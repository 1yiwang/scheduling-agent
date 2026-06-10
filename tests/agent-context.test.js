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
  querySelector() { return null; }, querySelectorAll() { return []; }, addEventListener() {},
};
const context = {
  console, document,
  window: { matchMedia: () => ({ matches: false, addEventListener() {} }) },
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  navigator: {}, setInterval() {}, setTimeout(fn) { fn(); }, Date,
};
vm.createContext(context);
vm.runInContext(`${script}
pendingTasksDB.length = 0; owedRepliesDB.length = 0; pendingMeetingsDB.length = 0;
Object.keys(eventsDB).forEach(k => delete eventsDB[k]);
Object.keys(completionDB).forEach(k => delete completionDB[k]);
Object.keys(prefStore).forEach(k => delete prefStore[k]);
interactionLog.length = 0;
// Anchor data to whatever "today" the app sees, so the test is date-agnostic.
const t = appNow();
const y = t.getFullYear(), mo = t.getMonth() + 1, da = t.getDate();
const mk = y + '-' + mo;
eventsDB[mk] = {};
eventsDB[mk][da] = [
  { id: 'm1', type: 'busy', title: 'Board', startTime: '09:00', endTime: '11:00', time: '9–11', duration: '2h', participants: ['Marie'] }
];
prefStore['candidate_kind::deep'] = { dimension: 'candidate_kind', key: 'deep', alpha: 7, beta: 3, sampleCount: 10, confidence: 0.7 };
interactionLog.push(
  { action: 'dismiss', type: 'cleanup_unmarked' },
  { action: 'dismiss', type: 'cleanup_unmarked' },
  { action: 'accept', type: 'prep_needed' }
);
globalThis.__app = { buildAgentContext };`, context);

const app = context.__app;

assert.strictEqual(typeof app.buildAgentContext, 'function', 'buildAgentContext should be exported');

const ctx = app.buildAgentContext();

// Compact "today" summary from real events.
assert(ctx.today, 'context has a today summary');
assert.strictEqual(ctx.today.workMinutes, 120, 'today work minutes from real events');
assert.strictEqual(ctx.today.eventCount, 1, 'today event count');
assert.strictEqual(ctx.today.highStakesSoon, true, 'near-term meeting with participants flagged');

// Dismiss tendency aggregated by move type.
assert.strictEqual(ctx.dismissByType.cleanup_unmarked, 2, 'dismiss counts aggregated per type');
assert(!ctx.dismissByType.prep_needed, 'accepts are not counted as dismisses');

// Preference card from Beta means.
assert(ctx.prefs['candidate_kind::deep'] > 0.65 && ctx.prefs['candidate_kind::deep'] < 0.75,
  'preference score reflects Beta mean (~0.7)');

console.log('agent-context.test.js passed');
