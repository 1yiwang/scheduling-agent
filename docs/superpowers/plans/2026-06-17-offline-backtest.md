# Offline Backtest Scaffold (Learning Flywheel · Track A #3)

> **For agentic workers:** Implement task-by-task with TDD. Steps use checkbox (`- [ ]`) syntax for tracking. Tests are Node `vm`-based in `tests/*.test.js`. Run the full suite after each task.

**Status:** ✅ Phase A–C complete (2026-06-17). Track A learning flywheel closed.

**Goal:** Replay `interaction_log` / `planActualLog` rows offline and **measure whether Beta-enhanced ranking beats a no-learning baseline** — without new UI or Supabase tables. Answers: 「增强有没有用？」「LLM 策展值不值？」（ranking slice only in v1; LLM curate replay deferred until we log curate decisions).

**Locked decisions:**
- **Pure replay only.** No DOM, no cloud calls. Isolated `prefStore` snapshot rebuilt from rows via `applySignalToPrefStore` / `applyPlanActualRowToStore`.
- **Input:** array of normalized interaction rows (local `interactionLog` shape or Supabase export `{ ts, action, kind, source, involves, context, top3, chosen_idx, features, label }`).
- **Strategies v1:** `baseline` (importance/urgency only) vs `enhanced` (replay prefs + `prefScoreFromStore`). LLM curate comparison deferred — no curate decision rows in log yet.
- **Metrics v1:**
  - Accept rate (`accepted`+`sent` vs `dismissed`; **`implicit_dismiss` excluded**)
  - Plan vs Actual completion rate + gap breakdown
  - Top-1 hit rate on rows with `top3` + `chosenIdx` (commute-style)
  - `lift` = enhanced top1Rate − baseline top1Rate
- **CLI:** `node scripts/run-backtest.js [fixture.json]` for local/Supabase export replay.
- **No new Supabase table.** Consume existing `interaction_log` JSONB.

---

## Architecture

```
interaction_log rows (sorted by ts)
  → normalizeBacktestRow(row)
  → replayPrefStore(rows, { untilIndex })     // isolated pref snapshot
  → runOfflineBacktest(rows)
       ├─ aggregateAcceptMetrics
       ├─ aggregatePlanActualMetrics
       └─ evaluateRankingTop1 (baseline | enhanced)
```

### Row → pref replay mapping

| `action` | Pref update |
|---|---|
| `accepted` | weak accept kind/source/person |
| `sent` | medium accept |
| `dismissed` | weak reject |
| `plan_actual` | strong/medium/weak via gap type (from `context`) |
| `implicit_dismiss` | skip |

---

## File Structure

- **Modify `index.html`**
  - Pure: `getPrefInStore`, `applySignalToPrefStore`, `prefScoreFromStore`, `scoreCandidateFromStore`
  - Refactor: `recordSignal`, `applyPlanActualLearning` → use store helpers
  - Backtest: `normalizeBacktestRow`, `sortBacktestRows`, `applyInteractionRowToStore`, `applyPlanActualRowToStore`, `replayPrefStore`, `aggregateAcceptMetrics`, `aggregatePlanActualMetrics`, `evaluateRankingTop1`, `runOfflineBacktest`
- **Create**
  - `tests/fixtures/backtest-sample.json`
  - `tests/backtest-replay.test.js`
  - `tests/backtest-metrics.test.js`
  - `scripts/run-backtest.js`
- **Modify docs** when shipped

---

## Verification

```powershell
node tests/backtest-replay.test.js
node tests/backtest-metrics.test.js
node scripts/run-backtest.js tests/fixtures/backtest-sample.json
Get-ChildItem tests/*.test.js | ForEach-Object { node $_.FullName }
```

---

## Tasks

### Phase A — Pure pref store replay

- [x] **A1.** `getPrefInStore` + `applySignalToPrefStore` + test
- [x] **A2.** Refactor `recordSignal` to call `applySignalToPrefStore(prefStore, …)`
- [x] **A3.** `applyPlanActualRowToStore` + refactor `applyPlanActualLearning`
- [x] **A4.** `normalizeBacktestRow` + `sortBacktestRows` + test

### Phase B — Metrics + ranking evaluation

- [x] **B1.** `applyInteractionRowToStore` + `replayPrefStore` + test
- [x] **B2.** `prefScoreFromStore` + `scoreCandidateFromStore` + test
- [x] **B3.** `aggregateAcceptMetrics` + `aggregatePlanActualMetrics` + test
- [x] **B4.** `evaluateRankingTop1` + `runOfflineBacktest` + fixture test

### Phase C — CLI + docs

- [x] **C1.** `scripts/run-backtest.js`
- [x] **C2.** Update `project-description.md` §7.7, `product-description.md`, plan status

---

## Non-Goals (v1)

- LLM curate decision replay (no logged `{order,folded}` rows yet)
- Detector-level backtest (deadline-risk slot pick vs actual)
- Analytics UI card for backtest results
- Cross-user pooled metrics

---

## Manual QA (after ship)

1. Supabase SQL Editor → export `interaction_log` last 30 days as JSON.
2. Save as `my-log.json`, run `node scripts/run-backtest.js my-log.json`.
3. Expect: `acceptMetrics`, `planActualMetrics`, `rankingMetrics.lift` printed.
4. If `plan_actual` rows ≥ 5 and `lift > 0`, enhanced ranking beats baseline on commute top-3 picks.
