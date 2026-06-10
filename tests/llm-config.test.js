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
// Stateful localStorage so we can verify save/load round-trips.
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
globalThis.__app = { normalizeLLMConfig, llmConfigured, saveLLMConfig, getLLMConfig };`, context);
const app = context.__app;

assert.strictEqual(typeof app.normalizeLLMConfig, 'function', 'normalizeLLMConfig exported');

// Defaults preset for DeepSeek; empty input fills them all.
const def = app.normalizeLLMConfig(null);
assert.strictEqual(def.provider, 'deepseek', 'defaults to deepseek');
assert.strictEqual(def.baseUrl, 'https://api.deepseek.com', 'default base url');
assert.strictEqual(def.model, 'deepseek-chat', 'default model');
assert.strictEqual(def.enabled, false, 'disabled by default');
assert.strictEqual(def.apiKey, '', 'no key by default');

// User overrides merge over defaults; unknown junk ignored.
const merged = app.normalizeLLMConfig({ enabled: true, apiKey: 'sk-x', model: 'deepseek-reasoner', junk: 1 });
assert.strictEqual(merged.enabled, true);
assert.strictEqual(merged.apiKey, 'sk-x');
assert.strictEqual(merged.model, 'deepseek-reasoner');
assert.strictEqual(merged.baseUrl, 'https://api.deepseek.com', 'untouched field keeps default');
assert.strictEqual(merged.junk, undefined, 'unknown keys dropped');

// llmConfigured = enabled + key + baseUrl + model (mode-independent).
assert.strictEqual(app.llmConfigured({ enabled: true, apiKey: 'k', baseUrl: 'u', model: 'm' }), true);
assert.strictEqual(app.llmConfigured({ enabled: false, apiKey: 'k', baseUrl: 'u', model: 'm' }), false, 'disabled is not configured');
assert.strictEqual(app.llmConfigured({ enabled: true, apiKey: '', baseUrl: 'u', model: 'm' }), false, 'missing key is not configured');

// Save persists to localStorage and getLLMConfig reads it back.
app.saveLLMConfig({ enabled: true, apiKey: 'sk-saved' });
const reread = app.normalizeLLMConfig(JSON.parse(store['schedulingAgentLLM.v1']));
assert.strictEqual(reread.apiKey, 'sk-saved', 'saved key round-trips through localStorage');
assert.strictEqual(reread.enabled, true, 'saved enable flag round-trips');

console.log('llm-config.test.js passed');
