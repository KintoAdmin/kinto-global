// @ts-nocheck
import { MODULE_REGISTRY, moduleIdFromCode, PHASE_NAME_BY_CODE } from "@/lib/constants/modules";
import { getAssessmentModule, updateAssessmentModuleState } from "@/lib/repositories/assessments";
import { getAllModuleScores, listModuleRoadmap, listSourceRoadmapRows, replaceModuleArtifacts, updateRoadmapExecutionState } from "@/lib/repositories/runtime";
import { round } from "@/lib/utils/math";
import { nowIso } from "@/lib/utils/ids";

type ModuleScoreRow = { module_id: string; score_pct?: number | null; blocked_usecases?: number | null; [key: string]: unknown };
type RoadmapRow = { phase_code?: string | null; phase_name?: string | null; initiative_title?: string | null; initiative_description?: string | null; owner_role?: string | null; linked_metric_id?: string | null; baseline_value?: string | number | null; target_value?: string | number | null; review_frequency?: string | null; business_outcome?: string | null; priority_rank?: number | string | null; source_module_id?: string | null; source_finding_instance_id?: string | null; source_action_instance_id?: string | null; roadmap_instance_id?: string | null; execution_status?: string | null; status?: string | null; progress_pct?: number | null; execution_notes?: string | null; last_reviewed_at?: string | null; [key: string]: unknown };

function normTitle(value: string) {
  return String(value || "").trim().toLowerCase();
}

