// @ts-nocheck
import { type ModuleCode } from "@/lib/constants/modules";
import { computeAndPersistLeakage } from "@/lib/services/leakage";
import { computeAndPersistAudit } from "@/lib/services/audit";
import { computeAndPersistDataFoundation } from "@/lib/services/data-foundation";
import { computeAndPersistAiReadiness } from "@/lib/services/ai-readiness";
import { computeAndPersistAiUsecases } from "@/lib/services/ai-usecase";
import { computeAndPersistCombinedRoadmap } from "@/lib/services/roadmap";

export async function computeModuleSummary(assessmentId: string, moduleCode: ModuleCode) {
  switch (moduleCode) {
    case "LEAK":
      return computeAndPersistLeakage(assessmentId);
    case "OPS":
      return computeAndPersistAudit(assessmentId);
    case "DATA":
      return computeAndPersistDataFoundation(assessmentId);
    case "AIR":
      return computeAndPersistAiReadiness(assessmentId);
    case "AIUC":
      return computeAndPersistAiUsecases(assessmentId);
    case "ROADMAP":
      return computeAndPersistCombinedRoadmap(assessmentId);
    default:
      return null;
  }
}
