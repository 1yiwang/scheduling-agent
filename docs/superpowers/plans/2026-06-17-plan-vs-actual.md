# Plan vs Actual Tracker (Learning Flywheel · Track A #1)

> **For agentic workers:** Implement task-by-task with TDD. Steps use checkbox (`- [ ]`) syntax for tracking. Tests are Node `vm`-based in `tests/*.test.js`. Run the full suite after each task.

**Status:** 🚧 Phase A–C implemented + tested. Phase D (docs + manual QA) pending.

**Goal:** Record the gap between what the agent **planned** (scheduled a block) and what **actually happened** (completed, rescheduled, skipped, ran long/short). This is the highest-information-density learning signal in the product — it upgrades learning from「用户点了什么」to「用户后来到底做没做」.

**Locked decisions (from `BRAINSTORM.md` §八 + path planning 2026-06-10):**
- **Track agent-scheduled events first.** v1 only stamps events created by `scheduleTaskToSlot`, `confirmDeskPlanWindow`, or `moveEventToSlot` when fixing an agent move. Manual `addTodayEvent` / `addEventToDay` are out of scope for v1 (no `planMeta` → no reconciliation).
- **Reconcile once per event.** When a past agent-scheduled event reaches a terminal state, emit **one** `planActualLog` row. Idempotent: same `eventId` never double-writes.
- **Pure classifier first.** All gap logic lives in testable pure functions before wiring DOM hooks.
- **Storage: in-memory `planActualLog[]` + blob**, dual-write best-effort to `interaction_log` with `action: 'plan_actual'`. **No new Supabase table in v1** — reuse append-only `interaction_log.context` JSONB (feeds future backtest scaffold in Track A #3).
- **Observe only in v1.** Do **not** yet change sorting (`prefScore`, `scoreCandidate`, detectors). Tier-2 / Beta-enhancement plan consumes this data next.

---

## Architecture

```
Agent schedules (scheduleTaskToSlot / confirmDeskPlanWindow)
  → stampPlanMeta(ev, { surface, sourceTaskId, plannedMins, ... })
  → event carries planMeta.planned snapshot

User acts later
  → moveEventToSlot        → planMeta.wasRescheduled = true, planMeta.rescheduleCount++
  → toggleTimelineComplete → reconcilePlanActual(eventId)
  → markComplete           → reconcilePlanActual(eventId)
  → syncAllViews           → reconcilePastAgentEvents()  // scan ended blocks without a log row

reconcilePlanActual(eventId)
  → read event + completionDB + planMeta + now
  → gap = classifyPlanActualGap(planned, actualState)   // pure
  → if terminal → recordPlanActualGap({ eventId, planned, actual, gap })  // append-once
       → planActualLog.push(row)
       → saveLearningState() + cloudInsertInteraction({ action:'plan_actual', context: row })
```

### Gap types (v1)

| `gap.type` | When |
|---|---|
| `completed_on_time` | Marked done; ended on planned day; duration within planned ±15min tolerance |
| `completed_late` | Marked done on a day after planned day |
| `not_completed` | Planned day passed; never marked done (or explicitly `not done`) |
| `rescheduled` | `moveEventToSlot` moved to different day/time before terminal state |
| `duration_drift` | Marked done same day but observed duration differs from planned by >25% |

Priority when multiple apply: `rescheduled` wins if cross-day move happened; else completion state; else `duration_drift` as additive flag on `features`.

### `planActualLog` row shape

```js
{
  eventId: 'plan-pendingTask-p1-1718...',
  ts: '2026-06-17T18:00:00.000Z',          // reconciliation time
  planned: {
    dateISO: '2026-06-10',
    startTime: '13:00',
    endTime: '15:00',
    plannedMinutes: 120,
    kind: 'solo',
    type: 'deep',
    title: 'SLTA newsletter',
    surface: 'agent_loop',                 // agent_loop | desk_plan | agent_move
    sourceTaskId: 'pendingTask:p1'
  },
  actual: {
    completed: false,
    completedDateISO: null,
    actualMinutes: null,
    wasRescheduled: true,
    finalDateISO: '2026-06-11',
    finalStartTime: '09:00'
  },
  gap: {
    type: 'rescheduled',                   // see table above
    severity: 'medium'                     // low | medium | high
  },
  features: {                              // for future ML / backtest
    hourOfDay: 13,
    dayOfWeek: 2,
    kind: 'solo',
    type: 'deep',
    importance: null,
    plannedMinutes: 120,
    actualMinutes: null,
    deltaMinutes: null
  },
  label: 0                                 // 1 = plan matched reality; 0 = mismatch
}
```

### `planMeta` on event (runtime only, small)

```js
ev.planMeta = {
  surface: 'agent_loop',
  plannedAt: '2026-06-10T11:00:00.000Z',
  plannedDateISO: '2026-06-10',
  plannedStart: '13:00',
  plannedEnd: '15:00',
  plannedMinutes: 120,
  wasRescheduled: false,
  rescheduleCount: 0,
  reconciled: false                        // set true after log row emitted
};
```

---

## File Structure

- **Modify `index.html`**
  - Add pure helpers: `buildPlannedSnapshot`, `classifyPlanActualGap`, `deriveGapSeverity`, `buildPlanActualFeatures`, `recordPlanActualGap`, `stampPlanMeta`, `reconcilePlanActual`, `reconcilePastAgentEvents`.
  - Stamp in `scheduleTaskToSlot`, `confirmDeskPlanWindow` (each created event).
  - Update `moveEventToSlot` to flip `planMeta.wasRescheduled` when `planMeta` exists.
  - Call `reconcilePlanActual` from `markComplete`, `toggleTimelineComplete` (when marking done/not done on past events).
  - Call `reconcilePastAgentEvents()` at end of `syncAllViews()` (cheap scan: only events with `planMeta && !planMeta.reconciled` whose planned end is in the past).
  - Persist: add `planActualLog` to `loadLearningState` / `saveLearningState` / `snapshotCloud().learning`.
  - Cloud: extend `cloudInsertInteraction` path via `recordPlanActualGap` → `{ action:'plan_actual', context: row, features: row.features, label: row.label }`.
- **Create tests**
  - `tests/plan-actual.test.js` — pure classifier + idempotency + severity (most important; write first).
  - `tests/plan-actual-hooks.test.js` — integration: schedule → move → complete → one log row.
- **Modify docs**
  - `product-description.md` — mark Plan vs Actual in progress / done when shipped.
  - `project-description.md` §7 / §8 — add Plan vs Actual subsection.
  - `BRAINSTORM.md` path planning — tick item when done.

---

## Verification Commands

Run after every task that changes code:

```powershell
node tests/plan-actual.test.js
node tests/plan-actual-hooks.test.js
node tests/agent-loop-schedule.test.js
node tests/inbox-plan.test.js
node tests/learning-features.test.js
node tests/timeline-complete.test.js
node tests/persistence.test.js
node tests/cloud-learning-sync.test.js
```

Quick full suite (19 existing + 2 new):

```powershell
Get-ChildItem tests/*.test.js | ForEach-Object { node $_.FullName }
```

Expected after full implementation:

```text
plan-actual.test.js passed
plan-actual-hooks.test.js passed
(... all existing tests still pass ...)
```

---

## Tasks

### Phase A — Pure classifier (no UI, no persistence)

- [x] **A1. Scaffold `tests/plan-actual.test.js` + expose helpers.** Load `index.html` via `vm` like `tests/learning-features.test.js`. Export via `globalThis.__app`:

  ```javascript
  buildPlannedSnapshot,
  classifyPlanActualGap,
  deriveGapSeverity,
  buildPlanActualFeatures,
  planActualLog,
  ```

- [x] **A2. `buildPlannedSnapshot(event, meta)` + test.** Given an event + `{ surface }`, return the `planned` sub-object. Test: preserves kind/type/title/minutes/date from event fields.

- [x] **A3. `classifyPlanActualGap(planned, actualState)` + test (write first, hard).** Cases to cover:

  | Case | Input | Expected `gap.type` |
  |---|---|---|
  | Done same day, on time | completed=true, same date, duration ≈ planned | `completed_on_time`, label=1 |
  | Done next day | completed=true, completedDate > plannedDate | `completed_late` |
  | Never done, day passed | completed=false, now > planned end | `not_completed` |
  | Moved cross-day | wasRescheduled=true, finalDate ≠ plannedDate | `rescheduled` |
  | Done but 2× duration | completed, actualMinutes >> planned | `duration_drift` or flag on features |

  Use fixed `now` in tests (inject as parameter — do not call `Date.now()` inside classifier).

- [x] **A4. `deriveGapSeverity(gapType, event)` + test.** Rules v1:
  - `not_completed` + agent-scheduled deep work → `high`
  - `rescheduled` → `medium`
  - `completed_late` → `medium`
  - `completed_on_time` → `low`
  - `duration_drift` alone → `low`

- [x] **A5. `buildPlanActualFeatures(planned, actual, gap)` + test.** Emits stable numeric fields for analytics/backtest (`hourOfDay`, `dayOfWeek`, `plannedMinutes`, `actualMinutes`, `deltaMinutes`, `label`).

### Phase B — Event stamping (agent paths only)

- [x] **B1. `stampPlanMeta(ev, meta)` + test via hooks file.** Sets `planMeta` on event object. Idempotent: second stamp ignored.

- [x] **B2. Wire `scheduleTaskToSlot`.** After pushing `ev`, call `stampPlanMeta(ev, { surface:'agent_loop', sourceTaskId: ev.sourceTaskId })`. Extend `tests/agent-loop-schedule.test.js`: scheduled event has `planMeta.surface === 'agent_loop'`.

- [x] **B3. Wire `confirmDeskPlanWindow`.** After each created event, `stampPlanMeta(event, { surface:'desk_plan', sourceTaskId: event.sourceTaskId })`. Extend `tests/inbox-plan.test.js` similarly.

- [x] **B4. Wire `moveEventToSlot`.** If `ev.planMeta` exists: set `wasRescheduled=true`, increment `rescheduleCount`, update `planMeta.finalDateISO/finalStart`. Do **not** reconcile yet unless event is also terminal.

### Phase C — Reconciliation + append-once log

- [x] **C1. `planActualLog = []` + load/save.** Mirror `interactionLog` pattern:
  - Initialize near `interactionLog`.
  - `loadLearningState` / `saveLearningState` read/write `planActualLog`.
  - `snapshotCloud().learning.planActualLog` included; bump comment to note schema v2 sibling field (no migration needed — missing field → `[]`).

- [x] **C2. `recordPlanActualGap(row)` + test.** Append to `planActualLog` only if no existing row with same `eventId`. Call `saveLearningState()`. Best-effort `recordInteraction({ action:'plan_actual', context: row, features: row.features, label: row.label })`.

- [x] **C3. `reconcilePlanActual(eventId, now)` + test.** Lookup event; if no `planMeta` or `planMeta.reconciled` → no-op. Build actual state from `completionDB`, current event slot, `planMeta`. Classify gap; if **terminal** (past end + (completed | explicit not done | rescheduled cross-day)) → `recordPlanActualGap`, set `planMeta.reconciled=true`.

  Terminal rules v1:
  - Marked done (any day) → terminal
  - Marked not done → terminal
  - Planned end passed + still unmarked → terminal as `not_completed` at first past-day scan
  - Rescheduled but new slot still in future → not terminal yet

- [x] **C4. `reconcilePastAgentEvents(now)` + test.** Iterate `eventsDB` for events with `planMeta && !reconciled` whose planned window ended before `now`. Call `reconcilePlanActual` for each. Test: two past unmarked events → two log rows.

- [x] **C5. Wire hooks.**
  - `markComplete` / `toggleTimelineComplete` → `reconcilePlanActual(eventId)` after state change.
  - End of `syncAllViews()` → `reconcilePastAgentEvents()` (guard with cheap early exit if no candidates).

- [x] **C6. Extend `tests/plan-actual-hooks.test.js`.** End-to-end vm scenario:

  ```text
  scheduleTaskToSlot → event has planMeta
  moveEventToSlot (next day) → wasRescheduled
  toggleTimelineComplete (done) → exactly 1 planActualLog row, gap.type rescheduled or completed_late
  second sync → still 1 row (idempotent)
  ```

### Phase D — Cloud dual-write + docs

- [ ] **D1. Cloud path test.** Extend `tests/cloud-learning-sync.test.js` or hooks test with fake Supabase: `recordPlanActualGap` triggers `interaction_log` insert with `action:'plan_actual'`.

- [ ] **D2. Update docs.**
  - `project-description.md` §7 — new §7.5 Plan vs Actual.
  - `product-description.md` — move item #1 to ✅ when shipped.
  - `BRAINSTORM.md` — note under path planning「Plan vs Actual ✅」.

- [ ] **D3. Manual QA (personal mode).**
  1. Agent Loop accept a deadline-risk slot → check event has `planMeta` in memory (devtools).
  2. Mark done → Supabase `interaction_log` has `plan_actual` row.
  3. Reload page → `planActualLog` restored from blob.
  4. Full test suite green; commit; push.

---

## Security & Data Notes

- `planActualLog` contains titles and schedule patterns — same sensitivity as `interaction_log`. RLS already scopes per user.
- Rows are append-only; no user PII beyond what events already store.
- Do not sync `planActualLog` into demo mode writes (`appMode !== 'live'` skips cloud, same as today).

## Non-Goals (this plan)

- Changing detector ranking or `prefScore` weights from gap data (Track A #2 Beta enhancement).
- Offline backtest UI (Track A #3).
- Analytics card for completion rate by hour/kind (nice follow-up, not blocking).
- New Supabase table `plan_actual_log` (defer until row volume or query patterns justify it).
- Tracking manually created events or external-calendar imports (stage 2).
- `userNote` capture for why a block failed (UI affordance — later).

## Follow-Up Plans (after this ships)

| Next | Depends on |
|---|---|
| Beta 增强 + 用 gap 特征调权重 | `planActualLog` + `features` |
| 离线回测脚手架 | `interaction_log` rows with `action:'plan_actual'` |
| Analytics「下午 deep work 完成率」卡 | `aggregatePlanActualTrends(planActualLog)` |

---

## Suggested First Session (2–3h)

1. **A3** — write failing classifier tests (30 min).
2. **A2, A4, A5** — implement pure functions until green (45 min).
3. **B1–B4** — stamp agent paths (30 min).
4. **C1–C5** — reconcile + hooks (45 min).
5. **C6, D1–D3** — integration test + cloud + QA (30 min).

Stop if time runs out after Phase A — merged pure functions still unblock Beta/backtest design work.
