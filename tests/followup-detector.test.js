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
  2: [
    {
      id: 'investor-call',
      type: 'online',
      title: 'Investor Update',
      startTime: '16:00',
      endTime: '16:30',
      time: '4:00–4:30 PM',
      duration: '30m',
      followUpNeeded: true,
      followUpBy: '2026-06-05',
      followUpStatus: 'pending',
      followUpNote: 'Send updated deck'
    }
  ],
  6: [
    {
      id: 'future-call',
      type: 'online',
      title: 'Future Follow-up',
      startTime: '10:00',
      endTime: '10:30',
      time: '10:00–10:30 AM',
      duration: '30m',
      followUpNeeded: true,
      followUpBy: '2026-06-09',
      followUpStatus: 'pending',
      followUpNote: 'Send later'
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
const follow = moves.find(m => m.type === 'follow_up_due');

assert(follow, 'Agent Loop should surface overdue follow-up items');
assert.strictEqual(follow.severity, 'high', 'overdue follow-up should be high severity');
assert.strictEqual(follow.daysUntil, -1, 'follow-up is one day overdue from the pinned demo date');
assert.strictEqual(follow.subject.eventId, 'investor-call', 'move subject should target the event');
assert(follow.title.includes('Send updated deck'), 'move title should use the follow-up note when available');
assert.strictEqual(follow.proposedActions.length, 1, 'follow-up move should have one done action');
assert.strictEqual(follow.proposedActions[0].fn, 'markFollowUpDone', 'follow-up action should mark it done');
assert(!moves.some(m => m.type === 'follow_up_due' && m.subject && m.subject.eventId === 'future-call'), 'future follow-up should not be shown yet');

app.runMoveAction(follow.id, 0);
const ev = app.eventsDB['2026-6'][2][0];
assert.strictEqual(ev.followUpStatus, 'done', 'one-tap action marks follow-up done');
assert(!app.runAgentLoop().some(m => m.type === 'follow_up_due'), 'done follow-up should disappear from Agent Loop');

console.log('followup-detector.test.js passed');
