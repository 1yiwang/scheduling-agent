# Learning Data Debt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the highest-impact learning-data bugs before Phase C so the agent records clean interaction signals from the real user paths.

**Architecture:** Keep Phase 1 storage (`app_state.data` JSON blob) for now, but make all learning events use one normalized in-memory log shape. Fix the silent scheduling paths first, then document the path to Phase C tables (`interaction_log`, `pref_store`, `duration_observations`) with clean data available for migration.

**Tech Stack:** Plain `index.html` JavaScript, Node `vm`-based tests in `tests/*.test.js`, Supabase Phase 1 blob persistence.

---

## Scope And Non-Goals

This plan fixes debts #2, #3, #4, #6, #7, and #11 from `BRAINSTORM.md` first:

- #2 Desk Plan confirm path does not log interaction signal.
- #3 Agent Loop `scheduleTaskToSlot` does not log interaction signal.
- #4 `prefScore` fallback key mismatch.
- #6 `confirmDeskPlanWindow` does not set `sourceTaskId`.
- #7 `interactionLog` schema is inconsistent.
- #11 scheduled event `type` loses original task kind.

This plan intentionally does **not** implement Phase C tables yet. Reason: storage normalization should happen after the app records the right signals. Otherwise the new tables will faithfully store incomplete or inconsistent data.

---

## File Structure

- Modify: `index.html`
  - Add a small helper family for normalized interaction logging.
  - Fix source fallback in `prefScore`.
  - Fix `confirmDeskPlanWindow` and `scheduleTaskToSlot` to set `sourceTaskId`, preserve type, and record interactions.
- Modify/Create tests:
  - Modify: `tests/learning-features.test.js` for `prefScore` fallback and normalized interaction schema helpers.
  - Modify: `tests/inbox-plan.test.js` for Inbox/Desk scheduling learning logs and `sourceTaskId`.
  - Create: `tests/agent-loop-schedule.test.js` for `scheduleTaskToSlot` behavior.
- Modify docs:
  - Modify: `project-description.md` to record that learning-path debt #2/#3/#4/#6/#7/#11 is fixed.
  - Optionally update the review table in `BRAINSTORM.md` by adding a short “resolution status” note, but do not rewrite the original review.

---

## Verification Commands

Run these after every task that changes code:

```powershell
node tests/learning-features.test.js
node tests/inbox-plan.test.js
node tests/agent-loop-schedule.test.js
node tests/persistence.test.js
node tests/timeline-complete.test.js
```

Expected after the relevant implementation step:

```text
learning-features.test.js passed
inbox-plan.test.js passed
agent-loop-schedule.test.js passed
persistence.test.js passed
timeline-complete.test.js passed
```

Also run lints in Cursor with `ReadLints` for:

- `index.html`
- changed test files
- `project-description.md`

---

## Task 1: Add Regression Tests For Learning Source Fallback (#4)

**Files:**
- Modify: `tests/learning-features.test.js`
- Modify: `index.html`

- [ ] **Step 1: Expose the functions needed by the test**

In `tests/learning-features.test.js`, extend `globalThis.__app`:

```javascript
globalThis.__app = {
  recordObservedDuration: typeof recordObservedDuration === 'function' ? recordObservedDuration : undefined,
  predictDurationMinutes: typeof predictDurationMinutes === 'function' ? predictDurationMinutes : undefined,
  buildFeatureVector: typeof buildFeatureVector === 'function' ? buildFeatureVector : undefined,
  recordSignal: typeof recordSignal === 'function' ? recordSignal : undefined,
  prefScore: typeof prefScore === 'function' ? prefScore : undefined,
  prefStore,
  parseEstMinutes,
};
```

- [ ] **Step 2: Add the failing test**

Append to `tests/learning-features.test.js`:

