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
// Jun 8 is overloaded (9h of work events); Jun 9 is wide open.
eventsDB['2026-6'] = {
  8: [
    { id: 'focus-a', type: 'deep', title: 'Focus A', startTime: '08:00', endTime: '10:00', time: '8–10', duration: '2h' },
    { id: 'big-meeting', type: 'busy', title: 'Big Meeting', startTime: '10:00', endTime: '12:30', time: '10–12:30', duration: '2h 30m', participants: ['Marie'] },
    { id: 'client-call', type: 'online', title: 'Client Call', startTime: '13:00', endTime: '15:00', time: '1–3', duration: '2h', participants: ['Client'] },
    { id: 'focus-b', type: 'deep', title: 'Focus B', startTime: '15:00', endTime: '17:30', time: '3–5:30', duration: '2h 30m' }
  ],
  9: []
};
globalThis.__app = {
  runAgentLoop,
  runMoveAction,
  eventsDB,
};`, context);

const app = context.__app;
const moves = app.runAgentLoop();
const rebalance = moves.find(m => m.type === 'overload_rebalance');

assert(rebalance, 'Agent Loop should surface an overloaded day');
assert.strictEqual(rebalance.subject.eventId, 'focus-a', 'rebalance should move the shortest low-risk focus block');
assert(rebalance.proposedActions.length > 0, 'rebalance should propose at least one target slot');
assert.strictEqual(rebalance.proposedActions[0].fn, 'moveEventToSlot', 'rebalance action should move the event');

// A meeting with participants is not a safe pick; only deep/focus blocks move.
assert.notStrictEqual(rebalance.subject.eventId, 'big-meeting', 'meetings with participants should not be auto-moved');

app.runMoveAction(rebalance.id, 0);

const stillOnDay8 = (app.eventsDB['2026-6'][8] || []).some(e => e.id === 'focus-a');
assert(!stillOnDay8, 'moved focus block should leave the overloaded day');
assert(!app.runAgentLoop().some(m => m.type === 'overload_rebalance' && m.dueISO === '2026-06-08'),
  'after rebalancing, the day should no longer be flagged as overloaded');

console.log('rebalance-detector.test.js passed');
