// @ts-nocheck
import { getReferenceBundle } from "@/lib/reference/bundle";
import { aiUsecaseStatus, ensureMetricCapture, getAllModuleScores, getResponseMap } from "@/lib/services/common";
import { countCapturedMetricRows, deriveModuleCoverage } from "@/lib/services/derived-state";
import { replaceModuleArtifacts } from "@/lib/repositories/runtime";
import { updateAssessmentModuleState } from "@/lib/repositories/assessments";
import { moduleIdFromCode } from "@/lib/constants/modules";
import { mean, round } from "@/lib/utils/math";
import { nowIso } from "@/lib/utils/ids";

function modulePctById(moduleScores: any[], moduleId: string) {
  return Number(moduleScores.find((row) => row.module_id === moduleId)?.score_pct || 0);
}

function moduleReadinessById(moduleScores: any[], moduleId: string) {
  return String(moduleScores.find((row) => row.module_id === moduleId)?.readiness_status || "");
}


// ── AIUC narrative synthesis ── Prioritization-engine narrative ────────────
// Explains WHAT to pilot, WHAT to prepare, WHAT to fix first, and WHY.
function buildAiucNarrative(
  overallPct: number,
  readinessStatus: string,
  pilotReady: number,
  conditional: number,
  blocked: number,
  domains: any[],
  opsPct: number,
  dataPct: number,
  airPct: number,
  airStatus: string,
  usecaseRows: any[]
): string[] {
  const scored = domains.filter((d: any) => d.questions_answered > 0 || d.is_complete);
  if (!scored.length && !usecaseRows.some((u: any) => u.is_complete)) {
    return ["AI Use Case scoring is not yet complete. Score each use case across the readiness and value factors to generate prioritisation guidance."];
  }

  const lines: string[] = [];
  const total = pilotReady + conditional + blocked;

  // Upstream dependency context — this is the AIUC module's core commercial value
  const upstreamWeak = [];
  if (opsPct < 60) upstreamWeak.push(`operational maturity (${opsPct.toFixed(0)}%)`);
  if (dataPct < 60) upstreamWeak.push(`data foundation (${dataPct.toFixed(0)}%)`);
  if (airPct < 60 || airStatus !== "PILOT_READY") upstreamWeak.push(`AI readiness (${airPct.toFixed(0)}%)`);

  // Opening — portfolio prioritization summary
  if (pilotReady > 0 && !conditional && !blocked) {
    lines.push(`The AI use case portfolio is in a strong position. All ${total} assessed use cases are rated as Pilot Ready, meaning the upstream dependencies — operational controls, data quality, and AI governance — are sufficiently established to support controlled deployments. This is a commercially significant finding: the business is in a position to begin generating measurable value from AI in the near term.`);
  } else if (pilotReady > 0) {
    lines.push(`The AI use case portfolio is mixed. ${pilotReady} use case${pilotReady !== 1 ? "s are" : " is"} rated Pilot Ready and can proceed to a controlled deployment now. ${conditional} ${conditional !== 1 ? "are" : "is"} Conditionally Ready — viable in the near term once specific gaps are addressed. ${blocked} ${blocked !== 1 ? "are" : "is"} currently Blocked by upstream readiness constraints that must be resolved first.`);
  } else if (conditional > 0) {
    lines.push(`No use cases are currently ready to pilot. ${conditional} use case${conditional !== 1 ? "s are" : " is"} Conditionally Ready — the use case potential is confirmed, but specific upstream dependencies must be resolved before deployment can be governed responsibly. ${blocked} ${blocked !== 1 ? "are" : "is"} Blocked by more fundamental constraints.`);
  } else if (blocked > 0) {
    lines.push(`All assessed use cases are currently blocked. This is a direct consequence of unresolved upstream constraints — the business must address its operational, data, or AI readiness gaps before any AI deployment can be managed safely. The use cases themselves may be commercially attractive, but deploying them now would create ungoverned AI risk rather than controlled business value.`);
  } else {
    lines.push(`AI use case prioritisation is in progress. Complete scoring across all use cases and factor dimensions to generate the full Pilot Now / Prepare First / Fix Foundations / Not Suitable prioritisation view.`);
  }

  // Pilot-ready use cases — named
  const pilotRows = usecaseRows.filter((u: any) => u.runtime_status === "PILOT_READY").slice(0, 3);
  if (pilotRows.length > 0) {
    lines.push(`The use cases ready to pilot now are: ${pilotRows.map((u: any) => u.usecase_name || u.usecase_id).join(", ")}. These should be scoped as a 30–60 day controlled pilot with a clear success indicator, named owner, and defined rollback condition.`);
  }

  // Conditional use cases — what blocks them
  const condRows = usecaseRows.filter((u: any) => u.runtime_status === "CONDITIONALLY_READY").slice(0, 3);
  if (condRows.length > 0) {
    const condNames = condRows.map((u: any) => u.usecase_name || u.usecase_id).join(", ");
    lines.push(`The use cases that are conditionally ready — including ${condNames} — can be prepared in parallel with the operational and data improvements underway. These are the P2 targets: position them for pilot once the prerequisite readiness controls are confirmed.`);
  }

  // Upstream gaps — specific and commercially framed
  if (upstreamWeak.length >= 2) {
    lines.push(`The primary constraint on this portfolio is upstream readiness. Weaknesses in ${upstreamWeak.join(" and ")} are gating multiple use cases that would otherwise be viable. Investing in these foundations is not preparatory overhead — it is the direct enabler of the AI value identified in this assessment.`);
  } else if (upstreamWeak.length === 1) {
    lines.push(`The main constraint on use case readiness is ${upstreamWeak[0]}. Resolving this gap will unlock the use cases currently rated as Conditionally Ready and potentially move blocked use cases into the preparatory pipeline.`);
  }

  // Sequencing instruction
  if (blocked > 0 && (opsPct < 60 || dataPct < 60 || airPct < 60)) {
    lines.push("The recommended sequencing is: (1) resolve the P1 operational and data foundation gaps identified in those modules, (2) confirm AI readiness controls in P2, (3) deploy the highest-ranked conditionally ready use cases in P3. This sequence maximises the probability that AI deployments produce sustained business value rather than isolated experiments.");
  }

  return lines;
}

