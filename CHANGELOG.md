# Kinto Global — Changelog

## v1.0.0-rc.4 (2026-03-31)

### Content — all three module gaps resolved

**DATA Foundation — 21 recommendation details written**
All recommendations now have a full `recommendation_detail` field averaging 461 chars.
Each one covers: what to do, why this approach, commercial consequence of inaction,
and expected outcome. Zero empty fields remain.

**Revenue Leakage — 18 finding texts rewritten**
Every finding now references the specific driver mechanism and revenue calculation logic.
Example: finding text for Qualified Lead-to-Win Conversion Leakage now explains the
revenue impact formula, names the driver responsible, and states the commercial consequence.
No longer structurally identical with just the core name swapped in.

**AI Readiness — 24 action details written**
All actions now have a full `action_detail` field averaging 574 chars.
Each one covers: specific steps to execute, who to involve, what the output document is,
what success looks like before moving on, and any prerequisites.

### Onboarding — new user guidance built

**GettingStarted panel (`/src/components/onboarding/getting-started.tsx`)**
Progressive 5-step guide shown on the workspace for new users:
create client → create assessment → score module → generate roadmap → generate report.
Current step highlighted with "Do this now" marker. Progress indicators per step.
Module selector guide (what each of the 5 modules covers). Scoring reference (1–5 scale).
Auto-dismisses when setup is complete. Manually dismissible.

**ModuleIntro banner (`/src/components/onboarding/module-intro.tsx`)**
Collapsible info banner at the top of each module's assessment tab. Covers:
what the module is for, how to score it, what outputs it produces, one specific tip.
Wired into all 5 modules (OPS, LEAK, DATA, AIR, AIUC). Auto-collapses once scoring starts.
Permanently dismissible per module.

### UX audit findings
- New user lands on workspace → immediate confusion (no context, two empty dropdowns)
- Fixed by GettingStarted panel explaining the sequence
- Module pages had no explanation of what they cover or how scoring works
- Fixed by ModuleIntro on every assessment tab
- Scoring scale (1–5) was never explained anywhere in the UI
- Fixed in GettingStarted and ModuleIntro

## v1.0.0-rc.3 (2026-03-31)

### Kinto AI — Claude assistant layer

**What the document defined — what was built:**

The clean boundary: Kinto calculates, decides, stores, controls, protects.
Claude explains, guides, summarises, supports.

**`/src/lib/assistant/providers.ts` — Multi-provider AI layer**
Supports OpenAI (primary), custom OpenAI-compatible endpoint, and Anthropic Claude
(fallback or explicit primary). Automatic fallback: if primary fails, Anthropic handles it.
SSE streaming normalised across all providers — the UI always receives plain text chunks
regardless of which provider answered. Provider selection invisible to users.

**`/src/app/api/assistant/route.ts` — Grounded assistant route**
Builds live platform context before every call: client name, module scores, executive
narratives, top 4 critical/high findings per module, P1 roadmap actions.
Five distinct system prompts — support, explainer, guidance, report, monitoring — each with
a non-negotiable boundary rule: NEVER change scores, modify data, or take platform actions.
Graceful `ASSISTANT_NOT_CONFIGURED` 503 when no API key is set.

**`/src/components/assistant/kinto-assistant.tsx` — Floating panel**
Teal gradient trigger button (bottom-right). 400×580px slide-in panel.
Dark header with five mode tabs: Help / Explain / What Next / Write / Health Check.
Starter prompts per mode. Streaming message rendering with inline markdown.
Listens for `kinto:explain` events so inline buttons anywhere open it pre-loaded.
Footer: "Explains only · Never changes scores or data".

**`/src/components/assistant/explain-button.tsx` — Inline context button**
Fires `kinto:explain` CustomEvent with the specific finding/action context.
Used on priority findings and roadmap cards in advisory view, and module score rows
in workspace. Opens the assistant pre-loaded with the right question.

**`/src/components/assistant/module-explain-row.tsx` — Server-component bridge**
Thin client wrapper that allows ExplainButton to appear in server-rendered tables
(workspace module portfolio) without converting the table to a client component.

**Wired in:**
- `app-frame.tsx` — assistant available on every page
- `advisory-view.tsx` — explain buttons on priority findings and P1 roadmap actions
- `workspace/page.tsx` — explain buttons on module score rows in portfolio table

**Configuration:**
Three env var options — OPENAI_API_KEY, ANTHROPIC_API_KEY, or custom endpoint.
Assistant is optional — platform works fully without it. If no key is configured,
the panel shows a "not configured" message rather than erroring silently.

### Content Quality Audit (separate document)

`CONTENT_QUALITY_AUDIT.md` — identifies specific gaps per module:
- DATA: all 21 recommendations have empty `recommendation_detail` (highest priority fix)
- LEAK: 18 findings structurally identical — financial figures not referenced in text
- AIR: action texts thin (~112 chars vs OPS ~353) — need key steps and deliverables
- AIUC: runtime-generated content thin — needs improvement in `ai-usecase.ts` generator
- OPS: consulting-grade benchmark — 531 findings, 177 recs, 177 actions with full depth

### SaaS Roadmap (separate document)

