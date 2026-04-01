// @ts-nocheck
import { computeAndPersistAiUsecases } from "@/lib/services/ai-usecase";
import { listActionInstances, listFindingInstances, listRecommendationInstances, listRoadmapInstances } from "@/lib/repositories/runtime";
import type { AreaScore, ModulePublication } from "@/lib/interoperability/types";
import { buildBasePublication, buildCapturedMetrics, buildModuleSummary, joinNarrative, mapPersistedAction, mapPersistedFinding, mapPersistedRecommendation, mapPersistedRoadmap, publishNormalizedPublication } from "@/lib/modules/_publication-common";
import { bandFromPercent } from "@/lib/interoperability/mappers/score-band";

export async function buildAiUseCasesPublication(assessmentId: string): Promise<ModulePublication> {
  const summary = await computeAndPersistAiUsecases(assessmentId);
  const base = await buildBasePublication("ai_use_cases", assessmentId);
  const [findings, recommendations, actions, roadmap, metrics] = await Promise.all([
    listFindingInstances(assessmentId, "AIUC"),
    listRecommendationInstances(assessmentId, "AIUC"),
    listActionInstances(assessmentId, "AIUC"),
    listRoadmapInstances(assessmentId, "AIUC"),
    buildCapturedMetrics(assessmentId, "AIUC", "ai_use_cases")
  ]);

  const areaScores: AreaScore[] = (summary.domain_scores || []).map((domain: Record<string, unknown>) => ({
    assessment_id: assessmentId,
    module_code: "ai_use_cases",
    area_code: String(domain.domain_id || ""),
    area_name: String(domain.domain_name || domain.domain_id || "Use Case Group"),
    area_type: "use_case_group",
    raw_score: Number(domain.score_pct || 0),
    normalized_percent: Number(domain.score_pct || 0),
    band: bandFromPercent(Number(domain.score_pct || 0)),
    weight: null,
    notes: String(domain.deployment_status || "").trim() || null,
    evidence_notes: null
  }));

  return {
    ...base,
    summary: await buildModuleSummary({
      assessmentId,
      moduleCode: "ai_use_cases",
      legacyModuleCode: "AIUC",
      rawScore: Number(summary.overall_pct || 0),
      normalizedPercent: Number(summary.overall_pct || 0),
      executiveSummary: joinNarrative(summary.executive_narrative),
      notes: String(summary.readiness_status || "").trim() || null
    }),
    area_scores: areaScores,
    findings: findings.map((row: Record<string, unknown>) => mapPersistedFinding(row, assessmentId, "ai_use_cases")),
    recommendations: recommendations.map((row: Record<string, unknown>) => mapPersistedRecommendation(row, assessmentId, "ai_use_cases")),
    actions: actions.map((row: Record<string, unknown>) => mapPersistedAction(row, assessmentId, "ai_use_cases")),
    roadmap_items: roadmap.map((row: Record<string, unknown>) => mapPersistedRoadmap(row, assessmentId, "ai_use_cases")),
    metrics
  };
}

export async function publishAiUseCasesPublication(assessmentId: string): Promise<ModulePublication> {
  return publishNormalizedPublication(await buildAiUseCasesPublication(assessmentId));
}
