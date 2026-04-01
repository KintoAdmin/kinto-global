import { getReferenceBundle } from "@/lib/reference/bundle";
import { getResponseMap, metricSnapshot } from "@/lib/services/common";
import { countCapturedMetricRows, deriveModuleCoverage } from "@/lib/services/derived-state";
import { replaceModuleArtifacts } from "@/lib/repositories/runtime";
import { updateAssessmentModuleState } from "@/lib/repositories/assessments";
import { moduleIdFromCode } from "@/lib/constants/modules";
import { mean, round, scoreToPercentage, maturityLabel } from "@/lib/utils/math";
import { nowIso } from "@/lib/utils/ids";

const PRIORITY_ORDER: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3, "": 4 };
const PHASE_ORDER: Record<string, number> = {
  "Phase 1": 1,
  "Phase 2": 2,
  "Phase 3": 3,
  "Phase 4": 4,
  "Phase 5": 5,
  Later: 6,
  Backlog: 7,
  Unphased: 99,
  "Design and Ownership Reset": 1,
  "Control and Workflow Standardisation": 2,
  "Automation and Intelligence Enablement": 3
};
const SCORE_LABELS: Record<number, string> = {
  1: "Absent / uncontrolled",
  2: "Weak / inconsistent",
  3: "Partly defined / partly followed",
  4: "Strong / mostly consistent",
  5: "Fully defined / managed / measurable"
};
const BAND_ORDER: Record<string, number> = {
  "Critical / Weak": 0,
  Developing: 1,
  "Strong / Managed": 2,
  "Not scored": 9
};

function scoreBand(score: number) {
  if (score <= 0) return "Not scored";
  if (score <= 2) return "Critical / Weak";
  if (score === 3) return "Developing";
  return "Strong / Managed";
}

function scoreBandKey(score: number) {
  if (score <= 0) return "";
  if (score <= 2) return "1-2";
  if (score === 3) return "3";
  return "4-5";
}

function safeInt(value: unknown, fallback = 99) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function findingRow(q: any, score: number, assessmentId: string, responseMap: Record<string, any>) {
  const rec = q.recommendation || {};
  const action = q.action || {};
  const roadmap = q.roadmap || {};
  const transformation = roadmap.transformation || (q.transformations?.[0] || {});
  const finding = (q.findings_by_band || {})[scoreBandKey(score)] || {};
  const band = scoreBand(score);
  const includedInRoadmap = score <= 2;
  const ownerRole = roadmap.owner_role || q.owner_role || action.action_owner || "";
  const priorityWeight = finding.report_priority || q.priority_weight || "";
  const phaseName = roadmap.phase_name || q.roadmap_phase || action.phase || "Unphased";
  const supportingMetric = await metricSnapshot(assessmentId, "OPS", q.primary_metric, { persistMissing: false });

  return {
    question_id: q.question_id,
    question_text: q.question_text,
    domain_name: q.domain_name,
    workflow_name: q.workflow_name,
    step_name: q.step_name,
    score,
    score_pct: scoreToPercentage(score),
    score_label: SCORE_LABELS[score] || "",
    severity_band: band,
    score_band_key: scoreBandKey(score),
    finding_id: finding.finding_id || "",
    finding_title: finding.finding_title || q.question_text,
    finding_text: finding.finding_text || q.question_text,
    business_impact: finding.business_impact || q.customer_impact_if_weak || "",
    likely_root_cause: finding.likely_root_cause || "",
    evidence_to_validate: finding.evidence_to_validate || q.evidence_examples || "",
    report_priority: finding.report_priority || priorityWeight,
    recommendation_id: q.recommendation_id || "",
    action_id: q.action_id || "",
    recommendation: rec,
    action,
    roadmap,
    transformations: q.transformations || [],
    transformation,
    transformation_title: transformation.transformation_title || "",
    transformation_text: transformation.transformation_text || "",
    transformation_type: transformation.transformation_type || "",
    automation_flag: q.automation_flag || "No",
    ai_flag: q.ai_flag || "No",
    roadmap_phase: phaseName,
    phase_name: phaseName,
    phase_number: safeInt(roadmap.phase_number, PHASE_ORDER[phaseName] || 99),
    owner_role: ownerRole,
    priority_weight: priorityWeight,
    issue_type: q.issue_type || "",
    question_type: q.question_type || "",
    question_intent: q.question_intent || "",
    included_in_roadmap: includedInRoadmap,
    notes: responseMap[q.question_id]?.notes || "",
    domain_description: q.domain?.domain_description || "",
    audit_focus: q.domain?.audit_focus || "",
    workflow_description: q.workflow?.workflow_description || "",
    workflow_objective: q.workflow?.workflow_objective || "",
    typical_evidence: q.workflow?.typical_evidence || q.evidence_examples || "",
    kpi_examples: q.workflow?.kpi_examples || "",
    step_description: q.step?.step_description || "",
    supporting_metric: supportingMetric
  };
}

