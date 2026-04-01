// @ts-nocheck
export type ModuleCode =
  | "ops_audit"
  | "revenue_leakage"
  | "data_foundation"
  | "ai_readiness"
  | "ai_use_cases";

export type LegacyModuleCode = "OPS" | "LEAK" | "DATA" | "AIR" | "AIUC";

export type AssessmentStatus =
  | "draft"
  | "in_progress"
  | "completed"
  | "archived";

export type ScopeType =
  | "enterprise"
  | "business_unit"
  | "department"
  | "function"
  | "region"
  | "product_line"
  | "workflow"
  | "other";

export type Band = "weak" | "developing" | "managed" | "strong";

export type Priority = "critical" | "high" | "medium" | "low";

export type Timeline = "immediate" | "0_30_days" | "30_60_days" | "60_90_days" | "90_plus_days";

export type ExecutionStatus = "not_started" | "in_progress" | "on_hold" | "blocked" | "complete";

export type PublicationStatus = "draft" | "published";

export type UnitType = "percent" | "currency" | "count" | "days" | "hours" | "ratio" | "score" | "text";

export type DirectionType = "higher_is_better" | "lower_is_better" | "target_range" | "informational";

export type AreaType = "domain" | "core" | "pillar" | "workflow" | "theme" | "use_case_group" | "category";

export const MODULE_LABELS: Record<ModuleCode, string> = {
  ops_audit: "Operational Audit",
  revenue_leakage: "Revenue Leakage",
  data_foundation: "Data Foundation",
  ai_readiness: "AI Readiness",
  ai_use_cases: "AI Use Cases"
};

export const LEGACY_TO_INTEROP_MODULE: Record<LegacyModuleCode, ModuleCode> = {
  OPS: "ops_audit",
  LEAK: "revenue_leakage",
  DATA: "data_foundation",
  AIR: "ai_readiness",
  AIUC: "ai_use_cases"
};

export const INTEROP_TO_LEGACY_MODULE: Record<ModuleCode, LegacyModuleCode> = {
  ops_audit: "OPS",
  revenue_leakage: "LEAK",
  data_foundation: "DATA",
  ai_readiness: "AIR",
  ai_use_cases: "AIUC"
};
