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
  if (['blocked', 'critical', 'overdue'].includes(raw)) return { bg: '#fee2e2', color: '#b91c1c', border: '#fecaca' };
  if (['locked', 'later', 'waiting'].includes(raw)) return { bg: '#f3f4f6', color: '#6b7280', border: '#e5e7eb' };
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
        whiteSpace: 'nowrap',
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

function ProgressBar({ percent }: { percent: number }) {
  const fill = Math.max(0, Math.min(100, Number(percent || 0)));
  const color = fill >= 100 ? '#16a34a' : fill >= 50 ? '#14b8a6' : fill > 0 ? '#f59e0b' : '#d1d5db';
  return (
    <div style={{ width: '100%', height: 8, background: '#f3f4f6', borderRadius: 999, overflow: 'hidden' }}>
      <div style={{ width: `${fill}%`, height: '100%', background: color, transition: 'width 0.2s ease' }} />
    </div>
  );
}

function phaseLabel(code?: string | null, phaseStates?: any[]) {
  const row = (phaseStates || []).find((item: any) => item.phase_code === code);
  return row?.phase_name || '—';
}

function buildDocumentLabel(doc: any) {
  return doc?.note_text || doc?.file_url || doc?.external_link || 'Saved document';
}

export function BusinessReadinessClient({ assessmentId, initialData, view = 'overview' }: Props) {
  const activeView = view === 'roadmap' ? 'execution' : view;
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
  const [phaseFilter, setPhaseFilter] = useState<'all' | 'current' | string>('current');
  const [statusFilter, setStatusFilter] = useState<'all' | string>('all');
  const [launchCriticalOnly, setLaunchCriticalOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [showDocComposerForTask, setShowDocComposerForTask] = useState<string | null>(null);
  const [docDraft, setDocDraft] = useState({ name: '', link: '' });
  const [documentSearch, setDocumentSearch] = useState('');

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

  async function addTaskDocument(taskInstanceId: string) {
    if (!assessmentId || !taskInstanceId || !docDraft.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/business-readiness/evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assessmentId,
          taskInstanceId,
          evidenceType: docDraft.link.trim() ? 'link' : 'note',
          noteText: docDraft.name.trim(),
          externalLink: docDraft.link.trim(),
        }),
      });
      const payload = await res.json();
      if (!res.ok || payload.ok === false) throw new Error(payload.error || 'Failed to save document reference.');
      setData(payload.data || payload);
      setDocDraft({ name: '', link: '' });
      setShowDocComposerForTask(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to save document reference.');
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
  const evidence = data?.evidence || [];

  const businessTypeLabel = businessTypes.find((row: any) => row.code === workspace?.business_type_code)?.label || titleCase(workspace?.business_type_code);
  const regionLabel = regions.find((row: any) => row.code === workspace?.primary_region_code)?.label || titleCase(workspace?.primary_region_code);
  const currentPhaseName = phaseLabel(workspace?.current_phase_code, phaseStates);

  const flatActions = useMemo(() => implementationPlan.flatMap((phase: any) => phase.sections.flatMap((section: any) => section.actions.map((action: any) => ({
    ...action,
    phase_code: phase.phase_code,
    phase_name: phase.phase_name,
    section_code: section.section_code,
    section_name: section.section_name,
  })))), [implementationPlan]);

  const taskContextByInstance = useMemo(() => {
    const map = new Map();
    flatActions.forEach((action: any) => {
      (action.tasks || []).forEach((task: any) => {
        map.set(task.task_instance_id, {
          task,
          action,
          phase_code: action.phase_code,
          phase_name: action.phase_name,
          section_code: action.section_code,
          section_name: action.section_name,
        });
      });
    });
    return map;
  }, [flatActions]);

  const docsByTask = useMemo(() => {
    const map = new Map<string, any[]>();
    (evidence || []).forEach((doc: any) => {
      const taskId = doc.task_instance_id;
      if (!map.has(taskId)) map.set(taskId, []);
      map.get(taskId)!.push(doc);
    });
    return map;
  }, [evidence]);

  const currentActionCode = openAction || nextActions?.[0]?.action_code || flatActions.find((row: any) => row.status !== 'complete')?.action_code || null;
  useEffect(() => {
    if (!openAction && currentActionCode) setOpenAction(currentActionCode);
  }, [currentActionCode]);

  const currentAction = flatActions.find((row: any) => row.action_code === currentActionCode) || null;

  const visibleActions = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return flatActions.filter((action: any) => {
      if (phaseFilter === 'current' && action.phase_code !== workspace?.current_phase_code) return false;
      if (phaseFilter !== 'all' && phaseFilter !== 'current' && action.phase_code !== phaseFilter) return false;
      if (statusFilter !== 'all' && action.status !== statusFilter) return false;
      if (launchCriticalOnly && !action.launch_critical) return false;
      if (needle) {
        const haystack = [action.phase_name, action.section_name, action.action_title, action.objective, ...(action.tasks || []).map((task: any) => task.task_title)].join(' ').toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [flatActions, phaseFilter, workspace?.current_phase_code, statusFilter, launchCriticalOnly, search]);

  const nextVisibleActions = useMemo(() => visibleActions.filter((action: any) => action.action_code !== currentActionCode).slice(0, 6), [visibleActions, currentActionCode]);

  const documentRows = useMemo(() => {
    const needle = documentSearch.trim().toLowerCase();
    return (evidence || [])
      .map((doc: any) => {
        const ctx = taskContextByInstance.get(doc.task_instance_id) || {};
        return {
          ...doc,
          label: buildDocumentLabel(doc),
          task_title: ctx.task?.task_title || 'Unlinked task',
          action_title: ctx.action?.action_title || 'Unlinked action',
          section_name: ctx.section_name || '—',
          phase_name: ctx.phase_name || '—',
        };
      })
      .filter((doc: any) => {
        if (!needle) return true;
        const hay = [doc.label, doc.task_title, doc.action_title, doc.section_name, doc.phase_name].join(' ').toLowerCase();
        return hay.includes(needle);
      });
  }, [evidence, taskContextByInstance, documentSearch]);

  const completionSummary = useMemo(() => {
    const total = flatActions.length;
    const done = flatActions.filter((row: any) => row.status === 'complete').length;
    return { total, done };
  }, [flatActions]);

  if (loading) return <div style={{ padding: 16 }}>Loading Business Readiness…</div>;
  if (!assessmentId) return <Card>No assessment selected yet.</Card>;

  if (!data?.hasWorkspace) {
    return (
      <div style={{ display: 'grid', gap: 16 }}>
        <Card>
          <SectionTitle>Start Business Readiness</SectionTitle>
          <SmallMuted>Tell Kinto what you are starting and it will build the first execution workspace.</SmallMuted>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1.3fr) repeat(5, minmax(120px, 0.8fr))', gap: 12, alignItems: 'stretch' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.3 }}>Business context</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{profile?.business_name || 'Business Readiness workspace'}</div>
            <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <StatusPill label={workspace?.launch_ready_flag ? 'ready' : 'blocked'} />
              <span style={{ fontSize: 12, color: '#6b7280' }}>{businessTypeLabel}</span>
              <span style={{ fontSize: 12, color: '#6b7280' }}>•</span>
              <span style={{ fontSize: 12, color: '#6b7280' }}>{regionLabel}</span>
            </div>
            <div style={{ marginTop: 10, fontSize: 13, color: '#4b5563', lineHeight: 1.5 }}>{profile?.business_description || 'Execution workspace for getting this business launch-ready and operating-ready.'}</div>
          </div>
          <Card style={{ padding: 14 }}>
            <SmallMuted>Current phase</SmallMuted>
            <div style={{ fontSize: 17, fontWeight: 700, marginTop: 6 }}>{currentPhaseName}</div>
            <div style={{ marginTop: 8 }}><StatusPill label={phaseStates.find((row: any) => row.phase_code === workspace?.current_phase_code)?.status || 'current'} /></div>
          </Card>
          <Card style={{ padding: 14 }}>
            <SmallMuted>Readiness</SmallMuted>
            <div style={{ fontSize: 17, fontWeight: 700, marginTop: 6 }}>{sentenceCase(workspace?.overall_readiness_state)}</div>
            <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>{completionSummary.done} of {completionSummary.total} actions complete</div>
          </Card>
          <Card style={{ padding: 14 }}>
            <SmallMuted>Open blockers</SmallMuted>
            <div style={{ fontSize: 17, fontWeight: 700, marginTop: 6 }}>{blockers.length}</div>
            <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>{blockers.length ? 'Resolve these before launch' : 'No active blockers right now'}</div>
          </Card>
          <Card style={{ padding: 14 }}>
            <SmallMuted>Documents</SmallMuted>
            <div style={{ fontSize: 17, fontWeight: 700, marginTop: 6 }}>{documentRows.length}</div>
            <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>Linked to execution tasks</div>
          </Card>
          <Card style={{ padding: 14 }}>
            <SmallMuted>Current focus</SmallMuted>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 6 }}>{currentAction?.action_title || nextActions?.[0]?.title || '—'}</div>
            <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>{currentAction?.tasks?.find((task: any) => task.status !== 'done')?.task_title || nextActions?.[0]?.next_task_name || 'Kinto will surface the next task here.'}</div>
          </Card>
        </div>
      </Card>

      {activeView === 'overview' ? (
        <div style={{ display: 'grid', gap: 16 }}>
          <Card>
            <SectionTitle>Sponsor summary</SectionTitle>
            <div style={{ marginTop: 10, lineHeight: 1.55 }}>{data?.summary}</div>
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1.1fr) minmax(280px, 0.9fr)', gap: 16 }}>
            <Card>
              <SectionTitle>Current action</SectionTitle>
              {currentAction ? (
                <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ fontWeight: 700, fontSize: 18 }}>{currentAction.action_title}</div>
                    {currentAction.launch_critical ? <StatusPill label="critical" /> : null}
                    <StatusPill label={currentAction.status} />
                  </div>
                  <SmallMuted>{currentAction.objective}</SmallMuted>
                  <div style={{ fontSize: 13 }}><strong>Section:</strong> {currentAction.section_name}</div>
                  <div style={{ fontSize: 13 }}><strong>Next task:</strong> {currentAction.tasks.find((task: any) => task.status !== 'done')?.task_title || 'All tasks complete'}</div>
                </div>
              ) : <SmallMuted>No current action available.</SmallMuted>}
            </Card>
            <Card>
              <SectionTitle>Immediate priorities</SectionTitle>
              <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                {nextActions.slice(0, 3).map((item: any, index: number) => (
                  <div key={item.id} style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 12 }}>
                    <div style={{ fontWeight: 700 }}>{index + 1}. {item.title}</div>
                    <SmallMuted>{item.reason}</SmallMuted>
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
              {blockers.length ? blockers.slice(0, 4).map((row: any) => (
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
      ) : null}

      {activeView === 'execution' ? (
        <div style={{ display: 'grid', gap: 16 }}>
          <Card style={{ position: 'sticky', top: 12, zIndex: 2 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr repeat(3, minmax(120px, 0.7fr)) auto', gap: 10, alignItems: 'end' }}>
              <label>
                <SmallMuted>Search</SmallMuted>
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search actions or tasks" style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db', marginTop: 4 }} />
              </label>
              <label>
                <SmallMuted>Phase</SmallMuted>
                <select value={phaseFilter} onChange={(e) => setPhaseFilter(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db', marginTop: 4 }}>
                  <option value="current">Current phase</option>
                  <option value="all">All phases</option>
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
                <SmallMuted>Region</SmallMuted>
                <input value={regionLabel} readOnly style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #e5e7eb', marginTop: 4, background: '#f9fafb', color: '#6b7280' }} />
              </label>
              <button onClick={() => setLaunchCriticalOnly((current) => !current)} style={{ padding: '10px 14px', borderRadius: 8, border: launchCriticalOnly ? '1px solid #fca5a5' : '1px solid #d1d5db', background: launchCriticalOnly ? '#fff7f7' : '#fff', color: launchCriticalOnly ? '#b91c1c' : '#111827', fontWeight: 600 }}>
                {launchCriticalOnly ? 'Launch critical only' : 'Show all actions'}
              </button>
            </div>
          </Card>

          <Card style={{ borderColor: currentAction?.launch_critical ? '#fecaca' : '#d1fae5', background: currentAction?.launch_critical ? '#fffafa' : '#f9fffb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ maxWidth: 780 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.3 }}>Current action</div>
                  {currentAction?.launch_critical ? <StatusPill label="critical" /> : null}
                  {currentAction ? <StatusPill label={currentAction.status} /> : null}
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, marginTop: 6 }}>{currentAction?.action_title || 'No current action available'}</div>
                <div style={{ marginTop: 8, fontSize: 14, color: '#4b5563', lineHeight: 1.6 }}>{currentAction?.objective || 'Kinto will surface the current action here.'}</div>
                {currentAction ? (
                  <div style={{ marginTop: 12, display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 13, color: '#4b5563' }}>
                    <span><strong>Phase:</strong> {currentAction.phase_name}</span>
                    <span><strong>Section:</strong> {currentAction.section_name}</span>
                    <span><strong>Tasks complete:</strong> {currentAction.completed_tasks} / {currentAction.total_tasks}</span>
                  </div>
                ) : null}
              </div>
              {currentAction ? (
                <div style={{ minWidth: 220 }}>
                  <SmallMuted>Action progress</SmallMuted>
                  <div style={{ marginTop: 10 }}><ProgressBar percent={currentAction.progress_pct} /></div>
                  <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>{currentAction.progress_pct}% complete</div>
                </div>
              ) : null}
            </div>
          </Card>

          {currentAction ? (
            <Card>
              <SectionTitle>Tasks for this action</SectionTitle>
              <SmallMuted>Complete these tasks to move this action forward.</SmallMuted>
              <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
                {currentAction.tasks.map((task: any, index: number) => {
                  const linkedDocs = docsByTask.get(task.task_instance_id) || [];
                  const isComposerOpen = showDocComposerForTask === task.task_instance_id;
                  return (
                    <div key={task.task_code} style={{ border: '1px solid #e5e7eb', borderRadius: 14, padding: 14, background: '#fff' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ fontWeight: 700 }}>{index + 1}. {task.task_title} {task.optional ? <span style={{ fontWeight: 600, color: '#6b7280', fontSize: 12 }}>(Optional)</span> : null}</div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <StatusPill label={task.status} />
                          <span style={{ fontSize: 12, color: '#6b7280' }}>{linkedDocs.length} file{linkedDocs.length === 1 ? '' : 's'}</span>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1.35fr repeat(3, minmax(180px, 0.9fr))', gap: 12, marginTop: 12 }}>
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

                      <div style={{ marginTop: 14, borderTop: '1px solid #f3f4f6', paddingTop: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>Files</div>
                          <button onClick={() => setShowDocComposerForTask(isComposerOpen ? null : task.task_instance_id)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontWeight: 600, fontSize: 12 }}>
                            {isComposerOpen ? 'Cancel' : 'Add file or link'}
                          </button>
                        </div>
                        {linkedDocs.length ? (
                          <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                            {linkedDocs.map((doc: any) => (
                              <div key={doc.evidence_id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: 13 }}>{buildDocumentLabel(doc)}</div>
                                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{sentenceCase(doc.evidence_type)} • {new Date(doc.uploaded_at).toLocaleDateString()}</div>
                                </div>
                                {doc.external_link ? <a href={doc.external_link} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 700 }}>Open</a> : null}
                              </div>
                            ))}
                          </div>
                        ) : <SmallMuted style={{ marginTop: 8 }}>No files linked to this task yet.</SmallMuted>}
                        {isComposerOpen ? (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginTop: 10 }}>
                            <input value={docDraft.name} onChange={(e) => setDocDraft((current) => ({ ...current, name: e.target.value }))} placeholder="File or document name" style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }} />
                            <input value={docDraft.link} onChange={(e) => setDocDraft((current) => ({ ...current, link: e.target.value }))} placeholder="Link (optional)" style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }} />
                            <button onClick={() => addTaskDocument(task.task_instance_id)} disabled={saving || !docDraft.name.trim()} style={{ padding: '10px 12px', borderRadius: 8, border: 'none', background: '#111827', color: '#fff', fontWeight: 600 }}>Save</button>
                          </div>
                        ) : null}
                      </div>

                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                        <button onClick={() => updateTask(task.task_instance_id, 'in_progress')} disabled={saving || !task.task_instance_id || task.status === 'complete'} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontWeight: 600 }}>Mark started</button>
                        <button onClick={() => updateTask(task.task_instance_id, 'done')} disabled={saving || !task.task_instance_id} style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: '#111827', color: '#fff', fontWeight: 600 }}>Mark complete</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ) : null}

          <div style={{ display: 'grid', gap: 12 }}>
            <SectionTitle>Next actions</SectionTitle>
            {nextVisibleActions.length ? nextVisibleActions.map((action: any) => (
              <Card key={action.action_code} style={{ padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ fontWeight: 700 }}>{action.action_title}</div>
                      {action.launch_critical ? <StatusPill label="critical" /> : null}
                      <StatusPill label={action.status} />
                    </div>
                    <div style={{ marginTop: 4, fontSize: 13, color: '#4b5563' }}>{action.phase_name} • {action.section_name}</div>
                    <SmallMuted>{action.objective}</SmallMuted>
                  </div>
                  <button onClick={() => setOpenAction(action.action_code)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontWeight: 600 }}>Make current action</button>
                </div>
              </Card>
            )) : <Card><SmallMuted>No further actions match these filters right now.</SmallMuted></Card>}
          </div>
        </div>
      ) : null}

      {activeView === 'documents' ? (
        <div style={{ display: 'grid', gap: 16 }}>
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <SectionTitle>Document repository</SectionTitle>
                <SmallMuted>Files and links saved against Business Readiness tasks.</SmallMuted>
              </div>
              <div style={{ minWidth: 280 }}>
                <input value={documentSearch} onChange={(e) => setDocumentSearch(e.target.value)} placeholder="Search documents, tasks, or actions" style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }} />
              </div>
            </div>
          </Card>

          {documentRows.length ? (
            <div style={{ display: 'grid', gap: 12 }}>
              {documentRows.map((doc: any) => (
                <Card key={doc.evidence_id} style={{ padding: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) repeat(4, minmax(120px, 0.65fr)) auto', gap: 12, alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{doc.label}</div>
                      <div style={{ marginTop: 4, fontSize: 13, color: '#4b5563' }}>{doc.action_title}</div>
                      <div style={{ marginTop: 2, fontSize: 12, color: '#6b7280' }}>{doc.task_title}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>Phase</div>
                      <div style={{ fontWeight: 600, marginTop: 4 }}>{doc.phase_name}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>Section</div>
                      <div style={{ fontWeight: 600, marginTop: 4 }}>{doc.section_name}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>Type</div>
                      <div style={{ fontWeight: 600, marginTop: 4 }}>{sentenceCase(doc.evidence_type)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>Saved</div>
                      <div style={{ fontWeight: 600, marginTop: 4 }}>{new Date(doc.uploaded_at).toLocaleDateString()}</div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      {doc.external_link ? <a href={doc.external_link} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 700 }}>Open</a> : <StatusPill label={doc.review_status || 'saved'} />}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <SmallMuted>No documents saved yet. Add files or links from a task inside Execution.</SmallMuted>
            </Card>
          )}
        </div>
      ) : null}
    </div>
  );
}
