// @ts-nocheck
import { getAdminClient } from "@/lib/supabase/admin";
import type { ReferenceRecordRow } from "@/lib/types/domain";
import { normalizeModuleCode, type ModuleCode } from "@/lib/constants/modules";
import { loadLeakageModel, loadBenchmarkLibrary } from "@/lib/reference/local/leakage";
import { loadAuditBundleLocal } from "@/lib/reference/local/audit";
import { loadDataFoundationBundleLocal } from "@/lib/reference/local/data-foundation";
import { loadAiReadinessBundleLocal } from "@/lib/reference/local/ai-readiness";
import { loadAiUsecaseBundleLocal } from "@/lib/reference/local/ai-usecase";

// ── In-memory bundle cache ───────────────────────────────────────────────────
// Reference bundles are static data seeded once per deployment.
// Caching in module scope gives us <1ms on all subsequent requests
// within the same server process (Next.js keeps modules alive).
const _bundleCache = new Map<string, unknown>();

async function getCachedBundle(cacheKey: string, builder: () => Promise<unknown>) {
  if (_bundleCache.has(cacheKey)) return _bundleCache.get(cacheKey);
  const result = await builder();
  _bundleCache.set(cacheKey, result);
  return result;
}


type AnyRow = Record<string, unknown>;

async function getReferenceRows(moduleCode: ModuleCode): Promise<ReferenceRecordRow[]> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("reference_records")
    .select("module_code, record_type, record_key, parent_key, order_index, payload")
    .eq("module_code", moduleCode)
    .order("record_type")
    .order("order_index");
  if (error) throw error;
  return (data as ReferenceRecordRow[]) || [];
}

function sortByDisplayOrder<T extends Record<string, unknown>>(rows: T[]) {
  return [...rows].sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0));
}

