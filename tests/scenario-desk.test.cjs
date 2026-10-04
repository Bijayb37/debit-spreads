const assert = require('node:assert/strict');
const test = require('node:test');
const load = require('./helpers/load-ts.cjs');

const desks = load('lib/scenario-desk.ts');
const { runDeskTool, DESK_TOOLS } = load('lib/desk-tools.ts');
const today = '2026-10-04';

// LITE at $840 with one 60-day call, as in the example the desk was designed around.
function liteDesk() {
  return desks.cleanDesk({ market: { symbol: 'LITE', spot: 840, ivPct: 60 }, strategies: [{ kind: 'long-call', longStrike: 840, expirationDays: 60 }] });
}

test('the example desk is one strategy and one what-if', () => {
  const desk = desks.defaultDesk();
  assert.equal(desk.strategies.length, 1);
  assert.equal(desk.moments.length, 0);
  const board = desks.evaluateDesk(desk, today);
  assert.deepEqual([board.price, board.days, board.ivPct], [110, 30, 50]);
  const [row] = board.rows;
  assert.equal(row.problem, null);
  assert.ok(row.contracts >= 1);
  assert.ok(row.now.pnl > 0, 'a call gains when the stock is up 10%');
  assert.ok(Math.abs(row.now.value - (row.cost + row.now.pnl)) < 0.01);
  assert.ok(Math.abs(row.now.returnPct - (row.now.pnl / row.cost) * 100) < 0.01);
  assert.equal(board.bestNow, null, 'nothing to rank with one strategy');
});

test('the what-if follows price, day and IV', () => {
  const desk = liteDesk();
  const at = (whatIf) => desks.evaluateDesk({ ...desk, whatIf: desks.makeWhatIf(desk.market, whatIf) }, today).rows[0].now.pnl;
  assert.ok(Math.abs(at({ price: 840, days: 0 })) < 0.01, 'no profit or loss at today\'s price today');
  assert.ok(at({ price: 960, days: 20 }) > 0, 'a rally is a gain');
  assert.ok(at({ price: 850, days: 45 }) < 0, 'a small gain in the stock late on is a loss for the call');
  assert.ok(at({ price: 850, days: 45 }) < at({ price: 850, days: 10 }), 'the same price later is worth less');
  assert.ok(at({ price: 850, days: 30, ivPct: 30 }) < at({ price: 850, days: 30 }), 'lower IV lowers a long call');
  assert.equal(desks.makeWhatIf(desk.market, { price: 960 }).movePct, 14.2857);
  assert.equal(desks.movePrice(desk.market, 14.2857), 960, 'a typed price comes back exactly');
});

test('the what-if day stops at the last expiry and later days use the expiry value', () => {
  const desk = liteDesk();
  desk.strategies.push(desks.makeStrategy(desk, { kind: 'long-call', longStrike: 840, expirationDays: 30 }));
  desk.whatIf = { movePct: 10, days: 500, ivPct: null };
  const board = desks.evaluateDesk(desk, today);
  assert.equal(board.days, 60);
  assert.equal(board.rows[0].now.expired, false);
  assert.equal(board.rows[1].now.expired, true);
  assert.equal(board.rows[1].now.pnl, desks.pnlAt(desk, desk.strategies[1], today, 30, 924, 60));
  assert.ok(board.bestNow === desk.strategies[0].id || board.bestNow === desk.strategies[1].id);
});

test('saved moments are valued for every strategy', () => {
  const desk = liteDesk();
  desk.moments.push(desks.makeMoment(desk, { price: 960, days: 20 }));
  desk.moments.push(desks.makeMoment(desk, { price: 850, days: 45, name: 'Pullback' }));
  assert.deepEqual(desk.moments.map((moment) => desks.momentLabel(desk.market, moment)), ['$960 on day 20', 'Pullback']);
  const [row] = desks.evaluateDesk(desk, today).rows;
  assert.equal(row.moments.length, 2);
  assert.ok(row.moments[0].pnl > 0 && row.moments[1].pnl < row.moments[0].pnl);
  assert.equal(row.moments[0].pnl, desks.pnlAt(desk, desk.strategies[0], today, 20, 960, 60));
});

