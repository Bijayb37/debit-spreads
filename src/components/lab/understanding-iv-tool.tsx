"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { calculateIvEquivalentStrategy } from "@/lib/iv-comparison";
import type {
  IvComparisonInstrument,
  IvComparisonMatchMetric,
} from "@/lib/iv-comparison";
import { clamp, roundTo } from "@/lib/debit-call-spread";
import {
  formatExpectedMove,
  formatReturnMatch,
  formatSignedGreekPercent,
  formatSignedMoveCurrency,
} from "@/components/lab/comparison-helpers";
import {
  compactNumber,
  formatCurrencyWithCents,
  formatPriceCurrency,
  formatStrikeCurrency,
} from "@/components/lab/format";
import { NumberSliderField } from "@/components/lab/number-slider-field";
import type { IvAlternativeStrategy } from "@/components/lab/types";

function IvEquivalentChoiceColumn({
  title,
  value,
  baselineValue,
  change,
  returnPct,
  targetMetricPct,
  matchMetric,
  matchDifferencePoints,
  maximumReturnPct,
  onCreateStrategy,
}: {
  title: string;
  value: string;
  baselineValue: string;
  change: string;
  returnPct: number;
  targetMetricPct: number;
  matchMetric: IvComparisonMatchMetric;
  matchDifferencePoints: number;
  maximumReturnPct: number | null;
  onCreateStrategy: () => void;
}) {
  const isExactMatch = Math.abs(matchDifferencePoints) < 0.05;
  const matchedMetricPct =
    matchMetric === "maximum-return"
      ? maximumReturnPct ?? 0
      : returnPct;
  const matchMetricLabel =
    matchMetric === "maximum-return"
      ? "max return"
      : "return at the expected move";

  return (
    <section className="min-w-0 p-3 sm:p-4">
      <div className="flex min-w-0 items-baseline justify-between gap-3">
        <h3 className="font-[family:var(--font-space-grotesk)] text-base font-semibold text-ink">
          {title}
        </h3>
        <span className="text-right font-mono text-caption font-semibold text-accent-strong tabular-nums">
          {formatReturnMatch(matchDifferencePoints)}
        </span>
      </div>
      <p className="mt-3 break-words font-mono text-xl font-semibold text-ink tabular-nums">
        {value}
      </p>
      <p className="mt-1 text-xs text-ink-muted">
        Instead of <span className="font-mono font-semibold text-ink-soft">{baselineValue}</span>
      </p>
      <div className="mt-3 border-t border-line pt-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <p className="text-caption font-medium text-ink-muted">Change</p>
            <p className="mt-1 break-words font-mono text-sm font-semibold text-accent-strong tabular-nums">
              {change}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-caption font-medium text-ink-muted">
              Max return
            </p>
            <p className="mt-1 font-mono text-sm font-semibold text-ink tabular-nums">
              {maximumReturnPct === null
                ? "Unlimited"
                : formatSignedGreekPercent(maximumReturnPct, 1)}
            </p>
          </div>
        </div>
        <p className="mt-1 text-caption text-ink-muted">
          {isExactMatch
            ? `Matches the selected strategy's ${formatSignedGreekPercent(
                targetMetricPct,
                1,
              )} ${matchMetricLabel}`
            : `${formatSignedGreekPercent(
                matchedMetricPct,
                1,
              )} ${matchMetricLabel} versus ${formatSignedGreekPercent(
                targetMetricPct,
                1,
              )} target`}
        </p>
      </div>
      <button
        type="button"
        aria-label={`Create ${title.toLowerCase()} strategy`}
        onClick={onCreateStrategy}
        className="mt-3 w-full rounded-md border border-accent bg-accent px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Create this strategy
      </button>
    </section>
  );
}

