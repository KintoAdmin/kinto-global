import { getAdminClient } from "@/lib/supabase/admin";
import { moduleIdFromCode, type ModuleCode } from "@/lib/constants/modules";
import { nowIso } from "@/lib/utils/ids";
import type { AuditQuestionResponseInput, MetricCaptureInput } from "@/lib/types/domain";
import {
  listQuestionFacts,
  listMetricFacts,
  listRoadmapFacts,
  listSourceRoadmapFacts,
  patchRoadmapFactProgress,
  replaceRoadmapFacts,
  syncModuleSnapshots,
  upsertMetricFact,
  upsertQuestionFact,
} from "@/lib/repositories/foundation";

type Row = Record<string, unknown>;

function num(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function text(value: unknown, fallback = "") {
  if (value == null) return fallback;
  return String(value);
}
function parseMetricNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const match = String(value).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}


function withMetadata(row: Row, extras: Row = {}) {
  const metadata = typeof row.metadata === "object" && row.metadata ? { ...(row.metadata as Row) } : {};
  return { ...metadata, ...extras };
}

function clean<T extends Row>(row: T): T {
  return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined)) as T;
}

function priorityRank(value: unknown) {
  const raw = String(value ?? "").trim().toUpperCase();
  if (!raw) return 0;
  if (/^\d+$/.test(raw)) return Number(raw);
  if (raw === "CRITICAL") return 1;
  if (raw === "HIGH") return 1;
  if (raw === "MEDIUM") return 2;
  if (raw === "LOW") return 3;
  return 0;
}

function normalizeDomainScoreRow(row: Row): Row {
  return clean({
    domain_score_id: text(row.domain_score_id),
    assessment_id: text(row.assessment_id),
    module_id: text(row.module_id),
    domain_id: text(row.domain_id),
    domain_name: text(row.domain_name),
    raw_score_total: num(row.raw_score_total),
    max_score_total: num(row.max_score_total),
    score_pct: num(row.score_pct),
    maturity_band: text(row.maturity_band),
    questions_answered: num(row.questions_answered),
    questions_total: num(row.questions_total),
    weight_pct: num(row.weight_pct),
    weighted_score_pct: num(row.weighted_score_pct),
    is_complete: Boolean(row.is_complete),
    calculated_at: row.calculated_at || nowIso(),
    metadata: withMetadata(row, { readiness_status: row.readiness_status ?? null }),
  });
}

function normalizeModuleScoreRow(row: Row): Row {
  return clean({
    module_score_id: text(row.module_score_id),
    assessment_id: text(row.assessment_id),
    module_id: text(row.module_id),
    raw_score_total: num(row.raw_score_total),
    max_score_total: num(row.max_score_total),
    score_pct: num(row.score_pct),
    maturity_band: text(row.maturity_band),
    domains_completed: num(row.domains_completed),
    domains_total: num(row.domains_total),
    questions_answered: num(row.questions_answered),
    questions_total: num(row.questions_total),
    is_complete: Boolean(row.is_complete),
    total_leakage: num(row.total_leakage),
    avg_driver_score: num(row.avg_driver_score),
    critical_exposures: num(row.critical_exposures),
    readiness_status: text(row.readiness_status),
    calculated_at: row.calculated_at || nowIso(),
    metadata: withMetadata(row),
  });
}

function normalizeFindingRow(row: Row): Row {
  return clean({
    finding_instance_id: text(row.finding_instance_id),
    assessment_id: text(row.assessment_id),
    module_id: text(row.module_id),
    domain_id: text(row.domain_id),
    workflow_id: text(row.workflow_id),
    question_id: text(row.question_id),
    source_library_id: text(row.source_library_id),
    severity_band: text(row.severity_band),
    finding_title: text(row.finding_title),
    finding_narrative: text(row.finding_narrative),
    business_impact: text(row.business_impact),
    likely_root_cause: text(row.likely_root_cause),
    evidence_required: text(row.evidence_required),
    evidence_strength: text(row.evidence_strength),
    is_priority: Boolean(row.is_priority),
    metadata: withMetadata(row),
    created_at: row.created_at || nowIso(),
    updated_at: row.updated_at || nowIso(),
  });
}

function normalizeRecommendationRow(row: Row): Row {
  return clean({
    recommendation_instance_id: text(row.recommendation_instance_id),
    assessment_id: text(row.assessment_id),
    module_id: text(row.module_id),
    linked_finding_instance_id: text(row.linked_finding_instance_id),
    source_library_id: text(row.source_library_id),
    recommendation_title: text(row.recommendation_title),
    recommendation_text: text(row.recommendation_text),
    expected_outcome: text(row.expected_outcome),
    implementation_notes: text(row.implementation_notes || row.notes),
    priority_rank: priorityRank(row.priority_rank || row.priority_level),
    priority_level: text(row.priority_level),
    owner_role: text(row.owner_role),
    metadata: withMetadata(row),
    created_at: row.created_at || nowIso(),
    updated_at: row.updated_at || nowIso(),
  });
}

