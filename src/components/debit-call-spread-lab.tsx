"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import DebitSpreadScenarioVisualizer from "@/components/debit-spread-scenario-visualizer";
import AiHelp from "@/components/ai-help";
import { cn } from "@/lib/cn";
import type { IvComparisonInstrument } from "@/lib/iv-comparison";
import {
  CONTRACT_MULTIPLIER,
  PUT_RATIO_SHORT_COUNT_MAX,
  PUT_RATIO_SHORT_COUNT_MIN,
  addDaysToIso,
  buildPriceLadderRows,
  buildTimelineRows,
  clamp,
  createScenarioSnapshot,
  daysBetween,
  formatLongDate,
  getDefaultCallCalendarShortExpirationDays,
  normalizeCallCalendarShortExpirationDays,
  normalizePutRatioShortCount,
  roundTo,
} from "@/lib/debit-call-spread";
import type { OptionStrategy, StrategyInputs } from "@/lib/debit-call-spread";
import { ActiveSetupStrip } from "@/components/lab/active-setup-strip";
import { CompactNumberInput } from "@/components/lab/compact-number-input";
import {
  applyComparisonToInputs,
  buildComparisonCard,
  formatBreakEvenAtExpiry,
  getBreakEvenLabel,
  getComparisonStrikeLabel,
  getCustomComparisonLabel,
  getNonPositiveEntryDebitMessage,
  isGeneratedCustomComparisonLabel,
} from "@/components/lab/comparison-helpers";
import {
  COLOR_SCHEME_STORAGE_KEY,
  DEFAULT_DECISION_COMPARISON_VIEW,
  DEFAULT_SCENARIO_GRAPH_VIEW,
  DEFAULT_SPOT,
  DEFAULT_WORKFLOW_TAB,
  INITIAL_IV_MODE_STORAGE_KEY,
  MONEY_DISPLAY_UNIT_STORAGE_KEY,
  STRATEGY_COPY,
  STRATEGY_OPTIONS,
  STRIKE_DECIMAL_DIGITS,
  TOP_BAR_HOVER_HIDE_Y,
  TOP_BAR_HOVER_REVEAL_HEIGHT,
  TOP_BAR_REVEAL_SCROLL_TOP,
  TOP_BAR_SCROLL_DELTA,
  UPDATE_STRIKES_WITH_PRICE_STORAGE_KEY,
  WORKSPACE_RESTORE_FALLBACK_MS,
  WORKSPACE_RESTORE_RETRY_DELAYS_MS,
} from "@/components/lab/constants";
import {
  CustomComparisonBoard,
} from "@/components/lab/custom-comparison-board";
import {
  DecisionComparisonBoard,
} from "@/components/lab/decision-comparison-board";
import {
  compactNumber,
  formatCurrency,
  formatCurrencyWithCents,
  formatPercent,
  formatPriceCurrency,
  formatStrikeCurrency,
  getMoneyDisplayUnitScale,
  getMoneyDisplayUnitSuffix,
  setActiveMoneyDisplayUnit,
} from "@/components/lab/format";
import { InfoIcon } from "@/components/lab/info-icon";
import {
  blurFocusedField,
  getRangeTrackStyle,
  getScenarioPriceSliderMax,
  getSliderMax,
  parseDecimalInput,
} from "@/components/lab/input-helpers";
import { NumberSliderField } from "@/components/lab/number-slider-field";
import { RatioCreditSummary } from "@/components/lab/ratio-credit-summary";
import { ResultsTable } from "@/components/lab/results-table";
import { SectionCard } from "@/components/lab/section-card";
import { SettingsWidget } from "@/components/lab/settings-widget";
import {
  clearAppUrlState,
  decodeColorScheme,
  decodeMoneyDisplayUnit,
  getCustomComparisonCounterSeed,
  getDecisionComparisonViewFromUrl,
  getLatestCreatedCustomComparison,
  getMarketScenarioMaxDte,
  getSavedStrategyDteKey,
  getShareStateFromUrl,
  getStoredCustomComparisons,
  getStoredShareState,
  getWorkflowTabFromUrl,
  storeCustomComparisons,
  storeShareState,
} from "@/components/lab/share-state";
import {
  getDefaultStrikesForStrategy,
  getNearCallShortStrike,
  getOtmPutStrike,
  getOtmStrike,
  isCallCalendarStrategy,
  isDebitSpreadStrategy,
  isPutDownsideStrategy,
  isPutOptionStrategy,
  isRatioSpreadStrategy,
  normalizeCapitalValue,
  normalizePriceValue,
  normalizeShortStrikeForStrategy,
  normalizeStrikeValue,
  normalizeSymbol,
} from "@/components/lab/strategy-helpers";
import { TimeDecayChart } from "@/components/lab/time-decay-chart";
import type { TimeDecayPoint } from "@/components/lab/time-decay-chart";
import type {
  ColorScheme,
  ComparisonCandidate,
  ComparisonCardData,
  ComparisonPanelMode,
  CustomComparisonConfig,
  CustomComparisonDraft,
  DecisionComparisonView,
  GraphComparisonOption,
  IvAlternativeStrategy,
  MoneyDisplayUnit,
  PriceTableRow,
  ScenarioGraphView,
  TableColumn,
  TimelineTableRow,
  ValuationDateInputMode,
  WorkflowTab,
} from "@/components/lab/types";
import { UnderstandingIvTool } from "@/components/lab/understanding-iv-tool";
import { WorkflowTabs } from "@/components/lab/workflow-tabs";

type DebitCallSpreadLabProps = {
  todayIso: string;
  defaultExpiryIso: string;
  children?: ReactNode;
};

