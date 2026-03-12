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
  total_fee?: string | number;
  market_cap?: string | number;
  marketcap?: string | number;
  fdv?: string | number;
  pool?: {
    exchange?: string;
    pool_address?: string;
  };
};

type MeteoraPool = {
  pool_address?: string;
  address?: string;
};

const HELIUS_API_KEY = mustGetEnv("HELIUS_API_KEY");
const TELEGRAM_BOT_TOKEN = mustGetEnv("TELEGRAM_BOT_TOKEN");
const TELEGRAM_CHAT_ID = mustGetEnv("TELEGRAM_CHAT_ID");

const SCAN_INTERVAL_MS = Number(process.env.SCAN_INTERVAL_MS ?? "15000");
const MIN_MC_PER_SOL_FEE = Number(process.env.MIN_MC_PER_SOL_FEE ?? "10000");
const WATCH_ADDRESSES = splitCsv(process.env.WATCH_ADDRESSES);
const WATCH_PROGRAM_IDS = new Set(splitCsv(process.env.WATCH_PROGRAM_IDS));

const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const GMGN_MULTI_INFO_URL = "https://gmgn.ai/api/v1/mutil_window_token_info";
const METEORA_SEARCH_URL = "https://pool-discovery-api.datapi.meteora.ag/search";
const SOL_MINT = "So11111111111111111111111111111111111111112";

if (WATCH_ADDRESSES.length === 0) {
  throw new Error("WATCH_ADDRESSES is required. Add one or more addresses in .env.");
}

const newestSignatureByAddress = new Map<string, string>();
const seenMints = new Map<string, number>();

async function main(): Promise<void> {
  console.log(`[boot] monitor start. interval=${SCAN_INTERVAL_MS}ms`);
  console.log(`[boot] watch addresses: ${WATCH_ADDRESSES.join(", ")}`);

  await bootstrapCursors();
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
  try {
    pruneSeenMints();
    for (const address of WATCH_ADDRESSES) {
      await scanAddress(address);
    }
  } catch (err) {
    console.error("[scan] tick error", err);
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

  const mints = extractCandidateMints(tx);
  for (const mint of mints) {
    if (seenMints.has(mint)) {
      continue;
    }
    seenMints.set(mint, Date.now());

    const gmgn = await fetchGmgnToken(mint);
    if (!gmgn) {
      continue;
    }

    const totalFee = toNumber(gmgn.total_fee);
    const marketCap = toNumber(gmgn.market_cap) ?? toNumber(gmgn.marketcap) ?? toNumber(gmgn.fdv);
    if (!passesFeeMarketCapRatio(totalFee, marketCap)) {
      continue;
    }

    const pool = await searchMeteoraDlmmPool(mint);
    await sendTelegramAlert(gmgn, mint, totalFee, marketCap, pool);
    console.log(`[alert] sent for ${mint}`);
  }
}

function extractCandidateMints(tx: ParsedTransaction): string[] {
  const logText = (tx.meta?.logMessages ?? []).join(" ").toLowerCase();
  const hasBondingSignal =
    logText.includes("migrate") ||
    logText.includes("bond") ||
    logText.includes("initialize_pool") ||
    logText.includes("create_pool");

  const accountKeys = (tx.transaction.message.accountKeys ?? []).map((k) =>
    typeof k === "string" ? k : k.pubkey,
  );
  const hasWatchedProgram = accountKeys.some((k) => WATCH_PROGRAM_IDS.has(k));

  if (!hasBondingSignal && !hasWatchedProgram && WATCH_PROGRAM_IDS.size > 0) {
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

function passesFeeMarketCapRatio(totalFee: number | null, marketCap: number | null): boolean {
  if (totalFee === null || marketCap === null || totalFee <= 0 || marketCap <= 0) {
    return false;
  }
  return marketCap / totalFee >= MIN_MC_PER_SOL_FEE;
}

async function fetchGmgnToken(mint: string): Promise<GmgnToken | null> {
  const res = await fetch(GMGN_MULTI_INFO_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Referer: `https://gmgn.ai/sol/token/${mint}`,
    },
    body: JSON.stringify({
      chain: "sol",
      addresses: [mint],
    }),
  });

  if (!res.ok) {
    return null;
  }

  const json = (await res.json()) as { data?: GmgnToken[] };
  return json.data?.[0] ?? null;
}

async function searchMeteoraDlmmPool(mint: string): Promise<MeteoraPool | null> {
  const url = new URL(METEORA_SEARCH_URL);
  url.searchParams.set("page_size", "100");
  url.searchParams.set("query", mint);
  url.searchParams.set("sort_by", "volume_24h:desc,tvl:desc");
  url.searchParams.set("filter_by", "is_blacklisted=false && pool_type=dlmm");

  const res = await fetch(url.toString());
  if (!res.ok) {
    return null;
  }

  const json = (await res.json()) as { data?: MeteoraPool[]; pools?: MeteoraPool[] };
  const pools = json.data ?? json.pools ?? [];
  return pools[0] ?? null;
}

async function sendTelegramAlert(
  token: GmgnToken,
  mint: string,
  totalFee: number | null,
  marketCap: number | null,
  pool: MeteoraPool | null,
): Promise<void> {
  const poolAddress = pool?.pool_address ?? pool?.address ?? token.pool?.pool_address ?? "None";
  const gmgnLink = `https://gmgn.ai/sol/token/${mint}`;
  const meteoraLink =
    poolAddress === "None" ? "None" : `https://app.meteora.ag/dlmm/${poolAddress}`;

  const text = [
    token.banner ? `<a href="${escapeHtml(token.banner)}">Token Banner</a>` : "Token Banner",
    "",
    "<u>Token Details</u>",
    `CA: <code>${escapeHtml(mint)}</code>`,
    `Token Name: ${escapeHtml(token.name ?? "Unknown")}`,
    `Token Symbol: ${escapeHtml(token.symbol ?? "Unknown")}`,
    "",
    "<u>Token Stat</u>",
    `Total fee: ${fmtNum(totalFee)}`,
    `Market cap: ${fmtNum(marketCap)}`,
    "",
    "<u>Pool Details</u>",
    `Pool Address: ${poolAddress === "None" ? "None" : `<code>${escapeHtml(poolAddress)}</code>`}`,
    "",
    "<u>Quick Action</u>",
    `<a href="${gmgnLink}">GMGN</a>`,
    meteoraLink === "None" ? "Meteora: None" : `<a href="${meteoraLink}">Meteora</a>`,
  ].join("\n");

  const tgUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const res = await fetch(tgUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: false,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("[telegram] send failed", body);
  }
}

async function getSignaturesForAddress(address: string, limit: number): Promise<SignatureInfo[]> {
  const result = await rpcCall<SignatureInfo[]>("getSignaturesForAddress", [
    address,
    { limit, commitment: "confirmed" },
  ]);
  return result ?? [];
}

async function getParsedTransaction(signature: string): Promise<ParsedTransaction | null> {
  return await rpcCall<ParsedTransaction>("getTransaction", [
    signature,
    {
      encoding: "jsonParsed",
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    },
  ]);
}

async function rpcCall<T>(method: string, params: unknown[]): Promise<T | null> {
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
