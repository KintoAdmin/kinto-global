// @ts-nocheck
export const dynamic = 'force-dynamic';

import { AppFrame } from '@/components/layout/app-frame';
import { ProfileClient } from '@/components/profile/profile-client';
import { resolvePageState } from '@/lib/page-state';
import { getUserProfile } from '@/lib/repositories/profile';
import { getWorkspaceSnapshot } from '@/lib/services/workspace';

type PageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function ProfilePage({ searchParams }: PageProps) {
  const state = await resolvePageState(searchParams);
  const snapshot = await getWorkspaceSnapshot({ clientId: state.clientId, assessmentId: state.assessmentId });
  const profile = await getUserProfile();
  const cId = snapshot.client?.client_id;
  const aId = snapshot.assessment?.assessment_id;

  return (
    <AppFrame pathname="/profile" clientId={cId} assessmentId={aId} clients={snapshot.clients} assessments={snapshot.assessments}>
      <div className="page-header"><div><h1 className="page-title">Profile</h1><p className="page-subtitle">Your user profile and onboarding settings</p></div></div>
      <ProfileClient profile={profile} />
    </AppFrame>
  );
}
