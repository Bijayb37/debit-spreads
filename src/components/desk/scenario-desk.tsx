"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import type { OptionStrategy } from "@/lib/debit-call-spread";
import {
  autoStrategyName,
  cleanDesk,
  defaultDesk,
  evaluateDesk,
  makeMoment,
  makeStrategy,
  makeWhatIf,
  withMarket,
  type Desk,
} from "@/lib/scenario-desk";
import { Assistant, type AssistantHandle } from "@/components/desk/assistant";
import { PriceTimeMap } from "@/components/desk/price-time-map";
import { Setup } from "@/components/desk/setup";
import { WhatIfCard } from "@/components/desk/what-if";

const STORAGE_KEY = "callculator-scenario-desk-v1";
// A shared link carries the whole setup after this marker in the URL hash.
const SHARE_PREFIX = "#desk=";
const EDITOR_OPEN_KEY = "callculator-desk-details-open";
const ADD_ORDER: OptionStrategy[] = [
  "long-call",
  "debit-call-spread",
  "bull-put-spread",
  "bear-put",
  "debit-put-spread",
  "call-calendar",
];
const MAX_UNDO = 30;

export default function ScenarioDesk({ todayIso, children }: { todayIso: string; children?: ReactNode }) {
  const [desk, setDesk] = useState<Desk>(defaultDesk);
  const [isLoaded, setIsLoaded] = useState(false);
  const [undoCount, setUndoCount] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const [isEditorOpen, setIsEditorOpen] = useState(true);
  const [notice, setNotice] = useState("");
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const history = useRef<{ desk: Desk; group?: string }[]>([]);
  const assistant = useRef<AssistantHandle>(null);

  useEffect(() => {
    let isActive = true;
    queueMicrotask(() => {
      if (!isActive) return;
      try {
        if (window.location.hash.startsWith(SHARE_PREFIX)) {
          // A shared link wins over what was saved here, and is then removed from the address bar.
          setDesk(cleanDesk(JSON.parse(decodeURIComponent(window.location.hash.slice(SHARE_PREFIX.length)))));
          window.history.replaceState(null, "", window.location.pathname + window.location.search);
          setNotice("Opened a shared setup.");
        } else {
          const stored = window.localStorage.getItem(STORAGE_KEY);
          if (stored) setDesk(cleanDesk(JSON.parse(stored)));
        }
        setIsEditorOpen(window.localStorage.getItem(EDITOR_OPEN_KEY) !== "0");
      } catch {
        // Unreadable link or blocked storage: keep the example desk.
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
      window.localStorage.setItem(EDITOR_OPEN_KEY, isEditorOpen ? "1" : "0");
    } catch {
      // Storage can fail in private browsing or when quota is full.
    }
  }, [desk, isEditorOpen, isLoaded]);

  // Edits in the same group (typing in one field, say) share one undo step.
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

  const copyLink = async () => {
    const link = `${window.location.origin}${window.location.pathname}${SHARE_PREFIX}${encodeURIComponent(JSON.stringify(desk))}`;
    try {
      await navigator.clipboard.writeText(link);
      setNotice("Link copied. It opens this exact setup.");
    } catch {
      // Clipboard access can be refused; leave the link in the address bar instead.
      window.history.replaceState(null, "", link);
      setNotice("Copy the link from the address bar.");
    }
  };

  const board = useMemo(() => evaluateDesk(desk, todayIso), [desk, todayIso]);

  return (
    <main className={cn("h-dvh overflow-y-auto bg-stone-100 text-ink", isAssistantOpen && "lg:pr-[24rem]")}>
      <div className="mx-auto w-full max-w-3xl space-y-4 px-3 pb-10 pt-3 sm:px-5">
        <header className="flex items-center gap-3">
          <Link href="/" className="text-lg font-bold tracking-tight text-ink">
            Callculator
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              disabled={undoCount === 0}
              onClick={undo}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold text-ink-soft hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40"
            >
              Undo
            </button>
            <button
              type="button"
              onClick={() => void copyLink()}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold text-ink-soft hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent"
            >
              Copy link
            </button>
            <button
              type="button"
              aria-expanded={isAssistantOpen}
              onClick={() => setIsAssistantOpen(!isAssistantOpen)}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Ask AI
            </button>
          </div>
        </header>
        <h1 className="sr-only">Options what-if calculator</h1>
        {notice ? (
          <p role="status" className="rounded-lg bg-accent-faint px-3 py-1.5 text-sm text-ink-soft">
            {notice}{" "}
            {undoCount > 0 && notice !== "Undone." && !notice.startsWith("Link") && !notice.startsWith("Copy") ? (
              <button type="button" onClick={undo} className="font-semibold text-accent underline-offset-2 hover:underline">
                Undo
              </button>
            ) : null}
          </p>
        ) : null}

        <Setup
          desk={desk}
          rows={board.rows}
          selectedId={selectedId}
          isEditorOpen={isEditorOpen}
          onToggleEditor={() => setIsEditorOpen(!isEditorOpen)}
          // Picking a strategy is a request to see it, so its details open.
          onSelect={(id) => {
            setSelectedId(id);
            setIsEditorOpen(true);
          }}
          onMarket={(patch) => {
            const next = withMarket(desk, patch);
            if (JSON.stringify(next.market) === JSON.stringify(desk.market)) return;
            commit(next, `market-${Object.keys(patch).join()}`);
            if (next.market.spot !== desk.market.spot && desk.strategies.length > 0) setNotice("Strikes were rescaled to the new price.");
          }}
          onStrategy={(strategy) =>
            commit({ ...desk, strategies: desk.strategies.map((item) => (item.id === strategy.id ? strategy : item)) }, `strategy-${strategy.id}`)
          }
          onAdd={() => {
            // Start each new strategy as a type that is not on the desk yet, so the
            // comparison is between different things.
            const kind = ADD_ORDER.find((candidate) => !desk.strategies.some((item) => item.kind === candidate)) ?? "debit-call-spread";
            const strategy = makeStrategy(desk, { kind });
            commit({ ...desk, strategies: [...desk.strategies, strategy] });
            setSelectedId(strategy.id);
            setIsEditorOpen(true);
          }}
          onDuplicate={(id) => {
            const source = desk.strategies.find((item) => item.id === id);
            if (!source) return;
            const copy = makeStrategy(desk, { ...source, id: undefined, name: source.name === autoStrategyName(source) ? "" : `${source.name.slice(0, 43)} copy` });
            commit({ ...desk, strategies: [...desk.strategies, copy] });
            setSelectedId(copy.id);
          }}
          onRemove={(id) => {
            const removed = desk.strategies.find((item) => item.id === id);
            commit({ ...desk, strategies: desk.strategies.filter((item) => item.id !== id) });
            if (removed) setNotice(`Removed ${removed.name}.`);
          }}
          onStartOver={() => {
            commit(defaultDesk());
            setSelectedId("");
            setNotice("Started over with the example.");
          }}
        />

        <WhatIfCard
          desk={desk}
          board={board}
          // Moving the what-if is exploring, not editing, so it is not an undo step.
          onWhatIf={(patch) => setDesk((current) => ({ ...current, whatIf: makeWhatIf(current.market, patch, current.whatIf) }))}
          onSaveMoment={() => commit({ ...desk, moments: [...desk.moments, makeMoment(desk, { ...desk.whatIf, days: board.days })] })}
          onRemoveMoment={(id) => commit({ ...desk, moments: desk.moments.filter((moment) => moment.id !== id) })}
        />

        <details className="group rounded-xl border border-line bg-surface shadow-sm">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-ink-soft sm:px-5">Every price and every date at once</summary>
          <div className="border-t border-line p-4 sm:p-5">
            <PriceTimeMap desk={desk} board={board} todayIso={todayIso} />
          </div>
        </details>

        <details className="rounded-xl border border-line bg-surface shadow-sm">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-ink-soft sm:px-5">How these numbers are made</summary>
          <div className="max-w-prose space-y-2 border-t border-line p-4 text-sm leading-relaxed text-ink-secondary sm:p-5">
            <p>
              Every value is a Black-Scholes model estimate from the stock price and IV you enter, not a live quote or a forecast. A strategy buys as many whole contracts (100 shares each) as its budget allows. Return is profit or loss divided by what the position cost. Fees, dividends, early exercise and assignment are not modelled.
            </p>
            <p>
              With several strategies, each is a separate alternative, not one combined position. A day after a strategy expires shows that strategy at its expiry at that stock price. Ratio spreads can lose more than their budget.
            </p>
          </div>
        </details>

        <p className="text-xs text-ink-muted">
          Looking for the earlier calculator?{" "}
          <Link href="/classic" className="font-semibold text-accent underline-offset-2 hover:underline">
            Open the classic view
          </Link>
        </p>
        {children ? <div>{children}</div> : null}
      </div>

      <div className={cn("fixed inset-y-0 right-0 z-50 w-full border-l border-line shadow-2xl sm:w-[24rem]", !isAssistantOpen && "hidden")}>
        <Assistant
          ref={assistant}
          desk={desk}
          todayIso={todayIso}
          onClose={() => setIsAssistantOpen(false)}
          onDesk={(next, summary) => {
            commit(next);
            setNotice(summary ? `AI: ${summary}.` : "AI updated the page.");
            if (!next.strategies.some((strategy) => strategy.id === selectedId)) setSelectedId(next.strategies.at(-1)?.id ?? "");
          }}
        />
      </div>
    </main>
  );
}
