// @ts-nocheck
import { bandFromPct, getSupabaseAdmin, phaseTextToCode, ragFromScore, scoreBandFromScore } from './module-admin';
import { getModuleSnapshot } from '@/lib/repositories/foundation';
import { listMetricCaptures, listQuestionResponses, replaceModuleArtifacts, upsertMetricCapture, upsertQuestionResponse } from '@/lib/repositories/runtime';
import { updateAssessmentModuleState } from '@/lib/repositories/assessments';
import { countCapturedMetricRows, deriveModuleCoverage } from '@/lib/services/derived-state';

export type GenericDomain = {
  domain_id: string;
  domain_name: string;
  description?: string;
  metric_id?: string;
  metric_name?: string;
};

export type GenericQuestion = {
  question_id: string;
  domain_id: string;
  domain_name: string;
  workflow_id: string;
  workflow_name: string;
  workflow_description?: string;
  workflow_objective?: string;
  question_text: string;
  guidance?: string;
  evidence_examples?: string;
  customer_impact_if_weak?: string;
  linked_metric?: string;
  owner_role?: string;
  roadmap_phase?: string;
  score_1_guidance?: string;
  score_3_guidance?: string;
  score_5_guidance?: string;
  priority_weight?: string;
  question_order?: number;
};

export type GenericFinding = {
  finding_id: string;
  domain_id: string;
  question_id?: string;
  score_band: string;
  finding_title: string;
  finding_text: string;
  business_impact?: string;
  likely_root_cause?: string;
};

export type GenericRecommendation = {
  recommendation_id: string;
  finding_id?: string;
  domain_id?: string;
  score_band?: string;
  recommendation_summary: string;
  recommendation_detail?: string;
  priority?: string;
  roadmap_phase?: string;
};

export type GenericAction = {
  action_id: string;
  recommendation_id: string;
  action_summary: string;
  owner_role?: string;
  timeline_band?: string;
  roadmap_phase?: string;
  expected_outcome?: string;
};

type QuestionResponseRow = {
  question_id: string;
  domain_id?: string | null;
  workflow_id?: string | null;
  score_1_to_5?: number | null;
};

export type ModuleLibrary = {
  moduleId: string;
  moduleCode: string;
  moduleName: string;
  domains: GenericDomain[];
  questions: GenericQuestion[];
  findings: GenericFinding[];
  recommendations: GenericRecommendation[];
  actions: GenericAction[];
};

function firstActionForRecommendation(actions: GenericAction[], recommendationId?: string | null) {
  return actions.filter((action) => action.recommendation_id === recommendationId);
}

function findFinding(library: ModuleLibrary, question: GenericQuestion, score: number) {
  const band = scoreBandFromScore(score);
  return (
    library.findings.find((finding) => finding.question_id === question.question_id && finding.score_band === band) ||
    library.findings.find((finding) => finding.domain_id === question.domain_id && finding.score_band === band) ||
    null
  );
}

function findRecommendation(library: ModuleLibrary, finding: GenericFinding | null, question: GenericQuestion, score: number) {
  const band = scoreBandFromScore(score);
  return (
    library.recommendations.find((rec) => finding?.finding_id && rec.finding_id === finding.finding_id) ||
    library.recommendations.find((rec) => rec.domain_id === question.domain_id && rec.score_band === band) ||
    null
  );
}

function buildFallbackFinding(library: ModuleLibrary, question: GenericQuestion, score: number): GenericFinding {
  const band = scoreBandFromScore(score);
  return {
    finding_id: `${library.moduleCode}-FALLBACK-${question.question_id}-${band}`,
    domain_id: question.domain_id,
    question_id: question.question_id,
    score_band: band,
    finding_title: `${question.workflow_name} is not yet controlled at the required standard`,
    finding_text: question.customer_impact_if_weak || question.guidance || question.question_text,
    business_impact: question.customer_impact_if_weak || `Weakness in ${question.workflow_name} is reducing control and execution quality.`,
    likely_root_cause: question.score_1_guidance || question.guidance || 'Control design or execution is inconsistent.'
  };
}

function buildFallbackRecommendation(library: ModuleLibrary, question: GenericQuestion, score: number): GenericRecommendation {
  const band = scoreBandFromScore(score);
  return {
    recommendation_id: `${library.moduleCode}-REC-${question.question_id}-${band}`,
    domain_id: question.domain_id,
    score_band: band,
    recommendation_summary: `Strengthen ${question.workflow_name.toLowerCase()} so the control becomes repeatable and decision-useful.`,
    recommendation_detail: question.guidance || question.customer_impact_if_weak || question.question_text,
    priority: score <= 2 ? 'HIGH' : 'MEDIUM',
    roadmap_phase: question.roadmap_phase || (score <= 2 ? 'Phase 1' : 'Phase 2')
  };
}

