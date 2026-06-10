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
  console, document,
  window: { matchMedia: () => ({ matches: false, addEventListener() {} }) },
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  navigator: {}, setInterval() {}, setTimeout(fn) { fn(); }, Date,
};

vm.createContext(context);
vm.runInContext(`${script}
globalThis.__app = {
  aggregateLearningTrends: typeof aggregateLearningTrends === 'function' ? aggregateLearningTrends : undefined,
};`, context);

const app = context.__app;
assert.strictEqual(typeof app.aggregateLearningTrends, 'function', 'aggregateLearningTrends should exist');

// Tuesday Jun 10, 2026 → this week Mon Jun 8–Sun Jun 14, last week Mon Jun 1–Sun Jun 7
const now = new Date(2026, 5, 10, 12, 0, 0);
const interactions = [
  { ts: '2026-06-09T10:00:00.000Z', action: 'accepted', kind: 'social', source: 'pendingTask', label: 1 },
  { ts: '2026-06-09T15:00:00.000Z', action: 'dismissed', kind: 'call', source: 'pendingTask', label: 0 },
  { ts: '2026-06-05T09:00:00.000Z', action: 'accepted', kind: 'deep', source: 'pendingTask', label: 1 },
];
const durations = [
  { ts: '2026-06-09T11:00:00.000Z', kind: 'social', person: 'Marie', observed_minutes: 35 },
  { ts: '2026-06-09T12:00:00.000Z', kind: 'social', person: 'Marie', observed_minutes: 40 },
  { ts: '2026-06-04T11:00:00.000Z', kind: 'deep', person: null, observed_minutes: 60 },
];

const trends = app.aggregateLearningTrends(interactions, durations, now);
assert.strictEqual(trends.thisWeek.interactions, 2, 'this week interaction count');
assert.strictEqual(trends.lastWeek.interactions, 1, 'last week interaction count');
assert.strictEqual(trends.thisWeek.acceptRate, 50, 'this week accept rate');
assert.strictEqual(trends.lastWeek.acceptRate, 100, 'last week accept rate');
assert.strictEqual(trends.acceptRateDelta, -50, 'accept rate delta');
assert.strictEqual(trends.thisWeek.topKind, 'social', 'this week top kind');
assert.strictEqual(trends.thisWeek.topSource, 'pendingTask', 'this week top source');
assert.strictEqual(trends.durationThisWeek, 2, 'this week duration observations');
assert.strictEqual(trends.avgDurationThisWeek, 38, 'this week avg duration');
assert.strictEqual(trends.hasData, true, 'trends has data');

console.log('analytics-trends.test.js passed');
