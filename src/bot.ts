import "dotenv/config";

type JsonRpcResponse<T> = {
  result?: T;
  error?: { code: number; message: string };
};

type SignatureInfo = {
  signature: string;
  err: unknown;
  blockTime?: number;
};

type ParsedTransaction = {
  transaction: {
    message: {
      accountKeys: Array<string | { pubkey: string }>;
      instructions?: Array<{
        programId?: string;
        parsed?: { type?: string };
      }>;
    };
  };
  meta?: {
    logMessages?: string[];
    postTokenBalances?: Array<{ mint?: string }>;
  };
  blockTime?: number;
};

type GmgnToken = {
  address: string;
  symbol?: string;
  name?: string;
  banner?: string;
  migrated_timestamp?: number;
  total_fee?: string | number;
  market_cap?: string | number;
  marketcap?: string | number;
  fdv?: string | number;
  pool?: {
    exchange?: string;
    pool_address?: string;
  };
};

type GmgnMultiToken = {
  address: string;
  launchpad_platform?: string;
  migrated_timestamp?: number;
};

type GmgnTokenSecurity = {
  address: string;
  renounced_mint?: boolean;
  renounced_freeze_account?: boolean;
};

type GmgnMcapCandle = {
  time?: number;
  volume?: string | number;
};

type MeteoraPool = {
  pool_address?: string;
};

type MeteoraPoolType = "dlmm" | "damm_v2";
type PipelineAction = "defer" | "skip" | "pass" | "alert";
type PipelineStage = "launchpad" | "security" | "timestamp" | "volume" | "ratio" | "alert";

const HELIUS_API_KEY = mustGetEnv("HELIUS_API_KEY");
const TELEGRAM_BOT_TOKEN = mustGetEnv("TELEGRAM_BOT_TOKEN");
const TELEGRAM_CHAT_ID = mustGetEnv("TELEGRAM_CHAT_ID");
const BOT_STARTED_AT = Date.now();

const SCAN_INTERVAL_MS = Number(process.env.SCAN_INTERVAL_MS ?? "15000");
const FORWARD_ALL_MIGRATED =
  (process.env.FORWARD_ALL_MIGRATED ?? "false").toLowerCase() === "true";
const MIN_SOL_PER_10K_MC = Number(process.env.MIN_SOL_PER_10K_MC ?? "0.8");
const MAX_SOL_PER_10K_MC = Number(process.env.MAX_SOL_PER_10K_MC ?? "1");
const MIN_TWO_CANDLE_AVG_VOLUME = Number(
  process.env.MIN_TWO_CANDLE_AVG_VOLUME ?? "18000",
);
const PIPELINE_SUMMARY_EVERY_TICKS = Number(
  process.env.PIPELINE_SUMMARY_EVERY_TICKS ?? "20",
);
const DEBUG_CANDLE_SELECTION =
  (process.env.DEBUG_CANDLE_SELECTION ?? "false").toLowerCase() === "true";
const GMGN_RETRY_COUNT = Number(process.env.GMGN_RETRY_COUNT ?? "5");
const GMGN_RETRY_DELAY_MS = Number(process.env.GMGN_RETRY_DELAY_MS ?? "2500");
const WATCH_ADDRESSES = splitCsv(process.env.WATCH_ADDRESSES);
const WATCH_PROGRAM_IDS = new Set(splitCsv(process.env.WATCH_PROGRAM_IDS));

const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const GMGN_MULTI_INFO_URL = "https://gmgn.ai/api/v1/mutil_window_token_info";
const GMGN_MULTI_TOKEN_INFO_URL = "https://gmgn.ai/mrwapi/v1/multi_token_info";
const GMGN_TOKEN_SECURITY_URL = "https://gmgn.ai/api/v1/token_security_sol/sol";
const GMGN_TOKEN_MCAP_CANDLES_URL =
  "https://gmgn.ai/api/v1/token_mcap_candles/sol";
const GMGN_QUOTE_API_URL =
  "https://gmgn.ai/defi/quotation/v1/smartmoney/sol/walletstat";
