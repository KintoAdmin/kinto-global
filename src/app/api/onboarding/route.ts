// @ts-nocheck
import { jsonError, jsonOk, parseJson } from '@/lib/api/http';
import { onboardingSetupSchema } from '@/lib/api/schemas';
import { createAssessment } from '@/lib/repositories/assessments';
import { upsertClient } from '@/lib/repositories/clients';
import { getUserProfile, upsertUserProfile } from '@/lib/repositories/profile';

export async function GET() {
  try {
    const profile = await getUserProfile();
    return jsonOk({ onboardingCompleted: Boolean(profile?.onboardingCompleted), profile });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = onboardingSetupSchema.parse(await parseJson(request));

    await upsertUserProfile({
      fullName: payload.fullName,
      workspaceName: payload.workspaceName || payload.organizationName,
      operatingMode: payload.mode,
      jobTitle: payload.jobTitle,
      phone: payload.phone,
      onboardingCompleted: true,
    });

    const client = await upsertClient({
      clientName: payload.organizationName,
      industry: payload.industry,
      companySize: payload.companySize,
      websiteUrl: payload.websiteUrl,
      country: payload.country,
      primaryContactName: payload.primaryContactName || payload.fullName,
      primaryContactEmail: payload.primaryContactEmail,
      servicesSummary: payload.servicesSummary,
      notes: payload.mode === 'consultant'
        ? `Created during consultant onboarding for workspace: ${payload.workspaceName || ''}`
        : 'Created during organisation onboarding.',
    });

    const assessment = await createAssessment({
      clientId: client.client_id,
      assessmentName: payload.assessmentName,
      scopeType: 'enterprise',
      scopeLabel: 'Initial onboarding scope',
      assessmentObjective: payload.assessmentObjective,
      priorityOutcomes: payload.priorityOutcomes,
      painPoints: payload.painPoints,
      departmentsInScope: payload.departmentsInScope,
      systemsInScope: payload.systemsInScope,
      locationsInScope: payload.locationsInScope,
    });

    return jsonOk({ client, assessment }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
