"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import {
  getDefaultCallCalendarShortExpirationDays,
  normalizePutRatioShortCount,
} from "@/lib/debit-call-spread";
import type { OptionStrategy } from "@/lib/debit-call-spread";
import { getStrategyDisplayLabel } from "@/components/lab/comparison-helpers";
import {
  compactNumber,
  formatPriceCurrency,
  formatStrikeCurrency,
} from "@/components/lab/format";
import {
  isDebitSpreadStrategy,
  isRatioSpreadStrategy,
} from "@/components/lab/strategy-helpers";
import type { ComparisonCardData } from "@/components/lab/types";

export function ActiveSetupStrip({
  symbol,
  spot,
  volatilityPct,
  expirationDays,
  strategy,
  longStrike,
  shortStrike,
  ratioShortCount,
  selectedStrategy,
  isOpen,
  strategyCount,
  onToggle,
  onOpen,
  strategiesPanel,
}: {
  symbol: string;
  spot: number;
  volatilityPct: number;
  expirationDays: number;
  strategy: OptionStrategy;
  longStrike: number;
  shortStrike: number;
  ratioShortCount: number;
  selectedStrategy?: ComparisonCardData | null;
  isOpen: boolean;
  strategyCount: number;
  onToggle: () => void;
  onOpen: () => void;
  strategiesPanel?: ReactNode;
}) {
  const displayStrategy = selectedStrategy?.strategy ?? strategy;
  const displayLongStrike = selectedStrategy?.longStrike ?? longStrike;
  const displayShortStrike = selectedStrategy?.shortStrike ?? shortStrike;
  const displayRatioShortCount =
    selectedStrategy?.ratioShortCount ?? ratioShortCount;
  const displayExpirationDays =
    selectedStrategy?.expirationDays ?? expirationDays;
  const displayShortExpirationDays =
    selectedStrategy?.snapshot.shortExpirationDays ??
    getDefaultCallCalendarShortExpirationDays(displayExpirationDays);
  const isSpread = isDebitSpreadStrategy(displayStrategy);
  const structure = displayStrategy === "call-calendar"
    ? `${formatStrikeCurrency(displayLongStrike)} call calendar`
    : isSpread
    ? `${formatStrikeCurrency(displayLongStrike)} / ${formatStrikeCurrency(displayShortStrike)}${
        isRatioSpreadStrategy(displayStrategy)
          ? ` x${normalizePutRatioShortCount(displayRatioShortCount)}`
          : ""
      }`
    : `${formatStrikeCurrency(displayLongStrike)} ${displayStrategy === "bear-put" ? "put" : "call"}`;
  const displayDteLabel =
    displayStrategy === "call-calendar"
      ? `${displayShortExpirationDays}/${displayExpirationDays} DTE`
      : `${displayExpirationDays} DTE`;
  const strategyLabel = getStrategyDisplayLabel(displayStrategy);
  const hasSavedStrategies = strategyCount > 0 && Boolean(selectedStrategy);
  const savedStrategyLabel =
    strategyCount === 1 ? "1 saved" : `${strategyCount} saved`;

  return (
    <div
      className={cn(
        "min-w-0 overflow-hidden rounded-lg border bg-white shadow-sm transition-colors hover:border-[var(--accent)] hover:bg-slate-50",
        isOpen ? "border-[var(--accent)]" : "border-slate-200",
      )}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls="setup-strategy-panel"
        aria-label={isOpen ? "Close setup and strategies" : "Open setup and strategies"}
        title={isOpen ? "Close setup and strategies" : "Open setup and strategies"}
        onClick={isOpen ? onToggle : onOpen}
        className="grid w-full min-w-0 cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-center gap-2 bg-transparent px-2 py-1 text-left text-sm text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[var(--accent)] sm:px-2.5"
      >
        <span
          aria-hidden
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-full border bg-white text-slate-700 shadow-sm transition-colors",
            isOpen ? "border-[var(--accent-border)] text-slate-950" : "border-slate-300",
          )}
        >
          <svg
            viewBox="0 0 20 20"
            className="size-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d={isOpen ? "M5 12l5-5 5 5" : "M5 8l5 5 5-5"} />
          </svg>
        </span>
        <span className="grid min-w-0 gap-1.5 md:grid-cols-2">
          <span className="grid min-w-0 gap-0.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1">
            <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">
              Setup
            </span>
            <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="font-[family:var(--font-space-grotesk)] text-sm font-semibold leading-none text-slate-950">
                {symbol.trim() || "Underlying"}
              </span>
              <span className="font-mono text-[11px] font-medium tabular-nums text-slate-600">
                {formatPriceCurrency(spot)} spot
              </span>
              <span className="font-mono text-[11px] font-medium tabular-nums text-slate-600">
                {compactNumber(volatilityPct)}% IV
              </span>
            </span>
          </span>
          <span className="grid min-w-0 gap-0.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1">
            <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">
              Strategy
            </span>
            <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
              {hasSavedStrategies ? (
                <>
                  <span className="font-[family:var(--font-space-grotesk)] text-sm font-semibold leading-none text-slate-950">
                    {strategyLabel}
                  </span>
                  <span className="min-w-0 truncate font-mono text-[11px] font-medium tabular-nums text-slate-600">
                    {structure}
                    </span>
                    <span className="shrink-0 rounded-full border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-none tabular-nums text-slate-700">
                      {displayDteLabel}
                    </span>
                  <span className="shrink-0 rounded-full border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-none tabular-nums text-slate-700 shadow-sm">
                    {savedStrategyLabel}
                  </span>
                </>
              ) : (
                <>
                  <span className="font-[family:var(--font-space-grotesk)] text-sm font-semibold leading-none text-slate-950">
                    No saved strategy
                  </span>
                  <span className="min-w-0 truncate text-[11px] font-medium text-slate-600">
                    Create one in setup
                  </span>
                </>
              )}
            </span>
          </span>
        </span>
      </button>

      {isOpen ? (
        <div id="setup-strategy-panel" className="border-t border-slate-200">
          {strategiesPanel ? (
            <div id="strategy-shelf" className="p-3">
              {strategiesPanel}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
