import {
  CONTRACT_MULTIPLIER,
  blackScholesCall,
  clamp,
  roundTo,
} from "@/lib/debit-call-spread";

const YEAR_DAYS = 365;
const DEFAULT_DTE_BUCKETS = [60, 45, 30, 21, 14, 7, 0];

export type DebitSpreadScenarioMetric =
  | "positionValue"
  | "profitLoss"
  | "profitLossPercent"
  | "percentOfMaxProfitCaptured";

export type DebitSpreadScenarioInputs = {
  currentPrice: number;
  longStrike: number;
  shortStrike: number;
  currentDte: number;
  numberOfSpreads: number;
  entryDebit: number;
  impliedVolatilityPct: number;
  riskFreeRatePct: number;
  dividendYieldPct?: number;
  priceSteps?: number;
  priceTickSize?: number;
  minPrice?: number;
  maxPrice?: number;
  dteBuckets?: number[];
};

export type DebitSpreadScenarioPoint = {
  underlyingPrice: number;
  dte: number;
  longCallValue: number;
  shortCallValue: number;
  spreadValue: number;
  positionValue: number;
  entryCost: number;
  profitLoss: number;
  profitLossPercent: number;
  percentOfMaxProfitCaptured: number;
};

export type DebitSpreadScenarioSummary = {
  spreadWidth: number;
  entryCost: number;
  maxProfit: number;
  maxLoss: number;
  expiryBreakeven: number;
  currentSpreadValue: number;
  currentPositionValue: number;
  currentProfitLoss: number;
  currentProfitLossPercent: number;
};

export type DebitSpreadScenarioGrid = {
  priceBuckets: number[];
  dteBuckets: number[];
  points: DebitSpreadScenarioPoint[];
  summary: DebitSpreadScenarioSummary;
};

export function buildDebitSpreadDteBuckets(
  currentDte: number,
  customBuckets = DEFAULT_DTE_BUCKETS,
): number[] {
  const safeCurrentDte = Math.max(0, Math.round(currentDte));
  const buckets = new Set([safeCurrentDte, ...customBuckets]);

  return [
    ...new Set(
      [...buckets]
        .map((bucket) => clamp(Math.round(bucket), 0, safeCurrentDte))
        .filter((bucket) => bucket <= safeCurrentDte),
    ),
  ].sort((first, second) => second - first);
}

export function buildDebitSpreadPriceBuckets(
  currentPrice: number,
  steps = 25,
  customMinPrice?: number,
  customMaxPrice?: number,
  customTickSize?: number,
): number[] {
  const safeCurrentPrice = Math.max(currentPrice, 1);
  const defaultMinPrice = Math.max(1, safeCurrentPrice * 0.7);
  const defaultMaxPrice = Math.max(defaultMinPrice + 1, safeCurrentPrice * 1.3);
  const minPrice = Math.max(1, Math.round(customMinPrice ?? defaultMinPrice));
  const maxPrice = Math.max(minPrice + 1, Math.round(customMaxPrice ?? defaultMaxPrice));

  if (customTickSize !== undefined) {
    const tickSize = Math.max(1, Math.round(customTickSize));
    const ticks: number[] = [];

    for (let price = minPrice; price <= maxPrice; price += tickSize) {
      ticks.push(price);
    }

    if (ticks[ticks.length - 1] !== maxPrice) {
      ticks.push(maxPrice);
    }

    return ticks;
  }

  const safeSteps = Math.min(Math.max(Math.round(steps), 2), maxPrice - minPrice + 1);

  return Array.from({ length: safeSteps }, (_, index) =>
    Math.round(minPrice + ((maxPrice - minPrice) * index) / Math.max(safeSteps - 1, 1)),
  );
}

