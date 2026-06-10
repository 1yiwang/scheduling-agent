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
  querySelector() { return null; },
  querySelectorAll() { return []; },
  addEventListener() {},
};

const context = {
  console, document,
  window: { matchMedia: () => ({ matches: false, addEventListener() {} }) },
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  navigator: {}, setInterval() {}, setTimeout(fn) { fn(); }, Date,
};

const calls = [];
function thenableQuery(op, table, payload) {
  return {
    then(resolve) {
      calls.push({ op, table, payload });
      if (resolve) resolve({ error: null });
      return Promise.resolve({ error: null });
    },
  };
}
const fakeSb = {
  from(table) {
    return {
      insert(payload) { return thenableQuery('insert', table, payload); },
      upsert(payload) { return thenableQuery('upsert', table, payload); },
    };
  },
};

vm.createContext(Object.assign(context, { fakeSb, calls }));
vm.runInContext(`${script}
globalThis.__app = {
  buildBackfillRows: typeof buildBackfillRows === 'function' ? buildBackfillRows : undefined,
  runBackfill: function (log, prefs, durs) {
    appMode = 'live';
    sb = fakeSb;
    sbUser = { id: 'user-1', email: 'user@example.com' };
    interactionLog = log;
    prefStore = prefs;
    durationStore = durs;
    learningBackfilledAt = '';
    backfillLearningToCloud();
    backfillLearningToCloud(); // second call must be a no-op (idempotent guard)
    return learningBackfilledAt;
  },
  calls,
};`, context);

const app = context.__app;
assert.strictEqual(typeof app.buildBackfillRows, 'function', 'buildBackfillRows should exist');

const interactionLog = [
  { ts: '2026-06-01T10:00:00.000Z', action: 'accepted', kind: 'social', source: 'pendingTask', involves: 'Marie', label: 1, chosenIdx: 0, features: { a: 1 } },
  { ts: '2026-06-02T10:00:00.000Z', action: 'dismissed', kind: 'call', source: 'pendingTask', involves: null, label: 0 },
];
const prefStore = {
  'candidate_kind::social': { dimension: 'candidate_kind', key: 'social', alpha: 3, beta: 1, confidence: 0.75, sampleCount: 3, lastUpdated: '2026-06-02T10:00:00.000Z' },
  'person::Marie': { dimension: 'person', key: 'Marie', alpha: 2, beta: 1, confidence: 0.66, sampleCount: 2, lastUpdated: '2026-06-02T11:00:00.000Z' },
};
const durationStore = {
  'person::Marie': { totalMin: 70, count: 2 },
  'kind::deep': { totalMin: 60, count: 1 },
};

const rows = app.buildBackfillRows(interactionLog, prefStore, durationStore, 'user-1');

assert.strictEqual(rows.interactions.length, 2, 'two interaction rows');
assert.strictEqual(rows.interactions[0].user_id, 'user-1', 'interaction row has user_id');
assert.strictEqual(rows.interactions[0].candidate_id == null, true, 'interaction row maps missing candidateId to null');
assert.strictEqual(rows.interactions[0].action, 'accepted', 'interaction row keeps action');
assert.strictEqual(rows.interactions[0].kind, 'social', 'interaction row keeps kind');
assert.strictEqual(rows.interactions[0].chosen_idx, 0, 'interaction row maps chosenIdx to chosen_idx');
assert.deepStrictEqual(rows.interactions[0].features, { a: 1 }, 'interaction row keeps features');

assert.strictEqual(rows.prefs.length, 2, 'two pref rows');
const socialPref = rows.prefs.find(p => p.dimension === 'candidate_kind' && p.key === 'social');
assert(socialPref, 'pref row for social kind exists');
assert.strictEqual(socialPref.user_id, 'user-1', 'pref row has user_id');
assert.strictEqual(socialPref.alpha, 3, 'pref row keeps alpha');
assert.strictEqual(socialPref.sample_count, 3, 'pref row maps sampleCount to sample_count');

// durationStore has only aggregates; backfill expands into `count` rows at the average.
const marieDur = rows.durations.filter(d => d.person === 'Marie');
assert.strictEqual(marieDur.length, 2, 'Marie has two duration rows (count expanded)');
assert.strictEqual(marieDur[0].observed_minutes, 35, 'Marie duration uses average (70/2)');
assert.strictEqual(marieDur[0].user_id, 'user-1', 'duration row has user_id');
const deepDur = rows.durations.filter(d => d.kind === 'deep');
assert.strictEqual(deepDur.length, 1, 'deep has one duration row');
assert.strictEqual(deepDur[0].observed_minutes, 60, 'deep duration uses average (60/1)');
assert.strictEqual(deepDur[0].person, null, 'kind-only duration has null person');

// Empty input is safe.
const empty = app.buildBackfillRows([], {}, {}, 'user-1');
assert.strictEqual(empty.interactions.length, 0, 'empty interactions');
assert.strictEqual(empty.prefs.length, 0, 'empty prefs');
assert.strictEqual(empty.durations.length, 0, 'empty durations');

// Integration: backfillLearningToCloud writes once and the guard blocks re-runs.
const stamp = app.runBackfill(interactionLog, prefStore, durationStore);
assert(stamp, 'backfill sets learningBackfilledAt timestamp');

const intInserts = app.calls.filter(c => c.op === 'insert' && c.table === 'interaction_log');
const prefUpserts = app.calls.filter(c => c.op === 'upsert' && c.table === 'pref_store');
const durInserts = app.calls.filter(c => c.op === 'insert' && c.table === 'duration_observations');
assert.strictEqual(intInserts.length, 1, 'interaction_log inserted once (batch), not per re-run');
assert.strictEqual(prefUpserts.length, 1, 'pref_store upserted once');
assert.strictEqual(durInserts.length, 1, 'duration_observations inserted once');
assert.strictEqual(intInserts[0].payload.length, 2, 'interaction batch has both rows');
assert.strictEqual(durInserts[0].payload.length, 3, 'duration batch has 3 expanded rows (2 + 1)');

console.log('learning-backfill.test.js passed');
