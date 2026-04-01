// @ts-nocheck
import { getAssessmentModule } from "@/lib/repositories/assessments";
import { listMetricCaptures } from "@/lib/repositories/runtime";
import { modulePublicationRepository } from "@/lib/interoperability/publication-repository";
import { buildSharedAssessmentContext } from "@/lib/interoperability/context";
import { MODULE_MANIFESTS } from "@/lib/interoperability/manifests";
import { MODULE_LABELS, type LegacyModuleCode, type ModuleCode } from "@/lib/interoperability/enums";
import { bandFromPercent, normalizeDirection, normalizeExecutionStatus, normalizePriority, normalizeTimeline, normalizeUnit } from "@/lib/interoperability/mappers/score-band";
import { extractEvidence, extractSharedTags } from "@/lib/interoperability/mappers/shared-tags";
import type { MetricArtifact, ModulePublication, ModuleSummary } from "@/lib/interoperability/types";
import { nowIso } from "@/lib/utils/ids";

export function toNullableNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = String(value).replace(/,/g, " ").replace(/[^0-9+\-. ]/g, " ").trim();
  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function joinNarrative(value: unknown): string | null {
  if (Array.isArray(value)) {
    const items = value.map((item) => String(item ?? "").trim()).filter(Boolean);
    return items.length ? items.join(" ") : null;
  }
  const text = String(value ?? "").trim();
  return text || null;
}

export function moduleStatusToReportStatus(value: unknown): ModuleSummary["status"] {
  const input = String(value ?? "").trim().toLowerCase();
  if (input.includes("complete")) return "completed";
  if (input.includes("progress") || input.includes("ready")) return "in_progress";
  if (input.includes("archive")) return "archived";
  return "draft";
}

export async function buildBasePublication(moduleCode: ModuleCode, assessmentId: string): Promise<Pick<ModulePublication, "assessment_id" | "module_code" | "module_version" | "publication_status" | "published_at" | "context">> {
  return {
    assessment_id: assessmentId,
    module_code: moduleCode,
    module_version: MODULE_MANIFESTS[moduleCode].module_version,
    publication_status: "draft",
    published_at: nowIso(),
    context: await buildSharedAssessmentContext(assessmentId)
  };
}

export async function buildModuleSummary(input: {
  assessmentId: string;
  moduleCode: ModuleCode;
  legacyModuleCode: LegacyModuleCode;
  rawScore: number | null;
  normalizedPercent: number | null;
  executiveSummary: string | null;
  notes?: string | null;
  evidenceNotes?: string | null;
}): Promise<ModuleSummary> {
  const runtime = await getAssessmentModule(input.assessmentId, input.legacyModuleCode);
  return {
    assessment_id: input.assessmentId,
    module_code: input.moduleCode,
    module_name: MODULE_LABELS[input.moduleCode],
    raw_score: input.rawScore,
    normalized_percent: input.normalizedPercent,
    band: bandFromPercent(input.normalizedPercent),
    completion_percent: Number(runtime?.completion_pct || 0),
    status: moduleStatusToReportStatus(runtime?.module_status),
    executive_summary: input.executiveSummary,
    notes: input.notes || null,
    evidence_notes: input.evidenceNotes || null
  };
}

export async function buildCapturedMetrics(assessmentId: string, legacyModuleCode: LegacyModuleCode, moduleCode: ModuleCode): Promise<MetricArtifact[]> {
  const rows = await listMetricCaptures(assessmentId, legacyModuleCode);
  return rows.map((row: Record<string, unknown>) => ({
    assessment_id: assessmentId,
    module_code: moduleCode,
    metric_code: String(row.metric_code || row.metric_id || row.metric_capture_id || ""),
    metric_name: String(row.metric_name || row.metric_id || "Metric"),
    category: String(row.category || row.domain_id || "").trim() || null,
    unit: normalizeUnit(row.unit),
    direction: normalizeDirection(row.direction),
    baseline_value: toNullableNumber(row.baseline_value_numeric ?? row.baseline_value),
    current_value: toNullableNumber(row.current_value_numeric ?? row.current_value),
    target_value: toNullableNumber(row.target_value_numeric ?? row.target_value),
    benchmark_value: toNullableNumber(row.benchmark_value_numeric),
    variance_value: toNullableNumber(row.variance_value_numeric ?? row.variance_to_target),
    period_label: String(row.period_label || row.baseline_date || "").trim() || null,
    ...extractSharedTags(row),
    ...extractEvidence(row)
  }));
}