export function UnderstandingIvTool({
  symbol,
  spot,
  currentIvPct,
  expirationDays,
  longStrike,
  shortStrike,
  ratePct,
  todayIso,
  capital,
  allowFractionalContracts,
  defaultInstrument,
  onCreateStrategy,
}: {
  symbol: string;
  spot: number;
  currentIvPct: number;
  expirationDays: number;
  longStrike: number;
  shortStrike: number;
  ratePct: number;
  todayIso: string;
  capital: number;
  allowFractionalContracts: boolean;
  defaultInstrument: IvComparisonInstrument;
  onCreateStrategy: (strategy: IvAlternativeStrategy) => void;
}) {
  const [instrument, setInstrument] =
    useState<IvComparisonInstrument>(defaultInstrument);
  const [comparisonIvPct, setComparisonIvPct] = useState(() =>
    clamp(currentIvPct + 25, 0, 300),
  );
  const result = calculateIvEquivalentStrategy({
    instrument,
    spot,
    longStrike,
    shortStrike,
    entryDte: expirationDays,
    baselineIvPct: currentIvPct,
    comparisonIvPct,
    ratePct,
    dividendYieldPct: 0,
  });
  const structureLabel =
    instrument === "long-call"
      ? `${formatStrikeCurrency(longStrike)} long call`
      : `${formatStrikeCurrency(longStrike)} / ${formatStrikeCurrency(
          shortStrike,
        )} debit call spread`;
  const equivalentStrikeLabel =
    instrument === "long-call"
      ? `${formatStrikeCurrency(
          roundTo(result.equivalentStrike.longStrike, 2),
        )} long call`
      : `${formatStrikeCurrency(
          roundTo(result.equivalentStrike.longStrike, 2),
        )} / ${formatStrikeCurrency(
          roundTo(result.equivalentStrike.shortStrike, 2),
        )} call spread`;
  const equivalentStrikeWidth =
    result.equivalentStrike.shortStrike -
    result.equivalentStrike.longStrike;
  const strikeChangeLabel =
    instrument === "debit-call-spread"
      ? `${formatSignedMoveCurrency(
          result.equivalentStrike.strikeShiftDollar,
        )} long · ${formatStrikeCurrency(
          roundTo(equivalentStrikeWidth, 2),
        )} wide`
      : result.equivalentStrike.strikeShiftDollar < 0.005
        ? "No farther strike match"
        : `${formatSignedMoveCurrency(
            result.equivalentStrike.strikeShiftDollar,
          )} · ${formatSignedGreekPercent(
            result.equivalentStrike.strikeShiftPct,
            2,
          )} of stock`;
  const equivalentDteWidth =
    result.equivalentDte.shortStrike - result.equivalentDte.longStrike;
  const dteChangeLabel =
    result.equivalentDte.daysLess > 0
      ? `${result.equivalentDte.daysLess} fewer days${
          instrument === "debit-call-spread"
            ? ` · ${formatStrikeCurrency(
                roundTo(equivalentDteWidth, 2),
              )} wide`
            : ""
        }`
      : "No shorter DTE match";

  return (
    <div className="min-w-0 space-y-3">
      <section className="min-w-0 overflow-hidden rounded-lg border border-line bg-surface shadow-sm">
        <header className="border-b border-line px-3 py-3 sm:px-4">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="text-caption font-semibold uppercase text-accent-strong">
                Understanding IV
              </p>
              <h2 className="mt-1 font-[family:var(--font-space-grotesk)] text-xl font-semibold text-ink">
                Higher IV: farther OTM or less time
              </h2>
            </div>
            <p className="font-mono text-xs text-ink-secondary tabular-nums">
              {symbol.trim() || "Stock"} {formatPriceCurrency(spot)} ·{" "}
              {compactNumber(currentIvPct)}% entry IV · {expirationDays} DTE
            </p>
          </div>
        </header>

        <div className="grid min-w-0 gap-3 p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <fieldset className="min-w-0">
            <legend className="text-sm font-medium text-slate-900">
              Position
            </legend>
            <div
              className="mt-2 grid grid-cols-2 rounded-lg border border-line bg-surface-sunken p-1"
              aria-label="IV comparison position"
            >
              {([
                { value: "long-call", label: "Long call" },
                {
                  value: "debit-call-spread",
                  label: "Debit spread",
                },
              ] as Array<{
                value: IvComparisonInstrument;
                label: string;
              }>).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={instrument === option.value}
                  onClick={() => setInstrument(option.value)}
                  className={cn(
                    "min-w-0 rounded-md px-2 py-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                    instrument === option.value
                      ? "bg-surface text-ink shadow-sm"
                      : "text-ink-secondary hover:text-ink",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <dl className="mt-3 grid min-w-0 grid-cols-2 gap-3 border-t border-line pt-3">
              <div className="min-w-0">
                <dt className="text-caption font-medium text-ink-muted">
                  Structure
                </dt>
                <dd className="mt-1 break-words font-mono text-xs font-semibold text-ink">
                  {structureLabel}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-caption font-medium text-ink-muted">
                  Max return
                </dt>
                <dd className="mt-1 font-mono text-sm font-semibold text-accent-strong tabular-nums">
                  {result.maximumReturnPct === null
                    ? "Unlimited"
                    : formatSignedGreekPercent(
                        result.maximumReturnPct,
                        1,
                      )}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-caption font-medium text-ink-muted">
                  Return at expected move
                </dt>
                <dd className="mt-1 font-mono text-xs font-semibold text-ink tabular-nums">
                  {formatSignedGreekPercent(
                    result.baseline.returnPct,
                    1,
                  )}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-caption font-medium text-ink-muted">
                  {compactNumber(currentIvPct)}% expected move
                </dt>
                <dd className="mt-1 font-mono text-xs font-semibold text-ink tabular-nums">
                  {formatExpectedMove(
                    result.baselineExpectedMoveDollar,
                    result.baselineExpectedMovePct,
                  )}
                </dd>
              </div>
            </dl>
          </fieldset>

          <div className="min-w-0 space-y-3">
            <NumberSliderField
              label="New IV"
              help="The IV for the farther-OTM and shorter-DTE alternatives."
              min={0}
              max={300}
              step={1}
              value={comparisonIvPct}
              onChange={(value) =>
                setComparisonIvPct(clamp(value, 0, 300))
              }
              suffix="%"
              allowDecimals
              quickActions={[
                { label: "50%", value: 50 },
                { label: "75%", value: 75 },
                { label: "100%", value: 100 },
                { label: "150%", value: 150 },
              ]}
            />
            <dl className="grid min-w-0 grid-cols-2 gap-3 border-t border-line pt-3">
              <div className="min-w-0">
                <dt className="text-caption font-medium text-ink-muted">
                  Expected move
                </dt>
                <dd className="mt-1 font-mono text-sm font-semibold text-ink tabular-nums">
                  {formatExpectedMove(
                    result.comparisonExpectedMoveDollar,
                    result.comparisonExpectedMovePct,
                  )}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-caption font-medium text-ink-muted">
                  Expected stock price
                </dt>
                <dd className="mt-1 font-mono text-sm font-semibold text-ink tabular-nums">
                  {formatCurrencyWithCents(result.comparisonScenarioPrice)}
                </dd>
              </div>
            </dl>
          </div>
        </div>
        <p className="border-t border-line bg-surface-muted px-3 py-2.5 text-xs text-ink-muted sm:px-4">
          {result.matchMetric === "maximum-return"
            ? "The alternatives below match the selected spread's max return. Expected move is shown for context."
            : "Long calls have unlimited max return, so alternatives match the return at the expected move."}
        </p>
      </section>

      <section className="min-w-0 overflow-hidden rounded-lg border border-line bg-surface shadow-sm">
        <header className="flex min-w-0 flex-col gap-1 border-b border-line bg-surface-muted px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <div className="min-w-0">
            <h2 className="font-[family:var(--font-space-grotesk)] text-base font-semibold text-ink">
              At {compactNumber(comparisonIvPct)}% IV, choose one
            </h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              {result.matchMetric === "maximum-return"
                ? `Both target the selected strategy's ${formatSignedGreekPercent(
                    result.targetMetricPct,
                    1,
                  )} max return.`
                : `Both target the selected strategy's ${formatSignedGreekPercent(
                    result.targetMetricPct,
                    1,
                  )} return at the expected move.`}
            </p>
          </div>
          <p className="font-mono text-xs font-semibold text-accent-strong tabular-nums">
            Current IV {compactNumber(currentIvPct)}%
          </p>
        </header>
        <div className="grid min-w-0 divide-y divide-slate-200 md:grid-cols-2 md:divide-x md:divide-y-0">
          <IvEquivalentChoiceColumn
            title="Farther OTM"
            value={equivalentStrikeLabel}
            baselineValue={structureLabel}
            change={strikeChangeLabel}
            returnPct={result.equivalentStrike.returnPct}
            targetMetricPct={result.targetMetricPct}
            matchMetric={result.matchMetric}
            matchDifferencePoints={
              result.equivalentStrike.matchDifferencePoints
            }
            maximumReturnPct={
              result.equivalentStrike.maximumReturnPct
            }
            onCreateStrategy={() =>
              onCreateStrategy({
                instrument,
                symbol,
                todayIso,
                spot,
                longStrike: roundTo(
                  result.equivalentStrike.longStrike,
                  2,
                ),
                shortStrike: roundTo(
                  result.equivalentStrike.shortStrike,
                  2,
                ),
                expirationDays,
                volatilityPct: comparisonIvPct,
                capital,
                allowFractionalContracts,
                ratePct,
                scenarioPrice:
                  result.matchMetric === "maximum-return"
                    ? result.equivalentStrike.shortStrike
                    : result.comparisonScenarioPrice,
                scenarioOffsetDays:
                  result.matchMetric === "maximum-return"
                    ? expirationDays
                    : result.elapsedDays,
              })
            }
          />
          <IvEquivalentChoiceColumn
            title="Less time"
            value={
              instrument === "debit-call-spread"
                ? `${result.equivalentDte.entryDte} DTE · ${formatStrikeCurrency(
                    roundTo(result.equivalentDte.longStrike, 2),
                  )} / ${formatStrikeCurrency(
                    roundTo(result.equivalentDte.shortStrike, 2),
                  )} call spread`
                : `${result.equivalentDte.entryDte} DTE`
            }
            baselineValue={`${expirationDays} DTE`}
            change={dteChangeLabel}
            returnPct={result.equivalentDte.returnPct}
            targetMetricPct={result.targetMetricPct}
            matchMetric={result.matchMetric}
            matchDifferencePoints={
              result.equivalentDte.matchDifferencePoints
            }
            maximumReturnPct={result.equivalentDte.maximumReturnPct}
            onCreateStrategy={() =>
              onCreateStrategy({
                instrument,
                symbol,
                todayIso,
                spot,
                longStrike: roundTo(
                  result.equivalentDte.longStrike,
                  2,
                ),
                shortStrike: roundTo(
                  result.equivalentDte.shortStrike,
                  2,
                ),
                expirationDays: result.equivalentDte.entryDte,
                volatilityPct: comparisonIvPct,
                capital,
                allowFractionalContracts,
                ratePct,
                scenarioPrice:
                  result.matchMetric === "maximum-return"
                    ? result.equivalentDte.shortStrike
                    : result.equivalentDte.scenarioPrice,
                scenarioOffsetDays:
                  result.matchMetric === "maximum-return"
                    ? result.equivalentDte.entryDte
                    : result.equivalentDte.elapsedDays,
              })
            }
          />
        </div>
      </section>
    </div>
  );
}
