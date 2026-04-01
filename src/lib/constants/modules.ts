// @ts-nocheck
export type ModuleCode = "OPS" | "LEAK" | "DATA" | "AIR" | "AIUC" | "ROADMAP";

export type ModuleRouteKey = "ops" | "leak" | "data" | "air" | "aiuc" | "roadmap";

export const MODULE_REGISTRY = [
  { module_id: "MOD-OPS", module_code: "OPS", module_name: "Operational Audit", display_order: 1, is_active: true },
  { module_id: "MOD-LEAK", module_code: "LEAK", module_name: "Revenue Leakage", display_order: 2, is_active: true },
  { module_id: "MOD-DATA", module_code: "DATA", module_name: "Data Foundation", display_order: 3, is_active: true },
  { module_id: "MOD-AIR", module_code: "AIR", module_name: "AI Readiness", display_order: 4, is_active: true },
  { module_id: "MOD-AIUC", module_code: "AIUC", module_name: "AI Use Case Prioritisation", display_order: 5, is_active: true },
  { module_id: "MOD-ROADMAP", module_code: "ROADMAP", module_name: "Combined Transformation Roadmap", display_order: 6, is_active: true }
] as const;

export const MODULE_BY_CODE: Record<ModuleCode, (typeof MODULE_REGISTRY)[number]> = {
  OPS: MODULE_REGISTRY[0],
  LEAK: MODULE_REGISTRY[1],
  DATA: MODULE_REGISTRY[2],
  AIR: MODULE_REGISTRY[3],
  AIUC: MODULE_REGISTRY[4],
  ROADMAP: MODULE_REGISTRY[5]
};

export const MODULE_CODE_BY_ROUTE: Record<ModuleRouteKey, ModuleCode> = {
  ops: "OPS",
  leak: "LEAK",
  data: "DATA",
  air: "AIR",
  aiuc: "AIUC",
  roadmap: "ROADMAP"
};

export const ROUTE_BY_MODULE_CODE: Record<ModuleCode, ModuleRouteKey> = {
  OPS: "ops",
  LEAK: "leak",
  DATA: "data",
  AIR: "air",
  AIUC: "aiuc",
  ROADMAP: "roadmap"
};

export const PHASE_NAME_BY_CODE: Record<string, string> = {
  P1: "Stabilise and Protect",
  P2: "Standardise and Strengthen",
  P3: "Optimize, Automate, and AI-Enable"
};

export function normalizeModuleCode(input: string): ModuleCode {
  const value = String(input || "").trim().toUpperCase();
  if (value in MODULE_BY_CODE) return value as ModuleCode;

  const routeKey = String(input || "").trim().toLowerCase();
  if (routeKey in MODULE_CODE_BY_ROUTE) {
    return MODULE_CODE_BY_ROUTE[routeKey as ModuleRouteKey];
  }

  throw new Error(`Unsupported module code: ${input}`);
}

export function moduleIdFromCode(moduleCode: ModuleCode): string {
  return MODULE_BY_CODE[moduleCode].module_id;
}
