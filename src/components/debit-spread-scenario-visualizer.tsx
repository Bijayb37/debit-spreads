"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
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

type SelectedScenarioState = {
  scenario: DebitSpreadScenarioPoint;
  locked: boolean;
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
  selected: "#d97706",
  breakeven: "#0f172a",
  muted: "#64748b",
  grid: "#e2e8f0",
  paper: "#ffffff",
};

const CURVE_COLORS = ["#0f766e", "#334155", "#64748b", "#94a3b8", "#059669"];

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

function formatMetricValue(
  point: DebitSpreadScenarioPoint,
  metric: DebitSpreadScenarioMetric,
): string {
  if (metric === "profitLossPercent" || metric === "percentOfMaxProfitCaptured") {
    return formatPercent(point[metric]);
  }

  return formatCurrency(point[metric]);
}

function scenarioTooltip(point: DebitSpreadScenarioPoint): string {
  return [
    `Underlying: ${formatCurrency(point.underlyingPrice)}`,
    `DTE: ${point.dte}`,
    `Long call: ${formatDecimalCurrency(point.longCallValue)}`,
    `Short call: ${formatDecimalCurrency(point.shortCallValue)}`,
    `Spread: ${formatDecimalCurrency(point.spreadValue)}`,
    `Position value: ${formatCurrency(point.positionValue)}`,
    `P/L: ${formatCurrency(point.profitLoss)}`,
    `P/L %: ${formatPercent(point.profitLossPercent)}`,
    `% max profit: ${formatPercent(point.percentOfMaxProfitCaptured)}`,
  ].join("\n");
}

