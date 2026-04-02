import "dotenv/config";
import fs from "fs";
import path from "path";
import {
  buildScreenFeatures,
  scoreScreenFeatures,
  type CandlePoint,
  type ScreenFeatures,
  type ScreenScore,
  type ScreenerConfig,
} from "./screener.js";
import {
  buildCandidateRow,
  buildPreCandidateRow,
  logCandidateRow,
  logOutcomeRow,
  logPreCandidateRow,
  type CandidateDatasetRow,
} from "./dataset.js";

type JsonRpcResponse<T> = {
  result?: T;
  error?: { code: number; message: string };
};

type ProgramAccountInfo = {
  pubkey: string;
  account: {
    data?: [string, string] | string;
  };
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
        accounts?: string[];
        data?: string;
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
  volume_1m?: string | number;
  volume_5m?: string | number;
  banner?: string;
  holder_count?: string | number;
  liquidity?: string | number;
  launchpad?: string;
  launchpad_platform?: string;
  exchange?: string;
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
  launchpad?: string;
  launchpad_platform?: string;
  exchange?: string;
  migrated_timestamp?: number;
};

type GmgnTrendingToken = {
  address: string;
  symbol?: string;
  name?: string;
  logo?: string;
  market_cap?: string | number;
  gas_fee?: string | number;
  liquidity?: string | number;
  volume?: string | number;
  creation_timestamp?: number;
  launchpad?: string;
  launchpad_platform?: string;
  exchange?: string;
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
  name?: string;
  mint_x?: string;
  mint_y?: string;
  mint_x_symbol?: string;
  mint_y_symbol?: string;
  bin_step?: string | number;
  fee_pct?: string | number;
  base_fee_percentage?: string | number;
  dlmm_params?: {
    bin_step?: string | number;
    base_fee_percentage?: string | number;
  };
  token_x?: { address?: string; symbol?: string };
  token_y?: { address?: string; symbol?: string };
};

type MeteoraPoolType = "dlmm" | "damm_v2";
type AlertKind = "migration" | "gmgn_trending" | "lp_wallet_tracker" | "new_dlmm_pool";
type LaunchSource = "pumpfun" | "letsbonk" | "meteora_curve" | "unknown";

type TrackedLpWallet = {
  address: string;
  label: string;
  enabled?: boolean;
  group?: string;
  priority?: number;
  notes?: string;
};

type TrackedLpWalletFileRow = {
  address?: string;
  label?: string;
  enabled?: boolean;
  group?: string;
  priority?: number;
  notes?: string;
};

type TrackedLpWalletFileSchema = {
  version?: number;
  defaults?: {
    enabled?: boolean;
    group?: string;
    priority?: number;
  };
  wallets?: TrackedLpWalletFileRow[];
};

type LpWalletTrackerStateFile = {
  version: number;
  updatedAt: string;
  wallets: Record<string, { knownPositions: string[] }>;
};

type DlmmPositionAccount = {
  pubkey: string;
  account: {
    data?: [string, string] | string;
  };
};

type GetProgramAccountsV2Page = {
  accounts?: DlmmPositionAccount[];
  cursor?: string | null;
};

type TrackedWalletPosition = {
  walletAddress: string;
  walletLabel: string;
  positionAddress: string;
  poolAddress: string;
  pairLabel?: string | null;
  poolBinStep?: number | null;
  poolFeePct?: number | null;
  lowerBinId?: number | null;
  upperBinId?: number | null;
  activeBinId?: number | null;
  totalValueUsd?: number | null;
  totalValueSol?: number | null;
  strategy?: string | null;
  depositTokenXAmount?: number | null;
  depositTokenYAmount?: number | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  gmgTokenMint?: string | null;
};

type DlmmPnlApiPosition = {
  positionAddress?: string;
  address?: string;
  position?: string;
  tokenXSymbol?: string;
  tokenYSymbol?: string;
  tokenXMint?: string;
  tokenYMint?: string;
  mintX?: string;
  mintY?: string;
  lowerBinId?: number;
  upperBinId?: number;
  poolActiveBinId?: number;
  strategy?: string;
  totalValueUsd?: string | number;
  totalValue?: string | number;
  totalPositionValue?: string | number;
  priceLower?: string | number;
  priceUpper?: string | number;
  minPrice?: string | number;
  maxPrice?: string | number;
  tokenX?: { symbol?: string; address?: string; mint?: string };
  tokenY?: { symbol?: string; address?: string; mint?: string };
  allTimeDeposits?: {
    tokenX?: { amount?: string | number; usd?: string | number; amountSol?: string | number };
    tokenY?: { amount?: string | number; usd?: string | number; amountSol?: string | number };
    total?: { usd?: string | number; sol?: string | number };
  };
  unrealizedPnl?: {
    balances?: string | number;
    balancesSol?: string | number;
  };
};
type PipelineAction = "defer" | "skip" | "pass" | "alert";
type PipelineStage =
  | "launchpad"
  | "security"
  | "timestamp"
  | "volume"
  | "ratio"
  | "alert";

const HELIUS_API_KEY = mustGetEnv("HELIUS_API_KEY");
const TELEGRAM_BOT_TOKEN = mustGetEnv("TELEGRAM_BOT_TOKEN");
const TELEGRAM_CHAT_ID = mustGetEnv("TELEGRAM_CHAT_ID");
const TELEGRAM_ALLOWED_USER_ID = process.env.TELEGRAM_ALLOWED_USER_ID?.trim() ?? "";
const DLMM_PROGRAM_ID = "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo";
const TELEGRAM_MIGRATION_THREAD_ID = parseOptionalNumber(
  process.env.TELEGRAM_MIGRATION_THREAD_ID,
);
const TELEGRAM_TRENDING_THREAD_ID = parseOptionalNumber(
  process.env.TELEGRAM_TRENDING_THREAD_ID,
);
const TELEGRAM_LP_WALLET_THREAD_ID = parseOptionalNumber(
  process.env.TELEGRAM_LP_WALLET_THREAD_ID,
);
const TELEGRAM_NEW_DLMM_POOL_THREAD_ID = parseOptionalNumber(
  process.env.TELEGRAM_NEW_DLMM_POOL_THREAD_ID,
);
const BOT_STARTED_AT = Date.now();
const DLMM_INIT_LB_PAIR2_DISCRIMINATOR_HEX = "493b2478ed536cc6";

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
const SCREENER_CONFIG: ScreenerConfig = {
  minTwoCandleAvgVolume: Number(
    process.env.MIN_TWO_CANDLE_AVG_VOLUME ?? "18000",
  ),
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
  tradeableScoreThreshold: Number(
    process.env.TRADEABLE_SCORE_THRESHOLD ?? "45",
  ),
  watchScoreThreshold: Number(process.env.WATCH_SCORE_THRESHOLD ?? "25"),
  highRiskScoreThreshold: Number(process.env.HIGH_RISK_SCORE_THRESHOLD ?? "10"),
};
const GMGN_RETRY_DELAY_MS = Number(process.env.GMGN_RETRY_DELAY_MS ?? "2500");
const ENABLE_GMGN_TRENDING =
  (process.env.ENABLE_GMGN_TRENDING ?? "false").toLowerCase() === "true";
const GMGN_TRENDING_INTERVAL_MS = Number(
  process.env.GMGN_TRENDING_INTERVAL_MS ?? "60000",
);
const ENABLE_LP_WALLET_TRACKER =
  (process.env.ENABLE_LP_WALLET_TRACKER ?? "false").toLowerCase() === "true";
const ENABLE_NEW_DLMM_POOL_TRACKER =
  (process.env.ENABLE_NEW_DLMM_POOL_TRACKER ?? "false").toLowerCase() === "true";
const LP_WALLET_TRACKER_INTERVAL_MS = Number(
  process.env.LP_WALLET_TRACKER_INTERVAL_MS ?? "60000",
);
const NEW_DLMM_POOL_MIN_VOLUME = Number(
  process.env.NEW_DLMM_POOL_MIN_VOLUME ?? "5000",
);
const LP_WALLET_ENRICHMENT_RETRY_COUNT = Number(
  process.env.LP_WALLET_ENRICHMENT_RETRY_COUNT ?? "3",
);
const LP_WALLET_ENRICHMENT_RETRY_DELAY_MS = Number(
  process.env.LP_WALLET_ENRICHMENT_RETRY_DELAY_MS ?? "5000",
);
const LP_WALLET_SHARD_COUNT = Math.max(
  1,
  Number(process.env.LP_WALLET_SHARD_COUNT ?? "1"),
);
const METEORA_POOL_META_CACHE_TTL_MS = Number(
  process.env.METEORA_POOL_META_CACHE_TTL_MS ?? "3600000",
);
const LP_TRACKED_WALLETS_FILE =
  process.env.LP_TRACKED_WALLETS_FILE ?? path.join(process.cwd(), "tracked-lp-wallets.json");
