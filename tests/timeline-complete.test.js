const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];

function makeElement() {
  return {
    innerHTML: '',
    textContent: '',
    dataset: {},
    style: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {},
    scrollIntoView() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    closest() { return null; },
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
  completionDB,
  getCompletion,
  findEventById,
  toggleTimelineComplete: typeof toggleTimelineComplete === 'function' ? toggleTimelineComplete : undefined,
};`, context);

const app = context.__app;

assert.strictEqual(typeof app.toggleTimelineComplete, 'function', 'toggleTimelineComplete should exist');

// evt-20260606-03 is a today event that starts unmarked in the demo data.
const target = app.findEventById('evt-20260606-03');
assert(target, 'expected demo event evt-20260606-03 to exist');
const ev = target.event;

assert.strictEqual(app.getCompletion(ev), null, 'event should start unmarked');

app.toggleTimelineComplete('evt-20260606-03');
assert.strictEqual(app.getCompletion(ev), true, 'first toggle marks the event done');

app.toggleTimelineComplete('evt-20260606-03');
assert.strictEqual(app.getCompletion(ev), null, 'second toggle returns the event to unmarked');

console.log('timeline-complete.test.js passed');
