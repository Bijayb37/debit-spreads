"use client";

import { cn } from "@/lib/cn";
import { CONTRACT_MULTIPLIER } from "@/lib/debit-call-spread";
import {
  formatBreakEvenAtExpiry,
  getBreakEvenLabel,
  getComparisonStrikeLabel,
  getDteDisplayLabel,
  getUnitCostMetricLabel,
  orderSelectedCardsFirst,
} from "@/components/lab/comparison-helpers";
import {
  compactNumber,
  formatCurrency,
  formatCurrencyWithCents,
  formatPercent,
  formatPriceCurrency,
} from "@/components/lab/format";
import type {
  ComparisonCardAction,
  ComparisonCardData,
} from "@/components/lab/types";

export function DecisionOutcomeCards({
  cards,
  selectedCardId,
  onAnalyzeCard,
}: {
  cards: ComparisonCardData[];
  selectedCardId?: string | null;
  onAnalyzeCard?: ComparisonCardAction;
}) {
  const orderedCards = orderSelectedCardsFirst(cards, selectedCardId);

  return (
    <div className="grid min-w-0 gap-2 md:grid-cols-2 xl:grid-cols-4">
      {orderedCards.map((card) => {
        const pnlIsPositive = card.snapshot.pnl >= 0;
        const isSelected = card.id === selectedCardId;
          const maxProfitPercent =
            card.strategy === "call-calendar"
              ? "Open"
              : card.maxReturnAtExpiry !== null
                ? formatPercent(card.maxReturnAtExpiry)
                : "Uncapped";
        const metrics = [
          ...(card.snapshot.reserveOffset > 0 ? [{
            label: "Credit / spread",
            value: formatCurrencyWithCents(-card.snapshot.entryPremium * CONTRACT_MULTIPLIER),
            valueClassName: "text-gain",
          }] : []),
            {
              label: "DTE · Initial price",
              value: `${getDteDisplayLabel(card)} · ${
                card.spot !== undefined ? formatPriceCurrency(card.spot) : "Current"
              }`,
              valueClassName: "text-ink",
            },
          {
            label: getBreakEvenLabel(card.snapshot),
            value: formatBreakEvenAtExpiry(card.snapshot),
            valueClassName: "text-ink",
          },
          {
            label: getUnitCostMetricLabel(card.strategy, card.snapshot),
            value: formatCurrencyWithCents(card.snapshot.unitCost * CONTRACT_MULTIPLIER),
            valueClassName: "text-ink",
          },
          {
            label: card.snapshot.reserveOffset > 0 ? "Capital reserved" : "Initial cost",
            value: formatCurrency(card.snapshot.totalCost),
            valueClassName: "text-ink",
          },
          {
            label: "IV",
            value:
              card.volatilityPct !== undefined
                ? `${compactNumber(card.volatilityPct)}%`
                : "Current",
            valueClassName: "text-ink",
          },
        ];

        return (
          <article
            key={card.id}
            className={cn(
              "group relative min-w-0 overflow-hidden rounded-md border bg-surface shadow-sm transition-colors",
              isSelected ? "border-accent" : "border-line",
              onAnalyzeCard && !isSelected && "hover:border-accent hover:bg-accent-faint",
            )}
          >
            {onAnalyzeCard ? (
              <button
                type="button"
                aria-pressed={isSelected}
                aria-label={`Select ${card.label}`}
                onClick={() => onAnalyzeCard(card)}
                className="absolute inset-0 z-10 cursor-pointer bg-transparent focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent"
              />
            ) : null}

            <div
              className={cn(
                "pointer-events-none relative flex min-h-14 min-w-0 items-center bg-slate-950 px-3 py-2 text-white",
                isSelected && "pr-28",
              )}
            >
              <div className="flex min-w-0 items-baseline gap-2">
                <h3 className="min-w-0 truncate font-sans text-sm font-semibold leading-tight text-balance">
                  {card.label}
                </h3>
                <p className="shrink-0 font-mono text-xs font-medium text-slate-300 tabular-nums">
                  {getComparisonStrikeLabel(card)}
                </p>
              </div>
              {isSelected ? (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-accent px-2 py-0.5 text-micro font-semibold text-white shadow-sm">
                  Selected
                </span>
              ) : null}
            </div>

            <div className="pointer-events-none space-y-2 p-2.5">
              <div className="grid min-w-0 grid-cols-3 gap-2 rounded-md bg-surface-muted p-2">
                <div className="min-w-0">
                  <p className="text-caption font-medium text-ink-muted">Position value</p>
                  <p className="mt-1 truncate font-mono text-sm font-semibold leading-none text-ink tabular-nums">
                    {formatCurrency(card.snapshot.scenarioPositionValue)}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-caption font-medium text-ink-muted">P/L</p>
                  <p
                    className={cn(
                      "mt-1 truncate font-mono text-base font-semibold leading-none tabular-nums",
                      pnlIsPositive ? "text-gain" : "text-loss",
                    )}
                  >
                    {pnlIsPositive ? "+" : ""}
                    {formatCurrency(card.snapshot.pnl)}
                  </p>
                </div>
                <div className="min-w-0 text-right">
                  <p className="text-caption font-medium text-ink-muted">Return</p>
                  <p className="mt-1 truncate font-mono text-sm font-semibold leading-none text-ink tabular-nums">
                    {formatPercent(card.snapshot.roi)}
                  </p>
                </div>
              </div>

              <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3">
                {metrics.map((metric) => (
                  <div
                    key={metric.label}
                    className="min-w-0 rounded-md border border-slate-100 bg-surface px-2 py-1.5 shadow-sm"
                  >
                    <p className="text-caption font-medium text-ink-muted">{metric.label}</p>
                    <p
                      className={cn(
                        "mt-0.5 truncate font-mono text-xs font-semibold tabular-nums",
                        metric.valueClassName,
                      )}
                    >
                      {metric.value}
                    </p>
                  </div>
                ))}
                <div className="min-w-0 rounded-md border border-slate-100 bg-surface px-2 py-1.5 shadow-sm">
                  <p className="text-caption font-medium text-ink-muted">
                    Max profit %
                  </p>
                  <p className="mt-0.5 truncate font-mono text-xs font-semibold text-gain tabular-nums">
                    {maxProfitPercent}
                  </p>
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
