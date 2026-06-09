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
// Stateful localStorage so we can prove writes happen / don't happen.
const store = {};
const context = {
  console, document,
  window: { matchMedia: () => ({ matches: false, addEventListener() {} }) },
  localStorage: {
    getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem(k, v) { store[k] = String(v); },
    removeItem(k) { delete store[k]; },
  },
  navigator: {}, setInterval() {}, setTimeout(fn) { fn(); }, Date,
};
vm.createContext(context);
vm.runInContext(`${script}
globalThis.__app = {
  snapshotDBs: typeof snapshotDBs === 'function' ? snapshotDBs : undefined,
  loadDBsFrom: typeof loadDBsFrom === 'function' ? loadDBsFrom : undefined,
  emptyDBs: typeof emptyDBs === 'function' ? emptyDBs : undefined,
  saveAppData: typeof saveAppData === 'function' ? saveAppData : undefined,
  DEMO_SEED: typeof DEMO_SEED !== 'undefined' ? DEMO_SEED : undefined,
  APP_DATA_KEY: typeof APP_DATA_KEY !== 'undefined' ? APP_DATA_KEY : undefined,
  appMode: typeof appMode !== 'undefined' ? appMode : undefined,
  eventsDB, pendingTasksDB,
};`, context);

const app = context.__app;

assert.strictEqual(typeof app.snapshotDBs, 'function', 'snapshotDBs should exist');
assert.strictEqual(typeof app.loadDBsFrom, 'function', 'loadDBsFrom should exist');
assert.strictEqual(typeof app.emptyDBs, 'function', 'emptyDBs should exist');
assert.strictEqual(typeof app.saveAppData, 'function', 'saveAppData should exist');

// Default mode is demo, with the curated seed loaded (so a viewer sees the story).
assert.strictEqual(app.appMode, 'demo', 'default mode is demo');
assert.ok(app.DEMO_SEED && app.DEMO_SEED.pendingTasksDB.length > 0, 'demo seed was captured pristine');
assert.ok(app.pendingTasksDB.length > 0, 'demo seed is loaded into the live DBs');
const seedTaskCount = app.pendingTasksDB.length;

// Empty start: clears everything to a blank slate.
app.emptyDBs();
assert.strictEqual(app.pendingTasksDB.length, 0, 'emptyDBs clears pending tasks');
assert.deepStrictEqual(Object.keys(app.eventsDB), ['2026-6'], 'emptyDBs leaves only the current month bucket');
assert.strictEqual(Object.keys(app.eventsDB['2026-6']).length, 0, 'emptyDBs leaves no events');

// In demo mode, saving must NOT persist (so showing the app never overwrites real data).
app.saveAppData();
assert.strictEqual(app.APP_DATA_KEY in store, false, 'demo mode does not write live data');

// Restoring from the seed snapshot brings the curated data back.
app.loadDBsFrom(JSON.parse(JSON.stringify(app.DEMO_SEED)));
assert.strictEqual(app.pendingTasksDB.length, seedTaskCount, 'loadDBsFrom restores the seed');

// Snapshot -> JSON -> restore is lossless (the persistence roundtrip).
const snap = app.snapshotDBs();
const roundtrip = JSON.parse(JSON.stringify(snap));
app.emptyDBs();
app.loadDBsFrom(roundtrip);
assert.strictEqual(app.pendingTasksDB.length, seedTaskCount, 'snapshot roundtrip preserves task count');

console.log('persistence.test.js passed');
