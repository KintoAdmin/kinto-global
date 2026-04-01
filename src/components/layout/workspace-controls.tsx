// @ts-nocheck
'use client';

import { useState, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Dialog } from '@/components/shared/dialog';
import { buildRoute } from '@/lib/routes';

type Client = { client_id: string; client_name: string };
type Assessment = { assessment_id: string; assessment_name: string; client_id?: string | null };

type DialogState = {
  open: boolean;
  mode: 'input' | 'confirm';
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  resolve?: (value: string | null) => void;
};

const EMPTY_DIALOG: DialogState = { open: false, mode: 'input', title: '' };

function useDialog() {
  const [dlg, setDlg] = useState<DialogState>(EMPTY_DIALOG);

  const openInput = useCallback((title: string, opts?: { message?: string; placeholder?: string; defaultValue?: string }): Promise<string | null> =>
    new Promise(resolve => setDlg({ open: true, mode: 'input', title, ...opts, resolve }))
  , []);

  const openConfirm = useCallback((title: string, message?: string): Promise<boolean> =>
    new Promise(resolve => setDlg({
      open: true, mode: 'confirm', title, message,
      resolve: (v) => resolve(v !== null)
    }))
  , []);

  function close(value: string | null) {
    setDlg(d => { d.resolve?.(value); return EMPTY_DIALOG; });
  }

  return { dlg, openInput, openConfirm, close };
}

type Props = {
  clients: Client[];
  assessments: Assessment[];
  activeClientId: string;
  activeAssessmentId: string;
};

