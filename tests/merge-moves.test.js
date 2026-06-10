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
pendingTasksDB.length = 0;
owedRepliesDB.length = 0;
pendingMeetingsDB.length = 0;
Object.keys(eventsDB).forEach(k => delete eventsDB[k]);
Object.keys(completionDB).forEach(k => delete completionDB[k]);
globalThis.__app = { mergeMoves };`, context);

const app = context.__app;

assert.strictEqual(typeof app.mergeMoves, 'function', 'mergeMoves should be exported');

// Two moves on the SAME event (overdue follow-up = high, cleanup = normal) plus
// one unrelated move. After merge: one card for the shared event, one for the other.
const followUp = {
  id: 'move-follow-up-evt1', type: 'follow_up_due', severity: 'high', daysUntil: -2,
  title: 'Send notes', dueShort: '2d overdue', subject: { eventId: 'evt1' }, mins: 10,
  dueISO: '2026-06-05',
  proposedActions: [{ label: 'Done', fn: 'markFollowUpDone', payload: { eventId: 'evt1' } }],
};
const cleanup = {
  id: 'move-cleanup-evt1', type: 'cleanup_unmarked', severity: 'normal', daysUntil: 0,
  title: 'Mark Sync', dueShort: 'unmarked', subject: { eventId: 'evt1' }, mins: 0,
  dueISO: '2026-06-05',
  proposedActions: [
    { label: 'Done', fn: 'markComplete', payload: { eventId: 'evt1', status: true } },
    { label: 'Not done', fn: 'markComplete', payload: { eventId: 'evt1', status: false } },
  ],
};
const deadline = {
  id: 'move-deadline-task-9', type: 'deadline_risk', severity: 'critical', daysUntil: 1,
  title: 'Ship report', dueShort: 'due 1d', subject: { source: 'task', id: '9' }, mins: 60,
  dueISO: '2026-06-11',
  proposedActions: [{ label: 'Tomorrow 9', fn: 'scheduleTaskToSlot', payload: {} }],
};

const merged = app.mergeMoves([followUp, cleanup, deadline]);

// evt1 collapses to a single card; deadline (no eventId) passes through untouched.
assert.strictEqual(merged.length, 2, 'two source moves on the same event should merge to one');

const evt1 = merged.find(m => m.subject && m.subject.eventId === 'evt1');
assert(evt1, 'merged result should keep an evt1 card');
assert.strictEqual(evt1.severity, 'high', 'merged card should take the highest severity');
assert.strictEqual(evt1.daysUntil, -2, 'merged card should take the most urgent daysUntil');

// Both underlying actions survive so the user keeps every one-tap option.
const fns = evt1.proposedActions.map(a => a.fn);
assert(fns.indexOf('markFollowUpDone') >= 0, 'follow-up action should survive merge');
assert(fns.indexOf('markComplete') >= 0, 'cleanup action should survive merge');

// Moves with no eventId are never merged away.
const dl = merged.find(m => m.id === 'move-deadline-task-9');
assert(dl, 'deadline move (no eventId) should pass through');
assert.strictEqual(dl.proposedActions.length, 1, 'pass-through move keeps its actions');

// Idempotent: merging an already-merged list changes nothing.
const again = app.mergeMoves(merged);
assert.strictEqual(again.length, merged.length, 'mergeMoves should be idempotent');

console.log('merge-moves.test.js passed');
