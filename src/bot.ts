import "dotenv/config";
import {
  buildScreenFeatures,
  scoreScreenFeatures,
  type CandlePoint,
  type ScreenFeatures,
  type ScreenScore,
  type ScreenerConfig,
} from "./screener.js";

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
  holder_count?: string | number;
  liquidity?: string | number;
  migrated_timestamp?: number;
  total_fee?: string | number;
  market_cap?: string | number;
  marketcap?: string | number;
  fdv?: string | number;
  price?: {
    price?: string | number;
    price_1m?: string | number;
    price_5m?: string | number;
    buys_1m?: number;
    sells_1m?: number;
    buys_5m?: number;
    sells_5m?: number;
    volume_1m?: string | number;
    volume_5m?: string | number;
    buy_volume_1m?: string | number;
    sell_volume_1m?: string | number;
    buy_volume_5m?: string | number;
    sell_volume_5m?: string | number;
    swaps_1m?: number;
    swaps_5m?: number;
    hot_level?: number;
  };
  visiting_count?: string | number;
  pool?: {
    exchange?: string;
    pool_address?: string;
    fee_ratio?: string | number;
  };
  dev?: {
    top_10_holder_rate?: string | number;
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
  top_10_holder_rate?: string | number;
  buy_tax?: string | number;
  sell_tax?: string | number;
  hide_risk?: boolean;
};

type GmgnTokenStat = {
  holder_count?: string | number;
  bluechip_owner_percentage?: string | number;
  top_bundler_trader_percentage?: string | number;
  top_entrapment_trader_percentage?: string | number;
  bot_degen_rate?: string | number;
  fresh_wallet_rate?: string | number;
  top_10_holder_rate?: string | number;
  dev_team_hold_rate?: string | number;
  creator_hold_rate?: string | number;
  creator_token_balance?: string | number;
  private_vault_hold_rate?: string | number;
};

type GmgnTagWalletCount = {
  smart_wallets?: number;
  fresh_wallets?: number;
  renowned_wallets?: number; // KOL wallets
  creator_wallets?: number;
  sniper_wallets?: number;
  rat_trader_wallets?: number;
  whale_wallets?: number;
  top_wallets?: number;
  following_wallets?: number;
  bundler_wallets?: number;
};

type GmgnTopBuyers = {
  holders?: {
    holder_count?: number;
    statusNow?: {
      hold?: number;
      bought_more?: number;
      sold_part?: number;
      sold?: number;
      transfered?: number;
      bought_rate?: string | number;
      holding_rate?: string | number;
    };
    holderInfo?: Array<{
      is_fast_sniper?: number;
    }>;
  };
};

type GmgnMcapCandle = {
  time?: number;
  open?: string | number;
  high?: string | number;
  low?: string | number;
  close?: string | number;
  volume?: string | number;
  amount?: string | number;
};

type MeteoraPool = {
  pool_address?: string;
};

type MeteoraPoolType = "dlmm" | "damm_v2";

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
const DEBUG_CANDLE_SELECTION =
  (process.env.DEBUG_CANDLE_SELECTION ?? "false").toLowerCase() === "true";
const GMGN_RETRY_COUNT = Number(process.env.GMGN_RETRY_COUNT ?? "5");
const SCREENER_CONFIG: ScreenerConfig = {
  minTwoCandleAvgVolume: Number(process.env.MIN_TWO_CANDLE_AVG_VOLUME ?? "18000"),
  minSolPer10kMc: Number(process.env.MIN_SOL_PER_10K_MC ?? "0.8"),
  maxSolPer10kMc: Number(process.env.MAX_SOL_PER_10K_MC ?? "1"),
  maxTop10HolderRate: Number(process.env.MAX_TOP10_HOLDER_RATE ?? "0.28"),
  maxCreatorHoldRate: Number(process.env.MAX_CREATOR_HOLD_RATE ?? "0.07"),
  maxBundlerRate: Number(process.env.MAX_BUNDLER_RATE ?? "0.45"),
  maxRatTraderRatio: Number(process.env.MAX_RAT_TRADER_RATIO ?? "0.08"),
  maxTopBuyerSoldRatio: Number(process.env.MAX_TOP_BUYER_SOLD_RATIO ?? "0.9"),
  maxBuyTax: Number(process.env.MAX_BUY_TAX ?? "0"),
  maxSellTax: Number(process.env.MAX_SELL_TAX ?? "0"),
  strongScoreThreshold: Number(process.env.STRONG_SCORE_THRESHOLD ?? "65"),
  tradeableScoreThreshold: Number(process.env.TRADEABLE_SCORE_THRESHOLD ?? "45"),
  watchScoreThreshold: Number(process.env.WATCH_SCORE_THRESHOLD ?? "25"),
  highRiskScoreThreshold: Number(process.env.HIGH_RISK_SCORE_THRESHOLD ?? "10"),
};
const GMGN_RETRY_DELAY_MS = Number(process.env.GMGN_RETRY_DELAY_MS ?? "2500");
const WATCH_ADDRESSES = splitCsv(process.env.WATCH_ADDRESSES);
const WATCH_PROGRAM_IDS = new Set(splitCsv(process.env.WATCH_PROGRAM_IDS));

