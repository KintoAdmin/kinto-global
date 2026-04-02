'use client';
// @ts-nocheck

import { useEffect, useMemo, useState } from 'react';

type Props = { assessmentId?: string | null; initialData?: any; view?: string };

function sentenceCase(value?: string | null) {
  const raw = String(value || '').replaceAll('_', ' ').trim();
  if (!raw) return '—';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function titleCase(value?: string | null) {
  return String(value || '')
    .replaceAll('_', ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function badgeTone(status?: string | null) {
  const raw = String(status || '').toLowerCase();
  if (['complete', 'done', 'ready', 'set_up'].includes(raw)) return { bg: '#dcfce7', color: '#166534', border: '#bbf7d0' };
  if (['in_progress', 'started', 'current'].includes(raw)) return { bg: '#ecfeff', color: '#0f766e', border: '#99f6e4' };
  if (['blocked', 'critical'].includes(raw)) return { bg: '#fee2e2', color: '#b91c1c', border: '#fecaca' };
  if (['locked', 'later'].includes(raw)) return { bg: '#f3f4f6', color: '#6b7280', border: '#e5e7eb' };
  return { bg: '#f3f4f6', color: '#374151', border: '#e5e7eb' };
}

function StatusPill({ label }: { label: string }) {
  const tone = badgeTone(label);
  return (
    <span
      style={{
        background: tone.bg,
        color: tone.color,
        border: `1px solid ${tone.border}`,
        borderRadius: 999,
        padding: '4px 10px',
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1,
        display: 'inline-flex',
        alignItems: 'center',
      }}
    >
      {sentenceCase(label)}
    </span>
  );
}

function SmallMuted({ children }: any) {
  return <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.45 }}>{children}</div>;
}

function Card({ children, style }: any) {
  return <div style={{ border: '1px solid #e5e7eb', borderRadius: 14, padding: 16, background: '#fff', ...style }}>{children}</div>;
}

function SectionTitle({ children }: any) {
  return <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{children}</h3>;
}

function progressColor(percent: number) {
  if (percent >= 100) return '#16a34a';
  if (percent >= 50) return '#14b8a6';
  if (percent > 0) return '#f59e0b';
  return '#d1d5db';
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div style={{ width: '100%', height: 8, background: '#f3f4f6', borderRadius: 999, overflow: 'hidden' }}>
      <div style={{ width: `${Math.max(0, Math.min(100, percent))}%`, height: '100%', background: progressColor(percent), transition: 'width 0.2s ease' }} />
    </div>
  );
}

function phaseLabel(code?: string | null, phaseStates?: any[]) {
  const row = (phaseStates || []).find((item: any) => item.phase_code === code);
  return row?.phase_name || '—';
}

