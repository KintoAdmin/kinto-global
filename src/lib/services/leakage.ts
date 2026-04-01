// @ts-nocheck
import { getReferenceBundle } from "@/lib/reference/bundle";
import { createBlankLeakageState, applyBenchmarkProfile } from "@/lib/reference/local/leakage";
import type { LeakCoreDefinition, LeakCoreRow, LeakState } from "@/lib/types/domain";
import { getAssessmentModule, updateAssessmentModuleState } from "@/lib/repositories/assessments";
import { replaceModuleArtifacts, upsertMetricCapture } from "@/lib/repositories/runtime";
import { moduleIdFromCode } from "@/lib/constants/modules";
import { mean, round } from "@/lib/utils/math";
import { nowIso, slug } from "@/lib/utils/ids";

function withinBenchmark(actual: number, benchmark: number, direction: string) {
  // Treat actual=0 as no data entered — cannot be "within benchmark" with no value
  if (actual === 0 && benchmark === 0) return false;
  if (actual === 0) return false;
  if (direction === "Higher is better") return actual >= benchmark;
  return actual <= benchmark;
}

function driverScore(drivers: Record<string, { actual: number; benchmark: number }>, driverDefs: { name: string; direction: string }[]) {
  const rows = driverDefs.map((driver) => {
    const values = drivers[driver.name] || { actual: 0, benchmark: 0 };
    const actual = Number(values.actual || 0);
    const benchmark = Number(values.benchmark || 0);
    const ok = withinBenchmark(actual, benchmark, driver.direction);
    const hasData = actual !== 0;  // only count drivers where data was actually entered
    return { name: driver.name, direction: driver.direction, actual, benchmark, within: ok, hasData };
  });
  const capturedRows = rows.filter((row) => row.hasData);
  const within = capturedRows.filter((row) => row.within).length;
  // Use answered-only scoring: score reflects quality of captured data, not penalised by gaps
  const score = capturedRows.length ? (within / capturedRows.length) * 100 : 0;
  return { score, within, total: rows.length, captured: capturedRows.length, rows };
}

function severityFromLeakage(value: number) {
  if (value >= 1_000_000) return "High";
  if (value >= 250_000) return "Medium";
  if (value > 0) return "Low";
  return "None";
}

function calcLeakage(coreName: string, coreData: { actual: number; benchmark: number; support: Record<string, number> }) {
  const actual = Number(coreData.actual || 0);
  const benchmark = Number(coreData.benchmark || 0);
  const support = coreData.support || {};
  if (coreName === "Qualified Lead Volume Leakage") {
    return Math.max(0, (benchmark - actual) * Number(support["Target Qualified Lead-to-Win %"] || 0) * Number(support["Target Average Deal Size"] || 0));
  }
  if (coreName === "Qualified Lead-to-Win Conversion Leakage") {
    return Math.max(0, Number(support["Actual Qualified Leads"] || 0) * (benchmark - actual) * Number(support["Target Average Deal Size"] || 0));
  }
  if (coreName === "Average Deal Size Leakage") {
    return Math.max(0, Number(support["Actual Qualified Leads"] || 0) * Number(support["Actual Qualified Lead-to-Win %"] || 0) * (benchmark - actual));
  }
  if ([
    "Pricing / Discount Leakage",
    "Unbilled / Uninvoiced Revenue Leakage",
    "Billing Error / Credit Note Leakage",
    "Revenue Churn Leakage",
    "Bad Debt / Collections Leakage"
  ].includes(coreName)) {
    return Math.max(0, actual - benchmark);
  }
  if (coreName === "Expansion Revenue Gap") {
    return Math.max(0, benchmark - actual);
  }
  return 0;
}


function hasLeakageSignal(value: unknown) {
  if (value == null) return false;
  if (typeof value === 'number') return Number.isFinite(value) && value !== 0;
  const raw = String(value).trim();
  return raw !== '' && raw !== '0' && raw !== '0.0';
}

