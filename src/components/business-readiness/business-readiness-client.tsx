'use client';
// @ts-nocheck

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

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

function SmallMuted({ children, style }: any) {
  return <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.45, ...style }}>{children}</div>;
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

function GroupLabel({ children }: any) {
  return <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3, color: '#6b7280' }}>{children}</div>;
}

function TaskBlock({ task, linkedDocs, saving, onStart, onComplete, showComposer, setShowComposer, docDraft, setDocDraft, onSaveDoc }: any) {
  return (
    <Card style={{ padding: 14, background: task.status === 'done' ? '#fbfffc' : '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 700 }}>{task.task_title}</div>
            {task.optional ? <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 700 }}>Optional</span> : null}
          </div>
          <div style={{ marginTop: 8, display: 'grid', gap: 10 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Instructions</div>
              <div style={{ fontSize: 13, lineHeight: 1.55, color: '#374151' }}>{task.instructions}</div>
            </div>
            {!!task.requirements?.length && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Requirements</div>
                <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.55, fontSize: 13, color: '#374151' }}>
                  {task.requirements.map((item: string) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            )}
            {!!task.where_to_do_this?.length && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Where to do this</div>
                <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.55, fontSize: 13, color: '#374151' }}>
                  {task.where_to_do_this.map((item: string) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            )}
            {!!task.record_and_save?.length && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Record and save</div>
                <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.55, fontSize: 13, color: '#374151' }}>
                  {task.record_and_save.map((item: string) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'grid', gap: 8, minWidth: 180, justifyItems: 'end' }}>
          <StatusPill label={task.status} />
          <button onClick={onStart} disabled={saving || task.status === 'done'} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontWeight: 600, width: '100%' }}>Mark started</button>
          <button onClick={onComplete} disabled={saving} style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: '#111827', color: '#fff', fontWeight: 600, width: '100%' }}>Mark complete</button>
        </div>
      </div>

      <div style={{ marginTop: 14, borderTop: '1px solid #f3f4f6', paddingTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontSize: 12, fontWeight: 700 }}>Files</div>
          <button onClick={() => setShowComposer(showComposer ? null : task.task_instance_id)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontWeight: 600, fontSize: 12 }}>
            {showComposer ? 'Cancel' : 'Add file or link'}
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
                {doc.external_link ? <a href={doc.external_link} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 700 }}>Open</a> : <StatusPill label={doc.review_status || 'saved'} />}
              </div>
            ))}
          </div>
        ) : <SmallMuted style={{ marginTop: 8 }}>No files linked to this task yet.</SmallMuted>}
        {showComposer ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginTop: 10 }}>
            <input value={docDraft.name} onChange={(e) => setDocDraft((current: any) => ({ ...current, name: e.target.value }))} placeholder="File or document name" style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }} />
            <input value={docDraft.link} onChange={(e) => setDocDraft((current: any) => ({ ...current, link: e.target.value }))} placeholder="Link (optional)" style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }} />
            <button onClick={onSaveDoc} disabled={saving || !docDraft.name.trim()} style={{ padding: '10px 12px', borderRadius: 8, border: 'none', background: '#111827', color: '#fff', fontWeight: 600 }}>Save</button>
          </div>
        ) : null}
      </div>
    </Card>
  );
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
    hiringStaff: false,
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [phaseFilter, setPhaseFilter] = useState<'all' | string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | string>('all');
  const [launchCriticalOnly, setLaunchCriticalOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [showLater, setShowLater] = useState(false);
  const [showDocComposerForTask, setShowDocComposerForTask] = useState<string | null>(null);
  const [docDraft, setDocDraft] = useState({ name: '', link: '' });
  const [documentSearch, setDocumentSearch] = useState('');
  const [documentPhaseFilter, setDocumentPhaseFilter] = useState<'all' | string>('all');
  const [documentTypeFilter, setDocumentTypeFilter] = useState<'all' | string>('all');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

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
          hiringStaff: form.hiringStaff,
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

  function pushView(viewName: string, actionCode?: string | null) {
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.set('view', viewName);
    if (assessmentId) params.set('assessmentId', assessmentId);
    if (actionCode) params.set('action', actionCode); else params.delete('action');
    router.push(`${pathname}?${params.toString()}`);
  }

  function openActionInExecution(actionCode?: string | null) {
    if (!actionCode) return;
    setOpenAction(actionCode);
    pushView('execution', actionCode);
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

  const suggestedActionCode = nextActions?.[0]?.action_code || flatActions.find((row: any) => row.status !== 'complete')?.action_code || flatActions[0]?.action_code || null;
  useEffect(() => {
    if (!openAction && suggestedActionCode) setOpenAction(suggestedActionCode);
  }, [suggestedActionCode]);

  useEffect(() => {
    const actionFromQuery = searchParams?.get('action');
    if (actionFromQuery) setOpenAction(actionFromQuery);
  }, [searchParams]);

  const currentActionCode = openAction || suggestedActionCode;
  const currentAction = flatActions.find((row: any) => row.action_code === currentActionCode) || null;

  const filteredActions = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return flatActions.filter((action: any) => {
      if (phaseFilter !== 'all' && action.phase_code !== phaseFilter) return false;
      if (statusFilter !== 'all' && action.status !== statusFilter) return false;
      if (launchCriticalOnly && !action.launch_critical) return false;
      if (needle) {
        const haystack = [action.phase_name, action.section_name, action.action_title, action.objective, ...(action.tasks || []).map((task: any) => task.task_title)].join(' ').toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [flatActions, phaseFilter, statusFilter, launchCriticalOnly, search]);

  const nextVisibleActions = useMemo(() => filteredActions.filter((action: any) => action.action_code !== currentActionCode && action.status !== 'complete').slice(0, 2), [filteredActions, currentActionCode]);
  const laterActions = useMemo(() => filteredActions.filter((action: any) => action.action_code !== currentActionCode && !nextVisibleActions.some((row: any) => row.action_code === action.action_code)), [filteredActions, currentActionCode, nextVisibleActions]);

  const laterActionsByPhase = useMemo(() => {
    const groups = new Map<string, any[]>();
    laterActions.forEach((action: any) => {
      const key = action.phase_name;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(action);
    });
    return Array.from(groups.entries());
  }, [laterActions]);

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
          action_code: ctx.action?.action_code || null,
          section_name: ctx.section_name || '—',
          phase_name: ctx.phase_name || '—',
          phase_code: ctx.phase_code || 'unknown',
        };
      })
      .filter((doc: any) => {
        if (documentPhaseFilter !== 'all' && doc.phase_code !== documentPhaseFilter) return false;
        if (documentTypeFilter !== 'all' && doc.evidence_type !== documentTypeFilter) return false;
        if (!needle) return true;
        const hay = [doc.label, doc.task_title, doc.action_title, doc.section_name, doc.phase_name].join(' ').toLowerCase();
        return hay.includes(needle);
      });
  }, [evidence, taskContextByInstance, documentSearch, documentPhaseFilter, documentTypeFilter]);

  const completionSummary = useMemo(() => {
    const total = flatActions.length;
    const done = flatActions.filter((row: any) => row.status === 'complete').length;
    return { total, done };
  }, [flatActions]);

  const documentSummary = useMemo(() => {
    const total = documentRows.length;
    const linkedTasks = new Set(documentRows.map((doc: any) => doc.task_instance_id)).size;
    const latest = documentRows
      .map((doc: any) => new Date(doc.uploaded_at).getTime())
      .filter((value: number) => Number.isFinite(value))
      .sort((a: number, b: number) => b - a)[0];
    return { total, linkedTasks, latest: latest ? new Date(latest).toLocaleDateString() : '—' };
  }, [documentRows]);

  const documentTypes = useMemo(() => Array.from(new Set((evidence || []).map((doc: any) => doc.evidence_type).filter(Boolean))), [evidence]);

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
            <label style={{ display: 'flex', gap: 10, alignItems: 'center', paddingTop: 24 }}>
              <input type="checkbox" checked={Boolean(form.hiringStaff)} onChange={(e) => setForm((current) => ({ ...current, hiringStaff: e.target.checked }))} />
              <span style={{ fontSize: 13, color: '#374151' }}>I plan to hire staff soon</span>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1.4fr) repeat(5, minmax(120px, 0.7fr))', gap: 12, alignItems: 'stretch' }}>
          <div>
            <GroupLabel>Business context</GroupLabel>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{profile?.business_name || 'Business Readiness workspace'}</div>
            <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <StatusPill label={workspace?.launch_ready_flag ? 'ready' : 'blocked'} />
              <span style={{ fontSize: 12, color: '#6b7280' }}>{businessTypeLabel}</span>
              <span style={{ fontSize: 12, color: '#6b7280' }}>•</span>
              <span style={{ fontSize: 12, color: '#6b7280' }}>{regionLabel}</span>
              {data?.employerIntent ? <><span style={{ fontSize: 12, color: '#6b7280' }}>•</span><span style={{ fontSize: 12, color: '#6b7280' }}>Hiring staff</span></> : null}
            </div>
            <SmallMuted style={{ marginTop: 10 }}>{profile?.business_description || 'Execution workspace for getting this business launch-ready and operating-ready.'}</SmallMuted>
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
          <Card style={{ background: '#f9fffb', borderColor: '#d1fae5' }}>
            <GroupLabel>Start here</GroupLabel>
            {currentAction ? (
              <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ fontWeight: 800, fontSize: 22 }}>{currentAction.action_title}</div>
                  {currentAction.launch_critical ? <StatusPill label="critical" /> : null}
                  <StatusPill label={currentAction.status} />
                </div>
                <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.6 }}>{currentAction.objective}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1fr) minmax(240px, 1fr)', gap: 12 }}>
                  <Card style={{ padding: 12 }}>
                    <SmallMuted>Do this now</SmallMuted>
                    <div style={{ fontWeight: 700, marginTop: 6 }}>{currentAction.tasks.find((task: any) => task.status !== 'done')?.task_title || 'All tasks complete'}</div>
                    <SmallMuted style={{ marginTop: 6 }}>Open Execution to complete the tasks for this action.</SmallMuted>
                  </Card>
                  <Card style={{ padding: 12 }}>
                    <SmallMuted>What this unlocks</SmallMuted>
                    <div style={{ fontWeight: 700, marginTop: 6 }}>{nextVisibleActions[0]?.action_title || 'Next action will appear here'}</div>
                    <SmallMuted style={{ marginTop: 6 }}>Kinto will move you forward once this action is complete.</SmallMuted>
                  </Card>
                </div>
              </div>
            ) : <SmallMuted style={{ marginTop: 8 }}>No current action available.</SmallMuted>}
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1.1fr) minmax(280px, 0.9fr)', gap: 16 }}>
            <Card>
              <SectionTitle>Sponsor summary</SectionTitle>
              <div style={{ marginTop: 10, lineHeight: 1.55 }}>{data?.summary}</div>
            </Card>
            <Card>
              <SectionTitle>Up next</SectionTitle>
              <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                {nextVisibleActions.length ? nextVisibleActions.map((item: any, index: number) => (
                  <div key={item.action_code} style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 12 }}>
                    <div style={{ fontWeight: 700 }}>{index + 1}. {item.action_title}</div>
                    <SmallMuted style={{ marginTop: 4 }}>{item.objective}</SmallMuted>
                  </div>
                )) : <SmallMuted>No later actions are visible yet.</SmallMuted>}
              </div>
            </Card>
          </div>

          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <SectionTitle>Launch blockers</SectionTitle>
                <SmallMuted>Only the blockers that are stopping launch or the next critical step.</SmallMuted>
              </div>
              <button onClick={runLaunchCheck} disabled={saving} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #111827', background: '#fff', color: '#111827', fontWeight: 600 }}>
                {saving ? 'Refreshing…' : 'Run launch check'}
              </button>
            </div>
            <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
              {blockers.length ? blockers.slice(0, 3).map((row: any) => (
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
          <Card style={{ background: '#f9fffb', borderColor: currentAction?.launch_critical ? '#fecaca' : '#d1fae5' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ maxWidth: 860 }}>
                <GroupLabel>Current action</GroupLabel>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>{currentAction?.action_title || 'No current action available'}</div>
                  {currentAction?.launch_critical ? <StatusPill label="critical" /> : null}
                  {currentAction ? <StatusPill label={currentAction.status} /> : null}
                </div>
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
              <SectionTitle>Complete these tasks now</SectionTitle>
              <SmallMuted>Focus on this action first. Kinto will move the next action up once these tasks are complete.</SmallMuted>
              <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
                {currentAction.tasks.map((task: any) => {
                  const linkedDocs = docsByTask.get(task.task_instance_id) || [];
                  const isComposerOpen = showDocComposerForTask === task.task_instance_id;
                  return (
                    <TaskBlock
                      key={task.task_code}
                      task={task}
                      linkedDocs={linkedDocs}
                      saving={saving}
                      onStart={() => updateTask(task.task_instance_id, 'in_progress')}
                      onComplete={() => updateTask(task.task_instance_id, 'done')}
                      showComposer={isComposerOpen}
                      setShowComposer={setShowDocComposerForTask}
                      docDraft={docDraft}
                      setDocDraft={setDocDraft}
                      onSaveDoc={() => addTaskDocument(task.task_instance_id)}
                    />
                  );
                })}
              </div>
            </Card>
          ) : null}

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) minmax(300px, 1fr)', gap: 16 }}>
            <Card>
              <SectionTitle>Up next</SectionTitle>
              <SmallMuted>These actions become important after the current one.</SmallMuted>
              <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                {nextVisibleActions.length ? nextVisibleActions.map((action: any) => (
                  <div key={action.action_code} style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ fontWeight: 700 }}>{action.action_title}</div>
                      {action.launch_critical ? <StatusPill label="critical" /> : null}
                    </div>
                    <SmallMuted style={{ marginTop: 4 }}>{action.objective}</SmallMuted>
                    <button onClick={() => openActionInExecution(action.action_code)} style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontWeight: 600 }}>Make current action</button>
                  </div>
                )) : <SmallMuted>No next actions visible yet.</SmallMuted>}
              </div>
            </Card>

            <Card>
              <SectionTitle>Need a different view?</SectionTitle>
              <SmallMuted>Search and filters are available, but they stay secondary so the main focus remains execution.</SmallMuted>
              <div style={{ marginTop: 12 }}>
                <button onClick={() => setShowAdvancedFilters((current) => !current)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontWeight: 600 }}>
                  {showAdvancedFilters ? 'Hide search and filters' : 'Show search and filters'}
                </button>
              </div>
              {showAdvancedFilters ? (
                <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search actions or tasks" style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }} />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
                    <label>
                      <SmallMuted>Phase</SmallMuted>
                      <select value={phaseFilter} onChange={(e) => setPhaseFilter(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db', marginTop: 4 }}>
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
                    <button onClick={() => setLaunchCriticalOnly((current) => !current)} style={{ marginTop: 20, padding: '10px 14px', borderRadius: 8, border: launchCriticalOnly ? '1px solid #fca5a5' : '1px solid #d1d5db', background: launchCriticalOnly ? '#fff7f7' : '#fff', color: launchCriticalOnly ? '#b91c1c' : '#111827', fontWeight: 600 }}>
                      {launchCriticalOnly ? 'Launch critical only' : 'Show all actions'}
                    </button>
                  </div>
                </div>
              ) : null}
            </Card>
          </div>

          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <SectionTitle>Later actions</SectionTitle>
                <SmallMuted>Everything else stays collapsed until you need it.</SmallMuted>
              </div>
              <button onClick={() => setShowLater((current) => !current)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontWeight: 600 }}>
                {showLater ? 'Hide later actions' : 'Show later actions'}
              </button>
            </div>
            {showLater ? (
              <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
                {laterActionsByPhase.length ? laterActionsByPhase.map(([phaseName, actions]: any) => (
                  <details key={phaseName} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, background: '#fff' }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 700 }}>{phaseName} ({actions.length})</summary>
                    <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                      {actions.map((action: any) => (
                        <div key={action.action_code} style={{ border: '1px solid #f3f4f6', borderRadius: 10, padding: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <div style={{ fontWeight: 700 }}>{action.action_title}</div>
                            <StatusPill label={action.status === 'complete' ? 'complete' : 'later'} />
                          </div>
                          <SmallMuted style={{ marginTop: 4 }}>{action.objective}</SmallMuted>
                        </div>
                      ))}
                    </div>
                  </details>
                )) : <SmallMuted>No later actions available right now.</SmallMuted>}
              </div>
            ) : null}
          </Card>
        </div>
      ) : null}

      {activeView === 'documents' ? (
        <div style={{ display: 'grid', gap: 16 }}>
          <Card>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <Card style={{ padding: 14 }}>
                <SmallMuted>Total documents</SmallMuted>
                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>{documentSummary.total}</div>
              </Card>
              <Card style={{ padding: 14 }}>
                <SmallMuted>Linked tasks</SmallMuted>
                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>{documentSummary.linkedTasks}</div>
              </Card>
              <Card style={{ padding: 14 }}>
                <SmallMuted>Latest saved</SmallMuted>
                <div style={{ fontSize: 18, fontWeight: 800, marginTop: 8 }}>{documentSummary.latest}</div>
              </Card>
              <Card style={{ padding: 14 }}>
                <SmallMuted>Current phase files</SmallMuted>
                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>{documentRows.filter((doc: any) => doc.phase_code === workspace?.current_phase_code).length}</div>
              </Card>
            </div>
          </Card>

          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <SectionTitle>Document repository</SectionTitle>
                <SmallMuted>Files and links saved against Business Readiness tasks. Filter them by phase or type, then jump back into the related work.</SmallMuted>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1fr) repeat(2, minmax(160px, 0.55fr))', gap: 10, marginTop: 14 }}>
              <input value={documentSearch} onChange={(e) => setDocumentSearch(e.target.value)} placeholder="Search documents, tasks, or actions" style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }} />
              <label>
                <SmallMuted>Phase</SmallMuted>
                <select value={documentPhaseFilter} onChange={(e) => setDocumentPhaseFilter(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db', marginTop: 4 }}>
                  <option value="all">All phases</option>
                  {phaseStates.map((phase: any) => <option key={phase.phase_code} value={phase.phase_code}>{phase.phase_name}</option>)}
                </select>
              </label>
              <label>
                <SmallMuted>Type</SmallMuted>
                <select value={documentTypeFilter} onChange={(e) => setDocumentTypeFilter(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db', marginTop: 4 }}>
                  <option value="all">All document types</option>
                  {documentTypes.map((type: any) => <option key={String(type)} value={String(type)}>{sentenceCase(String(type))}</option>)}
                </select>
              </label>
            </div>
          </Card>

          {documentRows.length ? (
            <div style={{ display: 'grid', gap: 12 }}>
              {documentRows.map((doc: any) => (
                <Card key={doc.evidence_id} style={{ padding: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1.1fr) repeat(4, minmax(120px, 0.6fr)) auto', gap: 12, alignItems: 'center' }}>
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
                    <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
                      {doc.external_link ? <a href={doc.external_link} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 700 }}>Open</a> : <StatusPill label={doc.review_status || 'saved'} />}
                      {doc.action_code ? <button onClick={() => openActionInExecution(doc.action_code)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontWeight: 600, fontSize: 12 }}>Open task</button> : null}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <SmallMuted>No documents match this view yet. Add files or links from a task inside Execution.</SmallMuted>
            </Card>
          )}
        </div>
      ) : null}
    </div>
  );
}
