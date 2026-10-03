"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import {
  normalizeCallCalendarShortExpirationDays,
  normalizePutRatioShortCount,
} from "@/lib/debit-call-spread";
import {
  calculateDebitSpreadScenario,
  buildDebitSpreadScenarioGrid,
  getDebitSpreadMetricValue,
} from "@/lib/options/debitSpreadScenarios";
import type {
  DebitSpreadScenarioInputs,
  DebitSpreadScenarioMetric,
  DebitSpreadScenarioPoint,
} from "@/lib/options/debitSpreadScenarios";

type DebitSpreadScenarioVisualizerProps = {
  inputs: DebitSpreadScenarioInputs;
  view?: "heatmap" | "multi";
  selectedUnderlyingPrice?: number;
  selectedDte?: number;
};

const METRIC_OPTIONS: Array<{ value: DebitSpreadScenarioMetric; label: string }> = [
  { value: "positionValue", label: "Position value" },
  { value: "profitLoss", label: "P/L $" },
  { value: "profitLossPercent", label: "P/L %" },
  { value: "percentOfMaxProfitCaptured", label: "% max profit" },
];

const CHART_COLORS = {
  primary: "#0f766e",
  expiry: "#059669",
  selected: "var(--accent)",
  breakeven: "#0f172a",
  muted: "#64748b",
  grid: "#e2e8f0",
  paper: "#ffffff",
};

const CURVE_COLORS = ["#0f766e", "#334155", "#64748b", "#94a3b8", "#059669"];

function getRangeTrackStyle(value: number, min: number, max: number): CSSProperties {
  const span = max - min;
  const progress =
    span > 0 ? Math.min(Math.max(((value - min) / span) * 100, 0), 100) : 0;

  return {
    background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${progress}%, #e2e8f0 ${progress}%, #e2e8f0 100%)`,
  };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Object.is(Math.round(value), -0) ? 0 : Math.round(value));
}

function formatDecimalCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Object.is(value, -0) ? 0 : value);
}

function formatPercent(value: number): string {
  const safeValue = Object.is(value, -0) ? 0 : value;
  return `${safeValue >= 0 ? "+" : ""}${safeValue.toFixed(1)}%`;
}

function formatCompactNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }

  const normalizedValue = Object.is(value, -0) ? 0 : value;
  return String(Math.round(normalizedValue * 100) / 100)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*?)0+$/, "$1");
}

function formatMetricValue(
  point: DebitSpreadScenarioPoint,
  metric: DebitSpreadScenarioMetric,
): string {
  if (metric === "profitLossPercent" || metric === "percentOfMaxProfitCaptured") {
    return formatPercent(point[metric]);
  }

  return formatCurrency(point[metric]);
}

function scenarioTooltip(
  point: DebitSpreadScenarioPoint,
  isLongCall = false,
  isBearPut = false,
  isPutSpread = false,
  isRatioSpread = false,
  isCallCalendar = false,
  ratioShortCount = 2,
): string {
  const shortCount = normalizePutRatioShortCount(ratioShortCount);
  const rows = [
    `Underlying: ${formatCurrency(point.underlyingPrice)}`,
    `DTE: ${point.dte}`,
  ];

  if (isLongCall || isBearPut) {
    rows.push(`${isBearPut ? "Put" : "Call"}: ${formatDecimalCurrency(point.spreadValue)}`);
  } else {
    rows.push(
      `Long ${isPutSpread ? "put" : "call"}: ${formatDecimalCurrency(point.longCallValue)}`,
      `Short ${isPutSpread ? "put" : "call"}${isRatioSpread ? ` x${shortCount}` : ""}: ${formatDecimalCurrency(
        isRatioSpread ? point.shortCallValue * shortCount : point.shortCallValue,
      )}`,
      `${isCallCalendar ? "Calendar" : isRatioSpread ? "Ratio" : "Spread"}: ${formatDecimalCurrency(point.spreadValue)}`,
    );
  }

  rows.push(
    `Position value: ${formatCurrency(point.positionValue)}`,
    `P/L: ${formatCurrency(point.profitLoss)}`,
    `P/L %: ${formatPercent(point.profitLossPercent)}`,
  );

  if (!isLongCall) {
    rows.push(`% max profit: ${formatPercent(point.percentOfMaxProfitCaptured)}`);
  }

  return rows.join("\n");
}

// Blue for profit and orange for loss stay distinguishable with red-green
// colour blindness; lightness carries the size of the result.
function cellColor(point: DebitSpreadScenarioPoint, maxProfit: number | null, maxLoss: number | null): string {
  const nearBreakEvenLimit = Math.max(maxProfit ?? 0, maxLoss ?? 0) * 0.02;

  if (Math.abs(point.profitLoss) <= nearBreakEvenLimit) {
    return "border border-line-strong bg-slate-200 text-ink";
  }

  if (point.profitLoss > 0) {
    const ratio = Math.min(point.profitLoss / Math.max(maxProfit ?? Math.abs(point.profitLoss), 1), 1);

    if (ratio > 0.75) return "bg-blue-800 text-white";
    if (ratio > 0.45) return "bg-blue-600 text-white";
    if (ratio > 0.2) return "bg-blue-200 text-blue-950";
    return "border border-blue-200 bg-blue-50 text-blue-950";
  }

  if (point.profitLoss < 0) {
    const ratio = Math.min(Math.abs(point.profitLoss) / Math.max(maxLoss ?? Math.abs(point.profitLoss), 1), 1);

    if (ratio > 0.65) return "bg-orange-700 text-white";
    if (ratio > 0.35) return "bg-orange-300 text-orange-950";
    return "border border-orange-200 bg-orange-50 text-orange-950";
  }

  return "border border-line-strong bg-slate-200 text-ink";
}

function buildPriceSeries(currentPrice: number, steps = 61): number[] {
  const minPrice = Math.max(1, currentPrice * 0.7);
  const maxPrice = Math.max(minPrice + 1, currentPrice * 1.3);

  return Array.from({ length: steps }, (_, index) =>
    Math.round(minPrice + ((maxPrice - minPrice) * index) / Math.max(steps - 1, 1)),
  );
}

function buildPriceSeriesWithSelection(currentPrice: number, selectedPrice: number): number[] {
  return [...new Set([...buildPriceSeries(currentPrice), Math.round(selectedPrice)])].sort(
    (first, second) => first - second,
  );
}

