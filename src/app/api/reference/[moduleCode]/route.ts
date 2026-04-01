import { jsonError, jsonOk } from "@/lib/api/http";
import { getReferenceBundle } from "@/lib/reference/bundle";
import { normalizeModuleCode } from "@/lib/constants/modules";

export async function GET(_: Request, context: { params: Promise<{ moduleCode: string }> }) {
  try {
    const { moduleCode } = await context.params;
    const normalized = normalizeModuleCode(moduleCode);
    const bundle = await getReferenceBundle(normalized);
    return jsonOk(bundle);
  } catch (error) {
    return jsonError(error, 404);
  }
}
