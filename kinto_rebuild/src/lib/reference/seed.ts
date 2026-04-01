import type { ReferenceRecordRow } from "@/lib/types/domain";
import { loadLeakageModel, loadBenchmarkLibrary } from "@/lib/reference/local/leakage";
import { loadAuditBundleLocal } from "@/lib/reference/local/audit";
import { loadDataFoundationBundleLocal } from "@/lib/reference/local/data-foundation";
import { loadAiReadinessBundleLocal } from "@/lib/reference/local/ai-readiness";
import { loadAiUsecaseBundleLocal } from "@/lib/reference/local/ai-usecase";

function row(module_code: string, record_type: string, record_key: string, payload: Record<string, unknown>, order_index = 0, parent_key = ""): ReferenceRecordRow {
  return { module_code, record_type, record_key, parent_key, order_index, payload };
}

export function buildReferenceSeedRows(): ReferenceRecordRow[] {
  const rows: ReferenceRecordRow[] = [];

  const leakModel = loadLeakageModel();
  const leakBenchmarks = loadBenchmarkLibrary();
  leakModel.cores.forEach((item, index) => rows.push(row("LEAK", "core", String(item.name), item as unknown as Record<string, unknown>, index)));
  leakBenchmarks.forEach((item, index) => rows.push(row("LEAK", "benchmark", `${item.profile_name || 'profile'}::${index}`, item, index, String(item.profile_name || ""))));

  const ops = loadAuditBundleLocal() as any;
  (ops.domains || []).forEach((item: any, index: number) => rows.push(row("OPS", "domain", item.domain_id, item, index)));
  (ops.workflows || []).forEach((item: any, index: number) => rows.push(row("OPS", "workflow", item.workflow_id, item, index, item.domain_id || "")));
  (ops.steps || []).forEach((item: any, index: number) => rows.push(row("OPS", "step", item.step_id, item, index, item.workflow_id || "")));
  (ops.questions || []).forEach((item: any, index: number) => rows.push(row("OPS", "question", item.question_id, item, index, item.step_id || item.workflow_id || item.domain_id || "")));
  (ops.findings || []).forEach((item: any, index: number) => rows.push(row("OPS", "finding", item.finding_id, item, index, item.question_id || item.domain_id || "")));
  (ops.roadmap_rows || []).forEach((item: any, index: number) => rows.push(row("OPS", "roadmap", item.roadmap_id || `ops-roadmap-${index}`, item, index, item.question_id || item.domain_id || "")));
  (ops.metrics || []).forEach((item: any, index: number) => rows.push(row("OPS", "metric", item.metric_id, item, index, item.workflow_id || item.domain_id || "")));
  (ops.master_mapping || []).forEach((item: any, index: number) => rows.push(row("OPS", "mapping", item.mapping_id || `ops-mapping-${index}`, item, index)));
  Object.values(ops.recommendations_by_id || {}).forEach((item: any, index: number) => rows.push(row("OPS", "recommendation", item.recommendation_id, item, index, item.question_id || item.domain_id || "")));
  Object.values(ops.actions_by_id || {}).forEach((item: any, index: number) => rows.push(row("OPS", "action", item.action_id, item, index, item.question_id || item.domain_id || "")));
  (ops.transformations || []).forEach((item: any, index: number) => rows.push(row("OPS", "transformation", item.transformation_id || `ops-transformation-${index}`, item, index, item.question_id || item.domain_id || "")));

  const data = loadDataFoundationBundleLocal() as any;
  (data.domains || []).forEach((item: any, index: number) => rows.push(row("DATA", "domain", item.domain_id, item, index)));
  (data.questions || []).forEach((item: any, index: number) => rows.push(row("DATA", "question", item.question_id, item, index, item.domain_id || "")));
  (data.findings || []).forEach((item: any, index: number) => rows.push(row("DATA", "finding", item.finding_id, item, index, item.domain_id || "")));
  (data.recommendations || []).forEach((item: any, index: number) => rows.push(row("DATA", "recommendation", item.recommendation_id, item, index, item.domain_id || "")));
  (data.actions || []).forEach((item: any, index: number) => rows.push(row("DATA", "action", item.action_id, item, index, item.recommendation_id || item.domain_id || "")));

  const air = loadAiReadinessBundleLocal() as any;
  (air.domains || []).forEach((item: any, index: number) => rows.push(row("AIR", "domain", item.domain_id, item, index)));
  (air.questions || []).forEach((item: any, index: number) => rows.push(row("AIR", "question", item.question_id, item, index, item.domain_id || "")));
  Object.values(air.findings_by_domain_trigger || {}).forEach((item: any, index: number) => rows.push(row("AIR", "finding", item.finding_id || `air-finding-${index}`, item, index, item.domain_id || "")));
  Object.values(air.recommendations_by_domain_trigger || {}).forEach((item: any, index: number) => rows.push(row("AIR", "recommendation", item.recommendation_id || `air-recommendation-${index}`, item, index, item.domain_id || "")));
  (air.usecases || []).forEach((item: any, index: number) => rows.push(row("AIR", "usecase", item.usecase_id || `air-usecase-${index}`, item, index)));
  Object.values(air.actions_by_recommendation || {}).flat().forEach((item: any, index: number) => rows.push(row("AIR", "action", item.action_id || `air-action-${index}`, item, index, item.recommendation_id || "")));

  const aiuc = loadAiUsecaseBundleLocal() as any;
  (aiuc.domains || []).forEach((item: any, index: number) => rows.push(row("AIUC", "domain", item.domain_id, item, index)));
  (aiuc.usecases || []).forEach((item: any, index: number) => rows.push(row("AIUC", "usecase", item.usecase_id, item, index, item.domain_id || "")));
  (aiuc.factors || []).forEach((item: any, index: number) => rows.push(row("AIUC", "factor", item.factor_id, item, index)));

  return rows;
}
