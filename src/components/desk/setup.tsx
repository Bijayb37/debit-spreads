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
  onSelect,
  onMarket,
  onStrategy,
  onAdd,
  onRemove,
}: {
  desk: Desk;
  rows: BoardRow[];
  selectedId: string;
  onSelect: (id: string) => void;
  onMarket: (patch: Partial<Market>) => void;
  onStrategy: (strategy: Strategy) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  const row = rows.find((item) => item.strategy.id === selectedId) ?? rows[0];
  const strategy = row?.strategy;
  const info = strategy ? KINDS[strategy.kind] : null;
  // A generated name follows the fields; a name the assistant gave is kept.
  const change = (patch: Partial<Strategy>) => {
    if (!strategy) return;
    const hadAutoName = strategy.name === makeStrategy(desk, { ...strategy, name: "" }).name;
    onStrategy(makeStrategy(desk, { ...strategy, ...patch, name: hadAutoName ? "" : strategy.name }));
  };
  const changeKind = (kind: OptionStrategy) => {
    if (!strategy) return;
    // Strike defaults depend on the type, so start the sold strike afresh.
    onStrategy(makeStrategy(desk, { id: strategy.id, kind, longStrike: strategy.longStrike, expirationDays: strategy.expirationDays, budget: strategy.budget }));
  };

  return (
    <section aria-label="Stock and strategy" className="rounded-xl border border-line bg-surface p-4 shadow-sm sm:p-5">
      <div className="grid grid-cols-3 gap-3 sm:max-w-md">
        <TextField id="market-symbol" label="Stock" value={desk.market.symbol} onCommit={(value) => onMarket({ symbol: value.toUpperCase() })} />
        <NumberField id="market-spot" label="Price today" prefix="$" min={0.01} value={desk.market.spot} onCommit={(value) => onMarket({ spot: value })} />
        <NumberField id="market-iv" label="IV today" suffix="%" min={1} max={300} value={desk.market.ivPct} onCommit={(value) => onMarket({ ivPct: value })} />
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-1 text-base font-semibold text-ink">{rows.length > 1 ? "Strategies" : "Strategy"}</h2>
          {rows.length > 1
            ? rows.map((item) => (
                <button
                  key={item.strategy.id}
                  type="button"
                  aria-pressed={item.strategy.id === strategy?.id}
                  onClick={() => onSelect(item.strategy.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                    item.strategy.id === strategy?.id ? "border-ink bg-ink text-white" : "border-line-strong bg-surface text-ink-soft hover:border-ink-muted",
                  )}
                >
                  <span aria-hidden className="size-2 rounded-full" style={{ background: seriesColor(item.strategy.id) }} />
                  {item.strategy.name}
                </button>
              ))
            : null}
          <button
            type="button"
            disabled={rows.length >= MAX_STRATEGIES}
            onClick={onAdd}
            className="ml-auto text-sm font-semibold text-accent underline-offset-2 hover:underline disabled:text-ink-muted disabled:no-underline"
          >
            {rows.length === 0 ? "+ Add a strategy" : "+ Compare with another"}
          </button>
        </div>

        {strategy && info ? (
          <div className="mt-3 space-y-3">
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
                value={strategy.longStrike}
                onCommit={(value) => change({ longStrike: value })}
              />
              {info.short ? (
                <NumberField
                  id="strategy-short"
                  label={strategy.kind === "bull-put-spread" ? "Sell put strike" : "Sell strike"}
                  prefix="$"
                  min={0.01}
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
              <NumberField id="strategy-budget" label="Budget" prefix="$" min={1} value={strategy.budget} onCommit={(value) => change({ budget: value })} />
            </div>
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
              <div className="min-w-0 max-w-prose">
                <Facts row={row} />
                <p className="mt-0.5 text-xs text-ink-muted">{info.summary}</p>
              </div>
              <button type="button" onClick={() => onRemove(strategy.id)} className="text-xs font-semibold text-ink-muted underline-offset-2 hover:text-loss hover:underline">
                Remove
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-ink-secondary">Add a strategy to see what it makes or loses as the stock moves.</p>
        )}
      </div>
    </section>
  );
}
