import { jsonError, jsonOk } from "@/lib/api/http";
import { deleteAssessment, getAssessmentById } from "@/lib/repositories/assessments";

export async function GET(_: Request, context: { params: Promise<{ assessmentId: string }> }) {
  try {
    const { assessmentId } = await context.params;
    return jsonOk(await getAssessmentById(assessmentId));
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ assessmentId: string }> }) {
  try {
    const { assessmentId } = await context.params;
    const deleted = await deleteAssessment(assessmentId);
    if (!deleted) return jsonOk({ deleted: false, assessmentId });
    return jsonOk({ deleted: true, assessmentId, assessment: deleted });
  } catch (error) {
    return jsonError(error);
  }
}
