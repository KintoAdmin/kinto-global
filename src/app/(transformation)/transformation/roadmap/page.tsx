// @ts-nocheck
export const dynamic = 'force-dynamic';
import { AppFrame } from '@/components/layout/app-frame';
import { RoadmapClient } from '@/components/transformation/roadmap-client';
import { RoadmapActions } from '@/components/transformation/roadmap-actions';
import { getWorkspaceSnapshot } from '@/lib/services/workspace';
import { resolvePageState } from '@/lib/page-state';
import { listModuleRoadmap } from '@/lib/repositories/runtime';

type PageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function RoadmapPage({ searchParams }: PageProps) {
  const state    = await resolvePageState(searchParams);
  const snapshot = await getWorkspaceSnapshot({ clientId: state.clientId, assessmentId: state.assessmentId });
  const aId      = snapshot.assessment?.assessment_id;
  const cId      = snapshot.client?.client_id;

  // Load existing roadmap items — do NOT auto-generate here (that blocks page load)
  // User triggers generation explicitly via the Generate button
  let items: any[] = [];
  if (aId) {
    try { items = await listModuleRoadmap(aId, 'ROADMAP'); } catch { items = []; }
  }

  const modules = (snapshot.modules ?? []).filter((m: any) => m.module_code !== 'ROADMAP');
  const moduleScores = modules.map((m: any) => ({
    module_code:    String(m.module_code || ''),
    module_name:    String(m.module_name || m.module_code || ''),
    score_pct:      Number(m.score_pct || 0),
    completion_pct: Number(m.completion_pct || 0),
  }));

  const normItems = items.map((row: any) => ({
    roadmap_fact_id:        String(row.roadmap_fact_id     || row.roadmap_instance_id || ''),
    roadmap_instance_id:    String(row.roadmap_instance_id || row.roadmap_fact_id     || ''),
    initiative_title:       String(row.initiative_title    || row.milestone_name      || 'Roadmap Action'),
    initiative_description: String(row.initiative_description || row.milestone_description || ''),
    phase_code:             String(row.phase_code          || 'P2'),
    phase_name:             String(row.phase_name          || ''),
    owner_role:             String(row.owner_role          || ''),
    business_outcome:       String(row.business_outcome    || ''),
    review_frequency:       String(row.review_frequency    || ''),
    source_module_id:       String(row.source_module_id    || row.module_id           || ''),
    module_code:            String(row.module_code         || ''),
    status:                 String(row.status              || row.execution_status    || 'NOT_STARTED'),
    progress_pct:           Number(row.progress_pct        || 0),
    execution_notes:        String(row.execution_notes     || ''),
    last_reviewed_at:       row.last_reviewed_at ? String(row.last_reviewed_at) : undefined,
    priority_rank:          Number(row.priority_rank       || 0),
    automation_opportunity: String(row.automation_opportunity || row.automation_flag  || ''),
  }));

  const totalActions  = normItems.length;
  const completeCount = normItems.filter(r => String(r.status).toUpperCase() === 'COMPLETE').length;
  const overallPct    = totalActions > 0 ? Math.round((completeCount / totalActions) * 100) : 0;

  // Count modules that have been scored — used to know if generation is possible
  const scoredModules = moduleScores.filter(m => m.completion_pct > 0 || m.score_pct > 0).length;

  return (
    <AppFrame pathname="/transformation/roadmap" clientId={cId} assessmentId={aId}
      clients={snapshot.clients} assessments={snapshot.assessments}>

      <div className="page-header">
        <div>
          <h1 className="page-title">Transformation Roadmap</h1>
          <p className="page-subtitle">
            {snapshot.client?.client_name ?? 'No client'}
            {snapshot.assessment?.assessment_name ? ` · ${snapshot.assessment.assessment_name}` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {totalActions > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div className="progress-bar-shell" style={{ width: 100, height: 10 }}>
                <div className="progress-bar-fill" style={{ width: `${overallPct}%` }} />
              </div>
              <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{overallPct}%</span>
            </div>
          )}
          {aId && (
            <RoadmapActions
              assessmentId={aId}
              hasItems={totalActions > 0}
              scoredModules={scoredModules}
              clientId={cId}
            />
          )}
        </div>
      </div>

      {aId ? (
        <RoadmapClient assessmentId={aId} initialItems={normItems} moduleScores={moduleScores} />
      ) : (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">🗺️</div>
            <p className="empty-state-title">No assessment selected</p>
            <p className="empty-state-sub">Select a client and assessment from the workspace bar.</p>
          </div>
        </div>
      )}
    </AppFrame>
  );
}
