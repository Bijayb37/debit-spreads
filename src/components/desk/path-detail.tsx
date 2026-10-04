"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import {
  formatMoney,
  formatPct,
  formatPrice,
  pathSeries,
  type Board,
  type Desk,
  type Scenario,
} from "@/lib/scenario-desk";
import { outcomeTint, seriesColor } from "@/components/desk/colors";
import { Money, stepTiming } from "@/components/desk/outcome-grid";

// Two panels share the day axis: the stock's path on top, each strategy's profit or
// loss underneath.
const PAD = { top: 18, right: 18, bottom: 34, left: 62 };
const PRICE_PANEL = 74;
const GAP = 22;
const PNL_PANEL = 230;
const HEIGHT = PAD.top + PRICE_PANEL + GAP + PNL_PANEL + PAD.bottom;

function niceTicks(low: number, high: number, count: number): number[] {
  const rough = (high - low) / count;
  const power = 10 ** Math.floor(Math.log10(Math.max(rough, 1e-9)));
  const step = [1, 2, 2.5, 5, 10].map((factor) => factor * power).find((value) => value >= rough) ?? rough;
  const ticks: number[] = [];
  for (let value = Math.ceil(low / step) * step; value <= high + step / 1000; value += step) ticks.push(value);
  return ticks;
}

