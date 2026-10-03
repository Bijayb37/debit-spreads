import type { OptionStrategy } from "@/lib/debit-call-spread";
import type {
  ColorScheme,
  DecisionComparisonView,
  MoneyDisplayUnit,
  ScenarioGraphView,
  StrategyCopy,
  WorkflowTab,
} from "@/components/lab/types";

export const TOP_BAR_REVEAL_SCROLL_TOP = 24;

export const TOP_BAR_SCROLL_DELTA = 8;

export const TOP_BAR_HOVER_REVEAL_HEIGHT = 16;

export const TOP_BAR_HOVER_HIDE_Y = 96;

export const CHART_COLORS = {
  paper: "#ffffff",
  paperSoft: "#f8fafc",
  paperMuted: "#e2e8f0",
  ink: "#0f172a",
  inkMuted: "#64748b",
  line: "#cbd5e1",
  grid: "#f1f5f9",
  accent: "var(--accent)",
  pine: "#059669",
  loss: "#be123c",
};

export const STRATEGY_OPTIONS: Array<{
  value: OptionStrategy;
  label: string;
  description: string;
}> = [
  {
    value: "debit-call-spread",
    label: "Debit call spread",
    description: "Buy one call and sell a higher-strike call.",
  },
  {
    value: "call-ratio-spread",
    label: "Call ratio spread",
    description: "Buy one call and sell multiple higher-strike calls.",
  },
  {
    value: "call-calendar",
    label: "Call calendar",
    description: "Buy a later-dated call and sell a nearer-dated call at the same strike.",
  },
  {
    value: "debit-put-spread",
    label: "Debit put spread",
    description: "Buy one put and sell a lower-strike put.",
  },
  {
    value: "bull-put-spread",
    label: "Bull put spread",
    description: "Sell one put and buy a lower-strike put for defined risk.",
  },
  {
    value: "bear-put",
    label: "Bear put",
    description: "Buy one put for a bearish target.",
  },
  {
    value: "put-ratio-spread",
    label: "Put ratio spread",
    description: "Buy one put and sell multiple lower-strike puts.",
  },
  {
    value: "long-call",
    label: "Long call",
    description: "Buy one call with uncapped upside.",
  },
];

export const STRATEGY_COPY: Record<OptionStrategy, StrategyCopy> = {
  "debit-call-spread": {
    unitName: "spread",
    unitTitle: "Spread",
    contractName: "1x1 spread",
    contractPlural: "full spreads",
    costMetricLabel: "Spread cost today",
    unitColumnLabel: "Spread / 1 spread",
    modelAssumptions:
      "This uses a Black-Scholes estimate with current IV for today's entry cost, future IV for scenario values, and a flat risk-free rate. Both call legs share the same IV in each estimate.",
    capitalHelp: "The app buys as many full 1x1 spreads as this amount allows.",
  },
  "debit-put-spread": {
    unitName: "spread",
    unitTitle: "Spread",
    contractName: "1x1 put spread",
    contractPlural: "full put spreads",
    costMetricLabel: "Put spread cost today",
    unitColumnLabel: "Spread / 1 put spread",
    modelAssumptions:
      "This uses a Black-Scholes estimate with current IV for today's entry cost, future IV for scenario values, and a flat risk-free rate. Both put legs share the same IV in each estimate.",
    capitalHelp: "The app buys as many full 1x1 put spreads as this amount allows.",
  },
  "bull-put-spread": {
    unitName: "spread",
    unitTitle: "Spread",
    contractName: "1x1 bull put spread",
    contractPlural: "full bull put spreads",
    costMetricLabel: "Risk per spread today",
    unitColumnLabel: "Risk / 1 bull put spread",
    modelAssumptions:
      "This uses a Black-Scholes estimate with current IV for today's opening credit, future IV for scenario values, and a flat risk-free rate. It models one short put and one lower-strike protective put.",
    capitalHelp:
      "The app sells as many full bull put spreads as this amount of maximum risk allows.",
  },
  "bear-put": {
    unitName: "put",
    unitTitle: "Put",
    contractName: "put contract",
    contractPlural: "put contracts",
    costMetricLabel: "Bear put cost today",
    unitColumnLabel: "Put / 1 contract",
    modelAssumptions:
      "This uses a Black-Scholes estimate with current IV for today's entry cost, future IV for scenario values, and a flat risk-free rate. It treats the put like European-style pricing.",
    capitalHelp: "The app buys as many full put contracts as this amount allows.",
  },
  "call-ratio-spread": {
    unitName: "ratio spread",
    unitTitle: "Ratio spread",
    contractName: "call ratio spread",
    contractPlural: "full call ratio spreads",
    costMetricLabel: "Call ratio spread cost today",
    unitColumnLabel: "Ratio / 1 spread",
    modelAssumptions:
      "This uses a Black-Scholes estimate with current IV for today's entry cost, future IV for scenario values, and a flat risk-free rate. It models one long call and the selected number of short calls at the higher strike.",
    capitalHelp: "Debit entries use their purchase cost. Credit entries use a notional reserve: uncovered calls times the higher of spot or short strike, plus spread width, less credit. This is not broker margin or a loss limit; losses are uncapped.",
  },
  "call-calendar": {
    unitName: "calendar",
    unitTitle: "Calendar",
    contractName: "call calendar",
    contractPlural: "full call calendars",
    costMetricLabel: "Calendar cost today",
    unitColumnLabel: "Calendar / 1 spread",
    modelAssumptions:
      "This uses a Black-Scholes estimate with current IV for today's entry cost and future IV for scenario values. It models one longer-dated long call and one nearer-dated short call at the same strike.",
    capitalHelp: "The app buys as many full call calendars as this amount allows.",
  },
  "put-ratio-spread": {
    unitName: "ratio spread",
    unitTitle: "Ratio spread",
    contractName: "put ratio spread",
    contractPlural: "full put ratio spreads",
    costMetricLabel: "Put ratio spread cost today",
    unitColumnLabel: "Ratio / 1 spread",
    modelAssumptions:
      "This uses a Black-Scholes estimate with current IV for today's entry cost, future IV for scenario values, and a flat risk-free rate. It models one long put and the selected number of short puts at the lower strike.",
    capitalHelp: "Debit entries use their purchase cost. Credit entries use maximum loss as the capital reserve. Return is measured against the capital used for sizing.",
  },
  "long-call": {
    unitName: "call",
    unitTitle: "Call",
    contractName: "call contract",
    contractPlural: "call contracts",
    costMetricLabel: "Call cost today",
    unitColumnLabel: "Call / 1 contract",
    modelAssumptions:
      "This uses a Black-Scholes estimate with current IV for today's entry cost, future IV for scenario values, and a flat risk-free rate. It treats the call like European-style pricing.",
    capitalHelp: "The app buys as many full call contracts as this amount allows.",
  },
};

