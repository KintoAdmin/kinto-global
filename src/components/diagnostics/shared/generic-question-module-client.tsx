// @ts-nocheck
// Kinto Global — Generic Question Module Client v2
'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { ScoreButtonGroup } from '@/components/shared/score-button-group';
import { AdvisoryView } from '@/components/diagnostics/shared/advisory-view';
import { ModuleIntro } from '@/components/onboarding/module-intro';

// ── Types ──────────────────────────────────────────────────────────────────
type Question = {
  question_id: string; domain_id: string; domain_name: string;
  workflow_id: string; workflow_name: string; workflow_description?: string;
  workflow_objective?: string; question_text: string; guidance?: string;
  evidence_examples?: string; customer_impact_if_weak?: string;
  linked_metric?: string; owner_role?: string; roadmap_phase?: string;
  score_1_guidance?: string; score_3_guidance?: string; score_5_guidance?: string;
};
type ResponseRow = { question_id: string; score_1_to_5: number | null };
type MetricRow = {
  metric_id: string; metric_name?: string; domain_id?: string; workflow_id?: string;
  current_value?: string | number | null; target_value?: string | number | null;
  variance_to_target?: string | number | null; unit?: string | null;
  rag_status?: string | null; trend_direction?: string | null; notes?: string | null;
};
type DomainScore = { domain_id: string; score_pct: number; maturity_band: string; questions_answered: number; questions_total: number; is_complete: boolean };
type FindingPreview = { finding_title: string; severity_band: string; domain_id: string; is_priority?: boolean };
type ApiPayload = {
  assessmentId?: string | null; mode?: 'preview' | 'assessment';
  questions?: Question[]; responses?: ResponseRow[];
  moduleScore?: { score_pct?: number; maturity_band?: string; is_complete?: boolean } | null;
  domainScores?: DomainScore[]; findingsPreview?: FindingPreview[];
  metricCaptures?: MetricRow[]; error?: string;
};
type Props = {
  routePath: string; assessmentId?: string; moduleLabel: string;
  moduleCode: string; moduleIntro?: string; view?: string;
  tabs?: Array<{ key: string; label: string }>;
};

// ── Helpers ────────────────────────────────────────────────────────────────
function withAid(path: string, aid?: string) {
  if (!aid) return path;
  return `${path}${path.includes('?') ? '&' : '?'}assessmentId=${encodeURIComponent(aid)}`;
}
function safe<T>(v: T[] | undefined | null): T[] { return Array.isArray(v) ? v : []; }
function pct(v?: number | null) { return `${Math.round(Number(v || 0))}%`; }
function bandClass(v?: string | null) {
  const s = String(v || '').toUpperCase();
  if (s.includes('CRITICAL') || s.includes('WEAK')) return 'score-band-critical';
  if (s.includes('DEVELOPING') || s.includes('INCOMPLETE')) return 'score-band-developing';
  if (s.includes('MANAGED') || s.includes('STRONG')) return 'score-band-strong';
  return 'score-band-unscored';
}
function bandDisplay(v?: string | null) { return String(v || 'Not scored').replaceAll('_', ' '); }

// ── Component ──────────────────────────────────────────────────────────────

// Live domain score computation — instant feedback without waiting for background recompute
function computeLiveScores(
  domains: Array<{ domain_id: string }>,
  questions: Array<{ question_id: string; domain_id: string }>,
  responses: Array<{ question_id: string; score_1_to_5: number | null }>
) {
  const respMap = new Map(responses.map(r => [r.question_id, r]));
  return domains.reduce<Record<string, { score_pct: number; answered: number; total: number; maturity_band: string }>>((acc, d) => {
    const dQs = questions.filter(q => q.domain_id === d.domain_id);
    const ans  = dQs.filter(q => Number(respMap.get(q.question_id)?.score_1_to_5 || 0) > 0);
    const raw  = ans.reduce((s, q) => s + Number(respMap.get(q.question_id)?.score_1_to_5 || 0), 0);
    const avg  = ans.length > 0 ? raw / ans.length : 0;
    const pct  = ans.length > 0 ? Math.round((avg / 5) * 100) : 0;
    const band = pct >= 80 ? 'STRONG' : pct >= 60 ? 'MANAGED' : pct >= 40 ? 'DEVELOPING' : pct > 0 ? 'WEAK' : 'NOT_SCORED';
    acc[d.domain_id] = { score_pct: pct, answered: ans.length, total: dQs.length, maturity_band: band };
    return acc;
  }, {});
}

