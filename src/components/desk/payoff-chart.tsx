"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  formatDollars,
  formatMoney,
  formatPct,
  formatPrice,
  movePrice,
  payoffCurve,
  type Board,
  type Desk,
} from "@/lib/scenario-desk";
import { seriesColor } from "@/components/desk/colors";

const HEIGHT = 260;
const PAD = { top: 14, right: 16, bottom: 40, left: 58 };
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

// Profit or loss across stock prices on the what-if's day and IV. Clicking the
// chart moves the what-if to that price.
export function PayoffChart({
  desk,
  board,
  todayIso,
  onPrice,
}: {
  desk: Desk;
  board: Board;
  todayIso: string;
  onPrice: (price: number) => void;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hoverPrice, setHoverPrice] = useState<number | null>(null);

  useEffect(() => {
    if (!frame.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)));
    observer.observe(frame.current);
    return () => observer.disconnect();
  }, []);

  const { lines, prices, low, high, minPrice, maxPrice } = useMemo(() => {
    const anchors = [board.price, desk.market.spot, ...desk.moments.map((moment) => movePrice(desk.market, moment.movePct))];
    const minPrice = Math.max(0.01, Math.min(desk.market.spot * 0.7, ...anchors.map((price) => price * 0.95)));
    const maxPrice = Math.max(desk.market.spot * 1.3, ...anchors.map((price) => price * 1.05));
    const prices = Array.from({ length: STEPS + 1 }, (_, index) => minPrice + ((maxPrice - minPrice) * index) / STEPS);
    const usable = board.rows.filter((row) => !row.problem);
    const lines = usable.map((row) => ({
      id: row.strategy.id,
      name: row.strategy.name,
      color: seriesColor(row.strategy.id),
      values: payoffCurve(desk, row.strategy, todayIso, prices, board.days, board.ivPct),
      // With one strategy there is room for the familiar at-expiry line as well.
      atExpiry: usable.length === 1 && board.days < row.strategy.expirationDays
        ? payoffCurve(desk, row.strategy, todayIso, prices, row.strategy.expirationDays, board.ivPct)
        : null,
      now: row.now.pnl,
    }));
    const values = lines.flatMap((line) => [...line.values, ...(line.atExpiry ?? [])]);
    const lo = Math.min(0, ...values);
    const hi = Math.max(0, ...values);
    const pad = Math.max((hi - lo) * 0.08, 50);
    return { lines, prices, low: lo - pad, high: hi + pad, minPrice, maxPrice };
  }, [board, desk, todayIso]);

  if (lines.length === 0) return null;

  const plotWidth = width - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  // Rounded so the server and the browser, whose maths can differ in the last digit,
  // render identical markup.
  const tenth = (value: number) => Math.round(value * 10) / 10;
  const x = (price: number) => tenth(PAD.left + ((price - minPrice) / (maxPrice - minPrice)) * plotWidth);
  const y = (value: number) => tenth(PAD.top + ((high - value) / (high - low)) * plotHeight);
  const priceAt = (event: React.PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const price = minPrice + ((((event.clientX - box.left) / box.width) * width - PAD.left) / plotWidth) * (maxPrice - minPrice);
    return Math.min(maxPrice, Math.max(minPrice, price));
  };
  const hoverIndex = hoverPrice === null ? null : Math.round(((hoverPrice - minPrice) / (maxPrice - minPrice)) * STEPS);
  const path = (values: number[]) => values.map((value, index) => `${index ? "L" : "M"}${x(prices[index])},${y(value)}`).join("");
  const single = lines.length === 1 ? lines[0] : null;

  return (
    <div ref={frame} className="min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-sm font-semibold text-ink">
          Profit or loss at every {desk.market.symbol} price, {board.days === 0 ? "today" : `on day ${board.days}`}
        </h3>
        {single?.atExpiry ? (
          <p className="flex items-center gap-3 text-xs text-ink-secondary">
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="h-0.5 w-4 rounded-full" style={{ background: single.color }} />
              on day {board.days}
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="w-4 border-t-2 border-dashed border-slate-400" />
              at expiry
            </span>
          </p>
        ) : null}
      </div>
      <div className="relative mt-1">
        <svg
          viewBox={`0 0 ${width} ${HEIGHT}`}
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`Profit or loss of ${lines.length === 1 ? lines[0].name : `${lines.length} strategies`} across ${desk.market.symbol} prices from ${formatPrice(minPrice)} to ${formatPrice(maxPrice)} on day ${board.days}.`}
          className="block max-w-full cursor-crosshair touch-none select-none font-mono"
          onPointerMove={(event) => setHoverPrice(priceAt(event))}
          onPointerLeave={() => setHoverPrice(null)}
          onClick={(event) => onPrice(priceAt(event as unknown as React.PointerEvent<SVGSVGElement>))}
        >
          {yTicks(low, high).map((tick) => (
            <g key={tick}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? "#94a3b8" : "#eef2f6"} strokeWidth={1} />
              <text x={PAD.left - 8} y={y(tick) + 3.5} textAnchor="end" fontSize={11} fill="#64748b">
                {formatMoney(tick, tick !== 0)}
              </text>
            </g>
          ))}
          {/* Today's price on the axis. */}
          <line x1={x(desk.market.spot)} x2={x(desk.market.spot)} y1={HEIGHT - PAD.bottom} y2={HEIGHT - PAD.bottom + 5} stroke="#94a3b8" strokeWidth={1} />
          <text x={x(desk.market.spot)} y={HEIGHT - PAD.bottom + 18} textAnchor="middle" fontSize={11} fill="#64748b">
            {formatPrice(desk.market.spot)}
          </text>
          <text x={x(desk.market.spot)} y={HEIGHT - PAD.bottom + 31} textAnchor="middle" fontSize={10} fill="#94a3b8">
            today
          </text>
          {/* The what-if price. */}
          <line x1={x(board.price)} x2={x(board.price)} y1={PAD.top} y2={HEIGHT - PAD.bottom + 5} stroke="#0f172a" strokeWidth={1} strokeDasharray="4 3" />
          {Math.abs(x(board.price) - x(desk.market.spot)) > 44 ? (
            <text x={x(board.price)} y={HEIGHT - PAD.bottom + 18} textAnchor="middle" fontSize={11} fontWeight={600} fill="#0f172a">
              {formatPrice(board.price)}
            </text>
          ) : null}
          {lines.map((line) =>
            line.atExpiry ? <path key={`${line.id}-expiry`} d={path(line.atExpiry)} fill="none" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 4" strokeLinejoin="round" /> : null,
          )}
          {lines.map((line) => (
            <path key={line.id} d={path(line.values)} fill="none" stroke={line.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {lines.map((line) => (
            <circle key={line.id} cx={x(board.price)} cy={y(line.now)} r={5} fill={line.color} stroke="#ffffff" strokeWidth={2} />
          ))}
          {hoverIndex !== null ? <line x1={x(prices[hoverIndex])} x2={x(prices[hoverIndex])} y1={PAD.top} y2={HEIGHT - PAD.bottom} stroke="#94a3b8" strokeWidth={1} /> : null}
        </svg>
        {hoverIndex !== null ? (
          <div
            className="pointer-events-none absolute top-1 z-10 w-52 rounded-lg border border-line bg-surface p-2 text-xs shadow-lg"
            style={x(prices[hoverIndex]) > width / 2 ? { right: width - x(prices[hoverIndex]) + 10 } : { left: x(prices[hoverIndex]) + 10 }}
          >
            <p className="font-mono font-semibold text-ink tabular-nums">
              {formatPrice(prices[hoverIndex])}{" "}
              <span className="font-normal text-ink-muted">{formatPct((prices[hoverIndex] / desk.market.spot - 1) * 100, 1)}</span>
            </p>
            <ul className="mt-1 space-y-0.5">
              {lines.map((line) => (
                <li key={line.id} className="flex items-center gap-1.5">
                  <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: line.color }} />
                  <span className="min-w-0 flex-1 truncate text-ink-secondary">{line.name}</span>
                  <span className="font-mono font-semibold text-ink tabular-nums">{formatDollars(line.values[hoverIndex])}</span>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-ink-muted">Click to set this price</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