const GMGN_QUOTE_WALLET =
  process.env.GMGN_QUOTE_WALLET ??
  "HVHAvzNxQUhvTWr5uoNNNfrQYfzcsReUFM4HnZwfeHkQ";
const METEORA_SEARCH_URL =
  "https://pool-discovery-api.datapi.meteora.ag/search";
const SOL_MINT = "So11111111111111111111111111111111111111112";

if (WATCH_ADDRESSES.length === 0) {
  throw new Error(
    "WATCH_ADDRESSES is required. Add one or more addresses in .env.",
  );
}

const newestSignatureByAddress = new Map<string, string>();
const seenMints = new Map<string, number>();
const deferredVolumeMints = new Set<string>();
const deferredVolumeCandidates = new Map<
  string,
  { signature: string; migratedTimestamp: number }
>();
const inFlightMints = new Set<string>();
let isScanTickRunning = false;
let telegramUpdateOffset = 0;
let telegramBotUsername = "";
let tickCounter = 0;
const pipelineCounters = new Map<string, number>();

async function main(): Promise<void> {
  console.log(`[boot] monitor start. interval=${SCAN_INTERVAL_MS}ms`);
  console.log(`[boot] watch addresses: ${WATCH_ADDRESSES.join(", ")}`);
  console.log(`[boot] forward all migrated=${FORWARD_ALL_MIGRATED}`);
  console.log(
    `[boot] ratio gate sol_per_10k_mc=${MIN_SOL_PER_10K_MC}..${MAX_SOL_PER_10K_MC}`,
  );
  console.log(`[boot] volume gate 2x1m avg >= ${MIN_TWO_CANDLE_AVG_VOLUME}`);
  console.log(`[boot] pipeline summary every ${PIPELINE_SUMMARY_EVERY_TICKS} ticks`);
  if (FORWARD_ALL_MIGRATED) {
    console.log(
      "[boot] ratio filter is DISABLED because FORWARD_ALL_MIGRATED=true",
    );
  }

  await bootstrapCursors();
  void startTelegramPingListener();
  setInterval(scanTick, SCAN_INTERVAL_MS);
  await scanTick();
}

async function bootstrapCursors(): Promise<void> {
  for (const address of WATCH_ADDRESSES) {
    const sigs = await getSignaturesForAddress(address, 1);
    if (sigs[0]?.signature) {
      newestSignatureByAddress.set(address, sigs[0].signature);
      console.log(`[bootstrap] cursor for ${address} = ${sigs[0].signature}`);
    } else {
      console.log(`[bootstrap] no recent signatures for ${address}`);
    }
  }
}

async function scanTick(): Promise<void> {
  if (isScanTickRunning) {
    return;
  }
  isScanTickRunning = true;
  try {
    pruneSeenMints();
    await processDeferredVolumeCandidates();
    for (const address of WATCH_ADDRESSES) {
      await scanAddress(address);
    }
    tickCounter += 1;
    maybePrintPipelineSummary();
  } catch (err) {
    console.error("[scan] tick error", err);
  } finally {
    isScanTickRunning = false;
  }
}

async function scanAddress(address: string): Promise<void> {
  const latestKnown = newestSignatureByAddress.get(address);
  const sigs = await getSignaturesForAddress(address, 50);
  if (sigs.length === 0) {
    return;
  }

  const newSigs: SignatureInfo[] = [];
  for (const sig of sigs) {
    if (sig.signature === latestKnown) {
      break;
    }
    newSigs.push(sig);
  }

  if (newSigs.length === 0) {
    return;
  }

  newestSignatureByAddress.set(address, sigs[0].signature);
  newSigs.reverse();

  for (const sig of newSigs) {
    if (sig.err) {
      continue;
    }
    await processSignature(sig.signature);
  }
}

