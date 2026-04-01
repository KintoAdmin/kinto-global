import { jsonError, jsonOk } from "@/lib/api/http";
import { modulePublicationRepository } from "@/lib/interoperability/publication-repository";
import { publishAllModulesForAssessment } from "@/lib/interoperability/publish-all";

export async function GET(_: Request, context: { params: Promise<{ assessmentId: string }> }) {
  try {
    const { assessmentId } = await context.params;
    const publications = await modulePublicationRepository.listLatestPublished(assessmentId);

    if (publications.length >= 5) {
      // All 5 module publications exist — return immediately without recomputing
      return jsonOk(publications);
    }

    // Fewer than 5 publications exist (fresh assessment or partial generation)
    // Run in background if we have at least some — return what we have immediately
    if (publications.length > 0) {
      // Non-blocking: regenerate in background, return existing now
      void publishAllModulesForAssessment(assessmentId).catch(err =>
        console.error("[publications:get] Background regen failed:", err)
      );
      return jsonOk(publications);
    }

    // Nothing at all — must generate synchronously (first time)
    await publishAllModulesForAssessment(assessmentId);
    const fresh = await modulePublicationRepository.listLatestPublished(assessmentId);
    return jsonOk(fresh);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(_: Request, context: { params: Promise<{ assessmentId: string }> }) {
  try {
    const { assessmentId } = await context.params;
    // Always force-regenerate on explicit POST
    return jsonOk(await publishAllModulesForAssessment(assessmentId));
  } catch (error) {
    return jsonError(error);
  }
}
