import {
  addDaysToIso,
  createScenarioSnapshot,
  type OptionStrategy,
} from "@/lib/debit-call-spread";

// The desk: one stock, one or more option strategies, and a "what if" (a stock
// price, a day and an IV) that every strategy is valued at. Moments are what-ifs
// the user has saved to compare side by side. This module is pure so the page and
// the assistant's server tools calculate the same numbers.

export const MAX_STRATEGIES = 6;
export const MAX_MOMENTS = 8;

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

// Where the stock is (as a move from today's price), how many days from today, and
// the IV then. `ivPct: null` keeps today's IV.
export type WhatIf = { movePct: number; days: number; ivPct: number | null };

export type WhatIfInput = { movePct?: number; price?: number; days?: number; ivPct?: number | null };

// A saved what-if.
export type Moment = WhatIf & { id: string; name: string };

export type Desk = { market: Market; strategies: Strategy[]; whatIf: WhatIf; moments: Moment[] };

// `expired` is set when the day is past the strategy's expiry; the result is then
// its value at expiry at that stock price.
export type Outcome = { pnl: number; returnPct: number; value: number; expired: boolean };

export type BoardRow = {
  strategy: Strategy;
  cost: number;
  contracts: number;
  // Cost of one contract (or one spread) in dollars; for a credit entry, the reserve set aside for it.
  unitCost: number;
  // The credit received per contract when the entry is a credit sized by a reserve, else null.
  unitCredit: number | null;
  maxLoss: number | null;
  maxProfit: number | null;
  // The most the position can make as a percentage of its cost; null when uncapped.
  maxReturnPct: number | null;
  breakEven: number;
  // Ratio spreads have a second, lower break-even.
  lowerBreakEven: number | null;
  problem: string | null;
  now: Outcome;
  moments: Outcome[];
};