export async function buildCombinedRoadmap(assessmentId: string) {
  const sourceModuleIds = MODULE_REGISTRY
    .filter((row) => row.module_code !== "ROADMAP")
    .map((row) => row.module_id);

  const sourceRows = (await listSourceRoadmapRows(assessmentId, sourceModuleIds)) as RoadmapRow[];
  const moduleScores = (await getAllModuleScores(assessmentId)) as ModuleScoreRow[];
  const opsPct = Number(moduleScores.find((row) => row.module_id === moduleIdFromCode("OPS"))?.score_pct || 0);
  const dataPct = Number(moduleScores.find((row) => row.module_id === moduleIdFromCode("DATA"))?.score_pct || 0);
  const airPct = Number(moduleScores.find((row) => row.module_id === moduleIdFromCode("AIR"))?.score_pct || 0);
  const leakPct = Number(moduleScores.find((row) => row.module_id === moduleIdFromCode("LEAK"))?.score_pct || 0);
  const blockedUsecases = Number(moduleScores.find((row) => row.module_id === moduleIdFromCode("AIUC"))?.blocked_usecases || 0);
  const phaseOrder: Record<string, number> = { P1: 1, P2: 2, P3: 3 };

  const manualRows = (await listModuleRoadmap(assessmentId, "ROADMAP")) as RoadmapRow[];
  const manualStateByKey = Object.fromEntries(
    manualRows.map((row) => [
      `${row.phase_code || "P2"}::${normTitle(row.initiative_title || "")}::${normTitle(row.owner_role || "")}`,
      row
    ])
  );

  function priorityUplift(row: RoadmapRow) {
    const sourceModule = row.source_module_id || "";
    const phaseCode = row.phase_code || "P2";
    let uplift = 0;
    if (sourceModule === moduleIdFromCode("LEAK") && phaseCode === "P1" && leakPct < 55) uplift += 3;
    if (sourceModule === moduleIdFromCode("DATA") && ["P1", "P2"].includes(phaseCode) && dataPct < 60) uplift += 2;
    if ([moduleIdFromCode("AIR"), moduleIdFromCode("AIUC")].includes(sourceModule)) {
      if (opsPct < 60 || dataPct < 60 || airPct < 50 || blockedUsecases > 0) uplift -= 2;
    }
    return uplift;
  }

  const grouped: Record<string, any> = {};
  for (const row of sourceRows) {
    const phaseCode = row.phase_code || "P2";
    const title = row.initiative_title || "Initiative";
    const owner = row.owner_role || "";
    const key = `${phaseCode}::${normTitle(title)}::${normTitle(owner)}`;
    const item = grouped[key] || {
      phase_code: phaseCode,
      phase_name: PHASE_NAME_BY_CODE[phaseCode] || row.phase_name || "",
      initiative_title: title,
      initiative_description_parts: [] as string[],
      owner_role: owner,
      linked_metric_id: row.linked_metric_id || "",
      baseline_value: row.baseline_value || "",
      target_value: row.target_value || "",
      review_frequency: row.review_frequency || "",
      business_outcome_parts: [] as string[],
      priority_rank_seed: Number(row.priority_rank || 9999),
      source_module_ids: [] as string[],
      source_finding_ids: [] as string[],
      source_action_ids: [] as string[],
      source_row_ids: [] as string[],
      priority_uplift: 0
    };
    grouped[key] = item;

    const description = String(row.initiative_description || "").trim();
    if (description && !item.initiative_description_parts.includes(description)) item.initiative_description_parts.push(description);
    const outcome = String(row.business_outcome || "").trim();
    if (outcome && !item.business_outcome_parts.includes(outcome)) item.business_outcome_parts.push(outcome);
    if (row.source_module_id && !item.source_module_ids.includes(row.source_module_id)) item.source_module_ids.push(row.source_module_id);
    if (row.source_finding_instance_id && !item.source_finding_ids.includes(row.source_finding_instance_id)) item.source_finding_ids.push(row.source_finding_instance_id);
    if (row.source_action_instance_id && !item.source_action_ids.includes(row.source_action_instance_id)) item.source_action_ids.push(row.source_action_instance_id);
    if (row.roadmap_instance_id && !item.source_row_ids.includes(row.roadmap_instance_id)) item.source_row_ids.push(row.roadmap_instance_id);
    if (!item.owner_role && row.owner_role) item.owner_role = row.owner_role;
    if (!item.linked_metric_id && row.linked_metric_id) item.linked_metric_id = row.linked_metric_id;
    if (!item.baseline_value && row.baseline_value) item.baseline_value = row.baseline_value;
    if (!item.target_value && row.target_value) item.target_value = row.target_value;
    if (!item.review_frequency && row.review_frequency) item.review_frequency = row.review_frequency;
    item.priority_rank_seed = Math.min(item.priority_rank_seed, Number(row.priority_rank || 9999));
    item.priority_uplift = Math.max(item.priority_uplift, priorityUplift(row));
  }

  const groupedRows = Object.values(grouped).map((item: Record<string, any>) => {
    const sourceModules = new Set(item.source_module_ids);
    const dependencyFlags = new Set<string>();
    const dependencyNotes: string[] = [];
    let executionStatus = "READY";

    if (sourceModules.has(moduleIdFromCode("AIR")) || sourceModules.has(moduleIdFromCode("AIUC"))) {
      if (opsPct < 60) {
        dependencyFlags.add("OPS_PREREQ");
        dependencyNotes.push("Operational maturity must improve before broader AI or automation rollout.");
      }
      if (dataPct < 60) {
        dependencyFlags.add("DATA_PREREQ");
        dependencyNotes.push("Data foundation needs strengthening before broader AI or automation rollout.");
      }
      if (airPct < 50 && sourceModules.has(moduleIdFromCode("AIUC"))) {
        dependencyFlags.add("AIR_PREREQ");
        dependencyNotes.push("AI governance and readiness controls are not yet strong enough for scaled rollout.");
      }
      if (blockedUsecases > 0 && sourceModules.has(moduleIdFromCode("AIUC"))) {
        dependencyFlags.add("AIUC_BLOCKERS");
        dependencyNotes.push("Some prioritised AI use cases remain blocked by upstream prerequisites.");
      }
    }

    if (sourceModules.size === 1 && sourceModules.has(moduleIdFromCode("LEAK")) && leakPct < 55) {
      dependencyNotes.push("Financial leakage urgency has pulled this initiative forward in the roadmap.");
    }
    if (sourceModules.size === 1 && sourceModules.has(moduleIdFromCode("DATA")) && opsPct < 60) {
      dependencyNotes.push("Operational discipline gaps are weakening data trust, so this data initiative should move earlier.");
    }

    if ([...dependencyFlags].some((flag) => ["OPS_PREREQ", "DATA_PREREQ", "AIR_PREREQ", "AIUC_BLOCKERS"].includes(flag))) {
      const blockers = [...dependencyFlags].filter((flag) => ["OPS_PREREQ", "DATA_PREREQ", "AIR_PREREQ"].includes(flag)).length;
      executionStatus = blockers >= 2 ? "BLOCKED" : "CONDITIONAL";
    }

    let priorityEffective = Math.max(1, Number(item.priority_rank_seed || 9999) - Number(item.priority_uplift || 0));
    if (executionStatus === "BLOCKED") priorityEffective += 50;
    else if (executionStatus === "CONDITIONAL") priorityEffective += 15;

    return {
      ...item,
      dependency_flags: [...dependencyFlags].sort(),
      dependency_notes: dependencyNotes,
      execution_status: executionStatus,
      priority_effective: priorityEffective
    };
  });

  groupedRows.sort((a: Record<string, any>, b: Record<string, any>) =>
    (phaseOrder[a.phase_code || "P2"] || 9) - (phaseOrder[b.phase_code || "P2"] || 9) ||
    Number(a.priority_effective || 9999) - Number(b.priority_effective || 9999) ||
    String(a.initiative_title || "").localeCompare(String(b.initiative_title || ""))
  );

  const finalRoadmap = groupedRows.map((item: Record<string, any>, index: number) => {
    const stateKey = `${item.phase_code || "P2"}::${normTitle(item.initiative_title || "")}::${normTitle(item.owner_role || "")}`;
    const previous = manualStateByKey[stateKey] || {};
    let status = String(previous.status || (item.execution_status === "BLOCKED" ? "BLOCKED" : "NOT_STARTED")).toUpperCase();
    if (item.execution_status === "BLOCKED" && status === "COMPLETE") status = "ON_HOLD";
    const progressPct = Math.max(0, Math.min(100, Number(previous.progress_pct || 0)));
    const sourceModuleIds = Array.isArray(item.source_module_ids) ? item.source_module_ids.filter(Boolean) : [];
    const primarySourceModuleId = sourceModuleIds[0] || moduleIdFromCode("ROADMAP");
    return {
      roadmap_instance_id: `${assessmentId}::${moduleIdFromCode("ROADMAP")}::ROAD::${String(index + 1).padStart(4, "0")}`,
      assessment_id: assessmentId,
      module_id: moduleIdFromCode("ROADMAP"),
      source_module_id: primarySourceModuleId,
      source_finding_instance_id: item.source_finding_ids.join(";"),
      source_action_instance_id: item.source_action_ids.join(";"),
      phase_code: item.phase_code,
      phase_name: item.phase_name,
      initiative_title: item.initiative_title,
      initiative_description: item.initiative_description_parts.join(" | ").slice(0, 1200),
      owner_role: item.owner_role,
      linked_metric_id: item.linked_metric_id,
      baseline_value: item.baseline_value,
      target_value: item.target_value,
      review_frequency: item.review_frequency || "Monthly",
      business_outcome: item.business_outcome_parts.join(" | ").slice(0, 1200),
      priority_rank: index + 1,
      priority_effective: item.priority_effective,
      status,
      progress_pct: progressPct,
      execution_notes: previous.execution_notes || "",
      last_reviewed_at: previous.last_reviewed_at || "",
      execution_status: item.execution_status,
      dependency_flags: item.dependency_flags.join(";"),
      dependency_summary: item.dependency_notes.join(" "),
      source_module_ids: item.source_module_ids.join(";"),
      source_row_ids: item.source_row_ids.join(";"),
      created_at: nowIso(),
      updated_at: nowIso()
    };
  });

  const domainScores = ["P1", "P2", "P3"].map((phaseCode) => {
    const phaseItems = finalRoadmap.filter((row) => row.phase_code === phaseCode);
    const pct = finalRoadmap.length ? round((phaseItems.length / finalRoadmap.length) * 100, 2) : 0;
    return {
      domain_score_id: `${assessmentId}::${moduleIdFromCode("ROADMAP")}::${phaseCode}`,
      assessment_id: assessmentId,
      module_id: moduleIdFromCode("ROADMAP"),
      domain_id: phaseCode,
      raw_score_total: phaseItems.length,
      max_score_total: finalRoadmap.length,
      score_pct: pct,
      maturity_band: pct >= 80 ? "STRONG" : pct >= 60 ? "MANAGED" : pct >= 40 ? "DEVELOPING" : "WEAK",
      questions_answered: phaseItems.length,
      questions_total: finalRoadmap.length,
      is_complete: finalRoadmap.length > 0,
      phase_name: PHASE_NAME_BY_CODE[phaseCode] || phaseCode,
      initiative_count: phaseItems.length,
      blocked_count: phaseItems.filter((row) => row.execution_status === "BLOCKED").length,
      conditional_count: phaseItems.filter((row) => row.execution_status === "CONDITIONAL").length,
      calculated_at: nowIso()
    };
  });

  const representedModules = [...new Set(sourceRows.map((row) => row.source_module_id).filter(Boolean))];
  const blockedItems = finalRoadmap.filter((row) => row.execution_status === "BLOCKED").length;
  const conditionalItems = finalRoadmap.filter((row) => row.execution_status === "CONDITIONAL").length;
  const coveragePct = sourceModuleIds.length ? round((representedModules.length / sourceModuleIds.length) * 100, 2) : 0;

  return {
    overall_pct: coveragePct,
    overall_maturity: coveragePct >= 80 ? "Strong" : coveragePct >= 60 ? "Managed" : coveragePct >= 40 ? "Developing" : coveragePct > 0 ? "Weak" : "Not scored",
    answered: finalRoadmap.length,
    total: finalRoadmap.length,
    initiatives: finalRoadmap,
    domain_scores: domainScores,
    initiative_count: finalRoadmap.length,
    blocked_initiatives: blockedItems,
    conditional_initiatives: conditionalItems,
    ready_initiatives: Math.max(0, finalRoadmap.length - blockedItems - conditionalItems),
    represented_modules: representedModules
  };
}

