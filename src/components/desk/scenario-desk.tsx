"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import {
  cleanDesk,
  defaultDesk,
  evaluateDesk,
  formatMoney,
  withMarket,
  type BoardRow,
  type Desk,
  type Scenario,
  type Strategy,
} from "@/lib/scenario-desk";
import { Assistant, type AssistantHandle } from "@/components/desk/assistant";
import { seriesColor } from "@/components/desk/colors";
import { ScenarioDialog, StrategyDialog } from "@/components/desk/editors";
import { OutcomeGrid } from "@/components/desk/outcome-grid";
import { PathDetail } from "@/components/desk/path-detail";
import { PriceTimeMap } from "@/components/desk/price-time-map";

const STORAGE_KEY = "callculator-scenario-desk-v1";
const MAX_UNDO = 30;

type Editing =
  | { type: "strategy"; strategy: Strategy | null }
  | { type: "scenario"; scenario: Scenario | null }
  | null;

function MarketField({
  id,
  label,
  value,
  prefix,
  suffix,
  width,
  numeric = true,
  onCommit,
}: {
  id: string;
  label: string;
  value: string | number;
  prefix?: string;
  suffix?: string;
  width: string;
  numeric?: boolean;
  onCommit: (value: string) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 focus-within:border-accent">
      <span className="text-caption font-semibold uppercase tracking-wide text-ink-muted">{label}</span>
      {prefix ? <span className="font-mono text-sm text-ink-muted">{prefix}</span> : null}
      <input
        // Remount when the value changes elsewhere (undo, the assistant).
        key={String(value)}
        id={id}
        type={numeric ? "number" : "text"}
        step="any"
        defaultValue={value}
        onBlur={(event) => onCommit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        className={cn("bg-transparent font-mono text-sm font-semibold text-ink outline-none", width)}
      />
      {suffix ? <span className="font-mono text-sm text-ink-muted">{suffix}</span> : null}
    </label>
  );
}

function Finding({ title, row, value, note }: { title: string; row: BoardRow; value: number; note: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-line bg-surface px-3 py-2.5 shadow-sm">
      <p className="text-caption font-semibold uppercase tracking-wide text-ink-muted">{title}</p>
      <p className="mt-1 flex items-center gap-2">
        <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: seriesColor(row.strategy.id) }} />
        <span className="truncate text-sm font-semibold text-ink">{row.strategy.name}</span>
      </p>
      <p className="mt-0.5 flex items-baseline gap-2">
        <span className={cn("font-mono text-xl font-semibold tabular-nums", value >= 0 ? "text-gain" : "text-loss")}>{formatMoney(value)}</span>
        <span className="truncate text-xs text-ink-secondary">{note}</span>
      </p>
    </div>
  );
}

