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
eventsDB['2026-6'] = {
  8: [
    { id: 'deep-1', type: 'deep', title: 'Deep work block', startTime: '10:00', endTime: '11:00', time: '10–11', duration: '1h' },
    { id: 'call-1', type: 'online', title: 'Client call', startTime: '10:30', endTime: '11:00', time: '10:30–11', duration: '30m' }
  ]
};
globalThis.__app = {
  runAgentLoop,
  runMoveAction,
  eventsDB,
};`, context);

const app = context.__app;
const moves = app.runAgentLoop();
const conflict = moves.find(m => m.type === 'existing_conflict');

assert(conflict, 'Agent Loop should surface an existing calendar conflict');
assert.strictEqual(conflict.severity, 'critical', 'existing conflicts should be critical');
assert.strictEqual(conflict.daysUntil, 2, 'conflict is two days from the pinned demo date');
assert.strictEqual(conflict.subject.eventId, 'call-1', 'shorter/later event should be selected as the movable event');
assert(conflict.title.includes('Client call'), 'move title should name the event to move');
assert(conflict.dueShort.includes('conflict'), 'move badge should explain the problem');
assert(conflict.proposedActions.length > 0, 'conflict move should have at least one proposed action');
assert.strictEqual(conflict.proposedActions[0].fn, 'moveEventToSlot', 'conflict action should move an existing event');

app.runMoveAction(conflict.id, 0);

const day = app.eventsDB['2026-6'][8];
const moved = day.find(e => e.id === 'call-1');
const fixed = day.find(e => e.id === 'deep-1');
assert(moved, 'moved event should remain on the calendar');
assert(fixed, 'fixed event should remain on the calendar');
assert.notStrictEqual(moved.startTime, '10:30', 'moved event should receive a new start time');

function toMin(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
assert(
  toMin(moved.startTime) >= toMin(fixed.endTime) || toMin(moved.endTime) <= toMin(fixed.startTime),
  'moved event should no longer overlap the fixed event'
);

assert(!app.runAgentLoop().some(m => m.type === 'existing_conflict'), 'resolved conflict should disappear from Agent Loop');

console.log('conflict-detector.test.js passed');
