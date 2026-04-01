import { MODULE_REGISTRY, moduleIdFromCode, type ModuleCode } from "@/lib/constants/modules";
import { getAssessmentModule } from "@/lib/repositories/assessments";
import { getAdminClient } from "@/lib/supabase/admin";
import { nowIso, metricCaptureId, responseId } from "@/lib/utils/ids";
import type { AuditQuestionResponseInput, MetricCaptureInput } from "@/lib/types/domain";

type Row = Record<string, unknown>;

type SyncSnapshotInput = {
  assessmentId: string;
  moduleCode: ModuleCode;
  domainScores?: Row[];
  moduleScore?: Row | null;
  findings?: Row[];
  recommendations?: Row[];
  actions?: Row[];
  roadmap?: Row[];
};

function text(value: unknown, fallback = "") {
  if (value == null) return fallback;
  return String(value);
}

function num(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function clean<T extends Row>(row: T): T {
  return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined)) as T;
}

function parseMetricNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const match = String(value).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function escapeInValue(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

async function syncRows(
  table: string,
  idColumn: string,
  assessmentId: string,
  moduleId: string,
  rows: Row[],
  onConflict?: string,
) {
  const supabase = getAdminClient();
  if (!rows.length) {
    const { error } = await supabase.from(table).delete().eq("assessment_id", assessmentId).eq("module_id", moduleId);
    if (error) throw error;
    return;
  }

  const { error: upsertError } = await supabase.from(table).upsert(rows, { onConflict: onConflict || idColumn });
  if (upsertError) throw upsertError;

  const ids = rows.map((row) => text(row[idColumn])).filter(Boolean);
  if (!ids.length) return;
  const inList = `(${ids.map(escapeInValue).join(",")})`;
  const { error: cleanupError } = await supabase
    .from(table)
    .delete()
    .eq("assessment_id", assessmentId)
    .eq("module_id", moduleId)
    .not(idColumn, "in", inList);
  if (cleanupError) throw cleanupError;
}

export async function listQuestionFacts(assessmentId: string, moduleCode: ModuleCode) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("assessment_question_facts")
    .select("*")
    .eq("assessment_id", assessmentId)
    .eq("module_id", moduleIdFromCode(moduleCode));
  if (error) throw error;
  return data || [];
}

export async function upsertQuestionFact(assessmentId: string, moduleCode: ModuleCode, input: AuditQuestionResponseInput) {
  const supabase = getAdminClient();
  const moduleId = moduleIdFromCode(moduleCode);
  const score = Number(input.score || 0);
  const payload = {
    question_fact_id: responseId(assessmentId, moduleId, input.questionId),
    assessment_id: assessmentId,
    module_id: moduleId,
    module_code: moduleCode,
    domain_id: input.domainId || "",
    workflow_id: input.workflowId || "",
    question_id: input.questionId,
    score_1_to_5: score,
    score,
    notes: input.notes || "",
    evidence_summary: input.evidenceSummary || "",
    assessor_confidence: input.assessorConfidence || "",
    is_complete: score > 0,
    scored_at: score > 0 ? nowIso() : null,
    updated_at: nowIso(),
  };

  const { data, error } = await supabase
    .from("assessment_question_facts")
    .upsert(payload, { onConflict: "assessment_id,module_id,question_id" })
    .select("*")
    .single();
  if (error) throw error;

  const legacyPayload = {
    response_id: payload.question_fact_id,
    assessment_id: assessmentId,
    module_id: moduleId,
    domain_id: payload.domain_id,
    workflow_id: payload.workflow_id,
    question_id: payload.question_id,
    score_1_to_5: payload.score_1_to_5,
    score: payload.score,
    notes: payload.notes,
    evidence_summary: payload.evidence_summary,
    assessor_confidence: payload.assessor_confidence,
    is_complete: payload.is_complete,
    scored_at: payload.scored_at,
    updated_at: payload.updated_at,
  };
  const { error: legacyError } = await supabase
    .from("question_responses")
    .upsert(legacyPayload, { onConflict: "assessment_id,module_id,question_id" });
  if (legacyError) throw legacyError;

  return data;
}

