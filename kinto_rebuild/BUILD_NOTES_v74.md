# Kinto Global — Build v74

## The problem v73 introduced (and v74 fixes)

`proxyToPythonIfAvailable()` was still at the top of every POST handler.
When Python is running (`PYTHON_ROUTE_PROXY_ENABLED=true`) and idle, it
intercepts POST saves and runs full Python computation:
- OPS update-question: 3.5s → 8.6s (Python intercepted)
- OPS update-metric:   4s   → 35s  (Python intercepted, heavy computation)

DATA/AIR/AIUC saves only appeared fixed in v73 because Python happened to be
busy with the 19s OPS cold-start GET — the health check timed out (2.5s) and
fell through to our fast-write code. As soon as Python finishes a GET, saves
become slow again.

## Fix applied in v74

Python is now GET-only for cold-start. The rule, applied to all 5 modules:

  GET  → check snapshot first
           if snapshot empty → call Python (cold start, one-time per module)
           if snapshot exists → serve directly (fast path, no Python)

  POST → always use fast-write + scheduleRecompute
           never proxy to Python

## Expected latency after v74

| Operation              | v72    | v73    | v74        |
|------------------------|--------|--------|------------|
| OPS update-question    | 3.5s   | 8.6s   | < 500ms    |
| OPS update-metric      | 4s     | 35s    | < 500ms    |
| LEAK update-core       | 28s    | 3.8s   | < 500ms    |
| DATA/AIR/AIUC save     | 11-12s | <900ms | < 500ms    |
| Any module GET (warm)  | 3-20s  | 3-20s  | < 400ms    |
| Cold start (first GET) | 20-29s | 20-29s | 20-29s (*) |

(*) Cold start only happens once per assessment per module — Python builds
    the snapshot, all subsequent GETs serve from that snapshot directly.

## Other fixes in this build

- E2E stale ID detection improved: checks if DATA module returns correct
  assessment_id in response body, not just HTTP status
- E2E AIUC reference check fixed: AIUC uses 'usecases' key in reference
  bundle, not 'questions' — the check now handles both
- Reference bundle in-memory cache (from v73): all 5 modules cached after
  first Supabase load within a server process lifetime

## Running QA

```bash
npm run dev:full          # start app

# second terminal:
npm run qa:full-system    # 43/43 functional tests
node e2e/kinto-diagnostics.mjs   # latency + data flow diagnostic
```
