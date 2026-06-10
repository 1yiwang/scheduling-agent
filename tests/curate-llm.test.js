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
  navigator: {}, setInterval() {}, setTimeout(fn) { fn(); }, Date, Promise,
};
vm.createContext(context);
vm.runInContext(`${script}
globalThis.__app = { buildCuratePrompt, parseCurateResponse, curateMovesLLM, curateMovesRules };`, context);
const app = context.__app;

const arr = list => Array.from(list);
function move(id, severity, type, daysUntil) {
  return { id, severity, type, daysUntil, title: id, subject: { eventId: id }, proposedActions: [] };
}
const moves = [
  move('c1', 'critical', 'existing_conflict', 0),
  move('p1', 'normal', 'prep_needed', 1),
  move('cl1', 'normal', 'cleanup_unmarked', 0),
];
const ctx = { dismissByType: {}, prefs: {}, today: { workMinutes: 60, eventCount: 2, highStakesSoon: true } };

// --- buildCuratePrompt: returns chat messages mentioning the move ids ---
const messages = app.buildCuratePrompt(moves, ctx);
assert(Array.isArray(messages) && messages.length >= 1, 'prompt is a messages array');
const blob = JSON.stringify(messages);
assert(blob.indexOf('c1') >= 0 && blob.indexOf('p1') >= 0, 'prompt lists the candidate move ids');

// --- parseCurateResponse: valid JSON, filters unknown ids ---
let d = app.parseCurateResponse('{"order":["p1","c1","ghost"],"folded":["cl1"]}', moves);
assert(d, 'valid JSON parses to a decision');
assert.deepStrictEqual(arr(d.order), ['p1', 'c1'], 'unknown ids filtered from order');
assert.deepStrictEqual(arr(d.folded), ['cl1'], 'folded preserved');

// --- parseCurateResponse: JSON embedded in prose still extracted ---
d = app.parseCurateResponse('Sure! Here:\n{"order":["c1"],"folded":[]}\nThanks', moves);
assert(d && arr(d.order).indexOf('c1') >= 0, 'extracts JSON from surrounding prose');

// --- parseCurateResponse: garbage → null (caller will fall back) ---
assert.strictEqual(app.parseCurateResponse('no json here', moves), null, 'garbage returns null');
assert.strictEqual(app.parseCurateResponse('', moves), null, 'empty returns null');

// --- curateMovesLLM: success path uses injected transport ---
let captured = null;
const okTransport = (msgs) => { captured = msgs; return Promise.resolve('{"order":["p1","c1"],"folded":["cl1"]}'); };
app.curateMovesLLM(moves, ctx, okTransport).then(dec => {
  assert(captured, 'transport was called with messages');
  assert(arr(dec.order).indexOf('p1') >= 0, 'LLM decision used on success');

  // --- curateMovesLLM: transport throws → falls back to rules decision ---
  const badTransport = () => Promise.reject(new Error('network'));
  return app.curateMovesLLM(moves, ctx, badTransport);
}).then(dec => {
  const rules = app.curateMovesRules(moves, ctx);
  assert.deepStrictEqual(arr(dec.order).sort(), arr(rules.order).sort(), 'falls back to rules on transport failure');

  // --- curateMovesLLM: invalid response → falls back to rules ---
  const junkTransport = () => Promise.resolve('garbage');
  return app.curateMovesLLM(moves, ctx, junkTransport);
}).then(dec => {
  const rules = app.curateMovesRules(moves, ctx);
  assert.deepStrictEqual(arr(dec.order).sort(), arr(rules.order).sort(), 'falls back to rules on invalid response');
  console.log('curate-llm.test.js passed');
}).catch(e => { console.error(e); process.exitCode = 1; });
