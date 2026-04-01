import { jsonError, jsonOk } from "@/lib/api/http";
import { normalizeModuleCode } from "@/lib/constants/modules";
import { getAssessmentModule } from "@/lib/repositories/assessments";
import { getModuleSnapshot } from "@/lib/repositories/foundation";
import { computeModuleSummary } from "@/lib/services/module-summary";

function hasSnapshotContent(snapshot: any) {
  if (!snapshot) return false;
  return Boolean(
    (snapshot.summary_payload && Object.keys(snapshot.summary_payload).length) ||
    (Array.isArray(snapshot.domain_scores_payload) && snapshot.domain_scores_payload.length) ||
    (Array.isArray(snapshot.findings_payload) && snapshot.findings_payload.length) ||
    (Array.isArray(snapshot.roadmap_payload) && snapshot.roadmap_payload.length) ||
    (Array.isArray(snapshot.metrics_payload) && snapshot.metrics_payload.length)
  );
}

export async function GET(_: Request, context: { params: Promise<{ assessmentId: string; moduleCode: string }> }) {
  try {
    const { assessmentId, moduleCode } = await context.params;
    const normalized = normalizeModuleCode(moduleCode);
    const module = await getAssessmentModule(assessmentId, normalized);
    let snapshot = await getModuleSnapshot(assessmentId, normalized);

    if (!hasSnapshotContent(snapshot)) {
      await computeModuleSummary(assessmentId, normalized);
      snapshot = await getModuleSnapshot(assessmentId, normalized);
    }

    return jsonOk({
      module: {
        assessment_module_id: module.assessment_module_id,
        module_status: snapshot?.module_status || module.module_status,
        completion_pct: snapshot?.completion_pct ?? module.completion_pct
      },
      runtime_state: module.runtime_state || {},
      summary: snapshot?.summary_payload || module.summary_payload || {},
      domainScores: snapshot?.domain_scores_payload || [],
      findings: snapshot?.findings_payload || [],
      roadmap: snapshot?.roadmap_payload || [],
      metrics: snapshot?.metrics_payload || []
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(_: Request, context: { params: Promise<{ assessmentId: string; moduleCode: string }> }) {
  try {
    const { assessmentId, moduleCode } = await context.params;
    const summary = await computeModuleSummary(assessmentId, normalizeModuleCode(moduleCode));
    return jsonOk(summary);
  } catch (error) {
    return jsonError(error);
  }
}