function coreCompletionStats(coreName: string, state: LeakState, driverCount: number) {
  const coreState = state.cores[coreName] || { actual: 0, benchmark: 0, support: {}, drivers: {} };
  const supportKeys = Object.keys(coreState.support || {});
  const required = 2 + supportKeys.length + (driverCount * 2);
  let captured = 0;
  if (hasLeakageSignal(coreState.actual)) captured += 1;
  if (hasLeakageSignal(coreState.benchmark)) captured += 1;
  for (const key of supportKeys) {
    if (hasLeakageSignal(coreState.support[key])) captured += 1;
  }
  for (const driverState of Object.values(coreState.drivers || {})) {
    if (hasLeakageSignal((driverState as any).actual)) captured += 1;
    if (hasLeakageSignal((driverState as any).benchmark)) captured += 1;
  }
  return {
    required,
    captured,
    isComplete: required > 0 && captured === required,
  };
}

async function syncLeakageMetrics(assessmentId: string, summary: Record<string, any>) {
  await upsertMetricCapture(assessmentId, "LEAK", {
    metricId: "TOTAL_REVENUE_LEAKAGE",
    metricName: "Total Revenue Leakage",
    domainId: "HEADLINE",
    workflowId: "headline_total_leakage",
    baselineValue: String(summary.total_leakage ?? ""),
    currentValue: String(summary.total_leakage ?? ""),
    targetValue: "0",
    unit: "ZAR",
    reviewFrequency: "Monthly",
    ownerRole: "Revenue Leader",
    ragStatus: Number(summary.total_leakage || 0) > 0 ? "ACTION_REQUIRED" : "ON_TARGET",
    evidenceStrength: "MEASURED",
    sourceSystem: "Revenue Leakage Engine",
    notes: "Headline estimated leakage exposure from the shared leakage engine.",
  });

  await upsertMetricCapture(assessmentId, "LEAK", {
    metricId: "DRIVER_TARGET_ACHIEVEMENT_PCT",
    metricName: "Driver Target Achievement %",
    domainId: "HEADLINE",
    workflowId: "headline_driver_target_achievement",
    baselineValue: String(summary.headline?.driver_target_achievement_pct ?? ""),
    currentValue: String(summary.headline?.driver_target_achievement_pct ?? ""),
    targetValue: "100",
    unit: "%",
    reviewFrequency: "Monthly",
    ownerRole: "Revenue Leader",
    ragStatus: Number(summary.headline?.driver_target_achievement_pct || 0) >= 80 ? "ON_TRACK" : "ACTION_REQUIRED",
    evidenceStrength: "MEASURED",
    sourceSystem: "Revenue Leakage Engine",
    notes: "Average driver achievement against benchmark across leakage cores.",
  });

  for (const core of summary.core_rows || []) {
    const code = slug(String(core.name || "CORE")).toUpperCase();
    const workflowId = slug(String(core.name || "core"));
    await upsertMetricCapture(assessmentId, "LEAK", {
      metricId: `${code}_LEAKAGE`,
      metricName: `${core.name} Leakage`,
      domainId: code,
      workflowId,
      baselineValue: String(core.leakage ?? ""),
      currentValue: String(core.leakage ?? ""),
      targetValue: "0",
      unit: "ZAR",
      reviewFrequency: "Monthly",
      ownerRole: String(core.category || "Revenue Leader").includes("Cash") ? "Finance Lead" : String(core.category || "").includes("Retention") ? "Customer Success Lead" : "Revenue Leader",
      ragStatus: Number(core.leakage || 0) > 0 ? "ACTION_REQUIRED" : "ON_TARGET",
      evidenceStrength: "MEASURED",
      sourceSystem: "Revenue Leakage Engine",
      notes: String(core.formula || "Revenue Leakage formula"),
    });

    await upsertMetricCapture(assessmentId, "LEAK", {
      metricId: `${code}_DRIVER_SCORE`,
      metricName: `${core.name} Driver Score`,
      domainId: code,
      workflowId: `${workflowId}_drivers`,
      baselineValue: String(core.driver_score ?? ""),
      currentValue: String(core.driver_score ?? ""),
      targetValue: "100",
      unit: "%",
      reviewFrequency: "Monthly",
      ownerRole: String(core.category || "Revenue Leader").includes("Cash") ? "Finance Lead" : String(core.category || "").includes("Retention") ? "Customer Success Lead" : "Revenue Leader",
      ragStatus: Number(core.driver_score || 0) >= 80 ? "ON_TRACK" : "ACTION_REQUIRED",
      evidenceStrength: "MEASURED",
      sourceSystem: "Revenue Leakage Engine",
      notes: Array.isArray(core.driver_rows)
        ? core.driver_rows.filter((row: any) => !row.within).map((row: any) => row.name).join(", ") || "Revenue Leakage driver scoring"
        : "Revenue Leakage driver scoring",
    });
  }
}

