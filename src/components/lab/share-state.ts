import {
  PUT_RATIO_SHORT_COUNT_MAX,
  PUT_RATIO_SHORT_COUNT_MIN,
  clamp,
  normalizeCallCalendarShortExpirationDays,
  normalizePutRatioShortCount,
} from "@/lib/debit-call-spread";
import type { OptionStrategy } from "@/lib/debit-call-spread";
import {
  DEFAULT_MONEY_DISPLAY_UNIT,
  DEFAULT_SCENARIO_GRAPH_VIEW,
  DEFAULT_SPOT,
  DEFAULT_WORKFLOW_TAB,
  ORDERED_CUSTOM_COMPARISONS_PREFIX,
  SAVED_STRATEGIES_STORAGE_KEY,
  SHARE_PARAM,
  SHARE_VERSION,
  WORKFLOW_TAB_PARAM,
  WORKSPACE_STATE_STORAGE_KEY,
} from "@/components/lab/constants";
import { compactNumber } from "@/components/lab/format";
import {
  getNearCallShortStrike,
  getOtmStrike,
  isCallCalendarStrategy,
  isPutDownsideStrategy,
  normalizeCapitalValue,
  normalizePriceValue,
  normalizeShortStrikeForStrategy,
  normalizeStrikeValue,
} from "@/components/lab/strategy-helpers";
import type {
  ColorScheme,
  CustomComparisonConfig,
  DecisionComparisonView,
  MoneyDisplayUnit,
  ShareState,
  WorkflowTab,
} from "@/components/lab/types";

export function decodeColorScheme(value: string | null | undefined): ColorScheme {
  return value === "teal" ||
    value === "graphite" ||
    value === "red" ||
    value === "green"
    ? value
    : "blue";
}

export function decodeMoneyDisplayUnit(value: string | null | undefined): MoneyDisplayUnit {
  return value === "millions" ? value : DEFAULT_MONEY_DISPLAY_UNIT;
}

function encodeWorkflowTab(tab: WorkflowTab): string {
  if (tab === "decision") return "d";
  if (tab === "heatmap") return "h";
  return "s";
}

function decodeWorkflowTab(value: string | undefined): WorkflowTab {
  // "o" historically meant the old Compare/Opportunities step; send old links to Compare.
  if (value === "o") return "decision";
  if (value === "d") return "decision";
  // Old Analyze links now open the remaining chart tab.
  if (value === "h" || value === "a") return "heatmap";
  return DEFAULT_WORKFLOW_TAB;
}

function decodeDecisionComparisonView(value: string | undefined | null): DecisionComparisonView | null {
  if (value === "cards") return "cards";
  if (value === "detailed-cards" || value === "details") return "detailed-cards";
  if (value === "table") return "table";
  if (value === "matrix") return "matrix";
  if (value === "verdict") return "table";
  return null;
}

function encodeStrategyToken(strategy: OptionStrategy): string {
  if (strategy === "long-call") return "l";
  if (strategy === "call-ratio-spread") return "c";
  if (strategy === "call-calendar") return "k";
  if (strategy === "put-ratio-spread") return "r";
  if (strategy === "bear-put") return "b";
  if (strategy === "debit-put-spread") return "p";
  if (strategy === "bull-put-spread") return "u";
  return "d";
}

function decodeStrategyToken(value: string | undefined): OptionStrategy {
  if (value === "l") return "long-call";
  if (value === "c") return "call-ratio-spread";
  if (value === "k") return "call-calendar";
  if (value === "r") return "put-ratio-spread";
  if (value === "b") return "bear-put";
  if (value === "p") return "debit-put-spread";
  if (value === "u") return "bull-put-spread";
  return "debit-call-spread";
}

export function getDecisionComparisonViewFromUrl(): DecisionComparisonView | null {
  if (typeof window === "undefined") {
    return null;
  }

  return decodeDecisionComparisonView(new URLSearchParams(window.location.search).get("decision"));
}

function encodeShareText(value: string): string {
  return encodeURIComponent(value).replace(/!/g, "%21");
}

function parseShareNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}

function parseOptionalShareNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : undefined;
}

function decodeShareText(value: string | undefined, fallback: string): string {
  if (!value) {
    return fallback;
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return fallback;
  }
}

