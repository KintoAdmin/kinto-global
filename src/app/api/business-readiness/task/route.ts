// @ts-nocheck
import { jsonError, jsonOk, parseJson } from '@/lib/api/http';
import { setBusinessReadinessTaskStatus } from '@/lib/services/business-readiness';

export async function POST(request: Request) {
  try {
    const body = await parseJson<any>(request);
    if (!body.assessmentId) throw new Error('assessmentId is required.');
    if (!body.taskInstanceId) throw new Error('taskInstanceId is required.');
    if (!body.status) throw new Error('status is required.');
    const payload = await setBusinessReadinessTaskStatus({
      assessmentId: body.assessmentId,
      taskInstanceId: body.taskInstanceId,
      status: body.status,
      notes: body.notes,
    });
    return jsonOk(payload);
  } catch (error) {
    return jsonError(error);
  }
}
