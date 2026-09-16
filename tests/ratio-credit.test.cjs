const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadTypescript(relativePath, dependencies = {}) {
  const filename = path.resolve(__dirname, '..', relativePath);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const loadedModule = { exports: {} };
  vm.runInNewContext(compiled.outputText, {
    exports: loadedModule.exports,
    module: loadedModule,
    require: (name) => {
      assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  }, { filename });
  return loadedModule.exports;
}

const model = loadTypescript('src/lib/debit-call-spread.ts');
const grid = loadTypescript('src/lib/options/debitSpreadScenarios.ts', {
  '@/lib/debit-call-spread': model,
});
const base = {
  strategy: 'call-ratio-spread', todayIso: '2026-09-16', expiryIso: '2026-11-15',
  spot: 100, longStrike: 100, shortStrike: 105, ratioShortCount: 3,
  volatilityPct: 50, futureVolatilityPct: 50, ratePct: 4, dividendYieldPct: 0,
  capital: 100000, allowFractionalContracts: false, scenarioPrice: 100, scenarioOffsetDays: 0,
};
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);
const expiryPayoff = (inputs, price) => inputs.strategy === 'call-ratio-spread'
  ? Math.max(price - inputs.longStrike, 0) - inputs.ratioShortCount * Math.max(price - inputs.shortStrike, 0)
  : Math.max(inputs.longStrike - price, 0) - inputs.ratioShortCount * Math.max(inputs.shortStrike - price, 0);
const gridInputs = (inputs, snapshot) => ({
  strategy: inputs.strategy, currentPrice: inputs.spot, currentDte: snapshot.expirationDays,
  longStrike: inputs.longStrike, shortStrike: inputs.shortStrike, ratioShortCount: inputs.ratioShortCount,
  entryDebit: snapshot.entryPremium, numberOfSpreads: snapshot.contracts,
  impliedVolatilityPct: inputs.futureVolatilityPct, riskFreeRatePct: inputs.ratePct,
  dividendYieldPct: inputs.dividendYieldPct,
});

for (const strategy of ['call-ratio-spread', 'put-ratio-spread']) {
  const inputs = { ...base, strategy, shortStrike: strategy === 'call-ratio-spread' ? 105 : 95 };
  test(`${strategy}: credit entry has usable sizing and zero initial P/L`, () => {
    const s = model.createScenarioSnapshot(inputs);
    assert.ok(s.entryPremium < 0);
    assert.ok(s.contracts > 0);
    assert.ok(s.totalCost > 0 && s.totalCost <= inputs.capital);
    near(s.pnl, 0);
    near(s.roi, 0);
    assert.equal(s.lowerBreakEvenAtExpiry, null);
    const fractional = model.createScenarioSnapshot({ ...inputs, allowFractionalContracts: true });
    near(fractional.totalCost, inputs.capital);
    near(fractional.pnl, 0);
  });

  test(`${strategy}: expiry profit, loss, break-even and grid agree with option payoffs`, () => {
    const entry = model.createScenarioSnapshot(inputs);
    const prices = [0, 50, inputs.longStrike, inputs.shortStrike, entry.breakEvenAtExpiry, 150, 500];
    for (const scenarioPrice of prices) {
      const s = model.createScenarioSnapshot({ ...inputs, scenarioPrice, scenarioOffsetDays: 60 });
      const expected = (expiryPayoff(inputs, scenarioPrice) - entry.entryPremium) * 100 * entry.contracts;
      near(s.pnl, expected);
      const point = grid.calculateDebitSpreadScenario(gridInputs(inputs, entry), scenarioPrice, 0);
      near(point.profitLoss, expected);
      near(point.profitLossPercent, s.roi * 100);
    }
    near(model.createScenarioSnapshot({ ...inputs, scenarioPrice: entry.breakEvenAtExpiry, scenarioOffsetDays: 60 }).pnl, 0);
    const peak = model.createScenarioSnapshot({ ...inputs, scenarioPrice: inputs.shortStrike, scenarioOffsetDays: 60 });
    near(peak.pnl, entry.maxProfitPerUnit * 100 * entry.contracts);
    if (strategy === 'call-ratio-spread') assert.equal(entry.maxLossPerUnit, null);
    else near(model.createScenarioSnapshot({ ...inputs, scenarioPrice: 0, scenarioOffsetDays: 60 }).pnl, -entry.maxLossPerUnit * 100 * entry.contracts);
    const summary = grid.buildDebitSpreadScenarioGrid(gridInputs(inputs, entry)).summary;
    near(summary.expiryBreakeven, entry.breakEvenAtExpiry);
    assert.equal(summary.lowerExpiryBreakeven, null);
    near(summary.maxProfit, entry.maxProfitPerUnit * 100 * entry.contracts);
  });

  test(`${strategy}: timeline, ladder and curves keep the same reserve throughout the trade`, () => {
    const selected = { ...inputs, scenarioPrice: 115, scenarioOffsetDays: 30 };
    const s = model.createScenarioSnapshot(selected);
    for (const row of model.buildTimelineRows(selected)) {
      near(row.pnl, model.createScenarioSnapshot({ ...selected, scenarioOffsetDays: row.daysElapsed }).pnl);
    }
    for (const row of model.buildPriceLadderRows(selected)) {
      near(row.pnl, model.createScenarioSnapshot({ ...selected, scenarioPrice: row.price }).pnl);
    }
    for (const point of model.buildPriceCurve(selected)) {
      near(point.selectedDateValue - s.totalCost, model.createScenarioSnapshot({ ...selected, scenarioPrice: point.price }).pnl);
      near(point.expiryValue - s.totalCost, (expiryPayoff(inputs, point.price) - s.entryPremium) * 100 * s.contracts);
    }
    const point = grid.calculateDebitSpreadScenario(gridInputs(inputs, s), selected.scenarioPrice, 30);
    near(point.profitLoss, s.pnl);
  });
}

test('zero premium ratio entries remain finite and saveable', () => {
  const s = model.createScenarioSnapshot({ ...base, spot: 50, scenarioPrice: 50, volatilityPct: 0, futureVolatilityPct: 0, ratePct: 0 });
  near(s.entryPremium, 0);
  assert.ok(s.unitCost > 0 && s.contracts > 0);
  near(s.pnl, 0);
  assert.equal(s.lowerBreakEvenAtExpiry, null);
});

test('debit ratio sizing is unchanged', () => {
  const s = model.createScenarioSnapshot({ ...base, shortStrike: 150 });
  assert.ok(s.entryPremium > 0);
  assert.equal(s.reserveOffset, 0);
  near(s.unitCost, s.entryPremium);
  assert.equal(s.contracts, Math.floor(base.capital / (s.entryPremium * 100)));
  near(s.pnl, 0);
});

test('call ratio losses can exceed the sizing reserve', () => {
  const s = model.createScenarioSnapshot({ ...base, scenarioPrice: 1000, scenarioOffsetDays: 60 });
  assert.ok(s.pnl < -s.totalCost);
  assert.ok(s.roi < -1);
});
