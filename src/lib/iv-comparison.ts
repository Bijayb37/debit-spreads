import {
  blackScholesCall,
  priceDebitCallSpread,
} from "@/lib/debit-call-spread";

const YEAR_DAYS = 365;
const MIN_OPTION_VALUE = 0.000001;
const STRIKE_SEARCH_STEPS = 800;
const STRIKE_REFINEMENT_STEPS = 60;
const MAX_RETURN_WIDTH_SEARCH_STEPS = 50;

export type IvComparisonInstrument = "long-call" | "debit-call-spread";
export type IvComparisonMatchMetric =
  | "maximum-return"
  | "expected-move-return";

export type IvEquivalentStrategyInput = {
  instrument: IvComparisonInstrument;
  spot: number;
  longStrike: number;
  shortStrike: number;
  entryDte: number;
  baselineIvPct: number;
  comparisonIvPct: number;
  ratePct: number;
  dividendYieldPct: number;
};

type StrategyTerms = {
  longStrike: number;
  shortStrike: number;
  entryDte: number;
};

type ReturnResult = {
  entryUnitCost: number;
  scenarioUnitValue: number;
  returnPct: number;
  maximumReturnPct: number | null;
};

export type IvEquivalentStrategyResult = {
  matchMetric: IvComparisonMatchMetric;
  targetMetricPct: number;
  elapsedDays: number;
  valuationDte: number;
  baselineScenarioPrice: number;
  comparisonScenarioPrice: number;
  baselineExpectedMoveDollar: number;
  baselineExpectedMovePct: number;
  comparisonExpectedMoveDollar: number;
  comparisonExpectedMovePct: number;
  maximumReturnPct: number | null;
  baseline: ReturnResult;
  comparisonAtSameTerms: ReturnResult;
  equivalentStrike: ReturnResult & {
    longStrike: number;
    shortStrike: number;
    strikeShiftDollar: number;
    strikeShiftPct: number;
    matchDifferencePoints: number;
  };
  equivalentDte: ReturnResult & {
    longStrike: number;
    shortStrike: number;
    entryDte: number;
    valuationDte: number;
    elapsedDays: number;
    scenarioPrice: number;
    daysLess: number;
    matchDifferencePoints: number;
  };
};

type PriceStrategyInput = {
  instrument: IvComparisonInstrument;
  spot: number;
  longStrike: number;
  shortStrike: number;
  timeYears: number;
  volatility: number;
  rate: number;
  dividendYield: number;
};

