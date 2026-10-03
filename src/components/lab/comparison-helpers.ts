import {
  CONTRACT_MULTIPLIER,
  addDaysToIso,
  blackScholesCall,
  blackScholesGreeks,
  blackScholesPut,
  clamp,
  createScenarioSnapshot,
  normalizeCallCalendarShortExpirationDays,
  normalizePutRatioShortCount,
  roundTo,
} from "@/lib/debit-call-spread";
import type {
  OptionGreeks,
  OptionStrategy,
  ScenarioSnapshot,
  StrategyInputs,
} from "@/lib/debit-call-spread";
import {
  compactNumber,
  formatCompactCurrency,
  formatCurrency,
  formatCurrencyWithCents,
  formatPercent,
  formatPriceCurrency,
  formatStrikeCurrency,
} from "@/components/lab/format";
import {
  isDebitSpreadStrategy,
  isPutDownsideStrategy,
  isPutOptionStrategy,
  isRatioSpreadStrategy,
  normalizeShortStrikeForStrategy,
} from "@/components/lab/strategy-helpers";
import type {
  ComparisonCandidate,
  ComparisonCardData,
  CustomComparisonConfig,
  CustomComparisonDraft,
  StrategyGreekRow,
} from "@/components/lab/types";

export function getComparisonStrikeLabel(candidate: ComparisonCandidate): string {
  if (candidate.strategy === "long-call") {
    return `${formatStrikeCurrency(candidate.longStrike)} call`;
  }

  if (candidate.strategy === "call-calendar") {
    return `${formatStrikeCurrency(candidate.longStrike)} call calendar`;
  }

  if (candidate.strategy === "bear-put") {
    return `${formatStrikeCurrency(candidate.longStrike)} put`;
  }

  if (isRatioSpreadStrategy(candidate.strategy)) {
    return `${formatStrikeCurrency(candidate.longStrike)} / ${formatStrikeCurrency(
      candidate.shortStrike,
    )} x${normalizePutRatioShortCount(candidate.ratioShortCount)}`;
  }

  return `${formatStrikeCurrency(candidate.longStrike)} / ${formatStrikeCurrency(candidate.shortStrike)}`;
}

export function getComparisonSetupLabel(candidate: ComparisonCandidate): string {
  const details = [
    candidate.symbol?.trim() || null,
    Number.isFinite(candidate.spot)
      ? `${formatPriceCurrency(candidate.spot ?? 0)} spot`
      : null,
    Number.isFinite(candidate.volatilityPct)
      ? `${compactNumber(candidate.volatilityPct ?? 0)}% IV`
      : null,
    formatCompactCurrency(candidate.capital),
    candidate.strategy === "call-calendar"
      ? `${normalizeCallCalendarShortExpirationDays(
          candidate.shortExpirationDays,
          candidate.expirationDays,
        )} / ${candidate.expirationDays} DTE`
      : `${candidate.expirationDays} DTE`,
  ];

  return details.filter(Boolean).join(" · ");
}

export function getStrategyDisplayLabel(strategy: OptionStrategy): string {
  if (strategy === "long-call") return "Long call";
  if (strategy === "call-ratio-spread") return "Call ratio spread";
  if (strategy === "call-calendar") return "Call calendar";
  if (strategy === "put-ratio-spread") return "Put ratio spread";
  if (strategy === "bear-put") return "Bear put";
  if (strategy === "debit-put-spread") return "Debit put spread";
  if (strategy === "bull-put-spread") return "Bull put spread";
  return "Debit call spread";
}

export function getUnitCostMetricLabel(strategy: OptionStrategy, snapshot?: ScenarioSnapshot): string {
  if (snapshot && snapshot.reserveOffset > 0) return "Reserve / spread";
  if (strategy === "long-call") return "Call cost";
  if (strategy === "call-calendar") return "Calendar cost";
  if (strategy === "bear-put") return "Put cost";
  if (strategy === "bull-put-spread") return "Risk per spread";
  if (isPutDownsideStrategy(strategy)) return "Put spread cost";
  return "Spread cost";
}

