"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent, ReactNode } from "react";
import DebitSpreadScenarioVisualizer from "@/components/debit-spread-scenario-visualizer";
import { cn } from "@/lib/cn";
import {
  CONTRACT_MULTIPLIER,
  addDaysToIso,
  buildPriceCurve,
  buildPriceLadderRows,
  buildTimelineRows,
  clamp,
  createScenarioSnapshot,
  daysBetween,
  formatLongDate,
  roundTo,
} from "@/lib/debit-call-spread";
import type {
  OptionStrategy,
  PriceCurvePoint,
  PriceLadderRow,
  ScenarioSnapshot,
  StrategyInputs,
  TimelineRow,
} from "@/lib/debit-call-spread";

type SectionCardProps = {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  className?: string;
  eyebrowClassName?: string;
  action?: ReactNode;
};

type MetricTone = "default" | "positive" | "negative" | "accent";

type MetricCardProps = {
  label: string;
  value: string;
  tone?: MetricTone;
  helper?: string;
};

type InfoIconProps = {
  label: string;
};

type TooltipPosition = {
  left: number;
  top: number;
};

type ScenarioGraphView = "decay" | "overlay" | "map";

type TimeDecayPoint = {
  offsetDays: number;
  dateIso: string;
  positionValue: number;
  pnl: number;
};

type TimeDecayChartProps = {
  title: string;
  subtitle: string;
  points: TimeDecayPoint[];
  expirationDays: number;
  selectedOffsetDays: number;
  selectedPositionValue: number;
  selectedPnl: number;
  totalCost: number;
  scenarioPriceLabel: string;
};

type OverlayCurve = {
  id: string;
  label: string;
  offsetDays: number;
  isExpiry: boolean;
  points: Array<{ price: number; pnl: number }>;
};

type MultiDateOverlayChartProps = {
  title: string;
  subtitle: string;
  curves: OverlayCurve[];
  selectedPrice: number;
  selectedOffsetDays: number;
  breakEvenPrice: number;
  spotPrice: number;
  priceMarkers: PriceMarker[];
  totalCost: number;
};

type PnlCurvePoint = {
  price: number;
  selectedDatePnl: number;
  expiryPnl: number;
};

type PriceMarker = {
  value: number;
  label: string;
};

type PnlScenarioChartProps = {
  title: string;
  subtitle: string;
  points: PnlCurvePoint[];
  selectedPrice: number;
  selectedPnl: number;
  breakEvenPrice: number;
  spotPrice: number;
  priceMarkers: PriceMarker[];
  maxProfit: number | null;
  maxLoss: number;
  totalCost: number;
  showExpiryCurve: boolean;
  scenarioDateLabel: string;
};

type NumberSliderFieldProps = {
  label: string;
  help: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
  prefix?: string;
  quickActions?: Array<{
    label: string;
    value: number;
  }>;
  className?: string;
  headerClassName?: string;
  sliderClassName?: string;
};

type ScenarioValueMapProps = {
  unitName: string;
  minPrice: number;
  maxPrice: number;
  selectedPrice: number;
  selectedOffsetDays: number;
  selectedValue: number;
  selectedPnl: number;
  selectedRoi: number;
  currentSpot: number;
  expirationDays: number;
  todayIso: string;
  scenarioDateLabel: string;
  breakEvenPrice: number;
  totalCost: number;
  maxProfit: number | null;
  getScenarioTooltipPoint: (price: number, offsetDays: number) => {
    dateLabel: string;
    positionValue: number;
    pnl: number;
    roi: number;
  };
};

type TableColumn<Row> = {
  key: string;
  label: string;
  align?: "right";
  muted?: boolean;
  render: (row: Row) => ReactNode;
};

type ResultsTableProps<Row extends { id: string; isHighlighted?: boolean }> = {
  title: string;
  subtitle: string;
  columns: TableColumn<Row>[];
  rows: Row[];
};

type DebitCallSpreadLabProps = {
  todayIso: string;
  defaultExpiryIso: string;
};

type TimelineTableRow = TimelineRow & { id: string };
type PriceTableRow = PriceLadderRow & { id: string };

type ComparisonPanelMode = "hidden" | "presets" | "custom";

type ComparisonCandidate = {
  id: string;
  label: string;
  note: string;
  strategy: OptionStrategy;
  longStrike: number;
  shortStrike: number;
  capital: number;
  expirationDays: number;
  allowFractionalContracts: boolean;
};

type ComparisonCardData = ComparisonCandidate & {
  snapshot: ScenarioSnapshot;
  maxProfitAtExpiry: number | null;
  maxReturnAtExpiry: number | null;
  maxLossAtExpiry: number;
  rank: number;
};

type CustomComparisonConfig = {
  id: string;
  label: string;
  strategy: OptionStrategy;
  longStrike: number;
  shortStrike: number;
  capital: number;
  expirationDays: number;
  allowFractionalContracts: boolean;
};

type CustomComparisonDraft = Omit<CustomComparisonConfig, "id">;

type GraphComparisonOption = {
  id: string;
  label: string;
  detail: string;
  inputs: StrategyInputs;
  snapshot: ScenarioSnapshot;
};

type StrategyCopy = {
  unitName: string;
  unitTitle: string;
  contractName: string;
  contractPlural: string;
  costMetricLabel: string;
  unitColumnLabel: string;
  modelAssumptions: string;
  capitalHelp: string;
};

type ShareState = {
  strategy: OptionStrategy;
  symbol: string;
  spot: number;
  volatilityPct: number;
  futureVolatilityPct: number;
  longStrike: number;
  shortStrike: number;
  capital: number;
  allowFractionalContracts: boolean;
  expirationDays: number;
  scenarioPrice: number;
  scenarioOffsetDays: number;
  ratePct: number;
  scenarioGraphView: ScenarioGraphView;
  comparisonPanelMode: ComparisonPanelMode;
  customComparisons: CustomComparisonConfig[];
  graphComparisonId: string;
};

const CHART_COLORS = {
  paper: "#ffffff",
  paperSoft: "#f8fafc",
  paperMuted: "#e2e8f0",
  ink: "#0f172a",
  inkMuted: "#64748b",
  line: "#cbd5e1",
  grid: "#f1f5f9",
  accent: "#e63946",
  pine: "#059669",
  loss: "#be123c",
};

const STRATEGY_OPTIONS: Array<{
  value: OptionStrategy;
  label: string;
  description: string;
}> = [
  {
    value: "debit-call-spread",
    label: "Debit call spread",
    description: "Buy one call and sell a higher-strike call.",
  },
  {
    value: "long-call",
    label: "Long call",
    description: "Buy one call with uncapped upside.",
  },
];

const STRATEGY_COPY: Record<OptionStrategy, StrategyCopy> = {
  "debit-call-spread": {
    unitName: "spread",
    unitTitle: "Spread",
    contractName: "1x1 spread",
    contractPlural: "full spreads",
    costMetricLabel: "Spread cost today",
    unitColumnLabel: "Spread / 1 spread",
    modelAssumptions:
      "This uses a Black-Scholes estimate with current IV for today's entry cost, future IV for scenario values, and a flat risk-free rate. Both call legs share the same IV in each estimate.",
    capitalHelp: "The app buys as many full 1x1 spreads as this amount allows.",
  },
  "long-call": {
    unitName: "call",
    unitTitle: "Call",
    contractName: "call contract",
    contractPlural: "call contracts",
    costMetricLabel: "Call cost today",
    unitColumnLabel: "Call / 1 contract",
    modelAssumptions:
      "This uses a Black-Scholes estimate with current IV for today's entry cost, future IV for scenario values, and a flat risk-free rate. It treats the call like European-style pricing.",
    capitalHelp: "The app buys as many full call contracts as this amount allows.",
  },
};

const SHARE_PARAM = "s";
const SHARE_VERSION = "1";

function compactNumber(value: number): string {
  return String(roundTo(value, 2)).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

function encodeShareText(value: string): string {
  return encodeURIComponent(value).replace(/!/g, "%21");
}

function parseShareNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}

function decodeShareText(value: string | undefined, fallback: string): string {
  if (!value) {
    return fallback;
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return fallback;
  }
}

function encodeCustomComparisons(comparisons: CustomComparisonConfig[]): string {
  return comparisons
    .slice(0, 12)
    .map((comparison) =>
      [
        comparison.strategy === "long-call" ? "l" : "d",
        compactNumber(comparison.longStrike),
        compactNumber(comparison.shortStrike),
        compactNumber(comparison.capital),
        comparison.allowFractionalContracts ? "1" : "0",
        encodeShareText(comparison.label),
        encodeShareText(comparison.id),
        compactNumber(comparison.expirationDays),
      ].join(","),
    )
    .join(";");
}

function decodeCustomComparisons(value: string | undefined): CustomComparisonConfig[] {
  if (!value) {
    return [];
  }

  return value
    .split(";")
    .slice(0, 12)
    .flatMap((entry, index) => {
      const [
        strategyToken,
        longStrikeToken,
        shortStrikeToken,
        capitalToken,
        fractionalToken,
        labelToken,
        idToken,
        expirationDaysToken,
      ] = entry.split(",");
      const strategy: OptionStrategy =
        strategyToken === "l" ? "long-call" : "debit-call-spread";
      const longStrike = Math.max(1, Math.round(parseShareNumber(longStrikeToken, 100)));
      const shortStrike =
        strategy === "long-call"
          ? longStrike
          : Math.max(longStrike + 1, Math.round(parseShareNumber(shortStrikeToken, longStrike + 10)));
      const capital = Math.max(0, Math.round(parseShareNumber(capitalToken, 10000)));
      const expirationDays = clamp(
        Math.round(parseShareNumber(expirationDaysToken, 60)),
        1,
        1095,
      );

      if (capital <= 0) {
        return [];
      }

      return [{
        label: decodeShareText(labelToken, ""),
        strategy,
        longStrike,
        shortStrike,
        capital,
        expirationDays,
        allowFractionalContracts: fractionalToken === "1",
        id: decodeShareText(idToken, `shared-custom-${index}`),
      }];
    });
}

function encodeShareState(state: ShareState): string {
  const parts = [
    SHARE_VERSION,
    state.strategy === "long-call" ? "l" : "d",
    encodeShareText(state.symbol),
    compactNumber(state.spot),
    compactNumber(state.volatilityPct),
    compactNumber(state.futureVolatilityPct),
    compactNumber(state.longStrike),
    compactNumber(state.shortStrike),
    compactNumber(state.capital),
    state.allowFractionalContracts ? "1" : "0",
    compactNumber(state.expirationDays),
    compactNumber(state.scenarioPrice),
    compactNumber(state.scenarioOffsetDays),
    compactNumber(state.ratePct),
    state.scenarioGraphView === "map"
      ? "m"
      : state.scenarioGraphView === "decay"
        ? "t"
        : "o",
  ];

  if (
    state.comparisonPanelMode !== "hidden" ||
    state.customComparisons.length > 0 ||
    state.graphComparisonId !== "editor"
  ) {
    parts.push(
      state.comparisonPanelMode === "custom"
        ? "c"
        : state.comparisonPanelMode === "presets"
          ? "p"
          : "h",
      encodeCustomComparisons(state.customComparisons),
      encodeShareText(state.graphComparisonId),
    );
  }

  return parts.join("~");
}

function getShareStateFromUrl(defaultExpirationDays: number): ShareState | null {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const hashState = decodeShareState(hashParams.get(SHARE_PARAM), defaultExpirationDays);

  if (hashState) {
    return hashState;
  }

  return decodeShareState(
    new URLSearchParams(window.location.search).get(SHARE_PARAM),
    defaultExpirationDays,
  );
}

function replaceShareHash(nextState: string) {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));

  if (hashParams.get(SHARE_PARAM) === nextState) {
    return;
  }

  hashParams.set(SHARE_PARAM, nextState);
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${window.location.search}#${hashParams.toString()}`,
  );
}

function decodeShareState(value: string | null, defaultExpirationDays: number): ShareState | null {
  if (!value) {
    return null;
  }

  const [
    version,
    strategyToken,
    symbolToken,
    spotToken,
    volatilityToken,
    futureVolatilityToken,
    longStrikeToken,
    shortStrikeToken,
    capitalToken,
    fractionalToken,
    expirationDaysToken,
    scenarioPriceToken,
    scenarioOffsetDaysToken,
    rateToken,
    graphToken,
    comparisonPanelToken,
    customComparisonsToken,
    graphComparisonToken,
  ] = value.split("~");

  if (version !== SHARE_VERSION) {
    return null;
  }

  const expirationDays = clamp(
    Math.round(parseShareNumber(expirationDaysToken, defaultExpirationDays)),
    0,
    1095,
  );

  return {
    strategy: strategyToken === "l" ? "long-call" : "debit-call-spread",
    symbol: decodeShareText(symbolToken, "NVDA").toUpperCase(),
    spot: Math.max(1, Math.round(parseShareNumber(spotToken, 100))),
    volatilityPct: clamp(Math.round(parseShareNumber(volatilityToken, 50)), 0, 300),
    futureVolatilityPct: clamp(
      Math.round(parseShareNumber(futureVolatilityToken, 50)),
      0,
      300,
    ),
    longStrike: Math.max(1, Math.round(parseShareNumber(longStrikeToken, 120))),
    shortStrike: Math.max(1, Math.round(parseShareNumber(shortStrikeToken, 130))),
    capital: Math.max(0, Math.round(parseShareNumber(capitalToken, 10000))),
    allowFractionalContracts: fractionalToken === "1",
    expirationDays,
    scenarioPrice: Math.max(1, Math.round(parseShareNumber(scenarioPriceToken, 145))),
    scenarioOffsetDays: clamp(
      Math.round(parseShareNumber(scenarioOffsetDaysToken, Math.round(expirationDays / 2))),
      0,
      expirationDays,
    ),
    ratePct: clamp(parseShareNumber(rateToken, 4), 0, 15),
    scenarioGraphView:
      graphToken === "t"
        ? "decay"
        : graphToken === "o"
          ? "overlay"
          : "map",
    comparisonPanelMode:
      comparisonPanelToken === "c"
        ? "custom"
        : comparisonPanelToken === "p"
          ? "presets"
          : "hidden",
    customComparisons: decodeCustomComparisons(customComparisonsToken),
    graphComparisonId: decodeShareText(graphComparisonToken, "editor"),
  };
}

function formatCurrency(value: number): string {
  const roundedValue = Math.round(value);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Object.is(roundedValue, -0) ? 0 : roundedValue);
}

function formatCompactCurrency(value: number): string {
  const roundedValue = Math.round(value);
  const safeValue = Object.is(roundedValue, -0) ? 0 : roundedValue;
  const sign = safeValue < 0 ? "-" : "";
  const absValue = Math.abs(safeValue);

  if (absValue >= 1_000_000) {
    return `${sign}$${Math.round(absValue / 1_000_000)}M`;
  }

  if (absValue >= 1_000) {
    return `${sign}$${Math.round(absValue / 1_000)}K`;
  }

  return `${sign}$${absValue}`;
}

function getStockPriceTickStep(
  minPrice: number,
  maxPrice: number,
  referencePrice: number,
): number {
  const rangeStep = Math.max(maxPrice - minPrice, 1) / 5;
  const priceStep = Math.max(Math.abs(referencePrice) * 0.05, 1);
  const rawStep = Math.max(rangeStep, priceStep);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalizedStep = rawStep / magnitude;
  const niceMultiplier =
    normalizedStep <= 1
      ? 1
      : normalizedStep <= 2
        ? 2
        : normalizedStep <= 2.5
          ? 2.5
          : normalizedStep <= 5
            ? 5
            : 10;

  return Math.max(1, niceMultiplier * magnitude);
}

function buildStockPriceAxisTicks(
  minPrice: number,
  maxPrice: number,
  referencePrice: number,
): number[] {
  const safeMin = Math.max(0, Math.floor(Math.min(minPrice, maxPrice)));
  const safeMax = Math.max(safeMin + 1, Math.ceil(Math.max(minPrice, maxPrice)));
  const step = getStockPriceTickStep(safeMin, safeMax, referencePrice);
  const firstTick = Math.ceil(safeMin / step) * step;
  const ticks: number[] = [];
  const seenLabels = new Set<string>();

  for (
    let tick = firstTick;
    tick <= safeMax + step * 0.001;
    tick += step
  ) {
    const roundedTick = Math.round(tick);
    const label = formatCurrency(roundedTick);

    if (!seenLabels.has(label)) {
      ticks.push(roundedTick);
      seenLabels.add(label);
    }
  }

  return ticks;
}

function formatPercent(value: number): string {
  const roundedValue = Math.round(value * 100);
  const safeValue = Object.is(roundedValue, -0) ? 0 : roundedValue;

  return `${safeValue >= 0 ? "+" : ""}${safeValue}%`;
}

function formatQuantity(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Object.is(value, -0) ? 0 : value);
}

function getSliderMax(...values: number[]): number {
  return Math.ceil((Math.max(...values, 50) * 1.8) / 5) * 5;
}

function parseNumberInput(value: string): number {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? Math.round(nextValue) : 0;
}

function parseDecimalInput(value: string): number {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : 0;
}

function getOtmStrike(spotPrice: number, percent: number): number {
  return Math.round(spotPrice * (1 + percent / 100));
}

function handleNumberKeyDown(
  event: KeyboardEvent<HTMLInputElement>,
  onChange: (value: number) => void,
) {
  if (event.altKey || event.ctrlKey || event.metaKey) {
    return;
  }

  if (event.key === "Enter") {
    event.currentTarget.blur();
    return;
  }

  if (event.key === "Backspace" && /^\d$/.test(event.currentTarget.value)) {
    event.preventDefault();
    onChange(0);
    return;
  }

  if (/^\d$/.test(event.key) && event.currentTarget.value === "0") {
    event.preventDefault();
    onChange(Number(event.key));
  }
}

function blurFocusedField() {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
}

function SidebarGroupLabel({ children }: { children: ReactNode }) {
  return (
    <h3 className="flex items-baseline justify-between gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </h3>
  );
}

function SectionCard({
  title,
  eyebrow,
  children,
  className,
  eyebrowClassName,
  action,
}: SectionCardProps) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4",
        className,
      )}
    >
      <div className="mb-4 flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow ? (
            <p
              className={cn(
                "text-sm font-medium text-[#e63946]",
                eyebrowClassName,
              )}
            >
              {eyebrow}
            </p>
          ) : null}
          <h2 className="font-[family:var(--font-space-grotesk)] text-lg font-semibold text-balance text-slate-950">
            {title}
          </h2>
        </div>
        {action ? <div className="min-w-0 shrink-0 basis-full sm:basis-auto">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function MetricCard({ label, value, tone = "default", helper }: MetricCardProps) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-3 shadow-sm sm:p-4">
      <p className="text-sm text-slate-600">{label}</p>
      <p
        className={cn(
          "mt-2 font-mono text-2xl font-semibold tabular-nums",
          tone === "positive" && "text-emerald-700",
          tone === "negative" && "text-rose-700",
          tone === "accent" && "text-[#e63946]",
          tone === "default" && "text-slate-950",
        )}
      >
        {value}
      </p>
      {helper ? <p className="mt-1 text-sm text-slate-500 text-pretty">{helper}</p> : null}
    </div>
  );
}

function getComparisonStrikeLabel(candidate: ComparisonCandidate): string {
  if (candidate.strategy === "long-call") {
    return `${formatCurrency(candidate.longStrike)} call`;
  }

  return `${formatCurrency(candidate.longStrike)} / ${formatCurrency(candidate.shortStrike)}`;
}

