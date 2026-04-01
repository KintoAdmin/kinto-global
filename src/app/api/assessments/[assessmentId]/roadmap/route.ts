import { jsonError, jsonOk } from "@/lib/api/http";
import { listModuleRoadmap } from "@/lib/repositories/runtime";
import { computeAndPersistCombinedRoadmap } from "@/lib/services/roadmap";

export async function GET(_: Request, context: { params: Promise<{ assessmentId: string }> }) {
  try {
    const { assessmentId } = await context.params;
    let rows = await listModuleRoadmap(assessmentId, "ROADMAP");
    if (!rows.length) {
      await computeAndPersistCombinedRoadmap(assessmentId);
      rows = await listModuleRoadmap(assessmentId, "ROADMAP");
    }
    return jsonOk(rows);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(_: Request, context: { params: Promise<{ assessmentId: string }> }) {
  try {
    const { assessmentId } = await context.params;
    const summary = await computeAndPersistCombinedRoadmap(assessmentId);
    return jsonOk(summary);
  } catch (error) {
    return jsonError(error);
  }
}
