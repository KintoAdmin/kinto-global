import { getReferenceBundle } from "@/lib/reference/bundle";
import { getResponseMap, ensureMetricCapture, routePhase } from "@/lib/services/common";
import { countCapturedMetricRows, deriveModuleCoverage } from "@/lib/services/derived-state";
import { replaceModuleArtifacts } from "@/lib/repositories/runtime";
import { updateAssessmentModuleState } from "@/lib/repositories/assessments";
import { moduleIdFromCode } from "@/lib/constants/modules";
import { mean, round } from "@/lib/utils/math";
import { nowIso } from "@/lib/utils/ids";


// ── DATA narrative synthesis ───────────────────────────────────────────────
// Pattern-driven, commercially credible. Not a template readout.
function buildDataNarrative(overallPct: number, domains: any[], findings: any[]): string[] {
  if (!domains.some((d: any) => d.questions_answered > 0)) {
    return ["Data Foundation has not yet been scored. Complete the assessment to produce advisory findings."];
  }

  const scored   = domains.filter((d: any) => d.questions_answered > 0);
  const weak     = [...scored].sort((a, b) => a.score_pct - b.score_pct).filter((d: any) => d.score_pct < 65);
  const critical = weak.filter((d: any) => d.score_pct < 40);
  const strong   = scored.filter((d: any) => d.score_pct >= 75);
  const pFindings = findings.filter((f: any) => f.is_priority || String(f.severity_band || "").toLowerCase().includes("crit"));

  const maturity = overallPct >= 80 ? "strong" : overallPct >= 60 ? "managed" : overallPct >= 40 ? "developing" : "critically weak";
  const lines: string[] = [];

  // Opening assessment sentence
  if (overallPct <= 0) {
    lines.push("Data Foundation scoring is incomplete. No maturity view can be produced until questions are answered.");
  } else if (critical.length >= 3) {
    lines.push(`Data Foundation is in a critically weak state overall (${overallPct.toFixed(1)}%), with ${critical.length} domains below the minimum threshold required to support reliable business intelligence, AI initiatives, or confident reporting. This level of data risk typically manifests as poor decision quality, delayed issue identification, and failed technology investments.`);
  } else if (weak.length >= 2) {
    lines.push(`Data Foundation is currently ${maturity} (${overallPct.toFixed(1)}%). While some areas are functional, significant gaps in data governance, quality, or integration are constraining the organisation's ability to trust its data and act on it with confidence.`);
  } else {
    lines.push(`Data Foundation is operating at a ${maturity} level (${overallPct.toFixed(1)}%). The core data infrastructure is established, but targeted improvements are needed to ensure data quality, lineage, and governance reach the standard required for AI and advanced analytics.`);
  }

  // Strengths
  if (strong.length >= 1) {
    lines.push(`The areas of relative strength — ${strong.slice(0, 2).map((d: any) => d.domain_name).join(" and ")} — provide a credible foundation to build from. These should be leveraged as reference standards when strengthening weaker domains.`);
  }

  // Critical gaps
  if (critical.length >= 1) {
    lines.push(`The most urgent gaps are in ${critical.slice(0, 3).map((d: any) => `${d.domain_name} (${d.score_pct.toFixed(0)}%)`).join(", ")}. These domains are at a level where data cannot be relied upon for operational decisions, let alone analytical or AI use. Remediation should be treated as a prerequisite for any data-dependent initiative.`);
  } else if (weak.length >= 1) {
    lines.push(`The domains requiring most immediate attention are ${weak.slice(0, 3).map((d: any) => `${d.domain_name} (${d.score_pct.toFixed(0)}%)`).join(", ")}. Performance in these areas is below the managed threshold, which typically indicates inconsistent data handling, unclear ownership, or insufficient quality controls.`);
  }

  // Consequence of inaction
  if (overallPct < 60) {
    lines.push("Taken together, these data weaknesses represent a structural constraint on transformation feasibility. AI use cases, advanced reporting, and any initiative that depends on reliable data will underperform or fail without a deliberate data improvement programme running in parallel.");
  }

  // P1 actions available
  const p1Count = findings.filter((f: any) => {
    const t = String(f.indicative_timeline || f.timeline_band || "").toLowerCase();
    return t.includes("0-30") || t.includes("immediate") || t.includes("p1");
  }).length;
  if (p1Count > 0) {
    lines.push(`${p1Count} finding${p1Count !== 1 ? "s" : ""} have been assessed as requiring immediate action within the first 30 days. Assigning ownership to these items should be the first output of this assessment.`);
  }

  return lines;
}

