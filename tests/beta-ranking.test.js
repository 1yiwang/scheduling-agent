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
  recordSignal,
  scoreCandidate,
  prefScore,
  prefStore,
  slotContextFromStartTime,
};`, context);

const app = context.__app;

const base = {
  importance: 'medium',
  urgency: 'medium',
  estMinutes: 30,
  source: 'pendingTask',
  involves: null,
};

const solo = { ...base, kind: 'solo', id: 'a' };
const call = { ...base, kind: 'call', id: 'b' };

Object.keys(app.prefStore).forEach(k => delete app.prefStore[k]);

const beforeSolo = app.scoreCandidate(solo);
const beforeCall = app.scoreCandidate(call);
assert.strictEqual(beforeSolo, beforeCall, 'equal base scores before learning');

for (let i = 0; i < 4; i++) {
  app.recordSignal('candidate_kind', 'solo', true, { strength: 'strong', nowISO: '2026-06-17T12:00:00.000Z' });
}

const afterSolo = app.scoreCandidate(solo);
const afterCall = app.scoreCandidate(call);
assert.ok(afterSolo > afterCall, 'solo ranks above call after 3 strong accepts');
assert.ok(afterSolo - afterCall >= 12, 'material score delta ≥ 12 points');

// ── B2: hour/dow context ──
Object.keys(app.prefStore).forEach(k => delete app.prefStore[k]);
app.recordSignal('schedule_hour', '14', true, { strength: 'strong', nowISO: '2026-06-17T12:00:00.000Z' });

const ctxAfternoon = { hour: 14, dow: 2 };
const ctxMorning = { hour: 9, dow: 2 };
const afternoonScore = app.prefScore(solo, ctxAfternoon);
const morningScore = app.prefScore(solo, ctxMorning);
assert.ok(afternoonScore > morningScore, 'learned afternoon hour boosts prefScore');

const slotCtx = app.slotContextFromStartTime('14:30', 2);
assert.strictEqual(slotCtx.hour, 14);
assert.strictEqual(slotCtx.dow, 2);

console.log('beta-ranking.test.js passed');
