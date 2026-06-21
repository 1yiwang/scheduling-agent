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
  stampPlanMeta,
  touchPlanMetaReschedule,
  moveEventToSlot,
  eventsDB,
  runtimeEvents,
};`, context);

const app = context.__app;

const ev = {
  id: 'evt-plan-meta',
  title: 'Deep work block',
  startTime: '13:00',
  endTime: '15:00',
  type: 'deep',
  kind: 'solo',
  sourceTaskId: 'pendingTask:p9',
};

app.stampPlanMeta(ev, { surface: 'agent_loop', year: 2026, month: 6, day: 10, plannedMinutes: 120 });
assert.ok(ev.planMeta, 'stampPlanMeta sets planMeta');
assert.strictEqual(ev.planMeta.surface, 'agent_loop');
assert.strictEqual(ev.planMeta.plannedDateISO, '2026-06-10');
assert.strictEqual(ev.planMeta.plannedMinutes, 120);
assert.strictEqual(ev.planMeta.reconciled, false);
assert.strictEqual(ev.planMeta.wasRescheduled, false);

const firstAt = ev.planMeta.plannedAt;
app.stampPlanMeta(ev, { surface: 'desk_plan', year: 2026, month: 6, day: 11 });
assert.strictEqual(ev.planMeta.surface, 'agent_loop', 'second stamp is ignored');
assert.strictEqual(ev.planMeta.plannedAt, firstAt, 'plannedAt unchanged on idempotent stamp');

app.eventsDB['2026-6'] = { 10: [ev] };
app.runtimeEvents[ev.id] = ev;
app.moveEventToSlot(ev.id, 2026, 6, 11, 9 * 60, 120);

assert.strictEqual(ev.planMeta.wasRescheduled, true);
assert.strictEqual(ev.planMeta.rescheduleCount, 1);
assert.strictEqual(ev.planMeta.finalDateISO, '2026-06-11');
assert.strictEqual(ev.planMeta.finalStartTime, '09:00');
assert.strictEqual(ev.startTime, '09:00');

const moved = (app.eventsDB['2026-6'][11] || []).find(e => e.id === ev.id);
assert(moved, 'event moved to new day in eventsDB');

console.log('plan-actual-hooks.test.js passed');