function buildFallbackAction(library: ModuleLibrary, recommendationId: string, question: GenericQuestion, score: number): GenericAction {
  return {
    action_id: `${library.moduleCode}-ACT-${question.question_id}-${score}`,
    recommendation_id: recommendationId,
    action_summary: question.guidance || `Define ownership, standards, and review cadence for ${question.workflow_name.toLowerCase()}.`,
    owner_role: question.owner_role || 'Module Owner',
    timeline_band: score <= 2 ? '0-30 days' : '30-60 days',
    roadmap_phase: question.roadmap_phase || (score <= 2 ? 'Phase 1' : 'Phase 2'),
    expected_outcome: question.customer_impact_if_weak || `Improve control, visibility, and consistency in ${question.workflow_name.toLowerCase()}.`
  };
}


function hasMetricSignal(value: unknown) {
  if (value == null) return false;
  if (typeof value === "number") return Number.isFinite(value) && value !== 0;
  const raw = String(value).trim();
  return raw !== "" && raw !== "0" && raw !== "0.0";
}

function preserveMetricValue(existing: Record<string, unknown> | undefined, key: string, fallback: unknown) {
  const current = existing?.[key];
  return hasMetricSignal(current) ? current : fallback;
}

export async function getQuestionModulePayload(library: ModuleLibrary, assessmentIdOverride?: string) {
  const safeQuestions = Array.isArray(library.questions) ? library.questions : [];
  const safeDomains = Array.isArray(library.domains) ? library.domains : [];

  if (!assessmentIdOverride) {
    return {
      assessmentId: null,
      questions: safeQuestions,
      responses: [],
      moduleScore: null,
      domainScores: safeDomains.map((domain) => ({
        domain_id: domain.domain_id,
        score_pct: 0,
        maturity_band: 'INCOMPLETE',
        questions_answered: 0,
        questions_total: safeQuestions.filter((question) => question.domain_id === domain.domain_id).length,
        is_complete: false,
      })),
      findingsPreview: [],
      mode: 'preview',
    };
  }

  const assessmentId = assessmentIdOverride;
  const [responses, metricCaptures, moduleSnapshot] = await Promise.all([
    listQuestionResponses(assessmentId, library.moduleCode as any),
    listMetricCaptures(assessmentId, library.moduleCode as any),
    getModuleSnapshot(assessmentId, library.moduleCode as any),
  ]);

  const domainScores = Array.isArray(moduleSnapshot?.domain_scores_payload)
    ? moduleSnapshot.domain_scores_payload
    : safeDomains.map((domain) => ({
        domain_id: domain.domain_id,
        score_pct: 0,
        maturity_band: 'INCOMPLETE',
        questions_answered: 0,
        questions_total: safeQuestions.filter((question) => question.domain_id === domain.domain_id).length,
        is_complete: false,
      }));

  return {
    assessmentId,
    questions: safeQuestions,
    responses: responses ?? [],
    moduleScore: moduleSnapshot
      ? {
          score_pct: moduleSnapshot.score_pct ?? 0,
          maturity_band: moduleSnapshot.maturity_band ?? null,
          is_complete: String(moduleSnapshot.module_status || '').toUpperCase() === 'COMPLETE',
        }
      : null,
    domainScores,
    findingsPreview: Array.isArray(moduleSnapshot?.findings_payload) ? moduleSnapshot.findings_payload : [],
    recommendations: Array.isArray(moduleSnapshot?.recommendations_payload) ? moduleSnapshot.recommendations_payload : [],
    actions: Array.isArray(moduleSnapshot?.actions_payload) ? moduleSnapshot.actions_payload : [],
    roadmapItems: Array.isArray(moduleSnapshot?.roadmap_payload) ? moduleSnapshot.roadmap_payload : [],
    metricCaptures: metricCaptures ?? [],
    executiveNarrative: Array.isArray(moduleSnapshot?.summary_payload?.executive_narrative)
      ? moduleSnapshot.summary_payload.executive_narrative
      : [],
  };
}