function leakageCompletion(bundle: { model: { cores: LeakCoreDefinition[] } }, state: LeakState) {
  let required = 0;
  let captured = 0;
  let completeCores = 0;
  let anySignal = false;

  for (const core of bundle.model.cores) {
    const stats = coreCompletionStats(core.name, state, core.drivers.length);
    required += stats.required;
    captured += stats.captured;
    if (stats.captured > 0) anySignal = true;
    if (stats.isComplete) completeCores += 1;
  }

  const completionPct = required ? round((captured / required) * 100, 2) : 0;
  return {
    required,
    captured,
    completeCores,
    totalCores: bundle.model.cores.length,
    completionPct,
    isComplete: bundle.model.cores.length > 0 && completeCores === bundle.model.cores.length,
    hasAnySignal: anySignal,
  };
}

export async function getLeakageBundle() {
  return (await getReferenceBundle("LEAK")) as {
    model: { cores: LeakCoreDefinition[] };
    benchmarks: Record<string, string>[];
  };
}

export async function getLeakageState(assessmentId: string, options?: { persistIfMissing?: boolean }) {
  const module = await getAssessmentModule(assessmentId, "LEAK");
  const raw = module?.runtime_state as LeakState | null | undefined;
  if (raw && Object.keys(raw as unknown as Record<string, unknown>).length) return raw;
  const blank = createBlankLeakageState();
  if (options?.persistIfMissing === false) return blank;
  await updateAssessmentModuleState(assessmentId, "LEAK", blank as unknown as Record<string, unknown>, { moduleStatus: "NOT_STARTED", completionPct: 0 });
  return blank;
}

export async function saveLeakageState(assessmentId: string, nextState: LeakState) {
  const bundle = await getLeakageBundle();
  const progress = leakageCompletion(bundle, nextState);
  await updateAssessmentModuleState(assessmentId, "LEAK", nextState as unknown as Record<string, unknown>, {
    moduleStatus: progress.isComplete ? "COMPLETE" : progress.hasAnySignal ? "IN_PROGRESS" : "NOT_STARTED",
    completionPct: progress.completionPct
  });
  return nextState;
}

export async function setLeakageBenchmarkProfile(assessmentId: string, profileName: string) {
  const current = await getLeakageState(assessmentId);
  const next = applyBenchmarkProfile(current, profileName);
  return saveLeakageState(assessmentId, next);
}

