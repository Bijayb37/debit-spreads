"use client";

import { cn } from "@/lib/cn";
import { CONTRACT_MULTIPLIER, formatLongDate } from "@/lib/debit-call-spread";
import {
  formatBreakEvenAtExpiry,
  formatGreekValuePercent,
  formatSignedGreekPercent,
  getBreakEvenLabel,
  getComparisonStrikeLabel,
  getEntryLegPricingDetails,
  getOutcomeStrategyTitle,
  getScenarioGreekRows,
  getStrategyDisplayLabel,
  getUnitCostMetricLabel,
  getValuationDte,
  orderSelectedCardsFirst,
} from "@/components/lab/comparison-helpers";
import {
  compactNumber,
  formatCurrency,
  formatCurrencyWithCents,
  formatPercent,
  formatPriceCurrency,
  formatQuantity,
} from "@/components/lab/format";
import { RatioCreditSummary } from "@/components/lab/ratio-credit-summary";
import type {
  ComparisonCardAction,
  ComparisonCardData,
} from "@/components/lab/types";

export function DetailedDecisionOutcomeCards({
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
    <div className="grid min-w-0 gap-3 lg:grid-cols-2">
      {orderedCards.map((card) => {
        const pnlIsPositive = card.snapshot.pnl >= 0;
        const isSelected = card.id === selectedCardId;
        const valuationDte = getValuationDte(card.snapshot);
        const totalCost = card.snapshot.totalCost;
          const maxProfitLabel =
            card.strategy === "call-calendar"
              ? "Open"
              : card.maxProfitAtExpiry !== null
                ? `${formatCurrency(card.maxProfitAtExpiry)}${
                    card.maxReturnAtExpiry !== null
                      ? ` ${formatPercent(card.maxReturnAtExpiry)}`
                      : ""
                  }`
                : "Uncapped";
        const maxLossReturnLabel =
          card.maxLossAtExpiry !== null && totalCost > 0
            ? ` ${formatPercent(card.maxLossAtExpiry / totalCost)}`
            : "";
        const maxLossLabel =
          card.maxLossAtExpiry !== null
            ? `${formatCurrency(card.maxLossAtExpiry)}${maxLossReturnLabel}`
            : "Uncapped";
        const setupDetails = [
          { label: "Strategy", value: getStrategyDisplayLabel(card.strategy) },
          { label: "Structure", value: getOutcomeStrategyTitle(card) },
          { label: "Spot", value: card.spot !== undefined ? formatPriceCurrency(card.spot) : "Current" },
          { label: "Capital", value: formatCurrency(card.capital) },
          { label: "Sizing", value: card.allowFractionalContracts ? "Fractional" : "Whole" },
            { label: "Expiry DTE", value: `${card.snapshot.expirationDays}` },
          ...(card.strategy === "call-calendar"
            ? [{ label: "Short call DTE", value: `${card.snapshot.shortExpirationDays}` }]
            : []),
        ];
        const scenarioDetails = [
          { label: "Valuation date", value: formatLongDate(card.snapshot.selectedDateIso) },
          { label: "Valuation DTE", value: `${valuationDte}` },
          { label: "Position value", value: formatCurrency(card.snapshot.scenarioPositionValue) },
          { label: "P/L", value: `${pnlIsPositive ? "+" : ""}${formatCurrency(card.snapshot.pnl)}` },
          { label: "Return", value: formatPercent(card.snapshot.roi) },
          {
            label: "Future IV",
            value:
              card.futureVolatilityPct !== undefined
                ? `${compactNumber(card.futureVolatilityPct)}%`
                : "Current",
          },
        ];
        const riskDetails = [
          { label: card.snapshot.reserveOffset > 0 ? "Capital reserved" : "Entry cost", value: formatCurrency(totalCost) },
          ...(card.snapshot.reserveOffset > 0 ? [{
            label: "Opening credit",
            value: formatCurrencyWithCents(-card.snapshot.entryPremium * CONTRACT_MULTIPLIER * card.snapshot.contracts),
          }] : []),
          {
            label: getUnitCostMetricLabel(card.strategy, card.snapshot),
            value: formatCurrencyWithCents(card.snapshot.unitCost * CONTRACT_MULTIPLIER),
          },
          { label: "Contracts", value: formatQuantity(card.snapshot.contracts) },
          { label: "Cash left", value: formatCurrency(card.snapshot.cashLeft) },
          { label: getBreakEvenLabel(card.snapshot), value: formatBreakEvenAtExpiry(card.snapshot) },
          { label: "Max profit", value: maxProfitLabel },
          {
            label: "Max loss",
            value: maxLossLabel,
          },
          {
            label: "Profit cap",
              value: card.snapshot.isProfitCapped ? "Capped" : "Uncapped",
            },
        ];
        const entryLegPricingDetails = getEntryLegPricingDetails(card);
        const pricingDetails = [
          ...entryLegPricingDetails,
          {
            label: "Current IV",
            value:
              card.volatilityPct !== undefined
                ? `${compactNumber(card.volatilityPct)}%`
                : "Current",
          },
          {
            label: "Rate",
            value: card.ratePct !== undefined ? `${compactNumber(card.ratePct)}%` : "Current",
          },
          {
            label: "Dividend yield",
            value:
              card.dividendYieldPct !== undefined
                ? `${compactNumber(card.dividendYieldPct)}%`
                : "Current",
          },
          { label: "Width", value: formatCurrency(card.snapshot.width) },
        ];
        const groups = [
          { title: "Setup", details: setupDetails },
          { title: "Scenario", details: scenarioDetails },
          { title: "Risk", details: riskDetails },
          { title: "Pricing", details: pricingDetails },
        ];
        const greekRows = getScenarioGreekRows(card);

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

            <div className="pointer-events-none border-b border-line bg-slate-950 px-3 py-2.5 text-white">
              <div className="flex min-w-0 items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-sans text-base font-semibold leading-tight text-balance">
                    {card.label}
                  </h3>
                  <p className="mt-1 truncate font-mono text-xs text-slate-300 tabular-nums">
                    {getComparisonStrikeLabel(card)}
                  </p>
                </div>
                {isSelected ? (
                  <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-micro font-semibold text-white shadow-sm">
                    Selected
                  </span>
                ) : null}
              </div>
              <div className="mt-3 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-3">
                <div className="min-w-0">
                  <p className="text-caption font-medium text-slate-300">P/L</p>
                  <p
                    className={cn(
                      "mt-1 truncate font-sans text-3xl font-semibold leading-none tabular-nums",
                      pnlIsPositive ? "text-emerald-300" : "text-rose-300",
                    )}
                  >
                    {pnlIsPositive ? "+" : ""}
                    {formatCurrency(card.snapshot.pnl)}
                  </p>
                </div>
                <div className="min-w-[5rem] text-right">
                  <p className="text-caption font-medium text-slate-300">Return</p>
                  <p
                    className={cn(
                      "mt-1 font-sans text-xl font-semibold leading-none tabular-nums",
                      pnlIsPositive ? "text-emerald-300" : "text-rose-300",
                    )}
                  >
                    {formatPercent(card.snapshot.roi)}
                  </p>
                </div>
              </div>
            </div>

            <div className="pointer-events-none grid min-w-0 gap-3 p-3 sm:grid-cols-2">
              {card.snapshot.reserveOffset > 0 ? (
                <div className="min-w-0 sm:col-span-2">
                  <RatioCreditSummary snapshot={card.snapshot} />
                </div>
              ) : null}
              {groups.map((group) => (
                <section key={group.title} className="min-w-0">
                  <h4 className="text-micro font-semibold uppercase text-ink-muted">
                    {group.title}
                  </h4>
                  <dl className="mt-2 grid min-w-0 grid-cols-2 gap-x-3 gap-y-2">
                    {group.details.map((detail) => (
                      <div key={`${group.title}-${detail.label}`} className="min-w-0">
                        <dt className="truncate text-caption font-medium text-ink-muted">
                          {detail.label}
                        </dt>
                        <dd
                          className="mt-0.5 truncate font-mono text-xs font-semibold text-ink tabular-nums"
                          title={String(detail.value)}
                        >
                          {detail.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
              <section className="min-w-0 sm:col-span-2">
                <h4 className="text-micro font-semibold uppercase text-ink-muted">
                  Greeks (%)
                </h4>
                <div className="mt-2 grid min-w-0 gap-2">
                  {greekRows.map((row) => {
        const metrics = [
                      {
                        label: "Delta",
                        value: formatSignedGreekPercent(row.greeks.delta, 2),
                      },
                      {
                        label: "Gamma",
                        value: formatSignedGreekPercent(row.greeks.gamma, 3),
                      },
                      {
                        label: "Theta/day",
                        value: formatGreekValuePercent(
                          row.greeks.theta,
                          row.marketValue,
                        ),
                      },
                      {
                        label: "Vega/1%",
                        value: formatGreekValuePercent(
                          row.greeks.vega,
                          row.marketValue,
                        ),
                      },
                      {
                        label: "Rho/1%",
                        value: formatGreekValuePercent(
                          row.greeks.rho,
                          row.marketValue,
                        ),
                      },
                    ];

                    return (
                      <div
                        key={row.label}
                        className={cn(
                          "min-w-0",
                          row.isNet && "border-t border-line pt-2",
                        )}
                      >
                        <p
                          className={cn(
                            "truncate text-caption font-medium text-ink-muted",
                            row.isNet && "font-semibold text-ink-soft",
                          )}
                        >
                          {row.label}
                        </p>
                        <dl className="mt-1 grid min-w-0 grid-cols-5 gap-x-2">
                          {metrics.map((metric) => (
                            <div key={metric.label} className="min-w-0">
                              <dt className="truncate text-nano font-medium text-slate-400">
                                {metric.label}
                              </dt>
                              <dd
                                className={cn(
                                  "mt-0.5 truncate font-mono text-caption font-semibold text-ink tabular-nums",
                                  row.isNet && "text-accent-strong",
                                )}
                                title={metric.value}
                              >
                                {metric.value}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          </article>
        );
      })}
    </div>
  );
}