const LP_TRACKED_WALLETS = loadTrackedLpWallets();
const WATCH_ADDRESSES = splitCsv(process.env.WATCH_ADDRESSES);
const WATCH_PROGRAM_IDS = new Set(splitCsv(process.env.WATCH_PROGRAM_IDS));
const OUTCOME_HORIZONS_MINUTES = splitCsv(
  process.env.OUTCOME_HORIZONS_MINUTES ?? "5,15,60",
)
  .map((v) => Number(v))
  .filter((v) => Number.isFinite(v) && v > 0)
  .sort((a, b) => a - b);
const OUTCOME_POLL_INTERVAL_MS = Number(
  process.env.OUTCOME_POLL_INTERVAL_MS ?? "60000",
);

const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const GMGN_MULTI_INFO_URL = "https://gmgn.ai/api/v1/mutil_window_token_info";
const GMGN_MULTI_TOKEN_INFO_URL = "https://gmgn.ai/mrwapi/v1/multi_token_info";
const GMGN_TOKEN_SECURITY_URL = "https://gmgn.ai/api/v1/token_security_sol/sol";
const GMGN_TOKEN_STAT_URL = "https://gmgn.ai/api/v1/token_stat/sol";
const GMGN_TAG_WALLET_COUNT_URL =
  "https://gmgn.ai/api/v1/token_wallet_tags_stat/sol";
const GMGN_TOP_BUYERS_URL =
  "https://gmgn.ai/defi/quotation/v1/tokens/top_buyers/sol";
const GMGN_TOKEN_MCAP_CANDLES_URL =
  "https://gmgn.ai/api/v1/token_mcap_candles/sol";
const GMGN_QUOTE_API_URL =
  "https://gmgn.ai/defi/quotation/v1/smartmoney/sol/walletstat";
const GMGN_TRENDING_URL = "https://gmgn.ai/api/v1/rank/sol/swaps/1m";
const GMGN_QUOTE_WALLET =
  process.env.GMGN_QUOTE_WALLET ??
  "HVHAvzNxQUhvTWr5uoNNNfrQYfzcsReUFM4HnZwfeHkQ";
const METEORA_SEARCH_URL =
  "https://pool-discovery-api.datapi.meteora.ag/search";
const METEORA_DLMM_PNL_URL = "https://dlmm.datapi.meteora.ag/positions";
const SOL_MINT = "So11111111111111111111111111111111111111112";
const BONK_MIGRATION_PROGRAM_ID = "LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj";
const BONK_MIGRATION_MINT_ACCOUNT_INDEX = 1;
const METEORA_CURVE_MIGRATION_PROGRAM_ID =
  "dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN";
const METEORA_CURVE_MIGRATION_MINT_ACCOUNT_INDEX = 13;
const METEORA_DLMM_PROGRAM_ID = "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo";

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
const pendingOutcomes = new Map<
  string,
  {
    row: CandidateDatasetRow;
    horizonsRemaining: number[];
    nextCheckAt: number;
  }
>();
const loggedPreCandidateDrops = new Set<string>();
const loggedSecurityNotReadyMints = new Set<string>();
const seenTrendingMints = new Map<string, number>();
const trackedLpWalletPositionKeysByWallet = new Map<string, Set<string>>();
const meteoraPoolMetaCache = new Map<
  string,
  { value: MeteoraPool | null; expiresAt: number }
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
  console.log(
    `[boot] pipeline summary every ${PIPELINE_SUMMARY_EVERY_TICKS} ticks`,
  );
  console.log(
    `[boot] gmgn trending enabled=${ENABLE_GMGN_TRENDING} interval=${GMGN_TRENDING_INTERVAL_MS}ms`,
  );
  console.log(
    `[boot] lp wallet tracker enabled=${ENABLE_LP_WALLET_TRACKER} interval=${LP_WALLET_TRACKER_INTERVAL_MS}ms wallets=${LP_TRACKED_WALLETS.length}`,
  );
  console.log(
    `[boot] new dlmm pool tracker enabled=${ENABLE_NEW_DLMM_POOL_TRACKER} min_volume=${NEW_DLMM_POOL_MIN_VOLUME}`,
  );
  console.log(
    `[boot] lp enrichment retry count=${LP_WALLET_ENRICHMENT_RETRY_COUNT} delay=${LP_WALLET_ENRICHMENT_RETRY_DELAY_MS}ms`,
  );
  console.log(`[boot] lp wallet shard count=${LP_WALLET_SHARD_COUNT}`);
  console.log(
    `[boot] meteora pool meta cache ttl=${METEORA_POOL_META_CACHE_TTL_MS}ms`,
  );
  if (FORWARD_ALL_MIGRATED) {
    console.log(
      "[boot] ratio filter is DISABLED because FORWARD_ALL_MIGRATED=true",
    );
  }

  await bootstrapCursors();
  await bootstrapTrackedLpWalletPositions();
  void startTelegramPingListener();
  setInterval(scanTick, SCAN_INTERVAL_MS);
  setInterval(processPendingOutcomes, OUTCOME_POLL_INTERVAL_MS);
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

function getOrderedLpTrackedWallets(): TrackedLpWallet[] {
  return [...LP_TRACKED_WALLETS].sort((a, b) => {
    const aPriority = a.priority ?? 100;
    const bPriority = b.priority ?? 100;
    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }
    return a.label.localeCompare(b.label);
  });
}

function getLpWalletShardForTick(tick: number): TrackedLpWallet[] {
  const ordered = getOrderedLpTrackedWallets();
  if (ordered.length === 0) {
    return [];
  }
  const shardCount = Math.max(1, Math.min(LP_WALLET_SHARD_COUNT, ordered.length));
  const shardIndex = tick % shardCount;
  return ordered.filter((_, idx) => idx % shardCount === shardIndex);
}

