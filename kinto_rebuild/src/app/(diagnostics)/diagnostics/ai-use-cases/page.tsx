export const dynamic = 'force-dynamic';
import { AppFrame } from '@/components/layout/app-frame';
import { GenericQuestionModuleClient } from '@/components/diagnostics/shared/generic-question-module-client';
import { getWorkspaceSnapshot } from '@/lib/services/workspace';
import { resolvePageState } from '@/lib/page-state';
import { buildRoute } from '@/lib/routes';
import Link from 'next/link';

type PageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };
export default async function Page({ searchParams }: PageProps) {
  const state = await resolvePageState(searchParams);
  const view = state.view || 'assessment';
  const snapshot = await getWorkspaceSnapshot({ clientId: state.clientId, assessmentId: state.assessmentId });
  const cId = snapshot.client?.client_id;
  const aId = snapshot.assessment?.assessment_id;
  const tabs = [{ key: 'assessment', label: 'Assessment' },{ key: 'executive', label: 'Executive Dashboard' },{ key: 'metrics', label: 'Metrics' },{ key: 'advisory', label: 'Advisory' },{ key: 'report', label: 'Report Preview' }];
  return (
    <AppFrame pathname="/diagnostics/ai-use-cases" clientId={cId} assessmentId={aId} clients={snapshot.clients} assessments={snapshot.assessments}>
      <div className="page-header"><div><h1 className="page-title">AI Use Cases</h1><p className="page-subtitle">Use case prioritisation, feasibility scoring, and transformation sequencing</p></div></div>
      <div className="view-tabs">{tabs.map(t => <Link key={t.key} href={buildRoute('/diagnostics/ai-use-cases', { clientId: cId ?? null, assessmentId: aId ?? null, view: t.key })} className={`view-tab${view === t.key ? ' active' : ''}`}>{t.label}</Link>)}</div>
      <GenericQuestionModuleClient routePath="/api/ai-use-cases" assessmentId={aId} moduleLabel="AI Use Cases" moduleCode="AIUC" moduleIntro="Use case prioritisation, feasibility scoring, and transformation sequencing" view={view} />
    </AppFrame>
  );
}