async function processSignature(signature: string): Promise<void> {
  const tx = await getParsedTransaction(signature);
  if (!tx) {
    return;
  }

  const mints = extractMigratedMints(tx);
  for (const mint of mints) {
    if (seenMints.has(mint)) {
      continue;
    }
    seenMints.set(mint, Date.now());
    await processMintCandidate(mint, signature, undefined, "new");
  }
}

async function processDeferredVolumeCandidates(): Promise<void> {
  for (const [mint, candidate] of deferredVolumeCandidates.entries()) {
    await processMintCandidate(
      mint,
      candidate.signature,
      candidate.migratedTimestamp,
      "deferred",
    );
  }
}

async function processMintCandidate(
  mint: string,
  signature: string,
  migratedTimestampHint?: number,
  source: "new" | "deferred" = "new",
): Promise<void> {
  if (inFlightMints.has(mint)) {
    return;
  }
  inFlightMints.add(mint);
  try {
  const [gmgn, launchpadInfo, securityInfo, quotedMarketCap] =
    await Promise.all([
      fetchGmgnTokenWithRetry(mint),
      fetchGmgnLaunchpadInfo(mint),
      fetchGmgnTokenSecurity(mint),
      fetchGmgnQuoteMarketCap(mint),
    ]);

  if (launchpadInfo?.launchpad_platform === "pump_mayhem") {
    deferredVolumeCandidates.delete(mint);
    deferredVolumeMints.delete(mint);
    logPipeline("skip", "launchpad", mint, "launchpad_platform_pump_mayhem");
    return;
  }
  const hasSecurityFlags =
    typeof securityInfo?.renounced_mint === "boolean" &&
    typeof securityInfo?.renounced_freeze_account === "boolean";
  if (!hasSecurityFlags) {
    deferredVolumeCandidates.set(mint, {
      signature,
      migratedTimestamp: migratedTimestampHint ?? 0,
    });
    logPipeline("defer", "security", mint, "security_data_not_ready");
    return;
  }
  if (
    securityInfo?.renounced_mint === false ||
    securityInfo?.renounced_freeze_account === false
  ) {
    deferredVolumeCandidates.delete(mint);
    deferredVolumeMints.delete(mint);
    logPipeline(
      "skip",
      "security",
      mint,
      "renounce_gate_failed",
      `renounced_mint=${String(securityInfo?.renounced_mint)} renounced_freeze_account=${String(securityInfo?.renounced_freeze_account)}`,
    );
    return;
  }

  const migratedTimestamp =
    toNumber(launchpadInfo?.migrated_timestamp) ??
    toNumber(gmgn?.migrated_timestamp) ??
    migratedTimestampHint;
  if (!migratedTimestamp) {
    deferredVolumeCandidates.delete(mint);
    deferredVolumeMints.delete(mint);
    logPipeline("skip", "timestamp", mint, "missing_migrated_timestamp");
    return;
  }

  const twoCandleVolume = await fetchTwoCandleAverageVolume(
    mint,
    migratedTimestamp,
  );
  if (twoCandleVolume.status !== "ok") {
    deferredVolumeMints.add(mint);
    deferredVolumeCandidates.set(mint, { signature, migratedTimestamp });
    if (source === "new") {
      logPipeline(
        "defer",
        "volume",
        mint,
        "volume_waiting",
        `reason=${twoCandleVolume.reason}`,
      );
    }
    return;
  }
  if (deferredVolumeMints.has(mint)) {
    logPipeline(
      "pass",
      "volume",
      mint,
      "volume_ready_after_defer",
      `avg=${twoCandleVolume.average.toFixed(2)}`,
    );
  }
  if (twoCandleVolume.average < MIN_TWO_CANDLE_AVG_VOLUME) {
    deferredVolumeCandidates.delete(mint);
    if (deferredVolumeMints.has(mint)) {
      deferredVolumeMints.delete(mint);
      logPipeline(
        "skip",
        "volume",
        mint,
        "avg_below_threshold_after_defer",
        `avg=${twoCandleVolume.average.toFixed(2)} threshold=${MIN_TWO_CANDLE_AVG_VOLUME}`,
      );
      return;
    }
    logPipeline(
      "skip",
      "volume",
      mint,
      "avg_below_threshold",
      `avg=${twoCandleVolume.average.toFixed(2)} threshold=${MIN_TWO_CANDLE_AVG_VOLUME}`,
    );
    return;
  }
  if (deferredVolumeMints.has(mint)) {
    logPipeline(
      "pass",
      "volume",
      mint,
      "avg_above_threshold_after_defer",
      `avg=${twoCandleVolume.average.toFixed(2)}`,
    );
  }

  const totalFee = toNumber(gmgn?.total_fee);
  const marketCap =
    quotedMarketCap ??
    toNumber(gmgn?.market_cap) ??
    toNumber(gmgn?.marketcap) ??
    toNumber(gmgn?.fdv);
  if (!FORWARD_ALL_MIGRATED && !passesFeeMarketCapRatio(totalFee, marketCap)) {
    const solPer10kMc =
      totalFee !== null &&
      marketCap !== null &&
      totalFee > 0 &&
      marketCap > 0
        ? (totalFee * 10000) / marketCap
        : null;
    deferredVolumeCandidates.delete(mint);
    deferredVolumeMints.delete(mint);
    if (solPer10kMc === null) {
      logPipeline(
        "skip",
        "ratio",
        mint,
        "ratio_input_missing",
      );
    } else {
      logPipeline(
        "skip",
        "ratio",
        mint,
        "sol_per_10k_mc_out_of_range",
        `value=${solPer10kMc.toFixed(4)} expected=${MIN_SOL_PER_10K_MC}..${MAX_SOL_PER_10K_MC}`,
      );
    }
    return;
  }

  const [dlmmPool, dammV2Pool] = await Promise.all([
    searchMeteoraPoolByType(mint, "dlmm"),
    searchMeteoraPoolByType(mint, "damm_v2"),
  ]);
  const latestQuotedMarketCap = await fetchGmgnQuoteMarketCap(mint);
  const latestMarketCap = latestQuotedMarketCap ?? marketCap;
  await sendTelegramAlert(
    gmgn,
    mint,
    totalFee,
    latestMarketCap,
    dlmmPool,
    dammV2Pool,
    twoCandleVolume.average,
    signature,
  );
  deferredVolumeCandidates.delete(mint);
  if (deferredVolumeMints.has(mint)) {
    deferredVolumeMints.delete(mint);
    logPipeline("alert", "alert", mint, "sent_after_defer", `signature=${signature}`);
  } else {
    logPipeline("alert", "alert", mint, "sent", `signature=${signature}`);
  }
  } finally {
    inFlightMints.delete(mint);
  }
}

