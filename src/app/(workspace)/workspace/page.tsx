export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { AppFrame } from '@/components/layout/app-frame';
import { ModuleSummaryCards } from '@/components/shared/module-summary-cards';
import { getWorkspaceSnapshot } from '@/lib/services/workspace';
import { resolvePageState } from '@/lib/page-state';
import { buildIntegratedLayerReadiness } from '@/lib/services/integrated-layer';
import { getFreshPersistedReport } from '@/lib/services/report';
import { buildRoute } from '@/lib/routes';
import { ModuleExplainRow } from '@/components/assistant/module-explain-row';
import { GettingStarted } from '@/components/onboarding/getting-started';

type PageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

function fmt(v?: number | null) {
  return `${Math.round(Number(v || 0))}%`;
}

function statusBadge(status?: string | null) {
  const s = String(status || 'NOT_STARTED').toUpperCase();
  if (s === 'COMPLETE') return { label: 'Complete', cls: 'badge-success' };
  if (s === 'IN_PROGRESS') return { label: 'In Progress', cls: 'badge-info' };
  return { label: 'Not Started', cls: 'badge-muted' };
}

function bandBadge(pct: number) {
  if (pct <= 0) return { label: 'Not scored', cls: 'badge-muted' };
  if (pct < 40) return { label: 'Critical / Weak', cls: 'badge-danger' };
  if (pct < 65) return { label: 'Developing', cls: 'badge-warn' };
  return { label: 'Strong / Managed', cls: 'badge-success' };
}

function phaseLabel(p: string) {
  if (String(p).toLowerCase().includes('1') || String(p).toLowerCase().includes('design')) return 'phase-1-pill';
  if (String(p).toLowerCase().includes('2') || String(p).toLowerCase().includes('exec')) return 'phase-2-pill';
  return 'phase-3-pill';
}

