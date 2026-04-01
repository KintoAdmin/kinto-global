import { computeAndPersistDataFoundation } from "@/lib/services/data-foundation";
import { listActionInstances, listFindingInstances, listRecommendationInstances, listRoadmapInstances } from "@/lib/repositories/runtime";
import type { AreaScore, ModulePublication } from "@/lib/interoperability/types";
import { buildBasePublication, buildCapturedMetrics, buildModuleSummary, joinNarrative, mapPersistedAction, mapPersistedFinding, mapPersistedRecommendation, mapPersistedRoadmap, publishNormalizedPublication } from "@/lib/modules/_publication-common";
import { bandFromPercent } from "@/lib/interoperability/mappers/score-band";

export async function buildDataFoundationPublication(assessmentId: string): Promise<ModulePublication> {
  const summary = await computeAndPersistDataFoundation(assessmentId);
  const base = await buildBasePublication("data_foundation", assessmentId);
  const [findings, recommendations, actions, roadmap, metrics] = await Promise.all([
    listFindingInstances(assessmentId, "DATA"),
    listRecommendationInstances(assessmentId, "DATA"),
    listActionInstances(assessmentId, "DATA"),
    listRoadmapInstances(assessmentId, "DATA"),
    buildCapturedMetrics(assessmentId, "DATA", "data_foundation")
  ]);

  const areaScores: AreaScore[] = (summary.domain_scores || []).map((domain: Record<string, unknown>) => ({
    assessment_id: assessmentId,
    module_code: "data_foundation",
    area_code: String(domain.domain_id || ""),
    area_name: String(domain.domain_name || domain.domain_id || "Data Domain"),
    area_type: "domain",
    raw_score: Number(domain.avg_score || 0),
    normalized_percent: Number(domain.score_pct || 0),
    band: bandFromPercent(Number(domain.score_pct || 0)),
    weight: Number(domain.weight_pct || 0) || null,
    data_domain: String(domain.domain_name || domain.domain_id || "").trim() || null,
    notes: null,
    evidence_notes: null
  }));

  return {
    ...base,
    summary: await buildModuleSummary({
      assessmentId,
      moduleCode: "data_foundation",
      legacyModuleCode: "DATA",
      rawScore: Number(summary.overall_pct || 0),
      normalizedPercent: Number(summary.overall_pct || 0),
      executiveSummary: joinNarrative(summary.executive_narrative)
    }),
    area_scores: areaScores,
    findings: findings.map((row: Record<string, unknown>) => mapPersistedFinding(row, assessmentId, "data_foundation")),
    recommendations: recommendations.map((row: Record<string, unknown>) => mapPersistedRecommendation(row, assessmentId, "data_foundation")),
    actions: actions.map((row: Record<string, unknown>) => mapPersistedAction(row, assessmentId, "data_foundation")),
    roadmap_items: roadmap.map((row: Record<string, unknown>) => mapPersistedRoadmap(row, assessmentId, "data_foundation")),
    metrics
  };
}

export async function publishDataFoundationPublication(assessmentId: string): Promise<ModulePublication> {
  return publishNormalizedPublication(await buildDataFoundationPublication(assessmentId));
}
