import type { OptionStrategy } from "@/lib/debit-call-spread";
import {
  KIND_IDS,
  MAX_MOMENTS,
  MAX_STRATEGIES,
  horizonDays,
  makeMoment,
  makeStrategy,
  makeWhatIf,
  momentLabel,
  movePrice,
  pnlAt,
  strategyProblem,
  withMarket,
  type Desk,
  type Strategy,
  type WhatIfInput,
} from "@/lib/scenario-desk";

// The assistant's tools. Each one edits a copy of the desk on the server and the
// model is shown the recalculated desk, so it explains real numbers.

const strategyFields = {
  name: { type: "string", description: "Short name. Omit to generate one from the strikes." },
  longStrike: { type: "number", description: "Strike of the option bought. For call-calendar, the shared strike." },
  shortStrike: {
    type: "number",
    description:
      "Strike of the option(s) sold. Above longStrike for debit-call-spread, bull-put-spread and call-ratio-spread; below it for debit-put-spread and put-ratio-spread. Omit for long-call, bear-put and call-calendar.",
  },
  expirationDays: { type: "integer", description: "Days to expiration, 1 to 1095." },
  shortExpirationDays: { type: "integer", description: "call-calendar only: days until the sold call expires." },
  ratio: { type: "integer", description: "Ratio spreads only: options sold per option bought, 2 to 10." },
  budget: { type: "number", description: "USD to allocate. Keep budgets equal across strategies unless the user says otherwise." },
};

const pointFields = {
  price: { type: "number", description: "Stock price in USD at that point. Use this when the user gives prices." },
  movePct: { type: "number", description: "Alternative to price: move from today's price in percent, e.g. -12." },
  days: { type: "integer", description: "Days from today, 0 or more." },
  ivPct: { type: "number", description: "IV in percent at that point. Omit to keep today's IV." },
};

type Tool = {
  name: string;
  description: string;
  parameters: { type: "object"; properties: Record<string, unknown>; required?: string[] };
};