export async function saveQuestionModuleScore(library: ModuleLibrary, questionId: string, score: number, assessmentIdOverride?: string) {
  if (!assessmentIdOverride) throw new Error('No assessment selected. Create or choose an assessment first.');
  const assessmentId = assessmentIdOverride;
  const question = library.questions.find((item) => item.question_id === questionId);
  if (!question) throw new Error('Question not found.');

  await upsertQuestionResponse(assessmentId, library.moduleCode as any, {
    questionId: question.question_id,
    domainId: question.domain_id,
    workflowId: question.workflow_id,
    score,
    notes: '',
    evidenceSummary: '',
    assessorConfidence: score > 0 ? 'WORKING' : '',
  });

  await rebuildQuestionModuleRuntime(library, assessmentId);

  return getQuestionModulePayload(library, assessmentId);
}

/**
 * Fast-write: saves the score row immediately, schedules background recompute.
 * Returns the current payload from snapshot (stale by design — will refresh after recompute).
 * This keeps the HTTP response under 500ms regardless of module size.
 */
export async function fastWriteQuestionScore(
  library: ModuleLibrary,
  questionId: string,
  score: number,
  assessmentIdOverride?: string
) {
  if (!assessmentIdOverride) throw new Error('No assessment selected. Create or choose an assessment first.');
  const assessmentId = assessmentIdOverride;
  const question = library.questions.find((item) => item.question_id === questionId);
  if (!question) throw new Error('Question not found.');

  // Write immediately — no compute
  await upsertQuestionResponse(assessmentId, library.moduleCode as any, {
    questionId: question.question_id,
    domainId: question.domain_id,
    workflowId: question.workflow_id,
    score,
    notes: '',
    evidenceSummary: '',
    assessorConfidence: score > 0 ? 'WORKING' : '',
  });

  // Return optimistic state: current responses + cached snapshot scores
  // The background recompute (scheduled by the route) will update domain_scores/findings
  const [responses, metricCaptures, moduleSnapshot] = await Promise.all([
    listQuestionResponses(assessmentId, library.moduleCode as any),
    listMetricCaptures(assessmentId, library.moduleCode as any),
    getModuleSnapshot(assessmentId, library.moduleCode as any),
  ]);

  const safeDomains = Array.isArray(library.domains) ? library.domains : [];
  const domainScores = Array.isArray(moduleSnapshot?.domain_scores_payload)
    ? moduleSnapshot.domain_scores_payload
    : safeDomains.map((domain) => ({
        domain_id: domain.domain_id,
        score_pct: 0,
        maturity_band: 'INCOMPLETE',
        questions_answered: 0,
        questions_total: library.questions.filter((q) => q.domain_id === domain.domain_id).length,
        is_complete: false,
      }));

  return {
    assessmentId,
    questions: library.questions,
    responses: responses ?? [],
    moduleScore: moduleSnapshot
      ? {
          score_pct: moduleSnapshot.score_pct ?? 0,
          maturity_band: moduleSnapshot.maturity_band ?? null,
          is_complete: String(moduleSnapshot.module_status || '').toUpperCase() === 'COMPLETE',
        }
      : null,
    domainScores,
    findingsPreview: Array.isArray(moduleSnapshot?.findings_payload) ? moduleSnapshot.findings_payload : [],
    recommendations: Array.isArray(moduleSnapshot?.recommendations_payload) ? moduleSnapshot.recommendations_payload : [],
    actions: Array.isArray(moduleSnapshot?.actions_payload) ? moduleSnapshot.actions_payload : [],
    roadmapItems: Array.isArray(moduleSnapshot?.roadmap_payload) ? moduleSnapshot.roadmap_payload : [],
    executiveNarrative: Array.isArray(moduleSnapshot?.summary_payload?.executive_narrative)
      ? moduleSnapshot.summary_payload.executive_narrative
      : [],
    metricCaptures: metricCaptures ?? [],
  };
}