export type Board = {
  rows: BoardRow[];
  // The what-if with its price and IV worked out.
  price: number;
  days: number;
  ivPct: number;
  // Id of the strategy with the highest profit or loss at the what-if, when there is
  // more than one to compare.
  bestNow: string | null;
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

// Dollars and cents, e.g. $356.83.
export function formatCents(value: number): string {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Whole dollars with an explicit sign, e.g. +$6,540 or -$850.
export function formatDollars(value: number, signed = true): string {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? "-" : signed && rounded > 0 ? "+" : "";
  return `${sign}$${Math.abs(rounded).toLocaleString("en-US")}`;
}

// Compact dollars for tight spaces, e.g. +$9.6K.
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

export function momentLabel(market: Market, moment: Moment): string {
  return moment.name || `${formatPrice(movePrice(market, moment.movePct))} on day ${moment.days}`;
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

// Typical strike spacing for a stock at this price.
export function strikeIncrement(value: number): number {
  return value < 25 ? 0.5 : value < 200 ? 1 : value < 1000 ? 5 : 10;
}

function niceStrike(value: number): number {
  const increment = strikeIncrement(value);
  return Math.max(increment, Math.round(value / increment) * increment);
}

// Fills in a complete strategy from whatever fields are known, using the stock price
// for default strikes.
export function makeStrategy(
  desk: Pick<Desk, "market" | "strategies">,
  input: Partial<Strategy> & { kind: OptionStrategy },
): Strategy {
  const kind = KINDS[input.kind];
  const spot = desk.market.spot;
  const longStrike = round(
    clampNumber(input.longStrike, 0.01, 1e7, niceStrike(input.kind === "bull-put-spread" ? spot * 0.85 : spot)),
  );
  const defaultShort =
    input.kind === "bull-put-spread"
      ? Math.max(longStrike + strikeIncrement(spot), niceStrike(spot * 0.95))
      : kind.short === "above"
        ? Math.max(longStrike + strikeIncrement(spot), niceStrike(longStrike * 1.1))
        : kind.short === "below"
          ? Math.max(0.01, Math.min(longStrike - strikeIncrement(spot), niceStrike(longStrike * 0.9)))
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

export function makeWhatIf(market: Market, input: WhatIfInput, fallback?: WhatIf): WhatIf {
  return {
    movePct: round(
      clampNumber(
        input.movePct ?? (typeof input.price === "number" ? (input.price / market.spot - 1) * 100 : undefined),
        -95,
        500,
        fallback?.movePct ?? 0,
      ),
      // Enough precision that a price the user typed comes back exactly.
      4,
    ),
    days: Math.round(clampNumber(input.days, 0, 1095, fallback?.days ?? 0)),
    ivPct:
      input.ivPct === null
        ? null
        : input.ivPct === undefined
          ? (fallback?.ivPct ?? null)
          : round(clampNumber(input.ivPct, 1, 300, market.ivPct), 1),
  };
}

export function makeMoment(desk: Desk, input: WhatIfInput & { id?: string; name?: string }): Moment {
  return {
    ...makeWhatIf(desk.market, input),
    id: input.id || nextId("m", desk.moments),
    name: cleanText(input.name, 32),
  };
}

export function defaultDesk(): Desk {
  const desk: Desk = {
    market: { symbol: "NVDA", spot: 100, ivPct: 50, ratePct: 4 },
    strategies: [],
    whatIf: { movePct: 10, days: 30, ivPct: null },
    moments: [],
  };
  desk.strategies.push(makeStrategy(desk, { kind: "long-call" }));
  return desk;
}

type LegacyScenario = WhatIfInput & { name?: string; steps?: WhatIfInput[] };

// Rebuilds a desk from untrusted data (browser storage, a request body). Anything
// malformed is dropped or reset; a desk that is not an object at all throws.
export function cleanDesk(value: unknown): Desk {
  if (!value || typeof value !== "object") throw new Error("Not a desk.");
  const raw = value as { market?: Partial<Market>; strategies?: unknown; whatIf?: unknown; moments?: unknown; scenarios?: unknown };
  const symbol = cleanText(raw.market?.symbol, 10).toUpperCase();
  const desk: Desk = {
    market: {
      symbol: /^[A-Z0-9.^-]+$/.test(symbol) ? symbol : "STOCK",
      spot: round(clampNumber(raw.market?.spot, 0.01, 1e7, 100)),
      ivPct: round(clampNumber(raw.market?.ivPct, 1, 300, 50), 1),
      ratePct: round(clampNumber(raw.market?.ratePct, 0, 20, 4), 2),
    },
    strategies: [],
    whatIf: defaultDesk().whatIf,
    moments: [],
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
  if (raw.whatIf && typeof raw.whatIf === "object") {
    desk.whatIf = makeWhatIf(desk.market, raw.whatIf as WhatIfInput, desk.whatIf);
  }
  // Desks saved by the earlier version stored scenarios made of dated steps.
  const saved: unknown[] = Array.isArray(raw.moments)
    ? raw.moments
    : Array.isArray(raw.scenarios)
      ? (raw.scenarios as LegacyScenario[]).flatMap((scenario) =>
          scenario && typeof scenario === "object"
            ? (Array.isArray(scenario.steps) ? scenario.steps : [scenario]).filter(
                (step) => step && typeof step === "object" && typeof step.days === "number",
              )
            : [],
        )
      : [];
  for (const entry of saved) {
    if (desk.moments.length >= MAX_MOMENTS) break;
    const item = entry as WhatIfInput & { id?: string; name?: string };
    if (!item || typeof item !== "object") continue;
    const id = cleanText(item.id, 24);
    desk.moments.push(
      makeMoment(desk, { ...item, id: id && !desk.moments.some((moment) => moment.id === id) ? id : undefined }),
    );
  }
  return desk;
}

// Changes the stock, price or IV. When the price changes, strikes are rescaled so
// each strategy stays as far in or out of the money as it was; the what-if and saved
// moments are stored as moves from today's price, so they follow on their own.
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
  };
}

// The last day any strategy on the desk is still open.
export function horizonDays(desk: Pick<Desk, "strategies">): number {
  return desk.strategies.length ? Math.max(...desk.strategies.map((strategy) => strategy.expirationDays)) : 60;
}

function snapshot(desk: Desk, strategy: Strategy, todayIso: string, day: number, price: number, ivPct: number) {
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
    calendarShortPrice: price,
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

export function evaluateDesk(desk: Desk, todayIso: string): Board {
  // The what-if cannot be dated after the last strategy expires.
  const days = Math.min(desk.whatIf.days, horizonDays(desk));
  const price = movePrice(desk.market, desk.whatIf.movePct);
  const ivPct = desk.whatIf.ivPct ?? desk.market.ivPct;
  const rows = desk.strategies.map((strategy): BoardRow => {
    const inputProblem = strategyProblem(strategy);
    const entry = inputProblem ? null : snapshot(desk, strategy, todayIso, 0, desk.market.spot, desk.market.ivPct);
    const problem =
      inputProblem ??
      (entry!.unitCost <= 0
        ? "These strikes have no entry cost in the model."
        : entry!.contracts < 1
          ? "The budget is too small for one contract."
          : null);
    const cost = entry?.totalCost ?? 0;
    const outcome = (point: { price: number; days: number; ivPct: number }): Outcome => {
      if (problem) return { pnl: 0, returnPct: 0, value: 0, expired: false };
      const { pnl } = snapshot(desk, strategy, todayIso, point.days, point.price, point.ivPct);
      return { pnl, returnPct: cost > 0 ? (pnl / cost) * 100 : 0, value: cost + pnl, expired: point.days > strategy.expirationDays };
    };
    const maxProfit = !entry || entry.maxProfitPerUnit === null ? null : entry.maxProfitPerUnit * entry.contracts * 100;
    return {
      strategy,
      cost,
      contracts: entry?.contracts ?? 0,
      unitCost: (entry?.unitCost ?? 0) * 100,
      unitCredit: entry && entry.reserveOffset > 0 ? -entry.entryPremium * 100 : null,
      maxLoss: !entry || entry.maxLossPerUnit === null ? null : entry.maxLossPerUnit * entry.contracts * 100,
      maxProfit,
      maxReturnPct: maxProfit === null || cost <= 0 ? null : (maxProfit / cost) * 100,
      breakEven: entry?.breakEvenAtExpiry ?? 0,
      lowerBreakEven: entry?.lowerBreakEvenAtExpiry ?? null,
      problem,
      now: outcome({ price, days, ivPct }),
      moments: desk.moments.map((moment) =>
        outcome({ price: movePrice(desk.market, moment.movePct), days: moment.days, ivPct: moment.ivPct ?? desk.market.ivPct }),
      ),
    };
  });
  const usable = rows.filter((row) => !row.problem);
  return {
    rows,
    price,
    days,
    ivPct,
    bestNow: usable.length > 1 ? usable.reduce((best, row) => (row.now.pnl > best.now.pnl ? row : best)).strategy.id : null,
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
  const widest = Math.max(30, ...[desk.whatIf, ...desk.moments].map((point) => Math.abs(point.movePct)));
  const range = Math.ceil(widest / 10) * 10;
  const prices = Array.from({ length: 11 }, (_, index) => movePrice(desk.market, Math.max(-95, (range * (5 - index)) / 5)));
  const lastDay = horizonDays(desk);
  const days = [...new Set(Array.from({ length: 8 }, (_, index) => Math.round((lastDay * index) / 7)))];
  const values: PriceTimeMap["values"] = {};
  for (const strategy of desk.strategies) {
    values[strategy.id] = prices.map((price) => days.map((day) => pnlAt(desk, strategy, todayIso, day, price, ivPct)));
  }
  return { prices, days, values };
}

// The desk as plain data for the assistant. Dollar values are whole USD.
export function describeBoard(desk: Desk, todayIso: string) {
  const board = evaluateDesk(desk, todayIso);
  const usable = board.rows.filter((row) => !row.problem);
  return {
    market: desk.market,
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
          }),
    })),
    whatIfOnScreen: {
      day: board.days,
      stockPrice: board.price,
      movePct: round(desk.whatIf.movePct, 1),
      ivPct: board.ivPct,
      pnlByStrategy: usable.map((row) => ({ id: row.strategy.id, pnl: Math.round(row.now.pnl), returnOnCostPct: Math.round(row.now.returnPct) })),
    },
    savedMoments: desk.moments.map((moment, index) => ({
      id: moment.id,
      name: momentLabel(desk.market, moment),
      day: moment.days,
      stockPrice: movePrice(desk.market, moment.movePct),
      ivPct: moment.ivPct ?? desk.market.ivPct,
      pnlByStrategy: usable.map((row) => ({ id: row.strategy.id, pnl: Math.round(row.moments[index].pnl) })),
    })),
    notes:
      "Theoretical Black-Scholes values, not live quotes; whole contracts of 100 shares; no fees or dividends. Return is profit or loss divided by the cost of the position. A day past a strategy's expiry shows that strategy at its expiry at that stock price. With several strategies, each is a separate alternative, not a combined position.",
  };
}