function buildAuditRoadmap(priorityFindings: any[]) {
  const roadmap: any[] = [];
  const seen = new Set<string>();
  for (const item of priorityFindings) {
    const rec = item.recommendation || {};
    const action = item.action || {};
    const roadmapRow = item.roadmap || {};
    const transformation = item.transformation || {};
    const key = roadmapRow.roadmap_id || item.action_id || item.question_id;
    if (seen.has(key)) continue;
    seen.add(key);
    const phaseName = roadmapRow.phase_name || item.roadmap_phase || action.phase || "Unphased";
    roadmap.push({
      roadmap_id: roadmapRow.roadmap_id || "",
      question_id: item.question_id || "",  // Preserved for stable ID generation
      phase: phaseName,
      phase_name: phaseName,
      phase_number: safeInt(roadmapRow.phase_number, PHASE_ORDER[phaseName] || 99),
      priority: item.priority_weight || "",
      owner: roadmapRow.owner_role || item.owner_role || action.action_owner || "Functional owner",
      domain_name: item.domain_name,
      workflow_name: item.workflow_name,
      step_name: item.step_name,
      question_text: item.question_text,
      finding_title: item.finding_title || "",
      severity_band: item.severity_band || "Critical / Weak",
      score: item.score,
      score_pct: item.score_pct || 0,
      action_title: action.action_title || rec.recommendation_title || roadmapRow.milestone_name || item.question_text,
      action_text: action.action_text || rec.recommendation_text || "",
      recommendation_title: rec.recommendation_title || "",
      recommendation_text: rec.recommendation_text || "",
      milestone_name: roadmapRow.milestone_name || action.action_title || "",
      milestone_description: roadmapRow.milestone_description || action.action_text || "",
      target_outcome: roadmapRow.target_outcome || rec.expected_outcome || "",
      kpi_focus: roadmapRow.kpi_focus || item.kpi_examples || "",
      automation_or_ai_opportunity: roadmapRow.automation_or_ai_opportunity || transformation.advanced_intelligence_option || "",
      effort_level: action.effort_level || "",
      dependency: roadmapRow.dependency || action.dependency || "",
      indicative_timeline: roadmapRow.indicative_timeline || action.indicative_timeline || "",
      automation_flag: item.automation_flag || "No",
      ai_flag: item.ai_flag || "No",
      action_deliverable: action.action_deliverable || "",
      success_measure: action.success_measure || "",
      transformation_title: transformation.transformation_title || "",
      transformation_text: transformation.transformation_text || "",
      transformation_type: transformation.transformation_type || "",
      supporting_metric: item.supporting_metric || {}
    });
  }
  roadmap.sort((a, b) =>
    (a.phase_number || 99) - (b.phase_number || 99) ||
    (PRIORITY_ORDER[a.priority || ""] || 9) - (PRIORITY_ORDER[b.priority || ""] || 9) ||
    (a.score || 9) - (b.score || 9) ||
    String(a.domain_name || "").localeCompare(String(b.domain_name || ""))
  );
  return roadmap;
}


