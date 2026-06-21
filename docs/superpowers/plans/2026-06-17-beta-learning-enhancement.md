# Beta Learning Enhancement (Learning Flywheel · Track A #2)

> **For agentic workers:** Implement task-by-task with TDD. Steps use checkbox (`- [ ]`) syntax for tracking. Tests are Node `vm`-based in `tests/*.test.js`. Run the full suite after each task.

**Status:** ✅ Phase A–D complete (2026-06-17). Track A #3 offline backtest scaffold is next.

**Goal:** Make Tier-1 Beta preferences **actually change Top-N ranking** — not symbolic learning buried under `importance×18`. Close the second half of the flywheel: **consume `planActualLog` as delayed reward**, and **stop treating dismiss like reject**.

**Locked decisions (from `BRAINSTORM.md` §八 + `product-description.md` P0 #2):**
- **Three deliverables in v1:** (1) raise pref weight in `scoreCandidate`, (2) signal layering (strength tiers), (3) `planActualLog` → preference updates on reconcile.
- **Read-side time decay** with 45-day half-life applied inside `betaConfidence()` — no background job, no schema migration.
- **Fractional Beta updates** via float `alpha`/`beta` increments (`weak=0.25`, `medium=0.5`, `strong=1.0`). Existing integer-only rows remain valid.
- **Dismiss ≠ reject.** `dismissMove()` logs `implicit_dismiss` to `interactionLog` only — **zero** Beta penalty. Commute card dismiss downgrades from full reject to **weak** negative.
- **Accept ≠ strong positive.** One-tap schedule / desk plan acceptance records **weak** positive (+0.25). Terminal `plan_actual` rows carry **strong** (+1 / −1) delayed reward.
- **New preference dimensions** for scheduling context: `schedule_hour` (0–23), `schedule_dow` (0–6), plus existing `candidate_kind`, `candidate_source`, `person`.
- **Observe + act in sorting only.** No new detectors, no Thompson Sampling, no Tier-2 rule engine, no Settings UI in this plan.
- **Idempotent plan-actual learning.** `applyPlanActualLearning(row)` runs once per `eventId` — guard with `row.learningApplied` or skip if pref already updated for that event.

---

## Problem (measured)

Current `scoreCandidate`:

```javascript
importanceScore(candidate.importance) * 18 +
importanceScore(candidate.urgency) * 14 +
Math.max(0, 30 - candidate.estMinutes) * 0.2 +
prefScore(candidate);
```

`prefScore` max swing ≈ ±20 (kind×20 + person×12 + source×8). After 10 accepts, kind confidence 0.92 → pref contribution ≈ **+8.4**. High-importance task base ≈ **54**. **Learning is ~15% of score — rules dominate.**

Secondary bugs:
- `dismissMove()` writes nothing; commute `dismissed` calls `recordSignal(..., false)` → **full reject** for a weak signal.
- `scheduleTaskToSlot` / `recordPlanAcceptance` → immediate **full** accept, but user may never complete the block → **no delayed correction** until now (`planActualLog` exists but is unused).

---

## Architecture

```
User interaction                          Signal strength          Beta update
─────────────────────────────────────────────────────────────────────────────────
scheduleTaskToSlot / desk accept          weak accept (+0.25)      kind, source, person
commute accept / sent                     medium accept (+0.5)     kind, source, person
plan_actual completed_on_time             strong accept (+1.0)     kind, hour, dow
plan_actual not_completed / rescheduled   strong reject (+1.0)     kind, hour, dow
plan_actual completed_late                medium reject (+0.5)     hour, dow
plan_actual duration_drift                weak reject (+0.25)      kind only
dismissMove (agent card ×)                log only                 none
commute dismissed                         weak reject (+0.25)      kind, source, person

betaConfidence(pref)
  → effectiveAlpha/Beta = decay(prior=1,1 + observed, halflife=45d)
  → return effectiveAlpha / (effectiveAlpha + effectiveBeta)

prefScore(candidate, slotContext?)
  → kind + source + person (existing, higher weights)
  → + scheduleHourBoost(candidate.proposedHour)   // from schedule_hour dimension
  → + scheduleDowBoost(candidate.proposedDow)     // optional if slot known

scoreCandidate(candidate)  // unchanged shape, prefScore now material
```

### Wire points

| Hook | Change |
|---|---|
| `recordSignal(dimension, key, accepted, opts?)` | Add `opts.strength`; fractional increment; bump `lastUpdated` |
| `betaConfidence(pref, nowISO?)` | Apply read-side decay before ratio |
| `prefScore(candidate, ctx?)` | Raise multipliers; add hour/dow terms when ctx provided |
| `scoreCandidate(candidate, ctx?)` | Pass through optional slot context |
| `applyPlanActualLearning(row)` | Pure: map gap → dimension updates; called from `recordPlanActualGap` |
| `dismissMove(id)` | `recordInteraction({ action:'implicit_dismiss', ... })` — no `recordSignal` |
| `recordCommuteInteraction` | `dismissed` → weak reject, not full |
| `scheduleTaskToSlot` / `confirmPlanWindow` paths | acceptance signals → weak, not full |
| `findCommuteSuggestions` ranking | unchanged call site; benefits from stronger `prefScore` |

---

## File Structure

- **Modify `index.html`**
  - Constants: `SIGNAL_STRENGTH`, `PREF_DECAY_HALFLIFE_DAYS`, `PREF_SCORE_WEIGHTS`
  - Upgrade: `recordSignal`, `betaConfidence`, `prefScore`, `scoreCandidate`
  - Add pure: `decayBetaCounts`, `signalDelta`, `applyPlanActualLearning`, `planActualLearningKey`
  - Wire: `recordPlanActualGap`, `dismissMove`, commute + schedule acceptance call sites
- **Create tests**
  - `tests/beta-signal.test.js` — strength tiers, decay math, applyPlanActualLearning pure cases
  - `tests/beta-ranking.test.js` — scoreCandidate order flips after strong learning
- **Extend tests**
  - `tests/plan-actual-hooks.test.js` — reconcile → prefStore `schedule_hour` / kind updated
  - `tests/learning-features.test.js` — fractional signal + decay smoke
- **Modify docs**
  - `product-description.md` — link plan, mark #2 in progress when started
  - `project-description.md` §7 — Beta enhancement subsection
  - `BRAINSTORM.md` — path planning tick when done

---

## Verification Commands

Run after every task that changes code:

```powershell
node tests/beta-signal.test.js
node tests/beta-ranking.test.js
node tests/plan-actual-hooks.test.js
node tests/learning-features.test.js
node tests/agent-loop-schedule.test.js
node tests/cloud-learning-sync.test.js
```

Full suite:

```powershell
Get-ChildItem tests/*.test.js | ForEach-Object { node $_.FullName }
```

Expected after full implementation:

```text
beta-signal.test.js passed
beta-ranking.test.js passed
(... all 21+ existing tests still pass ...)
```

---

## Tasks

### Phase A — Pure signal + decay (no UI hooks)

- [x] **A1. Scaffold `tests/beta-signal.test.js`.** Export via `globalThis.__app`:

  ```javascript
  SIGNAL_STRENGTH,
  decayBetaCounts,
  signalDelta,
  applyPlanActualLearning,
  recordSignal,
  betaConfidence,
  prefStore,
  ```

- [x] **A2. `SIGNAL_STRENGTH` + `signalDelta(accepted, strength)` + test.**

  | `strength` | `accepted=true` | `accepted=false` |
  |---|---|---|
  | `weak` | +0.25 α | +0.25 β |
  | `medium` | +0.5 α | +0.5 β |
  | `strong` | +1.0 α | +1.0 β |
  | omitted | +1.0 α (backward compat) | +1.0 β |

- [x] **A3. `decayBetaCounts(pref, nowISO)` + test.** Given `alpha=11, beta=1, lastUpdated=90d ago`, effective counts ≈ halfway between prior `(1,1)` and raw `(11,1)`. Fresh `lastUpdated` → no decay.

- [x] **A4. Upgrade `betaConfidence(pref, nowISO?)` + test.** Uses `decayBetaCounts`. Inject fixed `nowISO` in tests — never bare `Date.now()` inside pure path.

- [x] **A5. Upgrade `recordSignal(dimension, key, accepted, opts?)` + test.** Applies `signalDelta`; `sampleCount += strengthWeight` (round to 2 decimals); updates `lastUpdated`.

- [x] **A6. `applyPlanActualLearning(row)` + test (write first, hard).**

  | `gap.type` | Dimensions updated | Strength |
  |---|---|---|
  | `completed_on_time` | `candidate_kind`, `schedule_hour`, `schedule_dow` | strong accept |
  | `not_completed` | same | strong reject |
  | `rescheduled` | same | strong reject |
  | `completed_late` | `schedule_hour`, `schedule_dow` | medium reject |
  | `duration_drift` | `candidate_kind` | weak reject |

  Keys from `row.features`: `kind`, `hourOfDay`, `dayOfWeek`. No-op if any required feature missing. Return `{ applied: boolean, dimensions: string[] }`.

### Phase B — Raise pref weight + ranking impact

- [x] **B1. Raise `prefScore` multipliers + test in `tests/beta-ranking.test.js`.**

  v1 targets (tune in test until flip works):

  ```javascript
  // kind: 20 → 36, person: 12 → 22, source: 8 → 14
  // schedule_hour / schedule_dow: ±10 each when ctx provided
  ```

- [x] **B2. `prefScore(candidate, ctx?)` hour/dow terms + test.** When `ctx = { hour: 13, dow: 2 }`, include `schedule_hour::13` and `schedule_dow::2` confidence deltas.

- [x] **B3. `scoreCandidate(candidate, ctx?)` pass-through + ranking test.** Scenario:

  ```text
  Two candidates: equal importance/urgency/duration.
  Candidate A kind=solo → after 3 strong accepts on solo, A ranks above B kind=call.
  Delta in scoreCandidate ≥ 12 points (material, not noise).
  ```

- [x] **B4. `findCommuteSuggestions` / time-plan ranking.** Audit call sites — pass slot hour into `scoreCandidate` where window start is known (`win.startTime`). If too invasive for v1, document skip and leave hour learning to plan_actual path only.

### Phase C — Wire signal layering + delayed reward

- [x] **C1. `recordPlanActualGap` → `applyPlanActualLearning(row)` + test.** After append, call learning; set `row.learningApplied = true` on stored row. Second reconcile attempt → no double-apply.

- [x] **C2. Acceptance paths → weak signal.** Change `scheduleTaskToSlot` tail `recordSignal` calls to `{ strength: 'weak' }`. Same for `confirmPlanWindow` / `recordPlanAcceptance` companion signals (lines ~4150, ~5316, ~7145). **Do not remove** `recordInteraction` rows.

- [x] **C3. `recordCommuteInteraction` dismissed → weak reject.** Accept/sent stay medium (`0.5`) — stronger than schedule weak because user saw alternatives.

- [x] **C4. `dismissMove(id)` → log only + test.** `recordInteraction({ action:'implicit_dismiss', context:{ moveId, detector:m.detector, subject:m.subject } })`. Assert **no** change to `prefStore` counts for involved kind/source.

- [x] **C5. Extend `tests/plan-actual-hooks.test.js`.** End-to-end:

  ```text
  scheduleTaskToSlot → weak pref bump (small)
  toggleTimelineComplete → plan_actual row
  → schedule_hour + candidate_kind strong accept
  second sync → pref unchanged (idempotent)
  ```

- [x] **C6. Extend `tests/learning-features.test.js`.** Fractional `recordSignal(..., { strength:'weak' })` increases alpha by 0.25; decay reduces effective confidence over time.

### Phase D — Docs + manual QA

- [x] **D1. Update docs.**
  - `project-description.md` §7.6 Beta enhancement (signal table + new dimensions).
  - `product-description.md` — #2 link to this plan; update maturity table when shipped.
  - `BRAINSTORM.md` — path planning: Beta 增强 ✅ when done.

- [x] **D2. Manual QA (personal mode).**
  1. Accept 3 agent-loop schedules for solo deep work in the **afternoon** → complete all on time.
  2. Supabase: `pref_store` rows for `schedule_hour::14` (or your hour) show rising `alpha`.
  3. Dismiss an agent card (×) → `interaction_log.action = 'implicit_dismiss'`, **no** new reject in `pref_store` for that task kind.
  4. Accept then never complete → after past-day scan, `plan_actual` row + `schedule_hour` beta increment.
  5. Reload → preferences persist in blob + `pref_store`.

---

## Security & Data Notes

- `schedule_hour` / `schedule_dow` reveal routine patterns — same sensitivity as existing prefs. RLS unchanged.
- Float alpha/beta sync to `pref_store` as `numeric` / `real` — verify Supabase column types accept decimals (likely `integer` today → may need `alter column` or round on cloud upsert). **Check `cloudUpsertPreference` before Phase C.**
- Demo mode skips cloud writes — local-only learning still works.

---

## Non-Goals (this plan)

- Thompson Sampling / exploration in sort order
- Tier-2 pattern discovery ("lunch blocks always fail")
- Offline backtest scaffold (Track A #3 — separate plan)
- Settings → "Agent 眼中的你" preference UI
- Cold-start crowd priors for all dimensions (optional follow-up: transit modes only)
- Changing LLM curation prompts
- Using gap data to auto-hide detectors

---

## Follow-Up Plans (after this ships)

| Next | Depends on |
|---|---|
| Offline backtest scaffold | weighted prefs + `plan_actual` rows |
| Analytics「下午 deep work 完成率」| `planActualLog` aggregates |
| Tier-2 pattern discovery | backtest metrics |
| Crowd priors for transit | `transit_work` dimension |

---

## Suggested First Session (2–4h)

1. **A2–A6** — failing pure tests + `applyPlanActualLearning` (45 min).
2. **B1–B3** — pref weight + ranking flip test (45 min).
3. **C1–C5** — wire hooks + integration (60 min).
4. **D1–D2** — docs + Supabase QA (30 min).

Stop if time runs out after Phase A — pure functions + tests still unblock Track A #3 backtest design.
