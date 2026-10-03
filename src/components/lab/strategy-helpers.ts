import {
  clamp,
  normalizePutRatioShortCount,
  priceCallRatioSpread,
  roundTo,
} from "@/lib/debit-call-spread";
import type { OptionStrategy } from "@/lib/debit-call-spread";
import {
  CAPITAL_DECIMAL_DIGITS,
  PRICE_DECIMAL_DIGITS,
  STRIKE_DECIMAL_DIGITS,
  STRIKE_MIN_GAP,
} from "@/components/lab/constants";
import type { DefaultStrikeOptions } from "@/components/lab/types";

export function getOtmStrike(spotPrice: number, percent: number): number {
  return Math.round(spotPrice * (1 + percent / 100));
}

export function getNearCallShortStrike(spotPrice: number): number {
  const atmStrike = Math.max(1, Math.round(spotPrice));
  return Math.max(atmStrike + 1, getOtmStrike(spotPrice, 3));
}

export function getOtmPutStrike(spotPrice: number, percent: number): number {
  return Math.max(1, Math.round(spotPrice * (1 - percent / 100)));
}

function getCallRatioShortStrike(
  spotPrice: number,
  {
    expirationDays = 60,
    volatilityPct = 50,
    ratioShortCount,
    ratePct = 4,
    dividendYieldPct = 0,
  }: DefaultStrikeOptions = {},
): number {
  const longStrike = Math.max(1, Math.round(spotPrice));
  const timeYears = clamp(Math.round(expirationDays), 1, 1095) / 365;
  const volatility = Math.max(volatilityPct, 0) / 100;
  const rate = ratePct / 100;
  const dividendYield = dividendYieldPct / 100;
  const shortCount = normalizePutRatioShortCount(ratioShortCount);
  const candidateStrikes = [5, 10, 15, 20, 25, 30, 40, 50]
    .map((percent) =>
      roundTo(
        Math.max(longStrike + STRIKE_MIN_GAP, getOtmStrike(spotPrice, percent)),
        STRIKE_DECIMAL_DIGITS,
      ),
    )
    .filter((strike, index, strikes) => strikes.indexOf(strike) === index);

  for (const shortStrike of candidateStrikes) {
    const entryDebit = priceCallRatioSpread({
      spot: spotPrice,
      longStrike,
      shortStrike,
      ratioShortCount: shortCount,
      timeYears,
      volatility,
      rate,
      dividendYield,
    });

    if (entryDebit > 0) {
      return shortStrike;
    }
  }

  return candidateStrikes.at(-1) ?? roundTo(longStrike + STRIKE_MIN_GAP, STRIKE_DECIMAL_DIGITS);
}

export function isDebitSpreadStrategy(strategy: OptionStrategy): boolean {
  return strategy !== "long-call" && strategy !== "bear-put";
}

export function isCallCalendarStrategy(strategy: OptionStrategy): boolean {
  return strategy === "call-calendar";
}

export function isPutDownsideStrategy(strategy: OptionStrategy): boolean {
  return (
    strategy === "debit-put-spread" ||
    strategy === "put-ratio-spread"
  );
}

export function isPutOptionStrategy(strategy: OptionStrategy): boolean {
  return (
    strategy === "bear-put" ||
    strategy === "bull-put-spread" ||
    isPutDownsideStrategy(strategy)
  );
}

export function isRatioSpreadStrategy(strategy: OptionStrategy): boolean {
  return strategy === "put-ratio-spread" || strategy === "call-ratio-spread";
}

export function normalizePriceValue(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, roundTo(value, PRICE_DECIMAL_DIGITS));
}

export function normalizeCapitalValue(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, roundTo(value, CAPITAL_DECIMAL_DIGITS));
}

export function normalizeStrikeValue(value: number): number {
  return Math.max(1, roundTo(value, STRIKE_DECIMAL_DIGITS));
}

export function normalizeShortStrikeForStrategy(
  strategy: OptionStrategy,
  longStrike: number,
  shortStrike: number,
): number {
  const safeLongStrike = normalizeStrikeValue(longStrike);
  const safeShortStrike = normalizeStrikeValue(shortStrike);

  if (strategy === "long-call" || strategy === "bear-put" || isCallCalendarStrategy(strategy)) {
    return safeLongStrike;
  }

  if (isPutDownsideStrategy(strategy)) {
    return Math.max(
      1,
      roundTo(
        Math.min(safeShortStrike, safeLongStrike - STRIKE_MIN_GAP),
        STRIKE_DECIMAL_DIGITS,
      ),
    );
  }

  return roundTo(
    Math.max(safeShortStrike, safeLongStrike + STRIKE_MIN_GAP),
    STRIKE_DECIMAL_DIGITS,
  );
}

export function getDefaultStrikesForStrategy(
  strategy: OptionStrategy,
  spotPrice: number,
  options?: DefaultStrikeOptions,
): { longStrike: number; shortStrike: number } {
  const nextLongStrike = Math.max(1, Math.round(spotPrice));

  if (strategy === "long-call" || strategy === "bear-put" || isCallCalendarStrategy(strategy)) {
    return {
      longStrike: nextLongStrike,
      shortStrike: nextLongStrike,
    };
  }

  if (strategy === "call-ratio-spread") {
    return {
      longStrike: nextLongStrike,
      shortStrike: getCallRatioShortStrike(spotPrice, options),
    };
  }

  if (strategy === "bull-put-spread") {
    const nextShortStrike = getOtmPutStrike(spotPrice, 10);

    return {
      longStrike: Math.max(1, getOtmPutStrike(spotPrice, 15)),
      shortStrike: nextShortStrike,
    };
  }

  if (isPutDownsideStrategy(strategy)) {
    return {
      longStrike: nextLongStrike,
      shortStrike: getOtmPutStrike(spotPrice, 10),
    };
  }

  return {
    longStrike: nextLongStrike,
    shortStrike: getNearCallShortStrike(spotPrice),
  };
}

export function normalizeSymbol(value: string): string {
  return value.trim().toUpperCase();
}
