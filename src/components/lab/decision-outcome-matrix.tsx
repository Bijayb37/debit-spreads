"use client";

import { cn } from "@/lib/cn";
import { normalizePutRatioShortCount } from "@/lib/debit-call-spread";
import {
  formatBreakEvenAtExpiry,
  getCompactMaxProfitAtExpiryLabel,
  getDteDisplayLabel,
  getOutcomeStrategyTitle,
  orderSelectedCardsFirst,
} from "@/components/lab/comparison-helpers";
import {
  formatCurrency,
  formatPercent,
  formatStrikeCurrency,
} from "@/components/lab/format";
import { isRatioSpreadStrategy } from "@/components/lab/strategy-helpers";
import type {
  ComparisonCardAction,
  ComparisonCardData,
} from "@/components/lab/types";

export function DecisionOutcomeMatrix({
  cards,
  selectedCardId,
  onAnalyzeCard,
}: {
  cards: ComparisonCardData[];
  selectedCardId?: string | null;
  onAnalyzeCard?: ComparisonCardAction;
}) {
  const orderedCards = orderSelectedCardsFirst(cards, selectedCardId);
  const matrixMetrics = [
    {
      label: "Scenario",
      getValue: (card: ComparisonCardData) =>
        `${card.snapshot.pnl >= 0 ? "Profit" : "Loss"} ${formatPercent(card.snapshot.roi)}`,
      getValueClassName: () => "text-slate-950",
    },
    {
      label: "P/L",
      getValue: (card: ComparisonCardData) =>
        `${card.snapshot.pnl >= 0 ? "+" : ""}${formatCurrency(card.snapshot.pnl)}`,
      getValueClassName: (card: ComparisonCardData) =>
        card.snapshot.pnl >= 0 ? "text-emerald-700" : "text-rose-700",
    },
    {
      label: "Return",
      getValue: (card: ComparisonCardData) => formatPercent(card.snapshot.roi),
      getValueClassName: () => "text-slate-950",
    },
    {
      label: "Cost",
      getValue: (card: ComparisonCardData) => formatCurrency(card.snapshot.totalCost),
      getValueClassName: () => "text-slate-950",
    },
    {
        label: "DTE",
        getValue: (card: ComparisonCardData) => getDteDisplayLabel(card),
        getValueClassName: () => "text-slate-950",
      },
    {
      label: "B/E",
      getValue: (card: ComparisonCardData) => formatBreakEvenAtExpiry(card.snapshot),
      getValueClassName: () => "text-slate-950",
    },
    {
      label: "Max at expiry",
      getValue: (card: ComparisonCardData) => getCompactMaxProfitAtExpiryLabel(card),
      getValueClassName: () => "text-slate-950",
    },
  ];

  return (
    <div className="grid min-w-0 gap-2 lg:grid-cols-2 xl:grid-cols-3">
      {matrixMetrics.map((metric) => (
        <article
          key={metric.label}
          className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-md"
        >
          <div className="bg-slate-950 px-3 py-2.5 text-white">
            <p className="text-xs font-medium text-slate-300">Metric</p>
            <h3 className="mt-1 font-[family:var(--font-space-grotesk)] text-base font-semibold leading-tight text-balance">
              {metric.label}
            </h3>
          </div>
          <div className="divide-y divide-slate-100">
            {orderedCards.map((card) => {
              const isSelected = card.id === selectedCardId;
              const value = metric.getValue(card);

              return (
                <div
                  key={card.id}
                  className={cn(
                    "relative grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 transition-colors",
                    onAnalyzeCard && !isSelected && "hover:bg-[var(--accent-faint)]",
                    isSelected && "bg-[var(--accent-faint)]",
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
                  <div className="pointer-events-none min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">
                      {getOutcomeStrategyTitle(card)}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-xs text-slate-500 tabular-nums">
                      {card.strategy === "long-call" || card.strategy === "bear-put"
                        ? `${formatStrikeCurrency(card.longStrike)} ${
                            card.strategy === "bear-put" ? "put" : "call"
                          }`
                        : `${formatStrikeCurrency(card.longStrike)} / ${formatStrikeCurrency(card.shortStrike)}${
                            isRatioSpreadStrategy(card.strategy)
                              ? ` x${normalizePutRatioShortCount(card.ratioShortCount)}`
                              : ""
                          }`}
                    </p>
                  </div>
                  <p
                    className={cn(
                      "pointer-events-none max-w-32 truncate text-right font-mono text-sm font-semibold tabular-nums",
                      metric.getValueClassName(card),
                    )}
                    title={value}
                  >
                    {value}
                  </p>
                </div>
              );
            })}
          </div>
        </article>
      ))}
    </div>
  );
}
