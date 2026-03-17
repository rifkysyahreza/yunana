export type CandlePoint = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  amount: number | null;
};

export type CandleDerived = CandlePoint & {
  range: number;
  body: number;
  bodyPctOfRange: number;
  upperWickPctOfRange: number;
  lowerWickPctOfRange: number;
  closePositionPct: number;
};

export type ScreenFeatures = {
  mint: string;
  symbol: string | null;
  name: string | null;
  marketCap: number | null;
  liquidity: number | null;
  totalFee: number | null;
  solPer10kMc: number | null;
  holderCount: number | null;
  top10HolderRate: number | null;
  creatorHoldRate: number | null;
  devTeamHoldRate: number | null;
  privateVaultHoldRate: number | null;
  topBundlerTraderPercentage: number | null;
  topEntrapmentTraderPercentage: number | null;
  freshWalletRate: number | null;
  bluechipOwnerPercentage: number | null;
  botDegenRate: number | null;
  smartWallets: number | null;
  freshWallets: number | null;
  renownedWallets: number | null;
  sniperWallets: number | null;
  ratTraderWallets: number | null;
  whaleWallets: number | null;
  topWallets: number | null;
  fastSniperCount: number | null;
  topBuyersHolderCount: number | null;
  topBuyersSoldCount: number | null;
  topBuyersSoldPartCount: number | null;
  topBuyersHoldCount: number | null;
  topBuyersHoldingRate: number | null;
  topBuyersBoughtRate: number | null;
  buyTax: number | null;
  sellTax: number | null;
  hideRisk: boolean | null;
  renouncedMint: boolean | null;
  renouncedFreezeAccount: boolean | null;
  launchpadPlatform: string | null;
  hasDlmmPool: boolean;
  hasDammV2Pool: boolean;
  twoCandleAvgVolume: number | null;
  threeCandleAvgVolume: number | null;
  priceNow: number | null;
  price1m: number | null;
  price5m: number | null;
  buys1m: number | null;
  sells1m: number | null;
  buys5m: number | null;
  sells5m: number | null;
  volume1m: number | null;
  volume5m: number | null;
  buyVolume1m: number | null;
  sellVolume1m: number | null;
  buyVolume5m: number | null;
  sellVolume5m: number | null;
  swaps1m: number | null;
  swaps5m: number | null;
  hotLevel: number | null;
  visitingCount: number | null;
  c0: CandleDerived | null;
  c1: CandleDerived | null;
  c2: CandleDerived | null;
  momentum1mPct: number | null;
  momentum5mPct: number | null;
  buySellRatio1m: number | null;
  buySellRatio5m: number | null;
  buyVolumeDominance1m: number | null;
  buyVolumeDominance5m: number | null;
  volumePersistenceRatio: number | null;
};

export type ScreenScore = {
  structureScore: number;
  flowScore: number;
  poolScore: number;
  riskPenalty: number;
  finalScore: number;
  verdict: "reject" | "watch" | "tradeable" | "high-risk-momentum" | "strong-structure";
  reasons: string[];
  rejectReasons: string[];
  greenFlags: string[];
  redFlags: string[];
};

export type ScreenerConfig = {
  minTwoCandleAvgVolume: number;
  minSolPer10kMc: number;
  maxSolPer10kMc: number;
  maxTop10HolderRate: number;
  maxCreatorHoldRate: number;
  maxBundlerRate: number;
  maxRatTraderRatio: number;
  maxTopBuyerSoldRatio: number;
  maxBuyTax: number;
  maxSellTax: number;
  strongScoreThreshold: number;
  tradeableScoreThreshold: number;
  watchScoreThreshold: number;
  highRiskScoreThreshold: number;
};

