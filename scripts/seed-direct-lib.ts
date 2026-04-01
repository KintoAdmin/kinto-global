// @ts-nocheck
import { upsertClient } from "@/lib/repositories/clients";
import { createAssessment } from "@/lib/repositories/assessments";
import { getReferenceBundle } from "@/lib/reference/bundle";
import { moduleIdFromCode, type ModuleCode } from "@/lib/constants/modules";
import { getAdminClient } from "@/lib/supabase/admin";
import { nowIso, metricCaptureId, responseId } from "@/lib/utils/ids";
import { calculateVarianceToTarget, parseNumeric } from "@/lib/services/common";
import { computeAndPersistAudit } from "@/lib/services/audit";
import { computeAndPersistDataFoundation } from "@/lib/services/data-foundation";
import { computeAndPersistAiReadiness } from "@/lib/services/ai-readiness";
import { computeAndPersistAiUsecases } from "@/lib/services/ai-usecase";
import { computeAndPersistLeakage, getLeakageBundle, saveLeakageState } from "@/lib/services/leakage";
import { computeAndPersistCombinedRoadmap } from "@/lib/services/roadmap";
import { buildAssessmentReport, buildStandaloneModuleReport } from "@/lib/services/report";
import { publishAllModulesForAssessment } from "@/lib/interoperability/publish-all";
import { createBlankLeakageState, applyBenchmarkProfile, resolveBenchmarkProfileName } from "@/lib/reference/local/leakage";

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function numeric(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function scenarioScore(scenario: any, moduleCode: string, index: number) {
  const cycle = scenario?.questionCycles?.[moduleCode] || [3, 3, 4, 2, 4, 3];
  return cycle[index % cycle.length];
}

function buildScenarioMetricValues(metric: any, scenario: any, index: number) {
  const unit = String(metric?.unit || '').toLowerCase();
  const profile = scenario.metricProfile;

  let target = 10 + (index % 5) * 2;
  let current = target * profile.genericFactor;
  let baseline = current * 0.92;

  if (unit.includes('%') || unit.includes('percent') || unit.includes('ratio')) {
    target = 90 + (index % 6);
    current = target * profile.pctFactor;
    baseline = current * 0.94;
  } else if (unit.includes('day') || unit.includes('hour') || unit.includes('minute')) {
    target = 5 + (index % 4);
    current = target * profile.timeFactor;
    baseline = current * 1.08;
  } else if (unit.includes('count') || unit.includes('volume') || unit.includes('lead')) {
    target = 100 + (index % 8) * 20;
    current = target * profile.countFactor;
    baseline = current * 0.93;
  } else if (unit.includes('currency') || unit.includes('zar') || unit.includes('revenue') || unit.includes('margin')) {
    target = 100000 + index * 2500;
    current = target * profile.currencyFactor;
    baseline = current * 0.95;
  }

  return {
    baselineValue: String(round2(baseline)),
    currentValue: String(round2(current)),
    targetValue: String(round2(target)),
    trendDirection: profile.trend,
    ragStatus: profile.rag,
    baselineDate: '2026-01-01',
    notes: `${scenario.label} seeded metric coverage.`,
  };
}

function scaledLeakageValue(benchmark: unknown, factor: number, fallbackBase: number, index: number) {
  const base = numeric(benchmark) || fallbackBase + index * 3;
  return round2(base * factor);
}

function fallbackLeakBenchmark(coreName: string, index: number) {
  const numericFallbacks: Record<string, number> = {
    'Qualified Lead Volume Leakage': 55 + index * 2,
    'Qualified Lead-to-Win Conversion Leakage': 0.22,
    'Average Deal Size Leakage': 28,
    'Pricing / Discount Leakage': 8,
    'Unbilled / Uninvoiced Revenue Leakage': 3,
    'Billing Error / Credit Note Leakage': 1,
    'Revenue Churn Leakage': 6,
    'Expansion Revenue Gap': 12,
    'Bad Debt / Collections Leakage': 1.2,
  };
  return numericFallbacks[coreName] ?? (25 + index * 2);
}

function fallbackLeakSupportValue(key: string, index: number) {
  const fallback: Record<string, number> = {
    'Target Qualified Lead-to-Win %': 0.22,
    'Target Average Deal Size': 28,
    'Actual Qualified Leads': 48 + index,
    'Actual Qualified Lead-to-Win %': 0.18,
  };
  return fallback[key] ?? (20 + index);
}

function fallbackLeakDriverBenchmark(direction: string, index: number) {
  if (String(direction || '').toLowerCase().includes('lower')) return 7 + (index % 4);
  return 80 + (index % 8) * 2;
}

async function bulkUpsertQuestionFacts(assessmentId: string, moduleCode: ModuleCode, rows: any[]) {
  if (!rows.length) return;
  const supabase = getAdminClient();
  const moduleId = moduleIdFromCode(moduleCode);
  const now = nowIso();
  const factRows = rows.map((row) => ({
    question_fact_id: responseId(assessmentId, moduleId, row.questionId),
    assessment_id: assessmentId,
    module_id: moduleId,
    module_code: moduleCode,
    domain_id: String(row.domainId || ''),
    workflow_id: String(row.workflowId || ''),
    question_id: row.questionId,
    score_1_to_5: Number(row.score || 0),
    score: Number(row.score || 0),
    notes: String(row.notes || ''),
    evidence_summary: String(row.evidenceSummary || ''),
    assessor_confidence: String(row.assessorConfidence || ''),
    is_complete: Number(row.score || 0) > 0,
    scored_at: Number(row.score || 0) > 0 ? now : null,
    updated_at: now,
  }));
  const legacyRows = factRows.map((row) => ({
    response_id: row.question_fact_id,
    assessment_id: row.assessment_id,
    module_id: row.module_id,
    domain_id: row.domain_id,
    workflow_id: row.workflow_id,
    question_id: row.question_id,
    score_1_to_5: row.score_1_to_5,
    score: row.score,
    notes: row.notes,
    evidence_summary: row.evidence_summary,
    assessor_confidence: row.assessor_confidence,
    is_complete: row.is_complete,
    scored_at: row.scored_at,
    updated_at: row.updated_at,
  }));
  const { error: factError } = await supabase.from('assessment_question_facts').upsert(factRows, { onConflict: 'assessment_id,module_id,question_id' });
  if (factError) throw factError;
  const { error: legacyError } = await supabase.from('question_responses').upsert(legacyRows, { onConflict: 'assessment_id,module_id,question_id' });
  if (legacyError) throw legacyError;
}

async function bulkUpsertMetricFacts(assessmentId: string, moduleCode: ModuleCode, rows: any[]) {
  if (!rows.length) return;
  const supabase = getAdminClient();
  const moduleId = moduleIdFromCode(moduleCode);
  const now = nowIso();
  const factRows = rows.map((row) => {
    const baseline = row.baselineValue ?? '';
    const current = row.currentValue ?? '';
    const target = row.targetValue ?? '';
    return {
      metric_fact_id: metricCaptureId(assessmentId, moduleId, row.metricId, String(row.workflowId || '')),
      assessment_id: assessmentId,
      module_id: moduleId,
      module_code: moduleCode,
      domain_id: String(row.domainId || ''),
      workflow_id: String(row.workflowId || ''),
      metric_id: row.metricId,
      metric_name: String(row.metricName || ''),
      baseline_value: String(baseline),
      baseline_date: String(row.baselineDate || ''),
      current_value: String(current),
      target_value: String(target),
      variance_to_target: String(row.varianceToTarget || calculateVarianceToTarget(current, target, row.unit || '')),
      unit: String(row.unit || ''),
      trend_direction: String(row.trendDirection || ''),
      review_frequency: String(row.reviewFrequency || ''),
      owner_role: String(row.ownerRole || ''),
      rag_status: String(row.ragStatus || ''),
      evidence_strength: String(row.evidenceStrength || ''),
      source_system: String(row.sourceSystem || ''),
      notes: String(row.notes || ''),
      baseline_value_numeric: parseNumeric(baseline),
      current_value_numeric: parseNumeric(current),
      target_value_numeric: parseNumeric(target),
      variance_value_numeric: parseNumeric(current) != null && parseNumeric(target) != null ? Number(parseNumeric(current)) - Number(parseNumeric(target)) : null,
      updated_at: now,
    };
  });
  const legacyRows = factRows.map((row) => ({
    metric_capture_id: row.metric_fact_id,
    assessment_id: row.assessment_id,
    module_id: row.module_id,
    domain_id: row.domain_id,
    workflow_id: row.workflow_id,
    metric_id: row.metric_id,
    metric_name: row.metric_name,
    baseline_value: row.baseline_value,
    baseline_date: row.baseline_date,
    current_value: row.current_value,
    target_value: row.target_value,
    variance_to_target: row.variance_to_target,
    unit: row.unit,
    trend_direction: row.trend_direction,
    review_frequency: row.review_frequency,
    owner_role: row.owner_role,
    rag_status: row.rag_status,
    evidence_strength: row.evidence_strength,
    source_system: row.source_system,
    notes: row.notes,
    baseline_value_numeric: row.baseline_value_numeric,
    current_value_numeric: row.current_value_numeric,
    target_value_numeric: row.target_value_numeric,
    variance_value_numeric: row.variance_value_numeric,
    updated_at: row.updated_at,
  }));
  const { error: factError } = await supabase.from('assessment_metric_facts').upsert(factRows, { onConflict: 'assessment_id,module_id,metric_id,workflow_id' });
  if (factError) throw factError;
  const { error: legacyError } = await supabase.from('metric_captures').upsert(legacyRows, { onConflict: 'assessment_id,module_id,metric_id,workflow_id' });
  if (legacyError) throw legacyError;
}

function uniqueMetricDefs(defs: any[]) {
  const seen = new Set<string>();
  const result: any[] = [];
  for (const def of defs) {
    if (!def?.metric_id) continue;
    const key = `${def.metric_id}::${def.workflow_id || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(def);
  }
  return result;
}

async function seedOperationalAuditDirect(assessmentId: string, scenario: any) {
  const bundle: any = await getReferenceBundle('OPS');
  const questions = Array.isArray(bundle.questions) ? bundle.questions : Object.values(bundle.question_map || {});
  await bulkUpsertQuestionFacts(assessmentId, 'OPS', questions.map((question: any, index: number) => ({
    questionId: question.question_id,
    domainId: question.domain_id,
    workflowId: question.workflow_id,
    score: scenarioScore(scenario, 'OPS', index),
    notes: `${scenario.label} seeded response.`,
    evidenceSummary: 'Seeded during bulk full-coverage client generation.',
  })));

  const metricDefs = uniqueMetricDefs(Object.values(bundle.metric_map || {}));
  await bulkUpsertMetricFacts(assessmentId, 'OPS', metricDefs.map((metric: any, index: number) => {
    const values = buildScenarioMetricValues(metric, scenario, index);
    return {
      metricId: metric.metric_id,
      metricName: metric.metric_name,
      domainId: metric.domain_id || '',
      workflowId: metric.workflow_id || '',
      unit: metric.unit || '',
      reviewFrequency: metric.review_frequency || metric.frequency || 'Monthly',
      ownerRole: metric.owner_role || metric.owner || 'Operations Lead',
      evidenceStrength: 'MEASURED',
      sourceSystem: 'Full Coverage Seed',
      ...values,
    };
  }));

  const summary: any = await computeAndPersistAudit(assessmentId);
  return {
    moduleCode: 'OPS',
    questionsTotal: questions.length,
    questionsAnswered: summary.answered,
    metricsTotal: metricDefs.length,
    metricsCaptured: summary.metrics_captured,
    complete: summary.answered === questions.length && summary.metrics_captured === metricDefs.length,
    summary,
  };
}

async function seedGenericQuestionModuleDirect(moduleCode: 'DATA' | 'AIR' | 'AIUC', assessmentId: string, scenario: any) {
  const bundle: any = await getReferenceBundle(moduleCode);
  let questions: any[] = [];
  let metricDefs: any[] = [];

  if (moduleCode === 'AIUC') {
    const factors = bundle.factors || [];
    const domains = bundle.domains || [];
    for (const domain of domains) {
      for (const usecase of bundle.usecases_by_domain?.[domain.domain_id] || []) {
        for (const factor of factors) {
          questions.push({
            question_id: `${usecase.usecase_id}::${factor.factor_id}`,
            domain_id: domain.domain_id,
            workflow_id: usecase.usecase_id,
          });
        }
        if (usecase.metric_def?.metric_id) {
          metricDefs.push({
            ...usecase.metric_def,
            domain_id: domain.domain_id,
            workflow_id: usecase.usecase_id,
          });
        }
      }
    }
  } else {
    questions = Array.isArray(bundle.questions) ? bundle.questions : [];
    metricDefs = (bundle.domains || []).map((domain: any) => ({
      ...(domain.metric_def || {}),
      domain_id: domain.domain_id,
      workflow_id: domain.domain_id,
    })).filter((def: any) => def.metric_id);
  }

  await bulkUpsertQuestionFacts(assessmentId, moduleCode, questions.map((question: any, index: number) => ({
    questionId: question.question_id,
    domainId: question.domain_id,
    workflowId: question.workflow_id,
    score: scenarioScore(scenario, moduleCode, index),
    notes: `${scenario.label} seeded response.`,
    evidenceSummary: 'Seeded during bulk full-coverage client generation.',
  })));

  await bulkUpsertMetricFacts(assessmentId, moduleCode, uniqueMetricDefs(metricDefs).map((metric: any, index: number) => {
    const values = buildScenarioMetricValues(metric, scenario, index);
    return {
      metricId: metric.metric_id,
      metricName: metric.metric_name,
      domainId: metric.domain_id || '',
      workflowId: metric.workflow_id || '',
      unit: metric.unit || '',
      reviewFrequency: metric.review_frequency || metric.frequency || 'Monthly',
      ownerRole: metric.owner_role || metric.owner || 'Functional Lead',
      evidenceStrength: 'MEASURED',
      sourceSystem: 'Full Coverage Seed',
      ...values,
    };
  }));

  const compute = moduleCode === 'DATA'
    ? computeAndPersistDataFoundation
    : moduleCode === 'AIR'
      ? computeAndPersistAiReadiness
      : computeAndPersistAiUsecases;
  const summary: any = await compute(assessmentId);
  const metricsTotal = uniqueMetricDefs(metricDefs).length;
  return {
    moduleCode,
    questionsTotal: questions.length,
    questionsAnswered: summary.answered,
    metricsTotal,
    metricsCaptured: Number(summary.metrics_captured || metricsTotal),
    complete: Boolean(summary.complete),
    summary,
  };
}

async function seedRevenueLeakageDirect(assessmentId: string, scenario: any) {
  const bundle: any = await getLeakageBundle();
  const resolvedProfile = resolveBenchmarkProfileName(scenario.benchmarkProfile);
  let state = createBlankLeakageState({ 'Benchmark Profile': resolvedProfile, 'Client Name': scenario.clientName || scenario.label || 'Seeded Client' });
  state = applyBenchmarkProfile(state, resolvedProfile);

  let supportCount = 0;
  let driverCount = 0;
  for (const [coreIndex, core] of (bundle.model.cores || []).entries()) {
    const coreState = state.cores[core.name];
    if (!numeric(coreState.benchmark)) {
      coreState.benchmark = fallbackLeakBenchmark(core.name, coreIndex);
    }
    coreState.actual = scaledLeakageValue(coreState.benchmark, scenario.metricProfile.leakageActualFactor, fallbackLeakBenchmark(core.name, coreIndex), supportCount + driverCount + 1);

    for (const key of Object.keys(coreState.support || {})) {
      supportCount += 1;
      if (!numeric(coreState.support[key])) {
        coreState.support[key] = fallbackLeakSupportValue(key, supportCount);
      }
      coreState.support[key] = scaledLeakageValue(coreState.support[key], scenario.metricProfile.leakageSupportFactor, fallbackLeakSupportValue(key, supportCount), supportCount);
    }

    for (const driver of core.drivers || []) {
      driverCount += 1;
      const driverState = coreState.drivers[driver.name];
      if (!numeric(driverState.benchmark)) {
        driverState.benchmark = fallbackLeakDriverBenchmark(driver.direction, driverCount);
      }
      driverState.actual = scaledLeakageValue(driverState.benchmark, scenario.metricProfile.leakageDriverFactor, fallbackLeakDriverBenchmark(driver.direction, driverCount), driverCount);
    }
  }

  await saveLeakageState(assessmentId, state);
  const summary: any = await computeAndPersistLeakage(assessmentId);
  return {
    moduleCode: 'LEAK',
    benchmarkProfile: resolvedProfile,
    coresTotal: (bundle.model.cores || []).length,
    supportCount,
    driverCount,
    complete: Boolean(summary.is_complete),
    summary,
  };
}

export async function seedScenarioDirect(scenario: any, options?: { generateOutputs?: boolean }) {
  const client = await upsertClient({
    clientName: scenario.clientName,
    industry: scenario.industry,
    businessModel: scenario.businessModel,
    revenueModel: scenario.revenueModel,
    companySize: scenario.companySize,
    region: scenario.region,
    notes: scenario.notes,
  });

  const assessment = await createAssessment({
    clientId: client.client_id,
    assessmentName: scenario.assessmentName,
    assessmentDate: '2026-03-28',
    scopeType: 'enterprise',
    scopeLabel: 'Full business',
    version: 'runtime-v1',
  });

  const assessmentId = String(assessment.assessment_id);
  const clientId = String(client.client_id);

  const ops = await seedOperationalAuditDirect(assessmentId, scenario);
  const leak = await seedRevenueLeakageDirect(assessmentId, scenario);
  const data = await seedGenericQuestionModuleDirect('DATA', assessmentId, scenario);
  const air = await seedGenericQuestionModuleDirect('AIR', assessmentId, scenario);
  const aiuc = await seedGenericQuestionModuleDirect('AIUC', assessmentId, scenario);
  const roadmap = await computeAndPersistCombinedRoadmap(assessmentId);

  if (options?.generateOutputs) {
    await publishAllModulesForAssessment(assessmentId);
    await buildAssessmentReport(assessmentId);
    for (const moduleCode of ['ops_audit', 'revenue_leakage', 'data_foundation', 'ai_readiness', 'ai_use_cases']) {
      await buildStandaloneModuleReport(assessmentId, moduleCode as ModuleCode);
    }
  }

  return {
    scenario: scenario.key,
    label: scenario.label,
    clientId,
    assessmentId,
    modules: { ops, leak, data, air, aiuc },
    roadmap: { initiativeCount: roadmap.initiative_count, representedModules: roadmap.represented_modules?.length || 0 },
    outputsGenerated: Boolean(options?.generateOutputs),
  };
}