export function mapPersistedFinding(row: Record<string, unknown>, assessmentId: string, moduleCode: ModuleCode) {
  return {
    assessment_id: assessmentId,
    module_code: moduleCode,
    finding_code: String(row.finding_instance_id || row.source_library_id || ""),
    title: String(row.finding_title || ""),
    summary: String(row.finding_narrative || ""),
    severity: normalizePriority(row.severity_band),
    business_impact: String(row.business_impact || "").trim() || null,
    priority: row.is_priority ? "high" : normalizePriority(row.severity_band),
    ...extractSharedTags(row),
    ...extractEvidence(row)
  };
}

export function mapPersistedRecommendation(row: Record<string, unknown>, assessmentId: string, moduleCode: ModuleCode) {
  return {
    assessment_id: assessmentId,
    module_code: moduleCode,
    recommendation_code: String(row.recommendation_instance_id || row.source_library_id || ""),
    finding_code: String(row.linked_finding_instance_id || "").trim() || null,
    title: String(row.recommendation_title || ""),
    summary: String(row.recommendation_text || ""),
    priority: normalizePriority(row.priority_level || row.priority_rank),
    expected_outcome: String(row.expected_outcome || "").trim() || null,
    ...extractSharedTags(row),
    ...extractEvidence(row)
  };
}

export function mapPersistedAction(row: Record<string, unknown>, assessmentId: string, moduleCode: ModuleCode) {
  return {
    assessment_id: assessmentId,
    module_code: moduleCode,
    action_code: String(row.action_instance_id || row.source_library_id || ""),
    recommendation_code: String(row.linked_recommendation_instance_id || "").trim() || null,
    title: String(row.action_title || ""),
    summary: String(row.action_text || ""),
    owner_role: String(row.owner_role || "").trim() || null,
    timeline: normalizeTimeline(row.timeline_band || row.indicative_timeline || row.phase_name || row.phase_code),
    effort: String(row.effort_level || "").trim() || null,
    success_measure: String(row.success_measure || "").trim() || null,
    execution_status: normalizeExecutionStatus(row.status || row.execution_status),
    ...extractSharedTags(row),
    ...extractEvidence(row)
  };
}

export function mapPersistedRoadmap(row: Record<string, unknown>, assessmentId: string, moduleCode: ModuleCode) {
  const phase = normalizeTimeline(row.phase_code || row.phase_name || row.timeline || row.indicative_timeline) || "90_plus_days";
  return {
    assessment_id: assessmentId,
    module_code: moduleCode,
    roadmap_code: String(row.roadmap_instance_id || row.source_library_id || ""),
    phase,
    title: String(row.initiative_title || row.action_title || row.milestone_name || ""),
    summary: String(row.initiative_description || row.initiative_text || row.milestone_description || ""),
    priority: normalizePriority(row.priority_level || row.priority_rank || row.priority_effective),
    owner_role: String(row.owner_role || "").trim() || null,
    timeline: normalizeTimeline(row.indicative_timeline || row.phase_name || row.phase_code),
    dependency_summary: String(row.dependency_summary || row.dependency || "").trim() || null,
    execution_status: normalizeExecutionStatus(row.status || row.execution_status),
    ...extractSharedTags(row),
    ...extractEvidence(row)
  };
}

export async function publishNormalizedPublication(publication: ModulePublication): Promise<ModulePublication> {
  await modulePublicationRepository.upsertDraft(publication);
  const published = { ...publication, publication_status: "published" as const, published_at: nowIso() };
  await modulePublicationRepository.publish(published);
  return published;
}