export function WorkspaceControls({ clients, assessments, activeClientId, activeAssessmentId }: Props) {
  const router   = useRouter();
  const pathname = usePathname() ?? '/workspace';
  const params   = useSearchParams();
  const { dlg, openInput, openConfirm, close } = useDialog();
  const [busyLabel, setBusyLabel] = useState<string | null>(null);

  const busy = Boolean(busyLabel);
  const visibleAssessments = assessments.filter(a =>
    !activeClientId || a.client_id === activeClientId || !a.client_id
  );

  function navigate(update: { clientId?: string | null; assessmentId?: string | null }) {
    const cId = 'clientId'    in update ? update.clientId    : (params.get('clientId')    || activeClientId || null);
    const aId = 'assessmentId' in update ? update.assessmentId : (params.get('assessmentId') || activeAssessmentId || null);
    router.push(buildRoute(pathname, { clientId: cId, assessmentId: aId }));
  }

  async function handleClientChange(clientId: string) {
    const res  = await fetch(`/api/assessments?clientId=${encodeURIComponent(clientId)}`, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    const rows = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
    navigate({ clientId, assessmentId: rows[0]?.assessment_id ?? null });
    router.refresh();
  }

  function handleAssessmentChange(assessmentId: string) {
    navigate({ assessmentId: assessmentId || null });
  }

  async function createAssessmentForClient(clientId: string, suggestedName: string): Promise<Assessment | null> {
    const name = await openInput('Assessment name', {
      message: 'Name this diagnostic assessment.',
      placeholder: 'e.g. FY2026 Full Diagnostic',
      defaultValue: suggestedName,
    });
    if (!name?.trim()) return null;
    const res  = await fetch('/api/assessments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, assessmentName: name.trim(), scopeType: 'enterprise', scopeLabel: 'Full business' }),
    });
    const p = await res.json();
    if (!res.ok) throw new Error(p?.error || 'Failed to create assessment.');
    return p?.data || p;
  }

  async function handleNewClient() {
    try {
      const name = await openInput('New client', {
        message: 'Enter the client name. An initial assessment will be created automatically.',
        placeholder: 'e.g. Acme Corporation',
      });
      if (!name?.trim()) return;
      setBusyLabel('Creating client…');
      const res  = await fetch('/api/clients', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientName: name.trim() }),
      });
      const p = await res.json();
      const client = p?.data || p;
      if (!res.ok || !client?.client_id) throw new Error(p?.error || 'Failed to create client.');
      const assessment = await createAssessmentForClient(
        client.client_id,
        `${name.trim()} Diagnostic Assessment`
      );
      navigate({ clientId: client.client_id, assessmentId: assessment?.assessment_id ?? null });
      router.refresh();
    } catch (err) {
      await openConfirm('Error', err instanceof Error ? err.message : 'Failed to create client.');
    } finally { setBusyLabel(null); }
  }

  async function handleNewAssessment() {
    try {
      if (!activeClientId) {
        await openConfirm('No client selected', 'Select or create a client first.');
        return;
      }
      setBusyLabel('Creating assessment…');
      const clientName = clients.find(c => c.client_id === activeClientId)?.client_name || 'Client';
      const assessment = await createAssessmentForClient(activeClientId, `${clientName} Diagnostic Assessment`);
      if (!assessment?.assessment_id) return;
      navigate({ clientId: activeClientId, assessmentId: assessment.assessment_id });
      router.refresh();
    } catch (err) {
      await openConfirm('Error', err instanceof Error ? err.message : 'Failed to create assessment.');
    } finally { setBusyLabel(null); }
  }

  async function handleDeleteAssessment() {
    if (!activeAssessmentId) return;
    const aName = visibleAssessments.find(a => a.assessment_id === activeAssessmentId)?.assessment_name || activeAssessmentId;
    const ok = await openConfirm(
      `Delete "${aName}"?`,
      'This permanently removes the assessment and all its data. This cannot be undone.'
    );
    if (!ok) return;
    try {
      setBusyLabel('Deleting…');
      const res = await fetch(`/api/assessments/${encodeURIComponent(activeAssessmentId)}`, { method: 'DELETE' });
      const p   = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(p?.error || 'Failed to delete.');
      const remaining = visibleAssessments.filter(a => a.assessment_id !== activeAssessmentId);
      navigate({ clientId: activeClientId || null, assessmentId: remaining[0]?.assessment_id ?? null });
      router.refresh();
    } catch (err) {
      await openConfirm('Error', err instanceof Error ? err.message : 'Failed to delete assessment.');
    } finally { setBusyLabel(null); }
  }

  async function handleDeleteClient() {
    if (!activeClientId) return;
    const cName = clients.find(c => c.client_id === activeClientId)?.client_name || activeClientId;
    const ok = await openConfirm(
      `Delete client "${cName}"?`,
      'This removes the client and ALL linked assessments permanently. This cannot be undone.'
    );
    if (!ok) return;
    try {
      setBusyLabel('Deleting client…');
      const res = await fetch(`/api/clients/${encodeURIComponent(activeClientId)}`, { method: 'DELETE' });
      const p   = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(p?.error || 'Failed to delete.');
      const remaining = clients.filter(c => c.client_id !== activeClientId);
      const nextCid   = remaining[0]?.client_id ?? null;
      let nextAid: string | null = null;
      if (nextCid) {
        const r2 = await fetch(`/api/assessments?clientId=${encodeURIComponent(nextCid)}`, { cache: 'no-store' });
        const p2 = await r2.json().catch(() => ({}));
        const rows = Array.isArray(p2?.data) ? p2.data : Array.isArray(p2) ? p2 : [];
        nextAid = rows[0]?.assessment_id ?? null;
      }
      navigate({ clientId: nextCid, assessmentId: nextAid });
      router.refresh();
    } catch (err) {
      await openConfirm('Error', err instanceof Error ? err.message : 'Failed to delete client.');
    } finally { setBusyLabel(null); }
  }

  async function handleGenerateReport() {
    if (!activeAssessmentId) {
      await openConfirm('No assessment', 'Select or create an assessment before generating a report.');
      return;
    }
    try {
      setBusyLabel('Generating report…');
      const res = await fetch(`/api/assessments/${encodeURIComponent(activeAssessmentId)}/report`, { method: 'POST' });
      const p   = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(p?.error || 'Report generation failed.');
      router.refresh();
    } catch (err) {
      await openConfirm('Report error', err instanceof Error ? err.message : 'Report generation failed.');
    } finally { setBusyLabel(null); }
  }

  return (
    <>
      {/* Modal dialog */}
      <Dialog
        open={dlg.open}
        title={dlg.title}
        message={dlg.message}
        placeholder={dlg.mode === 'confirm' ? '__CONFIRM__' : dlg.placeholder}
        defaultValue={dlg.defaultValue}
        onConfirm={val => close(dlg.mode === 'confirm' ? 'confirmed' : val)}
        onCancel={() => close(null)}
      />

      {/* Toolbar */}
      <div className="workspace-bar" aria-label="Workspace controls">
        {/* Client selector */}
        <select
          className="kinto-select"
          value={activeClientId}
          onChange={e => void handleClientChange(e.target.value)}
          disabled={busy}
          aria-label="Active client"
          style={{ minWidth: 160, maxWidth: 240 }}
        >
          {clients.length > 0
            ? clients.map(c => <option key={c.client_id} value={c.client_id}>{c.client_name}</option>)
            : <option value="">No clients — click + Client</option>}
        </select>

        {/* Assessment selector */}
        <select
          className="kinto-select"
          value={activeAssessmentId}
          onChange={e => handleAssessmentChange(e.target.value)}
          disabled={busy || !activeClientId}
          aria-label="Active assessment"
          style={{ minWidth: 200, maxWidth: 320 }}
        >
          {visibleAssessments.length > 0
            ? visibleAssessments.map(a => <option key={a.assessment_id} value={a.assessment_id}>{a.assessment_name}</option>)
            : <option value="">No assessments — click + Assessment</option>}
        </select>

        {/* Actions */}
        <div className="workspace-bar-actions">
          <button className="btn btn-secondary btn-sm" type="button" onClick={() => void handleNewClient()} disabled={busy}>
            + Client
          </button>
          <button className="btn btn-secondary btn-sm" type="button" onClick={() => void handleNewAssessment()} disabled={busy || !activeClientId}>
            + Assessment
          </button>
          <div style={{ width: 1, height: 20, background: 'var(--line)', margin: '0 0.2rem', flexShrink: 0 }} />
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            onClick={() => void handleDeleteAssessment()}
            disabled={busy || !activeAssessmentId}
            title="Delete this assessment"
            style={{ color: 'var(--danger)' }}
          >
            🗑 Assessment
          </button>
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            onClick={() => void handleDeleteClient()}
            disabled={busy || !activeClientId}
            title="Delete this client and all assessments"
            style={{ color: 'var(--danger)' }}
          >
            🗑 Client
          </button>
          <div style={{ width: 1, height: 20, background: 'var(--line)', margin: '0 0.2rem', flexShrink: 0 }} />
          <button
            className="btn btn-primary btn-sm"
            type="button"
            onClick={() => void handleGenerateReport()}
            disabled={busy || !activeAssessmentId}
          >
            Generate Report
          </button>
        </div>

        {busyLabel && (
          <span className="saving-indicator" style={{ marginLeft: 'auto' }}>
            <span style={{
              display: 'inline-block', width: 11, height: 11, borderRadius: '50%',
              border: '2px solid var(--brand)', borderTopColor: 'transparent',
              animation: 'spin 0.7s linear infinite',
            }} />
            {busyLabel}
          </span>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
