#!/usr/bin/env node
/**
 * Offline backtest CLI — replay interaction_log JSON and print metrics.
 * Usage: node scripts/run-backtest.js [path/to/export.json]
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const inputPath = process.argv[2] || path.join(__dirname, '..', 'tests', 'fixtures', 'backtest-sample.json');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];

const raw = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const rows = Array.isArray(raw) ? raw : (raw.interaction_log || raw.rows || []);

const context = {
  console,
  document: {
    documentElement: { setAttribute() {}, removeAttribute() {} },
    getElementById() {
      return {
        innerHTML: '', textContent: '', dataset: {}, style: {},
        classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
        addEventListener() {}, scrollIntoView() {},
        querySelector() { return null; }, querySelectorAll() { return []; }, closest() { return null; },
      };
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {},
  },
  window: { matchMedia: () => ({ matches: false, addEventListener() {} }) },
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  navigator: {},
  setInterval() {},
  setTimeout(fn) { fn(); },
  Date,
};

vm.createContext(context);
vm.runInContext(`${script}
globalThis.__runOfflineBacktest = runOfflineBacktest;
`, context);

const report = context.__runOfflineBacktest(rows);

console.log('Offline backtest report');
console.log('Source:', inputPath);
console.log('Rows:', report.rowCount);
console.log('');
console.log('Accept metrics:', JSON.stringify(report.acceptMetrics, null, 2));
console.log('');
console.log('Plan vs Actual:', JSON.stringify(report.planActualMetrics, null, 2));
console.log('');
console.log('Ranking (baseline vs enhanced):');
console.log('  baseline:', report.rankingMetrics.baseline);
console.log('  enhanced:', report.rankingMetrics.enhanced);
console.log('  lift:', report.rankingMetrics.lift, 'pp');
console.log('');
console.log('Replayed pref keys:', report.replayedPrefCount);