function logPipeline(
  action: PipelineAction,
  stage: PipelineStage,
  mint: string,
  reason: string,
  details?: string,
): void {
  const key = `${action}|${stage}|${reason}`;
  pipelineCounters.set(key, (pipelineCounters.get(key) ?? 0) + 1);
  const suffix = details ? ` ${details}` : "";
  console.log(`[${action}] ${mint} stage=${stage} reason=${reason}${suffix}`);
}

function maybePrintPipelineSummary(): void {
  if (PIPELINE_SUMMARY_EVERY_TICKS <= 0) {
    return;
  }
  if (tickCounter % PIPELINE_SUMMARY_EVERY_TICKS !== 0) {
    return;
  }
  const top = Array.from(pipelineCounters.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([k, v]) => `${k}:${v}`)
    .join(" | ");
  console.log(`[pipeline-summary] ticks=${tickCounter} ${top || "no-events"}`);
}

function extractMigratedMints(tx: ParsedTransaction): string[] {
  const logText = (tx.meta?.logMessages ?? []).join(" ").toLowerCase();
  const instructionTypes = (tx.transaction.message.instructions ?? [])
    .map((ix) => ix.parsed?.type?.toLowerCase() ?? "")
    .join(" ");
  const hasMigrationSignal =
    logText.includes("migrate") || instructionTypes.includes("migrate");

  const accountKeys = (tx.transaction.message.accountKeys ?? []).map((k) =>
    typeof k === "string" ? k : k.pubkey,
  );
  const hasWatchedProgram = accountKeys.some((k) => WATCH_PROGRAM_IDS.has(k));

  if (!hasMigrationSignal) {
    return [];
  }

  if (!hasWatchedProgram && WATCH_PROGRAM_IDS.size > 0) {
    return [];
  }

  const mints = new Set<string>();
  for (const b of tx.meta?.postTokenBalances ?? []) {
    if (!b.mint || b.mint === SOL_MINT) {
      continue;
    }
    mints.add(b.mint);
  }

  return Array.from(mints);
}

