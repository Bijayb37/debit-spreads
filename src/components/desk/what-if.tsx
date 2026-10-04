"use client";

import { cn } from "@/lib/cn";
import {
  MAX_MOMENTS,
  formatDollars,
  formatPct,
  formatPrice,
  horizonDays,
  momentLabel,
  movePrice,
  strikeIncrement,
  type Board,
  type BoardRow,
  type Desk,
  type Moment,
  type WhatIfInput,
} from "@/lib/scenario-desk";
import { outcomeTint, seriesColor } from "@/components/desk/colors";
import { NumberField } from "@/components/desk/fields";
import { PayoffChart } from "@/components/desk/payoff-chart";

const tone = (value: number) => (value > 0.5 ? "text-gain" : value < -0.5 ? "text-loss" : "text-ink-secondary");

function Slider({
  id,
  label,
  value,
  min,
  max,
  step,
  prefix,
  suffix,
  note,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  prefix?: string;
  suffix?: string;
  note: React.ReactNode;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <label htmlFor={`${id}-range`} className="block text-sm font-semibold text-ink">
            {label}
          </label>
          <p className="text-xs text-ink-muted">{note}</p>
        </div>
        <NumberField id={id} label={label} hideLabel className="w-32 shrink-0" value={value} prefix={prefix} suffix={suffix} min={min} step={step} onCommit={onChange} />
      </div>
      <input
        id={`${id}-range`}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2.5 block h-2 w-full cursor-pointer accent-accent"
      />
    </div>
  );
}

// One strategy: the answer as a single large figure.
function SingleResult({ row }: { row: BoardRow }) {
  return (
    <div>
      <p className={cn("font-mono text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl", tone(row.now.pnl))}>{formatDollars(row.now.pnl)}</p>
      <p className="mt-1 text-sm text-ink-secondary">
        {formatPct(row.now.returnPct)} on the {formatDollars(row.cost, false)} it cost · position worth {formatDollars(row.now.value, false)}
        {row.now.expired ? ` · expired on day ${row.strategy.expirationDays}` : ""}
      </p>
    </div>
  );
}

