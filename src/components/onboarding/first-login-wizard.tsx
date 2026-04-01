// @ts-nocheck
'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { buildRoute } from '@/lib/routes';

const MODES = [
  {
    key: 'own_business',
    title: 'Set up my organisation',
    description: 'Use Kinto for your own business. We will create your organisation profile and first assessment.',
    icon: '🏢',
  },
  {
    key: 'consultant',
    title: 'I am a consultant managing clients',
    description: 'Set up your workspace first, then create the first client and initial assessment.',
    icon: '🧭',
  },
] as const;

type Mode = (typeof MODES)[number]['key'];

type FormState = {
  mode: Mode;
  fullName: string;
  workspaceName: string;
  jobTitle: string;
  phone: string;
  organizationName: string;
  industry: string;
  companySize: string;
  websiteUrl: string;
  country: string;
  primaryContactName: string;
  primaryContactEmail: string;
  servicesSummary: string;
  assessmentName: string;
  assessmentObjective: string;
  priorityOutcomes: string;
  painPoints: string;
  departmentsInScope: string;
  systemsInScope: string;
  locationsInScope: string;
};

const EMPTY_FORM: FormState = {
  mode: 'own_business',
  fullName: '',
  workspaceName: '',
  jobTitle: '',
  phone: '',
  organizationName: '',
  industry: '',
  companySize: '',
  websiteUrl: '',
  country: '',
  primaryContactName: '',
  primaryContactEmail: '',
  servicesSummary: '',
  assessmentName: 'Initial Diagnostic Assessment',
  assessmentObjective: '',
  priorityOutcomes: '',
  painPoints: '',
  departmentsInScope: '',
  systemsInScope: '',
  locationsInScope: '',
};

function StepHeader({ current }: { current: number }) {
  const steps = ['Path', 'Your details', 'Organisation', 'Assessment'];
  return (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
      {steps.map((label, index) => {
        const active = index === current;
        const done = index < current;
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.35rem 0.6rem', borderRadius: 999, border: `1px solid ${active ? 'rgba(26,188,176,0.35)' : 'var(--line)'}`, background: done ? 'rgba(26,188,176,0.12)' : active ? 'rgba(26,188,176,0.06)' : 'var(--surface-2)', fontSize: '0.75rem', color: active ? 'var(--text)' : 'var(--muted)', fontWeight: active ? 700 : 600 }}>
            <span>{done ? '✓' : index + 1}</span>
            <span>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: '0.35rem' }}>
      <span style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 600 }}>{label}</span>
      {children}
    </label>
  );
}

