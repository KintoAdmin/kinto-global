# Kinto Global — Build v72

## What changed from v71

### Advisory tab — now on ALL modules
Previously only Revenue Leakage had an Advisory tab. All five modules
now have it: OPS, LEAK, DATA, AIR, AIUC.

**How it works:**
- Shared `AdvisoryView` component (`src/components/diagnostics/shared/advisory-view.tsx`)
- Renders: priority findings → recommendations → actions → roadmap per module
- OPS uses `surfaced_findings` (nested rec/action per finding)
- DATA/AIR/AIUC use `recommendations[]` + `actions[]` from the module snapshot
- Advisory data populates automatically once questions are scored
- Empty state shown with guidance if no scoring done yet

**Runtime updated:**
- `src/lib/runtime/question-module.ts` — `getQuestionModulePayload` now returns
  `recommendations`, `actions`, `roadmapItems`, `executiveNarrative` in every GET

### E2E Diagnostic Suite
`e2e/kinto-diagnostics.mjs` — run from your project root:

```bash
node e2e/kinto-diagnostics.mjs
# or with specific assessment:
node e2e/kinto-diagnostics.mjs --base http://localhost:3000 --aid YOUR_ASSESSMENT_ID
```

Covers 16 test sections:
1. Health check
2. Clients & assessments
3. Workspace snapshot integrity
4. Reference data bundles (all 5 modules)
5. Module GET payload integrity (all 5 modules)
6. OPS score save — latency & persistence trace (fast-write verification)
7. OPS bulk score
8. Generic module saves (DATA, AIR, AIUC)
9. Revenue Leakage save flow
10. Metric saves
11. Module summary routes
12. Report routes
13. Roadmap & publications
14. Data flow integrity cross-checks
15. Latency deep-dive with root cause analysis
16. Route coverage map

Outputs a prioritised root-cause report: CRITICAL → ERROR → PERF → WARN

## Install steps (same as v71)

1. Extract zip, copy your `.env.local` into root
2. `npm install`
3. `pip install -r python_engine/requirements.txt` (in your .venv)
4. `npm run dev:full` (runs Next.js + Python engine together)
5. Open `http://localhost:3000`

## Run E2E suite

```bash
# Start the app first, then in a second terminal:
node e2e/kinto-diagnostics.mjs

# With a known assessment ID for faster targeted testing:
node e2e/kinto-diagnostics.mjs --aid xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

The suite will print each check live and a full root-cause report at the end.
Paste the output back and we can fix each issue in order.

## Known items for next session (after E2E run)
- Apply fast-write + background recompute to LEAK/DATA/AIR/AIUC routes
  (currently only OPS has it — DATA/AIR/AIUC still block on full recompute)
- Advisory content depth depends on library data quality per module
- Report generation (DOCX/PPTX) quality pass
