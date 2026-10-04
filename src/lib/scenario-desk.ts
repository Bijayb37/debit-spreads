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
export const MAX_STEPS = 5;

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

// One checkpoint on a scenario's path: where the stock is, when, and at what IV.
// `days: null` (last step only) means the day the longest-dated strategy expires.
// `ivPct: null` keeps the entry IV.
export type Step = { days: number | null; movePct: number; ivPct: number | null };

// A scenario is a path the stock takes from today through one or more steps, e.g.
// up to $960 by day 20, then back to $850 by day 45. `odds` is the user's own
// relative weight for the scenario, not a forecast.
export type Scenario = { id: string; name: string; steps: Step[]; odds: number };

export type StepInput = { days?: number | null; movePct?: number; price?: number; ivPct?: number | null };

export type ScenarioInput = { id?: string; name?: string; odds?: number; steps?: StepInput[] } & StepInput;

// A step with its day, price and IV worked out.
export type PathPoint = { day: number; price: number; movePct: number; ivPct: number };

export type Desk = { market: Market; strategies: Strategy[]; scenarios: Scenario[] };

// `expiredDay` is set when the strategy had already expired by that point on the
// path; its result is then locked in at the stock price on its expiry day.
export type Cell = { pnl: number; returnPct: number; expiredDay: number | null };

export type BoardRow = {
  strategy: Strategy;
  cost: number;
  contracts: number;
  maxLoss: number | null;
  maxProfit: number | null;
  breakEven: number;
  // Result at the end of each scenario's path.
  cells: Cell[];
  // Result at every step of each scenario's path: [scenario][step].
  steps: Cell[][];
  worst: number;
  best: number;
  // P/L averaged across scenarios, weighted by the user's odds.
  expected: number;
  problem: string | null;
};

