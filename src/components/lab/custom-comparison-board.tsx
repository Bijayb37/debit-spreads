"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import {
  PUT_RATIO_SHORT_COUNT_MIN,
  clamp,
  getDefaultCallCalendarShortExpirationDays,
  normalizeCallCalendarShortExpirationDays,
  normalizePutRatioShortCount,
} from "@/lib/debit-call-spread";
import type { OptionStrategy, ScenarioSnapshot } from "@/lib/debit-call-spread";
import { CompactNumberInput } from "@/components/lab/compact-number-input";
import { CompactStrategyList } from "@/components/lab/compact-strategy-list";
import { ComparisonCardGrid } from "@/components/lab/comparison-card-grid";
import { getCustomComparisonLabel } from "@/components/lab/comparison-helpers";
import { STRATEGY_OPTIONS } from "@/components/lab/constants";
import { formatCurrency } from "@/components/lab/format";
import { RatioCreditSummary } from "@/components/lab/ratio-credit-summary";
import { SectionCard } from "@/components/lab/section-card";
import {
  getDefaultStrikesForStrategy,
  isDebitSpreadStrategy,
  isPutDownsideStrategy,
  isPutOptionStrategy,
  isRatioSpreadStrategy,
  normalizeShortStrikeForStrategy,
  normalizeStrikeValue,
} from "@/components/lab/strategy-helpers";
import type {
  ComparisonCardAction,
  ComparisonCardData,
  CustomComparisonDraft,
} from "@/components/lab/types";

