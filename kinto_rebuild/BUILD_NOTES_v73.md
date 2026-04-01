# Kinto Global — Build v73

## What this build fixes

All issues identified by the E2E diagnostic suite run on 2026-03-30.
The system was functionally correct (43/43 QA passes) — purely performance.

---

## Performance fixes

### 1. DATA / AIR / AIUC saves: 11–12s → <500ms

**Root cause:** `saveQuestionModuleScore` called `rebuildQuestionModuleRuntime`
synchronously before returning. That function reads all responses, recalculates
every domain score, writes domain_scores, findings, recommendations, actions,
roadmap, and summary — all blocking the HTTP response.

**Fix:** New `fastWriteQuestionScore` in `src/lib/runtime/question-module.ts`
- Writes the score row to DB immediately (~50ms)
- Returns current snapshot state optimistically
- Caller schedules `scheduleRecompute(assessmentId, moduleCode)` — non-blocking
- Background recompute runs after 600ms debounce, updates snapshot for next GET

### 2. LEAK saves: 28–29s → <500ms

**Root cause:** Every `update-core`, `update-driver`, `update-support` call
invoked `computeAndPersistLeakage` synchronously — full leakage engine + DB
writes before returning.

**Fix:** `buildPayloadFast` in LEAK route
- `saveLeakageState` writes the new value (~50ms)
- `buildPayloadFast` runs `computeLeakage` in-memory (CPU only, no DB writes, ~10ms)
- Returns updated numbers to client immediately
- `scheduleRecompute(assessmentId, 'LEAK')` persists full snapshot in background

### 3. All module GETs warm: 3–20s → <400ms

**Root cause:** `proxyToPythonIfAvailable` intercepted every GET request when
`PYTHON_ROUTE_PROXY_ENABLED=true`, sending everything to the Python engine
even when a valid cached snapshot already existed.

**Fix:** Snapshot-first pattern on all 5 module GET handlers
- Check `getModuleSnapshot` before proxying to Python
- If snapshot has content → serve directly (no Python call)
- If snapshot is empty (cold start, fresh assessment) → let Python handle it
- Python now only runs once per assessment per module — on first load

### 4. Reference bundle: 3–4s every request → <10ms after first

**Root cause:** `getReferenceBundle` queried Supabase `reference_records` on
every single API call. OPS has 177+ questions across multiple record types —
a large query on every request.

**Fix:** Module-level in-memory cache in `src/lib/reference/bundle.ts`
- First call loads from Supabase and populates `_bundleCache`
- All subsequent calls within the same server process return from memory
- Cache persists for the lifetime of the Next.js server process (warm between requests)

### 5. Background recompute: extended to all 5 modules

`src/lib/services/background-recompute.ts` now handles OPS, LEAK, DATA, AIR, AIUC.
All modules use the same debounce pattern (600ms) with try/catch isolation.

---

## Feature: Advisory tab on all modules

OPS, DATA, AIR, AIUC now have an Advisory tab matching LEAK.
Renders findings → recommendations → actions → roadmap per module.
Shared `AdvisoryView` component (`src/components/diagnostics/shared/advisory-view.tsx`).

---

## Bug fix: E2E suite — stale assessment ID

`e2e/kinto-diagnostics.mjs` now auto-creates a fresh client + assessment
if the passed `--aid` value returns a 500 or is unreachable. The suite
always runs against a known-good assessment.

---

## Expected latency profile after this build

| Operation                    | Before   | After    |
|------------------------------|----------|----------|
| DATA/AIR/AIUC score save     | 11–12s   | <500ms   |
| LEAK core/driver/support save| 28–29s   | <500ms   |
| OPS score save               | <2s      | <500ms   |
| Any module GET (warm)        | 3–20s    | <400ms   |
| Any module GET (cold start)  | 20–29s   | 20–29s   |
| Reference bundle (2nd+ call) | 3–4s     | <10ms    |
| Publications                 | 113s     | 113s     |

Cold start is unavoidable on a fresh assessment's first load — Python needs to
build the initial snapshot. Subsequent loads serve from cache.

Publications (113s) require an async job queue pattern — scheduled for a future session.

---

## Run E2E after installing

```bash
# Start app first
npm run dev:full

# In second terminal — runs full diagnostic + creates fresh test assessment
node e2e/kinto-diagnostics.mjs

# Or target the existing Stark Industries demo assessment
node e2e/kinto-diagnostics.mjs --aid asm-cl-stark-industries-full-system-demo-20260329-163912-001
```

---

## Install (same as previous builds)

1. Extract zip, copy `.env.local` to root
2. `npm install`
3. `npm run dev:full`
4. Open `http://localhost:3000`