export type Board = {
  rows: BoardRow[];
  // Each scenario's path with days, prices and IVs worked out.
  paths: PathPoint[][];
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

export function movePrice(market: Market, movePct: number): number {
  return Math.max(0.01, round(market.spot * (1 + movePct / 100)));
}

export function autoScenarioName(market: Market, steps: Pick<Step, "movePct">[]): string {
  if (steps.length > 1) return steps.map((step) => formatPrice(movePrice(market, step.movePct))).join(" → ");
  const movePct = steps[0]?.movePct ?? 0;
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

function makeStep(market: Market, input: StepInput): Step {
  return {
    days: input.days === null || input.days === undefined ? null : Math.round(clampNumber(input.days, 1, 1095, 1)),
    movePct: round(
      clampNumber(
        input.movePct ?? (typeof input.price === "number" ? (input.price / market.spot - 1) * 100 : 0),
        -95,
        500,
        0,
      ),
      // Enough precision that a price the user typed comes back exactly.
      4,
    ),
    ivPct: input.ivPct === null || input.ivPct === undefined ? null : round(clampNumber(input.ivPct, 1, 300, market.ivPct), 1),
  };
}

// Orders steps by day, keeps one step per day and at most one open-ended last step.
export function makeSteps(market: Market, inputs: StepInput[]): Step[] {
  const dated = new Map<number, Step>();
  let open: Step | null = null;
  for (const input of inputs) {
    if (!input || typeof input !== "object") continue;
    const step = makeStep(market, input);
    if (step.days === null) open = step;
    else dated.set(step.days, step);
  }
  const steps = [...dated.values()].sort((first, second) => first.days! - second.days!);
  if (open) steps.push(open);
  return steps.length > 0 ? steps.slice(0, MAX_STEPS) : [{ days: null, movePct: 0, ivPct: null }];
}

// Accepts a path (`steps`) or the single-step shorthand (`movePct`/`price`, `days`, `ivPct`).
export function makeScenario(desk: Desk, input: ScenarioInput): Scenario {
  const steps = makeSteps(
    desk.market,
    Array.isArray(input.steps) && input.steps.length > 0 ? input.steps : [input],
  );
  return {
    id: input.id || nextId("sc", desk.scenarios),
    name: cleanText(input.name, 32) || autoScenarioName(desk.market, steps),
    steps,
    odds: round(clampNumber(input.odds, 0, 100, 1), 1),
  };
}

export function defaultDesk(): Desk {
  const desk: Desk = {
    market: { symbol: "NVDA", spot: 100, ivPct: 50, ratePct: 4 },
    strategies: [],
    scenarios: [],
  };
  // Two paths show how timing changes the picture; three simple moves frame the range.
  desk.scenarios.push(makeScenario(desk, { name: "Rally, then fade", steps: [{ days: 20, movePct: 15 }, { days: 45, movePct: 1 }] }));
  desk.scenarios.push(makeScenario(desk, { name: "Dip, then recover", steps: [{ days: 20, movePct: -12 }, { days: 50, movePct: 8 }] }));
  for (const movePct of [-20, 0, 20]) {
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
    const item = entry as ScenarioInput;
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

// Typical strike spacing for a stock at this price.
function strikeIncrement(value: number): number {
  return value < 25 ? 0.5 : value < 200 ? 1 : value < 1000 ? 5 : 10;
}

function niceStrike(value: number): number {
  const increment = strikeIncrement(value);
  return Math.max(increment, Math.round(value / increment) * increment);
}

// Changes the stock, price or IV. When the price changes, strikes are rescaled so
// each strategy stays as far in or out of the money as it was; scenarios are stored
// as moves from today's price, so they follow on their own.
export function withMarket(desk: Desk, patch: Partial<Market>): Desk {
  const next = cleanDesk({ ...desk, market: { ...desk.market, ...patch } });
  if (next.market.spot === desk.market.spot) return next;
  const ratio = next.market.spot / desk.market.spot;
  return {
    ...next,
    strategies: desk.strategies.map((strategy) => {
      const scaled = {
        ...strategy,
        longStrike: niceStrike(strategy.longStrike * ratio),
        shortStrike: niceStrike(strategy.shortStrike * ratio),
      };
      // Rounding can leave both strikes equal; keep the original order.
      if (strategyProblem(scaled) && !strategyProblem(strategy)) {
        const gap = strikeIncrement(scaled.longStrike);
        scaled.shortStrike = Math.max(0.01, scaled.longStrike + (KINDS[strategy.kind].short === "below" ? -gap : gap));
      }
      return { ...scaled, name: strategy.name === autoStrategyName(strategy) ? autoStrategyName(scaled) : strategy.name };
    }),
    scenarios: desk.scenarios.map((scenario) => ({
      ...scenario,
      name: scenario.name === autoScenarioName(desk.market, scenario.steps) ? autoScenarioName(next.market, scenario.steps) : scenario.name,
    })),
  };
}

// The last day any strategy on the desk is still open.
export function horizonDays(desk: Desk): number {
  return desk.strategies.length ? Math.max(...desk.strategies.map((strategy) => strategy.expirationDays)) : 60;
}

export function resolvePath(desk: Desk, scenario: Scenario): PathPoint[] {
  const horizon = horizonDays(desk);
  let previous = 0;
  return scenario.steps.map((step) => {
    const day = step.days ?? Math.max(horizon, previous + 1);
    previous = day;
    return { day, price: movePrice(desk.market, step.movePct), movePct: step.movePct, ivPct: step.ivPct ?? desk.market.ivPct };
  });
}

// Where the stock and IV are on a given day, moving in straight lines from today
// through each step and holding the last step's values afterwards.
export function pathAt(desk: Desk, path: PathPoint[], day: number): { price: number; ivPct: number } {
  let from = { day: 0, price: desk.market.spot, ivPct: desk.market.ivPct };
  for (const point of path) {
    if (day <= point.day) {
      const share = point.day === from.day ? 1 : (day - from.day) / (point.day - from.day);
      return {
        price: from.price + (point.price - from.price) * share,
        ivPct: from.ivPct + (point.ivPct - from.ivPct) * share,
      };
    }
    from = point;
  }
  return { price: from.price, ivPct: from.ivPct };
}

function snapshot(
  desk: Desk,
  strategy: Strategy,
  todayIso: string,
  day: number,
  price: number,
  ivPct: number,
  shortLegPrice = price,
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
    futureVolatilityPct: ivPct,
    capital: strategy.budget,
    allowFractionalContracts: false,
    scenarioPrice: price,
    calendarShortPrice: shortLegPrice,
    scenarioOffsetDays: Math.min(day, strategy.expirationDays),
    ratePct: desk.market.ratePct,
    dividendYieldPct: 0,
  });
}

// Profit or loss of one strategy with the stock at `price` on `day`. A day past the
// strategy's expiry gives its value at expiry at that price.
export function pnlAt(desk: Desk, strategy: Strategy, todayIso: string, day: number, price: number, ivPct: number): number {
  if (strategyProblem(strategy)) return 0;
  const result = snapshot(desk, strategy, todayIso, day, price, ivPct);
  return result.unitCost > 0 && result.contracts > 0 ? result.pnl : 0;
}

// Profit or loss of one strategy on `day` of a path. After the strategy expires its
// result stays locked at the stock price on its expiry day.
function pnlOnPath(desk: Desk, strategy: Strategy, todayIso: string, path: PathPoint[], day: number): number {
  const heldDay = Math.min(day, strategy.expirationDays);
  const point = pathAt(desk, path, heldDay);
  // A calendar's sold call settles at the stock price on its own expiry day.
  const shortLegPrice =
    KINDS[strategy.kind].calendar && heldDay >= strategy.shortExpirationDays
      ? pathAt(desk, path, strategy.shortExpirationDays).price
      : point.price;
  return snapshot(desk, strategy, todayIso, heldDay, point.price, point.ivPct, shortLegPrice).pnl;
}

export function evaluateDesk(desk: Desk, todayIso: string): Board {
  const paths = desk.scenarios.map((scenario) => resolvePath(desk, scenario));
  const totalOdds = desk.scenarios.reduce((sum, scenario) => sum + scenario.odds, 0);
  // With no odds set at all, every scenario counts equally.
  const weights = desk.scenarios.map((scenario) =>
    totalOdds > 0 ? scenario.odds / totalOdds : 1 / Math.max(1, desk.scenarios.length),
  );
  const rows = desk.strategies.map((strategy): BoardRow => {
    const inputProblem = strategyProblem(strategy);
    const entry = inputProblem
      ? null
      : snapshot(desk, strategy, todayIso, 0, desk.market.spot, desk.market.ivPct);
    const problem =
      inputProblem ??
      (entry!.unitCost <= 0
        ? "These strikes have no entry cost in the model."
        : entry!.contracts < 1
          ? "The budget is too small for one contract."
          : null);
    const steps = paths.map((path) =>
      path.map((point): Cell => {
        if (problem) return { pnl: 0, returnPct: 0, expiredDay: null };
        const pnl = pnlOnPath(desk, strategy, todayIso, path, point.day);
        return {
          pnl,
          returnPct: (pnl / strategy.budget) * 100,
          expiredDay: point.day > strategy.expirationDays ? strategy.expirationDays : null,
        };
      }),
    );
    const cells = steps.map((cellsOnPath) => cellsOnPath.at(-1)!);
    const pnls = cells.map((cell) => cell.pnl);
    return {
      strategy,
      cost: entry?.totalCost ?? 0,
      contracts: entry?.contracts ?? 0,
      maxLoss: !entry || entry.maxLossPerUnit === null ? null : entry.maxLossPerUnit * entry.contracts * 100,
      maxProfit: !entry || entry.maxProfitPerUnit === null ? null : entry.maxProfitPerUnit * entry.contracts * 100,
      breakEven: entry?.breakEvenAtExpiry ?? 0,
      cells,
      steps,
      worst: pnls.length ? Math.min(...pnls) : 0,
      best: pnls.length ? Math.max(...pnls) : 0,
      expected: pnls.reduce((sum, pnl, index) => sum + pnl * weights[index], 0),
      problem,
    };
  });
  const usable = rows.filter((row) => !row.problem);
  return {
    rows,
    paths,
    oddsPct: weights.map((weight) => weight * 100),
    bestInScenario: desk.scenarios.map((_, index) =>
      usable.length > 1
        ? usable.reduce((best, row) => (row.cells[index].pnl > best.cells[index].pnl ? row : best)).strategy.id
        : null,
    ),
  };
}

export type PathSeries = {
  days: number[];
  prices: number[];
  ivs: number[];
  lines: { id: string; values: number[] }[];
};

// Every usable strategy's profit or loss day by day along one scenario's path.
export function pathSeries(desk: Desk, todayIso: string, scenario: Scenario): PathSeries {
  const path = resolvePath(desk, scenario);
  const end = path.at(-1)!.day;
  const usable = desk.strategies.filter((strategy) => !strategyProblem(strategy));
  const days = [
    ...new Set([
      ...Array.from({ length: 49 }, (_, index) => Math.round((end * index) / 48)),
      ...path.map((point) => point.day),
      ...usable.map((strategy) => strategy.expirationDays).filter((day) => day < end),
    ]),
  ].sort((first, second) => first - second);
  const points = days.map((day) => pathAt(desk, path, day));
  return {
    days,
    prices: points.map((point) => point.price),
    ivs: points.map((point) => point.ivPct),
    lines: usable.flatMap((strategy) => {
      const entry = snapshot(desk, strategy, todayIso, 0, desk.market.spot, desk.market.ivPct);
      if (entry.unitCost <= 0 || entry.contracts < 1) return [];
      return [{ id: strategy.id, values: days.map((day) => pnlOnPath(desk, strategy, todayIso, path, day)) }];
    }),
  };
}

export type PriceTimeMap = {
  // Highest price first.
  prices: number[];
  days: number[];
  // Profit or loss per strategy id: [price][day].
  values: Record<string, number[][]>;
};

// Every strategy's profit or loss on a grid of stock prices and days, at one IV.
export function priceTimeMap(desk: Desk, todayIso: string, ivPct: number): PriceTimeMap {
  const paths = desk.scenarios.map((scenario) => resolvePath(desk, scenario));
  const widest = Math.max(30, ...paths.flat().map((point) => Math.abs(point.movePct)));
  const range = Math.ceil(widest / 10) * 10;
  const prices = Array.from({ length: 11 }, (_, index) => movePrice(desk.market, Math.max(-95, (range * (5 - index)) / 5)));
  const lastDay = Math.max(horizonDays(desk), ...paths.map((path) => path.at(-1)!.day));
  const days = [...new Set(Array.from({ length: 8 }, (_, index) => Math.round((lastDay * index) / 7)))];
  const values: PriceTimeMap["values"] = {};
  for (const strategy of desk.strategies) {
    values[strategy.id] = prices.map((price) => days.map((day) => pnlAt(desk, strategy, todayIso, day, price, ivPct)));
  }
  return { prices, days, values };
}

// The board as plain data for the assistant. Dollar values are whole USD.
export function describeBoard(desk: Desk, todayIso: string) {
  const board = evaluateDesk(desk, todayIso);
  return {
    market: desk.market,
    scenarios: desk.scenarios.map((scenario, index) => ({
      id: scenario.id,
      name: scenario.name,
      userOddsPct: round(board.oddsPct[index], 1),
      path: board.paths[index].map((point) => ({
        day: point.day,
        stockPrice: point.price,
        movePct: point.movePct,
        ivPct: point.ivPct,
      })),
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
            pnlAtEachStepByScenario: row.steps.map((cells) => cells.map((cell) => Math.round(cell.pnl))),
            worstEndPnl: Math.round(row.worst),
            bestEndPnl: Math.round(row.best),
            oddsWeightedEndPnl: Math.round(row.expected),
          }),
    })),
    notes:
      "Each scenario is a path: the stock moves in straight lines from today's price through each step, and IV moves with it. pnlAtEachStepByScenario follows the order of scenarios, then of each scenario's steps; the last step is the scenario's end result. A strategy that expires before a step keeps the result it had on its expiry day. Theoretical Black-Scholes values, not live quotes; whole contracts of 100 shares; no fees or dividends. Odds are the user's own weights, not probabilities from the model. Each strategy is a separate alternative for the same budget, not a combined position.",
  };
}