export function computeLeakage(bundle: { model: { cores: LeakCoreDefinition[] } }, state: LeakState) {
  const coreRows: LeakCoreRow[] = [];
  let totalLeakage = 0;

  for (const core of bundle.model.cores) {
    const coreState = state.cores[core.name] || { actual: 0, benchmark: 0, support: {}, drivers: {} };
    const leakage = calcLeakage(core.name, coreState);
    const driver = driverScore(coreState.drivers || {}, core.drivers);
    const severity = severityFromLeakage(leakage);
    const status = leakage === 0 ? "Healthy" : ["High", "Medium"].includes(severity) ? "Adverse" : "Watch";

    const row: LeakCoreRow = {
      name: core.name,
      category: core.category,
      actual_label: core.actual_label,
      benchmark_label: core.benchmark_label,
      actual: Number(coreState.actual || 0),
      benchmark: Number(coreState.benchmark || 0),
      leakage,
      severity,
      status,
      driver_score: round(driver.score, 1),
      drivers_within: driver.within,
      drivers_total: driver.total,
      driver_rows: driver.rows,
      formula: core.leakage_formula_label,
      advisory: core.advisory,
      support: coreState.support || {}
    };

    totalLeakage += leakage;
    coreRows.push(row);
  }

  const top3 = [...coreRows].sort((a, b) => b.leakage - a.leakage).slice(0, 3);
  const avgDriverScore = round(mean(coreRows.map((row) => row.driver_score)), 1);
  const cores = state.cores || {};
  const ql = Number(cores["Qualified Lead Volume Leakage"]?.actual || 0);
  const qlTarget = Number(cores["Qualified Lead Volume Leakage"]?.benchmark || 0);
  const conv = Number(cores["Qualified Lead-to-Win Conversion Leakage"]?.actual || 0);
  const convTarget = Number(cores["Qualified Lead-to-Win Conversion Leakage"]?.benchmark || 0);
  const ads = Number(cores["Average Deal Size Leakage"]?.actual || 0);
  const adsTarget = Number(cores["Average Deal Size Leakage"]?.benchmark || 0);
  const revenueChurn = Number(cores["Revenue Churn Leakage"]?.actual || 0);
  const expansionRevenue = Number(cores["Expansion Revenue Gap"]?.actual || 0);
  const expansionTarget = Number(cores["Expansion Revenue Gap"]?.benchmark || 0);
  const unbilledRevenue = Number(cores["Unbilled / Uninvoiced Revenue Leakage"]?.actual || 0);
  const billingErrors = Number(cores["Billing Error / Credit Note Leakage"]?.actual || 0);
  const badDebt = Number(cores["Bad Debt / Collections Leakage"]?.actual || 0);
  const monthlyRevenueProxy = Math.max(1, (ads * Math.max(1, ql * Math.max(conv, 0.01))) / 3);
  const dsoProxy = round(((badDebt + unbilledRevenue) / monthlyRevenueProxy) * 30, 1);

  return {
    core_rows: coreRows,
    total_leakage: round(totalLeakage, 2),
    headline: {
      total_revenue_leakage: round(totalLeakage, 2),
      revenue_gap: round(totalLeakage, 2),
      driver_target_achievement_pct: avgDriverScore,
      top_3_leakage_areas: top3.map((row) => row.name)
    },
    commercial: {
      qualified_leads: ql,
      qualified_leads_target: qlTarget,
      qualified_lead_to_win_pct: conv,
      qualified_lead_to_win_pct_target: convTarget,
      average_deal_size: ads,
      average_deal_size_target: adsTarget,
      revenue_churn: revenueChurn,
      expansion_revenue: expansionRevenue,
      expansion_revenue_target: expansionTarget
    },
    operational: {
      unbilled_revenue: unbilledRevenue,
      billing_error_credit_note_value: billingErrors,
      bad_debt_collections_leakage: badDebt,
      dso_proxy_days: dsoProxy
    }
  };
}

