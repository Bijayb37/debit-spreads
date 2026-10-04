"use client";

import type { OptionStrategy } from "@/lib/debit-call-spread";
import { cn } from "@/lib/cn";
import {
  KINDS,
  KIND_IDS,
  MAX_STRATEGIES,
  formatDollars,
  formatPrice,
  makeStrategy,
  strikeIncrement,
  type BoardRow,
  type Desk,
  type Market,
  type Strategy,
} from "@/lib/scenario-desk";
import { seriesColor } from "@/components/desk/colors";
import { NumberField, TextField, fieldLabel } from "@/components/desk/fields";

// What a strategy costs and where it stops making or losing money, in one sentence.
function Facts({ row }: { row: BoardRow }) {
  if (row.problem) return <p className="text-sm font-medium text-loss">{row.problem}</p>;
  return (
    <p className="text-sm leading-relaxed text-ink-secondary">
      Buys <strong className="font-semibold text-ink">{row.contracts} contract{row.contracts === 1 ? "" : "s"}</strong> for{" "}
      <strong className="font-semibold text-ink">{formatDollars(row.cost, false)}</strong>. Breaks even at{" "}
      <strong className="font-semibold text-ink">{formatPrice(row.breakEven)}</strong> at expiry. Can lose{" "}
      {row.maxLoss === null ? "more than it cost" : `up to ${formatDollars(row.maxLoss, false)}`} and make{" "}
      {row.maxProfit === null ? "an unlimited amount" : `up to ${formatDollars(row.maxProfit, false)}`}.
    </p>
  );
}

