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
  parseEstMinutes,
};`, context);

const app = context.__app;

assert.strictEqual(typeof app.recordObservedDuration, 'function', 'recordObservedDuration should exist');
assert.strictEqual(typeof app.predictDurationMinutes, 'function', 'predictDurationMinutes should exist');
assert.strictEqual(typeof app.buildFeatureVector, 'function', 'buildFeatureVector should exist');

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

console.log('learning-features.test.js passed');
