// @ts-nocheck
// Kinto Global — Operational Audit Assessment Client v2
'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ScoreButtonGroup } from '@/components/shared/score-button-group';
import { AdvisoryView } from '@/components/diagnostics/shared/advisory-view';
import { buildRoute } from '@/lib/routes';

// ── Types ──────────────────────────────────────────────────────────────────
type Question = {
  domain_id: string; domain_name: string; workflow_id: string; workflow_name: string;
  step_id: string; step_name: string; question_id: string; question_text: string;
  owner_role?: string; guidance?: string; audit_scoring_focus?: string;
  evidence_examples?: string; customer_impact_if_weak?: string; linked_metric?: string;
  roadmap_phase?: string; score_1_guidance?: string; score_3_guidance?: string;
  score_5_guidance?: string; priority_weight?: string;
  workflow?: Record<string, string>; primary_metric?: Record<string, string>;
};
type Workflow = {
  workflow_id: string; workflow_name: string; workflow_description?: string;
  workflow_objective?: string; typical_evidence?: string; kpi_examples?: string;
  primary_metric?: Record<string, string>;
};
type MetricCapture = {
  metric_id: string; workflow_id?: string; current_value?: string;
  target_value?: string; variance_to_target?: string; trend_direction?: string;
  rag_status?: string; unit?: string; notes?: string;
};
type ResponseRow = { question_id: string; score_1_to_5: number | null; notes?: string | null; evidence_summary?: string | null };
type Summary = {
  overall_percentage: number; overall_maturity: string; answered: number; total: number;
  domain_scores: Array<Record<string, any>>; surfaced_findings: Array<Record<string, any>>;
  priority_findings: Array<Record<string, any>>; developing_findings: Array<Record<string, any>>;
  roadmap: Array<Record<string, any>>; weakest_domains: Array<Record<string, any>>;
  strongest_domains: Array<Record<string, any>>; common_root_causes: string[];
  metrics_captured: number; metrics_total: number; automation_ready: number; ai_ready: number;
  executive_narrative?: string[];
};
type Payload = {
  assessmentId: string;
  bundle: {
    domains: Array<Record<string, string>>;
    workflows_by_domain: Record<string, Workflow[]>;
    steps_by_workflow: Record<string, Array<Record<string, string>>>;
    questions_by_step: Record<string, Question[]>;
    questions: Question[];
    roadmap_rows: Array<Record<string, string>>;
    primary_metric_by_workflow: Record<string, Record<string, string>>;
    metric_map: Record<string, Record<string, string>>;
  };
  responses: ResponseRow[];
  metricCaptures: MetricCapture[];
  summary: Summary;
};

// ── Helpers ────────────────────────────────────────────────────────────────
const TREND_OPTIONS = ['', 'Down', 'Flat', 'Up', 'Not available'];
const RAG_OPTIONS   = ['', 'Red', 'Amber', 'Green', 'Not captured'];

const PHASE_BLUEPRINT = [
  { phaseNumber: 1, phaseName: 'Design and Ownership Reset' },
  { phaseNumber: 2, phaseName: 'Execution Stabilisation' },
  { phaseNumber: 3, phaseName: 'Visibility, Automation, and Control' },
];

function bandClass(pct: number) {
  if (pct < 40) return 'score-band-critical';
  if (pct < 65) return 'score-band-developing';
  return 'score-band-strong';
}
function bandLabel(pct: number) {
  if (pct <= 0) return 'Not scored';
  if (pct < 40) return 'Critical / Weak';
  if (pct < 65) return 'Developing';
  return 'Strong / Managed';
}
function phasePill(n: number) {
  if (n === 1) return 'phase-1-pill';
  if (n === 2) return 'phase-2-pill';
  return 'phase-3-pill';
}
function withAid(path: string, aid?: string) {
  if (!aid) return path;
  return `${path}${path.includes('?') ? '&' : '?'}assessmentId=${encodeURIComponent(aid)}`;
}

