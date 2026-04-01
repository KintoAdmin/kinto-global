# Kinto Global — Build v75 Final

## All changes in this build

---

### Bug fixes

**AIUC question count showing 114/90**
The `responses` array in Supabase can contain rows from previous library states
where AIUC had more questions. The `answered` count and `liveModuleScore` now
cross-reference against a `Set` of current library question IDs — stale rows
are excluded. Result: answered count can never exceed `questions.length`.

**OPS advisory chain broken (P0 data integrity)**
Finding → recommendation → action → roadmap rows were assembled using sequential
array indexes for IDs and cross-links. After filtering (e.g. only items with rec
text), `recommendations[2]` pointed to a different question than `findings[2]`.
All OPS advisory IDs are now content-stable: `OPS::FND::${assessmentId}::${questionId}`.
Cross-links use Maps keyed by `question_id` — every row traces to the same scored
question. Generic modules (DATA/AIR/AIUC) already used this pattern.

**LEAK 100% score with no data entered**
`withinBenchmark(0, 0, "Lower is better")` = `0 <= 0 = true`. All unentered
drivers counted as within benchmark → 100% score. Fixed with two layers:
(a) `actual === 0` → always `false`, (b) driver scoring uses answered-only
denominator (same as OPS/generic) so empty drivers don't deflate the score.
`NOT_SCORED` shown when no data entered.

---

### Revenue Leakage — input, formatting, currency

**Smart number input fields (`SmartLeakField`)**
Replaces `type="number"` `InlineNumberField` across all 12 input sites.
- Percentage fields (detected from field name — contains `%`, `rate`, `conversion`, etc.):
  user types `30` → stored as `30` → displayed as `30 %`. No decimals needed.
- Currency/count fields: user types `1250000` → displayed as `1 250 000` with locale formatting.
- All inputs accept plain numbers. Strips commas, spaces, currency symbols on parse.

**Global currency selector**
Currency profile field is now a `<select>` dropdown: ZAR, USD, AED, GBP, EUR.
Stored in assessment state. Drives every `currency()` call in the module.
`currency()` updated to use locale-correct formatting per currency code:
ZAR → `R 1 250 000`, USD → `$1,250,000`, AED → `AED 4,593,750`.

**Layout improvements**
- Table grid columns widened: `2.7fr 1fr 1fr` → `2.2fr 1.1fr 1.1fr`
- Number display cells use `word-break: break-all` — no more overflow
- `metric-panel strong` wraps correctly at any length
- Driver grid column widths balanced

---

### Scoring consistency (all 5 modules)

| Module | Formula |
|--------|---------|
| OPS | `mean(answeredScores) / 5 × 100` |
| DATA / AIR / AIUC | `mean(answeredScores) / 5 × 100` |
| LEAK | `within / capturedDrivers × 100` |

All modules show real maturity band as soon as any question/driver is scored.
`NOT_SCORED` only when no data has been entered at all.

---

### Transformation Roadmap

Interactive implementation tracker with:
- Initiative → Stage (Discover/Define/Build/Validate/Embed) → Task structure
- Task types: Foundation, Design, Implementation, Validation, Governance
- Confidence score (Low/Medium/High) separate from progress %
- Progress derived from weighted task completion (Foundation/Design = 1.5×)
- Definition of done per initiative
- Readiness warnings (not hard locks) for out-of-order task starts
- Guidance stored in sessionStorage per assessment

---

### Run

```bash
npm install && npm run dev:full
npm run qa:full-system      # expect 43/43
node e2e/kinto-diagnostics.mjs
```
