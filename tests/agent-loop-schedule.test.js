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
globalThis.__app = {
  scheduleTaskToSlot,
  pendingTasksDB,
  eventsDB,
  interactionLog,
};`, context);

const app = context.__app;
assert.strictEqual(typeof app.scheduleTaskToSlot, 'function', 'scheduleTaskToSlot should exist');

app.pendingTasksDB.push({
  id: 'loop-social',
  title: 'Plan founder coffee',
  estTime: '~30m',
  kind: 'social',
  involves: 'Marie',
  deadline: 'Jun 8',
  importance: 3,
  urgency: 3,
});

app.scheduleTaskToSlot('pendingTask', 'loop-social', 2026, 6, 7, 10 * 60, 30);

const ev = (app.eventsDB['2026-6'][7] || []).find(e => e.sourceTaskId === 'pendingTask:loop-social');
assert(ev, 'agent-loop scheduled task should create a calendar event');
assert.strictEqual(ev.type, 'social', 'agent-loop event should preserve social type');
assert.strictEqual(ev.kind, 'social', 'agent-loop event should preserve kind');
assert.ok(ev.planMeta, 'agent-loop scheduled event should carry planMeta');
assert.strictEqual(ev.planMeta.surface, 'agent_loop');
assert.strictEqual(ev.planMeta.plannedDateISO, '2026-06-07');
assert.strictEqual(ev.planMeta.sourceTaskId, 'pendingTask:loop-social');

const log = app.interactionLog.find(row =>
  row.action === 'accepted' &&
  row.context &&
  row.context.surface === 'agent_loop' &&
  row.candidateId === 'loop-social'
);
assert(log, 'agent-loop scheduling should write a normalized interaction row');
assert.strictEqual(log.label, 1, 'agent-loop acceptance has positive label');
assert.ok(log.features && typeof log.features === 'object', 'agent-loop log includes features');

console.log('agent-loop-schedule.test.js passed');
