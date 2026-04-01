// @ts-nocheck
import { getAdminClient } from "@/lib/supabase/admin";
import { nowIso } from "@/lib/utils/ids";

export type ReportStatus = "queued" | "generating" | "ready" | "failed";
export type ReportArtifactType = "json" | "docx" | "pptx";

export function reportInstanceIdFor(assessmentId: string, moduleScope: string) {
  return `${assessmentId}::${moduleScope}`;
}

export function artifactIdFor(reportInstanceId: string, fileType: ReportArtifactType, version: number) {
  return `${reportInstanceId}::${fileType}::v${version}`;
}

export async function getReportInstance(reportInstanceId: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase.from("report_instances").select("*").eq("report_instance_id", reportInstanceId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listReportInstances(assessmentId: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("report_instances")
    .select("*")
    .eq("assessment_id", assessmentId)
    .order("module_scope", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function upsertReportRecord(input: {
  reportInstanceId: string;
  assessmentId: string;
  reportType: string;
  moduleScope: string;
  moduleCode?: string | null;
  scopeType: "integrated" | "module";
  title: string;
  summaryText?: string;
  status: ReportStatus;
  latestVersion: number;
  reportPayload?: unknown;
  fileName?: string;
  filePath?: string;
  lastError?: string;
}) {
  const supabase = getAdminClient();
  const payload = {
    report_instance_id: input.reportInstanceId,
    assessment_id: input.assessmentId,
    report_type: input.reportType,
    module_scope: input.moduleScope,
    module_code: input.moduleCode || null,
    scope_type: input.scopeType,
    title: input.title,
    summary_text: input.summaryText || "",
    report_status: input.status,
    latest_version: input.latestVersion,
    file_name: input.fileName || "",
    file_path: input.filePath || "",
    generated_at: nowIso(),
    generated_by: "system",
    report_version: `v${input.latestVersion}`,
    report_payload: (input.reportPayload as any) || {},
    last_error: input.lastError || "",
    updated_at: nowIso(),
  };
  const { data, error } = await supabase.from("report_instances").upsert(payload).select("*").single();
  if (error) throw error;
  return data;
}

export async function replaceArtifacts(input: {
  reportInstanceId: string;
  assessmentId: string;
  moduleScope: string;
  moduleCode?: string | null;
  version: number;
  artifacts: Array<{
    artifactId: string;
    fileType: ReportArtifactType;
    fileName: string;
    storagePath: string;
    fileSize: number;
  }>;
}) {
  const supabase = getAdminClient();
  const { error: deleteError } = await supabase.from("report_artifacts").delete().eq("report_instance_id", input.reportInstanceId);
  if (deleteError) throw deleteError;

  const rows = input.artifacts.map((artifact) => ({
    artifact_id: artifact.artifactId,
    report_instance_id: input.reportInstanceId,
    assessment_id: input.assessmentId,
    module_scope: input.moduleScope,
    module_code: input.moduleCode || null,
    file_type: artifact.fileType,
    file_name: artifact.fileName,
    storage_path: artifact.storagePath,
    file_size: artifact.fileSize,
    generated_version: input.version,
    created_at: nowIso(),
  }));

  const { error } = await supabase.from("report_artifacts").insert(rows);
  if (error) throw error;
  return rows;
}

export async function listArtifacts(reportInstanceId: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("report_artifacts")
    .select("*")
    .eq("report_instance_id", reportInstanceId)
    .order("file_type", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getArtifact(artifactId: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase.from("report_artifacts").select("*").eq("artifact_id", artifactId).maybeSingle();
  if (error) throw error;
  return data;
}