export async function computeAndPersistCombinedRoadmap(assessmentId: string) {
  const summary = await buildCombinedRoadmap(assessmentId);
  const moduleId = moduleIdFromCode("ROADMAP");
  const moduleScore = {
    module_score_id: `${assessmentId}::${moduleId}`,
    assessment_id: assessmentId,
    module_id: moduleId,
    raw_score_total: summary.represented_modules.length,
    max_score_total: MODULE_REGISTRY.filter((row) => row.module_code !== "ROADMAP").length,
    score_pct: summary.overall_pct,
    maturity_band: String(summary.overall_maturity || "Not scored").toUpperCase().replace(/\s+/g, "_"),
    domains_completed: summary.initiative_count ? 3 : 0,
    domains_total: 3,
    is_complete: summary.initiative_count > 0,
    initiative_count: summary.initiative_count,
    source_module_count: summary.represented_modules.length,
    blocked_initiatives: summary.blocked_initiatives,
    conditional_initiatives: summary.conditional_initiatives,
    ready_initiatives: summary.ready_initiatives,
    calculated_at: nowIso()
  };

  await replaceModuleArtifacts(assessmentId, "ROADMAP", {
    domainScores: summary.domain_scores,
    moduleScore,
    findings: [],
    recommendations: [],
    actions: [],
    roadmap: summary.initiatives
  });

  await updateAssessmentModuleState(assessmentId, "ROADMAP", {}, {
    moduleStatus: summary.initiative_count ? "COMPLETE" : "NOT_STARTED",
    completionPct: summary.initiative_count ? 100 : 0,
    summaryPayload: summary
  });

  return summary;
}

export async function patchRoadmapExecutionState(assessmentId: string, roadmapInstanceId: string, updates: { status?: string; progressPct?: number; executionNotes?: string; lastReviewedAt?: string }) {
  await updateRoadmapExecutionState(assessmentId, roadmapInstanceId, updates);
  return computeAndPersistCombinedRoadmap(assessmentId);
}