// Several strategies: one line each, with a bar so sizes compare at a glance.
function ComparedResults({ rows, bestId }: { rows: BoardRow[]; bestId: string | null }) {
  const largest = Math.max(1, ...rows.map((row) => Math.abs(row.now.pnl)));
  return (
    <ul className="divide-y divide-line">
      {rows.map((row) => (
        <li key={row.strategy.id} className="py-2.5 sm:grid sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] sm:items-center sm:gap-x-4">
          <p className="flex min-w-0 items-center gap-2">
            <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: seriesColor(row.strategy.id) }} />
            <span className="truncate text-sm font-semibold text-ink">{row.strategy.name}</span>
          </p>
          <div className="mt-1.5 flex items-center gap-3 sm:contents">
            <div aria-hidden className="grid h-2.5 min-w-0 flex-1 grid-cols-2">
              <div className="flex justify-end border-r border-line-strong">
                {row.now.pnl < 0 ? <div className="h-full rounded-l-sm bg-loss/70" style={{ width: `${Math.round((Math.abs(row.now.pnl) / largest) * 100)}%` }} /> : null}
              </div>
              <div>{row.now.pnl > 0 ? <div className="h-full rounded-r-sm bg-gain/70" style={{ width: `${Math.round((row.now.pnl / largest) * 100)}%` }} /> : null}</div>
            </div>
            <p className="shrink-0 text-right">
              <span className={cn("font-mono text-lg font-semibold tabular-nums", tone(row.now.pnl))}>{formatDollars(row.now.pnl)}</span>
              <span className="ml-2 inline-block w-28 text-left text-xs text-ink-muted">
                {formatPct(row.now.returnPct)}
                {row.strategy.id === bestId ? " · ahead here" : row.now.expired ? ` · expired d${row.strategy.expirationDays}` : ""}
              </span>
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Moments({
  desk,
  rows,
  onLoad,
  onRemove,
}: {
  desk: Desk;
  rows: BoardRow[];
  onLoad: (moment: Moment) => void;
  onRemove: (id: string) => void;
}) {
  // Shown in time order, whatever order they were saved in.
  const order = desk.moments.map((moment, index) => ({ moment, index })).sort((first, second) => first.moment.days - second.moment.days || first.moment.movePct - second.moment.movePct);
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full border-separate border-spacing-0 text-left">
        <caption className="sr-only">Profit or loss of each strategy at each saved moment.</caption>
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 z-10 border-b border-line bg-surface-muted px-3 py-2 align-bottom text-xs font-semibold text-ink-secondary">
              Saved moments
            </th>
            {order.map(({ moment }) => (
              <th key={moment.id} scope="col" className="min-w-28 border-b border-l border-line bg-surface-muted px-2.5 py-2 text-right align-bottom font-normal">
                <button type="button" title="Show this moment above" onClick={() => onLoad(moment)} className="block w-full text-right hover:text-accent focus-visible:outline-2 focus-visible:outline-accent">
                  <span className="block text-sm font-semibold text-ink">{moment.name || `Day ${moment.days}`}</span>
                  <span className="block font-mono text-xs text-ink-soft tabular-nums">
                    {formatPrice(movePrice(desk.market, moment.movePct))}
                    {moment.name ? ` · day ${moment.days}` : ""}
                  </span>
                  {moment.ivPct !== null ? <span className="block text-caption text-ink-muted">IV {moment.ivPct}%</span> : null}
                </button>
                <button type="button" onClick={() => onRemove(moment.id)} className="text-caption font-semibold text-ink-muted underline-offset-2 hover:text-loss hover:underline">
                  Remove<span className="sr-only"> {momentLabel(desk.market, moment)}</span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={row.strategy.id}>
              <th scope="row" className={cn("sticky left-0 z-10 border-line bg-surface px-3 py-2 font-normal", rowIndex < rows.length - 1 && "border-b")}>
                <span className="flex w-36 items-center gap-2 sm:w-48">
                  <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: seriesColor(row.strategy.id) }} />
                  <span className="truncate text-sm font-semibold text-ink">{row.strategy.name}</span>
                </span>
              </th>
              {order.map(({ moment, index }) => {
                const cell = row.moments[index];
                return (
                  <td
                    key={moment.id}
                    className={cn("border-l border-line px-2.5 py-2 text-right align-middle", rowIndex < rows.length - 1 && "border-b")}
                    style={{ backgroundColor: outcomeTint(cell.returnPct) }}
                  >
                    <span className={cn("block font-mono text-base font-semibold tabular-nums", tone(cell.pnl))}>{formatDollars(cell.pnl)}</span>
                    <span className="block font-mono text-caption text-ink-soft tabular-nums">
                      {cell.expired ? <span className="mr-1 font-sans text-ink-muted">expired</span> : null}
                      {formatPct(cell.returnPct)}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function WhatIfCard({
  desk,
  board,
  todayIso,
  onWhatIf,
  onSaveMoment,
  onRemoveMoment,
}: {
  desk: Desk;
  board: Board;
  todayIso: string;
  onWhatIf: (patch: WhatIfInput) => void;
  onSaveMoment: () => void;
  onRemoveMoment: (id: string) => void;
}) {
  const { symbol, spot, ivPct: todayIv } = desk.market;
  const rows = board.rows.filter((row) => !row.problem);
  const horizon = horizonDays(desk);
  const priceStep = strikeIncrement(spot) / (spot < 25 ? 5 : 1);
  const isSaved = desk.moments.some(
    (moment) => moment.days === board.days && movePrice(desk.market, moment.movePct) === board.price && (moment.ivPct ?? todayIv) === board.ivPct,
  );

  return (
    <section aria-label="What if" className="rounded-xl border border-line bg-surface p-4 shadow-sm sm:p-5">
      <h2 className="text-base font-semibold text-ink">What if…</h2>
      <div className="mt-3 space-y-4">
        <Slider
          id="what-if-price"
          label={`${symbol} is at`}
          prefix="$"
          value={board.price}
          min={Math.min(Math.round(spot * 0.5), board.price)}
          max={Math.max(Math.round(spot * 1.5), board.price)}
          step={priceStep}
          note={board.price === spot ? "same as today" : `${formatPct((board.price / spot - 1) * 100, 1)} from today's ${formatPrice(spot)}`}
          onChange={(price) => onWhatIf({ price })}
        />
        <Slider
          id="what-if-days"
          label="Days from today"
          suffix="days"
          value={board.days}
          min={0}
          max={horizon}
          step={1}
          note={board.days === 0 ? "today" : board.days >= horizon ? "on expiry day" : `${horizon - board.days} days before expiry`}
          onChange={(days) => onWhatIf({ days: Math.min(days, horizon) })}
        />
        <Slider
          id="what-if-iv"
          label="IV then"
          suffix="%"
          value={board.ivPct}
          min={5}
          max={Math.max(150, Math.ceil(todayIv * 2))}
          step={1}
          note={
            board.ivPct === todayIv ? (
              "same as today"
            ) : (
              <button type="button" onClick={() => onWhatIf({ ivPct: null })} className="font-semibold text-accent underline-offset-2 hover:underline">
                Back to today&apos;s {todayIv}%
              </button>
            )
          }
          onChange={(ivPct) => onWhatIf({ ivPct })}
        />
      </div>

      <div className="mt-5 border-t border-line pt-4" aria-live="polite">
        {rows.length === 0 ? (
          <p className="text-sm text-ink-secondary">Add a strategy above to see the result here.</p>
        ) : (
          <>
            <p className="text-sm text-ink-secondary">
              {rows.length === 1 ? rows[0].strategy.name : "Each strategy"}, if {symbol} is at{" "}
              <strong className="font-semibold text-ink">{formatPrice(board.price)}</strong> {board.days === 0 ? "today" : `in ${board.days} days`} with IV at {board.ivPct}%:
            </p>
            <div className="mt-2">{rows.length === 1 ? <SingleResult row={rows[0]} /> : <ComparedResults rows={rows} bestId={board.bestNow} />}</div>
          </>
        )}
      </div>

      {rows.length > 0 ? (
        <>
          <div className="mt-5">
            <PayoffChart desk={desk} board={board} todayIso={todayIso} onPrice={(price) => onWhatIf({ price: Math.round(price / priceStep) * priceStep })} />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-4">
            <button
              type="button"
              disabled={isSaved || desk.moments.length >= MAX_MOMENTS}
              onClick={onSaveMoment}
              className="rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm font-semibold text-ink-soft shadow-sm hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
            >
              {isSaved ? "Saved" : "Save this moment"}
            </button>
            <p className="text-xs text-ink-muted">
              {desk.moments.length === 0
                ? "Save a few moments to compare them side by side, like a rally on day 20 and a pullback on day 45."
                : "Select a saved moment to show it above."}
            </p>
          </div>
          {desk.moments.length > 0 ? (
            <div className="mt-3">
              <Moments desk={desk} rows={rows} onLoad={(moment) => onWhatIf({ movePct: moment.movePct, days: moment.days, ivPct: moment.ivPct })} onRemove={onRemoveMoment} />
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