// ── Inline inputs ──────────────────────────────────────────────────────────
function InlineInput({ value, onCommit, onDraft, type = 'text', placeholder = '' }: {
  value: string; onCommit: (v: string) => void; onDraft?: (v: string) => void;
  type?: 'text' | 'number'; placeholder?: string;
}) {
  return (
    <input
      className="metric-inline-input"
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={e => onDraft?.(e.target.value)}
      onBlur={e => onCommit(e.currentTarget.value)}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
    />
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
type Props = { assessmentId?: string; view?: 'assessment' | 'executive' | 'metrics' | 'report' };


// Compute domain scores live from current responses — gives instant feedback
// without waiting for background recompute to complete
function computeLiveDomainScores(
  domains: Array<{ domain_id: string; domain_name: string }>,
  questions: Array<{ question_id: string; domain_id: string }>,
  responses: Array<{ question_id: string; score_1_to_5: number | null }>
): Record<string, { percentage: number; answered: number; total: number; maturity: string }> {
  const responseMap = new Map(responses.map(r => [r.question_id, r]));
  const result: Record<string, { percentage: number; answered: number; total: number; maturity: string }> = {};
  for (const domain of domains) {
    const domainQs = questions.filter(q => q.domain_id === domain.domain_id);
    const answered = domainQs.filter(q => Number(responseMap.get(q.question_id)?.score_1_to_5 || 0) > 0);
    const rawSum = answered.reduce((s, q) => s + Number(responseMap.get(q.question_id)?.score_1_to_5 || 0), 0);
    const avgScore = answered.length > 0 ? rawSum / answered.length : 0;
    const percentage = answered.length > 0 ? Math.round((avgScore / 5) * 100) : 0;
    const maturity = percentage >= 80 ? 'Strong' : percentage >= 60 ? 'Managed' : percentage >= 40 ? 'Developing' : percentage > 0 ? 'Weak' : 'Not scored';
    result[domain.domain_id] = { percentage, answered: answered.length, total: domainQs.length, maturity };
  }
  return result;
}

export function OperationalAuditAssessmentClient({ assessmentId, view }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>(view || 'assessment');
  const [openDomains, setOpenDomains] = useState<Record<string, boolean>>({});
  const [domainFilter, setDomainFilter] = useState('All domains');
  const [searchText, setSearchText] = useState('');
  const [unansweredOnly, setUnansweredOnly] = useState(false);
  const [applyToUnanswered, setApplyToUnanswered] = useState(true);
  const [savingLabel, setSavingLabel] = useState<string | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [standaloneReport, setStandaloneReport] = useState<any>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [metricDrafts, setMetricDrafts] = useState<Record<string, Record<string, string>>>({});
  const queueRef = useRef(Promise.resolve());
  const [, startTransition] = useTransition();

  // ── Load ─────────────────────────────────────────────────────────────────
  async function load() {
    setLoading(true); setError(null);
    try {
      const [res, rptRes] = await Promise.all([
        fetch(withAid('/api/operational-audit', assessmentId), { cache: 'no-store' }),
        assessmentId
          ? fetch(`/api/assessments/${encodeURIComponent(assessmentId)}/report/OPS`, { cache: 'no-store' }).catch(() => null)
          : Promise.resolve(null),
      ]);
      const p = await res.json();
      if (!res.ok || p.ok === false) throw new Error(p.error || 'Failed to load Operational Audit.');
      const resolved = (p.data || p) as Payload;
      setData(resolved);
      const next: Record<string, boolean> = {};
      for (const d of resolved.bundle.domains || []) next[d.domain_id] = true;
      setOpenDomains(n => ({ ...next, ...n }));
      if (rptRes) {
        const rp = await rptRes.json().catch(() => null);
        if (rptRes.ok && !rp?.error) setStandaloneReport(rp?.data || rp || null);
        else { setStandaloneReport(null); if (rp?.error) setReportError(String(rp.error)); }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load.');
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [assessmentId]);
  useEffect(() => { setActiveTab(view || 'assessment'); }, [view]);

  // ── Metric draft helpers ─────────────────────────────────────────────────
  const draftKey = (mId: string, wId?: string) => `${mId}::${wId || ''}`;
  const readDraft = (mId: string, wId?: string) => metricDrafts[draftKey(mId, wId)] || {};
  const updateDraft = (mId: string, wId: string | undefined, patch: Record<string, string>) => {
    const k = draftKey(mId, wId);
    setMetricDrafts(c => ({ ...c, [k]: { ...(c[k] || {}), ...patch } }));
  };
  const clearDraft = (mId: string, wId?: string) => {
    const k = draftKey(mId, wId);
    setMetricDrafts(c => { if (!(k in c)) return c; const n = { ...c }; delete n[k]; return n; });
  };
  const merged = (mId: string, wId: string | undefined) => {
    const persisted = (data?.metricCaptures || []).find(r =>
      String(r.metric_id) === String(mId) && String(r.workflow_id || '') === String(wId || '')
    ) || {};
    return { ...persisted, ...(metricDrafts[draftKey(mId, wId)] || {}) };
  };

  // ── Optimistic update ────────────────────────────────────────────────────
  function applyOptimistic(cur: Payload, body: Record<string, unknown>): Payload {
    const action = String(body.action || '');
    if (action === 'update-question') {
      const id = String(body.questionId || '');
      const next = [...(cur.responses || [])];
      const idx = next.findIndex(r => r.question_id === id);
      const existing = idx >= 0 ? next[idx] : { question_id: id };
      const row = { ...existing, question_id: id,
        score_1_to_5: typeof body.score === 'number' ? body.score : (existing as any).score_1_to_5,
        notes: typeof body.notes === 'string' ? body.notes : (existing as any).notes,
        evidence_summary: typeof body.evidenceSummary === 'string' ? body.evidenceSummary : (existing as any).evidence_summary,
      };
      if (idx >= 0) next[idx] = row as any; else next.push(row as any);
      return { ...cur, responses: next };
    }
    if (action === 'bulk-score') {
      const updates = Array.isArray(body.updates) ? body.updates as Array<Record<string, unknown>> : [];
      const next = [...(cur.responses || [])];
      for (const u of updates) {
        const id = String(u.questionId || '');
        const idx = next.findIndex(r => r.question_id === id);
        const existing = idx >= 0 ? next[idx] : { question_id: id };
        const row = { ...existing, question_id: id, score_1_to_5: Number(u.score || 0) };
        if (idx >= 0) next[idx] = row as any; else next.push(row as any);
      }
      return { ...cur, responses: next };
    }
    if (action === 'update-metric') {
      const mId = String(body.metricId || ''); const wId = String(body.workflowId || '');
      const next = [...(cur.metricCaptures || [])];
      const idx = next.findIndex(r => String(r.metric_id) === mId && String(r.workflow_id || '') === wId);
      const existing = idx >= 0 ? next[idx] : { metric_id: mId, workflow_id: wId };
      const row = { ...existing, metric_id: mId, workflow_id: wId,
        current_value: body.currentValue ?? (existing as any).current_value,
        target_value:  body.targetValue  ?? (existing as any).target_value,
        trend_direction: body.trendDirection ?? (existing as any).trend_direction,
        rag_status: body.ragStatus ?? (existing as any).rag_status,
      };
      if (idx >= 0) next[idx] = row as any; else next.push(row as any);
      return { ...cur, metricCaptures: next };
    }
    return cur;
  }

  // ── Commit ────────────────────────────────────────────────────────────────
  async function commit(body: Record<string, unknown>, label: string) {
    const prev = data;
    setSavingLabel(label);
    setError(null);
    if (prev) setData(applyOptimistic(prev, body));
    const execute = async () => {
      const res = await fetch(withAid('/api/operational-audit', assessmentId), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assessmentId, ...body }),
      });
      const raw = await res.text();
      let p: any = null;
      try { p = raw ? JSON.parse(raw) : null; } catch { /**/ }
      if (!res.ok || p?.ok === false) throw new Error(p?.error || raw || 'Save failed.');
      // Handle response based on what's returned
      if (body.action === 'update-metric') {
        if (p?.metricCaptures) setData(c => c ? { ...c, metricCaptures: p.metricCaptures } : c);
        clearDraft(String(body.metricId || ''), String(body.workflowId || ''));
      } else if (p?.responses && !p?.bundle) {
        // Slim response (just responses array) — merge into existing data
        setData(c => c ? { ...c, responses: p.responses } : c);
      } else if (p && (p.bundle || p.data?.bundle)) {
        setData((p.data || p) as Payload);
      }
    };
    try {
      if (body.action === 'update-metric') {
        queueRef.current = queueRef.current.then(execute);
        await queueRef.current;
      } else { await execute(); }
    } catch (err) {
      if (body.action !== 'update-metric' && prev) setData(prev);
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally { startTransition(() => setSavingLabel(null)); }
  }

  // ── Computed values ───────────────────────────────────────────────────────
  const responseMap = useMemo(
    () => new Map((data?.responses || []).map(r => [r.question_id, r])), [data]);
  const metricMap = useMemo(
    () => new Map((data?.metricCaptures || []).map(r => [`${r.metric_id}::${r.workflow_id || ''}`, r])), [data]);

  const groupedDomains = useMemo(() => {
    if (!data) return [];
    const search = searchText.trim().toLowerCase();
    const selDomain = data.bundle.domains.find(d => d.domain_name === domainFilter);
    const selDomainId = selDomain?.domain_id || '';
    return data.bundle.domains
      .filter(d => !selDomainId || d.domain_id === selDomainId)
      .map(domain => {
        const workflows = (data.bundle.workflows_by_domain[domain.domain_id] || []).map(wf => {
          const steps = (data.bundle.steps_by_workflow[wf.workflow_id] || []).map(step => {
            const questions = (data.bundle.questions_by_step[step.step_id] || []).filter(q => {
              const sc = Number(responseMap.get(q.question_id)?.score_1_to_5 || 0);
              if (unansweredOnly && sc > 0) return false;
              if (search) {
                const hay = [q.question_text, q.question_id, q.workflow_name, q.owner_role, q.evidence_examples].join(' ').toLowerCase();
                if (!hay.includes(search)) return false;
              }
              return true;
            });
            return { ...step, questions };
          }).filter(s => s.questions.length > 0);
          return { ...wf, steps };
        }).filter(wf => wf.steps.length > 0);
        return { domain, workflows };
      }).filter(d => d.workflows.length > 0);
  }, [data, domainFilter, searchText, unansweredOnly, responseMap]);

  const roadmapByPhase = useMemo(() => {
    if (!data) return {} as Record<string, any[]>;
    const byPhase = (data.summary.roadmap || []).reduce<Record<string, any[]>>((acc, row) => {
      (acc[String(row.phase_name || 'Unphased')] ||= []).push(row);
      return acc;
    }, {});
    const result: Record<string, any[]> = {};
    for (const ph of PHASE_BLUEPRINT) {
      const rows = byPhase[ph.phaseName] || [];
      result[ph.phaseName] = rows.slice(0, 6);
    }
    return result;
  }, [data]);

  // Live domain scores: recalculated from current responses on every change
  // These update immediately when a score button is clicked (no wait for background recompute)
  const liveDomainScores = useMemo(() => {
    if (!data) return {};
    return computeLiveDomainScores(
      data.bundle.domains || [],
      data.bundle.questions || [],
      data.responses || []
    );
  }, [data]);

  const domainScoreMap = useMemo(() => {
    const serverMap = new Map((data?.summary.domain_scores || []).map((d: any) => [d.domain_id, d]));
    // Merge: use live scores for percentage/answered, keep server data for other fields
    const merged = new Map<string, any>();
    for (const [dId, liveScore] of Object.entries(liveDomainScores)) {
      const server = serverMap.get(dId) || {};
      merged.set(dId, { ...server, percentage: liveScore.percentage, answered: liveScore.answered, total: liveScore.total, maturity: liveScore.maturity });
    }
    // Also add any server-only entries
    for (const [dId, serverScore] of serverMap.entries()) {
      if (!merged.has(dId)) merged.set(dId, serverScore);
    }
    return merged;
  }, [data, liveDomainScores]);

  // ── Metric snapshot display helper ────────────────────────────────────────
  function metricDisplay(def: Record<string, string> | undefined, capture?: MetricCapture) {
    if (!def) return null;
    const unit = String(def.unit || capture?.unit || '');
    const fmt = (v?: string) => { const s = String(v || '').trim(); return s && unit && !s.includes(unit) ? `${s} ${unit}` : s; };
    return {
      metric_name: def.metric_name || '',
      why_it_matters: def.why_it_matters || '',
      target_guidance: def.target_guidance || '',
      owner_role: def.owner_role || '',
      current_display: fmt(capture?.current_value),
      target_display: fmt(capture?.target_value),
      variance_display: String(capture?.variance_to_target || 'Not calculated'),
      rag_display: String(capture?.rag_status || (capture?.current_value ? 'Captured' : 'Not captured')),
      trend_display: String(capture?.trend_direction || 'Not set'),
      captured: Boolean(String(capture?.current_value || '').trim() || String(capture?.target_value || '').trim()),
    };
  }

  // ── Tab navigation ────────────────────────────────────────────────────────
  function goTab(tab: string) {
    setActiveTab(tab);
    const cId = searchParams.get('clientId') || '';
    const aId = searchParams.get('assessmentId') || assessmentId || '';
    router.push(buildRoute(pathname || '/diagnostics/operational-audit', { clientId: cId || null, assessmentId: aId || null, view: tab }));
  }

  const activeView = view || activeTab;

  // ── Live stats — computed from responses, null-safe, always called ─────────
  // IMPORTANT: These must be before any early returns (Rules of Hooks)
  const liveAnswered = useMemo(
    () => (data?.responses || []).filter(r => Number(r.score_1_to_5 || 0) > 0).length,
    [data?.responses]
  );
  const liveTotal = data?.bundle?.questions?.length ?? 0;
  const liveRaw = useMemo(
    () => (data?.responses || []).reduce((s, r) => s + (Number(r.score_1_to_5 || 0) > 0 ? Number(r.score_1_to_5) : 0), 0),
    [data?.responses]
  );
  const liveAvg = liveAnswered > 0 ? liveRaw / liveAnswered : 0;
  const liveScorePct = liveAnswered > 0 ? Math.round((liveAvg / 5) * 100) : 0;
  const liveBand = liveScorePct >= 80 ? 'Strong' : liveScorePct >= 60 ? 'Managed' : liveScorePct >= 40 ? 'Developing' : liveScorePct > 0 ? 'Weak' : 'Not scored';
  const liveCritical = useMemo(
    () => (data?.responses || []).filter(r => Number(r.score_1_to_5 || 0) > 0 && Number(r.score_1_to_5) <= 2).length,
    [data?.responses]
  );

  // ── States ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 0', color: 'var(--muted)' }}>
        <span style={{ display: 'inline-block', width: 18, height: 18, borderRadius: '50%', border: '2px solid var(--brand)', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
        Loading Operational Audit…
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );

  if (error && !data) return (
    <div className="card">
      <p style={{ color: 'var(--danger)', marginBottom: '0.75rem' }}>{error}</p>
      <button className="btn btn-secondary" onClick={() => void load()}>Retry</button>
    </div>
  );

  if (!data) return null;

  const { summary } = data;
  const artList = standaloneReport?.artifacts || [];
  const docxArt = artList.find((a: any) => a.file_type === 'docx');
  const pptxArt = artList.find((a: any) => a.file_type === 'pptx');

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Status bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div className="view-tabs" style={{ flex: 1, borderBottom: 'none', marginBottom: 0 }}>
          {['assessment','executive','metrics','advisory','report'].map(t => (
            <button key={t} type="button" className={`view-tab${activeView === t ? ' active' : ''}`} onClick={() => goTab(t)}>
              {t === 'assessment' ? 'Assessment' : t === 'executive' ? 'Executive Dashboard' : t === 'metrics' ? 'Metrics' : t === 'advisory' ? 'Advisory' : 'Report Preview'}
            </button>
          ))}
        </div>
        {savingLabel && (
          <span className="saving-indicator">
            <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--brand)', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
            {savingLabel}…
          </span>
        )}
        {error && <span style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>{error}</span>}
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem' }}>
        {[
          { label: 'Questions', value: `${liveAnswered}/${liveTotal}`, sub: 'Answered' },
          { label: 'Score', value: liveScorePct > 0 ? `${liveScorePct}%` : '—', sub: liveBand },
          { label: 'Critical/Weak', value: String(liveCritical), sub: 'Scores 1–2 (live)' },
          { label: 'Developing', value: String(summary.developing_findings?.length || 0), sub: 'Score 3' },
          { label: 'Roadmap', value: String(summary.roadmap?.length || 0), sub: 'Priority actions' },
          { label: 'Metrics', value: `${summary.metrics_captured || 0}/${summary.metrics_total || 0}`, sub: 'Captured' },
        ].map(k => (
          <div key={k.label} className="stat-card">
            <div className="stat-card-label">{k.label}</div>
            <div className="stat-card-value" style={{ fontSize: '1.3rem' }}>{k.value}</div>
            <div className="stat-card-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ══ ASSESSMENT TAB ══════════════════════════════════════════════════ */}
      {activeView === 'assessment' && (
        <>
          <ModuleIntro moduleCode="OPS" moduleName="Operational Audit" hasScores={(liveAnswered || 0) > 0} />
          {/* Filters */}
          <div className="card">
            <div className="card-header"><h3 className="card-title">Filters & Controls</h3></div>
            <div className="grid-2" style={{ alignItems: 'end', gap: '0.75rem' }}>
              <div className="field-block">
                <span className="field-label">Domain</span>
                <select className="kinto-select" value={domainFilter} onChange={e => setDomainFilter(e.target.value)}>
                  <option>All domains</option>
                  {data.bundle.domains.map(d => <option key={d.domain_id}>{d.domain_name}</option>)}
                </select>
              </div>
              <div className="field-block">
                <span className="field-label">Search</span>
                <input className="kinto-input" value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Question text, workflow, owner…" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={unansweredOnly} onChange={e => setUnansweredOnly(e.target.checked)} />
                Unanswered only
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={applyToUnanswered} onChange={e => setApplyToUnanswered(e.target.checked)} />
                Master score → unanswered only
              </label>
            </div>
          </div>

          {groupedDomains.length === 0 && (
            <div className="card"><div className="empty-state"><p className="empty-state-title">No questions match current filters.</p></div></div>
          )}

          {/* Domain blocks */}
          {groupedDomains.map(({ domain, workflows }) => {
            const ds = domainScoreMap.get(domain.domain_id) || {};
            const allQs = workflows.flatMap(wf => wf.steps.flatMap(s => s.questions));
            const answered = allQs.filter(q => Number(responseMap.get(q.question_id)?.score_1_to_5 || 0) > 0).length;
            const isOpen = openDomains[domain.domain_id] ?? true;
            const domPct = Number(ds.percentage || 0);

            return (
              <div key={domain.domain_id} className="domain-block">
                {/* Domain header */}
                <button type="button" className="domain-header" onClick={() => setOpenDomains(c => ({ ...c, [domain.domain_id]: !isOpen }))}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flex: 1 }}>
                    <div>
                      <h3 className="domain-title">{domain.domain_name}</h3>
                      {(() => {
                        const live = liveDomainScores[domain.domain_id];
                        const displayPct = live?.percentage ?? domPct;
                        const displayAns = live?.answered ?? answered;
                        return (
                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                            <span className="text-xs muted-2">{displayAns}/{allQs.length} answered</span>
                            {displayPct > 0 && (
                              <>
                                <span className="text-xs muted-2">·</span>
                                <span style={{ fontWeight: 700, fontSize: '0.875rem', color: displayPct < 40 ? 'var(--danger)' : displayPct < 65 ? 'var(--warn)' : 'var(--brand-dark)' }}>{Math.round(displayPct)}%</span>
                                <span className={`score-band ${bandClass(displayPct)}`} style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem' }}>{bandLabel(displayPct)}</span>
                              </>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  <span style={{ color: 'var(--muted)', fontSize: '1.2rem' }}>{isOpen ? '▲' : '▼'}</span>
                </button>

                {isOpen && (
                  <div className="domain-body">
                    {/* Master score row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', padding: '0.75rem', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--muted)' }}>Apply score to {applyToUnanswered ? 'unanswered' : 'all'} visible questions:</span>
                      <ScoreButtonGroup onChange={score => {
                        const updates = allQs
                          .filter(q => !applyToUnanswered || Number(responseMap.get(q.question_id)?.score_1_to_5 || 0) === 0)
                          .map(q => ({ questionId: q.question_id, score }));
                        if (updates.length) void commit({ action: 'bulk-score', updates }, `${domain.domain_name} bulk score`);
                      }} />
                    </div>

                    {/* Workflows */}
                    {workflows.map(wf => {
                      const metDef = wf.primary_metric || data.bundle.primary_metric_by_workflow[wf.workflow_id];
                      const wfAnswered = wf.steps.flatMap(s => s.questions).filter(q => Number(responseMap.get(q.question_id)?.score_1_to_5 || 0) > 0).length;
                      const wfTotal   = wf.steps.flatMap(s => s.questions).length;

                      return (
                        <div key={wf.workflow_id} className="workflow-block" style={{ marginBottom: '0.75rem' }}>
                          {/* Workflow header */}
                          <div className="workflow-header" style={{ cursor: 'default' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <h4 className="workflow-title">{wf.workflow_name}</h4>
                                <span className="text-xs muted-2">{wfAnswered}/{wfTotal}</span>
                              </div>
                              {wf.workflow_objective && <p className="text-xs muted-2" style={{ marginTop: '0.25rem' }}>{wf.workflow_objective}</p>}
                              {wf.typical_evidence && <p className="text-xs muted-2">Evidence: {wf.typical_evidence}</p>}
                            </div>
                          </div>

                          <div className="workflow-body">
                            {/* Metric evidence */}
                            {metDef && (() => {
                              const cap = merged(metDef.metric_id, wf.workflow_id) as MetricCapture;
                              const disp = metricDisplay(metDef, cap);
                              return (
                                <details style={{ marginBottom: '0.85rem' }}>
                                  <summary style={{ cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: 'var(--brand-dark)', padding: '0.5rem', background: 'var(--brand-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--brand-border)', listStyle: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span>📊</span> Metric: {metDef.metric_name}
                                    {disp?.captured && <span className="badge badge-success" style={{ marginLeft: 'auto', fontSize: '0.68rem' }}>Captured</span>}
                                  </summary>
                                  <div style={{ padding: '0.85rem', background: 'var(--surface-2)', borderRadius: '0 0 var(--radius-sm) var(--radius-sm)', border: '1px solid var(--line)', borderTop: 'none' }}>
                                    {metDef.why_it_matters && <p className="text-xs muted-2" style={{ marginBottom: '0.75rem' }}>{metDef.why_it_matters}</p>}
                                    <div className="grid-4" style={{ gap: '0.5rem', marginBottom: '0.5rem' }}>
                                      <div className="field-block">
                                        <span className="field-label">Target</span>
                                        <InlineInput
                                          value={String(cap?.target_value || '')}
                                          onDraft={v => updateDraft(metDef.metric_id, wf.workflow_id, { target_value: v })}
                                          onCommit={v => void commit({ action: 'update-metric', metricId: metDef.metric_id, workflowId: wf.workflow_id, targetValue: v, currentValue: String(merged(metDef.metric_id, wf.workflow_id)?.current_value || ''), trendDirection: String(merged(metDef.metric_id, wf.workflow_id)?.trend_direction || ''), ragStatus: String(merged(metDef.metric_id, wf.workflow_id)?.rag_status || '') }, `${metDef.metric_name} target`)}
                                          placeholder={metDef.target_guidance || 'Target'}
                                        />
                                      </div>
                                      <div className="field-block">
                                        <span className="field-label">Current</span>
                                        <InlineInput
                                          value={String(cap?.current_value || '')}
                                          onDraft={v => updateDraft(metDef.metric_id, wf.workflow_id, { current_value: v })}
                                          onCommit={v => void commit({ action: 'update-metric', metricId: metDef.metric_id, workflowId: wf.workflow_id, currentValue: v, targetValue: String(merged(metDef.metric_id, wf.workflow_id)?.target_value || ''), trendDirection: String(merged(metDef.metric_id, wf.workflow_id)?.trend_direction || ''), ragStatus: String(merged(metDef.metric_id, wf.workflow_id)?.rag_status || '') }, `${metDef.metric_name} current`)}
                                          placeholder="Current value"
                                        />
                                      </div>
                                      <div className="field-block">
                                        <span className="field-label">Trend</span>
                                        <select className="kinto-select" value={String(cap?.trend_direction || '')} onChange={e => { updateDraft(metDef.metric_id, wf.workflow_id, { trend_direction: e.target.value }); void commit({ action: 'update-metric', metricId: metDef.metric_id, workflowId: wf.workflow_id, trendDirection: e.target.value, currentValue: String(merged(metDef.metric_id, wf.workflow_id)?.current_value || ''), targetValue: String(merged(metDef.metric_id, wf.workflow_id)?.target_value || ''), ragStatus: String(merged(metDef.metric_id, wf.workflow_id)?.rag_status || '') }, `${metDef.metric_name} trend`); }}>
                                          {TREND_OPTIONS.map(o => <option key={o} value={o}>{o || 'Select trend'}</option>)}
                                        </select>
                                      </div>
                                      <div className="field-block">
                                        <span className="field-label">RAG</span>
                                        <select className="kinto-select" value={String(cap?.rag_status || '')} onChange={e => { updateDraft(metDef.metric_id, wf.workflow_id, { rag_status: e.target.value }); void commit({ action: 'update-metric', metricId: metDef.metric_id, workflowId: wf.workflow_id, ragStatus: e.target.value, currentValue: String(merged(metDef.metric_id, wf.workflow_id)?.current_value || ''), targetValue: String(merged(metDef.metric_id, wf.workflow_id)?.target_value || ''), trendDirection: String(merged(metDef.metric_id, wf.workflow_id)?.trend_direction || '') }, `${metDef.metric_name} RAG`); }}>
                                          {RAG_OPTIONS.map(o => <option key={o} value={o}>{o || 'Select RAG'}</option>)}
                                        </select>
                                      </div>
                                    </div>
                                    {disp && <p className="text-xs muted-2">Gap: {disp.variance_display} · Status: {disp.rag_display} · Trend: {disp.trend_display}</p>}
                                  </div>
                                </details>
                              );
                            })()}

                            {/* Questions */}
                            {wf.steps.map(step => (
                              <div key={step.step_id} style={{ marginBottom: '0.75rem' }}>
                                <h4 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted-2)', marginBottom: '0.5rem' }}>{step.step_name}</h4>
                                <div style={{ display: 'grid', gap: '0.65rem' }}>
                                  {step.questions.map(q => {
                                    const resp = responseMap.get(q.question_id);
                                    const sc = Number(resp?.score_1_to_5 || 0);
                                    const cardCls = sc === 0 ? '' : sc <= 2 ? ' question-card critical' : sc === 3 ? '' : ' question-card answered';
                                    return (
                                      <div key={q.question_id} className={`question-card${cardCls}`}>
                                        <div className="question-card-head">
                                          <div>
                                            <span className="badge" style={{ fontSize: '0.68rem', marginBottom: '0.3rem' }}>{q.question_id}</span>
                                            <p className="question-text">{q.question_text}</p>
                                            {q.evidence_examples && <p className="text-xs muted-2"><strong>Evidence:</strong> {q.evidence_examples}</p>}
                                            {q.customer_impact_if_weak && sc > 0 && sc <= 2 && (
                                              <p className="text-xs" style={{ color: 'var(--danger)', marginTop: '0.25rem' }}>⚠ {q.customer_impact_if_weak}</p>
                                            )}
                                            {/* Score guidance */}
                                            {(q.score_1_guidance || q.score_3_guidance || q.score_5_guidance) && (
                                              <div className="guidance-grid">
                                                {q.score_1_guidance && <div className="guidance-card guidance-1"><div className="guidance-label">Score 1–2</div><div className="guidance-text">{q.score_1_guidance}</div></div>}
                                                {q.score_3_guidance && <div className="guidance-card guidance-3"><div className="guidance-label">Score 3</div><div className="guidance-text">{q.score_3_guidance}</div></div>}
                                                {q.score_5_guidance && <div className="guidance-card guidance-5"><div className="guidance-label">Score 4–5</div><div className="guidance-text">{q.score_5_guidance}</div></div>}
                                              </div>
                                            )}
                                          </div>
                                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem', flexShrink: 0 }}>
                                            <ScoreButtonGroup
                                              value={sc || undefined}
                                              onChange={v => void commit({ action: 'update-question', questionId: q.question_id, score: v }, `${q.question_id}`)}
                                            />
                                            <span style={{ fontSize: '0.7rem', color: sc > 0 ? 'var(--brand-dark)' : 'var(--muted-2)', fontWeight: 500 }}>
                                              {sc > 0 ? `Score ${sc}` : 'Not scored'}
                                            </span>
                                            {q.owner_role && <span style={{ fontSize: '0.68rem', color: 'var(--muted-2)' }}>{q.owner_role}</span>}
                                          </div>
                                        </div>
                                        {/* Notes */}
                                        <div className="grid-2" style={{ marginTop: '0.5rem', gap: '0.5rem' }}>
                                          <div className="field-block">
                                            <span className="field-label">Notes</span>
                                            <textarea className="kinto-textarea" style={{ minHeight: 60, fontSize: '0.82rem' }}
                                              defaultValue={String(resp?.notes || '')}
                                              key={`${q.question_id}-n-${resp?.notes || ''}`}
                                              rows={2}
                                              onBlur={e => { const v = e.currentTarget.value; if (v !== String(resp?.notes || '')) void commit({ action: 'update-question', questionId: q.question_id, notes: v }, `${q.question_id} notes`); }}
                                            />
                                          </div>
                                          <div className="field-block">
                                            <span className="field-label">Evidence</span>
                                            <textarea className="kinto-textarea" style={{ minHeight: 60, fontSize: '0.82rem' }}
                                              defaultValue={String(resp?.evidence_summary || '')}
                                              key={`${q.question_id}-e-${resp?.evidence_summary || ''}`}
                                              rows={2}
                                              onBlur={e => { const v = e.currentTarget.value; if (v !== String(resp?.evidence_summary || '')) void commit({ action: 'update-question', questionId: q.question_id, evidenceSummary: v }, `${q.question_id} evidence`); }}
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}

                    {/* Domain findings summary */}
                    {(() => {
                      const ds2 = domainScoreMap.get(domain.domain_id) || {};
                      const snaps = (ds2.metric_snapshots || []) as any[];
                      if (!snaps.length) return null;
                      return (
                        <div style={{ marginTop: '0.75rem' }}>
                          <h4 style={{ marginBottom: '0.5rem' }}>Supporting Metrics</h4>
                          <div className="table-scroll">
                            <table className="kinto-table">
                              <thead><tr><th>Metric</th><th>Current</th><th>Target</th><th>Gap</th><th>RAG</th></tr></thead>
                              <tbody>
                                {snaps.map((m: any) => (
                                  <tr key={m.metric_fact_id || `${domain.domain_id}-${m.workflow_id || ''}-${m.metric_id || m.metric_name}`}>
                                    <td style={{ fontWeight: 600 }}>{m.metric_name}</td>
                                    <td>{m.current_display || <span className="muted-2 text-xs">Not captured</span>}</td>
                                    <td>{m.target_display || m.target_guidance || '—'}</td>
                                    <td>{m.variance_display || '—'}</td>
                                    <td><span className={`badge ${m.rag_display === 'Green' ? 'badge-success' : m.rag_display === 'Amber' ? 'badge-warn' : m.rag_display === 'Red' ? 'badge-danger' : 'badge-muted'}`}>{m.rag_display || '—'}</span></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* ══ EXECUTIVE DASHBOARD ══════════════════════════════════════════════ */}
      {activeView === 'executive' && (
        <div style={{ display: 'grid', gap: '1.25rem' }}>
          {/* Narrative */}
          {summary.overall_percentage > 0 && (
            <div className="exec-headline">
              {(summary.executive_narrative || []).join(' ') ||
                `Operational maturity stands at ${Math.round(summary.overall_percentage)}% (${summary.overall_maturity}). ${
                  summary.weakest_domains?.length
                    ? `Most exposed domains: ${summary.weakest_domains.slice(0,3).map((d:any) => d.domain_name).join(', ')}.`
                    : ''
                }`}
            </div>
          )}

          {/* What this means */}
          <div className="grid-3">
            {[
              { title: 'Commercial Exposure', text: summary.priority_findings?.length > 0 ? `${summary.priority_findings.length} critical/weak findings create direct exposure in revenue continuity, service quality, and management control. These require immediate attention.` : 'No critical findings surfaced yet. Complete the assessment to identify commercial exposures.' },
              { title: 'Operational Risk', text: summary.common_root_causes?.length > 0 ? `Recurring root causes: ${summary.common_root_causes.slice(0,3).join('; ')}. These patterns indicate systemic gaps rather than isolated incidents.` : 'Root cause analysis will populate once the assessment is scored.' },
              { title: 'Transformation Readiness', text: `${summary.automation_ready || 0} automation and ${summary.ai_ready || 0} AI opportunities surfaced. These are viable only after process ownership and execution stability are in place.` },
            ].map(c => (
              <div key={c.title} className="card" style={{ borderTop: '3px solid var(--brand)' }}>
                <h4 style={{ marginBottom: '0.5rem' }}>{c.title}</h4>
                <p className="text-sm muted">{c.text}</p>
              </div>
            ))}
          </div>

          {/* Domain score matrix */}
          <div className="card">
            <div className="card-header"><h3 className="card-title">Assessment Snapshot</h3><p className="card-subtitle">Domain scores, maturity, and finding volumes</p></div>
            <div className="table-scroll">
              <table className="kinto-table">
                <thead><tr><th>Domain</th><th>Score</th><th>Maturity</th><th>Answered</th><th>Critical</th><th>Developing</th><th>Metrics</th></tr></thead>
                <tbody>
                  {summary.domain_scores.map((d: any) => (
                    <tr key={d.domain_id}>
                      <td style={{ fontWeight: 600 }}>{d.domain_name}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div className="progress-bar-shell" style={{ width: 60, height: 6 }}>
                            <div className={`progress-bar-fill ${Number(d.percentage||0)<40?'danger':Number(d.percentage||0)<65?'warn':''}`} style={{ width: `${Number(d.percentage||0)}%` }} />
                          </div>
                          <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{Number(d.percentage||0) > 0 ? `${Math.round(d.percentage)}%` : '—'}</span>
                        </div>
                      </td>
                      <td><span className={`score-band ${bandClass(Number(d.percentage||0))}`} style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem' }}>{bandLabel(Number(d.percentage||0))}</span></td>
                      <td className="text-sm">{d.answered}/{d.total}</td>
                      <td><span style={{ fontWeight: 700, color: Number(d.priority_findings||0) > 0 ? 'var(--danger)' : 'var(--muted-2)' }}>{d.priority_findings || 0}</span></td>
                      <td><span style={{ fontWeight: 700, color: Number(d.developing_findings||0) > 0 ? 'var(--warn)' : 'var(--muted-2)' }}>{d.developing_findings || 0}</span></td>
                      <td className="text-sm">{d.metrics_captured || 0}/{d.metrics_total || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Priority findings */}
          {summary.priority_findings?.length > 0 && (
            <div className="card">
              <div className="card-header"><h3 className="card-title">Priority Findings</h3><span className="badge badge-danger">{summary.priority_findings.length} critical / weak</span></div>
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {summary.priority_findings.slice(0,10).map((f: any, i: number) => (
                  <div key={f.question_id || i} className="finding-card finding-card-critical">
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                      <span className="badge badge-danger" style={{ fontSize: '0.68rem', flexShrink: 0 }}>Score {f.score}</span>
                      <div>
                        <p className="finding-card-title">{f.finding_title || f.question_text}</p>
                        {f.business_impact && <p className="finding-card-impact">{f.business_impact}</p>}
                        {f.likely_root_cause && <p className="text-xs muted-2" style={{ marginTop: '0.2rem' }}>Root cause: {f.likely_root_cause}</p>}
                      </div>
                      <span className="text-xs muted-2" style={{ marginLeft: 'auto', flexShrink: 0 }}>{f.domain_name}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Roadmap */}
          {summary.roadmap?.length > 0 && (
            <div className="card">
              <div className="card-header"><h3 className="card-title">Priority Improvement Roadmap</h3></div>
              {PHASE_BLUEPRINT.map(ph => {
                const rows = roadmapByPhase[ph.phaseName] || [];
                if (!rows.length) return null;
                return (
                  <div key={ph.phaseName} style={{ marginBottom: '1.25rem' }}>
                    <div className="roadmap-phase-header">
                      <span className={`roadmap-phase-pill ${phasePill(ph.phaseNumber)}`}>Phase {ph.phaseNumber}</span>
                      <h4 style={{ margin: 0 }}>{ph.phaseName}</h4>
                    </div>
                    <div style={{ display: 'grid', gap: '0.5rem' }}>
                      {rows.map((r: any, i: number) => (
                        <div key={r.question_id || i} className="roadmap-card">
                          <div className="roadmap-card-title">{r.milestone_name || r.action_title || r.question_text}</div>
                          {r.milestone_description && <p className="text-xs muted-2">{r.milestone_description}</p>}
                          <div className="roadmap-card-meta">
                            {r.owner_role && <span className="badge badge-muted">{r.owner_role}</span>}
                            {r.domain_name && <span className="badge badge-muted">{r.domain_name}</span>}
                            {r.automation_flag === 'Yes' && <span className="badge badge-info">⚡ Automation</span>}
                            {r.ai_flag === 'Yes' && <span className="badge badge-info">🤖 AI</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══ METRICS TAB ══════════════════════════════════════════════════════ */}
      {activeView === 'metrics' && (
        <div className="card">
          <div className="card-header">
            <div><h3 className="card-title">Metric Tracker</h3><p className="card-subtitle">All workflow metrics for this assessment</p></div>
            <span className="badge badge-muted">{summary.metrics_captured || 0}/{summary.metrics_total || 0} captured</span>
          </div>
          <div className="table-scroll">
            <table className="kinto-table">
              <thead><tr><th>Domain</th><th>Metric</th><th>Current</th><th>Target</th><th>Gap</th><th>Trend</th><th>RAG</th></tr></thead>
              <tbody>
                {summary.domain_scores.flatMap((d: any) =>
                  (d.metric_snapshots || []).map((m: any) => (
                    <tr key={m.metric_fact_id || `${d.domain_id}-${m.workflow_id}-${m.metric_id || m.metric_name}`}>
                      <td className="text-xs muted-2">{d.domain_name}</td>
                      <td style={{ fontWeight: 600 }}>{m.metric_name}{m.why_it_matters && <div className="text-xs muted-2" style={{ fontWeight: 400 }}>{m.why_it_matters}</div>}</td>
                      <td>{m.current_display || <span className="text-xs muted-2">Not captured</span>}</td>
                      <td>{m.target_display || m.target_guidance || '—'}</td>
                      <td>{m.variance_display || '—'}</td>
                      <td>{m.trend_display || '—'}</td>
                      <td><span className={`badge ${m.rag_display==='Green'?'badge-success':m.rag_display==='Amber'?'badge-warn':m.rag_display==='Red'?'badge-danger':'badge-muted'}`}>{m.rag_display || '—'}</span></td>
                    </tr>
                  ))
                )}
                {summary.domain_scores.every((d: any) => !(d.metric_snapshots || []).length) && (
                  <tr><td colSpan={7}><div className="empty-state"><p className="empty-state-title">No metrics captured yet.</p><p className="empty-state-sub">Enter metric values in the Assessment tab for each workflow.</p></div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ ADVISORY ══════════════════════════════════════════════════════════ */}
      {activeView === 'advisory' && (
        <AdvisoryView
          moduleLabel="Operational Audit"
          moduleCode="OPS"
          scorePct={summary.overall_percentage}
          maturityBand={summary.overall_maturity}
          surfacedFindings={summary.surfaced_findings || []}
          roadmapItems={summary.roadmap || []}
          executiveNarrative={summary.executive_narrative || []}
        />
      )}

      {/* ══ REPORT PREVIEW ══════════════════════════════════════════════════ */}
      {activeView === 'report' && (
        <div className="card">
          <div className="card-header">
            <div><h3 className="card-title">Operational Audit Report</h3><p className="card-subtitle">Standalone module DOCX and PPTX</p></div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {docxArt && <a href={`/api/reports/artifacts/${encodeURIComponent(docxArt.artifact_id)}`} className="btn btn-primary btn-sm" download>↓ DOCX</a>}
              {pptxArt && <a href={`/api/reports/artifacts/${encodeURIComponent(pptxArt.artifact_id)}`} className="btn btn-secondary btn-sm" download>↓ PPTX</a>}
              <button className="btn btn-secondary btn-sm" disabled={reportBusy || !assessmentId} onClick={async () => {
                try {
                  setReportBusy(true); setReportError(null);
                  const r = await fetch(`/api/assessments/${encodeURIComponent(assessmentId!)}/report/OPS`, { method: 'POST' });
                  const raw = await r.text(); let p: any = null;
                  try { p = JSON.parse(raw); } catch {/**/}
                  if (!r.ok || p?.error) throw new Error(p?.error || raw || 'Failed.');
                  setStandaloneReport(p?.data || p || null);
                  await load();
                } catch (e) { setReportError(e instanceof Error ? e.message : 'Failed.'); }
                finally { setReportBusy(false); }
              }}>
                {reportBusy ? 'Generating…' : standaloneReport ? 'Regenerate' : 'Generate Report'}
              </button>
            </div>
          </div>

          {reportError && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{reportError}</p>}

          {!standaloneReport ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <p className="empty-state-title">No report generated yet</p>
              <p className="empty-state-sub">Click Generate Report to create your Operational Audit DOCX and PPTX.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div className="grid-4">
                <div className="stat-card"><div className="stat-card-label">Status</div><div className="stat-card-value" style={{ fontSize: '1rem' }}>{standaloneReport?.report?.report_status || 'Ready'}</div></div>
                <div className="stat-card"><div className="stat-card-label">Artifacts</div><div className="stat-card-value" style={{ fontSize: '1rem' }}>{artList.length}</div></div>
                <div className="stat-card"><div className="stat-card-label">DOCX</div><div className="stat-card-value" style={{ fontSize: '1rem' }}>{docxArt ? '✓' : '—'}</div></div>
                <div className="stat-card"><div className="stat-card-label">PPTX</div><div className="stat-card-value" style={{ fontSize: '1rem' }}>{pptxArt ? '✓' : '—'}</div></div>
              </div>
              {standaloneReport?.payload?.executive_summary?.headline && (
                <div className="exec-headline">{standaloneReport.payload.executive_summary.headline}</div>
              )}
              {standaloneReport?.payload?.executive_summary?.key_message && (
                <p className="text-sm muted">{standaloneReport.payload.executive_summary.key_message}</p>
              )}
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