function passesFeeMarketCapRatio(
  totalFee: number | null,
  marketCap: number | null,
): boolean {
  if (
    totalFee === null ||
    marketCap === null ||
    totalFee <= 0 ||
    marketCap <= 0
  ) {
    return false;
  }
  const solPer10kMc = (totalFee * 10000) / marketCap;
  return solPer10kMc >= MIN_SOL_PER_10K_MC && solPer10kMc <= MAX_SOL_PER_10K_MC;
}

async function fetchGmgnToken(mint: string): Promise<GmgnToken | null> {
  const res = await fetch(GMGN_MULTI_INFO_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/plain, */*",
      Origin: "https://gmgn.ai",
      Referer: `https://gmgn.ai/sol/token/${mint}`,
      "User-Agent": "Mozilla/5.0",
    },
    body: JSON.stringify({
      chain: "sol",
      addresses: [mint],
    }),
  });

  if (!res.ok) {
    return null;
  }

  const json = (await res.json()) as { data?: GmgnToken[]; code?: number };
  if (json.code !== undefined && json.code !== 0) {
    return null;
  }
  return json.data?.[0] ?? null;
}

async function fetchGmgnTokenWithRetry(
  mint: string,
): Promise<GmgnToken | null> {
  for (let i = 0; i < GMGN_RETRY_COUNT; i += 1) {
    const token = await fetchGmgnToken(mint);
    if (token?.name || token?.symbol || token?.banner) {
      return token;
    }
    if (i < GMGN_RETRY_COUNT - 1) {
      await sleep(GMGN_RETRY_DELAY_MS);
    }
  }
  return null;
}

async function fetchGmgnLaunchpadInfo(
  mint: string,
): Promise<GmgnMultiToken | null> {
  const res = await fetch(GMGN_MULTI_TOKEN_INFO_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/plain, */*",
      Origin: "https://gmgn.ai",
      Referer: `https://gmgn.ai/sol/token/${mint}`,
      "User-Agent": "Mozilla/5.0",
    },
    body: JSON.stringify({
      chain: "sol",
      addresses: [mint],
    }),
  });

  if (!res.ok) {
    return null;
  }

  const json = (await res.json()) as { data?: GmgnMultiToken[]; code?: number };
  if (json.code !== undefined && json.code !== 0) {
    return null;
  }
  return json.data?.[0] ?? null;
}

async function fetchGmgnTokenSecurity(
  mint: string,
): Promise<GmgnTokenSecurity | null> {
  const res = await fetch(`${GMGN_TOKEN_SECURITY_URL}/${mint}`, {
    headers: {
      Accept: "application/json, text/plain, */*",
      Origin: "https://gmgn.ai",
      Referer: `https://gmgn.ai/sol/token/${mint}`,
      "User-Agent": "Mozilla/5.0",
    },
  });

  if (!res.ok) {
    return null;
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return null;
  }

  let json: { data?: GmgnTokenSecurity; code?: number };
  try {
    json = (await res.json()) as {
      data?: GmgnTokenSecurity;
      code?: number;
    };
  } catch {
    return null;
  }
  if (json.code !== undefined && json.code !== 0) {
    return null;
  }
  return json.data ?? null;
}