export default function DebitCallSpreadLab({
  todayIso,
  defaultExpiryIso,
  children,
}: DebitCallSpreadLabProps) {
  const defaultExpirationDays = Math.max(1, daysBetween(todayIso, defaultExpiryIso));
  const [strategy, setStrategy] = useState<OptionStrategy>("debit-call-spread");
  const [symbol, setSymbol] = useState("NVDA");
  const [spot, setSpot] = useState(DEFAULT_SPOT);
  const [volatilityPct, setVolatilityPct] = useState(50);
  const [futureVolatilityPct, setFutureVolatilityPct] = useState(50);
  const [useInitialIvForStrategies, setUseInitialIvForStrategies] =
    useState(false);
  const [longStrike, setLongStrike] = useState(DEFAULT_SPOT);
  const [shortStrike, setShortStrike] = useState(() =>
    getNearCallShortStrike(DEFAULT_SPOT),
  );
  const [putRatioShortCount, setPutRatioShortCount] = useState(2);
  const [capital, setCapital] = useState(10000);
  const [allowFractionalContracts, setAllowFractionalContracts] =
    useState(false);
  const [ratePct, setRatePct] = useState(4);
  const [ratePctDraft, setRatePctDraft] = useState("4");
  const [expirationDays, setExpirationDays] = useState(defaultExpirationDays);
  const [shortExpirationDays, setShortExpirationDays] = useState(() =>
    getDefaultCallCalendarShortExpirationDays(defaultExpirationDays),
  );
  const [scenarioPrice, setScenarioPrice] = useState(DEFAULT_SPOT);
  const [calendarShortPrice, setCalendarShortPrice] = useState(DEFAULT_SPOT);
  const [scenarioPriceDraft, setScenarioPriceDraft] = useState<string | null>(
    null,
  );
  const [calendarShortPriceDraft, setCalendarShortPriceDraft] = useState<string | null>(
    null,
  );
  const [valuationDteDraft, setValuationDteDraft] = useState<string | null>(
    null,
  );
  const [valuationDateInputMode, setValuationDateInputMode] =
    useState<ValuationDateInputMode>("elapsed");
  const [scenarioGraphView, setScenarioGraphView] =
    useState<ScenarioGraphView>(DEFAULT_SCENARIO_GRAPH_VIEW);
  const [scenarioOffsetDays, setScenarioOffsetDays] = useState(
    Math.round(defaultExpirationDays / 2),
  );
  const [isUrlStateReady, setIsUrlStateReady] = useState(false);
  const [comparisonPanelMode, setComparisonPanelMode] =
    useState<ComparisonPanelMode>("presets");
  const [customComparisons, setCustomComparisons] = useState<
    CustomComparisonConfig[]
  >([]);
  const hasInitializedSavedStrategyDteSyncRef = useRef(false);
  const previousSavedStrategyDteKeyRef = useRef("");
  const pendingScenarioOffsetAfterStrategyChangeRef = useRef<number | null>(
    null,
  );
  const [isCustomComparisonEditorOpen, setIsCustomComparisonEditorOpen] =
    useState(false);
  const [editingComparisonId, setEditingComparisonId] = useState<string | null>(
    null,
  );
  const [showDetailedTables, setShowDetailedTables] = useState(false);
  const [activeWorkflowTab, setActiveWorkflowTab] =
    useState<WorkflowTab>(DEFAULT_WORKFLOW_TAB);
  const [decisionComparisonView, setDecisionComparisonView] =
    useState<DecisionComparisonView>(DEFAULT_DECISION_COMPARISON_VIEW);
  const [colorScheme, setColorScheme] = useState<ColorScheme>("blue");
  const [moneyDisplayUnit, setMoneyDisplayUnit] =
    useState<MoneyDisplayUnit>("dollars");
  const [updateStrikesWithPrice, setUpdateStrikesWithPrice] = useState(true);
  const [isCoreSetupOpen, setIsCoreSetupOpen] = useState(false);
  const [isSetupFormVisible, setIsSetupFormVisible] = useState(false);
  const [isMarketScenarioOpen, setIsMarketScenarioOpen] = useState(false);
  const initialDraftStrikes = getDefaultStrikesForStrategy(
    "debit-call-spread",
    spot,
  );
  const [customDraft, setCustomDraft] = useState<CustomComparisonDraft>({
    label: "",
    strategy: "debit-call-spread",
    spot,
    longStrike: initialDraftStrikes.longStrike,
    shortStrike: initialDraftStrikes.shortStrike,
    ratioShortCount: putRatioShortCount,
    shortExpirationDays,
    capital,
    expirationDays,
    allowFractionalContracts,
  });
  const customComparisonIdCounter = useRef(0);
  const hasLoadedColorScheme = useRef(false);
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const lastScrollTopRef = useRef(0);
  const topBarHoverHideTimerRef = useRef<number | null>(null);
  const [graphComparisonId, setGraphComparisonId] = useState("editor");
  const [isTopBarPinnedVisible, setIsTopBarPinnedVisible] = useState(true);
  const [isTopBarHoverRevealed, setIsTopBarHoverRevealed] = useState(false);
  const isDebitCallSpread = strategy === "debit-call-spread";
  const isCallRatioSpread = strategy === "call-ratio-spread";
  const isCallCalendar = strategy === "call-calendar";
  const isDebitPutSpread = strategy === "debit-put-spread";
  const isBullPutSpread = strategy === "bull-put-spread";
  const isBearPut = strategy === "bear-put";
  const isPutRatioSpread = strategy === "put-ratio-spread";
  const isRatioSpread = isRatioSpreadStrategy(strategy);
  const isPutDownsideSpread = isPutDownsideStrategy(strategy);
  const isPutSpread = isPutOptionStrategy(strategy);
  const isDebitSpread = isDebitSpreadStrategy(strategy);
  const strategyCopy = STRATEGY_COPY[strategy];
  const upperStrike =
    isDebitCallSpread || isCallRatioSpread || isBullPutSpread
      ? shortStrike
      : longStrike;

  setActiveMoneyDisplayUnit(moneyDisplayUnit);
  const moneyDisplayUnitScale = getMoneyDisplayUnitScale(moneyDisplayUnit);
  const moneyDisplayUnitSuffix = getMoneyDisplayUnitSuffix(moneyDisplayUnit);

  const scenarioPriceSliderMin = Math.max(1, Math.floor(spot * 0.2));
  const scenarioPriceSliderMax = Math.max(
    scenarioPriceSliderMin,
    getScenarioPriceSliderMax(spot, scenarioPrice),
  );
  const calendarShortPriceSliderMax = Math.max(
    scenarioPriceSliderMin,
    getScenarioPriceSliderMax(spot, calendarShortPrice),
  );
  const safeScenarioPrice = normalizePriceValue(
    clamp(scenarioPrice, scenarioPriceSliderMin, scenarioPriceSliderMax),
  );
  const safeCalendarShortPrice = normalizePriceValue(
    clamp(
      calendarShortPrice,
      scenarioPriceSliderMin,
      calendarShortPriceSliderMax,
    ),
  );
  const scenarioPriceInputValue =
    Number.isFinite(scenarioPrice) &&
    (scenarioPrice < scenarioPriceSliderMin || scenarioPrice > scenarioPriceSliderMax)
      ? normalizePriceValue(scenarioPrice)
      : safeScenarioPrice;
  const calendarShortPriceInputValue =
    Number.isFinite(calendarShortPrice) &&
    (calendarShortPrice < scenarioPriceSliderMin ||
      calendarShortPrice > calendarShortPriceSliderMax)
      ? normalizePriceValue(calendarShortPrice)
      : safeCalendarShortPrice;
  const displayedCalendarShortPriceInputValue =
    calendarShortPriceDraft ?? String(calendarShortPriceInputValue);
  const currentPriceSliderMax = getSliderMax(
    spot,
    safeScenarioPrice,
    longStrike,
    upperStrike,
  );
  const baseStrikeSliderMax = getSliderMax(
    spot,
    safeScenarioPrice,
    longStrike,
    upperStrike,
  );
  const longStrikeSliderMax = Math.max(
    baseStrikeSliderMax,
    isDebitCallSpread || isCallRatioSpread ? shortStrike + 20 : longStrike + 20,
  );
  const shortStrikeSliderMax = isPutDownsideSpread
    ? Math.max(5, longStrike - 1)
    : Math.max(baseStrikeSliderMax + 20, longStrike + 5);
  const expiryIso = addDaysToIso(todayIso, expirationDays);
  const savedStrategyDteKey = useMemo(
    () => getSavedStrategyDteKey(customComparisons),
    [customComparisons],
  );
  const marketScenarioMaxOffsetDays = useMemo(
    () => getMarketScenarioMaxDte(customComparisons, expirationDays),
    [customComparisons, expirationDays],
  );
  const marketScenarioMaxDateIso = addDaysToIso(todayIso, marketScenarioMaxOffsetDays);
  const safeScenarioOffsetDays = clamp(
    scenarioOffsetDays,
    0,
    marketScenarioMaxOffsetDays,
  );
  const marketScenarioDateIso = addDaysToIso(todayIso, safeScenarioOffsetDays);
  const marketScenarioDte = Math.max(
    0,
    marketScenarioMaxOffsetDays - safeScenarioOffsetDays,
  );
  const valuationDateInputValue =
    valuationDateInputMode === "elapsed"
      ? Math.max(0, Math.round(safeScenarioOffsetDays))
      : Math.max(0, Math.round(marketScenarioDte));
  const displayedValuationDteInputValue =
    valuationDteDraft ?? String(valuationDateInputValue);
  const safeCalendarShortExpirationDays = normalizeCallCalendarShortExpirationDays(
    shortExpirationDays,
    expirationDays,
  );
  const selectedCalendarConfig = graphComparisonId.startsWith("custom:")
    ? customComparisons.find(
        (comparison) =>
          comparison.id === graphComparisonId.slice("custom:".length) &&
          comparison.strategy === "call-calendar",
      ) ?? null
    : null;
  const firstSavedCalendarConfig =
    customComparisons.find(
      (comparison) => comparison.strategy === "call-calendar",
    ) ?? null;
  const isSelectedCalendarPreset =
    graphComparisonId === "preset:call-calendar-atm";
  const calendarReferenceConfig =
    selectedCalendarConfig ?? firstSavedCalendarConfig;
  const calendarReferenceShortExpirationDays = selectedCalendarConfig
    ? normalizeCallCalendarShortExpirationDays(
        selectedCalendarConfig.shortExpirationDays,
        selectedCalendarConfig.expirationDays,
      )
    : isCallCalendar
      ? safeCalendarShortExpirationDays
      : isSelectedCalendarPreset
        ? getDefaultCallCalendarShortExpirationDays(expirationDays)
        : calendarReferenceConfig
          ? normalizeCallCalendarShortExpirationDays(
              calendarReferenceConfig.shortExpirationDays,
              calendarReferenceConfig.expirationDays,
            )
          : safeCalendarShortExpirationDays;
  const shouldShowCalendarShortPrice =
    isCallCalendar ||
    isSelectedCalendarPreset ||
    firstSavedCalendarConfig !== null;
  const calendarReferenceTodayIso =
    selectedCalendarConfig?.todayIso ??
    (isCallCalendar || isSelectedCalendarPreset
      ? todayIso
      : calendarReferenceConfig?.todayIso ?? todayIso);
  const calendarShortExpiryDateIso = addDaysToIso(
    calendarReferenceTodayIso,
    calendarReferenceShortExpirationDays,
  );
  const effectiveScenarioPrice = safeScenarioPrice;
  const effectiveScenarioPriceInputValue = scenarioPriceInputValue;
  const displayedScenarioPriceInputValue =
    scenarioPriceDraft ?? String(effectiveScenarioPriceInputValue);

  useEffect(() => {
    let isActive = true;

    queueMicrotask(() => {
      if (!isActive || typeof window === "undefined") {
        return;
      }

      hasLoadedColorScheme.current = true;
      setColorScheme(decodeColorScheme(window.localStorage.getItem(COLOR_SCHEME_STORAGE_KEY)));
      setMoneyDisplayUnit(
        decodeMoneyDisplayUnit(
          window.localStorage.getItem(MONEY_DISPLAY_UNIT_STORAGE_KEY),
        ),
      );
      setUseInitialIvForStrategies(
        window.localStorage.getItem(INITIAL_IV_MODE_STORAGE_KEY) === "1",
      );
      setUpdateStrikesWithPrice(
        window.localStorage.getItem(UPDATE_STRIKES_WITH_PRICE_STORAGE_KEY) !==
          "0",
      );
    });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!hasLoadedColorScheme.current) {
      return;
    }

    window.localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, colorScheme);
    window.localStorage.setItem(MONEY_DISPLAY_UNIT_STORAGE_KEY, moneyDisplayUnit);
    window.localStorage.setItem(
      INITIAL_IV_MODE_STORAGE_KEY,
      useInitialIvForStrategies ? "1" : "0",
    );
    window.localStorage.setItem(
      UPDATE_STRIKES_WITH_PRICE_STORAGE_KEY,
      updateStrikesWithPrice ? "1" : "0",
    );
  }, [
    colorScheme,
    moneyDisplayUnit,
    updateStrikesWithPrice,
    useInitialIvForStrategies,
  ]);

  useEffect(() => {
    let isActive = true;
    let didFinishRestore = false;
    const restoreTimeouts: number[] = [];
    const markReady = () => {
      if (isActive && !didFinishRestore) {
        didFinishRestore = true;
        setIsUrlStateReady(true);
      }
    };
    const restoreWorkspace = (attemptIndex: number) => {
      if (!isActive || didFinishRestore || typeof window === "undefined") {
        return;
      }

      try {
        const urlState = getShareStateFromUrl(defaultExpirationDays);
        const storedState = urlState ? null : getStoredShareState(defaultExpirationDays);
        const initialState = urlState ?? storedState;
        const storedCustomComparisons = initialState ? [] : getStoredCustomComparisons();
        const explicitWorkflowTab = getWorkflowTabFromUrl();
        const explicitDecisionComparisonView = getDecisionComparisonViewFromUrl();

        if (initialState) {
          setStrategy(initialState.strategy);
          setSymbol(initialState.symbol);
          setSpot(initialState.spot);
          setVolatilityPct(initialState.volatilityPct);
          setFutureVolatilityPct(initialState.futureVolatilityPct);
          setLongStrike(initialState.longStrike);
          setShortStrike(initialState.shortStrike);
          setPutRatioShortCount(normalizePutRatioShortCount(initialState.ratioShortCount));
          setShortExpirationDays(
            normalizeCallCalendarShortExpirationDays(
              initialState.shortExpirationDays,
              initialState.expirationDays,
            ),
          );
          setCapital(initialState.capital);
          setAllowFractionalContracts(initialState.allowFractionalContracts);
          setExpirationDays(initialState.expirationDays);
          setScenarioPrice(initialState.scenarioPrice);
          setScenarioPriceDraft(null);
          setCalendarShortPrice(initialState.calendarShortPrice);
          setCalendarShortPriceDraft(null);
          setScenarioGraphView(initialState.scenarioGraphView);
          setScenarioOffsetDays(initialState.scenarioOffsetDays);
          setValuationDteDraft(null);
          setRatePct(initialState.ratePct);
          setRatePctDraft(compactNumber(initialState.ratePct));
          setComparisonPanelMode(initialState.comparisonPanelMode);
          setCustomComparisons(initialState.customComparisons);
          customComparisonIdCounter.current = getCustomComparisonCounterSeed(
            initialState.customComparisons,
          );
          setGraphComparisonId(initialState.graphComparisonId);
          setActiveWorkflowTab(initialState.workflowTab);
        } else if (storedCustomComparisons.length > 0) {
          setCustomComparisons(storedCustomComparisons);
          customComparisonIdCounter.current = getCustomComparisonCounterSeed(
            storedCustomComparisons,
          );
          setComparisonPanelMode("custom");
        }

        if (explicitWorkflowTab) {
          setActiveWorkflowTab(explicitWorkflowTab);
        }

        if (explicitDecisionComparisonView) {
          setDecisionComparisonView(explicitDecisionComparisonView);
        }

        if (urlState || explicitWorkflowTab || explicitDecisionComparisonView) {
          clearAppUrlState();
        }

        markReady();
      } catch (error) {
        const nextAttemptIndex = attemptIndex + 1;

        if (nextAttemptIndex < WORKSPACE_RESTORE_RETRY_DELAYS_MS.length) {
          restoreTimeouts.push(
            window.setTimeout(
              () => restoreWorkspace(nextAttemptIndex),
              WORKSPACE_RESTORE_RETRY_DELAYS_MS[nextAttemptIndex],
            ),
          );
          return;
        }

        console.warn("Callculator could not restore the saved workspace.", error);
        markReady();
      }
    };

    restoreWorkspace(0);

    const handlePageShow = () => {
      restoreWorkspace(0);
    };

    window.addEventListener("pageshow", handlePageShow);
    restoreTimeouts.push(window.setTimeout(markReady, WORKSPACE_RESTORE_FALLBACK_MS));

    return () => {
      isActive = false;
      window.removeEventListener("pageshow", handlePageShow);
      restoreTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, [defaultExpirationDays]);

  useEffect(() => {
    if (!isUrlStateReady) {
      return;
    }

    storeCustomComparisons(customComparisons);
  }, [customComparisons, isUrlStateReady]);

  useEffect(() => {
    if (!isUrlStateReady) {
      previousSavedStrategyDteKeyRef.current = savedStrategyDteKey;
      return;
    }

    if (!hasInitializedSavedStrategyDteSyncRef.current) {
      hasInitializedSavedStrategyDteSyncRef.current = true;
      previousSavedStrategyDteKeyRef.current = savedStrategyDteKey;
      return;
    }

    if (previousSavedStrategyDteKeyRef.current === savedStrategyDteKey) {
      return;
    }

    previousSavedStrategyDteKeyRef.current = savedStrategyDteKey;
    setValuationDteDraft(null);
    const requestedOffset = pendingScenarioOffsetAfterStrategyChangeRef.current;
    setScenarioOffsetDays((currentDays) =>
      clamp(requestedOffset ?? currentDays, 0, marketScenarioMaxOffsetDays),
    );
    pendingScenarioOffsetAfterStrategyChangeRef.current = null;
  }, [isUrlStateReady, marketScenarioMaxOffsetDays, savedStrategyDteKey]);

  useEffect(() => {
    if (!isUrlStateReady) {
      return;
    }

    storeShareState({
      strategy,
      symbol,
      spot,
      volatilityPct,
      futureVolatilityPct,
      longStrike,
      shortStrike,
      ratioShortCount: putRatioShortCount,
      shortExpirationDays,
      capital,
      allowFractionalContracts,
      expirationDays,
      scenarioPrice: effectiveScenarioPrice,
      calendarShortPrice: safeCalendarShortPrice,
      scenarioOffsetDays: safeScenarioOffsetDays,
      ratePct,
      scenarioGraphView,
      comparisonPanelMode,
      customComparisons,
      graphComparisonId,
      workflowTab: activeWorkflowTab,
    });
  }, [
    allowFractionalContracts,
    capital,
    comparisonPanelMode,
    customComparisons,
    expirationDays,
    futureVolatilityPct,
    graphComparisonId,
    activeWorkflowTab,
    longStrike,
    putRatioShortCount,
    ratePct,
    safeScenarioOffsetDays,
    safeCalendarShortPrice,
    effectiveScenarioPrice,
    scenarioGraphView,
    shortExpirationDays,
    shortStrike,
    spot,
    strategy,
    symbol,
    volatilityPct,
    isUrlStateReady,
  ]);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;

    if (!scrollContainer || typeof window === "undefined") {
      return;
    }

    let animationFrame = 0;
    lastScrollTopRef.current = scrollContainer.scrollTop;

    const updateTopBarVisibility = () => {
      const nextScrollTop = Math.max(scrollContainer.scrollTop, 0);
      const scrollDelta = nextScrollTop - lastScrollTopRef.current;

      if (nextScrollTop <= TOP_BAR_REVEAL_SCROLL_TOP) {
        setIsTopBarPinnedVisible(true);
        setIsTopBarHoverRevealed(false);
      } else if (scrollDelta > TOP_BAR_SCROLL_DELTA) {
        setIsTopBarPinnedVisible(false);
        setIsTopBarHoverRevealed(false);
      } else if (scrollDelta < -TOP_BAR_SCROLL_DELTA) {
        setIsTopBarPinnedVisible(true);
      }

      lastScrollTopRef.current = nextScrollTop;
      animationFrame = 0;
    };

    const handleScroll = () => {
      if (animationFrame !== 0) {
        return;
      }

      animationFrame = window.requestAnimationFrame(updateTopBarVisibility);
    };

    scrollContainer.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      scrollContainer.removeEventListener("scroll", handleScroll);

      if (animationFrame !== 0) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  }, [isUrlStateReady]);

  useEffect(() => {
    return () => {
      if (topBarHoverHideTimerRef.current !== null) {
        window.clearTimeout(topBarHoverHideTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      if (event.pointerType !== "mouse") {
        return;
      }

      if (isTopBarPinnedVisible) {
        return;
      }

      if (event.clientY <= TOP_BAR_HOVER_REVEAL_HEIGHT) {
        if (topBarHoverHideTimerRef.current !== null) {
          window.clearTimeout(topBarHoverHideTimerRef.current);
          topBarHoverHideTimerRef.current = null;
        }

        setIsTopBarHoverRevealed(true);
        return;
      }

      if (isTopBarHoverRevealed && event.clientY > TOP_BAR_HOVER_HIDE_Y) {
        setIsTopBarHoverRevealed(false);
      }
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
    };
  }, [isTopBarHoverRevealed, isTopBarPinnedVisible]);

  const revealTopBarFromEdge = () => {
    if (topBarHoverHideTimerRef.current !== null) {
      window.clearTimeout(topBarHoverHideTimerRef.current);
      topBarHoverHideTimerRef.current = null;
    }

    setIsTopBarHoverRevealed(true);
  };

  const hideTopBarHoverReveal = () => {
    if ((scrollContainerRef.current?.scrollTop ?? 0) <= TOP_BAR_REVEAL_SCROLL_TOP) {
      return;
    }

    setIsTopBarHoverRevealed(false);
  };

  const queueTopBarHoverRevealHide = () => {
    if (topBarHoverHideTimerRef.current !== null) {
      window.clearTimeout(topBarHoverHideTimerRef.current);
    }

    topBarHoverHideTimerRef.current = window.setTimeout(() => {
      topBarHoverHideTimerRef.current = null;
      hideTopBarHoverReveal();
    }, 180);
  };

  const updateSpot = (nextValue: number) => {
    const nextSpot = normalizePriceValue(nextValue);
    const nextDefaultStrikes = getDefaultStrikesForStrategy(strategy, nextSpot, {
      expirationDays,
      volatilityPct,
      ratioShortCount: putRatioShortCount,
      ratePct,
    });

    setSpot(nextSpot);
    if (updateStrikesWithPrice) {
      setLongStrike(nextDefaultStrikes.longStrike);
      setShortStrike(nextDefaultStrikes.shortStrike);
    }
    setCustomDraft((currentDraft) => {
      if (!updateStrikesWithPrice) {
        return {
          ...currentDraft,
          spot: nextSpot,
        };
      }

      const nextDraftStrikes = getDefaultStrikesForStrategy(
        currentDraft.strategy,
        nextSpot,
        {
          expirationDays: currentDraft.expirationDays,
          volatilityPct: currentDraft.volatilityPct ?? volatilityPct,
          ratioShortCount: currentDraft.ratioShortCount,
          ratePct: currentDraft.ratePct ?? ratePct,
          dividendYieldPct: currentDraft.dividendYieldPct,
        },
      );

      return {
        ...currentDraft,
        spot: nextSpot,
        longStrike: nextDraftStrikes.longStrike,
        shortStrike: nextDraftStrikes.shortStrike,
      };
    });
  };
  const updateVolatilityPct = (nextValue: number) => {
    setVolatilityPct(nextValue);
    setFutureVolatilityPct(nextValue);
  };
  const syncMarketScenarioDteRange = (
    comparisons: CustomComparisonConfig[],
    nextExpirationDays = expirationDays,
  ) => {
    const nextScenarioMaxOffsetDays = getMarketScenarioMaxDte(
      comparisons,
      nextExpirationDays,
    );

    setValuationDteDraft(null);
    setScenarioOffsetDays((currentDays) =>
      clamp(currentDays, 0, nextScenarioMaxOffsetDays),
    );
  };
  const updateExpirationDays = (nextValue: number) => {
    const nextExpirationDays = clamp(Math.round(nextValue), 0, 1095);

    setExpirationDays(nextExpirationDays);
    setShortExpirationDays((currentDays) =>
      normalizeCallCalendarShortExpirationDays(currentDays, nextExpirationDays),
    );
    setCustomDraft((currentDraft) => ({
      ...currentDraft,
      shortExpirationDays: normalizeCallCalendarShortExpirationDays(
        currentDraft.shortExpirationDays,
        nextExpirationDays,
      ),
    }));
    syncMarketScenarioDteRange(customComparisons, nextExpirationDays);
  };
  const revealScenarioComparisons = () => {
    setComparisonPanelMode((currentMode) =>
      currentMode === "hidden" ? "presets" : currentMode,
    );
  };
  const updateScenarioPrice = (nextValue: number) => {
    revealScenarioComparisons();
    const nextPrice = clamp(
      nextValue,
      scenarioPriceSliderMin,
      scenarioPriceSliderMax,
    );

    setScenarioPrice(nextPrice);
  };
  const updateCalendarShortPrice = (nextValue: number) => {
    revealScenarioComparisons();
    const nextPrice = clamp(
      nextValue,
      scenarioPriceSliderMin,
      calendarShortPriceSliderMax,
    );

    setCalendarShortPrice(nextPrice);
  };
  const updateScenarioOffsetDays = (nextValue: number) => {
    revealScenarioComparisons();
    const nextOffsetDays = clamp(nextValue, 0, marketScenarioMaxOffsetDays);

    setValuationDteDraft(null);
    setScenarioOffsetDays(nextOffsetDays);
  };
  const updateValuationDte = (nextValue: number) => {
    revealScenarioComparisons();
    const normalizedValue = clamp(
      Math.round(nextValue),
      0,
      marketScenarioMaxOffsetDays,
    );
    const nextOffsetDays =
      valuationDateInputMode === "elapsed"
        ? normalizedValue
        : marketScenarioMaxOffsetDays - normalizedValue;

    setScenarioOffsetDays(nextOffsetDays);
  };
  const updateValuationDteDraft = (nextValue: string) => {
    const parsedValue = Number(nextValue);

    setValuationDteDraft(nextValue);

    if (nextValue.trim() && Number.isFinite(parsedValue)) {
      updateValuationDte(parsedValue);
    }
  };
  const commitValuationDteDraft = (nextValue: string) => {
    const parsedValue = Number(nextValue);
    const committedValue = Number.isFinite(parsedValue)
      ? Math.round(parsedValue)
      : valuationDateInputValue;

    updateValuationDte(committedValue);
    setValuationDteDraft(null);
  };
  const updateValuationDateInputMode = (
    nextMode: ValuationDateInputMode,
  ) => {
    setValuationDteDraft(null);
    setValuationDateInputMode(nextMode);
  };
  const handleValuationDteKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    if (event.key === "Enter") {
      event.currentTarget.blur();
      return;
    }

    if (event.key === "Backspace" && /^\d$/.test(event.currentTarget.value)) {
      event.preventDefault();
      setValuationDteDraft("0");
      updateValuationDte(0);
      return;
    }

    if (/^\d$/.test(event.key) && event.currentTarget.value === "0") {
      event.preventDefault();
      setValuationDteDraft(event.key);
      updateValuationDte(Number(event.key));
    }
  };
  const updateFutureScenarioVolatilityPct = (nextValue: number) => {
    revealScenarioComparisons();
    setFutureVolatilityPct(nextValue);
  };
  const updateScenarioPriceDraft = (nextValue: string) => {
    const parsedValue = Number(nextValue);

    setScenarioPriceDraft(nextValue);

    if (nextValue.trim() && Number.isFinite(parsedValue)) {
      revealScenarioComparisons();
      const nextPrice = normalizePriceValue(parsedValue);

      setScenarioPrice(nextPrice);
    }
  };
  const updateCalendarShortPriceDraft = (nextValue: string) => {
    const parsedValue = Number(nextValue);

    setCalendarShortPriceDraft(nextValue);

    if (nextValue.trim() && Number.isFinite(parsedValue)) {
      revealScenarioComparisons();
      const nextPrice = normalizePriceValue(parsedValue);

      setCalendarShortPrice(nextPrice);
    }
  };
  const commitScenarioPriceDraft = (nextValue: string) => {
    const parsedValue = Number(nextValue);
    const committedValue = Number.isFinite(parsedValue)
      ? normalizePriceValue(parsedValue)
      : effectiveScenarioPrice;

    updateScenarioPrice(committedValue);
    setScenarioPriceDraft(null);
  };
  const commitCalendarShortPriceDraft = (nextValue: string) => {
    const parsedValue = Number(nextValue);
    const committedValue = Number.isFinite(parsedValue)
      ? normalizePriceValue(parsedValue)
      : safeCalendarShortPrice;

    updateCalendarShortPrice(committedValue);
    setCalendarShortPriceDraft(null);
  };
  const handleScenarioPriceKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    if (event.key === "Enter") {
      event.currentTarget.blur();
      return;
    }

    if (event.key === "Backspace" && /^\d$/.test(event.currentTarget.value)) {
      event.preventDefault();
      setScenarioPriceDraft("0");
      updateScenarioPrice(0);
      return;
    }

    if (/^\d$/.test(event.key) && event.currentTarget.value === "0") {
      event.preventDefault();
      setScenarioPriceDraft(event.key);
      updateScenarioPrice(Number(event.key));
    }
  };
  const handleCalendarShortPriceKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    if (event.key === "Enter") {
      event.currentTarget.blur();
      return;
    }

    if (event.key === "Backspace" && /^\d$/.test(event.currentTarget.value)) {
      event.preventDefault();
      setCalendarShortPriceDraft("0");
      updateCalendarShortPrice(0);
      return;
    }

    if (/^\d$/.test(event.key) && event.currentTarget.value === "0") {
      event.preventDefault();
      setCalendarShortPriceDraft(event.key);
      updateCalendarShortPrice(Number(event.key));
    }
  };
  const updateRatePctDraft = (nextValue: string) => {
    if (!/^\d*\.?\d*$/.test(nextValue)) {
      return;
    }

    setRatePctDraft(nextValue);

    if (!nextValue.trim() || nextValue === ".") {
      setRatePct(0);
      return;
    }

    setRatePct(clamp(parseDecimalInput(nextValue), 0, 15));
  };
  const commitRatePctDraft = () => {
    const nextRate = clamp(parseDecimalInput(ratePctDraft), 0, 15);

    setRatePct(nextRate);
    setRatePctDraft(String(roundTo(nextRate, 2)));
  };
  const handleRatePctKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    if (event.key === "Enter") {
      event.currentTarget.blur();
      return;
    }

    if (event.key === "Backspace" && /^\d$/.test(event.currentTarget.value)) {
      event.preventDefault();
      setRatePctDraft("0");
      setRatePct(0);
      return;
    }

    if (/^\d$/.test(event.key) && event.currentTarget.value === "0") {
      event.preventDefault();
      setRatePctDraft(event.key);
      setRatePct(Number(event.key));
    }
  };
  const seedCustomDraftFromComparison = (
    comparison: CustomComparisonConfig,
  ) => {
    const nextSymbol = normalizeSymbol(comparison.symbol ?? symbol);
    const nextSpot = normalizePriceValue(comparison.spot ?? spot);
    const nextLongStrike = normalizeStrikeValue(comparison.longStrike);
    const nextShortStrike = normalizeShortStrikeForStrategy(
      comparison.strategy,
      nextLongStrike,
      comparison.shortStrike,
    );
    const nextRatioShortCount = normalizePutRatioShortCount(
      comparison.ratioShortCount,
    );
    const nextExpirationDays = clamp(
      Math.round(comparison.expirationDays),
      1,
      1095,
    );
    const nextShortExpirationDays = normalizeCallCalendarShortExpirationDays(
      comparison.shortExpirationDays,
      nextExpirationDays,
    );
    const nextVolatilityPct = clamp(
      comparison.volatilityPct ?? volatilityPct,
      0,
      300,
    );
    const nextFutureVolatilityPct = clamp(
      comparison.futureVolatilityPct ?? futureVolatilityPct,
      0,
      300,
    );
    const nextCapital = Math.max(1, normalizeCapitalValue(comparison.capital));
    const nextRatePct = clamp(comparison.ratePct ?? ratePct, 0, 15);

    if (nextSymbol) {
      setSymbol(nextSymbol);
    }
    setStrategy(comparison.strategy);
    setSpot(nextSpot);
    setLongStrike(nextLongStrike);
    setShortStrike(nextShortStrike);
    setPutRatioShortCount(nextRatioShortCount);
    setShortExpirationDays(nextShortExpirationDays);
    setVolatilityPct(nextVolatilityPct);
    setFutureVolatilityPct(nextFutureVolatilityPct);
    setCapital(nextCapital);
    setExpirationDays(nextExpirationDays);
    setAllowFractionalContracts(comparison.allowFractionalContracts);
    setRatePct(nextRatePct);
    setRatePctDraft(compactNumber(nextRatePct));
    setCustomDraft({
      label: "",
      strategy: comparison.strategy,
      symbol: nextSymbol,
      todayIso: comparison.todayIso,
      spot: nextSpot,
      longStrike: nextLongStrike,
      shortStrike: nextShortStrike,
      ratioShortCount: nextRatioShortCount,
      shortExpirationDays: nextShortExpirationDays,
      volatilityPct: nextVolatilityPct,
      futureVolatilityPct: nextFutureVolatilityPct,
      capital: nextCapital,
      expirationDays: nextExpirationDays,
      allowFractionalContracts: comparison.allowFractionalContracts,
      scenarioPrice: comparison.scenarioPrice,
      scenarioOffsetDays: comparison.scenarioOffsetDays,
      ratePct: nextRatePct,
      dividendYieldPct: comparison.dividendYieldPct,
    });
  };
  const seedCustomDraftFromCurrent = (draftStrategy: OptionStrategy = strategy) => {
    const selectedComparisonId = graphComparisonId.startsWith("custom:")
      ? graphComparisonId.slice("custom:".length)
      : null;
    const defaultExpirationDays =
      (selectedComparisonId
        ? customComparisons.find((comparison) => comparison.id === selectedComparisonId)
            ?.expirationDays
        : undefined) ??
      customComparisons[0]?.expirationDays ??
      expirationDays;
    const draftExpirationDays = clamp(Math.round(defaultExpirationDays), 1, 1095);
    const nextDraftStrikes = getDefaultStrikesForStrategy(draftStrategy, spot, {
      expirationDays: draftExpirationDays,
      volatilityPct,
      ratioShortCount: putRatioShortCount,
      ratePct,
    });

    setCustomDraft({
      label: "",
      strategy: draftStrategy,
      spot,
      longStrike: nextDraftStrikes.longStrike,
      shortStrike: nextDraftStrikes.shortStrike,
      ratioShortCount: putRatioShortCount,
      capital,
      expirationDays: draftExpirationDays,
      shortExpirationDays:
        draftStrategy === "call-calendar" && strategy !== "call-calendar"
          ? getDefaultCallCalendarShortExpirationDays(draftExpirationDays)
          : normalizeCallCalendarShortExpirationDays(
              shortExpirationDays,
              draftExpirationDays,
            ),
      allowFractionalContracts,
    });
  };
  const useCustomQuickStart = (card: ComparisonCardData) => {
    setEditingComparisonId(null);
    setCustomDraft({
      label: card.label,
      strategy: card.strategy,
      spot: card.spot,
      longStrike: card.longStrike,
      shortStrike: normalizeShortStrikeForStrategy(
        card.strategy,
        card.longStrike,
        card.shortStrike,
      ),
      ratioShortCount: normalizePutRatioShortCount(card.ratioShortCount),
      shortExpirationDays: card.snapshot.shortExpirationDays,
      capital: card.capital,
      expirationDays: card.expirationDays,
      allowFractionalContracts: card.allowFractionalContracts,
    });
  };
  const editCustomComparison = (card: ComparisonCardData) => {
    const nextSymbol = normalizeSymbol(card.symbol ?? symbol);
    const nextLongStrike = normalizeStrikeValue(card.longStrike);
    const nextExpirationDays = clamp(Math.round(card.expirationDays), 1, 1095);
    const nextShortExpirationDays = normalizeCallCalendarShortExpirationDays(
      card.shortExpirationDays ?? card.snapshot.shortExpirationDays,
      nextExpirationDays,
    );
    const nextRatePct = clamp(card.ratePct ?? ratePct, 0, 15);

    if (nextSymbol) {
      setSymbol(nextSymbol);
    }
    setStrategy(card.strategy);
    setLongStrike(nextLongStrike);
    setShortStrike(
      normalizeShortStrikeForStrategy(card.strategy, nextLongStrike, card.shortStrike),
    );
    setPutRatioShortCount(normalizePutRatioShortCount(card.ratioShortCount));
    setShortExpirationDays(nextShortExpirationDays);
    setSpot(normalizePriceValue(card.spot ?? spot));
    setVolatilityPct(clamp(card.volatilityPct ?? volatilityPct, 0, 300));
    setFutureVolatilityPct(
      clamp(card.futureVolatilityPct ?? futureVolatilityPct, 0, 300),
    );
    setCapital(Math.max(1, normalizeCapitalValue(card.capital)));
    setAllowFractionalContracts(card.allowFractionalContracts);
    setExpirationDays(nextExpirationDays);
    setRatePct(nextRatePct);
    setRatePctDraft(compactNumber(nextRatePct));
    setCustomDraft({
      label: card.label,
      strategy: card.strategy,
      longStrike: nextLongStrike,
      shortStrike: normalizeShortStrikeForStrategy(
        card.strategy,
        nextLongStrike,
        card.shortStrike,
      ),
      ratioShortCount: normalizePutRatioShortCount(card.ratioShortCount),
      shortExpirationDays: nextShortExpirationDays,
      capital: card.capital,
      expirationDays: nextExpirationDays,
      allowFractionalContracts: card.allowFractionalContracts,
      symbol: card.symbol,
      todayIso: card.todayIso,
      spot: card.spot,
      volatilityPct: card.volatilityPct,
      futureVolatilityPct: card.futureVolatilityPct,
      ratePct: card.ratePct,
      dividendYieldPct: card.dividendYieldPct,
    });
    setEditingComparisonId(card.id);
    setComparisonPanelMode("custom");
    setGraphComparisonId(`custom:${card.id}`);
    setIsSetupFormVisible(true);
    setIsCustomComparisonEditorOpen(true);
  };
  const openCustomComparisonEditor = () => {
    setEditingComparisonId(null);
    const latestComparison = getLatestCreatedCustomComparison(customComparisons);

    if (latestComparison) {
      seedCustomDraftFromComparison(latestComparison);
    } else {
      seedCustomDraftFromCurrent(customDraft.strategy);
    }

    if (graphComparisonId.startsWith("preset:")) {
      setGraphComparisonId("editor");
    }

    setComparisonPanelMode("custom");
    setIsSetupFormVisible(true);
    setIsCustomComparisonEditorOpen(true);
  };
  const changeWorkflowTab = (nextTab: WorkflowTab) => {
    setActiveWorkflowTab(nextTab);

    if (nextTab === "decision") {
      setComparisonPanelMode(customComparisons.length > 0 ? "custom" : "presets");
      setIsCustomComparisonEditorOpen(false);
      return;
    }
  };
  const changeDecisionComparisonView = (nextView: DecisionComparisonView) => {
    setDecisionComparisonView(nextView);

    if (typeof window === "undefined") {
      return;
    }

    const searchParams = new URLSearchParams(window.location.search);
    searchParams.set("decision", nextView);
    const nextSearch = searchParams.toString();

    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`,
    );
  };
  const customDraftStrategy = customDraft.strategy;
  const customDraftLongStrike = normalizeStrikeValue(customDraft.longStrike);
  const customDraftExpirationDays = clamp(
    Math.round(customDraft.expirationDays),
    1,
    1095,
  );
  const customDraftSnapshot = createScenarioSnapshot({
    strategy: customDraftStrategy,
    todayIso,
    expiryIso: addDaysToIso(todayIso, customDraftExpirationDays),
    spot: normalizePriceValue(customDraft.spot ?? spot),
    longStrike: customDraftLongStrike,
    shortStrike: normalizeShortStrikeForStrategy(
      customDraftStrategy,
      customDraftLongStrike,
      customDraft.shortStrike,
    ),
    ratioShortCount: normalizePutRatioShortCount(customDraft.ratioShortCount),
    shortExpirationDays: normalizeCallCalendarShortExpirationDays(
      customDraft.shortExpirationDays,
      customDraftExpirationDays,
    ),
    volatilityPct: clamp(customDraft.volatilityPct ?? volatilityPct, 0, 300),
    futureVolatilityPct: clamp(
      customDraft.futureVolatilityPct ?? futureVolatilityPct,
      0,
      300,
    ),
    capital: Math.max(1, normalizeCapitalValue(customDraft.capital)),
    allowFractionalContracts: customDraft.allowFractionalContracts,
    scenarioPrice: effectiveScenarioPrice,
    calendarShortPrice: safeCalendarShortPrice,
    scenarioOffsetDays: clamp(safeScenarioOffsetDays, 0, customDraftExpirationDays),
    ratePct: clamp(customDraft.ratePct ?? ratePct, 0, 15),
    dividendYieldPct: customDraft.dividendYieldPct ?? 0,
  });
  const customDraftBaseError =
    customDraft.longStrike <= 0
      ? "Long strike has to be greater than zero."
      : (customDraft.strategy === "debit-call-spread" ||
            customDraft.strategy === "call-ratio-spread" ||
            customDraft.strategy === "bull-put-spread") &&
          customDraft.shortStrike <= customDraft.longStrike
        ? customDraft.strategy === "bull-put-spread"
          ? "Short put strike has to be above the long put strike."
          : "Short call strike has to be above the long call strike."
      : isPutDownsideStrategy(customDraft.strategy) && customDraft.shortStrike >= customDraft.longStrike
        ? "Short put strike has to be below the long put strike."
      : customDraft.capital <= 0
          ? "Capital needs to be greater than zero."
          : customDraft.expirationDays <= 0
            ? "DTE needs to be greater than zero."
            : null;
  const customDraftError =
    customDraftBaseError ??
    (customDraftSnapshot.unitCost <= 0
      ? getNonPositiveEntryDebitMessage(customDraft.strategy)
      : null);
  const addCustomComparison = () => {
    if (customDraftError) {
      return;
    }

    const nextStrategy = customDraft.strategy;
    const nextLongStrike = normalizeStrikeValue(customDraft.longStrike);
    const nextShortStrike = normalizeShortStrikeForStrategy(
      nextStrategy,
      nextLongStrike,
      customDraft.shortStrike,
    );
    const nextRatioShortCount = normalizePutRatioShortCount(customDraft.ratioShortCount);
    const nextSymbol = normalizeSymbol(symbol);
    const nextExpirationDays = clamp(Math.round(customDraft.expirationDays), 1, 1095);
    const nextShortExpirationDays = normalizeCallCalendarShortExpirationDays(
      customDraft.shortExpirationDays,
      nextExpirationDays,
    );
    const editedComparison = editingComparisonId
      ? customComparisons.find((comparison) => comparison.id === editingComparisonId)
      : undefined;
    const shouldRegenerateLabel =
      !customDraft.label.trim() ||
      (editedComparison &&
        isGeneratedCustomComparisonLabel(editedComparison) &&
        customDraft.label.trim() === editedComparison.label);
    const nextLabel = getCustomComparisonLabel({
      ...customDraft,
      label: shouldRegenerateLabel ? "" : customDraft.label,
      longStrike: nextLongStrike,
      shortStrike: nextShortStrike,
      ratioShortCount: nextRatioShortCount,
      shortExpirationDays: nextShortExpirationDays,
      expirationDays: nextExpirationDays,
    });
    const nextComparisonBase = {
      label: nextLabel,
      strategy: nextStrategy,
      longStrike: nextLongStrike,
      shortStrike: nextShortStrike,
      ratioShortCount: nextRatioShortCount,
      shortExpirationDays: nextShortExpirationDays,
      capital: Math.max(1, normalizeCapitalValue(customDraft.capital)),
      expirationDays: nextExpirationDays,
      allowFractionalContracts: customDraft.allowFractionalContracts,
      symbol: nextSymbol,
      todayIso,
      spot,
      volatilityPct,
      futureVolatilityPct,
      ratePct,
      dividendYieldPct: 0,
    };
    const nextId =
      editingComparisonId ??
      `custom-${customComparisonIdCounter.current + 1}-${customComparisons.length}`;
    const isEditingExistingComparison = Boolean(
      editingComparisonId &&
        customComparisons.some((comparison) => comparison.id === editingComparisonId),
    );
    const shouldInitializeCalendarShortPrice =
      nextStrategy === "call-calendar" &&
      !customComparisons.some(
        (comparison) => comparison.strategy === "call-calendar",
      );

    const nextComparisons =
      isEditingExistingComparison
        ? customComparisons.map((comparison) =>
          comparison.id === editingComparisonId
            ? { ...comparison, ...nextComparisonBase }
            : comparison,
        )
        : [
            {
              id: nextId,
              ...nextComparisonBase,
            },
            ...customComparisons,
          ];

    if (!isEditingExistingComparison) {
      customComparisonIdCounter.current += 1;
    }

    setCustomComparisons(nextComparisons);
    if (shouldInitializeCalendarShortPrice) {
      setCalendarShortPrice(effectiveScenarioPrice);
      setCalendarShortPriceDraft(null);
    }
    syncMarketScenarioDteRange(nextComparisons, nextExpirationDays);
    setGraphComparisonId(`custom:${nextId}`);
    setEditingComparisonId(null);

    setCapital(nextComparisonBase.capital);
    setCustomDraft({
      ...nextComparisonBase,
      label: "",
    });
    setIsCustomComparisonEditorOpen(false);
    setIsSetupFormVisible(false);
  };
  const addCurrentStrategyComparison = () => {
    const nextLongStrike = normalizeStrikeValue(longStrike);
    const nextShortStrike = normalizeShortStrikeForStrategy(
      strategy,
      nextLongStrike,
      shortStrike,
    );
    const nextCapital = Math.max(1, normalizeCapitalValue(capital));
    const nextSymbol = normalizeSymbol(symbol);
    const nextExpirationDays = clamp(Math.round(expirationDays), 1, 1095);
    const nextShortExpirationDays = normalizeCallCalendarShortExpirationDays(
      shortExpirationDays,
      nextExpirationDays,
    );
    const matchingComparison = customComparisons.find((comparison) =>
      comparison.strategy === strategy &&
      comparison.longStrike === nextLongStrike &&
      comparison.shortStrike === nextShortStrike &&
      (!isRatioSpreadStrategy(strategy) ||
        normalizePutRatioShortCount(comparison.ratioShortCount) ===
          normalizePutRatioShortCount(putRatioShortCount)) &&
      (!isCallCalendarStrategy(strategy) ||
        normalizeCallCalendarShortExpirationDays(
          comparison.shortExpirationDays,
          comparison.expirationDays,
        ) === nextShortExpirationDays) &&
      comparison.capital === nextCapital &&
      comparison.expirationDays === nextExpirationDays &&
      comparison.allowFractionalContracts === allowFractionalContracts &&
      comparison.symbol === nextSymbol &&
      comparison.todayIso === todayIso &&
      comparison.spot === spot &&
      comparison.volatilityPct === volatilityPct &&
      comparison.futureVolatilityPct === futureVolatilityPct &&
      comparison.ratePct === ratePct &&
      comparison.dividendYieldPct === 0,
    );

    if (matchingComparison) {
      setComparisonPanelMode("custom");
      setGraphComparisonId(`custom:${matchingComparison.id}`);
      syncMarketScenarioDteRange(customComparisons);
      setIsCustomComparisonEditorOpen(false);
      setIsSetupFormVisible(false);
      return;
    }

    customComparisonIdCounter.current += 1;
    const nextId = `custom-${customComparisonIdCounter.current}-${customComparisons.length}`;
    const nextComparison: CustomComparisonConfig = {
      id: nextId,
      label: getCustomComparisonLabel({
        label: "",
        strategy,
        longStrike: nextLongStrike,
        shortStrike: nextShortStrike,
        ratioShortCount: putRatioShortCount,
        shortExpirationDays: nextShortExpirationDays,
        expirationDays: nextExpirationDays,
      }),
      strategy,
      longStrike: nextLongStrike,
      shortStrike: nextShortStrike,
      ratioShortCount: normalizePutRatioShortCount(putRatioShortCount),
      shortExpirationDays: nextShortExpirationDays,
      capital: nextCapital,
      expirationDays: nextExpirationDays,
      allowFractionalContracts,
      symbol: nextSymbol,
      todayIso,
      spot,
      volatilityPct,
      futureVolatilityPct,
      ratePct,
      dividendYieldPct: 0,
    };

    const nextComparisons = [nextComparison, ...customComparisons];

    setCapital(nextCapital);
    setCustomDraft({
      label: "",
      strategy: nextComparison.strategy,
      symbol: nextComparison.symbol,
      todayIso: nextComparison.todayIso,
      spot: nextComparison.spot,
      longStrike: nextComparison.longStrike,
      shortStrike: nextComparison.shortStrike,
      ratioShortCount: nextComparison.ratioShortCount,
      shortExpirationDays: nextComparison.shortExpirationDays,
      volatilityPct: nextComparison.volatilityPct,
      futureVolatilityPct: nextComparison.futureVolatilityPct,
      capital: nextComparison.capital,
      expirationDays: nextComparison.expirationDays,
      allowFractionalContracts: nextComparison.allowFractionalContracts,
      scenarioPrice: nextComparison.scenarioPrice,
      scenarioOffsetDays: nextComparison.scenarioOffsetDays,
      ratePct: nextComparison.ratePct,
      dividendYieldPct: nextComparison.dividendYieldPct,
    });
    setCustomComparisons(nextComparisons);
    syncMarketScenarioDteRange(nextComparisons, nextExpirationDays);
    setComparisonPanelMode("custom");
    setGraphComparisonId(`custom:${nextId}`);
    setIsCustomComparisonEditorOpen(false);
    setIsSetupFormVisible(false);
  };
  const createIvAlternativeStrategy = (
    alternative: IvAlternativeStrategy,
  ) => {
    const nextStrategy: OptionStrategy =
      alternative.instrument === "long-call"
        ? "long-call"
        : "debit-call-spread";
    const nextLongStrike = normalizeStrikeValue(alternative.longStrike);
    const nextShortStrike = normalizeShortStrikeForStrategy(
      nextStrategy,
      nextLongStrike,
      alternative.shortStrike,
    );
    const nextExpirationDays = clamp(
      Math.round(alternative.expirationDays),
      1,
      1095,
    );
    const nextVolatilityPct = clamp(alternative.volatilityPct, 0, 300);
    const nextScenarioPrice = normalizePriceValue(
      alternative.scenarioPrice,
    );
    const nextScenarioOffsetDays = clamp(
      Math.round(alternative.scenarioOffsetDays),
      0,
      nextExpirationDays,
    );
    const nextCapital = Math.max(
      1,
      normalizeCapitalValue(alternative.capital),
    );
    const nextSymbol = normalizeSymbol(alternative.symbol);
    const nextSpot = normalizePriceValue(alternative.spot);
    const nextTodayIso = alternative.todayIso;
    const nextRatePct = clamp(alternative.ratePct, 0, 15);
    const nextAllowFractionalContracts =
      alternative.allowFractionalContracts;
    const nextShortExpirationDays =
      normalizeCallCalendarShortExpirationDays(
        shortExpirationDays,
        nextExpirationDays,
      );
    const matchingComparison = customComparisons.find(
      (comparison) =>
        comparison.strategy === nextStrategy &&
        comparison.longStrike === nextLongStrike &&
        comparison.shortStrike === nextShortStrike &&
        comparison.capital === nextCapital &&
        comparison.expirationDays === nextExpirationDays &&
        comparison.allowFractionalContracts ===
          nextAllowFractionalContracts &&
        comparison.symbol === nextSymbol &&
        comparison.todayIso === nextTodayIso &&
        comparison.spot === nextSpot &&
        comparison.volatilityPct === nextVolatilityPct &&
        comparison.futureVolatilityPct === nextVolatilityPct &&
        comparison.ratePct === nextRatePct &&
        comparison.dividendYieldPct === 0,
    );
    let selectedComparison = matchingComparison;
    let nextComparisons = customComparisons;

    if (!selectedComparison) {
      customComparisonIdCounter.current += 1;
      const nextId = `custom-${customComparisonIdCounter.current}-${customComparisons.length}`;
      selectedComparison = {
        id: nextId,
        label: getCustomComparisonLabel({
          label: "",
          strategy: nextStrategy,
          longStrike: nextLongStrike,
          shortStrike: nextShortStrike,
          ratioShortCount: putRatioShortCount,
          shortExpirationDays: nextShortExpirationDays,
          expirationDays: nextExpirationDays,
        }),
        strategy: nextStrategy,
        longStrike: nextLongStrike,
        shortStrike: nextShortStrike,
        ratioShortCount: normalizePutRatioShortCount(putRatioShortCount),
        shortExpirationDays: nextShortExpirationDays,
        capital: nextCapital,
        expirationDays: nextExpirationDays,
        allowFractionalContracts: nextAllowFractionalContracts,
        symbol: nextSymbol,
        todayIso: nextTodayIso,
        spot: nextSpot,
        volatilityPct: nextVolatilityPct,
        futureVolatilityPct: nextVolatilityPct,
        scenarioPrice: nextScenarioPrice,
        scenarioOffsetDays: nextScenarioOffsetDays,
        ratePct: nextRatePct,
        dividendYieldPct: 0,
      };
      nextComparisons = [selectedComparison, ...customComparisons];
      pendingScenarioOffsetAfterStrategyChangeRef.current =
        nextScenarioOffsetDays;
      setCustomComparisons(nextComparisons);
    }

    setStrategy(nextStrategy);
    setLongStrike(nextLongStrike);
    setShortStrike(nextShortStrike);
    setExpirationDays(nextExpirationDays);
    setShortExpirationDays(nextShortExpirationDays);
    setVolatilityPct(nextVolatilityPct);
    setFutureVolatilityPct(nextVolatilityPct);
    setSymbol(nextSymbol);
    setSpot(nextSpot);
    setAllowFractionalContracts(nextAllowFractionalContracts);
    setRatePct(nextRatePct);
    setRatePctDraft(compactNumber(nextRatePct));
    setScenarioPrice(nextScenarioPrice);
    setScenarioPriceDraft(null);
    setCapital(nextCapital);
    setCustomDraft({
      ...selectedComparison,
      label: "",
      scenarioPrice: nextScenarioPrice,
      scenarioOffsetDays: nextScenarioOffsetDays,
    });
    syncMarketScenarioDteRange(nextComparisons, nextExpirationDays);
    setScenarioOffsetDays(nextScenarioOffsetDays);
    setValuationDteDraft(null);
    setComparisonPanelMode("custom");
    setGraphComparisonId(`custom:${selectedComparison.id}`);
    setEditingComparisonId(null);
    setIsCustomComparisonEditorOpen(false);
    setIsSetupFormVisible(false);
    setActiveWorkflowTab("decision");
  };
  const removeCustomComparison = (id: string) => {
    const removedComparison = customComparisons.find((comparison) => comparison.id === id);
    const nextComparisons = customComparisons.filter((comparison) => comparison.id !== id);
    const nextComparisonMaxExpirationDays = getMarketScenarioMaxDte(
      nextComparisons,
      defaultExpirationDays,
    );
    const shouldMoveEditorOffDeletedExpiration =
      graphComparisonId === `custom:${id}` ||
      (removedComparison !== undefined &&
        expirationDays === removedComparison.expirationDays);
    const nextExpirationDays = shouldMoveEditorOffDeletedExpiration
      ? clamp(Math.round(nextComparisonMaxExpirationDays), 1, 1095)
      : expirationDays;

    setCustomComparisons(nextComparisons);
    if (shouldMoveEditorOffDeletedExpiration) {
      setExpirationDays(nextExpirationDays);
      setShortExpirationDays((currentDays) =>
        normalizeCallCalendarShortExpirationDays(currentDays, nextExpirationDays),
      );
      setCustomDraft((currentDraft) => ({
        ...currentDraft,
        expirationDays: nextExpirationDays,
        shortExpirationDays: normalizeCallCalendarShortExpirationDays(
          currentDraft.shortExpirationDays,
          nextExpirationDays,
        ),
      }));
    }
    syncMarketScenarioDteRange(nextComparisons, nextExpirationDays);
    setEditingComparisonId((currentId) => (currentId === id ? null : currentId));
    setGraphComparisonId((currentId) =>
      currentId === `custom:${id}` ? "editor" : currentId,
    );
  };
  const reorderCustomComparisons = (orderedIds: string[]) => {
    setCustomComparisons((currentComparisons) => {
      const orderedIdSet = new Set(orderedIds);
      const comparisonsById = new Map(
        currentComparisons.map((comparison) => [comparison.id, comparison]),
      );
      const orderedComparisons = orderedIds.flatMap((id) => {
        const comparison = comparisonsById.get(id);

        return comparison ? [comparison] : [];
      });
      const remainingComparisons = currentComparisons.filter(
        (comparison) => !orderedIdSet.has(comparison.id),
      );

      return [...orderedComparisons, ...remainingComparisons];
    });
  };
  const loadComparisonSetup = (card: ComparisonCardData) => {
    const nextSymbol = normalizeSymbol(card.symbol ?? symbol);
    const nextLongStrike = normalizeStrikeValue(card.longStrike);
    const nextExpirationDays = clamp(Math.round(card.expirationDays), 1, 1095);
    const nextShortExpirationDays = normalizeCallCalendarShortExpirationDays(
      card.shortExpirationDays ?? card.snapshot.shortExpirationDays,
      nextExpirationDays,
    );
    const nextRatePct = clamp(card.ratePct ?? ratePct, 0, 15);

    if (nextSymbol) {
      setSymbol(nextSymbol);
    }
    setStrategy(card.strategy);
    setLongStrike(nextLongStrike);
    setShortStrike(
      normalizeShortStrikeForStrategy(card.strategy, nextLongStrike, card.shortStrike),
    );
    setPutRatioShortCount(normalizePutRatioShortCount(card.ratioShortCount));
    setShortExpirationDays(nextShortExpirationDays);
    setSpot(normalizePriceValue(card.spot ?? spot));
    setVolatilityPct(clamp(card.volatilityPct ?? volatilityPct, 0, 300));
    setFutureVolatilityPct(
      clamp(card.futureVolatilityPct ?? futureVolatilityPct, 0, 300),
    );
    setCapital(Math.max(1, normalizeCapitalValue(card.capital)));
    setAllowFractionalContracts(card.allowFractionalContracts);
    setExpirationDays(nextExpirationDays);
    setRatePct(nextRatePct);
    setRatePctDraft(compactNumber(nextRatePct));
  };
  const analyzeCustomComparison = (card: ComparisonCardData) => {
    loadComparisonSetup(card);
    setComparisonPanelMode("custom");
    setGraphComparisonId(`custom:${card.id}`);
  };

  const validationMessages: string[] = [];
  if (!symbol.trim()) {
    validationMessages.push("Enter a ticker or label so the scenario has a clear underlying.");
  }
  if (spot <= 0) {
    validationMessages.push("Current stock price has to be greater than zero.");
  }
  if (volatilityPct < 0) {
    validationMessages.push("Current IV cannot be negative.");
  }
  if (futureVolatilityPct < 0) {
    validationMessages.push("Future IV cannot be negative.");
  }
  if (longStrike <= 0 || (isDebitSpread && shortStrike <= 0)) {
    validationMessages.push(
      isDebitSpread
        ? "Strike prices have to be greater than zero."
        : isBearPut
          ? "Put strike has to be greater than zero."
          : "Call strike has to be greater than zero.",
    );
  }
  if (isDebitCallSpread && shortStrike <= longStrike) {
    validationMessages.push("For a debit call spread, the short strike must be above the long strike.");
  }
  if (isCallRatioSpread && shortStrike <= longStrike) {
    validationMessages.push("For a call ratio spread, the short strike must be above the long call strike.");
  }
  if (isDebitPutSpread && shortStrike >= longStrike) {
    validationMessages.push("For a debit put spread, the short strike must be below the long strike.");
  }
  if (isBullPutSpread && shortStrike <= longStrike) {
    validationMessages.push(
      "For a bull put spread, the short put strike must be above the long put strike.",
    );
  }
  if (isPutRatioSpread && shortStrike >= longStrike) {
    validationMessages.push("For a put ratio spread, the short strike must be below the long put strike.");
  }
  if (capital <= 0) {
    validationMessages.push("Capital needs to be greater than zero.");
  }
    if (expirationDays === 0) {
      validationMessages.push("Set the expiration after today so the app can model time value.");
    }
  if (isCallCalendar && shortExpirationDays >= expirationDays) {
    validationMessages.push("For a call calendar, the short call DTE must be before the long call DTE.");
  }

    const inputs = useMemo<StrategyInputs>(
      () => ({
      strategy,
      todayIso,
      expiryIso,
      spot,
      longStrike,
      shortStrike,
      ratioShortCount: putRatioShortCount,
      shortExpirationDays: normalizeCallCalendarShortExpirationDays(
        shortExpirationDays,
        expirationDays,
      ),
      volatilityPct,
      futureVolatilityPct,
      capital,
      allowFractionalContracts,
      scenarioPrice: clamp(
        scenarioPrice,
        scenarioPriceSliderMin,
        scenarioPriceSliderMax,
      ),
      calendarShortPrice: clamp(
        calendarShortPrice,
        scenarioPriceSliderMin,
        calendarShortPriceSliderMax,
      ),
      scenarioOffsetDays: clamp(
        scenarioOffsetDays,
        0,
        marketScenarioMaxOffsetDays,
      ),
      ratePct,
      dividendYieldPct: 0,
    }),
    [
      allowFractionalContracts,
      capital,
      calendarShortPrice,
      calendarShortPriceSliderMax,
      expiryIso,
      futureVolatilityPct,
      longStrike,
      marketScenarioMaxOffsetDays,
      expirationDays,
      putRatioShortCount,
      ratePct,
      scenarioOffsetDays,
      scenarioPrice,
      scenarioPriceSliderMax,
      scenarioPriceSliderMin,
      shortStrike,
      shortExpirationDays,
      spot,
      strategy,
      todayIso,
      volatilityPct,
    ],
  );

  const snapshot = useMemo(() => createScenarioSnapshot(inputs), [inputs]);
  if (validationMessages.length === 0 && snapshot.unitCost <= 0) {
    validationMessages.push(getNonPositiveEntryDebitMessage(strategy));
  }
  const canModel = validationMessages.length === 0;
  const activeScenarioGraphView: ScenarioGraphView =
    scenarioGraphView === "overlay" || scenarioGraphView === "decay" || scenarioGraphView === "map"
      ? scenarioGraphView
      : DEFAULT_SCENARIO_GRAPH_VIEW;
  const scenarioGraphOptions: Array<{
    value: ScenarioGraphView;
    label: string;
    shortLabel: string;
  }> = [
    { value: "decay", label: "Time value", shortLabel: "Time" },
    { value: "overlay", label: "Multi-date", shortLabel: "Dates" },
    { value: "map", label: "Heat map", shortLabel: "Heat" },
  ];
  const changeAnalysisView = (view: ScenarioGraphView) => {
    if (view === "map") {
      setActiveWorkflowTab("heatmap");
      return;
    }

    setScenarioGraphView(view);
    setActiveWorkflowTab("analysis");
  };
  const isTabbedAnalysis = activeWorkflowTab === "analysis";
  const isTabbedHeatMap = activeWorkflowTab === "heatmap";
  const activeDisplayGraphView: ScenarioGraphView = isTabbedHeatMap
    ? "map"
    : isTabbedAnalysis && activeScenarioGraphView === "map"
      ? "overlay"
      : activeScenarioGraphView;
  const showScenarioSelectionControls = activeDisplayGraphView !== "map";
  const comparisonCards = useMemo<ComparisonCardData[]>(() => {
    if (!canModel) {
      return [];
    }

    const atmStrike = Math.max(1, Math.round(spot));
    const candidates: ComparisonCandidate[] = [
      {
        id: "current",
        label: "Current setup",
        note: "The position currently in the editor.",
          strategy,
          longStrike,
          shortStrike,
          ratioShortCount: putRatioShortCount,
        shortExpirationDays,
          capital,
        expirationDays,
        allowFractionalContracts,
      },
      {
        id: "atm-long-call",
        label: "ATM long call",
        note: "Cleaner upside, higher premium, no capped profit.",
        strategy: "long-call",
        longStrike: atmStrike,
        shortStrike: atmStrike,
        capital,
        expirationDays,
        allowFractionalContracts,
      },
      {
        id: "spread-5-otm",
        label: "5% OTM call spread",
        note: "Closer target with a higher chance of finishing in range.",
        strategy: "debit-call-spread",
        longStrike: atmStrike,
        shortStrike: Math.max(atmStrike + 1, getOtmStrike(spot, 5)),
        capital,
        expirationDays,
        allowFractionalContracts,
      },
      {
        id: "spread-10-otm",
        label: "10% OTM call spread",
        note: "Balanced call spread matching the default short-strike idea.",
        strategy: "debit-call-spread",
        longStrike: atmStrike,
        shortStrike: Math.max(atmStrike + 1, getOtmStrike(spot, 10)),
        capital,
        expirationDays,
        allowFractionalContracts,
      },
      {
        id: "call-ratio-10-otm",
        label: "10% OTM call ratio spread",
        note: "Targets a moderate upside move with extra risk above the short calls.",
        strategy: "call-ratio-spread",
        longStrike: atmStrike,
        shortStrike: Math.max(atmStrike + 1, getOtmStrike(spot, 10)),
          ratioShortCount: 2,
          capital,
          expirationDays,
          allowFractionalContracts,
        },
      {
        id: "call-calendar-atm",
        label: "ATM call calendar",
        note: "Same strike, nearer short call against a longer long call.",
        strategy: "call-calendar",
        longStrike: atmStrike,
        shortStrike: atmStrike,
        shortExpirationDays:
          strategy === "call-calendar"
            ? normalizeCallCalendarShortExpirationDays(
                shortExpirationDays,
                expirationDays,
              )
            : getDefaultCallCalendarShortExpirationDays(expirationDays),
        capital,
        expirationDays,
        allowFractionalContracts,
      },
        {
          id: "spread-20-otm",
        label: "20% OTM call spread",
        note: "Cheaper, more aggressive target with a wider payoff window.",
        strategy: "debit-call-spread",
        longStrike: atmStrike,
        shortStrike: Math.max(atmStrike + 1, getOtmStrike(spot, 20)),
        capital,
        expirationDays,
        allowFractionalContracts,
      },
      {
        id: "spread-30-otm",
        label: "30% OTM call spread",
        note: "Lowest cost preset with the furthest upside target.",
        strategy: "debit-call-spread",
        longStrike: atmStrike,
        shortStrike: Math.max(atmStrike + 1, getOtmStrike(spot, 30)),
        capital,
        expirationDays,
        allowFractionalContracts,
      },
      {
        id: "put-spread-5-otm",
        label: "5% OTM put spread",
        note: "Closer downside hedge with defined risk.",
        strategy: "debit-put-spread",
        longStrike: atmStrike,
        shortStrike: getOtmPutStrike(spot, 5),
        capital,
        expirationDays,
        allowFractionalContracts,
      },
      {
        id: "put-spread-10-otm",
        label: "10% OTM put spread",
        note: "Balanced put spread for a moderate downside target.",
        strategy: "debit-put-spread",
        longStrike: atmStrike,
        shortStrike: getOtmPutStrike(spot, 10),
        capital,
        expirationDays,
        allowFractionalContracts,
      },
      {
        id: "bull-put-spread-10-otm",
        label: "10% OTM bull put spread",
        note: "Sell the 10% OTM put and buy a lower put for defined downside risk.",
        strategy: "bull-put-spread",
        longStrike: getOtmPutStrike(spot, 15),
        shortStrike: getOtmPutStrike(spot, 10),
        capital,
        expirationDays,
        allowFractionalContracts,
      },
      {
        id: "bear-put-10-otm",
        label: "10% OTM bear put",
        note: "Single put for a moderate downside target.",
        strategy: "bear-put",
        longStrike: getOtmPutStrike(spot, 10),
        shortStrike: getOtmPutStrike(spot, 10),
        capital,
        expirationDays,
        allowFractionalContracts,
      },
      {
        id: "put-ratio-10-otm",
        label: "10% OTM put ratio spread",
        note: "Targets a moderate downside move with extra risk below the short puts.",
        strategy: "put-ratio-spread",
        longStrike: atmStrike,
        shortStrike: getOtmPutStrike(spot, 10),
        ratioShortCount: 2,
        capital,
        expirationDays,
        allowFractionalContracts,
      },
      {
        id: "put-spread-20-otm",
        label: "20% OTM put spread",
        note: "Lower-cost bearish target with capped downside profit.",
        strategy: "debit-put-spread",
        longStrike: atmStrike,
        shortStrike: getOtmPutStrike(spot, 20),
        capital,
        expirationDays,
        allowFractionalContracts,
      },
    ];

    return candidates.flatMap((candidate) => {
      const card = buildComparisonCard(
        candidate,
        inputs,
        useInitialIvForStrategies,
      );
      return card ? [card] : [];
    });
  }, [
    allowFractionalContracts,
    canModel,
    capital,
    expirationDays,
    inputs,
    longStrike,
      putRatioShortCount,
    shortExpirationDays,
      shortStrike,
    spot,
    strategy,
    useInitialIvForStrategies,
  ]);
  const customComparisonCards = useMemo<ComparisonCardData[]>(() => {
    return customComparisons.flatMap((comparison) => {
      const card = buildComparisonCard(
        {
          ...comparison,
          note: "",
        },
        inputs,
        useInitialIvForStrategies,
      );
      return card ? [card] : [];
    });
  }, [customComparisons, inputs, useInitialIvForStrategies]);
  const hasSavedComparisonCards = customComparisonCards.length > 0;
  const effectiveComparisonPanelMode: ComparisonPanelMode =
    comparisonPanelMode === "hidden"
      ? "hidden"
      : hasSavedComparisonCards
        ? "custom"
        : "hidden";
  const comparisonBoardCards = customComparisonCards;
  const visibleComparisonCards = useMemo(() => {
    if (effectiveComparisonPanelMode === "custom") {
      return customComparisonCards;
    }

    return [];
  }, [customComparisonCards, effectiveComparisonPanelMode]);
  const graphComparisonOptions = useMemo<GraphComparisonOption[]>(() => {
    const currentCandidate: ComparisonCandidate = {
      id: "current-editor",
      label: "Current setup",
      note: "The position currently in the editor.",
      strategy,
      longStrike,
        shortStrike,
        ratioShortCount: putRatioShortCount,
      shortExpirationDays,
        capital,
      expirationDays,
      allowFractionalContracts,
    };
    const currentDetail = `${getComparisonStrikeLabel(currentCandidate)} · ${formatPercent(
      snapshot.roi,
    )}`;
    const comparisonOptions = visibleComparisonCards.map((card) => ({
      id: `${effectiveComparisonPanelMode === "custom" ? "custom" : "preset"}:${card.id}`,
      label: card.label,
      detail: `${getComparisonStrikeLabel(card)} · ${formatPercent(card.snapshot.roi)}`,
      inputs: applyComparisonToInputs(
        card,
        inputs,
        useInitialIvForStrategies,
      ),
      snapshot: card.snapshot,
    }));

    return [
      {
        id: "editor",
        label: "Current setup",
        detail: currentDetail,
        inputs,
        snapshot,
      },
      ...comparisonOptions,
    ];
  }, [
    allowFractionalContracts,
    capital,
    expirationDays,
    effectiveComparisonPanelMode,
    inputs,
    longStrike,
      putRatioShortCount,
    shortExpirationDays,
      shortStrike,
    snapshot,
    strategy,
    useInitialIvForStrategies,
    visibleComparisonCards,
  ]);
  const selectedGraphComparison =
    graphComparisonOptions.find((option) => option.id === graphComparisonId) ??
    graphComparisonOptions[0];
  const selectedPresetCardId = graphComparisonId.startsWith("preset:")
    ? graphComparisonId.slice("preset:".length)
    : null;
  const selectedCustomCardId = graphComparisonId.startsWith("custom:")
    ? graphComparisonId.slice("custom:".length)
    : null;
  const selectedComparisonBoardCardId = hasSavedComparisonCards
    ? selectedCustomCardId
    : selectedPresetCardId;
  const selectedSavedStrategyCard = hasSavedComparisonCards
    ? customComparisonCards.find((card) => card.id === selectedCustomCardId) ??
      customComparisonCards[0] ??
      null
    : null;
  const visualizedInputs = selectedGraphComparison.inputs;
  const visualizedSnapshot = selectedGraphComparison.snapshot;
  const visualizedStrategy = visualizedInputs.strategy;
  const visualizedStrategyCopy = STRATEGY_COPY[visualizedStrategy];
  const visualizedIsBearPut = visualizedStrategy === "bear-put";
  const visualizedIsPutSpread = visualizedStrategy === "debit-put-spread";
  const visualizedIsPutRatioSpread = visualizedStrategy === "put-ratio-spread";
  const visualizedIsCallRatioSpread = visualizedStrategy === "call-ratio-spread";
  const visualizedIsRatioSpread = isRatioSpreadStrategy(visualizedStrategy);
  const visualizedIsPutDownsideSpread = isPutDownsideStrategy(visualizedStrategy);
  const visualizedIsCallCalendar = visualizedStrategy === "call-calendar";
  const visualizedMaxProfitAtExpiry =
    visualizedSnapshot.maxProfitPerUnit !== null
      ? visualizedSnapshot.maxProfitPerUnit *
        visualizedSnapshot.contracts *
        CONTRACT_MULTIPLIER
      : null;
  const visualizedMaxReturnAtExpiry =
    visualizedMaxProfitAtExpiry !== null && visualizedSnapshot.totalCost > 0
      ? visualizedMaxProfitAtExpiry / visualizedSnapshot.totalCost
      : null;
  const visualizedMaxLossAtExpiry =
    visualizedSnapshot.maxLossPerUnit === null
      ? null
      : -visualizedSnapshot.maxLossPerUnit *
        visualizedSnapshot.contracts *
        CONTRACT_MULTIPLIER;
  const visualizedMaxLossReturnAtExpiry =
    visualizedMaxLossAtExpiry !== null && visualizedSnapshot.totalCost > 0
      ? visualizedMaxLossAtExpiry / visualizedSnapshot.totalCost
      : null;
  const visualizedScenarioVisualizerInputs = useMemo(
    () => ({
      strategy: visualizedInputs.strategy,
      currentPrice: visualizedInputs.spot,
      longStrike: visualizedInputs.longStrike,
        shortStrike: visualizedInputs.shortStrike,
        ratioShortCount: visualizedInputs.ratioShortCount,
      shortExpirationDays: visualizedSnapshot.shortExpirationDays,
      calendarShortPrice: visualizedInputs.calendarShortPrice,
        currentDte: visualizedSnapshot.expirationDays,
      numberOfSpreads: visualizedSnapshot.contracts,
      entryDebit: visualizedSnapshot.entryPremium,
      impliedVolatilityPct: visualizedInputs.futureVolatilityPct,
      riskFreeRatePct: visualizedInputs.ratePct,
      dividendYieldPct: visualizedInputs.dividendYieldPct,
    }),
    [visualizedInputs, visualizedSnapshot],
  );
  const graphRenderKey = [
    selectedGraphComparison.id,
    visualizedInputs.strategy,
    visualizedInputs.longStrike,
      visualizedInputs.shortStrike,
      visualizedInputs.ratioShortCount,
    visualizedSnapshot.shortExpirationDays,
    visualizedInputs.calendarShortPrice,
      visualizedInputs.futureVolatilityPct,
    visualizedSnapshot.contracts,
    visualizedSnapshot.unitCost,
  ].join("|");
  const timelineRows = useMemo<TimelineTableRow[]>(
    () =>
      canModel
        ? buildTimelineRows(inputs).map((row) => ({
            id: row.dateIso,
            ...row,
          }))
        : [],
    [canModel, inputs],
  );
  const priceRows = useMemo<PriceTableRow[]>(
    () =>
      canModel
        ? buildPriceLadderRows(inputs).map((row) => ({
            id: `${row.price}`,
            ...row,
          }))
        : [],
    [canModel, inputs],
  );
  const decayPoints = useMemo<TimeDecayPoint[]>(() => {
    const visualizedExpirationDays = visualizedSnapshot.expirationDays;

    if (!canModel || visualizedExpirationDays <= 0) {
      return [];
    }

    const sampleCount = Math.min(Math.max(visualizedExpirationDays + 1, 12), 80);
    const offsets = [
      ...new Set([
        ...Array.from({ length: sampleCount }, (_, index) =>
          Math.round(
            (visualizedExpirationDays * index) / Math.max(sampleCount - 1, 1),
          ),
        ),
        ...(visualizedInputs.strategy === "call-calendar"
          ? [visualizedSnapshot.shortExpirationDays]
          : []),
      ]),
    ].sort((first, second) => first - second);
    const seenOffsets = new Set<number>();
    return offsets.flatMap((offset) => {
      if (seenOffsets.has(offset)) return [];
      seenOffsets.add(offset);
      const decaySnapshot = createScenarioSnapshot({
        ...visualizedInputs,
        scenarioOffsetDays: clamp(offset, 0, visualizedExpirationDays),
      });
      return [{
        offsetDays: offset,
        dateIso: decaySnapshot.selectedDateIso,
        positionValue: decaySnapshot.scenarioPositionValue,
        pnl: decaySnapshot.pnl,
      }];
    });
  }, [
    canModel,
    visualizedInputs,
    visualizedSnapshot.expirationDays,
    visualizedSnapshot.shortExpirationDays,
  ]);

  const timelineColumns: TableColumn<TimelineTableRow>[] = [
    {
      key: "date",
      label: "Date",
      render: (row) => (
        <div>
          <div>{formatLongDate(row.dateIso)}</div>
          <div className="mt-1 text-xs text-ink-muted">
            {row.daysRemaining} days left
          </div>
        </div>
      ),
    },
    {
      key: "unitValue",
      label: strategyCopy.unitColumnLabel,
      align: "right",
      render: (row) => formatCurrency(row.unitValue * CONTRACT_MULTIPLIER),
    },
    {
      key: "positionValue",
      label: "Position value",
      align: "right",
      render: (row) => formatCurrency(row.positionValue),
    },
    {
      key: "intrinsic",
      label: "Intrinsic floor",
      align: "right",
      render: (row) => formatCurrency(row.intrinsicValue * 100),
    },
    {
      key: "pnl",
      label: "P/L",
      align: "right",
      render: (row) => (
        <span className={cn(row.pnl >= 0 ? "text-gain" : "text-loss")}>
          {formatCurrency(row.pnl)}
        </span>
      ),
    },
    {
      key: "roi",
      label: "Return",
      align: "right",
      render: (row) => (
        <span className={cn(row.roi >= 0 ? "text-gain" : "text-loss")}>
          {formatPercent(row.roi)}
        </span>
      ),
    },
  ];

  const priceColumns: TableColumn<PriceTableRow>[] = [
    {
      key: "price",
      label: `${symbol.trim() || "Underlying"} price`,
      render: (row) => formatCurrency(row.price),
    },
    {
      key: "unitValue",
      label: strategyCopy.unitColumnLabel,
      align: "right",
      render: (row) => formatCurrency(row.unitValue * CONTRACT_MULTIPLIER),
    },
    {
      key: "positionValue",
      label: "Position value",
      align: "right",
      render: (row) => formatCurrency(row.positionValue),
    },
    {
      key: "pnl",
      label: "P/L",
      align: "right",
      render: (row) => (
        <span className={cn(row.pnl >= 0 ? "text-gain" : "text-loss")}>
          {formatCurrency(row.pnl)}
        </span>
      ),
    },
    {
      key: "roi",
      label: "Return",
      align: "right",
      render: (row) => (
        <span className={cn(row.roi >= 0 ? "text-gain" : "text-loss")}>
          {formatPercent(row.roi)}
        </span>
      ),
    },
  ];
  const shortStrikeOtmActions = [5, 10, 20, 30].map((percent) => ({
    label: `${percent}% OTM`,
    value: getOtmStrike(spot, percent),
  }));
  const shortPutStrikeOtmActions = [5, 10, 20, 30].map((percent) => ({
    label: `${percent}% OTM`,
    value: getOtmPutStrike(spot, percent),
  }));
  const callStrikeActions = [
    {
      label: "ATM",
      value: Math.round(spot),
    },
    ...[5, 10, 20].map((percent) => ({
      label: `${percent}% OTM`,
      value: getOtmStrike(spot, percent),
    })),
  ];
  const putStrikeActions = [
    {
      label: "ATM",
      value: Math.round(spot),
    },
    ...[5, 10, 20].map((percent) => ({
      label: `${percent}% OTM`,
      value: getOtmPutStrike(spot, percent),
    })),
  ];
  const updateStrategySelection = (nextStrategy: OptionStrategy) => {
    const nextDefaultStrikes = getDefaultStrikesForStrategy(nextStrategy, spot, {
      expirationDays,
      volatilityPct,
      ratioShortCount: putRatioShortCount,
      ratePct,
    });

    setStrategy(nextStrategy);
    setLongStrike(nextDefaultStrikes.longStrike);
    setShortStrike(nextDefaultStrikes.shortStrike);
    if (nextStrategy === "call-calendar") {
      setShortExpirationDays(getDefaultCallCalendarShortExpirationDays(expirationDays));
      setCalendarShortPrice(effectiveScenarioPrice);
      setCalendarShortPriceDraft(null);
    }
    setScenarioGraphView("map");
  };
  const isTopBarVisible = isTopBarPinnedVisible || isTopBarHoverRevealed;
  const isAnalysisVisible = isTabbedAnalysis || isTabbedHeatMap;
  const ivToolInstrument: IvComparisonInstrument =
    visualizedInputs.strategy === "long-call"
      ? "long-call"
      : "debit-call-spread";
  const ivToolLongStrike = visualizedInputs.longStrike;
  const ivToolShortStrike =
    visualizedInputs.shortStrike > ivToolLongStrike
      ? visualizedInputs.shortStrike
      : roundTo(
          ivToolLongStrike + Math.max(1, visualizedInputs.spot * 0.05),
          STRIKE_DECIMAL_DIGITS,
        );
  const stepHeader = (number: string, title: string, hint: string) => (
    <header className="flex min-w-0 items-start gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-950 font-mono text-xs font-semibold text-white tabular-nums">
        {number}
      </span>
      <div className="min-w-0">
        <h3 className="font-[family:var(--font-space-grotesk)] text-base font-semibold leading-tight text-ink text-balance">
          {title}
        </h3>
        <p className="mt-0.5 text-xs leading-5 text-ink-muted text-pretty">{hint}</p>
      </div>
    </header>
  );

  const setupInputControls = (
    <div
      className={cn(
        "grid min-w-0 gap-section",
        "lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]",
      )}
    >
      <section className="min-w-0 space-y-3">
        {stepHeader("1", "Stock setup", "Set the underlying assumptions.")}
        <label className="flex min-w-0 items-center gap-3 rounded-panel bg-surface-muted px-panel py-2">
          <span className="shrink-0 text-caption font-medium uppercase tracking-wide text-ink-muted">
            Ticker
          </span>
          <input
            type="text"
            value={symbol}
            onChange={(event) => setSymbol(event.target.value.toUpperCase())}
            className="min-w-0 flex-1 border-0 bg-transparent p-0 font-mono text-sm font-semibold text-ink outline-none"
            placeholder="AAPL"
          />
        </label>

        <NumberSliderField
          label="Current price"
          help={`Used to price the ${strategyCopy.unitName} today.`}
          min={5}
          max={currentPriceSliderMax}
          step={0.01}
          value={spot}
          onChange={updateSpot}
          prefix="$"
          allowDecimals
        />

        <NumberSliderField
          label="Current IV"
          help={`Used to estimate today's ${strategyCopy.unitName} cost.`}
          min={5}
          max={150}
          step={0.1}
          value={volatilityPct}
          onChange={updateVolatilityPct}
          suffix="%"
          allowDecimals
        />

        <NumberSliderField
          label="Days to expiration"
          help={`The ${strategyCopy.unitName} value moves toward intrinsic value as DTE approaches zero.`}
          min={0}
          max={365}
          step={1}
          value={expirationDays}
          onChange={updateExpirationDays}
          suffix=" DTE"
          quickActions={[7, 14, 30, 45, 60, 90].map((days) => ({
            label: `${days}d`,
            value: days,
          }))}
        />

        <details className="group rounded-panel bg-surface-muted">
          <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm font-medium text-ink-soft">
            <span>Advanced pricing</span>
            <span className="text-xs text-ink-muted transition-transform group-open:rotate-180">
              ▾
            </span>
          </summary>
          <div className="space-y-3 border-t border-line px-3 py-3">
            <label className="block">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-900">Risk-free rate</span>
                <InfoIcon label="Annualized rate used in the Black-Scholes model." />
              </div>
              <div className="mt-2 flex items-center rounded-md border border-line-strong bg-surface px-3 py-1.5">
                <input
                  type="text"
                  inputMode="decimal"
                  value={ratePctDraft}
                  min={0}
                  max={15}
                  pattern="[0-9]*[.]?[0-9]*"
                  aria-label="Risk-free rate"
                  onBlur={commitRatePctDraft}
                  onKeyDown={handleRatePctKeyDown}
                  onChange={(event) => updateRatePctDraft(event.target.value)}
                  className="w-full border-0 bg-transparent p-0 font-mono text-sm text-ink outline-none"
                />
                <span className="text-sm text-ink-muted">%</span>
              </div>
            </label>

            <div className="rounded-md border border-accent-border bg-accent-soft p-2.5 text-xs text-accent-strong">
              <p className="font-medium">Model assumptions</p>
              <p className="mt-1 leading-5 text-pretty">
                {strategyCopy.modelAssumptions}
              </p>
            </div>
          </div>
        </details>
      </section>

      <section className="min-w-0 space-y-3 border-t border-line pt-section lg:border-l lg:border-t-0 lg:pl-section lg:pt-0">
        {stepHeader(
          "2",
          "Pick a strategy",
            strategy === "debit-call-spread"
              ? "Buy one call and sell a higher-strike call. Defined risk, capped upside."
              : strategy === "call-ratio-spread"
                ? `Buy one call and sell ${putRatioShortCount} higher-strike calls. Best at the short strike with uncapped upside risk.`
            : strategy === "call-calendar"
              ? "Buy a later-dated call and sell a nearer-dated call at the same strike."
              : strategy === "bear-put"
                ? "Buy one put. Bearish, defined risk, profit increases as the stock falls."
            : strategy === "debit-put-spread"
              ? "Buy one put and sell a lower-strike put. Defined risk, capped downside profit."
              : strategy === "bull-put-spread"
                ? "Sell one put and buy a lower-strike put. Bullish, with defined risk and capped profit."
              : strategy === "put-ratio-spread"
                ? `Buy one put and sell ${putRatioShortCount} lower-strike puts. Best at the short strike with extra downside risk.`
                : "Buy a single call. Higher risk, uncapped upside.",
        )}
        <label className="block min-w-0 xl:hidden">
          <span className="sr-only">Option strategy</span>
          <select
            value={strategy}
            onChange={(event) => updateStrategySelection(event.target.value as OptionStrategy)}
            className="w-full rounded-md border border-line-strong bg-surface px-3 py-2 font-medium text-ink shadow-sm outline-none focus:border-accent"
          >
            {STRATEGY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div
            className="hidden min-w-0 grid-cols-4 gap-2 xl:grid"
          role="group"
          aria-label="Option strategy"
        >
          {STRATEGY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={strategy === option.value}
              title={option.description}
              onClick={() => updateStrategySelection(option.value)}
              className={cn(
                "min-w-0 rounded-md border border-line-strong bg-surface px-3 py-2 text-center text-sm font-semibold leading-tight text-ink-soft shadow-sm text-balance focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                strategy === option.value &&
                  "border-accent bg-accent-soft text-ink",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        {isDebitSpread && (
          isPutDownsideSpread ? shortStrike < longStrike : shortStrike > longStrike
        ) ? (
          <p className="rounded-panel bg-surface-muted px-panel py-2 text-xs text-ink-secondary">
            <span className="font-semibold text-slate-900">
              {formatStrikeCurrency(Math.abs(shortStrike - longStrike))} wide
            </span>{" "}
            spread between long and short strikes.
          </p>
        ) : null}
          {isCallCalendar ? (
          <>
            <NumberSliderField
              label="Call strike"
              help="The strike used for both the longer-dated long call and the nearer-dated short call."
              min={5}
              max={longStrikeSliderMax}
              step={0.01}
              allowDecimals
              value={longStrike}
              onChange={(nextValue) => {
                const nextLongStrike = normalizeStrikeValue(nextValue);
                setLongStrike(nextLongStrike);
                setShortStrike(nextLongStrike);
              }}
              prefix="$"
              quickActions={callStrikeActions}
            />

            <NumberSliderField
              label="Short call DTE"
              help="The nearer expiration for the call you sell."
              min={0}
              max={Math.max(0, expirationDays - 1)}
              step={1}
              value={normalizeCallCalendarShortExpirationDays(
                shortExpirationDays,
                expirationDays,
              )}
              onChange={(nextValue) =>
                setShortExpirationDays(
                  normalizeCallCalendarShortExpirationDays(
                    nextValue,
                    expirationDays,
                  ),
                )
              }
              suffix=" DTE"
              quickActions={[7, 14, 21, 30, 45].flatMap((days) =>
                days < expirationDays ? [{ label: `${days}d`, value: days }] : [],
              )}
            />
          </>
        ) : isDebitSpread ? (
            <>
            <NumberSliderField
              label={isPutSpread ? "Long put (buy)" : "Long call (buy)"}
              help="The strike you buy."
              min={5}
              max={longStrikeSliderMax}
              step={0.01}
              allowDecimals
              value={longStrike}
              onChange={(nextValue) => {
                const nextLongStrike = normalizeStrikeValue(nextValue);
                setLongStrike(nextLongStrike);
                setShortStrike((currentShortStrike) =>
                  isPutDownsideSpread
                    ? currentShortStrike
                    : normalizeShortStrikeForStrategy(
                        strategy,
                        nextLongStrike,
                        currentShortStrike,
                      ),
                );
              }}
              prefix="$"
              quickActions={isPutSpread ? putStrikeActions : callStrikeActions}
            />

            <NumberSliderField
              label={
                isPutRatioSpread
                  ? `Short puts (sell ${putRatioShortCount})`
                  : isCallRatioSpread
                    ? `Short calls (sell ${putRatioShortCount})`
                  : isPutSpread
                    ? "Short put (sell)"
                    : "Short call (sell)"
              }
              help={
                isPutRatioSpread
                  ? `The strike where you sell ${putRatioShortCount} puts.`
                  : isCallRatioSpread
                    ? `The strike where you sell ${putRatioShortCount} calls.`
                  : "The strike you sell."
              }
              min={5}
              max={shortStrikeSliderMax}
              step={0.01}
              allowDecimals
              value={shortStrike}
              onChange={(nextValue) =>
                setShortStrike(
                  isPutDownsideSpread
                    ? normalizeStrikeValue(nextValue)
                    : normalizeShortStrikeForStrategy(strategy, longStrike, nextValue),
                )
              }
              prefix="$"
              quickActions={
                isPutSpread ? shortPutStrikeOtmActions : shortStrikeOtmActions
              }
            />
            {isRatioSpread ? (
              <NumberSliderField
                label="Ratio"
                help={
                  isPutRatioSpread
                    ? "The number of lower-strike puts sold for each long put."
                    : "The number of higher-strike calls sold for each long call."
                }
                min={PUT_RATIO_SHORT_COUNT_MIN}
                max={PUT_RATIO_SHORT_COUNT_MAX}
                step={1}
                value={putRatioShortCount}
                onChange={(nextValue) =>
                  setPutRatioShortCount(normalizePutRatioShortCount(nextValue))
                }
                prefix="1 / "
              />
            ) : null}
          </>
        ) : (
          <NumberSliderField
            label={isBearPut ? "Put strike" : "Call strike"}
            help={
              isBearPut
                ? "The strike price of the put you buy."
                : "The strike price of the call you buy."
            }
            min={5}
            max={longStrikeSliderMax}
            step={0.01}
            allowDecimals
            value={longStrike}
            onChange={(nextValue) => {
              const nextLongStrike = normalizeStrikeValue(nextValue);

              setLongStrike(nextLongStrike);
              if (isBearPut) {
                setShortStrike(nextLongStrike);
              }
            }}
            prefix="$"
            quickActions={isBearPut ? putStrikeActions : callStrikeActions}
          />
        )}

        <NumberSliderField
          label="Capital to deploy"
          help={strategyCopy.capitalHelp}
          min={500}
          max={100000}
          step={100}
          value={capital}
          onChange={setCapital}
          prefix="$"
          displayScale={moneyDisplayUnitScale}
          displaySuffix={moneyDisplayUnitSuffix}
        />

        <div
          className="flex min-w-0 flex-col gap-3 rounded-panel bg-surface-muted px-panel py-2 min-[360px]:flex-row min-[360px]:items-center min-[360px]:justify-between"
          role="group"
          aria-label="Position sizing"
        >
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="text-sm font-medium text-slate-900">Contracts</span>
            <InfoIcon label="Whole rounds down so the position fits in cash. Fractional uses the full capital amount as if partial contracts were tradable." />
          </div>
          <div className="inline-flex min-w-0 rounded-md border border-line-strong bg-surface p-0.5">
            {[
              { label: "Whole", value: false },
              { label: "Fractional", value: true },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                aria-pressed={allowFractionalContracts === option.value}
                onClick={() => setAllowFractionalContracts(option.value)}
                className={cn(
                  "rounded-sm px-2.5 py-1 text-xs font-medium text-ink-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                  allowFractionalContracts === option.value &&
                    "bg-accent-soft text-accent-strong",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <RatioCreditSummary snapshot={snapshot} />
        <div className="grid min-w-0 gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            disabled={!canModel}
            onClick={() => {
              addCurrentStrategyComparison();
              changeWorkflowTab("decision");
            }}
            className="rounded-md border border-accent bg-accent px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-accent-hover disabled:cursor-not-allowed disabled:border-line-strong disabled:bg-slate-200 disabled:text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Create Strategy
          </button>
        </div>
      </section>
    </div>
  );

  const scenarioControlsBlock = (
    <div
      className={cn(
        "grid min-w-0 gap-2",
        shouldShowCalendarShortPrice ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-3",
      )}
    >
      <div className="min-w-0 rounded-lg border border-line bg-surface-muted p-2.5 shadow-sm sm:p-3">
        <div className="grid min-h-9 grid-cols-[minmax(0,1fr)_6.25rem] items-start gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <p className="min-w-0 text-sm font-medium leading-tight text-slate-900 text-balance">
              {shouldShowCalendarShortPrice ? "Valuation stock price" : "Future stock price"}
            </p>
            <InfoIcon
              label={
                shouldShowCalendarShortPrice
                  ? "The stock price used to value the remaining long call on the selected valuation date."
                  : "The stock price to test on the selected future date."
              }
            />
          </div>
          <div className="w-[6.25rem] min-w-0 shrink-0">
            <div className="flex items-center rounded-md border border-line-strong bg-surface px-2 py-1.5">
              <span className="text-sm text-ink-muted">$</span>
              <input
                type="number"
                value={displayedScenarioPriceInputValue}
                min={scenarioPriceSliderMin}
                max={scenarioPriceSliderMax}
                step={0.01}
                aria-label={
                  shouldShowCalendarShortPrice
                    ? "Valuation stock price"
                    : "Future stock price"
                }
                onFocus={() =>
                  setScenarioPriceDraft(String(scenarioPriceInputValue))
                }
                onBlur={(event) =>
                  commitScenarioPriceDraft(event.currentTarget.value)
                }
                onKeyDown={handleScenarioPriceKeyDown}
                onInput={(event) =>
                  updateScenarioPriceDraft(event.currentTarget.value)
                }
                onChange={(event) =>
                  updateScenarioPriceDraft(event.target.value)
                }
                className="w-full border-0 bg-transparent p-0 font-mono text-right text-sm font-medium text-ink outline-none tabular-nums"
              />
            </div>
          </div>
        </div>
        <input
          type="range"
          min={scenarioPriceSliderMin}
          max={scenarioPriceSliderMax}
          step={0.01}
          value={effectiveScenarioPrice}
          aria-label={
            shouldShowCalendarShortPrice
              ? "Valuation stock price"
              : "Future stock price"
          }
          onChange={(event) => updateScenarioPrice(Number(event.target.value))}
          onMouseDown={blurFocusedField}
          onPointerDown={blurFocusedField}
          onTouchStart={blurFocusedField}
          style={getRangeTrackStyle(
            effectiveScenarioPrice,
            scenarioPriceSliderMin,
            scenarioPriceSliderMax,
          )}
          className="mt-2.5 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-accent"
        />
        <div className="mt-1.5 grid min-h-5 grid-cols-[3.5rem_minmax(0,1fr)_3.5rem] items-start gap-1 font-mono text-micro text-ink-muted tabular-nums sm:text-caption">
          <span className="whitespace-nowrap">{formatCurrency(scenarioPriceSliderMin)}</span>
          <span className="min-w-0 truncate whitespace-nowrap text-center text-ink-secondary">
            {spot > 0
              ? `${effectiveScenarioPrice >= spot ? "+" : ""}${Math.round(
                  ((effectiveScenarioPrice - spot) / spot) * 100,
                )}% vs spot ${formatPriceCurrency(spot)}`
              : ""}
          </span>
          <span className="whitespace-nowrap text-right">{formatCurrency(scenarioPriceSliderMax)}</span>
        </div>
      </div>

      {shouldShowCalendarShortPrice ? (
        <div className="min-w-0 rounded-lg border border-line bg-surface-muted p-2.5 shadow-sm sm:p-3">
          <div className="grid min-h-9 grid-cols-[minmax(0,1fr)_6.25rem] items-start gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <p className="min-w-0 text-sm font-medium leading-tight text-slate-900 text-balance">
                Short expiry stock price
              </p>
              <InfoIcon label="The stock price used when the short call expires. After this date, that short call payoff is fixed." />
            </div>
            <div className="w-[6.25rem] min-w-0 shrink-0">
              <div className="flex items-center rounded-md border border-line-strong bg-surface px-2 py-1.5">
                <span className="text-sm text-ink-muted">$</span>
                <input
                  type="number"
                  value={displayedCalendarShortPriceInputValue}
                  min={scenarioPriceSliderMin}
                  max={calendarShortPriceSliderMax}
                  step={0.01}
                  aria-label="Short expiry stock price"
                  onFocus={() =>
                    setCalendarShortPriceDraft(String(calendarShortPriceInputValue))
                  }
                  onBlur={(event) =>
                    commitCalendarShortPriceDraft(event.currentTarget.value)
                  }
                  onKeyDown={handleCalendarShortPriceKeyDown}
                  onInput={(event) =>
                    updateCalendarShortPriceDraft(event.currentTarget.value)
                  }
                  onChange={(event) =>
                    updateCalendarShortPriceDraft(event.target.value)
                  }
                  className="w-full border-0 bg-transparent p-0 font-mono text-right text-sm font-medium text-ink outline-none tabular-nums"
                />
              </div>
            </div>
          </div>
          <input
            type="range"
            min={scenarioPriceSliderMin}
            max={calendarShortPriceSliderMax}
            step={0.01}
            value={safeCalendarShortPrice}
            aria-label="Short expiry stock price"
            onChange={(event) => updateCalendarShortPrice(Number(event.target.value))}
            onMouseDown={blurFocusedField}
            onPointerDown={blurFocusedField}
            onTouchStart={blurFocusedField}
            style={getRangeTrackStyle(
              safeCalendarShortPrice,
              scenarioPriceSliderMin,
              calendarShortPriceSliderMax,
            )}
            className="mt-2.5 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-accent"
          />
          <div className="mt-1.5 grid min-h-5 grid-cols-[3.5rem_minmax(0,1fr)_3.5rem] items-start gap-1 font-mono text-micro text-ink-muted tabular-nums sm:text-caption">
            <span className="whitespace-nowrap">{formatCurrency(scenarioPriceSliderMin)}</span>
            <span className="min-w-0 truncate whitespace-nowrap text-center text-ink-secondary">
              {formatLongDate(calendarShortExpiryDateIso)}
            </span>
            <span className="whitespace-nowrap text-right">{formatCurrency(calendarShortPriceSliderMax)}</span>
          </div>
        </div>
      ) : null}

      <div className="min-w-0 rounded-lg border border-line bg-surface-muted p-2.5 shadow-sm sm:p-3">
        <div className="grid min-h-9 grid-cols-[minmax(0,1fr)_7rem] items-start gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <p className="min-w-0 text-sm font-medium leading-tight text-slate-900 text-balance">Valuation date</p>
            <InfoIcon
              label="The date used to estimate what each position could be worth before expiration."
            />
          </div>
          <div className="w-[7rem] min-w-0 shrink-0">
            <div className="flex items-center rounded-md border border-line-strong bg-surface px-2 py-1.5 shadow-sm">
              <input
                type="number"
                min={0}
                max={marketScenarioMaxOffsetDays}
                step={1}
                value={displayedValuationDteInputValue}
                disabled={marketScenarioMaxOffsetDays === 0}
                aria-label={
                  valuationDateInputMode === "elapsed"
                    ? "Valuation days past"
                    : "Valuation DTE remaining"
                }
                onFocus={() =>
                  setValuationDteDraft(String(valuationDateInputValue))
                }
                onBlur={(event) =>
                  commitValuationDteDraft(event.currentTarget.value)
                }
                onKeyDown={handleValuationDteKeyDown}
                onInput={(event) =>
                  updateValuationDteDraft(event.currentTarget.value)
                }
                onChange={(event) =>
                  updateValuationDteDraft(event.target.value)
                }
                className="w-full border-0 bg-transparent p-0 font-mono text-right text-sm font-medium text-ink outline-none disabled:text-slate-400 tabular-nums"
              />
              <span className="ml-1 shrink-0 text-xs font-medium text-ink-muted">
                {valuationDateInputMode === "elapsed" ? "days" : "DTE"}
              </span>
            </div>
            <div className="mt-1 truncate whitespace-nowrap text-right font-mono text-caption leading-tight text-ink-muted tabular-nums">
              {formatLongDate(marketScenarioDateIso)}
            </div>
          </div>
        </div>
        <div
          className="mt-2 grid grid-cols-2 rounded-md border border-line bg-surface-sunken p-1"
          role="radiogroup"
          aria-label="Valuation date input mode"
        >
          <button
            type="button"
            role="radio"
            aria-checked={valuationDateInputMode === "elapsed"}
            onClick={() => updateValuationDateInputMode("elapsed")}
            className={cn(
              "min-w-0 rounded px-2 py-1 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              valuationDateInputMode === "elapsed"
                ? "bg-surface text-ink shadow-sm"
                : "text-ink-secondary hover:text-ink",
            )}
          >
            Days past
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={valuationDateInputMode === "remaining"}
            onClick={() => updateValuationDateInputMode("remaining")}
            className={cn(
              "min-w-0 rounded px-2 py-1 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              valuationDateInputMode === "remaining"
                ? "bg-surface text-ink shadow-sm"
                : "text-ink-secondary hover:text-ink",
            )}
          >
            DTE remaining
          </button>
        </div>
        <input
          type="range"
          min={0}
          max={marketScenarioMaxOffsetDays}
          step={1}
          value={safeScenarioOffsetDays}
          disabled={marketScenarioMaxOffsetDays === 0}
          aria-label="Valuation date"
          onChange={(event) => updateScenarioOffsetDays(Number(event.target.value))}
          onMouseDown={blurFocusedField}
          onPointerDown={blurFocusedField}
          onTouchStart={blurFocusedField}
          style={getRangeTrackStyle(safeScenarioOffsetDays, 0, marketScenarioMaxOffsetDays)}
          className="mt-2.5 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-accent"
        />
        <div className="mt-1.5 grid min-h-5 grid-cols-2 gap-2 font-mono text-micro leading-tight text-ink-muted tabular-nums sm:text-caption">
          <span className="truncate whitespace-nowrap">
            {formatLongDate(todayIso)} · {marketScenarioMaxOffsetDays} DTE
          </span>
          <span className="truncate whitespace-nowrap text-right">
            {formatLongDate(marketScenarioMaxDateIso)} · 0 DTE
          </span>
        </div>
      </div>

      <NumberSliderField
        label="Future IV"
        help="Used to estimate each position value on the selected future date unless initial IV mode is on."
        min={0}
        max={300}
        step={0.1}
        value={futureVolatilityPct}
        onChange={updateFutureScenarioVolatilityPct}
        suffix="%"
        allowDecimals
        className="p-2.5 sm:p-3"
        headerClassName="min-h-9 grid grid-cols-[minmax(0,1fr)_6.25rem] items-start gap-2 sm:grid-cols-[minmax(0,1fr)_6.25rem] sm:items-start"
        sliderClassName="mt-2.5"
        toggleAction={{
          label: "Use each strategy's initial IV",
          pressed: useInitialIvForStrategies,
          onClick: () =>
            setUseInitialIvForStrategies((currentValue) => !currentValue),
        }}
      />
    </div>
  );
  const marketScenarioIvSummary = useInitialIvForStrategies
    ? "Initial IVs"
    : `${compactNumber(futureVolatilityPct)}% IV`;
  const marketScenarioSummary = (
    shouldShowCalendarShortPrice
      ? [
          `${formatPriceCurrency(safeCalendarShortPrice)} short expiry`,
          `${formatPriceCurrency(effectiveScenarioPrice)} valuation`,
          formatLongDate(marketScenarioDateIso),
          `${marketScenarioDte} DTE`,
          marketScenarioIvSummary,
        ]
      : [
          `${formatPriceCurrency(effectiveScenarioPrice)} stock`,
          formatLongDate(marketScenarioDateIso),
          `${marketScenarioDte} DTE`,
          marketScenarioIvSummary,
        ]
  ).join(" · ");
  const marketScenarioCard = (
    <section className="min-w-0 overflow-hidden rounded-lg border border-line bg-surface shadow-sm transition-colors hover:border-accent hover:bg-surface-muted">
      <div className="min-w-0">
        <button
          type="button"
          aria-expanded={isMarketScenarioOpen}
          aria-label={
            isMarketScenarioOpen ? "Close market scenario" : "Open market scenario"
          }
          onClick={() => setIsMarketScenarioOpen((currentValue) => !currentValue)}
          className="flex w-full min-w-0 items-center gap-2 bg-transparent px-3 py-2 text-left transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-accent"
        >
          <span
            aria-hidden
            className="flex size-7 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface-muted text-ink-soft shadow-sm"
          >
            <svg
              viewBox="0 0 20 20"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={isMarketScenarioOpen ? "M5 12l5-5 5 5" : "M5 8l5 5 5-5"} />
            </svg>
          </span>
          <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-[family:var(--font-space-grotesk)] text-sm font-semibold text-ink">
              Market scenario
            </span>
            <span className="min-w-0 truncate font-mono text-xs text-ink-secondary tabular-nums">
              {marketScenarioSummary}
            </span>
          </span>
        </button>
      </div>
      {isMarketScenarioOpen ? (
        <div className="border-t border-line p-2">{scenarioControlsBlock}</div>
      ) : null}
    </section>
  );

  const setupFormFields = (
    <div className="grid min-w-0 gap-x-2 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-[minmax(10rem,18rem)_minmax(10rem,18rem)_minmax(10rem,18rem)]">
      <label className="block min-w-0">
        <span className="text-xs font-medium text-ink-muted">Ticker</span>
        <input
          type="text"
          value={symbol}
          onChange={(event) => setSymbol(event.target.value.toUpperCase())}
          className="mt-0.5 w-full rounded-md border border-line-strong bg-surface px-2.5 py-1 font-mono text-sm font-medium text-ink shadow-sm outline-none focus:border-accent"
          placeholder="AAPL"
        />
      </label>

      <CompactNumberInput
        label="Current price"
        value={spot}
        min={1}
        prefix="$"
        step={0.01}
        allowDecimals
        onChange={(value) => updateSpot(Math.max(1, value))}
      />

      <CompactNumberInput
        label="Current IV"
        value={volatilityPct}
        min={0}
        suffix="%"
        step={0.1}
        allowDecimals
        onChange={(value) => updateVolatilityPct(clamp(value, 0, 150))}
      />
    </div>
  );
  return (
    <main
      ref={scrollContainerRef}
      data-color-scheme={colorScheme}
      className="h-dvh overflow-x-hidden overflow-y-auto overscroll-none bg-stone-100 text-slate-900"
    >
      <div className="mx-auto w-full max-w-7xl px-2 pb-2 pt-1 sm:px-4 sm:pb-3 md:px-6">
        <h1 className="sr-only">Callculator debit spread strategy simulator</h1>
        <div className="grid min-w-0 items-start gap-2">

          <div className="min-w-0 space-y-2">

            <div
              onFocusCapture={() => setIsTopBarPinnedVisible(true)}
              onMouseEnter={revealTopBarFromEdge}
              onMouseLeave={hideTopBarHoverReveal}
              onPointerEnter={revealTopBarFromEdge}
              onPointerLeave={queueTopBarHoverRevealHide}
              className={cn(
                "sticky top-1 z-50 grid min-w-0 gap-2 transform-gpu transition duration-200 ease-out will-change-transform motion-reduce:transition-none",
                isTopBarVisible
                  ? "translate-y-0 opacity-100"
                  : "pointer-events-none -translate-y-[calc(100%+0.75rem)] opacity-0",
                "grid-cols-1 rounded-xl border border-line bg-surface/95 p-1.5 shadow-lg shadow-slate-900/10 backdrop-blur md:grid-cols-[minmax(0,1fr)_auto]",
              )}
            >
              <WorkflowTabs activeTab={activeWorkflowTab} onChange={changeWorkflowTab} />
              <div className="flex min-w-0 items-stretch justify-end gap-2">

                <SettingsWidget
                  colorScheme={colorScheme}
                  moneyDisplayUnit={moneyDisplayUnit}
                  updateStrikesWithPrice={updateStrikesWithPrice}
                  onColorSchemeChange={setColorScheme}
                  onMoneyDisplayUnitChange={setMoneyDisplayUnit}
                  onUpdateStrikesWithPriceChange={setUpdateStrikesWithPrice}
                />
                <AiHelp context={JSON.stringify({
                  symbol: selectedSavedStrategyCard?.symbol ?? symbol,
                  activeTab: activeWorkflowTab,
                  inputs: visualizedInputs,
                  results: canModel ? visualizedSnapshot : null,
                  validationMessages,
                  pricing: "Theoretical Black-Scholes model; not live market quotes. Monetary values are USD; one contract represents 100 shares.",
                })} />
              </div>
            </div>

            <ActiveSetupStrip
              symbol={symbol}
              spot={spot}
              volatilityPct={volatilityPct}
              expirationDays={expirationDays}
              strategy={strategy}
              longStrike={longStrike}
              shortStrike={shortStrike}
              ratioShortCount={putRatioShortCount}
              selectedStrategy={selectedSavedStrategyCard}
              isOpen={isCoreSetupOpen}
              strategyCount={customComparisonCards.length}
              onToggle={() => {
                setIsCoreSetupOpen(false);
                setIsSetupFormVisible(false);
              }}
              onOpen={() => {
                if (comparisonPanelMode !== "custom") {
                  seedCustomDraftFromCurrent();
                }
                if (graphComparisonId.startsWith("preset:")) {
                  setGraphComparisonId("editor");
                }
                setComparisonPanelMode("custom");
                setIsCustomComparisonEditorOpen(false);
                setIsSetupFormVisible(false);
                setIsCoreSetupOpen(true);
              }}
              strategiesPanel={
                <CustomComparisonBoard
                  cards={customComparisonCards}
                  draft={customDraft}
                  draftError={customDraftError}
                  draftSnapshot={customDraftSnapshot}
                  embedded
                  editingComparisonId={editingComparisonId}
                  isEditorOpen={isCustomComparisonEditorOpen}
                  setupForm={setupFormFields}
                  quickStartCards={isCustomComparisonEditorOpen ? comparisonCards : []}
                  saveActionLabel={editingComparisonId ? "Save changes" : "Save strategy"}
                  selectedCardId={selectedCustomCardId}
                  showSummary
                  showSetupForm={isSetupFormVisible}
                  moneyDisplayUnitScale={moneyDisplayUnitScale}
                  moneyDisplayUnitSuffix={moneyDisplayUnitSuffix}
                  currentSpot={spot}
                  currentVolatilityPct={volatilityPct}
                  currentRatePct={ratePct}
                  scenarioDateLabel={formatLongDate(snapshot.selectedDateIso)}
                  scenarioPrice={effectiveScenarioPrice}
                  symbol={symbol}
                  onDraftChange={setCustomDraft}
                  onAddComparison={addCustomComparison}
                  onAnalyzeCard={analyzeCustomComparison}
                  onClose={() => {
                    setEditingComparisonId(null);
                    setIsCustomComparisonEditorOpen(false);
                    setIsSetupFormVisible(false);
                  }}
                  onEditComparison={editCustomComparison}
                  onOpenEditor={openCustomComparisonEditor}
                  onRemoveComparison={removeCustomComparison}
                  onReorderComparisons={reorderCustomComparisons}
                  onToggleSetupForm={() =>
                    setIsSetupFormVisible((currentValue) => !currentValue)
                  }
                  onUseQuickStart={useCustomQuickStart}
                />
              }
            />

            {activeWorkflowTab === "setup" ? (
              <div className="space-y-3">
                <SectionCard
                  title="Setup"
                  eyebrow={`${symbol.trim() || "Underlying"} stock details, then strategy`}
                >
                  {setupInputControls}

                  {validationMessages.length > 0 ? (
                    <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
                      <p className="font-medium">Fix these inputs first</p>
                      <ul className="mt-2 space-y-1">
                        {validationMessages.map((message) => (
                          <li key={message}>{message}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                </SectionCard>
              </div>
            ) : null}

            {activeWorkflowTab === "decision" ? (
              <div className="space-y-2">
                {marketScenarioCard}

                {comparisonBoardCards.length > 0 ? (
                  <DecisionComparisonBoard
                    cards={comparisonBoardCards}
                    selectedCardId={selectedComparisonBoardCardId}
                    view={decisionComparisonView}
                    onAnalyzeCard={analyzeCustomComparison}
                    onViewChange={changeDecisionComparisonView}
                  />
                ) : (
                  <div className="rounded-lg border border-dashed border-line-strong bg-surface p-6 text-sm text-ink-secondary shadow-sm">
                    <p className="font-medium text-slate-900">Nothing to compare yet.</p>
                    <p className="mt-1 text-sm text-ink-muted">
                      Save the strategy from Setup to see its outcomes here, then add more to compare side by side.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={!canModel}
                        onClick={() => {
                          addCurrentStrategyComparison();
                          changeWorkflowTab("decision");
                        }}
                        className="rounded-md border border-accent bg-accent px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-accent-hover disabled:cursor-not-allowed disabled:border-line-strong disabled:bg-slate-200 disabled:text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      >
                        Save current setup
                      </button>
                      <button
                        type="button"
                        onClick={() => changeWorkflowTab("setup")}
                        className="rounded-md border border-line-strong bg-surface px-3 py-2 text-sm font-semibold text-ink-soft shadow-sm hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      >
                        Back to Setup
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {activeWorkflowTab === "understanding-iv" ? (
              <UnderstandingIvTool
                key={selectedGraphComparison.id}
                symbol={selectedSavedStrategyCard?.symbol ?? symbol}
                spot={visualizedInputs.spot}
                currentIvPct={visualizedInputs.volatilityPct}
                expirationDays={visualizedSnapshot.expirationDays}
                longStrike={ivToolLongStrike}
                shortStrike={ivToolShortStrike}
                ratePct={visualizedInputs.ratePct}
                todayIso={visualizedInputs.todayIso}
                capital={visualizedInputs.capital}
                allowFractionalContracts={
                  visualizedInputs.allowFractionalContracts
                }
                defaultInstrument={ivToolInstrument}
                onCreateStrategy={createIvAlternativeStrategy}
              />
            ) : null}

            {isAnalysisVisible ? (
              <>

                {!isTabbedHeatMap ? marketScenarioCard : null}

            <SectionCard
              title={isTabbedHeatMap ? "Heat map" : "Scenario curve"}
                eyebrow={
                  isTabbedHeatMap
                    ? "Value across stock price and DTE"
                    : "Value across stock price and time"
                }
              action={
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                  <label className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-lg border border-line bg-surface-muted px-2 py-1.5 shadow-sm sm:w-72">
                    <span className="text-xs font-semibold text-ink-muted">
                      Strategy
                    </span>
                    <select
                      value={selectedGraphComparison.id}
                      onChange={(event) => setGraphComparisonId(event.target.value)}
                      title={selectedGraphComparison.detail}
                      className="min-w-0 rounded-md border border-line-strong bg-surface px-2 py-1.5 text-xs font-semibold text-slate-800 shadow-sm outline-none focus:border-accent"
                      aria-label={isTabbedHeatMap ? "Heat map strategy" : "Scenario curve strategy"}
                    >
                      {graphComparisonOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                    <div
                      className="grid w-full min-w-0 grid-cols-3 rounded-lg border border-line bg-surface-sunken p-1 sm:inline-flex sm:w-auto sm:grid-cols-none"
                      aria-label="Analysis view"
                    >
                      {scenarioGraphOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          aria-pressed={activeDisplayGraphView === option.value}
                        onPointerDown={() => changeAnalysisView(option.value)}
                        onMouseDown={() => changeAnalysisView(option.value)}
                        onClick={() => changeAnalysisView(option.value)}
                        className={cn(
                          "min-w-0 truncate rounded-md px-1.5 py-1.5 text-center text-xs font-medium text-ink-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent min-[360px]:text-sm sm:px-3",
                            activeDisplayGraphView === option.value &&
                              "bg-surface text-ink shadow-sm",
                          )}
                      >
                        <span className="hidden min-[360px]:inline">{option.label}</span>
                        <span className="min-[360px]:hidden">{option.shortLabel}</span>
                        </button>
                      ))}
                    </div>
                </div>
              }
            >
              <div className="space-y-4">
                {showScenarioSelectionControls ? (
                    <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm">
                      <div className="grid divide-y divide-slate-200 md:grid-cols-3 md:divide-x md:divide-y-0">
                        <div className="grid min-w-0 grid-rows-[auto_2.25rem_auto] gap-2.5 p-3 lg:p-4">
                          <div className="grid grid-cols-[minmax(0,1fr)_7rem] items-baseline gap-2">
                            <p className="text-xs font-semibold uppercase text-ink-muted text-balance">
                              At your scenario
                              </p>
                              <p className="truncate text-right font-mono text-caption text-ink-muted tabular-nums">
                                {formatPriceCurrency(effectiveScenarioPrice)} · {formatLongDate(visualizedSnapshot.selectedDateIso)}
                              </p>
                            </div>
                            <p
                              className={cn(
                                  "overflow-hidden whitespace-nowrap font-[family:var(--font-space-grotesk)] text-2xl font-semibold leading-none tabular-nums",
                                visualizedSnapshot.pnl >= 0 ? "text-gain" : "text-loss",
                              )}
                            >
                              {visualizedSnapshot.pnl >= 0 ? "+" : ""}
                              {formatCurrency(visualizedSnapshot.pnl)}
                            </p>
                              <div className="grid grid-cols-[minmax(0,1fr)_7rem] items-baseline gap-2 text-sm">
                              <span className="font-medium text-ink-muted">
                                {visualizedSnapshot.pnl >= 0 ? "Profit" : "Loss"}
                                {" · "}
                                <span
                                  className={cn(
                                    "font-mono font-semibold tabular-nums",
                                    visualizedSnapshot.roi >= 0 ? "text-gain" : "text-loss",
                                  )}
                                >
                                  {visualizedSnapshot.totalCost > 0 ? formatPercent(visualizedSnapshot.roi) : "N/A"}
                                </span>
                              </span>
                              <span className="truncate text-right font-mono text-xs text-ink-muted tabular-nums">
                                Position {formatCurrency(visualizedSnapshot.scenarioPositionValue)}
                              </span>
                            </div>
                          </div>

                          {visualizedSnapshot.isProfitCapped ? (
                          <div className="grid min-w-0 grid-rows-[auto_2.25rem_auto] gap-2.5 p-3 lg:p-4">
                            <div className="grid grid-cols-[minmax(0,1fr)_6rem] items-baseline gap-2">
                            <p className="text-xs font-semibold uppercase text-ink-muted text-balance">
                              Best case at expiry
                            </p>
                            <p className="truncate text-right font-mono text-caption text-ink-muted tabular-nums">
                              {visualizedIsBearPut
                                ? "At $0"
                                : `${visualizedIsRatioSpread
                                ? "At"
                                : visualizedIsPutSpread
                                  ? "≤"
                                  : "≥"} ${formatStrikeCurrency(visualizedInputs.shortStrike)}`}
                            </p>
                          </div>
                            <p className="overflow-hidden whitespace-nowrap font-[family:var(--font-space-grotesk)] text-2xl font-semibold leading-none text-gain tabular-nums">
                            +{formatCurrency(visualizedMaxProfitAtExpiry ?? 0)}
                          </p>
                            <div className="grid grid-cols-[minmax(0,1fr)_6rem] items-baseline gap-2 text-sm">
                            <span className="font-medium text-ink-muted">
                              Max profit ·{" "}
                              <span className="font-mono font-semibold text-gain tabular-nums">
                                {visualizedMaxReturnAtExpiry !== null ? formatPercent(visualizedMaxReturnAtExpiry) : "N/A"}
                              </span>
                            </span>
                            <span className="truncate text-right font-mono text-xs text-ink-muted tabular-nums">
                              {getBreakEvenLabel(visualizedSnapshot)} {formatBreakEvenAtExpiry(visualizedSnapshot)}
                            </span>
                          </div>
                        </div>
                    ) : (
                          <div className="grid min-w-0 grid-rows-[auto_2.25rem_auto] gap-2.5 p-3 lg:p-4">
                            <div className="grid grid-cols-[minmax(0,1fr)_6rem] items-baseline gap-2">
                              <p className="text-xs font-semibold uppercase text-ink-muted text-balance">
                                {visualizedIsCallCalendar ? "Calendar target" : "Upside at expiry"}
                              </p>
                              <p className="truncate text-right font-mono text-caption text-ink-muted tabular-nums">
                                {visualizedIsCallCalendar
                                  ? `At ${formatCurrencyWithCents(visualizedSnapshot.breakEvenAtExpiry)}`
                                  : `≥ ${formatCurrencyWithCents(visualizedSnapshot.breakEvenAtExpiry)}`}
                              </p>
                            </div>
                          <p className="overflow-hidden whitespace-nowrap font-[family:var(--font-space-grotesk)] text-2xl font-semibold leading-none text-gain tabular-nums">
                            {visualizedIsCallCalendar ? "Open" : "Uncapped"}
                          </p>
                            <div className="grid grid-cols-[minmax(0,1fr)_6rem] items-baseline gap-2 text-sm">
                            <span className="font-medium text-ink-muted">
                              {visualizedIsCallCalendar
                                ? "Calendar value depends on how the short call expires."
                                : "Long calls have no profit ceiling."}
                              </span>
                              <span className="truncate text-right font-mono text-xs text-ink-muted tabular-nums">
                                {visualizedIsCallCalendar ? "Target" : "B/E"}{" "}
                              {formatCurrencyWithCents(visualizedSnapshot.breakEvenAtExpiry)}
                              </span>
                            </div>
                        </div>
                    )}

                        <div className="grid min-w-0 grid-rows-[auto_2.25rem_auto] gap-2.5 p-3 lg:p-4">
                          <div className="grid grid-cols-[minmax(0,1fr)_6rem] items-baseline gap-2">
                            <p className="text-xs font-semibold uppercase text-ink-muted text-balance">
                              Worst case at expiry
                            </p>
                            <p className="truncate text-right font-mono text-caption text-ink-muted tabular-nums">
                              {visualizedIsPutRatioSpread
                                ? "At $0"
                                : visualizedIsBearPut
                                  ? "≥"
                                : visualizedIsCallRatioSpread
                                  ? "Above upper B/E"
                                : visualizedIsPutDownsideSpread
                                  ? ">"
                                  : "<"}{" "}
                              {visualizedIsPutRatioSpread || visualizedIsCallRatioSpread
                                ? ""
                                : formatStrikeCurrency(visualizedInputs.longStrike)}
                            </p>
                          </div>
                              <p className="overflow-hidden whitespace-nowrap font-[family:var(--font-space-grotesk)] text-2xl font-semibold leading-none text-loss tabular-nums">
                              {visualizedMaxLossAtExpiry === null
                                ? "Uncapped"
                                : formatCurrency(visualizedMaxLossAtExpiry)}
                            </p>
                          <div className="grid grid-cols-[minmax(0,1fr)_6rem] items-baseline gap-2 text-sm">
                            <span className="font-medium text-ink-muted">
                              Max loss ·{" "}
                                <span className="font-mono font-semibold text-loss tabular-nums">
                                  {visualizedMaxLossAtExpiry === null
                                      ? "Uncapped"
                                      : visualizedMaxLossReturnAtExpiry !== null
                                        ? formatPercent(visualizedMaxLossReturnAtExpiry)
                                        : "N/A"}
                                </span>
                              </span>
                              <span className="truncate text-right font-mono text-xs text-ink-muted tabular-nums">
                                {visualizedSnapshot.reserveOffset > 0 ? "Reserve" : "Cost"} {formatCurrency(visualizedSnapshot.totalCost)}
                              </span>
                          </div>
                        </div>
                      </div>
                    </div>
                ) : null}

                {validationMessages.length > 0 ? (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
                    <p className="font-medium">Fix these inputs first</p>
                    <ul className="mt-2 space-y-1">
                      {validationMessages.map((message) => (
                        <li key={message}>{message}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                    {canModel && activeDisplayGraphView === "map" ? (
                    <DebitSpreadScenarioVisualizer
                      key={`heatmap-${graphRenderKey}`}
                      inputs={visualizedScenarioVisualizerInputs}
                    />
                  ) : null}

                    {canModel && activeDisplayGraphView === "decay" ? (
                    <TimeDecayChart
                      title={`${visualizedStrategyCopy.unitTitle} value over time`}
                      subtitle={`At a fixed underlying price of ${formatPriceCurrency(
                        effectiveScenarioPrice,
                      )} and ${visualizedInputs.futureVolatilityPct}% IV. Hover to read the ${visualizedStrategyCopy.unitName}'s value and P/L on any date.`}
                      points={decayPoints}
                      expirationDays={visualizedSnapshot.expirationDays}
                      selectedOffsetDays={visualizedSnapshot.selectedOffsetDays}
                      selectedPositionValue={visualizedSnapshot.scenarioPositionValue}
                      selectedPnl={visualizedSnapshot.pnl}
                      totalCost={visualizedSnapshot.totalCost}
                      scenarioPriceLabel={formatPriceCurrency(effectiveScenarioPrice)}
                    />
                ) : null}

                    {canModel && activeDisplayGraphView === "overlay" ? (
                    <DebitSpreadScenarioVisualizer
                      key={`multi-${graphRenderKey}`}
                      inputs={visualizedScenarioVisualizerInputs}
                      view="multi"
                    selectedUnderlyingPrice={effectiveScenarioPrice}
                    selectedDte={
                      visualizedSnapshot.expirationDays - visualizedSnapshot.selectedOffsetDays
                    }
                  />
                ) : null}

                {!canModel ? (
                  <div className="rounded-lg border border-dashed border-line-strong bg-surface-muted p-8 text-center text-ink-muted">
                    Clean up the inputs and the curve will appear here.
                  </div>
                ) : null}
              </div>
            </SectionCard>

            <section className="rounded-lg border border-line bg-surface shadow-sm">
              <button
                type="button"
                onClick={() => setShowDetailedTables((isOpen) => !isOpen)}
                aria-expanded={showDetailedTables}
                className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <span>
                  <span className="block font-[family:var(--font-space-grotesk)] text-base font-semibold text-ink">
                    Detailed tables
                  </span>
                  <span className="block text-xs text-ink-muted">
                    Open when you want exact rows by date or stock price.
                  </span>
                </span>
                <span className="text-sm text-ink-muted">
                  {showDetailedTables ? "Hide" : "Show"}
                </span>
              </button>

              {showDetailedTables ? (
                <div className="space-y-3 border-t border-line p-3">
                  <ResultsTable
                    title={`${strategyCopy.unitTitle} value over time at the selected stock price`}
                    subtitle={`These rows keep ${symbol.trim() || "the stock"} fixed at ${formatCurrency(
                      effectiveScenarioPrice,
                    )} and move the date toward expiry.`}
                    columns={timelineColumns}
                    rows={timelineRows}
                  />
                  <ResultsTable
                    title={`${strategyCopy.unitTitle} value by stock price on the selected date`}
                    subtitle={`These rows keep the date fixed at ${formatLongDate(
                      snapshot.selectedDateIso,
                    )} and move the underlying price.`}
                    columns={priceColumns}
                    rows={priceRows}
                  />
                </div>
              ) : null}
            </section>
              </>
            ) : null}
            {children ? <div className="mt-2">{children}</div> : null}
          </div>
        </div>
      </div>
    </main>
  );
}