function getCustomComparisonLabel(draft: CustomComparisonDraft): string {
  if (draft.label.trim()) {
    return draft.label.trim();
  }

  if (draft.strategy === "long-call") {
    return `${formatCurrency(draft.longStrike)} long call`;
  }

  return `${formatCurrency(draft.longStrike)} / ${formatCurrency(draft.shortStrike)} spread`;
}

function applyComparisonToInputs(
  candidate: ComparisonCandidate,
  inputs: StrategyInputs,
): StrategyInputs {
  return {
    ...inputs,
    strategy: candidate.strategy,
    longStrike: candidate.longStrike,
    shortStrike:
      candidate.strategy === "long-call"
        ? candidate.longStrike
        : Math.max(candidate.shortStrike, candidate.longStrike + 1),
    capital: candidate.capital,
    expiryIso: addDaysToIso(inputs.todayIso, candidate.expirationDays),
    allowFractionalContracts: candidate.allowFractionalContracts,
  };
}

function buildComparisonCard(
  candidate: ComparisonCandidate,
  inputs: StrategyInputs,
): ComparisonCardData | null {
  const candidateSnapshot = createScenarioSnapshot(applyComparisonToInputs(candidate, inputs));

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
    snapshot: candidateSnapshot,
    maxProfitAtExpiry: candidateMaxProfit,
    maxReturnAtExpiry:
      candidateMaxProfit !== null && candidateSnapshot.totalCost > 0
        ? candidateMaxProfit / candidateSnapshot.totalCost
        : null,
    maxLossAtExpiry: -candidateSnapshot.totalCost,
    rank: 0,
  };
}

function rankComparisonCards(cards: ComparisonCardData[]): ComparisonCardData[] {
  return [...cards]
    .sort((first, second) => second.snapshot.roi - first.snapshot.roi)
    .map((card, index) => ({ ...card, rank: index + 1 }));
}