export function getNonPositiveEntryDebitMessage(strategy: OptionStrategy): string {
  if (isRatioSpreadStrategy(strategy)) return "This setup has no positive sizing reserve. Adjust the strikes or DTE before saving.";

  return "This setup has no entry debit. Adjust the strikes or DTE before saving.";
}

export function getBreakEvenLabel(snapshot: ScenarioSnapshot): string {
  if (snapshot.strategy === "call-calendar") return "Target";
  return snapshot.lowerBreakEvenAtExpiry !== null ? "B/Es" : "B/E";
}

export function getDteDisplayLabel(card: ComparisonCardData): string {
  if (card.strategy === "call-calendar") {
    return `${card.snapshot.shortExpirationDays}/${card.expirationDays}`;
  }

  return String(card.expirationDays);
}

export function formatBreakEvenAtExpiry(snapshot: ScenarioSnapshot): string {
  if (snapshot.lowerBreakEvenAtExpiry !== null) {
    return `${formatCurrencyWithCents(snapshot.lowerBreakEvenAtExpiry)} / ${formatCurrencyWithCents(
      snapshot.breakEvenAtExpiry,
    )}`;
  }

  return formatCurrencyWithCents(snapshot.breakEvenAtExpiry);
}

export function getValuationDte(snapshot: ScenarioSnapshot): number {
  return Math.max(0, snapshot.expirationDays - snapshot.selectedOffsetDays);
}

export function getEntryLegPricingDetails(card: ComparisonCardData): Array<{
  label: string;
  value: string;
}> {
  if (!isDebitSpreadStrategy(card.strategy) || card.spot === undefined) {
    return [];
  }

  const timeYears = card.snapshot.timeNowYears;
  const volatility = Math.max(card.volatilityPct ?? 0, 0) / 100;
  const rate = (card.ratePct ?? 0) / 100;
  const dividendYield = (card.dividendYieldPct ?? 0) / 100;
  const isCallCalendar = card.strategy === "call-calendar";

  if (isCallCalendar) {
    const longLegCost = blackScholesCall({
      spot: card.spot,
      strike: card.longStrike,
      timeYears,
      volatility,
      rate,
      dividendYield,
    });
    const shortLegCost = blackScholesCall({
      spot: card.spot,
      strike: card.longStrike,
      timeYears: card.snapshot.shortTimeNowYears,
      volatility,
      rate,
      dividendYield,
    });

    return [
      {
        label: `Long ${formatStrikeCurrency(card.longStrike)} call ${card.expirationDays} DTE / contract`,
        value: formatCurrency(longLegCost * CONTRACT_MULTIPLIER),
      },
      {
        label: `Short ${formatStrikeCurrency(card.longStrike)} call ${card.snapshot.shortExpirationDays} DTE / contract`,
        value: formatCurrency(shortLegCost * CONTRACT_MULTIPLIER),
      },
    ];
  }

  const isPutSpread = isPutOptionStrategy(card.strategy);
  const longLegCost = isPutSpread
    ? blackScholesPut({
        spot: card.spot,
        strike: card.longStrike,
        timeYears,
        volatility,
        rate,
        dividendYield,
      })
    : blackScholesCall({
        spot: card.spot,
        strike: card.longStrike,
        timeYears,
        volatility,
        rate,
        dividendYield,
      });
  const shortLegCost = isPutSpread
    ? blackScholesPut({
        spot: card.spot,
        strike: card.shortStrike,
        timeYears,
        volatility,
        rate,
        dividendYield,
      })
    : blackScholesCall({
        spot: card.spot,
        strike: card.shortStrike,
        timeYears,
        volatility,
        rate,
        dividendYield,
      });
  const legName = isPutSpread ? "put" : "call";
  const shortCount =
    isRatioSpreadStrategy(card.strategy)
      ? normalizePutRatioShortCount(card.ratioShortCount)
      : 1;

  return [
    {
      label: `Long ${formatStrikeCurrency(card.longStrike)} ${legName} / contract`,
      value: formatCurrency(longLegCost * CONTRACT_MULTIPLIER),
    },
    {
      label: `Short ${formatStrikeCurrency(card.shortStrike)} ${legName} / contract`,
      value: formatCurrency(shortLegCost * CONTRACT_MULTIPLIER),
    },
    ...(shortCount > 1
      ? [
          {
            label: "Short credit / ratio",
            value: formatCurrency(shortLegCost * shortCount * CONTRACT_MULTIPLIER),
          },
        ]
      : []),
  ];
}

