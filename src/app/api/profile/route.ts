// @ts-nocheck
import { jsonError, jsonOk, parseJson } from '@/lib/api/http';
import { userProfileSchema } from '@/lib/api/schemas';
import { getUserProfile, upsertUserProfile } from '@/lib/repositories/profile';

export async function GET() {
  try {
    return jsonOk(await getUserProfile());
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = userProfileSchema.parse(await parseJson(request));
    return jsonOk(await upsertUserProfile(payload));
  } catch (error) {
    return jsonError(error);
  }
}
