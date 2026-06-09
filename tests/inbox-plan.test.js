const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];

function makeElement() {
  return {
    innerHTML: '',
    textContent: '',
    style: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {},
    scrollIntoView() {},
    querySelector() { return null; },
    closest() { return null; },
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
  console,
  document,
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
  pendingTasksDB,
  eventsDB,
  buildCandidatePool,
  getPlanWindows,
  planCandidateFitsWindow,
  confirmInboxPlanToWindow: typeof confirmInboxPlanToWindow === 'function' ? confirmInboxPlanToWindow : undefined,
};`, context);

const app = context.__app;
const beforeCount = app.pendingTasksDB.length;
const candidate = app.buildCandidatePool().find(c => c.id === 'p4');
assert(candidate, 'expected Inbox task p4 to be present in candidate pool');

const window = app.getPlanWindows().find(w => app.planCandidateFitsWindow(candidate, w, w.minutes));
assert(window, 'expected at least one available planning window for p4');

assert.strictEqual(
  typeof app.confirmInboxPlanToWindow,
  'function',
  'confirmInboxPlanToWindow should exist for Inbox -> calendar scheduling'
);

vm.runInContext('calView = "tasks";', context);
app.confirmInboxPlanToWindow('pendingTask', 'p4', window.id);

assert.strictEqual(
  vm.runInContext('calView', context),
  'tasks',
  'planning from Inbox should stay on the Tasks view, not navigate away'
);

assert.strictEqual(app.pendingTasksDB.length, beforeCount - 1, 'scheduled task should leave Inbox task source');
assert(!app.buildCandidatePool().some(c => c.id === 'p4'), 'scheduled task should leave agent candidate pool');

const scheduled = app.eventsDB['2026-6'][6].some(event => event.title === 'Reply to Anna');
const commuteScheduled = Object.values(app.eventsDB['2026-6']).flat().some(event =>
  event.commuteTasks && event.commuteTasks.some(task => task.title === 'Reply to Anna')
);
assert(scheduled || commuteScheduled, 'scheduled task should appear on calendar or inside a commute window');

console.log('inbox-plan.test.js passed');
