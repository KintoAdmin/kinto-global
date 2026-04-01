// @ts-nocheck
import { getReferenceBundle } from "@/lib/reference/bundle";
import { airReadinessStatus, ensureMetricCapture, getResponseMap, routePhase } from "@/lib/services/common";
import { countCapturedMetricRows, deriveModuleCoverage } from "@/lib/services/derived-state";
import { replaceModuleArtifacts } from "@/lib/repositories/runtime";
import { updateAssessmentModuleState } from "@/lib/repositories/assessments";
import { moduleIdFromCode } from "@/lib/constants/modules";
import { round } from "@/lib/utils/math";
import { nowIso } from "@/lib/utils/ids";


// ── AIR narrative synthesis ───────────────────────────────────────────────
function buildAirNarrative(
  overallPct: number,
  readinessStatus: string,
  domains: any[],
  blockedDomains: number,
  conditionalDomains: number,
  pilotReadyDomains: number,
  findings: any[]
): string[] {
  if (!domains.some((d: any) => d.questions_answered > 0)) {
    return ["AI Readiness has not yet been scored. Complete the assessment to surface readiness blockers and sequencing guidance."];
  }

  const scored    = domains.filter((d: any) => d.questions_answered > 0);
  const blocked   = scored.filter((d: any) => d.readiness_status === "BLOCKED" || d.score_pct < 40);
  const weak      = scored.filter((d: any) => d.score_pct < 60);
  const ready     = scored.filter((d: any) => d.readiness_status === "PILOT_READY" || d.score_pct >= 75);
  const maturity  = overallPct >= 80 ? "strong" : overallPct >= 60 ? "managed" : overallPct >= 40 ? "developing" : "critically weak";
  const statusLabel = readinessStatus.replaceAll("_", " ").toLowerCase();
  const lines: string[] = [];

  // Opening assessment
  if (readinessStatus === "PILOT_READY") {
    lines.push(`AI Readiness is assessed at a ${maturity} level (${overallPct.toFixed(1)}%). The organisation has established sufficient foundations in AI governance, data controls, and operational readiness to proceed with controlled use case piloting. This is a commercially significant position — it means the business can begin converting diagnostic findings into real AI deployments.`);
  } else if (readinessStatus === "CONDITIONAL") {
    lines.push(`AI Readiness is currently conditional (${overallPct.toFixed(1)}%). The organisation has made progress in some readiness dimensions, but material gaps remain that will limit the reliability and governance of any AI deployment attempted at this stage. Conditional readiness means pilots are possible in lower-risk, well-controlled areas, but broader deployment should wait for the identified blockers to be resolved.`);
  } else if (readinessStatus === "BLOCKED") {
    lines.push(`AI Readiness is currently blocked (${overallPct.toFixed(1)}%). Fundamental gaps in AI governance, data quality, or operational controls are preventing the organisation from deploying AI initiatives responsibly. Proceeding without resolving these gaps would increase risk exposure significantly and is likely to result in failed or ungoverned AI deployments.`);
  } else {
    lines.push(`AI Readiness assessment is in progress. The current scored state is ${maturity} (${overallPct.toFixed(1)}%). Further scoring is required to confirm readiness status across all domains.`);
  }

  // What's working
  if (ready.length >= 1) {
    lines.push(`The strongest areas — ${ready.slice(0, 2).map((d: any) => d.domain_name).join(" and ")} — demonstrate that the organisation has the capacity to manage AI programmes. These areas should anchor the governance model for use case pilots.`);
  }

  // Blockers — named explicitly
  if (blocked.length >= 1) {
    lines.push(`The critical blockers are concentrated in ${blocked.slice(0, 3).map((d: any) => `${d.domain_name} (${d.score_pct.toFixed(0)}%)`).join(", ")}. These represent the minimum set of readiness controls that must be established before any use case pilot can be governed safely. They are not optional preparatory steps — they are the prerequisite for responsible deployment.`);
  } else if (weak.length >= 1) {
    lines.push(`The areas requiring most attention before broader deployment are ${weak.slice(0, 3).map((d: any) => `${d.domain_name} (${d.score_pct.toFixed(0)}%)`).join(", ")}. Strengthening these domains will increase deployment confidence and reduce the risk of AI initiatives producing unreliable or ungoverned outputs.`);
  }

  // Dependency signal for AIUC
  if (overallPct < 60) {
    lines.push("This readiness score directly affects which AI use cases can be prioritised in the near term. AI Use Cases that depend on high data quality, automated decision controls, or production-grade MLOps infrastructure are not currently viable and should be sequenced after the readiness gaps identified here are resolved.");
  } else if (overallPct >= 60) {
    lines.push("The readiness level is sufficient to support controlled, governed AI pilots in domains where data quality is confirmed. The AI Use Cases module can now be used to identify the highest-priority starting points.");
  }

  // P1 action count
  const criticalFindings = findings.filter((f: any) => String(f.severity_band || "").toUpperCase().includes("CRIT") || f.is_priority);
  if (criticalFindings.length > 0) {
    lines.push(`${criticalFindings.length} finding${criticalFindings.length !== 1 ? "s" : ""} have been assessed as critical. These should be assigned to named owners as an immediate output of this assessment, with resolution targeted within 30 days.`);
  }

  return lines;
}