export const SHARE_PARAM = "s";

export const WORKFLOW_TAB_PARAM = "tab";

export const SHARE_VERSION = "1";

export const DEFAULT_WORKFLOW_TAB: WorkflowTab = "setup";

export const DEFAULT_DECISION_COMPARISON_VIEW: DecisionComparisonView = "cards";

export const DEFAULT_SCENARIO_GRAPH_VIEW: ScenarioGraphView = "decay";

export const COLOR_SCHEME_STORAGE_KEY = "callculator-color-scheme";

export const MONEY_DISPLAY_UNIT_STORAGE_KEY = "callculator-money-display-unit";

export const INITIAL_IV_MODE_STORAGE_KEY = "callculator-use-initial-iv";

export const UPDATE_STRIKES_WITH_PRICE_STORAGE_KEY =
  "callculator-update-strikes-with-price";

export const WORKSPACE_STATE_STORAGE_KEY = "callculator-workspace-state";

export const SAVED_STRATEGIES_STORAGE_KEY = "callculator-saved-strategies";

export const ORDERED_CUSTOM_COMPARISONS_PREFIX = "o2:";

export const WORKSPACE_RESTORE_RETRY_DELAYS_MS = [0, 150, 500];

export const WORKSPACE_RESTORE_FALLBACK_MS = 1200;

export const PRICE_DECIMAL_DIGITS = 4;

export const CAPITAL_DECIMAL_DIGITS = 2;

export const STRIKE_DECIMAL_DIGITS = 4;

export const STRIKE_MIN_GAP = 0.01;

export const WORKFLOW_TABS: Array<{
  value: WorkflowTab;
  label: string;
  shortLabel: string;
  step: string;
}> = [
  { value: "setup", label: "Setup", shortLabel: "Setup", step: "1" },
  { value: "decision", label: "Compare", shortLabel: "Compare", step: "2" },
  { value: "heatmap", label: "Heat map", shortLabel: "Heat", step: "3" },
  { value: "analysis", label: "Analyze", shortLabel: "Analyze", step: "4" },
  {
    value: "understanding-iv",
    label: "Understanding IV",
    shortLabel: "IV",
    step: "5",
  },
];

export const COLOR_SCHEME_OPTIONS: Array<{
  value: ColorScheme;
  label: string;
  swatchClassName: string;
}> = [
  {
    value: "blue",
    label: "Blue",
    swatchClassName: "bg-sky-600",
  },
  {
    value: "teal",
    label: "Teal",
    swatchClassName: "bg-[#0f5f59]",
  },
  {
    value: "graphite",
    label: "Graphite",
    swatchClassName: "bg-slate-600",
  },
  {
    value: "red",
    label: "Red",
    swatchClassName: "bg-[#e63946]",
  },
  {
    value: "green",
    label: "Green",
    swatchClassName: "bg-emerald-700",
  },
];

export const MONEY_DISPLAY_UNIT_OPTIONS: Array<{
  value: MoneyDisplayUnit;
  label: string;
  helper: string;
}> = [
  {
    value: "dollars",
    label: "Dollars",
    helper: "$300,000",
  },
  {
    value: "thousands",
    label: "Thousands",
    helper: "$300K",
  },
  {
    value: "millions",
    label: "Millions",
    helper: "$0.3M",
  },
];
