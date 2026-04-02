// @ts-nocheck
export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { AppFrame } from '@/components/layout/app-frame';
import { resolvePageState } from '@/lib/page-state';
import { getWorkspaceSnapshot } from '@/lib/services/workspace';
import { buildRoute } from '@/lib/routes';
import { BusinessReadinessClient } from '@/components/business-readiness/business-readiness-client';

type PageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function BusinessReadinessPage({ searchParams }: PageProps) {
  const state = await resolvePageState(searchParams);
  const view = state.view || 'overview';
  const snapshot = await getWorkspaceSnapshot({ clientId: state.clientId, assessmentId: state.assessmentId });
  const cId = snapshot.client?.client_id;
  const aId = snapshot.assessment?.assessment_id;
  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'phases', label: 'Phases' },
    { key: 'tasks', label: 'Tasks' },
    { key: 'blockers', label: 'Blockers' },
  ];

  return (
    <AppFrame pathname="/readiness/business-readiness" clientId={cId} assessmentId={aId} clients={snapshot.clients} assessments={snapshot.assessments}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Business Readiness</h1>
          <p className="page-subtitle">Guided business setup inside Kinto — step by step, beginner-friendly, and built to feed the wider transformation roadmap without losing its own structure.</p>
        </div>
      </div>
      <div className="view-tabs">
        {tabs.map((tab) => (
          <Link key={tab.key} href={buildRoute('/readiness/business-readiness', { clientId: cId ?? null, assessmentId: aId ?? null, view: tab.key })} className={`view-tab${view === tab.key ? ' active' : ''}`}>
            {tab.label}
          </Link>
        ))}
      </div>
      <BusinessReadinessClient assessmentId={aId} view={view} />
    </AppFrame>
  );
}
