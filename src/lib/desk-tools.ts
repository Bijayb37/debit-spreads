import type { OptionStrategy } from "@/lib/debit-call-spread";
import {
  KIND_IDS,
  MAX_SCENARIOS,
  MAX_STRATEGIES,
  cleanDesk,
  makeScenario,
  makeStrategy,
  strategyProblem,
  type Desk,
  type Scenario,
  type Strategy,
} from "@/lib/scenario-desk";

// The assistant's tools. Each one edits a copy of the desk on the server and the
// model is shown the recalculated board, so it explains real numbers.

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

const scenarioFields = {
  name: { type: "string", description: "Short name, e.g. 'Earnings miss'." },
  movePct: { type: "number", description: "Stock move from today's price in percent, e.g. -12." },
  price: { type: "number", description: "Stock price in USD. Use instead of movePct when the user gives a price." },
  days: { type: "integer", description: "Days from today. Omit to value each strategy at its own expiration." },
  ivPct: { type: "number", description: "IV in percent at that time. Omit to keep the entry IV." },
  odds: { type: "number", description: "The user's own relative weight for this scenario, 0 to 100. Set only from what the user says they believe." },
};

type Tool = {
  name: string;
  description: string;
  parameters: { type: "object"; properties: Record<string, unknown>; required?: string[] };
};

export const DESK_TOOLS: Tool[] = [
  {
    name: "add_strategy",
    description: "Add an option strategy to the comparison. Call once per strategy.",
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
    name: "set_scenarios",
    description: "Add what-if scenarios, or replace the whole list. Every strategy is priced in every scenario.",
    parameters: {
      type: "object",
      properties: {
        replace: { type: "boolean", description: "true replaces all scenarios; false (default) adds to them." },
        scenarios: { type: "array", items: { type: "object", properties: scenarioFields } },
      },
      required: ["scenarios"],
    },
  },
  {
    name: "update_scenario",
    description: "Change fields of an existing scenario by id, for example the user's odds. Pass only what changes.",
    parameters: { type: "object", properties: { id: { type: "string" }, ...scenarioFields }, required: ["id"] },
  },
  {
    name: "remove_scenario",
    description: "Remove a scenario by id.",
    parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
  {
    name: "set_market",
    description: "Change the stock being modelled. Use only values the user gives; there are no live quotes. Existing strikes are kept.",
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
export function runDeskTool(desk: Desk, name: string, value: unknown): { desk: Desk; summary: string } {
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

  if (name === "set_scenarios") {
    if (!Array.isArray(args.scenarios) || args.scenarios.length === 0) throw new Error("scenarios must be a non-empty list.");
    let next: Desk = { ...desk, scenarios: args.replace === true ? [] : desk.scenarios };
    const room = MAX_SCENARIOS - next.scenarios.length;
    if (room <= 0) throw new Error(`The desk holds at most ${MAX_SCENARIOS} scenarios. Remove one or pass replace: true.`);
    const added: string[] = [];
    for (const entry of args.scenarios.slice(0, room)) {
      if (!entry || typeof entry !== "object") continue;
      const scenario = makeScenario(next, { ...(entry as Partial<Scenario>), id: undefined });
      next = { ...next, scenarios: [...next.scenarios, scenario] };
      added.push(scenario.name);
    }
    if (added.length === 0) throw new Error("No usable scenarios were given.");
    return { desk: next, summary: `${args.replace === true ? "Set scenarios to" : "Added scenario"} ${added.join(", ")}` };
  }

  if (name === "update_scenario") {
    const current = findById(desk.scenarios, args.id, "scenario");
    const moved = args.movePct !== undefined || args.price !== undefined;
    const scenario = makeScenario(desk, {
      ...current,
      ...(args as Partial<Scenario>),
      id: current.id,
      movePct: args.price !== undefined ? undefined : ((args.movePct as number | undefined) ?? current.movePct),
      // A generated name follows the new move.
      name: typeof args.name === "string" ? args.name : moved && current.name === makeScenario(desk, { movePct: current.movePct }).name ? "" : current.name,
    });
    return {
      desk: { ...desk, scenarios: desk.scenarios.map((item) => (item.id === current.id ? scenario : item)) },
      summary: `Updated scenario ${scenario.name}`,
    };
  }

  if (name === "remove_scenario") {
    const current = findById(desk.scenarios, args.id, "scenario");
    if (desk.scenarios.length <= 1) throw new Error("The desk needs at least one scenario.");
    return { desk: { ...desk, scenarios: desk.scenarios.filter((item) => item.id !== current.id) }, summary: `Removed scenario ${current.name}` };
  }

  if (name === "set_market") {
    const next = cleanDesk({ ...desk, market: { ...desk.market, ...args } });
    return { desk: next, summary: `Set ${next.market.symbol} to $${next.market.spot} at ${next.market.ivPct}% IV` };
  }

  throw new Error("Unknown tool.");
}