async function fetchGmgnQuoteMarketCap(mint: string): Promise<number | null> {
  const url = new URL(`${GMGN_QUOTE_API_URL}/${GMGN_QUOTE_WALLET}`);
  url.searchParams.set("token_address", mint);

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json, text/plain, */*",
      Origin: "https://gmgn.ai",
      Referer: `https://gmgn.ai/sol/token/${mint}`,
      "User-Agent": "Mozilla/5.0",
    },
  });

  if (!res.ok) {
    return null;
  }

  const json = (await res.json()) as {
    code?: number;
    data?: { market_cap?: unknown };
  };
  if (json.code !== undefined && json.code !== 0) {
    return null;
  }
  return toNumber(json.data?.market_cap);
}

async function fetchTwoCandleAverageVolume(
  mint: string,
  migratedTimestampSec: number,
): Promise<
  { status: "ok"; average: number } | { status: "not_ready"; reason: string }
> {
  const migratedCandleMs = Math.floor(migratedTimestampSec / 60) * 60 * 1000;
  const afterCandleMs = migratedCandleMs + 60_000;
  const thirdCandleMs = afterCandleMs + 60_000;

  const url = new URL(`${GMGN_TOKEN_MCAP_CANDLES_URL}/${mint}`);
  url.searchParams.set("pool_type", "tpool");
  url.searchParams.set("resolution", "1m");
  url.searchParams.set("limit", "20");

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json, text/plain, */*",
      Origin: "https://gmgn.ai",
      Referer: `https://gmgn.ai/sol/token/${mint}`,
      "User-Agent": "Mozilla/5.0",
    },
  });
  if (!res.ok) {
    return { status: "not_ready", reason: `candles_http_${res.status}` };
  }

  const json = (await res.json()) as {
    code?: number;
    data?: { list?: GmgnMcapCandle[] };
  };
  if (json.code !== undefined && json.code !== 0) {
    return { status: "not_ready", reason: `candles_code_${String(json.code)}` };
  }

  const list = Array.isArray(json.data?.list) ? json.data.list : [];
  const byTime = new Map<number, GmgnMcapCandle>();
  for (const c of list) {
    if (typeof c.time === "number") {
      byTime.set(c.time, c);
    }
  }

  const candle0 = byTime.get(migratedCandleMs);
  const candle1 = byTime.get(afterCandleMs);
  const candle2 = byTime.get(thirdCandleMs);
  if (!candle0 || !candle1 || !candle2) {
    return { status: "not_ready", reason: "candle_not_closed_yet" };
  }

  const v0 = toNumber(candle0.volume);
  const v1 = toNumber(candle1.volume);
  if (v0 === null || v1 === null) {
    return { status: "not_ready", reason: "candle_volume_missing" };
  }

  if (DEBUG_CANDLE_SELECTION) {
    console.log(
      `[candle] ${mint} migrated_ts=${migratedTimestampSec} candle0=${migratedCandleMs} vol0=${v0.toFixed(6)} candle1=${afterCandleMs} vol1=${v1.toFixed(6)} avg=${((v0 + v1) / 2).toFixed(6)}`,
    );
  }

  return { status: "ok", average: (v0 + v1) / 2 };
}

async function searchMeteoraPoolByType(
  mint: string,
  poolType: MeteoraPoolType,
): Promise<MeteoraPool | null> {
  const url = new URL(METEORA_SEARCH_URL);
  url.searchParams.set("page_size", "100");
  url.searchParams.set("query", mint);
  url.searchParams.set("sort_by", "volume_24h:desc,tvl:desc");
  url.searchParams.set(
    "filter_by",
    `is_blacklisted=false && pool_type=${poolType}`,
  );

  const res = await fetch(url.toString());
  if (!res.ok) {
    return null;
  }

  const json = (await res.json()) as { data?: MeteoraPool[] };
  const pools = Array.isArray(json.data) ? json.data : [];
  return pools.length > 0 ? pools[0] : null;
}

