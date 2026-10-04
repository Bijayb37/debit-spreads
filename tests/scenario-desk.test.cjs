const assert = require('node:assert/strict');
const test = require('node:test');
const load = require('./helpers/load-ts.cjs');

const desks = load('lib/scenario-desk.ts');
const { runDeskTool, DESK_TOOLS } = load('lib/desk-tools.ts');
const today = '2026-10-04';

// A desk with one simple scenario per move, so tests do not depend on the examples.
function simpleDesk(moves = [-20, -10, 0, 10, 20]) {
  const desk = desks.defaultDesk();
  desk.scenarios = [];
  for (const movePct of moves) desk.scenarios.push(desks.makeScenario(desk, { movePct }));
  return desk;
}

test('every strategy is priced at the end of every scenario', () => {
  const desk = simpleDesk();
  const board = desks.evaluateDesk(desk, today);
  assert.equal(board.rows.length, 3);
  assert.deepEqual(board.paths.map((path) => path.at(-1).price), [80, 90, 100, 110, 120]);
  assert.ok(board.paths.every((path) => path.length === 1 && path[0].day === 60), 'open-ended steps land on the last expiry');
  for (const row of board.rows) {
    assert.equal(row.problem, null);
    assert.equal(row.cells.length, 5);
    assert.ok(row.contracts >= 1);
    assert.equal(row.worst, Math.min(...row.cells.map((cell) => cell.pnl)));
    assert.equal(row.best, Math.max(...row.cells.map((cell) => cell.pnl)));
  }
  // A long call held to expiry loses its whole cost below the strike and gains above it.
  const call = board.rows[0];
  assert.ok(Math.abs(call.cells[0].pnl + call.cost) < 0.01);
  assert.ok(call.cells[4].pnl > call.cells[3].pnl);
  assert.ok(board.bestInScenario.every((id) => desk.strategies.some((strategy) => strategy.id === id)));
});

test('a path values each strategy at every step, and time decay shows up', () => {
  const desk = desks.cleanDesk({ market: { symbol: 'LITE', spot: 840, ivPct: 60 }, strategies: [{ kind: 'long-call', longStrike: 840, expirationDays: 60 }] });
  // Up to 960 by day 20, back to 850 by day 45, and the same 850 on day 10 for comparison.
  desk.scenarios = [];
  desk.scenarios.push(desks.makeScenario(desk, { steps: [{ days: 45, price: 850 }, { days: 20, price: 960 }] }));
  desk.scenarios.push(desks.makeScenario(desk, { days: 10, price: 850 }));
  const [path, early] = desk.scenarios;
  assert.deepEqual(path.steps.map((step) => step.days), [20, 45], 'steps are put in time order');
  assert.equal(path.name, '$960 → $850');

  const board = desks.evaluateDesk(desk, today);
  assert.deepEqual(board.paths[0].map((point) => [point.day, point.price]), [[20, 960], [45, 850]]);
  const [atPeak, afterFade] = board.rows[0].steps[0];
  assert.ok(atPeak.pnl > 0, 'the rally is a gain');
  assert.ok(afterFade.pnl < atPeak.pnl, 'the fade gives it back');
  assert.equal(board.rows[0].cells[0], afterFade, 'the scenario result is its last step');
  assert.ok(afterFade.pnl < board.rows[0].cells[1].pnl, 'the same price later is worth less to a long call');
});

test('the stock moves in straight lines between steps and holds after the last', () => {
  const desk = simpleDesk();
  const path = desks.resolvePath(desk, desks.makeScenario(desk, { steps: [{ days: 20, movePct: 20, ivPct: 30 }, { days: 40, movePct: 0 }] }));
  assert.deepEqual(desks.pathAt(desk, path, 0), { price: 100, ivPct: 50 });
  assert.deepEqual(desks.pathAt(desk, path, 10), { price: 110, ivPct: 40 });
  assert.deepEqual(desks.pathAt(desk, path, 30), { price: 110, ivPct: 40 });
  assert.deepEqual(desks.pathAt(desk, path, 99), { price: 100, ivPct: 50 });
});

test('a strategy that expires mid-path keeps its expiry result', () => {
  const desk = simpleDesk([0]);
  desk.strategies = [desks.makeStrategy(desk, { kind: 'long-call', longStrike: 100, expirationDays: 30 }), desks.makeStrategy(desk, { kind: 'long-call', longStrike: 100, expirationDays: 90 })];
  desk.scenarios = [desks.makeScenario(desk, { steps: [{ days: 30, movePct: 10 }, { days: 60, movePct: 40 }] })];
  const board = desks.evaluateDesk(desk, today);
  const [short, long] = board.rows;
  assert.equal(short.steps[0][0].expiredDay, null);
  assert.equal(short.steps[0][1].expiredDay, 30);
  assert.equal(short.steps[0][1].pnl, short.steps[0][0].pnl, 'locked in at the day-30 price');
  assert.ok(long.steps[0][1].pnl > long.steps[0][0].pnl, 'the longer call keeps gaining');

  const series = desks.pathSeries(desk, today, desk.scenarios[0]);
  assert.equal(series.days[0], 0);
  assert.equal(series.days.at(-1), 60);
  assert.ok(series.days.includes(30));
  assert.ok(Math.abs(series.lines[0].values[0]) < 0.01, 'no profit or loss on day 0');
  assert.equal(series.lines[0].values.at(-1), short.cells[0].pnl);
});

