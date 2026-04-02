// @ts-nocheck
import { jsonError, jsonOk, parseJson } from '@/lib/api/http';
import { addBusinessReadinessEvidence, setBusinessReadinessEvidenceReview } from '@/lib/services/business-readiness';

export async function POST(request: Request) {
  try {
    const body = await parseJson<any>(request);
    if (body.action === 'review') {
      if (!body.assessmentId) throw new Error('assessmentId is required.');
      if (!body.evidenceId) throw new Error('evidenceId is required.');
      if (!body.reviewStatus) throw new Error('reviewStatus is required.');
      const payload = await setBusinessReadinessEvidenceReview({
        assessmentId: body.assessmentId,
        evidenceId: body.evidenceId,
        reviewStatus: body.reviewStatus,
      });
      return jsonOk(payload);
    }
    if (!body.assessmentId) throw new Error('assessmentId is required.');
    if (!body.taskInstanceId) throw new Error('taskInstanceId is required.');
    const payload = await addBusinessReadinessEvidence({
      assessmentId: body.assessmentId,
      taskInstanceId: body.taskInstanceId,
      noteText: body.noteText,
      externalLink: body.externalLink,
      evidenceType: body.evidenceType,
      replaceExisting: Boolean(body.replaceExisting),
    });
    return jsonOk(payload);
  } catch (error) {
    return jsonError(error);
  }
}
