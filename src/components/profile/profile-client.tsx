// @ts-nocheck
'use client';

import { useState } from 'react';

type Props = { profile: any };

export function ProfileClient({ profile }: Props) {
  const [form, setForm] = useState({
    fullName: profile?.fullName || '',
    workspaceName: profile?.workspaceName || '',
    operatingMode: profile?.operatingMode || 'consultant',
    jobTitle: profile?.jobTitle || '',
    phone: profile?.phone || '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function save() {
    try {
      setSaving(true);
      setError('');
      setMessage('');
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'Failed to save profile.');
      setMessage('Profile saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">User profile</h3>
            <p className="card-subtitle">This section did not exist before this patch. It stores your role, workspace details, and onboarding status.</p>
          </div>
          <span className={`badge ${profile?.onboardingCompleted ? 'badge-success' : 'badge-warn'}`}>{profile?.onboardingCompleted ? 'Onboarding complete' : 'Onboarding incomplete'}</span>
        </div>
        <div className="grid-2" style={{ gap: '0.9rem' }}>
          <label className="field-block"><span className="field-label">Full name</span><input className="kinto-input" value={form.fullName} onChange={e => setForm(current => ({ ...current, fullName: e.target.value }))} /></label>
          <label className="field-block"><span className="field-label">Workspace name</span><input className="kinto-input" value={form.workspaceName} onChange={e => setForm(current => ({ ...current, workspaceName: e.target.value }))} /></label>
          <label className="field-block"><span className="field-label">Operating mode</span><select className="kinto-select" value={form.operatingMode} onChange={e => setForm(current => ({ ...current, operatingMode: e.target.value }))}><option value="own_business">Own organisation</option><option value="consultant">Consultant</option></select></label>
          <label className="field-block"><span className="field-label">Role / title</span><input className="kinto-input" value={form.jobTitle} onChange={e => setForm(current => ({ ...current, jobTitle: e.target.value }))} /></label>
          <label className="field-block"><span className="field-label">Phone</span><input className="kinto-input" value={form.phone} onChange={e => setForm(current => ({ ...current, phone: e.target.value }))} /></label>
          <div className="field-block"><span className="field-label">Account email</span><div className="kinto-input" style={{ display: 'flex', alignItems: 'center', background: 'var(--surface-2)' }}>{profile?.email || '—'}</div></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '0.8rem', color: error ? 'var(--danger)' : 'var(--muted)' }}>{error || message || 'Save changes here without touching the diagnostic engine.'}</div>
          <button className="btn btn-primary btn-sm" type="button" onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button>
        </div>
      </div>
    </div>
  );
}