export async function computeAndPersistLeakage(assessmentId: string) {
  const bundle = await getLeakageBundle();
  const state = await getLeakageState(assessmentId);
  const summary = computeLeakage(bundle, state);
  const moduleId = moduleIdFromCode("LEAK");

  const domainScores = summary.core_rows.map((core, index) => {
    const domainId = `LEAK-D${String(index + 1).padStart(2, "0")}`;
    // Use answered-only scoring: only count drivers where actual data was entered
    const capturedDrivers = core.driver_rows.filter((row: any) => Number(row.actual || 0) !== 0);
    const withinCount = capturedDrivers.filter((row: any) => row.within).length;
    // Score = % of captured drivers that are within benchmark (0 if no data)
    const scorePct = capturedDrivers.length
      ? round((withinCount / capturedDrivers.length) * 100, 2)
      : 0;
    const completionStats = coreCompletionStats(core.name, state, core.driver_rows.length);
    return {
      domain_score_id: `${assessmentId}::${moduleId}::${domainId}`,
      assessment_id: assessmentId,
      module_id: moduleId,
      domain_id: domainId,
      raw_score_total: withinCount,
      max_score_total: capturedDrivers.length,
      score_pct: scorePct,
      maturity_band: capturedDrivers.length === 0
        ? "NOT_SCORED"
        : scorePct >= 80 ? "STRONG" : scorePct >= 60 ? "MANAGED" : scorePct >= 40 ? "DEVELOPING" : "WEAK",
      questions_answered: completionStats.captured,
      questions_total: completionStats.required,
      is_complete: completionStats.isComplete,
      calculated_at: nowIso()
    };
  });

  const completion = leakageCompletion(bundle, state);
  const enrichedSummary = {
    ...summary,
    completion_pct: completion.completionPct,
    complete_cores: completion.completeCores,
    total_cores: completion.totalCores,
    is_complete: completion.isComplete,
  };
  // Only average over cores that have captured data — consistent with answered-only scoring
  const scoredDomains = domainScores.filter((row) => Number(row.max_score_total) > 0);
  const overallPct = scoredDomains.length ? round(mean(scoredDomains.map((row) => Number(row.score_pct))), 2) : 0;
  const moduleScore = {
    module_score_id: `${assessmentId}::${moduleId}`,
    assessment_id: assessmentId,
    module_id: moduleId,
    raw_score_total: round((overallPct / 100) * (summary.core_rows.length * 25), 2),
    max_score_total: summary.core_rows.length * 25,
    score_pct: overallPct,
    maturity_band: scoredDomains.length === 0
      ? "NOT_SCORED"
      : overallPct >= 80 ? "STRONG" : overallPct >= 60 ? "MANAGED" : overallPct >= 40 ? "DEVELOPING" : "WEAK",
    domains_completed: completion.completeCores,
    domains_total: completion.totalCores,
    is_complete: completion.isComplete,
    total_leakage: summary.total_leakage,
    avg_driver_score: summary.headline.driver_target_achievement_pct,
    critical_exposures: summary.core_rows.filter((row) => ["High", "Medium"].includes(row.severity)).length,
    calculated_at: nowIso()
  };

  const findings: Record<string, unknown>[] = [];
  const recommendations: Record<string, unknown>[] = [];
  const actions: Record<string, unknown>[] = [];
  const roadmap: Record<string, unknown>[] = [];

  summary.core_rows.forEach((core, index) => {
    if (core.leakage <= 0) return;
    const domainId = `LEAK-D${String(index + 1).padStart(2, "0")}`;
    const workflowId = `LEAK-WF-${String(index + 1).padStart(3, "0")}`;
    const severity = ["High", "Medium"].includes(core.severity) ? "CRITICAL" : "DEVELOPING";
    const findingId = `${assessmentId}::${moduleId}::${domainId}::${severity}`;
    const weakDrivers = core.driver_rows.filter((row) => !row.within).map((row) => row.name).slice(0, 5);

    findings.push({
      finding_instance_id: findingId,
      assessment_id: assessmentId,
      module_id: moduleId,
      domain_id: domainId,
      workflow_id: workflowId,
      question_id: `${workflowId}::SUMMARY`,
      source_library_id: `LEAK-FIND-${slug(core.name)}`,
      severity_band: severity,
      finding_title: `${core.name} exposure detected`,
      finding_narrative: `${core.status} position in ${core.name}. Estimated exposure is R ${core.leakage.toLocaleString("en-ZA", { maximumFractionDigits: 0 })} and driver achievement is ${Math.round(core.driver_score)}%.`,
      business_impact: `Potential commercial drag across ${core.category.toLowerCase()}.`,
      likely_root_cause: weakDrivers.join(", ") || "Benchmark variance requires validation.",
      evidence_required: "Validate source inputs, benchmark assumptions, and revenue impact estimate.",
      evidence_strength: "MEASURED",
      is_priority: severity === "CRITICAL",
      created_at: nowIso(),
      updated_at: nowIso()
    });

    const recommendationId = `${findingId}::REC`;
    recommendations.push({
      recommendation_instance_id: recommendationId,
      assessment_id: assessmentId,
      module_id: moduleId,
      linked_finding_instance_id: findingId,
      source_library_id: `LEAK-REC-${slug(core.name)}`,
      recommendation_title: `Reduce ${core.name}`,
      recommendation_text: core.advisory.actions || "Reduce the leakage source through process and control redesign.",
      expected_outcome: "Lower leakage and stronger commercial control.",
      priority_level: severity === "CRITICAL" ? "HIGH" : "MEDIUM",
      created_at: nowIso(),
      updated_at: nowIso()
    });

    const actionId = `${findingId}::ACT`;
    actions.push({
      action_instance_id: actionId,
      assessment_id: assessmentId,
      module_id: moduleId,
      linked_recommendation_instance_id: recommendationId,
      source_library_id: `LEAK-ACT-${slug(core.name)}`,
      action_title: `Implement controls for ${core.name}`,
      action_text: `${core.advisory.process || ""} ${core.advisory.automation || ""}`.trim(),
      owner_role: core.category.includes("Cash") ? "Finance Lead" : core.category.includes("Retention") ? "Customer Success Lead" : "Revenue Leader",
      indicative_timeline: severity === "CRITICAL" ? "0-30 days" : "30-60 days",
      success_measure: core.name,
      priority_level: severity === "CRITICAL" ? "HIGH" : "MEDIUM",
      created_at: nowIso(),
      updated_at: nowIso()
    });

    const phaseCode = severity === "CRITICAL" ? "P1" : "P2";
    roadmap.push({
      roadmap_instance_id: `${assessmentId}::${moduleId}::ROAD::${String(index + 1).padStart(4, "0")}`,
      assessment_id: assessmentId,
      module_id: moduleId,
      source_module_id: moduleId,
      source_finding_instance_id: findingId,
      source_action_instance_id: actionId,
      phase_code: phaseCode,
      phase_name: phaseCode === "P1" ? "Stabilise and Protect" : "Standardise and Strengthen",
      initiative_title: `Reduce ${core.name}`,
      initiative_description: core.advisory.actions || `Reduce estimated exposure in ${core.name}.`,
      owner_role: core.category.includes("Cash") ? "Finance Lead" : core.category.includes("Retention") ? "Customer Success Lead" : "Revenue Leader",
      linked_metric_id: `LEAK-MET-${slug(core.name)}`,
      baseline_value: String(core.leakage),
      target_value: "0",
      review_frequency: "Monthly",
      business_outcome: "Reduced leakage exposure and tighter revenue control.",
      priority_rank: index + 1,
      status: "NOT_STARTED",
      created_at: nowIso(),
      updated_at: nowIso()
    });
  });

  await syncLeakageMetrics(assessmentId, enrichedSummary as Record<string, any>);

  await replaceModuleArtifacts(assessmentId, "LEAK", {
    domainScores,
    moduleScore,
    findings,
    recommendations,
    actions,
    roadmap
  });

  await updateAssessmentModuleState(assessmentId, "LEAK", state as unknown as Record<string, unknown>, {
    moduleStatus: completion.isComplete ? "COMPLETE" : completion.hasAnySignal ? "IN_PROGRESS" : "NOT_STARTED",
    completionPct: completion.completionPct,
    summaryPayload: enrichedSummary as unknown as Record<string, unknown>
  });

  return enrichedSummary;
}
