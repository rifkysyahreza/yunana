import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { ScreenFeatures, ScreenScore } from "./screener.js";

export type PreCandidateDatasetRow = {
  kind: "pre_candidate";
  loggedAt: string;
  mint: string;
  signature: string;
  source: "new" | "deferred";
  detectedStage: "migration_detected";
  dropStage:
    | "launchpad"
    | "security"
    | "migrated_timestamp"
    | "candles"
    | "volume_gate"
    | "ratio_gate"
    | "scored";
  dropReason: string;
  migratedTimestampHint: number | null;
  basic: {
    symbol: string | null;
    name: string | null;
    marketCap: number | null;
    totalFee: number | null;
  };
};

export type CandidateDatasetRow = {
  kind: "candidate";
  loggedAt: string;
  mint: string;
  signature: string;
  source: "new" | "deferred";
  migratedTimestamp: number;
  token: {
    symbol: string | null;
    name: string | null;
  };
  baseline: {
    marketCap: number | null;
    price: number | null;
  };
  features: ScreenFeatures;
  score: ScreenScore;
};

export type OutcomeDatasetRow = {
  kind: "outcome";
  loggedAt: string;
  mint: string;
  observedAt: string;
  horizonMinutes: number;
  marketCapStart: number | null;
  marketCapObserved: number | null;
  priceStart: number | null;
  priceObserved: number | null;
  returnPct: number | null;
  priceReturnPct: number | null;
  maxReturnPctWithinHorizon: number | null;
  minReturnPctWithinHorizon: number | null;
  maxPriceReturnPctWithinHorizon: number | null;
  minPriceReturnPctWithinHorizon: number | null;
  hit30WithinHorizon: boolean;
  hit50WithinHorizon: boolean;
  hit100WithinHorizon: boolean;
  hitMinus30WithinHorizon: boolean;
  hitMinus50WithinHorizon: boolean;
  styleBaseHitWithinHorizon: boolean;
  styleDoubleHitWithinHorizon: boolean;
  styleFailedFastWithinHorizon: boolean;
};

const DATA_DIR = process.env.RUNTIME_DATA_DIR ?? "runtime-data";
const PRE_CANDIDATES_PATH = `${DATA_DIR}/pre_candidates.jsonl`;
const CANDIDATES_PATH = `${DATA_DIR}/candidates.jsonl`;
const OUTCOMES_PATH = `${DATA_DIR}/outcomes.jsonl`;

async function appendJsonl(path: string, row: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(row)}\n`, "utf8");
}

export async function logPreCandidateRow(
  row: PreCandidateDatasetRow,
): Promise<void> {
  await appendJsonl(PRE_CANDIDATES_PATH, row);
}

export async function logCandidateRow(row: CandidateDatasetRow): Promise<void> {
  await appendJsonl(CANDIDATES_PATH, row);
}

export async function logOutcomeRow(row: OutcomeDatasetRow): Promise<void> {
  await appendJsonl(OUTCOMES_PATH, row);
}

export function buildPreCandidateRow(input: {
  mint: string;
  signature: string;
  source: "new" | "deferred";
  dropStage: PreCandidateDatasetRow["dropStage"];
  dropReason: string;
  migratedTimestampHint: number | null;
  symbol: string | null;
  name: string | null;
  marketCap: number | null;
  totalFee: number | null;
}): PreCandidateDatasetRow {
  return {
    kind: "pre_candidate",
    loggedAt: new Date().toISOString(),
    mint: input.mint,
    signature: input.signature,
    source: input.source,
    detectedStage: "migration_detected",
    dropStage: input.dropStage,
    dropReason: input.dropReason,
    migratedTimestampHint: input.migratedTimestampHint,
    basic: {
      symbol: input.symbol,
      name: input.name,
      marketCap: input.marketCap,
      totalFee: input.totalFee,
    },
  };
}

export function buildCandidateRow(input: {
  mint: string;
  signature: string;
  source: "new" | "deferred";
  migratedTimestamp: number;
  symbol: string | null;
  name: string | null;
  baselineMarketCap: number | null;
  baselinePrice: number | null;
  features: ScreenFeatures;
  score: ScreenScore;
}): CandidateDatasetRow {
  return {
    kind: "candidate",
    loggedAt: new Date().toISOString(),
    mint: input.mint,
    signature: input.signature,
    source: input.source,
    migratedTimestamp: input.migratedTimestamp,
    token: {
      symbol: input.symbol,
      name: input.name,
    },
    baseline: {
      marketCap: input.baselineMarketCap,
      price: input.baselinePrice,
    },
    features: input.features,
    score: input.score,
  };
}
