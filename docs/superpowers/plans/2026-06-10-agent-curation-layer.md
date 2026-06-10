# Agent Curation Layer (Layer 1) + BYO-Key LLM Plan

> **For agentic workers:** Implement task-by-task with TDD. Steps use checkbox (`- [ ]`) syntax for tracking. Tests are Node `vm`-based in `tests/*.test.js`. Run the full suite + lint after each task.

**Goal:** Put a curation layer on top of the deterministic Agent Loop. It ranks, dedups, and suppresses candidate moves without ever touching their actions. Demo runs a deterministic curator (zero cost, zero latency). Personal mode can optionally route curation through a user-provided LLM (DeepSeek first), configured on a Settings page with the user's own API key.

**Locked decisions (from discussion):**
- **rank_only**: the LLM only ranks / folds. Copy stays templated — no LLM-written text, so no AI-smell, consistent with the earlier "remove AI tone / no em-dashes" requirement.
- **Output is a decision object, not move objects.** The curator returns `{ order, folded }` (move ids only). A pure `applyCuration(moves, decision)` applies it. The LLM can never emit an action payload, so it structurally cannot schedule, hide a conflict, or alter a slot.
- **BYO key, per user.** A Settings page (personal mode only) stores provider / base URL / model / API key. Each user uses their own key; the author also fills it manually. First target: **DeepSeek** (`https://api.deepseek.com`, OpenAI-compatible `POST /chat/completions`, model `deepseek-chat`).
- **Serverless proxy for the LLM call.** Browser → `api/llm` (Vercel function) → DeepSeek. The key is passed per-request from the client (localStorage); it is **not** stored server-side. Reason: DeepSeek browser CORS is undocumented/unreliable, and a thin proxy makes the call robust. No streaming needed (curation returns a small JSON).
- **Key storage: localStorage only by default** (per-device), not synced into the Supabase `app_state` blob. The key is a secret; cross-device sync is a later opt-in if wanted.

---

## Architecture

```
runAgentLoop()                      // existing: detectors → Move[] (dismiss-filtered, severity-sorted)
  → mergeMoves(moves)               // NEW deterministic: collapse same-event duplicates
  → context = buildAgentContext()   // NEW compact profile card (load summary + prefs + dismiss stats)
  → decision = curate(merged, ctx)  // NEW seam:
       demo / fallback → curateMovesRules(merged, ctx)        // deterministic
       personal + LLM on → curateMovesLLM(merged, ctx)        // proxy → DeepSeek → {order, folded}
  → final = applyCuration(merged, decision)   // NEW pure: enforce guardrails, build render list
  → renderBriefingGroups(final)     // existing renderer, now fed curated list
```

### Decision object (the only thing a curator returns)

```js
{
  order:  [moveId, ...],   // visible moves, in priority order
  folded: [moveId, ...]    // moves to tuck under a "More" affordance
}
```

### applyCuration guardrails (deterministic, non-negotiable — this is the safety core)

- Every `critical` move MUST be visible and ranked above all non-critical moves. A curator cannot bury a real conflict.
- Unknown ids in `order` / `folded` → ignored.
- Moves missing from both lists → appended to visible in default (severity, daysUntil) order. Nothing is silently lost.
- `folded` never hides a `critical`.
- If a curator throws or returns an invalid shape → discard it, fall back to `curateMovesRules`.

---

## File Structure

- **Modify `index.html`**
  - Add `mergeMoves`, `buildAgentContext`, `curateMovesRules`, `applyCuration`, and a `curate()` dispatcher.
  - Add `curateMovesLLM` (async; calls `api/llm`; validates; falls back).
  - Wire the briefing path: `renderBriefingGroups` consumes the curated/applied list. Because LLM is async, keep render synchronous on the last-known curated result and refresh when the async curation resolves (cache per loop signature).
  - LLM settings: state + load/save (`schedulingAgentLLM.v1` in localStorage), Settings UI group, test-connection button.
  - "More" fold/unfold UI in the briefing.
- **Create `api/llm.js`** — Vercel serverless function. Accepts `{ baseUrl, apiKey, model, messages, ... }`, forwards to `${baseUrl}/chat/completions`, returns JSON. Restrict to POST; set permissive-but-scoped CORS for our own origins.
- **Create tests**
  - `tests/merge-moves.test.js`
  - `tests/apply-curation.test.js` (the guardrails — most important)
  - `tests/curate-rules.test.js`
  - `tests/agent-context.test.js`
