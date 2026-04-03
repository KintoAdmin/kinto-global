// @ts-nocheck
import { jsonError, jsonOk, parseJson } from '@/lib/api/http';
import { getLatestAssessment } from '@/lib/repositories/assessments';
import { getBusinessReadinessPayload, initializeBusinessReadiness, computeAndPersistBusinessReadiness } from '@/lib/services/business-readiness';

async function resolveAssessmentId(input?: string | null) {
  if (input) return input;
  const latest = await getLatestAssessment();
  if (!latest?.assessment_id) throw new Error('No assessment found. Create a client and assessment first.');
  return latest.assessment_id as string;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const assessmentId = await resolveAssessmentId(searchParams.get('assessmentId'));
    const payload = await getBusinessReadinessPayload(assessmentId, {
      businessTypeCode: searchParams.get('previewBusinessTypeCode'),
      regionCode: searchParams.get('previewRegionCode'),
      employerIntent: searchParams.get('previewEmployerIntent') ? searchParams.get('previewEmployerIntent') === 'true' : undefined,
    });
    return jsonOk(payload);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await parseJson<any>(request);
    const assessmentId = await resolveAssessmentId(body.assessmentId);
    if (body.action === 'initialize') {
      const payload = await initializeBusinessReadiness({
        assessmentId,
        businessTypeCode: body.businessTypeCode,
        primaryRegionCode: body.primaryRegionCode,
        subRegionCode: body.subRegionCode,
        businessName: body.businessName,
        founderName: body.founderName,
        businessDescription: body.businessDescription,
        targetCustomer: body.targetCustomer,
        revenueModel: body.revenueModel,
        operatingChannel: body.operatingChannel,
        whatYouSell: body.whatYouSell,
        hiringStaff: body.hiringStaff,
      });
      return jsonOk(payload);
    }
    if (body.action === 'refresh') {
      await computeAndPersistBusinessReadiness(assessmentId);
      return jsonOk(await getBusinessReadinessPayload(assessmentId));
    }
    throw new Error(`Unsupported Business Readiness action: ${body.action}`);
  } catch (error) {
    return jsonError(error);
  }
}
