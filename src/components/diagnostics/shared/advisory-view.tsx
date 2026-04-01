// @ts-nocheck
'use client';
// Kinto Global — Advisory View (shared across OPS, DATA, AIR, AIUC)
// Renders findings → recommendations → actions → roadmap for any module
import { ExplainButton } from '@/components/assistant/explain-button';

type Finding = {
  finding_title?: string; finding_text?: string;
  business_impact?: string; likely_root_cause?: string;
  domain_id?: string; domain_name?: string; score_band?: string;
  question_id?: string; score?: number;
  recommendation?: { recommendation_title?: string; recommendation_text?: string; expected_outcome?: string; priority?: string; roadmap_phase?: string };
  action?: { action_title?: string; action_text?: string; owner_role?: string; timeline_band?: string; effort_level?: string; success_measure?: string };
};

type Recommendation = {
  recommendation_id?: string; recommendation_title?: string; recommendation_summary?: string;
  recommendation_detail?: string; priority?: string; roadmap_phase?: string;
  domain_id?: string; finding_id?: string;
};

type Action = {
  action_id?: string; action_summary?: string; action_title?: string; action_text?: string;
  owner_role?: string; timeline_band?: string; roadmap_phase?: string; expected_outcome?: string;
  effort_level?: string; success_measure?: string;
};

type RoadmapItem = {
  roadmap_instance_id?: string; initiative_title?: string; milestone_name?: string;
  phase_name?: string; phase_code?: string; owner_role?: string;
  business_outcome?: string; priority_rank?: number;
};

type Props = {
  moduleLabel: string;
  moduleCode: string;
  scorePct?: number;
  maturityBand?: string;
  findings?: Finding[];
  recommendations?: Recommendation[];
  actions?: Action[];
  roadmapItems?: RoadmapItem[];
  executiveNarrative?: string[];
  // OPS-style: surfaced_findings with nested rec/action
  surfacedFindings?: Finding[];
};

function priorityBadge(p?: string) {
  const v = String(p || '').toUpperCase();
  if (v === 'CRITICAL' || v === 'HIGH') return 'badge-danger';
  if (v === 'MEDIUM') return 'badge-warn';
  return 'badge-muted';
}

function phasePill(phase?: string) {
  const v = String(phase || '');
  if (v.includes('1') || v.toUpperCase().includes('P1')) return 'phase-1-pill';
  if (v.includes('3') || v.toUpperCase().includes('P3')) return 'phase-3-pill';
  return 'phase-2-pill';
}

function bandBadge(band?: string | null, score?: number) {
  const v = String(band || '').toUpperCase();
  if (v.includes('CRITICAL') || v.includes('WEAK') || (score !== undefined && score <= 2)) return 'badge-danger';
  if (v.includes('DEVELOPING') || (score !== undefined && score === 3)) return 'badge-warn';
  if (v.includes('STRONG') || v.includes('MANAGED') || (score !== undefined && score >= 4)) return 'badge-success';
  return 'badge-muted';
}

