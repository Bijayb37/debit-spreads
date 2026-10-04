"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { OptionStrategy } from "@/lib/debit-call-spread";
import {
  KINDS,
  KIND_IDS,
  autoScenarioName,
  autoStrategyName,
  formatPrice,
  makeScenario,
  makeStrategy,
  scenarioPrice,
  strategyProblem,
  type Desk,
  type Scenario,
  type Strategy,
} from "@/lib/scenario-desk";

const field =
  "mt-1 w-full rounded-md border border-line-strong bg-surface px-2.5 py-1.5 text-sm text-ink shadow-sm outline-none focus:border-accent";
const label = "block text-xs font-medium text-ink-secondary";

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-labelledby="desk-dialog-title"
      className="m-auto w-[min(30rem,calc(100vw-1.5rem))] rounded-xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-slate-900/40"
    >
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 id="desk-dialog-title" className="text-base font-semibold">{title}</h2>
        <button
          type="button"
          aria-label="Close"
          onClick={() => dialog.current?.close()}
          className="grid size-8 place-items-center rounded-md text-xl text-ink-secondary hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-accent"
        >
          ×
        </button>
      </header>
      {children}
    </dialog>
  );
}

function Actions({ saveLabel, error, onDelete, onCancel }: { saveLabel: string; error: string | null; onDelete?: () => void; onCancel: () => void }) {
  return (
    <>
      {error ? <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-sm text-loss">{error}</p> : null}
      <div className="flex items-center justify-between gap-2 pt-1">
        {onDelete ? (
          <button type="button" onClick={onDelete} className="text-sm font-semibold text-loss underline-offset-2 hover:underline">
            Delete
          </button>
        ) : <span />}
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="rounded-md border border-line-strong px-3 py-1.5 text-sm font-semibold text-ink-soft hover:bg-surface-muted">
            Cancel
          </button>
          <button type="submit" className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            {saveLabel}
          </button>
        </div>
      </div>
    </>
  );
}

const numberOrUndefined = (text: string) => (text.trim() === "" || !Number.isFinite(Number(text)) ? undefined : Number(text));

export function StrategyDialog({
  desk,
  strategy,
  onSave,
  onDelete,
  onClose,
}: {
  desk: Desk;
  // null creates a new strategy.
  strategy: Strategy | null;
  onSave: (strategy: Strategy) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const initial = strategy ?? makeStrategy(desk, { kind: "debit-call-spread" });
  const [kind, setKind] = useState<OptionStrategy>(initial.kind);
  const [form, setForm] = useState({
    // A generated name is left blank so it keeps following the strikes.
    name: strategy && strategy.name !== autoStrategyName(strategy) ? strategy.name : "",
    longStrike: String(initial.longStrike),
    shortStrike: String(initial.shortStrike),
    expirationDays: String(initial.expirationDays),
    shortExpirationDays: String(initial.shortExpirationDays || 30),
    ratio: String(initial.ratio),
    budget: String(initial.budget),
  });
  const [error, setError] = useState<string | null>(null);
  const info = KINDS[kind];
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const changeKind = (next: OptionStrategy) => {
    // Strike defaults depend on the type, so refresh them when it changes.
    const defaults = makeStrategy(desk, { kind: next, longStrike: numberOrUndefined(form.longStrike) });
    setKind(next);
    setForm((current) => ({ ...current, shortStrike: String(defaults.shortStrike) }));
    setError(null);
  };

  return (
    <Dialog title={strategy ? "Edit strategy" : "Add a strategy"} onClose={onClose}>
      <form
        className="space-y-3 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          const next = makeStrategy(desk, {
            id: strategy?.id,
            kind,
            name: form.name,
            longStrike: numberOrUndefined(form.longStrike),
            shortStrike: numberOrUndefined(form.shortStrike),
            expirationDays: numberOrUndefined(form.expirationDays),
            shortExpirationDays: numberOrUndefined(form.shortExpirationDays),
            ratio: numberOrUndefined(form.ratio),
            budget: numberOrUndefined(form.budget),
          });
          const problem = strategyProblem(next);
          if (problem) setError(problem);
          else onSave(next);
        }}
      >
        <label className={label}>
          Type
          <select id="strategy-kind" value={kind} onChange={(event) => changeKind(event.target.value as OptionStrategy)} className={field}>
            {KIND_IDS.map((id) => (
              <option key={id} value={id}>{KINDS[id].name}</option>
            ))}
          </select>
          <span className="mt-1 block font-normal text-ink-muted">{info.summary}</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>
            {info.calendar ? "Strike ($)" : kind === "bull-put-spread" ? "Buy put strike ($)" : "Buy strike ($)"}
            <input id="strategy-long" type="number" step="any" min={0.01} required value={form.longStrike} onChange={set("longStrike")} className={field} />
          </label>
          {info.short ? (
            <label className={label}>
              {kind === "bull-put-spread" ? "Sell put strike ($)" : "Sell strike ($)"}
              <input id="strategy-short" type="number" step="any" min={0.01} required value={form.shortStrike} onChange={set("shortStrike")} className={field} />
            </label>
          ) : null}
          <label className={label}>
            Days to expiration
            <input id="strategy-expiry" type="number" step={1} min={1} max={1095} required value={form.expirationDays} onChange={set("expirationDays")} className={field} />
          </label>
          {info.calendar ? (
            <label className={label}>
              Sold call expires in (days)
              <input id="strategy-short-expiry" type="number" step={1} min={1} max={1094} required value={form.shortExpirationDays} onChange={set("shortExpirationDays")} className={field} />
            </label>
          ) : null}
          {info.ratio ? (
            <label className={label}>
              Options sold per one bought
              <input id="strategy-ratio" type="number" step={1} min={2} max={10} required value={form.ratio} onChange={set("ratio")} className={field} />
            </label>
          ) : null}
          <label className={label}>
            Budget ($)
            <input id="strategy-budget" type="number" step="any" min={1} required value={form.budget} onChange={set("budget")} className={field} />
          </label>
        </div>
        <label className={label}>
          Name <span className="font-normal text-ink-muted">(optional)</span>
          <input id="strategy-name" type="text" maxLength={48} value={form.name} onChange={set("name")} placeholder="Named from the strikes if left empty" className={field} />
        </label>
        <p className="text-caption text-ink-muted">
          {desk.market.symbol} is at {formatPrice(desk.market.spot)}. The desk buys as many whole contracts as the budget allows.
        </p>
        <Actions
          saveLabel={strategy ? "Save" : "Add strategy"}
          error={error}
          onDelete={strategy ? () => onDelete(strategy.id) : undefined}
          onCancel={onClose}
        />
      </form>
    </Dialog>
  );
}