function getCustomComparisonCreationOrder(
  comparison: Pick<CustomComparisonConfig, "id">,
  fallbackIndex: number,
): number {
  const match = /^custom-(\d+)-/.exec(comparison.id);

  return match ? Number(match[1]) : fallbackIndex;
}

export function getLatestCreatedCustomComparison(
  comparisons: readonly CustomComparisonConfig[],
): CustomComparisonConfig | null {
  return comparisons.reduce<{
    comparison: CustomComparisonConfig;
    creationOrder: number;
  } | null>((latest, comparison, index) => {
    const creationOrder = getCustomComparisonCreationOrder(
      comparison,
      comparisons.length - index,
    );

    return !latest || creationOrder > latest.creationOrder
      ? { comparison, creationOrder }
      : latest;
  }, null)?.comparison ?? null;
}

export function getSavedStrategyDteKey(
  comparisons: readonly CustomComparisonConfig[],
): string {
  return comparisons
    .map((comparison) => `${comparison.id}:${comparison.expirationDays}`)
    .sort()
    .join("|");
}

export function getMarketScenarioMaxDte(
  comparisons: readonly CustomComparisonConfig[],
  fallbackExpirationDays: number,
): number {
  if (comparisons.length === 0) {
    return clamp(Math.round(fallbackExpirationDays), 0, 1095);
  }

  return Math.max(
    ...comparisons.map((comparison) =>
      clamp(Math.round(comparison.expirationDays), 0, 1095),
    ),
  );
}

function encodeCustomComparisons(comparisons: CustomComparisonConfig[]): string {
  const encodedComparisons = comparisons
    .slice(0, 12)
    .map((comparison) =>
      [
        encodeStrategyToken(comparison.strategy),
        compactNumber(comparison.longStrike),
        compactNumber(comparison.shortStrike),
        compactNumber(comparison.capital),
        comparison.allowFractionalContracts ? "1" : "0",
        encodeShareText(comparison.label),
        encodeShareText(comparison.id),
        compactNumber(comparison.expirationDays),
        encodeShareText(comparison.todayIso ?? ""),
        comparison.spot === undefined ? "" : compactNumber(comparison.spot),
        comparison.volatilityPct === undefined ? "" : compactNumber(comparison.volatilityPct),
        comparison.futureVolatilityPct === undefined
          ? ""
          : compactNumber(comparison.futureVolatilityPct),
        comparison.scenarioPrice === undefined
          ? ""
          : compactNumber(comparison.scenarioPrice),
        comparison.scenarioOffsetDays === undefined
          ? ""
          : compactNumber(comparison.scenarioOffsetDays),
        comparison.ratePct === undefined ? "" : compactNumber(comparison.ratePct),
        comparison.dividendYieldPct === undefined
          ? ""
          : compactNumber(comparison.dividendYieldPct),
        encodeShareText(comparison.symbol ?? ""),
        comparison.ratioShortCount === undefined
          ? ""
          : compactNumber(normalizePutRatioShortCount(comparison.ratioShortCount)),
        isCallCalendarStrategy(comparison.strategy)
          ? compactNumber(
              normalizeCallCalendarShortExpirationDays(
                comparison.shortExpirationDays,
                comparison.expirationDays,
              ),
            )
          : "",
      ].join(","),
    )
    .join(";");

  return encodedComparisons
    ? `${ORDERED_CUSTOM_COMPARISONS_PREFIX}${encodedComparisons}`
    : "";
}