export function GenericQuestionModuleClient({ routePath, assessmentId, moduleLabel, moduleCode, moduleIntro, view = 'assessment' }: Props) {
  const [data, setData] = useState<ApiPayload | null>(null);
  const [loading, setLoading] = useState(Boolean(assessmentId));
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [openDomains, setOpenDomains] = useState<Record<string, boolean>>({});
  const [reportBusy, setReportBusy] = useState(false);
  const [standaloneReport, setStandaloneReport] = useState<any>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [metricDrafts, setMetricDrafts] = useState<Record<string, Record<string, string>>>({});
  const [, startTransition] = useTransition();
  const qRef = useRef(Promise.resolve());

  // ── Load ──────────────────────────────────────────────────────────────────
  async function load() {
    if (!assessmentId) {
      setLoading(false);
      setData({ questions: [], responses: [], domainScores: [], findingsPreview: [], moduleScore: null, metricCaptures: [] });
      setErr('No assessment selected. Create or choose a client assessment first.');
      return;
    }
    setLoading(true); setErr(null);
    try {
      const [r, rptR] = await Promise.all([
        fetch(withAid(routePath, assessmentId), { cache: 'no-store' }),
        fetch(`/api/assessments/${encodeURIComponent(assessmentId)}/report/${encodeURIComponent(moduleCode)}`, { cache: 'no-store' }).catch(() => null),
      ]);
      const p = await r.json();
      if (!r.ok || p?.error) { setErr(p?.error || 'Failed to load.'); setData({ questions: [], responses: [], domainScores: [], findingsPreview: [], moduleScore: null, metricCaptures: [] }); return; }
      const payload = p?.data || p;
      setData({ assessmentId, questions: safe(payload.questions), responses: safe(payload.responses), domainScores: safe(payload.domainScores), findingsPreview: safe(payload.findingsPreview), moduleScore: payload.moduleScore || null, metricCaptures: safe(payload.metricCaptures) });
      const next: Record<string, boolean> = {};
      for (const q of safe(payload.questions)) { if (q.domain_id) next[q.domain_id] = true; }
      setOpenDomains(c => ({ ...next, ...c }));
      if (rptR) { const rp = await rptR.json().catch(() => null); if (rptR.ok && !rp?.error) setStandaloneReport(rp?.data || rp || null); }
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed to load.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [assessmentId]);

  // ── Derived data ──────────────────────────────────────────────────────────
  const questions = safe(data?.questions);
  const responses = safe(data?.responses);
  const domainScores = safe(data?.domainScores);
  const metrics = safe(data?.metricCaptures);
  const findings = safe(data?.findingsPreview);
  const responseMap = useMemo(() => new Map(responses.map(r => [r.question_id, r])), [responses]);
  const liveScores = useMemo(() => computeLiveScores(
    questions.map(q => ({ domain_id: q.domain_id })).filter((d, i, a) => a.findIndex(x => x.domain_id === d.domain_id) === i),
    questions,
    responses
  ), [questions, responses]);

  const domainScoreMap = useMemo(() => {
    const serverMap = new Map(domainScores.map(d => [d.domain_id, d]));
    const merged = new Map<string, any>();
    for (const [dId, live] of Object.entries(liveScores)) {
      const server = serverMap.get(dId) || {};
      merged.set(dId, { ...server, score_pct: live.score_pct, questions_answered: live.answered, questions_total: live.total, maturity_band: live.maturity_band });
    }
    for (const [dId, s] of serverMap.entries()) { if (!merged.has(dId)) merged.set(dId, s); }
    return merged;
  }, [domainScores, liveScores]);

  // Live module score from all responses
  const liveModuleScore = useMemo(() => {
    const validQIds = new Set(questions.map(q => q.question_id));
    const ans = responses.filter(r => validQIds.has(r.question_id) && Number(r.score_1_to_5 || 0) > 0);
    if (!ans.length) return null;
    const raw = ans.reduce((s, r) => s + Number(r.score_1_to_5 || 0), 0);
    const avg = raw / ans.length;
    const pct = Math.round((avg / 5) * 100);
    const band = pct >= 80 ? 'STRONG' : pct >= 60 ? 'MANAGED' : pct >= 40 ? 'DEVELOPING' : 'WEAK';
    return { score_pct: pct, maturity_band: band, is_complete: ans.length === questions.length };
  }, [responses, questions]);
  // Only count responses for questions that exist in the current library
  // This prevents stale DB rows from inflating the answered count
  const questionIds = useMemo(() => new Set(questions.map(q => q.question_id)), [questions]);
  const answered = responses.filter(r => questionIds.has(r.question_id) && Number(r.score_1_to_5 || 0) > 0).length;
  const totalQ = questions.length;

  const grouped = useMemo(() => {
    const byDomain = new Map<string, { domainId: string; domainName: string; workflows: Map<string, { workflowId: string; workflowName: string; workflowDescription?: string; workflowObjective?: string; questions: Question[] }> }>();
    for (const q of questions) {
      if (!byDomain.has(q.domain_id)) byDomain.set(q.domain_id, { domainId: q.domain_id, domainName: q.domain_name, workflows: new Map() });
      const d = byDomain.get(q.domain_id)!;
      if (!d.workflows.has(q.workflow_id)) d.workflows.set(q.workflow_id, { workflowId: q.workflow_id, workflowName: q.workflow_name, workflowDescription: q.workflow_description, workflowObjective: q.workflow_objective, questions: [] });
      d.workflows.get(q.workflow_id)!.questions.push(q);
    }
    return [...byDomain.values()].map(d => ({ ...d, workflows: [...d.workflows.values()] }));
  }, [questions]);

  // ── Save score ────────────────────────────────────────────────────────────
  async function saveScore(q: Question, score: number) {
    if (!data || !assessmentId) return;
    setSaving(q.question_id);
    // Optimistic
    const next = [...responses]; const idx = next.findIndex(r => r.question_id === q.question_id);
    if (idx >= 0) next[idx] = { ...next[idx], score_1_to_5: score }; else next.push({ question_id: q.question_id, score_1_to_5: score });
    setData({ ...data, responses: next });
    try {
      const r = await fetch(withAid(routePath, assessmentId), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questionId: q.question_id, score, assessmentId }) });
      const p = await r.json();
      if (!r.ok || p?.error) { setErr(p?.error || 'Save failed.'); return; }
      const payload = p?.data || p;
      setData({ assessmentId, questions: safe(payload.questions), responses: safe(payload.responses), domainScores: safe(payload.domainScores), findingsPreview: safe(payload.findingsPreview), moduleScore: payload.moduleScore || null, metricCaptures: safe(payload.metricCaptures || data.metricCaptures) });
    } catch (e) { setErr(e instanceof Error ? e.message : 'Save failed.'); }
    finally { startTransition(() => setSaving(null)); }
  }

  // ── Save metric ────────────────────────────────────────────────────────────
  const dK = (mId: string, wId?: string) => `${mId}::${wId || ''}`;
  const getDraft = (mId: string, wId?: string) => metricDrafts[dK(mId, wId)] || {};
  const setDraft = (mId: string, wId: string | undefined, patch: Record<string, string>) => {
    const k = dK(mId, wId); setMetricDrafts(c => ({ ...c, [k]: { ...(c[k] || {}), ...patch } }));
  };
  function mergedMetric(mId: string, wId?: string): MetricRow {
    const p = metrics.find(m => m.metric_id === mId && String(m.workflow_id || '') === String(wId || '')) || {} as MetricRow;
    return { ...p, ...getDraft(mId, wId) } as MetricRow;
  }
  async function saveMetric(metricId: string, workflowId: string | undefined, field: string, value: string) {
    if (!assessmentId) return;
    const m = mergedMetric(metricId, workflowId);
    const body = { metricId, workflowId: workflowId || '', assessmentId, currentValue: String(m.current_value || ''), targetValue: String(m.target_value || ''), trendDirection: String(m.trend_direction || ''), ragStatus: String(m.rag_status || ''), [field]: value };
    const exec = async () => {
      const r = await fetch(`/api/assessments/${encodeURIComponent(assessmentId)}/modules/${encodeURIComponent(moduleCode)}/metric`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const p = await r.json().catch(() => null);
      if (r.ok && !p?.error && p?.metricCaptures) setData(c => c ? { ...c, metricCaptures: safe(p.metricCaptures) } : c);
    };
    qRef.current = qRef.current.then(exec).catch(() => {});
  }

  // ── Report ────────────────────────────────────────────────────────────────
  async function generateReport() {
    if (!assessmentId) { alert('Select an assessment first.'); return; }
    try {
      setReportBusy(true); setReportError(null);
      const r = await fetch(`/api/assessments/${encodeURIComponent(assessmentId)}/report/${encodeURIComponent(moduleCode)}`, { method: 'POST' });
      const raw = await r.text(); let p: any = null;
      try { p = JSON.parse(raw); } catch {/**/}
      if (!r.ok || p?.error) throw new Error(p?.error || raw || 'Failed.');
      setStandaloneReport(p?.data || p || null);
      await load();
    } catch (e) { setReportError(e instanceof Error ? e.message : 'Failed.'); }
    finally { setReportBusy(false); }
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--muted)', padding: '1rem 0' }}>
        <span style={{ display: 'inline-block', width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--brand)', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
        Loading {moduleLabel}…
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );

  const artList = standaloneReport?.artifacts || [];
  const docxArt = artList.find((a: any) => a.file_type === 'docx');
  const pptxArt = artList.find((a: any) => a.file_type === 'pptx');
  const scorePct = liveModuleScore?.score_pct ?? Number(data?.moduleScore?.score_pct || 0);
  const band = liveModuleScore?.maturity_band ?? data?.moduleScore?.maturity_band;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem' }}>
        {[
          { label: 'Questions', value: `${answered}/${totalQ}`, sub: 'Answered' },
          { label: 'Score', value: scorePct > 0 ? pct(scorePct) : '—', sub: bandDisplay(band) },
          { label: 'Critical', value: String(findings.filter(f => f.is_priority).length), sub: 'Priority findings' },
          { label: 'Developing', value: String(findings.filter(f => !f.is_priority && f.severity_band?.toLowerCase().includes('develop')).length), sub: 'Development' },
          { label: 'Metrics', value: String(metrics.filter(m => m.current_value).length) + '/' + String(metrics.length), sub: 'Captured' },
        ].map(k => (
          <div key={k.label} className="stat-card">
            <div className="stat-card-label">{k.label}</div>
            <div className="stat-card-value" style={{ fontSize: '1.3rem' }}>{k.value}</div>
            <div className="stat-card-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {err && <div style={{ padding: '0.75rem 1rem', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 'var(--radius-sm)', color: 'var(--danger)', fontSize: '0.875rem' }}>{err}</div>}

      {/* ═══ ASSESSMENT ══════════════════════════════════════════════════════ */}
      {view === 'assessment' && (
        <>
          <ModuleIntro moduleCode={moduleCode} moduleName={moduleLabel} hasScores={answered > 0} />
          {!questions.length && (
            <div className="card"><div className="empty-state">
              <p className="empty-state-title">{assessmentId ? 'No questions loaded.' : 'No assessment selected.'}</p>
              <p className="empty-state-sub">{assessmentId ? 'The module may still be initialising. Try refreshing.' : 'Create or select an assessment from the workspace bar.'}</p>
            </div></div>
          )}
          {grouped.map(domain => {
            const ds = domainScoreMap.get(domain.domainId);
            const isOpen = openDomains[domain.domainId] ?? true;
            const dAns = domain.workflows.flatMap(w => w.questions).filter(q => Number(responseMap.get(q.question_id)?.score_1_to_5 || 0) > 0).length;
            const dTotal = domain.workflows.flatMap(w => w.questions).length;
            const dPct = Number(ds?.score_pct || 0);
            return (
              <div key={domain.domainId} className="domain-block">
                <button type="button" className="domain-header" onClick={() => setOpenDomains(c => ({ ...c, [domain.domainId]: !isOpen }))}>
                  <div>
                    <h3 className="domain-title">{domain.domainName}</h3>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.3rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className="text-xs muted-2">{dAns}/{dTotal} answered</span>
                      {dPct > 0 && (
                        <>
                          <span className="text-xs muted-2">·</span>
                          <span style={{ fontWeight: 700, fontSize: '0.875rem', color: dPct < 40 ? 'var(--danger)' : dPct < 65 ? 'var(--warn)' : 'var(--brand-dark)' }}>{Math.round(dPct)}%</span>
                          <span className={`score-band ${bandClass(ds?.maturity_band)}`} style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem' }}>{bandDisplay(ds?.maturity_band)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <span style={{ color: 'var(--muted)', fontSize: '1.1rem' }}>{isOpen ? '▲' : '▼'}</span>
                </button>

                {isOpen && (
                  <div className="domain-body">
                    {domain.workflows.map(wf => (
                      <div key={wf.workflowId} className="workflow-block" style={{ marginBottom: '0.65rem' }}>
                        <div className="workflow-header" style={{ cursor: 'default' }}>
                          <div>
                            <h4 className="workflow-title">{wf.workflowName}</h4>
                            {wf.workflowObjective && <p className="text-xs muted-2" style={{ marginTop: '0.2rem' }}>{wf.workflowObjective}</p>}
                          </div>
                        </div>
                        <div className="workflow-body">
                          <div style={{ display: 'grid', gap: '0.65rem' }}>
                            {wf.questions.map(q => {
                              const resp = responseMap.get(q.question_id);
                              const sc = Number(resp?.score_1_to_5 || 0);
                              return (
                                <div key={q.question_id} className={`question-card${sc > 0 && sc <= 2 ? ' question-card critical' : sc >= 4 ? ' question-card answered' : ''}`}>
                                  <div className="question-card-head">
                                    <div>
                                      <span className="badge" style={{ fontSize: '0.68rem', marginBottom: '0.3rem' }}>{q.question_id}</span>
                                      <p className="question-text">{q.question_text}</p>
                                      {q.guidance && <p className="text-xs muted-2"><strong>Focus:</strong> {q.guidance}</p>}
                                      {q.evidence_examples && <p className="text-xs muted-2"><strong>Evidence:</strong> {q.evidence_examples}</p>}
                                      {q.customer_impact_if_weak && sc > 0 && sc <= 2 && (
                                        <p className="text-xs" style={{ color: 'var(--danger)', marginTop: '0.25rem' }}>⚠ {q.customer_impact_if_weak}</p>
                                      )}
                                      {(q.score_1_guidance || q.score_3_guidance || q.score_5_guidance) && (
                                        <details style={{ marginTop: '0.3rem' }}>
                                          <summary style={{ cursor: 'pointer', fontSize: '0.7rem', color: 'var(--muted-2)', listStyle: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem', userSelect: 'none' }}>
                                            <span>▸</span> Scoring guidance
                                          </summary>
                                          <div className="guidance-grid" style={{ marginTop: '0.4rem' }}>
                                            {q.score_1_guidance && <div className="guidance-card guidance-1"><div className="guidance-label">Score 1–2</div><div className="guidance-text">{q.score_1_guidance}</div></div>}
                                            {q.score_3_guidance && <div className="guidance-card guidance-3"><div className="guidance-label">Score 3</div><div className="guidance-text">{q.score_3_guidance}</div></div>}
                                            {q.score_5_guidance && <div className="guidance-card guidance-5"><div className="guidance-label">Score 4–5</div><div className="guidance-text">{q.score_5_guidance}</div></div>}
                                          </div>
                                        </details>
                                      )}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem', flexShrink: 0 }}>
                                      <ScoreButtonGroup value={sc || undefined} onChange={v => void saveScore(q, v)} />
                                      <span style={{ fontSize: '0.7rem', color: saving === q.question_id ? 'var(--brand-dark)' : sc > 0 ? 'var(--brand-dark)' : 'var(--muted-2)', fontWeight: 500 }}>
                                        {saving === q.question_id ? 'Saving…' : sc > 0 ? `Score ${sc}` : 'Not scored'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* ═══ EXECUTIVE ════════════════════════════════════════════════════════ */}
      {view === 'executive' && (
        <div style={{ display: 'grid', gap: '1.25rem' }}>
          {scorePct > 0 && (
            <div className="exec-headline">
              {moduleLabel} is currently assessed at {pct(scorePct)} ({bandDisplay(band)}).
              {findings.filter(f => f.is_priority).length > 0
                ? ` ${findings.filter(f => f.is_priority).length} critical findings require attention.`
                : ' No critical findings surfaced at current scoring level.'}
            </div>
          )}
          {/* Domain table */}
          <div className="card">
            <div className="card-header"><h3 className="card-title">Domain Scores</h3></div>
            <div className="table-scroll">
              <table className="kinto-table">
                <thead><tr><th>Domain</th><th>Score</th><th>Maturity</th><th>Answered</th></tr></thead>
                <tbody>
                  {domainScores.map(d => (
                    <tr key={d.domain_id}>
                      <td style={{ fontWeight: 600 }}>{grouped.find(g => g.domainId === d.domain_id)?.domainName || d.domain_id}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div className="progress-bar-shell" style={{ width: 64, height: 6 }}>
                            <div className={`progress-bar-fill ${Number(d.score_pct||0)<40?'danger':Number(d.score_pct||0)<65?'warn':''}`} style={{ width: `${Number(d.score_pct||0)}%` }} />
                          </div>
                          <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{Number(d.score_pct||0) > 0 ? pct(d.score_pct) : '—'}</span>
                        </div>
                      </td>
                      <td><span className={`score-band ${bandClass(d.maturity_band)}`} style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem' }}>{bandDisplay(d.maturity_band)}</span></td>
                      <td className="text-sm">{d.questions_answered}/{d.questions_total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {/* Findings */}
          {findings.length > 0 && (
            <div className="card">
              <div className="card-header"><h3 className="card-title">Key Findings</h3></div>
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {findings.slice(0,10).map((f, i) => (
                  <div key={i} className={`finding-card ${f.is_priority ? 'finding-card-critical' : 'finding-card-developing'}`}>
                    <p className="finding-card-title">{f.finding_title}</p>
                    <span className="text-xs muted-2">{f.domain_id}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ METRICS ══════════════════════════════════════════════════════════ */}
      {view === 'metrics' && (
        <div className="card">
          <div className="card-header"><h3 className="card-title">Metric Captures</h3><span className="badge badge-muted">{metrics.filter(m => m.current_value).length}/{metrics.length} captured</span></div>
          {metrics.length === 0 ? (
            <div className="empty-state"><p className="empty-state-title">No metrics available for this module.</p></div>
          ) : (
            <div style={{ display: 'grid', gap: '0.65rem' }}>
              {metrics.map(m => {
                const draft = getDraft(m.metric_id, String(m.workflow_id || ''));
                const cur = String(draft.current_value ?? m.current_value ?? '');
                const tgt = String(draft.target_value ?? m.target_value ?? '');
                return (
                  <div key={`${m.metric_id}-${m.workflow_id || ''}`} style={{ padding: '0.85rem', background: 'var(--surface-2)', borderRadius: 'var(--radius)', border: '1px solid var(--line)' }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{m.metric_name || m.metric_id}</div>
                    <div className="grid-4" style={{ gap: '0.5rem' }}>
                      <div className="field-block">
                        <span className="field-label">Current</span>
                        <input className="metric-inline-input" value={cur}
                          onChange={e => setDraft(m.metric_id, String(m.workflow_id || ''), { current_value: e.target.value })}
                          onBlur={e => void saveMetric(m.metric_id, String(m.workflow_id || ''), 'currentValue', e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                        />
                      </div>
                      <div className="field-block">
                        <span className="field-label">Target</span>
                        <input className="metric-inline-input" value={tgt}
                          onChange={e => setDraft(m.metric_id, String(m.workflow_id || ''), { target_value: e.target.value })}
                          onBlur={e => void saveMetric(m.metric_id, String(m.workflow_id || ''), 'targetValue', e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                        />
                      </div>
                      <div className="field-block">
                        <span className="field-label">Trend</span>
                        <select className="kinto-select" value={String(draft.trend_direction ?? m.trend_direction ?? '')} onChange={e => { setDraft(m.metric_id, String(m.workflow_id || ''), { trend_direction: e.target.value }); void saveMetric(m.metric_id, String(m.workflow_id || ''), 'trendDirection', e.target.value); }}>
                          {['','Up','Flat','Down','Not available'].map(o => <option key={o} value={o}>{o || 'Trend'}</option>)}
                        </select>
                      </div>
                      <div className="field-block">
                        <span className="field-label">RAG</span>
                        <select className="kinto-select" value={String(draft.rag_status ?? m.rag_status ?? '')} onChange={e => { setDraft(m.metric_id, String(m.workflow_id || ''), { rag_status: e.target.value }); void saveMetric(m.metric_id, String(m.workflow_id || ''), 'ragStatus', e.target.value); }}>
                          {['','Green','Amber','Red','Not captured'].map(o => <option key={o} value={o}>{o || 'RAG'}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ ADVISORY ════════════════════════════════════════════════════════ */}
      {view === 'advisory' && (
        <AdvisoryView
          moduleLabel={moduleLabel}
          moduleCode={moduleCode}
          scorePct={scorePct}
          maturityBand={band}
          findings={safe(data?.findingsPreview)}
          recommendations={safe(data?.recommendations)}
          actions={safe(data?.actions)}
          roadmapItems={safe(data?.roadmapItems)}
          executiveNarrative={safe(data?.executiveNarrative)}
        />
      )}

      {/* ═══ REPORT ═══════════════════════════════════════════════════════════ */}
      {view === 'report' && (
        <div className="card">
          <div className="card-header">
            <div><h3 className="card-title">{moduleLabel} Report</h3><p className="card-subtitle">Standalone DOCX and PPTX</p></div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {docxArt && <a href={`/api/reports/artifacts/${encodeURIComponent(docxArt.artifact_id)}`} className="btn btn-primary btn-sm" download>↓ DOCX</a>}
              {pptxArt && <a href={`/api/reports/artifacts/${encodeURIComponent(pptxArt.artifact_id)}`} className="btn btn-secondary btn-sm" download>↓ PPTX</a>}
              <button className="btn btn-secondary btn-sm" disabled={reportBusy || !assessmentId} onClick={() => void generateReport()}>
                {reportBusy ? 'Generating…' : standaloneReport ? 'Regenerate' : 'Generate Report'}
              </button>
            </div>
          </div>
          {reportError && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>{reportError}</p>}
          {!standaloneReport ? (
            <div className="empty-state">
              <p className="empty-state-title">No report generated yet</p>
              <p className="empty-state-sub">Click Generate Report to create your {moduleLabel} DOCX and PPTX.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {standaloneReport?.payload?.executive_summary?.headline && (
                <div className="exec-headline">{standaloneReport.payload.executive_summary.headline}</div>
              )}
              {standaloneReport?.payload?.executive_summary?.key_message && (
                <p className="text-sm muted">{standaloneReport.payload.executive_summary.key_message}</p>
              )}
              <div className="grid-3">
                <div className="stat-card"><div className="stat-card-label">Status</div><div className="stat-card-value" style={{ fontSize: '0.95rem' }}>{standaloneReport?.report?.report_status || 'Ready'}</div></div>
                <div className="stat-card"><div className="stat-card-label">DOCX</div><div className="stat-card-value" style={{ fontSize: '0.95rem' }}>{docxArt ? '✓ Available' : '—'}</div></div>
                <div className="stat-card"><div className="stat-card-label">PPTX</div><div className="stat-card-value" style={{ fontSize: '0.95rem' }}>{pptxArt ? '✓ Available' : '—'}</div></div>
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