test('odds weight the expected column and default to equal weights', () => {
  const desk = simpleDesk();
  const equal = desks.evaluateDesk(desk, today);
  const row = equal.rows[0];
  const mean = row.cells.reduce((sum, cell) => sum + cell.pnl, 0) / row.cells.length;
  assert.ok(Math.abs(row.expected - mean) < 0.01);
  assert.deepEqual(equal.oddsPct.map(Math.round), [20, 20, 20, 20, 20]);

  desk.scenarios = desk.scenarios.map((scenario, index) => ({ ...scenario, odds: index === 4 ? 100 : 0 }));
  const certain = desks.evaluateDesk(desk, today);
  assert.ok(Math.abs(certain.rows[0].expected - certain.rows[0].cells[4].pnl) < 0.01);

  desk.scenarios = desk.scenarios.map((scenario) => ({ ...scenario, odds: 0 }));
  assert.deepEqual(desks.evaluateDesk(desk, today).oddsPct.map(Math.round), [20, 20, 20, 20, 20]);
});

test('the price and date map covers the scenarios and matches the board', () => {
  const desk = simpleDesk([-40, 20]);
  const map = desks.priceTimeMap(desk, today, 50);
  assert.equal(map.prices.length, 11);
  assert.equal(map.prices[0], 140);
  assert.equal(map.prices[5], 100, 'today\'s price is the middle row');
  assert.equal(map.prices[10], 60);
  assert.equal(map.days[0], 0);
  assert.equal(map.days.at(-1), 60);
  const call = desk.strategies[0];
  assert.ok(Math.abs(map.values[call.id][5][0]) < 0.01, 'no profit or loss at today\'s price today');
  assert.equal(map.values[call.id][0].at(-1), desks.pnlAt(desk, call, today, 60, 140, 50));
  assert.ok(desks.priceTimeMap(desk, today, 80).values[call.id][5][3] > map.values[call.id][5][3], 'higher IV lifts a long call before expiry');
});

test('changing the stock price rescales strikes and price-based names', () => {
  const desk = desks.defaultDesk();
  const moved = desks.withMarket(desk, { symbol: 'lite', spot: 840, ivPct: 60 });
  assert.deepEqual(moved.strategies.map((strategy) => [strategy.name, strategy.longStrike, strategy.shortStrike]), [
    ['$840 long call', 840, 840],
    ['$840 / $965 call spread', 840, 965],
    ['$715 / $800 bull put spread', 715, 800],
  ]);
  assert.equal(moved.scenarios[0].name, 'Rally, then fade', 'custom names are kept');
  assert.ok(desks.evaluateDesk(moved, today).rows.every((row) => row.problem === null));
  assert.deepEqual(desks.withMarket(desk, { ivPct: 35 }).strategies, desk.strategies, 'an IV change leaves strikes alone');
  const penny = desks.withMarket(desk, { spot: 2 });
  assert.ok(penny.strategies.every((strategy) => desks.strategyProblem(strategy) === null));
});

test('unusable strategies are flagged instead of priced', () => {
  const desk = simpleDesk();
  desk.strategies = [
    { ...desk.strategies[1], shortStrike: 90 },
    { ...desk.strategies[0], budget: 5 },
    desk.strategies[2],
  ];
  const board = desks.evaluateDesk(desk, today);
  assert.match(board.rows[0].problem, /above the bought strike/);
  assert.match(board.rows[1].problem, /too small/);
  assert.equal(board.rows[2].problem, null);
  // With one usable strategy there is nothing to rank.
  assert.ok(board.bestInScenario.every((id) => id === null));
  assert.equal(desks.pathSeries(desk, today, desk.scenarios[0]).lines.length, 1);
});

