const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'backtest-sample.json'), 'utf8'));

function makeElement() {
  return {
    innerHTML: '', textContent: '', dataset: {}, style: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {}, scrollIntoView() {},
    querySelector() { return null; }, querySelectorAll() { return []; }, closest() { return null; },
  };
}

const document = {
  documentElement: { setAttribute() {}, removeAttribute() {} },
  getElementById() { return makeElement(); },
  querySelector() { return null; }, querySelectorAll() { return []; }, addEventListener() {},
};

const context = {
  console, document,
  window: { matchMedia: () => ({ matches: false, addEventListener() {} }) },
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  navigator: {}, setInterval() {}, setTimeout(fn) { fn(); }, Date,
};

vm.createContext(context);
vm.runInContext(`${script}
globalThis.__app = {
  runOfflineBacktest,
  aggregateAcceptMetrics,
  aggregatePlanActualMetrics,
  evaluateRankingTop1,
  scoreCandidateFromStore,
  replayPrefStore,
  pickTopCandidateIndex,
  sortBacktestRows,
  normalizeBacktestRow,
};`, context);

const app = context.__app;

// accept metrics
const accept = app.aggregateAcceptMetrics(fixture);
assert.strictEqual(accept.decided, 3, 'accepted + sent + dismissed');
assert.strictEqual(accept.accepted, 2, 'accepted + sent');
assert.strictEqual(accept.implicitDismissCount, 1);
assert.strictEqual(accept.acceptRate, 67);

// plan actual metrics
const plan = app.aggregatePlanActualMetrics(fixture.map(app.normalizeBacktestRow));
assert.strictEqual(plan.total, 3);
assert.strictEqual(plan.completedOnTime, 2);
assert.strictEqual(plan.gapBreakdown.not_completed, 1);

// ranking: enhanced beats baseline on fixture
const report = app.runOfflineBacktest(fixture);
assert.strictEqual(report.rowCount, 7);
assert.strictEqual(report.rankingMetrics.baseline.decisions, 1);
assert.strictEqual(report.rankingMetrics.enhanced.top1Hits, 1, 'enhanced picks user-chosen solo');
assert.strictEqual(report.rankingMetrics.baseline.top1Hits, 0, 'baseline picks high-importance call');
assert.ok(report.rankingMetrics.lift > 0, 'positive lift from learning');
assert.ok(report.replayedPrefCount >= 3, 'replay builds multiple pref keys');

// deterministic replay
const report2 = app.runOfflineBacktest(fixture);
assert.strictEqual(report2.rankingMetrics.enhanced.top1Rate, report.rankingMetrics.enhanced.top1Rate);

console.log('backtest-metrics.test.js passed');
