import {
  addDaysToIso,
  createScenarioSnapshot,
  type OptionStrategy,
} from "@/lib/debit-call-spread";

// The scenario desk: a set of option strategies on one stock, a set of what-if
// scenarios, and every strategy's profit or loss in every scenario. This module is
// pure so the page and the assistant's server tools calculate the same numbers.

export const MAX_STRATEGIES = 8;
export const MAX_SCENARIOS = 8;

type KindInfo = {
  name: string;
  summary: string;
  // Where the sold strike sits relative to the bought strike, if there is one.
  short: "above" | "below" | null;
  ratio?: boolean;
  calendar?: boolean;
};

export const KINDS: Record<OptionStrategy, KindInfo> = {
  "long-call": { name: "Long call", summary: "Buy a call. Gains if the stock rises.", short: null },
  "debit-call-spread": { name: "Call spread", summary: "Buy a call, sell a higher call. Cheaper, with capped upside.", short: "above" },
  "bull-put-spread": { name: "Bull put spread", summary: "Sell a put, buy a lower put. Collects premium if the stock holds.", short: "above" },
  "call-calendar": { name: "Call calendar", summary: "Buy a later call, sell a nearer call at the same strike.", short: null, calendar: true },
  "call-ratio-spread": { name: "Call ratio spread", summary: "Buy a call, sell several higher calls. Loses if the stock runs far.", short: "above", ratio: true },
  "bear-put": { name: "Long put", summary: "Buy a put. Gains if the stock falls.", short: null },
  "debit-put-spread": { name: "Put spread", summary: "Buy a put, sell a lower put. Cheaper, with capped gain.", short: "below" },
  "put-ratio-spread": { name: "Put ratio spread", summary: "Buy a put, sell several lower puts. Loses if the stock collapses.", short: "below", ratio: true },
};

export const KIND_IDS = Object.keys(KINDS) as OptionStrategy[];

export type Market = { symbol: string; spot: number; ivPct: number; ratePct: number };

export type Strategy = {
  id: string;
  name: string;
  kind: OptionStrategy;
  longStrike: number;
  shortStrike: number;
  expirationDays: number;
  shortExpirationDays: number;
  ratio: number;
  budget: number;
};

// `days: null` values each strategy at its own expiration. `ivPct: null` keeps the
// entry IV. `odds` is the user's own relative weight for the scenario, not a forecast.
export type Scenario = {
  id: string;
  name: string;
  movePct: number;
  days: number | null;
  ivPct: number | null;
  odds: number;
};

export type Desk = { market: Market; strategies: Strategy[]; scenarios: Scenario[] };

export type Cell = { pnl: number; returnPct: number };

export type BoardRow = {
  strategy: Strategy;
  cost: number;
  contracts: number;
  maxLoss: number | null;
  maxProfit: number | null;
  breakEven: number;
  cells: Cell[];
  worst: number;
  best: number;
  // P/L averaged across scenarios, weighted by the user's odds.
  expected: number;
  problem: string | null;
};

export type Board = {
  rows: BoardRow[];
  prices: number[];
  // Each scenario's share of the total odds, in percent.
  oddsPct: number[];
  // Row id of the highest P/L in each scenario, when there is something to compare.
  bestInScenario: (string | null)[];
};

