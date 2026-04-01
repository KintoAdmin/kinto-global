// @ts-nocheck
import { jsonError, jsonOk, parseJson } from "@/lib/api/http";
import { questionResponseSchema } from "@/lib/api/schemas";
import { normalizeModuleCode } from "@/lib/constants/modules";
import { upsertQuestionResponse } from "@/lib/repositories/runtime";
import { getAssessmentModule, updateAssessmentModuleState } from "@/lib/repositories/assessments";

export async function POST(request: Request, context: { params: Promise<{ assessmentId: string; moduleCode: string }> }) {
  try {
    const { assessmentId, moduleCode } = await context.params;
    const normalized = normalizeModuleCode(moduleCode);
    const payload = questionResponseSchema.parse(await parseJson(request));
    const response = await upsertQuestionResponse(assessmentId, normalized, payload);

    const current = await getAssessmentModule(assessmentId, normalized);
    await updateAssessmentModuleState(assessmentId, normalized, (current.runtime_state || {}) as Record<string, unknown>, {
      moduleStatus: current.module_status === "COMPLETE" ? "COMPLETE" : "IN_PROGRESS",
      completionPct: Math.max(Number(current.completion_pct || 0), payload.score > 0 ? 1 : 0),
      summaryPayload: (current.summary_payload || {}) as Record<string, unknown>
    });

    return jsonOk(response, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
