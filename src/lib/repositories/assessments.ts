// @ts-nocheck
import { getAdminClient } from "@/lib/supabase/admin";
import { getAuthUserId } from "@/lib/supabase/server";
import { assessmentId, nowIso } from "@/lib/utils/ids";
import { MODULE_REGISTRY, moduleIdFromCode, type ModuleCode } from "@/lib/constants/modules";
import { createBlankLeakageState } from "@/lib/reference/local/leakage";
import { refreshModuleSnapshotState } from "@/lib/repositories/foundation";

import { isEnsured, markEnsured, cacheResolved, getCachedResolved } from '@/lib/repositories/assessment-cache';

export async function seedModuleRegistry() {
  const supabase = getAdminClient();
  const payload = MODULE_REGISTRY.map((row) => ({ ...row, updated_at: nowIso() }));
  const { error } = await supabase.from("modules").upsert(payload);
  if (error) throw error;
}

export async function listAssessments(clientId?: string) {
  const supabase = getAdminClient();
  let query = supabase.from("assessments").select("*").order("assessment_date", { ascending: false });
  if (clientId) query = query.eq("client_id", clientId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getAssessmentById(assessmentIdValue: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("assessments")
    .select("*")
    .eq("assessment_id", assessmentIdValue)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getLatestAssessment(clientId?: string) {
  const rows = await listAssessments(clientId);
  return rows[0] || null;
}

export async function createAssessment(input: {
  clientId: string;
  assessmentName: string;
  assessmentDate?: string;
  version?: string;
  assessmentVersion?: string;
  reportingPeriodLabel?: string;
  scopeType?: string;
  scopeLabel?: string;
}) {
  const supabase = getAdminClient();
  await seedModuleRegistry();

  const existing = await listAssessments(input.clientId);
  const identifier = assessmentId(input.clientId, existing.length + 1);

  const payload = {
    assessment_id: identifier,
    client_id: input.clientId,
    assessment_name: input.assessmentName,
    assessment_date: input.assessmentDate || new Date().toISOString().slice(0, 10),
    version: input.version || input.assessmentVersion || "runtime-v1",
    assessment_version: input.assessmentVersion || input.version || "runtime-v1",
    reporting_period_label: input.reportingPeriodLabel || "",
    scope_type: input.scopeType || "enterprise",
    scope_label: input.scopeLabel || "",
    status: "IN_PROGRESS",
    consultant_id: await getAuthUserId(),
    updated_at: nowIso()
  };

  const { data, error } = await supabase.from("assessments").insert(payload).select("*").single();
  if (error) throw error;

  await ensureAssessmentModules(identifier);
  return data;
}

export async function ensureAssessmentModules(assessmentIdValue: string) {
  // Skip all DB roundtrips if we've already ensured this assessment in this process
  if (isEnsured(assessmentIdValue)) {
    // Fast path: modules already set up, return empty array as signal
    // Callers only use the return value on initial setup
    return [];
  }

  const supabase = getAdminClient();
  await seedModuleRegistry();

  const existing = await supabase
    .from("assessment_modules")
    .select("assessment_module_id, module_id")
    .eq("assessment_id", assessmentIdValue);
  if (existing.error) throw existing.error;
  const existingModuleIds = new Set((existing.data || []).map((row: any) => row.module_id));

  const rows = MODULE_REGISTRY.filter((row) => !existingModuleIds.has(row.module_id)).map((module) => ({
    assessment_module_id: `${assessmentIdValue}::${module.module_id}`,
    assessment_id: assessmentIdValue,
    module_id: module.module_id,
    module_status: "NOT_STARTED",
    completion_pct: 0,
    started_at: nowIso(),
    runtime_state: module.module_code === "LEAK" ? createBlankLeakageState() : {},
    summary_payload: {},
    updated_at: nowIso()
  }));

  if (rows.length) {
    const { error } = await supabase.from("assessment_modules").insert(rows);
    if (error) throw error;
  }

  const { data, error } = await supabase
    .from("assessment_modules")
    .select("*, modules(*)")
    .eq("assessment_id", assessmentIdValue)
    .order("module_id", { ascending: true });
  if (error) throw error;
  markEnsured(assessmentIdValue);
  return data || [];
}

export async function getAssessmentModule(assessmentIdValue: string, moduleCode: ModuleCode) {
  const supabase = getAdminClient();
  const moduleId = moduleIdFromCode(moduleCode);
  const { data, error } = await supabase
    .from("assessment_modules")
    .select("*")
    .eq("assessment_id", assessmentIdValue)
    .eq("module_id", moduleId)
    .maybeSingle();
  if (error) throw error;
  if (data) return data;
  await ensureAssessmentModules(assessmentIdValue);
  const { data: retry, error: retryError } = await supabase
    .from("assessment_modules")
    .select("*")
    .eq("assessment_id", assessmentIdValue)
    .eq("module_id", moduleId)
    .single();
  if (retryError) throw retryError;
  return retry;
}

export async function updateAssessmentModuleState(
  assessmentIdValue: string,
  moduleCode: ModuleCode,
  state: unknown,
  options?: { moduleStatus?: string; completionPct?: number; summaryPayload?: Record<string, unknown> }
) {
  const supabase = getAdminClient();
  const current = await getAssessmentModule(assessmentIdValue, moduleCode);
  const payload: Record<string, unknown> = {
    runtime_state: state,
    updated_at: nowIso()
  };
  if (options?.moduleStatus) payload.module_status = options.moduleStatus;
  if (typeof options?.completionPct === "number") payload.completion_pct = options.completionPct;
  if (options?.summaryPayload) payload.summary_payload = options.summaryPayload;
  if (options?.completionPct === 100) payload.completed_at = nowIso();
  const { data, error } = await supabase
    .from("assessment_modules")
    .update(payload)
    .eq("assessment_module_id", current.assessment_module_id)
    .select("*")
    .single();
  if (error) throw error;
  await refreshModuleSnapshotState(assessmentIdValue, moduleCode);
  return data;
}


export async function deleteAssessment(assessmentIdValue: string) {
  const supabase = getAdminClient();
  const existing = await getAssessmentById(assessmentIdValue);
  if (!existing) return null;
  const { error } = await supabase.from("assessments").delete().eq("assessment_id", assessmentIdValue);
  if (error) throw error;
  return existing;
}
