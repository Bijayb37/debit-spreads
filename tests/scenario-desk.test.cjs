const assert = require('node:assert/strict');
const test = require('node:test');
const load = require('./helpers/load-ts.cjs');

const desks = load('lib/scenario-desk.ts');
const { runDeskTool, DESK_TOOLS } = load('lib/desk-tools.ts');
const today = '2026-10-04';

test('the example desk prices every strategy in every scenario', () => {
  const desk = desks.defaultDesk();
  const board = desks.evaluateDesk(desk, today);
  assert.equal(board.rows.length, 3);
  assert.deepEqual(board.prices, [80, 90, 100, 110, 120]);
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
  assert.equal(board.bestInScenario.length, 5);
  assert.ok(board.bestInScenario.every((id) => desk.strategies.some((strategy) => strategy.id === id)));
});

test('odds weight the expected column and default to equal weights', () => {
  const desk = desks.defaultDesk();
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

test('a scenario date and IV change the value before expiry', () => {
  const desk = desks.defaultDesk();
  desk.strategies = [desk.strategies[0]];
  desk.scenarios = [
    desks.makeScenario(desk, { movePct: 0 }),
    desks.makeScenario(desk, { movePct: 0, days: 10 }),
    desks.makeScenario(desk, { movePct: 0, days: 10, ivPct: 20 }),
    desks.makeScenario(desk, { movePct: 0, days: 500 }),
  ];
  const [atExpiry, early, earlyLowIv, afterExpiry] = desks.evaluateDesk(desk, today).rows[0].cells;
  assert.ok(early.pnl > atExpiry.pnl, 'time value remains before expiry');
  assert.ok(earlyLowIv.pnl < early.pnl, 'lower IV lowers a long call');
  assert.equal(afterExpiry.pnl, atExpiry.pnl, 'dates past expiry use the expiry value');
});

test('unusable strategies are flagged instead of priced', () => {
  const desk = desks.defaultDesk();
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
});

test('cleanDesk repairs untrusted data', () => {
  const desk = desks.cleanDesk({
    market: { symbol: '<b>', spot: -5, ivPct: 'high' },
    strategies: [{ kind: 'iron-condor' }, { kind: 'long-call', longStrike: 105, id: 'x' }, { kind: 'bear-put', id: 'x' }, null],
    scenarios: [{ movePct: 9999, odds: -3, name: 'x'.repeat(80) }, 'bad'],
  });
  assert.deepEqual(desk.market, { symbol: 'STOCK', spot: 0.01, ivPct: 50, ratePct: 4 });
  assert.equal(desk.strategies.length, 2);
  assert.notEqual(desk.strategies[0].id, desk.strategies[1].id);
  assert.equal(desk.scenarios.length, 1);
  assert.equal(desk.scenarios[0].movePct, 500);
  assert.equal(desk.scenarios[0].odds, 0);
  assert.equal(desk.scenarios[0].name.length, 32);
  assert.throws(() => desks.cleanDesk('nope'));
  assert.equal(desks.cleanDesk({}).scenarios.length, 5);
});

test('assistant tools edit a copy of the desk and reject bad input', () => {
  const desk = desks.defaultDesk();
  const added = runDeskTool(desk, 'add_strategy', { kind: 'debit-put-spread', longStrike: 100, shortStrike: 85, budget: 5000 });
  assert.equal(desk.strategies.length, 3, 'the original desk is untouched');
  assert.equal(added.desk.strategies.length, 4);
  assert.match(added.summary, /Added \$100 \/ \$85 put spread/);
  assert.throws(() => runDeskTool(desk, 'add_strategy', { kind: 'debit-put-spread', longStrike: 100, shortStrike: 120 }), /below the bought strike/);
  assert.throws(() => runDeskTool(desk, 'add_strategy', { kind: 'straddle', longStrike: 100 }), /kind must be/);
  assert.throws(() => runDeskTool(desk, 'update_strategy', { id: 'nope' }), /Valid ids: st1, st2, st3/);

  const updated = runDeskTool(desk, 'update_strategy', { id: 'st1', longStrike: 110 }).desk.strategies[0];
  assert.equal(updated.longStrike, 110);
  assert.equal(updated.name, '$110 long call', 'a generated name follows the strike');

  const scenarios = runDeskTool(desk, 'set_scenarios', { replace: true, scenarios: [{ name: 'Miss', price: 88, days: 30, ivPct: 30 }, { movePct: 25 }] }).desk.scenarios;
  assert.deepEqual(scenarios.map((scenario) => [scenario.name, scenario.movePct, scenario.days, scenario.ivPct]), [['Miss', -12, 30, 30], ['Up 25%', 25, null, null]]);
  assert.throws(() => runDeskTool(desk, 'set_scenarios', { scenarios: [1, 2, 3, 4] }), /most 8|No usable/);
  assert.equal(runDeskTool(desk, 'update_scenario', { id: 'sc3', odds: 50 }).desk.scenarios[2].odds, 50);

  const market = runDeskTool(desk, 'set_market', { symbol: 'aapl', spot: 230, ivPct: 35 }).desk.market;
  assert.deepEqual([market.symbol, market.spot, market.ivPct], ['AAPL', 230, 35]);
  assert.throws(() => runDeskTool(desk, 'place_trade', {}), /Unknown tool/);
  assert.deepEqual(DESK_TOOLS.map((tool) => tool.name), ['add_strategy', 'update_strategy', 'remove_strategy', 'set_scenarios', 'update_scenario', 'remove_scenario', 'set_market']);
});