async function sendTelegramAlert(
  token: GmgnToken | null,
  mint: string,
  totalFee: number | null,
  marketCap: number | null,
  dlmmPool: MeteoraPool | null,
  dammV2Pool: MeteoraPool | null,
  twoCandleAvgVolume: number,
  signature: string,
): Promise<void> {
  const dlmmPoolAddress = dlmmPool?.pool_address ?? "None";
  const dammV2PoolAddress = dammV2Pool?.pool_address ?? "None";
  const gmgnLink = `https://gmgn.ai/sol/token/${mint}`;
  const dlmmLink =
    dlmmPoolAddress !== "None"
      ? `https://app.meteora.ag/dlmm/${dlmmPoolAddress}`
      : null;
  const dammV2Link =
    dammV2PoolAddress !== "None"
      ? `https://app.meteora.ag/dammv2/${dammV2PoolAddress}`
      : null;

  const quickActions = [`<a href="${gmgnLink}">GMGN</a>`];
  if (dlmmLink) {
    quickActions.push(`<a href="${dlmmLink}">Meteora DLMM</a>`);
  }
  if (dammV2Link) {
    quickActions.push(`<a href="${dammV2Link}">Meteora DAMMV2</a>`);
  }

  const text = [
    "<u>Token Details</u>",
    `CA: <code>${escapeHtml(mint)}</code>`,
    `Token Name: ${escapeHtml(token?.name ?? "Unknown")}`,
    `Token Symbol: ${escapeHtml(token?.symbol ?? "Unknown")}`,
    "",
    "<u>Token Stat</u>",
    `Total fee: ${fmtNum(totalFee)}`,
    `Market cap: ${fmtNum(marketCap)}`,
    `2x1m Avg Volume: ${fmtNum(twoCandleAvgVolume)}`,
    "",
    "<u>Meteora Pool</u>",
    `DLMM Pool: ${dlmmPoolAddress === "None" ? "None" : `<code>${escapeHtml(dlmmPoolAddress)}</code>`}`,
    `DAMMV2 Pool: ${dammV2PoolAddress === "None" ? "None" : `<code>${escapeHtml(dammV2PoolAddress)}</code>`}`,
    "",
    "<u>Quick Action</u>",
    ...quickActions,
  ].join("\n");

  const payloadBase = {
    chat_id: TELEGRAM_CHAT_ID,
    parse_mode: "HTML",
  };

  const res = token?.banner
    ? await sendTelegramPhotoWithFallback(token.banner, text, payloadBase)
    : await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payloadBase,
            text,
            disable_web_page_preview: false,
          }),
        },
      );

  if (!res.ok) {
    const body = await res.text();
    console.error("[telegram] send failed", body);
  }
}

async function sendTelegramPhotoWithFallback(
  bannerUrl: string,
  caption: string,
  payloadBase: { chat_id: string; parse_mode: string },
): Promise<Response> {
  try {
    const imageRes = await fetch(bannerUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!imageRes.ok) {
      throw new Error(`banner fetch http ${imageRes.status}`);
    }

    const contentType = imageRes.headers.get("content-type") ?? "image/jpeg";
    const imageBuffer = await imageRes.arrayBuffer();
    const form = new FormData();
    form.append("chat_id", payloadBase.chat_id);
    form.append("parse_mode", payloadBase.parse_mode);
    form.append("caption", caption);
    form.append(
      "photo",
      new Blob([imageBuffer], { type: contentType }),
      "banner.jpg",
    );

    return await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`,
      {
        method: "POST",
        body: form,
      },
    );
  } catch (err) {
    console.error("[telegram] banner upload fallback to text", err);
    return await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payloadBase,
          text: `${caption}\nBanner: ${bannerUrl}`,
          disable_web_page_preview: false,
        }),
      },
    );
  }
}

async function startTelegramPingListener(): Promise<void> {
  try {
    telegramBotUsername = await fetchTelegramBotUsername();
    console.log(`[telegram] ping listener enabled for @${telegramBotUsername}`);
  } catch (err) {
    console.error("[telegram] ping listener disabled (getMe failed)", err);
    return;
  }

  let polling = false;
  setInterval(async () => {
    if (polling) {
      return;
    }
    polling = true;
    try {
      await pollTelegramUpdates();
    } catch (err) {
      console.error("[telegram] poll error", err);
    } finally {
      polling = false;
    }
  }, 5000);
}

async function fetchTelegramBotUsername(): Promise<string> {
  const res = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`,
  );
  if (!res.ok) {
    throw new Error(`getMe http ${res.status}`);
  }
  const json = (await res.json()) as {
    ok?: boolean;
    result?: { username?: string };
  };
  const username = json.result?.username?.trim();
  if (!json.ok || !username) {
    throw new Error("getMe response missing username");
  }
  return username;
}

