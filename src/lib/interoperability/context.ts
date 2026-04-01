import { getAssessmentById } from "@/lib/repositories/assessments";
import { getClientById } from "@/lib/repositories/clients";
import type { AssessmentStatus, ScopeType } from "@/lib/interoperability/enums";
import type { SharedAssessmentContext } from "@/lib/interoperability/types";

function normalizeAssessmentStatus(value: unknown): AssessmentStatus {
  const input = String(value ?? "").trim().toLowerCase();
  if (input.includes("complete")) return "completed";
  if (input.includes("archive")) return "archived";
  if (input.includes("progress")) return "in_progress";
  return "draft";
}

function normalizeScopeType(value: unknown): ScopeType {
  const input = String(value ?? "").trim().toLowerCase();
  if (
    input === "enterprise" ||
    input === "business_unit" ||
    input === "department" ||
    input === "function" ||
    input === "region" ||
    input === "product_line" ||
    input === "workflow" ||
    input === "other"
  ) {
    return input as ScopeType;
  }
  return "enterprise";
}

export async function buildSharedAssessmentContext(assessmentId: string): Promise<SharedAssessmentContext> {
  const assessment = await getAssessmentById(assessmentId);
  if (!assessment) throw new Error(`Assessment ${assessmentId} was not found.`);
  const client = await getClientById(String(assessment.client_id));
  if (!client) throw new Error(`Client ${assessment.client_id} was not found.`);

  return {
    client_id: String(client.client_id),
    client_name: String(client.client_name),
    industry: String(client.industry || "").trim() || null,
    business_model: String(client.business_model || "").trim() || null,
    company_size: String(client.company_size || "").trim() || null,
    region: String(client.region || "").trim() || null,
    assessment_id: String(assessment.assessment_id),
    assessment_name: String(assessment.assessment_name),
    assessment_status: normalizeAssessmentStatus(assessment.status),
    assessment_date: assessment.assessment_date ? String(assessment.assessment_date) : null,
    assessment_version: String(assessment.assessment_version || assessment.version || "").trim() || null,
    reporting_period_label: String(assessment.reporting_period_label || "").trim() || null,
    scope_type: normalizeScopeType(assessment.scope_type),
    scope_label: String(assessment.scope_label || "").trim() || null
  };
}
