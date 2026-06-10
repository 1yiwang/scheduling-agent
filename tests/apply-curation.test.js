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
globalThis.__app = { applyCuration, mergeMoves };`, context);
const app = context.__app;

assert.strictEqual(typeof app.applyCuration, 'function', 'applyCuration should be exported');

// r.visible/r.folded are arrays created inside the vm realm; normalize to a
// Node-realm array of ids so assert.deepStrictEqual's prototype check passes.
const ids = list => Array.from(list, m => m.id);

function move(id, severity, daysUntil) {
  return { id, severity, daysUntil, title: id, subject: {}, proposedActions: [] };
}
const crit = move('c1', 'critical', 0);
const hi = move('h1', 'high', 1);
const n1 = move('n1', 'normal', 2);
const n2 = move('n2', 'normal', 3);
const all = [crit, hi, n1, n2];

// 1. Honors curator order for non-criticals.
let r = app.applyCuration(all, { order: ['c1', 'n2', 'h1', 'n1'], folded: [] });
assert.strictEqual(ids(r.visible)[0], 'c1', 'critical must be first');
// non-criticals keep curator order after criticals
assert.deepStrictEqual(ids(r.visible), ['c1', 'n2', 'h1', 'n1'], 'order honored with critical floated');

// 2. Critical can never be folded — it gets pulled back to visible.
r = app.applyCuration(all, { order: ['h1', 'n1', 'n2'], folded: ['c1'] });
assert(ids(r.visible).indexOf('c1') >= 0, 'critical in folded must be forced visible');
assert(ids(r.folded).indexOf('c1') < 0, 'critical must never stay folded');
assert.strictEqual(ids(r.visible)[0], 'c1', 'forced critical floats to the top');

// 3. Unknown ids are ignored.
r = app.applyCuration(all, { order: ['ghost', 'c1', 'h1'], folded: ['phantom'] });
assert(ids(r.visible).indexOf('ghost') < 0, 'unknown visible id ignored');
assert(ids(r.folded).indexOf('phantom') < 0, 'unknown folded id ignored');

// 4. Missing ids are appended, never lost.
r = app.applyCuration(all, { order: ['c1'], folded: [] });
const seen = ids(r.visible).concat(ids(r.folded)).sort();
assert.deepStrictEqual(seen, ['c1', 'h1', 'n1', 'n2'], 'every move must appear somewhere');

// 5. Folded list is returned for non-criticals the curator hid.
r = app.applyCuration(all, { order: ['c1', 'h1'], folded: ['n1', 'n2'] });
assert.deepStrictEqual(ids(r.folded).sort(), ['n1', 'n2'], 'curator-folded normals stay folded');
assert.deepStrictEqual(ids(r.visible), ['c1', 'h1'], 'visible matches curator minus folded');

// 6. Invalid decision → defensive: everything visible in default (severity, urgency) order.
r = app.applyCuration(all, null);
assert.strictEqual(ids(r.visible)[0], 'c1', 'invalid decision still floats critical');
assert.strictEqual(r.folded.length, 0, 'invalid decision folds nothing');
assert.deepStrictEqual(ids(r.visible), ['c1', 'h1', 'n1', 'n2'], 'default order = severity then urgency');

console.log('apply-curation.test.js passed');
