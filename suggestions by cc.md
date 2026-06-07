# UI Design Suggestions for Scheduling Agent

> **Source:** Claude Code review of `index.html` (prototype) against `_index.md` (product spec)
> **Date:** 2026-06-07
> **Principle:** Agent 帮用户做计算和决策准备，用户做最终确认。UI 的目标是让决策流程尽可能地短——打开 App，看一眼建议，点一下确认。

---

## Summary Assessment

Current prototype (~3,200 lines `index.html`) has established a strong visual baseline and core interaction paradigm. However, when measured against the 9 modules (A–I) and the user journeys described in `_index.md`, key UX gaps remain:

1. **Today page is a vertical information dump** — critical decisions are diluted across too many cards
2. **Capture flow feels like a form** — not the conversational "one question at a time" experience specified in A3
3. **Coordinate page shows results, not reasoning** — lacks transparency (violates E3)
4. **No conflict detection UI** — scenarios like "add a meeting on top of another" have no visual treatment
5. **Daily Briefing is passive** — it's an info card at the bottom, not actionable (violates E4)
6. **Navigation is feature-oriented** — not aligned with user mental models

---

## 1. Today Page Restructure: From "View Calendar" to "Agent Thinks for You"

### Current Problem

The Today page is a top-to-bottom information dump: Pending → Morning → Afternoon → Agent Suggestions → Evening → Briefing. Users must scroll to see all content. **Critical decision information is diluted across many event cards.**

### Proposed Layout

```
┌─────────────────────────────────────┐
│  📅 Saturday, June 6                │
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐    │
│  │  🧠 早安, Yvonne             │    │  ← Agent Greeting Card (fixed top)
│  │                              │    │
│  │  🔴 2 past events need      │    │     At-a-glance critical info
│  │      confirmation            │    │
│  │  🟡 3 pending tasks          │    │
│  │  🟢 3h free this afternoon  │    │
│  │                              │    │
│  │  [View details]              │    │
│  └─────────────────────────────┘    │
│                                     │
│  ── Now ── 11:00 ──                 │  ← Timeline indicator
│                                     │
│  ● 08:00-09:00  NEUR.ON Q3...  ✅  │  ← Past events (dimmed/strikethrough)
│  ● 09:00-09:30  Noxtua Sync    ✅  │
│                                     │
│  ── Afternoon ──                    │
│                                     │
│  ○ 17:00-17:45  🚂 Fribourg→ZH   │  ← Future events
│  ○ 17:45-18:00  🚶 Walk→Kronenhalle│
│  ○ 18:00-21:30  🍽️ Alumni Dinner │
│                                     │
│  ┌─ 🧠 Agent Suggestion ───────┐   │
│  │                             │   │
│  │  13:00-16:00 · 3h free      │   │  ← Single aggregated card
│  │                             │   │     (not multiple competing cards)
│  │  ⭐ 13:00-16:00             │   │
│  │  Draft SLTA Newsletter     │   │
│  │  "Deadline Mon. 3h block = │   │
│  │   ideal for writing"        │   │
│  │  [Confirm] [Other ideas ▼]  │   │
│  │                             │   │
│  └─────────────────────────────┘   │
│                                     │
│  ── Evening ──                      │
│  ○ 18:00-21:30  🍽️ Alumni Dinner  │
└─────────────────────────────────────┘
```

### Key Changes

| # | Change | Rationale |
|---|--------|-----------|
| 1 | **Agent Greeting Card** pinned at top | One glance = all critical info (aligns with E1, E3) |
| 2 | **Timeline indicator** ("Now" marker) | Clear past/future distinction (aligns with A6 time awareness) |
| 3 | **Single aggregated suggestion card** | Default shows best pick; expand for alternatives (aligns with C1) |
| 4 | **Critical info above the fold** | No scrolling needed for decision-making |

---

## 2. Capture Flow: From "Form-based" to "Conversational Q&A"

### Current Problem

The Capture overlay is a multi-step form: Listening → Parse → Confirm. The parse step shows a grid of 7 field cards + missing-field warnings + chip selectors + optional classification. **Too much information density for mobile.** Users face cognitive overload on the parse screen.

### Proposed Flow

