"use client";

import { useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent, ReactNode } from "react";
import { cn } from "@/lib/cn";
import {
  addDaysToIso,
  buildPriceLadderRows,
  buildTimelineRows,
  clamp,
  createScenarioSnapshot,
  daysBetween,
  formatLongDate,
  roundTo,
} from "@/lib/debit-call-spread";
import type {
  DebitCallSpreadInputs,
  PriceLadderRow,
  TimelineRow,
} from "@/lib/debit-call-spread";

type SectionCardProps = {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  className?: string;
  eyebrowClassName?: string;
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

type ScenarioGraphView = "line" | "map";

type LineValuePoint = {
  id: string;
  price: number;
  value: number;
  isHighlighted?: boolean;
};

type SingleLineValueChartProps = {
  title: string;
  subtitle: string;
  points: LineValuePoint[];
  selectedPrice: number;
  selectedValue: number;
  maxProfitValue: number;
  maxExpiryValue: number;
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
};

type ScenarioValueMapProps = {
  minPrice: number;
  maxPrice: number;
  selectedPrice: number;
  selectedOffsetDays: number;
  selectedValue: number;
  selectedPnl: number;
  selectedRoi: number;
  maxProfitValue: number;
  maxExpiryValue: number;
  currentSpot: number;
  expirationDays: number;
  todayIso: string;
  scenarioDateLabel: string;
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

const CHART_COLORS = {
  paper: "#f7ecd8",
  paperSoft: "#f1dfc1",
  paperMuted: "#e4d0ad",
  ink: "#28261f",
  inkMuted: "#6f6757",
  line: "#cdbb99",
  grid: "#eadbbf",
  rust: "#b75534",
  pine: "#2f6b4f",
  loss: "#9f3a32",
};

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

function formatPercent(value: number): string {
  const roundedValue = Math.round(value * 100);
  const safeValue = Object.is(roundedValue, -0) ? 0 : roundedValue;

  return `${safeValue >= 0 ? "+" : ""}${safeValue}%`;
}

function getSliderMax(...values: number[]): number {
  return Math.ceil((Math.max(...values, 50) * 1.8) / 5) * 5;
}

function parseNumberInput(value: string): number {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? Math.round(nextValue) : 0;
}

function handleNumberKeyDown(
  event: KeyboardEvent<HTMLInputElement>,
  onChange: (value: number) => void,
) {
  if (event.altKey || event.ctrlKey || event.metaKey) {
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

function SectionCard({
  title,
  eyebrow,
  children,
  className,
  eyebrowClassName,
}: SectionCardProps) {
  return (
    <section
      className={cn(
        "rounded-lg border border-[var(--ink-line)] bg-[var(--paper)] p-4 shadow-sm",
        className,
      )}
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          {eyebrow ? (
            <p
              className={cn(
                "text-sm font-medium text-[var(--rust-dark)]",
                eyebrowClassName,
              )}
            >
              {eyebrow}
            </p>
          ) : null}
          <h2 className="font-[family:var(--font-serif)] text-xl font-semibold text-balance text-[var(--ink)]">
            {title}
          </h2>
        </div>
      </div>
      {children}
    </section>
  );
}

function MetricCard({ label, value, tone = "default", helper }: MetricCardProps) {
  return (
    <div className="rounded-lg border border-[var(--ink-line)] bg-[var(--paper-soft)] p-4 shadow-sm">
      <p className="text-sm text-[var(--ink-muted)]">{label}</p>
      <p
        className={cn(
          "mt-2 font-mono text-2xl font-semibold tabular-nums",
          tone === "positive" && "text-[var(--pine)]",
          tone === "negative" && "text-[var(--loss)]",
          tone === "accent" && "text-[var(--rust-dark)]",
          tone === "default" && "text-[var(--ink)]",
        )}
      >
        {value}
      </p>
      {helper ? <p className="mt-1 text-sm text-[var(--ink-muted)] text-pretty">{helper}</p> : null}
    </div>
  );
}

function InfoIcon({ label }: InfoIconProps) {
  const tooltipId = useId();
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const handledPointerActivation = useRef(false);
  const isOpen = isHovered || isFocused || isPinned;
  const togglePinned = () => setIsPinned((currentValue) => !currentValue);

  return (
    <span className="group relative inline-flex">
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
          togglePinned();
        }}
        onBlur={() => {
          setIsFocused(false);
          setIsPinned(false);
        }}
        onFocus={() => setIsFocused(true)}
        onMouseDown={(event) => {
          handledPointerActivation.current = true;
          togglePinned();
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
            togglePinned();
          }
        }}
        onPointerEnter={() => setIsHovered(true)}
        onPointerLeave={() => setIsHovered(false)}
        className="inline-flex size-5 items-center justify-center rounded-full border border-[var(--ink-line)] bg-[var(--paper)] font-[family:var(--font-serif)] text-xs font-semibold italic text-[var(--ink-muted)] shadow-sm hover:border-[var(--rust)] hover:text-[var(--rust-dark)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rust)]"
      >
        i
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        aria-hidden={!isOpen}
        className={cn(
          "invisible absolute right-0 top-7 z-20 w-64 rounded-md border border-[var(--ink-line)] bg-[var(--paper)] px-3 py-2 text-left text-xs font-normal leading-5 text-[var(--ink)] opacity-0 shadow-lg group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100",
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
}: NumberSliderFieldProps) {
  const fieldId = useId();
  const labelId = `${fieldId}-label`;
  const helpId = `${fieldId}-help`;
  const safeValue = clamp(value, min, max);
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
    if (!Number.isFinite(nextValue)) {
      onChange(min);
      return;
    }

    onChange(clamp(nextValue, min, max));
  };

  return (
    <div className="rounded-lg border border-[var(--ink-line)] bg-[var(--paper-soft)] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p id={labelId} className="text-sm font-medium text-[var(--ink)]">
              {label}
            </p>
            <InfoIcon label={help} />
          </div>
          <span id={helpId} className="sr-only">
            {help}
          </span>
        </div>
        <div className="w-28 shrink-0">
          <div className="flex items-center rounded-md border border-[var(--ink-line)] bg-[var(--paper)] px-3 py-2">
            {prefix ? <span className="text-sm text-[var(--ink-muted)]">{prefix}</span> : null}
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
              className="w-full border-0 bg-transparent p-0 font-mono text-right text-sm font-medium text-[var(--ink)] outline-none tabular-nums"
            />
            {suffix ? <span className="text-sm text-[var(--ink-muted)]">{suffix}</span> : null}
          </div>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={safeValue}
        aria-labelledby={labelId}
        aria-describedby={helpId}
        onChange={(event) => handleSliderChange(Number(event.target.value))}
        className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full bg-[var(--paper-muted)] accent-[var(--rust)]"
      />
      <div className="mt-2 flex justify-between font-mono text-xs text-[var(--ink-muted)] tabular-nums">
        <span>
          {prefix}
          {min}
          {suffix}
        </span>
        <span>
          {prefix}
          {max}
          {suffix}
        </span>
      </div>
      {quickActions.length > 0 ? (
        <div className="mt-3 grid grid-cols-4 gap-2">
          {quickActions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => onChange(clamp(action.value, 0, max))}
              className="rounded-md border border-[var(--ink-line)] bg-[var(--paper)] px-2 py-1.5 text-xs font-medium text-[var(--ink)] shadow-sm hover:border-[var(--rust)] hover:text-[var(--rust-dark)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rust)]"
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SingleLineValueChart({
  title,
  subtitle,
  points,
  selectedPrice,
  selectedValue,
  maxProfitValue,
  maxExpiryValue,
}: SingleLineValueChartProps) {
  const width = 820;
  const height = 320;
  const padding = { top: 32, right: 32, bottom: 58, left: 84 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const prices = [selectedPrice, ...points.map((point) => point.price)];
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices, minPrice + 1);
  const maxValue = Math.max(
    selectedValue,
    maxExpiryValue,
    ...points.map((point) => point.value),
    1,
  );
  const x = (price: number) =>
    padding.left +
    ((clamp(price, minPrice, maxPrice) - minPrice) /
      Math.max(maxPrice - minPrice, 1)) *
      chartWidth;
  const y = (value: number) =>
    padding.top +
    ((maxValue - clamp(value, 0, maxValue)) / Math.max(maxValue, 1)) * chartHeight;
  const yTicks = [0, Math.round(maxValue / 2), Math.round(maxValue)];
  const priceTicks = [minPrice, Math.round((minPrice + maxPrice) / 2), maxPrice];
  const selectedX = x(selectedPrice);
  const selectedY = y(selectedValue);
  const maxExpiryY = y(maxExpiryValue);
  const path = points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${x(point.price)} ${y(point.value)}`,
    )
    .join(" ");

  return (
    <div className="rounded-lg border border-[var(--ink-line)] bg-[var(--paper-soft)] p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[var(--ink)]">{title}</h3>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">{subtitle}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-x-4 gap-y-2 text-xs text-[var(--ink-muted)]">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[var(--ink-muted)]" />
            Value curve
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[var(--rust)]" />
            Selected
            <span className="font-mono font-semibold text-[var(--ink)] tabular-nums">
              {formatCompactCurrency(selectedValue)}
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[var(--pine)]" />
            Max profit at expiry
            <span className="font-mono font-semibold text-[var(--ink)] tabular-nums">
              {formatCompactCurrency(maxProfitValue)}
            </span>
          </span>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label={`${title}: ${subtitle}`}
      >
        <rect
          x={padding.left}
          y={padding.top}
          width={chartWidth}
          height={chartHeight}
          fill={CHART_COLORS.paper}
        />
        {yTicks.map((tick, index) => (
          <g key={`line-y-${tick}-${index}`}>
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
          </g>
        ))}
        {priceTicks.map((tick, index) => (
          <g key={`line-price-${tick}-${index}`}>
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
              {formatCurrency(tick)}
            </text>
          </g>
        ))}
        <line
          x1={padding.left}
          x2={width - padding.right}
          y1={maxExpiryY}
          y2={maxExpiryY}
          stroke={CHART_COLORS.pine}
          strokeDasharray="5 4"
          strokeWidth={1.5}
        />
        <text
          x={width - padding.right - 8}
          y={Math.max(padding.top + 12, maxExpiryY - 6)}
          textAnchor="end"
          fill={CHART_COLORS.pine}
          className="font-mono text-[11px] font-semibold"
        >
          Expiry value {formatCompactCurrency(maxExpiryValue)}
        </text>
        <path
          d={path}
          fill="none"
          stroke={CHART_COLORS.inkMuted}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((point, index) => (
          <circle
            key={`${point.id}-${index}`}
            cx={x(point.price)}
            cy={y(point.value)}
            r={point.isHighlighted ? 4.5 : 3}
            fill={point.isHighlighted ? CHART_COLORS.rust : CHART_COLORS.inkMuted}
            stroke={CHART_COLORS.paper}
            strokeWidth={1.5}
          />
        ))}
        <line
          x1={selectedX}
          x2={selectedX}
          y1={padding.top}
          y2={height - padding.bottom}
          stroke={CHART_COLORS.rust}
          strokeDasharray="4 4"
          strokeWidth={1.5}
        />
        <line
          x1={padding.left}
          x2={width - padding.right}
          y1={selectedY}
          y2={selectedY}
          stroke={CHART_COLORS.rust}
          strokeOpacity={0.45}
          strokeWidth={1}
        />
        <circle
          cx={selectedX}
          cy={selectedY}
          r={5}
          fill={CHART_COLORS.rust}
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
      </svg>
    </div>
  );
}

function ScenarioValueMap({
  minPrice,
  maxPrice,
  selectedPrice,
  selectedOffsetDays,
  selectedValue,
  selectedPnl,
  selectedRoi,
  maxProfitValue,
  maxExpiryValue,
  currentSpot,
  expirationDays,
  todayIso,
  scenarioDateLabel,
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
  const maxPositionValue = Math.max(
    selectedValue,
    maxExpiryValue,
    ...cells.map((cell) => cell.positionValue),
    1,
  );
  const valueColor = (positionValue: number) => {
    const ratio = clamp(positionValue / maxPositionValue, 0, 1);

    if (ratio < 0.14) return "#f7ecd8";
    if (ratio < 0.28) return "#eadbbf";
    if (ratio < 0.42) return "#d8c2a0";
    if (ratio < 0.56) return "#f1c66f";
    if (ratio < 0.7) return "#c56b3f";
    if (ratio < 0.84) return "#7c8f61";
    return CHART_COLORS.pine;
  };
  const priceTicks = Array.from({ length: 6 }, (_, index) => {
    const ratio = index / 5;
    return minPrice + (maxPrice - minPrice) * ratio;
  });
  const dateTicks = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    return Math.round(expirationDays * ratio);
  });
  const selectedTooltipPoint = {
    price: selectedPrice,
    offsetDays: selectedOffsetDays,
    dateLabel: scenarioDateLabel,
    positionValue: selectedValue,
    pnl: selectedPnl,
    roi: selectedRoi,
  };
  const tooltipPoint = hoverPoint ?? selectedTooltipPoint;
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
    <div className="overflow-hidden rounded-lg border border-[var(--ink-line)] bg-[var(--paper-soft)] p-3 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--ink-muted)]">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-2">
            <span className="size-2 rounded-full bg-[var(--rust)]" />
            Selected scenario
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="size-2 rounded-full bg-[var(--ink-muted)]" />
            Current stock price
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="size-2 rounded-sm bg-[var(--pine)]" />
            Higher spread value
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="size-2 rounded-full bg-[var(--pine)]" />
            Max profit at expiry {formatCompactCurrency(maxProfitValue)}
          </span>
        </div>
        <div className="rounded-md border border-[var(--ink-line)] bg-[var(--paper)] px-3 py-2 font-mono text-xs text-[var(--ink)] shadow-sm tabular-nums">
          {scenarioDateLabel} | {formatCurrency(selectedPrice)} |{" "}
          {formatCurrency(selectedValue)}
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
            fill={valueColor(cell.positionValue)}
          />
        ))}

        {priceTicks.map((price, index) => (
          <g key={`map-price-${price}-${index}`}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={y(price)}
              y2={y(price)}
              stroke={CHART_COLORS.paper}
              strokeOpacity={0.7}
              strokeWidth={1}
            />
            <text
              x={padding.left - 12}
              y={y(price) + 4}
              textAnchor="end"
              fill={CHART_COLORS.inkMuted}
              className="font-mono text-[11px]"
            >
              {formatCurrency(price)}
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
        <line
          x1={selectedX}
          x2={selectedX}
          y1={padding.top}
          y2={height - padding.bottom}
          stroke={CHART_COLORS.rust}
          strokeWidth={1.5}
        />
        <line
          x1={padding.left}
          x2={width - padding.right}
          y1={selectedY}
          y2={selectedY}
          stroke={CHART_COLORS.rust}
          strokeWidth={1.5}
        />
        <circle cx={selectedX} cy={selectedY} r={5.5} fill={CHART_COLORS.rust} stroke={CHART_COLORS.paper} strokeWidth={2} />
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
        <g pointerEvents="none">
          <line
            x1={tooltipXAnchor}
            x2={tooltipXAnchor}
            y1={tooltipYAnchor}
            y2={tooltipY + tooltipHeight / 2}
            stroke={CHART_COLORS.rust}
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
              tooltipPoint.roi >= 0 ? "fill-[var(--pine)]" : "fill-[var(--loss)]",
            )}
          >
            {formatPercent(tooltipPoint.roi)} gain
          </text>
          <text
            x={tooltipX + 10}
            y={tooltipY + 98}
            className={cn(
              "font-mono text-[12px]",
              tooltipPoint.pnl >= 0 ? "fill-[var(--pine)]" : "fill-[var(--loss)]",
            )}
          >
            {formatCurrency(tooltipPoint.pnl)} P/L
          </text>
        </g>
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
    <div className="rounded-lg border border-[var(--ink-line)] bg-[var(--paper)] shadow-sm">
      <div className="border-b border-[var(--ink-line)] px-5 py-4">
        <h3 className="font-[family:var(--font-serif)] text-xl font-semibold text-[var(--ink)]">
          {title}
        </h3>
        <p className="mt-1 text-sm text-[var(--ink-muted)] text-pretty">{subtitle}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-[var(--paper-soft)] text-[var(--ink-muted)]">
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
                  "border-t border-[var(--ink-line)]",
                  row.isHighlighted && "bg-[var(--paper-soft)]",
                )}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      "px-4 py-3 align-top font-mono tabular-nums text-[var(--ink)]",
                      column.align === "right" && "text-right",
                      column.muted && "text-[var(--ink-muted)]",
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
  const [symbol, setSymbol] = useState("EWY");
  const [spot, setSpot] = useState(125);
  const [volatilityPct, setVolatilityPct] = useState(65);
  const [longStrike, setLongStrike] = useState(125);
  const [shortStrike, setShortStrike] = useState(145);
  const [capital, setCapital] = useState(10000);
  const [ratePct, setRatePct] = useState(5);
  const [dividendYieldPct, setDividendYieldPct] = useState(0);
  const defaultExpirationDays = Math.max(1, daysBetween(todayIso, defaultExpiryIso));
  const [expirationDays, setExpirationDays] = useState(defaultExpirationDays);
  const [scenarioPrice, setScenarioPrice] = useState(145);
  const [scenarioPriceDraft, setScenarioPriceDraft] = useState<string | null>(
    null,
  );
  const [scenarioGraphView, setScenarioGraphView] =
    useState<ScenarioGraphView>("line");
  const [scenarioOffsetDays, setScenarioOffsetDays] = useState(
    Math.round(defaultExpirationDays / 2),
  );

  const scenarioPriceSliderMin = Math.max(1, Math.floor(spot * 0.7));
  const scenarioPriceSliderMax = Math.max(
    scenarioPriceSliderMin,
    Math.ceil(shortStrike * 1.3),
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
  const currentPriceSliderMax = getSliderMax(spot, safeScenarioPrice, longStrike, shortStrike);
  const baseStrikeSliderMax = getSliderMax(spot, safeScenarioPrice, longStrike, shortStrike);
  const longStrikeSliderMax = Math.max(baseStrikeSliderMax, shortStrike + 20);
  const shortStrikeSliderMax = Math.max(baseStrikeSliderMax + 20, longStrike + 5);
  const expiryIso = addDaysToIso(todayIso, expirationDays);
  const safeScenarioOffsetDays = clamp(scenarioOffsetDays, 0, expirationDays);
  const updateExpirationDays = (nextValue: number) => {
    const nextExpirationDays = clamp(Math.round(nextValue), 0, 1095);

    setExpirationDays(nextExpirationDays);
    setScenarioOffsetDays((currentDays) =>
      clamp(currentDays, 0, nextExpirationDays),
    );
  };
  const updateScenarioPriceDraft = (nextValue: string) => {
    const parsedValue = Number(nextValue);

    setScenarioPriceDraft(nextValue);

    if (nextValue.trim() && Number.isFinite(parsedValue)) {
      setScenarioPrice(Math.round(parsedValue));
    }
  };
  const commitScenarioPriceDraft = (nextValue: string) => {
    const parsedValue = Number(nextValue);
    const committedValue = Number.isFinite(parsedValue)
      ? Math.round(parsedValue)
      : safeScenarioPrice;

    setScenarioPrice(
      clamp(committedValue, scenarioPriceSliderMin, scenarioPriceSliderMax),
    );
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
      setScenarioPrice(0);
      return;
    }

    if (/^\d$/.test(event.key) && event.currentTarget.value === "0") {
      event.preventDefault();
      setScenarioPriceDraft(event.key);
      setScenarioPrice(Number(event.key));
    }
  };

  const validationMessages: string[] = [];
  if (!symbol.trim()) {
    validationMessages.push("Enter a ticker or label so the scenario has a clear underlying.");
  }
  if (spot <= 0) {
    validationMessages.push("Current stock price has to be greater than zero.");
  }
  if (volatilityPct < 0) {
    validationMessages.push("Implied volatility cannot be negative.");
  }
  if (longStrike <= 0 || shortStrike <= 0) {
    validationMessages.push("Strike prices have to be greater than zero.");
  }
  if (shortStrike <= longStrike) {
    validationMessages.push("For a debit call spread, the short strike must be above the long strike.");
  }
  if (capital <= 0) {
    validationMessages.push("Capital needs to be greater than zero.");
  }
  if (expirationDays === 0) {
    validationMessages.push("Set the expiration after today so the app can model time value.");
  }

  const inputs = useMemo<DebitCallSpreadInputs>(
    () => ({
      todayIso,
      expiryIso,
      spot,
      longStrike,
      shortStrike,
      volatilityPct,
      capital,
      scenarioPrice: safeScenarioPrice,
      scenarioOffsetDays: safeScenarioOffsetDays,
      ratePct,
      dividendYieldPct,
    }),
    [
      capital,
      dividendYieldPct,
      expiryIso,
      longStrike,
      ratePct,
      safeScenarioOffsetDays,
      safeScenarioPrice,
      shortStrike,
      spot,
      todayIso,
      volatilityPct,
    ],
  );

  const snapshot = useMemo(() => createScenarioSnapshot(inputs), [inputs]);
  const maxProfitAtExpiry =
    snapshot.maxProfitPerSpread * snapshot.contracts * 100;
  const maxPositionValueAtExpiry = snapshot.totalCost + maxProfitAtExpiry;
  const maxReturnAtExpiry =
    snapshot.totalCost > 0 ? maxProfitAtExpiry / snapshot.totalCost : 0;
  const canModel = validationMessages.length === 0 && snapshot.debitPerSpread > 0;
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
  const lineChartPoints = useMemo<LineValuePoint[]>(
    () =>
      priceRows.map((row) => ({
        id: row.id,
        price: row.price,
        value: row.positionValue,
        isHighlighted: row.isHighlighted,
      })),
    [priceRows],
  );
  const scenarioMapRange = useMemo(() => {
    const minMapPrice = Math.max(1, Math.floor(spot * 0.7));
    const maxMapPrice = Math.max(scenarioPriceSliderMax, Math.ceil(spot * 1.05));

    return {
      minPrice: minMapPrice,
      maxPrice: Math.ceil(maxMapPrice),
    };
  }, [scenarioPriceSliderMax, spot]);
  const getScenarioTooltipPoint = (price: number, offsetDays: number) => {
    const hoverSnapshot = createScenarioSnapshot({
      ...inputs,
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
          <div className="mt-1 text-xs text-[var(--ink-muted)]">
            {row.daysRemaining} days left
          </div>
        </div>
      ),
    },
    {
      key: "spreadValue",
      label: "Spread / 1 lot",
      align: "right",
      render: (row) => formatCurrency(row.spreadValue * 100),
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
        <span className={cn(row.pnl >= 0 ? "text-[var(--pine)]" : "text-[var(--loss)]")}>
          {formatCurrency(row.pnl)}
        </span>
      ),
    },
    {
      key: "roi",
      label: "Return",
      align: "right",
      render: (row) => (
        <span className={cn(row.roi >= 0 ? "text-[var(--pine)]" : "text-[var(--loss)]")}>
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
      key: "spreadValue",
      label: "Spread / 1 lot",
      align: "right",
      render: (row) => formatCurrency(row.spreadValue * 100),
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
        <span className={cn(row.pnl >= 0 ? "text-[var(--pine)]" : "text-[var(--loss)]")}>
          {formatCurrency(row.pnl)}
        </span>
      ),
    },
    {
      key: "roi",
      label: "Return",
      align: "right",
      render: (row) => (
        <span className={cn(row.roi >= 0 ? "text-[var(--pine)]" : "text-[var(--loss)]")}>
          {formatPercent(row.roi)}
        </span>
      ),
    },
  ];
  const shortStrikeOtmActions = [5, 10, 20, 30].map((percent) => ({
    label: `${percent}% OTM`,
    value: Math.round(spot * (1 + percent / 100)),
  }));

  return (
    <main className="min-h-dvh bg-[var(--background)] text-[var(--ink)] lg:h-dvh lg:overflow-hidden">
      <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col gap-3 px-4 py-3 md:px-6 lg:h-full lg:min-h-0">
        <div className="grid gap-3 lg:min-h-0 lg:flex-1 lg:grid-cols-[24rem_minmax(0,1fr)]">
          <aside className="lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
            <h1 className="sr-only">Debit Call Spread Lab</h1>
            <SectionCard
              title="Inputs"
              eyebrow="Debit Call Spread Lab"
              eyebrowClassName="font-[family:var(--font-serif)] text-2xl font-semibold text-balance text-[var(--ink)]"
            >
              <div className="space-y-4">
                <label className="block rounded-lg border border-[var(--ink-line)] bg-[var(--paper-soft)] p-4 shadow-sm">
                  <span className="text-sm font-medium text-[var(--ink)]">Underlying ticker or label</span>
                  <input
                    type="text"
                    value={symbol}
                    onChange={(event) => setSymbol(event.target.value.toUpperCase())}
                    className="mt-3 w-full rounded-md border border-[var(--ink-line)] bg-[var(--paper)] px-3 py-2 font-mono text-sm text-[var(--ink)] outline-none"
                    placeholder="AAPL"
                  />
                </label>

                <NumberSliderField
                  label="Current stock price"
                  help="Used to price the spread today."
                  min={5}
                  max={currentPriceSliderMax}
                  step={1}
                  value={spot}
                  onChange={setSpot}
                  prefix="$"
                />

                <NumberSliderField
                  label="Implied volatility"
                  help="Single-volatility assumption for both call legs."
                  min={5}
                  max={150}
                  step={1}
                  value={volatilityPct}
                  onChange={setVolatilityPct}
                  suffix="%"
                />

                <NumberSliderField
                  label="Long call strike"
                  help="The strike you buy."
                  min={5}
                  max={longStrikeSliderMax}
                  step={1}
                  value={longStrike}
                  onChange={setLongStrike}
                  prefix="$"
                />

                <NumberSliderField
                  label="Short call strike"
                  help="The strike you sell."
                  min={5}
                  max={shortStrikeSliderMax}
                  step={1}
                  value={shortStrike}
                  onChange={setShortStrike}
                  prefix="$"
                  quickActions={shortStrikeOtmActions}
                />

                <NumberSliderField
                  label="Capital to deploy"
                  help="The app buys as many full 1x1 spreads as this amount allows."
                  min={500}
                  max={100000}
                  step={100}
                  value={capital}
                  onChange={setCapital}
                  prefix="$"
                />

                <label className="block rounded-lg border border-[var(--ink-line)] bg-[var(--paper-soft)] p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-[var(--ink)]">Days to expiration</p>
                      <p className="mt-1 text-sm text-[var(--ink-muted)] text-pretty">
                        The spread value decays toward intrinsic value as DTE approaches zero.
                      </p>
                    </div>
                    <span className="font-mono text-sm text-[var(--ink-muted)] tabular-nums">
                      {formatLongDate(expiryIso)}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center rounded-md border border-[var(--ink-line)] bg-[var(--paper)] px-3 py-2">
                    <input
                      type="number"
                      value={expirationDays}
                      min={0}
                      max={1095}
                      step={1}
                      aria-label="Days to expiration"
                      onKeyDown={(event) =>
                        handleNumberKeyDown(event, updateExpirationDays)
                      }
                      onInput={(event) =>
                        updateExpirationDays(parseNumberInput(event.currentTarget.value))
                      }
                      onChange={(event) =>
                        updateExpirationDays(parseNumberInput(event.target.value))
                      }
                      className="w-full border-0 bg-transparent p-0 font-mono text-sm text-[var(--ink)] outline-none tabular-nums"
                    />
                    <span className="text-sm text-[var(--ink-muted)]">DTE</span>
                  </div>
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block rounded-lg border border-[var(--ink-line)] bg-[var(--paper-soft)] p-4 shadow-sm">
                    <span className="text-sm font-medium text-[var(--ink)]">Risk-free rate</span>
                    <input
                      type="number"
                      value={ratePct}
                      min={0}
                      max={15}
                      step={1}
                      onKeyDown={(event) => handleNumberKeyDown(event, setRatePct)}
                      onInput={(event) =>
                        setRatePct(clamp(parseNumberInput(event.currentTarget.value), 0, 15))
                      }
                      onChange={(event) =>
                        setRatePct(clamp(parseNumberInput(event.target.value), 0, 15))
                      }
                      className="mt-3 w-full rounded-md border border-[var(--ink-line)] bg-[var(--paper)] px-3 py-2 font-mono text-sm text-[var(--ink)] outline-none"
                    />
                  </label>
                  <label className="block rounded-lg border border-[var(--ink-line)] bg-[var(--paper-soft)] p-4 shadow-sm">
                    <span className="text-sm font-medium text-[var(--ink)]">Dividend yield</span>
                    <input
                      type="number"
                      value={dividendYieldPct}
                      min={0}
                      max={15}
                      step={1}
                      onKeyDown={(event) => handleNumberKeyDown(event, setDividendYieldPct)}
                      onInput={(event) =>
                        setDividendYieldPct(
                          clamp(parseNumberInput(event.currentTarget.value), 0, 15),
                        )
                      }
                      onChange={(event) =>
                        setDividendYieldPct(clamp(parseNumberInput(event.target.value), 0, 15))
                      }
                      className="mt-3 w-full rounded-md border border-[var(--ink-line)] bg-[var(--paper)] px-3 py-2 font-mono text-sm text-[var(--ink)] outline-none"
                    />
                  </label>
                </div>
              </div>
            </SectionCard>

            <div className="mt-4 rounded-lg border border-[var(--ink-line)] bg-[var(--paper-soft)] p-4 text-sm text-[var(--ink)] shadow-sm">
              <p className="font-medium">Model assumptions</p>
              <p className="mt-2 text-pretty">
                This uses a Black-Scholes estimate with one shared IV for both call legs, a flat rate, and a flat dividend yield. It treats the spread like European-style pricing, which is clean for learning and scenario work.
              </p>
            </div>
          </aside>

          <div className="space-y-4 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <MetricCard
                label="Spread cost today"
                value={formatCurrency(snapshot.debitPerSpread * 100)}
                tone="accent"
                helper="Cost for one 1x1 spread."
              />
              <MetricCard
                label="Total cash deployed"
                value={formatCurrency(snapshot.totalCost)}
                helper={`${snapshot.contracts} full spreads, ${formatCurrency(snapshot.cashLeft)} left over.`}
              />
              <MetricCard
                label="Break-even at expiry"
                value={formatCurrency(snapshot.breakEvenAtExpiry)}
                helper="Only applies right at expiration."
              />
            </section>

            <SectionCard
              title="Scenario curve"
              eyebrow={`${symbol.trim() || "Underlying"} spread value by stock price`}
            >
              <div className="space-y-4">
                <div className="overflow-hidden rounded-lg border border-[var(--ink-line)] bg-[var(--ink-line)] shadow-sm">
                  <div className="grid gap-px sm:grid-cols-2 xl:grid-cols-4">
                    <div className="flex min-h-32 flex-col items-center justify-center bg-[var(--paper)] p-5 text-center">
                      <p className="text-sm font-semibold text-[var(--ink-muted)]">
                        Selected scenario
                      </p>
                      <p className="mt-3 font-[family:var(--font-serif)] text-4xl font-semibold text-[var(--ink)] tabular-nums xl:text-5xl">
                        {formatCurrency(safeScenarioPrice)}
                      </p>
                      <p className="mt-1 text-sm font-medium text-[var(--ink-muted)]">
                        {formatLongDate(snapshot.selectedDateIso)}
                      </p>
                    </div>

                    <div className="flex min-h-32 flex-col items-center justify-center bg-[var(--paper)] p-5 text-center">
                      <p className="text-sm font-medium text-[var(--ink-muted)]">
                        Value on selected date
                      </p>
                      <p className="mt-3 font-mono text-3xl font-semibold text-[var(--ink)] tabular-nums xl:text-4xl">
                        {formatCurrency(snapshot.scenarioPositionValue)}
                      </p>
                    </div>

                    <div className="flex min-h-32 flex-col items-center justify-center bg-[var(--paper)] p-5 text-center">
                      <p className="text-sm font-medium text-[var(--ink-muted)]">
                        Max at expiry
                      </p>
                      <div className="mt-3 grid w-full max-w-56 grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs font-medium text-[var(--ink-muted)]">
                            Profit
                          </p>
                          <p className="mt-1 font-mono text-lg font-semibold text-[var(--pine)] tabular-nums">
                            {formatCurrency(maxProfitAtExpiry)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-[var(--ink-muted)]">
                            Return
                          </p>
                          <p className="mt-1 font-mono text-lg font-semibold text-[var(--pine)] tabular-nums">
                            {formatPercent(maxReturnAtExpiry)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex min-h-32 flex-col items-center justify-center bg-[var(--paper)] p-5 text-center">
                      <p className="text-sm font-medium text-[var(--ink-muted)]">
                        Profit or loss then
                      </p>
                      <p
                        className={cn(
                          "mt-3 font-mono text-3xl font-semibold tabular-nums xl:text-4xl",
                          snapshot.pnl >= 0 ? "text-[var(--pine)]" : "text-[var(--loss)]",
                        )}
                      >
                        {formatCurrency(snapshot.pnl)}
                      </p>
                      <p
                        className={cn(
                          "mt-2 font-mono text-lg font-semibold tabular-nums",
                          snapshot.roi >= 0 ? "text-[var(--pine)]" : "text-[var(--loss)]",
                        )}
                      >
                        {snapshot.totalCost > 0
                          ? formatPercent(snapshot.roi)
                          : "No position purchased yet."}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-lg border border-[var(--ink-line)] bg-[var(--paper-soft)] p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-[var(--ink)]">Future stock price</p>
                        <InfoIcon label="The stock price to test on the selected future date." />
                      </div>
                      <div className="w-28 shrink-0">
                        <div className="flex items-center rounded-md border border-[var(--ink-line)] bg-[var(--paper)] px-3 py-2">
                          <span className="text-sm text-[var(--ink-muted)]">$</span>
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
                            className="w-full border-0 bg-transparent p-0 font-mono text-right text-sm font-medium text-[var(--ink)] outline-none tabular-nums"
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
                        setScenarioPrice(
                          clamp(
                            Number(event.target.value),
                            scenarioPriceSliderMin,
                            scenarioPriceSliderMax,
                          ),
                        )
                      }
                      className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full bg-[var(--paper-muted)] accent-[var(--rust)]"
                    />
                    <div className="mt-2 flex justify-between font-mono text-xs text-[var(--ink-muted)] tabular-nums">
                      <span>{formatCurrency(scenarioPriceSliderMin)}</span>
                      <span>{formatCurrency(scenarioPriceSliderMax)}</span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-[var(--ink-line)] bg-[var(--paper-soft)] p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-[var(--ink)]">Valuation date</p>
                        <InfoIcon label="The date used to estimate what the spread could be worth before expiration." />
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm text-[var(--ink)] tabular-nums">
                          {formatLongDate(snapshot.selectedDateIso)}
                        </div>
                        <div className="mt-1 text-xs text-[var(--ink-muted)]">
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
                        setScenarioOffsetDays(
                          clamp(Number(event.target.value), 0, expirationDays),
                        )
                      }
                      className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full bg-[var(--paper-muted)] accent-[var(--rust)]"
                    />
                    <div className="mt-2 flex justify-between font-mono text-xs text-[var(--ink-muted)] tabular-nums">
                      <span>{formatLongDate(todayIso)}</span>
                      <span>{formatLongDate(expiryIso)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div
                    className="flex flex-wrap rounded-lg border border-[var(--ink-line)] bg-[var(--paper-soft)] p-1"
                    aria-label="Scenario graph view"
                  >
                    {[
                      { value: "line", label: "Line chart" },
                      { value: "map", label: "Heat map" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={scenarioGraphView === option.value}
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
                          "rounded-md px-3 py-1.5 text-sm font-medium text-[var(--ink-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rust)]",
                          scenarioGraphView === option.value &&
                            "bg-[var(--paper)] text-[var(--ink)] shadow-sm",
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <div className="font-mono text-xs text-[var(--ink-muted)] tabular-nums">
                    {formatLongDate(snapshot.selectedDateIso)} |{" "}
                    {formatCurrency(safeScenarioPrice)} |{" "}
                    {formatCurrency(snapshot.scenarioPositionValue)}
                  </div>
                </div>

                {validationMessages.length > 0 ? (
                  <div className="rounded-lg border border-[var(--loss)] bg-[var(--paper-soft)] p-4 text-sm text-[var(--loss)]">
                    <p className="font-medium">Fix these inputs first</p>
                    <ul className="mt-2 space-y-1">
                      {validationMessages.map((message) => (
                        <li key={message}>{message}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {canModel && scenarioGraphView === "line" ? (
                  <SingleLineValueChart
                    title="Spread value by stock price"
                    subtitle={`On ${formatLongDate(snapshot.selectedDateIso)}`}
                    points={lineChartPoints}
                    selectedPrice={safeScenarioPrice}
                    selectedValue={snapshot.scenarioPositionValue}
                    maxProfitValue={maxProfitAtExpiry}
                    maxExpiryValue={maxPositionValueAtExpiry}
                  />
                ) : null}

                {canModel && scenarioGraphView === "map" ? (
                  <ScenarioValueMap
                    minPrice={scenarioMapRange.minPrice}
                    maxPrice={scenarioMapRange.maxPrice}
                    selectedPrice={safeScenarioPrice}
                    selectedOffsetDays={safeScenarioOffsetDays}
                    selectedValue={snapshot.scenarioPositionValue}
                    selectedPnl={snapshot.pnl}
                    selectedRoi={snapshot.roi}
                    maxProfitValue={maxProfitAtExpiry}
                    maxExpiryValue={maxPositionValueAtExpiry}
                    currentSpot={spot}
                    expirationDays={expirationDays}
                    todayIso={todayIso}
                    scenarioDateLabel={formatLongDate(snapshot.selectedDateIso)}
                    getScenarioTooltipPoint={getScenarioTooltipPoint}
                  />
                ) : null}

                {!canModel ? (
                  <div className="rounded-lg border border-dashed border-[var(--ink-line)] bg-[var(--paper-soft)] p-8 text-center text-[var(--ink-muted)]">
                    Clean up the inputs and the curve will appear here.
                  </div>
                ) : null}
              </div>
            </SectionCard>

            <ResultsTable
              title="Value over time at the selected stock price"
              subtitle={`These rows keep ${symbol.trim() || "the stock"} fixed at ${formatCurrency(
                safeScenarioPrice,
              )} and move the date toward expiry.`}
              columns={timelineColumns}
              rows={timelineRows}
            />

            <ResultsTable
              title="Value by stock price on the selected date"
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