export async function buildDataFoundationSummary(assessmentId: string) {
  const bundle = (await getReferenceBundle("DATA")) as any;
  const responseMap = await getResponseMap(assessmentId, "DATA");
  const domains = bundle.domains || [];
  const domainSummaries: any[] = [];
  const successMeasures: any[] = [];
  const findings: any[] = [];
  const recommendations: any[] = [];
  const actions: any[] = [];
  const roadmap: any[] = [];
  let weightedTotal = 0;
  let weightSum = 0;
  let totalAnswered = 0;
  let totalQuestions = 0;

  for (const domain of domains) {
    const questions = bundle.questions_by_domain?.[domain.domain_id] || [];
    let answered = 0;
    let rawTotal = 0;

    for (const question of questions) {
      const score = Number(responseMap[question.question_id]?.score_1_to_5 || responseMap[question.question_id]?.score || 0);
      if (score > 0) {
        answered += 1;
        rawTotal += score;
      }
    }

    const total = questions.length;
    const isComplete = total > 0 && answered === total;
    const scorePct = total ? round((rawTotal / (total * 5)) * 100, 2) : 0;
    if (isComplete) {
      weightedTotal += scorePct * Number(domain.weight_pct || 0);
      weightSum += Number(domain.weight_pct || 0);
    }
    totalAnswered += answered;
    totalQuestions += total;

    const metricDef = domain.metric_def || {};
    if (metricDef.metric_id) {
      const capture = await ensureMetricCapture(assessmentId, "DATA", { ...metricDef, workflow_id: domain.domain_id, domain_id: domain.domain_id });
      successMeasures.push({
        metric_id: capture.metric_id,
        metric_family: capture.metric_name,
        linked_workflows: domain.domain_id,
        baseline_value: capture.baseline_value,
        target_value: capture.target_value,
        current_value: capture.current_value,
        owner_role: capture.owner_role,
        review_frequency: capture.review_frequency,
        roadmap_phase: scorePct < 40 ? "P1" : scorePct < 80 ? "P2" : "P3",
        rag_rule: capture.rag_status,
        why_it_matters: metricDef.why_it_matters || ""
      });
    }

    let trigger = "";
    const avgScore = answered ? rawTotal / answered : 0;
    if (answered > 0) {
      if (avgScore <= 2) trigger = "1-2";
      else if (avgScore <= 3) trigger = "3";
    }

    if (trigger) {
      const findingDef = bundle.findings_by_domain_trigger?.[`${domain.domain_id}::${trigger}`];
      if (findingDef) {
        const severity = trigger === "1-2" ? "CRITICAL" : "DEVELOPING";
        const findingId = `${assessmentId}::${moduleIdFromCode("DATA")}::${domain.domain_id}::${trigger}`;
        findings.push({
          finding_instance_id: findingId,
          assessment_id: assessmentId,
          module_id: moduleIdFromCode("DATA"),
          domain_id: domain.domain_id,
          workflow_id: domain.domain_id,
          question_id: `${domain.domain_id}::SUMMARY`,
          source_library_id: findingDef.finding_id || `DATA-${domain.domain_id}`,
          severity_band: severity,
          finding_title: findingDef.finding_title || "",
          finding_narrative: findingDef.finding_text || "",
          business_impact: `Weakness in ${String(domain.domain_name || "").toLowerCase()} is reducing trust in reporting, management visibility, or downstream digital enablement.`,
          likely_root_cause: findingDef.common_root_causes || "",
          evidence_required: "Validate source systems, field discipline, reporting logic, and ownership evidence.",
          evidence_strength: "OBSERVED_RISK",
          is_priority: trigger === "1-2",
          created_at: nowIso(),
          updated_at: nowIso()
        });

        const recDef = bundle.recommendations_by_finding?.[findingDef.finding_id || ""];
        if (recDef) {
          const recId = `${findingId}::REC`;
          recommendations.push({
            recommendation_instance_id: recId,
            assessment_id: assessmentId,
            module_id: moduleIdFromCode("DATA"),
            linked_finding_instance_id: findingId,
            source_library_id: recDef.recommendation_id || `DATA-REC-${domain.domain_id}`,
            recommendation_title: recDef.recommendation_summary || "",
            recommendation_text: recDef.recommendation_summary || "",
            expected_outcome: `Improved trust and control in ${String(domain.domain_name || "").toLowerCase()}.`,
            priority_level: recDef.priority || "",
            created_at: nowIso(),
            updated_at: nowIso()
          });

          const linkedActions = bundle.actions_by_recommendation?.[recDef.recommendation_id || ""] || [];
          const fallbackActions = linkedActions.length
            ? linkedActions
            : [{
                action_id: `DATA-ACT-${domain.domain_id}`,
                action_summary: recDef.recommendation_summary || "",
                owner_type: "Data Owner",
                effort_level: "Medium",
                expected_outcome: `Improved trust and control in ${String(domain.domain_name || "").toLowerCase()}.`
              }];

          for (const [index, actionDef] of fallbackActions.entries()) {
            const actionId = `${findingId}::ACT::${String(index + 1).padStart(2, "0")}`;
            actions.push({
              action_instance_id: actionId,
              assessment_id: assessmentId,
              module_id: moduleIdFromCode("DATA"),
              linked_recommendation_instance_id: recId,
              source_library_id: actionDef.action_id || `DATA-ACT-${domain.domain_id}`,
              action_title: actionDef.action_summary || "",
              action_text: actionDef.action_summary || "",
              owner_role: actionDef.owner_type || "",
              indicative_timeline: actionDef.effort_level || "",
              success_measure: metricDef.metric_name || "",
              priority_level: recDef.priority || "",
              created_at: nowIso(),
              updated_at: nowIso()
            });

            const phase = routePhase(recDef.roadmap_phase || "Phase 2");
            roadmap.push({
              roadmap_instance_id: `${assessmentId}::${moduleIdFromCode("DATA")}::ROAD::${String(roadmap.length + 1).padStart(4, "0")}`,
              assessment_id: assessmentId,
              module_id: moduleIdFromCode("DATA"),
              source_module_id: moduleIdFromCode("DATA"),
              source_finding_instance_id: findingId,
              source_action_instance_id: actionId,
              phase_code: phase.phaseCode,
              phase_name: phase.phaseName,
              initiative_title: String(actionDef.action_summary || "").slice(0, 140),
              initiative_description: actionDef.action_summary || "",
              owner_role: actionDef.owner_type || "",
              linked_metric_id: metricDef.metric_id || "",
              baseline_value: "",
              target_value: "",
              review_frequency: metricDef.frequency || "Monthly",
              business_outcome: actionDef.expected_outcome || "",
              priority_rank: roadmap.length + 1,
              status: "NOT_STARTED",
              created_at: nowIso(),
              updated_at: nowIso()
            });
          }
        }
      }
    }

    domainSummaries.push({
      domain_id: domain.domain_id,
      domain_name: domain.domain_name,
      score_pct: scorePct,
      questions_answered: answered,
      questions_total: total,
      is_complete: isComplete,
      avg_score: answered ? round(rawTotal / answered, 2) : 0,
      weight_pct: Number(domain.weight_pct || 0),
      maturity_band: scorePct >= 80 ? "STRONG" : scorePct >= 60 ? "MANAGED" : scorePct >= 40 ? "DEVELOPING" : "WEAK"
    });
  }

  const overallPct = weightSum ? round(weightedTotal / weightSum, 2) : 0;
  const metricsTotal = successMeasures.length;
  const metricsCaptured = countCapturedMetricRows(successMeasures as any);
  const coverage = deriveModuleCoverage({ questionsAnswered: totalAnswered, questionsTotal: totalQuestions, metricsCaptured, metricsTotal });
  return {
    overall_pct: overallPct,
    overall_maturity: overallPct >= 80 ? "Strong" : overallPct >= 60 ? "Managed" : overallPct >= 40 ? "Developing" : overallPct > 0 ? "Weak" : "Not scored",
    answered: totalAnswered,
    total: totalQuestions,
    domain_scores: domainSummaries,
    findings,
    recommendations,
    actions,
    roadmap,
    success_measures: successMeasures,
    top_phase_1_items: roadmap.filter((row) => row.phase_code === "P1").slice(0, 5),
    metrics_total: metricsTotal,
    metrics_captured: metricsCaptured,
    question_completion_pct: coverage.questionCompletionPct,
    metric_completion_pct: coverage.metricCompletionPct,
    completion_pct: coverage.completionPct,
    complete: coverage.complete,
    executive_narrative: buildDataNarrative(overallPct, domainSummaries, findings)
  };
}

