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

const elements = new Map();
const document = {
  documentElement: { setAttribute() {}, removeAttribute() {} },
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, makeElement());
    return elements.get(id);
  },
  querySelector() { return null; },
  querySelectorAll() { return []; },
  addEventListener() {},
};

const context = {
  console, document,
  window: { matchMedia: () => ({ matches: false, addEventListener() {} }) },
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  navigator: {},
  setInterval() {},
  setTimeout(fn) { fn(); },
  Date,
};

vm.createContext(context);
vm.runInContext(`${script}
globalThis.__app = {
  getPlanWindows,
  getPlanWindowsForDate,
  getPlanWindowsInHorizon,
  resolvePlanDate,
  findPlanWindow,
  confirmDeskPlanWindow,
  confirmPlanWindow,
  buildCandidatePool,
  planCandidateFitsWindow,
  eventsDB,
  pendingTasksDB,
  interactionLog,
  PLAN_BOARD_HORIZON_DAYS,
};`, context);

const app = context.__app;

// demo pinned to Jun 6, 2026
const today = app.getPlanWindows();
assert.ok(today.length > 0, 'getPlanWindows() still returns today windows');
assert.ok(today.every(w => w.isToday !== false), 'default getPlanWindows is today-only');
assert.ok(today[0].dateISO, 'windows carry dateISO');

// Jun 7 has no events in demo → large desk window
const jun7 = app.getPlanWindowsForDate(2026, 6, 7);
assert.ok(jun7.length > 0, 'Jun 7 should have free desk windows');
assert.strictEqual(jun7[0].day, 7);
assert.strictEqual(jun7[0].isToday, false);
assert.ok(jun7[0].minutes >= 60, 'empty day yields at least 1h free block');

// horizon spans multiple days
const horizon = app.getPlanWindowsInHorizon(3);
const dates = new Set(horizon.map(w => w.dateISO));
assert.ok(dates.size >= 2, '3-day horizon includes at least 2 distinct dates');

// findPlanWindow resolves future-day ids
const futureWin = jun7.find(w => w.type === 'desk');
assert(futureWin, 'Jun 7 has a desk window');
const found = app.findPlanWindow(futureWin.id);
assert(found, 'findPlanWindow finds horizon window by id');
assert.strictEqual(found.day, 7);

// confirm desk plan on future day lands on correct calendar day
app.pendingTasksDB.push({
  id: 'future-plan',
  title: 'Future focus task',
  estTime: '~60m',
  kind: 'solo',
  involves: null,
  deadline: 'Jun 8',
  importance: 2,
  urgency: 2,
});
const candidate = app.buildCandidatePool().find(c => c.id === 'future-plan');
assert(candidate, 'future-plan in pool');
assert(app.planCandidateFitsWindow(candidate, futureWin, futureWin.minutes), 'task fits Jun 7 window');

vm.runInContext(`addCandidateToPlanWindow('${futureWin.id}', 'future-plan');`, context);
app.confirmPlanWindow(futureWin.id);

const ev = (app.eventsDB['2026-6'][7] || []).find(e => e.title === 'Future focus task');
assert(ev, 'event created on Jun 7 not today');
assert.strictEqual(ev.sourceTaskId, 'pendingTask:future-plan');
assert.ok(ev.planMeta, 'future desk plan carries planMeta');
assert.strictEqual(ev.planMeta.plannedDateISO, '2026-06-07');

const deskLog = app.interactionLog.find(row =>
  row.action === 'accepted' && row.candidateId === 'future-plan'
);
assert(deskLog, 'future desk plan logs acceptance');

console.log('plan-windows-date.test.js passed');