```javascript
assert.strictEqual(typeof app.recordSignal, 'function', 'recordSignal should exist');
assert.strictEqual(typeof app.prefScore, 'function', 'prefScore should exist');

const beforeSourceScore = app.prefScore({ kind: 'solo', source: undefined, involves: null });
app.recordSignal('candidate_source', 'pendingTask', true);
const afterSourceScore = app.prefScore({ kind: 'solo', source: undefined, involves: null });
assert(
  afterSourceScore > beforeSourceScore,
  'prefScore should read the same pendingTask fallback key that recordSignal writes'
);
```

- [ ] **Step 3: Verify RED**

Run:

```powershell
node tests/learning-features.test.js
```

Expected before implementation: FAIL on `prefScore should read the same pendingTask fallback key...`.

- [ ] **Step 4: Implement minimal fix**

In `index.html`, change:

```javascript
const sourcePref = betaConfidence(getPreference('candidate_source', candidate.source || 'task'));
```

to:

```javascript
const sourcePref = betaConfidence(getPreference('candidate_source', candidate.source || 'pendingTask'));
```

- [ ] **Step 5: Verify GREEN**

Run:

```powershell
node tests/learning-features.test.js
```

Expected: `learning-features.test.js passed`.

---

## Task 2: Normalize Interaction Log Shape (#7)

**Files:**
- Modify: `index.html`
- Modify: `tests/learning-features.test.js`

- [ ] **Step 1: Add desired helper tests**

Expose helpers in `tests/learning-features.test.js` after they are added:

```javascript
normalizeInteractionAction: typeof normalizeInteractionAction === 'function' ? normalizeInteractionAction : undefined,
recordInteraction: typeof recordInteraction === 'function' ? recordInteraction : undefined,
interactionLog,
```

Add assertions:

```javascript
assert.strictEqual(app.normalizeInteractionAction('conflict_override'), 'conflict_override');
assert.strictEqual(app.normalizeInteractionAction('accepted'), 'accepted');

app.recordInteraction({
  action: 'accepted',
  context: { surface: 'test' },
  candidate: { id: 'x1', kind: 'call', source: 'pendingTask', involves: 'Lukas', estTime: '~30m' },
  label: 1,
});

const row = app.interactionLog[app.interactionLog.length - 1];
assert.ok(row.ts, 'normalized interaction has timestamp');
assert.strictEqual(row.action, 'accepted', 'normalized interaction has action');
assert.strictEqual(row.type, 'accepted', 'normalized interaction keeps type alias for older readers');
assert.deepStrictEqual(row.context, { surface: 'test' }, 'normalized interaction keeps context');
assert.strictEqual(row.candidateId, 'x1', 'normalized interaction has candidateId');
assert.strictEqual(row.kind, 'call', 'normalized interaction has kind');
assert.strictEqual(row.source, 'pendingTask', 'normalized interaction has source');
assert.strictEqual(row.involves, 'Lukas', 'normalized interaction has involves');
assert.strictEqual(row.label, 1, 'normalized interaction has label');
assert.ok(row.features && typeof row.features === 'object', 'normalized interaction has feature vector');
```

- [ ] **Step 2: Verify RED**

Run:

```powershell
node tests/learning-features.test.js
```

Expected before implementation: FAIL because `recordInteraction` / `normalizeInteractionAction` are undefined.

- [ ] **Step 3: Implement helpers**

Add near the learning section in `index.html`, before `recordCommuteInteraction`:

```javascript
function normalizeInteractionAction(action) {
 return action || 'unknown';
}

function recordInteraction(opts) {
 opts = opts || {};
 const candidate = opts.candidate || {};
 const context = opts.context || {};
 const featureWindow = opts.featureWindow || {
  route: context.route || null,
  mode: context.mode || null,
  windowMinutes: context.minutes || context.windowMinutes || null,
  startHour: context.startHour || null
 };
 const action = normalizeInteractionAction(opts.action);
 interactionLog.push({
  ts: opts.ts || new Date().toISOString(),
  action: action,
  type: action,
  context: context,
  top3: opts.top3 || [],
  chosenIdx: Number.isInteger(opts.chosenIdx) ? opts.chosenIdx : null,
  candidateId: candidate.id || opts.candidateId || null,
  kind: candidate.kind || opts.kind || null,
  source: candidate.source || opts.source || 'pendingTask',
  involves: candidate.involves || opts.involves || null,
  draftGenerated: !!opts.draftGenerated,
  draftSent: !!opts.draftSent,
  features: opts.features || (candidate.kind ? buildFeatureVector(candidate, featureWindow) : null),
  label: Object.prototype.hasOwnProperty.call(opts, 'label') ? opts.label : null
 });
 saveLearningState();
}
```

