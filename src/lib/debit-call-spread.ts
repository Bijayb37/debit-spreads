const DAY_MS = 24 * 60 * 60 * 1000;
const YEAR_DAYS = 365;

export const CONTRACT_MULTIPLIER = 100;
export const PUT_RATIO_SHORT_COUNT_MIN = 2;
export const PUT_RATIO_SHORT_COUNT_MAX = 10;
const DEFAULT_PUT_RATIO_SHORT_COUNT = PUT_RATIO_SHORT_COUNT_MIN;

export type OptionStrategy =
  | "debit-call-spread"
  | "call-ratio-spread"
  | "call-calendar"
  | "debit-put-spread"
  | "bear-put"
  | "put-ratio-spread"
  | "long-call";

type BlackScholesCallInput = {
  spot: number;
  strike: number;
  timeYears: number;
  volatility: number;
  rate: number;
  dividendYield: number;
};

type PriceDebitCallSpreadInput = Omit<BlackScholesCallInput, "strike"> & {
  longStrike: number;
  shortStrike: number;
  ratioShortCount?: number;
};

type PriceStrategyInput = PriceDebitCallSpreadInput & {
  strategy: OptionStrategy;
  shortTimeYears?: number;
};

export type StrategyInputs = {
  strategy: OptionStrategy;
  todayIso: string;
  expiryIso: string;
  spot: number;
  longStrike: number;
  shortStrike: number;
  ratioShortCount: number;
  shortExpirationDays?: number;
  volatilityPct: number;
  futureVolatilityPct: number;
  capital: number;
  allowFractionalContracts: boolean;
  scenarioPrice: number;
  calendarShortPrice?: number;
  scenarioOffsetDays: number;
  ratePct: number;
  dividendYieldPct: number;
};

export type ScenarioSnapshot = {
  strategy: OptionStrategy;
  expirationDays: number;
  selectedOffsetDays: number;
  selectedDateIso: string;
  timeNowYears: number;
  timeAtScenarioYears: number;
  shortExpirationDays: number;
  calendarShortPrice: number;
  usesCalendarShortPrice: boolean;
  shortTimeNowYears: number;
  shortTimeAtScenarioYears: number;
  width: number;
  ratioShortCount: number;
  unitCost: number;
  contracts: number;
  allowFractionalContracts: boolean;
  totalCost: number;
  cashLeft: number;
  maxValuePerUnit: number | null;
  maxProfitPerUnit: number | null;
  maxLossPerUnit: number | null;
  isProfitCapped: boolean;
  breakEvenAtExpiry: number;
  lowerBreakEvenAtExpiry: number | null;
  scenarioUnitValue: number;
  scenarioPositionValue: number;
  pnl: number;
  roi: number;
};

export type TimelineRow = {
  dateIso: string;
  daysElapsed: number;
  daysRemaining: number;
  unitValue: number;
  positionValue: number;
  intrinsicValue: number;
  pnl: number;
  roi: number;
  isHighlighted: boolean;
};

export type PriceLadderRow = {
  price: number;
  unitValue: number;
  intrinsicValue: number;
  positionValue: number;
  pnl: number;
  roi: number;
  isHighlighted: boolean;
};