async function bootstrapTrackedLpWalletPositions(): Promise<void> {
  if (!ENABLE_LP_WALLET_TRACKER || LP_TRACKED_WALLETS.length === 0) {
    return;
  }

  for (const wallet of getOrderedLpTrackedWallets()) {
    try {
      const positions = await fetchTrackedWalletPositions(wallet);
      const freshKeys = new Set<string>();
      for (const position of positions) {
        freshKeys.add(
          buildTrackedWalletPositionKey(position.walletAddress, position.positionAddress),
        );
      }
      trackedLpWalletPositionKeysByWallet.set(wallet.address, freshKeys);
      console.log(
        `[bootstrap] lp wallet ${wallet.label} (${wallet.address}) positions=${positions.length}`,
      );
    } catch (err) {
      console.error(
        `[bootstrap] lp wallet tracker failed for ${wallet.label} (${wallet.address})`,
        err,
      );
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
    if (ENABLE_NEW_DLMM_POOL_TRACKER) {
      await scanAddress(DLMM_PROGRAM_ID);
    }
    if (
      ENABLE_GMGN_TRENDING &&
      tickCounter %
        Math.max(
          1,
          Math.round(GMGN_TRENDING_INTERVAL_MS / SCAN_INTERVAL_MS),
        ) ===
        0
    ) {
      await processTrendingTick();
    }
    if (
      ENABLE_LP_WALLET_TRACKER &&
      LP_TRACKED_WALLETS.length > 0 &&
      tickCounter %
        Math.max(
          1,
          Math.round(LP_WALLET_TRACKER_INTERVAL_MS / SCAN_INTERVAL_MS),
        ) ===
        0
    ) {
      await processLpWalletTrackerTick();
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

  await processNewDlmmPoolSignature(signature, tx);

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

async function processPendingOutcomes(): Promise<void> {
  const now = Date.now();
  for (const [mint, pending] of pendingOutcomes.entries()) {
    if (pending.horizonsRemaining.length === 0) {
      pendingOutcomes.delete(mint);
      continue;
    }
    if (pending.nextCheckAt > now) {
      continue;
    }

    const horizonMinutes = pending.horizonsRemaining[0];
    const targetTime =
      new Date(pending.row.loggedAt).getTime() + horizonMinutes * 60_000;
    if (targetTime > now) {
      pending.nextCheckAt = targetTime;
      continue;
    }

    const [gmgn, quotedMarketCap] = await Promise.all([
      fetchGmgnTokenWithRetry(mint),
      fetchGmgnQuoteMarketCap(mint),
    ]);
    const observedMarketCap =
      quotedMarketCap ??
      toNumber(gmgn?.market_cap) ??
      toNumber(gmgn?.marketcap) ??
      toNumber(gmgn?.fdv);
    const observedPrice = toNumber(gmgn?.price?.price);
    const marketCapStart = pending.row.baseline.marketCap;
    const priceStart = pending.row.baseline.price;

    await logOutcomeRow({
      kind: "outcome",
      loggedAt: new Date().toISOString(),
      mint,
      observedAt: new Date().toISOString(),
      horizonMinutes,
      marketCapStart,
      marketCapObserved: observedMarketCap,
      priceStart,
      priceObserved: observedPrice,
      returnPct:
        marketCapStart !== null &&
        observedMarketCap !== null &&
        marketCapStart > 0
          ? (observedMarketCap - marketCapStart) / marketCapStart
          : null,
      priceReturnPct:
        priceStart !== null && observedPrice !== null && priceStart > 0
          ? (observedPrice - priceStart) / priceStart
          : null,
    });

    pending.horizonsRemaining.shift();
    pending.nextCheckAt = now + OUTCOME_POLL_INTERVAL_MS;
    if (pending.horizonsRemaining.length === 0) {
      pendingOutcomes.delete(mint);
    }
  }
}

async function logDroppedPreCandidate(input: {
  mint: string;
  signature: string;
  source: "new" | "deferred";
  dropStage:
    | "launchpad"
    | "security"
    | "migrated_timestamp"
    | "candles"
    | "volume_gate"
    | "ratio_gate"
    | "scored";
  dropReason: string;
  migratedTimestampHint?: number;
  gmgn?: GmgnToken | null;
  marketCap?: number | null;
  totalFee?: number | null;
}): Promise<void> {
  const dedupeKey = [
    input.mint,
    input.signature,
    input.dropStage,
    input.dropReason,
  ].join(":");
  if (loggedPreCandidateDrops.has(dedupeKey)) {
    return;
  }
  loggedPreCandidateDrops.add(dedupeKey);

  await logPreCandidateRow(
    buildPreCandidateRow({
      mint: input.mint,
      signature: input.signature,
      source: input.source,
      dropStage: input.dropStage,
      dropReason: input.dropReason,
      migratedTimestampHint: input.migratedTimestampHint ?? null,
      symbol: input.gmgn?.symbol ?? null,
      name: input.gmgn?.name ?? null,
      marketCap: input.marketCap ?? null,
      totalFee: input.totalFee ?? null,
    }),
  );
}

const seenDlmmPools = new Map<string, number>();

async function processNewDlmmPoolSignature(
  signature: string,
  tx: ParsedTransaction,
): Promise<void> {
  if (!ENABLE_NEW_DLMM_POOL_TRACKER) {
    return;
  }

  const dlmmPool = extractNewDlmmPoolFromTx(tx);
  if (!dlmmPool) {
    return;
  }

  if (seenDlmmPools.has(dlmmPool.poolAddress)) {
    return;
  }

  const gmgn = await fetchGmgnTokenWithRetry(dlmmPool.nonSolMint);
  const volume5m = toNumber(gmgn?.price?.volume_5m) ?? toNumber(gmgn?.volume_5m) ?? 0;
  const volume1m = toNumber(gmgn?.price?.volume_1m) ?? toNumber(gmgn?.volume_1m) ?? 0;
  const liquidity = toNumber(gmgn?.liquidity) ?? 0;
  const marketCap =
    toNumber(gmgn?.market_cap) ?? toNumber(gmgn?.marketcap) ?? toNumber(gmgn?.fdv) ?? 0;
  const buys1m = gmgn?.price?.buys_1m ?? 0;
  const sells1m = gmgn?.price?.sells_1m ?? 0;
  const hasActivity =
    volume5m >= NEW_DLMM_POOL_MIN_VOLUME &&
    liquidity > 0 &&
    marketCap > 0 &&
    (buys1m > 0 || sells1m > 0 || volume1m > 0);

  if (!hasActivity) {
    console.log(
      `[dlmm-pool] skip pool=${dlmmPool.poolAddress} mint=${dlmmPool.nonSolMint} vol5m=${fmtNum(volume5m)} vol1m=${fmtNum(volume1m)} liq=${fmtNum(liquidity)} mc=${fmtNum(marketCap)}`,
    );
    return;
  }

  seenDlmmPools.set(dlmmPool.poolAddress, Date.now());
  console.log(
    `[dlmm-pool] alert pool=${dlmmPool.poolAddress} mint=${dlmmPool.nonSolMint} vol5m=${fmtNum(volume5m)} vol1m=${fmtNum(volume1m)}`,
  );
  await sendNewDlmmPoolTelegramAlert(signature, dlmmPool, gmgn, volume5m, volume1m);
}

function extractNewDlmmPoolFromTx(tx: ParsedTransaction): {
  poolAddress: string;
  nonSolMint: string;
  tokenXMint: string;
  tokenYMint: string;
  creator: string | null;
} | null {
  const instructions = tx.transaction.message.instructions ?? [];
  const accountKeys = (tx.transaction.message.accountKeys ?? []).map((k) =>
    typeof k === "string" ? k : k.pubkey,
  );
  const creator = extractSignerFromAccountKeys(tx.transaction?.message?.accountKeys ?? []);

  for (const ix of instructions) {
    if (ix.programId !== DLMM_PROGRAM_ID) {
      continue;
    }
    const data = ix.data ?? "";
    if (!data) {
      continue;
    }
    let hex = "";
    try {
      hex = Buffer.from(data, "base64").subarray(0, 8).toString("hex");
    } catch {
      continue;
    }
    if (hex !== DLMM_INIT_LB_PAIR2_DISCRIMINATOR_HEX) {
      continue;
    }

    const poolAddress = ix.accounts?.[0];
    const tokenXMint = ix.accounts?.[2];
    const tokenYMint = ix.accounts?.[3];
    if (!poolAddress || !tokenXMint || !tokenYMint) {
      continue;
    }

    const nonSolMint = tokenXMint === SOL_MINT ? tokenYMint : tokenXMint;
    if (!nonSolMint || nonSolMint === SOL_MINT) {
      continue;
    }

    return {
      poolAddress,
      nonSolMint,
      tokenXMint,
      tokenYMint,
      creator,
    };
  }

  return null;
}

async function processTrendingTick(): Promise<void> {
  const tokens = await fetchGmgnTrendingTokens();
  if (tokens.length === 0) {
    return;
  }

  for (const token of tokens) {
    const mint = token.address;
    if (!mint || seenTrendingMints.has(mint)) {
      continue;
    }

    const launchSource = classifyLaunchSource(token, null);
    const totalFee = toNumber(token.gas_fee);
    const marketCap = toNumber(token.market_cap);

    seenTrendingMints.set(mint, Date.now());
    console.log(
      `[trend] alert ${mint} source=${formatLaunchSource(launchSource)} mc=${fmtNum(marketCap)} gas_fee=${fmtNum(totalFee)}`,
    );

    await sendTrendingTelegramAlert(token, launchSource);
  }
}

async function processLpWalletTrackerTick(): Promise<void> {
  const shardWallets = getLpWalletShardForTick(tickCounter);
  for (const wallet of shardWallets) {
    try {
      const positions = await fetchTrackedWalletPositions(wallet);
      const previousKeys =
        trackedLpWalletPositionKeysByWallet.get(wallet.address) ?? new Set<string>();
      const currentKeys = new Set<string>();

      for (const position of positions) {
        const key = buildTrackedWalletPositionKey(
          position.walletAddress,
          position.positionAddress,
        );
        currentKeys.add(key);
        if (previousKeys.has(key)) {
          continue;
        }
        const enrichedPosition = await retryLpWalletPositionEnrichment(position);
        console.log(
          `[lp-wallet] alert wallet=${enrichedPosition.walletLabel} pair=${enrichedPosition.pairLabel ?? "Unknown"} bin=${formatLpPoolBin(enrichedPosition)} size=${formatLpValue(enrichedPosition)}`,
        );
        await sendLpWalletTrackerAlert(enrichedPosition);
      }

      trackedLpWalletPositionKeysByWallet.set(wallet.address, currentKeys);
    } catch (err) {
      console.error(
        `[lp-wallet] tracker error for ${wallet.label} (${wallet.address})`,
        err,
      );
    }
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
    const [
      gmgn,
      launchpadInfo,
      securityInfo,
      tokenStat,
      tagWalletCount,
      topBuyers,
      quotedMarketCap,
    ] = await Promise.all([
      fetchGmgnTokenWithRetry(mint),
      fetchGmgnLaunchpadInfo(mint),
      fetchGmgnTokenSecurity(mint),
      fetchGmgnTokenStat(mint),
      fetchGmgnTagWalletCount(mint),
      fetchGmgnTopBuyers(mint),
      fetchGmgnQuoteMarketCap(mint),
    ]);
    const launchSource = classifyLaunchSource(gmgn, launchpadInfo);

    if (launchpadInfo?.launchpad_platform === "pump_mayhem") {
      deferredVolumeCandidates.delete(mint);
      deferredVolumeMints.delete(mint);
      await logDroppedPreCandidate({
        mint,
        signature,
        source,
        dropStage: "launchpad",
        dropReason: "launchpad_platform=pump_mayhem",
        migratedTimestampHint,
        gmgn,
      });
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
      await logDroppedPreCandidate({
        mint,
        signature,
        source,
        dropStage: "security",
        dropReason: "security data not ready",
        migratedTimestampHint,
        gmgn,
      });
      logDeferredSecurityNotReady(mint);
      return;
    }
    clearDeferredSecurityNotReady(mint);

    if (
      securityInfo?.renounced_mint === false ||
      securityInfo?.renounced_freeze_account === false
    ) {
      deferredVolumeCandidates.delete(mint);
      deferredVolumeMints.delete(mint);
      await logDroppedPreCandidate({
        mint,
        signature,
        source,
        dropStage: "security",
        dropReason: `security gate failed (renounced_mint=${String(
          securityInfo?.renounced_mint,
        )}, renounced_freeze_account=${String(
          securityInfo?.renounced_freeze_account,
        )})`,
        migratedTimestampHint,
        gmgn,
      });
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
      await logDroppedPreCandidate({
        mint,
        signature,
        source,
        dropStage: "migrated_timestamp",
        dropReason: "missing migrated_timestamp",
        migratedTimestampHint,
        gmgn,
      });
      logPipeline("skip", "timestamp", mint, "missing_migrated_timestamp");
      return;
    }

    const migrationCandles = await fetchMigrationCandles(
      mint,
      migratedTimestamp,
    );
    if (migrationCandles.status !== "ok") {
      deferredVolumeMints.add(mint);
      deferredVolumeCandidates.set(mint, { signature, migratedTimestamp });
      await logDroppedPreCandidate({
        mint,
        signature,
        source,
        dropStage: "candles",
        dropReason: migrationCandles.reason,
        migratedTimestampHint: migratedTimestamp,
        gmgn,
      });
      if (source === "new") {
        logPipeline(
          "defer",
          "volume",
          mint,
          "volume_waiting",
          `reason=${migrationCandles.reason}`,
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
        `avg=${migrationCandles.average.toFixed(2)}`,
      );
    }

    if (migrationCandles.average < MIN_TWO_CANDLE_AVG_VOLUME) {
      deferredVolumeCandidates.delete(mint);
      await logDroppedPreCandidate({
        mint,
        signature,
        source,
        dropStage: "volume_gate",
        dropReason: `volume gate failed avg=${migrationCandles.average.toFixed(2)}`,
        migratedTimestampHint: migratedTimestamp,
        gmgn,
        totalFee: toNumber(gmgn?.total_fee),
        marketCap:
          quotedMarketCap ??
          toNumber(gmgn?.market_cap) ??
          toNumber(gmgn?.marketcap) ??
          toNumber(gmgn?.fdv),
      });
      if (deferredVolumeMints.has(mint)) {
        deferredVolumeMints.delete(mint);
        logPipeline(
          "skip",
          "volume",
          mint,
          "avg_below_threshold_after_defer",
          `avg=${migrationCandles.average.toFixed(2)} threshold=${MIN_TWO_CANDLE_AVG_VOLUME}`,
        );
        return;
      }
      logPipeline(
        "skip",
        "volume",
        mint,
        "avg_below_threshold",
        `avg=${migrationCandles.average.toFixed(2)} threshold=${MIN_TWO_CANDLE_AVG_VOLUME}`,
      );
      return;
    }

    if (deferredVolumeMints.has(mint)) {
      logPipeline(
        "pass",
        "volume",
        mint,
        "avg_above_threshold_after_defer",
        `avg=${migrationCandles.average.toFixed(2)}`,
      );
    }

    const totalFee = toNumber(gmgn?.total_fee);
    const marketCap =
      quotedMarketCap ??
      toNumber(gmgn?.market_cap) ??
      toNumber(gmgn?.marketcap) ??
      toNumber(gmgn?.fdv);
    if (
      !FORWARD_ALL_MIGRATED &&
      !passesFeeMarketCapRatio(totalFee, marketCap)
    ) {
      const solPer10kMc =
        totalFee !== null && marketCap !== null && totalFee > 0 && marketCap > 0
          ? (totalFee * 10000) / marketCap
          : null;
      deferredVolumeCandidates.delete(mint);
      deferredVolumeMints.delete(mint);
      await logDroppedPreCandidate({
        mint,
        signature,
        source,
        dropStage: "ratio_gate",
        dropReason: "fee/market-cap ratio gate failed",
        migratedTimestampHint: migratedTimestamp,
        gmgn,
        totalFee,
        marketCap,
      });
      if (solPer10kMc === null) {
        logPipeline("skip", "ratio", mint, "ratio_input_missing");
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
      holderCount:
        toNumber(tokenStat?.holder_count) ?? toNumber(gmgn?.holder_count),
      top10HolderRate:
        toNumber(tokenStat?.top_10_holder_rate) ??
        toNumber(securityInfo?.top_10_holder_rate) ??
        toNumber(gmgn?.dev?.top_10_holder_rate),
      creatorHoldRate: toNumber(tokenStat?.creator_hold_rate),
      devTeamHoldRate: toNumber(tokenStat?.dev_team_hold_rate),
      privateVaultHoldRate: toNumber(tokenStat?.private_vault_hold_rate),
      topBundlerTraderPercentage: toNumber(
        tokenStat?.top_bundler_trader_percentage,
      ),
      topEntrapmentTraderPercentage: toNumber(
        tokenStat?.top_entrapment_trader_percentage,
      ),
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
      topBuyersHoldingRate: toNumber(
        topBuyers?.holders?.statusNow?.holding_rate,
      ),
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
    const candidateRow = buildCandidateRow({
      mint,
      signature,
      source,
      migratedTimestamp,
      symbol: gmgn?.symbol ?? null,
      name: gmgn?.name ?? null,
      baselineMarketCap: latestMarketCap,
      baselinePrice: toNumber(gmgn?.price?.price),
      features,
      score,
    });
    await logCandidateRow(candidateRow);
    if (!pendingOutcomes.has(mint)) {
      pendingOutcomes.set(mint, {
        row: candidateRow,
        horizonsRemaining: [...OUTCOME_HORIZONS_MINUTES],
        nextCheckAt: Date.now() + OUTCOME_POLL_INTERVAL_MS,
      });
    }

    if (score.rejectReasons.length > 0) {
      deferredVolumeCandidates.delete(mint);
      deferredVolumeMints.delete(mint);
      logPipeline(
        "skip",
        "alert",
        mint,
        "hard_reject",
        score.rejectReasons.join(", "),
      );
      return;
    }

    await sendTelegramAlert(
      "migration",
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
      launchSource,
      launchpadInfo,
    );
    deferredVolumeCandidates.delete(mint);
    if (deferredVolumeMints.has(mint)) {
      deferredVolumeMints.delete(mint);
      logPipeline(
        "alert",
        "alert",
        mint,
        "sent_after_defer",
        `signature=${signature}`,
      );
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

function logDeferredSecurityNotReady(mint: string): void {
  if (loggedSecurityNotReadyMints.has(mint)) {
    return;
  }
  loggedSecurityNotReadyMints.add(mint);
  logPipeline("defer", "security", mint, "security_data_not_ready");
}

function clearDeferredSecurityNotReady(mint: string): void {
  loggedSecurityNotReadyMints.delete(mint);
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
  const instructions = tx.transaction.message.instructions ?? [];
  const logText = (tx.meta?.logMessages ?? []).join(" ").toLowerCase();
  const instructionTypes = instructions
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

  const hasBonkMigrationProgram = instructions.some(
    (ix) => ix.programId === BONK_MIGRATION_PROGRAM_ID,
  );
  const bonkMint = extractBonkMigrationMint(instructions);
  if (bonkMint) {
    console.log(`[extract] bonk explicit mint=${bonkMint}`);
    return [bonkMint];
  }
  if (hasBonkMigrationProgram) {
    console.log(
      "[extract] bonk migration program matched but mint extraction failed; skipping fallback",
    );
    return [];
  }

  const hasMeteoraCurveMigrationProgram = instructions.some(
    (ix) => ix.programId === METEORA_CURVE_MIGRATION_PROGRAM_ID,
  );
  const meteoraCurveMint = extractMeteoraCurveMigrationMint(instructions);
  if (meteoraCurveMint) {
    console.log(`[extract] meteora_curve explicit mint=${meteoraCurveMint}`);
    return [meteoraCurveMint];
  }
  if (hasMeteoraCurveMigrationProgram) {
    console.log(
      "[extract] meteora curve migration program matched but mint extraction failed; skipping fallback",
    );
    return [];
  }

  const mints = new Set<string>();
  for (const b of tx.meta?.postTokenBalances ?? []) {
    if (!b.mint || b.mint === SOL_MINT) {
      continue;
    }
    mints.add(b.mint);
  }

  const fallbackMints = Array.from(mints);
  if (fallbackMints.length > 0) {
    console.log(
      `[extract] fallback postTokenBalances mints=${fallbackMints.join(",")}`,
    );
  }
  return fallbackMints;
}

function extractBonkMigrationMint(
  instructions: Array<{
    programId?: string;
    accounts?: string[];
    parsed?: { type?: string };
  }>,
): string | null {
  for (const ix of instructions) {
    if (ix.programId !== BONK_MIGRATION_PROGRAM_ID) {
      continue;
    }
    const mint = ix.accounts?.[BONK_MIGRATION_MINT_ACCOUNT_INDEX];
    if (mint && mint !== SOL_MINT) {
      return mint;
    }
  }
  return null;
}

function extractMeteoraCurveMigrationMint(
  instructions: Array<{
    programId?: string;
    accounts?: string[];
    parsed?: { type?: string };
  }>,
): string | null {
  for (const ix of instructions) {
    if (ix.programId !== METEORA_CURVE_MIGRATION_PROGRAM_ID) {
      continue;
    }
    const mint = ix.accounts?.[METEORA_CURVE_MIGRATION_MINT_ACCOUNT_INDEX];
    if (mint && mint !== SOL_MINT) {
      return mint;
    }
  }
  return null;
}

function classifyLaunchSource(
  token: Pick<GmgnToken, "launchpad" | "launchpad_platform"> | null,
  launchpadInfo: Pick<
    GmgnMultiToken,
    "launchpad" | "launchpad_platform"
  > | null,
): LaunchSource {
  const raw = [
    token?.launchpad_platform,
    launchpadInfo?.launchpad_platform,
    token?.launchpad,
    launchpadInfo?.launchpad,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (raw.includes("meteora_virtual_curve") || raw.includes("virtual_curve")) {
    return "meteora_curve";
  }
  if (raw.includes("letsbonk") || raw.includes("bonk")) {
    return "letsbonk";
  }
  if (
    raw.includes("pump.fun") ||
    raw.includes("pumpfun") ||
    raw.includes("pump")
  ) {
    return "pumpfun";
  }
  return "unknown";
}

function formatLaunchSource(source: LaunchSource): string {
  switch (source) {
    case "letsbonk":
      return "BONK.fun";
    case "meteora_curve":
      return "Meteora Curve";
    case "pumpfun":
      return "Pump.fun";
    default:
      return "Unknown";
  }
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

async function fetchGmgnTrendingTokens(): Promise<GmgnTrendingToken[]> {
  const url = new URL(GMGN_TRENDING_URL);
  url.searchParams.set("orderby", "volume");
  url.searchParams.set("direction", "desc");
  url.searchParams.append("filters[]", "renounced");
  url.searchParams.append("filters[]", "frozen");
  url.searchParams.append("filters[]", "is_out_market");
  url.searchParams.set("limit", "20");
  url.searchParams.set("min_created", "4m");
  url.searchParams.set("max_created", "1440m");
  url.searchParams.set("min_volume", "15000");
  url.searchParams.set("min_gas_fee", "1");

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json, text/plain, */*",
      Referer: "https://gmgn.ai/trend/chain=sol",
      "User-Agent": "Mozilla/5.0",
    },
  });

  if (!res.ok) {
    return [];
  }

  const json = (await res.json()) as {
    code?: number;
    data?: { rank?: GmgnTrendingToken[] };
  };
  if (json.code !== undefined && json.code !== 0) {
    return [];
  }
  return Array.isArray(json.data?.rank) ? json.data.rank : [];
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

async function fetchGmgnTokenStat(mint: string): Promise<GmgnTokenStat | null> {
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

async function fetchGmgnTopBuyers(mint: string): Promise<GmgnTopBuyers | null> {
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

async function retryLpWalletPositionEnrichment(
  position: TrackedWalletPosition,
): Promise<TrackedWalletPosition> {
  let current = position;
  for (let attempt = 0; attempt < Math.max(1, LP_WALLET_ENRICHMENT_RETRY_COUNT); attempt += 1) {
    if (hasUsefulLpWalletEnrichment(current)) {
      return current;
    }
    if (attempt > 0) {
      await sleep(LP_WALLET_ENRICHMENT_RETRY_DELAY_MS);
    }
    current = await refetchSingleTrackedWalletPosition(current);
  }
  return current;
}

function hasUsefulLpWalletEnrichment(position: TrackedWalletPosition): boolean {
  return Boolean(
    position.pairLabel &&
      position.pairLabel !== "TokenX / TokenY" &&
      position.pairLabel !== "Unknown",
  ) ||
    position.totalValueSol !== null ||
    position.totalValueUsd !== null ||
    (position.minPrice !== null && position.maxPrice !== null);
}

async function refetchSingleTrackedWalletPosition(
  position: TrackedWalletPosition,
): Promise<TrackedWalletPosition> {
  const wallet: TrackedLpWallet = {
    address: position.walletAddress,
    label: position.walletLabel,
  };
  const positions = await fetchTrackedWalletPositions(wallet);
  return (
    positions.find((p) => p.positionAddress === position.positionAddress) ?? position
  );
}

async function fetchTrackedWalletPositions(
  wallet: TrackedLpWallet,
): Promise<TrackedWalletPosition[]> {
  const accounts = await fetchDlmmPositionAccountsV2(wallet.address);

  const positions: TrackedWalletPosition[] = [];
  for (const account of accounts) {
    const rawData = Array.isArray(account.account?.data)
      ? account.account.data[0]
      : null;
    if (!rawData) {
      continue;
    }

    let decoded: Buffer;
    try {
      decoded = Buffer.from(rawData, "base64");
    } catch {
      continue;
    }
    if (decoded.length < 40) {
      continue;
    }

    const poolAddress = encodeBase58(decoded.subarray(8, 40));
    positions.push({
      walletAddress: wallet.address,
      walletLabel: wallet.label,
      positionAddress: account.pubkey,
      poolAddress,
    });
  }

  const enrichedByPosition = new Map<string, Partial<TrackedWalletPosition>>();
  const uniquePools = [...new Set(positions.map((p) => p.poolAddress))];
  await Promise.all(
    uniquePools.map(async (poolAddress) => {
      const pnlByPosition = await fetchDlmmWalletPoolPositions(poolAddress, wallet.address);
      for (const [positionAddress, detail] of pnlByPosition.entries()) {
        enrichedByPosition.set(positionAddress, detail);
      }
    }),
  );

  return positions.map((position) => ({
    ...position,
    ...(enrichedByPosition.get(position.positionAddress) ?? {}),
  }));
}

function buildTrackedWalletPositionKey(
  walletAddress: string,
  positionAddress: string,
): string {
  return `${walletAddress}:${positionAddress}`;
}

async function fetchDlmmPositionAccountsV2(
  walletAddress: string,
): Promise<DlmmPositionAccount[]> {
  const allAccounts: DlmmPositionAccount[] = [];
  let cursor: string | null = null;

  do {
    const page: GetProgramAccountsV2Page | null = await rpcCall<GetProgramAccountsV2Page>("getProgramAccountsV2", [
      METEORA_DLMM_PROGRAM_ID,
      {
        encoding: "base64",
        limit: 100,
        ...(cursor ? { cursor } : {}),
        filters: [{ memcmp: { offset: 40, bytes: walletAddress } }],
      },
    ]);

    const accounts = Array.isArray(page?.accounts) ? page.accounts : [];
    allAccounts.push(...accounts);
    cursor = typeof page?.cursor === "string" && page.cursor.length > 0 ? page.cursor : null;
  } while (cursor);

  return allAccounts;
}

async function fetchMeteoraPoolMeta(
  poolAddress: string,
): Promise<MeteoraPool | null> {
  const cached = meteoraPoolMetaCache.get(poolAddress);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const url = new URL(METEORA_SEARCH_URL);
  url.searchParams.set("page_size", "20");
  url.searchParams.set("query", poolAddress);
  url.searchParams.set("sort_by", "volume_24h:desc,tvl:desc");

  const res = await fetch(url.toString());
  if (!res.ok) {
    meteoraPoolMetaCache.set(poolAddress, {
      value: null,
      expiresAt: now + Math.min(30000, METEORA_POOL_META_CACHE_TTL_MS),
    });
    return null;
  }

  const json = (await res.json()) as { data?: MeteoraPool[] };
  const pools = Array.isArray(json.data) ? json.data : [];
  const value =
    pools.find((pool) => pool.pool_address === poolAddress) ?? pools[0] ?? null;
  meteoraPoolMetaCache.set(poolAddress, {
    value,
    expiresAt: now + METEORA_POOL_META_CACHE_TTL_MS,
  });
  return value;
}

async function fetchDlmmWalletPoolPositions(
  poolAddress: string,
  walletAddress: string,
): Promise<Map<string, Partial<TrackedWalletPosition>>> {
  const url = new URL(`${METEORA_DLMM_PNL_URL}/${poolAddress}/pnl`);
  url.searchParams.set("user", walletAddress);
  url.searchParams.set("status", "open");
  url.searchParams.set("pageSize", "100");
  url.searchParams.set("page", "1");

  const res = await fetch(url.toString());
  if (!res.ok) {
    return new Map();
  }

  const json = (await res.json()) as {
    positions?: DlmmPnlApiPosition[];
    data?: DlmmPnlApiPosition[];
  };
  const rows = Array.isArray(json.positions)
    ? json.positions
    : Array.isArray(json.data)
      ? json.data
      : [];

  const poolMeta = await fetchMeteoraPoolMeta(poolAddress);
  const poolTokenXSymbol =
    poolMeta?.mint_x_symbol ?? poolMeta?.token_x?.symbol ?? null;
  const poolTokenYSymbol =
    poolMeta?.mint_y_symbol ?? poolMeta?.token_y?.symbol ?? null;
  const poolTokenXMint = poolMeta?.mint_x ?? poolMeta?.token_x?.address ?? null;
  const poolTokenYMint = poolMeta?.mint_y ?? poolMeta?.token_y?.address ?? null;
  const poolBinStep =
    toNumber(poolMeta?.bin_step) ?? toNumber(poolMeta?.dlmm_params?.bin_step);
  const poolFeePct =
    toNumber(poolMeta?.base_fee_percentage) ??
    toNumber(poolMeta?.fee_pct) ??
    toNumber(poolMeta?.dlmm_params?.base_fee_percentage);

  const byPosition = new Map<string, Partial<TrackedWalletPosition>>();
  for (const row of rows) {
    const positionAddress = row.positionAddress ?? row.address ?? row.position;
    if (!positionAddress) {
      continue;
    }
    const tokenXSymbol =
      row.tokenXSymbol ?? row.tokenX?.symbol ?? poolTokenXSymbol ?? "TokenX";
    const tokenYSymbol =
      row.tokenYSymbol ?? row.tokenY?.symbol ?? poolTokenYSymbol ?? "TokenY";
    const tokenXMint =
      row.tokenXMint ??
      row.mintX ??
      row.tokenX?.address ??
      row.tokenX?.mint ??
      poolTokenXMint;
    const tokenYMint =
      row.tokenYMint ??
      row.mintY ??
      row.tokenY?.address ??
      row.tokenY?.mint ??
      poolTokenYMint;
    const totalValueUsd =
      toNumber(row.totalValueUsd) ??
      toNumber(row.totalValue) ??
      toNumber(row.totalPositionValue) ??
      toNumber(row.unrealizedPnl?.balances) ??
      toNumber(row.allTimeDeposits?.total?.usd);
    const totalValueSol =
      toNumber(row.unrealizedPnl?.balancesSol) ??
      toNumber(row.allTimeDeposits?.total?.sol);
    const gmgTokenMint = pickGmgTokenMint(tokenXMint ?? undefined, tokenYMint ?? undefined);
    byPosition.set(positionAddress, {
      pairLabel: `${tokenXSymbol} / ${tokenYSymbol}`,
      poolBinStep,
      poolFeePct,
      lowerBinId: row.lowerBinId ?? null,
      upperBinId: row.upperBinId ?? null,
      activeBinId: row.poolActiveBinId ?? null,
      totalValueUsd,
      totalValueSol,
      strategy: inferLpStrategy(row),
      minPrice: toNumber(row.priceLower) ?? toNumber(row.minPrice),
      maxPrice: toNumber(row.priceUpper) ?? toNumber(row.maxPrice),
      gmgTokenMint,
      depositTokenXAmount: toNumber(row.allTimeDeposits?.tokenX?.amount),
      depositTokenYAmount: toNumber(row.allTimeDeposits?.tokenY?.amount),
    });
  }
  return byPosition;
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

  if (
    parsed.some(
      (c) =>
        c.open === null ||
        c.high === null ||
        c.low === null ||
        c.close === null ||
        c.volume === null,
    )
  ) {
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

async function sendTrendingTelegramAlert(
  token: GmgnTrendingToken,
  launchSource: LaunchSource,
): Promise<void> {
  const mint = token.address;
  const gmgnLink = `https://gmgn.ai/sol/token/${mint}`;
  const bubbleMapLink = `https://v2.bubblemaps.io/map?address=${mint}&chain=solana`;
  const sourceLabel = formatLaunchSource(launchSource);
  const totalFee = toNumber(token.gas_fee);
  const marketCap = toNumber(token.market_cap);
  const quickActions = [
    `<a href="${gmgnLink}">GMG</a>`,
    `<a href="${bubbleMapLink}">BBLMP</a>`,
  ];

  const text = [
    `<b>GMGN Trending</b>`,
    "<u>Token Details</u>",
    `CA: <code>${escapeHtml(mint)}</code>`,
    `Name: ${escapeHtml(token.name ?? "Unknown")}`,
    `Symbol: ${escapeHtml(token.symbol ?? "Unknown")}`,
    `Source: ${escapeHtml(sourceLabel)} | Launchpad: ${escapeHtml(token.launchpad_platform ?? token.launchpad ?? "Unknown")} | Exchange: ${escapeHtml(token.exchange ?? "Unknown")}`,
    "",
    "<u>Token Stat</u>",
    `Total fee: ${fmtNum(totalFee)}`,
    `MC: ${fmtNum(marketCap)}`,
    `Vol: ${fmtNum(toNumber(token.volume))}`,
    `Liq: ${fmtNum(toNumber(token.liquidity))}`,
    "",
    `<u>Quick Action</u>`,
    `${quickActions.join(" ● ")}`,
  ].join("\n");

  const payloadBase = buildTelegramPayloadBase("gmgn_trending");

  const imageUrl = token.logo;
  const res = imageUrl
    ? await sendTelegramPhotoWithFallback(imageUrl, text, payloadBase)
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
    console.error("[telegram] trending send failed", body);
  }
}

async function sendNewDlmmPoolTelegramAlert(
  signature: string,
  pool: {
    poolAddress: string;
    nonSolMint: string;
    tokenXMint: string;
    tokenYMint: string;
    creator: string | null;
  },
  gmgn: GmgnToken | null,
  volume5m: number,
  volume1m: number,
): Promise<void> {
  const gmgnLink = `https://gmgn.ai/sol/token/${pool.nonSolMint}`;
  const dlmmLink = `https://app.meteora.ag/dlmm/${pool.poolAddress}`;
  const solscanTxLink = `https://solscan.io/tx/${signature}`;
  const tokenSymbol = gmgn?.symbol ?? shortenAddress(pool.nonSolMint);
  const pairLabel = `${tokenSymbol} / SOL`;
  const text = [
    `<b>New DLMM Pool</b>`,
    `Pool: ${escapeHtml(pairLabel)}`,
    `DLMM Pool: <code>${escapeHtml(pool.poolAddress)}</code>`,
    `Token: <code>${escapeHtml(pool.nonSolMint)}</code>`,
    ...(pool.creator ? [`Creator: <code>${escapeHtml(pool.creator)}</code>`] : []),
    `Vol 5m: ${fmtNum(volume5m)} | Vol 1m: ${fmtNum(volume1m)}`,
    `Liquidity: ${fmtNum(toNumber(gmgn?.liquidity))}`,
    `MC: ${fmtNum(toNumber(gmgn?.market_cap) ?? toNumber(gmgn?.marketcap) ?? toNumber(gmgn?.fdv))}`,
    "",
    `<u>Quick Action</u>`,
    `<a href="${gmgnLink}">GMG</a> ● <a href="${dlmmLink}">DLMM</a> ● <a href="${solscanTxLink}">TX</a>`,
  ].join("\n");

  const payloadBase = buildTelegramPayloadBase("new_dlmm_pool");
  const res = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payloadBase,
        text,
        disable_web_page_preview: true,
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`telegram new dlmm pool send failed: ${res.status} ${body}`);
  }
}

async function sendLpWalletTrackerAlert(
  position: TrackedWalletPosition,
): Promise<void> {
  const gmgnLink = position.gmgTokenMint
    ? `https://gmgn.ai/sol/token/${position.gmgTokenMint}`
    : `https://gmgn.ai/sol/address/${position.walletAddress}`;
  const dlmmLink = `https://app.meteora.ag/dlmm/${position.poolAddress}`;
  const solscanWalletLink = `https://solscan.io/account/${position.walletAddress}`;
  const solscanPositionLink = `https://solscan.io/account/${position.positionAddress}`;
  const lpAgentLink = `https://app.lpagent.io/portfolio?address=${position.walletAddress}`;
  const text = [
    `<b>LP Wallet Tracker</b>`,
    `Wallet: <b>${escapeHtml(position.walletLabel)}</b> (<code>${escapeHtml(shortenAddress(position.walletAddress))}</code>)`,
    `Pool: ${escapeHtml(position.pairLabel ?? "Unknown")} (${escapeHtml(formatLpPoolBin(position))})`,
    `Value: ${formatLpValue(position)}`,
    `Range: ${formatLpRange(position)}`,
    `Position: <code>${escapeHtml(position.positionAddress)}</code>`,
    `DLMM Pool: <code>${escapeHtml(position.poolAddress)}</code>`,
    "",
    `<u>Quick Action</u>`,
    `<a href="${gmgnLink}">GMG</a> ● <a href="${dlmmLink}">DLMM</a> ● <a href="${lpAgentLink}">LPA</a>`,
  ].join("\n");

  const payloadBase = buildTelegramPayloadBase("lp_wallet_tracker");
  const res = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payloadBase,
        text,
        disable_web_page_preview: true,
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`telegram lp wallet tracker send failed: ${res.status} ${body}`);
  }
}

async function sendTelegramAlert(
  alertKind: AlertKind,
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
  launchSource: LaunchSource = "unknown",
  launchpadInfo: GmgnMultiToken | null = null,
): Promise<void> {
  const dlmmPoolAddress = dlmmPool?.pool_address ?? "None";
  const dammV2PoolAddress = dammV2Pool?.pool_address ?? "None";
  const gmgnLink = `https://gmgn.ai/sol/token/${mint}`;
  const solscanTxLink = `https://solscan.io/tx/${signature}`;
  const bubbleMapLink = `https://v2.bubblemaps.io/map?address=${mint}&chain=solana`;
  const title =
    alertKind === "gmgn_trending" ? "GMGN Trending" : "Token Migration";
  const sourceLabel = formatLaunchSource(launchSource);
  const rawLaunchpad =
    launchpadInfo?.launchpad_platform ??
    token?.launchpad_platform ??
    token?.launchpad ??
    "Unknown";
  const rawExchange =
    launchpadInfo?.exchange ??
    token?.exchange ??
    token?.pool?.exchange ??
    "Unknown";
  const dlmmLink =
    dlmmPoolAddress !== "None"
      ? `https://app.meteora.ag/dlmm/${dlmmPoolAddress}`
      : null;
  const dammV2Link =
    dammV2PoolAddress !== "None"
      ? `https://app.meteora.ag/dammv2/${dammV2PoolAddress}`
      : null;

  const quickActions = [
    `<a href="${gmgnLink}">GMG</a>`,
    `<a href="${bubbleMapLink}">BBLMP</a>`,
    `<a href="${solscanTxLink}">TX</a>`,
  ];
  if (dlmmLink) {
    quickActions.push(`<a href="${dlmmLink}">DLMM</a>`);
  }
  if (dammV2Link) {
    quickActions.push(`<a href="${dammV2Link}">DAMMV2</a>`);
  }

  const compactReasons = score.reasons.slice(0, 4).join(" | ") || "n/a";
  const greenFlags = score.greenFlags.slice(0, 3).join(" | ") || "n/a";
  const redFlags = score.redFlags.slice(0, 3).join(" | ") || "n/a";

  const text = [
    `<b>${escapeHtml(title)}</b>`,
    `${escapeHtml(score.verdict.toUpperCase())} · <b>${score.finalScore}</b>`,
    "<u>Token Details</u>",
    `CA: <code>${escapeHtml(mint)}</code>`,
    `Name: ${escapeHtml(token?.name ?? "Unknown")}`,
    `Symbol: ${escapeHtml(token?.symbol ?? "Unknown")}`,
    `Source: ${escapeHtml(sourceLabel)} | Launchpad: ${escapeHtml(rawLaunchpad)} | Exchange: ${escapeHtml(rawExchange)}`,
    "",
    `<b>Why:</b> ${escapeHtml(compactReasons)}`,
    `<b>Green:</b> ${escapeHtml(greenFlags)}`,
    `<b>Red:</b> ${escapeHtml(redFlags)}`,
    "",
    `<u>Stats</u>`,
    `MC: ${fmtNum(marketCap)} | Fee: ${fmtNum(totalFee)} | Ratio: ${features.solPer10kMc === null ? "Unknown" : features.solPer10kMc.toFixed(3)}`,
    `2C Avg Vol: ${fmtNum(twoCandleAvgVolume)} | B/S 1m: ${features.buySellRatio1m === null ? "Unknown" : features.buySellRatio1m.toFixed(2)}`,
    `Top10: ${features.top10HolderRate === null ? "Unknown" : `${(features.top10HolderRate * 100).toFixed(1)}%`} | Top buyers sold: ${features.topBuyersHolderCount && features.topBuyersSoldCount !== null ? `${((features.topBuyersSoldCount / features.topBuyersHolderCount) * 100).toFixed(1)}%` : "Unknown"}`,
    `Smart: ${features.smartWallets === null ? "Unknown" : String(features.smartWallets)} | Rat: ${features.ratTraderWallets === null ? "Unknown" : String(features.ratTraderWallets)} | Fast snipers: ${features.fastSniperCount === null ? "Unknown" : String(features.fastSniperCount)}`,
    "",
    `<u>Pools</u>`,
    `DLMM: ${dlmmPoolAddress === "None" ? "None" : `<code>${escapeHtml(dlmmPoolAddress)}</code>`}`,
    `DAMMV2: ${dammV2PoolAddress === "None" ? "None" : `<code>${escapeHtml(dammV2PoolAddress)}</code>`}`,
    "",
    `<u>Quick Action</u>`,
    `${quickActions.join(" ● ")}`,
  ].join("\n");

  const payloadBase = buildTelegramPayloadBase(alertKind);

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
  payloadBase: {
    chat_id: string;
    parse_mode: string;
    message_thread_id?: number;
  },
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
    if (payloadBase.message_thread_id !== undefined) {
      form.append("message_thread_id", String(payloadBase.message_thread_id));
    }
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
      message?: {
        text?: string;
        message_thread_id?: number;
        chat?: { id?: number | string };
        from?: { id?: number | string };
      };
    }>;
  };
  const updates = Array.isArray(json.result) ? json.result : [];
  for (const update of updates) {
    telegramUpdateOffset = Math.max(telegramUpdateOffset, update.update_id + 1);
    const text = update.message?.text ?? "";
    const chatId = update.message?.chat?.id;
    const senderId = update.message?.from?.id;
    const messageThreadId = update.message?.message_thread_id;
    if (!text || chatId === undefined || chatId === null) {
      continue;
    }
    if (isTaggedPing(text)) {
      await respondPong(chatId);
      continue;
    }
    if (!isAllowedTelegramUser(senderId)) {
      continue;
    }
  }
}

function isTaggedPing(text: string): boolean {
  const lower = text.toLowerCase();
  const mention = `@${telegramBotUsername.toLowerCase()}`;
  return lower.includes("ping") && lower.includes(mention);
}

function isAllowedTelegramUser(senderId: number | string | undefined): boolean {
  if (!TELEGRAM_ALLOWED_USER_ID) {
    return true;
  }
  if (senderId === undefined || senderId === null) {
    return false;
  }
  return String(senderId) === TELEGRAM_ALLOWED_USER_ID;
}

async function respondPong(chatId: number | string): Promise<void> {
  const uptimeSec = Math.floor((Date.now() - BOT_STARTED_AT) / 1000);
  await sendTelegramPlainMessage(chatId, `pong\nuptime: ${uptimeSec}s`);
}

async function sendTelegramPlainMessage(
  chatId: number | string,
  text: string,
  messageThreadId?: number,
): Promise<void> {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      ...(messageThreadId !== undefined ? { message_thread_id: messageThreadId } : {}),
    }),
  });
}


function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getSignaturesForAddress(
  address: string,
  limit: number,
  before?: string,
): Promise<SignatureInfo[]> {
  const result = await rpcCall<SignatureInfo[]>("getSignaturesForAddress", [
    address,
    {
      limit,
      commitment: "confirmed",
      ...(before ? { before } : {}),
    },
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
  const maxAttempts = 4;
  let lastStatus: number | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
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

    if (res.ok) {
      const json = (await res.json()) as JsonRpcResponse<T>;
      if (json.error) {
        throw new Error(`rpc ${method} error: ${json.error.message}`);
      }
      return json.result ?? null;
    }

    lastStatus = res.status;
    if (res.status !== 429 || attempt === maxAttempts) {
      throw new Error(`rpc http error ${res.status}`);
    }

    await sleep(400 * attempt);
  }

  throw new Error(`rpc http error ${lastStatus ?? "unknown"}`);
}

function buildTelegramPayloadBase(alertKind: AlertKind): {
  chat_id: string;
  parse_mode: "HTML";
  message_thread_id?: number;
} {
  const messageThreadId =
    alertKind === "gmgn_trending"
      ? TELEGRAM_TRENDING_THREAD_ID
      : alertKind === "lp_wallet_tracker"
        ? TELEGRAM_LP_WALLET_THREAD_ID
        : alertKind === "new_dlmm_pool"
          ? TELEGRAM_NEW_DLMM_POOL_THREAD_ID
          : TELEGRAM_MIGRATION_THREAD_ID;

  return {
    chat_id: TELEGRAM_CHAT_ID,
    parse_mode: "HTML",
    ...(messageThreadId !== null ? { message_thread_id: messageThreadId } : {}),
  };
}

function extractSignerFromAccountKeys(
  accountKeys: Array<string | { pubkey: string; signer?: boolean }>,
): string | null {
  for (const key of accountKeys) {
    if (typeof key === "string") {
      continue;
    }
    if (key?.signer && key.pubkey) {
      return key.pubkey;
    }
  }
  if (accountKeys.length > 0 && typeof accountKeys[0] !== "string") {
    return accountKeys[0]?.pubkey ?? null;
  }
  return null;
}

function splitCsv(input: string | undefined): string[] {
  return (input ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function parseTrackedLpWallets(input: string | undefined): TrackedLpWallet[] {
  return splitCsv(input).flatMap((entry) => {
    const idx = entry.indexOf(":");
    if (idx === -1) {
      const address = entry.trim();
      return address ? [{ address, label: shortenAddress(address) }] : [];
    }
    const label = entry.slice(0, idx).trim();
    const address = entry.slice(idx + 1).trim();
    if (!address) {
      return [];
    }
    return [{
      address,
      label: label || shortenAddress(address),
    }];
  });
}

function parseTrackedLpWalletFileRows(
  rows: unknown,
  defaults?: TrackedLpWalletFileSchema["defaults"],
): TrackedLpWallet[] {
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows.flatMap((row) => {
    const item = row as TrackedLpWalletFileRow;
    const address = item.address?.trim();
    const enabled = item.enabled ?? defaults?.enabled ?? true;
    if (!address || enabled === false) {
      return [];
    }
    return [{
      address,
      label: item.label?.trim() || shortenAddress(address),
      enabled,
      group: item.group?.trim() || defaults?.group,
      priority: item.priority ?? defaults?.priority,
      notes: item.notes?.trim(),
    }];
  });
}

function parseTrackedLpWalletFile(input: unknown): TrackedLpWallet[] {
  if (Array.isArray(input)) {
    return parseTrackedLpWalletFileRows(input);
  }

  const schema = input as TrackedLpWalletFileSchema;
  if (schema && Array.isArray(schema.wallets)) {
    return parseTrackedLpWalletFileRows(schema.wallets, schema.defaults);
  }

  return [];
}

function loadTrackedLpWallets(): TrackedLpWallet[] {
  try {
    if (fs.existsSync(LP_TRACKED_WALLETS_FILE)) {
      const raw = fs.readFileSync(LP_TRACKED_WALLETS_FILE, "utf8");
      const parsed = JSON.parse(raw);
      const wallets = parseTrackedLpWalletFile(parsed);
      if (wallets.length > 0) {
        return wallets;
      }
      console.warn(
        `[lp-wallet] tracked wallet file exists but yielded no enabled wallets: ${LP_TRACKED_WALLETS_FILE}`,
      );
      return [];
    }
  } catch (err) {
    console.error(
      `[lp-wallet] failed to load wallet file ${LP_TRACKED_WALLETS_FILE}`,
      err,
    );
  }

  return parseTrackedLpWallets(process.env.LP_TRACKED_WALLETS);
}

function parseOptionalNumber(input: string | undefined): number | null {
  if (!input || input.trim() === "") {
    return null;
  }
  const parsed = Number(input);
  return Number.isFinite(parsed) ? parsed : null;
}

function shortenAddress(value: string): string {
  return value.length > 12 ? `${value.slice(0, 4)}...${value.slice(-4)}` : value;
}

function encodeBase58(bytes: Uint8Array): string {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i += 1) {
      const value = digits[i] * 256 + carry;
      digits[i] = value % 58;
      carry = Math.floor(value / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  let zeroes = 0;
  while (zeroes < bytes.length && bytes[zeroes] === 0) {
    zeroes += 1;
  }
  let result = "1".repeat(zeroes);
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    result += alphabet[digits[i]];
  }
  return result;
}

function formatLpPoolBin(position: TrackedWalletPosition): string {
  if (position.poolBinStep !== null && position.poolBinStep !== undefined) {
    const fee =
      position.poolFeePct !== null && position.poolFeePct !== undefined
        ? `${trimNumber(position.poolFeePct)}%`
        : "Unknown";
    return `${trimNumber(position.poolBinStep)}/${fee}`;
  }
  return "Unknown";
}

function formatLpValue(position: TrackedWalletPosition): string {
  if (position.totalValueSol !== null && position.totalValueSol !== undefined) {
    return `${position.totalValueSol.toFixed(position.totalValueSol >= 10 ? 1 : 2)} SOL`;
  }
  if (position.totalValueUsd !== null && position.totalValueUsd !== undefined) {
    return `$${position.totalValueUsd.toFixed(position.totalValueUsd >= 100 ? 0 : 2)}`;
  }
  return "Unknown";
}

function formatLpRange(position: TrackedWalletPosition): string {
  if (
    position.minPrice !== null &&
    position.minPrice !== undefined &&
    position.maxPrice !== null &&
    position.maxPrice !== undefined
  ) {
    const widthPct =
      position.maxPrice > 0
        ? ((position.minPrice - position.maxPrice) / position.maxPrice) * 100
        : null;
    return `${trimNumber(position.minPrice)} ~ ${trimNumber(position.maxPrice)}${widthPct !== null ? ` (${widthPct.toFixed(2)}%)` : ""}`;
  }
  if (
    position.lowerBinId !== null &&
    position.lowerBinId !== undefined &&
    position.upperBinId !== null &&
    position.upperBinId !== undefined
  ) {
    return `Bin ${position.lowerBinId} ~ ${position.upperBinId}`;
  }
  return "Unknown";
}

function trimNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "Unknown";
  }
  if (value === 0) {
    return "0";
  }

  let decimals = 4;
  const abs = Math.abs(value);
  if (abs >= 1) {
    decimals = 4;
  } else if (abs >= 0.01) {
    decimals = 6;
  } else if (abs >= 0.0001) {
    decimals = 8;
  } else {
    decimals = 12;
  }

  return value
    .toFixed(decimals)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*?)0+$/, "$1");
}

function formatLpStrategy(strategy: string | null | undefined): string | null {
  if (!strategy) {
    return null;
  }
  const normalized = strategy.toLowerCase();
  if (normalized.includes("bid") && normalized.includes("ask")) {
    return "BA";
  }
  if (normalized.includes("spot")) {
    return "Spot";
  }
  if (normalized.includes("curve")) {
    return "Curve";
  }
  return strategy;
}

function inferLpStrategy(row: DlmmPnlApiPosition): string | null {
  const direct = formatLpStrategy(row.strategy);
  if (direct) {
    return direct;
  }

  const depositX = toNumber(row.allTimeDeposits?.tokenX?.amount) ?? 0;
  const depositY = toNumber(row.allTimeDeposits?.tokenY?.amount) ?? 0;
  if (depositX === 0 && depositY > 0) {
    return "BA";
  }
  if (depositY === 0 && depositX > 0) {
    return "Single X";
  }
  if (depositX > 0 && depositY > 0) {
    return "Spot";
  }
  return null;
}

function pickGmgTokenMint(
  tokenXMint: string | undefined,
  tokenYMint: string | undefined,
): string | null {
  if (tokenXMint && tokenXMint !== SOL_MINT) {
    return tokenXMint;
  }
  if (tokenYMint && tokenYMint !== SOL_MINT) {
    return tokenYMint;
  }
  return null;
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
  for (const [mint, ts] of seenTrendingMints.entries()) {
    if (now - ts > 1000 * 60 * 60 * 24) {
      seenTrendingMints.delete(mint);
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
