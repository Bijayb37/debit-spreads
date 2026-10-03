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
const iv = loadTypescript('src/lib/iv-comparison.ts', { '@/lib/debit-call-spread': model });
const base = {
  instrument: 'debit-call-spread', spot: 100, longStrike: 100, shortStrike: 103,
  entryDte: 60, baselineIvPct: 50, comparisonIvPct: 75, ratePct: 4, dividendYieldPct: 0,
};
const isListed = (strike, increment) => Math.abs(strike / increment - Math.round(strike / increment)) < 1e-9;

test('default debit spread suggestions use listed strikes', () => {
  const result = iv.calculateIvEquivalentStrategy(base);
  for (const match of [result.equivalentStrike, result.equivalentDte]) {
    assert.ok(isListed(match.longStrike, 1), `long ${match.longStrike}`);
    assert.ok(isListed(match.shortStrike, 1), `short ${match.shortStrike}`);
    assert.ok(match.shortStrike - match.longStrike >= 1);
    assert.ok(match.longStrike >= base.longStrike);
  }
});

test('suggested strikes follow the listed spacing for the stock price', () => {
  const cases = [
    { ...base, shortStrike: 110 },
    { ...base, instrument: 'long-call' },
    { ...base, entryDte: 30, baselineIvPct: 30, comparisonIvPct: 55, shortStrike: 105 },
    { ...base, spot: 20, longStrike: 20, shortStrike: 22 },
    { ...base, spot: 450, longStrike: 450, shortStrike: 470 },
  ];
  for (const input of cases) {
    const increment = iv.getListedStrikeIncrement(input.spot);
    const result = iv.calculateIvEquivalentStrategy(input);
    for (const match of [result.equivalentStrike, result.equivalentDte]) {
      assert.ok(isListed(match.longStrike, increment), `long ${match.longStrike}`);
      if (input.instrument === 'debit-call-spread') {
        assert.ok(isListed(match.shortStrike, increment), `short ${match.shortStrike}`);
        assert.ok(match.shortStrike - match.longStrike >= increment - 1e-9);
      }
    }
  }
});

test('an unmatched strike search keeps the entered strikes', () => {
  const result = iv.calculateIvEquivalentStrategy({ ...base, longStrike: 100.5, shortStrike: 103.5, comparisonIvPct: 100 });
  assert.equal(result.equivalentStrike.longStrike, 100.5);
  assert.equal(result.equivalentStrike.shortStrike, 103.5);
});