export type PriceCurvePoint = {
  price: number;
  selectedDateValue: number;
  expiryValue: number;
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function roundTo(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function dateToIso(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function normalizePutRatioShortCount(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_PUT_RATIO_SHORT_COUNT;
  }

  return clamp(
    Math.round(value ?? DEFAULT_PUT_RATIO_SHORT_COUNT),
    PUT_RATIO_SHORT_COUNT_MIN,
    PUT_RATIO_SHORT_COUNT_MAX,
  );
}

export function getDefaultCallCalendarShortExpirationDays(expirationDays: number): number {
  const maxShortExpirationDays = Math.max(0, Math.round(expirationDays) - 1);

  return Math.min(30, maxShortExpirationDays);
}

export function normalizeCallCalendarShortExpirationDays(
  value: number | undefined,
  expirationDays: number,
): number {
  const maxShortExpirationDays = Math.max(0, Math.round(expirationDays) - 1);

  if (maxShortExpirationDays <= 0) {
    return 0;
  }

  if (!Number.isFinite(value)) {
    return getDefaultCallCalendarShortExpirationDays(expirationDays);
  }

  return clamp(Math.round(value ?? 0), 0, maxShortExpirationDays);
}

function isoToUtcTimestamp(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function utcTimestampToIso(timestamp: number): string {
  const value = new Date(timestamp);
  return value.toISOString().slice(0, 10);
}

export function addDaysToIso(isoDate: string, days: number): string {
  return utcTimestampToIso(isoToUtcTimestamp(isoDate) + days * DAY_MS);
}

export function daysBetween(startIsoDate: string, endIsoDate: string): number {
  return Math.max(
    Math.round((isoToUtcTimestamp(endIsoDate) - isoToUtcTimestamp(startIsoDate)) / DAY_MS),
    0,
  );
}

export function formatLongDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

function normalCdf(input: number): number {
  const absInput = Math.abs(input);
  const t = 1 / (1 + 0.2316419 * absInput);
  const density = 0.3989422804014327 * Math.exp((-absInput * absInput) / 2);
  const estimate =
    1 -
    density *
      t *
      (0.31938153 +
        t *
          (-0.356563782 +
            t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));

  return input >= 0 ? estimate : 1 - estimate;
}

export function blackScholesCall({
  spot,
  strike,
  timeYears,
  volatility,
  rate,
  dividendYield,
}: BlackScholesCallInput): number {
  const safeSpot = Math.max(spot, 0.0001);
  const safeStrike = Math.max(strike, 0.0001);
  const safeTime = Math.max(timeYears, 0);
  const safeVolatility = Math.max(volatility, 0);

  if (safeTime === 0) {
    return Math.max(safeSpot - safeStrike, 0);
  }

  if (safeVolatility === 0) {
    return Math.max(
      safeSpot * Math.exp(-dividendYield * safeTime) -
        safeStrike * Math.exp(-rate * safeTime),
      0,
    );
  }

  const rootTime = Math.sqrt(safeTime);
  const d1 =
    (Math.log(safeSpot / safeStrike) +
      (rate - dividendYield + 0.5 * safeVolatility * safeVolatility) * safeTime) /
    (safeVolatility * rootTime);
  const d2 = d1 - safeVolatility * rootTime;

  return (
    safeSpot * Math.exp(-dividendYield * safeTime) * normalCdf(d1) -
    safeStrike * Math.exp(-rate * safeTime) * normalCdf(d2)
  );
}

export function blackScholesPut({
  spot,
  strike,
  timeYears,
  volatility,
  rate,
  dividendYield,
}: BlackScholesCallInput): number {
  const safeSpot = Math.max(spot, 0.0001);
  const safeStrike = Math.max(strike, 0.0001);
  const safeTime = Math.max(timeYears, 0);
  const safeVolatility = Math.max(volatility, 0);

  if (safeTime === 0) {
    return Math.max(safeStrike - safeSpot, 0);
  }

  if (safeVolatility === 0) {
    return Math.max(
      safeStrike * Math.exp(-rate * safeTime) -
        safeSpot * Math.exp(-dividendYield * safeTime),
      0,
    );
  }

  const rootTime = Math.sqrt(safeTime);
  const d1 =
    (Math.log(safeSpot / safeStrike) +
      (rate - dividendYield + 0.5 * safeVolatility * safeVolatility) * safeTime) /
    (safeVolatility * rootTime);
  const d2 = d1 - safeVolatility * rootTime;

  return (
    safeStrike * Math.exp(-rate * safeTime) * normalCdf(-d2) -
    safeSpot * Math.exp(-dividendYield * safeTime) * normalCdf(-d1)
  );
}

export function priceLongCall(input: BlackScholesCallInput): number {
  return blackScholesCall(input);
}

export function priceLongPut(input: BlackScholesCallInput): number {
  return blackScholesPut(input);
}

export function priceDebitCallSpread({
  spot,
  longStrike,
  shortStrike,
  timeYears,
  volatility,
  rate,
  dividendYield,
}: PriceDebitCallSpreadInput): number {
  const width = Math.max(shortStrike - longStrike, 0);

  if (width === 0) {
    return 0;
  }

  if (timeYears === 0) {
    return clamp(
      Math.max(spot - longStrike, 0) - Math.max(spot - shortStrike, 0),
      0,
      width,
    );
  }

  const longCall = blackScholesCall({
    spot,
    strike: longStrike,
    timeYears,
    volatility,
    rate,
    dividendYield,
  });
  const shortCall = blackScholesCall({
    spot,
    strike: shortStrike,
    timeYears,
    volatility,
    rate,
    dividendYield,
  });

  return clamp(longCall - shortCall, 0, width);
}

export function priceDebitPutSpread({
  spot,
  longStrike,
  shortStrike,
  timeYears,
  volatility,
  rate,
  dividendYield,
}: PriceDebitCallSpreadInput): number {
  const width = Math.max(longStrike - shortStrike, 0);

  if (width === 0) {
    return 0;
  }

  if (timeYears === 0) {
    return clamp(
      Math.max(longStrike - spot, 0) - Math.max(shortStrike - spot, 0),
      0,
      width,
    );
  }

  const longPut = blackScholesPut({
    spot,
    strike: longStrike,
    timeYears,
    volatility,
    rate,
    dividendYield,
  });
  const shortPut = blackScholesPut({
    spot,
    strike: shortStrike,
    timeYears,
    volatility,
    rate,
    dividendYield,
  });

  return clamp(longPut - shortPut, 0, width);
}

export function pricePutRatioSpread({
  spot,
  longStrike,
  shortStrike,
  ratioShortCount,
  timeYears,
  volatility,
  rate,
  dividendYield,
}: PriceDebitCallSpreadInput): number {
  const width = Math.max(longStrike - shortStrike, 0);
  const shortCount = normalizePutRatioShortCount(ratioShortCount);

  if (width === 0) {
    return 0;
  }

  if (timeYears === 0) {
    return (
      Math.max(longStrike - spot, 0) -
      shortCount * Math.max(shortStrike - spot, 0)
    );
  }

  const longPut = blackScholesPut({
    spot,
    strike: longStrike,
    timeYears,
    volatility,
    rate,
    dividendYield,
  });
  const shortPut = blackScholesPut({
    spot,
    strike: shortStrike,
    timeYears,
    volatility,
    rate,
    dividendYield,
  });

  return longPut - shortCount * shortPut;
}

export function priceCallRatioSpread({
  spot,
  longStrike,
  shortStrike,
  ratioShortCount,
  timeYears,
  volatility,
  rate,
  dividendYield,
}: PriceDebitCallSpreadInput): number {
  const width = Math.max(shortStrike - longStrike, 0);
  const shortCount = normalizePutRatioShortCount(ratioShortCount);

  if (width === 0) {
    return 0;
  }

  if (timeYears === 0) {
    return (
      Math.max(spot - longStrike, 0) -
      shortCount * Math.max(spot - shortStrike, 0)
    );
  }

  const longCall = blackScholesCall({
    spot,
    strike: longStrike,
    timeYears,
    volatility,
    rate,
    dividendYield,
  });
  const shortCall = blackScholesCall({
    spot,
    strike: shortStrike,
    timeYears,
    volatility,
    rate,
    dividendYield,
  });

  return longCall - shortCount * shortCall;
}

export function priceCallCalendar({
  spot,
  longStrike,
  timeYears,
  shortTimeYears = timeYears,
  volatility,
  rate,
  dividendYield,
}: PriceDebitCallSpreadInput & { shortTimeYears?: number }): number {
  const safeLongTimeYears = Math.max(timeYears, 0);
  const safeShortTimeYears = Math.max(shortTimeYears, 0);
  const longCall = blackScholesCall({
    spot,
    strike: longStrike,
    timeYears: safeLongTimeYears,
    volatility,
    rate,
    dividendYield,
  });
  const shortCall = blackScholesCall({
    spot,
    strike: longStrike,
    timeYears: safeShortTimeYears,
    volatility,
    rate,
    dividendYield,
  });

  return Math.max(longCall - shortCall, 0);
}

function priceCallCalendarScenario({
  longValuationPrice,
  shortSettlementPrice,
  longStrike,
  selectedOffsetDays,
  shortExpirationDays,
  timeYears,
  shortTimeYears,
  volatility,
  rate,
  dividendYield,
}: {
  longValuationPrice: number;
  shortSettlementPrice: number;
  longStrike: number;
  selectedOffsetDays: number;
  shortExpirationDays: number;
  timeYears: number;
  shortTimeYears: number;
  volatility: number;
  rate: number;
  dividendYield: number;
}): number {
  if (selectedOffsetDays >= shortExpirationDays) {
    const longSpot =
      selectedOffsetDays === shortExpirationDays
        ? shortSettlementPrice
        : longValuationPrice;
    const longCall = blackScholesCall({
      spot: longSpot,
      strike: longStrike,
      timeYears,
      volatility,
      rate,
      dividendYield,
    });
    const shortSettlement = Math.max(shortSettlementPrice - longStrike, 0);

    return longCall - shortSettlement;
  }

  return priceCallCalendar({
    spot: longValuationPrice,
    longStrike,
    shortStrike: longStrike,
    shortTimeYears,
    timeYears,
    volatility,
    rate,
    dividendYield,
  });
}

export function getPutRatioSpreadLowerBreakEvenAtExpiry(
  longStrike: number,
  shortStrike: number,
  unitCost: number,
  ratioShortCount?: number,
): number | null {
  const shortCount = normalizePutRatioShortCount(ratioShortCount);
  const lowerBreakEven =
    (unitCost - longStrike + shortCount * shortStrike) / (shortCount - 1);

  return lowerBreakEven > 0 && lowerBreakEven < shortStrike
    ? lowerBreakEven
    : null;
}

export function getPutRatioSpreadMaxLossPerUnit(
  longStrike: number,
  shortStrike: number,
  unitCost: number,
  ratioShortCount?: number,
): number {
  const shortCount = normalizePutRatioShortCount(ratioShortCount);

  return Math.max(unitCost, shortCount * shortStrike - longStrike + unitCost, 0);
}

export function getCallRatioSpreadUpperBreakEvenAtExpiry(
  longStrike: number,
  shortStrike: number,
  unitCost: number,
  ratioShortCount?: number,
): number | null {
  const shortCount = normalizePutRatioShortCount(ratioShortCount);
  const upperBreakEven =
    (shortCount * shortStrike - longStrike - unitCost) / (shortCount - 1);

  return upperBreakEven > shortStrike ? upperBreakEven : null;
}

function priceStrategy({
  strategy,
  spot,
  longStrike,
  shortStrike,
  ratioShortCount,
  shortTimeYears,
  timeYears,
  volatility,
  rate,
  dividendYield,
}: PriceStrategyInput): number {
  if (strategy === "long-call") {
    return priceLongCall({
      spot,
      strike: longStrike,
      timeYears,
      volatility,
      rate,
      dividendYield,
    });
  }

  if (strategy === "bear-put") {
    return priceLongPut({
      spot,
      strike: longStrike,
      timeYears,
      volatility,
      rate,
      dividendYield,
    });
  }

  if (strategy === "put-ratio-spread") {
    return pricePutRatioSpread({
      spot,
      longStrike,
      shortStrike,
      ratioShortCount,
      timeYears,
      volatility,
      rate,
      dividendYield,
    });
  }

  if (strategy === "call-ratio-spread") {
    return priceCallRatioSpread({
      spot,
      longStrike,
      shortStrike,
      ratioShortCount,
      timeYears,
      volatility,
      rate,
      dividendYield,
    });
  }

  if (strategy === "call-calendar") {
    return priceCallCalendar({
      spot,
      longStrike,
      shortStrike,
      shortTimeYears,
      timeYears,
      volatility,
      rate,
      dividendYield,
    });
  }

  if (strategy === "debit-put-spread") {
    return priceDebitPutSpread({
      spot,
      longStrike,
      shortStrike,
      timeYears,
      volatility,
      rate,
      dividendYield,
    });
  }

  return priceDebitCallSpread({
    spot,
    longStrike,
    shortStrike,
    timeYears,
    volatility,
    rate,
    dividendYield,
  });
}

function intrinsicStrategyValue(
  strategy: OptionStrategy,
  spot: number,
  longStrike: number,
  shortStrike: number,
  ratioShortCount = DEFAULT_PUT_RATIO_SHORT_COUNT,
): number {
  if (strategy === "long-call") {
    return Math.max(spot - longStrike, 0);
  }

  if (strategy === "bear-put") {
    return Math.max(longStrike - spot, 0);
  }

  if (strategy === "call-calendar") {
    return 0;
  }

  if (strategy === "debit-put-spread") {
    const width = Math.max(longStrike - shortStrike, 0);

    return clamp(
      Math.max(longStrike - spot, 0) - Math.max(shortStrike - spot, 0),
      0,
      width,
    );
  }

  if (strategy === "put-ratio-spread") {
    const shortCount = normalizePutRatioShortCount(ratioShortCount);

    return (
      Math.max(longStrike - spot, 0) -
      shortCount * Math.max(shortStrike - spot, 0)
    );
  }

  if (strategy === "call-ratio-spread") {
    const shortCount = normalizePutRatioShortCount(ratioShortCount);

    return (
      Math.max(spot - longStrike, 0) -
      shortCount * Math.max(spot - shortStrike, 0)
    );
  }

  const width = Math.max(shortStrike - longStrike, 0);

  return clamp(
    Math.max(spot - longStrike, 0) - Math.max(spot - shortStrike, 0),
    0,
    width,
  );
}

export function createScenarioSnapshot({
  strategy,
  todayIso,
  expiryIso,
  spot,
  longStrike,
  shortStrike,
  ratioShortCount,
  shortExpirationDays,
  volatilityPct,
  futureVolatilityPct,
  capital,
  allowFractionalContracts,
  scenarioPrice,
  calendarShortPrice,
  scenarioOffsetDays,
  ratePct,
  dividendYieldPct,
}: StrategyInputs): ScenarioSnapshot {
  const expirationDays = daysBetween(todayIso, expiryIso);
  const selectedOffsetDays = clamp(
    Math.round(scenarioOffsetDays),
    0,
    expirationDays,
  );
  const selectedDateIso = addDaysToIso(todayIso, selectedOffsetDays);
  const timeNowYears = expirationDays / YEAR_DAYS;
  const timeAtScenarioYears = Math.max(
    (expirationDays - selectedOffsetDays) / YEAR_DAYS,
    0,
  );
  const isCallCalendar = strategy === "call-calendar";
  const normalizedShortExpirationDays = isCallCalendar
    ? normalizeCallCalendarShortExpirationDays(shortExpirationDays, expirationDays)
    : expirationDays;
  const shortTimeNowYears = normalizedShortExpirationDays / YEAR_DAYS;
  const shortTimeAtScenarioYears = Math.max(
    (normalizedShortExpirationDays - selectedOffsetDays) / YEAR_DAYS,
    0,
  );
  const normalizedCalendarShortPrice = Math.max(calendarShortPrice ?? scenarioPrice, 1);
  const usesCalendarShortPrice =
    isCallCalendar && selectedOffsetDays >= normalizedShortExpirationDays;
  const volatility = Math.max(volatilityPct, 0) / 100;
  const futureVolatility = Math.max(futureVolatilityPct, 0) / 100;
  const rate = ratePct / 100;
  const dividendYield = dividendYieldPct / 100;
  const isBearPut = strategy === "bear-put";
  const isCallRatioSpread = strategy === "call-ratio-spread";
  const isPutRatioSpread = strategy === "put-ratio-spread";
  const isPutDownsideStrategy =
    strategy === "debit-put-spread" || isPutRatioSpread;
  const normalizedRatioShortCount = normalizePutRatioShortCount(ratioShortCount);
  const width =
    strategy === "long-call" || isBearPut || isCallCalendar
      ? 0
      : isPutDownsideStrategy
        ? Math.max(longStrike - shortStrike, 0)
        : Math.max(shortStrike - longStrike, 0);
  const unitCost = priceStrategy({
    strategy,
    spot,
    longStrike,
    shortStrike,
    ratioShortCount: normalizedRatioShortCount,
    shortTimeYears: shortTimeNowYears,
    timeYears: timeNowYears,
    volatility,
    rate,
    dividendYield,
  });
  const contracts =
    unitCost > 0
      ? allowFractionalContracts
        ? capital / (unitCost * CONTRACT_MULTIPLIER)
        : Math.floor(capital / (unitCost * CONTRACT_MULTIPLIER))
      : 0;
  const totalCost =
    allowFractionalContracts && contracts > 0
      ? capital
      : contracts * unitCost * CONTRACT_MULTIPLIER;
  const scenarioUnitValue = isCallCalendar
    ? priceCallCalendarScenario({
        longValuationPrice: scenarioPrice,
        shortSettlementPrice: normalizedCalendarShortPrice,
        longStrike,
        selectedOffsetDays,
        shortExpirationDays: normalizedShortExpirationDays,
        shortTimeYears: shortTimeAtScenarioYears,
        timeYears: timeAtScenarioYears,
        volatility: futureVolatility,
        rate,
        dividendYield,
      })
    : priceStrategy({
        strategy,
        spot: scenarioPrice,
        longStrike,
        shortStrike,
        ratioShortCount: normalizedRatioShortCount,
        shortTimeYears: shortTimeAtScenarioYears,
        timeYears: timeAtScenarioYears,
        volatility: futureVolatility,
        rate,
        dividendYield,
      });
  const scenarioPositionValue =
    scenarioUnitValue * CONTRACT_MULTIPLIER * contracts;
  const pnl = scenarioPositionValue - totalCost;
  const roi = totalCost > 0 ? pnl / totalCost : 0;
  const maxValuePerUnit =
    strategy === "long-call" || isCallCalendar ? null : isBearPut ? longStrike : width;
  const maxProfitPerUnit =
    strategy === "long-call" || isCallCalendar
      ? null
      : isBearPut
        ? Math.max(longStrike - unitCost, 0)
        : Math.max(width - unitCost, 0);
  const maxLossPerUnit =
    isCallRatioSpread
      ? null
      : isPutRatioSpread
      ? getPutRatioSpreadMaxLossPerUnit(
          longStrike,
          shortStrike,
          unitCost,
          normalizedRatioShortCount,
        )
      : unitCost;
  const callRatioUpperBreakEvenAtExpiry = isCallRatioSpread
    ? getCallRatioSpreadUpperBreakEvenAtExpiry(
        longStrike,
        shortStrike,
        unitCost,
        normalizedRatioShortCount,
      )
    : null;
  const breakEvenAtExpiry = isBearPut
    ? longStrike - unitCost
    : isCallRatioSpread
      ? callRatioUpperBreakEvenAtExpiry ?? longStrike + unitCost
      : isCallCalendar
        ? longStrike
      : isPutDownsideStrategy
        ? longStrike - unitCost
        : longStrike + unitCost;
  const lowerBreakEvenAtExpiry =
    isPutRatioSpread
      ? getPutRatioSpreadLowerBreakEvenAtExpiry(
          longStrike,
          shortStrike,
          unitCost,
          normalizedRatioShortCount,
        )
      : callRatioUpperBreakEvenAtExpiry !== null
        ? longStrike + unitCost
      : null;

  return {
    strategy,
    expirationDays,
    selectedOffsetDays,
    selectedDateIso,
    timeNowYears,
    timeAtScenarioYears,
    shortExpirationDays: normalizedShortExpirationDays,
    calendarShortPrice: normalizedCalendarShortPrice,
    usesCalendarShortPrice,
    shortTimeNowYears,
    shortTimeAtScenarioYears,
    width,
    ratioShortCount: normalizedRatioShortCount,
    unitCost,
    contracts,
    allowFractionalContracts,
    totalCost,
    cashLeft: capital - totalCost,
    maxValuePerUnit,
    maxProfitPerUnit,
    maxLossPerUnit,
    isProfitCapped: strategy !== "long-call" && !isCallCalendar,
    breakEvenAtExpiry,
    lowerBreakEvenAtExpiry,
    scenarioUnitValue,
    scenarioPositionValue,
    pnl,
    roi,
  };
}

function buildOffsets(maxDays: number, highlightOffset: number, samples = 8): number[] {
  const offsets = new Set([0, maxDays, clamp(highlightOffset, 0, maxDays)]);

  for (let index = 0; index < samples; index += 1) {
    offsets.add(Math.round((maxDays * index) / Math.max(samples - 1, 1)));
  }

  return [...offsets].sort((first, second) => first - second);
}

function buildPriceSteps(
  minPrice: number,
  maxPrice: number,
  highlightPrice: number,
  samples = 10,
): number[] {
  const safeMin = Math.max(1, Math.floor(Math.max(minPrice, 0.5)));
  const safeMax = Math.ceil(Math.max(maxPrice, safeMin + 1));
  const prices = new Set([
    safeMin,
    safeMax,
    Math.round(clamp(highlightPrice, safeMin, safeMax)),
  ]);

  for (let index = 0; index < samples; index += 1) {
    prices.add(Math.round(safeMin + ((safeMax - safeMin) * index) / Math.max(samples - 1, 1)));
  }

  return [...prices].sort((first, second) => first - second);
}

export function buildTimelineRows(inputs: StrategyInputs): TimelineRow[] {
  const snapshot = createScenarioSnapshot(inputs);
  const futureVolatility = Math.max(inputs.futureVolatilityPct, 0) / 100;
  const rate = inputs.ratePct / 100;
  const dividendYield = inputs.dividendYieldPct / 100;
  const isCallCalendar = inputs.strategy === "call-calendar";

  return buildOffsets(
    snapshot.expirationDays,
    snapshot.selectedOffsetDays,
    8,
  ).map((offset) => {
    const timeYears = Math.max((snapshot.expirationDays - offset) / YEAR_DAYS, 0);
    const shortTimeYears = Math.max(
      (snapshot.shortExpirationDays - offset) / YEAR_DAYS,
      0,
    );
    const unitValue = isCallCalendar
      ? priceCallCalendarScenario({
          longValuationPrice: inputs.scenarioPrice,
          shortSettlementPrice: snapshot.calendarShortPrice,
          longStrike: inputs.longStrike,
          selectedOffsetDays: offset,
          shortExpirationDays: snapshot.shortExpirationDays,
          shortTimeYears,
          timeYears,
          volatility: futureVolatility,
          rate,
          dividendYield,
        })
      : priceStrategy({
          strategy: inputs.strategy,
          spot: inputs.scenarioPrice,
          longStrike: inputs.longStrike,
          shortStrike: inputs.shortStrike,
          ratioShortCount: inputs.ratioShortCount,
          shortTimeYears,
          timeYears,
          volatility: futureVolatility,
          rate,
          dividendYield,
        });
    const positionValue = unitValue * CONTRACT_MULTIPLIER * snapshot.contracts;
    const pnl = positionValue - snapshot.totalCost;
    return {
      dateIso: addDaysToIso(inputs.todayIso, offset),
      daysElapsed: offset,
      daysRemaining: snapshot.expirationDays - offset,
      unitValue,
      positionValue,
      intrinsicValue: intrinsicStrategyValue(
        inputs.strategy,
        inputs.scenarioPrice,
        inputs.longStrike,
        inputs.shortStrike,
        inputs.ratioShortCount,
      ),
      pnl,
      roi: snapshot.totalCost > 0 ? pnl / snapshot.totalCost : 0,
      isHighlighted: offset === snapshot.selectedOffsetDays,
    };
  });
}

export function buildPriceLadderRows(inputs: StrategyInputs): PriceLadderRow[] {
  const snapshot = createScenarioSnapshot(inputs);
  const futureVolatility = Math.max(inputs.futureVolatilityPct, 0) / 100;
  const rate = inputs.ratePct / 100;
  const dividendYield = inputs.dividendYieldPct / 100;
  const isCallRatioSpread = inputs.strategy === "call-ratio-spread";
  const isCallCalendar = inputs.strategy === "call-calendar";
  const isPutDownsideStrategy =
    inputs.strategy === "debit-put-spread" ||
    inputs.strategy === "put-ratio-spread";
  const upperStrike =
    inputs.strategy === "debit-call-spread" || isCallRatioSpread
      ? inputs.shortStrike
      : inputs.longStrike;
  const lowerStrike = isPutDownsideStrategy ? inputs.shortStrike : inputs.longStrike;
  const anchorPrice = Math.max(
    inputs.spot,
    inputs.scenarioPrice,
    snapshot.calendarShortPrice,
    upperStrike,
  );
  const floorPrice = Math.max(
    1,
    Math.min(
      lowerStrike,
      inputs.spot,
      inputs.scenarioPrice,
      snapshot.calendarShortPrice,
    ) * 0.7,
  );
  const ceilingPrice = Math.max(
    anchorPrice * 1.3,
    inputs.strategy === "debit-call-spread"
      ? inputs.shortStrike + snapshot.width
      : isCallRatioSpread
        ? inputs.shortStrike + snapshot.width * 4
        : inputs.longStrike * 1.5,
  );

  return buildPriceSteps(floorPrice, ceilingPrice, inputs.scenarioPrice, 10).map(
    (price) => {
      const shortSettlementPrice =
        isCallCalendar && snapshot.selectedOffsetDays === snapshot.shortExpirationDays
          ? price
          : snapshot.calendarShortPrice;
      const unitValue = isCallCalendar
        ? priceCallCalendarScenario({
            longValuationPrice: price,
            shortSettlementPrice,
            longStrike: inputs.longStrike,
            selectedOffsetDays: snapshot.selectedOffsetDays,
            shortExpirationDays: snapshot.shortExpirationDays,
            shortTimeYears: snapshot.shortTimeAtScenarioYears,
            timeYears: snapshot.timeAtScenarioYears,
            volatility: futureVolatility,
            rate,
            dividendYield,
          })
        : priceStrategy({
            strategy: inputs.strategy,
            spot: price,
            longStrike: inputs.longStrike,
            shortStrike: inputs.shortStrike,
            ratioShortCount: inputs.ratioShortCount,
            shortTimeYears: snapshot.shortTimeAtScenarioYears,
            timeYears: snapshot.timeAtScenarioYears,
            volatility: futureVolatility,
            rate,
            dividendYield,
          });
      const positionValue = unitValue * CONTRACT_MULTIPLIER * snapshot.contracts;
      const pnl = positionValue - snapshot.totalCost;

      return {
        price,
        unitValue,
        intrinsicValue: intrinsicStrategyValue(
          inputs.strategy,
          price,
          inputs.longStrike,
          inputs.shortStrike,
          inputs.ratioShortCount,
        ),
        positionValue,
        pnl,
        roi: snapshot.totalCost > 0 ? pnl / snapshot.totalCost : 0,
        isHighlighted: Math.round(price) === Math.round(inputs.scenarioPrice),
      };
    },
  );
}

export function buildPriceCurve(inputs: StrategyInputs): PriceCurvePoint[] {
  const snapshot = createScenarioSnapshot(inputs);
  const futureVolatility = Math.max(inputs.futureVolatilityPct, 0) / 100;
  const rate = inputs.ratePct / 100;
  const dividendYield = inputs.dividendYieldPct / 100;
  const isCallRatioSpread = inputs.strategy === "call-ratio-spread";
  const isCallCalendar = inputs.strategy === "call-calendar";
  const isPutDownsideStrategy =
    inputs.strategy === "debit-put-spread" ||
    inputs.strategy === "put-ratio-spread";
  const upperStrike =
    inputs.strategy === "debit-call-spread" || isCallRatioSpread
      ? inputs.shortStrike
      : inputs.longStrike;
  const lowerStrike = isPutDownsideStrategy ? inputs.shortStrike : inputs.longStrike;
  const ceilingPrice = Math.max(
    inputs.scenarioPrice,
    snapshot.calendarShortPrice,
    upperStrike,
    inputs.spot,
    inputs.longStrike,
  );
  const minPrice = Math.max(1, Math.min(lowerStrike, inputs.spot) * 0.7);
  const maxPrice = Math.max(
    ceilingPrice * 1.4,
    inputs.strategy === "debit-call-spread"
      ? inputs.shortStrike + snapshot.width
      : isCallRatioSpread
        ? inputs.shortStrike + snapshot.width * 4
        : inputs.longStrike * 1.5,
  );
  const pointCount = 61;

  return Array.from({ length: pointCount }, (_, index) => {
    const price = roundTo(
      minPrice + ((maxPrice - minPrice) * index) / Math.max(pointCount - 1, 1),
      2,
    );
    const selectedShortSettlementPrice =
      isCallCalendar && snapshot.selectedOffsetDays === snapshot.shortExpirationDays
        ? price
        : snapshot.calendarShortPrice;
    const selectedUnitValue = isCallCalendar
      ? priceCallCalendarScenario({
          longValuationPrice: price,
          shortSettlementPrice: selectedShortSettlementPrice,
          longStrike: inputs.longStrike,
          selectedOffsetDays: snapshot.selectedOffsetDays,
          shortExpirationDays: snapshot.shortExpirationDays,
          shortTimeYears: snapshot.shortTimeAtScenarioYears,
          timeYears: snapshot.timeAtScenarioYears,
          volatility: futureVolatility,
          rate,
          dividendYield,
        })
      : priceStrategy({
          strategy: inputs.strategy,
          spot: price,
          longStrike: inputs.longStrike,
          shortStrike: inputs.shortStrike,
          ratioShortCount: inputs.ratioShortCount,
          shortTimeYears: snapshot.shortTimeAtScenarioYears,
          timeYears: snapshot.timeAtScenarioYears,
          volatility: futureVolatility,
          rate,
          dividendYield,
        });
    const expiryUnitValue = isCallCalendar
      ? priceCallCalendarScenario({
          longValuationPrice: price,
          shortSettlementPrice: snapshot.calendarShortPrice,
          longStrike: inputs.longStrike,
          selectedOffsetDays: snapshot.expirationDays,
          shortExpirationDays: snapshot.shortExpirationDays,
          shortTimeYears: 0,
          timeYears: 0,
          volatility: futureVolatility,
          rate,
          dividendYield,
        })
      : priceStrategy({
          strategy: inputs.strategy,
          spot: price,
          longStrike: inputs.longStrike,
          shortStrike: inputs.shortStrike,
          ratioShortCount: inputs.ratioShortCount,
          shortTimeYears: 0,
          timeYears: 0,
          volatility: futureVolatility,
          rate,
          dividendYield,
        });

    return {
      price,
      selectedDateValue:
        selectedUnitValue * CONTRACT_MULTIPLIER * snapshot.contracts,
      expiryValue: expiryUnitValue * CONTRACT_MULTIPLIER * snapshot.contracts,
    };
  });
}