function cellColor(point: DebitSpreadScenarioPoint, maxProfit: number, maxLoss: number): string {
  if (point.profitLoss > 0) {
    const ratio = Math.min(point.profitLoss / Math.max(maxProfit, 1), 1);

    if (ratio > 0.75) return "bg-emerald-700 text-white";
    if (ratio > 0.45) return "bg-emerald-500 text-white";
    if (ratio > 0.2) return "bg-emerald-300 text-emerald-950";
    return "bg-emerald-100 text-emerald-950";
  }

  if (point.profitLoss < 0) {
    const ratio = Math.min(Math.abs(point.profitLoss) / Math.max(maxLoss, 1), 1);

    if (ratio > 0.65) return "bg-rose-600 text-white";
    if (ratio > 0.35) return "bg-rose-300 text-rose-950";
    return "bg-rose-100 text-rose-950";
  }

  return "bg-slate-100 text-slate-700";
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

function buildEvenDteBuckets(currentDte: number, steps: number): number[] {
  const safeCurrentDte = Math.max(0, Math.round(currentDte));
  const safeSteps = Math.min(Math.max(Math.round(steps), 2), safeCurrentDte + 1);

  return [...new Set(
    Array.from({ length: safeSteps }, (_, index) =>
      Math.round(safeCurrentDte - (safeCurrentDte * index) / Math.max(safeSteps - 1, 1)),
    ),
  )].sort((first, second) => second - first);
}

function normalizeDte(dte: number, currentDte: number): number {
  return Math.max(0, Math.min(currentDte, Math.round(dte)));
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

function ScenarioStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "positive" | "negative";
}) {
  return (
    <div className="min-w-0 rounded-md border border-slate-200 bg-white px-3 py-2">
      <dt className="text-[10px] font-semibold uppercase text-slate-500 text-balance">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-1 truncate font-mono text-sm font-semibold tabular-nums",
          tone === "positive" && "text-emerald-700",
          tone === "negative" && "text-rose-700",
          tone === "default" && "text-slate-950",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function SelectedScenarioPanel({
  selected,
  summary,
  locked,
  onUnlock,
}: {
  selected: DebitSpreadScenarioPoint;
  summary: ReturnType<typeof buildDebitSpreadScenarioGrid>["summary"];
  locked: boolean;
  onUnlock: () => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-orange-700 text-balance">
            Selected Scenario
          </h3>
          <p className="mt-1 text-xs text-slate-600 text-pretty">
            {locked ? "Locked scenario" : "Hover a chart or heatmap cell to preview. Click to lock."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {locked ? (
            <button
              type="button"
              onClick={onUnlock}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700"
            >
              Unlock
            </button>
          ) : null}
        </div>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ScenarioStat label="Underlying" value={formatCurrency(selected.underlyingPrice)} />
        <ScenarioStat label="DTE" value={`${selected.dte} DTE`} />
        <ScenarioStat label="Spread value" value={formatDecimalCurrency(selected.spreadValue)} />
        <ScenarioStat label="Position value" value={formatCurrency(selected.positionValue)} />
        <ScenarioStat
          label="P/L $"
          value={formatCurrency(selected.profitLoss)}
          tone={selected.profitLoss >= 0 ? "positive" : "negative"}
        />
        <ScenarioStat
          label="P/L %"
          value={formatPercent(selected.profitLossPercent)}
          tone={selected.profitLoss >= 0 ? "positive" : "negative"}
        />
        <ScenarioStat label="Max profit" value={formatCurrency(summary.maxProfit)} tone="positive" />
        <ScenarioStat label="Expiry B/E" value={formatCurrency(summary.expiryBreakeven)} />
      </dl>
    </div>
  );
}

function HeatmapTab({
  grid,
  metric,
  selectedScenario,
  onPreview,
  onClearPreview,
  onLock,
}: {
  grid: ReturnType<typeof buildDebitSpreadScenarioGrid>;
  metric: DebitSpreadScenarioMetric;
  selectedScenario: DebitSpreadScenarioPoint;
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

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-950 text-balance">
            At stock price X and DTE Y
          </h3>
          <p className="mt-1 text-xs text-slate-500 text-pretty">
            Theoretical estimates using the selected IV and Black-Scholes for non-expiry cells.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-600">
          <span className="size-3 rounded-sm bg-rose-500" />
          Loss
          <span className="size-3 rounded-sm bg-slate-100" />
          Near B/E
          <span className="size-3 rounded-sm bg-emerald-700" />
          Profit
        </div>
      </div>
      <div className="overflow-x-auto">
        <div
          className="grid min-w-[760px] gap-1"
          style={{
            gridTemplateColumns: `4.5rem repeat(${grid.dteBuckets.length}, minmax(4.75rem, 1fr))`,
          }}
        >
          <div className="text-[10px] font-semibold uppercase text-slate-500">Price</div>
          {grid.dteBuckets.map((dte) => (
            <div
              key={`dte-head-${dte}`}
              className="text-center font-mono text-[11px] font-semibold text-slate-600 tabular-nums"
            >
              {dte} DTE
            </div>
          ))}
          {displayedPriceBuckets.map((price) => (
            <div key={`price-row-${price}`} className="contents">
              <div className="flex items-center justify-end pr-2 font-mono text-[11px] text-slate-500 tabular-nums">
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
                    title={scenarioTooltip(point)}
                    aria-label={`${formatCurrency(price)} at ${dte} DTE: ${formatMetricValue(point, metric)}`}
                    onMouseEnter={() => onPreview(point)}
                    onMouseLeave={onClearPreview}
                    onFocus={() => onPreview(point)}
                    onBlur={onClearPreview}
                    onClick={() => onLock(point)}
                    className={cn(
                      "min-h-8 rounded-md px-1.5 py-1 text-center font-mono text-[11px] font-semibold shadow-sm outline-none tabular-nums",
                      "focus-visible:ring-2 focus-visible:ring-amber-500",
                      cellColor(point, grid.summary.maxProfit, grid.summary.maxLoss),
                      isSelected && "ring-2 ring-amber-500",
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

function PnlCurveTab({
  inputs,
  selectedScenario,
  summary,
  onPreview,
  onClearPreview,
  onLock,
}: {
  inputs: DebitSpreadScenarioInputs;
  selectedScenario: DebitSpreadScenarioPoint;
  summary: ReturnType<typeof buildDebitSpreadScenarioGrid>["summary"];
  onPreview: (scenario: DebitSpreadScenarioPoint) => void;
  onClearPreview: () => void;
  onLock: (scenario: DebitSpreadScenarioPoint) => void;
}) {
  const width = 820;
  const height = 340;
  const padding = { top: 34, right: 30, bottom: 52, left: 78 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const prices = useMemo(() => buildPriceSeries(inputs.currentPrice), [inputs.currentPrice]);
  const selectedPoints = useMemo(
    () =>
      prices.map((price) =>
        calculateDebitSpreadScenario(inputs, price, selectedScenario.dte),
      ),
    [inputs, prices, selectedScenario.dte],
  );
  const expiryPoints = useMemo(
    () => prices.map((price) => calculateDebitSpreadScenario(inputs, price, 0)),
    [inputs, prices],
  );
  const allPnl = [...selectedPoints, ...expiryPoints].map((point) => point.profitLoss);
  const rawMin = Math.min(...allPnl, 0);
  const rawMax = Math.max(...allPnl, 1);
  const span = Math.max(rawMax - rawMin, 1);
  const yMin = rawMin - span * 0.08;
  const yMax = rawMax + span * 0.08;
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const x = (price: number) =>
    padding.left + ((price - minPrice) / Math.max(maxPrice - minPrice, 1)) * chartWidth;
  const y = (value: number) =>
    padding.top + ((yMax - value) / Math.max(yMax - yMin, 1)) * chartHeight;
  const selectedAtPrice = calculateDebitSpreadScenario(
    inputs,
    selectedScenario.underlyingPrice,
    selectedScenario.dte,
  );
  const strikeMarkers = [
    { label: "Long", value: inputs.longStrike },
    { label: "Short", value: inputs.shortStrike },
    { label: "Current", value: inputs.currentPrice },
    { label: "Selected", value: selectedScenario.underlyingPrice },
    { label: "B/E", value: summary.expiryBreakeven },
  ];

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 shadow-sm">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-950 text-balance">
          P/L at {selectedScenario.dte} DTE across stock prices
        </h3>
        <p className="mt-1 text-xs text-slate-500 text-pretty">
          Solid line is theoretical value at the selected DTE. Dashed line is expiry payoff.
        </p>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img">
        <rect x={padding.left} y={padding.top} width={chartWidth} height={chartHeight} fill={CHART_COLORS.paper} />
        {[rawMin, 0, rawMax].map((tick, index) => (
          <g key={`curve-y-${index}`}>
            <line x1={padding.left} x2={width - padding.right} y1={y(tick)} y2={y(tick)} stroke={CHART_COLORS.grid} />
            <text x={padding.left - 10} y={y(tick) + 4} textAnchor="end" className="font-mono text-[11px]" fill={CHART_COLORS.muted}>
              {formatCurrency(tick)}
            </text>
          </g>
        ))}
        <path
          d={makePath(selectedPoints, x, y, "profitLoss")}
          fill="none"
          stroke={CHART_COLORS.primary}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={makePath(expiryPoints, x, y, "profitLoss")}
          fill="none"
          stroke={CHART_COLORS.expiry}
          strokeWidth={2}
          strokeDasharray="6 5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {strikeMarkers.map((marker, index) => (
          <g key={`${marker.label}-${index}`}>
            <line
              x1={x(marker.value)}
              x2={x(marker.value)}
              y1={padding.top}
              y2={height - padding.bottom}
              stroke={marker.label === "Selected" ? CHART_COLORS.selected : marker.label === "B/E" ? CHART_COLORS.breakeven : CHART_COLORS.muted}
              strokeDasharray={marker.label === "B/E" ? "2 4" : "4 4"}
              strokeOpacity={marker.label === "Selected" ? 0.9 : 0.45}
            />
            <text
              x={x(marker.value)}
              y={padding.top - (index % 2 === 0 ? 8 : 20)}
              textAnchor="middle"
              className="font-mono text-[10px]"
              fill={marker.label === "Selected" ? CHART_COLORS.selected : CHART_COLORS.muted}
            >
              {marker.label} {formatCurrency(marker.value)}
            </text>
          </g>
        ))}
        <circle
          cx={x(selectedAtPrice.underlyingPrice)}
          cy={y(selectedAtPrice.profitLoss)}
          r={5}
          fill={CHART_COLORS.selected}
          stroke={CHART_COLORS.paper}
          strokeWidth={2}
        />
        {selectedPoints.map((point) => (
          <circle
            key={`curve-hit-${point.underlyingPrice}`}
            cx={x(point.underlyingPrice)}
            cy={y(point.profitLoss)}
            r={7}
            fill="transparent"
            onMouseEnter={() => onPreview(point)}
            onMouseLeave={onClearPreview}
            onClick={() => onLock(point)}
          >
            <title>{scenarioTooltip(point)}</title>
          </circle>
        ))}
        {[minPrice, inputs.currentPrice, maxPrice].map((tick) => (
          <text key={`curve-x-${tick}`} x={x(tick)} y={height - padding.bottom + 20} textAnchor="middle" className="font-mono text-[11px]" fill={CHART_COLORS.muted}>
            {formatCurrency(tick)}
          </text>
        ))}
      </svg>
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
  const width = 820;
  const height = 340;
  const padding = { top: 28, right: 90, bottom: 52, left: 78 };
  const prices = useMemo(
    () => buildPriceSeriesWithSelection(inputs.currentPrice, selectedScenario.underlyingPrice),
    [inputs.currentPrice, selectedScenario.underlyingPrice],
  );
  const selectedDte = normalizeDte(selectedScenario.dte, inputs.currentDte);
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
    [inputs.currentDte, savedDteEntries, selectedDte],
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
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-950 text-balance">
            P/L curves as expiry approaches
          </h3>
          <p className="mt-1 text-xs text-slate-500 text-pretty">
            Compare how the curve shifts across valuation dates at the same stock prices.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            disabled={!canAddSelectedDte}
            onClick={() =>
              setSavedDtes((current) =>
                [...new Set([...current, selectedDte])].sort((first, second) => second - first),
              )
            }
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add date
          </button>
          {dteEntries.map((entry, index) => (
            <span
              key={`date-chip-${entry.dte}-${entry.label}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600"
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
                  className="rounded px-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900"
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
              <text x={padding.left - 10} y={y(tick) + 4} textAnchor="end" className="font-mono text-[11px]" fill={CHART_COLORS.muted}>
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
                <text x={x(lastPoint.underlyingPrice) + 8} y={y(lastPoint.profitLoss) + 4} className="font-mono text-[10px]" fill={CURVE_COLORS[index % CURVE_COLORS.length]}>
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
                <title>{scenarioTooltip(selectedPoint)}</title>
              </circle>
            </g>
          ) : null}
          {[minPrice, inputs.currentPrice, maxPrice].map((tick) => (
            <text key={`multi-x-${tick}`} x={x(tick)} y={height - padding.bottom + 20} textAnchor="middle" className="font-mono text-[11px]" fill={CHART_COLORS.muted}>
              {formatCurrency(tick)}
            </text>
          ))}
        </svg>
        {hoverTooltip ? (
          <div
            className="pointer-events-none absolute z-10 min-w-60 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600 shadow-lg"
            style={{
              left: `${Math.min(Math.max(hoverTooltip.leftPct, 12), 76)}%`,
              top: `${Math.min(Math.max(hoverTooltip.topPct, 10), 72)}%`,
            }}
          >
            <p className="mb-2 font-mono font-semibold text-slate-950 tabular-nums">
              Underlying {formatCurrency(hoverTooltip.price)}
            </p>
            <div className="space-y-1">
              {hoverTooltip.rows.map((row) => (
                <div key={row.label} className="grid grid-cols-[5rem_1fr] gap-2">
                  <span className="font-semibold text-slate-700">{row.label}</span>
                  <span className="font-mono tabular-nums">
                    Value {formatCurrency(row.positionValue)} · P/L{" "}
                    <span className={row.profitLoss >= 0 ? "text-emerald-700" : "text-rose-700"}>
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

function TimeValueTab({
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
  const [fixedPrice, setFixedPrice] = useState(inputs.currentPrice);
  const width = 820;
  const height = 320;
  const padding = { top: 26, right: 28, bottom: 50, left: 78 };
  const offsets = Array.from({ length: Math.min(inputs.currentDte + 1, 61) }, (_, index) =>
    Math.round((inputs.currentDte * index) / Math.max(Math.min(inputs.currentDte, 60), 1)),
  );
  const points = [...new Set(offsets)].map((offset) => {
    const dte = Math.max(inputs.currentDte - offset, 0);
    return calculateDebitSpreadScenario(inputs, fixedPrice, dte);
  });
  const selectedPoint = calculateDebitSpreadScenario(inputs, fixedPrice, selectedScenario.dte);
  const todayPoint = calculateDebitSpreadScenario(inputs, fixedPrice, inputs.currentDte);
  const expiryPoint = calculateDebitSpreadScenario(inputs, fixedPrice, 0);
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const values = points.map((point) => point.profitLoss);
  const rawMin = Math.min(...values, 0);
  const rawMax = Math.max(...values, 1);
  const span = Math.max(rawMax - rawMin, 1);
  const yMin = rawMin - span * 0.08;
  const yMax = rawMax + span * 0.08;
  const x = (dte: number) =>
    padding.left + ((inputs.currentDte - dte) / Math.max(inputs.currentDte, 1)) * chartWidth;
  const y = (value: number) =>
    padding.top + ((yMax - value) / Math.max(yMax - yMin, 1)) * chartHeight;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-950 text-balance">
            Spread value over time at fixed stock price
          </h3>
          <p className="mt-1 text-xs text-slate-500 text-pretty">
            Fixed stock price: {formatCurrency(fixedPrice)}. Estimated at {inputs.impliedVolatilityPct}% IV.
          </p>
        </div>
        <label className="flex min-w-64 items-center gap-3">
          <span className="text-xs font-semibold text-slate-600">Fixed price</span>
          <input
            type="range"
            min={Math.max(1, Math.round(inputs.currentPrice * 0.7))}
            max={Math.round(inputs.currentPrice * 1.3)}
            step={1}
            value={fixedPrice}
            onChange={(event) => setFixedPrice(Number(event.target.value))}
            className="w-full accent-orange-600"
          />
          <span className="w-16 text-right font-mono text-xs font-semibold tabular-nums">{formatCurrency(fixedPrice)}</span>
        </label>
      </div>
      <dl className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <ScenarioStat label="Value today" value={formatCurrency(todayPoint.positionValue)} />
        <ScenarioStat label="Value selected" value={formatCurrency(selectedPoint.positionValue)} />
        <ScenarioStat label="Value at expiry" value={formatCurrency(expiryPoint.positionValue)} />
        <ScenarioStat
          label="Expiry P/L"
          value={formatCurrency(expiryPoint.profitLoss)}
          tone={expiryPoint.profitLoss >= 0 ? "positive" : "negative"}
        />
      </dl>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img">
        <rect x={padding.left} y={padding.top} width={chartWidth} height={chartHeight} fill={CHART_COLORS.paper} />
        {[rawMin, 0, rawMax].map((tick, index) => (
          <g key={`time-y-${index}`}>
            <line x1={padding.left} x2={width - padding.right} y1={y(tick)} y2={y(tick)} stroke={CHART_COLORS.grid} />
            <text x={padding.left - 10} y={y(tick) + 4} textAnchor="end" className="font-mono text-[11px]" fill={CHART_COLORS.muted}>
              {formatCurrency(tick)}
            </text>
          </g>
        ))}
        <line x1={padding.left} x2={width - padding.right} y1={y(0)} y2={y(0)} stroke={CHART_COLORS.breakeven} strokeOpacity={0.35} strokeDasharray="4 4" />
        <path
          d={points
            .map((point, index) => {
              const command = index === 0 ? "M" : "L";
              return `${command} ${x(point.dte)} ${y(point.profitLoss)}`;
            })
            .join(" ")}
          fill="none"
          stroke={CHART_COLORS.primary}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line x1={x(selectedScenario.dte)} x2={x(selectedScenario.dte)} y1={padding.top} y2={height - padding.bottom} stroke={CHART_COLORS.selected} strokeDasharray="4 4" />
        <circle cx={x(selectedScenario.dte)} cy={y(selectedPoint.profitLoss)} r={5} fill={CHART_COLORS.selected} stroke={CHART_COLORS.paper} strokeWidth={2} />
        {points.map((point) => (
          <circle
            key={`time-hit-${point.dte}`}
            cx={x(point.dte)}
            cy={y(point.profitLoss)}
            r={7}
            fill="transparent"
            onMouseEnter={() => onPreview(point)}
            onMouseLeave={onClearPreview}
            onClick={() => onLock(point)}
          >
            <title>{scenarioTooltip(point)}</title>
          </circle>
        ))}
        {[inputs.currentDte, Math.round(inputs.currentDte / 2), 0].map((dte) => (
          <text key={`time-x-${dte}`} x={x(dte)} y={height - padding.bottom + 20} textAnchor="middle" className="font-mono text-[11px]" fill={CHART_COLORS.muted}>
            {dte} DTE
          </text>
        ))}
      </svg>
    </div>
  );
}

function ScenarioTable({
  selectedPoint,
  rows,
}: {
  selectedPoint: DebitSpreadScenarioPoint;
  rows: DebitSpreadScenarioPoint[];
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
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-950 text-balance">Scenario table</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2 font-semibold">Price</th>
              <th className="px-4 py-2 font-semibold">DTE</th>
              <th className="px-4 py-2 text-right font-semibold">Spread value</th>
              <th className="px-4 py-2 text-right font-semibold">Position value</th>
              <th className="px-4 py-2 text-right font-semibold">P/L $</th>
              <th className="px-4 py-2 text-right font-semibold">P/L %</th>
              <th className="px-4 py-2 text-right font-semibold">% max profit</th>
            </tr>
          </thead>
          <tbody>
            {dedupedRows.map((row, index) => (
              <tr
                key={`${row.underlyingPrice}-${row.dte}-${index}`}
                className={cn(index === 0 ? "bg-amber-50" : "border-t border-slate-100")}
              >
                <td className="px-4 py-2 font-mono tabular-nums text-slate-950">{formatCurrency(row.underlyingPrice)}</td>
                <td className="px-4 py-2 font-mono tabular-nums text-slate-950">{row.dte}</td>
                <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-950">{formatDecimalCurrency(row.spreadValue)}</td>
                <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-950">{formatCurrency(row.positionValue)}</td>
                <td className={cn("px-4 py-2 text-right font-mono font-semibold tabular-nums", row.profitLoss >= 0 ? "text-emerald-700" : "text-rose-700")}>
                  {formatCurrency(row.profitLoss)}
                </td>
                <td className={cn("px-4 py-2 text-right font-mono font-semibold tabular-nums", row.profitLossPercent >= 0 ? "text-emerald-700" : "text-rose-700")}>
                  {formatPercent(row.profitLossPercent)}
                </td>
                <td className={cn("px-4 py-2 text-right font-mono font-semibold tabular-nums", row.percentOfMaxProfitCaptured >= 0 ? "text-emerald-700" : "text-rose-700")}>
                  {formatPercent(row.percentOfMaxProfitCaptured)}
                </td>
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
  const [metric, setMetric] = useState<DebitSpreadScenarioMetric>("profitLoss");
  const [heatmapIvPct, setHeatmapIvPct] = useState(inputs.impliedVolatilityPct);
  const [heatmapDteSteps, setHeatmapDteSteps] = useState(7);
  const [heatmapMinPrice, setHeatmapMinPrice] = useState(() =>
    Math.max(1, Math.round(inputs.currentPrice * 0.7)),
  );
  const [heatmapMaxPrice, setHeatmapMaxPrice] = useState(() =>
    Math.max(2, Math.round(inputs.currentPrice * 1.3)),
  );
  const [heatmapPriceTickSize, setHeatmapPriceTickSize] = useState(() =>
    Math.max(1, Math.round((Math.max(2, inputs.currentPrice * 1.3) - Math.max(1, inputs.currentPrice * 0.7)) / 6)),
  );
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
      dteBuckets: buildEvenDteBuckets(inputs.currentDte, heatmapDteSteps),
    }),
    [
      heatmapIvPct,
      heatmapDteSteps,
      inputs,
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
  const selectedScenario = isHeatmapView
    ? hoverScenario ?? lockedScenario ?? defaultScenario
    : defaultScenario;
  const selectedState: SelectedScenarioState = {
    scenario: selectedScenario,
    locked: lockedScenario !== null,
  };
  const tableRows = useMemo(
    () =>
      grid.dteBuckets.map((dte) =>
        calculateDebitSpreadScenario(heatmapInputs, selectedScenario.underlyingPrice, dte),
      ),
    [grid.dteBuckets, heatmapInputs, selectedScenario.underlyingPrice],
  );

  const lockScenario = (scenario: DebitSpreadScenarioPoint) => {
    setLockedScenario(scenario);
    setHoverScenario(null);
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="mt-1 font-[family:var(--font-space-grotesk)] text-lg font-semibold text-slate-950 text-balance">
            {isHeatmapView ? "What is this spread worth?" : "How does the spread shift over time?"}
          </h2>
          <p className="mt-1 text-xs text-slate-500 text-pretty">
            Theoretical estimates only. Expiry uses payoff logic; non-expiry cells use Black-Scholes call pricing.
          </p>
        </div>
        {isHeatmapView ? (
          <div
            className="grid w-full grid-cols-2 rounded-lg border border-slate-200 bg-slate-100 p-1 sm:inline-flex sm:w-auto sm:grid-cols-none"
            aria-label="Scenario metric"
          >
            {METRIC_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setMetric(option.value)}
                className={cn(
                  "min-w-0 rounded-md px-2 py-1.5 text-sm font-medium text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 sm:px-3",
                  metric === option.value && "bg-white text-slate-950 shadow-sm",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {isHeatmapView ? (
        <SelectedScenarioPanel
          selected={selectedState.scenario}
          summary={grid.summary}
          locked={selectedState.locked}
          onUnlock={() => setLockedScenario(null)}
        />
      ) : null}

      {isHeatmapView ? (
        <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="block text-xs font-semibold text-slate-600">
            Min price
            <div className="mt-1 flex items-center rounded-md border border-slate-300 bg-white px-2.5 py-1.5">
              <span className="text-slate-500">$</span>
              <input
                type="number"
                min={1}
                step={1}
                value={heatmapMinPrice}
                onChange={(event) => setHeatmapMinPrice(Number(event.target.value))}
                className="w-full border-0 bg-transparent p-0 text-right font-mono text-sm font-semibold text-slate-950 outline-none tabular-nums"
              />
            </div>
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            Max price
            <div className="mt-1 flex items-center rounded-md border border-slate-300 bg-white px-2.5 py-1.5">
              <span className="text-slate-500">$</span>
              <input
                type="number"
                min={2}
                step={1}
                value={heatmapMaxPrice}
                onChange={(event) => setHeatmapMaxPrice(Number(event.target.value))}
                className="w-full border-0 bg-transparent p-0 text-right font-mono text-sm font-semibold text-slate-950 outline-none tabular-nums"
              />
            </div>
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            Price tick value
            <div className="mt-1 flex items-center rounded-md border border-slate-300 bg-white px-2.5 py-1.5">
              <span className="text-slate-500">$</span>
              <input
                type="number"
                min={1}
                step={1}
                value={heatmapPriceTickSize}
                onChange={(event) => setHeatmapPriceTickSize(Number(event.target.value))}
                className="w-full border-0 bg-transparent p-0 text-right font-mono text-sm font-semibold text-slate-950 outline-none tabular-nums"
              />
            </div>
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            DTE ticks
            <div className="mt-2 flex items-center gap-3">
              <input
                type="range"
                min={2}
                max={15}
                step={1}
                value={heatmapDteSteps}
                onChange={(event) => setHeatmapDteSteps(Number(event.target.value))}
                className="w-full accent-orange-600"
              />
              <span className="w-8 text-right font-mono text-sm font-semibold text-slate-950 tabular-nums">{heatmapDteSteps}</span>
            </div>
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            IV
            <div className="mt-2 flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={150}
                step={1}
                value={heatmapIvPct}
                onChange={(event) => setHeatmapIvPct(Number(event.target.value))}
                className="w-full accent-orange-600"
              />
              <span className="w-14 text-right font-mono text-sm font-semibold text-slate-950 tabular-nums">{heatmapIvPct}%</span>
            </div>
          </label>
        </div>
      ) : null}

      {isHeatmapView ? (
        <HeatmapTab
          grid={grid}
          metric={metric}
          selectedScenario={selectedScenario}
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

      <ScenarioTable selectedPoint={selectedScenario} rows={tableRows} />
    </section>
  );
}