function priceStrategy({
  instrument,
  spot,
  longStrike,
  shortStrike,
  timeYears,
  volatility,
  rate,
  dividendYield,
}: PriceStrategyInput): number {
  if (instrument === "long-call") {
    return blackScholesCall({
      spot,
      strike: longStrike,
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

function calculateStrategyReturn({
  instrument,
  spot,
  scenarioPrice,
  longStrike,
  shortStrike,
  entryDte,
  elapsedDays,
  volatility,
  rate,
  dividendYield,
}: StrategyTerms & {
  instrument: IvComparisonInstrument;
  spot: number;
  scenarioPrice: number;
  elapsedDays: number;
  volatility: number;
  rate: number;
  dividendYield: number;
}): ReturnResult {
  const valuationDte = Math.max(entryDte - elapsedDays, 0);
  const entryUnitCost = priceStrategy({
    instrument,
    spot,
    longStrike,
    shortStrike,
    timeYears: entryDte / YEAR_DAYS,
    volatility,
    rate,
    dividendYield,
  });
  const scenarioUnitValue = priceStrategy({
    instrument,
    spot: scenarioPrice,
    longStrike,
    shortStrike,
    timeYears: valuationDte / YEAR_DAYS,
    volatility,
    rate,
    dividendYield,
  });
  const returnPct =
    entryUnitCost > MIN_OPTION_VALUE
      ? (scenarioUnitValue / entryUnitCost - 1) * 100
      : -100;
  const maximumReturnPct =
    instrument === "debit-call-spread" &&
    entryUnitCost > MIN_OPTION_VALUE
      ? ((shortStrike - longStrike) / entryUnitCost - 1) * 100
      : null;

  return {
    entryUnitCost,
    scenarioUnitValue,
    returnPct,
    maximumReturnPct,
  };
}

function getMatchMetricValue(
  result: ReturnResult,
  matchMetric: IvComparisonMatchMetric,
): number {
  if (matchMetric === "maximum-return") {
    return result.maximumReturnPct ?? 0;
  }

  return result.returnPct;
}

type DebitSpreadWidthMatch = ReturnResult & {
  shortStrike: number;
  width: number;
  matchDifferencePoints: number;
};

function solveDebitSpreadWidthForMaxReturn({
  spot,
  scenarioPrice,
  longStrike,
  initialWidth,
  entryDte,
  elapsedDays,
  volatility,
  rate,
  dividendYield,
  targetMaximumReturnPct,
}: {
  spot: number;
  scenarioPrice: number;
  longStrike: number;
  initialWidth: number;
  entryDte: number;
  elapsedDays: number;
  volatility: number;
  rate: number;
  dividendYield: number;
  targetMaximumReturnPct: number;
}): DebitSpreadWidthMatch | null {
  const evaluateWidth = (width: number): DebitSpreadWidthMatch => {
    const shortStrike = longStrike + width;
    const result = calculateStrategyReturn({
      instrument: "debit-call-spread",
      spot,
      scenarioPrice,
      longStrike,
      shortStrike,
      entryDte,
      elapsedDays,
      volatility,
      rate,
      dividendYield,
    });

    return {
      ...result,
      shortStrike,
      width,
      matchDifferencePoints:
        (result.maximumReturnPct ?? 0) - targetMaximumReturnPct,
    };
  };
  let lowWidth = 0.01;
  let highWidth = Math.max(initialWidth, lowWidth * 2);
  let lowResult = evaluateWidth(lowWidth);
  let highResult = evaluateWidth(highWidth);

  if (
    lowResult.maximumReturnPct === null ||
    lowResult.matchDifferencePoints > 0
  ) {
    return null;
  }

  const maximumWidth = Math.max(
    spot * 4,
    scenarioPrice * 2,
    initialWidth * 32,
    10,
  );

  while (
    highResult.matchDifferencePoints < 0 &&
    highWidth < maximumWidth
  ) {
    highWidth = Math.min(highWidth * 2, maximumWidth);
    highResult = evaluateWidth(highWidth);
  }

  if (highResult.matchDifferencePoints < 0) {
    return null;
  }

  let bestResult =
    Math.abs(lowResult.matchDifferencePoints) <
    Math.abs(highResult.matchDifferencePoints)
      ? lowResult
      : highResult;

  for (
    let step = 0;
    step < MAX_RETURN_WIDTH_SEARCH_STEPS;
    step += 1
  ) {
    const midpointWidth = (lowWidth + highWidth) / 2;
    const midpointResult = evaluateWidth(midpointWidth);

    if (
      Math.abs(midpointResult.matchDifferencePoints) <
      Math.abs(bestResult.matchDifferencePoints)
    ) {
      bestResult = midpointResult;
    }

    if (midpointResult.matchDifferencePoints < 0) {
      lowWidth = midpointWidth;
      lowResult = midpointResult;
    } else {
      highWidth = midpointWidth;
      highResult = midpointResult;
    }
  }

  return bestResult;
}

function findEquivalentStrike({
  instrument,
  spot,
  scenarioPrice,
  longStrike,
  shortStrike,
  entryDte,
  elapsedDays,
  volatility,
  rate,
  dividendYield,
  matchMetric,
  targetMetricPct,
}: StrategyTerms & {
  instrument: IvComparisonInstrument;
  spot: number;
  scenarioPrice: number;
  elapsedDays: number;
  volatility: number;
  rate: number;
  dividendYield: number;
  matchMetric: IvComparisonMatchMetric;
  targetMetricPct: number;
}): IvEquivalentStrategyResult["equivalentStrike"] {
  const width = Math.max(shortStrike - longStrike, 0.01);
  const maxShift = Math.max(
    spot,
    scenarioPrice,
    longStrike,
    shortStrike,
    1,
  );
  const stepSize = maxShift / STRIKE_SEARCH_STEPS;
  const evaluateShift = (shift: number) => {
    const nextLongStrike = longStrike + shift;
    const nextShortStrike =
      instrument === "debit-call-spread"
        ? nextLongStrike + width
        : nextLongStrike;
    const result = calculateStrategyReturn({
      instrument,
      spot,
      scenarioPrice,
      longStrike: nextLongStrike,
      shortStrike: nextShortStrike,
      entryDte,
      elapsedDays,
      volatility,
      rate,
      dividendYield,
    });

    return {
      ...result,
      longStrike: nextLongStrike,
      shortStrike: nextShortStrike,
      strikeShiftDollar: shift,
      strikeShiftPct: shift / spot * 100,
      matchDifferencePoints:
        getMatchMetricValue(result, matchMetric) - targetMetricPct,
    };
  };
  let bestResult = evaluateShift(0);
  let previousResult = bestResult;
  let crossingBounds: [number, number] | null = null;

  for (let step = 1; step <= STRIKE_SEARCH_STEPS; step += 1) {
    const shift = step * stepSize;
    const nextResult = evaluateShift(shift);

    if (
      Math.abs(nextResult.matchDifferencePoints) <
      Math.abs(bestResult.matchDifferencePoints)
    ) {
      bestResult = nextResult;
    }

    if (
      previousResult.entryUnitCost > MIN_OPTION_VALUE &&
      nextResult.entryUnitCost > MIN_OPTION_VALUE &&
      previousResult.matchDifferencePoints *
        nextResult.matchDifferencePoints <=
        0
    ) {
      crossingBounds = [shift - stepSize, shift];
      break;
    }

    previousResult = nextResult;
  }

  if (!crossingBounds) {
    return bestResult;
  }

  let [low, high] = crossingBounds;
  let lowResult = evaluateShift(low);

  for (let step = 0; step < STRIKE_REFINEMENT_STEPS; step += 1) {
    const midpoint = (low + high) / 2;
    const midpointResult = evaluateShift(midpoint);

    if (
      Math.abs(midpointResult.matchDifferencePoints) <
      Math.abs(bestResult.matchDifferencePoints)
    ) {
      bestResult = midpointResult;
    }

    if (
      lowResult.matchDifferencePoints *
        midpointResult.matchDifferencePoints <=
      0
    ) {
      high = midpoint;
    } else {
      low = midpoint;
      lowResult = midpointResult;
    }
  }

  return bestResult;
}

function findEquivalentDebitSpread({
  spot,
  scenarioPrice,
  longStrike,
  shortStrike,
  entryDte,
  elapsedDays,
  volatility,
  rate,
  dividendYield,
  targetMaximumReturnPct,
  targetStrikeShift,
}: StrategyTerms & {
  spot: number;
  scenarioPrice: number;
  elapsedDays: number;
  volatility: number;
  rate: number;
  dividendYield: number;
  targetMaximumReturnPct: number;
  targetStrikeShift: number;
}): IvEquivalentStrategyResult["equivalentStrike"] {
  const initialWidth = Math.max(shortStrike - longStrike, 0.01);
  const evaluateShift = (shift: number) => {
    const nextLongStrike = longStrike + shift;
    const widthMatch = solveDebitSpreadWidthForMaxReturn({
      spot,
      scenarioPrice,
      longStrike: nextLongStrike,
      initialWidth,
      entryDte,
      elapsedDays,
      volatility,
      rate,
      dividendYield,
      targetMaximumReturnPct,
    });

    if (!widthMatch) {
      return null;
    }

    return {
      ...widthMatch,
      longStrike: nextLongStrike,
      shortStrike: widthMatch.shortStrike,
      strikeShiftDollar: shift,
      strikeShiftPct: shift / spot * 100,
    };
  };
  const desiredShift = Math.max(targetStrikeShift, 0);
  const desiredResult = evaluateShift(desiredShift);

  if (desiredResult) {
    return desiredResult;
  }

  let lowShift = 0;
  let highShift = desiredShift;
  let bestResult = evaluateShift(lowShift);

  for (let step = 0; step < STRIKE_REFINEMENT_STEPS; step += 1) {
    const midpointShift = (lowShift + highShift) / 2;
    const midpointResult = evaluateShift(midpointShift);

    if (midpointResult) {
      lowShift = midpointShift;
      bestResult = midpointResult;
    } else {
      highShift = midpointShift;
    }
  }

  if (bestResult) {
    return bestResult;
  }

  return findEquivalentStrike({
    instrument: "debit-call-spread",
    spot,
    scenarioPrice,
    longStrike,
    shortStrike,
    entryDte,
    elapsedDays,
    volatility,
    rate,
    dividendYield,
    matchMetric: "maximum-return",
    targetMetricPct: targetMaximumReturnPct,
  });
}

function findEquivalentDte({
  instrument,
  spot,
  longStrike,
  shortStrike,
  entryDte,
  volatility,
  rate,
  dividendYield,
  matchMetric,
  targetMetricPct,
  targetEntryUnitCost,
}: StrategyTerms & {
  instrument: IvComparisonInstrument;
  spot: number;
  volatility: number;
  rate: number;
  dividendYield: number;
  matchMetric: IvComparisonMatchMetric;
  targetMetricPct: number;
  targetEntryUnitCost: number;
}): IvEquivalentStrategyResult["equivalentDte"] {
  // Less time offsets higher IV when the same strikes cost the same to
  // enter, so pick the expiry whose entry cost is closest to the original.
  let bestResult: IvEquivalentStrategyResult["equivalentDte"] | null = null;
  let bestCostDifference = Number.POSITIVE_INFINITY;

  for (
    let candidateDte = 1;
    candidateDte <= entryDte;
    candidateDte += 1
  ) {
    const candidateElapsedDays = candidateDte / 2;
    const candidateScenarioPrice =
      spot +
      spot *
        volatility *
        Math.sqrt(candidateElapsedDays / YEAR_DAYS);
    const result = calculateStrategyReturn({
      instrument,
      spot,
      scenarioPrice: candidateScenarioPrice,
      longStrike,
      shortStrike,
      entryDte: candidateDte,
      elapsedDays: candidateElapsedDays,
      volatility,
      rate,
      dividendYield,
    });
    const candidate = {
      ...result,
      longStrike,
      shortStrike,
      entryDte: candidateDte,
      valuationDte: candidateDte - candidateElapsedDays,
      elapsedDays: candidateElapsedDays,
      scenarioPrice: candidateScenarioPrice,
      daysLess: entryDte - candidateDte,
      matchDifferencePoints:
        getMatchMetricValue(result, matchMetric) - targetMetricPct,
    };

    const costDifference = Math.abs(result.entryUnitCost - targetEntryUnitCost);

    if (costDifference < bestCostDifference) {
      bestResult = candidate;
      bestCostDifference = costDifference;
    }
  }

  if (bestResult) {
    return bestResult;
  }

  const fallbackElapsedDays = entryDte / 2;
  const fallbackScenarioPrice =
    spot + spot * volatility * Math.sqrt(fallbackElapsedDays / YEAR_DAYS);
  const fallbackResult = calculateStrategyReturn({
    instrument,
    spot,
    scenarioPrice: fallbackScenarioPrice,
    longStrike,
    shortStrike,
    entryDte,
    elapsedDays: fallbackElapsedDays,
    volatility,
    rate,
    dividendYield,
  });

  return {
    ...fallbackResult,
    longStrike,
    shortStrike,
    entryDte,
    valuationDte: entryDte - fallbackElapsedDays,
    elapsedDays: fallbackElapsedDays,
    scenarioPrice: fallbackScenarioPrice,
    daysLess: 0,
    matchDifferencePoints:
      getMatchMetricValue(fallbackResult, matchMetric) - targetMetricPct,
  };
}

// Typical listed strike spacing, so suggested strikes are ones a chain offers.
export function getListedStrikeIncrement(spot: number): number {
  if (spot < 25) {
    return 0.5;
  }

  return spot < 200 ? 1 : 5;
}

function getNearbyListedValues(
  value: number,
  increment: number,
  minimum: number,
): number[] {
  const steps = value / increment;

  return [Math.floor(steps), Math.ceil(steps)]
    .map((step) => Math.round(step * increment * 10000) / 10000)
    .map((listedValue) => Math.max(listedValue, minimum))
    .filter((listedValue, index, values) => values.indexOf(listedValue) === index);
}

function getListedStrikePairs({
  instrument,
  longStrike,
  shortStrike,
  minimumLongStrike,
  increment,
  keepLongStrike,
}: {
  instrument: IvComparisonInstrument;
  longStrike: number;
  shortStrike: number;
  minimumLongStrike: number;
  increment: number;
  keepLongStrike: boolean;
}): Array<{ longStrike: number; shortStrike: number }> {
  const longStrikes = keepLongStrike
    ? [longStrike]
    : getNearbyListedValues(longStrike, increment, minimumLongStrike);

  if (instrument === "long-call") {
    return longStrikes.map((listedLongStrike) => ({
      longStrike: listedLongStrike,
      shortStrike: listedLongStrike,
    }));
  }

  const widths = getNearbyListedValues(
    shortStrike - longStrike,
    increment,
    increment,
  );

  return longStrikes.flatMap((listedLongStrike) =>
    widths.map((width) => ({
      longStrike: listedLongStrike,
      shortStrike: Math.round((listedLongStrike + width) * 10000) / 10000,
    })),
  );
}

function pickClosestMatch<Match extends { matchDifferencePoints: number }>(
  matches: Match[],
): Match {
  return matches.reduce((best, match) =>
    Math.abs(match.matchDifferencePoints) < Math.abs(best.matchDifferencePoints)
      ? match
      : best,
  );
}

export function calculateIvEquivalentStrategy({
  instrument,
  spot,
  longStrike,
  shortStrike,
  entryDte,
  baselineIvPct,
  comparisonIvPct,
  ratePct,
  dividendYieldPct,
}: IvEquivalentStrategyInput): IvEquivalentStrategyResult {
  const safeSpot = Math.max(spot, 0.01);
  const safeLongStrike = Math.max(longStrike, 0.01);
  const safeShortStrike = Math.max(shortStrike, safeLongStrike + 0.01);
  const safeEntryDte = Math.max(1, Math.round(entryDte));
  const elapsedDays = safeEntryDte / 2;
  const valuationDte = safeEntryDte - elapsedDays;
  const baselineVolatility = Math.max(baselineIvPct, 0) / 100;
  const comparisonVolatility = Math.max(comparisonIvPct, 0) / 100;
  const rate = ratePct / 100;
  const dividendYield = dividendYieldPct / 100;
  const baselineExpectedMovePct =
    Math.max(baselineIvPct, 0) * Math.sqrt(elapsedDays / YEAR_DAYS);
  const comparisonExpectedMovePct =
    Math.max(comparisonIvPct, 0) * Math.sqrt(elapsedDays / YEAR_DAYS);
  const baselineExpectedMoveDollar =
    safeSpot * baselineExpectedMovePct / 100;
  const comparisonExpectedMoveDollar =
    safeSpot * comparisonExpectedMovePct / 100;
  const baselineScenarioPrice = safeSpot + baselineExpectedMoveDollar;
  const comparisonScenarioPrice = safeSpot + comparisonExpectedMoveDollar;
  const commonInputs = {
    instrument,
    spot: safeSpot,
    longStrike: safeLongStrike,
    shortStrike: safeShortStrike,
    entryDte: safeEntryDte,
    elapsedDays,
    rate,
    dividendYield,
  };
  const baseline = calculateStrategyReturn({
    ...commonInputs,
    scenarioPrice: baselineScenarioPrice,
    volatility: baselineVolatility,
  });
  const comparisonAtSameTerms = calculateStrategyReturn({
    ...commonInputs,
    scenarioPrice: comparisonScenarioPrice,
    volatility: comparisonVolatility,
  });
  const matchMetric: IvComparisonMatchMetric =
    instrument === "debit-call-spread"
      ? "maximum-return"
      : "expected-move-return";
  const targetMetricPct = getMatchMetricValue(baseline, matchMetric);
  const solvedStrike =
    instrument === "debit-call-spread"
      ? findEquivalentDebitSpread({
          ...commonInputs,
          scenarioPrice: comparisonScenarioPrice,
          volatility: comparisonVolatility,
          targetMaximumReturnPct: targetMetricPct,
          targetStrikeShift: Math.max(
            comparisonExpectedMoveDollar - baselineExpectedMoveDollar,
            0,
          ),
        })
      : findEquivalentStrike({
          ...commonInputs,
          scenarioPrice: comparisonScenarioPrice,
          volatility: comparisonVolatility,
          matchMetric,
          targetMetricPct,
        });
  const equivalentDte = findEquivalentDte({
    ...commonInputs,
    volatility: comparisonVolatility,
    matchMetric,
    targetMetricPct,
    targetEntryUnitCost: baseline.entryUnitCost,
  });
  const strikeIncrement = getListedStrikeIncrement(safeSpot);
  const isUnmovedStrike = solvedStrike.strikeShiftDollar < 0.005;
  const isUnchangedStrikeWidth =
    Math.abs(solvedStrike.shortStrike - solvedStrike.longStrike -
      (safeShortStrike - safeLongStrike)) < 0.005;
  const equivalentStrike =
    isUnmovedStrike && (instrument === "long-call" || isUnchangedStrikeWidth)
      ? solvedStrike
      : pickClosestMatch(
          getListedStrikePairs({
            instrument,
            longStrike: solvedStrike.longStrike,
            shortStrike: solvedStrike.shortStrike,
            minimumLongStrike: safeLongStrike,
            increment: strikeIncrement,
            keepLongStrike: isUnmovedStrike,
          }).map((strikes) => {
            const listedResult = calculateStrategyReturn({
              ...commonInputs,
              ...strikes,
              scenarioPrice: comparisonScenarioPrice,
              volatility: comparisonVolatility,
            });
            const strikeShiftDollar = strikes.longStrike - safeLongStrike;

            return {
              ...listedResult,
              ...strikes,
              strikeShiftDollar,
              strikeShiftPct: strikeShiftDollar / safeSpot * 100,
              matchDifferencePoints:
                getMatchMetricValue(listedResult, matchMetric) -
                targetMetricPct,
            };
          }),
        );
  return {
    matchMetric,
    targetMetricPct,
    elapsedDays,
    valuationDte,
    baselineScenarioPrice,
    comparisonScenarioPrice,
    baselineExpectedMoveDollar,
    baselineExpectedMovePct,
    comparisonExpectedMoveDollar,
    comparisonExpectedMovePct,
    maximumReturnPct: baseline.maximumReturnPct,
    baseline,
    comparisonAtSameTerms,
    equivalentStrike,
    equivalentDte,
  };
}