// ── OPS narrative synthesis ── Workflow/domain pattern-driven ─────────────
function buildOpsNarrative(params: {
  overallPercentage: number;
  scoredDomains: any[];
  unscoredDomains: any[];
  weakestDomains: any[];
  strongestDomains: any[];
  leastWeakDomains: any[];
  priorityFindings: any[];
  developingFindings: any[];
  spread: number;
  criticalGaps: number;
  automationReady: number;
  aiReady: number;
  commonRootCauses: string[];
  metricsCaptured: number;
  metricsTotal: number;
}): string[] {
  const {
    overallPercentage: pct, scoredDomains, unscoredDomains,
    weakestDomains, strongestDomains, leastWeakDomains, priorityFindings,
    developingFindings, spread, criticalGaps, automationReady, aiReady,
    commonRootCauses, metricsCaptured, metricsTotal
  } = params;

  if (!scoredDomains.length) {
    return ["Operational Audit has not yet been scored. Answer questions across the domains to produce findings and advisory outputs."];
  }

  const lines: string[] = [];
  const maturity = pct >= 80 ? "strong" : pct >= 65 ? "managed" : pct >= 45 ? "developing" : "critically weak";
  const uniform = spread <= 8;

  // Opening assessment
  if (pct < 40) {
    lines.push(`Operational Audit is assessed as critically weak overall (${pct.toFixed(1)}%). The business has ${criticalGaps} critical scoring gaps across its operational domains, indicating that the foundational process controls, ownership structures, and execution discipline required to run a scalable, governed business are not yet consistently in place. This represents immediate operating risk, not a future improvement opportunity.`);
  } else if (pct < 60) {
    lines.push(`Operational Audit is currently at a developing maturity level (${pct.toFixed(1)}%). Some process foundations exist, but execution is inconsistent, ownership is unclear in several domains, and management visibility is insufficient. The business is operating with meaningful control gaps that are constraining growth, margin, and customer reliability.`);
  } else if (pct < 80) {
    lines.push(`Operational Audit is operating at a managed level (${pct.toFixed(1)}%). The core operating model is established, but ${weakestDomains.length > 0 ? "weaknesses in " + weakestDomains.slice(0, 2).map((d: any) => d.domain_name).join(" and ") + " are" : "some process areas are"} constraining the consistency and scalability of delivery. Targeted improvement in these areas would materially strengthen operational reliability.`);
  } else {
    lines.push(`Operational Audit reflects a strong operating model overall (${pct.toFixed(1)}%). Process ownership, execution discipline, and management visibility are well-established. The focus should shift to optimisation, automation, and sustained performance governance.`);
  }

  // Distribution insight
  if (uniform && scoredDomains.length >= 3) {
    lines.push(`Scores are broadly consistent across domains, suggesting that the operating weaknesses are systemic rather than isolated. A broad-based improvement programme is more appropriate than single-domain fixes.`);
  } else if (!uniform && weakestDomains.length >= 1) {
    lines.push(`Performance is uneven across the operational portfolio. ${weakestDomains.slice(0, 2).map((d: any) => `${d.domain_name} (${d.percentage.toFixed(0)}%)`).join(" and ")} are significantly below the other domains, creating bottlenecks that affect the whole value chain even where upstream processes are stronger.`);
  }

  // Strengths — only if meaningful
  if (strongestDomains.length >= 1) {
    lines.push(`The areas of relative operational strength — ${strongestDomains.slice(0, 2).map((d: any) => d.domain_name).join(" and ")} — demonstrate that the organisation has established effective controls in these domains. These should be used as internal benchmarks and referenced when designing improvements elsewhere.`);
  }

  // Critical and developing findings count
  const critTotal = priorityFindings.length;
  const devTotal  = developingFindings.length;
  if (critTotal > 0) {
    lines.push(`${critTotal} critical finding${critTotal !== 1 ? "s have" : " has"} been identified${devTotal > 0 ? `, plus ${devTotal} developing finding${devTotal !== 1 ? "s" : ""}` : ""}. The critical findings represent areas where current performance creates immediate operating, commercial, or customer risk and must be addressed within the P1 sprint.`);
  } else if (devTotal > 0) {
    lines.push(`${devTotal} developing finding${devTotal !== 1 ? "s have" : " has"} been identified across the operational audit. These represent areas that are partially functioning but require structured improvement to reach a managed standard.`);
  }

  // Root cause patterns — cross-domain synthesis
  if (commonRootCauses.length >= 2) {
    lines.push(`Across the findings, recurring root causes include: ${commonRootCauses.slice(0, 3).join("; ")}. These systemic themes suggest that the most effective improvement path is not domain-by-domain patching, but targeted intervention on the underlying ownership, process design, and reporting structures that are producing multiple independent failures.`);
  } else if (commonRootCauses.length === 1) {
    lines.push(`The most recurring root cause identified across findings is: ${commonRootCauses[0]}. This is likely a systemic issue affecting multiple domains simultaneously.`);
  }

  // Automation and AI readiness signal
  if (automationReady >= 3) {
    lines.push(`${automationReady} identified gaps also represent automation and AI opportunities. Resolving these through targeted technology enablement — rather than manual process fixes — would compound the business benefit and accelerate the organisation's transformation trajectory.`);
  }

  // Metric coverage
  if (metricsTotal > 0) {
    const metricCoverage = metricsTotal > 0 ? Math.round((metricsCaptured / metricsTotal) * 100) : 0;
    if (metricCoverage < 50) {
      lines.push(`Metric capture is at ${metricCoverage}% of the available KPIs. Completing the metric evidence for the highest-priority workflows will strengthen the commercial case for remediation and provide a performance baseline to measure progress against.`);
    }
  }

  // Unscored domains — flag for completion
  if (unscoredDomains.length > 0) {
    lines.push(`${unscoredDomains.length} domain${unscoredDomains.length !== 1 ? "s have" : " has"} not yet been scored: ${unscoredDomains.slice(0, 3).map((d: any) => d.domain_name).join(", ")}. The findings above reflect only the scored portion of the assessment. Completing these domains may reveal additional risks or raise/lower the overall maturity rating.`);
  }

  return lines;
}

