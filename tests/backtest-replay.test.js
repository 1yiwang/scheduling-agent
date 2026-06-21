const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];

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
  normalizeBacktestRow,
  sortBacktestRows,
  getPrefInStore,
  applySignalToPrefStore,
  applyInteractionRowToStore,
  applyPlanActualRowToStore,
  replayPrefStore,
  prefKey,
};`, context);

const app = context.__app;

// normalizeBacktestRow
const supaRow = { ts: '2026-06-01T10:00:00Z', action: 'accepted', chosen_idx: 2, kind: 'solo' };
const norm = app.normalizeBacktestRow(supaRow);
assert.strictEqual(norm.chosenIdx, 2);
assert.strictEqual(norm.action, 'accepted');

// sortBacktestRows
const sorted = app.sortBacktestRows([
  { ts: '2026-06-03T10:00:00Z', action: 'dismissed' },
  { ts: '2026-06-01T10:00:00Z', action: 'accepted' },
]);
assert.strictEqual(sorted[0].ts, '2026-06-01T10:00:00Z');

// replayPrefStore
const store = {};
app.applyInteractionRowToStore(store, { ts: '2026-06-01T10:00:00Z', action: 'accepted', kind: 'solo', source: 'pendingTask' });
const soloKey = app.prefKey('candidate_kind', 'solo');
assert.ok(store[soloKey].alpha > 1, 'accepted row bumps solo alpha');

app.applyInteractionRowToStore(store, { ts: '2026-06-02T10:00:00Z', action: 'implicit_dismiss', context: {} });
const alphaBeforeDismiss = store[soloKey].alpha;
app.applyInteractionRowToStore(store, { ts: '2026-06-03T10:00:00Z', action: 'implicit_dismiss', context: {} });
assert.strictEqual(store[soloKey].alpha, alphaBeforeDismiss, 'implicit_dismiss does not change prefs');

const replayed = app.replayPrefStore([
  { ts: '2026-06-01T10:00:00Z', action: 'accepted', kind: 'call', source: 'pendingTask' },
  { ts: '2026-06-02T10:00:00Z', action: 'plan_actual', context: {
    gap: { type: 'completed_on_time' },
    features: { kind: 'solo', hourOfDay: 13, dayOfWeek: 2, label: 1 },
  }},
], { untilIndex: 2 });
assert.ok(replayed[app.prefKey('candidate_kind', 'solo')].alpha >= 2, 'plan_actual strong accept on solo');
assert.ok(replayed[app.prefKey('schedule_hour', '13')], 'plan_actual creates schedule_hour pref');

console.log('backtest-replay.test.js passed');
