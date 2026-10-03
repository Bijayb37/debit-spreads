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
  formatCompactCurrency,
  formatCurrency,
  formatCurrencyWithCents,
  formatPercent,
  formatQuantity,
} from "@/components/lab/format";
import type { ComparisonCardData } from "@/components/lab/types";

export function ComparisonCardGrid({
  cards,
  prioritizeSelected = true,
  selectedCardId,
  onRemoveCard,
}: {
  cards: ComparisonCardData[];
  prioritizeSelected?: boolean;
  selectedCardId?: string | null;
  onRemoveCard?: (id: string) => void;
}) {
  const orderedCards = prioritizeSelected
    ? orderSelectedCardsFirst(cards, selectedCardId)
    : cards;

  return (
    <div className="grid min-w-0 gap-3 lg:grid-cols-2 xl:grid-cols-3">
      {orderedCards.map((card) => {
        const isCurrent = card.id === "current";
        const isSelected = card.id === selectedCardId;
        const pnlIsPositive = card.snapshot.pnl >= 0;
        const pnlTone = pnlIsPositive ? "text-gain" : "text-loss";
          const maxAtExpiryLabel =
          card.strategy === "call-calendar"
            ? "Open"
            :
            card.maxProfitAtExpiry !== null
              ? `${formatCompactCurrency(card.maxProfitAtExpiry)} ${
                  card.maxReturnAtExpiry !== null ? formatPercent(card.maxReturnAtExpiry) : ""
                }`.trim()
              : "Uncapped";
        const details = [
          {
            label: getBreakEvenLabel(card.snapshot),
            value: formatBreakEvenAtExpiry(card.snapshot),
          },
            { label: "DTE", value: getDteDisplayLabel(card) },
          {
            label: getUnitCostMetricLabel(card.strategy, card.snapshot),
            value: formatCurrencyWithCents(card.snapshot.unitCost * CONTRACT_MULTIPLIER),
          },
          { label: "Max at expiry", value: maxAtExpiryLabel },
          { label: "Contracts", value: formatQuantity(card.snapshot.contracts) },
        ];
        if (card.snapshot.reserveOffset > 0) {
          details.push({ label: "Credit / spread", value: formatCurrencyWithCents(-card.snapshot.entryPremium * CONTRACT_MULTIPLIER) });
        }

        return (
          <article
            key={card.id}
            className={cn(
              "min-w-0 overflow-hidden rounded-lg border bg-surface shadow-sm",
              "border-line",
              isCurrent && "border-accent-border ring-1 ring-accent-ring",
              isSelected && "border-accent ring-1 ring-accent-ring",
            )}
          >
            <div
              className={cn(
                "h-1 w-full",
                pnlIsPositive ? "bg-emerald-600" : "bg-rose-600",
              )}
            />
            <div className="p-3">
              <div className="flex min-w-0 items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-ink text-balance">
                      {card.label}
                    </h3>
                    {isSelected ? (
                      <span className="rounded-full border border-accent-border bg-accent-soft px-2 py-0.5 text-micro font-semibold text-accent-strong">
                        Selected
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 truncate font-mono text-xs text-ink-muted tabular-nums">
                    {getComparisonStrikeLabel(card)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center">
                  {onRemoveCard ? (
                    <button
                      type="button"
                      aria-label={`Remove ${card.label}`}
                      onClick={() => onRemoveCard(card.id)}
                      className="inline-flex size-6 items-center justify-center rounded-md border border-line bg-surface text-sm font-semibold text-ink-muted shadow-sm hover:border-rose-300 hover:text-loss focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      x
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="mt-3 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-lg bg-surface-muted p-3">
                <div className="min-w-0">
                  <p className="text-micro font-semibold uppercase tracking-wide text-ink-muted">
                    Scenario P/L
                  </p>
                  <p
                    className={cn(
                      "mt-1 truncate font-sans text-3xl font-semibold leading-none tabular-nums",
                      pnlTone,
                    )}
                  >
                    {pnlIsPositive ? "+" : ""}
                    {formatCurrency(card.snapshot.pnl)}
                  </p>
                </div>
                <div className="min-w-[4.5rem] text-right">
                  <p className="text-micro font-semibold uppercase tracking-wide text-ink-muted">
                    Return
                  </p>
                  <p
                    className={cn(
                      "mt-1 font-sans text-xl font-semibold leading-none tabular-nums",
                      pnlTone,
                    )}
                  >
                    {formatPercent(card.snapshot.roi)}
                  </p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                {details.map((detail) => (
                  <div key={detail.label} className="min-w-0">
                    <p className="text-micro font-semibold uppercase tracking-wide text-ink-muted">
                      {detail.label}
                    </p>
                    <p className="mt-0.5 truncate font-mono font-semibold text-ink tabular-nums">
                      {detail.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