export async function buildAuditSummary(assessmentId: string) {
  const bundle = (await getReferenceBundle("OPS")) as any;
  const questions = bundle.questions as any[];
  const responseMap = await getResponseMap(assessmentId, "OPS");
  const scoredRows: Array<{ q: any; score: number }> = [];
  const domainScores: any[] = [];

  for (const domain of bundle.domains as any[]) {
    const domainQuestions = (bundle.questions_by_domain[domain.domain_id] || []) as any[];
    const domainScored: number[] = [];
    for (const q of domainQuestions) {
      const score = Number(responseMap[q.question_id]?.score ?? responseMap[q.question_id]?.score_1_to_5 ?? 0);
      if (score > 0) {
        domainScored.push(score);
        scoredRows.push({ q, score });
      }
    }

    const avgScore = domainScored.length ? round(mean(domainScored), 2) : 0;
    const percentage = scoreToPercentage(avgScore);
    domainScores.push({
      domain_id: domain.domain_id,
      domain_name: domain.domain_name,
      domain_description: domain.domain_description || "",
      audit_focus: domain.audit_focus || "",
      answered: domainScored.length,
      total: domainQuestions.length,
      avg_score: avgScore,
      percentage,
      maturity: maturityLabel(percentage),
      is_scored: Boolean(domainScored.length)
    });
  }

  const overallAvg = scoredRows.length ? round(mean(scoredRows.map((row) => row.score)), 2) : 0;
  const overallPercentage = scoreToPercentage(overallAvg);
  const surfacedFindings: any[] = [];
  const priorityFindings: any[] = [];
  const developingFindings: any[] = [];
  const metricDefs = Array.from(new Map((Array.isArray(bundle.metrics) ? bundle.metrics : Object.values(bundle.metric_map || {}))
    .filter((metric: any) => metric?.metric_id)
    .map((metric: any) => [`${metric.metric_id}::${metric.workflow_id || ''}`, metric])
  ).values());
  const scoreDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<number, number>;

  for (const { q, score } of scoredRows) {
    scoreDistribution[score as keyof typeof scoreDistribution] += 1;
    if (score <= 3) {
      const row = await findingRow(q, score, assessmentId, responseMap);
      surfacedFindings.push(row);
      if (score <= 2) priorityFindings.push(row);
      else developingFindings.push(row);
    }
  }

  surfacedFindings.sort((a, b) =>
    (BAND_ORDER[a.severity_band || "Not scored"] || 9) - (BAND_ORDER[b.severity_band || "Not scored"] || 9) ||
    a.score - b.score ||
    (PRIORITY_ORDER[a.priority_weight || ""] || 9) - (PRIORITY_ORDER[b.priority_weight || ""] || 9) ||
    (a.phase_number || 99) - (b.phase_number || 99) ||
    String(a.domain_name || "").localeCompare(String(b.domain_name || ""))
  );

  priorityFindings.sort((a, b) =>
    a.score - b.score ||
    (PRIORITY_ORDER[a.priority_weight || ""] || 9) - (PRIORITY_ORDER[b.priority_weight || ""] || 9) ||
    (a.phase_number || 99) - (b.phase_number || 99)
  );

  developingFindings.sort((a, b) =>
    (PRIORITY_ORDER[a.priority_weight || ""] || 9) - (PRIORITY_ORDER[b.priority_weight || ""] || 9) ||
    (a.phase_number || 99) - (b.phase_number || 99)
  );

  const findingsByDomain = surfacedFindings.reduce<Record<string, any[]>>((acc, finding) => {
    (acc[finding.domain_name] ||= []).push(finding);
    return acc;
  }, {});

  for (const domain of domainScores) {
    const domainFindings = findingsByDomain[domain.domain_name] || [];
    domain.priority_findings = domainFindings.filter((finding) => finding.score <= 2).length;
    domain.developing_findings = domainFindings.filter((finding) => finding.score === 3).length;
    domain.top_root_cause = domainFindings.find((finding) => finding.likely_root_cause)?.likely_root_cause || "";
    const domainMetricDefs: any[] = metricDefs.filter((metric: any) => String(metric.domain_id || '') === String(domain.domain_id));
    const workflowMetrics = [] as any[];
    for (const metricDef of domainMetricDefs as any[]) {
      const snapshot = await metricSnapshot(assessmentId, "OPS", metricDef, { persistMissing: false });
      workflowMetrics.push({ ...snapshot, workflow_name: metricDef.workflow_name || "" });
    }
    const domainCoverage = deriveModuleCoverage({
      questionsAnswered: Number(domain.answered || 0),
      questionsTotal: Number(domain.total || 0),
      metricsCaptured: countCapturedMetricRows(workflowMetrics),
      metricsTotal: workflowMetrics.length,
    });
    domain.metric_snapshots = workflowMetrics;
    domain.metrics_total = domainCoverage.metricsTotal;
    domain.metrics_captured = domainCoverage.metricsCaptured;
    domain.question_completion_pct = domainCoverage.questionCompletionPct;
    domain.metric_completion_pct = domainCoverage.metricCompletionPct;
    domain.completion_pct = domainCoverage.completionPct;
    domain.is_complete = domainCoverage.complete;
  }

  const scoredDomains = domainScores.filter((domain) => domain.answered > 0);
  const unscoredDomains = domainScores.filter((domain) => domain.answered === 0);
  const weakestDomains = [...scoredDomains].sort((a, b) => a.percentage - b.percentage).slice(0, 3);
  const leastWeakDomains = [...scoredDomains].sort((a, b) => b.percentage - a.percentage).slice(0, 3);
  const spread = scoredDomains.length ? Math.max(...scoredDomains.map((row) => row.percentage)) - Math.min(...scoredDomains.map((row) => row.percentage)) : 0;
  const strongestDomains = scoredDomains.length >= 2 && spread > 5 ? leastWeakDomains : [];
  const automationReady = surfacedFindings.filter((row) => String(row.automation_flag || "").toLowerCase() === "yes").length;
  const aiReady = surfacedFindings.filter((row) => String(row.ai_flag || "").toLowerCase() === "yes").length;
  const criticalGaps = priorityFindings.filter((row) => row.score === 1).length;
  const roadmap = buildAuditRoadmap(priorityFindings);
  const metricsTotal = metricDefs.length;
  const metricsCaptured = countCapturedMetricRows(domainScores.flatMap((domain: any) => domain.metric_snapshots || []));
  const coverage = deriveModuleCoverage({
    questionsAnswered: scoredRows.length,
    questionsTotal: questions.length,
    metricsCaptured,
    metricsTotal,
  });
  const rootCauseCounts = new Map<string, number>();
  surfacedFindings.forEach((finding) => {
    const cause = String(finding.likely_root_cause || "").trim();
    if (!cause) return;
    rootCauseCounts.set(cause, (rootCauseCounts.get(cause) || 0) + 1);
  });
  const commonRootCauses = [...rootCauseCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cause]) => cause);

  const executiveNarrative: string[] = buildOpsNarrative({
    overallPercentage,
    scoredDomains,
    unscoredDomains,
    weakestDomains,
    strongestDomains,
    leastWeakDomains,
    priorityFindings,
    developingFindings,
    spread,
    criticalGaps,
    automationReady,
    aiReady,
    commonRootCauses,
    metricsCaptured,
    metricsTotal,
  });

  return {
    overall_avg: overallAvg,
    overall_percentage: overallPercentage,
    overall_maturity: maturityLabel(overallPercentage),
    answered: scoredRows.length,
    total: questions.length,
    domain_scores: domainScores.sort((a, b) => String(a.domain_id).localeCompare(String(b.domain_id))),
    scored_domains: scoredDomains,
    unscored_domains: unscoredDomains,
    surfaced_findings: surfacedFindings,
    priority_findings: priorityFindings,
    developing_findings: developingFindings,
    weak_questions: priorityFindings,
    automation_ready: automationReady,
    ai_ready: aiReady,
    critical_gaps: criticalGaps,
    metrics_total: metricsTotal,
    metrics_captured: metricsCaptured,
    question_completion_pct: coverage.questionCompletionPct,
    metric_completion_pct: coverage.metricCompletionPct,
    completion_pct: coverage.completionPct,
    complete: coverage.complete,
    score_distribution: scoreDistribution,
    roadmap,
    weakest_domains: weakestDomains,
    strongest_domains: strongestDomains,
    least_weak_domains: leastWeakDomains,
    uniform_scores: spread <= 5,
    common_root_causes: commonRootCauses,
    executive_narrative: executiveNarrative
  };
}