- [ ] **Step 4: Refactor existing direct interaction writes**

In `recordCommuteInteraction`, replace direct `interactionLog.push({...})` with:

```javascript
recordInteraction({
 action: action,
 context: {
  surface: 'commute',
  windowId: cs.window.id,
  route: cs.window.loc,
  mode: cs.window.transitMode,
  minutes: windowMinutes(cs.window)
 },
 top3: (cs.options || []).map(o => ({ id:o.id, kind:o.kind, source:o.source, involves:o.involves || null })),
 chosenIdx: selectedCommuteOptionIdx,
 candidate: candidate,
 draftGenerated: action === 'drafted',
 draftSent: action === 'sent',
 featureWindow: {
  route: cs.window.loc,
  mode: cs.window.transitMode,
  windowMinutes: windowMinutes(cs.window),
  startHour: cs.window.startTime ? parseInt(cs.window.startTime.split(':')[0]) : null
 },
 label: (action === 'accepted' || action === 'sent') ? 1 : (action === 'dismissed' ? 0 : null)
});
```

Remove the trailing `saveLearningState()` from `recordCommuteInteraction` because `recordInteraction` already saves.

In `recordConflictOverride`, replace direct push with:

```javascript
recordInteraction({
 action: 'conflict_override',
 context: { surface: 'conflict', conflictKind: c.kind, mode: c.mode || null },
 kind: c.kind,
 source: 'conflict',
 involves: null,
 label: 1
});
```

- [ ] **Step 5: Verify GREEN**

Run:

```powershell
node tests/learning-features.test.js
node tests/timeline-complete.test.js
```

Expected: both pass.

---

## Task 3: Preserve Task Identity And Type In Desk Planning (#6, #11)

**Files:**
- Modify: `index.html`
- Modify: `tests/inbox-plan.test.js`

- [ ] **Step 1: Add failing assertions to Inbox planning test**

In `tests/inbox-plan.test.js`, after planning `p4`, replace the loose scheduled check with a captured event:

```javascript
const scheduledEvent = (app.eventsDB['2026-6'][6] || []).find(event => event.title === 'Reply to Anna');
const commuteEvent = Object.values(app.eventsDB['2026-6']).flat().find(event =>
  event.commuteTasks && event.commuteTasks.some(task => task.title === 'Reply to Anna')
);
assert(scheduledEvent || commuteEvent, 'scheduled task should appear on calendar or inside a commute window');

if (scheduledEvent) {
  assert.strictEqual(scheduledEvent.sourceTaskId, 'pendingTask:p4', 'desk-planned event keeps sourceTaskId');
  assert.strictEqual(scheduledEvent.kind, 'call', 'desk-planned event keeps original kind');
  assert.strictEqual(scheduledEvent.type, 'online', 'call task is typed as online for analytics');
}
```

- [ ] **Step 2: Add one non-call type fixture test**

Append:

```javascript
app.pendingTasksDB.push({
  id: 'social-test',
  title: 'Coffee follow-up',
  estTime: '~30m',
  kind: 'social',
  involves: 'Marie',
  deadline: 'Jun 6',
  importance: 2,
  urgency: 2,
});

const socialCandidate = app.buildCandidatePool().find(c => c.id === 'social-test');
const socialWindow = app.getPlanWindows().find(w => app.planCandidateFitsWindow(socialCandidate, w, w.minutes));
assert(socialWindow, 'expected an available window for social-test');
app.confirmInboxPlanToWindow('pendingTask', 'social-test', socialWindow.id);

const socialEvent = (app.eventsDB['2026-6'][6] || []).find(event => event.title === 'Coffee follow-up');
if (socialEvent) {
  assert.strictEqual(socialEvent.sourceTaskId, 'pendingTask:social-test', 'social event keeps sourceTaskId');
  assert.strictEqual(socialEvent.kind, 'social', 'social event keeps original kind');
  assert.strictEqual(socialEvent.type, 'social', 'social kind maps to social event type');
}
```

