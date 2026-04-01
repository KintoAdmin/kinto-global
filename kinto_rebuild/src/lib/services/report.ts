// @ts-nocheck
/**
 * Kinto Global — Report Payload Builder
 * Produces rich consulting-narrative JSON payloads for DOCX/PPTX rendering.
 * Each payload carries the full structured content the renderer needs to produce
 * a professional advisory report — not a dashboard summary.
 */
import { getWorkspaceSnapshot } from "@/lib/services/workspace";
import { publishAllModulesForAssessment } from "@/lib/interoperability/publish-all";
import { publishOperationalAuditPublication } from "@/lib/modules/ops-audit/publication";
import { publishRevenueLeakagePublication } from "@/lib/modules/revenue-leakage/publication";
import { publishDataFoundationPublication } from "@/lib/modules/data-foundation/publication";
import { publishAiReadinessPublication } from "@/lib/modules/ai-readiness/publication";
import { publishAiUseCasesPublication } from "@/lib/modules/ai-use-cases/publication";
import { modulePublicationRepository } from "@/lib/interoperability/publication-repository";
import type { ModuleCode } from "@/lib/interoperability/enums";
import { MODULE_LABELS } from "@/lib/interoperability/enums";
import {
  artifactIdFor, getReportInstance, listArtifacts, listReportInstances,
  replaceArtifacts, reportInstanceIdFor, upsertReportRecord,
} from "@/lib/repositories/report-delivery";
import { generateDocumentArtifacts } from "@/lib/services/document-generator";
import { nowIso } from "@/lib/utils/ids";
import { sortByPriorityPhase, sortBySeverity, phaseWeight, severityWeight } from "@/lib/utils/priority";
import { getAssessmentSnapshot, getModuleSnapshot, rebuildAssessmentSnapshot } from "@/lib/repositories/foundation";