export async function buildAiUsecaseSummary(assessmentId: string) {
  const bundle = (await getReferenceBundle("AIUC")) as any;
  const responseMap = await getResponseMap(assessmentId, "AIUC");
  const moduleScores = await getAllModuleScores(assessmentId);
  const opsPct = modulePctById(moduleScores, moduleIdFromCode("OPS"));
  const dataPct = modulePctById(moduleScores, moduleIdFromCode("DATA"));
  const airPct = modulePctById(moduleScores, moduleIdFromCode("AIR"));
  const airStatus = moduleReadinessById(moduleScores, moduleIdFromCode("AIR"));
  const factors = bundle.factors || [];
  const domains = bundle.domains || [];
  const domainSummaries: any[] = [];
  const usecaseRows: any[] = [];
  const findings: any[] = [];
  const recommendations: any[] = [];
  const actions: any[] = [];
  const roadmap: any[] = [];
  let totalAnswered = 0;
  let totalQuestions = 0;
  let pilotReady = 0;
  let conditional = 0;
  let blocked = 0;

  for (const domain of domains) {
    const usecases = bundle.usecases_by_domain?.[domain.domain_id] || [];
    const domainRankScores: number[] = [];
    const statusCounts = { PILOT_READY: 0, CONDITIONALLY_READY: 0, BLOCKED: 0, INCOMPLETE: 0 };
    let domainAnswered = 0;
    let domainTotal = 0;

    for (const usecase of usecases) {
      const factorScores: any[] = [];
      let answered = 0;
      for (const factor of factors) {
        const questionId = `${usecase.usecase_id}::${factor.factor_id}`;
        const score = Number(responseMap[questionId]?.score_1_to_5 || responseMap[questionId]?.score || 0);
        if (score > 0) answered += 1;
        factorScores.push({ ...factor, score });
      }
      const total = factors.length;
      const isComplete = total > 0 && answered === total;
      const weightedScore = factorScores.reduce((sum, factor) => sum + Number(factor.score || 0) * Number(factor.weight_pct || 0), 0);
      const rankPct = round(weightedScore * 20, 2);
      const status = aiUsecaseStatus(rankPct, isComplete, opsPct, dataPct, airPct, airStatus);
      statusCounts[status as keyof typeof statusCounts] += 1;
      if (status === "PILOT_READY") pilotReady += 1;
      if (status === "CONDITIONALLY_READY") conditional += 1;
      if (status === "BLOCKED") blocked += 1;
      if (isComplete) domainRankScores.push(rankPct);
      domainAnswered += answered;
      domainTotal += total;
      totalAnswered += answered;
      totalQuestions += total;

      const metricDef = usecase.metric_def || {};
      const capture = await ensureMetricCapture(assessmentId, "AIUC", { ...metricDef, workflow_id: usecase.usecase_id, domain_id: domain.domain_id });
      usecaseRows.push({
        ...usecase,
        factor_scores: factorScores,
        answered,
        total,
        is_complete: isComplete,
        rank_pct: rankPct,
        runtime_status: status,
        ops_pct: opsPct,
        data_pct: dataPct,
        air_pct: airPct,
        air_status: airStatus,
        metric_capture: capture
      });

      if (["BLOCKED", "CONDITIONALLY_READY"].includes(status)) {
        const severity = status === "BLOCKED" ? "CRITICAL" : "DEVELOPING";
        const findingId = `${assessmentId}::${moduleIdFromCode("AIUC")}::${usecase.usecase_id}::${severity}`;
        const blockers: string[] = [];
        if (opsPct < 60) blockers.push("operational maturity");
        if (dataPct < 60) blockers.push("data readiness");
        if (airPct < 60 || airStatus !== "PILOT_READY") blockers.push("AI readiness controls");
        if (rankPct < 40) blockers.push("use case attractiveness/feasibility");

        findings.push({
          finding_instance_id: findingId,
          assessment_id: assessmentId,
          module_id: moduleIdFromCode("AIUC"),
          domain_id: domain.domain_id,
          workflow_id: usecase.usecase_id,
          question_id: `${usecase.usecase_id}::SUMMARY`,
          source_library_id: `AIUC-FIND::${usecase.usecase_id}::${status}`,
          severity_band: severity,
          finding_title: `${usecase.usecase_name || "Use case"} is ${status.replaceAll("_", " ").toLowerCase()}`,
          finding_narrative: usecase.usecase_description || "",
          business_impact: usecase.business_value_driver || "",
          likely_root_cause: blockers.join(", ") || "Readiness gating needs review.",
          evidence_required: usecase.readiness_prerequisite || "Confirm value, feasibility, and prerequisite readiness.",
          evidence_strength: "ESTIMATED",
          is_priority: status === "BLOCKED" && rankPct >= 40,
          created_at: nowIso(),
          updated_at: nowIso()
        });

        const recommendationId = `${findingId}::REC`;
        recommendations.push({
          recommendation_instance_id: recommendationId,
          assessment_id: assessmentId,
          module_id: moduleIdFromCode("AIUC"),
          linked_finding_instance_id: findingId,
          source_library_id: `AIUC-REC::${usecase.usecase_id}::${status}`,
          recommendation_title: `Prepare ${usecase.usecase_name || "this use case"} for a controlled pilot`,
          recommendation_text: usecase.readiness_prerequisite || "Close the identified prerequisite gaps before pilot launch.",
          expected_outcome: `Clearer pathway to deploy ${usecase.usecase_name || "the use case"}.`,
          priority_level: status === "BLOCKED" ? "HIGH" : "MEDIUM",
          created_at: nowIso(),
          updated_at: nowIso()
        });

        const actionId = `${findingId}::ACT`;
        actions.push({
          action_instance_id: actionId,
          assessment_id: assessmentId,
          module_id: moduleIdFromCode("AIUC"),
          linked_recommendation_instance_id: recommendationId,
          source_library_id: `AIUC-ACT::${usecase.usecase_id}::${status}`,
          action_title: `Resolve prerequisites for ${usecase.usecase_name || "this use case"}`,
          action_text: usecase.readiness_prerequisite || "Assign owners, confirm controls, and close readiness gaps.",
          owner_role: usecase.review_owner || usecase.primary_user_role || "Transformation Lead",
          indicative_timeline: status === "CONDITIONALLY_READY" ? "30-60 days" : "Immediate",
          success_measure: metricDef.metric_name || "",
          priority_level: status === "BLOCKED" ? "HIGH" : "MEDIUM",
          created_at: nowIso(),
          updated_at: nowIso()
        });

        const phaseCode = status === "BLOCKED" ? "P1" : "P2";
        roadmap.push({
          roadmap_instance_id: `${assessmentId}::${moduleIdFromCode("AIUC")}::ROAD::${String(roadmap.length + 1).padStart(4, "0")}`,
          assessment_id: assessmentId,
          module_id: moduleIdFromCode("AIUC"),
          source_module_id: moduleIdFromCode("AIUC"),
          source_finding_instance_id: findingId,
          source_action_instance_id: actionId,
          phase_code: phaseCode,
          phase_name: phaseCode === "P1" ? "Stabilise and Protect" : "Standardise and Strengthen",
          initiative_title: `Prepare ${usecase.usecase_name || "use case"} prerequisites`,
          initiative_description: usecase.readiness_prerequisite || usecase.usecase_description || "",
          owner_role: usecase.review_owner || usecase.primary_user_role || "Transformation Lead",
          linked_metric_id: metricDef.metric_id || "",
          baseline_value: String(capture.baseline_value || ""),
          target_value: String(capture.target_value || ""),
          review_frequency: capture.review_frequency || "Monthly",
          business_outcome: usecase.business_value_driver || `Move ${usecase.usecase_name || "the use case"} toward pilot readiness.`,
          priority_rank: roadmap.length + 1,
          status: "NOT_STARTED",
          created_at: nowIso(),
          updated_at: nowIso()
        });
      } else if (status === "PILOT_READY") {
        roadmap.push({
          roadmap_instance_id: `${assessmentId}::${moduleIdFromCode("AIUC")}::ROAD::${String(roadmap.length + 1).padStart(4, "0")}`,
          assessment_id: assessmentId,
          module_id: moduleIdFromCode("AIUC"),
          source_module_id: moduleIdFromCode("AIUC"),
          source_finding_instance_id: "",
          source_action_instance_id: "",
          phase_code: "P3",
          phase_name: "Optimize, Automate, and AI-Enable",
          initiative_title: `Pilot ${usecase.usecase_name || "use case"}`,
          initiative_description: usecase.usecase_description || "",
          owner_role: usecase.review_owner || usecase.primary_user_role || "Transformation Lead",
          linked_metric_id: metricDef.metric_id || "",
          baseline_value: String(capture.baseline_value || ""),
          target_value: String(capture.target_value || ""),
          review_frequency: capture.review_frequency || "Monthly",
          business_outcome: usecase.business_value_driver || `Launch a controlled pilot for ${usecase.usecase_name || "the use case"}.`,
          priority_rank: roadmap.length + 1,
          status: "NOT_STARTED",
          created_at: nowIso(),
          updated_at: nowIso()
        });
      }
    }

    const scorePct = domainRankScores.length ? round(mean(domainRankScores), 2) : 0;
    const deploymentStatus = statusCounts.PILOT_READY && !statusCounts.BLOCKED && !statusCounts.CONDITIONALLY_READY
      ? "PILOT_READY"
      : statusCounts.CONDITIONALLY_READY || statusCounts.PILOT_READY
        ? "CONDITIONALLY_READY"
        : statusCounts.BLOCKED
          ? "BLOCKED"
          : "INCOMPLETE";

    domainSummaries.push({
      domain_id: domain.domain_id,
      domain_name: domain.domain_name,
      score_pct: scorePct,
      questions_answered: domainAnswered,
      questions_total: domainTotal,
      is_complete: usecases.every((usecase: any) => usecaseRows.find((row) => row.usecase_id === usecase.usecase_id)?.is_complete),
      deployment_status: deploymentStatus,
      maturity_band: scorePct >= 80 ? "STRONG" : scorePct >= 60 ? "MANAGED" : scorePct >= 40 ? "DEVELOPING" : "WEAK"
    });
  }

  const completeScores = domainSummaries.filter((row) => row.is_complete && row.score_pct > 0).map((row) => row.score_pct);
  const overallPct = completeScores.length ? round(mean(completeScores), 2) : 0;
  const readinessStatus = pilotReady && !conditional && !blocked ? "PILOT_READY" : conditional || pilotReady ? "CONDITIONAL" : blocked ? "BLOCKED" : "INCOMPLETE";
  const metricsTotal = usecaseRows.filter((row: any) => row.metric_capture?.metric_id).length;
  const metricsCaptured = countCapturedMetricRows(usecaseRows.map((row: any) => row.metric_capture));
  const coverage = deriveModuleCoverage({ questionsAnswered: totalAnswered, questionsTotal: totalQuestions, metricsCaptured, metricsTotal });
  return {
    overall_pct: overallPct,
    overall_maturity: overallPct >= 80 ? "Strong" : overallPct >= 60 ? "Managed" : overallPct >= 40 ? "Developing" : overallPct > 0 ? "Weak" : "Not scored",
    readiness_status: readinessStatus,
    answered: totalAnswered,
    total: totalQuestions,
    pilot_ready_usecases: pilotReady,
    conditional_usecases: conditional,
    blocked_usecases: blocked,
    upstream: { ops_pct: opsPct, data_pct: dataPct, air_pct: airPct, air_status: airStatus },
    domain_scores: domainSummaries,
    usecases: usecaseRows,
    findings,
    recommendations,
    actions,
    roadmap,
    metrics_total: metricsTotal,
    metrics_captured: metricsCaptured,
    question_completion_pct: coverage.questionCompletionPct,
    metric_completion_pct: coverage.metricCompletionPct,
    completion_pct: coverage.completionPct,
    complete: coverage.complete,
    executive_narrative: buildAiucNarrative(overallPct, readinessStatus, pilotReady, conditional, blocked, domainSummaries, opsPct, dataPct, airPct, airStatus, usecaseRows)
  };
}

export async function computeAndPersistAiUsecases(assessmentId: string) {
  const summary = await buildAiUsecaseSummary(assessmentId);
  const moduleId = moduleIdFromCode("AIUC");
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
    deployment_status: domain.deployment_status,
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
    pilot_ready_usecases: summary.pilot_ready_usecases,
    conditional_usecases: summary.conditional_usecases,
    blocked_usecases: summary.blocked_usecases,
    readiness_status: summary.readiness_status,
    calculated_at: nowIso()
  };

  await replaceModuleArtifacts(assessmentId, "AIUC", {
    domainScores,
    moduleScore,
    findings: summary.findings,
    recommendations: summary.recommendations,
    actions: summary.actions,
    roadmap: summary.roadmap
  });

  await updateAssessmentModuleState(assessmentId, "AIUC", {}, {
    moduleStatus: summary.complete ? "COMPLETE" : summary.answered > 0 || (summary.metrics_captured || 0) > 0 ? "IN_PROGRESS" : "NOT_STARTED",
    completionPct: summary.completion_pct || 0,
    summaryPayload: summary
  });

  return summary;
}