export async function buildAiReadinessSummary(assessmentId: string) {
  const bundle = (await getReferenceBundle("AIR")) as any;
  const responseMap = await getResponseMap(assessmentId, "AIR");
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
  let blockedDomains = 0;
  let conditionalDomains = 0;
  let pilotReadyDomains = 0;

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
    const readinessStatus = airReadinessStatus(scorePct, isComplete);
    if (isComplete) {
      weightedTotal += scorePct * Number(domain.weight_pct || 0);
      weightSum += Number(domain.weight_pct || 0);
    }
    if (readinessStatus === "BLOCKED") blockedDomains += 1;
    if (readinessStatus === "CONDITIONAL") conditionalDomains += 1;
    if (readinessStatus === "PILOT_READY") pilotReadyDomains += 1;
    totalAnswered += answered;
    totalQuestions += total;

    const metricDef = domain.metric_def || {};
    if (metricDef.metric_id) {
      const capture = await ensureMetricCapture(assessmentId, "AIR", { ...metricDef, workflow_id: domain.domain_id, domain_id: domain.domain_id });
      successMeasures.push({
        metric_id: capture.metric_id,
        metric_family: capture.metric_name,
        linked_workflows: domain.domain_id,
        baseline_value: capture.baseline_value,
        target_value: capture.target_value,
        current_value: capture.current_value,
        owner_role: capture.owner_role,
        review_frequency: capture.review_frequency,
        roadmap_phase: readinessStatus === "BLOCKED" ? "P1" : readinessStatus === "CONDITIONAL" ? "P2" : "P3",
        rag_rule: capture.rag_status,
        why_it_matters: metricDef.why_it_matters || ""
      });
    }

    if (answered > 0) {
      const severityKey = scorePct < 40 ? "Critical / Weak" : scorePct < 70 ? "Developing" : "Strong / Managed";
      if (severityKey !== "Strong / Managed") {
        const findingDef = bundle.findings_by_domain_trigger?.[`${domain.domain_id}::${severityKey}`];
        if (findingDef) {
          const severity = severityKey === "Critical / Weak" ? "CRITICAL" : "DEVELOPING";
          const findingId = `${assessmentId}::${moduleIdFromCode("AIR")}::${domain.domain_id}::${severity}`;
          findings.push({
            finding_instance_id: findingId,
            assessment_id: assessmentId,
            module_id: moduleIdFromCode("AIR"),
            domain_id: domain.domain_id,
            workflow_id: domain.domain_id,
            question_id: `${domain.domain_id}::SUMMARY`,
            source_library_id: findingDef.finding_id || `AIR-${domain.domain_id}`,
            severity_band: severity,
            finding_title: findingDef.finding_title || "",
            finding_narrative: findingDef.finding_text || "",
            business_impact: findingDef.business_impact || "",
            likely_root_cause: `AI readiness in ${String(domain.domain_name || "").toLowerCase()} is not yet strong enough for confident pilot progression.`,
            evidence_required: "Validate policy, ownership, operating design, data, and control evidence for this domain.",
            evidence_strength: "OBSERVED_RISK",
            is_priority: severityKey === "Critical / Weak",
            created_at: nowIso(),
            updated_at: nowIso()
          });

          const recDef = bundle.recommendations_by_domain_trigger?.[`${domain.domain_id}::${severityKey}`];
          if (recDef) {
            const recId = `${findingId}::REC`;
            recommendations.push({
              recommendation_instance_id: recId,
              assessment_id: assessmentId,
              module_id: moduleIdFromCode("AIR"),
              linked_finding_instance_id: findingId,
              source_library_id: recDef.recommendation_id || `AIR-REC-${domain.domain_id}`,
              recommendation_title: recDef.recommendation_summary || "",
              recommendation_text: recDef.recommendation_detail || recDef.recommendation_summary || "",
              expected_outcome: `Improved readiness across ${String(domain.domain_name || "").toLowerCase()}.`,
              priority_level: recDef.priority || "",
              created_at: nowIso(),
              updated_at: nowIso()
            });

            const linkedActions = bundle.actions_by_recommendation?.[recDef.recommendation_id || ""] || [];
            const fallbackActions = linkedActions.length
              ? linkedActions
              : [{
                  action_id: `AIR-ACT-${domain.domain_id}`,
                  action_summary: recDef.recommendation_summary || "",
                  owner_role: recDef.default_owner_role || "AI Sponsor",
                  timeline_band: recDef.default_timeline_band || "30-60 days",
                  roadmap_phase: recDef.default_phase || "Phase 2"
                }];

            for (const [index, actionDef] of fallbackActions.entries()) {
              const actionId = `${findingId}::ACT::${String(index + 1).padStart(2, "0")}`;
              actions.push({
                action_instance_id: actionId,
                assessment_id: assessmentId,
                module_id: moduleIdFromCode("AIR"),
                linked_recommendation_instance_id: recId,
                source_library_id: actionDef.action_id || `AIR-ACT-${domain.domain_id}`,
                action_title: actionDef.action_summary || "",
                action_text: actionDef.action_summary || "",
                owner_role: actionDef.owner_role || "",
                indicative_timeline: actionDef.timeline_band || "",
                success_measure: metricDef.metric_name || "",
                priority_level: recDef.priority || "",
                created_at: nowIso(),
                updated_at: nowIso()
              });

              const phase = routePhase(actionDef.roadmap_phase || recDef.default_phase || "Phase 2");
              roadmap.push({
                roadmap_instance_id: `${assessmentId}::${moduleIdFromCode("AIR")}::ROAD::${String(roadmap.length + 1).padStart(4, "0")}`,
                assessment_id: assessmentId,
                module_id: moduleIdFromCode("AIR"),
                source_module_id: moduleIdFromCode("AIR"),
                source_finding_instance_id: findingId,
                source_action_instance_id: actionId,
                phase_code: phase.phaseCode,
                phase_name: phase.phaseName,
                initiative_title: String(actionDef.action_summary || "").slice(0, 140),
                initiative_description: actionDef.action_summary || "",
                owner_role: actionDef.owner_role || "",
                linked_metric_id: metricDef.metric_id || "",
                baseline_value: "",
                target_value: "",
                review_frequency: metricDef.frequency || "Monthly",
                business_outcome: recDef.recommendation_summary || "",
                priority_rank: roadmap.length + 1,
                status: "NOT_STARTED",
                created_at: nowIso(),
                updated_at: nowIso()
              });
            }
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
      readiness_status: readinessStatus,
      maturity_band: scorePct >= 80 ? "STRONG" : scorePct >= 60 ? "MANAGED" : scorePct >= 40 ? "DEVELOPING" : "WEAK"
    });
  }

  const overallPct = weightSum ? round(weightedTotal / weightSum, 2) : 0;
  const metricsTotal = successMeasures.length;
  const metricsCaptured = countCapturedMetricRows(successMeasures as any);
  const coverage = deriveModuleCoverage({ questionsAnswered: totalAnswered, questionsTotal: totalQuestions, metricsCaptured, metricsTotal });
  const readinessStatus = pilotReadyDomains && !conditionalDomains && !blockedDomains ? "PILOT_READY" : conditionalDomains || pilotReadyDomains ? "CONDITIONAL" : blockedDomains ? "BLOCKED" : "INCOMPLETE";
  return {
    overall_pct: overallPct,
    overall_maturity: overallPct >= 80 ? "Strong" : overallPct >= 60 ? "Managed" : overallPct >= 40 ? "Developing" : overallPct > 0 ? "Weak" : "Not scored",
    readiness_status: readinessStatus,
    answered: totalAnswered,
    total: totalQuestions,
    blocked_domains: blockedDomains,
    conditional_domains: conditionalDomains,
    pilot_ready_domains: pilotReadyDomains,
    domain_scores: domainSummaries,
    findings,
    recommendations,
    actions,
    roadmap,
    success_measures: successMeasures,
    metrics_total: metricsTotal,
    metrics_captured: metricsCaptured,
    question_completion_pct: coverage.questionCompletionPct,
    metric_completion_pct: coverage.metricCompletionPct,
    completion_pct: coverage.completionPct,
    complete: coverage.complete,
    executive_narrative: buildAirNarrative(overallPct, readinessStatus, domainSummaries, blockedDomains, conditionalDomains, pilotReadyDomains, findings)
  };
}

export async function computeAndPersistAiReadiness(assessmentId: string) {
  const summary = await buildAiReadinessSummary(assessmentId);
  const moduleId = moduleIdFromCode("AIR");
  const domainScores = summary.domain_scores.map((domain: any) => ({
    domain_score_id: `${assessmentId}::${moduleId}::${domain.domain_id}`,
    assessment_id: assessmentId,
    module_id: moduleId,
    domain_id: domain.domain_id,
    raw_score_total: round((domain.score_pct / 100) * (domain.questions_total * 5), 2),
    max_score_total: domain.questions_total * 5,
    score_pct: domain.score_pct,
    maturity_band: domain.maturity_band,
    questions_answered: domain.questions_answered,
    questions_total: domain.questions_total,
    is_complete: domain.is_complete,
    readiness_status: domain.readiness_status,
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
    readiness_status: summary.readiness_status,
    calculated_at: nowIso()
  };

  await replaceModuleArtifacts(assessmentId, "AIR", {
    domainScores,
    moduleScore,
    findings: summary.findings,
    recommendations: summary.recommendations,
    actions: summary.actions,
    roadmap: summary.roadmap
  });

  await updateAssessmentModuleState(assessmentId, "AIR", {}, {
    moduleStatus: summary.complete ? "COMPLETE" : summary.answered > 0 || (summary.metrics_captured || 0) > 0 ? "IN_PROGRESS" : "NOT_STARTED",
    completionPct: summary.completion_pct || 0,
    summaryPayload: summary
  });

  return summary;
}