export const DESK_TOOLS: Tool[] = [
  {
    name: "add_strategy",
    description: "Add an option strategy. Call once per strategy. Add only what the user asks for; one strategy is often enough.",
    parameters: {
      type: "object",
      properties: { kind: { type: "string", enum: KIND_IDS }, ...strategyFields },
      required: ["kind", "longStrike"],
    },
  },
  {
    name: "update_strategy",
    description: "Change fields of an existing strategy by id. Pass only what changes.",
    parameters: { type: "object", properties: { id: { type: "string" }, ...strategyFields }, required: ["id"] },
  },
  {
    name: "remove_strategy",
    description: "Remove a strategy by id.",
    parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
  {
    name: "show_what_if",
    description: "Move the page's what-if controls to a stock price, day and IV, so the user sees every strategy at that point. Pass only what changes.",
    parameters: { type: "object", properties: pointFields },
  },
  {
    name: "save_moments",
    description:
      "Save points in time to compare side by side. When the user describes a sequence ('it ran to 960 in three weeks, then fell to 850 by day 45'), save one moment per point.",
    parameters: {
      type: "object",
      properties: {
        replace: { type: "boolean", description: "true replaces all saved moments; false (default) adds to them." },
        moments: {
          type: "array",
          items: { type: "object", properties: { name: { type: "string", description: "Optional short name." }, ...pointFields } },
        },
      },
      required: ["moments"],
    },
  },
  {
    name: "remove_moment",
    description: "Remove a saved moment by id.",
    parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
  {
    name: "what_if",
    description: "Read-only. Returns every strategy's profit or loss at one stock price, day and IV without changing the page.",
    parameters: { type: "object", properties: pointFields },
  },
  {
    name: "set_market",
    description: "Change the stock being modelled. Use only values the user gives; there are no live quotes. When the price changes, existing strikes are rescaled to it, so check them afterwards.",
    parameters: {
      type: "object",
      properties: {
        symbol: { type: "string" },
        spot: { type: "number", description: "Stock price today in USD." },
        ivPct: { type: "number", description: "Implied volatility today in percent." },
      },
    },
  },
];

function findById<Item extends { id: string }>(items: Item[], id: unknown, what: string): Item {
  const item = items.find((entry) => entry.id === id);
  if (!item) throw new Error(`No ${what} has id "${String(id)}". Valid ids: ${items.map((entry) => entry.id).join(", ") || "none"}.`);
  return item;
}

function checkedStrategy(strategy: Strategy): Strategy {
  const problem = strategyProblem(strategy);
  if (problem) throw new Error(problem);
  return strategy;
}

// Runs one tool call against the desk. Throws with a message the model can act on.
// `output` carries a read-only tool's answer; the desk is returned unchanged for those.
export function runDeskTool(
  desk: Desk,
  name: string,
  value: unknown,
  todayIso: string,
): { desk: Desk; summary: string; output?: unknown } {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Tool arguments must be an object.");
  const args = value as Record<string, unknown>;

  if (name === "add_strategy") {
    if (desk.strategies.length >= MAX_STRATEGIES) throw new Error(`The desk holds at most ${MAX_STRATEGIES} strategies. Remove one first.`);
    if (!KIND_IDS.includes(args.kind as OptionStrategy)) throw new Error(`kind must be one of: ${KIND_IDS.join(", ")}.`);
    const strategy = checkedStrategy(makeStrategy(desk, { ...(args as Partial<Strategy>), id: undefined, kind: args.kind as OptionStrategy }));
    return { desk: { ...desk, strategies: [...desk.strategies, strategy] }, summary: `Added ${strategy.name}` };
  }

  if (name === "update_strategy") {
    const current = findById(desk.strategies, args.id, "strategy");
    const kind = args.kind === undefined ? current.kind : (args.kind as OptionStrategy);
    if (!KIND_IDS.includes(kind)) throw new Error(`kind must be one of: ${KIND_IDS.join(", ")}.`);
    // A generated name follows the new strikes; a custom one is kept.
    const keepsName = typeof args.name === "string" || current.name !== makeStrategy(desk, { ...current, name: "" }).name;
    const strategy = checkedStrategy(
      makeStrategy(desk, { ...current, ...(args as Partial<Strategy>), kind, id: current.id, name: keepsName ? ((args.name as string) ?? current.name) : "" }),
    );
    return {
      desk: { ...desk, strategies: desk.strategies.map((item) => (item.id === current.id ? strategy : item)) },
      summary: `Updated ${strategy.name}`,
    };
  }

  if (name === "remove_strategy") {
    const current = findById(desk.strategies, args.id, "strategy");
    return { desk: { ...desk, strategies: desk.strategies.filter((item) => item.id !== current.id) }, summary: `Removed ${current.name}` };
  }

  if (name === "show_what_if") {
    const whatIf = makeWhatIf(desk.market, args as WhatIfInput, desk.whatIf);
    return {
      desk: { ...desk, whatIf },
      summary: `Showing $${movePrice(desk.market, whatIf.movePct)} on day ${whatIf.days}`,
    };
  }

  if (name === "save_moments") {
    if (!Array.isArray(args.moments) || args.moments.length === 0) throw new Error("moments must be a non-empty list.");
    let next: Desk = { ...desk, moments: args.replace === true ? [] : desk.moments };
    const room = MAX_MOMENTS - next.moments.length;
    if (room <= 0) throw new Error(`The desk holds at most ${MAX_MOMENTS} saved moments. Remove one or pass replace: true.`);
    const added: string[] = [];
    for (const entry of args.moments.slice(0, room)) {
      if (!entry || typeof entry !== "object") continue;
      const moment = makeMoment(next, { ...(entry as WhatIfInput & { name?: string }), id: undefined });
      next = { ...next, moments: [...next.moments, moment] };
      added.push(momentLabel(next.market, moment));
    }
    if (added.length === 0) throw new Error("No usable moments were given.");
    return { desk: next, summary: `Saved ${added.join(", ")}` };
  }

  if (name === "remove_moment") {
    const current = findById(desk.moments, args.id, "saved moment");
    return { desk: { ...desk, moments: desk.moments.filter((item) => item.id !== current.id) }, summary: `Removed ${momentLabel(desk.market, current)}` };
  }

  if (name === "what_if") {
    const point = makeWhatIf(desk.market, args as WhatIfInput, { movePct: 0, days: horizonDays(desk), ivPct: null });
    const price = movePrice(desk.market, point.movePct);
    const ivPct = point.ivPct ?? desk.market.ivPct;
    return {
      desk,
      summary: `Checked $${price} on day ${point.days}`,
      output: {
        day: point.days,
        stockPrice: price,
        ivPct,
        pnlByStrategy: desk.strategies.map((strategy) => ({
          id: strategy.id,
          name: strategy.name,
          pnl: Math.round(pnlAt(desk, strategy, todayIso, point.days, price, ivPct)),
          ...(point.days > strategy.expirationDays ? { note: `expired on day ${strategy.expirationDays}; shown at expiry at this price` } : {}),
        })),
      },
    };
  }

  if (name === "set_market") {
    const next = withMarket(desk, args);
    return { desk: next, summary: `Set ${next.market.symbol} to $${next.market.spot} at ${next.market.ivPct}% IV` };
  }

  throw new Error("Unknown tool.");
}