function normalizeActionRow(row: Row): Row {
  return clean({
    action_instance_id: text(row.action_instance_id),
    assessment_id: text(row.assessment_id),
    module_id: text(row.module_id),
    linked_recommendation_instance_id: text(row.linked_recommendation_instance_id),
    source_library_id: text(row.source_library_id),
    action_title: text(row.action_title),
    action_text: text(row.action_text),
    owner_role: text(row.owner_role),
    action_deliverable: text(row.action_deliverable || row.expected_outcome || row.action_text),
    success_measure: text(row.success_measure),
    effort_level: text(row.effort_level),
    timeline_band: text(row.timeline_band || row.indicative_timeline),
    indicative_timeline: text(row.indicative_timeline || row.timeline_band),
    priority_level: text(row.priority_level),
    metadata: withMetadata(row),
    created_at: row.created_at || nowIso(),
    updated_at: row.updated_at || nowIso(),
  });
}

function normalizeRoadmapRow(row: Row): Row {
  return clean({
    roadmap_instance_id: text(row.roadmap_instance_id),
    assessment_id: text(row.assessment_id),
    module_id: text(row.module_id),
    linked_action_instance_id: text(row.linked_action_instance_id || row.source_action_instance_id),
    source_library_id: text(row.source_library_id || row.source_finding_instance_id),
    phase_code: text(row.phase_code),
    phase_name: text(row.phase_name),
    initiative_title: text(row.initiative_title),
    initiative_text: text(row.initiative_text || row.initiative_description),
    owner_role: text(row.owner_role),
    priority_rank: priorityRank(row.priority_rank || row.priority_level),
    dependency_code: text(row.dependency_code),
    dependency_summary: text(row.dependency_summary),
    target_outcome: text(row.target_outcome || row.business_outcome),
    success_measure: text(row.success_measure || row.linked_metric_id),
    execution_status: text(row.execution_status || row.status),
    status: text(row.status || "NOT_STARTED"),
    progress_pct: num(row.progress_pct),
    execution_notes: text(row.execution_notes),
    last_reviewed_at: cleanTimestamp(row.last_reviewed_at),
    source_module_id: text(row.source_module_id),
    source_finding_instance_id: text(row.source_finding_instance_id),
    source_action_instance_id: text(row.source_action_instance_id),
    initiative_description: text(row.initiative_description || row.initiative_text),
    linked_metric_id: text(row.linked_metric_id),
    baseline_value: text(row.baseline_value),
    target_value: text(row.target_value),
    review_frequency: text(row.review_frequency),
    business_outcome: text(row.business_outcome),
    priority_effective: priorityRank(row.priority_effective || row.priority_rank || row.priority_level),
    dependency_flags: text(row.dependency_flags),
    source_module_ids: text(row.source_module_ids),
    source_row_ids: text(row.source_row_ids),
    metadata: withMetadata(row),
    created_at: row.created_at || nowIso(),
    updated_at: row.updated_at || nowIso(),
  });
}



function cleanTimestamp(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : value;
  return raw ? raw : null;
}