async function pollTelegramUpdates(): Promise<void> {
  const url = new URL(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates`,
  );
  url.searchParams.set("timeout", "0");
  url.searchParams.set("limit", "50");
  if (telegramUpdateOffset > 0) {
    url.searchParams.set("offset", String(telegramUpdateOffset));
  }

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`getUpdates http ${res.status}`);
  }

  const json = (await res.json()) as {
    ok?: boolean;
    result?: Array<{
      update_id: number;
      message?: { text?: string; chat?: { id?: number | string } };
    }>;
  };
  const updates = Array.isArray(json.result) ? json.result : [];
  for (const update of updates) {
    telegramUpdateOffset = Math.max(telegramUpdateOffset, update.update_id + 1);
    const text = update.message?.text ?? "";
    const chatId = update.message?.chat?.id;
    if (!text || chatId === undefined || chatId === null) {
      continue;
    }
    if (isTaggedPing(text)) {
      await respondPong(chatId);
    }
  }
}

function isTaggedPing(text: string): boolean {
  const lower = text.toLowerCase();
  const mention = `@${telegramBotUsername.toLowerCase()}`;
  return lower.includes("ping") && lower.includes(mention);
}

async function respondPong(chatId: number | string): Promise<void> {
  const uptimeSec = Math.floor((Date.now() - BOT_STARTED_AT) / 1000);
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: `pong\nuptime: ${uptimeSec}s`,
    }),
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getSignaturesForAddress(
  address: string,
  limit: number,
): Promise<SignatureInfo[]> {
  const result = await rpcCall<SignatureInfo[]>("getSignaturesForAddress", [
    address,
    { limit, commitment: "confirmed" },
  ]);
  return result ?? [];
}

async function getParsedTransaction(
  signature: string,
): Promise<ParsedTransaction | null> {
  return await rpcCall<ParsedTransaction>("getTransaction", [
    signature,
    {
      encoding: "jsonParsed",
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    },
  ]);
}

async function rpcCall<T>(
  method: string,
  params: unknown[],
): Promise<T | null> {
  const res = await fetch(HELIUS_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  });

  if (!res.ok) {
    throw new Error(`rpc http error ${res.status}`);
  }

  const json = (await res.json()) as JsonRpcResponse<T>;
  if (json.error) {
    throw new Error(`rpc ${method} error: ${json.error.message}`);
  }
  return json.result ?? null;
}

function splitCsv(input: string | undefined): string[] {
  return (input ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function toNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) {
    return v;
  }
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) {
      return n;
    }
  }
  return null;
}

function fmtNum(v: number | null): string {
  if (v === null) {
    return "Unknown";
  }
  if (v >= 1_000_000_000) {
    return `${(v / 1_000_000_000).toFixed(2)}B`;
  }
  if (v >= 1_000_000) {
    return `${(v / 1_000_000).toFixed(2)}M`;
  }
  if (v >= 1_000) {
    return `${(v / 1_000).toFixed(2)}K`;
  }
  return v.toFixed(4);
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function pruneSeenMints(): void {
  const now = Date.now();
  for (const [mint, ts] of seenMints.entries()) {
    if (now - ts > 1000 * 60 * 60 * 6) {
      seenMints.delete(mint);
    }
  }
}

function mustGetEnv(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`Missing env var: ${key}`);
  }
  return value;
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
