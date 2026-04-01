// @ts-nocheck
import { jsonError, jsonOk, parseJson } from "@/lib/api/http";
import { roadmapUpdateSchema } from "@/lib/api/schemas";
import { updateRoadmapExecutionState } from "@/lib/repositories/runtime";

export async function PATCH(request: Request, context: { params: Promise<{ assessmentId: string; roadmapInstanceId: string }> }) {
  try {
    const { assessmentId, roadmapInstanceId } = await context.params;
    const payload = roadmapUpdateSchema.parse(await parseJson(request));
    const updated = await updateRoadmapExecutionState(assessmentId, roadmapInstanceId, payload);
    return jsonOk(updated);
  } catch (error) {
    return jsonError(error);
  }
}