function decodeCustomComparisons(value: string | undefined): CustomComparisonConfig[] {
  if (!value) {
    return [];
  }

  const hasExplicitOrder = value.startsWith(ORDERED_CUSTOM_COMPARISONS_PREFIX);
  const rawValue = hasExplicitOrder
    ? value.slice(ORDERED_CUSTOM_COMPARISONS_PREFIX.length)
    : value;

  if (!rawValue) {
    return [];
  }

  const decodedComparisons = rawValue
    .split(";")
    .slice(0, 12)
    .flatMap((entry, index) => {
      const [
        strategyToken,
        longStrikeToken,
        shortStrikeToken,
        capitalToken,
        fractionalToken,
        labelToken,
        idToken,
        expirationDaysToken,
        todayIsoToken,
        spotToken,
        volatilityPctToken,
        futureVolatilityPctToken,
        scenarioPriceToken,
        scenarioOffsetDaysToken,
        rateToken,
        dividendYieldToken,
        symbolToken,
        ratioShortCountToken,
        shortExpirationDaysToken,
      ] = entry.split(",");
      const strategy = decodeStrategyToken(strategyToken);
      const longStrike = normalizeStrikeValue(parseShareNumber(longStrikeToken, 100));
      const shortStrike = normalizeShortStrikeForStrategy(
        strategy,
        longStrike,
        parseShareNumber(
          shortStrikeToken,
          isPutDownsideStrategy(strategy) ? longStrike - 10 : longStrike + 10,
        ),
      );
      const capital = normalizeCapitalValue(parseShareNumber(capitalToken, 10000));
      const expirationDays = clamp(
        Math.round(parseShareNumber(expirationDaysToken, 60)),
        1,
        1095,
      );
      const shortExpirationDays = normalizeCallCalendarShortExpirationDays(
        parseOptionalShareNumber(shortExpirationDaysToken),
        expirationDays,
      );
      const spot = parseOptionalShareNumber(spotToken);

      if (capital <= 0) {
        return [];
      }

      return [{
        label: decodeShareText(labelToken, ""),
        strategy,
        longStrike,
        shortStrike,
        capital,
        expirationDays,
        shortExpirationDays,
        allowFractionalContracts: fractionalToken === "1",
        id: decodeShareText(idToken, `shared-custom-${index}`),
        todayIso: decodeShareText(todayIsoToken, "") || undefined,
        spot: spot === undefined ? undefined : normalizePriceValue(spot),
        volatilityPct: parseOptionalShareNumber(volatilityPctToken),
        futureVolatilityPct: parseOptionalShareNumber(futureVolatilityPctToken),
        scenarioPrice: parseOptionalShareNumber(scenarioPriceToken),
        scenarioOffsetDays: parseOptionalShareNumber(scenarioOffsetDaysToken),
        ratePct: parseOptionalShareNumber(rateToken),
        dividendYieldPct: parseOptionalShareNumber(dividendYieldToken),
        symbol: decodeShareText(symbolToken, "") || undefined,
        ratioShortCount: normalizePutRatioShortCount(
          parseOptionalShareNumber(ratioShortCountToken),
        ),
      }];
    });

  if (hasExplicitOrder) {
    return decodedComparisons;
  }

  return decodedComparisons
    .map((comparison, index) => ({ comparison, index }))
    .sort(
      (a, b) =>
        getCustomComparisonCreationOrder(b.comparison, b.index) -
        getCustomComparisonCreationOrder(a.comparison, a.index),
    )
    .map(({ comparison }) => comparison);
}

export function getStoredShareState(defaultExpirationDays: number): ShareState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return decodeShareState(
      window.localStorage.getItem(WORKSPACE_STATE_STORAGE_KEY),
      defaultExpirationDays,
    );
  } catch {
    return null;
  }
}

export function storeShareState(state: ShareState) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(WORKSPACE_STATE_STORAGE_KEY, encodeShareState(state));
  } catch {
    // Storage can fail in private browsing or when quota is full.
  }
}

export function getStoredCustomComparisons(): CustomComparisonConfig[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    return decodeCustomComparisons(
      window.localStorage.getItem(SAVED_STRATEGIES_STORAGE_KEY) ?? undefined,
    );
  } catch {
    return [];
  }
}

