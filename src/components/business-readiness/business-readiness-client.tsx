'use client';
// @ts-nocheck

import { useEffect, useMemo, useState } from 'react';

type Props = { assessmentId?: string | null; initialData?: any; view?: string };

function phaseLabel(code?: string | null, phaseStates?: any[]) {
  const row = (phaseStates || []).find((item: any) => item.phase_code === code);
  return row?.phase_name || '—';
}

function sentenceCase(value?: string | null) {
  const raw = String(value || '').replaceAll('_', ' ');
  if (!raw) return '—';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function badgeTone(status?: string | null) {
  const raw = String(status || '').toLowerCase();
  if (raw === 'complete' || raw === 'done' || raw === 'set_up') return { bg: '#dcfce7', color: '#166534' };
  if (raw === 'in_progress' || raw === 'started') return { bg: '#fef3c7', color: '#92400e' };
  if (raw === 'blocked') return { bg: '#fee2e2', color: '#991b1b' };
  return { bg: '#e5e7eb', color: '#374151' };
}

function StatusPill({ label }: { label: string }) {
  const tone = badgeTone(label);
  return (
    <span style={{ background: tone.bg, color: tone.color, borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 600 }}>
      {sentenceCase(label)}
    </span>
  );
}

function SmallMuted({ children }: any) {
  return <div style={{ fontSize: 13, color: '#6b7280' }}>{children}</div>;
}

function Card({ children }: any) {
  return <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, background: '#fff' }}>{children}</div>;
}

