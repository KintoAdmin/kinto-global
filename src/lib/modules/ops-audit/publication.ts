import { computeAndPersistAudit } from "@/lib/services/audit";
import { listActionInstances, listFindingInstances, listRecommendationInstances, listRoadmapInstances } from "@/lib/repositories/runtime";
import type { AreaScore, ModulePublication } from "@/lib/interoperability/types";
import { buildBasePublication, buildCapturedMetrics, buildModuleSummary, joinNarrative, mapPersistedAction, mapPersistedFinding, mapPersistedRecommendation, mapPersistedRoadmap, publishNormalizedPublication } from "@/lib/modules/_publication-common";
import { bandFromPercent } from "@/lib/interoperability/mappers/score-band";

export async function buildOperationalAuditPublication(assessmentId: string): Promise<ModulePublication> {
  const summary = await computeAndPersistAudit(assessmentId);
  const base = await buildBasePublication("ops_audit", assessmentId);
  const [findings, recommendations, actions, roadmap, metrics] = await Promise.all([
    listFindingInstances(assessmentId, "OPS"),
    listRecommendationInstances(assessmentId, "OPS"),
    listActionInstances(assessmentId, "OPS"),
    listRoadmapInstances(assessmentId, "OPS"),
    buildCapturedMetrics(assessmentId, "OPS", "ops_audit")
  ]);

  const areaScores: AreaScore[] = (summary.domain_scores || []).map((domain: Record<string, unknown>) => ({
    assessment_id: assessmentId,
    module_code: "ops_audit",
    area_code: String(domain.domain_id || ""),
    area_name: String(domain.domain_name || domain.domain_id || "Operational Area"),
    area_type: "domain",
    raw_score: typeof domain.avg_score === "number" ? domain.avg_score : Number(domain.avg_score || 0),
    normalized_percent: typeof domain.percentage === "number" ? domain.percentage : Number(domain.percentage || 0),
    band: bandFromPercent(Number(domain.percentage || 0)),
    weight: null,
    workflow: null,
    notes: null,
    evidence_notes: null
  }));

  return {
    ...base,
    summary: await buildModuleSummary({
      assessmentId,
      moduleCode: "ops_audit",
      legacyModuleCode: "OPS",
      rawScore: Number(summary.overall_avg || 0),
      normalizedPercent: Number(summary.overall_percentage || 0),
      executiveSummary: joinNarrative(summary.executive_narrative)
    }),
    area_scores: areaScores,
    findings: findings.map((row: Record<string, unknown>) => mapPersistedFinding(row, assessmentId, "ops_audit")),
    recommendations: recommendations.map((row: Record<string, unknown>) => mapPersistedRecommendation(row, assessmentId, "ops_audit")),
    actions: actions.map((row: Record<string, unknown>) => mapPersistedAction(row, assessmentId, "ops_audit")),
    roadmap_items: roadmap.map((row: Record<string, unknown>) => mapPersistedRoadmap(row, assessmentId, "ops_audit")),
    metrics
  };
}

export async function publishOperationalAuditPublication(assessmentId: string): Promise<ModulePublication> {
  return publishNormalizedPublication(await buildOperationalAuditPublication(assessmentId));
}