test('cleanDesk repairs untrusted data and reads the older single-step format', () => {
  const desk = desks.cleanDesk({
    market: { symbol: '<b>', spot: -5, ivPct: 'high' },
    strategies: [{ kind: 'iron-condor' }, { kind: 'long-call', longStrike: 105, id: 'x' }, { kind: 'bear-put', id: 'x' }, null],
    scenarios: [
      { movePct: 9999, odds: -3, name: 'x'.repeat(80) },
      'bad',
      { movePct: -12, days: 30, ivPct: 30 },
      { steps: [{ days: 9 }, { days: 3 }, {}, {}, 5, { days: 3, movePct: 7 }, { days: 1 }, { days: 2 }, { days: 4 }] },
    ],
  });
  assert.deepEqual(desk.market, { symbol: 'STOCK', spot: 0.01, ivPct: 50, ratePct: 4 });
  assert.equal(desk.strategies.length, 2);
  assert.notEqual(desk.strategies[0].id, desk.strategies[1].id);
  assert.equal(desk.scenarios.length, 3);
  assert.deepEqual(desk.scenarios[0].steps, [{ days: null, movePct: 500, ivPct: null }]);
  assert.equal(desk.scenarios[0].odds, 0);
  assert.equal(desk.scenarios[0].name.length, 32);
  assert.deepEqual(desk.scenarios[1].steps, [{ days: 30, movePct: -12, ivPct: 30 }]);
  assert.deepEqual(desk.scenarios[2].steps.map((step) => [step.days, step.movePct]), [[1, 0], [2, 0], [3, 7], [4, 0], [9, 0]], 'sorted, one per day, capped at five');
  assert.throws(() => desks.cleanDesk('nope'));
  assert.equal(desks.cleanDesk({}).scenarios.length, 5);
});

test('assistant tools edit a copy of the desk and reject bad input', () => {
  const desk = simpleDesk();
  const run = (name, args) => runDeskTool(desk, name, args, today);
  const added = run('add_strategy', { kind: 'debit-put-spread', longStrike: 100, shortStrike: 85, budget: 5000 });
  assert.equal(desk.strategies.length, 3, 'the original desk is untouched');
  assert.equal(added.desk.strategies.length, 4);
  assert.match(added.summary, /Added \$100 \/ \$85 put spread/);
  assert.throws(() => run('add_strategy', { kind: 'debit-put-spread', longStrike: 100, shortStrike: 120 }), /below the bought strike/);
  assert.throws(() => run('add_strategy', { kind: 'straddle', longStrike: 100 }), /kind must be/);
  assert.throws(() => run('update_strategy', { id: 'nope' }), /Valid ids: st1, st2, st3/);

  const updated = run('update_strategy', { id: 'st1', longStrike: 110 }).desk.strategies[0];
  assert.equal(updated.longStrike, 110);
  assert.equal(updated.name, '$110 long call', 'a generated name follows the strike');

  const scenarios = run('set_scenarios', { replace: true, scenarios: [
    { name: 'Rally then fade', steps: [{ days: 20, price: 115 }, { days: 45, price: 101, ivPct: 35 }] },
    { name: 'Miss', price: 88, days: 30, ivPct: 30 },
    { movePct: 25 },
  ] }).desk.scenarios;
  assert.deepEqual(scenarios.map((scenario) => [scenario.name, scenario.steps]), [
    ['Rally then fade', [{ days: 20, movePct: 15, ivPct: null }, { days: 45, movePct: 1, ivPct: 35 }]],
    ['Miss', [{ days: 30, movePct: -12, ivPct: 30 }]],
    ['Up 25%', [{ days: null, movePct: 25, ivPct: null }]],
  ]);
  assert.throws(() => run('set_scenarios', { scenarios: [1, 2, 3, 4] }), /most 8|No usable/);

  const withOdds = run('update_scenario', { id: 'sc3', odds: 50 }).desk.scenarios[2];
  assert.deepEqual([withOdds.odds, withOdds.name, withOdds.steps.length], [50, 'Flat', 1]);
  const repathed = run('update_scenario', { id: 'sc3', steps: [{ days: 10, price: 120 }, { days: 30, price: 90 }] }).desk.scenarios[2];
  assert.equal(repathed.name, '$120 → $90', 'a generated name follows the new path');

  const check = run('what_if', { price: 130, days: 20 });
  assert.equal(check.desk, desk, 'a read-only tool leaves the desk alone');
  assert.equal(check.output.pnlByStrategy.length, 3);
  assert.equal(check.output.pnlByStrategy[0].pnl, Math.round(desks.pnlAt(desk, desk.strategies[0], today, 20, 130, 50)));

  const market = run('set_market', { symbol: 'lite', spot: 840, ivPct: 60 }).desk.market;
  assert.deepEqual([market.symbol, market.spot, market.ivPct], ['LITE', 840, 60]);
  assert.throws(() => run('place_trade', {}), /Unknown tool/);
  assert.deepEqual(DESK_TOOLS.map((tool) => tool.name), ['add_strategy', 'update_strategy', 'remove_strategy', 'set_scenarios', 'update_scenario', 'remove_scenario', 'what_if', 'set_market']);
});
