import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { ScreenFeatures, ScreenScore } from "./screener.js";

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
};

const DATA_DIR = process.env.RUNTIME_DATA_DIR ?? "runtime-data";
const CANDIDATES_PATH = `${DATA_DIR}/candidates.jsonl`;
const OUTCOMES_PATH = `${DATA_DIR}/outcomes.jsonl`;

async function appendJsonl(path: string, row: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(row)}\n`, "utf8");
}

export async function logCandidateRow(row: CandidateDatasetRow): Promise<void> {
  await appendJsonl(CANDIDATES_PATH, row);
}

export async function logOutcomeRow(row: OutcomeDatasetRow): Promise<void> {
  await appendJsonl(OUTCOMES_PATH, row);
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