test('each strategy carries the figures its card shows', () => {
  const desk = liteDesk();
  desk.strategies.push(desks.makeStrategy(desk, { kind: 'debit-call-spread', longStrike: 840, shortStrike: 925 }));
  // A credit ratio spread is sized by a reserve for its uncovered calls, so it needs a large budget.
  desk.strategies.push(desks.makeStrategy(desk, { kind: 'call-ratio-spread', longStrike: 840, shortStrike: 900, ratio: 3, budget: 500000 }));
  const [call, spread, ratio] = desks.evaluateDesk(desk, today).rows;
  assert.ok(Math.abs(call.unitCost * call.contracts - call.cost) < 0.01, 'unit cost times contracts is the cost');
  assert.deepEqual([call.maxReturnPct, call.unitCredit, call.lowerBreakEven], [null, null, null], 'a long call is uncapped with one break-even');
  assert.ok(Math.abs(spread.maxReturnPct - (spread.maxProfit / spread.cost) * 100) < 0.01);
  assert.ok(spread.breakEven > 840 && spread.breakEven < 925);
  assert.equal(ratio.problem, null);
  assert.ok(ratio.unitCredit > 0, 'this ratio spread is entered for a credit');
});

test('the price and date map agrees with single points', () => {
  const desk = liteDesk();
  const [call] = desk.strategies;
  const map = desks.priceTimeMap(desk, today, 60);
  assert.equal(map.prices.length, 11);
  assert.equal(map.prices[5], 840, 'today\'s price is the middle row');
  assert.deepEqual([map.days[0], map.days.at(-1)], [0, 60]);
  assert.ok(Math.abs(map.values[call.id][5][0]) < 0.01);
  assert.equal(map.values[call.id][0].at(-1), desks.pnlAt(desk, call, today, 60, map.prices[0], 60));
});

test('changing the stock price rescales strikes and generated names', () => {
  const desk = desks.defaultDesk();
  desk.strategies.push(desks.makeStrategy(desk, { kind: 'debit-call-spread', shortStrike: 115 }));
  desk.strategies.push(desks.makeStrategy(desk, { kind: 'bull-put-spread', name: 'Income idea' }));
  const moved = desks.withMarket(desk, { symbol: 'lite', spot: 840, ivPct: 60 });
  assert.deepEqual(moved.strategies.map((strategy) => [strategy.name, strategy.longStrike, strategy.shortStrike]), [
    ['$840 long call', 840, 840],
    ['$840 / $965 call spread', 840, 965],
    ['Income idea', 715, 800],
  ]);
  assert.ok(desks.evaluateDesk(moved, today).rows.every((row) => row.problem === null));
  assert.deepEqual(desks.withMarket(desk, { ivPct: 35 }).strategies, desk.strategies, 'an IV change leaves strikes alone');
  const kept = desks.withMarket(desk, { spot: 840 }, false);
  assert.deepEqual([kept.market.spot, kept.strategies.map((strategy) => strategy.longStrike)], [840, [100, 100, 85]], 'strikes can be kept when the price changes');
  assert.ok(desks.withMarket(desk, { spot: 2 }).strategies.every((strategy) => desks.strategyProblem(strategy) === null));
});

test('unusable strategies are flagged instead of priced', () => {
  const desk = desks.defaultDesk();
  desk.strategies = [
    desks.makeStrategy(desk, { kind: 'debit-call-spread', longStrike: 100, shortStrike: 90 }),
    { ...desk.strategies[0], id: 'st2', budget: 5 },
    { ...desk.strategies[0], id: 'st3' },
  ];
  const board = desks.evaluateDesk(desk, today);
  assert.match(board.rows[0].problem, /above the bought strike/);
  assert.match(board.rows[1].problem, /too small/);
  assert.equal(board.rows[2].problem, null);
  assert.equal(board.rows[0].now.pnl, 0);
  assert.equal(board.bestNow, null, 'one usable strategy leaves nothing to rank');
});

