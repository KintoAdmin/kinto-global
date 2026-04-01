'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = { assessmentId: string | null };

const MODULE_CODES = [
  { code: 'OPS', label: 'Operational Audit' },
  { code: 'LEAK', label: 'Revenue Leakage' },
  { code: 'DATA', label: 'Data Foundation' },
  { code: 'AIR', label: 'AI Readiness' },
  { code: 'AIUC', label: 'AI Use Cases' },
];

export function ReportLibraryClient({ assessmentId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function generate(moduleCode?: string) {
    if (!assessmentId) { alert('Select an assessment first.'); return; }
    const key = moduleCode || 'FULL';
    setBusy(key);
    setErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
    try {
      const url = moduleCode
        ? `/api/assessments/${encodeURIComponent(assessmentId)}/report/${moduleCode}`
        : `/api/assessments/${encodeURIComponent(assessmentId)}/report`;
      const r = await fetch(url, { method: 'POST' });
      const raw = await r.text();
      let payload: any = null;
      try { payload = JSON.parse(raw); } catch { /* ignore */ }
      if (!r.ok || payload?.error) throw new Error(payload?.error || raw || 'Generation failed.');
      router.refresh();
    } catch (e) {
      setErrors(prev => ({ ...prev, [key]: e instanceof Error ? e.message : 'Failed.' }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h3 className="card-title">Generate Reports</h3>
          <p className="card-subtitle">Generate DOCX and PPTX outputs for individual modules or the full integrated report</p>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '0.75rem' }}>
        {/* Integrated report */}
        <div className="report-row" style={{ background: 'var(--brand-subtle)', border: '1px solid var(--brand-border)' }}>
          <div className="report-row-info">
            <div className="report-row-title" style={{ color: 'var(--brand-dark)' }}>Integrated Executive Report</div>
            <div className="report-row-meta">All modules combined — DOCX + PPTX</div>
            {errors['FULL'] && <div style={{ color: 'var(--danger)', fontSize: '0.78rem', marginTop: '0.25rem' }}>{errors['FULL']}</div>}
          </div>
          <div className="report-row-actions">
            <button
              className="btn btn-primary btn-sm"
              onClick={() => generate()}
              disabled={busy !== null || !assessmentId}
            >
              {busy === 'FULL' ? 'Generating…' : 'Generate Integrated Report'}
            </button>
          </div>
        </div>

        {/* Module reports */}
        {MODULE_CODES.map(({ code, label }) => (
          <div key={code} className="report-row">
            <div className="report-row-info">
              <div className="report-row-title">{label}</div>
              <div className="report-row-meta">Standalone module DOCX + PPTX</div>
              {errors[code] && <div style={{ color: 'var(--danger)', fontSize: '0.78rem', marginTop: '0.25rem' }}>{errors[code]}</div>}
            </div>
            <div className="report-row-actions">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => generate(code)}
                disabled={busy !== null || !assessmentId}
              >
                {busy === code ? 'Generating…' : `Generate ${label}`}
              </button>
            </div>
          </div>
        ))}
      </div>

      {busy && (
        <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--brand-dark)', fontSize: '0.875rem' }}>
          <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', border: '2px solid var(--brand)', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
          Generating report — this may take up to 30 seconds…
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
    </div>
  );
}