function scaleGreeks(greeks: OptionGreeks, scale: number): OptionGreeks {
  return {
    delta: greeks.delta * scale,
    gamma: greeks.gamma * scale,
    theta: greeks.theta * scale,
    vega: greeks.vega * scale,
    rho: greeks.rho * scale,
  };
}

function addGreeks(first: OptionGreeks, second: OptionGreeks): OptionGreeks {
  return {
    delta: first.delta + second.delta,
    gamma: first.gamma + second.gamma,
    theta: first.theta + second.theta,
    vega: first.vega + second.vega,
    rho: first.rho + second.rho,
  };
}

export function getScenarioGreekRows(card: ComparisonCardData): StrategyGreekRow[] {
  const volatility = Math.max(card.futureVolatilityPct ?? 0, 0) / 100;
  const rate = (card.ratePct ?? 0) / 100;
  const dividendYield = (card.dividendYieldPct ?? 0) / 100;
  const isPut = isPutOptionStrategy(card.strategy);
  const optionType = isPut ? "put" : "call";
  const optionName = isPut ? "put" : "call";
  const priceOption = isPut ? blackScholesPut : blackScholesCall;
  const longOptionValue = priceOption({
    spot: card.snapshot.scenarioPrice,
    strike: card.longStrike,
    timeYears: card.snapshot.timeAtScenarioYears,
    volatility,
    rate,
    dividendYield,
  });
  const longGreeks = scaleGreeks(
    blackScholesGreeks({
      optionType,
      spot: card.snapshot.scenarioPrice,
      strike: card.longStrike,
      timeYears: card.snapshot.timeAtScenarioYears,
      volatility,
      rate,
      dividendYield,
    }),
    CONTRACT_MULTIPLIER,
  );

  if (!isDebitSpreadStrategy(card.strategy)) {
    return [
      {
        label: `Long ${formatStrikeCurrency(card.longStrike)} ${optionName}`,
        greeks: longGreeks,
        marketValue: longOptionValue * CONTRACT_MULTIPLIER,
      },
    ];
  }

  const isCallCalendar = card.strategy === "call-calendar";
  const shortStrike = isCallCalendar ? card.longStrike : card.shortStrike;
  const shortCount = isRatioSpreadStrategy(card.strategy)
    ? normalizePutRatioShortCount(card.ratioShortCount)
    : 1;
  const shortTimeYears = isCallCalendar
    ? card.snapshot.shortTimeAtScenarioYears
    : card.snapshot.timeAtScenarioYears;
  const shortOptionValue = priceOption({
    spot: card.snapshot.scenarioPrice,
    strike: shortStrike,
    timeYears: shortTimeYears,
    volatility,
    rate,
    dividendYield,
  });
  const shortGreeks = scaleGreeks(
    blackScholesGreeks({
      optionType,
      spot: card.snapshot.scenarioPrice,
      strike: shortStrike,
      timeYears: shortTimeYears,
      volatility,
      rate,
      dividendYield,
    }),
    -shortCount * CONTRACT_MULTIPLIER,
  );

  return [
    {
      label: `Long ${formatStrikeCurrency(card.longStrike)} ${optionName}`,
      greeks: longGreeks,
      marketValue: longOptionValue * CONTRACT_MULTIPLIER,
    },
    {
      label: isCallCalendar && card.snapshot.shortTimeAtScenarioYears === 0
        ? `Short ${formatStrikeCurrency(shortStrike)} call settled`
        : `Short ${formatStrikeCurrency(shortStrike)} ${optionName}${
            shortCount > 1 ? ` x${shortCount}` : ""
          }`,
      greeks: shortGreeks,
      marketValue: shortOptionValue * shortCount * CONTRACT_MULTIPLIER,
    },
    {
      label: "Net strategy",
      greeks: addGreeks(longGreeks, shortGreeks),
      marketValue: Math.abs((card.snapshot.scenarioUnitValue - card.snapshot.reserveOffset) * CONTRACT_MULTIPLIER),
      isNet: true,
    },
  ];
}