function SectionTitle({ children }: any) {
  return <h3 style={{ margin: 0, fontSize: 18 }}>{children}</h3>;
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
  const phaseStates = data?.phaseStates || [];
  const blockers = data?.blockers || [];
  const nextActions = data?.nextActions || [];
  const implementationPlan = data?.implementationPlan || [];

  const currentFocus = nextActions[0] || null;
  const currentPhaseName = phaseLabel(workspace?.current_phase_code, phaseStates);

  const currentPhasePlan = useMemo(() => {
    return implementationPlan.find((phase: any) => phase.phase_code === workspace?.current_phase_code) || implementationPlan[0] || null;
  }, [implementationPlan, workspace?.current_phase_code]);

  if (loading) return <div style={{ padding: 16 }}>Loading Business Readiness…</div>;

  if (!assessmentId) {
    return <Card>No assessment selected yet.</Card>;
  }

  if (!data?.hasWorkspace) {
    return (
      <div style={{ display: 'grid', gap: 16 }}>
        <Card>
          <SectionTitle>Start Business Readiness</SectionTitle>
          <SmallMuted>Tell Kinto what you are starting and it will build the first implementation plan.</SmallMuted>
          <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
            <label>
              <SmallMuted>Business type</SmallMuted>
              <select value={form.businessTypeCode} onChange={(e) => setForm((current) => ({ ...current, businessTypeCode: e.target.value }))} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db', marginTop: 4 }}>
                {(data?.businessTypes || []).map((row: any) => <option key={row.code} value={row.code}>{row.label}</option>)}
              </select>
            </label>
            <label>
              <SmallMuted>Region</SmallMuted>
              <select value={form.primaryRegionCode} onChange={(e) => setForm((current) => ({ ...current, primaryRegionCode: e.target.value }))} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db', marginTop: 4 }}>
                {(data?.regions || []).map((row: any) => <option key={row.code} value={row.code}>{row.label}</option>)}
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

      {view === 'overview' ? (
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <Card>
              <SmallMuted>Current phase</SmallMuted>
              <div style={{ fontSize: 20, fontWeight: 700, marginTop: 6 }}>{currentPhaseName}</div>
            </Card>
            <Card>
              <SmallMuted>Readiness</SmallMuted>
              <div style={{ fontSize: 20, fontWeight: 700, marginTop: 6 }}>{sentenceCase(workspace?.overall_readiness_state)}</div>
            </Card>
            <Card>
              <SmallMuted>Launch status</SmallMuted>
              <div style={{ fontSize: 20, fontWeight: 700, marginTop: 6 }}>{workspace?.launch_ready_flag ? 'Ready' : 'Not ready yet'}</div>
            </Card>
            <Card>
              <SmallMuted>Critical actions open</SmallMuted>
              <div style={{ fontSize: 20, fontWeight: 700, marginTop: 6 }}>{blockers.length}</div>
            </Card>
          </div>

          <Card>
            <SectionTitle>Sponsor summary</SectionTitle>
            <div style={{ marginTop: 10, lineHeight: 1.55 }}>{data?.summary}</div>
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1.1fr) minmax(320px, 1.4fr)', gap: 16 }}>
            <Card>
              <SectionTitle>What Kinto wants you to focus on first</SectionTitle>
              <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
                {nextActions.slice(0, 3).map((item: any, index: number) => (
                  <div key={item.id} style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 10 }}>
                    <div style={{ fontWeight: 600 }}>{index + 1}. {item.title}</div>
                    <SmallMuted>{item.reason}</SmallMuted>
                    {item.next_task_name ? <div style={{ marginTop: 8, fontSize: 13 }}>Start with: <strong>{item.next_task_name}</strong></div> : null}
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <SectionTitle>What is holding you back right now</SectionTitle>
              <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                {blockers.length ? blockers.slice(0, 4).map((row: any) => (
                  <div key={row.blocker_id} style={{ padding: 12, border: '1px solid #fee2e2', borderRadius: 10, background: '#fff7f7' }}>
                    <div style={{ fontWeight: 600 }}>{row.title}</div>
                    <SmallMuted>{row.description}</SmallMuted>
                  </div>
                )) : <SmallMuted>No active launch blockers right now.</SmallMuted>}
              </div>
            </Card>
          </div>

          <Card>
            <SectionTitle>What happens next</SectionTitle>
            <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
              {(currentPhasePlan?.sections || []).flatMap((section: any) => section.actions).slice(0, 3).map((action: any) => (
                <div key={action.action_code} style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                    <div style={{ fontWeight: 600 }}>{action.action_title}</div>
                    <StatusPill label={action.status} />
                  </div>
                  <SmallMuted>{action.objective}</SmallMuted>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12 }}>
              <button onClick={runLaunchCheck} disabled={saving} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #111827', background: '#fff', color: '#111827', fontWeight: 600 }}>
                {saving ? 'Refreshing…' : 'Refresh launch check'}
              </button>
            </div>
          </Card>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {(implementationPlan || []).map((phase: any) => (
            <Card key={phase.phase_code}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div>
                  <SectionTitle>{phase.phase_name}</SectionTitle>
                  <SmallMuted>{phase.phase_code === workspace?.current_phase_code ? 'Current phase' : 'Later phase'}</SmallMuted>
                </div>
                {phase.phase_code === workspace?.current_phase_code ? <StatusPill label="current" /> : null}
              </div>
              <div style={{ display: 'grid', gap: 16, marginTop: 16 }}>
                {phase.sections.map((section: any) => (
                  <div key={section.section_code}>
                    <div style={{ fontWeight: 700, marginBottom: 10 }}>{section.section_name}</div>
                    <div style={{ display: 'grid', gap: 12 }}>
                      {section.actions.map((action: any) => {
                        const isOpen = openAction === action.action_code;
                        return (
                          <div key={action.action_code} style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
                            <button onClick={() => setOpenAction(isOpen ? null : action.action_code)} style={{ width: '100%', textAlign: 'left', padding: 14, border: 'none', background: '#f9fafb', cursor: 'pointer' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                                <div>
                                  <div style={{ fontWeight: 700 }}>{action.action_title}</div>
                                  <SmallMuted>{action.objective}</SmallMuted>
                                  <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                    <StatusPill label={action.status} />
                                    {action.launch_critical ? <span style={{ fontSize: 12, fontWeight: 600, color: '#991b1b' }}>Launch critical</span> : null}
                                    <span style={{ fontSize: 12, color: '#6b7280' }}>{action.completed_tasks} / {action.total_tasks} tasks complete</span>
                                  </div>
                                </div>
                                <div style={{ fontSize: 12, color: '#6b7280' }}>{isOpen ? 'Hide' : 'Open'}</div>
                              </div>
                            </button>
                            {isOpen ? (
                              <div style={{ padding: 14, display: 'grid', gap: 12 }}>
                                {action.tasks.map((task: any) => (
                                  <div key={task.task_code} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 14 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                                      <div style={{ fontWeight: 600 }}>{task.task_title}</div>
                                      <StatusPill label={task.status} />
                                    </div>
                                    <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                                      <div>
                                        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Instructions</div>
                                        <div style={{ lineHeight: 1.55 }}>{task.instructions}</div>
                                      </div>
                                      <div>
                                        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Requirements</div>
                                        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.5 }}>
                                          {(task.requirements || []).map((item: string) => <li key={item}>{item}</li>)}
                                        </ul>
                                      </div>
                                      <div>
                                        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Where to do this</div>
                                        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.5 }}>
                                          {(task.where_to_do_this || []).map((item: string) => <li key={item}>{item}</li>)}
                                        </ul>
                                      </div>
                                      <div>
                                        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Record and save</div>
                                        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.5 }}>
                                          {(task.record_and_save || []).map((item: string) => <li key={item}>{item}</li>)}
                                        </ul>
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                                      <button onClick={() => updateTask(task.task_instance_id, 'in_progress')} disabled={saving || !task.task_instance_id} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff' }}>Mark started</button>
                                      <button onClick={() => updateTask(task.task_instance_id, 'done')} disabled={saving || !task.task_instance_id} style={{ padding: '8px 10px', borderRadius: 8, border: 'none', background: '#111827', color: '#fff' }}>Mark complete</button>
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
          ))}
        </div>
      )}
    </div>
  );
}
