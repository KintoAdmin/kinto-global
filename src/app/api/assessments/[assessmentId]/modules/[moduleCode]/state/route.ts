// @ts-nocheck
import { jsonError, jsonOk, parseJson } from "@/lib/api/http";
import { moduleStateUpdateSchema } from "@/lib/api/schemas";
import { getAssessmentModule, updateAssessmentModuleState } from "@/lib/repositories/assessments";
import { normalizeModuleCode } from "@/lib/constants/modules";

export async function GET(_: Request, context: { params: Promise<{ assessmentId: string; moduleCode: string }> }) {
  try {
    const { assessmentId, moduleCode } = await context.params;
    const module = await getAssessmentModule(assessmentId, normalizeModuleCode(moduleCode));
    return jsonOk(module);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request, context: { params: Promise<{ assessmentId: string; moduleCode: string }> }) {
  try {
    const { assessmentId, moduleCode } = await context.params;
    const payload = moduleStateUpdateSchema.parse(await parseJson(request));
    const updated = await updateAssessmentModuleState(assessmentId, normalizeModuleCode(moduleCode), payload.runtimeState, {
      moduleStatus: payload.moduleStatus,
      completionPct: payload.completionPct,
      summaryPayload: payload.summaryPayload
    });
    return jsonOk(updated);
  } catch (error) {
    return jsonError(error);
  }
}
