"use client";

import { cn } from "@/lib/cn";
import {
  KINDS,
  MAX_MOMENTS,
  formatCents,
  formatDollars,
  formatPct,
  formatPrice,
  horizonDays,
  momentLabel,
  movePrice,
  strategyStrikes,
  strikeIncrement,
  type Board,
  type BoardRow,
  type Desk,
  type Moment,
  type WhatIfInput,
} from "@/lib/scenario-desk";
import { seriesColor } from "@/components/desk/colors";
import { NumberField } from "@/components/desk/fields";

const noteLink = "font-semibold text-accent underline-offset-2 hover:underline";

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
  marks,
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
  // Bookmarked values, shown as ticks under the track.
  marks: number[];
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
      <div aria-hidden className="relative h-2">
        {[...new Set(marks)]
          .filter((mark) => mark >= min && mark <= max && max > min)
          .map((mark) => {
            const share = (mark - min) / (max - min);
            // The thumb's centre travels the track width minus the thumb (about 16px).
            return <span key={mark} className="absolute top-0.5 h-1.5 w-0.5 -translate-x-1/2 rounded-full bg-ink-secondary" style={{ left: `calc(${Math.round(share * 1000) / 10}% + ${Math.round((0.5 - share) * 16)}px)` }} />;
          })}
      </div>
    </div>
  );
}

