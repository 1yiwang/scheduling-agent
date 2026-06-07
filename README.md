# Personal Scheduling Agent — Prototype

> **Your scheduling brain that sits *above* all your calendars.**

Not a calendar. Not a todo app. An **AI Agent** that understands your life rhythm, computes transit buffers, negotiates time across people, and presents you with decisions — which you approve with one tap.

---

## 🔴 Live Demo

**→ [scheduling-agent.vercel.app](https://scheduling-agent.vercel.app)** ←

Best viewed on mobile (375–428px) or desktop with phone-frame emulation.

---

## What's Inside

A single-file (~3200 lines), zero-dependency prototype showing the full UX: capture intent → Agent parses → you confirm → timeline updates. All data is mock (hardcoded `eventsDB` for June 6, 2026).

### 📱 5 Navigation Tabs

| Tab | Content |
|-----|---------|
| **Today** | Full timeline: Morning / Afternoon / Evening sections + transit buffers, AI-suggested free slots, pending tasks, follow-up tracker |
| **Calendar** | Monthly dot-grid. Tap any day → day detail panel with event cards. In-place refresh on edit/delete |
| **Coordinate** | Agent ↔ Agent cross-person negotiation demo. Background-free-slot exchange → ranked suggestions |
| **Contacts** | Calendar Friends list + one-time scheduling link generation |
| **Analytics** | Completion tracking, daily briefing cards, weekly stats |

### ✅ Feature Checklist

| Feature | Detail |
|---------|--------|
| 🎤 **Capture overlay** | 3-step pipeline: voice/text input → Agent parsing animation → 1–2 follow-up questions → confirm → added to timeline |
| 📸 **Screenshot input** | Mock vision AI. File picker → analysis animation → structured extraction → reuse parsing pipeline |
| 📋 **Event cards** | Compact view (time + title + tags) → tap to expand (location, people, transit mode, buffer, dress code, agent note) |
| ✏️ **Edit** | Inline edit form: title, time, location, transit mode, duration, buffer |
| 🗑️ **Delete** | Red destructive button; opacity + max-height collapse animation; day detail refreshes in-place (doesn't close) |
| ✅ **Mark complete** | Checkbox with visual confirmation |
| 🔄 **Reschedule** | Suggest alternative time slots for task-type events |
| 🧠 **Agent suggestions** | Free-slot detection → editable suggestion cards. Accepting one removes all time-overlapping suggestions. Accepted → becomes real event in eventsDB |
| ⚠️ **Conflict detection** | Overlapping time = all conflicting slots removed when one is accepted |
| 🔔 **Follow-ups** | Overdue / Due Today / Upcoming states. Collapsible. Per-item: mark done, snooze, dismiss |
| 📊 **Analytics** | Completion rate, briefing cards, weekly stats panel |
| 🍞 **Toast notifications** | Slide-in feedback for all actions (confirm, delete, complete) |

---

## Design System

### Icons

**Outlook Fluent-style SVG sprite sheet** — 20+ custom icons. No emoji, no Unicode. All icons: 1.5px stroke, rounded caps, `currentColor` theming.

| Category | Icons | Size |
|----------|-------|------|
| Navigation | today, calendar, coordinate, contacts, analytics | 24×24 |
| Form fields | date, time, location, person, type, home, transit, source | 18×18 |
| Actions | camera, mic, sun, moon, bell, trash, pencil, chart | 18×18 |
| Small indicators | check-sm, dismiss-sm | 14×14 |

### Visual Style
- **Phone frame:** 390×844px centered with device bezel
- **Theme:** iOS-inspired light mode (🌙 dark mode toggle ready)
- **Typography:** System font stack, clean hierarchy
- **Animations:** Card expand/collapse (max-height + opacity), toast slide-in, staggered list reveals, delete collapse
- **Colors:** iOS system palette — blue actions, red destructive, green confirmations
- **Layout:** Morning / Afternoon / Evening sections with sun/moon icons

### Technical
- **Zero dependencies.** Single `index.html` (~3200 lines). Pure HTML + CSS + vanilla JS.
- **No build step.** Open the file or deploy as-is.
- **All data is mock.** `eventsDB`, `pendingTasksDB`, `runtimeEvents`, `todayFreeSlots` — hardcoded for June 6, 2026.
- **CRLF line endings.** Windows-native.

---

## How to Deploy on Vercel

### One-time setup

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import this GitHub repo: `1yiwang/scheduling-agent`
3. Vercel auto-detects static HTML — **no configuration needed**
4. Click **Deploy**

Every `git push` to `main` triggers automatic redeployment.

### Manual deploy via CLI

```bash
cd frontend
npx vercel --prod
```

---

## Future (Post-Prototype)

See the [full PRD](https://github.com/1yiwang/scheduling-agent) (also in Obsidian: `10-PROJECTS/scheduling-agent/_index.md`) for:

| Module | Description |
|--------|-------------|
| **A** | Smart event capture (real voice → text, NLU parsing) |
| **B** | Spacetime engine (real transit APIs, SBB integration, buffer computation) |
| **C** | Intelligent scheduling (gap filling, dynamic rescheduling, priority perception) |
| **D** | Cross-person coordination (Agent ↔ Agent real negotiation, privacy-preserving) |
| **E** | Daily briefing (morning push, inline reasoning, actionable cards) |
| **F** | Platform (PWA, share links, history) |
| **G** | Non-Agent user fallback (read-only scheduling links) |
| **H** | External calendar sync (Outlook + Google Calendar via APIs) |
| **I** | Multi-modal input (screenshot OCR, email forwarding) |

### Competitive Positioning

We don't compete in the "calendar" category. We compete in the **"AI scheduling layer above calendars"** category — a new product category.

**7 structural moats:**
1. Cross-platform aggregation layer (Outlook + Google + Apple)
2. Agent ↔ Agent cross-person negotiation
3. Transit-time intelligence with Swiss precision
4. Privacy-preserving free/busy model
5. Multi-modal input (voice, text, screenshot, email)
6. Personal AI, not enterprise IT (works across org boundaries)
7. Network effects via Calendar Friends

---

## Project Status

- **Stage:** Interactive prototype — complete (June 7, 2026)
- **Next:** Collecting feedback from first users (Clark et al.) before deciding on backend MVP scope
- **Goal:** Validate UX hypothesis before committing to real APIs, database, or backend
- **Success criteria:** User understands the product in 10 seconds; completes the capture→confirm flow without friction; gives actionable feedback
- **Full PRD:** [github.com/1yiwang/scheduling-agent](https://github.com/1yiwang/scheduling-agent) — `_index.md` in the repo, or `10-PROJECTS/scheduling-agent/_index.md` in Obsidian
