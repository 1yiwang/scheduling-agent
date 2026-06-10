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
  interactionLog,
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

const deskLog = app.interactionLog.find(row =>
  row.action === 'accepted' &&
  row.context &&
  row.context.surface === 'desk_plan' &&
  row.candidateId === 'p4'
);
assert(deskLog, 'desk plan acceptance should write a normalized interaction row');
assert.strictEqual(deskLog.source, 'pendingTask', 'desk plan log keeps source');
assert.strictEqual(deskLog.label, 1, 'desk plan acceptance has positive label');
assert.ok(deskLog.features && typeof deskLog.features === 'object', 'desk plan log includes features');

assert.strictEqual(
  vm.runInContext('calView', context),
  'tasks',
  'planning from Inbox should stay on the Tasks view, not navigate away'
);

assert.strictEqual(app.pendingTasksDB.length, beforeCount - 1, 'scheduled task should leave Inbox task source');
assert(!app.buildCandidatePool().some(c => c.id === 'p4'), 'scheduled task should leave agent candidate pool');

const scheduledEvent = (app.eventsDB['2026-6'][6] || []).find(event => event.title === 'Reply to Anna');
const commuteEvent = Object.values(app.eventsDB['2026-6']).flat().find(event =>
  event.commuteTasks && event.commuteTasks.some(task => task.title === 'Reply to Anna')
);
assert(scheduledEvent || commuteEvent, 'scheduled task should appear on calendar or inside a commute window');

if (scheduledEvent) {
  assert.strictEqual(scheduledEvent.sourceTaskId, 'pendingTask:p4', 'desk-planned event keeps sourceTaskId');
  assert.strictEqual(scheduledEvent.kind, candidate.kind, 'desk-planned event keeps original kind');
  assert.strictEqual(scheduledEvent.type, 'deep', 'solo task is typed as deep for analytics');
}

app.pendingTasksDB.push({
  id: 'social-test',
  title: 'Coffee follow-up',
  estTime: '~30m',
  kind: 'social',
  involves: 'Marie',
  deadline: 'Jun 6',
  importance: 2,
  urgency: 2,
});

const socialCandidate = app.buildCandidatePool().find(c => c.id === 'social-test');
const socialWindow = app.getPlanWindows().find(w =>
  w.type === 'desk' && app.planCandidateFitsWindow(socialCandidate, w, w.minutes)
);
assert(socialWindow, 'expected an available desk window for social-test');
app.confirmInboxPlanToWindow('pendingTask', 'social-test', socialWindow.id);

const socialEvent = (app.eventsDB['2026-6'][6] || []).find(event => event.title === 'Coffee follow-up');
assert(socialEvent, 'social desk-planned task should create a calendar event');
assert.strictEqual(socialEvent.sourceTaskId, 'pendingTask:social-test', 'social event keeps sourceTaskId');
assert.strictEqual(socialEvent.kind, 'social', 'social event keeps original kind');
assert.strictEqual(socialEvent.type, 'social', 'social kind maps to social event type');

console.log('inbox-plan.test.js passed');