export default function ScenarioDesk({ todayIso, children }: { todayIso: string; children?: ReactNode }) {
  const [desk, setDesk] = useState<Desk>(defaultDesk);
  const [isLoaded, setIsLoaded] = useState(false);
  const [undoCount, setUndoCount] = useState(0);
  const [selectedScenarioId, setSelectedScenarioId] = useState("");
  const [editing, setEditing] = useState<Editing>(null);
  const [notice, setNotice] = useState("");
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const history = useRef<{ desk: Desk; group?: string }[]>([]);
  const assistant = useRef<AssistantHandle>(null);

  useEffect(() => {
    let isActive = true;
    queueMicrotask(() => {
      if (!isActive) return;
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored) setDesk(cleanDesk(JSON.parse(stored)));
      } catch {
        // Unreadable or blocked storage: keep the example desk.
      }
      setIsLoaded(true);
    });
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(desk));
    } catch {
      // Storage can fail in private browsing or when quota is full.
    }
  }, [desk, isLoaded]);

  // Edits in the same group (typing odds, say) share one undo step.
  const commit = (next: Desk, group?: string) => {
    if (!group || history.current.at(-1)?.group !== group) {
      history.current = [...history.current.slice(-(MAX_UNDO - 1)), { desk, group }];
      setUndoCount(history.current.length);
    }
    setDesk(next);
    setNotice("");
  };
  const undo = () => {
    const previous = history.current.pop();
    if (!previous) return;
    setUndoCount(history.current.length);
    setDesk(previous.desk);
    setNotice("Undone.");
  };

  const board = useMemo(() => evaluateDesk(desk, todayIso), [desk, todayIso]);
  const scenarioIndex = Math.max(0, desk.scenarios.findIndex((scenario) => scenario.id === selectedScenarioId));
  const scenario = desk.scenarios[scenarioIndex];
  const hasCustomOdds = desk.scenarios.some((item) => item.odds !== desk.scenarios[0].odds);
  const usable = board.rows.filter((row) => !row.problem);
  const top = (score: (row: BoardRow) => number) => usable.reduce((best, row) => (score(row) > score(best) ? row : best));
  const ask = (prompt: string) => {
    setIsAssistantOpen(true);
    assistant.current?.ask(prompt);
  };
  const setMarket = (patch: Partial<Desk["market"]>) => {
    const next = withMarket(desk, patch);
    if (JSON.stringify(next.market) === JSON.stringify(desk.market)) return;
    commit(next);
    if (next.market.spot !== desk.market.spot && desk.strategies.length > 0) {
      setNotice("Strikes were rescaled to the new price.");
    }
  };

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-stone-100 text-ink">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-surface px-3 py-2 sm:px-5">
        <Link href="/" className="mr-1 text-lg font-bold tracking-tight text-ink">
          Callculator
        </Link>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Stock assumptions">
          <MarketField id="market-symbol" label="Stock" value={desk.market.symbol} width="w-16 uppercase" numeric={false} onCommit={(value) => setMarket({ symbol: value.toUpperCase() })} />
          <MarketField id="market-spot" label="Price today" prefix="$" value={desk.market.spot} width="w-20" onCommit={(value) => setMarket({ spot: Number(value) })} />
          <MarketField id="market-iv" label="IV today" suffix="%" value={desk.market.ivPct} width="w-14" onCommit={(value) => setMarket({ ivPct: Number(value) })} />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            disabled={undoCount === 0}
            onClick={undo}
            className="rounded-md border border-line-strong bg-surface px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={() => setIsAssistantOpen(true)}
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:hidden"
          >
            Assistant
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="min-h-0 space-y-3 overflow-y-auto px-3 py-3 sm:px-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h1 className="text-xl font-semibold tracking-tight text-ink text-balance">
              How each strategy holds up as {desk.market.symbol} moves over time
            </h1>
            {notice ? (
              <p role="status" className="text-xs font-medium text-ink-secondary">
                {notice}{" "}
                {undoCount > 0 && notice !== "Undone." ? (
                  <button type="button" onClick={undo} className="font-semibold text-accent underline-offset-2 hover:underline">
                    Undo
                  </button>
                ) : null}
              </p>
            ) : null}
          </div>

          {usable.length > 1 ? (
            <section aria-label="What stands out" className="grid gap-2 sm:grid-cols-3">
              <Finding
                title={hasCustomOdds ? "Leads under your odds" : "Leads with equal odds"}
                row={top((row) => row.expected)}
                value={top((row) => row.expected).expected}
                note="weighted across scenarios"
              />
              <Finding
                title="Smallest worst case"
                row={top((row) => row.worst)}
                value={top((row) => row.worst).worst}
                note="in its worst scenario here"
              />
              <Finding
                title="Biggest best case"
                row={top((row) => row.best)}
                value={top((row) => row.best).best}
                note="in its best scenario here"
              />
            </section>
          ) : null}

          <section aria-label="Outcomes" className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm">
            <OutcomeGrid
              desk={desk}
              board={board}
              selectedScenarioId={scenario.id}
              hasCustomOdds={hasCustomOdds}
              onSelectScenario={setSelectedScenarioId}
              onEditScenario={(item) => setEditing({ type: "scenario", scenario: item })}
              onAddScenario={() => setEditing({ type: "scenario", scenario: null })}
              onEditStrategy={(item) => setEditing({ type: "strategy", strategy: item })}
              onAddStrategy={() => setEditing({ type: "strategy", strategy: null })}
              onOddsChange={(id, odds) =>
                commit({ ...desk, scenarios: desk.scenarios.map((item) => (item.id === id ? { ...item, odds } : item)) }, "odds")
              }
            />
            <div className="flex flex-wrap items-center gap-2 border-t border-line bg-surface-muted px-3 py-2">
              <span className="text-xs font-semibold text-ink-muted">Ask the assistant</span>
              {[
                { label: "Which holds up best?", prompt: "Which strategy holds up best across these scenarios, and what does each one give up?" },
                { label: "Add a path", prompt: `Add a scenario where ${desk.market.symbol} rallies 15% in three weeks and then gives it all back by day 45. Tell me how each strategy holds up at each step.` },
                { label: "Suggest another strategy", prompt: "Add one strategy that does better in the scenarios where my current ones lose, and explain the trade-off." },
              ].map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => ask(chip.prompt)}
                  className="rounded-full border border-accent-border bg-accent-faint px-3 py-1 text-xs font-semibold text-accent-strong hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {chip.label}
                </button>
              ))}
              <span className="ml-auto text-caption text-ink-muted">Shows the end of each scenario · ★ best · select a heading to see it step by step</span>
            </div>
          </section>

          <section aria-label="Scenario step by step" className="rounded-lg border border-line bg-surface p-3 shadow-sm">
            <PathDetail desk={desk} board={board} todayIso={todayIso} scenario={scenario} scenarioIndex={scenarioIndex} />
          </section>

          <section aria-label="Price and date map" className="rounded-lg border border-line bg-surface p-3 shadow-sm">
            <PriceTimeMap desk={desk} board={board} todayIso={todayIso} />
          </section>

          <details className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink-secondary shadow-sm">
            <summary className="cursor-pointer text-sm font-semibold text-ink-soft">How these numbers are made</summary>
            <div className="mt-2 max-w-prose space-y-2 text-sm leading-relaxed">
              <p>
                Every value is a Black-Scholes model estimate from the stock price and IV at the top, not a live quote or a forecast. Each strategy buys as many whole contracts (100 shares each) as its budget allows, and return is profit or loss divided by that budget. Fees, dividends, early exercise and assignment are not modelled.
              </p>
              <p>
                A scenario is a path: the stock moves in a straight line from today through each step, and IV with it. A strategy that expires before a step keeps the result it had on its expiry day. Strategies are separate alternatives, not one combined position. The worst scenario shown is not the most a strategy can lose: ratio spreads can lose more than their budget.
              </p>
              <p>
                The odds row holds your own weights for how likely each scenario is. They only change the weighted column and say nothing about what the market will do.
              </p>
            </div>
          </details>

          <p className="text-xs text-ink-muted">
            Looking for the earlier calculator?{" "}
            <Link href="/classic" className="font-semibold text-accent underline-offset-2 hover:underline">
              Open the classic view
            </Link>
          </p>
          {children ? <div className="pt-2">{children}</div> : null}
        </div>

        <div className={cn("min-h-0 border-l border-line", isAssistantOpen ? "fixed inset-0 z-50 lg:static" : "hidden lg:block")}>
          <Assistant
            ref={assistant}
            desk={desk}
            todayIso={todayIso}
            onClose={() => setIsAssistantOpen(false)}
            onDesk={(next, summary) => {
              commit(next);
              setNotice(summary ? `Assistant: ${summary}.` : "Assistant updated the board.");
            }}
          />
        </div>
      </div>

      {editing?.type === "strategy" ? (
        <StrategyDialog
          key={editing.strategy?.id ?? "new"}
          desk={desk}
          strategy={editing.strategy}
          onClose={() => setEditing(null)}
          onDelete={(id) => {
            commit({ ...desk, strategies: desk.strategies.filter((item) => item.id !== id) });
            setEditing(null);
          }}
          onSave={(next) => {
            const exists = desk.strategies.some((item) => item.id === next.id);
            commit({ ...desk, strategies: exists ? desk.strategies.map((item) => (item.id === next.id ? next : item)) : [...desk.strategies, next] });
            setEditing(null);
          }}
        />
      ) : null}
      {editing?.type === "scenario" ? (
        <ScenarioDialog
          key={editing.scenario?.id ?? "new"}
          desk={desk}
          scenario={editing.scenario}
          onClose={() => setEditing(null)}
          onDelete={(id) => {
            commit({ ...desk, scenarios: desk.scenarios.filter((item) => item.id !== id) });
            setEditing(null);
          }}
          onSave={(next) => {
            const exists = desk.scenarios.some((item) => item.id === next.id);
            commit({ ...desk, scenarios: exists ? desk.scenarios.map((item) => (item.id === next.id ? next : item)) : [...desk.scenarios, next] });
            setSelectedScenarioId(next.id);
            setEditing(null);
          }}
        />
      ) : null}
    </main>
  );
}