// ── Utility ────────────────────────────────────────────────────────────────
function num(v: unknown, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
function pct(v: unknown) { return `${num(v).toFixed(1)}%`; }
function slug(v: string) { return String(v || "report").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "report"; }
function band(v: unknown) { const r = String(v || "").trim(); if (!r) return "Not scored"; return r.replaceAll("_", " ").replace(/\b\w/g, m => m.toUpperCase()); }
function maturityNarrative(score: number, moduleName: string): string {
  if (score <= 0) return `${moduleName} has not yet been scored.`;
  if (score < 40) return `${moduleName} is currently in a critical and weak state (${pct(score)}), with material gaps in process design, ownership, and execution consistency. Immediate remediation is required.`;
  if (score < 60) return `${moduleName} is developing (${pct(score)}), indicating some foundational elements are in place but execution remains inconsistent. Targeted improvements are needed to reach a managed standard.`;
  if (score < 80) return `${moduleName} is operating at a managed level (${pct(score)}). The core framework is established, but opportunities exist to strengthen consistency, governance, and measurability.`;
  return `${moduleName} is performing at a strong level (${pct(score)}). The fundamentals are well-established and the focus should shift to optimisation and sustained performance.`;
}
function priorityLabel(score: number): string {
  if (score < 40) return "Critical";
  if (score < 60) return "High";
  if (score < 80) return "Medium";
  return "Low";
}
function phaseFromPriority(priority: string, score: number): string {
  if (priority === "Critical" || score < 40) return "P1 — Stabilise & Protect";
  if (priority === "High"     || score < 60) return "P2 — Standardise & Strengthen";
  return "P3 — Optimise, Automate & AI-Enable";
}
function reportTitle(ctx: any, moduleCode?: string | null) {
  if (moduleCode) return `${ctx.client_name} — ${MODULE_LABELS[moduleCode]} Assessment Report`;
  return `${ctx.client_name} — Executive Diagnostic Report`;
}
function reportSubtitle(ctx: any) {
  const date = ctx.assessment_date ? new Date(ctx.assessment_date).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" }) : new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
  return `${ctx.assessment_name}  ·  ${date}`;
}
function formatMoney(v: unknown, currency = "ZAR") {
  const n = Math.abs(num(v));
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

// ── Finding builder ────────────────────────────────────────────────────────
function buildFinding(raw: any, moduleCode: string, index: number) {
  const score = num(raw.severity === "critical" || raw.severity === "high" ? 1 : raw.severity === "medium" ? 2 : 3);
  const priority = raw.severity === "critical" ? "Critical" : raw.severity === "high" ? "High" : raw.severity === "medium" ? "Medium" : "Low";
  return {
    number:         index + 1,
    title:          raw.title || raw.finding_title || "Operational Gap Identified",
    observation:    raw.summary || raw.finding_narrative || raw.description || "Refer to evidence review.",
    why_it_matters: raw.business_impact || `This gap affects the consistency and reliability of ${MODULE_LABELS[moduleCode]} delivery, creating risk to commercial performance, management control, and operational scalability.`,
    likely_cause:   raw.likely_root_cause || "The root cause is likely related to unclear ownership, inconsistent process design, or insufficient governance cadence. Validation is recommended during the action phase.",
    impact:         raw.business_impact || raw.summary || "Without remediation, this will continue to constrain performance, limit visibility, and increase execution risk.",
    severity:       priority,
    module_code:    moduleCode,
    module_name:    MODULE_LABELS[moduleCode] || moduleCode,
    phase:          phaseFromPriority(priority, score),
    source_finding_id: raw.finding_code || raw.source_library_id || "",
  };
}

// ── Recommendation builder ─────────────────────────────────────────────────
function buildRecommendation(raw: any, moduleCode: string, index: number) {
  return {
    number:           index + 1,
    title:            raw.title || raw.recommendation_title || "Process Improvement Required",
    detail:           raw.summary || raw.recommendation_text || "A targeted improvement initiative is recommended to address the identified gap.",
    rationale:        raw.expected_outcome ? `This recommendation directly addresses the identified weakness. ${raw.expected_outcome}` : `This recommendation directly addresses the identified weakness and is designed to improve control quality, execution consistency, and management visibility within ${MODULE_LABELS[moduleCode]}.`,
    expected_benefit: raw.expected_outcome || `Improved control, clearer ownership, and stronger execution consistency within ${MODULE_LABELS[moduleCode]}.`,
    priority:         raw.priority || "High",
    module_code:      moduleCode,
    module_name:      MODULE_LABELS[moduleCode] || moduleCode,
  };
}

// ── Action builder ─────────────────────────────────────────────────────────
function buildAction(raw: any, moduleCode: string, index: number) {
  const title = raw.title || raw.action_title || `Implement ${MODULE_LABELS[moduleCode]} improvement`;
  const summary = raw.summary || raw.action_text || raw.description || "";
  const owner = raw.owner_role || "Functional Owner / Operations Lead";
  const timeline = raw.timeline || raw.indicative_timeline || raw.timeline_band || "30–60 days";
  const success = raw.success_measure || raw.action_deliverable || "Confirmed by management review and evidence of adoption in live operations.";
  const priority = raw.priority || "High";
  const phase = raw.phase || phaseFromPriority(priority, priority === "High" ? 35 : 60);

  return {
    number:             index + 1,
    title,
    objective:          summary || `Resolve the identified gap in ${MODULE_LABELS[moduleCode]} to improve control, visibility, and execution quality.`,
    key_steps: [
      `Confirm ownership and accountability for this initiative with the relevant senior stakeholder.`,
      `Conduct a focused review of current state to validate the finding and agree on the target standard.`,
      `Design and implement the required process, system, or governance change.`,
      `Communicate the change to all affected teams and confirm adoption through a structured review.`,
      success !== "Confirmed by management review and evidence of adoption in live operations." ? success : `Monitor performance against the agreed success indicator for a minimum of 30 days post-implementation.`,
    ],
    owner_role:         owner,
    indicative_timeline:timeline,
    success_indicator:  success,
    priority,
    phase,
    module_code:        moduleCode,
    module_name:        MODULE_LABELS[moduleCode] || moduleCode,
  };
}

// ── Roadmap item builder ───────────────────────────────────────────────────
function buildRoadmapItem(raw: any, moduleCode: string, index: number) {
  return {
    number:        index + 1,
    phase:         raw.phase || raw.phase_code || "P2 — Standardise & Strengthen",
    phase_code:    raw.phase_code || (raw.phase || "").slice(0, 2) || "P2",
    initiative:    raw.action || raw.initiative_title || raw.milestone_name || raw.title || "Transformation initiative",
    description:   raw.summary || raw.initiative_description || raw.description || "",
    business_outcome: raw.business_outcome || raw.target_outcome || "",
    owner_role:    raw.owner_role || "Operations Lead",
    timeline:      raw.timeline || raw.indicative_timeline || "30–90 days",
    priority:      raw.priority || "High",
    module_code:   moduleCode,
    module_name:   MODULE_LABELS[moduleCode] || moduleCode,
    linked_metric: raw.linked_metric_id || "",
    source_finding: raw.source_finding_instance_id || "",
  };
}

// ── Module section builder ─────────────────────────────────────────────────
function buildModuleSection(publication: any) {
  const moduleCode: string = publication.module_code;
  const moduleName = MODULE_LABELS[moduleCode] || moduleCode;
  const score = num(publication.summary?.normalized_percent);
  const scoreBand = band(publication.summary?.band);
  const executiveSummary = publication.summary?.executive_summary || "";

  const areaScores = (publication.area_scores || []).map((a: any) => ({
    name:       a.area_name,
    score:      num(a.normalized_percent),
    band:       band(a.band),
    priority:   priorityLabel(num(a.normalized_percent)),
  }));

  // Sort source rows by priority before mapping — ensures output is ordered
  const sortedFindings = [...(publication.findings || [])].sort(sortBySeverity);
  const sortedRecs     = [...(publication.recommendations || [])].sort(sortBySeverity);
  const sortedActions  = [...(publication.actions || [])].sort(sortByPriorityPhase);
  const sortedRoadmap  = [...(publication.roadmap_items || [])].sort(sortByPriorityPhase);

  const findings       = sortedFindings.map((f: any, i: number) => buildFinding(f, moduleCode, i));
  const recommendations = sortedRecs.map((r: any, i: number) => buildRecommendation(r, moduleCode, i));
  const actions        = sortedActions.map((a: any, i: number) => buildAction(a, moduleCode, i));
  const roadmapItems   = sortedRoadmap.map((r: any, i: number) => buildRoadmapItem(r, moduleCode, i));
  const metrics        = (publication.metrics         || []).slice(0, 8).map((m: any) => ({
    name:      m.metric_name,
    unit:      m.unit || "",
    baseline:  m.baseline_value,
    current:   m.current_value,
    target:    m.target_value,
    variance:  m.variance_value,
    direction: m.direction || "",
    rag:       m.rag_status || "",
  }));

  // Identify weakest and strongest areas
  const sorted = [...areaScores].sort((a, b) => a.score - b.score);
  const weakest  = sorted.slice(0, 3).filter(a => a.score < 70).map(a => a.name);
  const strongest = sorted.reverse().slice(0, 2).filter(a => a.score >= 60).map(a => a.name);

  const currentStateNarrative = (() => {
    const lines = [];
    lines.push(maturityNarrative(score, moduleName));
    if (executiveSummary) lines.push(executiveSummary);
    if (strongest.length) lines.push(`The areas of relative strength within this module include ${strongest.join(" and ")}, which provide a foundation to build from.`);
    if (weakest.length) lines.push(`The areas requiring the most immediate attention are ${weakest.join(", ")}, where current performance is below the required standard and corrective action is overdue.`);
    if (findings.length) lines.push(`This assessment has surfaced ${findings.length} finding${findings.length !== 1 ? "s" : ""} across the module, with ${findings.filter(f => f.severity === "Critical" || f.severity === "High").length} assessed as Critical or High priority.`);
    return lines.join(" ");
  })();

  // Cross-cutting themes
  const crossCuttingThemes = [];
  if (weakest.length >= 2) crossCuttingThemes.push(`${weakest.slice(0, 2).join(" and ")} are both underperforming, suggesting a systemic gap in this area rather than an isolated issue.`);
  if (findings.filter(f => (f.likely_cause || "").toLowerCase().includes("ownership")).length >= 2) crossCuttingThemes.push("Multiple findings point to unclear ownership as a contributing factor, suggesting that an accountability framework needs to be established as a foundation for other improvements.");
  if (metrics.length) crossCuttingThemes.push("The metric evidence captured supports the qualitative findings and should be used to baseline performance and track improvement over time.");

  return {
    module_code:       moduleCode,
    module_name:       moduleName,
    score,
    score_band:        scoreBand,
    maturity_label:    scoreBand,
    priority_level:    priorityLabel(score),
    current_state:     currentStateNarrative,
    area_scores:       areaScores,
    cross_cutting_themes: crossCuttingThemes,
    findings,
    recommendations,
    actions,
    roadmap_items:     roadmapItems,
    metrics,
    transition_note:   findings.length > 0
      ? `Taken together, these findings suggest that ${moduleName.toLowerCase()} requires structured intervention to move from its current state to a consistently managed standard. The recommendations and actions below provide a sequenced path forward.`
      : `The assessment did not surface material findings in this module at this stage. This may reflect genuine maturity or may indicate that scoring has not yet been completed in full.`,
    expected_outcomes: [
      `${moduleName} reaches a consistently managed operating standard, with clear ownership, documented processes, and visible KPIs.`,
      `The priority findings identified in this assessment are resolved within the timeframes defined in the action plan.`,
      `Management has reliable visibility over performance in this area, enabling faster issue identification and course correction.`,
    ],
  };
}

// ── Integrated executive summary ───────────────────────────────────────────
function buildIntegratedExecSummary(publications: any[], ctx: any) {
  const scored  = publications.filter(p => num(p.summary?.normalized_percent) > 0);
  const sorted  = [...scored].sort((a, b) => num(a.summary?.normalized_percent) - num(b.summary?.normalized_percent));
  const weakest = sorted[0];
  const avgScore = scored.length ? scored.reduce((s, p) => s + num(p.summary?.normalized_percent), 0) / scored.length : 0;

  const leakPub = publications.find(p => p.module_code === "revenue_leakage");
  const leakMetric = (leakPub?.metrics || []).find((m: any) => num(m.variance_value) > 0 || num(m.current_value) > 0);
  const financialImpact = leakMetric
    ? `Revenue leakage is estimated at ${formatMoney(Math.abs(num(leakMetric.variance_value) || num(leakMetric.current_value)))} based on current data. This represents the quantified portion of commercial exposure; total exposure including operational and data risk is likely higher.`
    : "Revenue and commercial exposure has been identified across multiple modules. Quantification requires the leakage engine inputs to be completed.";

  const criticalModules = sorted.filter(p => num(p.summary?.normalized_percent) < 40).map(p => MODULE_LABELS[p.module_code]);
  const developingModules = sorted.filter(p => { const s = num(p.summary?.normalized_percent); return s >= 40 && s < 65; }).map(p => MODULE_LABELS[p.module_code]);

  const keyStrengths = publications
    .filter(p => num(p.summary?.normalized_percent) >= 65)
    .map(p => `${MODULE_LABELS[p.module_code]} (${pct(p.summary?.normalized_percent)})`);

  const keyWeaknesses = sorted.slice(0, 3)
    .filter(p => num(p.summary?.normalized_percent) < 65)
    .map(p => `${MODULE_LABELS[p.module_code]} (${pct(p.summary?.normalized_percent)})`);

  const allActions = publications.flatMap(p => (p.actions || []).map((a: any) => ({ ...a, module_name: MODULE_LABELS[p.module_code], module_code: p.module_code })));
  const topPriorities = allActions
    .filter(a => a.priority === "high" || a.priority === "High" || a.priority === "critical" || a.priority === "Critical")
    .slice(0, 5)
    .map(a => `${a.title} (${a.module_name})`);

  const headline = weakest
    ? `This diagnostic assessment identifies material performance gaps across ${ctx.client_name}'s operational, commercial, and capability landscape, with the most significant exposure concentrated in ${MODULE_LABELS[weakest.module_code]}. The overall portfolio maturity sits at ${pct(avgScore)}, reflecting a business that has established foundational processes in several areas but requires targeted intervention to reach a consistently managed standard.`
    : `This diagnostic assessment provides a structured view of ${ctx.client_name}'s operational, commercial, data, and AI readiness landscape. The findings identify specific areas for improvement and define a prioritised action roadmap.`;

  const assessmentContext = `This report presents the findings from a structured diagnostic assessment conducted across ${publications.length} operational and capability modules. The assessment was designed to identify performance gaps, quantify commercial exposure, and define a prioritised improvement roadmap for ${ctx.client_name}. Each module has been evaluated against a defined maturity framework, with findings, recommendations, and actions produced at the question and domain level.`;

  const biggestRisks = [];
  if (criticalModules.length) biggestRisks.push(`Critical maturity gaps in ${criticalModules.join(" and ")} create immediate operational and commercial risk.`);
  biggestRisks.push("Revenue leakage across commercial, billing, and retention processes represents the most quantifiable near-term exposure.");
  if (developingModules.length) biggestRisks.push(`${developingModules.join(", ")} ${developingModules.length === 1 ? "is" : "are"} in a developing state and risk becoming structural constraints on growth if not addressed.`);

  const biggestOpportunities = [];
  if (keyStrengths.length) biggestOpportunities.push(`${keyStrengths[0]} provides a strong foundation that can be leveraged to accelerate improvement in adjacent areas.`);
  biggestOpportunities.push("A focused P1 remediation effort on the highest-priority findings across OPS and LEAK would deliver rapid, measurable commercial improvement within 30–60 days.");
  biggestOpportunities.push("Strengthening data foundations and AI readiness now positions the business to deploy targeted AI use cases in the near term, compressing competitive development timelines.");

  return {
    headline,
    assessment_context: assessmentContext,
    overall_view: `The diagnostic has assessed ${publications.length} modules covering operational audit, revenue leakage, data foundation, AI readiness, and AI use case prioritisation. The portfolio average maturity score is ${pct(avgScore)}. ${criticalModules.length ? `${criticalModules.length} module(s) are in a critical state (below 40%).` : ""} ${developingModules.length ? `${developingModules.length} module(s) are developing (40–65%).` : ""}`,
    key_strengths:     keyStrengths.length ? keyStrengths : ["Assessment is in progress — strengths will be confirmed as scoring is completed."],
    key_weaknesses:    keyWeaknesses.length ? keyWeaknesses : ["Full scope assessment required to confirm weaknesses."],
    biggest_risks:     biggestRisks,
    biggest_opportunities: biggestOpportunities,
    top_strategic_priorities: topPriorities.length ? topPriorities : allActions.slice(0, 5).map(a => `${a.title} (${a.module_name})`),
    financial_impact:  financialImpact,
    conclusion:        `Leadership should treat this report as an input to a structured transformation programme rather than a one-time diagnostic. The recommended next step is to confirm the top three priorities from the P1 phase, assign ownership, and establish a governance cadence to track progress. Revisiting the diagnostic in 60–90 days to measure improvement will confirm whether the actions are delivering the intended outcomes.`,
  };
}

// ── Module executive summary ───────────────────────────────────────────────
function buildModuleExecSummary(publication: any) {
  const moduleCode = publication.module_code;
  const moduleName = MODULE_LABELS[moduleCode];
  const score = num(publication.summary?.normalized_percent);
  const scoreBand = band(publication.summary?.band);
  const findings = publication.findings || [];
  const criticalCount = findings.filter((f: any) => f.severity === "critical" || f.severity === "high").length;

  const headline = `${moduleName} is currently assessed at ${pct(score)} (${scoreBand}). ${
    score < 40 ? "The module requires immediate remediation to address critical gaps in process design, ownership, and execution." :
    score < 65 ? "While some foundational elements are in place, significant gaps in consistency and governance are constraining performance." :
    "The module is well-established, with opportunities to strengthen consistency and move toward optimisation."
  }`;

  const assessmentContext = `This report presents the findings from a detailed assessment of ${moduleName} conducted as part of ${publication.context?.assessment_name || "the Kinto Global diagnostic programme"}. The assessment evaluated ${scoreBand === "Not scored" ? "the module structure" : `${findings.length} specific areas`} across the module, identifying gaps, root causes, and a prioritised improvement roadmap. ${criticalCount > 0 ? `${criticalCount} finding(s) have been assessed as Critical or High priority and require immediate attention.` : ""}`;

  return {
    headline,
    assessment_context:  assessmentContext,
    overall_view:        `${moduleName} scored ${pct(score)} (${scoreBand}). ${maturityNarrative(score, moduleName)}`,
    key_strengths:       (publication.area_scores || []).filter((a: any) => num(a.normalized_percent) >= 65).map((a: any) => `${a.area_name} (${pct(a.normalized_percent)})`),
    key_weaknesses:      (publication.area_scores || []).filter((a: any) => num(a.normalized_percent) < 65 && num(a.normalized_percent) > 0).sort((a: any, b: any) => num(a.normalized_percent) - num(b.normalized_percent)).slice(0, 3).map((a: any) => `${a.area_name} (${pct(a.normalized_percent)})`),
    biggest_risks:       criticalCount > 0 ? [`${criticalCount} Critical/High priority finding(s) require immediate action to prevent escalating operational or commercial risk.`] : [],
    top_priorities:      (publication.actions || []).slice(0, 3).map((a: any) => a.title || a.action_title),
    financial_impact:    moduleCode === "revenue_leakage" ? "Revenue and margin exposure should be treated as immediate." : "Primary impact is operational readiness, control quality, and execution reliability.",
    conclusion:          `The recommended next step for ${moduleName} is to confirm ownership of the top-priority actions, establish a review cadence, and target measurable progress within the first 30-day sprint.`,
  };
}

// ── Cross-cutting themes ───────────────────────────────────────────────────
function buildCrossCuttingThemes(publications: any[]) {
  const themes = [];
  const allFindings = publications.flatMap(p => (p.findings || []).map((f: any) => ({ ...f, module: MODULE_LABELS[p.module_code] })));

  // Ownership theme
  const ownershipFindings = allFindings.filter(f => (f.likely_root_cause || f.summary || "").toLowerCase().includes("owner"));
  if (ownershipFindings.length >= 2) {
    themes.push({
      title:       "Ownership and Accountability Gaps",
      observation: "Findings across multiple modules point to unclear or absent ownership as a recurring root cause. Where accountability is not clearly assigned, process gaps persist and improvement initiatives lose momentum.",
      affected_modules: [...new Set(ownershipFindings.slice(0, 4).map(f => f.module))],
      recommendation: "Establish a clear ownership matrix across all diagnostic modules before proceeding with specific process improvements. Define named accountable roles and confirm them with senior leadership."
    });
  }

  // Data and visibility theme
  const dataModules = publications.filter(p => ["data_foundation", "ops_audit"].includes(p.module_code) && num(p.summary?.normalized_percent) < 65);
  if (dataModules.length >= 2) {
    themes.push({
      title:       "Data Visibility and Reporting Quality",
      observation: "Data foundation and operational reporting gaps are limiting management's ability to monitor performance accurately and respond to issues in a timely way. This affects decision quality across all modules.",
      affected_modules: dataModules.map(p => MODULE_LABELS[p.module_code]),
      recommendation: "Prioritise the data foundation improvement track as an enabler for all other module improvements. Strong data foundations compound the value of every other initiative."
    });
  }

  // AI readiness dependency theme
  const airPub = publications.find(p => p.module_code === "ai_readiness");
  const aiucPub = publications.find(p => p.module_code === "ai_use_cases");
  if (airPub && aiucPub && num(airPub.summary?.normalized_percent) < 60) {
    themes.push({
      title:       "AI Readiness as a Prerequisite for Use Case Delivery",
      observation: "AI use cases have been identified as commercially viable opportunities, but the current AI readiness score indicates that foundational controls, governance, and data quality are not yet at the level required for confident deployment.",
      affected_modules: ["AI Readiness", "AI Use Cases"],
      recommendation: "Focus AI readiness improvements in P1 and P2 so that the highest-priority AI use cases can be deployed with appropriate confidence and governance in P3."
    });
  }

  // Revenue protection theme
  const leakPub = publications.find(p => p.module_code === "revenue_leakage");
  const opsPub  = publications.find(p => p.module_code === "ops_audit");
  if (leakPub && opsPub && (num(leakPub.summary?.normalized_percent) < 70 || num(opsPub.summary?.normalized_percent) < 60)) {
    themes.push({
      title:       "Revenue Protection Requires Operational Discipline",
      observation: "Revenue leakage and operational execution performance are interdependent. Gaps in process ownership, billing discipline, and pipeline management collectively reduce the revenue that is captured and recognised. Improving one without the other yields limited and short-lived gains.",
      affected_modules: ["Revenue Leakage", "Operational Audit"],
      recommendation: "Treat revenue protection and operational improvement as a single coordinated programme rather than separate module workstreams."
    });
  }

  return themes;
}

// ── Integrated strategic priorities ───────────────────────────────────────
function buildStrategicPriorities(publications: any[]) {
  const allActions = publications.flatMap(p =>
    (p.actions || []).map((a: any, i: number) => buildAction(a, p.module_code, i))
  );

  const p1 = allActions.filter(a => a.phase.startsWith("P1")).slice(0, 5);
  const p2 = allActions.filter(a => a.phase.startsWith("P2")).slice(0, 5);
  const p3 = allActions.filter(a => a.phase.startsWith("P3")).slice(0, 4);

  return { p1, p2, p3 };
}

// ── Expected outcomes (integrated) ────────────────────────────────────────
function buildExpectedOutcomes(publications: any[], ctx: any) {
  return [
    `${ctx.client_name} achieves a minimum average diagnostic score of 65% across all five modules within 90 days of beginning the P1 improvement programme.`,
    "Revenue leakage exposure is reduced by a material and measurable amount within the first 60 days, validated by a repeat leakage engine calculation.",
    "All Critical and High priority findings are assigned owners, have active improvement plans, and show evidence of progress within 30 days of this report being received.",
    "A standardised KPI reporting framework is in place within 60 days, providing management with a consistent and reliable view of operational and commercial performance.",
    "AI readiness reaches a sufficient threshold to begin piloting the top two AI use cases identified in the AIUC module assessment.",
    "The transformation roadmap is being actively managed with a regular governance cadence, confirmed owner accountability, and visible progress tracking.",
  ];
}

// ── Closing advisory note ──────────────────────────────────────────────────
function buildClosingNote(ctx: any, publications: any[]) {
  const avgScore = publications.filter(p => num(p.summary?.normalized_percent) > 0)
    .reduce((s, p, _, arr) => s + num(p.summary?.normalized_percent) / arr.length, 0);
  return {
    title:   "Closing Advisory Note",
    message: `This diagnostic report represents a point-in-time assessment of ${ctx.client_name}'s operational, commercial, and capability landscape. The findings are evidence-led and have been produced through a structured assessment methodology applied consistently across all five modules.\n\nThe most important next step is execution. A well-designed improvement roadmap creates value only when it is actively managed. We recommend that ${ctx.client_name} appoints a transformation lead or programme owner to govern the roadmap, and that the top three P1 priorities are formally initiated within two weeks of this report being approved by leadership.\n\nKinto Global is available to support the implementation of these priorities, facilitate review sessions, and provide advisory input as the programme progresses. We recommend a 60-day checkpoint to revisit the diagnostic and confirm whether the scores are moving in the right direction.\n\nThe current portfolio average of ${pct(avgScore)} reflects a business with genuine capability and commercial ambition. With focused, accountable improvement action, the pathway to a managed or strong performance standard is achievable within a realistic timeframe.`,
  };
}

// ── Full integrated payload ────────────────────────────────────────────────
function buildIntegratedPayload(context: any, publications: any[]) {
  const moduleSections   = publications.map(buildModuleSection);
  const executiveSummary = buildIntegratedExecSummary(publications, context);
  const crossCutting     = buildCrossCuttingThemes(publications);
  const strategic        = buildStrategicPriorities(publications);
  const outcomes         = buildExpectedOutcomes(publications, context);
  const closing          = buildClosingNote(context, publications);

  // Sort all outputs globally: phase first, then severity, then priority_rank
  const allFindings        = moduleSections.flatMap(m => m.findings).sort(sortBySeverity);
  const allRecommendations = moduleSections.flatMap(m => m.recommendations).sort(sortBySeverity);
  const allActions         = moduleSections.flatMap(m => m.actions).sort(sortByPriorityPhase);
  const allRoadmap         = moduleSections.flatMap(m => m.roadmap_items).sort(sortByPriorityPhase);

  return {
    report_kind:          "integrated",
    title:                reportTitle(context),
    subtitle:             reportSubtitle(context),
    generated_at:         nowIso(),
    context,
    executive_summary:    executiveSummary,
    module_scores:        publications.map(p => ({
      module_code:    p.module_code,
      module_name:    MODULE_LABELS[p.module_code],
      score:          num(p.summary?.normalized_percent),
      score_band:     band(p.summary?.band),
      priority:       priorityLabel(num(p.summary?.normalized_percent)),
      findings_count: (p.findings || []).length,
      critical_count: (p.findings || []).filter((f: any) => f.severity === "critical" || f.severity === "high").length,
    })),
    cross_cutting_themes: crossCutting,
    module_sections:      moduleSections,
    strategic_priorities: strategic,
    consolidated: {
      findings:        allFindings,
      recommendations: allRecommendations,
      actions:         allActions,
      roadmap:         allRoadmap,
    },
    expected_outcomes: outcomes,
    closing_note:      closing,
    ordered_plan:      buildOrderedPlan(moduleSections),
    engagement_framing: `This integrated report covers ${publications.length} diagnostic module${publications.length !== 1 ? "s" : ""} and constitutes a complete business improvement programme. The plan below sequences all priority actions across modules into a single ordered path forward — from immediate stabilisation through to optimisation and AI enablement.`,
    // Legacy fields kept for backward compatibility with the PPTX renderer
    business_performance_overview: { scores: publications.map(p => ({ name: MODULE_LABELS[p.module_code], percentage: num(p.summary?.normalized_percent), band: band(p.summary?.band) })) },
    key_findings:          allFindings.slice(0, 12),
    financial_impact:      publications.filter(p => p.module_code === "revenue_leakage").flatMap(p => (p.metrics || []).slice(0, 5).map((m: any) => ({ label: m.metric_name, value: m.variance_value ? formatMoney(Math.abs(num(m.variance_value))) : String(m.current_value || "Evidence review") }))),
    strategic_priorities_flat: allActions.slice(0, 10).map(a => ({ initiative: a.title, impact: a.objective, effort: a.indicative_timeline, priority_score: a.module_name })),
    ai_opportunities:      publications.filter(p => p.module_code === "ai_use_cases").flatMap(p => (p.recommendations || []).slice(0, 8).map((r: any) => ({ use_case: r.title || r.recommendation_title, outcome: r.expected_outcome || r.summary }))),
    implementation_roadmap: allRoadmap.slice(0, 15),
    expected_outcomes:     outcomes,
    publications,
    markdown: [
      `# ${reportTitle(context)}`, reportSubtitle(context), "",
      `## Executive Summary`, executiveSummary.headline, "",
      executiveSummary.assessment_context, "",
      "## Key Findings",
      ...allFindings.slice(0, 12).map(f => `### Finding ${f.number}: ${f.title}\n**Observation:** ${f.observation}\n**Impact:** ${f.impact}`),
      "", "## Priority Actions",
      ...allActions.slice(0, 10).map(a => `### Action ${a.number}: ${a.title}\n**Objective:** ${a.objective}\n**Owner:** ${a.owner_role}\n**Timeline:** ${a.indicative_timeline}`),
    ].join("\n"),
  };
}

// ── Standalone module payload ──────────────────────────────────────────────

// ── Ordered Plan — works for 1 module or N modules ──────────────────────────
// Produces a clean, numbered sequence of actions the user should take.
// Used in both standalone and integrated payloads.
function buildOrderedPlan(sectionOrSections: any | any[]): {
  summary: string;
  immediate: { number: number; title: string; owner: string; why: string; timeline: string }[];
  near_term: { number: number; title: string; owner: string; why: string; timeline: string }[];
  later: { number: number; title: string; owner: string; why: string; timeline: string }[];
} {
  const sections = Array.isArray(sectionOrSections) ? sectionOrSections : [sectionOrSections];
  const allActions = sections.flatMap((s: any) => s.actions || []).sort(sortByPriorityPhase);
  const allFindings = sections.flatMap((s: any) => s.findings || []).sort(sortBySeverity);

  const immediate = allActions.filter((a: any) => phaseWeight(a.phase) === 1).slice(0, 5);
  const nearTerm  = allActions.filter((a: any) => phaseWeight(a.phase) === 2).slice(0, 5);
  const later     = allActions.filter((a: any) => phaseWeight(a.phase) >= 3).slice(0, 4);

  const critCount = allFindings.filter((f: any) => severityWeight(f.severity) <= 2).length;
  const totalActions = allActions.length;

  let summary = '';
  if (immediate.length > 0) {
    summary = `The ${totalActions} actions in this plan are sequenced across three phases. `;
    summary += `There ${immediate.length === 1 ? 'is' : 'are'} ${immediate.length} immediate action${immediate.length !== 1 ? 's' : ''} to complete within the first 30 days`;
    if (critCount > 0) summary += `, responding to ${critCount} critical finding${critCount !== 1 ? 's' : ''}`;
    summary += '.';
    if (nearTerm.length > 0) summary += ` ${nearTerm.length} further action${nearTerm.length !== 1 ? 's' : ''} follow in the 30–90 day window.`;
    if (later.length > 0) summary += ` ${later.length} optimisation and automation action${later.length !== 1 ? 's' : ''} are sequenced beyond 90 days.`;
  } else {
    summary = `${totalActions} action${totalActions !== 1 ? 's have' : ' has'} been identified. Complete the assessment scoring to generate a fully sequenced action plan.`;
  }

  const mapToStep = (a: any, offset: number) => ({
    number:   Number(a.number || offset),
    title:    a.title,
    owner:    a.owner_role || 'Owner to confirm',
    why:      a.objective || a.summary || '',
    timeline: a.indicative_timeline || 'To be confirmed',
  });

  return {
    summary,
    immediate: immediate.map((a: any, i: number) => mapToStep(a, i + 1)),
    near_term: nearTerm.map((a: any, i: number) => mapToStep(a, immediate.length + i + 1)),
    later:     later.map((a: any, i: number) => mapToStep(a, immediate.length + nearTerm.length + i + 1)),
  };
}

function buildStandalonePayload(publication: any) {
  const context    = publication.context;
  const section    = buildModuleSection(publication);
  const execSummary = buildModuleExecSummary(publication);

  return {
    report_kind:       "module",
    module_code:       publication.module_code,
    title:             reportTitle(context, publication.module_code),
    subtitle:          reportSubtitle(context),
    generated_at:      nowIso(),
    context,
    executive_summary: execSummary,
    module_section:    section,
    module_scores:     [{ module_code: publication.module_code, module_name: section.module_name, score: section.score, score_band: section.score_band, priority: section.priority_level, findings_count: section.findings.length, critical_count: section.findings.filter(f => f.severity === "Critical" || f.severity === "High").length }],
    cross_cutting_themes: section.cross_cutting_themes.map(t => ({ title: "Theme", observation: t })),
    consolidated: { findings: section.findings, recommendations: section.recommendations, actions: section.actions, roadmap: section.roadmap_items },
    expected_outcomes: section.expected_outcomes,
    closing_note:      { title: "Next Steps", message: `The recommended next step for ${section.module_name} is to confirm ownership of the top-priority actions, establish a review cadence, and target measurable progress within the first 30-day sprint. A 60-day re-assessment is recommended to confirm that scores are improving.` },
    // Single-module ordered plan — presented as a complete engagement, not a partial one
    ordered_plan: buildOrderedPlan(section),
    engagement_framing: `This report represents a complete advisory engagement covering ${section.module_name}. It is a full-scope assessment of this topic with findings, recommendations, actions, and a sequenced roadmap — not a component of a larger incomplete assessment. The plan below is the complete priority sequence for this engagement.`,
    // Legacy compat fields
    business_performance_overview: { scores: section.area_scores.map(a => ({ name: a.name, percentage: a.score, band: a.band })) },
    key_findings:    section.findings.slice(0, 10),
    impact_overview: section.metrics.slice(0, 6).map(m => ({ label: m.name, value: m.current_value != null ? String(m.current_value) : m.variance_value != null ? String(m.variance_value) : m.unit || "Evidence-led" })),
    strategic_priorities_flat: section.actions.slice(0, 8).map(a => ({ initiative: a.title, impact: a.objective, effort: a.indicative_timeline, priority_score: a.owner_role })),
    ai_opportunities: publication.module_code === "ai_use_cases" ? section.recommendations.slice(0, 8).map(r => ({ use_case: r.title, outcome: r.expected_benefit })) : [],
    implementation_roadmap: section.roadmap_items.slice(0, 12),
    publications: [publication],
    markdown: [
      `# ${reportTitle(context, publication.module_code)}`, reportSubtitle(context), "",
      `## Executive Summary`, execSummary.headline, "", execSummary.assessment_context, "",
      "## Findings",
      ...section.findings.map(f => `### Finding ${f.number}: ${f.title}\n**Observation:** ${f.observation}\n**Impact:** ${f.impact}`),
      "", "## Recommendations",
      ...section.recommendations.map(r => `### Recommendation ${r.number}: ${r.title}\n${r.detail}\n**Expected benefit:** ${r.expected_benefit}`),
      "", "## Actions",
      ...section.actions.map(a => `### Action ${a.number}: ${a.title}\n**Objective:** ${a.objective}\n**Owner:** ${a.owner_role}\n**Timeline:** ${a.indicative_timeline}`),
    ].join("\n"),
  };
}

// ── Persistence and delivery ───────────────────────────────────────────────
async function generateAndPersist(assessmentId: string, payload: any, moduleCode?: ModuleCode | null) {
  const moduleScope = moduleCode || "FULL";
  const reportInstanceId = reportInstanceIdFor(assessmentId, moduleScope);
  const existing = await getReportInstance(reportInstanceId);
  const nextVersion = num(existing?.latest_version, 0) + 1;
  const scopeType = moduleCode ? "module" : "integrated";

  await upsertReportRecord({ reportInstanceId, assessmentId, reportType: scopeType === "integrated" ? "INTEGRATED_REPORT" : "MODULE_REPORT", moduleScope, moduleCode: moduleCode || null, scopeType, title: payload.title, summaryText: payload.executive_summary?.headline || "", status: "generating", latestVersion: nextVersion, reportPayload: payload, fileName: "", filePath: "", lastError: "" });

  try {
    const generated = await generateDocumentArtifacts({ assessmentId, reportInstanceId, version: nextVersion, title: payload.title, payload });
    const artifacts = generated.artifacts.map(a => ({ artifactId: artifactIdFor(reportInstanceId, a.fileType as any, nextVersion), fileType: a.fileType, fileName: a.fileName, storagePath: a.storagePath, fileSize: a.fileSize }));
    await replaceArtifacts({ reportInstanceId, assessmentId, moduleScope, moduleCode: moduleCode || null, version: nextVersion, artifacts });
    const preferred = artifacts.find(a => a.fileType === "docx") || artifacts[0];
    await upsertReportRecord({ reportInstanceId, assessmentId, reportType: scopeType === "integrated" ? "INTEGRATED_REPORT" : "MODULE_REPORT", moduleScope, moduleCode: moduleCode || null, scopeType, title: payload.title, summaryText: payload.executive_summary?.headline || "", status: "ready", latestVersion: nextVersion, reportPayload: payload, fileName: preferred?.fileName || "", filePath: preferred?.storagePath || "", lastError: "" });
    return { report: await getReportInstance(reportInstanceId), artifacts: await listArtifacts(reportInstanceId), payload };
  } catch (error: any) {
    await upsertReportRecord({ reportInstanceId, assessmentId, reportType: scopeType === "integrated" ? "INTEGRATED_REPORT" : "MODULE_REPORT", moduleScope, moduleCode: moduleCode || null, scopeType, title: payload.title, summaryText: payload.executive_summary?.headline || "", status: "failed", latestVersion: nextVersion, reportPayload: payload, fileName: "", filePath: "", lastError: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

async function publishModuleIfNeeded(assessmentId: string, moduleCode: ModuleCode) {
  const existing = await modulePublicationRepository.getLatestPublished(assessmentId, moduleCode);
  if (existing) return existing;
  const map: Record<string, Function> = { ops_audit: publishOperationalAuditPublication, revenue_leakage: publishRevenueLeakagePublication, data_foundation: publishDataFoundationPublication, ai_readiness: publishAiReadinessPublication, ai_use_cases: publishAiUseCasesPublication };
  if (map[moduleCode]) return map[moduleCode](assessmentId);
  throw new Error(`Unsupported module: ${moduleCode}`);
}

async function ensureIntegratedPublications(assessmentId: string) {
  const required: ModuleCode[] = ["ops_audit", "revenue_leakage", "data_foundation", "ai_readiness", "ai_use_cases"];
  const existing = await modulePublicationRepository.listLatestPublished(assessmentId);
  const existingCodes = new Set(existing.map(r => r.module_code as ModuleCode));
  const missing = required.filter(c => !existingCodes.has(c));
  if (!missing.length) return existing;
  for (const code of missing) await publishModuleIfNeeded(assessmentId, code);
  return modulePublicationRepository.listLatestPublished(assessmentId);
}

export async function buildStandaloneModuleReport(assessmentId: string, moduleCode: ModuleCode) {
  const pub = await publishModuleIfNeeded(assessmentId, moduleCode);
  if (!pub) throw new Error(`No published output for ${moduleCode}`);
  return generateAndPersist(assessmentId, buildStandalonePayload(pub), moduleCode);
}

export async function buildAssessmentReport(assessmentId: string) {
  const publications = await ensureIntegratedPublications(assessmentId);
  const workspace = await getWorkspaceSnapshot({ assessmentId });
  const context = publications[0]?.context || { client_name: workspace.client?.client_name || "Client", assessment_name: workspace.assessment?.assessment_name || assessmentId, assessment_date: null };
  return generateAndPersist(assessmentId, buildIntegratedPayload(context, publications), null);
}

function timestampMs(v: unknown) { const p = Date.parse(String(v || "")); return Number.isFinite(p) ? p : 0; }

async function getSnapshotCalculatedAt(assessmentId: string, moduleCode?: ModuleCode | null) {
  if (moduleCode) { const s = await getModuleSnapshot(assessmentId, moduleCode); return timestampMs(s?.calculated_at); }
  const s = await getAssessmentSnapshot(assessmentId) || await rebuildAssessmentSnapshot(assessmentId);
  return timestampMs(s?.calculated_at);
}

export async function getPersistedReport(assessmentId: string, moduleCode?: ModuleCode | null) {
  const id = reportInstanceIdFor(assessmentId, moduleCode || "FULL");
  const report = await getReportInstance(id);
  if (!report) return null;
  return { report, artifacts: await listArtifacts(id), payload: report.report_payload };
}

export async function getFreshPersistedReport(assessmentId: string, moduleCode?: ModuleCode | null) {
  const existing = await getPersistedReport(assessmentId, moduleCode);
  if (!existing) return moduleCode ? buildStandaloneModuleReport(assessmentId, moduleCode) : buildAssessmentReport(assessmentId);
  const reportMs = timestampMs(existing.report?.generated_at || existing.report?.updated_at);
  const hasReady = String(existing.report?.report_status || "").toLowerCase() === "ready" && Array.isArray(existing.artifacts) && existing.artifacts.length > 0;
  if (hasReady && reportMs > 0 && Date.now() - reportMs < 30_000) return existing;
  try {
    const snapMs = await getSnapshotCalculatedAt(assessmentId, moduleCode);
    if (snapMs > reportMs) return moduleCode ? buildStandaloneModuleReport(assessmentId, moduleCode) : buildAssessmentReport(assessmentId);
    return existing;
  } catch { if (hasReady) return existing; throw new Error("Report generation failed"); }
}

export async function listPersistedReports(assessmentId: string) {
  const reports = await listReportInstances(assessmentId);
  return Promise.all(reports.map(async r => ({ ...r, artifacts: await listArtifacts(r.report_instance_id) })));
}