export function BusinessReadinessClient({ assessmentId, initialData, view = 'overview' }: Props) {
  const [data, setData] = useState<any>(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openAction, setOpenAction] = useState<string | null>(null);
  const [form, setForm] = useState({
    businessTypeCode: 'professional_services',
    primaryRegionCode: 'south_africa',
    businessName: '',
    founderName: '',
    targetCustomer: '',
    whatYouSell: '',
  });
  const [phaseFilter, setPhaseFilter] = useState<'all' | 'current' | string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | string>('all');
  const [launchCriticalOnly, setLaunchCriticalOnly] = useState(false);
  const [search, setSearch] = useState('');

  async function load() {
    if (!assessmentId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/business-readiness?assessmentId=${encodeURIComponent(assessmentId)}`, { cache: 'no-store' });
      const payload = await res.json();
      if (!res.ok || payload.ok === false) throw new Error(payload.error || 'Failed to load Business Readiness.');
      setData(payload.data || payload);
    } catch (err: any) {
      setError(err?.message || 'Failed to load Business Readiness.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!initialData && assessmentId) load();
  }, [assessmentId]);

  useEffect(() => {
    if (!openAction && data?.nextActions?.[0]?.action_code) {
      setOpenAction(data.nextActions[0].action_code);
    }
  }, [data?.nextActions?.[0]?.action_code]);

  async function initializeWorkspace() {
    if (!assessmentId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/business-readiness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'initialize',
          assessmentId,
          businessTypeCode: form.businessTypeCode,
          primaryRegionCode: form.primaryRegionCode,
          businessName: form.businessName,
          founderName: form.founderName,
          targetCustomer: form.targetCustomer,
          whatYouSell: form.whatYouSell,
        }),
      });
      const payload = await res.json();
      if (!res.ok || payload.ok === false) throw new Error(payload.error || 'Failed to initialize Business Readiness.');
      setData(payload.data || payload);
    } catch (err: any) {
      setError(err?.message || 'Failed to initialize Business Readiness.');
    } finally {
      setSaving(false);
    }
  }

  async function updateTask(taskInstanceId: string, status: string) {
    if (!assessmentId || !taskInstanceId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/business-readiness/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assessmentId, taskInstanceId, status }),
      });
      const payload = await res.json();
      if (!res.ok || payload.ok === false) throw new Error(payload.error || 'Failed to update task.');
      setData(payload.data || payload);
    } catch (err: any) {
      setError(err?.message || 'Failed to update task.');
    } finally {
      setSaving(false);
    }
  }

  async function runLaunchCheck() {
    if (!assessmentId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/business-readiness/launch-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assessmentId }),
      });
      const payload = await res.json();
      if (!res.ok || payload.ok === false) throw new Error(payload.error || 'Failed to run launch check.');
      setData(payload.data || payload);
    } catch (err: any) {
      setError(err?.message || 'Failed to run launch check.');
    } finally {
      setSaving(false);
    }
  }

  const workspace = data?.workspace || null;
  const profile = data?.profile || null;
  const phaseStates = data?.phaseStates || [];
  const blockers = data?.blockers || [];
  const nextActions = data?.nextActions || [];
  const implementationPlan = data?.implementationPlan || [];
  const businessTypes = data?.businessTypes || [];
  const regions = data?.regions || [];

  const currentPhaseName = phaseLabel(workspace?.current_phase_code, phaseStates);
  const businessTypeLabel = businessTypes.find((row: any) => row.code === workspace?.business_type_code)?.label || titleCase(workspace?.business_type_code);
  const regionLabel = regions.find((row: any) => row.code === workspace?.primary_region_code)?.label || titleCase(workspace?.primary_region_code);

  const currentFocus = nextActions[0] || null;
  const completionSummary = useMemo(() => {
    const allActions = implementationPlan.flatMap((phase: any) => phase.sections.flatMap((section: any) => section.actions));
    const total = allActions.length;
    const done = allActions.filter((row: any) => row.status === 'complete').length;
    return { total, done };
  }, [implementationPlan]);

  const filteredPlan = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return implementationPlan
      .filter((phase: any) => {
        if (phaseFilter === 'all') return true;
        if (phaseFilter === 'current') return phase.phase_code === workspace?.current_phase_code;
        return phase.phase_code === phaseFilter;
      })
      .map((phase: any) => ({
        ...phase,
        sections: phase.sections
          .map((section: any) => ({
            ...section,
            actions: section.actions.filter((action: any) => {
              if (launchCriticalOnly && !action.launch_critical) return false;
              if (statusFilter !== 'all' && action.status !== statusFilter) return false;
              if (needle) {
                const haystack = [phase.phase_name, section.section_name, action.action_title, action.objective, ...(action.tasks || []).map((task: any) => task.task_title)].join(' ').toLowerCase();
                if (!haystack.includes(needle)) return false;
              }
              return true;
            }),
          }))
          .filter((section: any) => section.actions.length > 0),
      }))
      .filter((phase: any) => phase.sections.length > 0);
  }, [implementationPlan, phaseFilter, statusFilter, launchCriticalOnly, search, workspace?.current_phase_code]);

  const totalVisibleActions = useMemo(() => filteredPlan.flatMap((phase: any) => phase.sections.flatMap((section: any) => section.actions)).length, [filteredPlan]);

  if (loading) return <div style={{ padding: 16 }}>Loading Business Readiness…</div>;

  if (!assessmentId) return <Card>No assessment selected yet.</Card>;

  if (!data?.hasWorkspace) {
    return (
      <div style={{ display: 'grid', gap: 16 }}>
        <Card>
          <SectionTitle>Start Business Readiness</SectionTitle>
          <SmallMuted>Tell Kinto what you are starting and it will build the first implementation plan.</SmallMuted>
          <div style={{ display: 'grid', gap: 12, marginTop: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            <label>
              <SmallMuted>Business type</SmallMuted>
              <select value={form.businessTypeCode} onChange={(e) => setForm((current) => ({ ...current, businessTypeCode: e.target.value }))} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db', marginTop: 4 }}>
                {businessTypes.map((row: any) => <option key={row.code} value={row.code}>{row.label}</option>)}
              </select>
            </label>
            <label>
              <SmallMuted>Region</SmallMuted>
              <select value={form.primaryRegionCode} onChange={(e) => setForm((current) => ({ ...current, primaryRegionCode: e.target.value }))} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db', marginTop: 4 }}>
                {regions.map((row: any) => <option key={row.code} value={row.code}>{row.label}</option>)}
              </select>
            </label>
            <label>
              <SmallMuted>Business name</SmallMuted>
              <input value={form.businessName} onChange={(e) => setForm((current) => ({ ...current, businessName: e.target.value }))} placeholder="Example: Kinto Test Advisory" style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db', marginTop: 4 }} />
            </label>
            <label>
              <SmallMuted>Founder name</SmallMuted>
              <input value={form.founderName} onChange={(e) => setForm((current) => ({ ...current, founderName: e.target.value }))} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db', marginTop: 4 }} />
            </label>
            <label>
              <SmallMuted>What will you sell?</SmallMuted>
              <input value={form.whatYouSell} onChange={(e) => setForm((current) => ({ ...current, whatYouSell: e.target.value }))} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db', marginTop: 4 }} />
            </label>
            <label>
              <SmallMuted>Target customer</SmallMuted>
              <input value={form.targetCustomer} onChange={(e) => setForm((current) => ({ ...current, targetCustomer: e.target.value }))} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db', marginTop: 4 }} />
            </label>
          </div>
          <div style={{ marginTop: 14 }}>
            <button onClick={initializeWorkspace} disabled={saving} style={{ padding: '10px 14px', borderRadius: 8, border: 'none', background: '#111827', color: '#fff', fontWeight: 600 }}>
              {saving ? 'Creating workspace…' : 'Create workspace'}
            </button>
          </div>
        </Card>
        {error ? <Card><div style={{ color: '#b91c1c' }}>{error}</div></Card> : null}
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {error ? <Card><div style={{ color: '#b91c1c' }}>{error}</div></Card> : null}

      <Card style={{ padding: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1.25fr) repeat(4, minmax(140px, 0.8fr))', gap: 14, alignItems: 'stretch' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.3 }}>Business context</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{profile?.business_name || 'Business Readiness workspace'}</div>
            <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <StatusPill label={workspace?.launch_ready_flag ? 'ready' : 'blocked'} />
              <span style={{ fontSize: 12, color: '#6b7280' }}>{businessTypeLabel}</span>
              <span style={{ fontSize: 12, color: '#6b7280' }}>•</span>
              <span style={{ fontSize: 12, color: '#6b7280' }}>{regionLabel}</span>
            </div>
            <div style={{ marginTop: 10, fontSize: 13, color: '#4b5563', lineHeight: 1.5 }}>
              {profile?.what_you_sell || profile?.business_description || 'Structured setup guidance for this business.'}
            </div>
          </div>
          <Card style={{ padding: 14 }}>
            <SmallMuted>Current phase</SmallMuted>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6 }}>{currentPhaseName}</div>
            <div style={{ marginTop: 8 }}><StatusPill label={phaseStates.find((row: any) => row.phase_code === workspace?.current_phase_code)?.status || 'current'} /></div>
          </Card>
          <Card style={{ padding: 14 }}>
            <SmallMuted>Readiness</SmallMuted>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6 }}>{sentenceCase(workspace?.overall_readiness_state)}</div>
            <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>{completionSummary.done} of {completionSummary.total} actions complete</div>
          </Card>
          <Card style={{ padding: 14 }}>
            <SmallMuted>Critical actions open</SmallMuted>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6 }}>{blockers.length}</div>
            <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>{blockers.length ? 'Needs attention before launch' : 'No critical blockers right now'}</div>
          </Card>
          <Card style={{ padding: 14 }}>
            <SmallMuted>Current focus</SmallMuted>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 6 }}>{currentFocus?.title || '—'}</div>
            <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>{currentFocus?.next_task_name || 'Kinto will surface the next action here.'}</div>
          </Card>
        </div>
      </Card>

      {view === 'overview' ? (
        <div style={{ display: 'grid', gap: 16 }}>
          <Card>
            <SectionTitle>Sponsor summary</SectionTitle>
            <div style={{ marginTop: 10, lineHeight: 1.55 }}>{data?.summary}</div>
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) minmax(320px, 1.1fr)', gap: 16 }}>
            <Card>
              <SectionTitle>Immediate priorities</SectionTitle>
              <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
                {nextActions.slice(0, 4).map((item: any, index: number) => (
                  <div key={item.id} style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 12, display: 'grid', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                      <div style={{ fontWeight: 700 }}>{index + 1}. {item.title}</div>
                      {item.launch_critical ? <StatusPill label="critical" /> : null}
                    </div>
                    <SmallMuted>{item.reason}</SmallMuted>
                    {item.next_task_name ? <div style={{ fontSize: 13 }}><strong>Start with:</strong> {item.next_task_name}</div> : null}
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <SectionTitle>Phase progress</SectionTitle>
              <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                {phaseStates.map((phase: any) => (
                  <div key={phase.phase_code} style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                      <div style={{ fontWeight: 700 }}>{phase.phase_name}</div>
                      <StatusPill label={phase.status} />
                    </div>
                    <div style={{ marginTop: 10 }}><ProgressBar percent={Number(phase.percent_complete || 0)} /></div>
                    <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>{phase.percent_complete}% complete</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <SectionTitle>Launch blockers</SectionTitle>
                <SmallMuted>Critical actions keeping launch from turning green.</SmallMuted>
              </div>
              <button onClick={runLaunchCheck} disabled={saving} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #111827', background: '#fff', color: '#111827', fontWeight: 600 }}>
                {saving ? 'Refreshing…' : 'Run launch check'}
              </button>
            </div>
            <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
              {blockers.length ? blockers.map((row: any) => (
                <div key={row.blocker_id} style={{ padding: 12, border: '1px solid #fee2e2', borderRadius: 12, background: '#fff7f7', display: 'grid', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                    <div style={{ fontWeight: 700 }}>{row.title}</div>
                    <StatusPill label={row.severity} />
                  </div>
                  <SmallMuted>{row.description}</SmallMuted>
                </div>
              )) : <SmallMuted>No active launch blockers right now.</SmallMuted>}
            </div>
          </Card>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          <Card style={{ position: 'sticky', top: 12, zIndex: 2 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr repeat(4, minmax(120px, 0.75fr)) auto', gap: 10, alignItems: 'end' }}>
              <label>
                <SmallMuted>Search</SmallMuted>
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search phases, sections, actions, or tasks" style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db', marginTop: 4 }} />
              </label>
              <label>
                <SmallMuted>Phase</SmallMuted>
                <select value={phaseFilter} onChange={(e) => setPhaseFilter(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db', marginTop: 4 }}>
                  <option value="all">All phases</option>
                  <option value="current">Current phase</option>
                  {phaseStates.map((phase: any) => <option key={phase.phase_code} value={phase.phase_code}>{phase.phase_name}</option>)}
                </select>
              </label>
              <label>
                <SmallMuted>Status</SmallMuted>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db', marginTop: 4 }}>
                  <option value="all">All statuses</option>
                  <option value="not_started">Not started</option>
                  <option value="in_progress">In progress</option>
                  <option value="complete">Complete</option>
                </select>
              </label>
              <label>
                <SmallMuted>Business type</SmallMuted>
                <input value={businessTypeLabel} readOnly style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #e5e7eb', marginTop: 4, background: '#f9fafb', color: '#6b7280' }} />
              </label>
              <label>
                <SmallMuted>Region</SmallMuted>
                <input value={regionLabel} readOnly style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #e5e7eb', marginTop: 4, background: '#f9fafb', color: '#6b7280' }} />
              </label>
              <button onClick={() => setLaunchCriticalOnly((current) => !current)} style={{ padding: '10px 14px', borderRadius: 8, border: launchCriticalOnly ? '1px solid #fca5a5' : '1px solid #d1d5db', background: launchCriticalOnly ? '#fff7f7' : '#fff', color: launchCriticalOnly ? '#b91c1c' : '#111827', fontWeight: 600 }}>
                {launchCriticalOnly ? 'Launch critical only' : 'Show all actions'}
              </button>
            </div>
            <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <SmallMuted>{totalVisibleActions} actions shown</SmallMuted>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <StatusPill label={workspace?.launch_ready_flag ? 'ready' : 'blocked'} />
                <StatusPill label={phaseFilter === 'current' ? 'current' : 'all'} />
              </div>
            </div>
          </Card>

          {filteredPlan.map((phase: any) => {
            const phaseState = phaseStates.find((row: any) => row.phase_code === phase.phase_code);
            const phaseActionCount = phase.sections.reduce((sum: number, section: any) => sum + section.actions.length, 0);
            const phaseTaskDone = phase.sections.flatMap((section: any) => section.actions).reduce((sum: number, action: any) => sum + Number(action.completed_tasks || 0), 0);
            const phaseTaskTotal = phase.sections.flatMap((section: any) => section.actions).reduce((sum: number, action: any) => sum + Number(action.total_tasks || 0), 0);
            return (
              <Card key={phase.phase_code} style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: 18, borderBottom: '1px solid #e5e7eb', background: phase.phase_code === workspace?.current_phase_code ? 'linear-gradient(180deg, #f0fdfa 0%, #ffffff 100%)' : '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.4 }}>{phase.phase_name}</div>
                      <div style={{ fontSize: 15, color: '#4b5563', marginTop: 4 }}>{phase.phase_code === workspace?.current_phase_code ? 'Current implementation phase' : 'Planned phase in the roadmap'}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      {phase.phase_code === workspace?.current_phase_code ? <StatusPill label="current" /> : null}
                      <StatusPill label={phaseState?.status || 'not_started'} />
                    </div>
                  </div>
                  <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1.4fr repeat(3, minmax(120px, 0.6fr))', gap: 12, alignItems: 'center' }}>
                    <div>
                      <ProgressBar percent={Number(phaseState?.percent_complete || 0)} />
                      <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>{phaseState?.percent_complete || 0}% phase progress</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>Actions</div>
                      <div style={{ fontWeight: 700, marginTop: 4 }}>{phaseActionCount}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>Tasks complete</div>
                      <div style={{ fontWeight: 700, marginTop: 4 }}>{phaseTaskDone} / {phaseTaskTotal}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>Launch-critical actions</div>
                      <div style={{ fontWeight: 700, marginTop: 4 }}>{phase.sections.flatMap((section: any) => section.actions).filter((action: any) => action.launch_critical).length}</div>
                    </div>
                  </div>
                </div>

                <div style={{ padding: 18, display: 'grid', gap: 18 }}>
                  {phase.sections.map((section: any) => (
                    <div key={section.section_code}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{section.section_name}</div>
                          <SmallMuted>{section.actions.length} action{section.actions.length === 1 ? '' : 's'} in this section</SmallMuted>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gap: 12 }}>
                        {section.actions.map((action: any) => {
                          const isOpen = openAction === action.action_code;
                          return (
                            <div key={action.action_code} style={{ border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden', background: '#fff' }}>
                              <button onClick={() => setOpenAction(isOpen ? null : action.action_code)} style={{ width: '100%', textAlign: 'left', padding: 16, border: 'none', background: isOpen ? '#f9fafb' : '#fff', cursor: 'pointer' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1.3fr) minmax(200px, 0.7fr) minmax(120px, 0.4fr)', gap: 16, alignItems: 'center' }}>
                                  <div>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                      <div style={{ fontWeight: 700, fontSize: 16 }}>{action.action_title}</div>
                                      {action.launch_critical ? <StatusPill label="critical" /> : null}
                                    </div>
                                    <div style={{ marginTop: 6, fontSize: 13, color: '#4b5563', lineHeight: 1.5 }}>{action.objective}</div>
                                    <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>Complete when all required tasks for this action are finished.</div>
                                  </div>
                                  <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                                      <StatusPill label={action.status} />
                                      <div style={{ fontSize: 12, color: '#6b7280' }}>{action.completed_tasks} / {action.total_tasks} tasks</div>
                                    </div>
                                    <div style={{ marginTop: 10 }}><ProgressBar percent={action.progress_pct} /></div>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>{isOpen ? 'Hide tasks' : 'Open tasks'}</span>
                                  </div>
                                </div>
                              </button>
                              {isOpen ? (
                                <div style={{ borderTop: '1px solid #e5e7eb', padding: 16, display: 'grid', gap: 12, background: '#fbfbfb' }}>
                                  {action.tasks.map((task: any) => (
                                    <div key={task.task_code} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 14, background: '#fff' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                                        <div style={{ fontWeight: 700 }}>{task.task_title} {task.optional ? <span style={{ fontWeight: 600, color: '#6b7280', fontSize: 12 }}>(Optional)</span> : null}</div>
                                        <StatusPill label={task.status} />
                                      </div>
                                      <div style={{ display: 'grid', gridTemplateColumns: '1.35fr repeat(3, minmax(180px, 0.85fr))', gap: 12, marginTop: 12 }}>
                                        <div>
                                          <div style={{ fontSize: 12, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Instructions</div>
                                          <div style={{ fontSize: 13, lineHeight: 1.55, color: '#374151' }}>{task.instructions}</div>
                                        </div>
                                        <div>
                                          <div style={{ fontSize: 12, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Requirements</div>
                                          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.55, fontSize: 13, color: '#374151' }}>
                                            {(task.requirements || []).map((item: string) => <li key={item}>{item}</li>)}
                                          </ul>
                                        </div>
                                        <div>
                                          <div style={{ fontSize: 12, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Where to do this</div>
                                          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.55, fontSize: 13, color: '#374151' }}>
                                            {(task.where_to_do_this || []).map((item: string) => <li key={item}>{item}</li>)}
                                          </ul>
                                        </div>
                                        <div>
                                          <div style={{ fontSize: 12, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Record and save</div>
                                          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.55, fontSize: 13, color: '#374151' }}>
                                            {(task.record_and_save || []).map((item: string) => <li key={item}>{item}</li>)}
                                          </ul>
                                        </div>
                                      </div>
                                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                                        <button onClick={() => updateTask(task.task_instance_id, 'in_progress')} disabled={saving || !task.task_instance_id || task.status === 'complete'} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontWeight: 600 }}>Mark started</button>
                                        <button onClick={() => updateTask(task.task_instance_id, 'done')} disabled={saving || !task.task_instance_id} style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: '#111827', color: '#fff', fontWeight: 600 }}>Mark complete</button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}

          {!filteredPlan.length ? (
            <Card>
              <SectionTitle>No actions match these filters</SectionTitle>
              <SmallMuted>Clear the search or broaden the filters to see the full implementation plan.</SmallMuted>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}