const round = (value: number, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const clampNumber = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;

const cleanText = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

export function formatPrice(value: number): string {
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

// Compact dollars with an explicit sign, e.g. +$9.6K, -$850, $0.
export function formatMoney(value: number, signed = true): string {
  const rounded = Math.round(value);
  const size = Math.abs(rounded);
  const sign = rounded < 0 ? "-" : signed && rounded > 0 ? "+" : "";
  const body =
    size >= 1e6
      ? `${round(size / 1e6, 2)}M`
      : size >= 1e4
        ? `${round(size / 1e3, 1)}K`
        : size >= 1e3
          ? `${round(size / 1e3, 2)}K`
          : String(size);
  return `${sign}$${body}`;
}

export function formatPct(value: number, digits = 0): string {
  const rounded = round(value, digits);
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

export function strategyStrikes(strategy: Strategy): string {
  const kind = KINDS[strategy.kind];
  if (!kind.short) return formatPrice(strategy.longStrike);
  return `${formatPrice(strategy.longStrike)} / ${formatPrice(strategy.shortStrike)}${
    kind.ratio ? ` x${strategy.ratio}` : ""
  }`;
}

export function autoStrategyName(strategy: Strategy): string {
  return `${strategyStrikes(strategy)} ${KINDS[strategy.kind].name.toLowerCase()}`;
}

export function autoScenarioName(movePct: number): string {
  return movePct === 0 ? "Flat" : `${movePct > 0 ? "Up" : "Down"} ${round(Math.abs(movePct), 1)}%`;
}

// The reason a strategy's inputs cannot be used, or null when they are fine.
export function strategyProblem(strategy: Strategy): string | null {
  const kind = KINDS[strategy.kind];
  if (kind.short === "above" && strategy.shortStrike <= strategy.longStrike) {
    return "The sold strike has to be above the bought strike.";
  }
  if (kind.short === "below" && strategy.shortStrike >= strategy.longStrike) {
    return "The sold strike has to be below the bought strike.";
  }
  if (kind.calendar && strategy.shortExpirationDays >= strategy.expirationDays) {
    return "The sold call has to expire before the bought call.";
  }
  return null;
}

export function nextId(prefix: string, used: { id: string }[]): string {
  let index = used.length + 1;
  while (used.some((item) => item.id === `${prefix}${index}`)) index++;
  return `${prefix}${index}`;
}

// Fills in a complete strategy from whatever fields are known, using the stock price
// for default strikes.
export function makeStrategy(
  desk: Desk,
  input: Partial<Strategy> & { kind: OptionStrategy },
): Strategy {
  const kind = KINDS[input.kind];
  const spot = desk.market.spot;
  const longStrike = round(
    clampNumber(
      input.longStrike,
      0.01,
      1e7,
      input.kind === "bull-put-spread" ? Math.round(spot * 0.85) : Math.round(spot),
    ),
  );
  const defaultShort =
    input.kind === "bull-put-spread"
      ? Math.max(longStrike + 1, Math.round(spot * 0.95))
      : kind.short === "above"
        ? Math.max(longStrike + 1, Math.round(longStrike * 1.1))
        : kind.short === "below"
          ? Math.max(0.01, Math.min(longStrike - 1, Math.round(longStrike * 0.9)))
          : longStrike;
  const expirationDays = Math.round(clampNumber(input.expirationDays, 1, 1095, 60));
  const strategy: Strategy = {
    id: input.id || nextId("st", desk.strategies),
    name: "",
    kind: input.kind,
    longStrike,
    shortStrike: kind.short ? round(clampNumber(input.shortStrike, 0.01, 1e7, defaultShort)) : longStrike,
    expirationDays,
    shortExpirationDays: kind.calendar
      ? Math.round(
          clampNumber(input.shortExpirationDays, 1, 1094, Math.max(1, Math.min(30, expirationDays - 1))),
        )
      : 0,
    ratio: Math.round(clampNumber(input.ratio, 2, 10, 2)),
    budget: round(clampNumber(input.budget, 1, 1e9, desk.strategies.at(-1)?.budget ?? 10000)),
  };
  strategy.name = cleanText(input.name, 48) || autoStrategyName(strategy);
  return strategy;
}

export function makeScenario(
  desk: Desk,
  input: Partial<Scenario> & { price?: number },
): Scenario {
  const movePct = round(
    clampNumber(
      input.movePct ?? (typeof input.price === "number" ? (input.price / desk.market.spot - 1) * 100 : 0),
      -95,
      500,
      0,
    ),
  );
  return {
    id: input.id || nextId("sc", desk.scenarios),
    name: cleanText(input.name, 32) || autoScenarioName(movePct),
    movePct,
    days: input.days === null || input.days === undefined ? null : Math.round(clampNumber(input.days, 0, 1095, 0)),
    ivPct: input.ivPct === null || input.ivPct === undefined ? null : round(clampNumber(input.ivPct, 1, 300, desk.market.ivPct), 1),
    odds: round(clampNumber(input.odds, 0, 100, 1), 1),
  };
}

export function defaultDesk(): Desk {
  const desk: Desk = {
    market: { symbol: "NVDA", spot: 100, ivPct: 50, ratePct: 4 },
    strategies: [],
    scenarios: [],
  };
  for (const movePct of [-20, -10, 0, 10, 20]) {
    desk.scenarios.push(makeScenario(desk, { movePct }));
  }
  desk.strategies.push(makeStrategy(desk, { kind: "long-call" }));
  desk.strategies.push(makeStrategy(desk, { kind: "debit-call-spread", shortStrike: 115 }));
  desk.strategies.push(makeStrategy(desk, { kind: "bull-put-spread" }));
  return desk;
}

// Rebuilds a desk from untrusted data (browser storage, a request body). Anything
// malformed is dropped or reset; a desk that is not an object at all throws.
export function cleanDesk(value: unknown): Desk {
  if (!value || typeof value !== "object") throw new Error("Not a desk.");
  const raw = value as { market?: Partial<Market>; strategies?: unknown; scenarios?: unknown };
  const symbol = cleanText(raw.market?.symbol, 10).toUpperCase();
  const desk: Desk = {
    market: {
      symbol: /^[A-Z0-9.^-]+$/.test(symbol) ? symbol : "STOCK",
      spot: round(clampNumber(raw.market?.spot, 0.01, 1e7, 100)),
      ivPct: round(clampNumber(raw.market?.ivPct, 1, 300, 50), 1),
      ratePct: round(clampNumber(raw.market?.ratePct, 0, 20, 4), 2),
    },
    strategies: [],
    scenarios: [],
  };
  for (const entry of Array.isArray(raw.strategies) ? raw.strategies.slice(0, MAX_STRATEGIES) : []) {
    const item = entry as Partial<Strategy>;
    if (!item || typeof item !== "object" || !KIND_IDS.includes(item.kind as OptionStrategy)) continue;
    const id = cleanText(item.id, 24);
    desk.strategies.push(
      makeStrategy(desk, {
        ...item,
        kind: item.kind as OptionStrategy,
        id: id && !desk.strategies.some((strategy) => strategy.id === id) ? id : undefined,
      }),
    );
  }
  for (const entry of Array.isArray(raw.scenarios) ? raw.scenarios.slice(0, MAX_SCENARIOS) : []) {
    const item = entry as Partial<Scenario>;
    if (!item || typeof item !== "object") continue;
    const id = cleanText(item.id, 24);
    desk.scenarios.push(
      makeScenario(desk, {
        ...item,
        id: id && !desk.scenarios.some((scenario) => scenario.id === id) ? id : undefined,
      }),
    );
  }
  if (desk.scenarios.length === 0) desk.scenarios = defaultDesk().scenarios;
  return desk;
}

export function scenarioPrice(market: Market, scenario: Pick<Scenario, "movePct">): number {
  return Math.max(0.01, round(market.spot * (1 + scenario.movePct / 100)));
}

function snapshot(
  desk: Desk,
  strategy: Strategy,
  todayIso: string,
  price: number,
  days: number | null,
  ivPct: number | null,
) {
  return createScenarioSnapshot({
    strategy: strategy.kind,
    todayIso,
    expiryIso: addDaysToIso(todayIso, strategy.expirationDays),
    spot: desk.market.spot,
    longStrike: strategy.longStrike,
    shortStrike: strategy.shortStrike,
    ratioShortCount: strategy.ratio,
    shortExpirationDays: strategy.shortExpirationDays,
    volatilityPct: desk.market.ivPct,
    futureVolatilityPct: ivPct ?? desk.market.ivPct,
    capital: strategy.budget,
    allowFractionalContracts: false,
    scenarioPrice: price,
    calendarShortPrice: price,
    // A scenario dated after a strategy expires shows that strategy's value at expiry.
    scenarioOffsetDays: Math.min(days ?? strategy.expirationDays, strategy.expirationDays),
    ratePct: desk.market.ratePct,
    dividendYieldPct: 0,
  });
}

// One strategy's profit or loss at each stock price, on one date and IV.
export function payoffCurve(
  desk: Desk,
  strategy: Strategy,
  todayIso: string,
  prices: number[],
  days: number | null,
  ivPct: number | null,
): number[] {
  if (strategyProblem(strategy)) return prices.map(() => 0);
  return prices.map((price) => {
    const result = snapshot(desk, strategy, todayIso, price, days, ivPct);
    return result.unitCost > 0 && result.contracts > 0 ? result.pnl : 0;
  });
}

export function evaluateDesk(desk: Desk, todayIso: string): Board {
  const prices = desk.scenarios.map((scenario) => scenarioPrice(desk.market, scenario));
  const totalOdds = desk.scenarios.reduce((sum, scenario) => sum + scenario.odds, 0);
  // With no odds set at all, every scenario counts equally.
  const weights = desk.scenarios.map((scenario) =>
    totalOdds > 0 ? scenario.odds / totalOdds : 1 / Math.max(1, desk.scenarios.length),
  );
  const rows = desk.strategies.map((strategy): BoardRow => {
    const inputProblem = strategyProblem(strategy);
    const entry = inputProblem
      ? null
      : snapshot(desk, strategy, todayIso, desk.market.spot, 0, null);
    const problem =
      inputProblem ??
      (entry!.unitCost <= 0
        ? "These strikes have no entry cost in the model."
        : entry!.contracts < 1
          ? "The budget is too small for one contract."
          : null);
    const cells = desk.scenarios.map((scenario, index): Cell => {
      if (problem) return { pnl: 0, returnPct: 0 };
      const { pnl } = snapshot(desk, strategy, todayIso, prices[index], scenario.days, scenario.ivPct);
      return { pnl, returnPct: (pnl / strategy.budget) * 100 };
    });
    const pnls = cells.map((cell) => cell.pnl);
    return {
      strategy,
      cost: entry?.totalCost ?? 0,
      contracts: entry?.contracts ?? 0,
      maxLoss: !entry || entry.maxLossPerUnit === null ? null : entry.maxLossPerUnit * entry.contracts * 100,
      maxProfit: !entry || entry.maxProfitPerUnit === null ? null : entry.maxProfitPerUnit * entry.contracts * 100,
      breakEven: entry?.breakEvenAtExpiry ?? 0,
      cells,
      worst: pnls.length ? Math.min(...pnls) : 0,
      best: pnls.length ? Math.max(...pnls) : 0,
      expected: pnls.reduce((sum, pnl, index) => sum + pnl * weights[index], 0),
      problem,
    };
  });
  const usable = rows.filter((row) => !row.problem);
  return {
    rows,
    prices,
    oddsPct: weights.map((weight) => weight * 100),
    bestInScenario: desk.scenarios.map((_, index) =>
      usable.length > 1
        ? usable.reduce((best, row) => (row.cells[index].pnl > best.cells[index].pnl ? row : best)).strategy.id
        : null,
    ),
  };
}

// The board as plain data for the assistant. Dollar values are whole USD.
export function describeBoard(desk: Desk, todayIso: string) {
  const board = evaluateDesk(desk, todayIso);
  return {
    market: desk.market,
    scenarios: desk.scenarios.map((scenario, index) => ({
      id: scenario.id,
      name: scenario.name,
      stockPrice: board.prices[index],
      movePct: scenario.movePct,
      when: scenario.days === null ? "each strategy's expiration" : `${scenario.days} days from today`,
      iv: scenario.ivPct === null ? "unchanged from entry" : `${scenario.ivPct}%`,
      userOddsPct: round(board.oddsPct[index], 1),
    })),
    strategies: board.rows.map((row) => ({
      id: row.strategy.id,
      name: row.strategy.name,
      kind: row.strategy.kind,
      strikes: strategyStrikes(row.strategy),
      expirationDays: row.strategy.expirationDays,
      budget: row.strategy.budget,
      ...(row.problem
        ? { problem: row.problem }
        : {
            cost: Math.round(row.cost),
            contracts: row.contracts,
            breakEvenAtExpiry: round(row.breakEven),
            maxLoss: row.maxLoss === null ? "uncapped" : Math.round(row.maxLoss),
            maxProfit: row.maxProfit === null ? "uncapped" : Math.round(row.maxProfit),
            pnlByScenario: row.cells.map((cell) => Math.round(cell.pnl)),
            worstScenarioPnl: Math.round(row.worst),
            bestScenarioPnl: Math.round(row.best),
            oddsWeightedPnl: Math.round(row.expected),
          }),
    })),
    notes:
      "pnlByScenario follows the order of scenarios. Theoretical Black-Scholes values, not live quotes; whole contracts of 100 shares; no fees or dividends. Odds are the user's own weights, not probabilities from the model. Each strategy is a separate alternative for the same budget, not a combined position.",
  };
}