function buildOpsBundleFromRows(rows: ReferenceRecordRow[]) {
  const groups = rows.reduce<Record<string, ReferenceRecordRow[]>>((acc, row) => {
    (acc[row.record_type] ||= []).push(row);
    return acc;
  }, {});

  const domains = sortByDisplayOrder((groups.domain || []).map((row) => row.payload as AnyRow));
  const workflows = sortByDisplayOrder((groups.workflow || []).map((row) => row.payload as AnyRow));
  const steps = sortByDisplayOrder((groups.step || []).map((row) => row.payload as AnyRow));
  const questions = (groups.question || []).map((row) => row.payload as AnyRow);
  const recommendations = (groups.recommendation || []).map((row) => row.payload as AnyRow);
  const actions = (groups.action || []).map((row) => row.payload as AnyRow);
  const transformations = (groups.transformation || []).map((row) => row.payload as AnyRow);
  const findings = (groups.finding || []).map((row) => row.payload as AnyRow);
  const roadmap = (groups.roadmap || []).map((row) => row.payload as AnyRow);
  const masterMapping = (groups.mapping || []).map((row) => row.payload as AnyRow);
  const metrics = (groups.metric || []).map((row) => row.payload as AnyRow);

  if (!domains.length || !workflows.length || !steps.length || !questions.length) {
    return null;
  }

  const workflowsByDomain: Record<string, AnyRow[]> = {};
  workflows.forEach((row) => {
    const domainId = String(row.domain_id || "");
    (workflowsByDomain[domainId] ||= []).push(row);
  });

  const stepsByWorkflow: Record<string, AnyRow[]> = {};
  steps.forEach((row) => {
    const workflowId = String(row.workflow_id || "");
    (stepsByWorkflow[workflowId] ||= []).push(row);
  });

  const questionsByStep: Record<string, AnyRow[]> = {};
  const questionsByDomain: Record<string, AnyRow[]> = {};
  const questionsByWorkflow: Record<string, AnyRow[]> = {};
  questions.forEach((row) => {
    const stepId = String(row.step_id || "");
    const domainId = String(row.domain_id || "");
    const workflowId = String(row.workflow_id || "");
    (questionsByStep[stepId] ||= []).push(row);
    (questionsByDomain[domainId] ||= []).push(row);
    (questionsByWorkflow[workflowId] ||= []).push(row);
  });

  const domainMap = Object.fromEntries(domains.map((row) => [String(row.domain_id || ""), row]));
  const workflowMap = Object.fromEntries(workflows.map((row) => [String(row.workflow_id || ""), row]));
  const stepMap = Object.fromEntries(steps.map((row) => [String(row.step_id || ""), row]));
  const recommendationsById = Object.fromEntries(recommendations.map((row) => [String(row.recommendation_id || ""), row]));
  const actionsById = Object.fromEntries(actions.map((row) => [String(row.action_id || ""), row]));

  const transformationsByRecommendation: Record<string, AnyRow[]> = {};
  const transformationsById = Object.fromEntries(
    transformations.map((row) => {
      const recommendationId = String(row.recommendation_id || "");
      (transformationsByRecommendation[recommendationId] ||= []).push(row);
      return [String(row.transformation_id || ""), row];
    }),
  );

  const findingsByQuestionBand: Record<string, Record<string, AnyRow>> = {};
  findings.forEach((row) => {
    const questionId = String(row.question_id || "");
    const band = String(row.score_band || "");
    (findingsByQuestionBand[questionId] ||= {})[band] = row;
  });

  const roadmapByQuestion: Record<string, AnyRow> = {};
  roadmap.forEach((row) => {
    const questionId = String(row.question_id || "");
    roadmapByQuestion[questionId] = {
      ...row,
      transformation: transformationsById[String(row.transformation_id || "")] || {},
    };
  });

  const metricsByWorkflow: Record<string, AnyRow[]> = {};
  const metricsByDomain: Record<string, AnyRow[]> = {};
  const metricMap = Object.fromEntries(
    metrics.map((row) => {
      const workflowId = String(row.workflow_id || "");
      const domainId = String(row.domain_id || "");
      const metricId = String(row.metric_id || "");
      (metricsByWorkflow[workflowId] ||= []).push(row);
      (metricsByDomain[domainId] ||= []).push(row);
      return [metricId, row];
    }),
  );

  const primaryMetricByWorkflow: Record<string, AnyRow> = {};
  Object.entries(metricsByWorkflow).forEach(([workflowId, metricRows]) => {
    metricRows.sort((a, b) => {
      const aRank = String(a.metric_role || "").toLowerCase() === "primary" ? 0 : 1;
      const bRank = String(b.metric_role || "").toLowerCase() === "primary" ? 0 : 1;
      return aRank - bRank || String(a.metric_name || "").localeCompare(String(b.metric_name || ""));
    });
    primaryMetricByWorkflow[workflowId] = metricRows[0];
  });

  const enrichedQuestions: AnyRow[] = questions.map((q) => {
    const questionId = String(q.question_id || "");
    const domainId = String(q.domain_id || "");
    const workflowId = String(q.workflow_id || "");
    const stepId = String(q.step_id || "");
    const recommendationId = String(q.recommendation_id || "");
    return {
      ...q,
      domain_name: String((domainMap[domainId] as AnyRow | undefined)?.domain_name || ""),
      workflow_name: String((workflowMap[workflowId] as AnyRow | undefined)?.workflow_name || ""),
      step_name: String((stepMap[stepId] as AnyRow | undefined)?.step_name || ""),
      domain: domainMap[domainId] || {},
      workflow: workflowMap[workflowId] || {},
      step: stepMap[stepId] || {},
      recommendation: recommendationsById[recommendationId] || {},
      action: actionsById[String(q.action_id || "")] || {},
      transformations: transformationsByRecommendation[recommendationId] || [],
      roadmap: roadmapByQuestion[questionId] || {},
      findings_by_band: findingsByQuestionBand[questionId] || {},
      metrics: metricsByWorkflow[workflowId] || [],
      primary_metric: primaryMetricByWorkflow[workflowId] || {},
    };
  });

  return {
    domains: domains.map((domain) => ({ ...domain, metrics: metricsByDomain[String(domain.domain_id || "")] || [] })),
    workflows: workflows.map((workflow) => ({
      ...workflow,
      metrics: metricsByWorkflow[String(workflow.workflow_id || "")] || [],
      primary_metric: primaryMetricByWorkflow[String(workflow.workflow_id || "")] || {},
    })),
    steps,
    questions: enrichedQuestions,
    workflows_by_domain: workflowsByDomain,
    steps_by_workflow: stepsByWorkflow,
    questions_by_step: Object.fromEntries(
      Object.entries(questionsByStep).map(([key, questionRows]) => [
        key,
        questionRows.map((row) => enrichedQuestions.find((question) => String(question.question_id || "") === String(row.question_id || "")) || row),
      ]),
    ),
    questions_by_domain: Object.fromEntries(
      Object.entries(questionsByDomain).map(([key, questionRows]) => [
        key,
        questionRows.map((row) => enrichedQuestions.find((question) => String(question.question_id || "") === String(row.question_id || "")) || row),
      ]),
    ),
    questions_by_workflow: Object.fromEntries(
      Object.entries(questionsByWorkflow).map(([key, questionRows]) => [
        key,
        questionRows.map((row) => enrichedQuestions.find((question) => String(question.question_id || "") === String(row.question_id || "")) || row),
      ]),
    ),
    domain_map: domainMap,
    workflow_map: workflowMap,
    step_map: stepMap,
    question_map: Object.fromEntries(enrichedQuestions.map((row) => [String(row.question_id || ""), row])),
    recommendations_by_id: recommendationsById,
    actions_by_id: actionsById,
    transformations,
    transformations_by_recommendation: transformationsByRecommendation,
    transformations_by_id: transformationsById,
    findings_by_id: Object.fromEntries(findings.map((row) => [String(row.finding_id || ""), row])),
    findings,
    findings_by_question_band: findingsByQuestionBand,
    roadmap_rows: roadmap,
    roadmap_by_question: roadmapByQuestion,
    master_mapping: masterMapping,
    metrics,
    metric_map: metricMap,
    metrics_by_workflow: metricsByWorkflow,
    metrics_by_domain: metricsByDomain,
    primary_metric_by_workflow: primaryMetricByWorkflow,
  };
}