function ComparisonCardGrid({
  cards,
  onRemoveCard,
}: {
  cards: ComparisonCardData[];
  onRemoveCard?: (id: string) => void;
}) {
  const maxAbsPnl = Math.max(1, ...cards.map((card) => Math.abs(card.snapshot.pnl)));
  const bestCard = cards[0];

  return (
    <div className="grid min-w-0 gap-3 lg:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => {
        const isBest = card.id === bestCard?.id;
        const isCurrent = card.id === "current";
        const pnlIsPositive = card.snapshot.pnl >= 0;
        const barWidth = `${Math.max(
          8,
          Math.min((Math.abs(card.snapshot.pnl) / maxAbsPnl) * 100, 100),
        )}%`;

        return (
          <article
            key={card.id}
            className={cn(
              "min-w-0 rounded-lg border bg-white p-3 shadow-sm",
              isBest ? "border-emerald-300 ring-1 ring-emerald-100" : "border-slate-200",
              isCurrent && "border-[#e63946]/40 ring-1 ring-[#e63946]/20",
            )}
          >
            <div className="flex min-w-0 items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <h3 className="truncate text-sm font-semibold text-slate-950">
                    {card.label}
                  </h3>
                  {isCurrent ? (
                    <span className="rounded-full bg-[#e63946]/15 px-2 py-0.5 text-[10px] font-semibold text-[#9f1d2a]">
                      Current
                    </span>
                  ) : null}
                  {isBest ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                      Best
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-xs text-slate-600 tabular-nums">
                  #{card.rank}
                </span>
                {onRemoveCard ? (
                  <button
                    type="button"
                    aria-label={`Remove ${card.label}`}
                    onClick={() => onRemoveCard(card.id)}
                    className="inline-flex size-6 items-center justify-center rounded-md border border-slate-200 bg-white text-sm font-semibold text-slate-500 shadow-sm hover:border-rose-300 hover:text-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e63946]"
                  >
                    x
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase text-slate-500">
                  Scenario P/L
                </p>
                <p
                  className={cn(
                    "mt-1 truncate font-[family:var(--font-space-grotesk)] text-2xl font-semibold leading-none tabular-nums",
                    pnlIsPositive ? "text-emerald-700" : "text-rose-700",
                  )}
                >
                  {pnlIsPositive ? "+" : ""}
                  {formatCurrency(card.snapshot.pnl)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase text-slate-500">
                  Return
                </p>
                <p
                  className={cn(
                    "mt-1 font-mono text-base font-semibold tabular-nums",
                    pnlIsPositive ? "text-emerald-700" : "text-rose-700",
                  )}
                >
                  {formatPercent(card.snapshot.roi)}
                </p>
              </div>
            </div>

            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={cn(
                  "h-full rounded-full",
                  pnlIsPositive ? "bg-emerald-600" : "bg-rose-600",
                )}
                style={{ width: barWidth }}
              />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div>
                <p className="text-slate-500">Structure</p>
                <p className="mt-0.5 truncate font-mono font-semibold text-slate-950 tabular-nums">
                  {getComparisonStrikeLabel(card)}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Break-even</p>
                <p className="mt-0.5 truncate font-mono font-semibold text-slate-950 tabular-nums">
                  {formatCurrency(card.snapshot.breakEvenAtExpiry)}
                </p>
              </div>
              <div>
                <p className="text-slate-500">DTE</p>
                <p className="mt-0.5 truncate font-mono font-semibold text-slate-950 tabular-nums">
                  {card.snapshot.expirationDays}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Max at expiry</p>
                <p className="mt-0.5 truncate font-mono font-semibold text-slate-950 tabular-nums">
                  {card.maxProfitAtExpiry !== null
                    ? `${formatCompactCurrency(card.maxProfitAtExpiry)} ${card.maxReturnAtExpiry !== null ? formatPercent(card.maxReturnAtExpiry) : ""}`
                    : "Uncapped"}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Contracts</p>
                <p className="mt-0.5 truncate font-mono font-semibold text-slate-950 tabular-nums">
                  {formatQuantity(card.snapshot.contracts)}
                </p>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function OptionComparisonBoard({
  cards,
  scenarioDateLabel,
  scenarioPrice,
  symbol,
}: {
  cards: ComparisonCardData[];
  scenarioDateLabel: string;
  scenarioPrice: number;
  symbol: string;
}) {
  return (
    <SectionCard
      title="Opportunity board"
      eyebrow={`${symbol.trim() || "Underlying"} comparison at ${formatCurrency(
        scenarioPrice,
      )} on ${scenarioDateLabel}`}
      action={
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
          Ranked by selected scenario
        </div>
      }
    >
      <ComparisonCardGrid cards={cards} />
    </SectionCard>
  );
}

function CompactNumberInput({
  label,
  value,
  onChange,
  prefix,
  suffix,
  min = 0,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
  min?: number;
  step?: number;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <div className="mt-1 flex items-center rounded-md border border-slate-300 bg-white px-2.5 py-1.5 shadow-sm">
        {prefix ? <span className="text-sm text-slate-500">{prefix}</span> : null}
        <input
          type="number"
          min={min}
          step={step}
          value={value}
          onKeyDown={(event) => handleNumberKeyDown(event, onChange)}
          onChange={(event) => onChange(parseNumberInput(event.target.value))}
          className="min-w-0 flex-1 border-0 bg-transparent p-0 font-mono text-sm font-medium text-slate-950 outline-none tabular-nums"
        />
        {suffix ? <span className="text-sm text-slate-500">{suffix}</span> : null}
      </div>
    </label>
  );
}

function CustomComparisonBoard({
  cards,
  draft,
  draftError,
  isEditorOpen,
  quickStartCards,
  showSummary,
  scenarioDateLabel,
  scenarioPrice,
  symbol,
  onDraftChange,
  onAddComparison,
  onRemoveComparison,
  onUseQuickStart,
}: {
  cards: ComparisonCardData[];
  draft: CustomComparisonDraft;
  draftError: string | null;
  isEditorOpen: boolean;
  quickStartCards: ComparisonCardData[];
  showSummary: boolean;
  scenarioDateLabel: string;
  scenarioPrice: number;
  symbol: string;
  onDraftChange: (draft: CustomComparisonDraft) => void;
  onAddComparison: () => void;
  onRemoveComparison: (id: string) => void;
  onUseQuickStart: (card: ComparisonCardData) => void;
}) {
  const isSpreadDraft = draft.strategy === "debit-call-spread";

  return (
    <SectionCard
      title="Custom comparisons"
      eyebrow={`${symbol.trim() || "Underlying"} comparison at ${formatCurrency(
        scenarioPrice,
      )} on ${scenarioDateLabel}`}
      action={
        isEditorOpen && quickStartCards.length > 0 ? (
          <details className="relative">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-[#e63946] hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e63946]">
              Start with
              <span className="text-slate-500">▾</span>
            </summary>
            <div className="absolute right-0 z-20 mt-2 grid w-56 gap-1 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
              {quickStartCards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={(event) => {
                    onUseQuickStart(card);
                    event.currentTarget.closest("details")?.removeAttribute("open");
                  }}
                  className="rounded-md px-2.5 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-[#e63946]/10 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e63946]"
                >
                  {card.label}
                </button>
              ))}
            </div>
          </details>
        ) : null
      }
    >
      {isEditorOpen ? (
        <>
          <div className="grid min-w-0 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 shadow-sm lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <label className="block min-w-0 sm:col-span-2 xl:col-span-1">
                <span className="text-xs font-medium text-slate-500">Name</span>
                <input
                  type="text"
                  value={draft.label}
                  placeholder={getCustomComparisonLabel({ ...draft, label: "" })}
                  onChange={(event) =>
                    onDraftChange({ ...draft, label: event.target.value })
                  }
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-950 shadow-sm outline-none placeholder:text-slate-400 focus:border-[#e63946]"
                />
              </label>

              <div className="min-w-0">
                <span className="text-xs font-medium text-slate-500">Type</span>
                <div
                  className="mt-1 grid grid-cols-2 rounded-md border border-slate-300 bg-white p-0.5 shadow-sm"
                  role="group"
                  aria-label="Custom comparison type"
                >
                  {STRATEGY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={draft.strategy === option.value}
                      onClick={() =>
                        onDraftChange({
                          ...draft,
                          strategy: option.value,
                          shortStrike:
                            option.value === "long-call"
                              ? draft.longStrike
                              : Math.max(draft.shortStrike, draft.longStrike + 1),
                        })
                      }
                      className={cn(
                        "min-w-0 truncate rounded px-2 py-1.5 text-xs font-semibold text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e63946]",
                        draft.strategy === option.value &&
                          "bg-[#e63946]/10 text-slate-950 shadow-sm",
                      )}
                    >
                      {option.value === "long-call" ? "Call" : "Spread"}
                    </button>
                  ))}
                </div>
              </div>

              <CompactNumberInput
                label={isSpreadDraft ? "Long strike" : "Strike"}
                value={draft.longStrike}
                min={1}
                prefix="$"
                onChange={(nextValue) =>
                  onDraftChange({
                    ...draft,
                    longStrike: Math.max(1, nextValue),
                    shortStrike: isSpreadDraft
                      ? Math.max(draft.shortStrike, nextValue + 1)
                      : Math.max(1, nextValue),
                  })
                }
              />

              {isSpreadDraft ? (
                <CompactNumberInput
                  label="Short strike"
                  value={draft.shortStrike}
                  min={1}
                  prefix="$"
                  onChange={(nextValue) =>
                    onDraftChange({ ...draft, shortStrike: Math.max(1, nextValue) })
                  }
                />
              ) : null}

              <CompactNumberInput
                label="Capital"
                value={draft.capital}
                min={0}
                prefix="$"
                step={100}
                onChange={(nextValue) =>
                  onDraftChange({ ...draft, capital: Math.max(0, nextValue) })
                }
              />

              <CompactNumberInput
                label="DTE"
                value={draft.expirationDays}
                min={1}
                suffix="d"
                step={1}
                onChange={(nextValue) =>
                  onDraftChange({
                    ...draft,
                    expirationDays: clamp(Math.round(nextValue), 1, 1095),
                  })
                }
              />
            </div>

            <div className="flex min-w-0 flex-col justify-end gap-2">
              <label className="flex min-w-0 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
                <input
                  type="checkbox"
                  checked={draft.allowFractionalContracts}
                  onChange={(event) =>
                    onDraftChange({
                      ...draft,
                      allowFractionalContracts: event.target.checked,
                    })
                  }
                  className="size-4 accent-[#e63946]"
                />
                <span>Fractional</span>
              </label>
              <button
                type="button"
                disabled={Boolean(draftError)}
                onClick={onAddComparison}
                className="rounded-md border border-[#e63946] bg-[#e63946] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#cf2433] disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e63946]"
              >
                Add comparison
              </button>
            </div>
          </div>

          {draftError ? (
            <p className="mt-2 text-sm font-medium text-rose-700">{draftError}</p>
          ) : null}
        </>
      ) : null}

      {showSummary ? (
        <div className={isEditorOpen ? "mt-4" : undefined}>
          {cards.length > 0 ? (
            <ComparisonCardGrid cards={cards} onRemoveCard={onRemoveComparison} />
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
              Add a custom spread or call to compare it against the selected scenario.
            </div>
          )}
        </div>
      ) : null}
    </SectionCard>
  );
}

function InfoIcon({ label }: InfoIconProps) {
  const tooltipId = useId();
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition>({
    left: 12,
    top: 12,
  });
  const handledPointerActivation = useRef(false);
  const isOpen = isHovered || isFocused || isPinned;
  const updateTooltipPosition = (element: HTMLElement) => {
    const tooltipWidth = 256;
    const viewportPadding = 12;
    const rect = element.getBoundingClientRect();
    const left = clamp(
      rect.right - tooltipWidth,
      viewportPadding,
      Math.max(viewportPadding, window.innerWidth - tooltipWidth - viewportPadding),
    );
    const top = clamp(
      rect.bottom + 8,
      viewportPadding,
      Math.max(viewportPadding, window.innerHeight - 112),
    );

    setTooltipPosition({ left, top });
  };
  const togglePinned = (element: HTMLElement) => {
    updateTooltipPosition(element);
    setIsPinned((currentValue) => !currentValue);
  };

  return (
    <span className="inline-flex">
      <button
        type="button"
        aria-label={`More information: ${label}`}
        aria-describedby={isOpen ? tooltipId : undefined}
        aria-expanded={isOpen}
        onClick={(event) => {
          if (handledPointerActivation.current) {
            handledPointerActivation.current = false;
            return;
          }

          event.preventDefault();
          togglePinned(event.currentTarget);
        }}
        onBlur={() => {
          setIsFocused(false);
          setIsPinned(false);
        }}
        onFocus={(event) => {
          updateTooltipPosition(event.currentTarget);
          setIsFocused(true);
        }}
        onMouseDown={(event) => {
          handledPointerActivation.current = true;
          togglePinned(event.currentTarget);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setIsPinned(false);
            setIsFocused(false);
            event.currentTarget.blur();
          }
        }}
        onPointerDown={(event) => {
          if (event.pointerType !== "mouse") {
            handledPointerActivation.current = true;
            togglePinned(event.currentTarget);
          }
        }}
        onPointerEnter={(event) => {
          updateTooltipPosition(event.currentTarget);
          setIsHovered(true);
        }}
        onPointerLeave={() => setIsHovered(false)}
        className="inline-flex size-5 items-center justify-center rounded-full border border-slate-300 bg-white font-[family:var(--font-space-grotesk)] text-xs font-semibold text-slate-500 shadow-sm hover:border-[#e63946] hover:text-[#e63946] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e63946]"
      >
        i
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        aria-hidden={!isOpen}
        style={{
          left: tooltipPosition.left,
          top: tooltipPosition.top,
        }}
        className={cn(
          "pointer-events-none invisible fixed z-50 w-64 rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-xs font-normal leading-5 text-slate-700 opacity-0 shadow-lg",
          isOpen && "visible opacity-100",
        )}
      >
        {label}
      </span>
    </span>
  );
}

function NumberSliderField({
  label,
  help,
  min,
  max,
  step,
  value,
  onChange,
  suffix = "",
  prefix = "",
  quickActions = [],
  className,
  headerClassName,
  sliderClassName,
}: NumberSliderFieldProps) {
  const fieldId = useId();
  const labelId = `${fieldId}-label`;
  const helpId = `${fieldId}-help`;
  const dragMaxRef = useRef<number | null>(null);
  const [dragMax, setDragMax] = useState<number | null>(null);
  const sliderMax = dragMax ?? max;
  const safeValue = clamp(value, min, max);
  const safeSliderValue = clamp(value, min, sliderMax);
  const inputValue =
    Number.isFinite(value) && (value < min || value > max) ? value : safeValue;
  const handleInputChange = (nextValue: number) => {
    if (!Number.isFinite(nextValue)) {
      onChange(0);
      return;
    }

    onChange(Math.max(nextValue, 0));
  };
  const handleSliderChange = (nextValue: number) => {
    if (dragMaxRef.current === null) {
      dragMaxRef.current = sliderMax;
      setDragMax(sliderMax);
    }

    const activeSliderMax = dragMaxRef.current;

    if (!Number.isFinite(nextValue)) {
      onChange(min);
      return;
    }

    onChange(clamp(nextValue, min, activeSliderMax));
  };
  const beginSliderDrag = () => {
    blurFocusedField();

    if (dragMaxRef.current !== null) {
      return;
    }

    dragMaxRef.current = sliderMax;
    setDragMax(sliderMax);
  };
  const endSliderDrag = () => {
    dragMaxRef.current = null;
    setDragMax(null);
  };

  return (
    <div className={cn("min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-3 shadow-sm", className)}>
      <div
        className={cn(
          "flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between",
          headerClassName,
        )}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p id={labelId} className="text-sm font-medium text-slate-900">
              {label}
            </p>
            <InfoIcon label={help} />
          </div>
          <span id={helpId} className="sr-only">
            {help}
          </span>
        </div>
        <div className="w-full min-w-0 shrink-0 sm:w-24">
          <div className="flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5">
            {prefix ? <span className="text-sm text-slate-500">{prefix}</span> : null}
            <input
              type="number"
              value={inputValue}
              min={min}
              max={max}
              step={step}
              aria-labelledby={labelId}
              aria-describedby={helpId}
              onKeyDown={(event) => handleNumberKeyDown(event, onChange)}
              onInput={(event) => handleInputChange(parseNumberInput(event.currentTarget.value))}
              onChange={(event) => handleInputChange(parseNumberInput(event.target.value))}
              className="w-full border-0 bg-transparent p-0 font-mono text-right text-sm font-medium text-slate-950 outline-none tabular-nums"
            />
            {suffix ? <span className="text-sm text-slate-500">{suffix}</span> : null}
          </div>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={sliderMax}
        step={step}
        value={safeSliderValue}
        aria-labelledby={labelId}
        aria-describedby={helpId}
        onBlur={endSliderDrag}
        onChange={(event) => handleSliderChange(Number(event.target.value))}
        onMouseDown={beginSliderDrag}
        onPointerCancel={endSliderDrag}
        onPointerDown={beginSliderDrag}
        onPointerUp={endSliderDrag}
        onTouchCancel={endSliderDrag}
        onTouchEnd={endSliderDrag}
        onTouchStart={beginSliderDrag}
        className={cn(
          "mt-3 h-2 w-full min-w-0 cursor-pointer appearance-none rounded-full bg-slate-200 accent-[#e63946]",
          sliderClassName,
        )}
      />
      <div className="mt-1.5 grid min-h-5 grid-cols-2 gap-2 font-mono text-[10px] leading-tight text-slate-500 tabular-nums sm:text-[11px]">
        <span className="truncate whitespace-nowrap">
          {prefix}
          {min}
          {suffix}
        </span>
        <span className="truncate whitespace-nowrap text-right">
          {prefix}
          {sliderMax}
          {suffix}
        </span>
      </div>
      {quickActions.length > 0 ? (
        <div className="mt-2 grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4">
          {quickActions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => onChange(clamp(action.value, 0, max))}
              className="min-w-0 truncate whitespace-nowrap rounded-md border border-slate-300 bg-white px-1.5 py-1.5 text-[11px] font-medium text-slate-700 shadow-sm hover:border-[#e63946] hover:text-[#e63946] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e63946]"
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PnlScenarioChart({
  title,
  subtitle,
  points,
  selectedPrice,
  selectedPnl,
  breakEvenPrice,
  spotPrice,
  priceMarkers,
  maxProfit,
  maxLoss,
  totalCost,
  showExpiryCurve,
  scenarioDateLabel,
}: PnlScenarioChartProps) {
  const profitClipId = useId();
  const lossClipId = useId();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverPrice, setHoverPrice] = useState<number | null>(null);

  const width = 820;
  const height = 360;
  const padding = { top: 28, right: 96, bottom: 58, left: 84 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  if (points.length < 2) {
    return null;
  }

  const allPrices = [selectedPrice, breakEvenPrice, spotPrice, ...points.map((p) => p.price)];
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices, minPrice + 1);

  const pnlValues = [
    selectedPnl,
    maxLoss,
    ...(maxProfit !== null ? [maxProfit] : []),
    ...points.flatMap((p) =>
      showExpiryCurve ? [p.selectedDatePnl, p.expiryPnl] : [p.selectedDatePnl],
    ),
  ];
  const rawMin = Math.min(...pnlValues);
  const rawMax = Math.max(...pnlValues);
  const span = Math.max(rawMax - rawMin, 1);
  const yMin = rawMin - span * 0.08;
  const yMax = rawMax + span * 0.08;

  const x = (price: number) =>
    padding.left +
    ((clamp(price, minPrice, maxPrice) - minPrice) /
      Math.max(maxPrice - minPrice, 1)) *
      chartWidth;
  const y = (value: number) =>
    padding.top +
    ((yMax - clamp(value, yMin, yMax)) / Math.max(yMax - yMin, 1)) * chartHeight;

  const niceTick = (raw: number) => {
    const abs = Math.abs(raw);
    if (abs >= 1000) {
      return Math.round(raw / 1000) * 1000;
    }
    if (abs >= 100) {
      return Math.round(raw / 100) * 100;
    }
    return Math.round(raw);
  };
  const yTickCandidates = [
    { value: 0, priority: 0 },
    { value: niceTick(rawMax), priority: 1 },
    { value: niceTick(rawMin), priority: 1 },
    { value: niceTick(yMin + (yMax - yMin) * 0.5), priority: 2 },
    { value: niceTick(yMin + (yMax - yMin) * 0.1), priority: 3 },
    { value: niceTick(yMin + (yMax - yMin) * 0.9), priority: 3 },
  ].filter((tick) => tick.value >= yMin && tick.value <= yMax);

  const selectedYTicks: number[] = [];
  const selectedYTickLabels = new Set<string>();
  const minYTickGap = 24;

  for (const candidate of yTickCandidates.sort((a, b) => a.priority - b.priority)) {
    const labelKey = `${formatCompactCurrency(candidate.value)}|${formatCompactCurrency(
      candidate.value + totalCost,
    )}`;
    const candidateY = y(candidate.value);
    const overlapsExistingTick = selectedYTicks.some(
      (tick) => Math.abs(y(tick) - candidateY) < minYTickGap,
    );

    if (selectedYTickLabels.has(labelKey) || overlapsExistingTick) {
      continue;
    }

    selectedYTicks.push(candidate.value);
    selectedYTickLabels.add(labelKey);
  }

  const yTickValues = selectedYTicks.sort((a, b) => a - b);

  const priceAxisTicks = buildStockPriceAxisTicks(minPrice, maxPrice, spotPrice);
  const strikeMarkers = priceMarkers
    .filter(
      (marker) =>
        marker.label !== "Spot" &&
        marker.value >= minPrice &&
        marker.value <= maxPrice,
    )
    .sort((a, b) => a.value - b.value);

  const buildPath = (key: "selectedDatePnl" | "expiryPnl") =>
    points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${x(point.price)} ${y(point[key])}`)
      .join(" ");

  const selectedPath = buildPath("selectedDatePnl");
  const expiryPath = buildPath("expiryPnl");

  const zeroY = y(0);

  const selectedX = x(selectedPrice);
  const selectedY = y(selectedPnl);
  const breakEvenX = x(breakEvenPrice);
  const spotX = x(spotPrice);
  const showSpotMarker = spotPrice >= minPrice && spotPrice <= maxPrice;
  const showBreakEvenMarker = breakEvenPrice >= minPrice && breakEvenPrice <= maxPrice;

  const profitColor = "#059669";
  const lossColor = "#be123c";
  const profitFill = "rgba(5, 150, 105, 0.08)";
  const lossFill = "rgba(190, 18, 60, 0.08)";

  const findNearestPoint = (price: number) => {
    let nearest = points[0];
    let nearestDistance = Math.abs(points[0].price - price);
    for (let index = 1; index < points.length; index += 1) {
      const distance = Math.abs(points[index].price - price);
      if (distance < nearestDistance) {
        nearest = points[index];
        nearestDistance = distance;
      }
    }
    return nearest;
  };
  const handleSvgPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0) return;
    const localX = ((event.clientX - rect.left) / rect.width) * width;
    if (localX < padding.left || localX > width - padding.right) {
      setHoverPrice(null);
      return;
    }
    const ratio = (localX - padding.left) / Math.max(chartWidth, 1);
    const price = minPrice + ratio * (maxPrice - minPrice);
    setHoverPrice(price);
  };
  const handlePointerLeave = () => setHoverPrice(null);

  const hoverPoint = hoverPrice !== null ? findNearestPoint(hoverPrice) : null;
  const hoverX = hoverPoint ? x(hoverPoint.price) : 0;
  const hoverSelectedY = hoverPoint ? y(hoverPoint.selectedDatePnl) : 0;
  const hoverExpiryY = hoverPoint ? y(hoverPoint.expiryPnl) : 0;
  const hoverValue = hoverPoint ? hoverPoint.selectedDatePnl + totalCost : 0;
  const hoverExpiryValue = hoverPoint ? hoverPoint.expiryPnl + totalCost : 0;
  const tooltipWidth = 168;
  const tooltipHeight = showExpiryCurve ? 102 : 78;
  const tooltipPadding = 12;
  const tooltipX =
    hoverPoint && hoverX + tooltipPadding + tooltipWidth > width - padding.right
      ? hoverX - tooltipPadding - tooltipWidth
      : hoverX + tooltipPadding;
  const tooltipY = padding.top + 4;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
          <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-x-4 gap-y-1.5 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-slate-700" />
            On {scenarioDateLabel}
          </span>
          {showExpiryCurve ? (
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-0.5 w-4 rounded-full"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, #64748b 50%, transparent 50%)",
                  backgroundSize: "6px 2px",
                }}
              />
              At expiry
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[#e63946]" />
            Selected
            <span
              className={cn(
                "font-mono font-semibold tabular-nums",
                selectedPnl >= 0 ? "text-emerald-700" : "text-rose-700",
              )}
            >
              {selectedPnl >= 0 ? "+" : ""}
              {formatCompactCurrency(selectedPnl)}
            </span>
            <span className="font-mono text-slate-500 tabular-nums">
              ({formatCompactCurrency(selectedPnl + totalCost)} value)
            </span>
          </span>
          {showBreakEvenMarker ? (
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-0.5 w-4 rounded-full"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, #0f172a 50%, transparent 50%)",
                  backgroundSize: "4px 2px",
                }}
              />
              B/E
              <span className="font-mono text-slate-500 tabular-nums">
                {formatCurrency(breakEvenPrice)}
              </span>
            </span>
          ) : null}
        </div>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label={`${title}: ${subtitle}`}
        onPointerMove={handleSvgPointerMove}
        onPointerLeave={handlePointerLeave}
      >
        <defs>
          <clipPath id={profitClipId}>
            <rect
              x={padding.left}
              y={padding.top}
              width={chartWidth}
              height={Math.max(zeroY - padding.top, 0)}
            />
          </clipPath>
          <clipPath id={lossClipId}>
            <rect
              x={padding.left}
              y={zeroY}
              width={chartWidth}
              height={Math.max(height - padding.bottom - zeroY, 0)}
            />
          </clipPath>
        </defs>

        <rect
          x={padding.left}
          y={padding.top}
          width={chartWidth}
          height={chartHeight}
          fill={CHART_COLORS.paper}
        />

        <rect
          x={padding.left}
          y={padding.top}
          width={chartWidth}
          height={Math.max(zeroY - padding.top, 0)}
          fill={profitFill}
        />
        <rect
          x={padding.left}
          y={zeroY}
          width={chartWidth}
          height={Math.max(height - padding.bottom - zeroY, 0)}
          fill={lossFill}
        />

        {yTickValues.map((tick, index) => (
          <g key={`pnl-y-${tick}-${index}`}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke={tick === 0 ? CHART_COLORS.inkMuted : CHART_COLORS.line}
              strokeWidth={tick === 0 ? 1.25 : 1}
            />
            <text
              x={padding.left - 10}
              y={y(tick) + 4}
              textAnchor="end"
              fill={tick === 0 ? CHART_COLORS.ink : CHART_COLORS.inkMuted}
              className="font-mono text-[11px]"
            >
              {tick > 0 ? "+" : ""}
              {formatCompactCurrency(tick)}
            </text>
            <text
              x={width - padding.right + 10}
              y={y(tick) + 4}
              textAnchor="start"
              fill={CHART_COLORS.inkMuted}
              className="font-mono text-[11px]"
            >
              {formatCompactCurrency(tick + totalCost)}
            </text>
          </g>
        ))}
        <text
          x={padding.left - 10}
          y={padding.top - 12}
          textAnchor="end"
          fill={CHART_COLORS.inkMuted}
          className="text-[10px] font-semibold uppercase tracking-wide"
        >
          P/L
        </text>
        <text
          x={width - padding.right + 10}
          y={padding.top - 12}
          textAnchor="start"
          fill={CHART_COLORS.inkMuted}
          className="text-[10px] font-semibold uppercase tracking-wide"
        >
          Value
        </text>

        {priceAxisTicks.map((tick) => (
          <g key={`pnl-price-axis-${tick}`}>
            <line
              x1={x(tick)}
              x2={x(tick)}
              y1={padding.top}
              y2={height - padding.bottom}
              stroke={CHART_COLORS.grid}
              strokeWidth={1}
            />
            <text
              x={x(tick)}
              y={height - padding.bottom + 18}
              textAnchor="middle"
              fill={CHART_COLORS.inkMuted}
              className="font-mono text-[11px]"
            >
              {formatCurrency(tick)}
            </text>
          </g>
        ))}

        {showExpiryCurve ? (
          <>
            <path
              d={expiryPath}
              fill="none"
              stroke={profitColor}
              strokeWidth={2}
              strokeDasharray="6 5"
              strokeLinecap="round"
              strokeLinejoin="round"
              clipPath={`url(#${profitClipId})`}
            />
            <path
              d={expiryPath}
              fill="none"
              stroke={lossColor}
              strokeWidth={2}
              strokeDasharray="6 5"
              strokeLinecap="round"
              strokeLinejoin="round"
              clipPath={`url(#${lossClipId})`}
            />
          </>
        ) : null}

        <path
          d={selectedPath}
          fill="none"
          stroke={profitColor}
          strokeWidth={2.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          clipPath={`url(#${profitClipId})`}
        />
        <path
          d={selectedPath}
          fill="none"
          stroke={lossColor}
          strokeWidth={2.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          clipPath={`url(#${lossClipId})`}
        />

        {showSpotMarker ? (
          <g>
            <line
              x1={spotX}
              x2={spotX}
              y1={padding.top}
              y2={height - padding.bottom}
              stroke={CHART_COLORS.inkMuted}
              strokeOpacity={0.55}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <text
              x={spotX}
              y={padding.top - 8}
              textAnchor="middle"
              fill={CHART_COLORS.inkMuted}
              className="font-mono text-[10px]"
            >
              Spot {formatCurrency(spotPrice)}
            </text>
          </g>
        ) : null}

        {strikeMarkers.map((marker, index) => (
          <g key={`pnl-strike-${marker.label}-${index}`}>
            <line
              x1={x(marker.value)}
              x2={x(marker.value)}
              y1={padding.top}
              y2={height - padding.bottom}
              stroke={CHART_COLORS.inkMuted}
              strokeOpacity={0.35}
              strokeWidth={1}
              strokeDasharray="2 4"
            />
            <text
              x={x(marker.value)}
              y={padding.top - (index % 2 === 0 ? 8 : 20)}
              textAnchor="middle"
              fill={CHART_COLORS.inkMuted}
              className="font-mono text-[10px]"
            >
              {marker.label} {formatCurrency(marker.value)}
            </text>
          </g>
        ))}

        {showBreakEvenMarker ? (
          <g>
            <line
              x1={breakEvenX}
              x2={breakEvenX}
              y1={padding.top}
              y2={height - padding.bottom}
              stroke={CHART_COLORS.ink}
              strokeOpacity={0.45}
              strokeWidth={1}
              strokeDasharray="2 4"
            />
          </g>
        ) : null}

        <line
          x1={selectedX}
          x2={selectedX}
          y1={padding.top}
          y2={height - padding.bottom}
          stroke={CHART_COLORS.accent}
          strokeDasharray="4 4"
          strokeWidth={1.5}
        />
        <circle
          cx={selectedX}
          cy={selectedY}
          r={5.5}
          fill={CHART_COLORS.accent}
          stroke={CHART_COLORS.paper}
          strokeWidth={2}
        />

        <text
          x={padding.left + chartWidth / 2}
          y={height - 10}
          textAnchor="middle"
          fill={CHART_COLORS.inkMuted}
          className="text-[11px] font-medium"
        >
          Underlying price
        </text>

        {hoverPoint ? (
          <g pointerEvents="none">
            <line
              x1={hoverX}
              x2={hoverX}
              y1={padding.top}
              y2={height - padding.bottom}
              stroke={CHART_COLORS.ink}
              strokeOpacity={0.5}
              strokeWidth={1}
            />
            <circle
              cx={hoverX}
              cy={hoverSelectedY}
              r={4}
              fill={CHART_COLORS.paper}
              stroke={hoverPoint.selectedDatePnl >= 0 ? profitColor : lossColor}
              strokeWidth={2}
            />
            {showExpiryCurve ? (
              <circle
                cx={hoverX}
                cy={hoverExpiryY}
                r={3}
                fill={CHART_COLORS.paper}
                stroke={hoverPoint.expiryPnl >= 0 ? profitColor : lossColor}
                strokeWidth={1.5}
              />
            ) : null}
            <rect
              x={tooltipX}
              y={tooltipY}
              width={tooltipWidth}
              height={tooltipHeight}
              rx={6}
              fill={CHART_COLORS.paper}
              stroke={CHART_COLORS.line}
              strokeWidth={1}
            />
            <text
              x={tooltipX + 10}
              y={tooltipY + 18}
              fill={CHART_COLORS.ink}
              className="font-mono text-[11px] font-semibold"
            >
              {formatCurrency(hoverPoint.price)}
            </text>
            <text
              x={tooltipX + 10}
              y={tooltipY + 36}
              fill={CHART_COLORS.inkMuted}
              className="text-[10px] font-semibold uppercase tracking-wide"
            >
              {scenarioDateLabel}
            </text>
            <text
              x={tooltipX + 10}
              y={tooltipY + 52}
              fill={CHART_COLORS.ink}
              className="font-mono text-[11px]"
            >
              <tspan>Value </tspan>
              <tspan className="font-semibold">{formatCurrency(hoverValue)}</tspan>
            </text>
            <text
              x={tooltipX + 10}
              y={tooltipY + 66}
              fill={hoverPoint.selectedDatePnl >= 0 ? profitColor : lossColor}
              className="font-mono text-[11px] font-semibold"
            >
              {hoverPoint.selectedDatePnl >= 0 ? "+" : ""}
              {formatCurrency(hoverPoint.selectedDatePnl)}{" "}
              <tspan fill={CHART_COLORS.inkMuted} className="font-normal">
                P/L
              </tspan>
            </text>
            {showExpiryCurve ? (
              <text
                x={tooltipX + 10}
                y={tooltipY + 86}
                fill={CHART_COLORS.inkMuted}
                className="font-mono text-[10px]"
              >
                <tspan>At expiry </tspan>
                <tspan
                  fill={hoverPoint.expiryPnl >= 0 ? profitColor : lossColor}
                  className="font-semibold"
                >
                  {hoverPoint.expiryPnl >= 0 ? "+" : ""}
                  {formatCompactCurrency(hoverPoint.expiryPnl)}
                </tspan>
                <tspan> · {formatCompactCurrency(hoverExpiryValue)}</tspan>
              </text>
            ) : null}
          </g>
        ) : null}
      </svg>
    </div>
  );
}

function TimeDecayChart({
  title,
  subtitle,
  points,
  expirationDays,
  selectedOffsetDays,
  selectedPositionValue,
  selectedPnl,
  totalCost,
  scenarioPriceLabel,
}: TimeDecayChartProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverOffset, setHoverOffset] = useState<number | null>(null);

  const width = 820;
  const height = 340;
  const padding = { top: 28, right: 96, bottom: 58, left: 84 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  if (points.length < 2 || expirationDays <= 0) {
    return null;
  }

  const minOffset = 0;
  const maxOffset = expirationDays;
  const valueValues = points.map((p) => p.positionValue);
  const pnlValuesAll = points.map((p) => p.pnl);
  const valueMax = Math.max(...valueValues, selectedPositionValue, totalCost);
  const valueMin = Math.min(...valueValues, 0);
  const valueSpan = Math.max(valueMax - valueMin, 1);
  const yMin = valueMin - valueSpan * 0.06;
  const yMax = valueMax + valueSpan * 0.08;

  const x = (offset: number) =>
    padding.left +
    ((clamp(offset, minOffset, maxOffset) - minOffset) /
      Math.max(maxOffset - minOffset, 1)) *
      chartWidth;
  const y = (value: number) =>
    padding.top +
    ((yMax - clamp(value, yMin, yMax)) / Math.max(yMax - yMin, 1)) * chartHeight;

  const niceTick = (raw: number) => {
    const abs = Math.abs(raw);
    if (abs >= 1000) return Math.round(raw / 1000) * 1000;
    if (abs >= 100) return Math.round(raw / 100) * 100;
    return Math.round(raw);
  };
  const yTickValues = Array.from(new Set([
    niceTick(yMin + (yMax - yMin) * 0.1),
    niceTick(valueMin),
    niceTick(totalCost),
    niceTick(valueMax),
    niceTick(yMin + (yMax - yMin) * 0.9),
  ].filter((tick) => tick >= yMin && tick <= yMax)));
  yTickValues.sort((a, b) => a - b);

  const dteTicks = Array.from(
    new Set([0, Math.round(maxOffset * 0.25), Math.round(maxOffset * 0.5), Math.round(maxOffset * 0.75), maxOffset]),
  ).sort((a, b) => a - b);

  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${x(point.offsetDays)} ${y(point.positionValue)}`)
    .join(" ");
  const costLineY = y(totalCost);

  const findNearest = (offset: number) => {
    let nearest = points[0];
    let nearestDistance = Math.abs(points[0].offsetDays - offset);
    for (let index = 1; index < points.length; index += 1) {
      const distance = Math.abs(points[index].offsetDays - offset);
      if (distance < nearestDistance) {
        nearest = points[index];
        nearestDistance = distance;
      }
    }
    return nearest;
  };
  const handleMove = (event: PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0) return;
    const localX = ((event.clientX - rect.left) / rect.width) * width;
    if (localX < padding.left || localX > width - padding.right) {
      setHoverOffset(null);
      return;
    }
    const ratio = (localX - padding.left) / Math.max(chartWidth, 1);
    const offset = minOffset + ratio * (maxOffset - minOffset);
    setHoverOffset(offset);
  };
  const handleLeave = () => setHoverOffset(null);

  const hoverPoint = hoverOffset !== null ? findNearest(hoverOffset) : null;
  const hoverX = hoverPoint ? x(hoverPoint.offsetDays) : 0;
  const hoverY = hoverPoint ? y(hoverPoint.positionValue) : 0;
  const tooltipWidth = 168;
  const tooltipHeight = 88;
  const tooltipPadding = 12;
  const tooltipX =
    hoverPoint && hoverX + tooltipPadding + tooltipWidth > width - padding.right
      ? hoverX - tooltipPadding - tooltipWidth
      : hoverX + tooltipPadding;
  const tooltipY = padding.top + 4;

  const selectedX = x(selectedOffsetDays);
  const selectedY = y(selectedPositionValue);
  const profitColor = "#059669";
  const lossColor = "#be123c";

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
          <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-x-4 gap-y-1.5 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-slate-700" />
            Stock at {scenarioPriceLabel}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-0.5 w-4 rounded-full"
              style={{
                backgroundImage:
                  "linear-gradient(to right, #94a3b8 50%, transparent 50%)",
                backgroundSize: "6px 2px",
              }}
            />
            Cost basis
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[#e63946]" />
            Selected
            <span
              className={cn(
                "font-mono font-semibold tabular-nums",
                selectedPnl >= 0 ? "text-emerald-700" : "text-rose-700",
              )}
            >
              {formatCompactCurrency(selectedPositionValue)}
            </span>
          </span>
        </div>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label={`${title}: ${subtitle}`}
        onPointerMove={handleMove}
        onPointerLeave={handleLeave}
      >
        <rect
          x={padding.left}
          y={padding.top}
          width={chartWidth}
          height={chartHeight}
          fill={CHART_COLORS.paper}
        />

        {yTickValues.map((tick) => (
          <g key={`decay-y-${tick}`}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke={CHART_COLORS.line}
              strokeWidth={1}
            />
            <text
              x={padding.left - 10}
              y={y(tick) + 4}
              textAnchor="end"
              fill={CHART_COLORS.inkMuted}
              className="font-mono text-[11px]"
            >
              {formatCompactCurrency(tick)}
            </text>
            <text
              x={width - padding.right + 10}
              y={y(tick) + 4}
              textAnchor="start"
              fill={CHART_COLORS.inkMuted}
              className="font-mono text-[11px]"
            >
              {(tick - totalCost) >= 0 ? "+" : ""}
              {formatCompactCurrency(tick - totalCost)}
            </text>
          </g>
        ))}
        <text
          x={padding.left - 10}
          y={padding.top - 12}
          textAnchor="end"
          fill={CHART_COLORS.inkMuted}
          className="text-[10px] font-semibold uppercase tracking-wide"
        >
          Value
        </text>
        <text
          x={width - padding.right + 10}
          y={padding.top - 12}
          textAnchor="start"
          fill={CHART_COLORS.inkMuted}
          className="text-[10px] font-semibold uppercase tracking-wide"
        >
          P/L
        </text>

        {dteTicks.map((tick) => (
          <g key={`decay-dte-${tick}`}>
            <line
              x1={x(tick)}
              x2={x(tick)}
              y1={padding.top}
              y2={height - padding.bottom}
              stroke={CHART_COLORS.grid}
              strokeWidth={1}
            />
            <text
              x={x(tick)}
              y={height - padding.bottom + 20}
              textAnchor="middle"
              fill={CHART_COLORS.inkMuted}
              className="font-mono text-[11px]"
            >
              {tick === 0 ? "Today" : tick === maxOffset ? "Expiry" : `+${tick}d`}
            </text>
          </g>
        ))}

        <line
          x1={padding.left}
          x2={width - padding.right}
          y1={costLineY}
          y2={costLineY}
          stroke={CHART_COLORS.inkMuted}
          strokeOpacity={0.6}
          strokeDasharray="4 4"
          strokeWidth={1}
        />
        <text
          x={width - padding.right - 4}
          y={costLineY - 4}
          textAnchor="end"
          fill={CHART_COLORS.inkMuted}
          className="font-mono text-[10px]"
        >
          Cost {formatCompactCurrency(totalCost)}
        </text>

        <path
          d={path}
          fill="none"
          stroke={selectedPnl >= 0 ? profitColor : lossColor}
          strokeWidth={2.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <line
          x1={selectedX}
          x2={selectedX}
          y1={padding.top}
          y2={height - padding.bottom}
          stroke={CHART_COLORS.accent}
          strokeDasharray="4 4"
          strokeWidth={1.5}
        />
        <circle
          cx={selectedX}
          cy={selectedY}
          r={5.5}
          fill={CHART_COLORS.accent}
          stroke={CHART_COLORS.paper}
          strokeWidth={2}
        />

        <text
          x={padding.left + chartWidth / 2}
          y={height - 10}
          textAnchor="middle"
          fill={CHART_COLORS.inkMuted}
          className="text-[11px] font-medium"
        >
          Days from today
        </text>

        {hoverPoint ? (
          <g pointerEvents="none">
            <line
              x1={hoverX}
              x2={hoverX}
              y1={padding.top}
              y2={height - padding.bottom}
              stroke={CHART_COLORS.ink}
              strokeOpacity={0.5}
              strokeWidth={1}
            />
            <circle
              cx={hoverX}
              cy={hoverY}
              r={4}
              fill={CHART_COLORS.paper}
              stroke={hoverPoint.pnl >= 0 ? profitColor : lossColor}
              strokeWidth={2}
            />
            <rect
              x={tooltipX}
              y={tooltipY}
              width={tooltipWidth}
              height={tooltipHeight}
              rx={6}
              fill={CHART_COLORS.paper}
              stroke={CHART_COLORS.line}
              strokeWidth={1}
            />
            <text
              x={tooltipX + 10}
              y={tooltipY + 18}
              fill={CHART_COLORS.ink}
              className="font-mono text-[11px] font-semibold"
            >
              {formatLongDate(hoverPoint.dateIso)}
            </text>
            <text
              x={tooltipX + 10}
              y={tooltipY + 36}
              fill={CHART_COLORS.inkMuted}
              className="text-[10px] font-semibold uppercase tracking-wide"
            >
              {hoverPoint.offsetDays === 0
                ? "Today"
                : hoverPoint.offsetDays === maxOffset
                  ? "At expiry"
                  : `+${hoverPoint.offsetDays} days`}
            </text>
            <text
              x={tooltipX + 10}
              y={tooltipY + 54}
              fill={CHART_COLORS.ink}
              className="font-mono text-[11px]"
            >
              <tspan>Value </tspan>
              <tspan className="font-semibold">{formatCurrency(hoverPoint.positionValue)}</tspan>
            </text>
            <text
              x={tooltipX + 10}
              y={tooltipY + 72}
              fill={hoverPoint.pnl >= 0 ? profitColor : lossColor}
              className="font-mono text-[11px] font-semibold"
            >
              {hoverPoint.pnl >= 0 ? "+" : ""}
              {formatCurrency(hoverPoint.pnl)}{" "}
              <tspan fill={CHART_COLORS.inkMuted} className="font-normal">
                P/L
              </tspan>
            </text>
          </g>
        ) : null}
      </svg>
    </div>
  );
}

function MultiDateOverlayChart({
  title,
  subtitle,
  curves,
  selectedPrice,
  selectedOffsetDays,
  breakEvenPrice,
  spotPrice,
  priceMarkers,
  totalCost,
}: MultiDateOverlayChartProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverPrice, setHoverPrice] = useState<number | null>(null);
  const profitClipId = useId();
  const lossClipId = useId();

  const width = 820;
  const height = 360;
  const padding = { top: 28, right: 96, bottom: 58, left: 84 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  if (curves.length === 0 || curves[0].points.length < 2) {
    return null;
  }

  const allPrices = [
    selectedPrice,
    breakEvenPrice,
    spotPrice,
    ...curves.flatMap((curve) => curve.points.map((p) => p.price)),
  ];
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices, minPrice + 1);

  const allPnls = curves.flatMap((curve) => curve.points.map((p) => p.pnl));
  const rawMin = Math.min(...allPnls);
  const rawMax = Math.max(...allPnls);
  const span = Math.max(rawMax - rawMin, 1);
  const yMin = rawMin - span * 0.08;
  const yMax = rawMax + span * 0.08;

  const x = (price: number) =>
    padding.left +
    ((clamp(price, minPrice, maxPrice) - minPrice) /
      Math.max(maxPrice - minPrice, 1)) *
      chartWidth;
  const y = (value: number) =>
    padding.top +
    ((yMax - clamp(value, yMin, yMax)) / Math.max(yMax - yMin, 1)) * chartHeight;

  const niceTick = (raw: number) => {
    const abs = Math.abs(raw);
    if (abs >= 1000) return Math.round(raw / 1000) * 1000;
    if (abs >= 100) return Math.round(raw / 100) * 100;
    return Math.round(raw);
  };
  const yTickValues = Array.from(new Set([
    niceTick(yMin + (yMax - yMin) * 0.1),
    niceTick(rawMin),
    0,
    niceTick(rawMax),
    niceTick(yMin + (yMax - yMin) * 0.9),
  ].filter((tick) => tick >= yMin && tick <= yMax)));
  yTickValues.sort((a, b) => a - b);

  const priceAxisTicks = buildStockPriceAxisTicks(minPrice, maxPrice, spotPrice);
  const strikeMarkers = priceMarkers
    .filter(
      (marker) =>
        marker.label !== "Spot" &&
        marker.value >= minPrice &&
        marker.value <= maxPrice,
    )
    .sort((a, b) => a.value - b.value);

  const zeroY = y(0);

  const curveColors = ["#0f172a", "#475569", "#94a3b8", "#cbd5e1", "#059669"];
  const colorFor = (index: number, isExpiry: boolean) =>
    isExpiry ? "#059669" : curveColors[Math.min(index, curveColors.length - 2)];

  const buildCurvePath = (curvePoints: OverlayCurve["points"]) =>
    curvePoints
      .map((point, index) => `${index === 0 ? "M" : "L"} ${x(point.price)} ${y(point.pnl)}`)
      .join(" ");

  const findNearest = (curve: OverlayCurve, price: number) => {
    let nearest = curve.points[0];
    let nearestDistance = Math.abs(curve.points[0].price - price);
    for (let index = 1; index < curve.points.length; index += 1) {
      const distance = Math.abs(curve.points[index].price - price);
      if (distance < nearestDistance) {
        nearest = curve.points[index];
        nearestDistance = distance;
      }
    }
    return nearest;
  };
  const handleMove = (event: PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0) return;
    const localX = ((event.clientX - rect.left) / rect.width) * width;
    if (localX < padding.left || localX > width - padding.right) {
      setHoverPrice(null);
      return;
    }
    const ratio = (localX - padding.left) / Math.max(chartWidth, 1);
    setHoverPrice(minPrice + ratio * (maxPrice - minPrice));
  };
  const handleLeave = () => setHoverPrice(null);

  const hoverX = hoverPrice !== null ? x(hoverPrice) : 0;
  const hoverPriceValue = hoverPrice !== null ? curves[0].points.length > 0 ? findNearest(curves[0], hoverPrice).price : 0 : 0;
  const tooltipWidth = 198;
  const tooltipLineHeight = 14;
  const tooltipHeaderHeight = 36;
  const tooltipHeight = hoverPrice !== null
    ? tooltipHeaderHeight + curves.length * tooltipLineHeight + 8
    : 0;
  const tooltipX =
    hoverPrice !== null && hoverX + 12 + tooltipWidth > width - padding.right
      ? hoverX - 12 - tooltipWidth
      : hoverX + 12;
  const tooltipY = padding.top + 4;

  const breakEvenX = x(breakEvenPrice);
  const spotX = x(spotPrice);
  const selectedX = x(selectedPrice);
  const showBreakEvenMarker = breakEvenPrice >= minPrice && breakEvenPrice <= maxPrice;
  const showSpotMarker = spotPrice >= minPrice && spotPrice <= maxPrice;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
          <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-x-3 gap-y-1.5 text-xs text-slate-600">
          {curves.map((curve, index) => (
            <span key={curve.id} className="inline-flex items-center gap-1.5">
              <span
                className="h-0.5 w-4 rounded-full"
                style={{ backgroundColor: colorFor(index, curve.isExpiry) }}
              />
              {curve.label}
            </span>
          ))}
          {showBreakEvenMarker ? (
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-0.5 w-4 rounded-full"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, #0f172a 50%, transparent 50%)",
                  backgroundSize: "4px 2px",
                }}
              />
              B/E
              <span className="font-mono text-slate-500 tabular-nums">
                {formatCurrency(breakEvenPrice)}
              </span>
            </span>
          ) : null}
        </div>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label={`${title}: ${subtitle}`}
        onPointerMove={handleMove}
        onPointerLeave={handleLeave}
      >
        <defs>
          <clipPath id={profitClipId}>
            <rect
              x={padding.left}
              y={padding.top}
              width={chartWidth}
              height={Math.max(zeroY - padding.top, 0)}
            />
          </clipPath>
          <clipPath id={lossClipId}>
            <rect
              x={padding.left}
              y={zeroY}
              width={chartWidth}
              height={Math.max(height - padding.bottom - zeroY, 0)}
            />
          </clipPath>
        </defs>

        <rect
          x={padding.left}
          y={padding.top}
          width={chartWidth}
          height={chartHeight}
          fill={CHART_COLORS.paper}
        />
        <rect
          x={padding.left}
          y={padding.top}
          width={chartWidth}
          height={Math.max(zeroY - padding.top, 0)}
          fill="rgba(5, 150, 105, 0.06)"
        />
        <rect
          x={padding.left}
          y={zeroY}
          width={chartWidth}
          height={Math.max(height - padding.bottom - zeroY, 0)}
          fill="rgba(190, 18, 60, 0.06)"
        />

        {yTickValues.map((tick) => (
          <g key={`overlay-y-${tick}`}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke={tick === 0 ? CHART_COLORS.inkMuted : CHART_COLORS.line}
              strokeWidth={tick === 0 ? 1.25 : 1}
            />
            <text
              x={padding.left - 10}
              y={y(tick) + 4}
              textAnchor="end"
              fill={tick === 0 ? CHART_COLORS.ink : CHART_COLORS.inkMuted}
              className="font-mono text-[11px]"
            >
              {tick > 0 ? "+" : ""}
              {formatCompactCurrency(tick)}
            </text>
            <text
              x={width - padding.right + 10}
              y={y(tick) + 4}
              textAnchor="start"
              fill={CHART_COLORS.inkMuted}
              className="font-mono text-[11px]"
            >
              {formatCompactCurrency(tick + totalCost)}
            </text>
          </g>
        ))}
        <text
          x={padding.left - 10}
          y={padding.top - 12}
          textAnchor="end"
          fill={CHART_COLORS.inkMuted}
          className="text-[10px] font-semibold uppercase tracking-wide"
        >
          P/L
        </text>
        <text
          x={width - padding.right + 10}
          y={padding.top - 12}
          textAnchor="start"
          fill={CHART_COLORS.inkMuted}
          className="text-[10px] font-semibold uppercase tracking-wide"
        >
          Value
        </text>

        {priceAxisTicks.map((tick) => (
          <g key={`overlay-price-axis-${tick}`}>
            <line
              x1={x(tick)}
              x2={x(tick)}
              y1={padding.top}
              y2={height - padding.bottom}
              stroke={CHART_COLORS.grid}
              strokeWidth={1}
            />
            <text
              x={x(tick)}
              y={height - padding.bottom + 18}
              textAnchor="middle"
              fill={CHART_COLORS.inkMuted}
              className="font-mono text-[11px]"
            >
              {formatCurrency(tick)}
            </text>
          </g>
        ))}

        {curves.map((curve, index) => (
          <g key={curve.id}>
            <path
              d={buildCurvePath(curve.points)}
              fill="none"
              stroke={colorFor(index, curve.isExpiry)}
              strokeWidth={curve.isExpiry ? 2 : 2.25}
              strokeDasharray={curve.isExpiry ? "6 5" : undefined}
              strokeOpacity={curve.offsetDays === selectedOffsetDays ? 1 : 0.85}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        ))}

        {showSpotMarker ? (
          <g>
            <line
              x1={spotX}
              x2={spotX}
              y1={padding.top}
              y2={height - padding.bottom}
              stroke={CHART_COLORS.inkMuted}
              strokeOpacity={0.5}
              strokeDasharray="3 3"
              strokeWidth={1}
            />
            <text
              x={spotX}
              y={padding.top - 8}
              textAnchor="middle"
              fill={CHART_COLORS.inkMuted}
              className="font-mono text-[10px]"
            >
              Spot {formatCurrency(spotPrice)}
            </text>
          </g>
        ) : null}
        {strikeMarkers.map((marker, index) => (
          <g key={`overlay-strike-${marker.label}-${index}`}>
            <line
              x1={x(marker.value)}
              x2={x(marker.value)}
              y1={padding.top}
              y2={height - padding.bottom}
              stroke={CHART_COLORS.inkMuted}
              strokeOpacity={0.35}
              strokeDasharray="2 4"
              strokeWidth={1}
            />
            <text
              x={x(marker.value)}
              y={padding.top - (index % 2 === 0 ? 8 : 20)}
              textAnchor="middle"
              fill={CHART_COLORS.inkMuted}
              className="font-mono text-[10px]"
            >
              {marker.label} {formatCurrency(marker.value)}
            </text>
          </g>
        ))}
        {showBreakEvenMarker ? (
          <g>
            <line
              x1={breakEvenX}
              x2={breakEvenX}
              y1={padding.top}
              y2={height - padding.bottom}
              stroke={CHART_COLORS.ink}
              strokeOpacity={0.45}
              strokeDasharray="2 4"
              strokeWidth={1}
            />
          </g>
        ) : null}

        <line
          x1={selectedX}
          x2={selectedX}
          y1={padding.top}
          y2={height - padding.bottom}
          stroke={CHART_COLORS.accent}
          strokeDasharray="4 4"
          strokeWidth={1.5}
        />

        <text
          x={padding.left + chartWidth / 2}
          y={height - 10}
          textAnchor="middle"
          fill={CHART_COLORS.inkMuted}
          className="text-[11px] font-medium"
        >
          Underlying price
        </text>

        {hoverPrice !== null ? (
          <g pointerEvents="none">
            <line
              x1={hoverX}
              x2={hoverX}
              y1={padding.top}
              y2={height - padding.bottom}
              stroke={CHART_COLORS.ink}
              strokeOpacity={0.5}
              strokeWidth={1}
            />
            {curves.map((curve, index) => {
              const point = findNearest(curve, hoverPrice);
              return (
                <circle
                  key={`overlay-hover-${curve.id}`}
                  cx={hoverX}
                  cy={y(point.pnl)}
                  r={3.5}
                  fill={CHART_COLORS.paper}
                  stroke={colorFor(index, curve.isExpiry)}
                  strokeWidth={2}
                />
              );
            })}
            <rect
              x={tooltipX}
              y={tooltipY}
              width={tooltipWidth}
              height={tooltipHeight}
              rx={6}
              fill={CHART_COLORS.paper}
              stroke={CHART_COLORS.line}
              strokeWidth={1}
            />
            <text
              x={tooltipX + 10}
              y={tooltipY + 18}
              fill={CHART_COLORS.ink}
              className="font-mono text-[11px] font-semibold"
            >
              {formatCurrency(hoverPriceValue)}
            </text>
            {curves.map((curve, index) => {
              const point = findNearest(curve, hoverPrice);
              const lineY = tooltipY + tooltipHeaderHeight + index * tooltipLineHeight + 2;
              const value = point.pnl + totalCost;
              return (
                <g key={`overlay-tip-${curve.id}`}>
                  <rect
                    x={tooltipX + 10}
                    y={lineY - 8}
                    width={8}
                    height={2}
                    fill={colorFor(index, curve.isExpiry)}
                  />
                  <text
                    x={tooltipX + 24}
                    y={lineY}
                    fill={CHART_COLORS.ink}
                    className="font-mono text-[10px]"
                  >
                    <tspan>{curve.label} </tspan>
                    <tspan
                      fill={point.pnl >= 0 ? "#059669" : "#be123c"}
                      className="font-semibold"
                    >
                      {point.pnl >= 0 ? "+" : ""}
                      {formatCompactCurrency(point.pnl)}
                    </tspan>
                    <tspan fill={CHART_COLORS.inkMuted}>
                      {" · "}
                      {formatCompactCurrency(value)}
                    </tspan>
                  </text>
                </g>
              );
            })}
          </g>
        ) : null}
      </svg>
    </div>
  );
}

function ScenarioValueMap({
  unitName: _unitName,
  minPrice,
  maxPrice,
  selectedPrice,
  selectedOffsetDays,
  selectedValue,
  selectedPnl,
  selectedRoi,
  currentSpot,
  expirationDays,
  todayIso,
  scenarioDateLabel,
  breakEvenPrice,
  totalCost,
  maxProfit,
  getScenarioTooltipPoint,
}: ScenarioValueMapProps) {
  const [hoverPoint, setHoverPoint] = useState<{
    price: number;
    offsetDays: number;
    dateLabel: string;
    positionValue: number;
    pnl: number;
    roi: number;
  } | null>(null);

  const width = 820;
  const height = 390;
  const padding = { top: 26, right: 28, bottom: 58, left: 92 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const columnCount = Math.min(Math.max(expirationDays + 1, 2), 42);
  const rowCount = 34;
  const cellWidth = chartWidth / columnCount;
  const cellHeight = chartHeight / rowCount;
  const toChartCoordinate = (value: number) => roundTo(value, 3);

  const x = (offsetDays: number) =>
    toChartCoordinate(
      padding.left +
        (clamp(offsetDays, 0, expirationDays) / Math.max(expirationDays, 1)) *
          chartWidth,
    );
  const y = (price: number) =>
    toChartCoordinate(
      padding.top +
        ((maxPrice - clamp(price, minPrice, maxPrice)) /
          Math.max(maxPrice - minPrice, 1)) *
          chartHeight,
    );

  const cells = useMemo(
    () =>
      Array.from({ length: rowCount }, (_, rowIndex) => {
        const price = Math.round(
          maxPrice -
            ((maxPrice - minPrice) * rowIndex) / Math.max(rowCount - 1, 1),
        );

        return Array.from({ length: columnCount }, (_, columnIndex) => {
          const offsetDays = Math.round(
            (expirationDays * columnIndex) / Math.max(columnCount - 1, 1),
          );
          const point = getScenarioTooltipPoint(price, offsetDays);

          return {
            ...point,
            price,
            offsetDays,
            rowIndex,
            columnIndex,
            x: padding.left + columnIndex * cellWidth,
            y: padding.top + rowIndex * cellHeight,
          };
        });
      }).flat(),
    [
      cellHeight,
      cellWidth,
      columnCount,
      expirationDays,
      getScenarioTooltipPoint,
      maxPrice,
      minPrice,
      padding.left,
      padding.top,
      rowCount,
    ],
  );
  const lossFloor = -Math.max(totalCost, 1);
  const profitCeiling = Math.max(
    maxProfit ?? 0,
    selectedPnl,
    ...cells.map((cell) => cell.pnl),
    1,
  );
  const pnlColor = (pnl: number) => {
    if (pnl > 0) {
      const ratio = clamp(pnl / profitCeiling, 0, 1);
      if (ratio < 0.15) return "#dcfce7";
      if (ratio < 0.35) return "#bbf7d0";
      if (ratio < 0.55) return "#86efac";
      if (ratio < 0.75) return "#34d399";
      return "#059669";
    }
    if (pnl < 0) {
      const ratio = clamp(pnl / lossFloor, 0, 1);
      if (ratio < 0.15) return "#fee2e2";
      if (ratio < 0.35) return "#fecaca";
      if (ratio < 0.55) return "#fca5a5";
      if (ratio < 0.75) return "#f87171";
      return "#dc2626";
    }
    return "#f8fafc";
  };
  const priceAxisTicks = buildStockPriceAxisTicks(
    minPrice,
    maxPrice,
    currentSpot,
  ).sort((a, b) => b - a);
  const dateTickCount = expirationDays >= 60 ? 6 : 5;
  const dateTicks = Array.from({ length: dateTickCount }, (_, index) => {
    const ratio = index / Math.max(dateTickCount - 1, 1);
    return Math.round(expirationDays * ratio);
  });
  const showBreakEvenMarker =
    breakEvenPrice >= minPrice && breakEvenPrice <= maxPrice;
  const selectedTooltipPoint = {
    price: selectedPrice,
    offsetDays: selectedOffsetDays,
    dateLabel: scenarioDateLabel,
    positionValue: selectedValue,
    pnl: selectedPnl,
    roi: selectedRoi,
  };
  const tooltipPoint = hoverPoint ?? selectedTooltipPoint;
  const tooltipVisible = hoverPoint !== null;
  const tooltipXAnchor = x(tooltipPoint.offsetDays);
  const tooltipYAnchor = y(tooltipPoint.price);
  const selectedX = x(selectedOffsetDays);
  const selectedY = y(selectedPrice);
  const isCurrentSpotVisible = currentSpot >= minPrice && currentSpot <= maxPrice;
  const tooltipWidth = 224;
  const tooltipHeight = 108;
  const tooltipX = clamp(
    tooltipXAnchor > width - padding.right - tooltipWidth - 12
      ? tooltipXAnchor - tooltipWidth - 12
      : tooltipXAnchor + 12,
    padding.left,
    width - padding.right - tooltipWidth,
  );
  const tooltipY = clamp(
    tooltipYAnchor - tooltipHeight / 2,
    padding.top,
    height - padding.bottom - tooltipHeight,
  );
  const getPointerScenarioPoint = (event: PointerEvent<SVGRectElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const xRatio = clamp(
      (event.clientX - bounds.left) / Math.max(bounds.width, 1),
      0,
      1,
    );
    const yRatio = clamp(
      (event.clientY - bounds.top) / Math.max(bounds.height, 1),
      0,
      1,
    );

    return {
      price: Math.round(maxPrice - (maxPrice - minPrice) * yRatio),
      offsetDays: Math.round(xRatio * Math.max(expirationDays, 0)),
    };
  };
  const showHoverTooltip = (event: PointerEvent<SVGRectElement>) => {
    const { price, offsetDays } = getPointerScenarioPoint(event);
    const tooltipPoint = getScenarioTooltipPoint(price, offsetDays);

    setHoverPoint({
      price,
      offsetDays,
      ...tooltipPoint,
    });
  };
  const handlePointerMove = (event: PointerEvent<SVGRectElement>) => {
    showHoverTooltip(event);
  };

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-3 shadow-sm">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[#e63946]" />
            Selected
          </span>
          {currentSpot >= minPrice && currentSpot <= maxPrice ? (
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-0.5 w-4 rounded-full"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, #64748b 50%, transparent 50%)",
                  backgroundSize: "6px 2px",
                }}
              />
              Spot {formatCurrency(currentSpot)}
            </span>
          ) : null}
          {showBreakEvenMarker ? (
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-0.5 w-4 rounded-full"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, #0f172a 50%, transparent 50%)",
                  backgroundSize: "4px 2px",
                }}
              />
              B/E {formatCurrency(breakEvenPrice)}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span className="font-mono tabular-nums">
            {formatCompactCurrency(lossFloor)}
          </span>
          <span
            className="h-2 w-32 rounded-sm border border-slate-200"
            style={{
              background:
                "linear-gradient(to right, #dc2626, #fca5a5, #f8fafc, #86efac, #059669)",
            }}
            aria-hidden
          />
          <span className="font-mono tabular-nums">
            +{formatCompactCurrency(profitCeiling)}
          </span>
          <span className="font-medium uppercase tracking-wide text-[10px] text-slate-500">
            P/L
          </span>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
        <rect
          x={padding.left}
          y={padding.top}
          width={chartWidth}
          height={chartHeight}
          fill={CHART_COLORS.paper}
        />
        {cells.map((cell) => (
          <rect
            key={`${cell.rowIndex}-${cell.columnIndex}`}
            x={cell.x}
            y={cell.y}
            width={cellWidth + 0.4}
            height={cellHeight + 0.4}
            fill={pnlColor(cell.pnl)}
          />
        ))}

        {priceAxisTicks.map((tick) => (
          <g key={`map-price-axis-${tick}`}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke={CHART_COLORS.paper}
              strokeOpacity={0.7}
              strokeWidth={1}
            />
            <text
              x={padding.left - 12}
              y={y(tick) + 4}
              textAnchor="end"
              fill={CHART_COLORS.inkMuted}
              className="font-mono text-[11px]"
            >
              {formatCurrency(tick)}
            </text>
          </g>
        ))}

        {dateTicks.map((offsetDays, index) => (
          <g key={`map-date-${offsetDays}-${index}`}>
            <line
              x1={x(offsetDays)}
              x2={x(offsetDays)}
              y1={padding.top}
              y2={height - padding.bottom}
              stroke={CHART_COLORS.paper}
              strokeOpacity={0.7}
              strokeWidth={1}
            />
            <text
              x={x(offsetDays)}
              y={height - padding.bottom + 18}
              textAnchor="middle"
              fill={CHART_COLORS.inkMuted}
              className="font-mono text-[11px]"
            >
              {offsetDays === 0
                ? "Today"
                : offsetDays === expirationDays
                  ? "Expiry"
                  : `+${offsetDays}d`}
            </text>
            <text
              x={x(offsetDays)}
              y={height - padding.bottom + 32}
              textAnchor="middle"
              fill={CHART_COLORS.inkMuted}
              className="font-mono text-[10px]"
              opacity={0.7}
            >
              {formatLongDate(addDaysToIso(todayIso, offsetDays))}
            </text>
          </g>
        ))}

        {isCurrentSpotVisible ? (
          <line
            x1={padding.left}
            x2={width - padding.right}
            y1={y(currentSpot)}
            y2={y(currentSpot)}
            stroke={CHART_COLORS.inkMuted}
            strokeDasharray="4 4"
            strokeWidth={1}
          />
        ) : null}
        {showBreakEvenMarker ? (
          <line
            x1={padding.left}
            x2={width - padding.right}
            y1={y(breakEvenPrice)}
            y2={y(breakEvenPrice)}
            stroke={CHART_COLORS.ink}
            strokeOpacity={0.5}
            strokeDasharray="2 4"
            strokeWidth={1}
          />
        ) : null}
        <line
          x1={selectedX}
          x2={selectedX}
          y1={padding.top}
          y2={height - padding.bottom}
          stroke={CHART_COLORS.accent}
          strokeWidth={1.5}
        />
        <line
          x1={padding.left}
          x2={width - padding.right}
          y1={selectedY}
          y2={selectedY}
          stroke={CHART_COLORS.accent}
          strokeWidth={1.5}
        />
        <circle cx={selectedX} cy={selectedY} r={5.5} fill={CHART_COLORS.accent} stroke={CHART_COLORS.paper} strokeWidth={2} />
        <text
          x={padding.left + chartWidth / 2}
          y={height - 12}
          textAnchor="middle"
          fill={CHART_COLORS.inkMuted}
          className="text-[12px] font-medium"
        >
          Valuation date
        </text>
        <text
          x={18}
          y={padding.top + chartHeight / 2}
          textAnchor="middle"
          transform={`rotate(-90 18 ${padding.top + chartHeight / 2})`}
          fill={CHART_COLORS.inkMuted}
          className="text-[12px] font-medium"
        >
          Underlying price
        </text>
        {tooltipVisible ? (
          <g pointerEvents="none">
            <line
              x1={tooltipXAnchor}
              x2={tooltipXAnchor}
              y1={tooltipYAnchor}
              y2={tooltipY + tooltipHeight / 2}
              stroke={CHART_COLORS.accent}
              strokeOpacity={0.4}
              strokeWidth={1}
            />
            <rect
              x={tooltipX}
              y={tooltipY}
              width={tooltipWidth}
              height={tooltipHeight}
              rx={6}
              fill={CHART_COLORS.paper}
              stroke={CHART_COLORS.line}
            />
            <text
              x={tooltipX + 10}
              y={tooltipY + 18}
              fill={CHART_COLORS.inkMuted}
              className="text-[12px] font-medium"
            >
              {formatCurrency(tooltipPoint.price)} stock price
            </text>
            <text
              x={tooltipX + 10}
              y={tooltipY + 36}
              fill={CHART_COLORS.inkMuted}
              className="text-[12px] font-medium"
            >
              {tooltipPoint.dateLabel}
            </text>
            <text
              x={tooltipX + 10}
              y={tooltipY + 60}
              fill={CHART_COLORS.ink}
              className="font-mono text-[15px] font-semibold"
            >
              {formatCurrency(tooltipPoint.positionValue)} total value
            </text>
            <text
              x={tooltipX + 10}
              y={tooltipY + 80}
              className={cn(
                "font-mono text-[12px]",
                tooltipPoint.roi >= 0 ? "fill-emerald-700" : "fill-rose-700",
              )}
            >
              {formatPercent(tooltipPoint.roi)} gain
            </text>
            <text
              x={tooltipX + 10}
              y={tooltipY + 98}
              className={cn(
                "font-mono text-[12px]",
                tooltipPoint.pnl >= 0 ? "fill-emerald-700" : "fill-rose-700",
              )}
            >
              {formatCurrency(tooltipPoint.pnl)} P/L
            </text>
          </g>
        ) : null}
        <rect
          x={padding.left}
          y={padding.top}
          width={chartWidth}
          height={chartHeight}
          fill={CHART_COLORS.paper}
          fillOpacity={0}
          pointerEvents="all"
          className="cursor-default"
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHoverPoint(null)}
        />
      </svg>
    </div>
  );
}

function ResultsTable<Row extends { id: string; isHighlighted?: boolean }>({
  title,
  subtitle,
  columns,
  rows,
}: ResultsTableProps<Row>) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h3 className="font-[family:var(--font-space-grotesk)] text-lg font-semibold text-slate-950">
          {title}
        </h3>
        <p className="mt-1 text-sm text-slate-500 text-pretty">{subtitle}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    "px-4 py-3 text-left font-medium",
                    column.align === "right" && "text-right",
                  )}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className={cn(
                  "border-t border-slate-100",
                  row.isHighlighted && "bg-[#e63946]/10",
                )}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      "px-4 py-3 align-top font-mono tabular-nums text-slate-950",
                      column.align === "right" && "text-right",
                      column.muted && "text-slate-600",
                    )}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function DebitCallSpreadLab({
  todayIso,
  defaultExpiryIso,
}: DebitCallSpreadLabProps) {
  const defaultExpirationDays = Math.max(1, daysBetween(todayIso, defaultExpiryIso));
  const [strategy, setStrategy] = useState<OptionStrategy>("debit-call-spread");
  const [symbol, setSymbol] = useState("NVDA");
  const [spot, setSpot] = useState(100);
  const [volatilityPct, setVolatilityPct] = useState(50);
  const [futureVolatilityPct, setFutureVolatilityPct] = useState(50);
  const [longStrike, setLongStrike] = useState(120);
  const [shortStrike, setShortStrike] = useState(130);
  const [capital, setCapital] = useState(10000);
  const [allowFractionalContracts, setAllowFractionalContracts] =
    useState(false);
  const [ratePct, setRatePct] = useState(4);
  const [ratePctDraft, setRatePctDraft] = useState("4");
  const [expirationDays, setExpirationDays] = useState(defaultExpirationDays);
  const [scenarioPrice, setScenarioPrice] = useState(145);
  const [scenarioPriceDraft, setScenarioPriceDraft] = useState<string | null>(
    null,
  );
  const [scenarioGraphView, setScenarioGraphView] =
    useState<ScenarioGraphView>("map");
  const [scenarioOffsetDays, setScenarioOffsetDays] = useState(
    Math.round(defaultExpirationDays / 2),
  );
  const [isUrlStateReady, setIsUrlStateReady] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [comparisonPanelMode, setComparisonPanelMode] =
    useState<ComparisonPanelMode>("presets");
  const [customComparisons, setCustomComparisons] = useState<
    CustomComparisonConfig[]
  >([]);
  const [isCustomComparisonEditorOpen, setIsCustomComparisonEditorOpen] =
    useState(false);
  const [customDraft, setCustomDraft] = useState<CustomComparisonDraft>({
    label: "",
    strategy: "debit-call-spread",
    longStrike: spot,
    shortStrike: getOtmStrike(spot, 10),
    capital,
    expirationDays,
    allowFractionalContracts,
  });
  const [graphComparisonId, setGraphComparisonId] = useState("editor");
  const isDebitCallSpread = strategy === "debit-call-spread";
  const strategyCopy = STRATEGY_COPY[strategy];
  const upperStrike = isDebitCallSpread ? shortStrike : longStrike;

  const scenarioPriceSliderMin = Math.max(1, Math.floor(spot * 0.7));
  const scenarioPriceSliderMax = Math.max(
    scenarioPriceSliderMin,
    Math.ceil(upperStrike * 1.3),
  );
  const safeScenarioPrice = Math.round(
    clamp(scenarioPrice, scenarioPriceSliderMin, scenarioPriceSliderMax),
  );
  const scenarioPriceInputValue =
    Number.isFinite(scenarioPrice) &&
    (scenarioPrice < scenarioPriceSliderMin || scenarioPrice > scenarioPriceSliderMax)
      ? Math.round(scenarioPrice)
      : safeScenarioPrice;
  const displayedScenarioPriceInputValue =
    scenarioPriceDraft ?? String(scenarioPriceInputValue);
  const currentPriceSliderMax = getSliderMax(spot, safeScenarioPrice, longStrike, upperStrike);
  const baseStrikeSliderMax = getSliderMax(spot, safeScenarioPrice, longStrike, upperStrike);
  const longStrikeSliderMax = Math.max(
    baseStrikeSliderMax,
    isDebitCallSpread ? shortStrike + 20 : longStrike + 20,
  );
  const shortStrikeSliderMax = Math.max(baseStrikeSliderMax + 20, longStrike + 5);
  const expiryIso = addDaysToIso(todayIso, expirationDays);
  const safeScenarioOffsetDays = clamp(scenarioOffsetDays, 0, expirationDays);

  useEffect(() => {
    let isActive = true;
    const sharedState = getShareStateFromUrl(defaultExpirationDays);

    queueMicrotask(() => {
      if (!isActive) {
        return;
      }

      if (sharedState) {
        setStrategy(sharedState.strategy);
        setSymbol(sharedState.symbol);
        setSpot(sharedState.spot);
        setVolatilityPct(sharedState.volatilityPct);
        setFutureVolatilityPct(sharedState.futureVolatilityPct);
        setLongStrike(sharedState.longStrike);
        setShortStrike(sharedState.shortStrike);
        setCapital(sharedState.capital);
        setAllowFractionalContracts(sharedState.allowFractionalContracts);
        setExpirationDays(sharedState.expirationDays);
        setScenarioPrice(sharedState.scenarioPrice);
        setScenarioPriceDraft(null);
        setScenarioGraphView(sharedState.scenarioGraphView);
        setScenarioOffsetDays(sharedState.scenarioOffsetDays);
        setRatePct(sharedState.ratePct);
        setRatePctDraft(compactNumber(sharedState.ratePct));
        setComparisonPanelMode(sharedState.comparisonPanelMode);
        setCustomComparisons(sharedState.customComparisons);
        setGraphComparisonId(sharedState.graphComparisonId);
      }

      setIsUrlStateReady(true);
    });

    return () => {
      isActive = false;
    };
  }, [defaultExpirationDays]);

  useEffect(() => {
    if (!isUrlStateReady) {
      return;
    }

    const nextState = encodeShareState({
      strategy,
      symbol,
      spot,
      volatilityPct,
      futureVolatilityPct,
      longStrike,
      shortStrike,
      capital,
      allowFractionalContracts,
      expirationDays,
      scenarioPrice: safeScenarioPrice,
      scenarioOffsetDays: safeScenarioOffsetDays,
      ratePct,
      scenarioGraphView,
      comparisonPanelMode,
      customComparisons,
      graphComparisonId,
    });
    replaceShareHash(nextState);
  }, [
    allowFractionalContracts,
    capital,
    comparisonPanelMode,
    customComparisons,
    expirationDays,
    futureVolatilityPct,
    graphComparisonId,
    longStrike,
    ratePct,
    safeScenarioOffsetDays,
    safeScenarioPrice,
    scenarioGraphView,
    shortStrike,
    spot,
    strategy,
    symbol,
    volatilityPct,
    isUrlStateReady,
  ]);
  const updateSpot = (nextValue: number) => {
    const nextSpot = Math.round(nextValue);

    setSpot(nextSpot);
    setLongStrike(nextSpot);
    setShortStrike(getOtmStrike(nextSpot, 10));
  };
  const updateVolatilityPct = (nextValue: number) => {
    setVolatilityPct(nextValue);
    setFutureVolatilityPct(nextValue);
  };
  const updateExpirationDays = (nextValue: number) => {
    const nextExpirationDays = clamp(Math.round(nextValue), 0, 1095);

    setExpirationDays(nextExpirationDays);
    setScenarioOffsetDays((currentDays) =>
      clamp(currentDays, 0, nextExpirationDays),
    );
  };
  const revealScenarioComparisons = () => {
    setComparisonPanelMode((currentMode) =>
      currentMode === "hidden" ? "presets" : currentMode,
    );
  };
  const updateScenarioPrice = (nextValue: number) => {
    revealScenarioComparisons();
    setScenarioPrice(
      clamp(nextValue, scenarioPriceSliderMin, scenarioPriceSliderMax),
    );
  };
  const updateScenarioOffsetDays = (nextValue: number) => {
    revealScenarioComparisons();
    setScenarioOffsetDays(clamp(nextValue, 0, expirationDays));
  };
  const updateFutureScenarioVolatilityPct = (nextValue: number) => {
    revealScenarioComparisons();
    setFutureVolatilityPct(nextValue);
  };
  const updateScenarioPriceDraft = (nextValue: string) => {
    const parsedValue = Number(nextValue);

    setScenarioPriceDraft(nextValue);

    if (nextValue.trim() && Number.isFinite(parsedValue)) {
      revealScenarioComparisons();
      setScenarioPrice(Math.round(parsedValue));
    }
  };
  const commitScenarioPriceDraft = (nextValue: string) => {
    const parsedValue = Number(nextValue);
    const committedValue = Number.isFinite(parsedValue)
      ? Math.round(parsedValue)
      : safeScenarioPrice;

    updateScenarioPrice(committedValue);
    setScenarioPriceDraft(null);
  };
  const handleScenarioPriceKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    if (event.key === "Enter") {
      event.currentTarget.blur();
      return;
    }

    if (event.key === "Backspace" && /^\d$/.test(event.currentTarget.value)) {
      event.preventDefault();
      setScenarioPriceDraft("0");
      updateScenarioPrice(0);
      return;
    }

    if (/^\d$/.test(event.key) && event.currentTarget.value === "0") {
      event.preventDefault();
      setScenarioPriceDraft(event.key);
      updateScenarioPrice(Number(event.key));
    }
  };
  const updateRatePctDraft = (nextValue: string) => {
    if (!/^\d*\.?\d*$/.test(nextValue)) {
      return;
    }

    setRatePctDraft(nextValue);

    if (!nextValue.trim() || nextValue === ".") {
      setRatePct(0);
      return;
    }

    setRatePct(clamp(parseDecimalInput(nextValue), 0, 15));
  };
  const commitRatePctDraft = () => {
    const nextRate = clamp(parseDecimalInput(ratePctDraft), 0, 15);

    setRatePct(nextRate);
    setRatePctDraft(String(roundTo(nextRate, 2)));
  };
  const handleRatePctKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    if (event.key === "Enter") {
      event.currentTarget.blur();
      return;
    }

    if (event.key === "Backspace" && /^\d$/.test(event.currentTarget.value)) {
      event.preventDefault();
      setRatePctDraft("0");
      setRatePct(0);
      return;
    }

    if (/^\d$/.test(event.key) && event.currentTarget.value === "0") {
      event.preventDefault();
      setRatePctDraft(event.key);
      setRatePct(Number(event.key));
    }
  };
  const seedCustomDraftFromCurrent = () => {
    setCustomDraft({
      label: "",
      strategy,
      longStrike,
      shortStrike: isDebitCallSpread ? shortStrike : longStrike,
      capital,
      expirationDays,
      allowFractionalContracts,
    });
  };
  const useCustomQuickStart = (card: ComparisonCardData) => {
    setCustomDraft({
      label: card.label,
      strategy: card.strategy,
      longStrike: card.longStrike,
      shortStrike:
        card.strategy === "long-call"
          ? card.longStrike
          : Math.max(card.shortStrike, card.longStrike + 1),
      capital: card.capital,
      expirationDays: card.expirationDays,
      allowFractionalContracts: card.allowFractionalContracts,
    });
  };
  const showCustomComparisons = () => {
    if (comparisonPanelMode !== "custom") {
      seedCustomDraftFromCurrent();
    }

    if (comparisonPanelMode === "custom" || graphComparisonId.startsWith("preset:")) {
      setGraphComparisonId("editor");
    }
    setComparisonPanelMode((currentMode) =>
      currentMode === "custom" ? "hidden" : "custom",
    );
    setIsCustomComparisonEditorOpen(false);
  };
  const openCustomComparisonEditor = () => {
    if (!isCustomComparisonEditorOpen) {
      seedCustomDraftFromCurrent();
    }

    if (graphComparisonId.startsWith("preset:")) {
      setGraphComparisonId("editor");
    }

    setIsCustomComparisonEditorOpen((currentValue) => !currentValue);
  };
  const customDraftError =
    customDraft.longStrike <= 0
      ? "Long strike has to be greater than zero."
      : customDraft.strategy === "debit-call-spread" &&
          customDraft.shortStrike <= customDraft.longStrike
        ? "Short strike has to be above the long strike."
        : customDraft.capital <= 0
          ? "Capital needs to be greater than zero."
          : customDraft.expirationDays <= 0
            ? "DTE needs to be greater than zero."
          : null;
  const addCustomComparison = () => {
    if (customDraftError) {
      return;
    }

    const nextStrategy = customDraft.strategy;
    const nextLongStrike = Math.max(1, Math.round(customDraft.longStrike));
    const nextShortStrike =
      nextStrategy === "long-call"
        ? nextLongStrike
        : Math.max(nextLongStrike + 1, Math.round(customDraft.shortStrike));
    const nextId = `custom-${Date.now()}-${customComparisons.length}`;

    setCustomComparisons((currentComparisons) => [
      ...currentComparisons,
      {
        id: nextId,
        label: getCustomComparisonLabel({
          ...customDraft,
          longStrike: nextLongStrike,
          shortStrike: nextShortStrike,
        }),
        strategy: nextStrategy,
        longStrike: nextLongStrike,
        shortStrike: nextShortStrike,
        capital: Math.max(1, Math.round(customDraft.capital)),
        expirationDays: clamp(Math.round(customDraft.expirationDays), 1, 1095),
        allowFractionalContracts: customDraft.allowFractionalContracts,
      },
    ]);
    setGraphComparisonId(`custom:${nextId}`);

    setCustomDraft((currentDraft) => ({ ...currentDraft, label: "" }));
    setIsCustomComparisonEditorOpen(false);
  };
  const removeCustomComparison = (id: string) => {
    setCustomComparisons((currentComparisons) =>
      currentComparisons.filter((comparison) => comparison.id !== id),
    );
    setGraphComparisonId((currentId) =>
      currentId === `custom:${id}` ? "editor" : currentId,
    );
  };

  const validationMessages: string[] = [];
  if (!symbol.trim()) {
    validationMessages.push("Enter a ticker or label so the scenario has a clear underlying.");
  }
  if (spot <= 0) {
    validationMessages.push("Current stock price has to be greater than zero.");
  }
  if (volatilityPct < 0) {
    validationMessages.push("Current IV cannot be negative.");
  }
  if (futureVolatilityPct < 0) {
    validationMessages.push("Future IV cannot be negative.");
  }
  if (longStrike <= 0 || (isDebitCallSpread && shortStrike <= 0)) {
    validationMessages.push(
      isDebitCallSpread
        ? "Strike prices have to be greater than zero."
        : "Call strike has to be greater than zero.",
    );
  }
  if (isDebitCallSpread && shortStrike <= longStrike) {
    validationMessages.push("For a debit call spread, the short strike must be above the long strike.");
  }
  if (capital <= 0) {
    validationMessages.push("Capital needs to be greater than zero.");
  }
  if (expirationDays === 0) {
    validationMessages.push("Set the expiration after today so the app can model time value.");
  }

  const inputs = useMemo<StrategyInputs>(
    () => ({
      strategy,
      todayIso,
      expiryIso,
      spot,
      longStrike,
      shortStrike,
      volatilityPct,
      futureVolatilityPct,
      capital,
      allowFractionalContracts,
      scenarioPrice: safeScenarioPrice,
      scenarioOffsetDays: safeScenarioOffsetDays,
      ratePct,
      dividendYieldPct: 0,
    }),
    [
      allowFractionalContracts,
      capital,
      expiryIso,
      futureVolatilityPct,
      longStrike,
      ratePct,
      safeScenarioOffsetDays,
      safeScenarioPrice,
      shortStrike,
      spot,
      strategy,
      todayIso,
      volatilityPct,
    ],
  );

  const snapshot = useMemo(() => createScenarioSnapshot(inputs), [inputs]);
  const canModel = validationMessages.length === 0 && snapshot.unitCost > 0;
  const activeScenarioGraphView: ScenarioGraphView =
    scenarioGraphView === "overlay" || scenarioGraphView === "decay" || scenarioGraphView === "map"
      ? scenarioGraphView
      : "map";
  const scenarioGraphOptions: Array<{ value: ScenarioGraphView; label: string }> = [
    { value: "map", label: "Heat map" },
    { value: "overlay", label: "Multi-date" },
    { value: "decay", label: "Time value" },
  ];
  const showScenarioSelectionControls = activeScenarioGraphView !== "map";
  const comparisonCards = useMemo<ComparisonCardData[]>(() => {
    if (!canModel) {
      return [];
    }

    const atmStrike = Math.max(1, Math.round(spot));
    const candidates: ComparisonCandidate[] = [
      {
        id: "current",
        label: "Current setup",
        note: "The position currently in the editor.",
        strategy,
        longStrike,
        shortStrike,
        capital,
        expirationDays,
        allowFractionalContracts,
      },
      {
        id: "atm-long-call",
        label: "ATM long call",
        note: "Cleaner upside, higher premium, no capped profit.",
        strategy: "long-call",
        longStrike: atmStrike,
        shortStrike: atmStrike,
        capital,
        expirationDays,
        allowFractionalContracts,
      },
      {
        id: "spread-5-otm",
        label: "5% OTM spread",
        note: "Closer target with a higher chance of finishing in range.",
        strategy: "debit-call-spread",
        longStrike: atmStrike,
        shortStrike: Math.max(atmStrike + 1, getOtmStrike(spot, 5)),
        capital,
        expirationDays,
        allowFractionalContracts,
      },
      {
        id: "spread-10-otm",
        label: "10% OTM spread",
        note: "Balanced spread matching the default short-strike idea.",
        strategy: "debit-call-spread",
        longStrike: atmStrike,
        shortStrike: Math.max(atmStrike + 1, getOtmStrike(spot, 10)),
        capital,
        expirationDays,
        allowFractionalContracts,
      },
      {
        id: "spread-20-otm",
        label: "20% OTM spread",
        note: "Cheaper, more aggressive target with a wider payoff window.",
        strategy: "debit-call-spread",
        longStrike: atmStrike,
        shortStrike: Math.max(atmStrike + 1, getOtmStrike(spot, 20)),
        capital,
        expirationDays,
        allowFractionalContracts,
      },
    ];

    return rankComparisonCards(
      candidates.flatMap((candidate) => {
        const card = buildComparisonCard(candidate, inputs);
        return card ? [card] : [];
      }),
    );
  }, [
    allowFractionalContracts,
    canModel,
    capital,
    expirationDays,
    inputs,
    longStrike,
    shortStrike,
    spot,
    strategy,
  ]);
  const customComparisonCards = useMemo<ComparisonCardData[]>(() => {
    if (!canModel) {
      return [];
    }

    return rankComparisonCards(
      customComparisons.flatMap((comparison) => {
        const card = buildComparisonCard(
          {
            ...comparison,
            note:
              comparison.strategy === "long-call"
                ? "Custom long call using the selected market assumptions."
                : "Custom spread using the selected market assumptions.",
          },
          inputs,
        );
        return card ? [card] : [];
      }),
    );
  }, [canModel, customComparisons, inputs]);
  const visibleComparisonCards = useMemo(() => {
    if (comparisonPanelMode === "presets") {
      return comparisonCards;
    }

    if (comparisonPanelMode === "custom") {
      return customComparisonCards;
    }

    return [];
  }, [comparisonCards, comparisonPanelMode, customComparisonCards]);
  const graphComparisonOptions = useMemo<GraphComparisonOption[]>(() => {
    const currentCandidate: ComparisonCandidate = {
      id: "current-editor",
      label: "Current setup",
      note: "The position currently in the editor.",
      strategy,
      longStrike,
      shortStrike,
      capital,
      expirationDays,
      allowFractionalContracts,
    };
    const currentDetail = `${getComparisonStrikeLabel(currentCandidate)} · ${formatPercent(
      snapshot.roi,
    )}`;
    const comparisonOptions = visibleComparisonCards.map((card) => ({
      id: `${comparisonPanelMode === "custom" ? "custom" : "preset"}:${card.id}`,
      label: `#${card.rank} ${card.label}`,
      detail: `${getComparisonStrikeLabel(card)} · ${formatPercent(card.snapshot.roi)}`,
      inputs: applyComparisonToInputs(card, inputs),
      snapshot: card.snapshot,
    }));

    return [
      {
        id: "editor",
        label: "Current setup",
        detail: currentDetail,
        inputs,
        snapshot,
      },
      ...comparisonOptions,
    ];
  }, [
    allowFractionalContracts,
    capital,
    expirationDays,
    comparisonPanelMode,
    inputs,
    longStrike,
    shortStrike,
    snapshot,
    strategy,
    visibleComparisonCards,
  ]);
  const selectedGraphComparison =
    graphComparisonOptions.find((option) => option.id === graphComparisonId) ??
    graphComparisonOptions[0];
  const visualizedInputs = selectedGraphComparison.inputs;
  const visualizedSnapshot = selectedGraphComparison.snapshot;
  const visualizedStrategy = visualizedInputs.strategy;
  const visualizedStrategyCopy = STRATEGY_COPY[visualizedStrategy];
  const visualizedIsDebitCallSpread = visualizedStrategy === "debit-call-spread";
  const visualizedMaxProfitAtExpiry =
    visualizedSnapshot.maxProfitPerUnit !== null
      ? visualizedSnapshot.maxProfitPerUnit *
        visualizedSnapshot.contracts *
        CONTRACT_MULTIPLIER
      : null;
  const visualizedMaxReturnAtExpiry =
    visualizedMaxProfitAtExpiry !== null && visualizedSnapshot.totalCost > 0
      ? visualizedMaxProfitAtExpiry / visualizedSnapshot.totalCost
      : null;
  const visualizedMaxLossAtExpiry = -visualizedSnapshot.totalCost;
  const visualizedScenarioVisualizerInputs = useMemo(
    () => ({
      strategy: visualizedInputs.strategy,
      currentPrice: visualizedInputs.spot,
      longStrike: visualizedInputs.longStrike,
      shortStrike: visualizedInputs.shortStrike,
      currentDte: visualizedSnapshot.expirationDays,
      numberOfSpreads: visualizedSnapshot.contracts,
      entryDebit: visualizedSnapshot.unitCost,
      impliedVolatilityPct: visualizedInputs.futureVolatilityPct,
      riskFreeRatePct: visualizedInputs.ratePct,
      dividendYieldPct: visualizedInputs.dividendYieldPct,
    }),
    [visualizedInputs, visualizedSnapshot],
  );
  const graphRenderKey = [
    selectedGraphComparison.id,
    visualizedInputs.strategy,
    visualizedInputs.longStrike,
    visualizedInputs.shortStrike,
    visualizedSnapshot.contracts,
    visualizedSnapshot.unitCost,
  ].join("|");
  const timelineRows = useMemo<TimelineTableRow[]>(
    () =>
      canModel
        ? buildTimelineRows(inputs).map((row) => ({
            id: row.dateIso,
            ...row,
          }))
        : [],
    [canModel, inputs],
  );
  const priceRows = useMemo<PriceTableRow[]>(
    () =>
      canModel
        ? buildPriceLadderRows(inputs).map((row) => ({
            id: `${row.price}`,
            ...row,
          }))
        : [],
    [canModel, inputs],
  );
  const pnlCurvePoints = useMemo<PnlCurvePoint[]>(() => {
    if (!canModel) {
      return [];
    }

    const totalCost = visualizedSnapshot.totalCost;
    return buildPriceCurve(visualizedInputs).map((point: PriceCurvePoint) => ({
      price: point.price,
      selectedDatePnl: point.selectedDateValue - totalCost,
      expiryPnl: point.expiryValue - totalCost,
    }));
  }, [canModel, visualizedInputs, visualizedSnapshot.totalCost]);
  const decayPoints = useMemo<TimeDecayPoint[]>(() => {
    if (!canModel || expirationDays <= 0) {
      return [];
    }

    const sampleCount = Math.min(Math.max(expirationDays + 1, 12), 80);
    const offsets = Array.from({ length: sampleCount }, (_, index) =>
      Math.round((expirationDays * index) / Math.max(sampleCount - 1, 1)),
    );
    const seenOffsets = new Set<number>();
    return offsets.flatMap((offset) => {
      if (seenOffsets.has(offset)) return [];
      seenOffsets.add(offset);
      const decaySnapshot = createScenarioSnapshot({
        ...visualizedInputs,
        scenarioOffsetDays: clamp(offset, 0, expirationDays),
      });
      return [{
        offsetDays: offset,
        dateIso: decaySnapshot.selectedDateIso,
        positionValue: decaySnapshot.scenarioPositionValue,
        pnl: decaySnapshot.pnl,
      }];
    });
  }, [canModel, expirationDays, visualizedInputs]);
  const overlayCurves = useMemo<OverlayCurve[]>(() => {
    if (!canModel) {
      return [];
    }

    const totalCost = visualizedSnapshot.totalCost;
    const offsets = expirationDays > 0
      ? [
          { offsetDays: 0, label: "Today" },
          { offsetDays: Math.round(expirationDays * 0.33), label: `+${Math.round(expirationDays * 0.33)}d` },
          { offsetDays: Math.round(expirationDays * 0.66), label: `+${Math.round(expirationDays * 0.66)}d` },
          { offsetDays: visualizedSnapshot.selectedOffsetDays, label: `Selected (+${visualizedSnapshot.selectedOffsetDays}d)` },
        ]
      : [{ offsetDays: 0, label: "Today" }];
    const dedupedOffsets: Array<{ offsetDays: number; label: string }> = [];
    const seen = new Set<number>();
    offsets.forEach((entry) => {
      if (seen.has(entry.offsetDays)) return;
      seen.add(entry.offsetDays);
      dedupedOffsets.push(entry);
    });
    const result: OverlayCurve[] = dedupedOffsets.map((entry) => {
      const curve = buildPriceCurve({
        ...visualizedInputs,
        scenarioOffsetDays: clamp(entry.offsetDays, 0, expirationDays),
      });
      return {
        id: `overlay-${entry.offsetDays}`,
        label: entry.label,
        offsetDays: entry.offsetDays,
        isExpiry: false,
        points: curve.map((point) => ({
          price: point.price,
          pnl: point.selectedDateValue - totalCost,
        })),
      };
    });
    if (expirationDays > 0 && !seen.has(expirationDays)) {
      const expiryCurve = buildPriceCurve(visualizedInputs);
      result.push({
        id: "overlay-expiry",
        label: "At expiry",
        offsetDays: expirationDays,
        isExpiry: true,
        points: expiryCurve.map((point) => ({
          price: point.price,
          pnl: point.expiryValue - totalCost,
        })),
      });
    }
    return result;
  }, [
    canModel,
    expirationDays,
    visualizedInputs,
    visualizedSnapshot.selectedOffsetDays,
    visualizedSnapshot.totalCost,
  ]);
  const scenarioMapRange = useMemo(() => {
    const minMapPrice = Math.max(1, Math.floor(spot * 0.7));
    const maxMapPrice = Math.max(scenarioPriceSliderMax, Math.ceil(spot * 1.05));

    return {
      minPrice: minMapPrice,
      maxPrice: Math.ceil(maxMapPrice),
    };
  }, [scenarioPriceSliderMax, spot]);
  const priceMarkers = useMemo<PriceMarker[]>(() => {
    const markers: PriceMarker[] = [
      { value: visualizedInputs.spot, label: "Spot" },
      {
        value: visualizedInputs.longStrike,
        label: visualizedIsDebitCallSpread ? "Long" : "Strike",
      },
    ];
    if (visualizedIsDebitCallSpread) {
      markers.push({ value: visualizedInputs.shortStrike, label: "Short" });
    }
    return markers
      .filter((marker) => Number.isFinite(marker.value) && marker.value > 0)
      .sort((a, b) => a.value - b.value);
  }, [visualizedInputs, visualizedIsDebitCallSpread]);
  const getScenarioTooltipPoint = (price: number, offsetDays: number) => {
    const hoverSnapshot = createScenarioSnapshot({
      ...visualizedInputs,
      scenarioPrice: price,
      scenarioOffsetDays: clamp(offsetDays, 0, expirationDays),
    });

    return {
      dateLabel: formatLongDate(hoverSnapshot.selectedDateIso),
      positionValue: hoverSnapshot.scenarioPositionValue,
      pnl: hoverSnapshot.pnl,
      roi: hoverSnapshot.roi,
    };
  };

  const timelineColumns: TableColumn<TimelineTableRow>[] = [
    {
      key: "date",
      label: "Date",
      render: (row) => (
        <div>
          <div>{formatLongDate(row.dateIso)}</div>
          <div className="mt-1 text-xs text-slate-500">
            {row.daysRemaining} days left
          </div>
        </div>
      ),
    },
    {
      key: "unitValue",
      label: strategyCopy.unitColumnLabel,
      align: "right",
      render: (row) => formatCurrency(row.unitValue * CONTRACT_MULTIPLIER),
    },
    {
      key: "positionValue",
      label: "Position value",
      align: "right",
      render: (row) => formatCurrency(row.positionValue),
    },
    {
      key: "intrinsic",
      label: "Intrinsic floor",
      align: "right",
      render: (row) => formatCurrency(row.intrinsicValue * 100),
    },
    {
      key: "pnl",
      label: "P/L",
      align: "right",
      render: (row) => (
        <span className={cn(row.pnl >= 0 ? "text-emerald-700" : "text-rose-700")}>
          {formatCurrency(row.pnl)}
        </span>
      ),
    },
    {
      key: "roi",
      label: "Return",
      align: "right",
      render: (row) => (
        <span className={cn(row.roi >= 0 ? "text-emerald-700" : "text-rose-700")}>
          {formatPercent(row.roi)}
        </span>
      ),
    },
  ];

  const priceColumns: TableColumn<PriceTableRow>[] = [
    {
      key: "price",
      label: `${symbol.trim() || "Underlying"} price`,
      render: (row) => formatCurrency(row.price),
    },
    {
      key: "unitValue",
      label: strategyCopy.unitColumnLabel,
      align: "right",
      render: (row) => formatCurrency(row.unitValue * CONTRACT_MULTIPLIER),
    },
    {
      key: "positionValue",
      label: "Position value",
      align: "right",
      render: (row) => formatCurrency(row.positionValue),
    },
    {
      key: "pnl",
      label: "P/L",
      align: "right",
      render: (row) => (
        <span className={cn(row.pnl >= 0 ? "text-emerald-700" : "text-rose-700")}>
          {formatCurrency(row.pnl)}
        </span>
      ),
    },
    {
      key: "roi",
      label: "Return",
      align: "right",
      render: (row) => (
        <span className={cn(row.roi >= 0 ? "text-emerald-700" : "text-rose-700")}>
          {formatPercent(row.roi)}
        </span>
      ),
    },
  ];
  const shortStrikeOtmActions = [5, 10, 20, 30].map((percent) => ({
    label: `${percent}% OTM`,
    value: getOtmStrike(spot, percent),
  }));
  const callStrikeActions = [
    {
      label: "ATM",
      value: Math.round(spot),
    },
    ...[5, 10, 20].map((percent) => ({
      label: `${percent}% OTM`,
      value: getOtmStrike(spot, percent),
    })),
  ];
  return (
    <main className="h-dvh overflow-x-hidden overflow-y-auto overscroll-none bg-stone-100 text-slate-900">
      <div className="mx-auto w-full max-w-7xl px-2 py-2 sm:px-4 sm:py-3 md:px-6">
        <h1 className="sr-only">Callculator</h1>
        <div
          className={cn(
            "grid min-w-0 items-start gap-3",
            isSidebarVisible && "lg:grid-cols-[21rem_minmax(0,1fr)]",
          )}
        >
          {isSidebarVisible ? (
          <aside className="min-w-0 lg:sticky lg:top-3 lg:max-h-[calc(100dvh-1.5rem)] lg:overflow-y-auto lg:overscroll-none lg:pr-1">
            <SectionCard
              title="Inputs"
              eyebrow="Callculator"
              eyebrowClassName="font-[family:var(--font-space-grotesk)] text-lg font-semibold text-balance"
              action={
                <button
                  type="button"
                  onClick={() => setIsSidebarVisible(false)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm hover:border-[#e63946] hover:text-[#e63946] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e63946] sm:w-auto"
                >
                  Hide inputs
                </button>
              }
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  <SidebarGroupLabel>Position</SidebarGroupLabel>
                  <div
                    className="grid min-w-0 grid-cols-2 gap-2"
                    role="group"
                    aria-label="Option strategy"
                  >
                    {STRATEGY_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={strategy === option.value}
                        title={option.description}
                        onClick={() => {
                          setStrategy(option.value);
                          setScenarioGraphView("map");
                        }}
                        className={cn(
                          "min-w-0 truncate rounded-md border border-slate-300 bg-white px-2 py-2 text-center text-xs font-semibold text-slate-700 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e63946] sm:px-3 sm:text-sm",
                          strategy === option.value &&
                            "border-[#e63946] bg-[#e63946]/10 text-slate-950",
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  <label className="flex min-w-0 items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 shadow-sm">
                    <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                      Ticker
                    </span>
                    <input
                      type="text"
                      value={symbol}
                      onChange={(event) => setSymbol(event.target.value.toUpperCase())}
                      className="min-w-0 flex-1 border-0 bg-transparent p-0 font-mono text-sm font-semibold text-slate-950 outline-none"
                      placeholder="AAPL"
                    />
                  </label>

                  <NumberSliderField
                    label="Current price"
                    help={`Used to price the ${strategyCopy.unitName} today.`}
                    min={5}
                    max={currentPriceSliderMax}
                    step={1}
                    value={spot}
                    onChange={updateSpot}
                    prefix="$"
                  />

                  <NumberSliderField
                    label="Current IV"
                    help={`Used to estimate today's ${strategyCopy.unitName} cost.`}
                    min={5}
                    max={150}
                    step={1}
                    value={volatilityPct}
                    onChange={updateVolatilityPct}
                    suffix="%"
                  />
                </div>

                <div className="space-y-2">
                  <SidebarGroupLabel>
                    {isDebitCallSpread ? "Strikes" : "Strike"}
                    {isDebitCallSpread && shortStrike > longStrike ? (
                      <span className="font-mono text-[11px] font-medium normal-case tracking-normal text-slate-500 tabular-nums">
                        {formatCurrency(shortStrike - longStrike)} wide
                      </span>
                    ) : null}
                  </SidebarGroupLabel>
                  {isDebitCallSpread ? (
                    <>
                      <NumberSliderField
                        label="Long call (buy)"
                        help="The strike you buy."
                        min={5}
                        max={longStrikeSliderMax}
                        step={1}
                        value={longStrike}
                        onChange={setLongStrike}
                        prefix="$"
                      />

                      <NumberSliderField
                        label="Short call (sell)"
                        help="The strike you sell."
                        min={5}
                        max={shortStrikeSliderMax}
                        step={1}
                        value={shortStrike}
                        onChange={setShortStrike}
                        prefix="$"
                        quickActions={shortStrikeOtmActions}
                      />
                    </>
                  ) : (
                    <NumberSliderField
                      label="Call strike"
                      help="The strike price of the call you buy."
                      min={5}
                      max={longStrikeSliderMax}
                      step={1}
                      value={longStrike}
                      onChange={setLongStrike}
                      prefix="$"
                      quickActions={callStrikeActions}
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <SidebarGroupLabel>Sizing</SidebarGroupLabel>
                  <NumberSliderField
                    label="Capital to deploy"
                    help={strategyCopy.capitalHelp}
                    min={500}
                    max={100000}
                    step={100}
                    value={capital}
                    onChange={setCapital}
                    prefix="$"
                  />

                  <div
                    className="flex min-w-0 flex-col gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 shadow-sm min-[360px]:flex-row min-[360px]:items-center min-[360px]:justify-between"
                    role="group"
                    aria-label="Position sizing"
                  >
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="text-sm font-medium text-slate-900">Contracts</span>
                      <InfoIcon label="Whole rounds down so the position fits in cash. Fractional uses the full capital amount as if partial contracts were tradable." />
                    </div>
                    <div className="inline-flex min-w-0 rounded-md border border-slate-300 bg-white p-0.5">
                      {[
                        { label: "Whole", value: false },
                        { label: "Fractional", value: true },
                      ].map((option) => (
                        <button
                          key={option.label}
                          type="button"
                          aria-pressed={allowFractionalContracts === option.value}
                          onClick={() => setAllowFractionalContracts(option.value)}
                          className={cn(
                            "rounded-sm px-2.5 py-1 text-xs font-medium text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e63946]",
                            allowFractionalContracts === option.value &&
                            "bg-[#e63946]/15 text-[#9f1d2a]",
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <SidebarGroupLabel>
                    Time
                    <span className="font-mono text-[11px] font-medium normal-case tracking-normal text-slate-500 tabular-nums">
                      Expires {formatLongDate(expiryIso)}
                    </span>
                  </SidebarGroupLabel>
                  <NumberSliderField
                    label="Days to expiration"
                    help={`The ${strategyCopy.unitName} value moves toward intrinsic value as DTE approaches zero.`}
                    min={0}
                    max={365}
                    step={1}
                    value={expirationDays}
                    onChange={updateExpirationDays}
                    suffix=" DTE"
                    quickActions={[7, 14, 30, 45, 60, 90].map((days) => ({
                      label: `${days}d`,
                      value: days,
                    }))}
                  />
                </div>

                <details className="group rounded-md border border-slate-200 bg-slate-50 shadow-sm">
                  <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm font-medium text-slate-700">
                    <span>Advanced</span>
                    <span className="text-xs text-slate-500 transition-transform group-open:rotate-180">
                      ▾
                    </span>
                  </summary>
                  <div className="space-y-3 border-t border-slate-200 px-3 py-3">
                    <label className="block">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900">Risk-free rate</span>
                        <InfoIcon label="Annualized rate used in the Black-Scholes model." />
                      </div>
                      <div className="mt-2 flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={ratePctDraft}
                          min={0}
                          max={15}
                          pattern="[0-9]*[.]?[0-9]*"
                          aria-label="Risk-free rate"
                          onBlur={commitRatePctDraft}
                          onKeyDown={handleRatePctKeyDown}
                          onChange={(event) => updateRatePctDraft(event.target.value)}
                          className="w-full border-0 bg-transparent p-0 font-mono text-sm text-slate-950 outline-none"
                        />
                        <span className="text-sm text-slate-500">%</span>
                      </div>
                    </label>

                    <div className="rounded-md border border-[#e63946]/30 bg-[#e63946]/10 p-2.5 text-xs text-[#9f1d2a]">
                      <p className="font-medium">Model assumptions</p>
                      <p className="mt-1 leading-5 text-pretty">
                        {strategyCopy.modelAssumptions}
                      </p>
                    </div>
                  </div>
                </details>
              </div>
            </SectionCard>
          </aside>
          ) : null}

          <div className="min-w-0 space-y-4">
            {!isSidebarVisible ? (
              <div className="flex justify-start">
                <button
                  type="button"
                  onClick={() => setIsSidebarVisible(true)}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-[#e63946] hover:text-[#e63946] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e63946]"
                >
                  Show inputs
                </button>
              </div>
            ) : null}
            <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex min-w-0 flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!canModel}
                  aria-pressed={comparisonPanelMode === "custom"}
                  onClick={showCustomComparisons}
                  className={cn(
                    "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-[#e63946] hover:text-slate-950 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e63946]",
                    comparisonPanelMode === "custom" &&
                      "border-[#e63946] bg-[#e63946]/10 text-slate-950",
                  )}
                >
                  Show quick summary
                </button>
                <button
                  type="button"
                  disabled={!canModel}
                  aria-expanded={isCustomComparisonEditorOpen}
                  onClick={openCustomComparisonEditor}
                  className={cn(
                    "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-[#e63946] hover:text-slate-950 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e63946]",
                    isCustomComparisonEditorOpen &&
                      "border-[#e63946] bg-[#e63946]/10 text-slate-950",
                  )}
                >
                  Add strategy
                </button>
              </div>

              {canModel && (comparisonPanelMode === "custom" || isCustomComparisonEditorOpen) ? (
                <div className="mt-3">
                  <CustomComparisonBoard
                    cards={customComparisonCards}
                    draft={customDraft}
                    draftError={customDraftError}
                    isEditorOpen={isCustomComparisonEditorOpen}
                    quickStartCards={comparisonCards}
                    showSummary={comparisonPanelMode === "custom"}
                    scenarioDateLabel={formatLongDate(snapshot.selectedDateIso)}
                    scenarioPrice={safeScenarioPrice}
                    symbol={symbol}
                    onDraftChange={setCustomDraft}
                    onAddComparison={addCustomComparison}
                    onRemoveComparison={removeCustomComparison}
                    onUseQuickStart={useCustomQuickStart}
                  />
                </div>
              ) : null}
            </section>
            <SectionCard
              title="Market scenario"
              eyebrow={`${symbol.trim() || "Underlying"} scenario assumptions`}
            >
              <div className="grid min-w-0 gap-2.5 md:grid-cols-3">
                <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-2.5 shadow-sm sm:p-3">
                  <div className="grid min-h-9 grid-cols-[minmax(0,1fr)_6.25rem] items-start gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="min-w-0 text-sm font-medium leading-tight text-slate-900 text-balance">Future stock price</p>
                      <InfoIcon label="The stock price to test on the selected future date." />
                    </div>
                    <div className="w-[6.25rem] min-w-0 shrink-0">
                      <div className="flex items-center rounded-md border border-slate-300 bg-white px-2 py-1.5">
                        <span className="text-sm text-slate-500">$</span>
                        <input
                          type="number"
                          value={displayedScenarioPriceInputValue}
                          min={scenarioPriceSliderMin}
                          max={scenarioPriceSliderMax}
                          step={1}
                          aria-label="Future stock price"
                          onFocus={() =>
                            setScenarioPriceDraft(String(scenarioPriceInputValue))
                          }
                          onBlur={(event) =>
                            commitScenarioPriceDraft(event.currentTarget.value)
                          }
                          onKeyDown={handleScenarioPriceKeyDown}
                          onInput={(event) =>
                            updateScenarioPriceDraft(event.currentTarget.value)
                          }
                          onChange={(event) =>
                            updateScenarioPriceDraft(event.target.value)
                          }
                          className="w-full border-0 bg-transparent p-0 font-mono text-right text-sm font-medium text-slate-950 outline-none tabular-nums"
                        />
                      </div>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={scenarioPriceSliderMin}
                    max={scenarioPriceSliderMax}
                    step={1}
                    value={safeScenarioPrice}
                    aria-label="Future stock price"
                    onChange={(event) =>
                      updateScenarioPrice(Number(event.target.value))
                    }
                    onMouseDown={blurFocusedField}
                    onPointerDown={blurFocusedField}
                    onTouchStart={blurFocusedField}
                    className="mt-2.5 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-[#e63946]"
                  />
                  <div className="mt-1.5 grid min-h-5 grid-cols-[3.5rem_minmax(0,1fr)_3.5rem] items-start gap-1 font-mono text-[10px] text-slate-500 tabular-nums sm:text-[11px]">
                    <span className="whitespace-nowrap">{formatCurrency(scenarioPriceSliderMin)}</span>
                    <span className="min-w-0 truncate whitespace-nowrap text-center text-slate-600">
                      {spot > 0
                        ? `${safeScenarioPrice >= spot ? "+" : ""}${Math.round(
                            ((safeScenarioPrice - spot) / spot) * 100,
                          )}% vs spot ${formatCurrency(spot)}`
                        : ""}
                    </span>
                    <span className="whitespace-nowrap text-right">{formatCurrency(scenarioPriceSliderMax)}</span>
                  </div>
                </div>

                <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-2.5 shadow-sm sm:p-3">
                  <div className="grid min-h-9 grid-cols-[minmax(0,1fr)_7rem] items-start gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="min-w-0 text-sm font-medium leading-tight text-slate-900 text-balance">Valuation date</p>
                      <InfoIcon
                        label={`The date used to estimate what each position could be worth before expiration.`}
                      />
                    </div>
                    <div className="w-[7rem] text-right">
                      <div className="truncate whitespace-nowrap font-mono text-sm leading-tight text-slate-950 tabular-nums">
                        {formatLongDate(snapshot.selectedDateIso)}
                      </div>
                      <div className="mt-1 truncate whitespace-nowrap text-[11px] leading-tight text-slate-500">
                        {snapshot.selectedOffsetDays} days from today
                      </div>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={expirationDays}
                    step={1}
                    value={safeScenarioOffsetDays}
                    disabled={expirationDays === 0}
                    aria-label="Valuation date"
                    onChange={(event) =>
                      updateScenarioOffsetDays(Number(event.target.value))
                    }
                    onMouseDown={blurFocusedField}
                    onPointerDown={blurFocusedField}
                    onTouchStart={blurFocusedField}
                    className="mt-2.5 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-[#e63946]"
                  />
                  <div className="mt-1.5 grid min-h-5 grid-cols-2 gap-2 font-mono text-[10px] leading-tight text-slate-500 tabular-nums sm:text-[11px]">
                    <span className="truncate whitespace-nowrap">{formatLongDate(todayIso)}</span>
                    <span className="truncate whitespace-nowrap text-right">{formatLongDate(expiryIso)}</span>
                  </div>
                </div>

                <NumberSliderField
                  label="Future IV"
                  help={`Used to estimate each position value on the selected future date.`}
                  min={0}
                  max={150}
                  step={1}
                  value={futureVolatilityPct}
                  onChange={updateFutureScenarioVolatilityPct}
                  suffix="%"
                  className="p-2.5 sm:p-3"
                  headerClassName="min-h-9 grid grid-cols-[minmax(0,1fr)_6.25rem] items-start gap-2 sm:grid-cols-[minmax(0,1fr)_6.25rem] sm:items-start"
                  sliderClassName="mt-2.5"
                />
              </div>
            </SectionCard>

            {canModel && comparisonPanelMode === "presets" && comparisonCards.length > 0 ? (
              <OptionComparisonBoard
                cards={comparisonCards}
                scenarioDateLabel={formatLongDate(snapshot.selectedDateIso)}
                scenarioPrice={safeScenarioPrice}
                symbol={symbol}
              />
            ) : null}

            <SectionCard
              title="Scenario curve"
              eyebrow={`${symbol.trim() || "Underlying"} profit & loss by stock price · ${selectedGraphComparison.label}`}
              action={
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                  <label className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 shadow-sm sm:w-72">
                    <span className="text-xs font-semibold text-slate-500">
                      Strategy
                    </span>
                    <select
                      value={selectedGraphComparison.id}
                      onChange={(event) => setGraphComparisonId(event.target.value)}
                      title={selectedGraphComparison.detail}
                      className="min-w-0 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-800 shadow-sm outline-none focus:border-[#e63946]"
                      aria-label="Scenario curve strategy"
                    >
                      {graphComparisonOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div
                    className="grid w-full min-w-0 grid-cols-3 rounded-lg border border-slate-200 bg-slate-100 p-1 sm:inline-flex sm:w-auto sm:grid-cols-none"
                    aria-label="Scenario graph view"
                  >
                    {scenarioGraphOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={activeScenarioGraphView === option.value}
                        onPointerDown={() =>
                          setScenarioGraphView(option.value as ScenarioGraphView)
                        }
                        onMouseDown={() =>
                          setScenarioGraphView(option.value as ScenarioGraphView)
                        }
                        onClick={() =>
                          setScenarioGraphView(option.value as ScenarioGraphView)
                        }
                        className={cn(
                          "min-w-0 truncate rounded-md px-1.5 py-1.5 text-center text-xs font-medium text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e63946] min-[360px]:text-sm sm:px-3",
                          activeScenarioGraphView === option.value &&
                            "bg-white text-slate-950 shadow-sm",
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              }
            >
              <div className="space-y-4">
                {showScenarioSelectionControls ? (
                  <>
                    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                      <div className="grid divide-y divide-slate-200 md:grid-cols-3 md:divide-x md:divide-y-0">
                        <div className="grid min-w-0 grid-rows-[auto_2.25rem_auto] gap-2.5 p-3 lg:p-4">
                          <div className="grid grid-cols-[minmax(0,1fr)_7rem] items-baseline gap-2">
                            <p className="text-xs font-semibold uppercase text-slate-500 text-balance">
                              At your scenario
	                            </p>
	                            <p className="truncate text-right font-mono text-[11px] text-slate-500 tabular-nums">
	                              {formatCurrency(safeScenarioPrice)} · {formatLongDate(visualizedSnapshot.selectedDateIso)}
	                            </p>
	                          </div>
	                          <p
	                            className={cn(
		                              "overflow-hidden whitespace-nowrap font-[family:var(--font-space-grotesk)] text-2xl font-semibold leading-none tabular-nums",
	                              visualizedSnapshot.pnl >= 0 ? "text-emerald-700" : "text-rose-700",
	                            )}
	                          >
	                            {visualizedSnapshot.pnl >= 0 ? "+" : ""}
	                            {formatCurrency(visualizedSnapshot.pnl)}
	                          </p>
		                          <div className="grid grid-cols-[minmax(0,1fr)_7rem] items-baseline gap-2 text-sm">
	                            <span className="font-medium text-slate-500">
	                              {visualizedSnapshot.pnl >= 0 ? "Profit" : "Loss"}
	                              {" · "}
	                              <span
	                                className={cn(
	                                  "font-mono font-semibold tabular-nums",
	                                  visualizedSnapshot.roi >= 0 ? "text-emerald-700" : "text-rose-700",
	                                )}
	                              >
	                                {visualizedSnapshot.totalCost > 0 ? formatPercent(visualizedSnapshot.roi) : "N/A"}
	                              </span>
	                            </span>
	                            <span className="truncate text-right font-mono text-xs text-slate-500 tabular-nums">
	                              Position {formatCurrency(visualizedSnapshot.scenarioPositionValue)}
	                            </span>
	                          </div>
	                        </div>

	                        {visualizedSnapshot.isProfitCapped ? (
		                      <div className="grid min-w-0 grid-rows-[auto_2.25rem_auto] gap-2.5 p-3 lg:p-4">
		                        <div className="grid grid-cols-[minmax(0,1fr)_6rem] items-baseline gap-2">
	                          <p className="text-xs font-semibold uppercase text-slate-500 text-balance">
	                            Best case at expiry
	                          </p>
	                          <p className="truncate text-right font-mono text-[11px] text-slate-500 tabular-nums">
	                            ≥ {formatCurrency(visualizedSnapshot.breakEvenAtExpiry)}
	                          </p>
	                        </div>
		                        <p className="overflow-hidden whitespace-nowrap font-[family:var(--font-space-grotesk)] text-2xl font-semibold leading-none text-emerald-700 tabular-nums">
	                          +{formatCurrency(visualizedMaxProfitAtExpiry ?? 0)}
	                        </p>
		                        <div className="grid grid-cols-[minmax(0,1fr)_6rem] items-baseline gap-2 text-sm">
	                          <span className="font-medium text-slate-500">
	                            Max profit ·{" "}
	                            <span className="font-mono font-semibold text-emerald-700 tabular-nums">
	                              {visualizedMaxReturnAtExpiry !== null ? formatPercent(visualizedMaxReturnAtExpiry) : "N/A"}
	                            </span>
	                          </span>
	                          <span className="truncate text-right font-mono text-xs text-slate-500 tabular-nums">
	                            B/E {formatCurrency(visualizedSnapshot.breakEvenAtExpiry)}
	                          </span>
	                        </div>
	                      </div>
                    ) : (
	                      <div className="grid min-w-0 grid-rows-[auto_2.25rem_auto] gap-2.5 p-3 lg:p-4">
	                        <div className="grid grid-cols-[minmax(0,1fr)_6rem] items-baseline gap-2">
	                          <p className="text-xs font-semibold uppercase text-slate-500 text-balance">
	                            Upside at expiry
	                          </p>
	                          <p className="truncate text-right font-mono text-[11px] text-slate-500 tabular-nums">
	                            ≥ {formatCurrency(visualizedSnapshot.breakEvenAtExpiry)}
	                          </p>
	                        </div>
                        <p className="overflow-hidden whitespace-nowrap font-[family:var(--font-space-grotesk)] text-2xl font-semibold leading-none text-emerald-700 tabular-nums">
                          Uncapped
                        </p>
	                        <div className="grid grid-cols-[minmax(0,1fr)_6rem] items-baseline gap-2 text-sm">
                          <span className="font-medium text-slate-500">
                            Long calls have no profit ceiling.
	                          </span>
	                          <span className="truncate text-right font-mono text-xs text-slate-500 tabular-nums">
	                            B/E {formatCurrency(visualizedSnapshot.breakEvenAtExpiry)}
	                          </span>
	                        </div>
                      </div>
                    )}

                        <div className="grid min-w-0 grid-rows-[auto_2.25rem_auto] gap-2.5 p-3 lg:p-4">
                          <div className="grid grid-cols-[minmax(0,1fr)_6rem] items-baseline gap-2">
                            <p className="text-xs font-semibold uppercase text-slate-500 text-balance">
	                            Worst case at expiry
	                          </p>
	                          <p className="truncate text-right font-mono text-[11px] text-slate-500 tabular-nums">
	                            &lt; {formatCurrency(visualizedInputs.longStrike)}
	                          </p>
	                        </div>
		                          <p className="overflow-hidden whitespace-nowrap font-[family:var(--font-space-grotesk)] text-2xl font-semibold leading-none text-rose-700 tabular-nums">
	                            {formatCurrency(visualizedMaxLossAtExpiry)}
	                          </p>
                          <div className="grid grid-cols-[minmax(0,1fr)_6rem] items-baseline gap-2 text-sm">
                            <span className="font-medium text-slate-500">
                              Max loss ·{" "}
	                              <span className="font-mono font-semibold text-rose-700 tabular-nums">
	                                {visualizedSnapshot.totalCost > 0 ? "-100%" : "N/A"}
	                              </span>
	                            </span>
	                            <span className="truncate text-right font-mono text-xs text-slate-500 tabular-nums">
	                              Cost {formatCurrency(visualizedSnapshot.totalCost)}
	                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid min-w-0 gap-2.5 md:grid-cols-3">
                  <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-2.5 shadow-sm sm:p-3">
                    <div className="grid min-h-9 grid-cols-[minmax(0,1fr)_6.25rem] items-start gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="min-w-0 text-sm font-medium leading-tight text-slate-900 text-balance">Future stock price</p>
                        <InfoIcon label="The stock price to test on the selected future date." />
                      </div>
                      <div className="w-[6.25rem] min-w-0 shrink-0">
                        <div className="flex items-center rounded-md border border-slate-300 bg-white px-2 py-1.5">
                          <span className="text-sm text-slate-500">$</span>
                          <input
                            type="number"
                            value={displayedScenarioPriceInputValue}
                            min={scenarioPriceSliderMin}
                            max={scenarioPriceSliderMax}
                            step={1}
                            aria-label="Future stock price"
                            onFocus={() =>
                              setScenarioPriceDraft(String(scenarioPriceInputValue))
                            }
                            onBlur={(event) =>
                              commitScenarioPriceDraft(event.currentTarget.value)
                            }
                            onKeyDown={handleScenarioPriceKeyDown}
                            onInput={(event) =>
                              updateScenarioPriceDraft(event.currentTarget.value)
                            }
                            onChange={(event) =>
                              updateScenarioPriceDraft(event.target.value)
                            }
                            className="w-full border-0 bg-transparent p-0 font-mono text-right text-sm font-medium text-slate-950 outline-none tabular-nums"
                          />
                        </div>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={scenarioPriceSliderMin}
                      max={scenarioPriceSliderMax}
                      step={1}
                      value={safeScenarioPrice}
                      aria-label="Future stock price"
                      onChange={(event) =>
                        updateScenarioPrice(Number(event.target.value))
                      }
                      onMouseDown={blurFocusedField}
                      onPointerDown={blurFocusedField}
                      onTouchStart={blurFocusedField}
                      className="mt-2.5 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-[#e63946]"
                    />
                    <div className="mt-1.5 grid min-h-5 grid-cols-[3.5rem_minmax(0,1fr)_3.5rem] items-start gap-1 font-mono text-[10px] text-slate-500 tabular-nums sm:text-[11px]">
                      <span className="whitespace-nowrap">{formatCurrency(scenarioPriceSliderMin)}</span>
                      <span className="min-w-0 truncate whitespace-nowrap text-center text-slate-600">
                        {spot > 0
                          ? `${safeScenarioPrice >= spot ? "+" : ""}${Math.round(
                              ((safeScenarioPrice - spot) / spot) * 100,
                            )}% vs spot ${formatCurrency(spot)}`
                          : ""}
                      </span>
                      <span className="whitespace-nowrap text-right">{formatCurrency(scenarioPriceSliderMax)}</span>
                    </div>
                  </div>

                  <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-2.5 shadow-sm sm:p-3">
                    <div className="grid min-h-9 grid-cols-[minmax(0,1fr)_7rem] items-start gap-2">
	                      <div className="flex min-w-0 items-center gap-2">
	                        <p className="min-w-0 text-sm font-medium leading-tight text-slate-900 text-balance">Valuation date</p>
	                        <InfoIcon
	                          label={`The date used to estimate what the ${visualizedStrategyCopy.unitName} could be worth before expiration.`}
	                        />
	                      </div>
	                      <div className="w-[7rem] text-right">
	                        <div className="truncate whitespace-nowrap font-mono text-sm leading-tight text-slate-950 tabular-nums">
	                          {formatLongDate(visualizedSnapshot.selectedDateIso)}
	                        </div>
	                        <div className="mt-1 truncate whitespace-nowrap text-[11px] leading-tight text-slate-500">
	                          {visualizedSnapshot.selectedOffsetDays} days from today
	                        </div>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={expirationDays}
                      step={1}
                      value={safeScenarioOffsetDays}
                      disabled={expirationDays === 0}
                      aria-label="Valuation date"
                      onChange={(event) =>
                        updateScenarioOffsetDays(Number(event.target.value))
                      }
                      onMouseDown={blurFocusedField}
                      onPointerDown={blurFocusedField}
                      onTouchStart={blurFocusedField}
                      className="mt-2.5 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-[#e63946]"
                    />
                    <div className="mt-1.5 grid min-h-5 grid-cols-2 gap-2 font-mono text-[10px] leading-tight text-slate-500 tabular-nums sm:text-[11px]">
                      <span className="truncate whitespace-nowrap">{formatLongDate(todayIso)}</span>
                      <span className="truncate whitespace-nowrap text-right">{formatLongDate(expiryIso)}</span>
                    </div>
                  </div>

	                  <NumberSliderField
	                    label="Future IV"
	                    help={`Used to estimate the ${visualizedStrategyCopy.unitName} value on the selected future date.`}
                    min={0}
                    max={150}
                    step={1}
                    value={futureVolatilityPct}
                    onChange={updateFutureScenarioVolatilityPct}
                    suffix="%"
                    className="p-2.5 sm:p-3"
                    headerClassName="min-h-9 grid grid-cols-[minmax(0,1fr)_6.25rem] items-start gap-2 sm:grid-cols-[minmax(0,1fr)_6.25rem] sm:items-start"
                    sliderClassName="mt-2.5"
                  />
                    </div>
                  </>
                ) : null}

                {validationMessages.length > 0 ? (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
                    <p className="font-medium">Fix these inputs first</p>
                    <ul className="mt-2 space-y-1">
                      {validationMessages.map((message) => (
                        <li key={message}>{message}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

	                {canModel && activeScenarioGraphView === "map" ? (
	                  <DebitSpreadScenarioVisualizer
	                    key={`heatmap-${graphRenderKey}`}
	                    inputs={visualizedScenarioVisualizerInputs}
	                  />
	                ) : null}

	                {canModel && activeScenarioGraphView === "decay" ? (
	                  <TimeDecayChart
	                    title={`${visualizedStrategyCopy.unitTitle} value over time`}
	                    subtitle={`At a fixed underlying price of ${formatCurrency(
	                      safeScenarioPrice,
	                    )} and ${futureVolatilityPct}% IV. Hover to read the ${visualizedStrategyCopy.unitName}'s value and P/L on any date.`}
	                    points={decayPoints}
	                    expirationDays={expirationDays}
	                    selectedOffsetDays={safeScenarioOffsetDays}
	                    selectedPositionValue={visualizedSnapshot.scenarioPositionValue}
	                    selectedPnl={visualizedSnapshot.pnl}
	                    totalCost={visualizedSnapshot.totalCost}
	                    scenarioPriceLabel={formatCurrency(safeScenarioPrice)}
	                  />
                ) : null}

	                {canModel && activeScenarioGraphView === "overlay" ? (
	                  <DebitSpreadScenarioVisualizer
	                    key={`multi-${graphRenderKey}`}
	                    inputs={visualizedScenarioVisualizerInputs}
	                    view="multi"
                    selectedUnderlyingPrice={safeScenarioPrice}
                    selectedDte={expirationDays - safeScenarioOffsetDays}
                  />
                ) : null}

                {!canModel ? (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
                    Clean up the inputs and the curve will appear here.
                  </div>
                ) : null}
              </div>
            </SectionCard>

            <ResultsTable
              title={`${strategyCopy.unitTitle} value over time at the selected stock price`}
              subtitle={`These rows keep ${symbol.trim() || "the stock"} fixed at ${formatCurrency(
                safeScenarioPrice,
              )} and move the date toward expiry.`}
              columns={timelineColumns}
              rows={timelineRows}
            />

            <ResultsTable
              title={`${strategyCopy.unitTitle} value by stock price on the selected date`}
              subtitle={`These rows keep the date fixed at ${formatLongDate(
                snapshot.selectedDateIso,
              )} and move the underlying price.`}
              columns={priceColumns}
              rows={priceRows}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