export function formatSignedGreekPercent(value: number, digits: number): string {
  const normalizedValue = Math.abs(value) < 0.5 * 10 ** -digits ? 0 : value;
  return `${normalizedValue > 0 ? "+" : ""}${normalizedValue.toFixed(digits)}%`;
}

export function formatGreekValuePercent(
  value: number,
  marketValue: number,
  digits = 2,
): string {
  if (marketValue <= 0) {
    return formatSignedGreekPercent(0, digits);
  }

  return formatSignedGreekPercent((value / marketValue) * 100, digits);
}

export function formatSignedMoveCurrency(value: number): string {
  const normalizedValue = Math.abs(value) < 0.005 ? 0 : value;
  return `${normalizedValue > 0 ? "+" : ""}${formatCurrencyWithCents(
    normalizedValue,
  )}`;
}

export function formatExpectedMove(
  expectedMoveDollar: number,
  expectedMovePct: number,
): string {
  return `+/- ${formatCurrencyWithCents(expectedMoveDollar)} · ${roundTo(
    expectedMovePct,
    2,
  )}%`;
}

export function formatReturnMatch(matchDifferencePoints: number): string {
  if (Math.abs(matchDifferencePoints) < 0.05) {
    return "Exact match";
  }

  return "Closest available";
}

export function getCustomComparisonLabel(
  draft: Pick<
    CustomComparisonDraft,
    | "label"
    | "strategy"
    | "longStrike"
    | "shortStrike"
    | "ratioShortCount"
    | "shortExpirationDays"
    | "expirationDays"
  >,
): string {
  if (draft.label.trim()) {
    return draft.label.trim();
  }

  if (draft.strategy === "call-calendar") {
    return `${formatStrikeCurrency(draft.longStrike)} ${normalizeCallCalendarShortExpirationDays(
      draft.shortExpirationDays,
      draft.expirationDays,
    )}/${draft.expirationDays} DTE call calendar`;
  }

  if (draft.strategy === "long-call" || draft.strategy === "bear-put") {
    return `${formatStrikeCurrency(draft.longStrike)} ${
      draft.strategy === "bear-put" ? "bear put" : "long call"
    }`;
  }

  return `${formatStrikeCurrency(draft.longStrike)} / ${formatStrikeCurrency(draft.shortStrike)} ${
    draft.strategy === "put-ratio-spread"
      ? `1/${normalizePutRatioShortCount(draft.ratioShortCount)} put ratio spread`
      : draft.strategy === "call-ratio-spread"
        ? `1/${normalizePutRatioShortCount(draft.ratioShortCount)} call ratio spread`
      : draft.strategy === "debit-put-spread"
        ? "put"
        : draft.strategy === "bull-put-spread"
          ? "bull put"
        : "call"
  }${isRatioSpreadStrategy(draft.strategy) ? "" : " spread"}`;
}

export function isGeneratedCustomComparisonLabel(
  comparison: CustomComparisonConfig,
): boolean {
  return (
    comparison.label ===
    getCustomComparisonLabel({
      ...comparison,
      label: "",
    })
  );
}

