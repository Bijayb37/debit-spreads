const DAY_MS = 24 * 60 * 60 * 1000;
const YEAR_DAYS = 365;

export const CONTRACT_MULTIPLIER = 100;

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
};

export type DebitCallSpreadInputs = {
  todayIso: string;
  expiryIso: string;
  spot: number;
  longStrike: number;
  shortStrike: number;
  volatilityPct: number;
  capital: number;
  scenarioPrice: number;
  scenarioOffsetDays: number;
  ratePct: number;
  dividendYieldPct: number;
};

export type ScenarioSnapshot = {
  expirationDays: number;
  selectedOffsetDays: number;
  selectedDateIso: string;
  timeNowYears: number;
  timeAtScenarioYears: number;
  width: number;
  debitPerSpread: number;
  contracts: number;
  totalCost: number;
  cashLeft: number;
  maxValuePerSpread: number;
  maxProfitPerSpread: number;
  breakEvenAtExpiry: number;
  scenarioSpreadValue: number;
  scenarioPositionValue: number;
  pnl: number;
  roi: number;
};

export type TimelineRow = {
  dateIso: string;
  daysElapsed: number;
  daysRemaining: number;
  spreadValue: number;
  positionValue: number;
  intrinsicValue: number;
  pnl: number;
  roi: number;
  isHighlighted: boolean;
};