export async function computeAndPersistAudit(assessmentId: string) {
  const summary = await buildAuditSummary(assessmentId);
  const moduleId = moduleIdFromCode("OPS");

  const domainScores = summary.domain_scores.map((domain: any) => ({
    domain_score_id: `${assessmentId}::${moduleId}::${domain.domain_id}`,
    assessment_id: assessmentId,
    module_id: moduleId,
    domain_id: domain.domain_id,
    raw_score_total: domain.avg_score * domain.answered,
    max_score_total: domain.total * 5,
    score_pct: domain.percentage,
    maturity_band: domain.maturity.toUpperCase().replace(/\s+/g, "_"),
    questions_answered: domain.answered,
    questions_total: domain.total,
    is_complete: Boolean(domain.is_complete),
    calculated_at: nowIso()
  }));

  const moduleScore = {
    module_score_id: `${assessmentId}::${moduleId}`,
    assessment_id: assessmentId,
    module_id: moduleId,
    raw_score_total: summary.overall_avg * summary.answered,
    max_score_total: summary.total * 5,
    score_pct: summary.overall_percentage,
    maturity_band: String(summary.overall_maturity || "Not scored").toUpperCase().replace(/\s+/g, "_"),
    domains_completed: domainScores.filter((row: any) => row.is_complete).length,
    domains_total: summary.domain_scores.length,
    is_complete: Boolean(summary.complete),
    calculated_at: nowIso()
  };

  // Build content-stable IDs keyed by question_id.
  // Previously used sequential index (::FND::0001) which broke linkage when
  // finding order changed. Now each ID is tied to the question that generated it.
  function opsId(type: string, questionId: string) {
    // Sanitize question_id to be safe in composite keys
    const safe = String(questionId || "UNKNOWN").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60);
    return `OPS::${type}::${assessmentId}::${safe}`;
  }

  // Build lookup: question_id → finding_instance_id for cross-linking
  const findingIdByQuestion = new Map<string, string>();
  const recIdByQuestion     = new Map<string, string>();
  const actionIdByQuestion  = new Map<string, string>();

  // Findings — one per surfaced finding, keyed by question_id
  const findings = summary.surfaced_findings.map((item: any) => {
    const fId = opsId("FND", item.question_id);
    findingIdByQuestion.set(item.question_id, fId);
    return {
      finding_instance_id: fId,
      assessment_id: assessmentId,
      module_id: moduleId,
      domain_id: item.domain_name,
      workflow_id: item.workflow_name,
      question_id: item.question_id,
      source_library_id: item.finding_id || item.question_id,
      severity_band: item.severity_band,
      finding_title: item.finding_title,
      finding_narrative: item.finding_text,
      business_impact: item.business_impact,
      likely_root_cause: item.likely_root_cause,
      evidence_required: item.evidence_to_validate,
      evidence_strength: "OBSERVED_RISK",
      is_priority: item.score <= 2,
      created_at: nowIso(),
      updated_at: nowIso()
    };
  });

  // Recommendations — linked to the finding from the SAME question
  const recommendations = summary.surfaced_findings
    .filter((item: any) => item.recommendation?.recommendation_text || item.recommendation?.recommendation_title)
    .map((item: any) => {
      const rId = opsId("REC", item.question_id);
      recIdByQuestion.set(item.question_id, rId);
      return {
        recommendation_instance_id: rId,
        assessment_id: assessmentId,
        module_id: moduleId,
        linked_finding_instance_id: findingIdByQuestion.get(item.question_id) || "",
        source_library_id: item.recommendation_id || item.question_id,
        recommendation_title: item.recommendation?.recommendation_title || "",
        recommendation_text: item.recommendation?.recommendation_text || "",
        expected_outcome: item.recommendation?.expected_outcome || "",
        priority_level: item.priority_weight || "",
        created_at: nowIso(),
        updated_at: nowIso()
      };
    });

  // Actions — linked to the recommendation from the SAME question
  const actions = summary.surfaced_findings
    .filter((item: any) => item.action?.action_text || item.action?.action_title)
    .map((item: any) => {
      const aId = opsId("ACT", item.question_id);
      actionIdByQuestion.set(item.question_id, aId);
      return {
        action_instance_id: aId,
        assessment_id: assessmentId,
        module_id: moduleId,
        linked_recommendation_instance_id: recIdByQuestion.get(item.question_id) || "",
        source_library_id: item.action_id || item.question_id,
        action_title: item.action?.action_title || "",
        action_text: item.action?.action_text || "",
        owner_role: item.owner_role || item.action?.action_owner || "",
        indicative_timeline: item.action?.indicative_timeline || "",
        success_measure: item.action?.success_measure || "",
        priority_level: item.priority_weight || "",
        created_at: nowIso(),
        updated_at: nowIso()
      };
    });

  // Roadmap — linked to the finding and action from the SAME question
  // Each roadmap item carries question_id via priorityFindings source
  const roadmap = summary.roadmap.map((item: any, index: number) => {
    const qId = item.question_id || "";
    // Use content-stable ID: keyed by question_id if available, else action_title slug
    const roadmapKey = qId || String(item.action_title || item.milestone_name || index + 1)
      .toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 40);
    return {
      roadmap_instance_id: opsId("ROAD", roadmapKey),
      assessment_id: assessmentId,
      module_id: moduleId,
      source_module_id: moduleId,
      source_finding_instance_id: findingIdByQuestion.get(qId) || "",
      source_action_instance_id: actionIdByQuestion.get(qId) || "",
      phase_code: item.phase_number === 1 ? "P1" : item.phase_number === 2 ? "P2" : "P3",
      phase_name: item.phase_name,
      initiative_title: item.milestone_name || item.action_title || item.question_text,
      initiative_description: item.milestone_description || item.action_text || "",
      owner_role: item.owner || "",
      linked_metric_id: item.supporting_metric?.metric_id || "",
      baseline_value: String(item.supporting_metric?.baseline_value || ""),
      target_value: String(item.supporting_metric?.target_value || ""),
      review_frequency: item.supporting_metric?.review_frequency || "Monthly",
      business_outcome: item.target_outcome || "",
      priority_rank: index + 1,
      status: "NOT_STARTED",
      created_at: nowIso(),
      updated_at: nowIso()
    };
  });

  await replaceModuleArtifacts(assessmentId, "OPS", {
    domainScores,
    moduleScore,
    findings,
    recommendations,
    actions,
    roadmap
  });

  await updateAssessmentModuleState(assessmentId, "OPS", {}, {
    moduleStatus: summary.complete ? "COMPLETE" : summary.answered > 0 || summary.metrics_captured > 0 ? "IN_PROGRESS" : "NOT_STARTED",
    completionPct: summary.completion_pct || 0,
    summaryPayload: summary
  });

  return summary;
}
