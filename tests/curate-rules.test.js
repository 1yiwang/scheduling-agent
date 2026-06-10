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
globalThis.__app = { curateMovesRules, applyCuration };`, context);
const app = context.__app;

const arr = list => Array.from(list);

assert.strictEqual(typeof app.curateMovesRules, 'function', 'curateMovesRules should be exported');

function move(id, severity, type, daysUntil) {
  return { id, severity, type, daysUntil, title: id, subject: { eventId: id }, proposedActions: [] };
}

// 1 critical + 6 normals; the user habitually dismisses cleanup_unmarked.
const moves = [
  move('c1', 'critical', 'existing_conflict', 0),
  move('p1', 'normal', 'prep_needed', 1),
  move('p2', 'normal', 'prep_needed', 2),
  move('f1', 'normal', 'follow_up_due', 1),
  move('o1', 'normal', 'overload_rebalance', 3),
  move('cl1', 'normal', 'cleanup_unmarked', 0),
  move('cl2', 'normal', 'cleanup_unmarked', 0),
];
const ctx = { dismissByType: { cleanup_unmarked: 5 }, prefs: {}, today: {} };

const decision = app.curateMovesRules(moves, ctx);

// Caps the visible list and folds the overflow.
assert.strictEqual(arr(decision.order).length, 5, 'visible list capped at 5');
assert.strictEqual(arr(decision.folded).length, 2, 'overflow folded');

// Critical always leads and is never folded.
assert.strictEqual(arr(decision.order)[0], 'c1', 'critical leads');
assert(arr(decision.folded).indexOf('c1') < 0, 'critical never folded');

// Habitually-dismissed type is demoted into the folded bucket.
assert(arr(decision.folded).indexOf('cl1') >= 0 && arr(decision.folded).indexOf('cl2') >= 0,
  'high-dismiss type demoted to folded');
assert(arr(decision.order).indexOf('cl1') < 0, 'demoted type not in visible');

// Decision is consumable by applyCuration without loss.
const applied = app.applyCuration(moves, decision);
const total = Array.from(applied.visible).length + Array.from(applied.folded).length;
assert.strictEqual(total, moves.length, 'no move lost after curate + apply');

console.log('curate-rules.test.js passed');
