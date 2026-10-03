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
            valueClassName: "text-emerald-700",
          }] : []),
            {
              label: "DTE · Initial price",
              value: `${getDteDisplayLabel(card)} · ${
                card.spot !== undefined ? formatPriceCurrency(card.spot) : "Current"
              }`,
              valueClassName: "text-slate-950",
            },
          {
            label: getBreakEvenLabel(card.snapshot),
            value: formatBreakEvenAtExpiry(card.snapshot),
            valueClassName: "text-slate-950",
          },
          {
            label: getUnitCostMetricLabel(card.strategy, card.snapshot),
            value: formatCurrencyWithCents(card.snapshot.unitCost * CONTRACT_MULTIPLIER),
            valueClassName: "text-slate-950",
          },
          {
            label: card.snapshot.reserveOffset > 0 ? "Capital reserved" : "Initial cost",
            value: formatCurrency(card.snapshot.totalCost),
            valueClassName: "text-slate-950",
          },
          {
            label: "IV",
            value:
              card.volatilityPct !== undefined
                ? `${compactNumber(card.volatilityPct)}%`
                : "Current",
            valueClassName: "text-slate-950",
          },
        ];

        return (
          <article
            key={card.id}
            className={cn(
              "group relative min-w-0 overflow-hidden rounded-md border bg-white shadow-sm transition-colors",
              isSelected ? "border-[var(--accent)]" : "border-slate-200",
              onAnalyzeCard && !isSelected && "hover:border-[var(--accent)] hover:bg-[var(--accent-faint)]",
            )}
          >
            {onAnalyzeCard ? (
              <button
                type="button"
                aria-pressed={isSelected}
                aria-label={`Select ${card.label}`}
                onClick={() => onAnalyzeCard(card)}
                className="absolute inset-0 z-10 cursor-pointer bg-transparent focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--accent)]"
              />
            ) : null}

            <div
              className={cn(
                "pointer-events-none relative flex min-h-14 min-w-0 items-center bg-slate-950 px-3 py-2 text-white",
                isSelected && "pr-28",
              )}
            >
              <div className="flex min-w-0 items-baseline gap-2">
                <h3 className="min-w-0 truncate font-[family:var(--font-space-grotesk)] text-sm font-semibold leading-tight text-balance">
                  {card.label}
                </h3>
                <p className="shrink-0 font-mono text-xs font-medium text-slate-300 tabular-nums">
                  {getComparisonStrikeLabel(card)}
                </p>
              </div>
              {isSelected ? (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
                  Selected
                </span>
              ) : null}
            </div>

            <div className="pointer-events-none space-y-2 p-2.5">
              <div className="grid min-w-0 grid-cols-3 gap-2 rounded-md bg-slate-50 p-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-slate-500">Position value</p>
                  <p className="mt-1 truncate font-mono text-sm font-semibold leading-none text-slate-950 tabular-nums">
                    {formatCurrency(card.snapshot.scenarioPositionValue)}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-slate-500">P/L</p>
                  <p
                    className={cn(
                      "mt-1 truncate font-mono text-base font-semibold leading-none tabular-nums",
                      pnlIsPositive ? "text-emerald-700" : "text-rose-700",
                    )}
                  >
                    {pnlIsPositive ? "+" : ""}
                    {formatCurrency(card.snapshot.pnl)}
                  </p>
                </div>
                <div className="min-w-0 text-right">
                  <p className="text-[11px] font-medium text-slate-500">Return</p>
                  <p className="mt-1 truncate font-mono text-sm font-semibold leading-none text-slate-950 tabular-nums">
                    {formatPercent(card.snapshot.roi)}
                  </p>
                </div>
              </div>

              <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3">
                {metrics.map((metric) => (
                  <div
                    key={metric.label}
                    className="min-w-0 rounded-md border border-slate-100 bg-white px-2 py-1.5 shadow-sm"
                  >
                    <p className="text-[11px] font-medium text-slate-500">{metric.label}</p>
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
                <div className="min-w-0 rounded-md border border-slate-100 bg-white px-2 py-1.5 shadow-sm">
                  <p className="text-[11px] font-medium text-slate-500">
                    Max profit %
                  </p>
                  <p className="mt-0.5 truncate font-mono text-xs font-semibold text-emerald-700 tabular-nums">
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