export default async function WorkspacePage({ searchParams }: PageProps) {
  const state = await resolvePageState(searchParams);
  const view = state.view || 'overview';
  const snapshot = await getWorkspaceSnapshot({
    clientId: state.clientId,
    assessmentId: state.assessmentId,
  });

  const assessmentSnapshot = snapshot.assessmentSnapshot as any;
  const moduleCards = (
    Array.isArray(assessmentSnapshot?.module_cards_payload) &&
    assessmentSnapshot.module_cards_payload.length
      ? assessmentSnapshot.module_cards_payload
      : snapshot.modules
  ) as any[];

  const summaryPayload = assessmentSnapshot?.summary_payload || {};
  const combinedRoadmap: any[] = Array.isArray(assessmentSnapshot?.roadmap_payload)
    ? assessmentSnapshot.roadmap_payload
    : [];

  const freshReport =
    view === 'report' && snapshot.assessment?.assessment_id
      ? await getFreshPersistedReport(snapshot.assessment.assessment_id).catch(() => null)
      : null;

  const reportPayload = (freshReport?.payload ?? null) as any;

  const diagModules = moduleCards.filter((m: any) => m.module_code !== 'ROADMAP');
  const completedModules = diagModules.filter(
    (m: any) => String(m.module_status || '').toUpperCase() === 'COMPLETE'
  ).length;

  const avgCompletion = diagModules.length
    ? diagModules.reduce((s: number, m: any) => s + Number(m.completion_pct || 0), 0) /
      diagModules.length
    : 0;

  const scoredModules = diagModules.filter((m: any) => Number(m.score_pct || 0) > 0);

  const avgScore = scoredModules.length
    ? scoredModules.reduce((s: number, m: any) => s + Number(m.score_pct || 0), 0) /
      scoredModules.length
    : 0;

  const criticalFindings = Number(summaryPayload.critical_findings || 0);
  const roadmapItems = Number(summaryPayload.roadmap_items || combinedRoadmap.length || 0);
  const readiness = buildIntegratedLayerReadiness(snapshot.reports || []);

  const hasClient = Boolean(snapshot.client?.client_id);
  const hasAssessment = Boolean(snapshot.assessment?.assessment_id);
  const hasScoredModules = scoredModules.length > 0;
  const hasRoadmap = combinedRoadmap.length > 0;

  const phaseCounts = combinedRoadmap.reduce(
    (acc: Record<string, number>, row: any) => {
      const key = row.phase_name || row.phase_code || 'Unassigned';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const orderedPlan = [...combinedRoadmap].sort((a: any, b: any) => {
    const phaseW = (v: string) => (v?.startsWith('P1') ? 1 : v?.startsWith('P2') ? 2 : 3);
    return (
      phaseW(a.phase_code) - phaseW(b.phase_code) ||
      Number(a.priority_effective || 999) - Number(b.priority_effective || 999)
    );
  });

  const immediateActions = orderedPlan.filter((r: any) => r.phase_code === 'P1').slice(0, 5);
  const nearTermActions = orderedPlan.filter((r: any) => r.phase_code === 'P2').slice(0, 4);
  const hasOrderedPlan = immediateActions.length > 0 || nearTermActions.length > 0;

  const scoredModulesCodes = scoredModules.map((m: any) => m.module_code);
  const isSingleModule = scoredModulesCodes.length === 1;
  const engagementLabel = isSingleModule
    ? scoredModules[0]?.module_name || 'Module Assessment'
    : 'Business Improvement Programme';

  const aId = snapshot.assessment?.assessment_id;
  const cId = snapshot.client?.client_id;

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'executive', label: 'Executive Dashboard' },
    { key: 'report', label: 'Report Preview' },
  ];

  return (
    <AppFrame
      pathname="/workspace"
      clientId={cId}
      assessmentId={aId}
      clients={snapshot.clients}
      assessments={snapshot.assessments}
    >
      <div className="page-header">
        <div>
          <h1 className="page-title">Workspace</h1>
          <p className="page-subtitle">
            {snapshot.client?.client_name ?? 'No client selected'}
            {snapshot.assessment?.assessment_name ? ` · ${snapshot.assessment.assessment_name}` : ''}
          </p>
        </div>
        {snapshot.assessment && (
          <span className={`badge ${statusBadge(snapshot.assessment.status).cls}`}>
            {statusBadge(snapshot.assessment.status).label}
          </span>
        )}
      </div>

      <div className="view-tabs">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={buildRoute('/workspace', {
              clientId: cId ?? null,
              assessmentId: aId ?? null,
              view: t.key,
            })}
            className={`view-tab${view === t.key ? ' active' : ''}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <ModuleSummaryCards assessmentId={aId} clientId={cId} />

      <GettingStarted
        hasClient={hasClient}
        hasAssessment={hasAssessment}
        hasScoredModules={hasScoredModules}
        hasRoadmap={hasRoadmap}
        clientName={snapshot.client?.client_name}
      />

      {view === 'overview' && (
        <>
          <div className="grid-5">
            {[
              {
                label: 'Modules Complete',
                value: `${completedModules}/${diagModules.length}`,
                sub: 'Standalone modules',
              },
              { label: 'Avg Completion', value: fmt(avgCompletion), sub: 'Across all modules' },
              {
                label: 'Portfolio Score',
                value: avgScore > 0 ? fmt(avgScore) : '—',
                sub: 'Scored modules only',
              },
              { label: 'Critical Findings', value: String(criticalFindings), sub: 'Scores 1–2' },
              { label: 'Roadmap Actions', value: String(roadmapItems), sub: 'Combined roadmap' },
            ].map((kpi) => (
              <div key={kpi.label} className="stat-card stat-card-accent">
                <div className="stat-card-label">{kpi.label}</div>
                <div className="stat-card-value">{kpi.value}</div>
                <div className="stat-card-sub">{kpi.sub}</div>
              </div>
            ))}
          </div>

          {hasOrderedPlan && (
            <div className="card" style={{ borderLeft: '3px solid var(--teal)' }}>
              <div className="card-header">
                <div>
                  <h3 className="card-title">
                    {isSingleModule
                      ? `${engagementLabel} — Priority Action Plan`
                      : 'Business Priority Action Plan'}
                  </h3>
                  <p className="card-subtitle">
                    {isSingleModule
                      ? 'This is a complete advisory engagement. The actions below are the full priority sequence for this module.'
                      : `Sequenced across ${scoredModulesCodes.length} modules — immediate actions first, then near-term, then optimisation.`}
                  </p>
                </div>
                {aId && (
                  <a
                    href={buildRoute('/transformation/roadmap', {
                      clientId: cId ?? null,
                      assessmentId: aId ?? null,
                    })}
                    className="btn btn-sm btn-primary"
                  >
                    Full Roadmap →
                  </a>
                )}
              </div>

              {immediateActions.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <div
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: 'var(--danger)',
                      marginBottom: '0.5rem',
                    }}
                  >
                    Do First — Phase 1 ({immediateActions.length} action
                    {immediateActions.length !== 1 ? 's' : ''})
                  </div>
                  <ol
                    style={{
                      listStyle: 'none',
                      padding: 0,
                      margin: 0,
                      display: 'grid',
                      gap: '0.5rem',
                    }}
                  >
                    {immediateActions.map((item: any, i: number) => (
                      <li
                        key={item.roadmap_instance_id || i}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1.5rem 1fr auto',
                          gap: '0.6rem',
                          alignItems: 'start',
                          padding: '0.6rem 0.75rem',
                          background: 'var(--surface)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--line)',
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 800,
                            fontSize: '0.85rem',
                            color: 'var(--danger)',
                            marginTop: '0.1rem',
                          }}
                        >
                          {i + 1}
                        </span>
                        <div>
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: '0.875rem',
                              color: 'var(--text)',
                            }}
                          >
                            {item.initiative_title}
                          </div>
                          {item.owner_role && (
                            <div
                              style={{
                                fontSize: '0.72rem',
                                color: 'var(--muted)',
                                marginTop: '0.15rem',
                              }}
                            >
                              Owner: {item.owner_role}
                            </div>
                          )}
                          {item.dependency_summary && (
                            <div
                              style={{
                                fontSize: '0.68rem',
                                color: 'var(--warn)',
                                marginTop: '0.15rem',
                              }}
                            >
                              ⚠ {item.dependency_summary}
                            </div>
                          )}
                        </div>
                        <span
                          className="roadmap-phase-pill phase-1-pill"
                          style={{
                            fontSize: '0.65rem',
                            padding: '0.1rem 0.4rem',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          P1
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {nearTermActions.length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: 'var(--warn)',
                      marginBottom: '0.5rem',
                    }}
                  >
                    Do Next — Phase 2 ({nearTermActions.length} action
                    {nearTermActions.length !== 1 ? 's' : ''})
                  </div>
                  <ol
                    style={{
                      listStyle: 'none',
                      padding: 0,
                      margin: 0,
                      display: 'grid',
                      gap: '0.4rem',
                    }}
                  >
                    {nearTermActions.map((item: any, i: number) => (
                      <li
                        key={item.roadmap_instance_id || i}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1.5rem 1fr auto',
                          gap: '0.6rem',
                          alignItems: 'start',
                          padding: '0.5rem 0.75rem',
                          background: 'var(--surface)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--line)',
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 800,
                            fontSize: '0.85rem',
                            color: 'var(--warn)',
                            marginTop: '0.1rem',
                          }}
                        >
                          {immediateActions.length + i + 1}
                        </span>
                        <div>
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: '0.875rem',
                              color: 'var(--text)',
                            }}
                          >
                            {item.initiative_title}
                          </div>
                          {item.owner_role && (
                            <div
                              style={{
                                fontSize: '0.72rem',
                                color: 'var(--muted)',
                                marginTop: '0.15rem',
                              }}
                            >
                              Owner: {item.owner_role}
                            </div>
                          )}
                        </div>
                        <span
                          className="roadmap-phase-pill phase-2-pill"
                          style={{
                            fontSize: '0.65rem',
                            padding: '0.1rem 0.4rem',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          P2
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {!hasOrderedPlan && (
                <div className="empty-state">
                  <p className="empty-state-title">Generate roadmap to see ordered plan</p>
                  <p className="empty-state-sub">
                    Complete module scoring and generate the transformation roadmap to populate
                    this view.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="grid-2">
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">Module Portfolio</h3>
                  <p className="card-subtitle">Assessment coverage and maturity by module</p>
                </div>
              </div>
              <div className="table-scroll">
                <table className="kinto-table">
                  <thead>
                    <tr>
                      <th>Module</th>
                      <th>Completion</th>
                      <th>Score</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {diagModules.map((m: any) => {
                      const sb = statusBadge(m.module_status);
                      const bb = bandBadge(Number(m.score_pct || 0));
                      return (
                        <tr key={m.module_id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{m.module_name}</div>
                            <div className="text-xs muted-2">{m.module_code}</div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{ flex: 1 }}>
                                <div className="progress-bar-shell" style={{ height: 6 }}>
                                  <div
                                    className="progress-bar-fill"
                                    style={{ width: `${Number(m.completion_pct || 0)}%` }}
                                  />
                                </div>
                              </div>
                              <span
                                className="text-xs"
                                style={{
                                  fontWeight: 600,
                                  minWidth: 36,
                                  textAlign: 'right',
                                }}
                              >
                                {fmt(m.completion_pct)}
                              </span>
                            </div>
                          </td>
                          <td>
                            {Number(m.score_pct || 0) > 0 ? (
                              <span
                                className={`score-band ${bb.cls
                                  .replace('badge-', 'score-band-')
                                  .replace('success', 'strong')
                                  .replace('warn', 'developing')
                                  .replace('danger', 'critical')
                                  .replace('muted', 'unscored')}`}
                              >
                                {fmt(m.score_pct)}
                              </span>
                            ) : (
                              <span className="text-xs muted-2">Not scored</span>
                            )}
                          </td>
                          <td>
                            <span className={`badge ${sb.cls}`}>{sb.label}</span>
                          </td>
                          <td>
                            {Number(m.score_pct || 0) > 0 && (
                              <ModuleExplainRow
                                moduleName={m.module_name}
                                modulePct={Number(m.score_pct || 0)}
                                maturityBand={String(m.maturity_band || bb.label)}
                              />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">Transformation Roadmap</h3>
                  <p className="card-subtitle">Combined roadmap action distribution</p>
                </div>
                {roadmapItems > 0 && (
                  <Link
                    href={buildRoute('/transformation/roadmap', {
                      clientId: cId ?? null,
                      assessmentId: aId ?? null,
                    })}
                    className="btn btn-sm btn-secondary"
                  >
                    View Roadmap →
                  </Link>
                )}
              </div>
              {Object.keys(phaseCounts).length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🗺️</div>
                  <p className="empty-state-title">No roadmap generated yet</p>
                  <p className="empty-state-sub">
                    Complete module assessments to generate your transformation roadmap.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  {Object.entries(phaseCounts).map(([phase, count]) => (
                    <div
                      key={phase}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}
                    >
                      <span
                        className={`roadmap-phase-pill ${phaseLabel(phase)}`}
                        style={{
                          fontSize: '0.7rem',
                          padding: '0.2rem 0.6rem',
                          minWidth: 80,
                          textAlign: 'center',
                        }}
                      >
                        {phase}
                      </span>
                      <div className="progress-bar-shell" style={{ flex: 1, height: 10 }}>
                        <div
                          className="progress-bar-fill"
                          style={{ width: `${Math.min(100, (count / roadmapItems) * 100)}%` }}
                        />
                      </div>
                      <span
                        style={{
                          fontWeight: 700,
                          minWidth: 28,
                          textAlign: 'right',
                        }}
                      >
                        {count}
                      </span>
                    </div>
                  ))}
                  <p className="text-xs muted-2" style={{ marginTop: '0.25rem' }}>
                    {roadmapItems} total actions across {Object.keys(phaseCounts).length} phases
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {view === 'executive' && (
        <div style={{ display: 'grid', gap: '1.25rem' }}>
          {avgScore > 0 && (
            <div className="exec-headline">
              {avgScore < 40
                ? `The business is currently operating with critical gaps across multiple domains. The diagnostic reveals systemic weaknesses in process ownership, execution discipline, and management visibility that — if unaddressed — will constrain both near-term performance and medium-term growth.`
                : avgScore < 65
                  ? `The business has foundational elements in place but operates with uneven execution across key domains. The diagnostic identifies targeted areas where tightening ownership, standardising processes, and improving KPI visibility will produce measurable performance gains.`
                  : `The business demonstrates solid operational foundations across most assessed domains. The diagnostic identifies selective improvement opportunities and automation readiness areas that can extend existing capability at lower marginal cost.`}
            </div>
          )}

          <div className="grid-2">
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">Domain Performance</h3>
                  <p className="card-subtitle">Module scores and maturity bands</p>
                </div>
              </div>
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {diagModules.map((m: any) => {
                  const pct = Number(m.score_pct || 0);
                  const bb = bandBadge(pct);
                  return (
                    <div
                      key={m.module_id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 120px 80px',
                        gap: '0.75rem',
                        alignItems: 'center',
                        padding: '0.5rem 0',
                        borderBottom: '1px solid var(--line)',
                      }}
                    >
                      <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                        {m.module_name}
                      </span>
                      <div className="progress-bar-shell" style={{ height: 8 }}>
                        <div
                          className={`progress-bar-fill ${pct < 40 ? 'danger' : pct < 65 ? 'warn' : ''}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span
                        style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.875rem' }}
                      >
                        {pct > 0 ? `${Math.round(pct)}%` : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'grid', gap: '1rem', alignContent: 'start' }}>
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Report Readiness</h3>
                </div>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  {readiness.moduleStatuses.map((row: any) => (
                    <div
                      key={row.moduleCode}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.875rem',
                      }}
                    >
                      <span>{row.label}</span>
                      <span className={`badge ${row.ready ? 'badge-success' : 'badge-muted'}`}>
                        {row.ready ? '✓ Ready' : 'Pending'}
                      </span>
                    </div>
                  ))}
                </div>
                <div
                  style={{
                    marginTop: '1rem',
                    padding: '0.75rem',
                    background: 'var(--surface-2)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.8rem',
                      color: 'var(--muted)',
                      marginBottom: '0.25rem',
                    }}
                  >
                    Integrated report
                  </div>
                  <span className={`badge ${readiness.fullyReady ? 'badge-success' : 'badge-warn'}`}>
                    {readiness.readyCount}/{readiness.totalCount} modules ready
                  </span>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Key Indicators</h3>
                </div>
                <div className="grid-2">
                  {[
                    {
                      label: 'Critical Findings',
                      value: String(criticalFindings),
                      danger: criticalFindings > 0,
                    },
                    { label: 'Roadmap Actions', value: String(roadmapItems), danger: false },
                    {
                      label: 'Modules Ready',
                      value: `${readiness.readyCount}/${readiness.totalCount}`,
                      danger: false,
                    },
                    {
                      label: 'Portfolio Score',
                      value: avgScore > 0 ? `${Math.round(avgScore)}%` : '—',
                      danger: avgScore > 0 && avgScore < 40,
                    },
                  ].map((k) => (
                    <div key={k.label} className="stat-card">
                      <div className="stat-card-label">{k.label}</div>
                      <div
                        className="stat-card-value"
                        style={{ color: k.danger ? 'var(--danger)' : undefined }}
                      >
                        {k.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {view === 'report' && (
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Integrated Report Preview</h3>
              <p className="card-subtitle">Executive summary from the latest generated report</p>
            </div>
            <Link
              href={buildRoute('/reports', {
                clientId: cId ?? null,
                assessmentId: aId ?? null,
              })}
              className="btn btn-secondary btn-sm"
            >
              Full Reports →
            </Link>
          </div>
          {!reportPayload ? (
            <div className="empty-state">
              <div className="empty-state-icon">📄</div>
              <p className="empty-state-title">No integrated report generated yet</p>
              <p className="empty-state-sub">
                Use the Generate Report button in the workspace bar to create your executive
                report.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '1.25rem' }}>
              {reportPayload.executive_summary?.headline && (
                <div className="exec-headline">{reportPayload.executive_summary.headline}</div>
              )}
              {reportPayload.executive_summary?.key_message && (
                <p
                  style={{
                    color: 'var(--muted)',
                    fontSize: '0.9rem',
                    lineHeight: 1.6,
                  }}
                >
                  {reportPayload.executive_summary.key_message}
                </p>
              )}
              {reportPayload.executive_summary?.financial_impact && (
                <div className="stat-card stat-card-accent" style={{ maxWidth: 280 }}>
                  <div className="stat-card-label">Financial Impact</div>
                  <div
                    className="stat-card-value"
                    style={{ fontSize: '1.3rem', color: 'var(--danger)' }}
                  >
                    {reportPayload.executive_summary.financial_impact}
                  </div>
                </div>
              )}
              {Array.isArray(reportPayload.key_findings) && reportPayload.key_findings.length > 0 && (
                <div>
                  <h4 style={{ marginBottom: '0.75rem' }}>Priority Findings</h4>
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    {reportPayload.key_findings.slice(0, 5).map((f: any, i: number) => (
                      <div key={i} className="finding-card finding-card-critical">
                        <div className="finding-card-title">{f.title}</div>
                        {f.summary && <div className="finding-card-impact">{f.summary}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </AppFrame>
  );
}