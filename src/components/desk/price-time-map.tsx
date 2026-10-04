"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import {
  formatMoney,
  formatPct,
  formatPrice,
  priceTimeMap,
  type Board,
  type Desk,
} from "@/lib/scenario-desk";
import { outcomeTint, seriesColor } from "@/components/desk/colors";

// Every stock price against every date, for all strategies at once. "Best" shows
// which strategy is ahead in each cell; picking one strategy shows only its values.
export function PriceTimeMap({ desk, board, todayIso }: { desk: Desk; board: Board; todayIso: string }) {
  // null follows the entry IV.
  const [iv, setIv] = useState<number | null>(null);
  const [view, setView] = useState("best");
  const [active, setActive] = useState<{ row: number; column: number } | null>(null);
  const ivPct = iv ?? desk.market.ivPct;
  const map = useMemo(() => priceTimeMap(desk, todayIso, ivPct), [desk, todayIso, ivPct]);
  const rows = board.rows.filter((row) => !row.problem);
  const shown = rows.find((row) => row.strategy.id === view);
  const cell = active && map.prices[active.row] !== undefined && map.days[active.column] !== undefined ? active : null;

  const valuesAt = (rowIndex: number, columnIndex: number) =>
    rows
      .map((row) => ({ row, pnl: map.values[row.strategy.id]?.[rowIndex]?.[columnIndex] ?? 0 }))
      .sort((first, second) => second.pnl - first.pnl);

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div>
          <h2 className="text-base font-semibold text-ink">Every price, every date</h2>
          <p className="text-xs text-ink-secondary">
            {shown ? `${shown.strategy.name}: profit or loss` : "Which strategy is ahead, and by how much"} if {desk.market.symbol} is at each price on each day.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-medium text-ink-secondary">
            Show
            <select
              id="map-view"
              value={shown ? view : "best"}
              onChange={(event) => setView(event.target.value)}
              className="mt-1 block rounded-md border border-line-strong bg-surface px-2 py-1 text-sm text-ink outline-none focus:border-accent"
            >
              <option value="best">Best strategy</option>
              {rows.map((row) => (
                <option key={row.strategy.id} value={row.strategy.id}>
                  {row.strategy.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-ink-secondary">
            IV on those dates
            <span className="mt-1 flex items-center gap-2">
              <input
                id="map-iv-range"
                type="range"
                min={5}
                max={Math.max(120, Math.ceil(desk.market.ivPct * 2))}
                step={1}
                value={ivPct}
                aria-label="IV on those dates"
                onChange={(event) => setIv(Number(event.target.value))}
                className="w-32 accent-accent"
              />
              <span className="w-10 font-mono text-sm font-semibold text-ink tabular-nums">{Math.round(ivPct)}%</span>
              <button
                type="button"
                disabled={iv === null || iv === desk.market.ivPct}
                onClick={() => setIv(null)}
                className="text-xs font-semibold text-accent underline-offset-2 hover:underline disabled:text-ink-muted disabled:no-underline"
              >
                Entry IV
              </button>
            </span>
          </label>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-line-strong p-6 text-center text-sm text-ink-secondary">
          Add a strategy to map it across prices and dates.
        </p>
      ) : (
        <>
          <div className="mt-3 overflow-x-auto rounded-lg border border-line" onPointerLeave={() => setActive(null)}>
            <table className="w-full border-separate border-spacing-0">
              <caption className="sr-only">
                Profit or loss by {desk.market.symbol} price (rows) and days from today (columns) at {Math.round(ivPct)}% IV.
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="sticky left-0 z-10 border-b border-line bg-surface-muted px-2.5 py-1.5 text-left text-caption font-semibold uppercase tracking-wide text-ink-muted">
                    Price
                  </th>
                  {map.days.map((day) => (
                    <th key={day} scope="col" className="min-w-20 border-b border-l border-line bg-surface-muted px-2 py-1.5 text-right text-xs font-semibold text-ink">
                      {day === 0 ? "Today" : `Day ${day}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {map.prices.map((price, rowIndex) => {
                  const movePct = (price / desk.market.spot - 1) * 100;
                  const isSpot = Math.abs(movePct) < 0.005;
                  return (
                    <tr key={price}>
                      <th
                        scope="row"
                        className={cn(
                          "sticky left-0 z-10 whitespace-nowrap border-b border-line px-2.5 py-1 text-left font-mono text-xs tabular-nums",
                          isSpot ? "bg-accent-soft font-semibold text-ink" : "bg-surface font-medium text-ink-soft",
                        )}
                      >
                        {formatPrice(price)} <span className="font-normal text-ink-muted">{isSpot ? "now" : formatPct(movePct)}</span>
                      </th>
                      {map.days.map((day, columnIndex) => {
                        const ranked = valuesAt(rowIndex, columnIndex);
                        const entry = shown ? ranked.find((item) => item.row === shown)! : ranked[0];
                        const isActive = cell?.row === rowIndex && cell.column === columnIndex;
                        return (
                          <td
                            key={day}
                            className={cn("border-b border-l border-line p-0", isActive && "outline outline-2 -outline-offset-2 outline-accent")}
                            style={{ backgroundColor: outcomeTint((entry.pnl / entry.row.strategy.budget) * 100) }}
                          >
                            <button
                              type="button"
                              onPointerEnter={() => setActive({ row: rowIndex, column: columnIndex })}
                              onFocus={() => setActive({ row: rowIndex, column: columnIndex })}
                              onClick={() => setActive({ row: rowIndex, column: columnIndex })}
                              aria-label={`${formatPrice(price)} on day ${day}: ${entry.row.strategy.name} ${formatMoney(entry.pnl)}`}
                              className="flex w-full items-center justify-end gap-1.5 px-2 py-1 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
                            >
                              {shown ? null : (
                                <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: seriesColor(entry.row.strategy.id) }} />
                              )}
                              <span className={cn("font-mono text-xs font-semibold tabular-nums", entry.pnl > 0.5 ? "text-gain" : entry.pnl < -0.5 ? "text-loss" : "text-ink-secondary")}>
                                {formatMoney(entry.pnl)}
                              </span>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-2 min-h-16 rounded-lg border border-line bg-surface-muted px-3 py-2" aria-live="polite">
            {cell ? (
              <>
                <p className="text-xs font-semibold text-ink">
                  {desk.market.symbol} at {formatPrice(map.prices[cell.row])} on {map.days[cell.column] === 0 ? "day 0 (today)" : `day ${map.days[cell.column]}`}, IV {Math.round(ivPct)}%
                </p>
                <ul className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-xs">
                  {valuesAt(cell.row, cell.column).map(({ row, pnl }) => (
                    <li key={row.strategy.id} className="flex items-center gap-1.5">
                      <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: seriesColor(row.strategy.id) }} />
                      <span className="text-ink-secondary">{row.strategy.name}</span>
                      <span className={cn("font-mono font-semibold tabular-nums", pnl > 0.5 ? "text-gain" : pnl < -0.5 ? "text-loss" : "text-ink-secondary")}>{formatMoney(pnl)}</span>
                      {map.days[cell.column] > row.strategy.expirationDays ? (
                        <span className="text-ink-muted">(expired day {row.strategy.expirationDays})</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-xs text-ink-secondary">
                Point at or tap a cell to see every strategy at that price and date.
                {shown ? "" : " The dot shows which strategy is ahead there:"}
                {shown
                  ? null
                  : rows.map((row) => (
                      <span key={row.strategy.id} className="ml-3 inline-flex items-center gap-1.5">
                        <span aria-hidden className="size-2 rounded-full" style={{ background: seriesColor(row.strategy.id) }} />
                        {row.strategy.name}
                      </span>
                    ))}
              </p>
            )}
          </div>
          <p className="mt-2 text-caption text-ink-muted">
            A date after a strategy expires shows that strategy at its expiry at that price.
          </p>
        </>
      )}
    </div>
  );
}