test('cleanDesk repairs untrusted data and reads the older scenario format', () => {
  const desk = desks.cleanDesk({
    market: { symbol: '<b>', spot: -5, ivPct: 'high' },
    strategies: [{ kind: 'iron-condor' }, { kind: 'long-call', longStrike: 105, id: 'x' }, { kind: 'bear-put', id: 'x' }, null],
    whatIf: { movePct: 9999, days: -4, ivPct: 500 },
    scenarios: [
      { movePct: -12, days: 30, ivPct: 30 },
      { movePct: 20, days: null },
      'bad',
      { steps: [{ days: 20, movePct: 15 }, { days: 45, movePct: 1 }, { days: null, movePct: 3 }] },
    ],
  });
  assert.deepEqual(desk.market, { symbol: 'STOCK', spot: 0.01, ivPct: 50, ratePct: 4 });
  assert.equal(desk.strategies.length, 2);
  assert.notEqual(desk.strategies[0].id, desk.strategies[1].id);
  assert.deepEqual(desk.whatIf, { movePct: 500, days: 0, ivPct: 300 });
  assert.deepEqual(desk.moments.map((moment) => [moment.movePct, moment.days, moment.ivPct]), [[-12, 30, 30], [15, 20, null], [1, 45, null]], 'dated steps become moments');
  assert.throws(() => desks.cleanDesk('nope'));
  const empty = desks.cleanDesk({});
  assert.deepEqual([empty.strategies.length, empty.moments.length, empty.whatIf.days], [0, 0, 30]);
});

test('assistant tools edit a copy of the desk and reject bad input', () => {
  const desk = desks.defaultDesk();
  const run = (name, args, on = desk) => runDeskTool(on, name, args, today);
  const added = run('add_strategy', { kind: 'debit-put-spread', longStrike: 100, shortStrike: 85, budget: 5000 });
  assert.equal(desk.strategies.length, 1, 'the original desk is untouched');
  assert.equal(added.desk.strategies.length, 2);
  assert.match(added.summary, /Added \$100 \/ \$85 put spread/);
  assert.throws(() => run('add_strategy', { kind: 'debit-put-spread', longStrike: 100, shortStrike: 120 }), /below the bought strike/);
  assert.throws(() => run('add_strategy', { kind: 'straddle', longStrike: 100 }), /kind must be/);
  assert.throws(() => run('update_strategy', { id: 'nope' }), /Valid ids: st1/);

  const updated = run('update_strategy', { id: 'st1', longStrike: 110 }).desk.strategies[0];
  assert.deepEqual([updated.longStrike, updated.name], [110, '$110 long call'], 'a generated name follows the strike');

  const shown = run('show_what_if', { price: 120, days: 20 }).desk.whatIf;
  assert.deepEqual(shown, { movePct: 20, days: 20, ivPct: null });
  assert.deepEqual(run('show_what_if', { ivPct: 35 }).desk.whatIf, { movePct: 10, days: 30, ivPct: 35 }, 'unspecified parts stay as they are');

  const saved = run('save_moments', { moments: [{ price: 115, days: 20 }, { name: 'Pullback', price: 101, days: 45, ivPct: 40 }, 7] });
  assert.deepEqual(saved.desk.moments.map((moment) => [moment.name, moment.movePct, moment.days, moment.ivPct]), [['', 15, 20, null], ['Pullback', 1, 45, 40]]);
  assert.equal(saved.summary, 'Saved $115 on day 20, Pullback');
  assert.equal(run('save_moments', { replace: true, moments: [{ movePct: 5, days: 3 }] }, saved.desk).desk.moments.length, 1);
  assert.equal(run('remove_moment', { id: 'm1' }, saved.desk).desk.moments.length, 1);
  assert.throws(() => run('save_moments', { moments: [] }), /non-empty/);

  const check = run('what_if', { price: 130, days: 20 });
  assert.equal(check.desk, desk, 'a read-only tool leaves the desk alone');
  assert.equal(check.output.pnlByStrategy[0].pnl, Math.round(desks.pnlAt(desk, desk.strategies[0], today, 20, 130, 50)));

  const market = run('set_market', { symbol: 'lite', spot: 840, ivPct: 60 }).desk;
  assert.deepEqual([market.market.symbol, market.market.spot, market.market.ivPct, market.strategies[0].longStrike], ['LITE', 840, 60, 840]);
  assert.throws(() => run('place_trade', {}), /Unknown tool/);
  assert.deepEqual(DESK_TOOLS.map((tool) => tool.name), ['add_strategy', 'update_strategy', 'remove_strategy', 'show_what_if', 'save_moments', 'remove_moment', 'what_if', 'set_market']);
});