export function applyComparisonToInputs(
  candidate: ComparisonCandidate,
  inputs: StrategyInputs,
  useInitialIv = false,
): StrategyInputs {
  const lockedTodayIso = candidate.todayIso ?? inputs.todayIso;
  const lockedExpirationDays = clamp(Math.round(candidate.expirationDays), 1, 1095);

  return {
    ...inputs,
    todayIso: lockedTodayIso,
    strategy: candidate.strategy,
    spot: candidate.spot ?? inputs.spot,
    longStrike: candidate.longStrike,
    shortStrike: normalizeShortStrikeForStrategy(
      candidate.strategy,
      candidate.longStrike,
      candidate.shortStrike,
    ),
    ratioShortCount: normalizePutRatioShortCount(
      candidate.ratioShortCount ?? inputs.ratioShortCount,
    ),
    shortExpirationDays: normalizeCallCalendarShortExpirationDays(
      candidate.shortExpirationDays ?? inputs.shortExpirationDays,
      lockedExpirationDays,
    ),
    volatilityPct: candidate.volatilityPct ?? inputs.volatilityPct,
    futureVolatilityPct: useInitialIv
      ? candidate.volatilityPct ?? inputs.volatilityPct
      : inputs.futureVolatilityPct,
    capital: candidate.capital,
    expiryIso: addDaysToIso(lockedTodayIso, lockedExpirationDays),
    allowFractionalContracts: candidate.allowFractionalContracts,
    scenarioPrice: inputs.scenarioPrice,
    calendarShortPrice: inputs.calendarShortPrice,
    scenarioOffsetDays: clamp(
      Math.round(inputs.scenarioOffsetDays),
      0,
      lockedExpirationDays,
    ),
    ratePct: candidate.ratePct ?? inputs.ratePct,
    dividendYieldPct: candidate.dividendYieldPct ?? inputs.dividendYieldPct,
  };
}

export function buildComparisonCard(
  candidate: ComparisonCandidate,
  inputs: StrategyInputs,
  useInitialIv = false,
): ComparisonCardData | null {
  const candidateInputs = applyComparisonToInputs(
    candidate,
    inputs,
    useInitialIv,
  );
  const candidateSnapshot = createScenarioSnapshot(candidateInputs);

  if (candidateSnapshot.unitCost <= 0) {
    return null;
  }

  const candidateMaxProfit =
    candidateSnapshot.maxProfitPerUnit !== null
      ? candidateSnapshot.maxProfitPerUnit *
        candidateSnapshot.contracts *
        CONTRACT_MULTIPLIER
      : null;

  return {
    ...candidate,
    futureVolatilityPct: candidateInputs.futureVolatilityPct,
    snapshot: candidateSnapshot,
    maxProfitAtExpiry: candidateMaxProfit,
    maxReturnAtExpiry:
      candidateMaxProfit !== null && candidateSnapshot.totalCost > 0
        ? candidateMaxProfit / candidateSnapshot.totalCost
        : null,
    maxLossAtExpiry:
      candidateSnapshot.maxLossPerUnit === null
        ? null
        : -candidateSnapshot.maxLossPerUnit *
          candidateSnapshot.contracts *
          CONTRACT_MULTIPLIER,
  };
}

export function getComparisonCardTone(card: ComparisonCardData) {
  if (card.id === "current") {
    return {
      accent: "bg-[var(--accent)]",
      badge: "border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-strong)]",
      surface: "bg-[var(--accent-faint)]",
      label: "Editor",
    };
  }

  if (card.strategy === "long-call") {
    return {
      accent: "bg-[var(--accent)]",
      badge: "border-sky-200 bg-sky-50 text-sky-800",
      surface: "bg-sky-50",
      label: "Uncapped",
    };
  }

  if (card.id.includes("5-otm")) {
    return {
      accent: "bg-emerald-500",
      badge: "border-emerald-200 bg-emerald-50 text-emerald-800",
      surface: "bg-emerald-50",
      label: "Closer",
    };
  }

  if (card.id.includes("10-otm")) {
    return {
      accent: "bg-amber-500",
      badge: "border-amber-200 bg-amber-50 text-amber-900",
      surface: "bg-amber-50",
      label: "Balanced",
    };
  }

  if (card.id.includes("20-otm")) {
    return {
      accent: "bg-teal-500",
      badge: "border-teal-200 bg-teal-50 text-teal-800",
      surface: "bg-teal-50",
      label: "Aggressive",
    };
  }

  if (card.id.includes("30-otm")) {
    return {
      accent: "bg-blue-500",
      badge: "border-blue-200 bg-blue-50 text-blue-800",
      surface: "bg-blue-50",
      label: "Furthest",
    };
  }

  return {
    accent: "bg-slate-500",
    badge: "border-slate-200 bg-slate-50 text-slate-700",
    surface: "bg-slate-50",
    label: "Custom",
  };
}

