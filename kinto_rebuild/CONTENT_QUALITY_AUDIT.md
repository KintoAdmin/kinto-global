# Kinto Global — Content Quality Audit
**Date:** 2026-03-31 | **Version:** v1.0.0-rc.2

---

## Summary verdict

The content quality is **uneven across modules**. OPS is genuinely consulting-grade.
DATA, AIR, AIUC, and LEAK need targeted depth improvements before a premium client engagement.

| Module | Findings | Recommendations | Actions | Overall verdict |
|--------|----------|-----------------|---------|-----------------|
| OPS    | ✅ Strong  | ✅ Strong        | ✅ Strong | Ready           |
| AIR    | ⚠️ Adequate | ⚠️ Summary-only  | ⚠️ Thin  | Needs work      |
| DATA   | ⚠️ Adequate | ✗ All empty detail | ⚠️ Thin | Needs work    |
| LEAK   | ⚠️ Thin    | ⚠️ Summary-only  | ⚠️ Thin  | Needs work      |
| AIUC   | ✗ Runtime-only | ✗ Runtime-only | ✗ Runtime-only | No static library content |

---

## Module-by-module diagnosis

### OPS — Ready

OPS is the benchmark. 531 findings across score bands, 177 recommendations, 177 actions.

**What makes OPS strong:**
- Each finding has: `finding_text` (~277 chars) + `business_impact` (~146 chars) + `likely_root_cause` (~148 chars)
- Each recommendation has: `recommendation_text` (~288 chars) + `expected_outcome` (~109 chars) + `advisory_note`
- Each action has: `action_text` (~353 chars) + `action_deliverable` (~113 chars) + `success_measure` (~114 chars) + owner role + timeline
- Content is workflow-specific, not domain-generic — "Strategy and Growth Planning" is described differently from "Customer Segment Definition"

**What is still slightly generic:**
- Business impact for the same score band is repeated across different questions in the same domain: "Weakness in strategy and growth planning increases exposure to revenue plan attainment risk" appears identically for multiple questions
- Recommended fix: make impact language reference the specific operational consequence, not just the domain label

---

### DATA — Needs work

**Critical gap: All 21 recommendations have empty `recommendation_detail`**

The `recommendation_summary` field is populated (~184 chars avg) but `recommendation_detail` is blank for every single recommendation. In the advisory output and DOCX, this means the recommendation renders with summary text only — no rationale, no operational steps, no why.

**Finding depth is adequate but thin:**
- Finding text: ~142 chars (vs OPS: 277). Findings describe the issue but don't explain why it matters commercially.
- Example current: *"Leads, opportunities, customers, invoices, and KPI reports are being assembled from conflicting CRM exports..."*
- What's missing: the commercial consequence — *"This means revenue numbers cannot be reconciled, creating audit risk, delayed management response, and unreliable sales forecasting."*

**Actions are present (49) but short (~111 chars avg vs OPS ~353)**
- Actions describe what to do at a headline level but don't explain how
- Missing: key steps, owner specificity, timeline, success indicator

**What to add to DATA library:**
- `recommendation_detail` for all 21 recommendations (target: 200–400 chars each)
- Extend finding texts with explicit commercial consequence sentences
- Extend action texts with 3-step sequencing

---

### AIR — Needs work

**Findings and recommendations have better depth than DATA** (AIR has no empty detail fields), but the content is still too abstract.

**Finding text examples at current state:**
- *"Leadership interest in AI is present, but the business has not yet translated that interest into a defined commercial thesis..."*

This is directionally correct but doesn't name the consequence. What goes wrong when this isn't fixed? That sentence is missing.

**Recommendations are the strongest part of AIR:**
- `recommendation_detail` is populated for all 24 (AIR is better than DATA here)
- Example: *"Run an executive alignment exercise that names the business problems AI should address..."* — clear and actionable

**Actions are thin (~112 chars avg):**
- Current: *"Run an executive workshop that defines the AI thesis, top business problems, success outcomes, and sponsorship model."*
- Missing: who facilitates, what inputs are needed, how long it takes, what the output document looks like, what success looks like

**What to add to AIR library:**
- Consequence sentences added to all findings: what goes wrong commercially if this isn't fixed
- Action texts extended with pre-conditions, key steps, output artifact, and success indicator (target: 250–350 chars each)

