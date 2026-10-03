"use client";

import { cn } from "@/lib/cn";
import {
  formatBreakEvenAtExpiry,
  getComparisonStrikeLabel,
  getDteDisplayLabel,
  getMaxProfitAtExpiryLabel,
  orderSelectedCardsFirst,
} from "@/components/lab/comparison-helpers";
import { DecisionOutcomeCards } from "@/components/lab/decision-outcome-cards";
import {
  DecisionOutcomeMatrix,
} from "@/components/lab/decision-outcome-matrix";
import {
  DetailedDecisionOutcomeCards,
} from "@/components/lab/detailed-decision-outcome-cards";
import { formatCurrency, formatPercent } from "@/components/lab/format";
import { SectionCard } from "@/components/lab/section-card";
import type {
  ComparisonCardAction,
  ComparisonCardData,
  DecisionComparisonView,
} from "@/components/lab/types";

export function DecisionComparisonBoard({
  cards,
  selectedCardId,
  view,
  onViewChange,
  onAnalyzeCard,
}: {
  cards: ComparisonCardData[];
  selectedCardId?: string | null;
  view: DecisionComparisonView;
  onViewChange: (view: DecisionComparisonView) => void;
  onAnalyzeCard?: ComparisonCardAction;
}) {
  const decisionViews: Array<{ value: DecisionComparisonView; label: string }> = [
    { value: "cards", label: "Cards" },
    { value: "detailed-cards", label: "Detailed cards" },
    { value: "table", label: "Table" },
    { value: "matrix", label: "Matrix" },
  ];
  const activeView =
    view === "detailed-cards" || view === "table" || view === "matrix"
      ? view
      : "cards";
  const orderedCards = orderSelectedCardsFirst(cards, selectedCardId);
  const title =
    activeView === "table"
      ? "Strategy table"
      : activeView === "matrix"
        ? "Outcome matrix"
        : activeView === "detailed-cards"
          ? "Detailed cards"
        : "Outcome cards";

  return (
    <SectionCard
      title={title}
      className="w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] overflow-hidden sm:w-auto sm:max-w-none [&_h2]:text-base [&_h2]:font-semibold"
      action={
        <div
          className="grid w-full min-w-0 grid-cols-2 rounded-md border border-line bg-surface-sunken p-0.5 shadow-sm sm:grid-cols-4"
          aria-label="Comparison view"
        >
          {decisionViews.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={activeView === option.value}
              onClick={() => onViewChange(option.value)}
              className={cn(
                "min-w-0 rounded px-2.5 py-1 text-xs font-semibold text-ink-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                activeView === option.value && "bg-surface text-ink shadow-sm",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      }
    >
      {cards.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line-strong bg-surface-muted p-6 text-center text-sm text-ink-muted">
          Add or fix a setup to compare strategies.
        </div>
      ) : activeView === "cards" ? (
        <DecisionOutcomeCards
          cards={orderedCards}
          selectedCardId={selectedCardId}
          onAnalyzeCard={onAnalyzeCard}
        />
      ) : activeView === "detailed-cards" ? (
        <DetailedDecisionOutcomeCards
          cards={orderedCards}
          selectedCardId={selectedCardId}
          onAnalyzeCard={onAnalyzeCard}
        />
      ) : activeView === "matrix" ? (
        <DecisionOutcomeMatrix
          cards={orderedCards}
          selectedCardId={selectedCardId}
          onAnalyzeCard={onAnalyzeCard}
        />
      ) : (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-lg border border-line bg-surface shadow-sm">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-slate-950 text-white">
                <tr>
                  {["Strategy", "Scenario", "P/L", "Return", "Cost", "DTE", "B/E", "Max at expiry"].map((label) => (
                    <th key={label} className="px-3 py-2 text-left font-medium">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orderedCards.map((card) => {
                  return (
                    <tr
                      key={card.id}
                      className={cn(
                        "border-t border-slate-100 transition-colors",
                        card.id === selectedCardId && "bg-accent-faint",
                      )}
                    >
                      <td className="px-3 py-3">
                        {onAnalyzeCard ? (
                          <button
                            type="button"
                            aria-pressed={card.id === selectedCardId}
                            onClick={() => onAnalyzeCard(card)}
                            className="text-left font-semibold text-ink hover:text-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                          >
                            {card.label}
                          </button>
                        ) : (
                          <p className="font-semibold text-ink">{card.label}</p>
                        )}
                        <p className="font-mono text-xs text-ink-muted tabular-nums">
                          {getComparisonStrikeLabel(card)}
                        </p>
                      </td>
                      <td className="max-w-64 px-3 py-3 text-xs leading-5 text-ink-secondary text-pretty">
                        {card.snapshot.pnl >= 0 ? "Profitable" : "Losing"} in this scenario
                        with {formatPercent(card.snapshot.roi)} return.
                      </td>
                      <td
                        className={cn(
                          "px-3 py-3 font-mono font-semibold tabular-nums",
                          card.snapshot.pnl >= 0 ? "text-gain" : "text-loss",
                        )}
                      >
                        {card.snapshot.pnl >= 0 ? "+" : ""}
                        {formatCurrency(card.snapshot.pnl)}
                      </td>
                      <td className="px-3 py-3 font-mono font-semibold tabular-nums text-ink">
                        {formatPercent(card.snapshot.roi)}
                      </td>
                      <td className="px-3 py-3 font-mono tabular-nums text-ink">
                        {formatCurrency(card.snapshot.totalCost)}
                      </td>
                        <td className="px-3 py-3 font-mono tabular-nums text-ink">
                          {getDteDisplayLabel(card)}
                        </td>
                      <td className="px-3 py-3 font-mono tabular-nums text-ink">
                        {formatBreakEvenAtExpiry(card.snapshot)}
                      </td>
                      <td className="px-3 py-3 font-mono tabular-nums text-ink">
                        {getMaxProfitAtExpiryLabel(card)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
