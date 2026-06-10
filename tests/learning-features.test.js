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
  recordObservedDuration: typeof recordObservedDuration === 'function' ? recordObservedDuration : undefined,
  predictDurationMinutes: typeof predictDurationMinutes === 'function' ? predictDurationMinutes : undefined,
  buildFeatureVector: typeof buildFeatureVector === 'function' ? buildFeatureVector : undefined,
  recordSignal: typeof recordSignal === 'function' ? recordSignal : undefined,
  prefScore: typeof prefScore === 'function' ? prefScore : undefined,
  normalizeInteractionAction: typeof normalizeInteractionAction === 'function' ? normalizeInteractionAction : undefined,
  recordInteraction: typeof recordInteraction === 'function' ? recordInteraction : undefined,
  interactionLog,
  prefStore,
  parseEstMinutes,
};`, context);

const app = context.__app;

assert.strictEqual(typeof app.recordObservedDuration, 'function', 'recordObservedDuration should exist');
assert.strictEqual(typeof app.predictDurationMinutes, 'function', 'predictDurationMinutes should exist');
assert.strictEqual(typeof app.buildFeatureVector, 'function', 'buildFeatureVector should exist');
assert.strictEqual(typeof app.recordSignal, 'function', 'recordSignal should exist');
assert.strictEqual(typeof app.prefScore, 'function', 'prefScore should exist');
assert.strictEqual(typeof app.normalizeInteractionAction, 'function', 'normalizeInteractionAction should exist');
assert.strictEqual(typeof app.recordInteraction, 'function', 'recordInteraction should exist');

// Falls back to the parsed estimate before anything is observed.
const cand = { kind: 'call', involves: 'Lukas', estTime: '~30m' };
assert.strictEqual(app.predictDurationMinutes(cand), 30, 'with no observations, prediction = parsed estimate');

// Person-keyed running average overrides the fixed estimate.
app.recordObservedDuration('busy', 'Lukas', 18);
app.recordObservedDuration('online', 'Lukas', 22);
assert.strictEqual(app.predictDurationMinutes(cand), 20, 'prediction should be the running average (18,22 -> 20)');

// A different person is unaffected.
assert.strictEqual(app.predictDurationMinutes({ kind: 'call', involves: 'Anna', estTime: '~45m' }), 45, 'unrelated person keeps its estimate');

// Stage A feature vector exposes the expected fields.
const fv = app.buildFeatureVector(cand, { route: 'Fribourg → Zurich', mode: 'train', windowMinutes: 55, startHour: 17 });
assert.strictEqual(fv.involves_other, 1, 'feature: involves_other');
assert.strictEqual(fv.person_id, 'Lukas', 'feature: person_id');
assert.strictEqual(fv.est_minutes, 20, 'feature: est_minutes uses the duration predictor');
assert.strictEqual(fv.is_evening, 1, 'feature: is_evening for 17:00');
assert.strictEqual(fv.route_mode, 'train', 'feature: route_mode');
assert.ok(typeof fv.kind_accept_rate === 'number', 'feature: kind_accept_rate is numeric');

// Source preferences must read the same fallback key they write.
const beforeSourceScore = app.prefScore({ kind: 'solo', source: undefined, involves: null });
app.recordSignal('candidate_source', 'pendingTask', true);
const afterSourceScore = app.prefScore({ kind: 'solo', source: undefined, involves: null });
assert(
  afterSourceScore > beforeSourceScore,
  'prefScore should read the same pendingTask fallback key that recordSignal writes'
);

// Normalized interaction rows should have one consistent shape across surfaces.
assert.strictEqual(app.normalizeInteractionAction('conflict_override'), 'conflict_override');
assert.strictEqual(app.normalizeInteractionAction('accepted'), 'accepted');

app.recordInteraction({
  action: 'accepted',
  context: { surface: 'test' },
  candidate: { id: 'x1', kind: 'call', source: 'pendingTask', involves: 'Lukas', estTime: '~30m' },
  label: 1,
});

const row = app.interactionLog[app.interactionLog.length - 1];
assert.ok(row.ts, 'normalized interaction has timestamp');
assert.strictEqual(row.action, 'accepted', 'normalized interaction has action');
assert.strictEqual(row.type, 'accepted', 'normalized interaction keeps type alias for older readers');
assert.deepStrictEqual(row.context, { surface: 'test' }, 'normalized interaction keeps context');
assert.strictEqual(row.candidateId, 'x1', 'normalized interaction has candidateId');
assert.strictEqual(row.kind, 'call', 'normalized interaction has kind');
assert.strictEqual(row.source, 'pendingTask', 'normalized interaction has source');
assert.strictEqual(row.involves, 'Lukas', 'normalized interaction has involves');
assert.strictEqual(row.label, 1, 'normalized interaction has label');
assert.ok(row.features && typeof row.features === 'object', 'normalized interaction has feature vector');

console.log('learning-features.test.js passed');