export function orderSelectedCardsFirst<Row extends { id: string }>(
  cards: Row[],
  selectedCardId?: string | null,
): Row[] {
  if (!selectedCardId) {
    return cards;
  }

  const selectedIndex = cards.findIndex((card) => card.id === selectedCardId);

  if (selectedIndex <= 0) {
    return cards;
  }

  return [
    cards[selectedIndex],
    ...cards.slice(0, selectedIndex),
    ...cards.slice(selectedIndex + 1),
  ];
}

export function moveCardById<Row extends { id: string }>(
  cards: Row[],
  sourceId: string,
  targetId: string,
): Row[] {
  if (sourceId === targetId) {
    return cards;
  }

  const sourceIndex = cards.findIndex((card) => card.id === sourceId);
  const targetIndex = cards.findIndex((card) => card.id === targetId);

  if (sourceIndex < 0 || targetIndex < 0) {
    return cards;
  }

  const nextCards = [...cards];
  const [movedCard] = nextCards.splice(sourceIndex, 1);
  nextCards.splice(targetIndex, 0, movedCard);

  return nextCards;
}

export function getMaxProfitAtExpiryLabel(card: ComparisonCardData): string {
  if (card.strategy === "call-calendar") {
    return "Open";
  }

  if (card.maxProfitAtExpiry === null) {
    return "Uncapped";
  }

  return card.maxReturnAtExpiry !== null
    ? `${formatCurrency(card.maxProfitAtExpiry)} ${formatPercent(card.maxReturnAtExpiry)}`
    : formatCurrency(card.maxProfitAtExpiry);
}

export function getCompactMaxProfitAtExpiryLabel(card: ComparisonCardData): string {
  if (card.strategy === "call-calendar") {
    return "Open";
  }

  if (card.maxProfitAtExpiry === null) {
    return "Uncapped";
  }

  return card.maxReturnAtExpiry !== null
    ? `${formatCompactCurrency(card.maxProfitAtExpiry)} ${formatPercent(card.maxReturnAtExpiry)}`
    : formatCompactCurrency(card.maxProfitAtExpiry);
}

export function getOutcomeStrategyTitle(card: ComparisonCardData): string {
  if (card.strategy === "long-call" || card.strategy === "bear-put") {
    return getComparisonStrikeLabel(card);
  }

  if (card.strategy === "call-calendar") {
    return `${formatStrikeCurrency(card.longStrike)} ${card.snapshot.shortExpirationDays}/${card.expirationDays} DTE call calendar`;
  }

  if (card.strategy === "put-ratio-spread") {
    return `${formatStrikeCurrency(card.longStrike)} / ${formatStrikeCurrency(
      card.shortStrike,
    )} 1/${normalizePutRatioShortCount(card.ratioShortCount)} put ratio spread`;
  }

  if (card.strategy === "call-ratio-spread") {
    return `${formatStrikeCurrency(card.longStrike)} / ${formatStrikeCurrency(
      card.shortStrike,
    )} 1/${normalizePutRatioShortCount(card.ratioShortCount)} call ratio spread`;
  }

  return `${getComparisonStrikeLabel(card)} ${
    card.strategy === "debit-put-spread"
        ? "put"
        : card.strategy === "bull-put-spread"
          ? "bull put"
        : "call"
  }${isRatioSpreadStrategy(card.strategy) ? "" : " spread"}`;
}
