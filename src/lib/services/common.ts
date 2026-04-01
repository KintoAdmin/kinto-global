// @ts-nocheck
import { moduleIdFromCode, PHASE_NAME_BY_CODE, type ModuleCode } from "@/lib/constants/modules";
import { getAssessmentModule, updateAssessmentModuleState } from "@/lib/repositories/assessments";
import { getAllModuleScores as listAllModuleScores, listMetricCaptures, listQuestionResponses, upsertMetricCapture, upsertQuestionResponse } from "@/lib/repositories/runtime";
import { slug } from "@/lib/utils/ids";
import { maturityBandFromPct } from "@/lib/utils/math";

type QuestionResponseRecord = { question_id: string; score?: number | null; score_1_to_5?: number | null; [key: string]: unknown };
type MetricCaptureRecord = { metric_id: string; workflow_id?: string | null; unit?: string | null; variance_to_target?: string | null; current_value?: string | number | null; target_value?: string | number | null; rag_status?: string | null; trend_direction?: string | null; baseline_value?: string | number | null; [key: string]: unknown };

export async function getResponseMap(assessmentId: string, moduleCode: ModuleCode) {
  const rows = await listQuestionResponses(assessmentId, moduleCode);
  return Object.fromEntries((rows as QuestionResponseRecord[]).map((row) => [row.question_id, row]));
}

export async function getMetricMap(assessmentId: string, moduleCode: ModuleCode) {
  const rows = await listMetricCaptures(assessmentId, moduleCode);
  return Object.fromEntries((rows as MetricCaptureRecord[]).map((row) => [`${row.metric_id}::${row.workflow_id || ""}`, row]));
}

export async function ensureMetricCapture(
  assessmentId: string,
  moduleCode: ModuleCode,
  metricDef: Record<string, unknown>,
  domainId = "",
  workflowId = ""
) {
  const metricIdValue = String(metricDef.metric_id || "");
  const metricName = String(metricDef.metric_name || "");
  const workflow = workflowId || String(metricDef.workflow_id || "");
  return upsertMetricCapture(assessmentId, moduleCode, {
    metricId: metricIdValue,
    metricName,
    domainId: domainId || String(metricDef.domain_id || ""),
    workflowId: workflow,
    unit: String(metricDef.unit || ""),
    reviewFrequency: String(metricDef.frequency || metricDef.review_frequency || ""),
    ownerRole: String(metricDef.owner_role || ""),
  });
}

export async function ensureQuestionResponse(
  assessmentId: string,
  moduleCode: ModuleCode,
  questionId: string,
  domainId = "",
  workflowId = ""
) {
  return upsertQuestionResponse(assessmentId, moduleCode, {
    questionId,
    domainId,
    workflowId,
    score: 0,
    notes: "",
    evidenceSummary: "",
    assessorConfidence: "",
  });
}

export function routePhase(phaseName: string): { phaseCode: string; phaseName: string } {
  const input = String(phaseName || "").toLowerCase();
  if (input.includes("1")) return { phaseCode: "P1", phaseName: PHASE_NAME_BY_CODE.P1 };
  if (input.includes("2")) return { phaseCode: "P2", phaseName: PHASE_NAME_BY_CODE.P2 };
  return { phaseCode: "P3", phaseName: PHASE_NAME_BY_CODE.P3 };
}

export function airReadinessStatus(scorePct: number, isComplete: boolean): string {
  if (!isComplete) return "INCOMPLETE";
  if (scorePct >= 80) return "PILOT_READY";
  if (scorePct >= 60) return "CONDITIONAL";
  return "BLOCKED";
}

export function aiUsecaseStatus(rankPct: number, isComplete: boolean, opsPct: number, dataPct: number, airPct: number, airStatus: string): string {
  if (!isComplete) return "INCOMPLETE";
  const highReadiness = opsPct >= 60 && dataPct >= 60 && airPct >= 60 && airStatus === "PILOT_READY";
  const mediumReadiness = opsPct >= 40 && dataPct >= 40 && airPct >= 50 && ["PILOT_READY", "CONDITIONAL"].includes(airStatus);
  if (rankPct >= 80 && highReadiness) return "PILOT_READY";
  if (rankPct >= 40 && mediumReadiness) return "CONDITIONALLY_READY";
  return "BLOCKED";
}