export function CustomComparisonBoard({
  cards,
  draft,
  draftError,
  draftSnapshot,
  embedded = false,
  isEditorOpen,
  setupForm,
  quickStartCards,
  editingComparisonId,
  selectedCardId,
  showSummary,
  showSetupForm = false,
  saveActionLabel = "Save strategy",
  moneyDisplayUnitScale = 1,
  moneyDisplayUnitSuffix,
  currentSpot,
  currentVolatilityPct,
  currentRatePct,
  scenarioDateLabel,
  scenarioPrice,
  symbol,
  onDraftChange,
  onAddComparison,
  onOpenEditor,
  onToggleSetupForm,
  onAnalyzeCard,
  onEditComparison,
  onClose,
  onRemoveComparison,
  onReorderComparisons,
  onUseQuickStart,
}: {
  cards: ComparisonCardData[];
  draft: CustomComparisonDraft;
  draftError: string | null;
  draftSnapshot: ScenarioSnapshot;
  embedded?: boolean;
  isEditorOpen: boolean;
  setupForm?: ReactNode;
  quickStartCards: ComparisonCardData[];
  editingComparisonId?: string | null;
  selectedCardId?: string | null;
  showSummary: boolean;
  showSetupForm?: boolean;
  saveActionLabel?: string;
  moneyDisplayUnitScale?: number;
  moneyDisplayUnitSuffix?: string;
  currentSpot: number;
  currentVolatilityPct: number;
  currentRatePct: number;
  scenarioDateLabel: string;
  scenarioPrice: number;
  symbol: string;
  onDraftChange: (draft: CustomComparisonDraft) => void;
  onAddComparison: () => void;
  onOpenEditor?: () => void;
  onToggleSetupForm?: () => void;
  onAnalyzeCard?: ComparisonCardAction;
  onEditComparison?: ComparisonCardAction;
  onClose?: () => void;
  onRemoveComparison: (id: string) => void;
  onReorderComparisons?: (orderedIds: string[]) => void;
  onUseQuickStart: (card: ComparisonCardData) => void;
}) {
  const isSpreadDraft = isDebitSpreadStrategy(draft.strategy);
  const isPutSpreadDraft = isPutOptionStrategy(draft.strategy);
  const isPutRatioSpreadDraft = draft.strategy === "put-ratio-spread";
  const isCallRatioSpreadDraft = draft.strategy === "call-ratio-spread";
  const isCallCalendarDraft = draft.strategy === "call-calendar";
  const isRatioSpreadDraft = isRatioSpreadStrategy(draft.strategy);
  const isEditingMode = Boolean(editingComparisonId);
  const actionContent =
    isEditorOpen || onOpenEditor ? (
      <div className="flex min-w-0 flex-wrap justify-end gap-2">
        {isEditorOpen && quickStartCards.length > 0 ? (
          <label className="relative min-w-0">
            <span className="sr-only">Start with preset strategy</span>
            <select
              value=""
              onChange={(event) => {
                const selectedCard = quickStartCards.find(
                  (card) => card.id === event.target.value,
                );

                if (selectedCard) {
                  onUseQuickStart(selectedCard);
                }
              }}
              className="h-9 max-w-full cursor-pointer appearance-none rounded-md border border-slate-300 bg-white py-0 pl-3 pr-8 text-xs font-semibold text-slate-700 shadow-sm outline-none hover:border-[var(--accent)] hover:text-slate-950 focus:border-[var(--accent)] focus:outline-2 focus:outline-offset-2 focus:outline-[var(--accent)]"
            >
              <option value="" disabled>
                Start with
              </option>
              {quickStartCards.map((card) => (
                <option
                  key={card.id}
                  value={card.id}
                >
                  {card.label}
                </option>
              ))}
            </select>
            <span
              aria-hidden
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500"
            >
              ▾
            </span>
          </label>
        ) : null}
        {isEditorOpen ? (
          <button
            type="button"
            disabled={Boolean(draftError)}
            onClick={onAddComparison}
            className="rounded-md border border-[var(--accent)] bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            {saveActionLabel}
          </button>
        ) : null}
        {!isEditorOpen && onToggleSetupForm ? (
          <button
            type="button"
            onClick={onToggleSetupForm}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-[var(--accent)] hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            {showSetupForm ? "Hide setup" : "Show setup"}
          </button>
        ) : null}
        {!isEditorOpen && onOpenEditor ? (
          <button
            type="button"
            onClick={onOpenEditor}
            className="rounded-md border border-[var(--accent)] bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[var(--accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            Add strategy
          </button>
        ) : null}
        {isEditorOpen && onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-[var(--accent)] hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            Close
          </button>
        ) : null}
      </div>
    ) : null;
  const boardContent = (
    <>
      {showSetupForm && setupForm ? (
        <div
          className={cn(
            "rounded-md border bg-slate-50 p-2 shadow-sm",
            isEditingMode ? "border-[var(--accent)]" : "border-slate-200",
          )}
        >
          {isEditingMode ? (
            <div className="mb-2 flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--accent-border)] bg-white px-2.5 py-2">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--accent-strong)]">
                  Editing saved strategy
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-600">
                  Setup changes will be saved with this strategy.
                </p>
              </div>
              <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-semibold text-white">
                Edit mode
              </span>
            </div>
          ) : null}
          {setupForm}
        </div>
      ) : null}

      {isEditorOpen ? (
        <>
          <div className={cn("rounded-md border border-slate-200 bg-slate-50 p-2 shadow-sm", showSetupForm && setupForm && "mt-2")}>
            {isEditingMode ? (
              <div className="mb-2 flex min-w-0 flex-wrap items-center gap-2 rounded-md border border-[var(--accent-border)] bg-[var(--accent-faint)] px-2.5 py-2 text-xs font-semibold text-[var(--accent-strong)]">
                Editing existing strategy
              </div>
            ) : null}
            <div className="grid min-w-0 gap-x-2 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-6 xl:grid-cols-[minmax(13rem,1.35fr)_minmax(12rem,1fr)_minmax(8rem,0.75fr)_minmax(8rem,0.75fr)_minmax(8rem,0.75fr)_minmax(6.5rem,0.55fr)_max-content]">
              <label className="block min-w-0 sm:col-span-2 lg:col-span-2 xl:col-span-1">
                <span className="text-xs font-medium text-slate-500">Strategy name</span>
                <input
                  type="text"
                  value={draft.label}
                  placeholder={getCustomComparisonLabel({ ...draft, label: "" })}
                  onChange={(event) =>
                    onDraftChange({ ...draft, label: event.target.value })
                  }
                  className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1 text-sm font-medium text-slate-950 shadow-sm outline-none placeholder:text-slate-400 focus:border-[var(--accent)]"
                />
              </label>

              <label className="block min-w-0 lg:col-span-2 xl:col-span-1">
                <span className="text-xs font-medium text-slate-500">Strategy type</span>
                <select
                  value={draft.strategy}
                  onChange={(event) => {
                    const nextStrategy = event.target.value as OptionStrategy;
                    const nextDraftStrikes = getDefaultStrikesForStrategy(
                      nextStrategy,
                      currentSpot,
                      {
                        expirationDays: draft.expirationDays,
                        volatilityPct: draft.volatilityPct ?? currentVolatilityPct,
                        ratioShortCount: draft.ratioShortCount,
                        ratePct: draft.ratePct ?? currentRatePct,
                        dividendYieldPct: draft.dividendYieldPct,
                      },
                    );

                    onDraftChange({
                      ...draft,
                      strategy: nextStrategy,
                      spot: currentSpot,
                      longStrike: nextDraftStrikes.longStrike,
                      shortStrike: nextDraftStrikes.shortStrike,
                      shortExpirationDays:
                        nextStrategy === "call-calendar" &&
                        draft.strategy !== "call-calendar"
                          ? getDefaultCallCalendarShortExpirationDays(
                              draft.expirationDays,
                            )
                          : normalizeCallCalendarShortExpirationDays(
                              draft.shortExpirationDays,
                              draft.expirationDays,
                            ),
                    });
                  }}
                  className="mt-0.5 h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1 text-sm font-medium text-slate-950 shadow-sm outline-none focus:border-[var(--accent)] focus:outline-2 focus:outline-offset-2 focus:outline-[var(--accent)]"
                >
                  {STRATEGY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              {isRatioSpreadDraft ? (
                <div className="min-w-0 lg:col-span-2 xl:col-span-1">
                  <CompactNumberInput
                    label="Ratio"
                    value={normalizePutRatioShortCount(draft.ratioShortCount)}
                    min={PUT_RATIO_SHORT_COUNT_MIN}
                    step={1}
                    prefix="1 / "
                    suffix={isPutRatioSpreadDraft ? " short puts" : " short calls"}
                    onChange={(nextValue) =>
                      onDraftChange({
                        ...draft,
                        ratioShortCount: normalizePutRatioShortCount(nextValue),
                      })
                    }
                  />
                </div>
              ) : null}

              <CompactNumberInput
                label={
                    isSpreadDraft
                      ? isPutSpreadDraft
                        ? "Long put"
                        : isCallCalendarDraft
                          ? "Call strike"
                          : "Long call"
                      : draft.strategy === "bear-put"
                        ? "Put strike"
                        : "Call strike"
                }
                value={draft.longStrike}
                min={1}
                step={0.01}
                allowDecimals
                prefix="$"
                className="lg:col-span-1 xl:col-span-1"
                onChange={(nextValue) => {
                  const nextLongStrike = normalizeStrikeValue(nextValue);

                  onDraftChange({
                    ...draft,
                    longStrike: nextLongStrike,
                    shortStrike: isPutDownsideStrategy(draft.strategy)
                      ? draft.shortStrike
                      : normalizeShortStrikeForStrategy(
                          draft.strategy,
                          nextLongStrike,
                          draft.shortStrike,
                        ),
                  });
                }}
              />

              {isSpreadDraft && !isCallCalendarDraft ? (
                <CompactNumberInput
                  label={
                    isPutRatioSpreadDraft
                      ? "Short puts"
                      : isCallRatioSpreadDraft
                        ? "Short calls"
                      : isPutSpreadDraft
                        ? "Short put"
                        : "Short call"
                  }
                  value={draft.shortStrike}
                  min={1}
                  step={0.01}
                  allowDecimals
                  prefix="$"
                  className="lg:col-span-1 xl:col-span-1"
                  onChange={(nextValue) =>
                    onDraftChange({
                      ...draft,
                      shortStrike: isPutDownsideStrategy(draft.strategy)
                        ? normalizeStrikeValue(nextValue)
                        : normalizeShortStrikeForStrategy(
                            draft.strategy,
                            draft.longStrike,
                            nextValue,
                          ),
                    })
                  }
                />
              ) : null}

              {isCallCalendarDraft ? (
                <CompactNumberInput
                  label="Short DTE"
                  value={normalizeCallCalendarShortExpirationDays(
                    draft.shortExpirationDays,
                    draft.expirationDays,
                  )}
                  min={0}
                  max={Math.max(0, Math.round(draft.expirationDays) - 1)}
                  suffix="d"
                  step={1}
                  className="lg:col-span-1 xl:col-span-1"
                  onChange={(nextValue) =>
                    onDraftChange({
                      ...draft,
                      shortExpirationDays: normalizeCallCalendarShortExpirationDays(
                        nextValue,
                        draft.expirationDays,
                      ),
                    })
                  }
                />
              ) : null}

              <CompactNumberInput
                label="Capital"
                value={draft.capital}
                min={0}
                prefix="$"
                displayScale={moneyDisplayUnitScale}
                displaySuffix={moneyDisplayUnitSuffix}
                step={100}
                className="lg:col-span-2 xl:col-span-1"
                onChange={(nextValue) =>
                  onDraftChange({ ...draft, capital: Math.max(0, nextValue) })
                }
              />

              <CompactNumberInput
                label="DTE"
                value={draft.expirationDays}
                min={1}
                suffix="d"
                step={1}
                className="lg:col-span-1 xl:col-span-1"
                onChange={(nextValue) => {
                  const nextExpirationDays = clamp(Math.round(nextValue), 1, 1095);

                  onDraftChange({
                    ...draft,
                    expirationDays: nextExpirationDays,
                    shortExpirationDays: normalizeCallCalendarShortExpirationDays(
                      draft.shortExpirationDays,
                      nextExpirationDays,
                    ),
                  });
                }}
              />

              <label className="flex min-h-8 min-w-0 items-center gap-2 self-end rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 shadow-sm lg:col-span-1 xl:col-span-1">
                <input
                  type="checkbox"
                  checked={draft.allowFractionalContracts}
                  onChange={(event) =>
                    onDraftChange({
                      ...draft,
                      allowFractionalContracts: event.target.checked,
                    })
                  }
                  className="size-4 accent-[var(--accent)]"
                />
                <span>Fractional</span>
              </label>
            </div>
          </div>

          <RatioCreditSummary snapshot={draftSnapshot} />
          {draftError ? (
            <p className="mt-2 text-sm font-medium text-rose-700">{draftError}</p>
          ) : null}
        </>
      ) : null}

      {showSummary ? (
        <div className={isEditorOpen || (showSetupForm && setupForm) ? "mt-3" : undefined}>
          {cards.length > 0 ? (
            embedded ? (
              <CompactStrategyList
                cards={cards}
                editingCardId={editingComparisonId}
                selectedCardId={selectedCardId}
                onAnalyzeCard={onAnalyzeCard}
                onEditCard={onEditComparison}
                onRemoveCard={onRemoveComparison}
                onReorderCards={onReorderComparisons}
              />
            ) : (
              <ComparisonCardGrid
                cards={cards}
                prioritizeSelected
                selectedCardId={selectedCardId}
                onRemoveCard={onRemoveComparison}
              />
            )
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
              Add a strategy to compare it against the selected scenario.
            </div>
          )}
        </div>
      ) : null}
    </>
  );

  if (embedded) {
    return (
      <div id="strategy-shelf" className="min-w-0 space-y-2">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-[family:var(--font-space-grotesk)] text-sm font-semibold text-slate-950 text-balance">
              Saved strategies
            </h3>
          </div>
          {actionContent}
        </div>
        {boardContent}
      </div>
    );
  }

  return (
    <SectionCard
      title="Saved strategies"
      eyebrow={`${symbol.trim() || "Underlying"} comparison at ${formatCurrency(
        scenarioPrice,
      )} on ${scenarioDateLabel}`}
      action={actionContent}
    >
      {boardContent}
    </SectionCard>
  );
}
