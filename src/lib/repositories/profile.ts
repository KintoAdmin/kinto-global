import { getAdminClient } from '@/lib/supabase/admin';
import { getAuthUser, getAuthUserId } from '@/lib/supabase/server';
import { nowIso } from '@/lib/utils/ids';
import type { UserProfileInput } from '@/lib/types/domain';

export async function getUserProfile() {
  const supabase = getAdminClient();
  const user = await getAuthUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;

  return {
    userId: user.id,
    email: user.email || '',
    fullName: data?.full_name || user.user_metadata?.full_name || '',
    workspaceName: data?.workspace_name || '',
    operatingMode: data?.operating_mode || '',
    jobTitle: data?.job_title || '',
    phone: data?.phone || '',
    onboardingCompleted: Boolean(data?.onboarding_completed),
    onboardingCompletedAt: data?.onboarding_completed_at || null,
    createdAt: data?.created_at || null,
    updatedAt: data?.updated_at || null,
  };
}

export async function upsertUserProfile(input: UserProfileInput) {
  const supabase = getAdminClient();
  const userId = await getAuthUserId();
  if (!userId) throw new Error('Not authenticated.');

  const payload: Record<string, unknown> = {
    user_id: userId,
    full_name: input.fullName || '',
    workspace_name: input.workspaceName || '',
    operating_mode: input.operatingMode || null,
    job_title: input.jobTitle || '',
    phone: input.phone || '',
    updated_at: nowIso(),
  };

  if (typeof input.onboardingCompleted === 'boolean') {
    payload.onboarding_completed = input.onboardingCompleted;
    payload.onboarding_completed_at = input.onboardingCompleted ? nowIso() : null;
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .upsert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}
