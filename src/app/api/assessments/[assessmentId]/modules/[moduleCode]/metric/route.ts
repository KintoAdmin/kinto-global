import { jsonError, jsonOk, parseJson } from "@/lib/api/http";
import { metricCaptureSchema } from "@/lib/api/schemas";
import { normalizeModuleCode } from "@/lib/constants/modules";
import { upsertMetricCapture } from "@/lib/repositories/runtime";
import { getAssessmentModule, updateAssessmentModuleState } from "@/lib/repositories/assessments";
import { computeModuleSummary } from "@/lib/services/module-summary";

export async function POST(request: Request, context: { params: Promise<{ assessmentId: string; moduleCode: string }> }) {
  try {
    const { assessmentId, moduleCode } = await context.params;
    const normalized = normalizeModuleCode(moduleCode);
    const payload = metricCaptureSchema.parse(await parseJson(request));
    const metric = await upsertMetricCapture(assessmentId, normalized, payload);
    const summary = await computeModuleSummary(assessmentId, normalized as any);

    if (!summary) {
      const current = await getAssessmentModule(assessmentId, normalized);
      await updateAssessmentModuleState(assessmentId, normalized, (current.runtime_state || {}) as Record<string, unknown>, {
        moduleStatus: current.module_status === "COMPLETE" ? "COMPLETE" : "IN_PROGRESS",
        completionPct: Math.max(Number(current.completion_pct || 0), 1),
        summaryPayload: (current.summary_payload || {}) as Record<string, unknown>
      });
    }

    return jsonOk({ metric, summary }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
