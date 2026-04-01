import { jsonError, jsonOk } from "@/lib/api/http";
import { buildAssessmentReport, buildStandaloneModuleReport, getFreshPersistedReport } from "@/lib/services/report";
import { LEGACY_TO_INTEROP_MODULE, type LegacyModuleCode, type ModuleCode } from "@/lib/interoperability/enums";

function normalizeModuleCode(value?: string | null): ModuleCode | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (raw in LEGACY_TO_INTEROP_MODULE) return LEGACY_TO_INTEROP_MODULE[raw as LegacyModuleCode];
  return raw as ModuleCode;
}

export async function GET(request: Request, context: { params: Promise<{ assessmentId: string }> }) {
  try {
    const { assessmentId } = await context.params;
    const { searchParams } = new URL(request.url);
    const moduleCode = normalizeModuleCode(searchParams.get('module'));
    return jsonOk(await getFreshPersistedReport(assessmentId, moduleCode));
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ assessmentId: string }> }) {
  try {
    const { assessmentId } = await context.params;
    const { searchParams } = new URL(request.url);
    const moduleCode = normalizeModuleCode(searchParams.get('module'));
    const report = moduleCode
      ? await buildStandaloneModuleReport(assessmentId, moduleCode)
      : await buildAssessmentReport(assessmentId);
    return jsonOk(report);
  } catch (error) {
    return jsonError(error);
  }
}