export function calculateDebitSpreadScenario(
  inputs: DebitSpreadScenarioInputs,
  underlyingPrice: number,
  dte: number,
): DebitSpreadScenarioPoint {
  const spreadWidth = Math.max(inputs.shortStrike - inputs.longStrike, 0);
  const safeDte = Math.max(Math.round(dte), 0);
  const entryCost = inputs.entryDebit * CONTRACT_MULTIPLIER * inputs.numberOfSpreads;
  const maxProfit =
    Math.max(spreadWidth - inputs.entryDebit, 0) *
    CONTRACT_MULTIPLIER *
    inputs.numberOfSpreads;
  const timeYears = safeDte / YEAR_DAYS;
  const volatility = Math.max(inputs.impliedVolatilityPct, 0) / 100;
  const rate = inputs.riskFreeRatePct / 100;
  const dividendYield = (inputs.dividendYieldPct ?? 0) / 100;

  const longCallValue =
    safeDte === 0
      ? Math.max(underlyingPrice - inputs.longStrike, 0)
      : blackScholesCall({
          spot: underlyingPrice,
          strike: inputs.longStrike,
          timeYears,
          volatility,
          rate,
          dividendYield,
        });
  const shortCallValue =
    safeDte === 0
      ? Math.max(underlyingPrice - inputs.shortStrike, 0)
      : blackScholesCall({
          spot: underlyingPrice,
          strike: inputs.shortStrike,
          timeYears,
          volatility,
          rate,
          dividendYield,
        });
  const spreadValue =
    safeDte === 0
      ? clamp(Math.max(underlyingPrice - inputs.longStrike, 0), 0, spreadWidth)
      : clamp(longCallValue - shortCallValue, 0, spreadWidth);
  const positionValue = spreadValue * CONTRACT_MULTIPLIER * inputs.numberOfSpreads;
  const profitLoss = positionValue - entryCost;

  return {
    underlyingPrice,
    dte: safeDte,
    longCallValue,
    shortCallValue,
    spreadValue,
    positionValue,
    entryCost,
    profitLoss,
    profitLossPercent: entryCost > 0 ? (profitLoss / entryCost) * 100 : 0,
    percentOfMaxProfitCaptured: maxProfit > 0 ? (profitLoss / maxProfit) * 100 : 0,
  };
}

export function buildDebitSpreadScenarioGrid(
  inputs: DebitSpreadScenarioInputs,
): DebitSpreadScenarioGrid {
  const priceBuckets = buildDebitSpreadPriceBuckets(
    inputs.currentPrice,
    inputs.priceSteps ?? 25,
    inputs.minPrice,
    inputs.maxPrice,
    inputs.priceTickSize,
  );
  const dteBuckets = buildDebitSpreadDteBuckets(
    inputs.currentDte,
    inputs.dteBuckets,
  );
  const points = dteBuckets.flatMap((dte) =>
    priceBuckets.map((price) => calculateDebitSpreadScenario(inputs, price, dte)),
  );
  const currentPoint = calculateDebitSpreadScenario(
    inputs,
    inputs.currentPrice,
    inputs.currentDte,
  );
  const spreadWidth = Math.max(inputs.shortStrike - inputs.longStrike, 0);
  const entryCost = inputs.entryDebit * CONTRACT_MULTIPLIER * inputs.numberOfSpreads;

  return {
    priceBuckets,
    dteBuckets,
    points,
    summary: {
      spreadWidth,
      entryCost,
      maxProfit:
        Math.max(spreadWidth - inputs.entryDebit, 0) *
        CONTRACT_MULTIPLIER *
        inputs.numberOfSpreads,
      maxLoss: entryCost,
      expiryBreakeven: inputs.longStrike + inputs.entryDebit,
      currentSpreadValue: currentPoint.spreadValue,
      currentPositionValue: currentPoint.positionValue,
      currentProfitLoss: currentPoint.profitLoss,
      currentProfitLossPercent: currentPoint.profitLossPercent,
    },
  };
}

export function getDebitSpreadMetricValue(
  point: DebitSpreadScenarioPoint,
  metric: DebitSpreadScenarioMetric,
): number {
  return roundTo(
    point[metric],
    metric === "profitLossPercent" || metric === "percentOfMaxProfitCaptured" ? 1 : 0,
  );
}