export function Setup({
  desk,
  rows,
  selectedId,
  isEditorOpen,
  onToggleEditor,
  onSelect,
  onMarket,
  onStrategy,
  onAdd,
  onDuplicate,
  onRemove,
  onStartOver,
}: {
  desk: Desk;
  rows: BoardRow[];
  selectedId: string;
  // When closed, only the row of strategy chips shows.
  isEditorOpen: boolean;
  onToggleEditor: () => void;
  onSelect: (id: string) => void;
  onMarket: (patch: Partial<Market>) => void;
  onStrategy: (strategy: Strategy) => void;
  onAdd: () => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  onStartOver: () => void;
}) {
  const row = rows.find((item) => item.strategy.id === selectedId) ?? rows[0];
  const strategy = row?.strategy;
  const info = strategy ? KINDS[strategy.kind] : null;
  // A generated name follows the fields; a name someone gave is kept.
  const hasOwnName = strategy ? strategy.name !== makeStrategy(desk, { ...strategy, name: "" }).name : false;
  const change = (patch: Partial<Strategy>) => {
    if (!strategy) return;
    onStrategy(makeStrategy(desk, { ...strategy, name: hasOwnName ? strategy.name : "", ...patch }));
  };
  const strikeStep = strikeIncrement(desk.market.spot);
  const atLimit = rows.length >= MAX_STRATEGIES;
  const action =
    "rounded-md border border-line-strong bg-surface px-2.5 py-1 text-xs font-semibold text-ink-soft shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40";
  const changeKind = (kind: OptionStrategy) => {
    if (!strategy) return;
    // Strike defaults depend on the type, so start the sold strike afresh.
    onStrategy(makeStrategy(desk, { id: strategy.id, kind, longStrike: strategy.longStrike, expirationDays: strategy.expirationDays, budget: strategy.budget }));
  };

  return (
    <section aria-label="Stock and strategy" className="rounded-xl border border-line bg-surface p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="grid min-w-0 basis-full grid-cols-3 gap-3 sm:max-w-md sm:flex-1 sm:basis-auto">
          <TextField id="market-symbol" label="Stock" uppercase value={desk.market.symbol} onCommit={(value) => onMarket({ symbol: value.toUpperCase() })} />
          <NumberField id="market-spot" label="Price today" prefix="$" min={0.01} value={desk.market.spot} onCommit={(value) => onMarket({ spot: value })} />
          <NumberField id="market-iv" label="IV today" suffix="%" min={1} max={300} value={desk.market.ivPct} onCommit={(value) => onMarket({ ivPct: value })} />
        </div>
        <button type="button" title="Clear everything and go back to the example" onClick={onStartOver} className={cn(action, "ml-auto hover:border-accent hover:text-accent")}>
          Start over
        </button>
      </div>

      <div className="mt-5 border-t border-line pt-4">
        {/* The heading and its two actions stay on one line; the strategies get their own row. */}
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-ink">{rows.length > 1 ? "Strategies" : "Strategy"}</h2>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              disabled={atLimit}
              title={atLimit ? `You can compare up to ${MAX_STRATEGIES} strategies` : "Add another strategy to compare"}
              onClick={onAdd}
              className={cn(action, "border-accent-border bg-accent-faint text-accent-strong hover:bg-accent-soft")}
            >
              + Add strategy
            </button>
            {rows.length > 0 ? (
              <button
                type="button"
                aria-expanded={isEditorOpen}
                aria-controls="strategy-editor"
                onClick={onToggleEditor}
                className={cn(action, "flex items-center gap-1 hover:border-accent hover:text-accent")}
              >
                {isEditorOpen ? "Hide" : "Show"}
                <span className="hidden sm:inline">details</span>
                <svg viewBox="0 0 20 20" aria-hidden className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                  <path d={isEditorOpen ? "M5 12l5-5 5 5" : "M5 8l5 5 5-5"} />
                </svg>
              </button>
            ) : null}
          </div>
        </div>

        {rows.length > 0 ? (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {rows.map((item) => {
              // With the details hidden nothing is being edited, so no chip is picked out.
              const isSelected = isEditorOpen && item.strategy.id === strategy?.id;
              return (
                <span
                  key={item.strategy.id}
                  className={cn(
                    "flex min-w-0 max-w-full items-center rounded-full border text-sm font-medium",
                    isSelected ? "border-ink bg-ink text-white" : "border-line-strong bg-surface text-ink-soft hover:border-ink-muted",
                  )}
                >
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    title={isEditorOpen ? undefined : "Show this strategy's details"}
                    onClick={() => onSelect(item.strategy.id)}
                    className="flex min-w-0 items-center gap-1.5 rounded-l-full py-1 pl-3 pr-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: seriesColor(item.strategy.id) }} />
                    <span className="truncate">{item.strategy.name}</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${item.strategy.name}`}
                    title="Remove this strategy"
                    onClick={() => onRemove(item.strategy.id)}
                    className={cn(
                      "mr-0.5 grid size-6 shrink-0 place-items-center rounded-full text-base leading-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                      isSelected ? "text-white/70 hover:bg-white/15 hover:text-white" : "text-ink-muted hover:bg-rose-50 hover:text-loss",
                    )}
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        ) : null}

        {strategy && info ? (
          <div id="strategy-editor" hidden={!isEditorOpen} className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <label className={cn(fieldLabel, "col-span-2 sm:col-span-1")}>
                Type
                <select
                  id="strategy-kind"
                  value={strategy.kind}
                  onChange={(event) => changeKind(event.target.value as OptionStrategy)}
                  className="mt-1 block w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-base font-semibold text-ink shadow-sm outline-none focus:border-accent"
                >
                  {KIND_IDS.map((id) => (
                    <option key={id} value={id}>
                      {KINDS[id].name}
                    </option>
                  ))}
                </select>
              </label>
              <NumberField
                id="strategy-long"
                label={info.calendar ? "Strike" : strategy.kind === "bull-put-spread" ? "Buy put strike" : "Buy strike"}
                prefix="$"
                min={0.01}
                step={strikeStep}
                value={strategy.longStrike}
                onCommit={(value) => change({ longStrike: value })}
              />
              {info.short ? (
                <NumberField
                  id="strategy-short"
                  label={strategy.kind === "bull-put-spread" ? "Sell put strike" : "Sell strike"}
                  prefix="$"
                  min={0.01}
                  step={strikeStep}
                  value={strategy.shortStrike}
                  onCommit={(value) => change({ shortStrike: value })}
                />
              ) : null}
              <NumberField
                id="strategy-expiry"
                label="Expires in"
                suffix="days"
                min={1}
                max={1095}
                step={1}
                value={strategy.expirationDays}
                onCommit={(value) => change({ expirationDays: value })}
              />
              {info.calendar ? (
                <NumberField
                  id="strategy-short-expiry"
                  label="Sold call expires in"
                  suffix="days"
                  min={1}
                  max={1094}
                  step={1}
                  value={strategy.shortExpirationDays}
                  onCommit={(value) => change({ shortExpirationDays: value })}
                />
              ) : null}
              {info.ratio ? (
                <NumberField id="strategy-ratio" label="Sold per one bought" min={2} max={10} step={1} value={strategy.ratio} onCommit={(value) => change({ ratio: value })} />
              ) : null}
              <NumberField id="strategy-budget" label="Budget" prefix="$" min={1} step={500} value={strategy.budget} onCommit={(value) => change({ budget: value })} />
              <TextField
                // Remount per strategy so the box shows the selected one's name.
                key={strategy.id}
                id="strategy-name"
                label={
                  <>
                    Name <span className="font-normal text-ink-muted">(optional)</span>
                  </>
                }
                className="col-span-2"
                maxLength={48}
                value={hasOwnName ? strategy.name : ""}
                placeholder={makeStrategy(desk, { ...strategy, name: "" }).name}
                onCommit={(value) => {
                  if (value.trim() !== (hasOwnName ? strategy.name : "")) change({ name: value });
                }}
              />
            </div>
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
              <div className="min-w-0 max-w-prose">
                <Facts row={row} />
                <p className="mt-0.5 text-xs text-ink-muted">{info.summary}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  disabled={atLimit}
                  title="Make a copy to change and compare"
                  onClick={() => onDuplicate(strategy.id)}
                  className={cn(action, "hover:border-accent hover:text-accent")}
                >
                  Duplicate
                </button>
                <button type="button" onClick={() => onRemove(strategy.id)} className={cn(action, "hover:border-loss hover:text-loss")}>
                  Remove
                </button>
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-ink-secondary">Add a strategy to see what it makes or loses as the stock moves.</p>
        )}
      </div>
    </section>
  );
}