- [ ] **Step 3: Verify RED**

Run:

```powershell
node tests/inbox-plan.test.js
```

Expected before implementation: FAIL on missing `sourceTaskId` or wrong type for social desk-planned event.

- [ ] **Step 4: Implement a task-kind mapping helper**

Add in `index.html` near scheduling helpers:

```javascript
function eventTypeForTaskKind(kind) {
 if (kind === 'call' || kind === 'video') return 'online';
 if (kind === 'social') return 'social';
 if (kind === 'meeting') return 'busy';
 if (kind === 'transit') return 'transit';
 return 'deep';
}
```

- [ ] **Step 5: Use helper in `confirmDeskPlanWindow`**

Inside `items.forEach`, compute:

```javascript
const eventType = eventTypeForTaskKind(item.kind);
```

Then set:

```javascript
id: evIdNew,
sourceTaskId: item.source && item.id ? item.source + ':' + item.id : null,
t: eventType,
type: eventType,
kind: item.kind,
```

- [ ] **Step 6: Use helper in `scheduleTaskToSlot`**

Replace:

```javascript
const isOnline = kind === 'call' || kind === 'video';
```

with:

```javascript
const eventType = eventTypeForTaskKind(kind);
const isOnline = eventType === 'online';
```

Then set:

```javascript
t: eventType,
type: eventType,
```

- [ ] **Step 7: Verify GREEN**

Run:

```powershell
node tests/inbox-plan.test.js
```

Expected: `inbox-plan.test.js passed`.

---

## Task 4: Log Desk Plan Acceptances (#2)

**Files:**
- Modify: `index.html`
- Modify: `tests/inbox-plan.test.js`

- [ ] **Step 1: Expose `interactionLog` in Inbox test**

In `tests/inbox-plan.test.js`, extend `globalThis.__app`:

```javascript
interactionLog,
```

- [ ] **Step 2: Add failing assertions**

After `app.confirmInboxPlanToWindow('pendingTask', 'p4', window.id);`:

```javascript
const deskLog = app.interactionLog.find(row =>
  row.action === 'accepted' &&
  row.context &&
  row.context.surface === 'desk_plan' &&
  row.candidateId === 'p4'
);
assert(deskLog, 'desk plan acceptance should write a normalized interaction row');
assert.strictEqual(deskLog.source, 'pendingTask', 'desk plan log keeps source');
assert.strictEqual(deskLog.label, 1, 'desk plan acceptance has positive label');
assert.ok(deskLog.features && typeof deskLog.features === 'object', 'desk plan log includes features');
```

- [ ] **Step 3: Verify RED**

Run:

```powershell
node tests/inbox-plan.test.js
```

Expected before implementation: FAIL on missing desk plan log.

- [ ] **Step 4: Add helper to log scheduled plan items**

Add to `index.html` near `confirmDeskPlanWindow`:

```javascript
function recordPlanAcceptance(win, item, surface) {
 if (!item) return;
 recordInteraction({
  action: 'accepted',
  context: {
   surface: surface || 'desk_plan',
   windowId: win && win.id ? win.id : null,
   route: win && win.loc ? win.loc : null,
   mode: win && win.transitMode ? win.transitMode : null,
   minutes: item.estMinutes || null,
   startHour: win && win.startTime ? parseInt(win.startTime.split(':')[0], 10) : null
  },
  candidate: item,
  featureWindow: {
   route: win && win.loc ? win.loc : null,
   mode: win && win.transitMode ? win.transitMode : null,
   windowMinutes: item.estMinutes || null,
   startHour: win && win.startTime ? parseInt(win.startTime.split(':')[0], 10) : null
  },
  label: 1
 });
}
```