function escapeInValue(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

const CONFLICT_COLUMNS: Record<string, string> = {
  domain_scores: "assessment_id,module_id,domain_id",
  module_scores: "assessment_id,module_id",
  question_responses: "assessment_id,module_id,question_id",
  metric_captures: "assessment_id,module_id,metric_id,workflow_id"
};

async function syncRows(
  supabase: ReturnType<typeof getAdminClient>,
  table: string,
  idColumn: string,
  assessmentIdValue: string,
  moduleId: string,
  rows: Row[]
) {
  if (!rows.length) {
    const { error } = await supabase.from(table).delete().eq("assessment_id", assessmentIdValue).eq("module_id", moduleId);
    if (error) throw error;
    return;
  }

  const { error: upsertError } = await supabase.from(table).upsert(rows, { onConflict: CONFLICT_COLUMNS[table] || idColumn });
  if (upsertError) throw upsertError;

  const ids = rows.map((row) => text(row[idColumn])).filter(Boolean);
  if (!ids.length) return;
  const inList = `(${ids.map(escapeInValue).join(",")})`;
  const { error: cleanupError } = await supabase
    .from(table)
    .delete()
    .eq("assessment_id", assessmentIdValue)
    .eq("module_id", moduleId)
    .not(idColumn, "in", inList);
  if (cleanupError) throw cleanupError;
}

export async function listQuestionResponses(assessmentIdValue: string, moduleCode: ModuleCode) {
  return listQuestionFacts(assessmentIdValue, moduleCode);
}

export async function upsertQuestionResponse(assessmentIdValue: string, moduleCode: ModuleCode, input: AuditQuestionResponseInput) {
  return upsertQuestionFact(assessmentIdValue, moduleCode, input);
}

export async function listMetricCaptures(assessmentIdValue: string, moduleCode: ModuleCode) {
  return listMetricFacts(assessmentIdValue, moduleCode);
}

export async function upsertMetricCapture(assessmentIdValue: string, moduleCode: ModuleCode, input: MetricCaptureInput) {
  return upsertMetricFact(assessmentIdValue, moduleCode, input);
}

export async function replaceModuleArtifacts(
  assessmentIdValue: string,
  moduleCode: ModuleCode,
  payload: {
    domainScores?: Record<string, unknown>[];
    moduleScore?: Record<string, unknown> | null;
    findings?: Record<string, unknown>[];
    recommendations?: Record<string, unknown>[];
    actions?: Record<string, unknown>[];
    roadmap?: Record<string, unknown>[];
  }
) {
  const supabase = getAdminClient();
  const moduleId = moduleIdFromCode(moduleCode);

  const domainRows = (payload.domainScores || []).map((row) => normalizeDomainScoreRow(row));
  const findingRows = (payload.findings || []).map((row) => normalizeFindingRow(row));
  const recommendationRows = (payload.recommendations || []).map((row) => normalizeRecommendationRow(row));
  const actionRows = (payload.actions || []).map((row) => normalizeActionRow(row));
  const roadmapRows = (payload.roadmap || []).map((row) => normalizeRoadmapRow(row));

  await syncRows(supabase, "domain_scores", "domain_score_id", assessmentIdValue, moduleId, domainRows);

  if (payload.moduleScore) {
    const moduleRow = normalizeModuleScoreRow(payload.moduleScore);
    const { error } = await supabase.from("module_scores").upsert(moduleRow, { onConflict: "assessment_id,module_id" });
    if (error) throw error;
  } else {
    const { error } = await supabase.from("module_scores").delete().eq("assessment_id", assessmentIdValue).eq("module_id", moduleId);
    if (error) throw error;
  }

  await syncRows(supabase, "finding_instances", "finding_instance_id", assessmentIdValue, moduleId, findingRows);
  await syncRows(supabase, "recommendation_instances", "recommendation_instance_id", assessmentIdValue, moduleId, recommendationRows);
  await syncRows(supabase, "action_instances", "action_instance_id", assessmentIdValue, moduleId, actionRows);
  await replaceRoadmapFacts(assessmentIdValue, moduleCode, roadmapRows);
  await syncModuleSnapshots({
    assessmentId: assessmentIdValue,
    moduleCode,
    domainScores: domainRows,
    moduleScore: payload.moduleScore || null,
    findings: findingRows,
    recommendations: recommendationRows,
    actions: actionRows,
    roadmap: roadmapRows,
  });
}

export async function listModuleRoadmap(assessmentIdValue: string, moduleCode: ModuleCode) {
  return listRoadmapFacts(assessmentIdValue, moduleCode);
}

export async function updateRoadmapExecutionState(
  assessmentIdValue: string,
  roadmapInstanceId: string,
  updates: { status?: string; progressPct?: number; executionNotes?: string; lastReviewedAt?: string }
) {
  return patchRoadmapFactProgress(assessmentIdValue, roadmapInstanceId, updates);
}

export async function listSourceRoadmapRows(assessmentIdValue: string, sourceModuleIds: string[]) {
  return listSourceRoadmapFacts(assessmentIdValue, sourceModuleIds);
}

export async function getAllModuleScores(assessmentIdValue: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("module_scores")
    .select("*")
    .eq("assessment_id", assessmentIdValue);
  if (error) throw error;
  return data || [];
}

export async function upsertReportInstance(assessmentIdValue: string, payload: Record<string, unknown>) {
  const supabase = getAdminClient();
  const { data, error } = await supabase.from("report_instances").upsert(payload).select("*").single();
  if (error) throw error;
  return data;
}

export async function listReports(assessmentIdValue: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("report_instances")
    .select("*")
    .eq("assessment_id", assessmentIdValue)
    .order("generated_at", { ascending: false });
  if (error) throw error;
  return data || [];
}


export async function getModuleScore(assessmentIdValue: string, moduleCode: ModuleCode) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("module_scores")
    .select("*")
    .eq("assessment_id", assessmentIdValue)
    .eq("module_id", moduleIdFromCode(moduleCode))
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listFindingInstances(assessmentIdValue: string, moduleCode: ModuleCode) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("finding_instances")
    .select("*")
    .eq("assessment_id", assessmentIdValue)
    .eq("module_id", moduleIdFromCode(moduleCode));
  if (error) throw error;
  return data || [];
}

export async function listRecommendationInstances(assessmentIdValue: string, moduleCode: ModuleCode) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("recommendation_instances")
    .select("*")
    .eq("assessment_id", assessmentIdValue)
    .eq("module_id", moduleIdFromCode(moduleCode));
  if (error) throw error;
  return data || [];
}

export async function listActionInstances(assessmentIdValue: string, moduleCode: ModuleCode) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("action_instances")
    .select("*")
    .eq("assessment_id", assessmentIdValue)
    .eq("module_id", moduleIdFromCode(moduleCode));
  if (error) throw error;
  return data || [];
}

export async function listRoadmapInstances(assessmentIdValue: string, moduleCode: ModuleCode) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("roadmap_instances")
    .select("*")
    .eq("assessment_id", assessmentIdValue)
    .eq("module_id", moduleIdFromCode(moduleCode))
    .order("phase_code", { ascending: true })
    .order("priority_rank", { ascending: true });
  if (error) throw error;
  return data || [];
}