export async function computeAndPersistDataFoundation(assessmentId: string) {
  const summary = await buildDataFoundationSummary(assessmentId);
  const moduleId = moduleIdFromCode("DATA");
  const domainScores = summary.domain_scores.map((domain: any) => ({
    domain_score_id: `${assessmentId}::${moduleId}::${domain.domain_id}`,
    assessment_id: assessmentId,
    module_id: moduleId,
    domain_id: domain.domain_id,
    raw_score_total: domain.avg_score * domain.questions_answered,
    max_score_total: domain.questions_total * 5,
    score_pct: domain.score_pct,
    maturity_band: domain.maturity_band,
    questions_answered: domain.questions_answered,
    questions_total: domain.questions_total,
    is_complete: domain.is_complete,
    calculated_at: nowIso()
  }));

  const moduleScore = {
    module_score_id: `${assessmentId}::${moduleId}`,
    assessment_id: assessmentId,
    module_id: moduleId,
    raw_score_total: round((summary.overall_pct / 100) * (summary.total * 5), 2),
    max_score_total: summary.total * 5,
    score_pct: summary.overall_pct,
    maturity_band: String(summary.overall_maturity || "Not scored").toUpperCase().replace(/\s+/g, "_"),
    domains_completed: summary.domain_scores.filter((row: any) => row.is_complete).length,
    domains_total: summary.domain_scores.length,
    metrics_total: summary.metrics_total || 0,
    metrics_captured: summary.metrics_captured || 0,
    is_complete: Boolean(summary.complete),
    calculated_at: nowIso()
  };

  await replaceModuleArtifacts(assessmentId, "DATA", {
    domainScores,
    moduleScore,
    findings: summary.findings,
    recommendations: summary.recommendations,
    actions: summary.actions,
    roadmap: summary.roadmap
  });

  await updateAssessmentModuleState(assessmentId, "DATA", {}, {
    moduleStatus: summary.complete ? "COMPLETE" : summary.answered > 0 || (summary.metrics_captured || 0) > 0 ? "IN_PROGRESS" : "NOT_STARTED",
    completionPct: summary.completion_pct || 0,
    summaryPayload: summary
  });

  return summary;
}
