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
  localStorage: { getItem() { return null; }, setItem() {} },
  navigator: {}, setInterval() {}, setTimeout(fn) { fn(); }, Date, Promise,
};
vm.createContext(context);
vm.runInContext(`${script}
globalThis.__voice = {
  parseVoiceEventJSON, buildVoiceParsePrompt, resolveVoiceCaptureDate,
  formatCaptureDateLabel, buildParseFieldsHTML, voiceSTTConfigured
};`, context);
const v = context.__voice;

// ── parseVoiceEventJSON ──
const good = v.parseVoiceEventJSON(JSON.stringify({
  title: 'Coffee with Lukas',
  dateISO: '2026-06-18',
  startTime: '15:00',
  endTime: '15:30',
  location: 'NEUR.ON Office',
  person: 'Lukas',
  eventKind: 'meeting',
  confidence: 0.92
}));
assert.strictEqual(good.title, 'Coffee with Lukas');
assert.strictEqual(good.dateISO, '2026-06-18');
assert.strictEqual(good.startTime, '15:00');
assert.strictEqual(good.endTime, '15:30');
assert.strictEqual(good.location, 'NEUR.ON Office');
assert.strictEqual(good.person, 'Lukas');
assert.strictEqual(good.eventKind, 'meeting');

// Markdown fence wrapper
const fenced = v.parseVoiceEventJSON('```json\n{"title":"Sync","startTime":"09:00","endTime":"09:30","eventKind":"call"}\n```');
assert.strictEqual(fenced.title, 'Sync');
assert.strictEqual(fenced.startTime, '09:00');

// Invalid / missing title → null
assert.strictEqual(v.parseVoiceEventJSON('not json'), null);
assert.strictEqual(v.parseVoiceEventJSON('{"startTime":"10:00"}'), null);

// Normalizes eventKind aliases
const alias = v.parseVoiceEventJSON('{"title":"Run","startTime":"07:00","endTime":"07:45","eventKind":"solo_work"}');
assert.strictEqual(alias.eventKind, 'solo');

// ── resolveVoiceCaptureDate ──
const now = new Date('2026-06-17T10:00:00');
assert.strictEqual(v.resolveVoiceCaptureDate({ dateISO: '2026-06-20' }, { selectedDay: null, now }), '2026-06-20');
assert.strictEqual(v.resolveVoiceCaptureDate({}, { selectedDay: { year: 2026, month: 6, day: 12 }, now }), '2026-06-12');
assert.strictEqual(v.resolveVoiceCaptureDate({}, { selectedDay: null, now }), '2026-06-17');

// ── formatCaptureDateLabel ──
const label = v.formatCaptureDateLabel('2026-06-18');
assert.ok(label.indexOf('Jun') >= 0 && label.indexOf('18') >= 0, 'label has month/day');

// ── buildVoiceParsePrompt ──
const prompt = v.buildVoiceParsePrompt('Meet Michael Monday 10am', { nowISO: '2026-06-17T08:00:00.000Z', timezone: 'Europe/Zurich' });
assert.ok(prompt.some(m => m.role === 'user' && m.content.indexOf('Meet Michael') >= 0), 'transcript in prompt');
assert.ok(prompt.some(m => m.content.indexOf('2026-06-17') >= 0), 'context date in prompt');

// ── buildParseFieldsHTML ──
const htmlOut = v.buildParseFieldsHTML({
  dateLabel: 'Wed, Jun 18',
  timeLabel: '3:00 – 3:30 PM',
  location: 'Office',
  person: 'Lukas',
  eventKind: 'meeting'
});
assert.ok(htmlOut.indexOf('Wed, Jun 18') >= 0);
assert.ok(htmlOut.indexOf('Lukas') >= 0);

// ── voiceSTTConfigured ──
assert.strictEqual(v.voiceSTTConfigured({ enabled: true, sttApiKey: 'k', sttBaseUrl: 'https://api.openai.com/v1' }), true);
assert.strictEqual(v.voiceSTTConfigured({ enabled: true, sttApiKey: '', sttBaseUrl: 'https://api.openai.com/v1', apiKey: 'k' }), true, 'falls back to chat key');
assert.strictEqual(v.voiceSTTConfigured({ enabled: false, sttApiKey: 'k', sttBaseUrl: 'u' }), false);

console.log('voice-parse.test.js passed');
