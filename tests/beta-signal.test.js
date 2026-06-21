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
  SIGNAL_STRENGTH,
  signalDelta,
  decayBetaCounts,
  betaConfidence,
  recordSignal,
  applyPlanActualLearning,
  prefStore,
  getPreference,
  prefKey,
};`, context);

const app = context.__app;

// ── A2: signalDelta ──
const weakAccept = app.signalDelta(true, 'weak');
assert.strictEqual(weakAccept.alpha, 0.25);
assert.strictEqual(weakAccept.beta, 0);
const weakReject = app.signalDelta(false, 'weak');
assert.strictEqual(weakReject.alpha, 0);
assert.strictEqual(weakReject.beta, 0.25);
const mediumAccept = app.signalDelta(true, 'medium');
assert.strictEqual(mediumAccept.alpha, 0.5);
const strongAccept = app.signalDelta(true, 'strong');
assert.strictEqual(strongAccept.alpha, 1);
const defaultReject = app.signalDelta(false, undefined);
assert.strictEqual(defaultReject.beta, 1);

// ── A3: decayBetaCounts ──
const fresh = app.decayBetaCounts({ alpha: 11, beta: 1, lastUpdated: '2026-06-17T12:00:00.000Z' }, '2026-06-17T12:00:00.000Z');
assert.strictEqual(fresh.alpha, 11, 'no decay when now equals lastUpdated');
assert.strictEqual(fresh.beta, 1);

const aged = app.decayBetaCounts({ alpha: 11, beta: 1, lastUpdated: '2026-05-03T12:00:00.000Z' }, '2026-06-17T12:00:00.000Z');
assert.ok(aged.alpha > 1 && aged.alpha < 11, '45d ago alpha decays toward prior');
assert.ok(Math.abs(aged.alpha - 6) < 1.5, '45d halflife ≈ halfway between 1 and 11');

// ── A4: betaConfidence with decay ──
const oldConf = app.betaConfidence({ alpha: 11, beta: 1, lastUpdated: '2026-01-01T00:00:00.000Z' }, '2026-06-17T00:00:00.000Z');
const rawConf = app.betaConfidence({ alpha: 11, beta: 1, lastUpdated: '2026-06-17T00:00:00.000Z' }, '2026-06-17T00:00:00.000Z');
assert.ok(oldConf < rawConf, 'decay lowers confidence of stale strong accepts');

// ── A5: recordSignal fractional ──
Object.keys(app.prefStore).forEach(k => delete app.prefStore[k]);
const weakPref = app.recordSignal('candidate_kind', 'solo', true, { strength: 'weak', nowISO: '2026-06-17T12:00:00.000Z' });
assert.strictEqual(weakPref.alpha, 1.25);
assert.strictEqual(weakPref.sampleCount, 0.25);

// ── A6: applyPlanActualLearning ──
Object.keys(app.prefStore).forEach(k => delete app.prefStore[k]);

const onTimeRow = {
  eventId: 'e1',
  gap: { type: 'completed_on_time' },
  features: { kind: 'solo', hourOfDay: 13, dayOfWeek: 2 },
};
const onTimeResult = app.applyPlanActualLearning(onTimeRow, { nowISO: '2026-06-17T12:00:00.000Z' });
assert.strictEqual(onTimeResult.applied, true);
assert.ok(onTimeResult.dimensions.includes('candidate_kind'));
assert.ok(onTimeResult.dimensions.includes('schedule_hour'));
const kindPref = app.getPreference('candidate_kind', 'solo');
assert.strictEqual(kindPref.alpha, 2, 'strong accept adds +1 on top of prior 1');
const hourPref = app.getPreference('schedule_hour', '13');
assert.strictEqual(hourPref.alpha, 2);

const missing = app.applyPlanActualLearning({
  eventId: 'e2',
  gap: { type: 'completed_on_time' },
  features: { kind: 'solo' },
});
assert.strictEqual(missing.applied, false, 'missing hour/dow → no-op');

Object.keys(app.prefStore).forEach(k => delete app.prefStore[k]);
const notDone = app.applyPlanActualLearning({
  eventId: 'e3',
  gap: { type: 'not_completed' },
  features: { kind: 'call', hourOfDay: 9, dayOfWeek: 1 },
}, { nowISO: '2026-06-17T12:00:00.000Z' });
assert.strictEqual(notDone.applied, true);
assert.strictEqual(app.getPreference('candidate_kind', 'call').beta, 2);

Object.keys(app.prefStore).forEach(k => delete app.prefStore[k]);
const late = app.applyPlanActualLearning({
  eventId: 'e4',
  gap: { type: 'completed_late' },
  features: { kind: 'solo', hourOfDay: 15, dayOfWeek: 4 },
}, { nowISO: '2026-06-17T12:00:00.000Z' });
assert.strictEqual(late.applied, true);
assert.strictEqual(app.getPreference('schedule_hour', '15').beta, 1.5, 'medium reject = +0.5 beta');
assert.strictEqual(app.getPreference('candidate_kind', 'solo').alpha, 1, 'completed_late skips kind');

Object.keys(app.prefStore).forEach(k => delete app.prefStore[k]);
const drift = app.applyPlanActualLearning({
  eventId: 'e5',
  gap: { type: 'duration_drift' },
  features: { kind: 'solo', hourOfDay: 10, dayOfWeek: 3 },
}, { nowISO: '2026-06-17T12:00:00.000Z' });
assert.strictEqual(drift.applied, true);
assert.strictEqual(app.getPreference('candidate_kind', 'solo').beta, 1.25, 'weak reject on kind only');

const idempotent = app.applyPlanActualLearning({ ...onTimeRow, learningApplied: true });
assert.strictEqual(idempotent.applied, false);

console.log('beta-signal.test.js passed');