export function ScenarioDialog({
  desk,
  scenario,
  onSave,
  onDelete,
  onClose,
}: {
  desk: Desk;
  // null creates a new scenario.
  scenario: Scenario | null;
  onSave: (scenario: Scenario) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: scenario && scenario.name !== autoScenarioName(scenario.movePct) ? scenario.name : "",
    movePct: String(scenario?.movePct ?? 0),
    days: scenario?.days === null || !scenario ? "" : String(scenario.days),
    ivPct: scenario?.ivPct === null || !scenario ? "" : String(scenario.ivPct),
    odds: String(scenario?.odds ?? 1),
  });
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));
  const move = numberOrUndefined(form.movePct) ?? 0;

  return (
    <Dialog title={scenario ? "Edit scenario" : "Add a scenario"} onClose={onClose}>
      <form
        className="space-y-3 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(
            makeScenario(desk, {
              id: scenario?.id,
              name: form.name,
              movePct: move,
              days: numberOrUndefined(form.days) ?? null,
              ivPct: numberOrUndefined(form.ivPct) ?? null,
              odds: numberOrUndefined(form.odds),
            }),
          );
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>
            Stock move (%)
            <input id="scenario-move" type="number" step="any" min={-95} max={500} required value={form.movePct} onChange={set("movePct")} className={field} />
            <span className="mt-1 block font-normal text-ink-muted">
              {desk.market.symbol} at {formatPrice(scenarioPrice(desk.market, { movePct: Math.min(500, Math.max(-95, move)) }))}
            </span>
          </label>
          <label className={label}>
            Days from today
            <input id="scenario-days" type="number" step={1} min={0} max={1095} value={form.days} onChange={set("days")} placeholder="At expiry" className={field} />
            <span className="mt-1 block font-normal text-ink-muted">Empty: each strategy at its expiry</span>
          </label>
          <label className={label}>
            IV then (%)
            <input id="scenario-iv" type="number" step="any" min={1} max={300} value={form.ivPct} onChange={set("ivPct")} placeholder={`Same (${desk.market.ivPct}%)`} className={field} />
          </label>
          <label className={label}>
            How likely? (weight)
            <input id="scenario-odds" type="number" step="any" min={0} max={100} required value={form.odds} onChange={set("odds")} className={field} />
          </label>
        </div>
        <label className={label}>
          Name <span className="font-normal text-ink-muted">(optional)</span>
          <input id="scenario-name" type="text" maxLength={32} value={form.name} onChange={set("name")} placeholder={autoScenarioName(move)} className={field} />
        </label>
        <Actions
          saveLabel={scenario ? "Save" : "Add scenario"}
          error={null}
          onDelete={scenario && desk.scenarios.length > 1 ? () => onDelete(scenario.id) : undefined}
          onCancel={onClose}
        />
      </form>
    </Dialog>
  );
}
