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
eventsDB['2026-6'] = {
  5: [
    { id: 'past-unmarked', type: 'online', title: 'Client demo', startTime: '10:00', endTime: '11:00', time: '10–11', duration: '1h' },
    { id: 'past-marked-not-done', type: 'busy', title: 'Board prep', startTime: '12:00', endTime: '13:00', time: '12–1', duration: '1h' }
  ],
  8: [
    { id: 'future-unmarked', type: 'online', title: 'Future call', startTime: '10:00', endTime: '11:00', time: '10–11', duration: '1h' }
  ]
};
completionDB['past-marked-not-done'] = false;
globalThis.__app = {
  runAgentLoop,
  runMoveAction,
  completionDB,
};`, context);

const app = context.__app;
const moves = app.runAgentLoop();
const cleanup = moves.find(m => m.type === 'cleanup_unmarked');

assert(cleanup, 'Agent Loop should surface unmarked past work events');
assert.strictEqual(cleanup.subject.eventId, 'past-unmarked', 'cleanup move should target the unmarked event');
assert(cleanup.title.includes('Client demo'), 'cleanup title should name the event');
assert.strictEqual(cleanup.proposedActions[0].fn, 'markComplete', 'cleanup action should reuse completion tracking');
assert(!moves.some(m => m.subject && m.subject.eventId === 'past-marked-not-done'), 'events already marked not done should not be shown');
assert(!moves.some(m => m.subject && m.subject.eventId === 'future-unmarked'), 'future events should not be shown');

app.runMoveAction(cleanup.id, 0);
assert.strictEqual(app.completionDB['past-unmarked'], true, 'one-tap cleanup action marks the event done');
assert(!app.runAgentLoop().some(m => m.type === 'cleanup_unmarked'), 'marked event should disappear from Agent Loop');

console.log('cleanup-detector.test.js passed');