export async function listMetricFacts(assessmentId: string, moduleCode: ModuleCode) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("assessment_metric_facts")
    .select("*")
    .eq("assessment_id", assessmentId)
    .eq("module_id", moduleIdFromCode(moduleCode));
  if (error) throw error;
  return data || [];
}

export async function upsertMetricFact(assessmentId: string, moduleCode: ModuleCode, input: MetricCaptureInput) {
  const supabase = getAdminClient();
  const moduleId = moduleIdFromCode(moduleCode);
  const workflowId = input.workflowId || "";
  const { data: existingRow, error: existingError } = await supabase
    .from("assessment_metric_facts")
    .select("*")
    .eq("assessment_id", assessmentId)
    .eq("module_id", moduleId)
    .eq("metric_id", input.metricId)
    .eq("workflow_id", workflowId)
    .maybeSingle();
  if (existingError) throw existingError;

  const merged = {
    domainId: input.domainId ?? existingRow?.domain_id ?? "",
    workflowId,
    metricName: input.metricName ?? existingRow?.metric_name ?? "",
    baselineValue: input.baselineValue ?? existingRow?.baseline_value ?? "",
    baselineDate: input.baselineDate ?? existingRow?.baseline_date ?? "",
    currentValue: input.currentValue ?? existingRow?.current_value ?? "",
    targetValue: input.targetValue ?? existingRow?.target_value ?? "",
    unit: input.unit ?? existingRow?.unit ?? "",
    trendDirection: input.trendDirection ?? existingRow?.trend_direction ?? "",
    reviewFrequency: input.reviewFrequency ?? existingRow?.review_frequency ?? "",
    ownerRole: input.ownerRole ?? existingRow?.owner_role ?? "",
    ragStatus: input.ragStatus ?? existingRow?.rag_status ?? "",
    evidenceStrength: input.evidenceStrength ?? existingRow?.evidence_strength ?? "",
    sourceSystem: input.sourceSystem ?? existingRow?.source_system ?? "",
    notes: input.notes ?? existingRow?.notes ?? "",
  };

  const current = parseMetricNumber(merged.currentValue);
  const target = parseMetricNumber(merged.targetValue);
  const baseline = parseMetricNumber(merged.baselineValue);
  const unit = merged.unit;
  let varianceText = input.varianceToTarget ?? existingRow?.variance_to_target ?? "";
  if (!varianceText && current != null && target != null) {
    const gap = current - target;
    varianceText = unit === "%"
      ? `${gap >= 0 ? "+" : ""}${gap.toFixed(1)} pts`
      : `${gap >= 0 ? "+" : ""}${Number.isInteger(gap) ? gap.toFixed(0) : gap.toFixed(2)}${unit ? ` ${unit}` : ""}`;
  }

  const payload = {
    metric_fact_id: metricCaptureId(assessmentId, moduleId, input.metricId, workflowId),
    assessment_id: assessmentId,
    module_id: moduleId,
    module_code: moduleCode,
    domain_id: merged.domainId,
    workflow_id: merged.workflowId,
    metric_id: input.metricId,
    metric_name: merged.metricName,
    baseline_value: merged.baselineValue,
    baseline_date: merged.baselineDate,
    current_value: merged.currentValue,
    target_value: merged.targetValue,
    variance_to_target: varianceText,
    unit,
    trend_direction: merged.trendDirection,
    review_frequency: merged.reviewFrequency,
    owner_role: merged.ownerRole,
    rag_status: merged.ragStatus,
    evidence_strength: merged.evidenceStrength,
    source_system: merged.sourceSystem,
    notes: merged.notes,
    baseline_value_numeric: baseline,
    current_value_numeric: current,
    target_value_numeric: target,
    variance_value_numeric: current != null && target != null ? current - target : null,
    updated_at: nowIso(),
  };

  const { data, error } = await supabase
    .from("assessment_metric_facts")
    .upsert(payload, { onConflict: "assessment_id,module_id,metric_id,workflow_id" })
    .select("*")
    .single();
  if (error) throw error;

  const legacyPayload = {
    metric_capture_id: payload.metric_fact_id,
    assessment_id: assessmentId,
    module_id: moduleId,
    domain_id: payload.domain_id,
    workflow_id: payload.workflow_id,
    metric_id: payload.metric_id,
    metric_name: payload.metric_name,
    baseline_value: payload.baseline_value,
    baseline_date: payload.baseline_date,
    current_value: payload.current_value,
    target_value: payload.target_value,
    variance_to_target: payload.variance_to_target,
    unit: payload.unit,
    trend_direction: payload.trend_direction,
    review_frequency: payload.review_frequency,
    owner_role: payload.owner_role,
    rag_status: payload.rag_status,
    evidence_strength: payload.evidence_strength,
    source_system: payload.source_system,
    notes: payload.notes,
    baseline_value_numeric: payload.baseline_value_numeric,
    current_value_numeric: payload.current_value_numeric,
    target_value_numeric: payload.target_value_numeric,
    variance_value_numeric: payload.variance_value_numeric,
    updated_at: payload.updated_at,
  };
  const { error: legacyError } = await supabase
    .from("metric_captures")
    .upsert(legacyPayload, { onConflict: "assessment_id,module_id,metric_id,workflow_id" });
  if (legacyError) throw legacyError;

  return data;
}