- [ ] **Step 5: Call it from `confirmDeskPlanWindow`**

After creating each event:

```javascript
recordPlanAcceptance(win, item, 'desk_plan');
```

- [ ] **Step 6: Avoid duplicate signal writes**

Keep existing `recordSignal` calls in `confirmInboxPlanToWindow` / `confirmPlanWindow` for now unless they demonstrably double-count. `recordInteraction` records the event row; `recordSignal` updates current Beta cache. If double-counting appears in tests, move `recordSignal` into `recordPlanAcceptance` once and remove duplicated caller writes.

- [ ] **Step 7: Verify GREEN**

Run:

```powershell
node tests/inbox-plan.test.js
node tests/learning-features.test.js
```

Expected: both pass.

---

## Task 5: Log Agent Loop Scheduling (#3)

**Files:**
- Create: `tests/agent-loop-schedule.test.js`
- Modify: `index.html`

- [ ] **Step 1: Create the failing test**

Create `tests/agent-loop-schedule.test.js`:

```javascript
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
  scheduleTaskToSlot,
  pendingTasksDB,
  eventsDB,
  interactionLog,
};`, context);

const app = context.__app;
assert.strictEqual(typeof app.scheduleTaskToSlot, 'function', 'scheduleTaskToSlot should exist');

app.pendingTasksDB.push({
  id: 'loop-social',
  title: 'Plan founder coffee',
  estTime: '~30m',
  kind: 'social',
  involves: 'Marie',
  deadline: 'Jun 8',
  importance: 3,
  urgency: 3,
});

app.scheduleTaskToSlot('pendingTask', 'loop-social', 2026, 6, 7, 10 * 60, 30);

const ev = (app.eventsDB['2026-6'][7] || []).find(e => e.sourceTaskId === 'pendingTask:loop-social');
assert(ev, 'agent-loop scheduled task should create a calendar event');
assert.strictEqual(ev.type, 'social', 'agent-loop event should preserve social type');
assert.strictEqual(ev.kind, 'social', 'agent-loop event should preserve kind');

const log = app.interactionLog.find(row =>
  row.action === 'accepted' &&
  row.context &&
  row.context.surface === 'agent_loop' &&
  row.candidateId === 'loop-social'
);
assert(log, 'agent-loop scheduling should write a normalized interaction row');
assert.strictEqual(log.label, 1, 'agent-loop acceptance has positive label');
assert.ok(log.features && typeof log.features === 'object', 'agent-loop log includes features');

