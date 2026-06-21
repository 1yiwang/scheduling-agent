# Generalize getPlanWindows(date) (Track B #4)

> **Status:** ✅ Complete (2026-06-17)

**Goal:** Time Planning Board shows free windows across the week, not just today — reusing `getFreeWindowsForDate` like Agent Loop already does.

## Delivered

- `resolvePlanDate` · `getDeskPlanningSlotsForDate` · `getPlanWindowsForDate`
- `getPlanWindowsInHorizon(PLAN_BOARD_HORIZON_DAYS=7)` · backward-compat `getPlanWindows()`
- Window objects carry `year/month/day/dateISO/isToday/dayLabel/dayOfWeek`
- `confirmDeskPlanWindow` schedules on the window's date (not always today)
- UI: Plan today tab shows 7-day board with day headers; Coming up tab shows future free time
- Tests: `tests/plan-windows-date.test.js`

## Verification

```powershell
node tests/plan-windows-date.test.js
node tests/inbox-plan.test.js
```

Manual: Agent suggestions → scroll past today → see Mon Jun 8 / empty Jun 7 windows → Confirm task lands on that day in calendar.
