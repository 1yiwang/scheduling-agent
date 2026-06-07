# Personal Scheduling Agent — Prototype

> **Your scheduling brain that sits *above* all your calendars.**

Not a calendar. Not a todo app. An **AI Agent** that understands your life rhythm, computes transit buffers, negotiates time across people, and presents you with decisions — which you approve with one tap.

---

## What This Prototype Shows

A mobile-first web app (375px–428px phone frame) demonstrating the core UX: capture intent → Agent parses → you confirm → timeline updates.

### 🔴 Live Demo

Deployed on Vercel. Open the link on your phone or in a desktop browser (phone-frame emulation).

---

## Implemented Screens & Interactions

### 📱 5 Navigation Tabs

| Tab | Content |
|-----|---------|
| **Today** | Full day timeline: Morning / Afternoon / Evening events with transit buffers, AI-suggested free slots, pending tasks, follow-up tracker |
| **Calendar** | Monthly heat-map grid. Tap any day → day detail panel with event cards |
| **Coordinate** | Cross-person Agent ↔ Agent negotiation mockup. Shows suggested time slots after background negotiation |
| **Contacts** | Calendar Friends list + one-time link generation for non-Agent users |
| **Analytics** | Completion tracking, daily briefing cards, weekly stats |

### 🎤 Capture Flow (3-step pipeline)

```
Hold mic button → speak "Friday 3pm coffee with Dr. Meier at ETH, train from home"
       │
       ▼
🧠 Agent parses → extracts: date, time, person, location, transit, event type
       │
       ▼
⚠️  Follow-up questions (asks 1–2 missing fields, e.g. "How should you get there?")
       │
       ▼
📊 Timeline preview → ✅ confirm → event added with transit buffer
```

**Input modes implemented:**
- 🎤 Voice (simulated — text input with parsing animation)
- 📸 Screenshot upload (mock vision AI extraction flow)
- ⌨️ Manual text input via capture overlay

### 📋 Event Cards (expandable)

Each event card shows:
- **Compact view:** time, title, type tag, transit mode icon
- **Expanded view:** location, participants, transit details, buffer before/after, dress code, agent reasoning note
- **Actions:** Edit ✏️, Delete 🗑️ (with collapse animation), Mark Complete ✅, Reschedule 🔄

### 🧠 Agent Suggestions

AI-detected free time slots shown as editable suggestion cards:
- Pre-filled with suggested activity type and title
- Editable title before accepting
- Accepting one slot auto-removes all conflicting (overlapping) suggestions
- Accepted suggestions become real events in the timeline

### 🔔 Follow-up Tracker

Tasks needing follow-up shown with:
- Overdue / Due Today / Upcoming status
- Per-task Mark Complete / Snooze / Dismiss actions
- Collapsible compact view

---

## Design System

### Icons
**Outlook Fluent-style SVG sprite sheet** — 20+ custom icons with 1.5px stroke, rounded caps, `currentColor` theming. No emoji, no Unicode. All icons match the iOS/Outlook aesthetic.

### Visual Style
- **Phone frame:** 390×844px centered with device bezel
- **Theme:** iOS-inspired light mode (dark mode toggle ready with 🌙 icon)
- **Typography:** System font stack, clean hierarchy
- **Animations:** Card expand/collapse, toast notifications, staggered list reveals
- **Colors:** iOS system palette — blue actions, red destructive, green confirmations

### Technical
- **Zero dependencies.** Single `index.html` file (~3100 lines). Pure HTML + CSS + vanilla JS.
- **No build step.** Open the file or deploy as-is.
- **All data is mock.** `eventsDB` object with hardcoded demo events for June 6, 2026.
- **CRLF line endings.** Windows-native encoding.

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

See full PRD at `D:\My Second Brain\10-PROJECTS\scheduling-agent\_index.md` for:

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

- **Stage:** Interactive prototype (MVP frontend)
- **Goal:** Validate UX with target users before building backend
- **Success criteria:** User understands the product in 10 seconds; completes the capture→confirm flow without friction; gives actionable feedback