export type PriceLadderRow = {
  price: number;
  spreadValue: number;
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

export function createScenarioSnapshot({
  todayIso,
  expiryIso,
  spot,
  longStrike,
  shortStrike,
  volatilityPct,
  capital,
  scenarioPrice,
  scenarioOffsetDays,
  ratePct,
  dividendYieldPct,
}: DebitCallSpreadInputs): ScenarioSnapshot {
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
  const volatility = Math.max(volatilityPct, 0) / 100;
  const rate = ratePct / 100;
  const dividendYield = dividendYieldPct / 100;
  const width = Math.max(shortStrike - longStrike, 0);
  const debitPerSpread = priceDebitCallSpread({
    spot,
    longStrike,
    shortStrike,
    timeYears: timeNowYears,
    volatility,
    rate,
    dividendYield,
  });
  const contracts =
    debitPerSpread > 0
      ? Math.floor(capital / (debitPerSpread * CONTRACT_MULTIPLIER))
      : 0;
  const totalCost = contracts * debitPerSpread * CONTRACT_MULTIPLIER;
  const scenarioSpreadValue = priceDebitCallSpread({
    spot: scenarioPrice,
    longStrike,
    shortStrike,
    timeYears: timeAtScenarioYears,
    volatility,
    rate,
    dividendYield,
  });
  const scenarioPositionValue =
    scenarioSpreadValue * CONTRACT_MULTIPLIER * contracts;
  const pnl = scenarioPositionValue - totalCost;
  const roi = totalCost > 0 ? pnl / totalCost : 0;

  return {
    expirationDays,
    selectedOffsetDays,
    selectedDateIso,
    timeNowYears,
    timeAtScenarioYears,
    width,
    debitPerSpread,
    contracts,
    totalCost,
    cashLeft: capital - totalCost,
    maxValuePerSpread: width,
    maxProfitPerSpread: width - debitPerSpread,
    breakEvenAtExpiry: longStrike + debitPerSpread,
    scenarioSpreadValue,
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

export function buildTimelineRows(inputs: DebitCallSpreadInputs): TimelineRow[] {
  const snapshot = createScenarioSnapshot(inputs);
  const volatility = Math.max(inputs.volatilityPct, 0) / 100;
  const rate = inputs.ratePct / 100;
  const dividendYield = inputs.dividendYieldPct / 100;

  return buildOffsets(
    snapshot.expirationDays,
    snapshot.selectedOffsetDays,
    8,
  ).map((offset) => {
    const timeYears = Math.max((snapshot.expirationDays - offset) / YEAR_DAYS, 0);
    const spreadValue = priceDebitCallSpread({
      spot: inputs.scenarioPrice,
      longStrike: inputs.longStrike,
      shortStrike: inputs.shortStrike,
      timeYears,
      volatility,
      rate,
      dividendYield,
    });
    const positionValue = spreadValue * CONTRACT_MULTIPLIER * snapshot.contracts;
    const pnl = positionValue - snapshot.totalCost;
    return {
      dateIso: addDaysToIso(inputs.todayIso, offset),
      daysElapsed: offset,
      daysRemaining: snapshot.expirationDays - offset,
      spreadValue,
      positionValue,
      intrinsicValue: clamp(
        Math.max(inputs.scenarioPrice - inputs.longStrike, 0) -
          Math.max(inputs.scenarioPrice - inputs.shortStrike, 0),
        0,
        snapshot.width,
      ),
      pnl,
      roi: snapshot.totalCost > 0 ? pnl / snapshot.totalCost : 0,
      isHighlighted: offset === snapshot.selectedOffsetDays,
    };
  });
}

export function buildPriceLadderRows(inputs: DebitCallSpreadInputs): PriceLadderRow[] {
  const snapshot = createScenarioSnapshot(inputs);
  const volatility = Math.max(inputs.volatilityPct, 0) / 100;
  const rate = inputs.ratePct / 100;
  const dividendYield = inputs.dividendYieldPct / 100;
  const anchorPrice = Math.max(inputs.spot, inputs.scenarioPrice, inputs.shortStrike);
  const floorPrice = Math.max(1, Math.min(inputs.longStrike, inputs.spot, inputs.scenarioPrice) * 0.7);
  const ceilingPrice = Math.max(anchorPrice * 1.3, inputs.shortStrike + snapshot.width);

  return buildPriceSteps(floorPrice, ceilingPrice, inputs.scenarioPrice, 10).map(
    (price) => {
      const spreadValue = priceDebitCallSpread({
        spot: price,
        longStrike: inputs.longStrike,
        shortStrike: inputs.shortStrike,
        timeYears: snapshot.timeAtScenarioYears,
        volatility,
        rate,
        dividendYield,
      });
      const positionValue = spreadValue * CONTRACT_MULTIPLIER * snapshot.contracts;
      const pnl = positionValue - snapshot.totalCost;

      return {
        price,
        spreadValue,
        intrinsicValue: clamp(
          Math.max(price - inputs.longStrike, 0) -
            Math.max(price - inputs.shortStrike, 0),
          0,
          snapshot.width,
        ),
        positionValue,
        pnl,
        roi: snapshot.totalCost > 0 ? pnl / snapshot.totalCost : 0,
        isHighlighted: Math.round(price) === Math.round(inputs.scenarioPrice),
      };
    },
  );
}

export function buildPriceCurve(inputs: DebitCallSpreadInputs): PriceCurvePoint[] {
  const snapshot = createScenarioSnapshot(inputs);
  const volatility = Math.max(inputs.volatilityPct, 0) / 100;
  const rate = inputs.ratePct / 100;
  const dividendYield = inputs.dividendYieldPct / 100;
  const ceilingPrice = Math.max(
    inputs.scenarioPrice,
    inputs.shortStrike,
    inputs.spot,
    inputs.longStrike,
  );
  const minPrice = Math.max(1, Math.min(inputs.longStrike, inputs.spot) * 0.7);
  const maxPrice = Math.max(ceilingPrice * 1.4, inputs.shortStrike + snapshot.width);
  const pointCount = 61;

  return Array.from({ length: pointCount }, (_, index) => {
    const price = roundTo(
      minPrice + ((maxPrice - minPrice) * index) / Math.max(pointCount - 1, 1),
      2,
    );
    const selectedSpreadValue = priceDebitCallSpread({
      spot: price,
      longStrike: inputs.longStrike,
      shortStrike: inputs.shortStrike,
      timeYears: snapshot.timeAtScenarioYears,
      volatility,
      rate,
      dividendYield,
    });
    const expirySpreadValue = priceDebitCallSpread({
      spot: price,
      longStrike: inputs.longStrike,
      shortStrike: inputs.shortStrike,
      timeYears: 0,
      volatility,
      rate,
      dividendYield,
    });

    return {
      price,
      selectedDateValue:
        selectedSpreadValue * CONTRACT_MULTIPLIER * snapshot.contracts,
      expiryValue: expirySpreadValue * CONTRACT_MULTIPLIER * snapshot.contracts,
    };
  });
}
