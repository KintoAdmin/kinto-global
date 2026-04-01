import type { ModuleCode } from "@/lib/interoperability/enums";
import { MODULE_LABELS } from "@/lib/interoperability/enums";

export type ModuleManifest = {
  module_code: ModuleCode;
  module_name: string;
  module_version: string;
  supports_standalone_reports: boolean;
  emits_metrics: boolean;
  emits_roadmap: boolean;
  emits_actions: boolean;
};

export const MODULE_MANIFESTS: Record<ModuleCode, ModuleManifest> = {
  ops_audit: {
    module_code: "ops_audit",
    module_name: MODULE_LABELS.ops_audit,
    module_version: "55.0.0",
    supports_standalone_reports: true,
    emits_metrics: true,
    emits_roadmap: true,
    emits_actions: true
  },
  revenue_leakage: {
    module_code: "revenue_leakage",
    module_name: MODULE_LABELS.revenue_leakage,
    module_version: "55.0.0",
    supports_standalone_reports: true,
    emits_metrics: true,
    emits_roadmap: true,
    emits_actions: true
  },
  data_foundation: {
    module_code: "data_foundation",
    module_name: MODULE_LABELS.data_foundation,
    module_version: "55.0.0",
    supports_standalone_reports: true,
    emits_metrics: true,
    emits_roadmap: true,
    emits_actions: true
  },
  ai_readiness: {
    module_code: "ai_readiness",
    module_name: MODULE_LABELS.ai_readiness,
    module_version: "55.0.0",
    supports_standalone_reports: true,
    emits_metrics: true,
    emits_roadmap: true,
    emits_actions: true
  },
  ai_use_cases: {
    module_code: "ai_use_cases",
    module_name: MODULE_LABELS.ai_use_cases,
    module_version: "55.0.0",
    supports_standalone_reports: true,
    emits_metrics: true,
    emits_roadmap: true,
    emits_actions: true
  }
};
