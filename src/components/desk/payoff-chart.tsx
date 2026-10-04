"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  formatMoney,
  formatPct,
  formatPrice,
  payoffCurve,
  type Board,
  type Desk,
  type Scenario,
} from "@/lib/scenario-desk";
import { seriesColor } from "@/components/desk/colors";
import { scenarioTiming } from "@/components/desk/outcome-grid";

const HEIGHT = 300;
const PAD = { top: 16, right: 16, bottom: 44, left: 62 };
const STEPS = 72;

// "Nice" axis ticks that always include zero.
function yTicks(low: number, high: number): number[] {
  const rough = (high - low) / 4;
  const power = 10 ** Math.floor(Math.log10(Math.max(rough, 1)));
  const step = [1, 2, 2.5, 5, 10].map((factor) => factor * power).find((value) => value >= rough) ?? rough;
  const ticks: number[] = [];
  for (let value = Math.ceil(low / step) * step; value <= high + step / 1000; value += step) ticks.push(value);
  return ticks;
}

export function PayoffChart({
  desk,
  board,
  todayIso,
  scenario,
  scenarioIndex,
}: {
  desk: Desk;
  board: Board;
  todayIso: string;
  scenario: Scenario;
  scenarioIndex: number;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [hoverPrice, setHoverPrice] = useState<number | null>(null);

  useEffect(() => {
    if (!frame.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)));
    observer.observe(frame.current);
    return () => observer.disconnect();
  }, []);

  const { series, prices, low, high, minPrice, maxPrice } = useMemo(() => {
    const anchors = [...board.prices, desk.market.spot];
    const minPrice = Math.max(0.01, Math.min(...anchors) * 0.92);
    const maxPrice = Math.max(...anchors) * 1.08;
    const prices = Array.from({ length: STEPS + 1 }, (_, index) => minPrice + ((maxPrice - minPrice) * index) / STEPS);
    const series = board.rows
      .filter((row) => !row.problem)
      .map((row) => ({
        id: row.strategy.id,
        name: row.strategy.name,
        color: seriesColor(row.strategy.id),
        values: payoffCurve(desk, row.strategy, todayIso, prices, scenario.days, scenario.ivPct),
        atScenario: row.cells[scenarioIndex]?.pnl ?? 0,
      }));
    const values = series.flatMap((line) => line.values);
    const lo = Math.min(0, ...values);
    const hi = Math.max(0, ...values);
    const pad = Math.max((hi - lo) * 0.08, 50);
    return { series, prices, low: lo - pad, high: hi + pad, minPrice, maxPrice };
  }, [board, desk, scenario.days, scenario.ivPct, scenarioIndex, todayIso]);

  const plotWidth = width - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const x = (price: number) => PAD.left + ((price - minPrice) / (maxPrice - minPrice)) * plotWidth;
  const y = (value: number) => PAD.top + ((high - value) / (high - low)) * plotHeight;
  const scenarioX = x(board.prices[scenarioIndex]);
  const hoverIndex =
    hoverPrice === null ? null : Math.round(((hoverPrice - minPrice) / (maxPrice - minPrice)) * STEPS);
  const condition = `${scenarioTiming(scenario)}, ${scenario.ivPct === null ? "entry IV" : `${scenario.ivPct}% IV`}`;

  return (
    <div ref={frame} className="min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-base font-semibold text-ink">Profit or loss at every stock price</h2>
        <p className="text-xs text-ink-secondary">
          Valued {condition}, as in <span className="font-semibold text-ink">{scenario.name}</span>
        </p>
      </div>
      {series.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-line-strong p-6 text-center text-sm text-ink-secondary">
          Add a strategy to see its payoff curve.
        </p>
      ) : (
        <>
          <div className="relative mt-2">
            <svg
              viewBox={`0 0 ${width} ${HEIGHT}`}
              width={width}
              height={HEIGHT}
              role="img"
              aria-label={`Payoff curves for ${series.length} strategies across ${desk.market.symbol} prices from ${formatPrice(minPrice)} to ${formatPrice(maxPrice)}. The table above has the exact values.`}
              className="block max-w-full touch-none select-none font-mono"
              onPointerMove={(event) => {
                const box = event.currentTarget.getBoundingClientRect();
                const price = minPrice + (((event.clientX - box.left) / box.width) * width - PAD.left) / plotWidth * (maxPrice - minPrice);
                setHoverPrice(Math.min(maxPrice, Math.max(minPrice, price)));
              }}
              onPointerLeave={() => setHoverPrice(null)}
            >
              {yTicks(low, high).map((tick) => (
                <g key={tick}>
                  <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? "#94a3b8" : "#e2e8f0"} strokeWidth={1} />
                  <text x={PAD.left - 8} y={y(tick) + 3.5} textAnchor="end" fontSize={11} fill="#64748b">
                    {formatMoney(tick, tick !== 0)}
                  </text>
                </g>
              ))}
              {/* Scenario prices along the bottom, the selected one drawn through the plot. */}
              {desk.scenarios.map((item, index) => {
                const isSelected = index === scenarioIndex;
                return (
                  <g key={item.id}>
                    <line
                      x1={x(board.prices[index])}
                      x2={x(board.prices[index])}
                      y1={isSelected ? PAD.top : HEIGHT - PAD.bottom}
                      y2={HEIGHT - PAD.bottom + 5}
                      stroke={isSelected ? "#0f172a" : "#94a3b8"}
                      strokeWidth={1}
                      strokeDasharray={isSelected ? "4 3" : undefined}
                    />
                    {desk.scenarios.length <= 6 || isSelected ? (
                      <>
                        <text x={x(board.prices[index])} y={HEIGHT - PAD.bottom + 18} textAnchor="middle" fontSize={11} fill={isSelected ? "#0f172a" : "#475569"} fontWeight={isSelected ? 600 : 400}>
                          {formatPrice(board.prices[index])}
                        </text>
                        <text x={x(board.prices[index])} y={HEIGHT - PAD.bottom + 32} textAnchor="middle" fontSize={10} fill="#64748b">
                          {formatPct(item.movePct, 1)}
                        </text>
                      </>
                    ) : null}
                  </g>
                );
              })}
              {series.map((line) => (
                <path
                  key={line.id}
                  d={line.values.map((value, index) => `${index ? "L" : "M"}${x(prices[index]).toFixed(1)},${y(value).toFixed(1)}`).join("")}
                  fill="none"
                  stroke={line.color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ))}
              {series.map((line) => (
                <circle key={line.id} cx={scenarioX} cy={y(line.atScenario)} r={4.5} fill={line.color} stroke="#ffffff" strokeWidth={2} />
              ))}
              {hoverIndex !== null ? (
                <line x1={x(prices[hoverIndex])} x2={x(prices[hoverIndex])} y1={PAD.top} y2={HEIGHT - PAD.bottom} stroke="#475569" strokeWidth={1} />
              ) : null}
            </svg>
            {hoverIndex !== null ? (
              <div
                className="pointer-events-none absolute top-2 z-10 w-52 rounded-lg border border-line bg-surface p-2 text-xs shadow-lg"
                style={x(prices[hoverIndex]) > width / 2 ? { right: width - x(prices[hoverIndex]) + 10 } : { left: x(prices[hoverIndex]) + 10 }}
              >
                <p className="font-mono font-semibold text-ink tabular-nums">
                  {desk.market.symbol} at {formatPrice(prices[hoverIndex])}{" "}
                  <span className="font-normal text-ink-muted">{formatPct((prices[hoverIndex] / desk.market.spot - 1) * 100, 1)}</span>
                </p>
                <ul className="mt-1 space-y-0.5">
                  {series.map((line) => (
                    <li key={line.id} className="flex items-center gap-1.5">
                      <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: line.color }} />
                      <span className="min-w-0 flex-1 truncate text-ink-secondary">{line.name}</span>
                      <span className="font-mono font-semibold text-ink tabular-nums">{formatMoney(line.values[hoverIndex])}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          <ul className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-xs">
            {series.map((line) => (
              <li key={line.id} className="flex items-center gap-1.5">
                <span aria-hidden className="h-0.5 w-4 rounded-full" style={{ background: line.color }} />
                <span className="text-ink-secondary">{line.name}</span>
                <span className="font-mono font-semibold text-ink tabular-nums">{formatMoney(line.atScenario)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
