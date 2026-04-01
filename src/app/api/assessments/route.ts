// @ts-nocheck
import { jsonError, jsonOk, parseJson } from "@/lib/api/http";
import { assessmentCreateSchema } from "@/lib/api/schemas";
import { createAssessment, listAssessments } from "@/lib/repositories/assessments";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId") || undefined;
    return jsonOk(await listAssessments(clientId));
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = assessmentCreateSchema.parse(await parseJson(request));
    const assessment = await createAssessment(payload);
    return jsonOk(assessment, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
