import { dataPath } from "@/lib/utils/files";
import { loadCsvRows } from "@/lib/utils/csv";

type CsvRow = Record<string, string>;
type EnrichedQuestion = Record<string, unknown> & {
  question_id?: string;
  domain_name: string;
  workflow_name: string;
  step_name: string;
  domain: CsvRow;
  workflow: CsvRow;
  step: CsvRow;
  recommendation: CsvRow;
  action: CsvRow;
  transformations: CsvRow[];
  roadmap: Record<string, unknown>;
  findings_by_band: Record<string, CsvRow>;
  metrics: CsvRow[];
  primary_metric: CsvRow;
};

function sortByDisplayOrder<T extends CsvRow>(rows: T[]) {
  return [...rows].sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0));
}

export function loadAuditBundleLocal() {
  const domains = sortByDisplayOrder(loadCsvRows(dataPath("audit", "audit_domains.csv"), ["domain_id,"]));
  const workflows = sortByDisplayOrder(loadCsvRows(dataPath("audit", "audit_workflows.csv"), ["workflow_id,"]));
  const steps = sortByDisplayOrder(loadCsvRows(dataPath("audit", "audit_steps.csv"), ["step_id,"]));
  const questions = loadCsvRows(dataPath("audit", "audit_questions.csv"), ["question_id,"]);
  const recommendations = loadCsvRows(dataPath("audit", "audit_recommendations.csv"), ["recommendation_id,"]);
  const actions = loadCsvRows(dataPath("audit", "audit_actions.csv"), ["action_id,"]);
  const transformations = loadCsvRows(dataPath("audit", "audit_transformation_register.csv"), ["transformation_id,"]);
  const findings = loadCsvRows(dataPath("audit", "audit_findings.csv"), ["finding_id,"]);
  const roadmap = loadCsvRows(dataPath("audit", "audit_roadmap.csv"), ["roadmap_id,"]);
  const masterMapping = loadCsvRows(dataPath("audit", "audit_master_mapping.csv"), ["domain_id,"]);
  const metrics = loadCsvRows(dataPath("audit", "audit_metrics.csv"), ["metric_id,"]);

  const workflowsByDomain: Record<string, Record<string, string>[]> = {};
  workflows.forEach((row) => {
    (workflowsByDomain[row.domain_id] ||= []).push(row);
  });

  const stepsByWorkflow: Record<string, Record<string, string>[]> = {};
  steps.forEach((row) => {
    (stepsByWorkflow[row.workflow_id] ||= []).push(row);
  });

  const questionsByStep: Record<string, Record<string, string>[]> = {};
  const questionsByDomain: Record<string, Record<string, string>[]> = {};
  const questionsByWorkflow: Record<string, Record<string, string>[]> = {};
  questions.forEach((row) => {
    (questionsByStep[row.step_id] ||= []).push(row);
    (questionsByDomain[row.domain_id] ||= []).push(row);
    (questionsByWorkflow[row.workflow_id] ||= []).push(row);
  });

  const domainMap = Object.fromEntries(domains.map((row) => [row.domain_id, row]));
  const workflowMap = Object.fromEntries(workflows.map((row) => [row.workflow_id, row]));
  const stepMap = Object.fromEntries(steps.map((row) => [row.step_id, row]));
  const recommendationsById = Object.fromEntries(recommendations.map((row) => [row.recommendation_id, row]));
  const actionsById = Object.fromEntries(actions.map((row) => [row.action_id, row]));

  const transformationsByRecommendation: Record<string, Record<string, string>[]> = {};
  const transformationsById = Object.fromEntries(
    transformations.map((row) => {
      (transformationsByRecommendation[row.recommendation_id] ||= []).push(row);
      return [row.transformation_id, row];
    })
  );

  const findingsByQuestionBand: Record<string, Record<string, Record<string, string>>> = {};
  findings.forEach((row) => {
    (findingsByQuestionBand[row.question_id] ||= {})[row.score_band || ""] = row;
  });

  const roadmapByQuestion: Record<string, Record<string, unknown>> = {};
  roadmap.forEach((row) => {
    roadmapByQuestion[row.question_id] = {
      ...row,
      transformation: transformationsById[row.transformation_id || ""] || {}
    };
  });

  const questionMap = Object.fromEntries(questions.map((row) => [row.question_id, row]));

  const metricsByWorkflow: Record<string, Record<string, string>[]> = {};
  const metricsByDomain: Record<string, Record<string, string>[]> = {};
  const metricMap = Object.fromEntries(
    metrics.map((row) => {
      (metricsByWorkflow[row.workflow_id || ""] ||= []).push(row);
      (metricsByDomain[row.domain_id || ""] ||= []).push(row);
      return [row.metric_id, row];
    })
  );

  const primaryMetricByWorkflow: Record<string, Record<string, string>> = {};
  Object.entries(metricsByWorkflow).forEach(([workflowId, rows]) => {
    rows.sort((a, b) => {
      const aRank = (a.metric_role || "").toLowerCase() === "primary" ? 0 : 1;
      const bRank = (b.metric_role || "").toLowerCase() === "primary" ? 0 : 1;
      return aRank - bRank || (a.metric_name || "").localeCompare(b.metric_name || "");
    });
    primaryMetricByWorkflow[workflowId] = rows[0];
  });

  const enrichedQuestions: EnrichedQuestion[] = questions.map((q) => ({
    ...q,
    domain_name: domainMap[q.domain_id]?.domain_name || "",
    workflow_name: workflowMap[q.workflow_id]?.workflow_name || "",
    step_name: stepMap[q.step_id]?.step_name || "",
    domain: domainMap[q.domain_id] || {},
    workflow: workflowMap[q.workflow_id] || {},
    step: stepMap[q.step_id] || {},
    recommendation: recommendationsById[q.recommendation_id || ""] || {},
    action: actionsById[q.action_id || ""] || {},
    transformations: transformationsByRecommendation[q.recommendation_id || ""] || [],
    roadmap: roadmapByQuestion[q.question_id] || {},
    findings_by_band: findingsByQuestionBand[q.question_id] || {},
    metrics: metricsByWorkflow[q.workflow_id || ""] || [],
    primary_metric: primaryMetricByWorkflow[q.workflow_id || ""] || {}
  }));

  return {
    domains: domains.map((domain) => ({ ...domain, metrics: metricsByDomain[domain.domain_id] || [] })),
    workflows: workflows.map((workflow) => ({
      ...workflow,
      metrics: metricsByWorkflow[workflow.workflow_id] || [],
      primary_metric: primaryMetricByWorkflow[workflow.workflow_id] || {}
    })),
    steps,
    questions: enrichedQuestions,
    workflows_by_domain: workflowsByDomain,
    steps_by_workflow: stepsByWorkflow,
    questions_by_step: questionsByStep,
    questions_by_domain: Object.fromEntries(
      Object.entries(questionsByDomain).map(([key, rows]) => [
        key,
        rows.map((row) => enrichedQuestions.find((question) => question.question_id === row.question_id) as EnrichedQuestion)
      ])
    ),
    questions_by_workflow: Object.fromEntries(
      Object.entries(questionsByWorkflow).map(([key, rows]) => [
        key,
        rows.map((row) => enrichedQuestions.find((question) => question.question_id === row.question_id) as EnrichedQuestion)
      ])
    ),
    domain_map: domainMap,
    workflow_map: workflowMap,
    step_map: stepMap,
    question_map: Object.fromEntries(enrichedQuestions.map((row) => [row.question_id, row])),
    recommendations_by_id: recommendationsById,
    actions_by_id: actionsById,
    transformations,
    transformations_by_recommendation: transformationsByRecommendation,
    transformations_by_id: transformationsById,
    findings_by_id: Object.fromEntries(findings.map((row) => [row.finding_id, row])),
    findings,
    findings_by_question_band: findingsByQuestionBand,
    roadmap_rows: roadmap,
    roadmap_by_question: roadmapByQuestion,
    master_mapping: masterMapping,
    metrics,
    metric_map: metricMap,
    metrics_by_workflow: metricsByWorkflow,
    metrics_by_domain: metricsByDomain,
    primary_metric_by_workflow: primaryMetricByWorkflow
  };
}
