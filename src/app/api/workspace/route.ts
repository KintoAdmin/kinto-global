// @ts-nocheck
import { jsonError, jsonOk } from "@/lib/api/http";
import { getWorkspaceSnapshot } from "@/lib/services/workspace";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId") || undefined;
    const assessmentId = searchParams.get("assessmentId") || undefined;
    const snapshot = await getWorkspaceSnapshot({ clientId, assessmentId });
    return jsonOk(snapshot);
  } catch (error) {
    return jsonError(error);
  }
}
