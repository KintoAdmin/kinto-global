import { computeAndPersistAiReadiness } from "@/lib/services/ai-readiness";
import { listActionInstances, listFindingInstances, listRecommendationInstances, listRoadmapInstances } from "@/lib/repositories/runtime";
import type { AreaScore, ModulePublication } from "@/lib/interoperability/types";
import { buildBasePublication, buildCapturedMetrics, buildModuleSummary, joinNarrative, mapPersistedAction, mapPersistedFinding, mapPersistedRecommendation, mapPersistedRoadmap, publishNormalizedPublication } from "@/lib/modules/_publication-common";
import { bandFromPercent } from "@/lib/interoperability/mappers/score-band";

export async function buildAiReadinessPublication(assessmentId: string): Promise<ModulePublication> {
  const summary = await computeAndPersistAiReadiness(assessmentId);
  const base = await buildBasePublication("ai_readiness", assessmentId);
  const [findings, recommendations, actions, roadmap, metrics] = await Promise.all([
    listFindingInstances(assessmentId, "AIR"),
    listRecommendationInstances(assessmentId, "AIR"),
    listActionInstances(assessmentId, "AIR"),
    listRoadmapInstances(assessmentId, "AIR"),
    buildCapturedMetrics(assessmentId, "AIR", "ai_readiness")
  ]);

  const areaScores: AreaScore[] = (summary.domain_scores || []).map((domain: Record<string, unknown>) => ({
    assessment_id: assessmentId,
    module_code: "ai_readiness",
    area_code: String(domain.domain_id || ""),
    area_name: String(domain.domain_name || domain.domain_id || "AI Readiness Domain"),
    area_type: "domain",
    raw_score: Number(domain.avg_score || 0),
    normalized_percent: Number(domain.score_pct || 0),
    band: bandFromPercent(Number(domain.score_pct || 0)),
    weight: Number(domain.weight_pct || 0) || null,
    notes: null,
    evidence_notes: null
  }));

  return {
    ...base,
    summary: await buildModuleSummary({
      assessmentId,
      moduleCode: "ai_readiness",
      legacyModuleCode: "AIR",
      rawScore: Number(summary.overall_pct || 0),
      normalizedPercent: Number(summary.overall_pct || 0),
      executiveSummary: joinNarrative(summary.executive_narrative),
      notes: String(summary.readiness_status || "").trim() || null
    }),
    area_scores: areaScores,
    findings: findings.map((row: Record<string, unknown>) => mapPersistedFinding(row, assessmentId, "ai_readiness")),
    recommendations: recommendations.map((row: Record<string, unknown>) => mapPersistedRecommendation(row, assessmentId, "ai_readiness")),
    actions: actions.map((row: Record<string, unknown>) => mapPersistedAction(row, assessmentId, "ai_readiness")),
    roadmap_items: roadmap.map((row: Record<string, unknown>) => mapPersistedRoadmap(row, assessmentId, "ai_readiness")),
    metrics
  };
}

export async function publishAiReadinessPublication(assessmentId: string): Promise<ModulePublication> {
  return publishNormalizedPublication(await buildAiReadinessPublication(assessmentId));
}