export type BuildScreenFeaturesInput = {
  mint: string;
  symbol?: string | null;
  name?: string | null;
  marketCap?: number | null;
  liquidity?: number | null;
  totalFee?: number | null;
  holderCount?: number | null;
  top10HolderRate?: number | null;
  creatorHoldRate?: number | null;
  devTeamHoldRate?: number | null;
  privateVaultHoldRate?: number | null;
  topBundlerTraderPercentage?: number | null;
  topEntrapmentTraderPercentage?: number | null;
  freshWalletRate?: number | null;
  bluechipOwnerPercentage?: number | null;
  botDegenRate?: number | null;
  smartWallets?: number | null;
  freshWallets?: number | null;
  renownedWallets?: number | null;
  sniperWallets?: number | null;
  ratTraderWallets?: number | null;
  whaleWallets?: number | null;
  topWallets?: number | null;
  fastSniperCount?: number | null;
  topBuyersHolderCount?: number | null;
  topBuyersSoldCount?: number | null;
  topBuyersSoldPartCount?: number | null;
  topBuyersHoldCount?: number | null;
  topBuyersHoldingRate?: number | null;
  topBuyersBoughtRate?: number | null;
  buyTax?: number | null;
  sellTax?: number | null;
  hideRisk?: boolean | null;
  renouncedMint?: boolean | null;
  renouncedFreezeAccount?: boolean | null;
  launchpadPlatform?: string | null;
  hasDlmmPool?: boolean;
  hasDammV2Pool?: boolean;
  priceNow?: number | null;
  price1m?: number | null;
  price5m?: number | null;
  buys1m?: number | null;
  sells1m?: number | null;
  buys5m?: number | null;
  sells5m?: number | null;
  volume1m?: number | null;
  volume5m?: number | null;
  buyVolume1m?: number | null;
  sellVolume1m?: number | null;
  buyVolume5m?: number | null;
  sellVolume5m?: number | null;
  swaps1m?: number | null;
  swaps5m?: number | null;
  hotLevel?: number | null;
  visitingCount?: number | null;
  candles?: Array<CandlePoint | null | undefined>;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function pctChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) {
    return null;
  }
  return (current - previous) / previous;
}

function safeRatio(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || denominator === 0) {
    return null;
  }
  return numerator / denominator;
}

export function deriveCandle(point: CandlePoint | null | undefined): CandleDerived | null {
  if (!point) {
    return null;
  }

  const range = Math.max(point.high - point.low, 0);
  const body = Math.abs(point.close - point.open);
  const upperWick = Math.max(point.high - Math.max(point.open, point.close), 0);
  const lowerWick = Math.max(Math.min(point.open, point.close) - point.low, 0);
  const bodyPctOfRange = range > 0 ? body / range : 0;
  const upperWickPctOfRange = range > 0 ? upperWick / range : 0;
  const lowerWickPctOfRange = range > 0 ? lowerWick / range : 0;
  const closePositionPct = range > 0 ? (point.close - point.low) / range : 0.5;

  return {
    ...point,
    range,
    body,
    bodyPctOfRange,
    upperWickPctOfRange,
    lowerWickPctOfRange,
    closePositionPct,
  };
}

