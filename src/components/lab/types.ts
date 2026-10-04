import type { ReactNode } from "react";
import type { IvComparisonInstrument } from "@/lib/iv-comparison";
import type {
  OptionGreeks,
  OptionStrategy,
  PriceLadderRow,
  ScenarioSnapshot,
  StrategyInputs,
  TimelineRow,
} from "@/lib/debit-call-spread";

export type ScenarioGraphView = "decay" | "overlay" | "map";

export type ColorScheme = "blue" | "teal" | "graphite" | "red" | "green";

export type MoneyDisplayUnit = "thousands" | "millions";

export type TableColumn<Row> = {
  key: string;
  label: string;
  align?: "right";
  muted?: boolean;
  render: (row: Row) => ReactNode;
};

export type TimelineTableRow = TimelineRow & { id: string };

export type PriceTableRow = PriceLadderRow & { id: string };

export type ComparisonPanelMode = "hidden" | "presets" | "custom";

export type WorkflowTab = "setup" | "decision" | "heatmap";

export type DecisionComparisonView = "cards" | "detailed-cards" | "table" | "matrix";

export type ValuationDateInputMode = "elapsed" | "remaining";

export type ComparisonCandidate = {
  id: string;
  label: string;
  note: string;
  strategy: OptionStrategy;
  symbol?: string;
  todayIso?: string;
  spot?: number;
  longStrike: number;
  shortStrike: number;
  ratioShortCount?: number;
  shortExpirationDays?: number;
  volatilityPct?: number;
  futureVolatilityPct?: number;
  capital: number;
  expirationDays: number;
  allowFractionalContracts: boolean;
  scenarioPrice?: number;
  scenarioOffsetDays?: number;
  ratePct?: number;
  dividendYieldPct?: number;
};

export type ComparisonCardData = ComparisonCandidate & {
  snapshot: ScenarioSnapshot;
  maxProfitAtExpiry: number | null;
  maxReturnAtExpiry: number | null;
  maxLossAtExpiry: number | null;
};

export type StrategyGreekRow = {
  label: string;
  greeks: OptionGreeks;
  marketValue: number;
  isNet?: boolean;
};

export type CustomComparisonConfig = Omit<ComparisonCandidate, "note">;

export type CustomComparisonDraft = Omit<CustomComparisonConfig, "id">;

export type GraphComparisonOption = {
  id: string;
  label: string;
  detail: string;
  inputs: StrategyInputs;
  snapshot: ScenarioSnapshot;
};

export type ComparisonCardAction = (card: ComparisonCardData) => void;

export type StrategyCopy = {
  unitName: string;
  unitTitle: string;
  contractName: string;
  contractPlural: string;
  costMetricLabel: string;
  unitColumnLabel: string;
  modelAssumptions: string;
  capitalHelp: string;
};

export type DefaultStrikeOptions = {
  expirationDays?: number;
  volatilityPct?: number;
  ratioShortCount?: number;
  ratePct?: number;
  dividendYieldPct?: number;
};

export type ShareState = {
  strategy: OptionStrategy;
  symbol: string;
  spot: number;
  volatilityPct: number;
  futureVolatilityPct: number;
  longStrike: number;
  shortStrike: number;
  ratioShortCount: number;
  shortExpirationDays: number;
  capital: number;
  allowFractionalContracts: boolean;
  expirationDays: number;
  scenarioPrice: number;
  calendarShortPrice: number;
  scenarioOffsetDays: number;
  ratePct: number;
  scenarioGraphView: ScenarioGraphView;
  comparisonPanelMode: ComparisonPanelMode;
  customComparisons: CustomComparisonConfig[];
  graphComparisonId: string;
  workflowTab: WorkflowTab;
};

export type IvAlternativeStrategy = {
  instrument: IvComparisonInstrument;
  symbol: string;
  todayIso: string;
  spot: number;
  longStrike: number;
  shortStrike: number;
  expirationDays: number;
  volatilityPct: number;
  capital: number;
  allowFractionalContracts: boolean;
  ratePct: number;
  scenarioPrice: number;
  scenarioOffsetDays: number;
};

export type AiStrategyRequest = {
  strategy: OptionStrategy;
  longStrike: number;
  shortStrike?: number;
  ratioShortCount?: number;
  expirationDays?: number;
  shortExpirationDays?: number;
  capital?: number;
  label?: string;
  symbol?: string;
  spot?: number;
  volatilityPct?: number;
};