export function storeCustomComparisons(comparisons: CustomComparisonConfig[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (comparisons.length === 0) {
      window.localStorage.removeItem(SAVED_STRATEGIES_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(
      SAVED_STRATEGIES_STORAGE_KEY,
      encodeCustomComparisons(comparisons),
    );
  } catch {
    // Storage can fail in private browsing or when quota is full. The URL state still works.
  }
}

export function getCustomComparisonCounterSeed(
  comparisons: CustomComparisonConfig[],
): number {
  const idCounters = comparisons.map((comparison) => {
    const match = /^custom-(\d+)-/.exec(comparison.id);
    return match ? Number(match[1]) : 0;
  });

  return Math.max(comparisons.length, ...idCounters, 0);
}

export function clearAppUrlState() {
  if (typeof window === "undefined") {
    return;
  }

  const appUrlParams = [SHARE_PARAM, WORKFLOW_TAB_PARAM, "decision", "view"];
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  let didChangeSearch = false;
  let didChangeHash = false;

  appUrlParams.forEach((param) => {
    if (searchParams.has(param)) {
      searchParams.delete(param);
      didChangeSearch = true;
    }

    if (hashParams.has(param)) {
      hashParams.delete(param);
      didChangeHash = true;
    }
  });

  if (!didChangeSearch && !didChangeHash) {
    return;
  }

  const nextSearch = searchParams.toString();
  const nextHash = didChangeHash
    ? hashParams.toString()
    : window.location.hash.replace(/^#/, "");
  const nextUrl = [
    window.location.pathname,
    nextSearch ? `?${nextSearch}` : "",
    nextHash ? `#${nextHash}` : "",
  ].join("");

  window.history.replaceState(null, "", nextUrl);
}

function encodeShareState(state: ShareState): string {
  const parts = [
    SHARE_VERSION,
    encodeStrategyToken(state.strategy),
    encodeShareText(state.symbol),
    compactNumber(state.spot),
    compactNumber(state.volatilityPct),
    compactNumber(state.futureVolatilityPct),
    compactNumber(state.longStrike),
    compactNumber(state.shortStrike),
    compactNumber(state.capital),
    state.allowFractionalContracts ? "1" : "0",
    compactNumber(state.expirationDays),
    compactNumber(state.scenarioPrice),
    compactNumber(state.scenarioOffsetDays),
    compactNumber(state.ratePct),
    state.scenarioGraphView === "map"
      ? "m"
      : state.scenarioGraphView === "decay"
        ? "t"
        : "o",
    compactNumber(normalizePutRatioShortCount(state.ratioShortCount)),
    compactNumber(
      normalizeCallCalendarShortExpirationDays(
        state.shortExpirationDays,
        state.expirationDays,
      ),
    ),
    compactNumber(state.calendarShortPrice),
  ];

  if (
    state.comparisonPanelMode !== "hidden" ||
    state.customComparisons.length > 0 ||
    state.graphComparisonId !== "editor" ||
    state.workflowTab !== DEFAULT_WORKFLOW_TAB
  ) {
    parts.push(
      state.comparisonPanelMode === "custom"
        ? "c"
        : state.comparisonPanelMode === "presets"
          ? "p"
          : "h",
      encodeCustomComparisons(state.customComparisons),
      encodeShareText(state.graphComparisonId),
      encodeWorkflowTab(state.workflowTab),
    );
  }

  return parts.join("~");
}

export function getShareStateFromUrl(defaultExpirationDays: number): ShareState | null {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const searchParams = new URLSearchParams(window.location.search);
  const explicitWorkflowTab = getWorkflowTabFromUrl();
  const hashState = decodeShareState(hashParams.get(SHARE_PARAM), defaultExpirationDays);

  if (hashState) {
    return {
      ...hashState,
      workflowTab: explicitWorkflowTab ?? hashState.workflowTab,
    };
  }

  const searchState = decodeShareState(searchParams.get(SHARE_PARAM), defaultExpirationDays);

  if (!searchState) {
    return null;
  }

  return {
    ...searchState,
    workflowTab: explicitWorkflowTab ?? searchState.workflowTab,
  };
}

export function getWorkflowTabFromUrl(): WorkflowTab | null {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const searchParams = new URLSearchParams(window.location.search);
  const token = hashParams.get(WORKFLOW_TAB_PARAM) ?? searchParams.get(WORKFLOW_TAB_PARAM);

  return token ? decodeWorkflowTab(token) : null;
}

function decodeShareState(value: string | null, defaultExpirationDays: number): ShareState | null {
  if (!value) {
    return null;
  }

  const parts = value.split("~");
  const [
    version,
    strategyToken,
    symbolToken,
    spotToken,
    volatilityToken,
    futureVolatilityToken,
    longStrikeToken,
    shortStrikeToken,
    capitalToken,
    fractionalToken,
    expirationDaysToken,
    scenarioPriceToken,
    scenarioOffsetDaysToken,
    rateToken,
    graphToken,
  ] = parts;

  if (version !== SHARE_VERSION) {
    return null;
  }

  const expirationDays = clamp(
    Math.round(parseShareNumber(expirationDaysToken, defaultExpirationDays)),
    0,
    1095,
  );
  const strategy = decodeStrategyToken(strategyToken);
  const spot = normalizePriceValue(parseShareNumber(spotToken, DEFAULT_SPOT));
  const longStrike = normalizeStrikeValue(parseShareNumber(longStrikeToken, 120));
  const decodedShortStrike = normalizeShortStrikeForStrategy(
    strategy,
    longStrike,
    parseShareNumber(
      shortStrikeToken,
      isPutDownsideStrategy(strategy) ? longStrike - 10 : longStrike + 10,
    ),
  );
  const shortStrike =
    strategy === "debit-call-spread" &&
    longStrike === Math.round(spot) &&
    decodedShortStrike === getOtmStrike(spot, 10)
      ? getNearCallShortStrike(spot)
      : decodedShortStrike;
  const legacyComparisonPanelToken = parts[15];
  const decodedRatioShortCount = parseOptionalShareNumber(legacyComparisonPanelToken);
  const hasRatioShortCountToken =
    decodedRatioShortCount !== undefined &&
    decodedRatioShortCount >= PUT_RATIO_SHORT_COUNT_MIN &&
    decodedRatioShortCount <= PUT_RATIO_SHORT_COUNT_MAX;
  const ratioShortCount = normalizePutRatioShortCount(
    hasRatioShortCountToken ? decodedRatioShortCount : undefined,
  );
  const afterRatioTokenIndex = hasRatioShortCountToken ? 16 : 15;
  const decodedShortExpirationDays = parseOptionalShareNumber(parts[afterRatioTokenIndex]);
  const hasShortExpirationDaysToken =
    decodedShortExpirationDays !== undefined &&
    decodedShortExpirationDays >= 0 &&
    (expirationDays <= 0 || decodedShortExpirationDays < expirationDays);
  const shortExpirationDays = normalizeCallCalendarShortExpirationDays(
    hasShortExpirationDaysToken ? decodedShortExpirationDays : undefined,
    expirationDays,
  );
  const afterShortExpirationTokenIndex =
    afterRatioTokenIndex + (hasShortExpirationDaysToken ? 1 : 0);
  const decodedCalendarShortPrice = parseOptionalShareNumber(
    parts[afterShortExpirationTokenIndex],
  );
  const hasCalendarShortPriceToken =
    decodedCalendarShortPrice !== undefined && decodedCalendarShortPrice > 0;
  const comparisonPanelIndex =
    afterShortExpirationTokenIndex + (hasCalendarShortPriceToken ? 1 : 0);
  const comparisonPanelToken = parts[comparisonPanelIndex];
  const customComparisonsToken = parts[comparisonPanelIndex + 1];
  const graphComparisonToken = parts[comparisonPanelIndex + 2];
  const workflowTabToken = parts[comparisonPanelIndex + 3];
  const scenarioPrice = normalizePriceValue(
    parseShareNumber(scenarioPriceToken, spot),
  );

  return {
    strategy,
    symbol: decodeShareText(symbolToken, "NVDA").toUpperCase(),
    spot,
    volatilityPct: clamp(parseShareNumber(volatilityToken, 50), 0, 300),
    futureVolatilityPct: clamp(
      parseShareNumber(futureVolatilityToken, 50),
      0,
      300,
    ),
    longStrike,
    ratioShortCount,
    shortExpirationDays,
    shortStrike,
    capital: normalizeCapitalValue(parseShareNumber(capitalToken, 10000)),
    allowFractionalContracts: fractionalToken === "1",
    expirationDays,
    scenarioPrice,
    calendarShortPrice: normalizePriceValue(
      hasCalendarShortPriceToken
        ? decodedCalendarShortPrice ?? scenarioPrice
        : scenarioPrice,
    ),
    scenarioOffsetDays: clamp(
      Math.round(parseShareNumber(scenarioOffsetDaysToken, Math.round(expirationDays / 2))),
      0,
      expirationDays,
    ),
    ratePct: clamp(parseShareNumber(rateToken, 4), 0, 15),
    scenarioGraphView:
      graphToken === "t"
        ? "decay"
        : graphToken === "o"
          ? "overlay"
          : graphToken === "m"
            ? "map"
            : DEFAULT_SCENARIO_GRAPH_VIEW,
    comparisonPanelMode:
      comparisonPanelToken === "c"
        ? "custom"
        : comparisonPanelToken === "p"
          ? "presets"
          : "hidden",
    customComparisons: decodeCustomComparisons(customComparisonsToken),
    graphComparisonId: decodeShareText(graphComparisonToken, "editor"),
    workflowTab: decodeWorkflowTab(workflowTabToken),
  };
}