```
┌─────────────────────────────────────┐
│  🎤 "Friday 3pm coffee with         │
│       Michael at Bahnhofstrasse"     │
│                                     │
│  ── Agent understood ──             │
│  📅 Fri, Jun 12                     │
│  🕐 3:00 PM                         │  ← Only confirmed fields shown
│  📍 Bahnhofstrasse, Zurich          │
│  👤 Michael                         │
│  🏷️  Coffee meeting                │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  🤔 Where are you leaving   │    │  ← ONE question at a time!
│  │     from?                   │    │
│  │                             │    │
│  │  [🏠 Home] [🏢 Office]      │    │
│  │  [✏️ Other...]              │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  🚂 How are you getting     │    │  ← Appears only after
│  │     there?                  │    │     previous answer
│  │                             │    │
│  │  [🚂 Train] [🚶 Walk]       │    │
│  │  [🚗 Car]   [🚌 Bus]        │    │
│  └─────────────────────────────┘    │
│                                     │
│  [Confirm · Add to Timeline]        │  ← Lights up when all info complete
└─────────────────────────────────────┘
```

### Key Changes

| # | Change | Rationale |
|---|--------|-----------|
| 1 | **Progressive Q&A** — one question at a time | Aligns with A3: "按优先级逐个问，每次最多 2 个问题" |
| 2 | **Reduced information density** | Don't show all 7 fields at once |
| 3 | **Conversational feel** | Agent feels like a real assistant, not a form wizard |
| 4 | **Classification deferred** | Eisenhower classification is nice-to-have; don't block confirmation on it |

### Eisenhower Classification (optional enhancement)

Move classification to post-confirmation or make it an opt-in setting. The prototype currently blocks confirmation until origin + transit are filled — classification should never be a blocker.

---

## 3. Cross-Person Coordination: From "Show Results" to "Show Reasoning"

### Current Problem

The Coordinate page directly shows 3 suggested slots without explaining **why** one is the best. Missing the Agent's reasoning transparency (violates E3).

### Proposed Layout

```
┌─────────────────────────────────────────┐
│  🤝 Meet Lukas (NEUR.ON CTO) · Coffee   │
│                                         │
│  ┌─ Agent negotiating in background ─┐  │
│  │                                   │  │
│  │  ✅ Queried Lukas's availability  │  │  ← Show negotiation steps
│  │  ✅ Computed your transit+buffer  │  │
│  │  ✅ Found 3 overlapping slots     │  │
│  │  ✅ Ranked by quality             │  │
│  │                                   │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ⭐ Best Match                         │
│  ┌──────────────────────────────────┐  │
│  │  Thu, Jun 11 · 15:00-15:30      │  │
│  │  📍 NEUR.ON Office, Zürich      │  │
│  │                                 │  │
│  │  👤 You: 🚶 Walk 5 min          │  │  ← Both sides' transit
│  │  👤 Lukas: 🚶 Walk 5 min        │  │
│  │                                 │  │
│  │  💡 Why this is best:           │  │
│  │  Zero transit friction, both    │  │  ← Explanation (≤20 chars, per E3)
│  │  on-site, deep discussion slot  │  │
│  │                                 │  │
│  │  [Confirm · Notify Lukas]       │  │
│  └──────────────────────────────────┘  │
│                                         │
│  Other options                          │
│  ┌──────────────────────────────────┐  │
│  │  Mon, Jun 8 · 14:00-14:30    ▶  │  │  ← Collapsed; tap to expand
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### Key Changes

| # | Change | Rationale |
|---|--------|-----------|
| 1 | **Negotiation process visualization** | Shows what the Agent did (E3: annotated reasoning) |
| 2 | **Both sides' transit side by side** | Each person's commute labeled separately (D3) |
| 3 | **"Why" explanation** | Best pick has a concise reason (E3: ≤20 chars) |
| 4 | **Non-best options collapsed** | Don't fight for visual weight with the best pick |

---

## 4. Conflict Detection: From "Passive Marker" to "Active Guidance"

### Current Problem

The prototype has no real conflict detection or guided resolution flow (violates C5: hard conflict detection; C2: dynamic rescheduling).

### Proposed Layout (Scenario 3 from spec)

```
┌─────────────────────────────────────────┐
│  ⚠️ Time Conflict                       │
│                                         │
│  "Tomorrow 10:00 meet Zhang San"        │
│                                         │
│  ┌──────────────────────────────────┐   │
│  │  🔴 CONFLICT: Noxtua Weekly       │   │
│  │     Tomorrow 10:00-10:30 (online) │   │
│  └──────────────────────────────────┘   │
│                                         │
│  Agent suggests:                        │
│                                         │
│  ┌──────────────────────────────────┐   │
│  │  🥇 9:00-10:00                  │   │  ← Before the conflict
│  │     "1h window before the sync.  │   │
│  │      Doable for a quick meet."   │   │
│  │     [Choose this]                │   │
│  └──────────────────────────────────┘   │
│  ┌──────────────────────────────────┐   │
│  │  🥈 11:00-12:00                 │   │  ← After the conflict
│  │     "30min buffer after the sync.│   │
│  │      Good for focused discussion."│  │
│  │     [Choose this]                │   │
│  └──────────────────────────────────┘   │
│  ┌──────────────────────────────────┐   │
│  │  🥉 Negotiate with Zhang San    │   │  ← Cross-person negotiation
│  │     Let the Agent find another   │   │
│  │     time that works for both     │   │
│  │     [Start negotiation]          │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### Dynamic Rescheduling (C2)

