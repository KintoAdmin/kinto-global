import { getClientById, listClients } from "@/lib/repositories/clients";
import { ensureAssessmentModules, getAssessmentById, getLatestAssessment, listAssessments } from "@/lib/repositories/assessments";
import { MODULE_REGISTRY } from "@/lib/constants/modules";
import { listReports } from "@/lib/repositories/runtime";
import { getAssessmentSnapshot, rebuildAssessmentSnapshot, getModuleSnapshot } from "@/lib/repositories/foundation";
import { modulePublicationRepository } from "@/lib/interoperability/publication-repository";

export async function getWorkspaceSnapshot(input?: { clientId?: string; assessmentId?: string }) {
  const clients = await listClients();
  const client = input?.clientId ? await getClientById(input.clientId) : clients[0] || null;
  const assessments = client ? await listAssessments(client.client_id) : await listAssessments();
  const assessment = input?.assessmentId
    ? await getAssessmentById(input.assessmentId)
    : client
      ? await getLatestAssessment(client.client_id)
      : assessments[0] || null;

  const modules = assessment ? await ensureAssessmentModules(assessment.assessment_id) : [];
  const reports = assessment ? await listReports(assessment.assessment_id) : [];
  const publications = assessment ? await modulePublicationRepository.listLatestPublished(assessment.assessment_id) : [];
  const assessmentSnapshot = assessment
    ? (await getAssessmentSnapshot(assessment.assessment_id)) || (await rebuildAssessmentSnapshot(assessment.assessment_id))
    : null;

  const snapshotCards = Array.isArray(assessmentSnapshot?.module_cards_payload) ? assessmentSnapshot.module_cards_payload as any[] : [];

  // Load live module snapshots in parallel — these contain real-time scores from recompute
  // Only loaded when we have an assessment; each call is a single indexed Supabase query
  const diagnosticModules = MODULE_REGISTRY.filter(m => m.module_code !== 'ROADMAP');
  const liveSnapshots = assessment
    ? await Promise.all(
        diagnosticModules.map(m =>
          getModuleSnapshot(assessment.assessment_id, m.module_code as any).catch(() => null)
        )
      )
    : [];

  const cards = MODULE_REGISTRY.map((module) => {
    const runtime = modules.find((row: any) => row.module_id === module.module_id);
    const snapshotCard = snapshotCards.find((row: any) => row.module_id === module.module_id);
    const liveSnap = liveSnapshots.find(s => s?.module_id === module.module_id) as any;

    // Priority: live snapshot score > assessment snapshot card > runtime
    // Live snapshot is written by background recompute and is always fresh
    const score_pct = Number(liveSnap?.score_pct || snapshotCard?.score_pct || 0);
    const completion_pct = Number(liveSnap?.completion_pct ?? snapshotCard?.completion_pct ?? runtime?.completion_pct ?? 0);
    const maturity_band = liveSnap?.maturity_band || snapshotCard?.maturity_band || null;

    return {
      module_id: module.module_id,
      module_code: module.module_code,
      module_name: module.module_name,
      display_order: module.display_order,
      module_status: liveSnap?.module_status || snapshotCard?.module_status || runtime?.module_status || "NOT_STARTED",
      completion_pct,
      summary_payload: liveSnap?.summary_payload || snapshotCard?.summary_payload || runtime?.summary_payload || {},
      score_pct,
      maturity_band,
    };
  });

  return {
    clients,
    client,
    assessments,
    assessment,
    modules: cards,
    reports,
    publications,
    assessmentSnapshot,
  };
}