console.log('agent-loop-schedule.test.js passed');
```

- [ ] **Step 2: Verify RED**

Run:

```powershell
node tests/agent-loop-schedule.test.js
```

Expected before implementation: FAIL on missing interaction log and/or wrong event type.

- [ ] **Step 3: Implement log call in `scheduleTaskToSlot`**

After `runtimeEvents[evId] = ev;`, add:

```javascript
recordPlanAcceptance({
 id: 'agent-loop-' + source + '-' + id,
 startTime: minutesToHHMM(start),
 loc: 'Agent Loop',
 transitMode: null
}, {
 id: id,
 title: title,
 estTime: formatPlanMinutes(mins),
 estMinutes: mins,
 kind: kind,
 source: source,
 involves: involves,
 reason: it ? it.reason : ''
}, 'agent_loop');
```

- [ ] **Step 4: Verify GREEN**

Run:

```powershell
node tests/agent-loop-schedule.test.js
```

Expected: `agent-loop-schedule.test.js passed`.

---

## Task 6: Add Phase C Schema Draft To Supabase Schema Without Applying It Yet

**Files:**
- Modify: `supabase-schema.sql`
- Modify: `project-description.md`

- [ ] **Step 1: Add commented Phase C schema block**

Append to `supabase-schema.sql` as comments only, so current production schema remains unchanged:

```sql
-- Phase C target schema (not applied yet):
-- create table public.pref_store (...);
-- create table public.interaction_log (...);
-- create table public.duration_observations (...);
```

Use the concrete schema from `BRAINSTORM.md` lines 1078-1114.

- [ ] **Step 2: Update `project-description.md`**

In §2.5, replace the compact `interactions (id pk...)` sketch with the detailed Phase C split:

- `pref_store`
- `interaction_log`
- `duration_observations`
- later `events/tasks/friends/profile`

State explicitly: implementation will be done after learning signals are clean.

- [ ] **Step 3: Verify documentation only**

Run:

```powershell
node tests/persistence.test.js
```

Expected: `persistence.test.js passed`. Since only comments/docs changed, behavior must be unchanged.

---

## Task 7: Full Regression Verification

**Files:**
- All changed files

- [ ] **Step 1: Run all tests**

```powershell
node tests/learning-features.test.js
node tests/inbox-plan.test.js
node tests/agent-loop-schedule.test.js
node tests/persistence.test.js
node tests/timeline-complete.test.js
```

Expected:

```text
learning-features.test.js passed
inbox-plan.test.js passed
agent-loop-schedule.test.js passed
persistence.test.js passed
timeline-complete.test.js passed
```

- [ ] **Step 2: Run Cursor lints**

Use `ReadLints` on:

- `index.html`
- `tests/learning-features.test.js`
- `tests/inbox-plan.test.js`
- `tests/agent-loop-schedule.test.js`
- `project-description.md`
- `supabase-schema.sql`

Expected: no new linter errors.

- [ ] **Step 3: Manual smoke test in browser**

In local or deployed demo:

1. Open Tasks view.
2. Plan an existing Inbox task into a desk window.
3. Verify it stays on the current page.
4. Verify the task disappears from Inbox.
5. Verify the event appears in the correct day timeline.
6. Verify Agent Suggestions does not show the same deadline-risk task again.
7. Trigger Find New Time / conflict override once.
8. Verify Analytics still renders.

- [ ] **Step 4: Inspect persisted blob shape**

In browser console after a few interactions:

```javascript
JSON.parse(localStorage.getItem('schedulingAgentLearning.v1')).interactionLog.slice(-3)
```

Expected rows share the normalized fields:

```javascript
{
  ts,
  action,
  type,
  context,
  top3,
  chosenIdx,
  candidateId,
  kind,
  source,
  involves,
  draftGenerated,
  draftSent,
  features,
  label
}
```

---

## Task 8: Commit Strategy

Commit in small slices:

1. `fix: align learning source preference fallback`
2. `feat: normalize interaction logging`
3. `fix: preserve source task ids in planning`
4. `feat: log desk and agent-loop scheduling interactions`
5. `docs: detail phase c learning storage schema`

Before each commit, run the tests relevant to that slice plus `node tests/persistence.test.js`.

---

## Risk Register

- **Risk: duplicate Beta increments.** `recordInteraction` logs rows; `recordSignal` updates cache. Do not automatically call `recordSignal` inside `recordInteraction` unless all caller-level `recordSignal` calls are removed or tests prove no double-count.
- **Risk: current tests execute the whole `<script>` via `vm`.** New helpers must not rely on real DOM APIs, Supabase network calls, or browser-only APIs beyond the existing test stubs.
- **Risk: event type taxonomy is mixed (`kind` vs `type`).** `kind` should preserve user/task semantics; `type` should be the analytics bucket. `eventTypeForTaskKind` is the single mapping boundary.
- **Risk: Phase C too early.** Do not create live Supabase tables in this plan. Add schema draft/comments and docs only unless explicitly approved.

---

## Self-Review Checklist

- Spec coverage: #2/#3/#4/#6/#7/#11 each has a task and a verification step.
- No placeholders: every code-changing task includes concrete code or exact replacement target.
- Type consistency: normalized log fields use `chosenIdx` because current code already writes `chosenIdx`; future DB can map it to `chosen_idx`.
- Testing: every behavior change starts with a failing test and a named RED/GREEN command.
- Scope: Phase C is documented but not implemented, matching the decision to clean data first.
