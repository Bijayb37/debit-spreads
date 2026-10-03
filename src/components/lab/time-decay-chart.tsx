"use client";

import { useRef, useState } from "react";
import type { PointerEvent } from "react";
import { cn } from "@/lib/cn";
import { clamp, formatLongDate } from "@/lib/debit-call-spread";
import { CHART_COLORS } from "@/components/lab/constants";
import { formatCompactCurrency, formatCurrency } from "@/components/lab/format";

export type TimeDecayPoint = {
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

export function TimeDecayChart({
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
            <span className="size-2 rounded-full bg-[var(--accent)]" />
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
