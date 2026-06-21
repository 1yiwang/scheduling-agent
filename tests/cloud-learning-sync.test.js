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

const calls = [];
function thenableQuery(op, table, payload) {
  return {
    then(resolve) {
      calls.push({ op, table, payload });
      if (resolve) resolve({ error: null });
      return Promise.resolve({ error: null });
    },
  };
}
const fakeSb = {
  from(table) {
    return {
      insert(payload) {
        return thenableQuery('insert', table, payload);
      },
      upsert(payload) {
        return thenableQuery('upsert', table, payload);
      },
    };
  },
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
appMode = 'live';
sb = fakeSb;
sbUser = { id: 'user-1', email: 'user@example.com' };
globalThis.__app = {
  recordInteraction,
  recordSignal,
  recordObservedDuration,
  recordPlanActualGap,
  calls,
};`, Object.assign(context, { fakeSb, calls }));

const app = context.__app;

app.recordInteraction({
  action: 'accepted',
  context: { surface: 'agent_loop', minutes: 30 },
  candidate: { id: 'task-1', kind: 'social', source: 'pendingTask', involves: 'Marie', estTime: '~30m' },
  label: 1,
});

app.recordSignal('candidate_kind', 'social', true);
app.recordObservedDuration('social', 'Marie', 35);

const interaction = app.calls.find(c => c.op === 'insert' && c.table === 'interaction_log');
assert(interaction, 'recordInteraction should insert into interaction_log when cloud is active');
assert.strictEqual(interaction.payload.user_id, 'user-1', 'interaction row has user_id');
assert.strictEqual(interaction.payload.action, 'accepted', 'interaction row has action');
assert.strictEqual(interaction.payload.candidate_id, 'task-1', 'interaction row maps candidateId to candidate_id');
assert.strictEqual(interaction.payload.chosen_idx, null, 'interaction row maps chosenIdx to chosen_idx');
assert.strictEqual(interaction.payload.label, 1, 'interaction row has label');
assert.ok(interaction.payload.features && typeof interaction.payload.features === 'object', 'interaction row has features');

const pref = app.calls.find(c => c.op === 'upsert' && c.table === 'pref_store');
assert(pref, 'recordSignal should upsert into pref_store when cloud is active');
assert.strictEqual(pref.payload.user_id, 'user-1', 'pref row has user_id');
assert.strictEqual(pref.payload.dimension, 'candidate_kind', 'pref row has dimension');
assert.strictEqual(pref.payload.key, 'social', 'pref row has key');
assert.ok(pref.payload.alpha >= 2, 'pref row has updated alpha');
assert.ok(pref.payload.sample_count >= 1, 'pref row has sample_count');

const duration = app.calls.find(c => c.op === 'insert' && c.table === 'duration_observations');
assert(duration, 'recordObservedDuration should insert into duration_observations when cloud is active');
assert.strictEqual(duration.payload.user_id, 'user-1', 'duration row has user_id');
assert.strictEqual(duration.payload.kind, 'social', 'duration row has kind');
assert.strictEqual(duration.payload.person, 'Marie', 'duration row has person');
assert.strictEqual(duration.payload.observed_minutes, 35, 'duration row has observed minutes');

app.recordPlanActualGap({
  eventId: 'evt-cloud-gap',
  ts: '2026-06-12T10:00:00.000Z',
  planned: { dateISO: '2026-06-12', plannedMinutes: 60, surface: 'agent_loop', kind: 'solo', type: 'deep' },
  actual: { completed: true, actualMinutes: 58 },
  gap: { type: 'completed_on_time', severity: 'low' },
  features: { label: 1, gapType: 'completed_on_time', plannedMinutes: 60, actualMinutes: 58 },
  label: 1,
});

const planActual = app.calls.find(c => c.op === 'insert' && c.table === 'interaction_log' && c.payload.action === 'plan_actual');
assert(planActual, 'recordPlanActualGap should insert plan_actual into interaction_log when cloud is active');
assert.strictEqual(planActual.payload.user_id, 'user-1', 'plan_actual row has user_id');
assert.strictEqual(planActual.payload.label, 1, 'plan_actual row has label');
assert.ok(planActual.payload.context && planActual.payload.context.eventId === 'evt-cloud-gap', 'plan_actual context carries gap row');

console.log('cloud-learning-sync.test.js passed');