// One card per strategy with everything about it at the what-if: what the position is
// worth, what it has made or lost, and the terms it was entered on.
function StrategyCards({ desk, rows, bestId }: { desk: Desk; rows: BoardRow[]; bestId: string | null }) {
  return (
    <div className={cn("grid min-w-0 gap-3", rows.length > 1 && "sm:grid-cols-2")}>
      {rows.map((row) => {
        const { strategy } = row;
        const kind = KINDS[strategy.kind];
        const details = [
          ...(row.unitCredit !== null ? [{ label: "Credit / spread", value: formatCents(row.unitCredit), className: "text-gain" }] : []),
          {
            label: "DTE · Initial price",
            value: `${kind.calendar ? `${strategy.shortExpirationDays}/${strategy.expirationDays}` : strategy.expirationDays} · ${formatPrice(desk.market.spot)}`,
          },
          {
            label: kind.calendar ? "Target" : row.lowerBreakEven !== null ? "B/Es" : "B/E",
            value: row.lowerBreakEven !== null ? `${formatCents(row.lowerBreakEven)} / ${formatCents(row.breakEven)}` : formatCents(row.breakEven),
          },
          {
            label:
              row.unitCredit !== null
                ? "Reserve / spread"
                : strategy.kind === "long-call"
                  ? "Call cost"
                  : strategy.kind === "bear-put"
                    ? "Put cost"
                    : kind.calendar
                      ? "Calendar cost"
                      : strategy.kind === "bull-put-spread"
                        ? "Risk per spread"
                        : kind.short === "below"
                          ? "Put spread cost"
                          : "Spread cost",
            value: formatCents(row.unitCost),
          },
          { label: row.unitCredit !== null ? "Capital reserved" : "Initial cost", value: formatDollars(row.cost, false) },
          { label: "Contracts", value: String(row.contracts) },
          { label: "IV", value: `${desk.market.ivPct}%` },
          {
            label: "Max profit %",
            value: kind.calendar ? "Open" : row.maxReturnPct === null ? "Uncapped" : formatPct(row.maxReturnPct),
            className: "text-gain",
          },
          { label: "Max loss", value: row.maxLoss === null ? "Uncapped" : formatDollars(-row.maxLoss), className: "text-loss" },
        ];

        return (
          <article key={strategy.id} className="min-w-0 overflow-hidden rounded-lg border border-line bg-surface shadow-sm">
            <div className="flex min-h-12 min-w-0 items-center gap-2 bg-slate-950 px-3 py-2 text-white">
              <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: seriesColor(strategy.id) }} />
              <h3 className="min-w-0 truncate text-sm font-semibold leading-tight">{strategy.name}</h3>
              <p className="shrink-0 font-mono text-xs font-medium text-slate-300 tabular-nums">{strategyStrikes(strategy)}</p>
              {strategy.id === bestId ? <span className="ml-auto shrink-0 rounded-full bg-accent px-2 py-0.5 text-micro font-semibold text-white">Ahead here</span> : null}
            </div>
            <div className="space-y-2 p-2.5">
              <div className="grid min-w-0 grid-cols-3 gap-2 rounded-md bg-surface-muted p-2.5">
                <div className="min-w-0">
                  <p className="text-caption font-medium text-ink-muted">Position value</p>
                  <p className="mt-1 truncate font-mono text-sm font-semibold leading-none text-ink tabular-nums">{formatDollars(row.now.value, false)}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-caption font-medium text-ink-muted">P/L</p>
                  <p className={cn("mt-1 truncate font-mono text-xl font-semibold leading-none tabular-nums", tone(row.now.pnl))}>{formatDollars(row.now.pnl)}</p>
                </div>
                <div className="min-w-0 text-right">
                  <p className="text-caption font-medium text-ink-muted">Return</p>
                  <p className={cn("mt-1 truncate font-mono text-sm font-semibold leading-none tabular-nums", tone(row.now.pnl))}>{formatPct(row.now.returnPct)}</p>
                </div>
              </div>
              <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3">
                {details.map((detail) => (
                  <div key={detail.label} className="min-w-0 rounded-md border border-slate-100 bg-surface px-2 py-1.5 shadow-sm">
                    <p className="text-caption font-medium text-ink-muted">{detail.label}</p>
                    <p className={cn("mt-0.5 truncate font-mono text-xs font-semibold tabular-nums", detail.className ?? "text-ink")}>{detail.value}</p>
                  </div>
                ))}
              </div>
              {row.now.expired ? <p className="text-caption text-ink-muted">Expired on day {strategy.expirationDays}; shown at its expiry at this stock price.</p> : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

// Saved what-ifs as chips: one click jumps the sliders back to that point.
function Bookmarks({
  desk,
  rows,
  activeId,
  canAdd,
  onLoad,
  onAdd,
  onRemove,
}: {
  desk: Desk;
  rows: BoardRow[];
  activeId: string | null;
  canAdd: boolean;
  onLoad: (moment: Moment) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  // Shown in time order, whatever order they were saved in.
  const order = desk.moments.map((moment, index) => ({ moment, index })).sort((first, second) => first.moment.days - second.moment.days || first.moment.movePct - second.moment.movePct);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold text-ink-muted">Bookmarks</span>
      {order.map(({ moment, index }) => {
        const isActive = moment.id === activeId;
        // With several strategies the chip shows whichever is ahead at that point.
        const lead = rows.length ? rows.reduce((best, row) => (row.moments[index].pnl > best.moments[index].pnl ? row : best)) : null;
        return (
          <span
            key={moment.id}
            className={cn("flex items-center rounded-full border text-sm", isActive ? "border-ink bg-ink text-white" : "border-line-strong bg-surface text-ink-soft hover:border-ink-muted")}
          >
            <button
              type="button"
              aria-pressed={isActive}
              title="Jump the sliders to this point"
              onClick={() => onLoad(moment)}
              className="flex items-center gap-2 rounded-l-full py-1 pl-3 pr-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <span className="font-medium">{momentLabel(desk.market, moment)}</span>
              {moment.ivPct !== null ? <span className={isActive ? "text-white/70" : "text-ink-muted"}>IV {moment.ivPct}%</span> : null}
              {lead ? (
                <span className="flex items-center gap-1">
                  {rows.length > 1 ? <span aria-hidden className="size-2 rounded-full" style={{ background: seriesColor(lead.strategy.id) }} /> : null}
                  <span className={cn("font-mono font-semibold tabular-nums", isActive ? "text-white" : tone(lead.moments[index].pnl))}>{formatDollars(lead.moments[index].pnl)}</span>
                </span>
              ) : null}
            </button>
            <button
              type="button"
              aria-label={`Remove bookmark ${momentLabel(desk.market, moment)}`}
              title="Remove this bookmark"
              onClick={() => onRemove(moment.id)}
              className={cn(
                "mr-0.5 grid size-6 shrink-0 place-items-center rounded-full text-base leading-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                isActive ? "text-white/70 hover:bg-white/15 hover:text-white" : "text-ink-muted hover:bg-rose-50 hover:text-loss",
              )}
            >
              ×
            </button>
          </span>
        );
      })}
      <button
        type="button"
        disabled={!canAdd}
        title={activeId ? "This point is already bookmarked" : "Keep this price, day and IV to come back to"}
        onClick={onAdd}
        className="rounded-full border border-dashed border-line-strong px-3 py-1 text-sm font-semibold text-ink-secondary hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
      >
        + Bookmark this
      </button>
      {desk.moments.length === 0 ? <span className="text-xs text-ink-muted">Keep a point to jump back to it, like a rally on day 20.</span> : null}
    </div>
  );
}

export function WhatIfCard({
  desk,
  board,
  onWhatIf,
  onSaveMoment,
  onRemoveMoment,
}: {
  desk: Desk;
  board: Board;
  onWhatIf: (patch: WhatIfInput) => void;
  onSaveMoment: () => void;
  onRemoveMoment: (id: string) => void;
}) {
  const { symbol, spot, ivPct: todayIv } = desk.market;
  const rows = board.rows.filter((row) => !row.problem);
  const horizon = horizonDays(desk);
  const priceStep = strikeIncrement(spot) / (spot < 25 ? 5 : 1);
  // The bookmark the sliders are sitting on, if any.
  const activeId =
    desk.moments.find(
      (moment) => moment.days === board.days && movePrice(desk.market, moment.movePct) === board.price && (moment.ivPct ?? todayIv) === board.ivPct,
    )?.id ?? null;

  return (
    <section aria-label="What if" className="rounded-xl border border-line bg-surface p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-ink">What if…</h2>
        <button
          type="button"
          disabled={board.price === spot && board.days === 0 && board.ivPct === todayIv}
          title="Back to today's price, today's date and today's IV"
          onClick={() => onWhatIf({ movePct: 0, days: 0, ivPct: null })}
          className="rounded-md border border-line-strong bg-surface px-2.5 py-1 text-xs font-semibold text-ink-soft shadow-sm hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40"
        >
          Reset
        </button>
      </div>
      <div className="mt-3 space-y-4">
        <Slider
          id="what-if-price"
          label={`${symbol} is at`}
          prefix="$"
          value={board.price}
          min={Math.min(Math.round(spot * 0.5), board.price)}
          max={Math.max(Math.round(spot * 1.5), board.price)}
          step={priceStep}
          marks={desk.moments.map((moment) => movePrice(desk.market, moment.movePct))}
          note={
            board.price === spot ? (
              "same as today"
            ) : (
              <>
                {formatPct((board.price / spot - 1) * 100, 1)} from today&apos;s {formatPrice(spot)} ·{" "}
                <button type="button" onClick={() => onWhatIf({ movePct: 0 })} className={noteLink}>
                  back to today&apos;s price
                </button>
              </>
            )
          }
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
          marks={desk.moments.map((moment) => moment.days)}
          note={
            <>
              {board.days === 0 ? "today" : board.days >= horizon ? "on expiry day" : `${horizon - board.days} days before expiry`} ·{" "}
              <button type="button" onClick={() => onWhatIf({ days: board.days >= horizon ? 0 : horizon })} className={noteLink}>
                {board.days >= horizon ? "back to today" : "jump to expiry"}
              </button>
            </>
          }
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
          marks={desk.moments.map((moment) => moment.ivPct ?? todayIv)}
          note={
            board.ivPct === todayIv ? (
              "same as today"
            ) : (
              <>
                {formatPct(board.ivPct - todayIv)} points ·{" "}
                <button type="button" onClick={() => onWhatIf({ ivPct: null })} className={noteLink}>
                  back to today&apos;s {todayIv}%
                </button>
              </>
            )
          }
          onChange={(ivPct) => onWhatIf({ ivPct })}
        />
      </div>

      {rows.length > 0 ? (
        <div className="mt-3">
          <Bookmarks
            desk={desk}
            rows={rows}
            activeId={activeId}
            canAdd={activeId === null && desk.moments.length < MAX_MOMENTS}
            onLoad={(moment) => onWhatIf({ movePct: moment.movePct, days: moment.days, ivPct: moment.ivPct })}
            onAdd={onSaveMoment}
            onRemove={onRemoveMoment}
          />
        </div>
      ) : null}

      <div className="mt-4 border-t border-line pt-4" aria-live="polite">
        {rows.length === 0 ? (
          <p className="text-sm text-ink-secondary">
            {board.rows.length === 0
              ? "Add a strategy above to see the result here."
              : `Nothing to show yet. ${board.rows[0].strategy.name}: ${board.rows[0].problem}`}
          </p>
        ) : (
          <>
            <p className="text-sm text-ink-secondary">
              If {symbol} is at <strong className="font-semibold text-ink">{formatPrice(board.price)}</strong> {board.days === 0 ? "today" : `in ${board.days} days`} with IV at {board.ivPct}%:
            </p>
            <div className="mt-2.5">
              <StrategyCards desk={desk} rows={rows} bestId={board.bestNow} />
            </div>
          </>
        )}
      </div>

    </section>
  );
}
