// @ts-nocheck
import { jsonError, jsonOk } from "@/lib/api/http";
import { modulePublicationRepository } from "@/lib/interoperability/publication-repository";
import type { ModuleCode } from "@/lib/interoperability/enums";
import { publishOperationalAuditPublication } from "@/lib/modules/ops-audit/publication";
import { publishRevenueLeakagePublication } from "@/lib/modules/revenue-leakage/publication";
import { publishDataFoundationPublication } from "@/lib/modules/data-foundation/publication";
import { publishAiReadinessPublication } from "@/lib/modules/ai-readiness/publication";
import { publishAiUseCasesPublication } from "@/lib/modules/ai-use-cases/publication";

function resolvePublisher(moduleCode: ModuleCode) {
  switch (moduleCode) {
    case "ops_audit":
      return publishOperationalAuditPublication;
    case "revenue_leakage":
      return publishRevenueLeakagePublication;
    case "data_foundation":
      return publishDataFoundationPublication;
    case "ai_readiness":
      return publishAiReadinessPublication;
    case "ai_use_cases":
      return publishAiUseCasesPublication;
    default:
      throw new Error(`Unsupported module code: ${moduleCode}`);
  }
}

export async function GET(_: Request, context: { params: Promise<{ assessmentId: string; moduleCode: string }> }) {
  try {
    const { assessmentId, moduleCode } = await context.params;
    let publication = await modulePublicationRepository.getLatestPublished(assessmentId, moduleCode as ModuleCode);
    if (!publication) {
      publication = await resolvePublisher(moduleCode as ModuleCode)(assessmentId);
    }
    return jsonOk(publication);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(_: Request, context: { params: Promise<{ assessmentId: string; moduleCode: string }> }) {
  try {
    const { assessmentId, moduleCode } = await context.params;
    return jsonOk(await resolvePublisher(moduleCode as ModuleCode)(assessmentId));
  } catch (error) {
    return jsonError(error);
  }
}