`SAAS_ROADMAP.md` — six-phase plan to multi-user subscription SaaS:
- Phase 1: Supabase Auth (4–6 weeks)
- Phase 2: Tenant isolation via RLS (3–4 weeks, with Phase 1)
- Phase 3: Role model — Admin / Consultant / Viewer (2–3 weeks)
- Phase 4: Stripe billing (3–4 weeks, parallel with Phase 3)
- Phase 5: Self-service onboarding (2 weeks)
- Phase 6: Production infrastructure (3–4 weeks)
Total: ~5–6 months with one focused developer. Core product unchanged.

## v1.0.0-rc.2 (2026-03-31)

### Priority Ordering & Sequencing

**Universal priority scoring (`src/lib/utils/priority.ts`)**  
Single source of truth for ordering: `sortByPriorityPhase` (phase → severity → rank) and `sortBySeverity` (severity → rank). Used across report, advisory view, and workspace.

**Report payload — sorted before slicing**  
All findings, recommendations, and actions are sorted by severity/phase before being mapped into module sections and before `slice()`. The top 12 findings in any report are the 12 most critical, not the 12 inserted first.

**`buildOrderedPlan()` — one plan for 1 or N modules**  
Produces a clean `immediate / near_term / later` numbered sequence from any set of module sections. The ordering logic is identical for a single-module engagement and an integrated programme — phase first, severity within phase.

**Single-module = complete engagement (not partial)**  
Standalone reports carry `engagement_framing` text explicitly stating this is a complete advisory engagement. The workspace labels single-module plans as `[Module Name] — Priority Action Plan` and states it is the full priority sequence.

**Advisory view — sorted**  
Findings render Critical → High → Developing. Roadmap items render P1 → P2 → P3, then by priority within phase. Both were previously in DB insertion order.

**Workspace — Priority Action Plan panel**  
New numbered action list in the workspace overview. "Do First" (P1, danger coloured) and "Do Next" (P2, warn coloured) with owner role shown per item. Detects single vs multi-module and adjusts label accordingly. Links to full roadmap.

**DOCX — Section 06b: Priority Action Plan**  
Numbered Do First → Do Next → Later before the full roadmap table. Each item shows title, why it matters, owner, and timeline.

**PPTX — Ordered Plan slide**  
Two-column slide: DO FIRST (P1 actions, red) | DO NEXT (P2 actions, amber) with numbered items.

## v1.0.0-rc.1 (2026-03-31)

First release candidate. License-ready baseline.

### Data Flow & Mapping Integrity (P0)
- **OPS advisory IDs now content-stable**: `OPS::FND::${aid}::${questionId}` replaces sequential index IDs. Finding → recommendation → action → roadmap chain now correctly traces to the same scored question via Maps keyed by `question_id`.
- **Generic module IDs already stable** (`DATA-F-${aid}-${qId}`): confirmed and verified.
- **AIUC stale response overcounting fixed**: `answered` count now cross-references against a Set of current library question IDs — stale DB rows no longer inflate the 114/90 figure.
- **LEAK scoring accuracy**: `actual === 0` → always false (no data ≠ within benchmark). Domain scoring uses answered-only denominator. `NOT_SCORED` shown on empty modules.

### Advisory Intelligence & Synthesis (P1)
- **All 5 modules now generate pattern-driven consulting narratives** — not template strings:
  - OPS: Workflow/domain pattern synthesis, root cause clustering, spread analysis, automation signal, metric coverage commentary.
  - DATA: Critical domain identification, structural constraint framing, transformation feasibility assessment.
  - AIR: Readiness blocker naming, dependency signal for AIUC sequencing, deployment confidence narrative.
  - AIUC: Full Pilot Now / Prepare First / Fix Foundations / Not Suitable prioritization narrative with upstream dependency framing and sequencing instructions.
- **Report payload builder** produces full consulting-narrative JSON: findings with observation/why it matters/likely cause/impact, recommendations with rationale/expected benefit/priority, actions with key steps/owner/timeline/success indicator, roadmap phased by P1/P2/P3.
- **DOCX renderer** produces a 9-section professional advisory report matching the brief's required structure.

### Revenue Leakage UX (P1)
- **SmartLeakField**: Replaces `type="number"` inputs. Percentage fields detect from name (`%`, `rate`, `conversion` etc.) — user types `30` for 30%. Currency/count fields format with locale grouping (`1 250 000`).
- **Currency selector**: ZAR / USD / AED / GBP / EUR dropdown stored in assessment profile state. Drives all `currency()` calls.
- **Layout**: Wider value columns, `word-break: break-all` on totals, no number overflow.

### Performance (P1)
- All 5 POST handlers Python-proxy-free. Fast-write + background recompute.
- Publications GET returns instantly when all 5 snapshots exist.
- `Promise.allSettled` parallel publication generation.
- Module-level reference bundle cache and in-memory assessment ID cache.

### Transformation Roadmap (P1)
- Single interactive Transformation Roadmap page (merged from Roadmap + Progress).
- Stage-based task model: Foundation / Design / Implementation / Validation / Embed.
- Confidence score separate from progress %. Progress derived from weighted task completion.
- Definition of done, evidence prompts, readiness warnings (not hard locks).
- Diagnostic score vs implementation progress comparison strip.

### Operational Readiness
- Package name: `kinto-global` v1.0.0-rc.1
- `.env.example` expanded with all required and optional variables.
- `OPERATIONS_RUNBOOK.md` added: setup, deployment, rollback, backup, health checks, role model, monitoring, release checklist.
- Known limitations documented.

---

## v0.9.2 (Previous — v75 build series)

See build history in session notes.