export function buildScreenFeatures(input: BuildScreenFeaturesInput): ScreenFeatures {
  const c0 = deriveCandle(input.candles?.[0]);
  const c1 = deriveCandle(input.candles?.[1]);
  const c2 = deriveCandle(input.candles?.[2]);
  const totalFee = input.totalFee ?? null;
  const marketCap = input.marketCap ?? null;
  const twoCandleAvgVolume =
    c0 && c1 ? (c0.volume + c1.volume) / 2 : null;
  const threeCandleAvgVolume =
    c0 && c1 && c2 ? (c0.volume + c1.volume + c2.volume) / 3 : null;

  return {
    mint: input.mint,
    symbol: input.symbol ?? null,
    name: input.name ?? null,
    marketCap,
    liquidity: input.liquidity ?? null,
    totalFee,
    solPer10kMc:
      totalFee !== null && marketCap !== null && totalFee > 0 && marketCap > 0
        ? (totalFee * 10000) / marketCap
        : null,
    holderCount: input.holderCount ?? null,
    top10HolderRate: input.top10HolderRate ?? null,
    creatorHoldRate: input.creatorHoldRate ?? null,
    devTeamHoldRate: input.devTeamHoldRate ?? null,
    privateVaultHoldRate: input.privateVaultHoldRate ?? null,
    topBundlerTraderPercentage: input.topBundlerTraderPercentage ?? null,
    topEntrapmentTraderPercentage: input.topEntrapmentTraderPercentage ?? null,
    freshWalletRate: input.freshWalletRate ?? null,
    bluechipOwnerPercentage: input.bluechipOwnerPercentage ?? null,
    botDegenRate: input.botDegenRate ?? null,
    smartWallets: input.smartWallets ?? null,
    freshWallets: input.freshWallets ?? null,
    renownedWallets: input.renownedWallets ?? null,
    sniperWallets: input.sniperWallets ?? null,
    ratTraderWallets: input.ratTraderWallets ?? null,
    whaleWallets: input.whaleWallets ?? null,
    topWallets: input.topWallets ?? null,
    fastSniperCount: input.fastSniperCount ?? null,
    topBuyersHolderCount: input.topBuyersHolderCount ?? null,
    topBuyersSoldCount: input.topBuyersSoldCount ?? null,
    topBuyersSoldPartCount: input.topBuyersSoldPartCount ?? null,
    topBuyersHoldCount: input.topBuyersHoldCount ?? null,
    topBuyersHoldingRate: input.topBuyersHoldingRate ?? null,
    topBuyersBoughtRate: input.topBuyersBoughtRate ?? null,
    buyTax: input.buyTax ?? null,
    sellTax: input.sellTax ?? null,
    hideRisk: input.hideRisk ?? null,
    renouncedMint: input.renouncedMint ?? null,
    renouncedFreezeAccount: input.renouncedFreezeAccount ?? null,
    launchpadPlatform: input.launchpadPlatform ?? null,
    hasDlmmPool: Boolean(input.hasDlmmPool),
    hasDammV2Pool: Boolean(input.hasDammV2Pool),
    twoCandleAvgVolume,
    threeCandleAvgVolume,
    priceNow: input.priceNow ?? null,
    price1m: input.price1m ?? null,
    price5m: input.price5m ?? null,
    buys1m: input.buys1m ?? null,
    sells1m: input.sells1m ?? null,
    buys5m: input.buys5m ?? null,
    sells5m: input.sells5m ?? null,
    volume1m: input.volume1m ?? null,
    volume5m: input.volume5m ?? null,
    buyVolume1m: input.buyVolume1m ?? null,
    sellVolume1m: input.sellVolume1m ?? null,
    buyVolume5m: input.buyVolume5m ?? null,
    sellVolume5m: input.sellVolume5m ?? null,
    swaps1m: input.swaps1m ?? null,
    swaps5m: input.swaps5m ?? null,
    hotLevel: input.hotLevel ?? null,
    visitingCount: input.visitingCount ?? null,
    c0,
    c1,
    c2,
    momentum1mPct: pctChange(input.priceNow ?? null, input.price1m ?? null),
    momentum5mPct: pctChange(input.priceNow ?? null, input.price5m ?? null),
    buySellRatio1m: safeRatio(input.buys1m ?? null, input.sells1m ?? null),
    buySellRatio5m: safeRatio(input.buys5m ?? null, input.sells5m ?? null),
    buyVolumeDominance1m: safeRatio(
      input.buyVolume1m ?? null,
      input.volume1m ?? null,
    ),
    buyVolumeDominance5m: safeRatio(
      input.buyVolume5m ?? null,
      input.volume5m ?? null,
    ),
    volumePersistenceRatio: c0 && c1 && c0.volume > 0 ? c1.volume / c0.volume : null,
  };
}