function spreadChartLabelPositions(
  labels: Array<{ id: number; y: number }>,
  minY: number,
  maxY: number,
  minimumGap: number,
): Map<number, number> {
  const sortedLabels = labels
    .map((label) => ({ ...label }))
    .sort((first, second) => first.y - second.y);

  sortedLabels.forEach((label, index) => {
    label.y = Math.max(
      label.y,
      index === 0 ? minY : sortedLabels[index - 1].y + minimumGap,
    );
  });

  const overflow = Math.max((sortedLabels.at(-1)?.y ?? maxY) - maxY, 0);
  if (overflow > 0) {
    sortedLabels.forEach((label) => {
      label.y -= overflow;
    });
  }

  return new Map(sortedLabels.map((label) => [label.id, label.y]));
}

function buildEvenDteBuckets(
  currentDte: number,
  steps: number,
  requiredDtes: number[] = [],
): number[] {
  const safeCurrentDte = Math.max(0, Math.round(currentDte));
  const safeSteps = Math.min(Math.max(Math.round(steps), 2), safeCurrentDte + 1);
  const evenBuckets = Array.from({ length: safeSteps }, (_, index) =>
    Math.round(safeCurrentDte - (safeCurrentDte * index) / Math.max(safeSteps - 1, 1)),
  );

  return [
    ...new Set([
      ...evenBuckets,
      ...requiredDtes.map((dte) => normalizeDte(dte, safeCurrentDte)),
    ]),
  ].sort((first, second) => second - first);
}

function normalizeDte(dte: number, currentDte: number): number {
  return Math.max(0, Math.min(currentDte, Math.round(dte)));
}

function findNearestScenarioPoint(
  points: DebitSpreadScenarioPoint[],
  underlyingPrice: number,
  dte: number,
): DebitSpreadScenarioPoint | undefined {
  return points
    .filter((point) => point.dte === dte)
    .sort(
      (first, second) =>
        Math.abs(first.underlyingPrice - underlyingPrice) -
        Math.abs(second.underlyingPrice - underlyingPrice),
    )[0];
}

function makePath(
  points: DebitSpreadScenarioPoint[],
  x: (price: number) => number,
  y: (value: number) => number,
  metric: DebitSpreadScenarioMetric,
): string {
  return points
    .map((point, index) => {
      const command = index === 0 ? "M" : "L";
      return `${command} ${x(point.underlyingPrice)} ${y(getDebitSpreadMetricValue(point, metric))}`;
    })
    .join(" ");
}

function blurFocusedField() {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
}

function MobileRangeValueControl({
  label,
  prefix = "",
  suffix = "",
  min,
  max,
  step = 1,
  value,
  onChange,
}: {
  label: string;
  prefix?: string;
  suffix?: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
}) {
  const safeMin = Math.min(min, max);
  const safeMax = Math.max(min, max);
  const safeValue = clampValue(value, safeMin, safeMax);

  return (
    <div className="mt-1 sm:hidden">
      <div className="flex items-center gap-2 rounded-md border border-line-strong bg-surface px-2.5 py-1.5">
        {prefix ? <span className="text-sm text-ink-muted">{prefix}</span> : null}
        <input
          type="number"
          min={safeMin}
          max={safeMax}
          step={step}
          value={safeValue}
          aria-label={label}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
          }}
          onChange={(event) => onChange(Number(event.target.value))}
          className="min-w-0 flex-1 border-0 bg-transparent p-0 font-mono text-right text-sm font-semibold text-ink outline-none tabular-nums"
        />
        {suffix ? <span className="text-sm text-ink-muted">{suffix}</span> : null}
      </div>
      <input
        type="range"
        min={safeMin}
        max={safeMax}
        step={step}
        value={safeValue}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
        onMouseDown={blurFocusedField}
        onPointerDown={blurFocusedField}
        onTouchStart={blurFocusedField}
        style={getRangeTrackStyle(safeValue, safeMin, safeMax)}
        className="mt-2 h-2 w-full min-w-0 cursor-pointer appearance-none rounded-full bg-slate-200 accent-accent"
      />
    </div>
  );
}

