# Voice Input (P2 #7 · prioritized)

> **Status:** ✅ MVP shipped · ⏸ E2E QA blocked on OpenAI subscription (2026-06-21)

**Goal:** Replace mock capture with **hold → Whisper STT → LLM JSON parse → editable draft → confirm**.

**Pipeline:** Mic (MediaRecorder) → `POST /api/transcribe` → transcript → `llmChat` (structured JSON) → Step 1 draft card → `confirmParse()` → timeline + `interaction_log`.

**Locked decisions:**
- **STT:** OpenAI Whisper via `api/transcribe.js` (BYO key, same-origin guard as `api/llm.js`).
- **Parse:** Reuse existing LLM config + optional `sttApiKey` / `sttBaseUrl` (defaults OpenAI). Chat key (DeepSeek) and STT key (OpenAI) may differ.
- **Date context:** Prompt injects `appNow()` ISO; parser returns `dateISO` (YYYY-MM-DD). `selectedDay` from calendar overrides when set.
- **Demo fallback:** If STT/LLM not configured, keep mock path (`simulateCapture`) with visible hint.
- **Scope v1:** New events via bottom Voice button; voice-edit existing event stays mock (follow-up).

---

## Progress log

| Date | What |
|---|---|
| 2026-06-17 | MVP: `api/transcribe`, voice parse pure fns, capture UI wired, `voice-parse.test.js` |
| 2026-06-17 | Deployed to `calendar-demo.yiwang.dev` + `calendar.yiwang.dev` |
| 2026-06-21 | Fix: API errors no longer show `[object Object]` (`04260f3`) |
| 2026-06-21 | **Paused:** User has DeepSeek key configured; OpenAI subscription not yet added → Whisper E2E untested |

### Config when resuming (DeepSeek + OpenAI)

| Field | Value |
|---|---|
| Smart ranking | ✅ |
| Base URL | `https://api.deepseek.com` |
| Model | `deepseek-chat` |
| API key | DeepSeek key |
| Voice transcription URL | `https://api.openai.com/v1` |
| STT key | OpenAI key (**separate**, after subscription) |

### Next session checklist

1. Add OpenAI billing / subscription → create API key → paste in **STT key** only.
2. Settings → **Test connection** (DeepSeek) should still pass.
3. Voice → speak → **Stop recording** → expect transcript + parsed draft (not mock).
4. Confirm event → check timeline + Supabase `interaction_log.action = 'voice_capture'`.
5. Until OpenAI ready: use **Demo parse (mock)** on demo site for UI flow.

### Commits

- `ba809fe` — feat: voice input MVP
- `04260f3` — fix: readable API errors in voice flow

---

## Tasks

### Phase A — Serverless + pure parse
- [x] `api/transcribe.js` — POST `{ baseUrl, apiKey, model, audioBase64, mimeType }` → `{ text }`
- [x] `parseVoiceEventJSON`, `buildVoiceParsePrompt`, `resolveVoiceCaptureDate`, `buildParseFieldsHTML`
- [x] `tests/voice-parse.test.js`

### Phase B — Wire capture UI
- [x] Extend `normalizeLLMConfig` with STT fields + settings inputs
- [x] `transcribeAudio`, `parseVoiceTranscript`, `processVoiceRecording`
- [x] Replace mock button with Stop → process; demo fallback when unconfigured
- [x] Fix `finalizeEvent` / conflict paths to use dynamic year from `capState`

### Phase C — Learning + docs
- [x] `recordInteraction({ action:'voice_capture', ... })` on confirm
- [x] Update `product-description.md`
- [ ] E2E manual QA on both sites (blocked: OpenAI STT)
- [ ] Update `project-description.md` §7.9 (after QA passes)

---

## Manual QA

1. Settings → enable AI + OpenAI key for STT (+ DeepSeek for parse).
2. Personal mode → Voice → speak "Meeting with Lukas tomorrow at 3pm for 30 minutes" → Stop.
3. Edit draft fields → Confirm → event on correct day in timeline.
4. Supabase: `interaction_log.action = 'voice_capture'`.
