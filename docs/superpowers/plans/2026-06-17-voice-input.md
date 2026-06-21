# Voice Input (P2 #7 · prioritized)

> **Status:** ✅ MVP shipped (2026-06-17)

**Goal:** Replace mock capture with **hold → Whisper STT → LLM JSON parse → editable draft → confirm**.

**Pipeline:** Mic (MediaRecorder) → `POST /api/transcribe` → transcript → `llmChat` (structured JSON) → Step 1 draft card → `confirmParse()` → timeline + `interaction_log`.

**Locked decisions:**
- **STT:** OpenAI Whisper via `api/transcribe.js` (BYO key, same-origin guard as `api/llm.js`).
- **Parse:** Reuse existing LLM config + optional `sttApiKey` / `sttBaseUrl` (defaults OpenAI). Chat key (DeepSeek) and STT key (OpenAI) may differ.
- **Date context:** Prompt injects `appNow()` ISO; parser returns `dateISO` (YYYY-MM-DD). `selectedDay` from calendar overrides when set.
- **Demo fallback:** If STT/LLM not configured, keep mock path (`simulateCapture`) with visible hint.
- **Scope v1:** New events via bottom Voice button; voice-edit existing event stays mock (follow-up).

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
- [ ] Update `product-description.md`, `project-description.md` §7.9

---

## Manual QA

1. Settings → enable AI + OpenAI key for STT (+ DeepSeek for parse, or same OpenAI for both).
2. Personal mode → Voice → speak "Meeting with Lukas tomorrow at 3pm for 30 minutes" → Stop.
3. Edit draft fields → Confirm → event on correct day in timeline.
4. Supabase: `interaction_log.action = 'voice_capture'`.