When a new event is inserted and causes downstream shifts:

```
┌─────────────────────────────────────────┐
│  ✅ "Lunch with Investor" added         │
│     Fri 12:00-13:30                     │
│                                         │
│  ⚠️ 2 downstream events shifted:        │
│                                         │
│  Original          →  New               │
│  ─────────────────────────────────────  │
│  13:00-14:00       →  13:30-14:30       │
│  LegalTech Pitch   │  LegalTech Pitch   │
│                                         │
│  14:00-14:45       →  14:30-15:15       │
│  🚂 Train to ZH   │  🚂 Train to ZH    │
│                                         │
│  [Accept changes] [Undo]               │
└─────────────────────────────────────────┘
```

### Key Changes

| # | Change | Rationale |
|---|--------|-----------|
| 1 | **Conflict detection overlay** with 3 resolution paths | C5: mark conflict red + suggest alternatives |
| 2 | **Before/after slot suggestions** | Natural resolution options |
| 3 | **Cross-person negotiation as fallback** | Integrates with Coordinate module |
| 4 | **Shift preview** for downstream events | C2: show what changed, let user confirm |

---

## 5. Daily Briefing: From "Info Card" to "Actionable Dashboard"

### Current Problem

The Briefing is a dark-gradient information card at the bottom of the Today page. It's **not interactive enough** — unmarked events require expanding cards to act on them. Violates E4: "每个建议都是可操作卡片：确认/推迟/跳过".

### Proposed Layout

```
┌─────────────────────────────────────────┐
│  🌅 Good morning, Yvonne    Sat, Jun 6  │
│                                         │
│  ┌─ Needs Your Confirmation ────────┐   │
│  │                                 │   │
│  │  📋 Product Spec Review         │   │
│  │     Thu 6/4 · Unmarked          │   │
│  │     [✅ Done] [❌ Not Done]     │   │  ← One-tap action
│  │                                 │   │
│  │  📋 Swiss AI Board              │   │
│  │     Fri 6/5 · Unmarked          │   │
│  │     [✅ Done] [❌ Not Done]     │   │
│  │                                 │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─ Pending Tasks ─────────────────┐   │
│  │  🔴 SLTA Newsletter             │   │  ← Color = urgency level
│  │     Due Mon 6/8 · ~2h           │   │
│  │     [Schedule it]               │   │
│  │                                 │   │
│  │  🟡 NEUR.ON Deck                │   │
│  │     Due Wed 6/10 · ~3h          │   │
│  │     [Schedule it]               │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─ Today's Stats ────────────────┐   │
│  │  5 events · 3 done · 2 pending  │   │
│  │  3h deep · 30m online · 4h social│  │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### Key Changes

| # | Change | Rationale |
|---|--------|-----------|
| 1 | **Briefing = top-of-page summary**, not bottom card | E1: morning push = first thing you see |
| 2 | **Every module is directly actionable** | E4: one-tap confirm/snooze/skip |
| 3 | **Pending tasks link into scheduling** | Connects to C1 (gap filling) |
| 4 | **Color = urgency for pending items** | Red = overdue / due today; Yellow = this week |

---

## 6. Navigation Restructure: From Feature-Oriented to Task-Oriented

### Current Problem

5 tabs (Today / Calendar / Coordinate / Contacts / Analytics) are feature-oriented, not aligned with the user's mental model of what they came to do.

### Option A: Rename existing tabs (conservative)

| Current | Proposed | Rationale |
|---------|----------|-----------|
| Today | **Home** 🏠 | Not "today's list" — it's "everything the Agent prepared for you" |
| Calendar | **Timeline** 📅 | Not just a calendar — a browsable timeline (incl. history, F5) |
| Coordinate | **Meet** 🤝 | User verb: "I want to meet someone" |
| Contacts | **People** 👥 | Calendar friends + temp links |
| Analytics | **Insights** 📊 | Not cold analytics — Agent insights |

### Option B: Reduce to 3 tabs (aggressive)

```
🏠 Home     │  Everything the Agent prepared (timeline + briefing + pending + follow-ups)
📅 Timeline │  Any day's full timeline + month calendar navigation
🤝 Meet     │  Cross-person coordination + contact list + temp link generator
```

- **Analytics** merges into Home (bottom section) or becomes part of Profile/Settings
- This reinforces the "Agent aggregates, you decide" paradigm

### Recommendation

Start with **Option A** (renames) for the next prototype iteration. Test with users. If the "Home vs Timeline" distinction confuses people, collapse to Option B.

---

## 7. Visual Detail Enhancements

### 7.1 Event Card Status Encoding

The prototype already has past / completed / not-completed visual states. Enhance:

```
✅ Completed past event:
┌─────────────────────────────────┐
│ ██ 08:00-09:00                  │  ← Green left border
│ NEUR.ON Q3 Roadmap Draft        │     Title gray + strikethrough
│ 📍 Home · Fribourg              │     Overall opacity 0.45
└─────────────────────────────────┘