export async function replaceRoadmapFacts(assessmentId: string, moduleCode: ModuleCode, rows: Row[]) {
  const moduleId = moduleIdFromCode(moduleCode);
  const mapped = rows.map((row, index) => clean({
    roadmap_fact_id: text(row.roadmap_instance_id || row.roadmap_fact_id || `${assessmentId}::${moduleId}::ROAD::${String(index + 1).padStart(4, "0")}`),
    assessment_id: assessmentId,
    module_id: moduleId,
    module_code: moduleCode,
    source_module_id: text(row.source_module_id || moduleId),
    source_finding_instance_id: text(row.source_finding_instance_id),
    source_action_instance_id: text(row.source_action_instance_id),
    phase_code: text(row.phase_code),
    phase_name: text(row.phase_name),
    initiative_title: text(row.initiative_title),
    initiative_description: text(row.initiative_description),
    owner_role: text(row.owner_role),
    linked_metric_id: text(row.linked_metric_id),
    baseline_value: text(row.baseline_value),
    target_value: text(row.target_value),
    review_frequency: text(row.review_frequency),
    business_outcome: text(row.business_outcome),
    priority_rank: num(row.priority_rank),
    priority_effective: num(row.priority_effective),
    status: text(row.status || "NOT_STARTED"),
    progress_pct: num(row.progress_pct),
    execution_status: text(row.execution_status),
    execution_notes: text(row.execution_notes),
    last_reviewed_at: row.last_reviewed_at || null,
    dependency_flags: text(row.dependency_flags),
    dependency_summary: text(row.dependency_summary),
    source_module_ids: text(row.source_module_ids),
    source_row_ids: text(row.source_row_ids),
    metadata: typeof row.metadata === "object" && row.metadata ? row.metadata : {},
    created_at: row.created_at || nowIso(),
    updated_at: row.updated_at || nowIso(),
  }));

  await syncRows(
    "assessment_roadmap_facts",
    "roadmap_fact_id",
    assessmentId,
    moduleId,
    mapped,
    "assessment_id,module_id,roadmap_fact_id",
  );

  const legacyRows = mapped.map((row) => ({
    roadmap_instance_id: row.roadmap_fact_id,
    assessment_id: row.assessment_id,
    module_id: row.module_id,
    source_module_id: row.source_module_id,
    source_finding_instance_id: row.source_finding_instance_id,
    source_action_instance_id: row.source_action_instance_id,
    phase_code: row.phase_code,
    phase_name: row.phase_name,
    initiative_title: row.initiative_title,
    initiative_description: row.initiative_description,
    owner_role: row.owner_role,
    linked_metric_id: row.linked_metric_id,
    baseline_value: row.baseline_value,
    target_value: row.target_value,
    review_frequency: row.review_frequency,
    business_outcome: row.business_outcome,
    priority_rank: row.priority_rank,
    priority_effective: row.priority_effective,
    status: row.status,
    progress_pct: row.progress_pct,
    execution_status: row.execution_status,
    execution_notes: row.execution_notes,
    last_reviewed_at: row.last_reviewed_at,
    dependency_flags: row.dependency_flags,
    dependency_summary: row.dependency_summary,
    source_module_ids: row.source_module_ids,
    source_row_ids: row.source_row_ids,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
  await syncRows(
    "roadmap_instances",
    "roadmap_instance_id",
    assessmentId,
    moduleId,
    legacyRows,
    "roadmap_instance_id",
  );

  const progressRows = mapped.map((row) => clean({
    progress_fact_id: `${text(row.roadmap_fact_id)}::progress`,
    assessment_id: assessmentId,
    module_id: moduleId,
    module_code: moduleCode,
    roadmap_fact_id: text(row.roadmap_fact_id),
    source_module_id: text(row.source_module_id || moduleId),
    linked_metric_id: text(row.linked_metric_id),
    metric_family: text(row.initiative_title),
    owner_role: text(row.owner_role),
    baseline_value: text(row.baseline_value),
    current_value: text(row.progress_pct),
    target_value: "100",
    roadmap_phase: text(row.phase_code),
    rag_rule: text(row.execution_status || row.status),
    review_frequency: text(row.review_frequency || "Monthly"),
    status: text(row.status || "NOT_STARTED"),
    progress_pct: num(row.progress_pct),
    execution_notes: text(row.execution_notes),
    last_reviewed_at: row.last_reviewed_at || null,
    metadata: {
      initiative_title: text(row.initiative_title),
      business_outcome: text(row.business_outcome),
      source_module_ids: text(row.source_module_ids),
      source_module_id: text(row.source_module_id || moduleId),
    },
    updated_at: nowIso(),
  }));
  await syncRows(
    "assessment_progress_facts",
    "progress_fact_id",
    assessmentId,
    moduleId,
    progressRows,
    "assessment_id,module_id,roadmap_fact_id",
  );
}

export async function listRoadmapFacts(assessmentId: string, moduleCode: ModuleCode) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("assessment_roadmap_facts")
    .select("*")
    .eq("assessment_id", assessmentId)
    .eq("module_id", moduleIdFromCode(moduleCode))
    .order("phase_code", { ascending: true })
    .order("priority_rank", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function listSourceRoadmapFacts(assessmentId: string, sourceModuleIds: string[]) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("assessment_roadmap_facts")
    .select("*")
    .eq("assessment_id", assessmentId);
  if (error) throw error;
  return (data || []).filter((row: any) => sourceModuleIds.includes(String(row.source_module_id || row.module_id || "")));
}

export async function listProgressFacts(assessmentId: string, moduleCode?: ModuleCode) {
  const supabase = getAdminClient();
  let query = supabase.from("assessment_progress_facts").select("*").eq("assessment_id", assessmentId);
  if (moduleCode) query = query.eq("module_id", moduleIdFromCode(moduleCode));
  const { data, error } = await query.order("module_id", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function patchRoadmapFactProgress(
  assessmentId: string,
  roadmapFactId: string,
  updates: { status?: string; progressPct?: number; executionNotes?: string; lastReviewedAt?: string },
) {
  const supabase = getAdminClient();
  const { data: current, error: currentError } = await supabase
    .from("assessment_roadmap_facts")
    .select("*")
    .eq("assessment_id", assessmentId)
    .eq("roadmap_fact_id", roadmapFactId)
    .maybeSingle();
  if (currentError) throw currentError;
  if (!current) throw new Error(`Roadmap item ${roadmapFactId} was not found.`);

  const roadmapPayload = clean({
    status: typeof updates.status === "string" ? updates.status : current.status,
    progress_pct: typeof updates.progressPct === "number" ? updates.progressPct : current.progress_pct,
    execution_notes: typeof updates.executionNotes === "string" ? updates.executionNotes : current.execution_notes,
    last_reviewed_at: typeof updates.lastReviewedAt !== "undefined" ? updates.lastReviewedAt || null : current.last_reviewed_at,
    updated_at: nowIso(),
  });

  const { data: roadmapRow, error: roadmapError } = await supabase
    .from("assessment_roadmap_facts")
    .update(roadmapPayload)
    .eq("assessment_id", assessmentId)
    .eq("roadmap_fact_id", roadmapFactId)
    .select("*")
    .single();
  if (roadmapError) throw roadmapError;

  const progressPayload = clean({
    progress_fact_id: `${roadmapFactId}::progress`,
    assessment_id: assessmentId,
    module_id: text(current.module_id),
    module_code: text(current.module_code),
    roadmap_fact_id: roadmapFactId,
    source_module_id: text(current.source_module_id || current.module_id),
    linked_metric_id: text(current.linked_metric_id),
    metric_family: text(current.initiative_title),
    owner_role: text(current.owner_role),
    baseline_value: text(current.baseline_value),
    current_value: typeof updates.progressPct === "number" ? String(updates.progressPct) : text(current.progress_pct),
    target_value: "100",
    roadmap_phase: text(current.phase_code),
    rag_rule: text(current.execution_status || roadmapPayload.status || current.status),
    review_frequency: text(current.review_frequency || "Monthly"),
    status: text(roadmapPayload.status || current.status),
    progress_pct: typeof updates.progressPct === "number" ? updates.progressPct : num(current.progress_pct),
    execution_notes: typeof updates.executionNotes === "string" ? updates.executionNotes : text(current.execution_notes),
    last_reviewed_at: typeof updates.lastReviewedAt !== "undefined" ? updates.lastReviewedAt || null : current.last_reviewed_at,
    metadata: {
      initiative_title: text(current.initiative_title),
      business_outcome: text(current.business_outcome),
      source_module_ids: text(current.source_module_ids),
      source_module_id: text(current.source_module_id || current.module_id),
    },
    updated_at: nowIso(),
  });
  const { error: progressError } = await supabase
    .from("assessment_progress_facts")
    .upsert(progressPayload, { onConflict: "assessment_id,module_id,roadmap_fact_id" });
  if (progressError) throw progressError;

  const { error: legacyRoadmapError } = await supabase
    .from("roadmap_instances")
    .update({
      status: roadmapPayload.status,
      progress_pct: roadmapPayload.progress_pct,
      execution_notes: roadmapPayload.execution_notes,
      last_reviewed_at: roadmapPayload.last_reviewed_at,
      updated_at: roadmapPayload.updated_at,
    })
    .eq("assessment_id", assessmentId)
    .eq("roadmap_instance_id", roadmapFactId);
  if (legacyRoadmapError) throw legacyRoadmapError;

  return roadmapRow;
}

export async function syncModuleSnapshots(input: SyncSnapshotInput) {
  const supabase = getAdminClient();
  const moduleId = moduleIdFromCode(input.moduleCode);
  const metricFacts = await listMetricFacts(input.assessmentId, input.moduleCode);
  const roadmapFacts = await listRoadmapFacts(input.assessmentId, input.moduleCode);
  const progressFacts = await listProgressFacts(input.assessmentId, input.moduleCode);
  const moduleState = await getAssessmentModule(input.assessmentId, input.moduleCode);

  const domainRows = (input.domainScores || []).map((row) => clean({
    domain_snapshot_id: `${input.assessmentId}::${moduleId}::${text(row.domain_id)}`,
    assessment_id: input.assessmentId,
    module_id: moduleId,
    module_code: input.moduleCode,
    domain_id: text(row.domain_id),
    domain_name: text(row.domain_name),
    score_pct: num(row.score_pct),
    maturity_band: text(row.maturity_band),
    questions_answered: num(row.questions_answered),
    questions_total: num(row.questions_total),
    is_complete: bool(row.is_complete),
    snapshot_payload: row,
    calculated_at: row.calculated_at || nowIso(),
  }));

  if (domainRows.length) {
    const { error: domainError } = await supabase
      .from("assessment_domain_snapshots")
      .upsert(domainRows, { onConflict: "assessment_id,module_id,domain_id" });
    if (domainError) throw domainError;
  } else {
    const { error: deleteError } = await supabase
      .from("assessment_domain_snapshots")
      .delete()
      .eq("assessment_id", input.assessmentId)
      .eq("module_id", moduleId);
    if (deleteError) throw deleteError;
  }

  const moduleSnapshot = clean({
    module_snapshot_id: `${input.assessmentId}::${moduleId}`,
    assessment_id: input.assessmentId,
    module_id: moduleId,
    module_code: input.moduleCode,
    summary_payload: moduleState?.summary_payload || {},
    domain_scores_payload: input.domainScores || [],
    findings_payload: input.findings || [],
    recommendations_payload: input.recommendations || [],
    actions_payload: input.actions || [],
    roadmap_payload: roadmapFacts,
    metrics_payload: metricFacts,
    progress_payload: progressFacts,
    module_status: text(moduleState?.module_status),
    completion_pct: num(moduleState?.completion_pct),
    score_pct: num(input.moduleScore?.score_pct),
    maturity_band: text(input.moduleScore?.maturity_band),
    calculated_at: nowIso(),
  });

  const { error: moduleError } = await supabase
    .from("assessment_module_snapshots")
    .upsert(moduleSnapshot, { onConflict: "assessment_id,module_id" });
  if (moduleError) throw moduleError;

  await rebuildAssessmentSnapshot(input.assessmentId);
}

export async function refreshModuleSnapshotState(assessmentId: string, moduleCode: ModuleCode) {
  const supabase = getAdminClient();
  const moduleId = moduleIdFromCode(moduleCode);
  const moduleState = await getAssessmentModule(assessmentId, moduleCode);
  const { data: existing, error } = await supabase
    .from("assessment_module_snapshots")
    .select("*")
    .eq("assessment_id", assessmentId)
    .eq("module_id", moduleId)
    .maybeSingle();
  if (error) throw error;

  const payload = clean({
    module_snapshot_id: `${assessmentId}::${moduleId}`,
    assessment_id: assessmentId,
    module_id: moduleId,
    module_code: moduleCode,
    summary_payload: moduleState?.summary_payload || existing?.summary_payload || {},
    domain_scores_payload: existing?.domain_scores_payload || [],
    findings_payload: existing?.findings_payload || [],
    recommendations_payload: existing?.recommendations_payload || [],
    actions_payload: existing?.actions_payload || [],
    roadmap_payload: existing?.roadmap_payload || [],
    metrics_payload: existing?.metrics_payload || [],
    progress_payload: existing?.progress_payload || [],
    module_status: text(moduleState?.module_status),
    completion_pct: num(moduleState?.completion_pct),
    score_pct: num(existing?.score_pct),
    maturity_band: text(existing?.maturity_band),
    calculated_at: nowIso(),
  });

  const { error: upsertError } = await supabase
    .from("assessment_module_snapshots")
    .upsert(payload, { onConflict: "assessment_id,module_id" });
  if (upsertError) throw upsertError;

  await rebuildAssessmentSnapshot(assessmentId);
}

export async function getModuleSnapshot(assessmentId: string, moduleCode: ModuleCode) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("assessment_module_snapshots")
    .select("*")
    .eq("assessment_id", assessmentId)
    .eq("module_id", moduleIdFromCode(moduleCode))
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listDomainSnapshots(assessmentId: string, moduleCode: ModuleCode) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("assessment_domain_snapshots")
    .select("*")
    .eq("assessment_id", assessmentId)
    .eq("module_id", moduleIdFromCode(moduleCode))
    .order("domain_id", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function rebuildAssessmentSnapshot(assessmentId: string) {
  const supabase = getAdminClient();
  const [{ data: modules, error: modulesError }, { data: runtimeModules, error: runtimeError }] = await Promise.all([
    supabase.from("assessment_module_snapshots").select("*").eq("assessment_id", assessmentId),
    supabase.from("assessment_modules").select("module_id, module_status, completion_pct").eq("assessment_id", assessmentId),
  ]);
  if (modulesError) throw modulesError;
  if (runtimeError) throw runtimeError;

  const safeModules = (modules || []) as any[];
  const snapshotByModuleId = new Map(safeModules.map((row: any) => [row.module_id, row]));
  const runtimeByModuleId = new Map((runtimeModules || []).map((row: any) => [row.module_id, row]));

  const moduleCards = MODULE_REGISTRY.map((module) => {
    const snapshot = snapshotByModuleId.get(module.module_id) as any;
    const runtime = runtimeByModuleId.get(module.module_id) as any;
    return {
      module_id: module.module_id,
      module_code: module.module_code,
      module_name: module.module_name,
      display_order: module.display_order,
      module_status: runtime?.module_status || snapshot?.module_status || "NOT_STARTED",
      completion_pct: num(runtime?.completion_pct ?? snapshot?.completion_pct),
      score_pct: num(snapshot?.score_pct),
      maturity_band: text(snapshot?.maturity_band),
      summary_payload: snapshot?.summary_payload || {},
    };
  });

  const roadmapModuleId = moduleIdFromCode("ROADMAP");
  const roadmapSnapshot = snapshotByModuleId.get(roadmapModuleId) as any;
  const sourceRoadmapRows = safeModules
    .filter((row) => row.module_id != roadmapModuleId)
    .flatMap((row) => Array.isArray(row.roadmap_payload) ? row.roadmap_payload : []);
  const combinedRoadmap = Array.isArray(roadmapSnapshot?.roadmap_payload) && roadmapSnapshot.roadmap_payload.length
    ? roadmapSnapshot.roadmap_payload
    : sourceRoadmapRows.sort((a: any, b: any) =>
        num(a.priority_rank || a.priority_effective, 999) - num(b.priority_rank || b.priority_effective, 999) ||
        text(a.phase_code || a.phase_name).localeCompare(text(b.phase_code || b.phase_name)) ||
        text(a.initiative_title).localeCompare(text(b.initiative_title))
      );

  const progressPayload = Array.isArray(roadmapSnapshot?.progress_payload) && roadmapSnapshot.progress_payload.length
    ? roadmapSnapshot.progress_payload
    : combinedRoadmap.map((row: any) => clean({
        progress_fact_id: `${text(row.roadmap_fact_id || row.roadmap_instance_id || row.initiative_title)}::progress`,
        assessment_id: assessmentId,
        module_id: roadmapModuleId,
        module_code: "ROADMAP",
        roadmap_fact_id: text(row.roadmap_fact_id || row.roadmap_instance_id),
        source_module_id: text(row.source_module_id || roadmapModuleId),
        linked_metric_id: text(row.linked_metric_id),
        metric_family: text(row.initiative_title),
        owner_role: text(row.owner_role),
        baseline_value: text(row.baseline_value),
        current_value: text(row.progress_pct),
        target_value: "100",
        roadmap_phase: text(row.phase_code),
        rag_rule: text(row.execution_status || row.status),
        review_frequency: text(row.review_frequency || "Monthly"),
        status: text(row.status || "NOT_STARTED"),
        progress_pct: num(row.progress_pct),
        execution_notes: text(row.execution_notes),
        last_reviewed_at: row.last_reviewed_at || null,
        metadata: {
          initiative_title: text(row.initiative_title),
          business_outcome: text(row.business_outcome),
          source_module_ids: text(row.source_module_ids),
          source_module_id: text(row.source_module_id || roadmapModuleId),
        },
      }));
  const criticalFindings = safeModules
    .flatMap((row) => Array.isArray(row.findings_payload) ? row.findings_payload : [])
    .filter((row: any) => {
      const severity = String(row.severity_band || "").toUpperCase();
      return severity == "CRITICAL" || severity.includes("WEAK");
    });
  const trackedMeasures = safeModules.flatMap((row) => Array.isArray(row.metrics_payload) ? row.metrics_payload : []);

  const completedCount = moduleCards.filter((row) => String(row.module_status || "").toUpperCase() === "COMPLETE").length;
  const completionPct = moduleCards.length ? moduleCards.reduce((sum, row) => sum + num(row.completion_pct), 0) / moduleCards.length : 0;
  const scoredCards = moduleCards.filter((row) => row.module_code !== "ROADMAP" && num(row.score_pct) > 0);
  const averageScore = scoredCards.length
    ? scoredCards.reduce((sum, row) => sum + num(row.score_pct), 0) / scoredCards.length
    : 0;

  const payload = {
    assessment_snapshot_id: assessmentId,
    assessment_id: assessmentId,
    summary_payload: {
      completed_modules: completedCount,
      module_count: moduleCards.length,
      average_completion_pct: Number(completionPct.toFixed(2)),
      average_score_pct: Number(averageScore.toFixed(2)),
      critical_findings: criticalFindings.length,
      roadmap_items: combinedRoadmap.length,
      tracked_measures: trackedMeasures.length,
    },
    module_cards_payload: moduleCards,
    roadmap_payload: combinedRoadmap,
    progress_payload: progressPayload,
    calculated_at: nowIso(),
  };

  const { error } = await supabase.from("assessment_snapshots").upsert(payload, { onConflict: "assessment_id" });
  if (error) throw error;
  return payload;
}

export async function getAssessmentSnapshot(assessmentId: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("assessment_snapshots")
    .select("*")
    .eq("assessment_id", assessmentId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