---

### LEAK — Needs work

LEAK has a strong mathematical engine but the advisory content is underdeveloped.

**Finding quality is weakest across all modules (~116 chars avg):**
- Current: *"Control weakness around qualified lead volume leakage is increasing the chance that avoidable leakage will persist or go undetected."*
- This sentence is generic to every LEAK finding — the word "leakage" just substitutes in the core name
- There are only 18 findings for 9 cores × 2 score bands = correctly minimal, but each one needs to be more specific

**What makes LEAK findings weak:**
- They don't reference the actual numbers (the LEAK engine has them — actual vs benchmark)
- They don't explain what the driver gap means in business terms
- Recommended fix: LEAK findings should reference the driver name and commercial mechanism: *"Qualified Lead-to-Win Conversion is running at X% against a benchmark of Y%, meaning each additional lead that fails to convert costs the business approximately Z in unrealised revenue."*

**Recommendations and actions are adequate at headline level but thin on how:**
- Current action: *"Review proposal acceptance, loss reasons, stakeholder access, and deal follow-up quality to improve close performance."*
- Missing: what to review first, who owns the review, what output it should produce, what a 30-day remediation sprint looks like

**What to add to LEAK library:**
- Finding templates that reference the specific driver mechanism, not just the core name
- Actions extended with diagnosis steps, owner role, output artifact, timeline band

---

### AIUC — Structurally different, runtime-generated

AIUC has **no static finding/recommendation/action library** — all advisory content is generated at runtime from the use case scoring and dependency status (BLOCKED/CONDITIONALLY_READY/PILOT_READY).

This is architecturally correct for a prioritisation engine. The gap is that the **runtime-generated content is still thin**:

- Finding title: *"Lead Qualification Assistant is blocked"* — correct but no explanation
- Recommendation: *"Prepare Lead Qualification Assistant for a controlled pilot"* — correct but generic
- Action: *"Resolve prerequisites for Lead Qualification Assistant"* — not actionable enough

**What to improve in the AIUC runtime generator (`ai-usecase.ts`):**
- Use case descriptions (`usecase.usecase_description`) are available — surface them in findings
- Blocker names are computed (`opsPct < 60 → "operational maturity"`) — make them specific: *"OPS score is currently 38%. This means the process controls that Lead Qualification AI depends on are not yet reliable enough to govern the output."*
- Pilot-ready recommendations should include a pilot design template: scope, success metric, rollback condition

---

## Priority fix sequence

### P0 — DATA `recommendation_detail` gap (blocking for consulting delivery)
All 21 recommendations render with summary text only. This is the single highest-priority content fix.

### P1 — LEAK finding specificity
LEAK findings need to reference the specific driver mechanism. Currently all 18 findings are structurally identical.

### P1 — AIUC runtime narrative depth  
Blocker explanations should name the specific upstream score and explain the dependency mechanism.

### P2 — DATA/AIR action depth
Action texts need extending with steps, owner, artifact, and success measure.

### P2 — OPS finding differentiation
Business impact sentences are currently repeated within domains. Each question's impact should be differentiated.

### P3 — AIR finding consequence sentences
Add commercial consequence to all AIR findings.

---

## What "good" looks like — the OPS standard

A finding that is genuinely consulting-grade has all of:
1. **What is happening** — specific to the question, not the domain
2. **Why it matters commercially** — consequence if unresolved
3. **Likely cause** — not just "unclear ownership" — which ownership, between whom
4. **Score-band specific** — band 1-2 language is different from band 3 language

A recommendation that is consulting-grade has:
1. **What to do** — specific enough to brief a team
2. **Why this approach** — rationale, not just restatement
3. **Expected outcome** — measurable
4. **Priority level** — relative to other recommendations

An action that is consulting-grade has:
1. **Objective** — what this achieves
2. **Key steps** — at least 3, in sequence
3. **Owner role** — specific enough to assign
4. **Deliverable** — the output artifact
5. **Success measure** — how completion is confirmed
6. **Timeline** — realistic band

OPS meets all of these. DATA, AIR, LEAK, and AIUC need to reach the same standard.
