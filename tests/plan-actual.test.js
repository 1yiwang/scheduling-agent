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
  buildPlannedSnapshot,
  classifyPlanActualGap,
  deriveGapSeverity,
  buildPlanActualFeatures,
  planActualLog,
};`, context);

const app = context.__app;

assert.strictEqual(typeof app.buildPlannedSnapshot, 'function');
assert.strictEqual(typeof app.classifyPlanActualGap, 'function');
assert.strictEqual(typeof app.deriveGapSeverity, 'function');
assert.strictEqual(typeof app.buildPlanActualFeatures, 'function');
assert.ok(Array.isArray(app.planActualLog));

const sampleEvent = {
  id: 'plan-p1',
  title: 'SLTA newsletter',
  startTime: '13:00',
  endTime: '15:00',
  type: 'deep',
  kind: 'solo',
  sourceTaskId: 'pendingTask:p1',
};

const planned = app.buildPlannedSnapshot(sampleEvent, {
  surface: 'agent_loop',
  year: 2026,
  month: 6,
  day: 10,
  sourceTaskId: 'pendingTask:p1',
});

assert.strictEqual(planned.dateISO, '2026-06-10');
assert.strictEqual(planned.startTime, '13:00');
assert.strictEqual(planned.plannedMinutes, 120);
assert.strictEqual(planned.surface, 'agent_loop');
assert.strictEqual(planned.kind, 'solo');
assert.strictEqual(planned.type, 'deep');

// A3 · classifier cases (fixed nowISO)
const plannedBase = {
  dateISO: '2026-06-10',
  startTime: '13:00',
  endTime: '15:00',
  plannedMinutes: 120,
  kind: 'solo',
  type: 'deep',
  title: 'SLTA newsletter',
  surface: 'agent_loop',
};

function assertGap(gap, type, terminal, msg) {
  assert.strictEqual(gap.type, type, msg + ' · type');
  assert.strictEqual(gap.terminal, terminal, msg + ' · terminal');
}

assertGap(
  app.classifyPlanActualGap(plannedBase, {
    completed: true,
    completedDateISO: '2026-06-10',
    actualMinutes: 118,
    nowISO: '2026-06-10T16:00:00.000Z',
  }),
  'completed_on_time',
  true,
  'done same day, on time'
);

assertGap(
  app.classifyPlanActualGap(plannedBase, {
    completed: true,
    completedDateISO: '2026-06-11',
    actualMinutes: 120,
    nowISO: '2026-06-11T10:00:00.000Z',
  }),
  'completed_late',
  true,
  'done next day'
);

assertGap(
  app.classifyPlanActualGap(plannedBase, {
    completed: false,
    nowISO: '2026-06-10T18:00:00.000Z',
  }),
  'not_completed',
  true,
  'explicit not done'
);

assertGap(
  app.classifyPlanActualGap(plannedBase, {
    completed: null,
    nowISO: '2026-06-11T08:00:00.000Z',
  }),
  'not_completed',
  true,
  'day passed, never marked'
);

assertGap(
  app.classifyPlanActualGap(plannedBase, {
    wasRescheduled: true,
    finalDateISO: '2026-06-11',
    finalStartTime: '09:00',
    completed: true,
    completedDateISO: '2026-06-11',
    nowISO: '2026-06-11T12:00:00.000Z',
  }),
  'rescheduled',
  true,
  'cross-day reschedule wins over completion'
);

assertGap(
  app.classifyPlanActualGap(plannedBase, {
    completed: true,
    completedDateISO: '2026-06-10',
    actualMinutes: 240,
    nowISO: '2026-06-10T18:00:00.000Z',
  }),
  'duration_drift',
  true,
  'done but 2× planned duration'
);

assertGap(
  app.classifyPlanActualGap({
    dateISO: '2099-06-10',
    startTime: '13:00',
    endTime: '15:00',
    plannedMinutes: 120,
  }, {
    completed: null,
    nowISO: '2026-06-10T12:00:00.000Z',
  }),
  null,
  false,
  'future block not terminal yet'
);

// A4 · severity
assert.strictEqual(app.deriveGapSeverity('not_completed', { type: 'deep', kind: 'solo' }), 'high');
assert.strictEqual(app.deriveGapSeverity('not_completed', { type: 'busy' }), 'medium');
assert.strictEqual(app.deriveGapSeverity('rescheduled', sampleEvent), 'medium');
assert.strictEqual(app.deriveGapSeverity('completed_late', sampleEvent), 'medium');
assert.strictEqual(app.deriveGapSeverity('completed_on_time', sampleEvent), 'low');
assert.strictEqual(app.deriveGapSeverity('duration_drift', sampleEvent), 'low');

// A5 · features
const gapOnTime = { type: 'completed_on_time', terminal: true };
const featuresOk = app.buildPlanActualFeatures(plannedBase, { actualMinutes: 118 }, gapOnTime);
assert.strictEqual(featuresOk.label, 1);
assert.strictEqual(featuresOk.plannedMinutes, 120);
assert.strictEqual(featuresOk.actualMinutes, 118);
assert.strictEqual(featuresOk.deltaMinutes, -2);
assert.strictEqual(featuresOk.gapType, 'completed_on_time');
assert.strictEqual(featuresOk.hourOfDay, 13);
assert.strictEqual(typeof featuresOk.dayOfWeek, 'number');

const gapMiss = app.buildPlanActualFeatures(plannedBase, { actualMinutes: null }, { type: 'not_completed', terminal: true });
assert.strictEqual(gapMiss.label, 0);

console.log('plan-actual.test.js passed');