export async function rebuildQuestionModuleRuntime(library: ModuleLibrary, assessmentId: string) {
  const supabase = getSupabaseAdmin();

  const responses = await listQuestionResponses(assessmentId, library.moduleCode as any);
  const safeResponses: QuestionResponseRow[] = (responses ?? []) as QuestionResponseRow[];
  const responseByQuestion = new Map<string, QuestionResponseRow>(safeResponses.map((row) => [row.question_id, row]));

  const domainRows = library.domains.map((domain) => {
    const questions = library.questions.filter((question) => question.domain_id === domain.domain_id);
    const answered = questions.filter((question) => Number(responseByQuestion.get(question.question_id)?.score_1_to_5 ?? 0) > 0);
    const raw = answered.reduce((sum, question) => sum + Number(responseByQuestion.get(question.question_id)?.score_1_to_5 ?? 0), 0);
    const max = questions.length * 5;
    // Use answered-only mean for score (consistent with OPS methodology):
    // score reflects quality of what has been assessed, not penalised by unanswered questions.
    // completion_pct (answered/total) is tracked separately to show assessment progress.
    const answeredMean = answered.length > 0 ? raw / answered.length : 0;
    const pct = answered.length > 0 ? Number(((answeredMean / 5) * 100).toFixed(2)) : 0;
    const completionPct = questions.length > 0 ? Number(((answered.length / questions.length) * 100).toFixed(2)) : 0;
    const isComplete = answered.length === questions.length;

    return {
      domain_score_id: `${assessmentId}-${library.moduleId}-${domain.domain_id}`,
      assessment_id: assessmentId,
      module_id: library.moduleId,
      domain_id: domain.domain_id,
      domain_name: domain.domain_name,
      raw_score_total: raw,
      max_score_total: answered.length * 5,  // max based on answered questions
      score_pct: pct,
      completion_pct: completionPct,
      maturity_band: bandFromPct(pct, answered.length > 0),  // show band as soon as any questions scored
      questions_answered: answered.length,
      questions_total: questions.length,
      is_complete: isComplete,
      calculated_at: new Date().toISOString()
    };
  });

  const answeredCount = safeResponses.filter((row) => Number(row.score_1_to_5 ?? 0) > 0).length;
  const totalQuestions = library.questions.length;
  const totalRaw = safeResponses.reduce((sum, row) => sum + (Number(row.score_1_to_5 ?? 0) > 0 ? Number(row.score_1_to_5 ?? 0) : 0), 0);
  const totalMax = totalQuestions * 5;
  // Use answered-only mean for module score (consistent with OPS)
  const totalAnsweredForScore = safeResponses.filter(row => Number(row.score_1_to_5 ?? 0) > 0).length;
  const answeredMeanModule = totalAnsweredForScore > 0 ? totalRaw / totalAnsweredForScore : 0;
  const modulePct = totalAnsweredForScore > 0 ? Number(((answeredMeanModule / 5) * 100).toFixed(2)) : 0;
  const moduleCompletionPct = totalQuestions > 0 ? Number(((answeredCount / totalQuestions) * 100).toFixed(2)) : 0;

  const existingMetricRows = await listMetricCaptures(assessmentId, library.moduleCode as any);
  const existingMetricMap = new Map(((existingMetricRows || []) as Array<Record<string, unknown>>).map((row) => [`${String(row.metric_id || '')}::${String(row.workflow_id || '')}`, row]));

  const successToInsert = await Promise.all(library.domains.map(async (domain) => {
    const domainInfo = library.domains.find((item) => item.domain_id === domain.domain_id);
    const domainScore = domainRows.find((row) => row.domain_id === domain.domain_id);
    const metricId = domainInfo?.metric_id || `${library.moduleCode}-MET-${domain.domain_id}`;
    const metricName = domainInfo?.metric_name || `${domainInfo?.domain_name || domain.domain_id} score`;
    const metricCurrent = Number(domainScore?.score_pct ?? 0);
    const metricKey = `${metricId}::${domain.domain_id}`;
    const existingMetric = existingMetricMap.get(metricKey);
    const baselineValue = preserveMetricValue(existingMetric, 'baseline_value', metricCurrent);
    const currentValue = preserveMetricValue(existingMetric, 'current_value', metricCurrent);
    const targetValue = preserveMetricValue(existingMetric, 'target_value', 80);
    const capture = await upsertMetricCapture(assessmentId, library.moduleCode as any, {
      metricId,
      metricName,
      domainId: domain.domain_id,
      workflowId: domain.domain_id,
      baselineValue: String(baselineValue),
      baselineDate: String(existingMetric?.baseline_date || new Date().toISOString().slice(0, 10)),
      currentValue: String(currentValue),
      targetValue: String(targetValue),
      unit: String(existingMetric?.unit || '%'),
      trendDirection: String(existingMetric?.trend_direction || 'FLAT'),
      reviewFrequency: String(existingMetric?.review_frequency || 'Monthly'),
      ownerRole: String(existingMetric?.owner_role || 'Module Owner'),
      ragStatus: String(existingMetric?.rag_status || ragFromScore(metricCurrent)),
      evidenceStrength: String(existingMetric?.evidence_strength || 'MEASURED'),
      sourceSystem: String(existingMetric?.source_system || 'Kinto Frontend Runtime'),
      notes: String(existingMetric?.notes || `${domainInfo?.domain_name || domain.domain_id} maturity score synchronized from module responses.`),
      varianceToTarget: Number((Number(currentValue || 0) - Number(targetValue || 0)).toFixed(2)).toString(),
    });

    return {
      success_measure_id: `${assessmentId}-${library.moduleId}-${metricId}`,
      assessment_id: assessmentId,
      module_id: library.moduleId,
      linked_metric_id: metricId,
      metric_family: metricName,
      linked_workflows: domain.domain_id,
      baseline_value: capture?.baseline_value ?? baselineValue,
      target_value: capture?.target_value ?? targetValue,
      current_value: capture?.current_value ?? currentValue,
      owner_role: capture?.owner_role ?? String(existingMetric?.owner_role || 'Module Owner'),
      review_frequency: capture?.review_frequency ?? String(existingMetric?.review_frequency || 'Monthly'),
      roadmap_phase: Number(currentValue || 0) < 60 ? 'P1' : Number(currentValue || 0) < 80 ? 'P2' : 'P3',
      rag_rule: capture?.rag_status ?? String(existingMetric?.rag_status || ragFromScore(metricCurrent)),
      why_it_matters: `Tracks progress in ${domainInfo?.domain_name || domain.domain_id}.`
    };
  }));

  const metricsTotal = successToInsert.length;
  const metricsCaptured = countCapturedMetricRows(successToInsert as any);
  const coverage = deriveModuleCoverage({
    questionsAnswered: answeredCount,
    questionsTotal: totalQuestions,
    metricsCaptured,
    metricsTotal,
  });
  const moduleComplete = coverage.complete;
  const completionPct = coverage.completionPct;

  const { error: successDeleteError } = await supabase
    .from('success_measure_tracker')
    .delete()
    .eq('assessment_id', assessmentId)
    .eq('module_id', library.moduleId);
  if (successDeleteError) throw successDeleteError;
  if (successToInsert.length) {
    const { error } = await supabase
      .from('success_measure_tracker')
      .upsert(successToInsert, { onConflict: 'assessment_id,module_id,linked_metric_id,metric_family' });
    if (error) throw error;
  }

  const findingsToInsert: Array<Record<string, unknown>> = [];
  const recommendationsToInsert: Array<Record<string, unknown>> = [];
  const actionsToInsert: Array<Record<string, unknown>> = [];
  const roadmapToInsert: Array<Record<string, unknown>> = [];

  for (const question of library.questions) {
    const response = responseByQuestion.get(question.question_id);
    const score = Number(response?.score_1_to_5 ?? 0);
    if (!score || score >= 4) continue;

    const finding = findFinding(library, question, score) || buildFallbackFinding(library, question, score);
    const recommendation = findRecommendation(library, finding, question, score) || buildFallbackRecommendation(library, question, score);
    const actions = firstActionForRecommendation(library.actions, recommendation.recommendation_id);
    const resolvedActions = actions.length ? actions : [buildFallbackAction(library, recommendation.recommendation_id, question, score)];

    const findingId = `${library.moduleCode}-F-${assessmentId}-${question.question_id}`;
    findingsToInsert.push({
      finding_instance_id: findingId,
      assessment_id: assessmentId,
      module_id: library.moduleId,
      domain_id: question.domain_id,
      workflow_id: question.workflow_id,
      question_id: question.question_id,
      source_library_id: finding.finding_id,
      severity_band: score <= 2 ? 'CRITICAL' : 'DEVELOPING',
      finding_title: finding.finding_title,
      finding_narrative: finding.finding_text,
      business_impact: finding.business_impact || question.customer_impact_if_weak || question.guidance,
      likely_root_cause: finding.likely_root_cause || question.score_1_guidance || question.guidance,
      evidence_required: question.evidence_examples || question.guidance,
      evidence_strength: 'OBSERVED_RISK',
      is_priority: String(question.priority_weight || '').toLowerCase() === 'high'
    });

    const recommendationId = `${library.moduleCode}-R-${assessmentId}-${question.question_id}`;
    recommendationsToInsert.push({
      recommendation_instance_id: recommendationId,
      assessment_id: assessmentId,
      module_id: library.moduleId,
      linked_finding_instance_id: findingId,
      source_library_id: recommendation.recommendation_id,
      recommendation_title: recommendation.recommendation_summary,
      recommendation_text: recommendation.recommendation_detail || recommendation.recommendation_summary,
      expected_outcome: recommendation.recommendation_summary,
      priority_level: recommendation.priority || (score <= 2 ? 'HIGH' : 'MEDIUM')
    });

    resolvedActions.forEach((action, index) => {
      const actionId = `${library.moduleCode}-A-${assessmentId}-${question.question_id}-${index + 1}`;
      actionsToInsert.push({
        action_instance_id: actionId,
        assessment_id: assessmentId,
        module_id: library.moduleId,
        linked_recommendation_instance_id: recommendationId,
        source_library_id: action.action_id,
        action_title: action.action_summary,
        action_text: action.action_summary,
        owner_role: action.owner_role || question.owner_role || 'Module Owner',
        indicative_timeline: action.timeline_band || (score <= 2 ? '0-30 days' : '30-60 days'),
        success_measure: question.linked_metric || null,
        priority_level: score <= 2 ? 'HIGH' : 'MEDIUM'
      });

      const phase = phaseTextToCode(action.roadmap_phase || recommendation.roadmap_phase || question.roadmap_phase || (score <= 2 ? 'Phase 1' : 'Phase 2'));
      roadmapToInsert.push({
        roadmap_instance_id: `${library.moduleCode}-RM-${assessmentId}-${question.question_id}-${index + 1}`,
        assessment_id: assessmentId,
        module_id: library.moduleId,
        source_module_id: library.moduleId,
        source_finding_instance_id: findingId,
        source_action_instance_id: actionId,
        phase_code: phase.code,
        phase_name: phase.name,
        initiative_title: action.action_summary,
        initiative_description: recommendation.recommendation_summary,
        owner_role: action.owner_role || question.owner_role || 'Module Owner',
        linked_metric_id: question.linked_metric || null,
        baseline_value: score,
        target_value: 4,
        review_frequency: 'Monthly',
        business_outcome: action.expected_outcome || recommendation.recommendation_summary,
        priority_rank: score <= 2 ? 1 : 2,
        status: score <= 2 ? 'READY' : 'CONDITIONAL'
      });
    });
  }

  const moduleSummary = {
    overall_pct: modulePct,
    overall_maturity: bandFromPct(modulePct, answeredCount > 0),
    answered: answeredCount,
    total: totalQuestions,
    metrics_total: metricsTotal,
    metrics_captured: metricsCaptured,
    question_completion_pct: coverage.questionCompletionPct,
    metric_completion_pct: coverage.metricCompletionPct,
    completion_pct: coverage.completionPct,
    complete: coverage.complete,
    domain_count: domainRows.length,
    findings_count: findingsToInsert.length,
    roadmap_items: roadmapToInsert.length,
    tracked_measures: successToInsert.length,
    executive_narrative: [
      `${library.moduleName} score is ${modulePct.toFixed(1)}%.`,
      `${answeredCount} of ${totalQuestions} questions have been answered.`
    ]
  };

  await replaceModuleArtifacts(assessmentId, library.moduleCode as any, {
    domainScores: domainRows,
    moduleScore: {
      module_score_id: `${assessmentId}-${library.moduleId}`,
      assessment_id: assessmentId,
      module_id: library.moduleId,
      raw_score_total: totalRaw,
      max_score_total: totalMax,
      score_pct: modulePct,
      maturity_band: bandFromPct(modulePct, answeredCount > 0),
      domains_completed: domainRows.filter((row) => row.is_complete).length,
      domains_total: domainRows.length,
      questions_answered: answeredCount,
      questions_total: totalQuestions,
      metrics_total: metricsTotal,
      metrics_captured: metricsCaptured,
      is_complete: moduleComplete,
      readiness_status: bandFromPct(modulePct, answeredCount > 0),
      calculated_at: new Date().toISOString(),
    },
    findings: findingsToInsert,
    recommendations: recommendationsToInsert,
    actions: actionsToInsert,
    roadmap: roadmapToInsert,
  });

  await updateAssessmentModuleState(
    assessmentId,
    library.moduleCode as any,
    {},
    {
      moduleStatus: answeredCount === 0 ? 'NOT_STARTED' : moduleComplete ? 'COMPLETE' : 'IN_PROGRESS',
      completionPct,
      summaryPayload: moduleSummary,
    }
  );

  return { answeredCount, totalQuestions, modulePct };
}