function buildFromDbRows(moduleCode: ModuleCode, rows: ReferenceRecordRow[]) {
  if (!rows.length) return null;

  if (moduleCode === "LEAK") {
    const cores = rows
      .filter((row) => row.record_type === "core")
      .sort((a, b) => a.order_index - b.order_index)
      .map((row) => row.payload);
    const benchmarks = rows
      .filter((row) => row.record_type === "benchmark")
      .sort((a, b) => a.order_index - b.order_index)
      .map((row) => row.payload);
    if (!cores.length || !benchmarks.length) return null;
    return { model: { cores }, benchmarks };
  }

  if (moduleCode === "OPS") {
    return buildOpsBundleFromRows(rows);
  }

  const groups = rows.reduce<Record<string, ReferenceRecordRow[]>>((acc, row) => {
    (acc[row.record_type] ||= []).push(row);
    return acc;
  }, {});

  if (moduleCode === "DATA") {
    const local = loadDataFoundationBundleLocal();
    const domains = (groups.domain || []).map((row) => row.payload);
    const questions = (groups.question || []).map((row) => row.payload);
    if (!domains.length || !questions.length) return null;
    return {
      ...local,
      domains,
      questions,
      findings: (groups.finding || []).map((row) => row.payload),
      recommendations: (groups.recommendation || []).map((row) => row.payload),
      actions: (groups.action || []).map((row) => row.payload),
    };
  }

  if (moduleCode === "AIR") {
    const local = loadAiReadinessBundleLocal();
    const domains = (groups.domain || []).map((row) => row.payload);
    const questions = (groups.question || []).map((row) => row.payload);
    if (!domains.length || !questions.length) return null;
    return {
      ...local,
      domains,
      questions,
      findings: (groups.finding || []).map((row) => row.payload),
      recommendations: (groups.recommendation || []).map((row) => row.payload),
      actions: (groups.action || []).map((row) => row.payload),
      usecases: (groups.usecase || []).map((row) => row.payload),
    };
  }

  if (moduleCode === "AIUC") {
    const local = loadAiUsecaseBundleLocal();
    const domains = (groups.domain || []).map((row) => row.payload);
    const usecases = (groups.usecase || []).map((row) => row.payload);
    if (!domains.length || !usecases.length) return null;
    return {
      ...local,
      domains,
      usecases,
      factors: (groups.factor || []).map((row) => row.payload),
    };
  }

  return null;
}

export async function getReferenceBundle(input: string) {
  const moduleCode = normalizeModuleCode(input);
  return getCachedBundle(moduleCode, async () => {
    const rows = await getReferenceRows(moduleCode);
    const fromDb = buildFromDbRows(moduleCode, rows);
    if (fromDb) return fromDb;

    switch (moduleCode) {
      case "LEAK":
        return { model: loadLeakageModel(), benchmarks: loadBenchmarkLibrary() };
      case "OPS":
        return loadAuditBundleLocal();
      case "DATA":
        return loadDataFoundationBundleLocal();
      case "AIR":
        return loadAiReadinessBundleLocal();
      case "AIUC":
        return loadAiUsecaseBundleLocal();
      case "ROADMAP":
        return { phases: [] };
    }
  });
}
