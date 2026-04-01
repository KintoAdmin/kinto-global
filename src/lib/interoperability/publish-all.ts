import { publishOperationalAuditPublication } from "@/lib/modules/ops-audit/publication";
import { publishRevenueLeakagePublication } from "@/lib/modules/revenue-leakage/publication";
import { publishDataFoundationPublication } from "@/lib/modules/data-foundation/publication";
import { publishAiReadinessPublication } from "@/lib/modules/ai-readiness/publication";
import { publishAiUseCasesPublication } from "@/lib/modules/ai-use-cases/publication";
import type { ModulePublication } from "@/lib/interoperability/types";

/**
 * Publish all 5 module publications in PARALLEL.
 * Previously ran sequentially: 5 × ~22s = 110s+
 * Now runs concurrently: max(OPS, LEAK, DATA, AIR, AIUC) = ~27s
 *
 * Each publication runs its own computeAndPersist independently,
 * so there are no cross-module data dependencies.
 */
export async function publishAllModulesForAssessment(assessmentId: string): Promise<ModulePublication[]> {
  const results = await Promise.allSettled([
    publishOperationalAuditPublication(assessmentId),
    publishRevenueLeakagePublication(assessmentId),
    publishDataFoundationPublication(assessmentId),
    publishAiReadinessPublication(assessmentId),
    publishAiUseCasesPublication(assessmentId),
  ]);

  const publications: ModulePublication[] = [];
  const errors: string[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      publications.push(result.value);
    } else {
      const msg = result.reason instanceof Error ? result.reason.message : String(result.reason);
      console.error("[publish-all] Module publication failed:", msg);
      errors.push(msg);
    }
  }

  // Surface errors only if ALL modules failed
  if (publications.length === 0 && errors.length > 0) {
    throw new Error(`All module publications failed: ${errors.join("; ")}`);
  }

  return publications;
}
