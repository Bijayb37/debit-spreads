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
        "min-w-0 overflow-hidden rounded-lg border bg-surface shadow-sm transition-colors hover:border-accent hover:bg-surface-muted",
        isOpen ? "border-accent" : "border-line",
      )}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls="setup-strategy-panel"
        aria-label={isOpen ? "Close setup and strategies" : "Open setup and strategies"}
        title={isOpen ? "Close setup and strategies" : "Open setup and strategies"}
        onClick={isOpen ? onToggle : onOpen}
        className="grid w-full min-w-0 cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-center gap-2 bg-transparent px-2 py-1.5 text-left text-sm text-ink-secondary transition-colors md:py-1 hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-accent sm:px-2.5"
      >
        <span
          aria-hidden
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-full border bg-surface text-ink-soft shadow-sm transition-colors",
            isOpen ? "border-accent-border text-ink" : "border-line-strong",
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
        {/* One line on phones; two labelled boxes from md up. */}
        <span className="flex min-w-0 items-baseline gap-3 md:grid md:grid-cols-2 md:gap-1.5">
          <span className="min-w-0 shrink-0 md:grid md:shrink md:gap-0.5 md:rounded-md md:border md:border-line md:bg-surface-muted md:px-2 md:py-1">
            <span className="hidden text-nano font-semibold uppercase tracking-wide text-ink-muted md:block">
              Setup
            </span>
            <span className="flex min-w-0 items-baseline gap-x-2 gap-y-0.5 whitespace-nowrap md:flex-wrap md:whitespace-normal">
              <span className="font-sans text-sm font-semibold leading-none text-ink">
                {symbol.trim() || "Underlying"}
              </span>
              <span className="font-mono text-caption font-medium tabular-nums text-ink-secondary">
                {formatPriceCurrency(spot)} spot
              </span>
              <span className="font-mono text-caption font-medium tabular-nums text-ink-secondary">
                {compactNumber(volatilityPct)}% IV
              </span>
            </span>
          </span>
          <span className="min-w-0 overflow-hidden border-l border-line pl-3 md:grid md:gap-0.5 md:rounded-md md:border md:bg-surface-muted md:px-2 md:py-1">
            <span className="hidden text-nano font-semibold uppercase tracking-wide text-ink-muted md:block">
              Strategy
            </span>
            <span className="flex min-w-0 items-baseline gap-x-2 gap-y-0.5 whitespace-nowrap md:flex-wrap md:whitespace-normal">
              {hasSavedStrategies ? (
                <>
                  <span className="font-sans text-sm font-semibold leading-none text-ink">
                    {strategyLabel}
                  </span>
                  <span className="min-w-0 truncate font-mono text-caption font-medium tabular-nums text-ink-secondary">
                    {structure}
                    </span>
                    <span className="shrink-0 rounded-full border border-line bg-surface px-1.5 py-0.5 font-mono text-micro font-semibold leading-none tabular-nums text-ink-soft">
                      {displayDteLabel}
                    </span>
                  <span className="hidden shrink-0 rounded-full border border-line bg-surface px-1.5 py-0.5 font-mono text-micro font-semibold leading-none tabular-nums text-ink-soft shadow-sm md:inline">
                    {savedStrategyLabel}
                  </span>
                </>
              ) : (
                <>
                  <span className="font-sans text-sm font-semibold leading-none text-ink">
                    No saved strategy
                  </span>
                  <span className="hidden min-w-0 truncate text-caption font-medium text-ink-secondary md:inline">
                    Create one in setup
                  </span>
                </>
              )}
            </span>
          </span>
        </span>
      </button>

      {isOpen ? (
        <div id="setup-strategy-panel" className="border-t border-line">
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
