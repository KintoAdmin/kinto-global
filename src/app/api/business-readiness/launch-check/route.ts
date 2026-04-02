// @ts-nocheck
import { jsonError, jsonOk, parseJson } from '@/lib/api/http';
import { runBusinessReadinessLaunchCheck } from '@/lib/services/business-readiness';

export async function POST(request: Request) {
  try {
    const body = await parseJson<any>(request);
    if (!body.assessmentId) throw new Error('assessmentId is required.');
    const payload = await runBusinessReadinessLaunchCheck(body.assessmentId);
    return jsonOk(payload);
  } catch (error) {
    return jsonError(error);
  }
}