const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const GMGN_MULTI_INFO_URL = "https://gmgn.ai/api/v1/mutil_window_token_info";
const GMGN_MULTI_TOKEN_INFO_URL = "https://gmgn.ai/mrwapi/v1/multi_token_info";
const GMGN_TOKEN_SECURITY_URL = "https://gmgn.ai/api/v1/token_security_sol/sol";
const GMGN_TOKEN_STAT_URL = "https://gmgn.ai/api/v1/token_stat/sol";
const GMGN_TAG_WALLET_COUNT_URL = "https://gmgn.ai/api/v1/token_wallet_tags_stat/sol";
const GMGN_TOP_BUYERS_URL = "https://gmgn.ai/defi/quotation/v1/tokens/top_buyers/sol";
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
let telegramUpdateOffset = 0;
let telegramBotUsername = "";

async function main(): Promise<void> {
  console.log(`[boot] monitor start. interval=${SCAN_INTERVAL_MS}ms`);
  console.log(`[boot] watch addresses: ${WATCH_ADDRESSES.join(", ")}`);
  console.log(`[boot] forward all migrated=${FORWARD_ALL_MIGRATED}`);
  console.log(
    `[boot] ratio gate sol_per_10k_mc=${MIN_SOL_PER_10K_MC}..${MAX_SOL_PER_10K_MC}`,
  );
  console.log(`[boot] volume gate 2x1m avg >= ${MIN_TWO_CANDLE_AVG_VOLUME}`);
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
  try {
    pruneSeenMints();
    await processDeferredVolumeCandidates();
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
  const [gmgn, launchpadInfo, securityInfo, tokenStat, tagWalletCount, topBuyers, quotedMarketCap] =
    await Promise.all([
      fetchGmgnTokenWithRetry(mint),
      fetchGmgnLaunchpadInfo(mint),
      fetchGmgnTokenSecurity(mint),
      fetchGmgnTokenStat(mint),
      fetchGmgnTagWalletCount(mint),
      fetchGmgnTopBuyers(mint),
      fetchGmgnQuoteMarketCap(mint),
    ]);

  if (launchpadInfo?.launchpad_platform === "pump_mayhem") {
    deferredVolumeCandidates.delete(mint);
    deferredVolumeMints.delete(mint);
    console.log(`[skip] ${mint} launchpad_platform=pump_mayhem`);
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
    console.log(`[defer] ${mint} security data not ready`);
    return;
  }
  if (
    securityInfo?.renounced_mint === false ||
    securityInfo?.renounced_freeze_account === false
  ) {
    deferredVolumeCandidates.delete(mint);
    deferredVolumeMints.delete(mint);
    console.log(
      `[skip] ${mint} security gate failed (renounced_mint=${String(
        securityInfo?.renounced_mint,
      )}, renounced_freeze_account=${String(
        securityInfo?.renounced_freeze_account,
      )})`,
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
    console.log(`[skip] ${mint} missing migrated_timestamp`);
    return;
  }

  const migrationCandles = await fetchMigrationCandles(mint, migratedTimestamp);
  if (migrationCandles.status !== "ok") {
    deferredVolumeMints.add(mint);
    deferredVolumeCandidates.set(mint, { signature, migratedTimestamp });
    if (source === "new") {
      console.log(
        `[defer] ${mint} volume gate waiting (${migrationCandles.reason})`,
      );
    }
    return;
  }
  if (deferredVolumeMints.has(mint)) {
    console.log(
      `[resume] ${mint} volume gate ready avg=${migrationCandles.average.toFixed(2)}`,
    );
  }
  if (migrationCandles.average < MIN_TWO_CANDLE_AVG_VOLUME) {
    deferredVolumeCandidates.delete(mint);
    if (deferredVolumeMints.has(mint)) {
      deferredVolumeMints.delete(mint);
      console.log(
        `[skip] ${mint} deferred token failed volume gate avg=${migrationCandles.average.toFixed(2)}`,
      );
      return;
    }
    console.log(
      `[skip] ${mint} volume gate failed avg=${migrationCandles.average.toFixed(2)}`,
    );
    return;
  }
  if (deferredVolumeMints.has(mint)) {
    console.log(
      `[pass] ${mint} deferred token passed volume gate avg=${migrationCandles.average.toFixed(2)}`,
    );
  }

  const totalFee = toNumber(gmgn?.total_fee);
  const marketCap =
    quotedMarketCap ??
    toNumber(gmgn?.market_cap) ??
    toNumber(gmgn?.marketcap) ??
    toNumber(gmgn?.fdv);
  if (!FORWARD_ALL_MIGRATED && !passesFeeMarketCapRatio(totalFee, marketCap)) {
    deferredVolumeCandidates.delete(mint);
    deferredVolumeMints.delete(mint);
    return;
  }

  const [dlmmPool, dammV2Pool] = await Promise.all([
    searchMeteoraPoolByType(mint, "dlmm"),
    searchMeteoraPoolByType(mint, "damm_v2"),
  ]);
  const latestQuotedMarketCap = await fetchGmgnQuoteMarketCap(mint);
  const latestMarketCap = latestQuotedMarketCap ?? marketCap;

  const topBuyersHolderInfo = Array.isArray(topBuyers?.holders?.holderInfo)
    ? topBuyers.holders.holderInfo
    : [];
  const fastSniperCount = topBuyersHolderInfo.filter(
    (h) => h.is_fast_sniper === 1,
  ).length;

  const features = buildScreenFeatures({
    mint,
    symbol: gmgn?.symbol ?? null,
    name: gmgn?.name ?? null,
    marketCap: latestMarketCap,
    liquidity: toNumber(gmgn?.liquidity),
    totalFee,
    holderCount: toNumber(tokenStat?.holder_count) ?? toNumber(gmgn?.holder_count),
    top10HolderRate:
      toNumber(tokenStat?.top_10_holder_rate) ??
      toNumber(securityInfo?.top_10_holder_rate) ??
      toNumber(gmgn?.dev?.top_10_holder_rate),
    creatorHoldRate: toNumber(tokenStat?.creator_hold_rate),
    devTeamHoldRate: toNumber(tokenStat?.dev_team_hold_rate),
    privateVaultHoldRate: toNumber(tokenStat?.private_vault_hold_rate),
    topBundlerTraderPercentage: toNumber(tokenStat?.top_bundler_trader_percentage),
    topEntrapmentTraderPercentage: toNumber(tokenStat?.top_entrapment_trader_percentage),
    freshWalletRate: toNumber(tokenStat?.fresh_wallet_rate),
    bluechipOwnerPercentage: toNumber(tokenStat?.bluechip_owner_percentage),
    botDegenRate: toNumber(tokenStat?.bot_degen_rate),
    smartWallets: tagWalletCount?.smart_wallets ?? null,
    freshWallets: tagWalletCount?.fresh_wallets ?? null,
    renownedWallets: tagWalletCount?.renowned_wallets ?? null,
    sniperWallets: tagWalletCount?.sniper_wallets ?? null,
    ratTraderWallets: tagWalletCount?.rat_trader_wallets ?? null,
    whaleWallets: tagWalletCount?.whale_wallets ?? null,
    topWallets: tagWalletCount?.top_wallets ?? null,
    fastSniperCount,
    topBuyersHolderCount: topBuyers?.holders?.holder_count ?? null,
    topBuyersSoldCount: topBuyers?.holders?.statusNow?.sold ?? null,
    topBuyersSoldPartCount: topBuyers?.holders?.statusNow?.sold_part ?? null,
    topBuyersHoldCount: topBuyers?.holders?.statusNow?.hold ?? null,
    topBuyersHoldingRate: toNumber(topBuyers?.holders?.statusNow?.holding_rate),
    topBuyersBoughtRate: toNumber(topBuyers?.holders?.statusNow?.bought_rate),
    buyTax: toNumber(securityInfo?.buy_tax),
    sellTax: toNumber(securityInfo?.sell_tax),
    hideRisk: securityInfo?.hide_risk ?? null,
    renouncedMint: securityInfo?.renounced_mint ?? null,
    renouncedFreezeAccount: securityInfo?.renounced_freeze_account ?? null,
    launchpadPlatform: launchpadInfo?.launchpad_platform ?? null,
    hasDlmmPool: Boolean(dlmmPool?.pool_address),
    hasDammV2Pool: Boolean(dammV2Pool?.pool_address),
    priceNow: toNumber(gmgn?.price?.price),
    price1m: toNumber(gmgn?.price?.price_1m),
    price5m: toNumber(gmgn?.price?.price_5m),
    buys1m: gmgn?.price?.buys_1m ?? null,
    sells1m: gmgn?.price?.sells_1m ?? null,
    buys5m: gmgn?.price?.buys_5m ?? null,
    sells5m: gmgn?.price?.sells_5m ?? null,
    volume1m: toNumber(gmgn?.price?.volume_1m),
    volume5m: toNumber(gmgn?.price?.volume_5m),
    buyVolume1m: toNumber(gmgn?.price?.buy_volume_1m),
    sellVolume1m: toNumber(gmgn?.price?.sell_volume_1m),
    buyVolume5m: toNumber(gmgn?.price?.buy_volume_5m),
    sellVolume5m: toNumber(gmgn?.price?.sell_volume_5m),
    swaps1m: gmgn?.price?.swaps_1m ?? null,
    swaps5m: gmgn?.price?.swaps_5m ?? null,
    hotLevel: gmgn?.price?.hot_level ?? null,
    visitingCount: toNumber(gmgn?.visiting_count),
    candles: migrationCandles.candles,
  });
  const score = scoreScreenFeatures(features, SCREENER_CONFIG);
  if (score.rejectReasons.length > 0) {
    deferredVolumeCandidates.delete(mint);
    deferredVolumeMints.delete(mint);
    console.log(`[skip] ${mint} hard reject: ${score.rejectReasons.join(", ")}`);
    return;
  }

  await sendTelegramAlert(
    gmgn,
    mint,
    totalFee,
    latestMarketCap,
    dlmmPool,
    dammV2Pool,
    migrationCandles.average,
    signature,
    features,
    score,
  );
  deferredVolumeCandidates.delete(mint);
  if (deferredVolumeMints.has(mint)) {
    deferredVolumeMints.delete(mint);
    console.log(`[alert] sent for ${mint} from ${signature} (after defer)`);
  } else {
    console.log(`[alert] sent for ${mint} from ${signature}`);
  }
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

async function fetchGmgnTokenStat(
  mint: string,
): Promise<GmgnTokenStat | null> {
  const res = await fetch(`${GMGN_TOKEN_STAT_URL}/${mint}`, {
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

  let json: { data?: GmgnTokenStat; code?: number };
  try {
    json = (await res.json()) as { data?: GmgnTokenStat; code?: number };
  } catch {
    return null;
  }
  if (json.code !== undefined && json.code !== 0) {
    return null;
  }
  return json.data ?? null;
}

async function fetchGmgnTagWalletCount(
  mint: string,
): Promise<GmgnTagWalletCount | null> {
  const res = await fetch(`${GMGN_TAG_WALLET_COUNT_URL}/${mint}`, {
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

  let json: { data?: GmgnTagWalletCount; code?: number };
  try {
    json = (await res.json()) as { data?: GmgnTagWalletCount; code?: number };
  } catch {
    return null;
  }
  if (json.code !== undefined && json.code !== 0) {
    return null;
  }
  return json.data ?? null;
}

async function fetchGmgnTopBuyers(
  mint: string,
): Promise<GmgnTopBuyers | null> {
  const res = await fetch(`${GMGN_TOP_BUYERS_URL}/${mint}`, {
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

  let json: { data?: GmgnTopBuyers; code?: number };
  try {
    json = (await res.json()) as { data?: GmgnTopBuyers; code?: number };
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

async function fetchMigrationCandles(
  mint: string,
  migratedTimestampSec: number,
): Promise<
  | {
      status: "ok";
      average: number;
      candles: [CandlePoint, CandlePoint, CandlePoint];
    }
  | { status: "not_ready"; reason: string }
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

  const parsed = [candle0, candle1, candle2].map((c) => ({
    time: c.time as number,
    open: toNumber(c.open),
    high: toNumber(c.high),
    low: toNumber(c.low),
    close: toNumber(c.close),
    volume: toNumber(c.volume),
    amount: toNumber(c.amount),
  }));

  if (parsed.some((c) => c.open === null || c.high === null || c.low === null || c.close === null || c.volume === null)) {
    return { status: "not_ready", reason: "candle_value_missing" };
  }

  const normalized = parsed.map((c) => ({
    time: c.time,
    open: c.open as number,
    high: c.high as number,
    low: c.low as number,
    close: c.close as number,
    volume: c.volume as number,
    amount: c.amount,
  })) as [CandlePoint, CandlePoint, CandlePoint];

  if (DEBUG_CANDLE_SELECTION) {
    console.log(
      `[candle] ${mint} migrated_ts=${migratedTimestampSec} candle0=${migratedCandleMs} vol0=${normalized[0].volume.toFixed(6)} candle1=${afterCandleMs} vol1=${normalized[1].volume.toFixed(6)} avg=${((normalized[0].volume + normalized[1].volume) / 2).toFixed(6)}`,
    );
  }

  return {
    status: "ok",
    average: (normalized[0].volume + normalized[1].volume) / 2,
    candles: normalized,
  };
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
  features: ScreenFeatures,
  score: ScreenScore,
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

  const compactReasons = score.reasons.slice(0, 4).join(" | ") || "n/a";
  const greenFlags = score.greenFlags.slice(0, 3).join(" | ") || "n/a";
  const redFlags = score.redFlags.slice(0, 3).join(" | ") || "n/a";

  const text = [
    `<b>${escapeHtml(score.verdict.toUpperCase())}</b> · <b>${score.finalScore}</b>`,
    `${escapeHtml(token?.symbol ?? "Unknown")} — <code>${escapeHtml(mint)}</code>`,
    "",
    `<b>Why:</b> ${escapeHtml(compactReasons)}`,
    `<b>Green:</b> ${escapeHtml(greenFlags)}`,
    `<b>Red:</b> ${escapeHtml(redFlags)}`,
    "",
    `<b>Stats</b>`,
    `MC: ${fmtNum(marketCap)} | Fee: ${fmtNum(totalFee)} | Ratio: ${features.solPer10kMc === null ? "Unknown" : features.solPer10kMc.toFixed(3)}`,
    `2C Avg Vol: ${fmtNum(twoCandleAvgVolume)} | B/S 1m: ${features.buySellRatio1m === null ? "Unknown" : features.buySellRatio1m.toFixed(2)}`,
    `Top10: ${features.top10HolderRate === null ? "Unknown" : `${(features.top10HolderRate * 100).toFixed(1)}%`} | Top buyers sold: ${features.topBuyersHolderCount && features.topBuyersSoldCount !== null ? `${((features.topBuyersSoldCount / features.topBuyersHolderCount) * 100).toFixed(1)}%` : "Unknown"}`,
    `Smart: ${features.smartWallets === null ? "Unknown" : String(features.smartWallets)} | Rat: ${features.ratTraderWallets === null ? "Unknown" : String(features.ratTraderWallets)} | Fast snipers: ${features.fastSniperCount === null ? "Unknown" : String(features.fastSniperCount)}`,
    "",
    `<b>Pools</b> DLMM: ${dlmmPoolAddress === "None" ? "None" : `<code>${escapeHtml(dlmmPoolAddress)}</code>`}`,
    `DAMMV2: ${dammV2PoolAddress === "None" ? "None" : `<code>${escapeHtml(dammV2PoolAddress)}</code>`}`,
    "",
    `<b>Links</b>`,
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
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`);
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
  const url = new URL(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates`);
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
