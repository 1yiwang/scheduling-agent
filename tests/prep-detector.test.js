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
  8: [
    {
      id: 'board-meeting',
      type: 'busy',
      title: 'Board Meeting',
      startTime: '10:00',
      endTime: '11:00',
      time: '10–11',
      duration: '1h',
      participants: ['Marie'],
      context: 'Quarterly board review'
    }
  ]
};
globalThis.__app = {
  runAgentLoop,
  runMoveAction,
  eventsDB,
};`, context);

const app = context.__app;
const moves = app.runAgentLoop();
const prep = moves.find(m => m.type === 'prep_needed');

assert(prep, 'Agent Loop should surface missing prep for important upcoming meetings');
assert.strictEqual(prep.subject.eventId, 'board-meeting', 'prep move should target the meeting');
assert(prep.title.includes('Board Meeting'), 'prep title should name the meeting');
assert.strictEqual(prep.proposedActions[0].fn, 'createPrepBlock', 'prep action should create a prep block');

app.runMoveAction(prep.id, 0);
const prepEvent = app.eventsDB['2026-6'][8].find(e => e.prepForEventId === 'board-meeting');
assert(prepEvent, 'one-tap action should create a prep event');
assert.strictEqual(prepEvent.type, 'deep', 'prep event should be a focus block');
assert.strictEqual(prepEvent.startTime, '09:30', 'prep should be scheduled immediately before the meeting when possible');
assert.strictEqual(prepEvent.endTime, '10:00', 'prep should end at meeting start');
assert(!app.runAgentLoop().some(m => m.type === 'prep_needed' && m.subject.eventId === 'board-meeting'), 'scheduled prep should remove the prep suggestion');

console.log('prep-detector.test.js passed');