❌ Marked not-done past event:
┌─────────────────────────────────┐
│ ██ 09:00-11:00                  │  ← Red left border
│ Product Spec Review             │     Normal opacity
│ [✅ Mark Done] [🔁 Reschedule]  │     Actions directly on card
└─────────────────────────────────┘

⚠️ Overdue unmarked past event:
┌─────────────────────────────────┐
│ ██ 10:00-12:00                  │  ← Orange left border
│ SLTA Board Meeting              │     Pulse animation to draw attention
│ [Done] [Not Done]               │
└─────────────────────────────────┘
```

### 7.2 Event Type Visual Weighting

Not all events deserve equal visual weight:

| Event Type | Visual Treatment |
|------------|-----------------|
| **Deep Work** | Purple left border + bold title |
| **High-priority Meeting** | Blue left border |
| **Social Event** | Soft purple accent |
| **Transit** | Minimal weight — smaller font, muted color |

### 7.3 Timeline Visual Rhythm

Current vertical card stack has no time-proportional spacing. Consider:
- A thin vertical **timeline rule** on the left side of event cards (like iOS Calendar week view)
- Optional: proportional spacing between events based on time gap (higher implementation cost)

---

## 8. Empty States & Error States

The prototype currently has no edge-case handling. Suggestions:

| State | Design |
|-------|--------|
| **Day with zero events** | Not blank. Show: "☀️ A completely free day! Agent suggests scheduling some deep work." + quick-add button |
| **Agent still computing** | Skeleton screen + "🧠 Agent is analyzing your schedule..." |
| **Network error** | Non-blocking banner: "⚠️ Unable to refresh. Showing local cache." |
| **First-time user** | 3-screen onboarding → calendar permission request → sample events demo |
| **No contacts yet** | "👥 Add your first Calendar Friend to unlock cross-person scheduling." |
| **No pending tasks** | "🎉 All caught up! Agent will notify you when new tasks come in." |

---

## 9. Priority Roadmap

Based on the spec's next step (collect user feedback → adjust prototype → MVP development):

| Priority | Change | Why | Est. Effort |
|----------|--------|-----|-------------|
| **P0** | Today page restructure (greeting card + timeline) | Core experience differentiator | Medium |
| **P0** | Capture flow → progressive Q&A | A3 explicitly requires "one question at a time" | Medium |
| **P1** | Conflict detection UI | Scenario 3 in spec — users will hit this immediately | Medium |
| **P1** | Coordinate results with reasoning + both-side transit | Core differentiator D1–D5 | Small |
| **P1** | Briefing → actionable dashboard | E4: every suggestion must be actionable | Medium |
| **P2** | Navigation restructure (Option A: renames) | Test with users before committing | Small |
| **P2** | Empty states & error states | Professional polish, not MVP-critical | Small |
| **P3** | Dark mode implementation | CSS variables already reserved | Small |
| **P3** | Timeline visual rhythm (proportional spacing) | Nice-to-have, higher implementation cost | Large |

---

## Core Principle (repeated)

> **Agent 帮用户做计算和决策准备，用户做最终确认。**
>
> The UI's job is to make this decision loop as short as possible: open app → glance at Agent's suggestion → tap confirm → done.
>
> Everything that doesn't serve this loop is noise.

---

*Generated by Claude Code · 2026-06-07*
