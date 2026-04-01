// @ts-nocheck
import { jsonError, jsonOk } from "@/lib/api/http";
import { buildStandaloneModuleReport, getFreshPersistedReport } from "@/lib/services/report";
import { LEGACY_TO_INTEROP_MODULE, type LegacyModuleCode, type ModuleCode } from "@/lib/interoperability/enums";

function normalizeModuleCode(value: string): ModuleCode {
  if (value in LEGACY_TO_INTEROP_MODULE) return LEGACY_TO_INTEROP_MODULE[value as LegacyModuleCode];
  return value as ModuleCode;
}

export async function GET(_: Request, context: { params: Promise<{ assessmentId: string; moduleCode: string }> }) {
  try {
    const { assessmentId, moduleCode } = await context.params;
    const normalized = normalizeModuleCode(moduleCode);
    return jsonOk(await getFreshPersistedReport(assessmentId, normalized));
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(_: Request, context: { params: Promise<{ assessmentId: string; moduleCode: string }> }) {
  try {
    const { assessmentId, moduleCode } = await context.params;
    return jsonOk(await buildStandaloneModuleReport(assessmentId, normalizeModuleCode(moduleCode)));
  } catch (error) {
    return jsonError(error);
  }
}