export function FirstLoginWizard() {
  const router = useRouter();
  const pathname = usePathname() || '/workspace';
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  useEffect(() => {
    let live = true;
    async function bootstrap() {
      try {
        const dismissed = typeof window !== 'undefined' ? window.localStorage.getItem('kinto_onboarding_dismissed') : null;
        const res = await fetch('/api/onboarding', { cache: 'no-store' });
        const payload = await res.json().catch(() => ({}));
        if (!live) return;
        const profile = payload?.data?.profile || payload?.profile || null;
        const onboardingCompleted = Boolean(payload?.data?.onboardingCompleted ?? payload?.onboardingCompleted);
        if (!res.ok) throw new Error(payload?.error || 'Failed to load onboarding state.');
        setForm(current => ({
          ...current,
          fullName: profile?.fullName || current.fullName,
          workspaceName: profile?.workspaceName || current.workspaceName,
          jobTitle: profile?.jobTitle || current.jobTitle,
          phone: profile?.phone || current.phone,
          mode: (profile?.operatingMode || current.mode || 'own_business') as Mode,
        }));
        setVisible(!onboardingCompleted && dismissed !== 'true');
      } catch {
        if (live) setVisible(false);
      } finally {
        if (live) setLoading(false);
      }
    }
    void bootstrap();
    return () => { live = false; };
  }, []);

  useEffect(() => {
    setForm(current => ({
      ...current,
      primaryContactName: current.primaryContactName || current.fullName,
      workspaceName: current.mode === 'consultant' ? current.workspaceName : current.organizationName || current.workspaceName,
      assessmentName: current.assessmentName || `${current.organizationName || 'Initial'} Diagnostic Assessment`,
    }));
  }, [form.fullName, form.mode, form.organizationName]);

  const stepIsValid = useMemo(() => {
    if (step === 0) return Boolean(form.mode);
    if (step === 1) return Boolean(form.fullName.trim());
    if (step === 2) return Boolean(form.organizationName.trim());
    if (step === 3) return Boolean(form.assessmentName.trim());
    return true;
  }, [form, step]);

  if (loading || !visible) return null;

  function patch(next: Partial<FormState>) {
    setForm(current => ({ ...current, ...next }));
  }

  function skip() {
    try { window.localStorage.setItem('kinto_onboarding_dismissed', 'true'); } catch {}
    setVisible(false);
  }

  async function complete() {
    try {
      setSubmitting(true);
      setError('');
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'Failed to complete setup.');
      const clientId = payload?.data?.client?.client_id || payload?.client?.client_id || null;
      const assessmentId = payload?.data?.assessment?.assessment_id || payload?.assessment?.assessment_id || null;
      setVisible(false);
      router.push(buildRoute(pathname, { clientId, assessmentId }));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete setup.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(15, 25, 35, 0.58)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 760, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', boxShadow: '0 24px 80px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        <div style={{ padding: '1.1rem 1.25rem', borderBottom: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1ABCB0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Get Started</div>
              <h2 style={{ margin: '0.3rem 0 0.35rem', fontSize: '1.15rem' }}>Set up your organisation and first engagement</h2>
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.88rem', lineHeight: 1.55 }}>This quick wizard captures the organisation context, your role, and the first assessment so the platform opens in a usable state immediately.</p>
            </div>
            <button className="btn btn-ghost btn-sm" type="button" onClick={skip}>Skip for now</button>
          </div>
        </div>

        <div style={{ padding: '1rem 1.25rem 1.25rem' }}>
          <StepHeader current={step} />

          {step === 0 && (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {MODES.map(option => {
                const active = form.mode === option.key;
                return (
                  <button key={option.key} type="button" onClick={() => patch({ mode: option.key })} style={{ textAlign: 'left', padding: '0.95rem 1rem', borderRadius: 'var(--radius-sm)', border: `1px solid ${active ? 'rgba(26,188,176,0.35)' : 'var(--line)'}`, background: active ? 'rgba(26,188,176,0.08)' : 'var(--surface-2)', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'start' }}>
                      <span style={{ fontSize: '1.15rem' }}>{option.icon}</span>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: '0.15rem' }}>{option.title}</div>
                        <div style={{ fontSize: '0.84rem', color: 'var(--muted)', lineHeight: 1.5 }}>{option.description}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {step === 1 && (
            <div style={{ display: 'grid', gap: '0.85rem' }}>
              <div className="grid-2" style={{ gap: '0.75rem' }}>
                <Field label="Your full name">
                  <input className="kinto-input" value={form.fullName} onChange={e => patch({ fullName: e.target.value, primaryContactName: form.primaryContactName || e.target.value })} placeholder="e.g. Sheldon Govender" />
                </Field>
                <Field label={form.mode === 'consultant' ? 'Workspace / consultancy name' : 'Internal team / workspace name'}>
                  <input className="kinto-input" value={form.workspaceName} onChange={e => patch({ workspaceName: e.target.value })} placeholder={form.mode === 'consultant' ? 'e.g. Kinto Advisory' : 'e.g. Operations Team'} />
                </Field>
              </div>
              <div className="grid-2" style={{ gap: '0.75rem' }}>
                <Field label="Role / title">
                  <input className="kinto-input" value={form.jobTitle} onChange={e => patch({ jobTitle: e.target.value })} placeholder="e.g. Founder, Consultant, COO" />
                </Field>
                <Field label="Phone (optional)">
                  <input className="kinto-input" value={form.phone} onChange={e => patch({ phone: e.target.value })} placeholder="Optional" />
                </Field>
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'grid', gap: '0.85rem' }}>
              <div className="grid-2" style={{ gap: '0.75rem' }}>
                <Field label={form.mode === 'consultant' ? 'First client name' : 'Organisation name'}>
                  <input className="kinto-input" value={form.organizationName} onChange={e => patch({ organizationName: e.target.value })} placeholder={form.mode === 'consultant' ? 'e.g. Stark Industries' : 'e.g. Kinto Global'} />
                </Field>
                <Field label="Industry">
                  <input className="kinto-input" value={form.industry} onChange={e => patch({ industry: e.target.value })} placeholder="e.g. IT services, Manufacturing" />
                </Field>
              </div>
              <div className="grid-3" style={{ gap: '0.75rem' }}>
                <Field label="Company size">
                  <input className="kinto-input" value={form.companySize} onChange={e => patch({ companySize: e.target.value })} placeholder="e.g. SME, 11–50 staff" />
                </Field>
                <Field label="Country / region">
                  <input className="kinto-input" value={form.country} onChange={e => patch({ country: e.target.value })} placeholder="e.g. South Africa" />
                </Field>
                <Field label="Website">
                  <input className="kinto-input" value={form.websiteUrl} onChange={e => patch({ websiteUrl: e.target.value })} placeholder="Optional" />
                </Field>
              </div>
              <div className="grid-2" style={{ gap: '0.75rem' }}>
                <Field label="Primary contact name">
                  <input className="kinto-input" value={form.primaryContactName} onChange={e => patch({ primaryContactName: e.target.value })} placeholder="e.g. Managing director" />
                </Field>
                <Field label="Primary contact email">
                  <input className="kinto-input" value={form.primaryContactEmail} onChange={e => patch({ primaryContactEmail: e.target.value })} placeholder="Optional" />
                </Field>
              </div>
              <Field label="What does this organisation do?">
                <textarea className="kinto-textarea" rows={3} value={form.servicesSummary} onChange={e => patch({ servicesSummary: e.target.value })} placeholder="Short description of products, services, or operational focus" />
              </Field>
            </div>
          )}

          {step === 3 && (
            <div style={{ display: 'grid', gap: '0.85rem' }}>
              <Field label="First assessment name">
                <input className="kinto-input" value={form.assessmentName} onChange={e => patch({ assessmentName: e.target.value })} placeholder="e.g. FY2026 Diagnostic Assessment" />
              </Field>
              <Field label="Assessment objective">
                <textarea className="kinto-textarea" rows={2} value={form.assessmentObjective} onChange={e => patch({ assessmentObjective: e.target.value })} placeholder="What are you trying to understand or improve?" />
              </Field>
              <div className="grid-2" style={{ gap: '0.75rem' }}>
                <Field label="Priority outcomes">
                  <textarea className="kinto-textarea" rows={3} value={form.priorityOutcomes} onChange={e => patch({ priorityOutcomes: e.target.value })} placeholder="e.g. improve margin, reduce delivery delays, stabilise reporting" />
                </Field>
                <Field label="Current pain points">
                  <textarea className="kinto-textarea" rows={3} value={form.painPoints} onChange={e => patch({ painPoints: e.target.value })} placeholder="e.g. poor visibility, weak ownership, inconsistent process execution" />
                </Field>
              </div>
              <div className="grid-3" style={{ gap: '0.75rem' }}>
                <Field label="Departments in scope">
                  <input className="kinto-input" value={form.departmentsInScope} onChange={e => patch({ departmentsInScope: e.target.value })} placeholder="Optional" />
                </Field>
                <Field label="Systems in scope">
                  <input className="kinto-input" value={form.systemsInScope} onChange={e => patch({ systemsInScope: e.target.value })} placeholder="Optional" />
                </Field>
                <Field label="Locations in scope">
                  <input className="kinto-input" value={form.locationsInScope} onChange={e => patch({ locationsInScope: e.target.value })} placeholder="Optional" />
                </Field>
              </div>
            </div>
          )}

          {error && <div style={{ marginTop: '0.85rem', color: 'var(--danger)', fontSize: '0.82rem' }}>{error}</div>}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', gap: '0.75rem' }}>
            <button className="btn btn-secondary btn-sm" type="button" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0 || submitting}>Back</button>
            {step < 3 ? (
              <button className="btn btn-primary btn-sm" type="button" disabled={!stepIsValid || submitting} onClick={() => setStep(s => Math.min(3, s + 1))}>Continue</button>
            ) : (
              <button className="btn btn-primary btn-sm" type="button" disabled={!stepIsValid || submitting} onClick={() => void complete()}>{submitting ? 'Setting up…' : 'Create workspace'}</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