export function PathDetail({
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
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    if (!frame.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)));
    observer.observe(frame.current);
    return () => observer.disconnect();
  }, []);

  const path = board.paths[scenarioIndex];
  const series = useMemo(() => pathSeries(desk, todayIso, scenario), [desk, todayIso, scenario]);
  const rows = board.rows.filter((row) => !row.problem);
  const lines = series.lines.map((line) => {
    const row = rows.find((item) => item.strategy.id === line.id)!;
    const low = Math.min(...line.values);
    const high = Math.max(...line.values);
    return {
      ...line,
      row,
      color: seriesColor(line.id),
      low,
      lowDay: series.days[line.values.indexOf(low)],
      high,
      highDay: series.days[line.values.indexOf(high)],
    };
  });
  const end = series.days.at(-1)!;
  const plotWidth = width - PAD.left - PAD.right;
  const x = (day: number) => PAD.left + (end === 0 ? 0 : (day / end) * plotWidth);

  const priceLow = Math.min(...series.prices);
  const priceHigh = Math.max(...series.prices);
  const pricePad = Math.max((priceHigh - priceLow) * 0.2, priceHigh * 0.01);
  const yPrice = (price: number) =>
    PAD.top + ((priceHigh + pricePad - price) / (priceHigh - priceLow + pricePad * 2)) * PRICE_PANEL;

  const values = lines.flatMap((line) => line.values);
  const rawLow = Math.min(0, ...values);
  const rawHigh = Math.max(0, ...values);
  const pnlPad = Math.max((rawHigh - rawLow) * 0.08, 50);
  const pnlLow = rawLow - pnlPad;
  const pnlHigh = rawHigh + pnlPad;
  const pnlTop = PAD.top + PRICE_PANEL + GAP;
  const yPnl = (value: number) => pnlTop + ((pnlHigh - value) / (pnlHigh - pnlLow)) * PNL_PANEL;

  // The best strategy at each step, when there is more than one to compare.
  const bestAtStep = path.map((_, stepIndex) =>
    rows.length > 1
      ? rows.reduce((best, row) =>
          row.steps[scenarioIndex][stepIndex].pnl > best.steps[scenarioIndex][stepIndex].pnl ? row : best,
        ).strategy.id
      : null,
  );
  const hoverDay = hover === null ? null : series.days[hover];

  return (
    <div ref={frame} className="min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-base font-semibold text-ink">
          Along the way: <span className="text-accent-strong">{scenario.name}</span>
        </h2>
        <p className="font-mono text-xs text-ink-secondary tabular-nums">
          {formatPrice(desk.market.spot)} today
          {path.map((point) => ` → ${formatPrice(point.price)} on day ${point.day}`).join("")}
        </p>
      </div>

      {lines.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-line-strong p-6 text-center text-sm text-ink-secondary">
          Add a strategy to see how it holds up along this path.
        </p>
      ) : (
        <>
          <div className="relative mt-2">
            <svg
              viewBox={`0 0 ${width} ${HEIGHT}`}
              width={width}
              height={HEIGHT}
              role="img"
              aria-label={`${desk.market.symbol} price over ${end} days and the profit or loss of ${lines.length} strategies along that path. The table below has the values at each step.`}
              className="block max-w-full touch-none select-none font-mono"
              onPointerMove={(event) => {
                const box = event.currentTarget.getBoundingClientRect();
                const day = ((((event.clientX - box.left) / box.width) * width - PAD.left) / plotWidth) * end;
                let nearest = 0;
                series.days.forEach((value, index) => {
                  if (Math.abs(value - day) < Math.abs(series.days[nearest] - day)) nearest = index;
                });
                setHover(nearest);
              }}
              onPointerLeave={() => setHover(null)}
            >
              <text x={PAD.left} y={PAD.top - 6} fontSize={11} fill="#64748b">
                {desk.market.symbol} price
              </text>
              <text x={PAD.left} y={pnlTop - 6} fontSize={11} fill="#64748b">
                Profit or loss
              </text>

              {/* Step guides run through both panels. */}
              {path.map((point, index) => (
                <g key={index}>
                  <line x1={x(point.day)} x2={x(point.day)} y1={PAD.top} y2={HEIGHT - PAD.bottom} stroke="#94a3b8" strokeWidth={1} strokeDasharray="4 3" />
                  <text x={x(point.day)} y={HEIGHT - PAD.bottom + 16} textAnchor={index === path.length - 1 ? "end" : "middle"} fontSize={11} fill="#0f172a" fontWeight={600}>
                    day {point.day}
                  </text>
                </g>
              ))}
              <text x={x(0)} y={HEIGHT - PAD.bottom + 16} fontSize={11} fill="#64748b">
                today
              </text>

              {/* Stock path. */}
              <path
                d={series.days.map((day, index) => `${index ? "L" : "M"}${x(day).toFixed(1)},${yPrice(series.prices[index]).toFixed(1)}`).join("")}
                fill="none"
                stroke="#0f172a"
                strokeWidth={2}
                strokeLinejoin="round"
              />
              <text x={x(0) - 8} y={yPrice(desk.market.spot) + 4} textAnchor="end" fontSize={11} fill="#475569">
                {formatPrice(desk.market.spot)}
              </text>
              {path.map((point, index) => (
                <g key={index}>
                  <circle cx={x(point.day)} cy={yPrice(point.price)} r={4.5} fill="#0f172a" stroke="#ffffff" strokeWidth={2} />
                  <text
                    x={x(point.day) + (index === path.length - 1 ? -8 : 8)}
                    y={yPrice(point.price) + (point.price >= (path[index - 1]?.price ?? desk.market.spot) ? -7 : 15)}
                    textAnchor={index === path.length - 1 ? "end" : "start"}
                    fontSize={11}
                    fontWeight={600}
                    fill="#0f172a"
                  >
                    {formatPrice(point.price)}
                  </text>
                </g>
              ))}

              {/* Profit or loss. */}
              {niceTicks(pnlLow, pnlHigh, 4).map((tick) => (
                <g key={tick}>
                  <line x1={PAD.left} x2={width - PAD.right} y1={yPnl(tick)} y2={yPnl(tick)} stroke={tick === 0 ? "#94a3b8" : "#e2e8f0"} strokeWidth={1} />
                  <text x={PAD.left - 8} y={yPnl(tick) + 3.5} textAnchor="end" fontSize={11} fill="#64748b">
                    {formatMoney(tick, tick !== 0)}
                  </text>
                </g>
              ))}
              {lines.map((line) => (
                <path
                  key={line.id}
                  d={line.values.map((value, index) => `${index ? "L" : "M"}${x(series.days[index]).toFixed(1)},${yPnl(value).toFixed(1)}`).join("")}
                  fill="none"
                  stroke={line.color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ))}
              {/* A hollow marker where a strategy expires before the path ends. */}
              {lines.map((line) =>
                line.row.strategy.expirationDays < end ? (
                  <circle
                    key={line.id}
                    cx={x(line.row.strategy.expirationDays)}
                    cy={yPnl(line.values[series.days.indexOf(line.row.strategy.expirationDays)] ?? 0)}
                    r={4.5}
                    fill="#ffffff"
                    stroke={line.color}
                    strokeWidth={2}
                  />
                ) : null,
              )}
              {hoverDay !== null ? (
                <line x1={x(hoverDay)} x2={x(hoverDay)} y1={PAD.top} y2={HEIGHT - PAD.bottom} stroke="#475569" strokeWidth={1} />
              ) : null}
            </svg>
            {hover !== null && hoverDay !== null ? (
              <div
                className="pointer-events-none absolute z-10 w-56 rounded-lg border border-line bg-surface p-2 text-xs shadow-lg"
                style={{ top: pnlTop, ...(x(hoverDay) > width / 2 ? { right: width - x(hoverDay) + 10 } : { left: x(hoverDay) + 10 }) }}
              >
                <p className="font-mono font-semibold text-ink tabular-nums">
                  Day {hoverDay} · {formatPrice(series.prices[hover])}{" "}
                  <span className="font-normal text-ink-muted">
                    {formatPct((series.prices[hover] / desk.market.spot - 1) * 100, 1)} · IV {Math.round(series.ivs[hover])}%
                  </span>
                </p>
                <ul className="mt-1 space-y-0.5">
                  {lines.map((line) => (
                    <li key={line.id} className="flex items-center gap-1.5">
                      <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: line.color }} />
                      <span className="min-w-0 flex-1 truncate text-ink-secondary">{line.row.strategy.name}</span>
                      <span className="font-mono font-semibold text-ink tabular-nums">{formatMoney(line.values[hover])}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
            {lines.map((line) => (
              <li key={line.id} className="flex items-center gap-1.5">
                <span aria-hidden className="h-0.5 w-4 rounded-full" style={{ background: line.color }} />
                <span className="text-ink-secondary">{line.row.strategy.name}</span>
                {line.row.strategy.expirationDays < end ? (
                  <span className="text-ink-muted">○ expires day {line.row.strategy.expirationDays}</span>
                ) : null}
              </li>
            ))}
          </ul>

          <div className="mt-3 overflow-x-auto rounded-lg border border-line">
            <table className="w-full border-separate border-spacing-0 text-left">
              <caption className="sr-only">Profit or loss of each strategy at each step of {scenario.name}.</caption>
              <thead>
                <tr>
                  <th scope="col" className="sticky left-0 z-10 border-b border-line bg-surface-muted px-3 py-2 align-bottom text-caption font-semibold uppercase tracking-wide text-ink-muted">
                    At each step
                  </th>
                  {path.map((point, index) => (
                    <th key={index} scope="col" className="min-w-28 border-b border-l border-line bg-surface-muted px-2.5 py-2 text-right align-bottom font-normal">
                      <span className="block text-sm font-semibold text-ink">{stepTiming(scenario.steps[index], point)}</span>
                      <span className="block font-mono text-xs text-ink-soft tabular-nums">
                        {formatPrice(point.price)} · {formatPct(point.movePct, 1)}
                      </span>
                      <span className="block text-caption text-ink-muted">IV {point.ivPct}%</span>
                    </th>
                  ))}
                  {["Lowest on the way", "Highest on the way"].map((label, index) => (
                    <th
                      key={label}
                      scope="col"
                      className={cn("min-w-28 border-b border-line bg-surface-muted px-2.5 py-2 text-right align-bottom text-caption font-semibold uppercase tracking-wide text-ink-muted", index === 0 ? "border-l-2" : "border-l")}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((line, lineIndex) => {
                  const border = lineIndex === lines.length - 1 ? "" : "border-b";
                  return (
                    <tr key={line.id}>
                      <th scope="row" className={cn("sticky left-0 z-10 border-line bg-surface px-3 py-2 font-normal", border)}>
                        <span className="flex w-40 items-center gap-2 sm:w-48">
                          <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: line.color }} />
                          <span className="truncate text-sm font-semibold text-ink">{line.row.strategy.name}</span>
                        </span>
                      </th>
                      {line.row.steps[scenarioIndex].map((cell, stepIndex) => (
                        <td
                          key={stepIndex}
                          className={cn("border-l border-line px-2.5 py-2 text-right align-middle", border)}
                          style={{ backgroundColor: outcomeTint(cell.returnPct) }}
                        >
                          <span className="block">
                            <Money value={cell.pnl} strong />
                          </span>
                          <span className="block font-mono text-caption text-ink-soft tabular-nums">
                            {cell.expiredDay !== null ? <span className="mr-1 font-sans text-ink-muted">exp. d{cell.expiredDay}</span> : null}
                            {formatPct(cell.returnPct)}
                            {bestAtStep[stepIndex] === line.id ? (
                              <span title="Highest profit or loss at this step" className="ml-1 text-ink">
                                ★<span className="sr-only"> best at this step</span>
                              </span>
                            ) : null}
                          </span>
                        </td>
                      ))}
                      {[
                        { value: line.low, day: line.lowDay },
                        { value: line.high, day: line.highDay },
                      ].map((extreme, index) => (
                        <td key={index} className={cn("border-line bg-surface-muted px-2.5 py-2 text-right align-middle", border, index === 0 ? "border-l-2" : "border-l")}>
                          <span className="block">
                            <Money value={extreme.value} />
                          </span>
                          <span className="block text-caption text-ink-muted">{extreme.day === 0 ? "today" : `day ${extreme.day}`}</span>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-caption text-ink-muted">
            The stock moves in a straight line between steps, and IV with it. A strategy that expires before a step keeps the result it had on its expiry day.
          </p>
        </>
      )}
    </div>
  );
}