export function scoreScreenFeatures(
  features: ScreenFeatures,
  config: ScreenerConfig,
): ScreenScore {
  const reasons: string[] = [];
  const rejectReasons: string[] = [];
  const greenFlags: string[] = [];
  const redFlags: string[] = [];

  if (features.renouncedMint !== true) {
    rejectReasons.push("mint not renounced");
  }
  if (features.renouncedFreezeAccount !== true) {
    rejectReasons.push("freeze not renounced");
  }
  if (features.launchpadPlatform === "pump_mayhem") {
    rejectReasons.push("pump_mayhem platform");
  }
  if (features.marketCap === null || features.marketCap <= 0) {
    rejectReasons.push("missing market cap");
  }
  if (features.twoCandleAvgVolume === null) {
    rejectReasons.push("missing migration candles");
  } else if (features.twoCandleAvgVolume < config.minTwoCandleAvgVolume) {
    rejectReasons.push("2-candle avg volume below threshold");
  }
  if (features.hideRisk === true) {
    rejectReasons.push("gmgn hide_risk flag");
  }
  if (
    features.ratTraderWallets !== null &&
    features.holderCount !== null &&
    features.holderCount > 0 &&
    features.ratTraderWallets / features.holderCount > config.maxRatTraderRatio
  ) {
    rejectReasons.push("rat trader wallet concentration too high");
  }
  if (
    features.top10HolderRate !== null &&
    features.top10HolderRate > config.maxTop10HolderRate
  ) {
    rejectReasons.push("top10 concentration too high");
  }
  if (
    features.creatorHoldRate !== null &&
    features.creatorHoldRate > config.maxCreatorHoldRate
  ) {
    rejectReasons.push("creator hold too high");
  }
  if (
    features.topBuyersHolderCount !== null &&
    features.topBuyersSoldCount !== null &&
    features.topBuyersHolderCount > 0 &&
    features.topBuyersSoldCount / features.topBuyersHolderCount > config.maxTopBuyerSoldRatio
  ) {
    rejectReasons.push("top buyers mostly fully sold");
  }
  if (
    features.topBundlerTraderPercentage !== null &&
    features.topBundlerTraderPercentage > config.maxBundlerRate
  ) {
    rejectReasons.push("bundler concentration too high");
  }

  let structureScore = 0;
  if (features.twoCandleAvgVolume !== null) {
    structureScore += clamp(features.twoCandleAvgVolume / 25000, 0, 1.5) * 20;
  }
  if (features.volumePersistenceRatio !== null) {
    structureScore += clamp(features.volumePersistenceRatio, 0, 1.25) * 12;
  }
  if (features.c0) {
    structureScore += clamp(features.c0.bodyPctOfRange, 0, 1) * 10;
    structureScore += clamp(features.c0.closePositionPct, 0, 1) * 8;
    structureScore -= clamp(features.c0.upperWickPctOfRange, 0, 1) * 8;
  }
  if (features.c1) {
    structureScore += clamp(features.c1.bodyPctOfRange, 0, 1) * 12;
    structureScore += clamp(features.c1.closePositionPct, 0, 1) * 10;
    structureScore -= clamp(features.c1.upperWickPctOfRange, 0, 1) * 10;
  }
  if (features.c2) {
    structureScore += clamp(features.c2.closePositionPct, 0, 1) * 6;
    structureScore -= clamp(features.c2.upperWickPctOfRange, 0, 1) * 6;
  }

  let flowScore = 0;
  if (features.buySellRatio1m !== null) {
    flowScore += clamp(features.buySellRatio1m / 2, 0, 1.5) * 10;
  }
  if (features.buySellRatio5m !== null) {
    flowScore += clamp(features.buySellRatio5m / 2, 0, 1.5) * 8;
  }
  if (features.buyVolumeDominance1m !== null) {
    flowScore += clamp(features.buyVolumeDominance1m, 0, 1) * 10;
  }
  if (features.buyVolumeDominance5m !== null) {
    flowScore += clamp(features.buyVolumeDominance5m, 0, 1) * 8;
  }
  if (features.momentum1mPct !== null) {
    flowScore += clamp(features.momentum1mPct * 10, -1, 1.5) * 6;
  }
  if (features.momentum5mPct !== null) {
    flowScore += clamp(features.momentum5mPct * 10, -1, 1.5) * 8;
  }
  if (features.hotLevel !== null) {
    flowScore += clamp(features.hotLevel / 3, 0, 1) * 4;
  }
  if (
    features.smartWallets !== null &&
    features.holderCount !== null &&
    features.holderCount > 0
  ) {
    flowScore +=
      clamp(features.smartWallets / features.holderCount, 0, 0.05) * 120;
  }
  if (
    features.renownedWallets !== null &&
    features.holderCount !== null &&
    features.holderCount > 0
  ) {
    flowScore +=
      clamp(features.renownedWallets / features.holderCount, 0, 0.05) * 80;
  }
  if (features.bluechipOwnerPercentage !== null) {
    flowScore += clamp(features.bluechipOwnerPercentage, 0, 0.03) * 200;
  }

  let poolScore = 0;
  if (features.hasDlmmPool) {
    poolScore += 8;
  }
  if (features.hasDammV2Pool) {
    poolScore += 6;
  }
  if (features.marketCap !== null && features.liquidity !== null && features.marketCap > 0) {
    const liqRatio = features.liquidity / features.marketCap;
    poolScore += clamp(liqRatio * 10, 0, 1) * 6;
  }

  let riskPenalty = 0;
  if (features.top10HolderRate !== null) {
    riskPenalty += clamp(features.top10HolderRate / 0.25, 0, 2) * 12;
  }
  if (features.creatorHoldRate !== null) {
    riskPenalty += clamp(features.creatorHoldRate / 0.05, 0, 2) * 10;
  }
  if (features.devTeamHoldRate !== null) {
    riskPenalty += clamp(features.devTeamHoldRate / 0.05, 0, 2) * 8;
  }
  if (features.privateVaultHoldRate !== null) {
    riskPenalty += clamp(features.privateVaultHoldRate / 0.05, 0, 2) * 8;
  }
  if (features.topBundlerTraderPercentage !== null) {
    riskPenalty += clamp(features.topBundlerTraderPercentage / 0.35, 0, 2) * 12;
  }
  if (features.topEntrapmentTraderPercentage !== null) {
    riskPenalty += clamp(features.topEntrapmentTraderPercentage / 0.12, 0, 2) * 10;
  }
  if (features.botDegenRate !== null) {
    riskPenalty += clamp(features.botDegenRate / 0.2, 0, 2) * 8;
  }
  if (
    features.sniperWallets !== null &&
    features.holderCount !== null &&
    features.holderCount > 0
  ) {
    riskPenalty +=
      clamp(features.sniperWallets / features.holderCount, 0, 0.08) * 80;
  }
  if (
    features.ratTraderWallets !== null &&
    features.holderCount !== null &&
    features.holderCount > 0
  ) {
    riskPenalty +=
      clamp(features.ratTraderWallets / features.holderCount, 0, 0.08) * 100;
  }
  if (
    features.freshWallets !== null &&
    features.holderCount !== null &&
    features.holderCount > 0
  ) {
    riskPenalty +=
      clamp(features.freshWallets / features.holderCount, 0, 0.25) * 20;
  }
  if (
    features.fastSniperCount !== null &&
    features.topBuyersHolderCount !== null &&
    features.topBuyersHolderCount > 0
  ) {
    riskPenalty +=
      clamp(features.fastSniperCount / features.topBuyersHolderCount, 0, 0.5) * 20;
  }
  if (
    features.topBuyersSoldCount !== null &&
    features.topBuyersHolderCount !== null &&
    features.topBuyersHolderCount > 0
  ) {
    riskPenalty +=
      clamp(features.topBuyersSoldCount / features.topBuyersHolderCount, 0, 1) * 10;
  }
  if (
    features.topBuyersSoldPartCount !== null &&
    features.topBuyersHolderCount !== null &&
    features.topBuyersHolderCount > 0
  ) {
    riskPenalty +=
      clamp(features.topBuyersSoldPartCount / features.topBuyersHolderCount, 0, 1) * 6;
  }
  if (features.buyTax !== null && features.buyTax > 0) {
    riskPenalty += clamp(features.buyTax / 10, 0, 1.5) * 10;
    if (features.buyTax > config.maxBuyTax) {
      rejectReasons.push("buy tax above threshold");
    }
  }
  if (features.sellTax !== null && features.sellTax > 0) {
    riskPenalty += clamp(features.sellTax / 10, 0, 1.5) * 12;
    if (features.sellTax > config.maxSellTax) {
      rejectReasons.push("sell tax above threshold");
    }
  }
  if (features.hideRisk === true) {
    riskPenalty += 25;
  }
  if (
    features.solPer10kMc !== null &&
    (features.solPer10kMc < config.minSolPer10kMc ||
      features.solPer10kMc > config.maxSolPer10kMc)
  ) {
    redFlags.push(`fee/mcap ratio ${features.solPer10kMc.toFixed(3)} outside preferred range`);
  } else if (features.solPer10kMc !== null) {
    greenFlags.push(`fee/mcap ratio ${features.solPer10kMc.toFixed(3)} in range`);
  }
  if (features.renouncedMint === false) {
    riskPenalty += 25;
  }
  if (features.renouncedFreezeAccount === false) {
    riskPenalty += 25;
  }
  if (features.launchpadPlatform === "pump_mayhem") {
    riskPenalty += 30;
  }
  if (
    features.solPer10kMc !== null &&
    (features.solPer10kMc < config.minSolPer10kMc ||
      features.solPer10kMc > config.maxSolPer10kMc)
  ) {
    riskPenalty += 8;
  }

  const finalScore = Math.round(structureScore + flowScore + poolScore - riskPenalty);

  if (features.twoCandleAvgVolume !== null) {
    reasons.push(`2-candle avg vol ${features.twoCandleAvgVolume.toFixed(0)}`);
  }
  if (features.buySellRatio1m !== null) {
    reasons.push(`buy/sell 1m ${features.buySellRatio1m.toFixed(2)}`);
  }
  if (features.top10HolderRate !== null) {
    reasons.push(`top10 ${(features.top10HolderRate * 100).toFixed(1)}%`);
  }
  if (features.topBundlerTraderPercentage !== null) {
    reasons.push(`bundler ${(features.topBundlerTraderPercentage * 100).toFixed(1)}%`);
  }
  if (
    features.smartWallets !== null &&
    features.holderCount !== null &&
    features.holderCount > 0
  ) {
    reasons.push(
      `smart ${(features.smartWallets / features.holderCount * 100).toFixed(1)}%`,
    );
  }
  if (
    features.topBuyersSoldCount !== null &&
    features.topBuyersHolderCount !== null &&
    features.topBuyersHolderCount > 0
  ) {
    reasons.push(
      `top-buyers sold ${((features.topBuyersSoldCount / features.topBuyersHolderCount) * 100).toFixed(1)}%`,
    );
  }

  if (features.c1 && features.c1.closePositionPct >= 0.6) {
    greenFlags.push("c1 closed strong in range");
  }
  if (features.c1 && features.c1.upperWickPctOfRange >= 0.5) {
    redFlags.push("c1 upper wick heavy");
  }
  if (
    features.topBuyersSoldCount !== null &&
    features.topBuyersHolderCount !== null &&
    features.topBuyersHolderCount > 0 &&
    features.topBuyersSoldCount / features.topBuyersHolderCount >= 0.75
  ) {
    redFlags.push("top buyers dumped heavily");
  }
  if (
    features.smartWallets !== null &&
    features.holderCount !== null &&
    features.holderCount > 0 &&
    features.smartWallets / features.holderCount >= 0.01
  ) {
    greenFlags.push("smart wallet participation present");
  }

  let verdict: ScreenScore["verdict"] = "reject";
  if (rejectReasons.length > 0) {
    verdict = "reject";
  } else if (finalScore >= config.strongScoreThreshold) {
    verdict = "strong-structure";
  } else if (finalScore >= config.tradeableScoreThreshold) {
    verdict = "tradeable";
  } else if (finalScore >= config.watchScoreThreshold) {
    verdict = "watch";
  } else if (finalScore >= config.highRiskScoreThreshold) {
    verdict = "high-risk-momentum";
  }

  return {
    structureScore: Math.round(structureScore),
    flowScore: Math.round(flowScore),
    poolScore: Math.round(poolScore),
    riskPenalty: Math.round(riskPenalty),
    finalScore,
    verdict,
    reasons,
    rejectReasons,
    greenFlags,
    redFlags,
  };
}
