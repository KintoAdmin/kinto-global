// @ts-nocheck
'use client';

import { useEffect, useMemo, useState } from 'react';

function withAid(path: string, aid?: string | null) {
  if (!aid) return path;
  return `${path}${path.includes('?') ? '&' : '?'}assessmentId=${encodeURIComponent(aid)}`;
}

function statusBadgeClass(flag?: boolean) {
  return flag ? 'badge-success' : 'badge-warn';
}

export function BusinessReadinessClient({ assessmentId, view = 'overview' }: { assessmentId?: string | null; view?: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    businessTypeCode: 'professional_services',
    primaryRegionCode: 'south_africa',
    subRegionCode: '',
    businessName: '',
    founderName: '',
    whatYouSell: '',
    targetCustomer: '',
  });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(withAid('/api/business-readiness', assessmentId), { cache: 'no-store' });
      const payload = await res.json();
      if (!res.ok || payload.ok === false) throw new Error(payload.error || 'Failed to load Business Readiness.');
      setData(payload.data || payload);
    } catch (err: any) {
      setError(err?.message || 'Failed to load Business Readiness.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [assessmentId]);

  async function initializeWorkspace() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/business-readiness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'initialize', assessmentId, ...form, businessDescription: form.whatYouSell }),
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

  const blockers = data?.blockers || [];
  const domains = data?.domainStates || [];
  const phases = data?.phaseStates || [];
  const nextActions = data?.nextActions || [];

  const groupedDomains = useMemo(() => {
    const byPhase: Record<string, any[]> = {};
    for (const row of domains) {
      const key = row.phase_code || 'phase_0_define';
      if (!byPhase[key]) byPhase[key] = [];
      byPhase[key].push(row);
    }
    return byPhase;
  }, [domains]);

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
        <div className="stat-card stat-card-accent"><div className="stat-card-label">Current phase</div><div className="stat-card-value">{data.workspace.current_phase_code?.replace('phase_', '').replaceAll('_', ' ') || '—'}</div><div className="stat-card-sub">Guided readiness flow</div></div>
        <div className="stat-card stat-card-accent"><div className="stat-card-label">Readiness</div><div className="stat-card-value">{String(data.workspace.overall_readiness_state || 'started').replaceAll('_', ' ')}</div><div className="stat-card-sub">Module state</div></div>
        <div className="stat-card stat-card-accent"><div className="stat-card-label">Launch blockers</div><div className="stat-card-value">{blockers.length}</div><div className="stat-card-sub">Critical setup gaps</div></div>
        <div className="stat-card stat-card-accent"><div className="stat-card-label">Launch status</div><div className="stat-card-value"><span className={`badge ${statusBadgeClass(Boolean(data.workspace.launch_ready_flag))}`}>{data.workspace.launch_ready_flag ? 'Ready' : 'Blocked'}</span></div><div className="stat-card-sub">Minimum launch threshold</div></div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">Sponsor summary</h3>
            <p className="card-subtitle">Plain-English view of where the business stands right now.</p>
          </div>
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
                    <td>{String(row.status || 'not_started').replaceAll('_', ' ')}</td>
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
                <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: '0.5rem' }}>{phaseCode.replace('phase_', '').replaceAll('_', ' ')}</div>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  {rows.map((row: any) => (
                    <div key={row.domain_code} style={{ padding: '0.75rem', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{row.domain_name}</div>
                          <div className="text-xs muted-2">State: {String(row.readiness_state || 'not_started').replaceAll('_', ' ')}</div>
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

      {(view === 'overview' || view === 'blockers') && (
        <div className="grid-2">
          <div className="card">
            <div className="card-header"><div><h3 className="card-title">Immediate next actions</h3><p className="card-subtitle">Published actions that should move first.</p></div></div>
            <ol style={{ margin: 0, paddingLeft: '1.25rem', display: 'grid', gap: '0.5rem' }}>
              {nextActions.map((row: any) => (
                <li key={row.id}>
                  <div style={{ fontWeight: 600 }}>{row.title}</div>
                  <div className="text-xs muted-2">{row.reason}</div>
                </li>
              ))}
            </ol>
          </div>
          <div className="card">
            <div className="card-header"><div><h3 className="card-title">Active launch blockers</h3><p className="card-subtitle">These are the setup gaps keeping launch from turning green.</p></div></div>
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
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
