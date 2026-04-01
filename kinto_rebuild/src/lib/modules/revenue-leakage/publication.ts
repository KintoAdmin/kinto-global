import { computeAndPersistLeakage } from "@/lib/services/leakage";
import { listActionInstances, listFindingInstances, listRecommendationInstances, listRoadmapInstances } from "@/lib/repositories/runtime";
import type { AreaScore, MetricArtifact, ModulePublication } from "@/lib/interoperability/types";
import { buildBasePublication, buildModuleSummary, mapPersistedAction, mapPersistedFinding, mapPersistedRecommendation, mapPersistedRoadmap, publishNormalizedPublication } from "@/lib/modules/_publication-common";
import { bandFromPercent, normalizeDirection } from "@/lib/interoperability/mappers/score-band";
import { slug } from "@/lib/utils/ids";

function deriveLeakageMetrics(assessmentId: string, summary: Record<string, any>): MetricArtifact[] {
  const module_code = "revenue_leakage" as const;
  const metrics: MetricArtifact[] = [
    {
      assessment_id: assessmentId,
      module_code,
      metric_code: "TOTAL_REVENUE_LEAKAGE",
      metric_name: "Total Revenue Leakage",
      category: "headline",
      unit: "currency",
      direction: "lower_is_better",
      baseline_value: null,
      current_value: Number(summary.total_leakage || 0),
      target_value: 0,
      benchmark_value: 0,
      variance_value: Number(summary.total_leakage || 0),
      period_label: null,
      notes: null,
      evidence_notes: null,
      source_reference: "Revenue Leakage calculation engine"
    },
    {
      assessment_id: assessmentId,
      module_code,
      metric_code: "DRIVER_TARGET_ACHIEVEMENT_PCT",
      metric_name: "Driver Target Achievement %",
      category: "headline",
      unit: "percent",
      direction: "higher_is_better",
      baseline_value: null,
      current_value: Number(summary.headline?.driver_target_achievement_pct || 0),
      target_value: 100,
      benchmark_value: 100,
      variance_value: Number(summary.headline?.driver_target_achievement_pct || 0) - 100,
      period_label: null,
      notes: null,
      evidence_notes: null,
      source_reference: "Revenue Leakage driver scoring"
    }
  ];

  for (const core of summary.core_rows || []) {
    const code = slug(String(core.name || "CORE"));
    metrics.push({
      assessment_id: assessmentId,
      module_code,
      metric_code: `${code}_LEAKAGE`,
      metric_name: `${core.name} Leakage`,
      category: String(core.category || "core"),
      unit: "currency",
      direction: "lower_is_better",
      baseline_value: null,
      current_value: Number(core.leakage || 0),
      target_value: 0,
      benchmark_value: 0,
      variance_value: Number(core.leakage || 0),
      period_label: null,
      notes: null,
      evidence_notes: null,
      source_reference: String(core.formula || "Revenue Leakage formula")
    });
    metrics.push({
      assessment_id: assessmentId,
      module_code,
      metric_code: `${code}_DRIVER_SCORE`,
      metric_name: `${core.name} Driver Score`,
      category: String(core.category || "core"),
      unit: "percent",
      direction: "higher_is_better",
      baseline_value: null,
      current_value: Number(core.driver_score || 0),
      target_value: 100,
      benchmark_value: 100,
      variance_value: Number(core.driver_score || 0) - 100,
      period_label: null,
      notes: core.driver_rows?.filter((row: any) => !row.within).map((row: any) => row.name).join(", ") || null,
      evidence_notes: null,
      source_reference: "Revenue Leakage driver scoring"
    });
  }

  return metrics;
}

export async function buildRevenueLeakagePublication(assessmentId: string): Promise<ModulePublication> {
  const summary = await computeAndPersistLeakage(assessmentId);
  const base = await buildBasePublication("revenue_leakage", assessmentId);
  const [findings, recommendations, actions, roadmap] = await Promise.all([
    listFindingInstances(assessmentId, "LEAK"),
    listRecommendationInstances(assessmentId, "LEAK"),
    listActionInstances(assessmentId, "LEAK"),
    listRoadmapInstances(assessmentId, "LEAK")
  ]);

  const areaScores: AreaScore[] = (summary.core_rows || []).map((core: Record<string, any>) => ({
    assessment_id: assessmentId,
    module_code: "revenue_leakage",
    area_code: String(slug(String(core.name || "core"))),
    area_name: String(core.name || "Leakage Core"),
    area_type: "core",
    raw_score: Number(core.driver_score || 0),
    normalized_percent: Number(core.driver_score || 0),
    band: bandFromPercent(Number(core.driver_score || 0)),
    weight: null,
    workflow: null,
    notes: String(core.formula || "").trim() || null,
    evidence_notes: core.driver_rows?.filter((row: any) => !row.within).map((row: any) => row.name).join(", ") || null,
    business_function: String(core.category || "").trim() || null
  }));

  const overallPct = areaScores.length
    ? areaScores.reduce((sum, row) => sum + Number(row.normalized_percent || 0), 0) / areaScores.length
    : 0;

  return {
    ...base,
    summary: await buildModuleSummary({
      assessmentId,
      moduleCode: "revenue_leakage",
      legacyModuleCode: "LEAK",
      rawScore: Number(overallPct || 0),
      normalizedPercent: Number(overallPct || 0),
      executiveSummary: `Estimated total revenue leakage is R ${Number(summary.total_leakage || 0).toLocaleString("en-ZA", { maximumFractionDigits: 0 })}. Average driver target achievement is ${Number(summary.headline?.driver_target_achievement_pct || 0).toFixed(1)}%.`
    }),
    area_scores: areaScores,
    findings: findings.map((row: Record<string, unknown>) => mapPersistedFinding(row, assessmentId, "revenue_leakage")),
    recommendations: recommendations.map((row: Record<string, unknown>) => mapPersistedRecommendation(row, assessmentId, "revenue_leakage")),
    actions: actions.map((row: Record<string, unknown>) => mapPersistedAction(row, assessmentId, "revenue_leakage")),
    roadmap_items: roadmap.map((row: Record<string, unknown>) => mapPersistedRoadmap(row, assessmentId, "revenue_leakage")),
    metrics: deriveLeakageMetrics(assessmentId, summary as Record<string, any>)
  };
}

export async function publishRevenueLeakagePublication(assessmentId: string): Promise<ModulePublication> {
  return publishNormalizedPublication(await buildRevenueLeakagePublication(assessmentId));
}