export function formatMetricValue(value: unknown, unit = "") {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return unit && !text.includes(unit) ? `${text} ${unit}` : text;
}

export function parseNumeric(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const match = String(value).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function calculateVarianceToTarget(currentValue: unknown, targetValue: unknown, unit = ""): string {
  const current = parseNumeric(currentValue);
  const target = parseNumeric(targetValue);
  if (current == null || target == null) return "";
  const gap = current - target;
  if (unit === "%") return `${gap >= 0 ? "+" : ""}${gap.toFixed(1)} pts`;
  if (["days", "hours", "count", "ratio", "rate"].includes(unit.toLowerCase())) {
    return `${gap >= 0 ? "+" : ""}${gap.toFixed(1)} ${unit}`.trim();
  }
  return `${gap >= 0 ? "+" : ""}${gap.toFixed(2)} ${unit}`.trim();
}

export async function metricSnapshot(
  assessmentId: string,
  moduleCode: ModuleCode,
  metricDef?: Record<string, unknown>,
  options?: { persistMissing?: boolean }
) {
  if (!metricDef || !metricDef.metric_id) return {};
  const workflowId = String(metricDef.workflow_id || "");
  const metricMap = await getMetricMap(assessmentId, moduleCode);
  const existing = metricMap[`${String(metricDef.metric_id)}::${workflowId}`];
  const state = existing || (options?.persistMissing === false
    ? { unit: String(metricDef.unit || ""), baseline_value: "", current_value: "", target_value: "" }
    : await ensureMetricCapture(assessmentId, moduleCode, metricDef, String(metricDef.domain_id || ""), workflowId));
  const unit = String(metricDef.unit || state.unit || "");
  const variance = String(state.variance_to_target || "").trim() || calculateVarianceToTarget(state.current_value, state.target_value, unit);
  const rag = String(state.rag_status || "").trim() || (String(state.current_value || "").trim() ? "Captured" : "Not captured");
  const trend = String(state.trend_direction || "").trim() || "Not set";

  return {
    ...metricDef,
    ...state,
    baseline_display: formatMetricValue(state.baseline_value, unit),
    current_display: formatMetricValue(state.current_value, unit),
    target_display: formatMetricValue(state.target_value, unit),
    variance_display: variance || "Not calculated",
    rag_display: rag,
    trend_display: trend,
    captured: Boolean(String(state.baseline_value || "").trim() || String(state.current_value || "").trim() || String(state.target_value || "").trim())
  };
}

export async function updateModuleRuntimeSummary(
  assessmentId: string,
  moduleCode: ModuleCode,
  runtimeState: Record<string, unknown>,
  summary: Record<string, unknown>,
  completionPct: number,
  status: string
) {
  await updateAssessmentModuleState(assessmentId, moduleCode, runtimeState, {
    moduleStatus: status,
    completionPct,
    summaryPayload: summary
  });
}

export async function getStoredRoadmapSummary(assessmentId: string) {
  const module = await getAssessmentModule(assessmentId, "ROADMAP");
  return module?.summary_payload || {};
}

export function slugId(prefix: string, value: string) {
  return `${prefix}-${slug(value)}`;
}

export function hasSignal(...values: unknown[]) {
  return values.some((value) => {
    if (value == null) return false;
    if (typeof value === "number") return value !== 0;
    return String(value).trim() !== "" && String(value).trim() !== "0";
  });
}

export function maturityForModule(scorePct: number, isComplete: boolean) {
  return maturityBandFromPct(scorePct, isComplete);
}

export async function getAllModuleScores(assessmentId: string) {
  return listAllModuleScores(assessmentId);
}
