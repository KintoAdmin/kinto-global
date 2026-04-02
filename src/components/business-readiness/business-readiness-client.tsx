'use client';
// @ts-nocheck

import { useEffect, useMemo, useState } from 'react';

type Props = { assessmentId?: string | null; initialData?: any; view?: string };

const TASK_FILTERS = [
  { key: 'all', label: 'All tasks' },
  { key: 'do_now', label: 'Do now' },
  { key: 'blockers', label: 'Launch blockers' },
  { key: 'proof', label: 'Proof needed' },
  { key: 'done', label: 'Done' },
];

function statusBadgeClass(ok: boolean) {
  return ok ? 'badge-good' : 'badge-warn';
}

function taskStatusLabel(status?: string | null) {
  return String(status || 'not_started').replaceAll('_', ' ');
}

function titleCase(raw?: string | null) {
  return String(raw || '')
    .replaceAll('_', ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function readinessLabel(state?: string | null) {
  const raw = String(state || 'not_started');
  return raw === 'set_up' ? 'Set up' : titleCase(raw);
}

function phaseBadgeLabel(phaseCode?: string | null, phases?: any[]) {
  const row = (phases || []).find((item: any) => item.phase_code === phaseCode);
  if (row?.phase_name) return row.phase_name;
  const raw = String(phaseCode || '').replace('phase_', '');
  if (!raw) return '—';
  return `Phase ${raw.split('_')[0]} — ${titleCase(raw.split('_').slice(1).join(' '))}`;
}

function viewLink(nextView: string) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.set('view', nextView);
  window.location.href = url.toString();
}

export function BusinessReadinessClient({ assessmentId, initialData, view = 'overview' }: Props) {
  const [data, setData] = useState<any>(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taskFilter, setTaskFilter] = useState('do_now');
  const [form, setForm] = useState({
    businessTypeCode: 'professional_services',
    primaryRegionCode: 'south_africa',
    businessName: '',
    founderName: '',
    targetCustomer: '',
    whatYouSell: '',
  });
  const [evidenceDrafts, setEvidenceDrafts] = useState<Record<string, string>>({});

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
    if (!assessmentId) return;
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

  async function saveEvidence(taskInstanceId: string) {
    if (!assessmentId) return;
    const noteText = String(evidenceDrafts[taskInstanceId] || '').trim();
    if (!noteText) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/business-readiness/evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assessmentId, taskInstanceId, noteText, evidenceType: 'note', replaceExisting: true }),
      });
      const payload = await res.json();
      if (!res.ok || payload.ok === false) throw new Error(payload.error || 'Failed to save evidence.');
      setData(payload.data || payload);
      setEvidenceDrafts((current) => ({ ...current, [taskInstanceId]: '' }));
    } catch (err: any) {
      setError(err?.message || 'Failed to save evidence.');
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

  const blockers = data?.blockers || [];
  const domains = data?.domainStates || [];
  const phases = data?.phaseStates || [];
  const tasks = data?.tasks || [];
  const nextActions = data?.nextActions || [];
  const evidence = data?.evidence || [];

  const groupedDomains = useMemo(() => {
    const byPhase: Record<string, any[]> = {};
    for (const row of domains) {
      const key = row.phase_code || 'phase_0_define';
      if (!byPhase[key]) byPhase[key] = [];
      byPhase[key].push(row);
    }
    return byPhase;
  }, [domains]);

  const evidenceByTask = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const row of evidence) {
      if (!map[row.task_instance_id]) map[row.task_instance_id] = [];
      map[row.task_instance_id].push(row);
    }
    return map;
  }, [evidence]);

  const blockerTaskCodes = useMemo(() => new Set(blockers.map((row: any) => row.task_code).filter(Boolean)), [blockers]);
  const activePhaseCode = data?.workspace?.current_phase_code || phases.find((row: any) => row.status !== 'complete' && row.status !== 'locked')?.phase_code || 'phase_0_define';

  const groupedTasksByPhase = useMemo(() => {
    const byPhase: Record<string, Record<string, any[]>> = {};
    for (const task of tasks) {
      const phaseCode = task.phase_code || 'phase_0_define';
      const domainCode = task.domain_code || 'd01_business_definition';
      if (!byPhase[phaseCode]) byPhase[phaseCode] = {};
      if (!byPhase[phaseCode][domainCode]) byPhase[phaseCode][domainCode] = [];
      byPhase[phaseCode][domainCode].push(task);
    }
    return byPhase;
  }, [tasks]);

  const filteredTasksByPhase = useMemo(() => {
    const byPhase: Record<string, Record<string, any[]>> = {};
    const include = (task: any) => {
      if (taskFilter === 'all') return true;
      if (taskFilter === 'done') return task.status === 'done';
      if (taskFilter === 'proof') return Boolean(task.evidence_required_flag);
      if (taskFilter === 'blockers') return Boolean(task.can_block_launch) || blockerTaskCodes.has(task.task_code);
      if (taskFilter === 'do_now') return task.status !== 'done' && (blockerTaskCodes.has(task.task_code) || task.can_block_launch || task.phase_code === activePhaseCode);
      return true;
    };
    for (const [phaseCode, domainsMap] of Object.entries(groupedTasksByPhase)) {
      for (const [domainCode, rows] of Object.entries(domainsMap)) {
        const filtered = (rows as any[]).filter(include);
        if (!filtered.length) continue;
        if (!byPhase[phaseCode]) byPhase[phaseCode] = {};
        byPhase[phaseCode][domainCode] = filtered.sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
      }
    }
    return byPhase;
  }, [groupedTasksByPhase, taskFilter, blockerTaskCodes, activePhaseCode]);

  const evidenceTasks = useMemo(() => tasks.filter((task: any) => task.evidence_required_flag), [tasks]);

  if (loading) return <div className="card"><div className="card-title">Loading Business Readiness…</div></div>;
  if (error) return <div className="card"><div className="card-title">Business Readiness</div><p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p></div>;

  if (!data?.workspace) {
    return (
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">Set up Business Readiness</h3>
            <p className="card-subtitle">Choose the type of business and operating region so Kinto can create the guided readiness workspace.</p>
          </div>
        </div>
        <div className="grid-2">
          <label className="field">
            <span className="field-label">Business type</span>
            <select className="input" value={form.businessTypeCode} onChange={(e) => setForm((v) => ({ ...v, businessTypeCode: e.target.value }))}>
              {(data?.catalog?.businessTypes || []).map((row: any) => <option key={row.code} value={row.code}>{row.label}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Region</span>
            <select className="input" value={form.primaryRegionCode} onChange={(e) => setForm((v) => ({ ...v, primaryRegionCode: e.target.value }))}>
              {(data?.catalog?.regions || []).map((row: any) => <option key={row.code} value={row.code}>{row.label}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Business name</span>
            <input className="input" value={form.businessName} onChange={(e) => setForm((v) => ({ ...v, businessName: e.target.value }))} placeholder="Your business or working name" />
          </label>
          <label className="field">
            <span className="field-label">Founder name</span>
            <input className="input" value={form.founderName} onChange={(e) => setForm((v) => ({ ...v, founderName: e.target.value }))} placeholder="Founder / owner" />
          </label>
          <label className="field">
            <span className="field-label">What will you sell?</span>
            <input className="input" value={form.whatYouSell} onChange={(e) => setForm((v) => ({ ...v, whatYouSell: e.target.value }))} placeholder="Products or services" />
          </label>
          <label className="field">
            <span className="field-label">Target customer</span>
            <input className="input" value={form.targetCustomer} onChange={(e) => setForm((v) => ({ ...v, targetCustomer: e.target.value }))} placeholder="Who this is for" />
          </label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button className="btn btn-primary" onClick={initializeWorkspace} disabled={saving}>
            {saving ? 'Creating…' : 'Create workspace'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div className="grid-4">
        <div className="stat-card stat-card-accent"><div className="stat-card-label">Current phase</div><div className="stat-card-value">{phaseBadgeLabel(data.workspace.current_phase_code, phases)}</div><div className="stat-card-sub">Guided readiness flow</div></div>
        <div className="stat-card stat-card-accent"><div className="stat-card-label">Readiness</div><div className="stat-card-value">{readinessLabel(data.workspace.overall_readiness_state || 'started')}</div><div className="stat-card-sub">Module state</div></div>
        <div className="stat-card stat-card-accent"><div className="stat-card-label">Launch blockers</div><div className="stat-card-value">{blockers.length}</div><div className="stat-card-sub">Critical setup gaps</div></div>
        <div className="stat-card stat-card-accent"><div className="stat-card-label">Launch status</div><div className="stat-card-value"><span className={`badge ${statusBadgeClass(Boolean(data.workspace.launch_ready_flag))}`}>{data.workspace.launch_ready_flag ? 'Ready' : 'Blocked'}</span></div><div className="stat-card-sub">Minimum launch threshold</div></div>
      </div>

      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
          <div>
            <h3 className="card-title">Sponsor summary</h3>
            <p className="card-subtitle">Plain-English view of where the business stands right now.</p>
          </div>
          <button className="btn btn-secondary" onClick={runLaunchCheck} disabled={saving}>{saving ? 'Working…' : 'Run launch check'}</button>
        </div>
        <p style={{ margin: 0, color: 'var(--text)' }}>{data.sponsorSummary}</p>
      </div>

      {(view === 'overview' || view === 'phases') && (
        <div className="card">
          <div className="card-header"><div><h3 className="card-title">Phase progress</h3><p className="card-subtitle">Business Readiness keeps its own six-phase guided journey inside the module.</p></div></div>
          <div className="table-scroll">
            <table className="kinto-table">
              <thead><tr><th>Phase</th><th>Status</th><th>Progress</th></tr></thead>
              <tbody>
                {phases.map((row: any) => (
                  <tr key={row.phase_code}>
                    <td style={{ fontWeight: 600 }}>{row.phase_name}</td>
                    <td>{titleCase(row.status || 'not_started')}</td>
                    <td>{Math.round(Number(row.percent_complete || 0))}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(view === 'overview' || view === 'domains') && (
        <div className="card">
          <div className="card-header"><div><h3 className="card-title">Domain readiness</h3><p className="card-subtitle">Launch-critical foundations are tracked separately from later control and optimisation work.</p></div></div>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {Object.entries(groupedDomains).map(([phaseCode, rows]: any) => (
              <div key={phaseCode}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: '0.5rem' }}>{phaseBadgeLabel(phaseCode, phases)}</div>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  {rows.map((row: any) => (
                    <div key={row.domain_code} style={{ padding: '0.75rem', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{row.domain_name}</div>
                          <div className="text-xs muted-2">State: {readinessLabel(row.readiness_state)}</div>
                          {!!row.next_required_task_code && <div className="text-xs muted-2">Next task: {row.next_required_task_code}</div>}
                        </div>
                        {row.launch_critical ? <span className="badge badge-warn">Launch-critical</span> : <span className="badge badge-muted">Supporting</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(view === 'overview' || view === 'tasks') && (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div><h3 className="card-title">Tasks and proof</h3><p className="card-subtitle">Work by phase, focus on the current step first, and keep proof with the task that needs it.</p></div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {TASK_FILTERS.map((filter) => (
                <button key={filter.key} className={`btn ${taskFilter === filter.key ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTaskFilter(filter.key)}>{filter.label}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gap: '0.85rem' }}>
            {Object.entries(filteredTasksByPhase).map(([phaseCode, domainMap]) => {
              const phase = phases.find((row: any) => row.phase_code === phaseCode);
              const isActive = phaseCode === activePhaseCode;
              return (
                <details key={phaseCode} open={isActive} style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', background: 'var(--surface)' }}>
                  <summary style={{ listStyle: 'none', cursor: 'pointer', padding: '0.85rem 1rem', display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{phaseBadgeLabel(phaseCode, phases)}</div>
                      <div className="text-xs muted-2">{titleCase(phase?.status || 'not_started')} • {Math.round(Number(phase?.percent_complete || 0))}% complete</div>
                    </div>
                    <span className={`badge ${isActive ? 'badge-info' : 'badge-muted'}`}>{isActive ? 'Current focus' : 'Other phase'}</span>
                  </summary>
                  <div style={{ padding: '0 1rem 1rem', display: 'grid', gap: '0.85rem' }}>
                    {Object.entries(domainMap as Record<string, any[]>).map(([domainCode, taskRows]) => {
                      const domain = domains.find((row: any) => row.domain_code === domainCode);
                      return (
                        <div key={domainCode} style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', padding: '0.85rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.75rem' }}>
                            <div>
                              <div style={{ fontWeight: 700 }}>{domain?.domain_name || domainCode}</div>
                              <div className="text-xs muted-2">{readinessLabel(domain?.readiness_state)} • {Math.round(Number(domain?.percent_complete || 0))}% complete</div>
                            </div>
                            {domain?.launch_critical ? <span className="badge badge-warn">Launch-critical</span> : <span className="badge badge-muted">Supporting</span>}
                          </div>
                          <div style={{ display: 'grid', gap: '0.75rem' }}>
                            {(taskRows as any[]).map((task: any) => {
                              const taskEvidence = evidenceByTask[task.task_instance_id] || [];
                              return (
                                <div key={task.task_instance_id} style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', padding: '0.75rem' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                                    <div>
                                      <div style={{ fontWeight: 600 }}>{task.task_name}</div>
                                      <div className="text-xs muted-2">{task.task_description}</div>
                                      <div className="text-xs muted-2">Role: {titleCase(task.task_role)} • Status: {taskStatusLabel(task.status)}</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                      {blockerTaskCodes.has(task.task_code) ? <span className="badge badge-warn">Fix now</span> : null}
                                      {task.can_block_launch ? <span className="badge badge-warn">Blocks launch</span> : <span className="badge badge-muted">Internal</span>}
                                      {task.evidence_required_flag ? <span className="badge badge-info">Proof needed</span> : null}
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                                    <button className="btn btn-secondary" onClick={() => updateTask(task.task_instance_id, 'in_progress')} disabled={saving || task.status === 'in_progress'}>Start</button>
                                    <button className="btn btn-primary" onClick={() => updateTask(task.task_instance_id, 'done')} disabled={saving || task.status === 'done'}>Mark done</button>
                                    {task.status === 'done' ? <button className="btn btn-secondary" onClick={() => updateTask(task.task_instance_id, 'not_started')} disabled={saving}>Reopen</button> : null}
                                  </div>
                                  <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.5rem' }}>
                                    <div className="text-xs muted-2">Proof / evidence</div>
                                    <textarea className="input" rows={3} value={evidenceDrafts[task.task_instance_id] ?? ''} onChange={(e) => setEvidenceDrafts((current) => ({ ...current, [task.task_instance_id]: e.target.value }))} placeholder={task.evidence_required_flag ? 'Add a note describing the proof or link you have for this step.' : 'Add a simple note if you want to capture proof or context.'} />
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                                      <div className="text-xs muted-2">{taskEvidence.length ? `${taskEvidence.length} proof item(s) saved` : 'No proof saved yet'}</div>
                                      <button className="btn btn-secondary" onClick={() => saveEvidence(task.task_instance_id)} disabled={saving || !String(evidenceDrafts[task.task_instance_id] || '').trim()}>Save proof note</button>
                                    </div>
                                    {taskEvidence.length ? (
                                      <div style={{ display: 'grid', gap: '0.4rem' }}>
                                        {taskEvidence.slice(0, 2).map((item: any) => (
                                          <div key={item.evidence_id} className="text-xs muted-2" style={{ padding: '0.5rem', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)' }}>{item.note_text || item.external_link || item.file_url || 'Proof item saved'}</div>
                                        ))}
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      )}

      {view === 'evidence' && (
        <div className="card">
          <div className="card-header"><div><h3 className="card-title">Evidence queue</h3><p className="card-subtitle">Proof-sensitive steps collected in one place so you can see what still needs supporting evidence.</p></div></div>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {evidenceTasks.map((task: any) => {
              const taskEvidence = evidenceByTask[task.task_instance_id] || [];
              return (
                <div key={task.task_instance_id} style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', padding: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{task.task_name}</div>
                      <div className="text-xs muted-2">{task.domain_name} • {task.status === 'done' ? 'Step completed' : 'Step still in progress'}</div>
                    </div>
                    <span className={`badge ${taskEvidence.length ? 'badge-good' : 'badge-warn'}`}>{taskEvidence.length ? 'Proof saved' : 'Proof missing'}</span>
                  </div>
                  <div style={{ marginTop: '0.75rem' }}>
                    <textarea className="input" rows={3} value={evidenceDrafts[task.task_instance_id] ?? ''} onChange={(e) => setEvidenceDrafts((current) => ({ ...current, [task.task_instance_id]: e.target.value }))} placeholder="Add a proof note, link, or simple explanation for this step." />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', gap: '1rem', flexWrap: 'wrap' }}>
                      <div className="text-xs muted-2">{taskEvidence.length ? `${taskEvidence.length} proof item(s) saved` : 'No proof saved yet'}</div>
                      <button className="btn btn-secondary" onClick={() => saveEvidence(task.task_instance_id)} disabled={saving || !String(evidenceDrafts[task.task_instance_id] || '').trim()}>Save proof note</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(view === 'overview' || view === 'blockers') && (
        <div className="grid-2" style={{ alignItems: 'start' }}>
          <div className="card">
            <div className="card-header"><div><h3 className="card-title">Immediate next actions</h3><p className="card-subtitle">Work these first so the guided setup keeps moving.</p></div></div>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {nextActions.map((row: any) => (
                <div key={row.id} style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', padding: '0.75rem' }}>
                  <div style={{ fontWeight: 600 }}>{row.title}</div>
                  <div className="text-xs muted-2" style={{ marginTop: '0.15rem' }}>{row.reason}</div>
                  <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span className="text-xs muted-2">{phaseBadgeLabel(row.phase_code, phases)}</span>
                    <button className="btn btn-secondary" onClick={() => viewLink('tasks')}>Go to tasks</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-header"><div><h3 className="card-title">Active launch blockers</h3><p className="card-subtitle">Critical setup gaps are listed first, then proof gaps that are stopping launch from turning green.</p></div></div>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {blockers.length === 0 ? <div className="text-sm muted-2">No active launch blockers.</div> : blockers.map((row: any) => (
                <div key={row.blocker_id} style={{ padding: '0.75rem', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{row.title}</div>
                      <div className="text-xs muted-2">{row.description}</div>
                    </div>
                    <span className="badge badge-warn">{row.severity}</span>
                  </div>
                  <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn btn-secondary" onClick={() => viewLink(row.blocker_type === 'missing_evidence' ? 'evidence' : 'tasks')}>Fix this</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