function clampValue(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function HeatmapTab({
  grid,
  metric,
  selectedScenario,
  isLongCall,
  isBearPut,
  isPutSpread,
  isRatioSpread,
  isCallCalendar,
  ratioShortCount,
  onPreview,
  onClearPreview,
  onLock,
}: {
  grid: ReturnType<typeof buildDebitSpreadScenarioGrid>;
  metric: DebitSpreadScenarioMetric;
  selectedScenario: DebitSpreadScenarioPoint;
  isLongCall: boolean;
  isBearPut: boolean;
  isPutSpread: boolean;
  isRatioSpread: boolean;
  isCallCalendar: boolean;
  ratioShortCount: number;
  onPreview: (scenario: DebitSpreadScenarioPoint) => void;
  onClearPreview: () => void;
  onLock: (scenario: DebitSpreadScenarioPoint) => void;
}) {
  const pointLookup = useMemo(() => {
    const lookup = new Map<string, DebitSpreadScenarioPoint>();
    grid.points.forEach((point) => lookup.set(`${point.underlyingPrice}-${point.dte}`, point));
    return lookup;
  }, [grid.points]);
  const displayedPriceBuckets = useMemo(
    () => [...grid.priceBuckets].reverse(),
    [grid.priceBuckets],
  );
  const selectedDte = grid.dteBuckets.includes(selectedScenario.dte)
    ? selectedScenario.dte
    : grid.dteBuckets[0] ?? 0;
  const selectedDtePoints = useMemo(
    () =>
      displayedPriceBuckets.flatMap((price) => {
        const point = pointLookup.get(`${price}-${selectedDte}`);
        return point ? [point] : [];
      }),
    [displayedPriceBuckets, pointLookup, selectedDte],
  );
  const selectDte = (dte: number) => {
    const nextPoint =
      findNearestScenarioPoint(grid.points, selectedScenario.underlyingPrice, dte) ??
      grid.points.find((point) => point.dte === dte);

    if (nextPoint) {
      onLock(nextPoint);
    }
  };

  return (
    <div className="min-w-0 rounded-lg border border-line bg-surface-muted p-3">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink text-balance">
            At stock price X and DTE Y
          </h3>
          <p className="mt-1 text-xs text-ink-muted text-pretty">
            Theoretical estimates using the selected IV and Black-Scholes for non-expiry cells.
          </p>
        </div>
        <div className="flex items-center gap-2 text-caption text-ink-secondary">
          <span className="size-3 rounded-sm bg-orange-700" />
          Loss
          <span className="size-3 rounded-sm border border-line-strong bg-slate-200" />
          Near B/E
          <span className="size-3 rounded-sm bg-blue-800" />
          Profit
        </div>
      </div>
      <div className="space-y-3 sm:hidden">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {grid.dteBuckets.map((dte) => (
            <button
              key={`mobile-dte-${dte}`}
              type="button"
              aria-pressed={selectedDte === dte}
              onClick={() => selectDte(dte)}
              className={cn(
                "shrink-0 rounded-md border border-line bg-surface px-3 py-2 font-mono text-xs font-semibold text-ink-secondary tabular-nums shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                selectedDte === dte && "border-accent bg-accent-soft text-ink",
              )}
            >
              {dte} DTE
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {selectedDtePoints.map((point) => {
            const isSelected =
              selectedScenario.underlyingPrice === point.underlyingPrice &&
              selectedScenario.dte === point.dte;

            return (
              <button
                key={`mobile-${point.underlyingPrice}-${point.dte}`}
                type="button"
                title={scenarioTooltip(point, isLongCall, isBearPut, isPutSpread, isRatioSpread, isCallCalendar, ratioShortCount)}
                aria-label={`${formatCurrency(point.underlyingPrice)} at ${point.dte} DTE: ${formatMetricValue(point, metric)}`}
                onFocus={() => onPreview(point)}
                onBlur={onClearPreview}
                onClick={() => onLock(point)}
                className={cn(
                  "grid min-h-12 w-full grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-3 py-2 text-left shadow-sm outline-none",
                  "focus-visible:ring-2 focus-visible:ring-accent",
                  cellColor(point, grid.summary.maxProfit, grid.summary.maxLoss),
                  isSelected && "relative z-10 ring-2 ring-slate-950 ring-offset-2",
                )}
              >
                <span className="font-mono text-xs font-semibold tabular-nums">
                  {formatCurrency(point.underlyingPrice)}
                </span>
                <span className="truncate text-xs font-medium">
                  {point.profitLoss >= 0 ? "Profit" : "Loss"} {formatCurrency(point.profitLoss)}
                </span>
                <span className="font-mono text-sm font-semibold tabular-nums">
                  {formatMetricValue(point, metric)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="hidden overflow-x-auto sm:block">
        <div
          className="grid min-w-[760px] gap-1"
          style={{
            gridTemplateColumns: `4.5rem repeat(${grid.dteBuckets.length}, minmax(4.75rem, 1fr))`,
          }}
        >
          <div className="text-micro font-semibold uppercase text-ink-muted">Price</div>
          {grid.dteBuckets.map((dte) => (
            <div
              key={`dte-head-${dte}`}
              className="text-center font-mono text-caption font-semibold text-ink-secondary tabular-nums"
            >
              {dte} DTE
            </div>
          ))}
          {displayedPriceBuckets.map((price) => (
            <div key={`price-row-${price}`} className="contents">
              <div className="flex items-center justify-end pr-2 font-mono text-caption text-ink-muted tabular-nums">
                {formatCurrency(price)}
              </div>
              {grid.dteBuckets.map((dte) => {
                const point = pointLookup.get(`${price}-${dte}`);
                if (!point) return null;

                const isSelected =
                  selectedScenario.underlyingPrice === point.underlyingPrice &&
                  selectedScenario.dte === point.dte;

                return (
                  <button
                    key={`${price}-${dte}`}
                    type="button"
                    title={scenarioTooltip(point, isLongCall, isBearPut, isPutSpread, isRatioSpread, isCallCalendar, ratioShortCount)}
                    aria-label={`${formatCurrency(price)} at ${dte} DTE: ${formatMetricValue(point, metric)}`}
                    onMouseEnter={() => onPreview(point)}
                    onMouseLeave={onClearPreview}
                    onFocus={() => onPreview(point)}
                    onBlur={onClearPreview}
                    onClick={() => onLock(point)}
                    className={cn(
                      "min-h-8 rounded-md px-1.5 py-1 text-center font-mono text-caption font-semibold shadow-sm outline-none tabular-nums",
                      "focus-visible:ring-2 focus-visible:ring-accent",
                      cellColor(point, grid.summary.maxProfit, grid.summary.maxLoss),
                      isSelected && "relative z-10 ring-2 ring-slate-950 ring-offset-2",
                    )}
                  >
                    {formatMetricValue(point, metric)}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MultiDateTab({
  inputs,
  selectedScenario,
  onPreview,
  onClearPreview,
  onLock,
}: {
  inputs: DebitSpreadScenarioInputs;
  selectedScenario: DebitSpreadScenarioPoint;
  onPreview: (scenario: DebitSpreadScenarioPoint) => void;
  onClearPreview: () => void;
  onLock: (scenario: DebitSpreadScenarioPoint) => void;
}) {
  const isLongCall = inputs.strategy === "long-call";
  const isBearPut = inputs.strategy === "bear-put";
  const isPutRatioSpread = inputs.strategy === "put-ratio-spread";
  const isCallRatioSpread = inputs.strategy === "call-ratio-spread";
  const isCallCalendar = inputs.strategy === "call-calendar";
  const isRatioSpread = isPutRatioSpread || isCallRatioSpread;
  const isPutSpread =
    inputs.strategy === "debit-put-spread" ||
    isPutRatioSpread;
  const width = 820;
  const height = 340;
  const padding = { top: 28, right: 90, bottom: 52, left: 78 };
  const prices = useMemo(
    () => buildPriceSeriesWithSelection(inputs.currentPrice, selectedScenario.underlyingPrice),
    [inputs.currentPrice, selectedScenario.underlyingPrice],
  );
  const selectedDte = normalizeDte(selectedScenario.dte, inputs.currentDte);
  const calendarShortExpiryDte = Math.max(
    inputs.currentDte -
      normalizeCallCalendarShortExpirationDays(
        inputs.shortExpirationDays,
        inputs.currentDte,
      ),
    0,
  );
  const [savedDtes, setSavedDtes] = useState<number[]>([]);
  const savedDteEntries = useMemo(
    () =>
      [...new Set(savedDtes.map((dte) => normalizeDte(dte, inputs.currentDte)))]
        .filter((dte) => dte !== inputs.currentDte && dte !== 0)
        .sort((first, second) => second - first),
    [inputs.currentDte, savedDtes],
  );
  const dteEntries = useMemo(
    () => {
      const entries = [
        { dte: inputs.currentDte, label: "Today", removable: false },
        ...(isCallCalendar
          ? [
              {
                dte: calendarShortExpiryDte,
                label: "Short expiry",
                removable: false,
              },
            ]
          : []),
        ...savedDteEntries.map((dte) => ({
          dte,
          label: `${dte} DTE`,
          removable: true,
        })),
        {
          dte: selectedDte,
          label:
            selectedDte === inputs.currentDte
              ? "Today"
              : selectedDte === 0
                ? "Expiry"
                : `Selected ${selectedDte} DTE`,
          removable: false,
        },
        { dte: 0, label: "Expiry", removable: false },
      ];
      const seen = new Set<number>();

      return entries.filter((entry) => {
        if (seen.has(entry.dte)) return false;
        seen.add(entry.dte);
        return true;
      });
    },
    [
      calendarShortExpiryDte,
      inputs.currentDte,
      isCallCalendar,
      savedDteEntries,
      selectedDte,
    ],
  );
  const canAddSelectedDte =
    selectedDte !== inputs.currentDte &&
    selectedDte !== 0 &&
    !savedDteEntries.includes(selectedDte);
  const [hoverTooltip, setHoverTooltip] = useState<{
    leftPct: number;
    topPct: number;
    price: number;
    rows: Array<{
      label: string;
      positionValue: number;
      profitLoss: number;
      profitLossPercent: number;
    }>;
  } | null>(null);
  const curves = dteEntries.map((entry) => ({
    ...entry,
    points: prices.map((price) => calculateDebitSpreadScenario(inputs, price, entry.dte)),
  }));
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const allPnl = curves.flatMap((curve) => curve.points.map((point) => point.profitLoss));
  const rawMin = Math.min(...allPnl, 0);
  const rawMax = Math.max(...allPnl, 1);
  const span = Math.max(rawMax - rawMin, 1);
  const yMin = rawMin - span * 0.08;
  const yMax = rawMax + span * 0.08;
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const x = (price: number) => padding.left + ((price - minPrice) / Math.max(maxPrice - minPrice, 1)) * chartWidth;
  const y = (value: number) => padding.top + ((yMax - value) / Math.max(yMax - yMin, 1)) * chartHeight;
  const curveEndLabelY = spreadChartLabelPositions(
    curves.map((curve) => ({
      id: curve.dte,
      y: y(curve.points[curve.points.length - 1].profitLoss) + 4,
    })),
    padding.top + 8,
    height - padding.bottom - 4,
    12,
  );
  const selectedPoint = calculateDebitSpreadScenario(
    inputs,
    selectedScenario.underlyingPrice,
    selectedScenario.dte,
  );
  const selectedX = x(selectedPoint.underlyingPrice);
  const selectedY = y(selectedPoint.profitLoss);
  const showSelectedMarker =
    selectedPoint.underlyingPrice >= minPrice &&
    selectedPoint.underlyingPrice <= maxPrice;
  const showTooltip = (point: DebitSpreadScenarioPoint) => {
    setHoverTooltip({
      leftPct: (x(point.underlyingPrice) / width) * 100,
      topPct: (y(point.profitLoss) / height) * 100,
      price: point.underlyingPrice,
      rows: curves.map((curve) => {
        const tooltipPoint = curve.points.find(
          (candidate) => candidate.underlyingPrice === point.underlyingPrice,
        );

        return {
          label: curve.label,
          positionValue: tooltipPoint?.positionValue ?? 0,
          profitLoss: tooltipPoint?.profitLoss ?? 0,
          profitLossPercent: tooltipPoint?.profitLossPercent ?? 0,
        };
      }),
    });
  };
  const showTooltipForPrice = (price: number) => {
    const previewPoint =
      curves.find((curve) => curve.dte === selectedDte)?.points.find(
        (point) => point.underlyingPrice === price,
      ) ??
      curves[0]?.points.find((point) => point.underlyingPrice === price);

    if (!previewPoint) return;

    onPreview(previewPoint);
    showTooltip(previewPoint);
  };
  const clearTooltip = () => {
    setHoverTooltip(null);
    onClearPreview();
  };

  return (
    <div className="min-w-0 rounded-lg border border-line bg-surface-muted p-3 shadow-sm">
      <div className="mb-3 flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink text-balance">
            P/L curves as expiry approaches
          </h3>
          <p className="mt-1 text-xs text-ink-muted text-pretty">
            Compare how the curve shifts across valuation dates at the same stock prices.
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-start gap-2 sm:justify-end">
          <button
            type="button"
            disabled={!canAddSelectedDte}
            onClick={() =>
              setSavedDtes((current) =>
                [...new Set([...current, selectedDte])].sort((first, second) => second - first),
              )
            }
            className="rounded-md border border-line-strong bg-surface px-2.5 py-1 text-xs font-semibold text-ink-soft shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add date
          </button>
          {dteEntries.map((entry, index) => (
            <span
              key={`date-chip-${entry.dte}-${entry.label}`}
              className="inline-flex min-w-0 items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-xs font-semibold text-ink-secondary"
            >
              <span className="size-2 rounded-full" style={{ backgroundColor: CURVE_COLORS[index % CURVE_COLORS.length] }} />
              {entry.label}
              {entry.removable ? (
                <button
                  type="button"
                  onClick={() =>
                    setSavedDtes((current) =>
                      current.filter((dte) => normalizeDte(dte, inputs.currentDte) !== entry.dte),
                    )
                  }
                  className="rounded px-1 text-micro font-semibold text-ink-muted hover:bg-surface-sunken hover:text-slate-900"
                >
                  Remove
                </button>
              ) : null}
            </span>
          ))}
        </div>
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img">
          <rect x={padding.left} y={padding.top} width={chartWidth} height={chartHeight} fill={CHART_COLORS.paper} />
          {[rawMin, 0, rawMax].map((tick, index) => (
            <g key={`multi-y-${index}`}>
              <line x1={padding.left} x2={width - padding.right} y1={y(tick)} y2={y(tick)} stroke={CHART_COLORS.grid} />
              <text x={padding.left - 10} y={y(tick) + 4} textAnchor="end" className="font-mono text-caption" fill={CHART_COLORS.muted}>
                {formatCurrency(tick)}
              </text>
            </g>
          ))}
          {curves.map((curve, index) => {
            const lastPoint = curve.points[curve.points.length - 1];
            return (
              <g key={`curve-${curve.dte}`}>
                <path
                  d={makePath(curve.points, x, y, "profitLoss")}
                  fill="none"
                  stroke={CURVE_COLORS[index % CURVE_COLORS.length]}
                  strokeWidth={curve.dte === 0 ? 2 : 2.25}
                  strokeDasharray={curve.dte === 0 ? "6 5" : undefined}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <text x={x(lastPoint.underlyingPrice) + 8} y={curveEndLabelY.get(curve.dte)} className="font-mono text-micro" fill={CURVE_COLORS[index % CURVE_COLORS.length]}>
                  {curve.label}
                </text>
              </g>
            );
          })}
          {prices.map((price, index) => {
            const previousPrice = prices[index - 1] ?? price;
            const nextPrice = prices[index + 1] ?? price;
            const previousX = index === 0 ? padding.left : (x(previousPrice) + x(price)) / 2;
            const nextX =
              index === prices.length - 1
                ? width - padding.right
                : (x(nextPrice) + x(price)) / 2;
            const hitWidth = Math.max(nextX - previousX, 4);
            const previewPoint =
              curves.find((curve) => curve.dte === selectedDte)?.points.find(
                (point) => point.underlyingPrice === price,
              ) ??
              curves[0]?.points.find((point) => point.underlyingPrice === price);

            return (
              <rect
                key={`multi-x-hit-${price}`}
                x={previousX}
                y={padding.top}
                width={hitWidth}
                height={chartHeight}
                fill="transparent"
                onMouseEnter={() => showTooltipForPrice(price)}
                onMouseMove={() => showTooltipForPrice(price)}
                onMouseLeave={clearTooltip}
                onFocus={() => showTooltipForPrice(price)}
                onBlur={clearTooltip}
                onClick={() => {
                  if (previewPoint) onLock(previewPoint);
                }}
                tabIndex={0}
              />
            );
          })}
          {showSelectedMarker ? (
            <g>
              <line
                x1={selectedX}
                x2={selectedX}
                y1={padding.top}
                y2={height - padding.bottom}
                stroke={CHART_COLORS.selected}
                strokeDasharray="4 4"
                strokeWidth={1.5}
              />
              <circle
                cx={selectedX}
                cy={selectedY}
                r={5}
                fill={CHART_COLORS.selected}
                stroke={CHART_COLORS.paper}
                strokeWidth={2}
              >
                <title>
                  {scenarioTooltip(
                    selectedPoint,
                    isLongCall,
                    isBearPut,
                    isPutSpread,
                    isRatioSpread,
                    isCallCalendar,
                    inputs.ratioShortCount,
                  )}
                </title>
              </circle>
            </g>
          ) : null}
          {[minPrice, inputs.currentPrice, maxPrice].map((tick) => (
            <text key={`multi-x-${tick}`} x={x(tick)} y={height - padding.bottom + 20} textAnchor="middle" className="font-mono text-caption" fill={CHART_COLORS.muted}>
              {formatCurrency(tick)}
            </text>
          ))}
        </svg>
        {hoverTooltip ? (
          <div
            className="pointer-events-none absolute z-10 w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-line bg-surface p-3 text-xs text-ink-secondary shadow-lg"
            style={{
              left: `${Math.min(Math.max(hoverTooltip.leftPct, 12), 76)}%`,
              top: `${Math.min(Math.max(hoverTooltip.topPct, 10), 72)}%`,
            }}
          >
            <p className="mb-2 font-mono font-semibold text-ink tabular-nums">
              Underlying {formatCurrency(hoverTooltip.price)}
            </p>
            <div className="space-y-1">
              {hoverTooltip.rows.map((row) => (
                <div key={row.label} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2">
                  <span className="font-semibold text-ink-soft">{row.label}</span>
                  <span className="min-w-0 font-mono tabular-nums">
                    Value {formatCurrency(row.positionValue)} · P/L{" "}
                    <span className={row.profitLoss >= 0 ? "text-gain" : "text-loss"}>
                      {formatCurrency(row.profitLoss)}
                    </span>{" "}
                    ({formatPercent(row.profitLossPercent)})
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ScenarioTable({
  selectedPoint,
  rows,
  isLongCall,
  isBearPut,
  isRatioSpread,
  isCallCalendar,
}: {
  selectedPoint: DebitSpreadScenarioPoint;
  rows: DebitSpreadScenarioPoint[];
  isLongCall: boolean;
  isBearPut: boolean;
  isRatioSpread: boolean;
  isCallCalendar: boolean;
}) {
  const dedupedRows = [
    selectedPoint,
    ...rows.filter(
      (row) =>
        row.underlyingPrice !== selectedPoint.underlyingPrice ||
        row.dte !== selectedPoint.dte,
    ),
  ].slice(0, 8);

  return (
    <div className="min-w-0 bg-surface">
      <div className="divide-y divide-slate-100 sm:hidden">
        {dedupedRows.map((row, index) => (
          <div
            key={`mobile-row-${row.underlyingPrice}-${row.dte}-${index}`}
            className={cn("px-3 py-3", index === 0 && "bg-accent-soft")}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-sm font-semibold text-ink tabular-nums">
                  {formatCurrency(row.underlyingPrice)}
                </p>
                <p className="mt-1 text-xs text-ink-muted">{row.dte} DTE</p>
              </div>
              <div className="text-right">
                <p
                  className={cn(
                    "font-mono text-sm font-semibold tabular-nums",
                    row.profitLoss >= 0 ? "text-gain" : "text-loss",
                  )}
                >
                  {formatCurrency(row.profitLoss)}
                </p>
                <p className="mt-1 font-mono text-xs text-ink-muted tabular-nums">
                  {formatPercent(row.profitLossPercent)}
                </p>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div>
                  <p className="font-semibold uppercase text-ink-muted">
                    {isLongCall ? "Call" : isBearPut ? "Put" : isCallCalendar ? "Calendar" : isRatioSpread ? "Ratio" : "Spread"}
                  </p>
                <p className="font-mono font-semibold text-ink tabular-nums">
                  {formatDecimalCurrency(row.spreadValue)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold uppercase text-ink-muted">Position</p>
                <p className="font-mono font-semibold text-ink tabular-nums">
                  {formatCurrency(row.positionValue)}
                </p>
              </div>
            </div>
            {!isLongCall && !isCallCalendar ? (
              <p
                className={cn(
                  "mt-2 font-mono text-xs font-semibold tabular-nums",
                  row.percentOfMaxProfitCaptured >= 0 ? "text-gain" : "text-loss",
                )}
              >
                {formatPercent(row.percentOfMaxProfitCaptured)} max profit
              </p>
            ) : null}
          </div>
        ))}
      </div>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[760px] border-collapse text-left text-xs">
          <thead className="bg-surface-muted text-micro uppercase text-ink-muted">
            <tr>
              <th className="px-4 py-2 font-semibold">Price</th>
              <th className="px-4 py-2 font-semibold">DTE</th>
              <th className="px-4 py-2 text-right font-semibold">
                  {isLongCall
                    ? "Call value"
                    : isBearPut
                      ? "Put value"
                    : isCallCalendar
                      ? "Calendar value"
                    : isRatioSpread
                      ? "Ratio value"
                    : "Spread value"}
              </th>
              <th className="px-4 py-2 text-right font-semibold">Position value</th>
              <th className="px-4 py-2 text-right font-semibold">P/L $</th>
              <th className="px-4 py-2 text-right font-semibold">P/L %</th>
              {!isLongCall && !isCallCalendar ? (
                <th className="px-4 py-2 text-right font-semibold">% max profit</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {dedupedRows.map((row, index) => (
              <tr
                key={`${row.underlyingPrice}-${row.dte}-${index}`}
                className={cn(index === 0 ? "bg-accent-soft" : "border-t border-slate-100")}
              >
                <td className="px-4 py-2 font-mono tabular-nums text-ink">{formatCurrency(row.underlyingPrice)}</td>
                <td className="px-4 py-2 font-mono tabular-nums text-ink">{row.dte}</td>
                <td className="px-4 py-2 text-right font-mono tabular-nums text-ink">{formatDecimalCurrency(row.spreadValue)}</td>
                <td className="px-4 py-2 text-right font-mono tabular-nums text-ink">{formatCurrency(row.positionValue)}</td>
                <td className={cn("px-4 py-2 text-right font-mono font-semibold tabular-nums", row.profitLoss >= 0 ? "text-gain" : "text-loss")}>
                  {formatCurrency(row.profitLoss)}
                </td>
                <td className={cn("px-4 py-2 text-right font-mono font-semibold tabular-nums", row.profitLossPercent >= 0 ? "text-gain" : "text-loss")}>
                  {formatPercent(row.profitLossPercent)}
                </td>
                {!isLongCall && !isCallCalendar ? (
                  <td className={cn("px-4 py-2 text-right font-mono font-semibold tabular-nums", row.percentOfMaxProfitCaptured >= 0 ? "text-gain" : "text-loss")}>
                    {formatPercent(row.percentOfMaxProfitCaptured)}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function DebitSpreadScenarioVisualizer({
  inputs,
  view = "heatmap",
  selectedUnderlyingPrice,
  selectedDte,
}: DebitSpreadScenarioVisualizerProps) {
  const isHeatmapView = view === "heatmap";
  const isLongCall = inputs.strategy === "long-call";
  const isPutRatioSpread = inputs.strategy === "put-ratio-spread";
  const isCallRatioSpread = inputs.strategy === "call-ratio-spread";
  const isCallCalendar = inputs.strategy === "call-calendar";
  const isRatioSpread = isPutRatioSpread || isCallRatioSpread;
  const isBearPut = inputs.strategy === "bear-put";
  const isPutSpread =
    inputs.strategy === "debit-put-spread" || isPutRatioSpread;
  const unitName = isLongCall
    ? "call"
    : isPutRatioSpread
      ? "put ratio spread"
        : isCallRatioSpread
          ? "call ratio spread"
        : isCallCalendar
          ? "call calendar"
        : isBearPut
        ? "bear put"
      : isPutSpread
        ? "put spread"
        : "call spread";
  const [metric, setMetric] = useState<DebitSpreadScenarioMetric>("profitLoss");
  const [heatmapIvPct, setHeatmapIvPct] = useState(inputs.impliedVolatilityPct);
  const [heatmapDteSteps, setHeatmapDteSteps] = useState(7);
  const [heatmapMinPrice, setHeatmapMinPrice] = useState(() =>
    Math.max(
      1,
      Math.round(
        Math.min(
          inputs.currentPrice,
          isPutSpread ? inputs.shortStrike : isBearPut ? inputs.longStrike : inputs.currentPrice,
        ) *
          0.7,
      ),
    ),
  );
  const [heatmapMaxPrice, setHeatmapMaxPrice] = useState(() =>
    Math.max(
      2,
      Math.round(
        Math.max(
          inputs.currentPrice,
          inputs.longStrike,
          isCallRatioSpread ? inputs.shortStrike + Math.max(inputs.shortStrike - inputs.longStrike, 1) * 4 : inputs.shortStrike,
        ) * 1.3,
      ),
    ),
  );
  const [heatmapPriceTickSize, setHeatmapPriceTickSize] = useState(() =>
    Math.max(1, Math.round((Math.max(2, inputs.currentPrice * 1.3) - Math.max(1, inputs.currentPrice * 0.7)) / 6)),
  );
  const [isRangeSettingsOpen, setIsRangeSettingsOpen] = useState(false);
  const [lockedScenario, setLockedScenario] = useState<DebitSpreadScenarioPoint | null>(null);
  const [hoverScenario, setHoverScenario] = useState<DebitSpreadScenarioPoint | null>(null);
  const safeHeatmapMinPrice = Math.max(1, Math.round(Math.min(heatmapMinPrice, heatmapMaxPrice - 1)));
  const safeHeatmapMaxPrice = Math.max(safeHeatmapMinPrice + 1, Math.round(heatmapMaxPrice));
  const safeHeatmapPriceTickSize = Math.max(1, Math.round(heatmapPriceTickSize));
  const heatmapInputs = useMemo(
    () => ({
      ...inputs,
      impliedVolatilityPct: heatmapIvPct,
      priceTickSize: safeHeatmapPriceTickSize,
      minPrice: safeHeatmapMinPrice,
      maxPrice: safeHeatmapMaxPrice,
      dteBuckets: buildEvenDteBuckets(
        inputs.currentDte,
        heatmapDteSteps,
        isCallCalendar
          ? [
              inputs.currentDte -
                normalizeCallCalendarShortExpirationDays(
                  inputs.shortExpirationDays,
                  inputs.currentDte,
                ),
            ]
          : [],
      ),
    }),
    [
      heatmapIvPct,
      heatmapDteSteps,
      inputs,
      isCallCalendar,
      safeHeatmapMaxPrice,
      safeHeatmapMinPrice,
      safeHeatmapPriceTickSize,
    ],
  );
  const grid = useMemo(() => buildDebitSpreadScenarioGrid(heatmapInputs), [heatmapInputs]);
  const selectedScenarioInputs = isHeatmapView ? heatmapInputs : inputs;
  const defaultScenario = useMemo(
    () =>
      calculateDebitSpreadScenario(
        selectedScenarioInputs,
        selectedUnderlyingPrice ?? selectedScenarioInputs.currentPrice,
        Math.max(
          0,
          Math.min(
            selectedScenarioInputs.currentDte,
            Math.round(selectedDte ?? selectedScenarioInputs.currentDte),
          ),
        ),
      ),
    [selectedDte, selectedScenarioInputs, selectedUnderlyingPrice],
  );
  const resolvedLockedScenario = useMemo(() => {
    if (!lockedScenario) return null;

    return calculateDebitSpreadScenario(
      selectedScenarioInputs,
      lockedScenario.underlyingPrice,
      normalizeDte(lockedScenario.dte, selectedScenarioInputs.currentDte),
    );
  }, [lockedScenario, selectedScenarioInputs]);
  const resolvedHoverScenario = useMemo(() => {
    if (!hoverScenario) return null;

    return calculateDebitSpreadScenario(
      selectedScenarioInputs,
      hoverScenario.underlyingPrice,
      normalizeDte(hoverScenario.dte, selectedScenarioInputs.currentDte),
    );
  }, [hoverScenario, selectedScenarioInputs]);
  const selectedScenario = isHeatmapView
    ? resolvedHoverScenario ?? resolvedLockedScenario ?? defaultScenario
    : defaultScenario;
  const tableRows = useMemo(
    () =>
      grid.dteBuckets.map((dte) =>
        calculateDebitSpreadScenario(heatmapInputs, selectedScenario.underlyingPrice, dte),
      ),
    [grid.dteBuckets, heatmapInputs, selectedScenario.underlyingPrice],
  );
  const metricOptions = isLongCall
    ? METRIC_OPTIONS.filter((option) => option.value !== "percentOfMaxProfitCaptured")
    : METRIC_OPTIONS;
  const activeMetric =
    (isLongCall || isCallCalendar) && metric === "percentOfMaxProfitCaptured"
      ? "profitLoss"
      : metric;

  const lockScenario = (scenario: DebitSpreadScenarioPoint) => {
    setLockedScenario(scenario);
    setHoverScenario(null);
  };

  return (
    <section className="min-w-0 space-y-4">
      {!isHeatmapView ? (
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-sans text-base font-semibold text-ink text-balance">
              {`How does the ${unitName} shift over time?`}
            </h2>
          </div>
        </div>
      ) : null}

      {isHeatmapView ? (
        <section className="min-w-0 rounded-lg border border-line bg-surface shadow-sm">
          <div className="flex min-w-0 flex-wrap items-center gap-2 px-3 py-2">
            <button
              type="button"
              aria-expanded={isRangeSettingsOpen}
              aria-label={
                isRangeSettingsOpen ? "Close range settings" : "Open range settings"
              }
              onClick={() => setIsRangeSettingsOpen((currentValue) => !currentValue)}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <span
                aria-hidden
                className="flex size-7 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface-muted text-ink-soft shadow-sm"
              >
                <svg
                  viewBox="0 0 20 20"
                  className="size-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={isRangeSettingsOpen ? "M5 12l5-5 5 5" : "M5 8l5 5 5-5"} />
                </svg>
              </span>
              <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-sans text-sm font-semibold text-ink">
                  Range settings
                </span>
                <span className="min-w-0 truncate font-mono text-xs text-ink-secondary tabular-nums">
                  {formatCurrency(safeHeatmapMinPrice)}-{formatCurrency(safeHeatmapMaxPrice)} · {heatmapDteSteps} DTE ticks · {formatCompactNumber(heatmapIvPct)}% IV
                </span>
              </span>
            </button>
            <button
              type="button"
              aria-expanded={isRangeSettingsOpen}
              onClick={() => setIsRangeSettingsOpen((currentValue) => !currentValue)}
              className="rounded-md border border-line bg-surface-muted px-2 py-1 text-xs font-semibold text-ink-soft shadow-sm hover:border-accent hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {isRangeSettingsOpen ? "Done" : "Edit"}
            </button>
          </div>
          {isRangeSettingsOpen ? (
            <div className="grid min-w-0 gap-2 border-t border-line bg-surface-muted p-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[minmax(15rem,1.25fr)_repeat(5,minmax(8rem,1fr))]">
              <div className="min-w-0 rounded-md border border-line bg-surface p-2 shadow-sm">
                <p className="text-micro font-semibold uppercase text-ink-muted">Cell value</p>
                <div
                  className="mt-1 grid w-full grid-cols-2 rounded-md border border-line bg-surface-sunken p-0.5"
                  aria-label="Scenario metric"
                >
                  {metricOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setMetric(option.value)}
                      className={cn(
                        "min-w-0 truncate rounded px-1.5 py-1 text-xs font-semibold text-ink-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                        activeMetric === option.value && "bg-accent text-white shadow-sm",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block min-w-0 rounded-md border border-line bg-surface p-2 text-xs font-semibold text-ink-secondary shadow-sm">
                <span className="text-micro font-semibold uppercase text-ink-muted">Min price</span>
                <div className="mt-1 hidden items-center rounded-md border border-line-strong bg-surface px-2.5 py-1.5 sm:flex">
                  <span className="text-ink-muted">$</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={heatmapMinPrice}
                    onChange={(event) => setHeatmapMinPrice(Number(event.target.value))}
                    className="w-full border-0 bg-transparent p-0 text-right font-mono text-sm font-semibold text-ink outline-none tabular-nums"
                  />
                </div>
                <MobileRangeValueControl
                  label="Min"
                  prefix="$"
                  min={1}
                  max={Math.max(1, safeHeatmapMaxPrice - 1)}
                  value={safeHeatmapMinPrice}
                  onChange={setHeatmapMinPrice}
                />
              </label>

              <label className="block min-w-0 rounded-md border border-line bg-surface p-2 text-xs font-semibold text-ink-secondary shadow-sm">
                <span className="text-micro font-semibold uppercase text-ink-muted">Max price</span>
                <div className="mt-1 hidden items-center rounded-md border border-line-strong bg-surface px-2.5 py-1.5 sm:flex">
                  <span className="text-ink-muted">$</span>
                  <input
                    type="number"
                    min={2}
                    step={1}
                    value={heatmapMaxPrice}
                    onChange={(event) => setHeatmapMaxPrice(Number(event.target.value))}
                    className="w-full border-0 bg-transparent p-0 text-right font-mono text-sm font-semibold text-ink outline-none tabular-nums"
                  />
                </div>
                <MobileRangeValueControl
                  label="Max"
                  prefix="$"
                  min={safeHeatmapMinPrice + 1}
                  max={Math.max(
                    safeHeatmapMaxPrice,
                    Math.round(inputs.currentPrice * 1.8),
                    safeHeatmapMinPrice + 2,
                  )}
                  value={safeHeatmapMaxPrice}
                  onChange={setHeatmapMaxPrice}
                />
              </label>

              <label className="block min-w-0 rounded-md border border-line bg-surface p-2 text-xs font-semibold text-ink-secondary shadow-sm">
                <span className="text-micro font-semibold uppercase text-ink-muted">Price tick</span>
                <div className="mt-1 hidden items-center rounded-md border border-line-strong bg-surface px-2.5 py-1.5 sm:flex">
                  <span className="text-ink-muted">$</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={heatmapPriceTickSize}
                    onChange={(event) => setHeatmapPriceTickSize(Number(event.target.value))}
                    className="w-full border-0 bg-transparent p-0 text-right font-mono text-sm font-semibold text-ink outline-none tabular-nums"
                  />
                </div>
                <MobileRangeValueControl
                  label="Tick"
                  prefix="$"
                  min={1}
                  max={Math.max(1, safeHeatmapMaxPrice - safeHeatmapMinPrice)}
                  value={safeHeatmapPriceTickSize}
                  onChange={setHeatmapPriceTickSize}
                />
              </label>

              <label className="block min-w-0 rounded-md border border-line bg-surface p-2 text-xs font-semibold text-ink-secondary shadow-sm">
                <span className="text-micro font-semibold uppercase text-ink-muted">DTE ticks</span>
                <div className="mt-2 grid min-h-8 grid-cols-[minmax(0,1fr)_2.25rem] items-center gap-2">
                  <input
                    type="range"
                    min={2}
                    max={15}
                    step={1}
                    value={heatmapDteSteps}
                    onChange={(event) => setHeatmapDteSteps(Number(event.target.value))}
                    onMouseDown={blurFocusedField}
                    onPointerDown={blurFocusedField}
                    onTouchStart={blurFocusedField}
                    style={getRangeTrackStyle(heatmapDteSteps, 2, 15)}
                    className="h-2 w-full min-w-0 cursor-pointer appearance-none rounded-full bg-slate-200 accent-accent"
                  />
                  <span className="text-right font-mono text-sm font-semibold text-ink tabular-nums">
                    {heatmapDteSteps}
                  </span>
                </div>
              </label>

              <label className="block min-w-0 rounded-md border border-line bg-surface p-2 text-xs font-semibold text-ink-secondary shadow-sm">
                <span className="text-micro font-semibold uppercase text-ink-muted">IV</span>
                <div className="mt-2 grid min-h-8 grid-cols-[minmax(0,1fr)_3rem] items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={150}
                    step={0.1}
                    value={heatmapIvPct}
                    onChange={(event) =>
                      setHeatmapIvPct(Math.round(Number(event.target.value) * 10) / 10)
                    }
                    onMouseDown={blurFocusedField}
                    onPointerDown={blurFocusedField}
                    onTouchStart={blurFocusedField}
                    style={getRangeTrackStyle(heatmapIvPct, 0, 150)}
                    className="h-2 w-full min-w-0 cursor-pointer appearance-none rounded-full bg-slate-200 accent-accent"
                  />
                  <span className="text-right font-mono text-sm font-semibold text-ink tabular-nums">
                    {formatCompactNumber(heatmapIvPct)}%
                  </span>
                </div>
              </label>
            </div>
          ) : null}
        </section>
      ) : null}

      {isHeatmapView ? (
        <HeatmapTab
          grid={grid}
          metric={activeMetric}
          selectedScenario={selectedScenario}
          isLongCall={isLongCall}
          isBearPut={isBearPut}
            isPutSpread={isPutSpread}
            isRatioSpread={isRatioSpread}
          isCallCalendar={isCallCalendar}
            ratioShortCount={normalizePutRatioShortCount(inputs.ratioShortCount)}
          onPreview={setHoverScenario}
          onClearPreview={() => setHoverScenario(null)}
          onLock={lockScenario}
        />
      ) : (
        <MultiDateTab
          inputs={inputs}
          selectedScenario={selectedScenario}
          onPreview={setHoverScenario}
          onClearPreview={() => setHoverScenario(null)}
          onLock={lockScenario}
        />
      )}

      <details className="group rounded-lg border border-line bg-surface shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-ink-soft">
          <span>Scenario table</span>
          <span className="text-xs text-ink-muted">Show exact rows</span>
        </summary>
        <div className="border-t border-line">
          <ScenarioTable
            selectedPoint={selectedScenario}
            rows={tableRows}
              isLongCall={isLongCall}
              isBearPut={isBearPut}
              isRatioSpread={isRatioSpread}
              isCallCalendar={isCallCalendar}
            />
        </div>
      </details>
    </section>
  );
}
