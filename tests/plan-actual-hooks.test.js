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

const store = {};
const cloudCalls = [];
function thenableQuery(op, table, payload) {
  return {
    then(resolve) {
      cloudCalls.push({ op, table, payload });
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

const document = {
  documentElement: { setAttribute() {}, removeAttribute() {} },
  getElementById() { return makeElement(); },
  querySelector() { return null; }, querySelectorAll() { return []; }, addEventListener() {},
};

const context = {
  console, document,
  window: { matchMedia: () => ({ matches: false, addEventListener() {} }) },
  localStorage: {
    getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem(k, v) { store[k] = String(v); },
    removeItem(k) { delete store[k]; },
  },
  navigator: {}, setInterval() {}, setTimeout(fn) { fn(); }, Date,
  fakeSb, cloudCalls,
};

vm.createContext(context);
vm.runInContext(`${script}
appMode = 'demo';
sb = fakeSb;
sbUser = { id: 'user-1', email: 'user@example.com' };
globalThis.__app = {
  stampPlanMeta,
  touchPlanMetaReschedule,
  moveEventToSlot,
  scheduleTaskToSlot,
  pendingTasksDB,
  eventsDB,
  runtimeEvents,
  completionDB,
  reconcilePlanActual,
  reconcilePastAgentEvents,
  recordPlanActualGap,
  planActualLog,
  interactionLog,
  saveLearningState,
  loadLearningState,
  LEARNING_STORAGE_KEY,
};`, context);

const app = context.__app;

// ── Phase B: stamp + reschedule ──
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

// Rescheduled to future day → not terminal yet
assert.strictEqual(
  app.reconcilePlanActual(ev.id, '2026-06-10T18:00:00.000Z'),
  false,
  'future rescheduled slot is not terminal yet'
);
assert.strictEqual(app.planActualLog.length, 0);

// ── Phase C: reconcile on completion ──
app.completionDB[ev.id] = true;
assert.strictEqual(app.reconcilePlanActual(ev.id, '2026-06-11T18:00:00.000Z'), true);
assert.strictEqual(app.planActualLog.length, 1, 'completion emits one planActualLog row');
assert.strictEqual(app.planActualLog[0].eventId, ev.id);
assert.strictEqual(app.planActualLog[0].gap.type, 'rescheduled');
assert.strictEqual(app.planActualLog[0].label, 0);
assert.strictEqual(ev.planMeta.reconciled, true);

assert.strictEqual(app.reconcilePlanActual(ev.id, '2026-06-11T19:00:00.000Z'), false, 'idempotent reconcile');
assert.strictEqual(app.planActualLog.length, 1, 'still one row after second reconcile');

const planLog = app.interactionLog.find(row => row.action === 'plan_actual' && row.context && row.context.eventId === ev.id);
assert(planLog, 'plan_actual also written to interactionLog');
assert.strictEqual(planLog.label, 0);

// ── Phase C: past scan for unmarked events ──
app.planActualLog.length = 0;
app.interactionLog.length = 0;
cloudCalls.length = 0;

function makePastEvent(id, day) {
  const e = {
    id,
    title: 'Past block ' + id,
    startTime: '10:00',
    endTime: '11:00',
    type: 'deep',
    kind: 'solo',
    sourceTaskId: 'pendingTask:' + id,
  };
  app.stampPlanMeta(e, { surface: 'agent_loop', year: 2026, month: 6, day, plannedMinutes: 60 });
  return e;
}

const pastA = makePastEvent('past-a', 8);
const pastB = makePastEvent('past-b', 9);
app.eventsDB['2026-6'][8] = [pastA];
app.eventsDB['2026-6'][9] = [pastB];
app.runtimeEvents[pastA.id] = pastA;
app.runtimeEvents[pastB.id] = pastB;

assert.strictEqual(app.reconcilePastAgentEvents('2026-06-12T08:00:00.000Z'), 2);
assert.strictEqual(app.planActualLog.length, 2);
assert.ok(app.planActualLog.every(r => r.gap.type === 'not_completed'));

// ── Phase C: persistence roundtrip ──
app.saveLearningState();
const saved = JSON.parse(store[app.LEARNING_STORAGE_KEY]);
assert.ok(Array.isArray(saved.planActualLog));
assert.strictEqual(saved.planActualLog.length, 2);

app.planActualLog.length = 0;
vm.runInContext('loadLearningState(); globalThis.__app.planActualLog = planActualLog;', context);
assert.strictEqual(app.planActualLog.length, 2, 'loadLearningState restores planActualLog');

// ── Phase C: schedule → complete on time ──
app.pendingTasksDB.push({
  id: 'on-time',
  title: 'On-time task',
  estTime: '~60m',
  kind: 'solo',
  involves: null,
  deadline: 'Jun 12',
  importance: 3,
  urgency: 3,
});
const beforeLogs = app.planActualLog.length;
app.scheduleTaskToSlot('pendingTask', 'on-time', 2026, 6, 12, 9 * 60, 60);
const onTimeEv = (app.eventsDB['2026-6'][12] || []).find(e => e.sourceTaskId === 'pendingTask:on-time');
assert(onTimeEv && onTimeEv.planMeta, 'scheduled event carries planMeta');
app.completionDB[onTimeEv.id] = true;
assert.strictEqual(app.reconcilePlanActual(onTimeEv.id, '2026-06-12T12:00:00.000Z'), true);
assert.strictEqual(app.planActualLog.length, beforeLogs + 1);
assert.strictEqual(app.planActualLog[app.planActualLog.length - 1].gap.type, 'completed_on_time');
assert.strictEqual(app.planActualLog[app.planActualLog.length - 1].label, 1);

// ── Phase C: cloud dual-write (live mode) ──
vm.runInContext("appMode = 'live';", context);
app.recordPlanActualGap({
  eventId: 'cloud-gap-1',
  ts: '2026-06-12T10:00:00.000Z',
  planned: { dateISO: '2026-06-12', plannedMinutes: 60, surface: 'agent_loop' },
  actual: { completed: true },
  gap: { type: 'completed_on_time', severity: 'low' },
  features: { label: 1, gapType: 'completed_on_time' },
  label: 1,
});
const cloudPlan2 = cloudCalls.find(c => c.table === 'interaction_log' && c.payload && c.payload.action === 'plan_actual' && c.payload.candidate_id == null);
assert(cloudPlan2, 'plan_actual dual-writes under live cloud mode');
vm.runInContext("appMode = 'demo';", context);

console.log('plan-actual-hooks.test.js passed');