- **Modify docs**
  - `docs/agent-detectors.md` — add a short "Curation layer" section pointing here.
  - `project-description.md` §4 / §8 — record curation layer + Settings/LLM.

---

## Tasks

### Phase A — Deterministic curation (no backend, demo benefits immediately)

- [ ] **A1. `mergeMoves(moves)` + test.** Collapse moves that target the same `subject.eventId` into one (keep highest severity; merge action lists deterministically; templated combined title). Pure function. `tests/merge-moves.test.js`.
- [ ] **A2. `applyCuration(moves, decision)` + test.** Implement all guardrails above. Test: criticals always float and are never folded; unknown ids ignored; missing ids appended; invalid decision → caller falls back. `tests/apply-curation.test.js`. **Write this test first and hard.**
- [ ] **A3. `buildAgentContext()` + test.** Build the compact profile card: today's load summary, presence of near-term high-stakes events, prefs derived from `prefStore` (Beta α/β → tendency), and per-type dismiss counts aggregated from `interactionLog`. Pure given state. `tests/agent-context.test.js`.
- [ ] **A4. `curateMovesRules(moves, context)` + test.** Deterministic curation: rank by (severity, daysUntil, dismiss-demotion from context), cap visible to N (e.g. 5), fold the rest, never fold criticals. Returns a decision object. `tests/curate-rules.test.js`.
- [ ] **A5. Wire briefing + "More" UI.** `renderBriefingGroups` consumes `applyCuration(mergeMoves(runAgentLoop()), curateMovesRules(...))`. Add a "More (N)" toggle for folded items. Manual QA in demo. Full test + lint, commit, push.

### Phase B — Settings page + BYO key (personal mode)

- [ ] **B1. LLM config state.** `schedulingAgentLLM.v1` in localStorage: `{ enabled, provider, baseUrl, model, apiKey }`. Defaults preset for DeepSeek (`baseUrl: https://api.deepseek.com`, `model: deepseek-chat`). Load on boot. Key stays local (not in cloud blob).
- [ ] **B2. Settings UI group.** New "AI assistant" group in `settingsOverlay`, visible only when `appMode === 'live'` and signed in. Fields: enable toggle, provider/base URL, model, API key (password input), and a "Test connection" button + status line. Save on change.
- [ ] **B3. `api/llm.js` serverless proxy.** POST only. Body: `{ baseUrl, apiKey, model, messages, temperature, response_format }`. Forward to `${baseUrl}/chat/completions`; return the upstream JSON (or a clean error). CORS scoped to our origins. Verify on a Vercel preview.
- [ ] **B4. `curateMovesLLM(moves, context)` + fallback.** Build a strict prompt: here are the candidate moves (id, type, severity, title, daysUntil) and the context card; return ONLY JSON `{ order:[...], folded:[...] }` of known ids. Call `api/llm`; parse + validate (subset of known ids, criticals present); on any failure return `curateMovesRules(...)`. Unit-test the parser/validator with mocked responses (`tests/curate-llm.test.js`).
- [ ] **B5. Dispatcher + async refresh.** `curate()` picks LLM when enabled+configured+live, else rules. Briefing renders synchronously from cached decision and re-renders when async LLM resolves. Test-connection in Settings exercises the full path. Full test + lint, commit, push.

---

## Security & Cost Notes

- The proxy is BYO-key: it never stores a key; the client sends its own each call. Scope CORS to our domains to avoid being an open relay; consider a tiny per-IP rate limit later.
- Key in localStorage is acceptable for a personal BYO tool (it is the user's own key on their own device). Document this in the Settings hint. Never log the key; never put it in the Supabase blob.
- Curation is one cheap, non-streaming call per loop refresh; cache by loop signature so we don't call on every minor re-render. If `enabled` is off or unconfigured, zero calls.

## Non-Goals (this plan)

- LLM-written copy (rank_only locked).
- LLM proposing brand-new moves or editing payloads (structurally excluded).
- Offline pattern-miner (Layer 2) and declarative detectors (Layer 3) — later.
- Cross-device sync of the API key.