export function AdvisoryView({
  moduleLabel, moduleCode, scorePct, maturityBand,
  findings = [], recommendations = [], actions = [],
  roadmapItems = [], executiveNarrative = [], surfacedFindings = [],
}: Props) {
  // Normalise: OPS passes surfacedFindings with nested rec/action
  // Generic modules pass separate findings/recommendations/actions arrays
  const allFindings: Finding[] = surfacedFindings.length > 0 ? surfacedFindings : findings;

  // Sort findings by severity — Critical first, then Developing, consistent everywhere
  function findingSeverityWeight(f: Finding): number {
    const score = Number(f.score || 0);
    const band = String(f.score_band || f.severity_band || '').toUpperCase();
    if (score === 1 || band === 'CRITICAL') return 1;
    if (score === 2 || band.includes('WEAK') || band.includes('1-2')) return 2;
    if (score === 3 || band === 'DEVELOPING') return 3;
    return 4;
  }
  const sortedFindings = [...allFindings].sort((a, b) => findingSeverityWeight(a) - findingSeverityWeight(b));

  const priorityFindings = sortedFindings.filter(f => {
    const score = Number(f.score || 0);
    const band = String(f.score_band || f.severity_band || '').toUpperCase();
    return score <= 2 || band === 'CRITICAL' || band === 'WEAK' || band.includes('1') || band.includes('2');
  });
  const developingFindings = sortedFindings.filter(f => {
    const score = Number(f.score || 0);
    const band = String(f.score_band || f.severity_band || '').toUpperCase();
    return score === 3 || band === 'DEVELOPING';
  });

  // Sort actions by phase (P1 → P3), then by priority within phase
  function actionPhaseWeight(r: RoadmapItem): number {
    const v = String(r.phase_code || r.phase_name || '').toUpperCase();
    if (v.startsWith('P1') || v.includes('STABILISE')) return 1;
    if (v.startsWith('P2') || v.includes('STANDARD')) return 2;
    return 3;
  }
  const sortedRoadmap = [...roadmapItems].sort((a, b) => actionPhaseWeight(a) - actionPhaseWeight(b));

  const noData = allFindings.length === 0 && recommendations.length === 0 && roadmapItems.length === 0;

  if (noData) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <p className="empty-state-title">No advisory data generated yet</p>
          <p className="empty-state-sub">
            Score questions in the Assessment tab to generate findings, recommendations, and actions.
            The advisory view populates automatically once scoring is complete.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem' }}>
        {[
          { label: 'Module Score', value: scorePct !== undefined && scorePct > 0 ? `${Math.round(scorePct)}%` : '—', sub: String(maturityBand || 'Not scored').replaceAll('_', ' ') },
          { label: 'Priority Findings', value: String(priorityFindings.length), sub: 'Critical / Weak', danger: priorityFindings.length > 0 },
          { label: 'Developing', value: String(developingFindings.length), sub: 'Score 3 — improvement areas' },
          { label: 'Recommendations', value: String(recommendations.length || allFindings.filter(f => f.recommendation?.recommendation_text).length), sub: 'Surfaced' },
          { label: 'Roadmap Actions', value: String(roadmapItems.length), sub: 'Priority initiatives' },
        ].map(k => (
          <div key={k.label} className="stat-card">
            <div className="stat-card-label">{k.label}</div>
            <div className="stat-card-value" style={{ fontSize: '1.2rem', color: (k as any).danger ? 'var(--danger)' : undefined }}>{k.value}</div>
            <div className="stat-card-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Executive narrative */}
      {executiveNarrative.length > 0 && (
        <div className="exec-headline">
          {executiveNarrative.join(' ')}
        </div>
      )}

      {/* Priority findings + recommendations */}
      {priorityFindings.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Priority Findings & Recommendations</h3>
              <p className="card-subtitle">Critical and weak areas requiring immediate action</p>
            </div>
            <span className="badge badge-danger">{priorityFindings.length} critical / weak</span>
          </div>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {priorityFindings.map((f, i) => {
              const rec = f.recommendation;
              const act = f.action;
              const title = f.finding_title || rec?.recommendation_title || `Finding ${i + 1}`;
              return (
                <div key={f.question_id || i} style={{ border: '1px solid var(--danger-border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                  {/* Finding header */}
                  <div style={{ background: 'var(--danger-bg)', padding: '0.75rem 1rem', borderBottom: '1px solid var(--danger-border)', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 700, fontSize: '0.9rem', margin: 0 }}>{title}</p>
                        {f.domain_name && <span className="text-xs muted-2">{f.domain_name}</span>}
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0, alignItems: 'center' }}>
                        {f.score && <span className="badge badge-danger">Score {f.score}</span>}
                        {rec?.priority && <span className={`badge ${priorityBadge(rec.priority)}`}>{rec.priority}</span>}
                        <ExplainButton
                          context={`Explain this finding: "${title}". Domain: ${String(f.domain_name || '')}. ${String(f.finding_text || '')} ${String(f.business_impact || '')}`}
                          label="Ask Claude"
                          compact
                        />
                      </div>
                    </div>
                    {f.finding_text && <p className="text-xs muted-2" style={{ marginTop: '0.35rem' }}>{f.finding_text}</p>}
                    {f.business_impact && <p className="text-xs" style={{ color: 'var(--danger)', marginTop: '0.25rem' }}>⚠ {f.business_impact}</p>}
                    {f.likely_root_cause && <p className="text-xs muted-2" style={{ marginTop: '0.2rem' }}><strong>Root cause:</strong> {f.likely_root_cause}</p>}
                  </div>
                  {/* Recommendation */}
                  {rec && (rec.recommendation_text || rec.recommendation_title) && (
                    <div style={{ padding: '0.75rem 1rem', borderBottom: act ? '1px solid var(--line)' : 'none', background: 'var(--surface)' }}>
                      <div className="text-xs" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--brand-dark)', marginBottom: '0.3rem' }}>
                        Recommendation
                      </div>
                      <p style={{ fontSize: '0.875rem', margin: 0 }}>{rec.recommendation_text || rec.recommendation_title}</p>
                      {rec.expected_outcome && <p className="text-xs muted-2" style={{ marginTop: '0.25rem' }}><strong>Expected outcome:</strong> {rec.expected_outcome}</p>}
                      {rec.roadmap_phase && (
                        <span className={`roadmap-phase-pill ${phasePill(rec.roadmap_phase)}`} style={{ display: 'inline-block', marginTop: '0.35rem', fontSize: '0.68rem', padding: '0.1rem 0.5rem' }}>
                          {rec.roadmap_phase}
                        </span>
                      )}
                    </div>
                  )}
                  {/* Action */}
                  {act && (act.action_text || act.action_title) && (
                    <div style={{ padding: '0.75rem 1rem', background: 'var(--surface-2)' }}>
                      <div className="text-xs" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted)', marginBottom: '0.3rem' }}>
                        Immediate Action
                      </div>
                      <p style={{ fontSize: '0.875rem', margin: 0 }}>{act.action_text || act.action_title}</p>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                        {act.owner_role && <span className="badge badge-muted">👤 {act.owner_role}</span>}
                        {act.timeline_band && <span className="badge badge-muted">⏱ {act.timeline_band}</span>}
                        {act.effort_level && <span className="badge badge-muted">Effort: {act.effort_level}</span>}
                        {act.success_measure && <span className="badge badge-info">✓ {act.success_measure}</span>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Developing findings */}
      {developingFindings.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Development Opportunities</h3>
              <p className="card-subtitle">Score 3 areas — functioning but improvable</p>
            </div>
            <span className="badge badge-warn">{developingFindings.length} developing</span>
          </div>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {developingFindings.map((f, i) => {
              const rec = f.recommendation;
              return (
                <div key={f.question_id || i} className="finding-card finding-card-developing">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <div>
                      <p className="finding-card-title">{f.finding_title || `Developing Area ${i + 1}`}</p>
                      {f.finding_text && <p className="finding-card-impact">{f.finding_text}</p>}
                      {rec?.recommendation_text && (
                        <p className="text-xs muted-2" style={{ marginTop: '0.3rem' }}>
                          <strong>Recommendation:</strong> {rec.recommendation_text}
                        </p>
                      )}
                    </div>
                    {f.domain_name && <span className="badge badge-muted" style={{ flexShrink: 0, fontSize: '0.68rem' }}>{f.domain_name}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Stand-alone recommendations (generic modules) */}
      {recommendations.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Recommendations</h3>
            <span className="badge badge-muted">{recommendations.length} total</span>
          </div>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {recommendations.slice(0, 10).map((r, i) => (
              <div key={r.recommendation_id || i} style={{ padding: '0.75rem', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <p style={{ fontWeight: 600, fontSize: '0.875rem', margin: 0 }}>{r.recommendation_summary || r.recommendation_title || `Recommendation ${i + 1}`}</p>
                  <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                    {r.priority && <span className={`badge ${priorityBadge(r.priority)}`} style={{ fontSize: '0.68rem' }}>{r.priority}</span>}
                    {r.roadmap_phase && <span className={`roadmap-phase-pill ${phasePill(r.roadmap_phase)}`} style={{ fontSize: '0.68rem', padding: '0.1rem 0.45rem' }}>{r.roadmap_phase}</span>}
                  </div>
                </div>
                {r.recommendation_detail && <p className="text-xs muted-2">{r.recommendation_detail}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Roadmap preview */}
      {roadmapItems.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Priority Roadmap Actions</h3>
              <p className="card-subtitle">Transformation initiatives from this module</p>
            </div>
            <span className="badge badge-muted">{roadmapItems.length} actions</span>
          </div>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {['P1', 'P2', 'P3'].map(phase => {
              const items = sortedRoadmap.filter(r => (r.phase_code || 'P2') === phase);
              if (!items.length) return null;
              return (
                <div key={phase}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                    <span className={`roadmap-phase-pill ${phasePill(phase)}`} style={{ fontSize: '0.7rem', padding: '0.15rem 0.55rem' }}>{phase}</span>
                    <span className="text-xs muted-2">{items.length} actions</span>
                  </div>
                  {items.map((r, i) => (
                    <div key={r.roadmap_instance_id || i} className="roadmap-card" style={{ marginBottom: '0.4rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <p className="roadmap-card-title">{r.initiative_title || r.milestone_name || `Action ${i + 1}`}</p>
                        {r.business_outcome && <p className="text-xs muted-2">{r.business_outcome}</p>}
                        {r.owner_role && (
                          <div className="roadmap-card-meta">
                            <span className="badge badge-muted">👤 {r.owner_role}</span>
                          </div>
                        )}
                      </div>
                      <ExplainButton
                        context={`Explain this action: "${String(r.initiative_title || '')}". Phase: ${phase}. Owner: ${String(r.owner_role || '')}. Outcome: ${String(r.business_outcome || '')}`}
                        mode="guidance"
                        compact
                      />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
