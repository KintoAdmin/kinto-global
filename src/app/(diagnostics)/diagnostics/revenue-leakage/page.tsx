export const dynamic = 'force-dynamic';
import { AppFrame } from '@/components/layout/app-frame';
import { RevenueLeakageWorkspaceClient } from '@/components/diagnostics/revenue-leakage/workspace-client';
import { getWorkspaceSnapshot } from '@/lib/services/workspace';
import { resolvePageState } from '@/lib/page-state';
import { buildRoute } from '@/lib/routes';
import Link from 'next/link';

type PageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };
export default async function Page({ searchParams }: PageProps) {
  const state = await resolvePageState(searchParams);
  const view = (state.view as any) || 'assessment';
  const snapshot = await getWorkspaceSnapshot({ clientId: state.clientId, assessmentId: state.assessmentId });
  const cId = snapshot.client?.client_id;
  const aId = snapshot.assessment?.assessment_id;
  const tabs = [
    { key: 'assessment', label: 'Assessment' },
    { key: 'executive', label: 'Executive Dashboard' },
    { key: 'metrics', label: 'Metrics' },
    { key: 'report', label: 'Report Preview' },
    { key: 'advisory', label: 'Advisory' },
  ];
  return (
    <AppFrame pathname="/diagnostics/revenue-leakage" clientId={cId} assessmentId={aId} clients={snapshot.clients} assessments={snapshot.assessments}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Revenue Leakage</h1>
          <p className="page-subtitle">Quantify and diagnose commercial revenue losses across pipeline, conversion, billing, retention, and collections</p>
        </div>
      </div>
      <div className="view-tabs">
        {tabs.map(t => (
          <Link key={t.key} href={buildRoute('/diagnostics/revenue-leakage', { clientId: cId ?? null, assessmentId: aId ?? null, view: t.key })} className={`view-tab${view === t.key ? ' active' : ''}`}>{t.label}</Link>
        ))}
      </div>
      <RevenueLeakageWorkspaceClient assessmentId={aId} view={view} />
    </AppFrame>
  );
}
