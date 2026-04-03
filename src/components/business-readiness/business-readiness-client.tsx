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

function statusTone(status?: string | null) {
  const raw = String(status || '').toLowerCase();
  if (['complete', 'done', 'ready', 'set_up'].includes(raw)) return { bg: '#dcfce7', color: '#166534', border: '#bbf7d0' };
  if (['in_progress', 'started', 'current'].includes(raw)) return { bg: '#ecfeff', color: '#0f766e', border: '#99f6e4' };
  if (['blocked', 'critical', 'overdue'].includes(raw)) return { bg: '#fee2e2', color: '#b91c1c', border: '#fecaca' };
  if (['planned', 'later', 'waiting'].includes(raw)) return { bg: '#fef3c7', color: '#92400e', border: '#fde68a' };
  return { bg: '#f3f4f6', color: '#374151', border: '#e5e7eb' };
}

const taskStatusOptions = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'waiting', label: 'Awaiting Inputs' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Complete' },
];

function TaskStatusSelect({ value, onChange, disabled }: { value?: string | null; onChange: (value: string) => void; disabled?: boolean }) {
  const tone = statusTone(value);
  return (
    <select
      value={value || 'not_started'}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      style={{
        minWidth: 150,
        padding: '7px 12px',
        borderRadius: 999,
        border: `2px solid ${tone.border}`,
        background: tone.bg,
        color: tone.color,
        fontWeight: 700,
        fontSize: 13,
        outline: 'none',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {taskStatusOptions.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  );
}

function Card({ children, style }: any) {
  return <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderLeft: '3px solid #14b8a6', borderRadius: 16, padding: 16, ...style }}>{children}</div>;
}

function StatusPill({ label }: { label: string }) {
  const tone = statusTone(label);
  return (
    <span style={{ background: tone.bg, color: tone.color, border: `1px solid ${tone.border}`, borderRadius: 999, padding: '5px 10px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
      {sentenceCase(label)}
    </span>
  );
}

function SmallMuted({ children, style }: any) {
  return <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.45, ...style }}>{children}</div>;
}

function GroupLabel({ children }: any) {
  return <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3, color: '#6b7280' }}>{children}</div>;
}

function ProgressBar({ percent }: { percent: number }) {
  const fill = Math.max(0, Math.min(100, Number(percent || 0)));
  const color = fill >= 100 ? '#16a34a' : fill >= 40 ? '#14b8a6' : fill > 0 ? '#f59e0b' : '#d1d5db';
  return (
    <div style={{ width: '100%', height: 9, background: '#e5e7eb', borderRadius: 999, overflow: 'hidden' }}>
      <div style={{ width: `${fill}%`, height: '100%', background: color, transition: 'width 0.2s ease' }} />
    </div>
  );
}



function PhaseStrip({ phases, selectedPhaseCode, onSelect }: any) {
  return (
    <div style={{ display:'flex', gap: 16, flexWrap:'wrap', alignItems:'center', borderBottom:'1px solid #e5e7eb', paddingBottom: 2 }}>
      {phases.map((phase: any) => {
        const active = phase.phase_code === selectedPhaseCode;
        return (
          <button
            key={phase.phase_code}
            onClick={() => onSelect(phase.phase_code)}
            style={{
              background:'none',
              border:'none',
              borderBottom: active ? '3px solid #14b8a6' : '3px solid transparent',
              color: active ? '#0f766e' : '#374151',
              fontWeight: 700,
              fontSize: 14,
              padding:'10px 0 12px',
              cursor:'pointer',
              display:'flex',
              alignItems:'center',
              gap:8,
            }}
          >
            <span>{phase.phase_name}</span>
            <span style={{
              fontSize:12,
              color:'#6b7280',
              background:'#f3f4f6',
              border:'1px solid #e5e7eb',
              borderRadius:999,
              padding:'1px 8px',
              lineHeight:1.5,
            }}>{phase.completedTasks}/{phase.totalTasks}</span>
          </button>
        );
      })}
    </div>
  );
}

function buildDocumentLabel(doc: any) {
  return doc?.note_text || doc?.file_url || doc?.external_link || 'Saved document';
}

function linkedDocsForTask(docsByTask: Map<string, any[]>, taskId?: string | null) {
  return docsByTask.get(taskId || '') || [];
}


function TaskRow({
  task,
  docs,
  expanded,
  onToggle,
  onStatusChange,
  saving,
  previewMode,
  composerOpen,
  onComposerToggle,
  docDraft,
  setDocDraft,
  onSaveDoc,
  onOpenDocuments,
}: any) {
  const blockerText = task.blocker || '—';
  const complete = String(task.status || '') === 'done';
  return (
    <>
      <tr style={{ borderBottom: '1px solid #e5e7eb', background: expanded ? '#f8fafc' : '#fff' }}>
        <td style={{ padding: '10px 12px', fontWeight: 600, width: '38%', textDecoration: complete ? 'line-through' : 'none', color: complete ? '#6b7280' : '#111827' }}>{task.task_title}</td>
        <td style={{ padding: '10px 12px', fontSize: 12, color: '#6b7280' }}>{task.optional ? 'Optional' : 'Required'}</td>
        <td style={{ padding: '10px 12px', fontSize: 13, color: '#111827', fontWeight: 700 }}>{task.sort_order}</td>
        <td style={{ padding: '10px 12px' }}>
          <TaskStatusSelect value={task.status} onChange={onStatusChange} disabled={saving || previewMode} />
        </td>
        <td style={{ padding: '10px 12px', fontSize: 12, color: '#6b7280' }}>{docs.length ? `${docs.length} linked` : '—'}</td>
        <td style={{ padding: '10px 12px', fontSize: 12, color: '#6b7280', textAlign: 'right', whiteSpace: 'nowrap' }}>
          <span style={{ marginRight: 10 }}>{blockerText}</span>
          <button onClick={onToggle} style={{ border: 'none', background: 'none', color: '#6b7280', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>{expanded ? '▲' : '▼'}</button>
        </td>
      </tr>
      {expanded ? (
        <tr style={{ background: '#f8fafc' }}>
          <td colSpan={6} style={{ padding: 16, borderTop: '1px solid #e5e7eb' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr', gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Instructions</div>
                <div style={{ fontSize: 13, lineHeight: 1.55, color: '#374151' }}>{task.instructions}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Requirements</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.5, color: '#374151' }}>
                  {(task.requirements || []).map((item: string) => <li key={item}>{item}</li>)}
                </ul>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Where to do this</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.5, color: '#374151' }}>
                  {(task.where_to_do_this || []).map((item: string) => <li key={item}>{item}</li>)}
                </ul>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Record and save</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.5, color: '#374151' }}>
                  {(task.record_and_save || []).map((item: string) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            </div>
            <div style={{ marginTop: 16, borderTop: '1px solid #e5e7eb', paddingTop: 12, display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Files</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                    <SmallMuted>{docs.length ? `${docs.length} file${docs.length === 1 ? '' : 's'} linked to this task` : 'No files linked yet.'}</SmallMuted>
                    <button onClick={onComposerToggle} disabled={previewMode} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontWeight: 600, fontSize: 12, opacity: previewMode ? 0.55 : 1 }}>
                      {composerOpen ? 'Cancel' : 'Add file or link'}
                    </button>
                  </div>
                  {docs.length ? (
                    <div style={{ display: 'grid', gap: 8 }}>
                      {docs.map((doc: any) => (
                        <div key={doc.evidence_id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap', background:'#fff' }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{buildDocumentLabel(doc)}</div>
                            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{sentenceCase(doc.evidence_type)} • {new Date(doc.uploaded_at).toLocaleDateString()}</div>
                          </div>
                          {doc.external_link ? <a href={doc.external_link} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 700 }}>Open</a> : <StatusPill label={doc.review_status || 'saved'} />}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {composerOpen && !previewMode ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 8, marginTop: 10 }}>
                      <input value={docDraft.name} onChange={(e) => setDocDraft((current: any) => ({ ...current, name: e.target.value }))} placeholder="File or document name" style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }} />
                      <input value={docDraft.link} onChange={(e) => setDocDraft((current: any) => ({ ...current, link: e.target.value }))} placeholder="Link (optional)" style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }} />
                      <button onClick={onSaveDoc} disabled={saving || !docDraft.name.trim()} style={{ padding: '10px 12px', borderRadius: 8, border: 'none', background: '#111827', color: '#fff', fontWeight: 600 }}>Save</button>
                      <button onClick={onOpenDocuments} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontWeight: 600 }}>Open in Documents</button>
                    </div>
                  ) : null}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Execution detail</div>
                  <div style={{ display:'grid', gap:12 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Blocker</div>
                      <div style={{ padding:10, minHeight:44, border:'1px solid #d1d5db', borderRadius:8, background:'#fff', fontSize:13, color:'#374151' }}>{task.blocker || 'No blocker recorded.'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Notes</div>
                      <div style={{ padding:10, minHeight:44, border:'1px solid #d1d5db', borderRadius:8, background:'#fff', fontSize:13, color:'#374151' }}>{task.notes || 'No notes recorded yet.'}</div>
                    </div>
                  </div>
                </div>
              </div>
              {previewMode ? <SmallMuted>Preview mode is on. Switch back to the workspace region and business type to update task status or save files.</SmallMuted> : null}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function ActionCard({ action, current, collapsed, docsByTask, expandedTaskId, setExpandedTaskId, onOpen, onStatusChange, saving, previewMode, showDocComposerForTask, setShowDocComposerForTask, docDraft, setDocDraft, addTaskDocument, openDocumentsForTask }: any) {
  return (
    <div style={{ background:'#fff', border:`1px solid ${current ? '#99f6e4' : '#e5e7eb'}`, borderLeft:`3px solid ${current ? '#14b8a6' : '#cbd5e1'}`, borderRadius:16, overflow:'hidden' }}>
      <div style={{ padding: 16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'0.45rem', flexWrap:'wrap', marginBottom:'0.4rem' }}>
          <span style={{ fontSize:'0.72rem', fontWeight:700, color:'#14b8a6' }}>🧭 Business Readiness</span>
          <span style={{ fontSize:'0.65rem', padding:'0.12rem 0.4rem', borderRadius:999, background:'#f3f4f6', border:'1px solid #e5e7eb', color:'#374151', fontWeight:700 }}>{action.section_name}</span>
          {action.launch_critical ? <span style={{ fontSize:'0.65rem', padding:'0.12rem 0.4rem', borderRadius:999, background:'#fee2e2', border:'1px solid #fecaca', color:'#b91c1c', fontWeight:700 }}>Critical</span> : null}
          {current ? <span style={{ fontSize:'0.65rem', padding:'0.12rem 0.4rem', borderRadius:999, background:'#ecfeff', border:'1px solid #99f6e4', color:'#0f766e', fontWeight:700 }}>Current</span> : null}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex:1, minWidth:260 }}>
            <div style={{ fontSize: 20, fontWeight: 700, lineHeight:1.25 }}>{action.action_title}</div>
            <SmallMuted style={{ marginTop: 6 }}>{action.objective}</SmallMuted>
          </div>
          <div style={{ display: 'grid', justifyItems: 'end', gap: 8, minWidth: 190 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', justifyContent:'flex-end' }}>
              <StatusPill label={action.status} />
              <span style={{ fontSize:12, color:'#6b7280' }}>{action.completed_tasks}/{action.total_tasks} tasks</span>
            </div>
            <button onClick={onOpen} style={{ border: 'none', background: 'none', color: '#6b7280', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>{current ? '▲ Collapse' : '▼ Open action'}</button>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginTop:12, flexWrap:'wrap' }}>
          <div style={{ flex:1, minWidth:180 }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#6b7280', marginBottom:4 }}><span>Progress</span><span style={{ fontWeight:700 }}>{action.progress_pct}%</span></div>
            <ProgressBar percent={action.progress_pct} />
          </div>
          <SmallMuted>{action.next_task_name ? `Start with: ${action.next_task_name}` : 'All tasks complete.'}</SmallMuted>
        </div>
      </div>
      {current && !collapsed ? (
        <div style={{ borderTop: '1px solid #e5e7eb', background: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                <th style={{ padding: '10px 12px', fontSize: 12, color: '#6b7280' }}>Task</th>
                <th style={{ padding: '10px 12px', fontSize: 12, color: '#6b7280' }}>Type</th>
                <th style={{ padding: '10px 12px', fontSize: 12, color: '#6b7280' }}>P</th>
                <th style={{ padding: '10px 12px', fontSize: 12, color: '#6b7280' }}>Status</th>
                <th style={{ padding: '10px 12px', fontSize: 12, color: '#6b7280' }}>Files</th>
                <th style={{ padding: '10px 12px', fontSize: 12, color: '#6b7280', textAlign:'right' }}>Blocker</th>
              </tr>
            </thead>
            <tbody>
              {(action.tasks || []).map((task: any) => {
                const docs = linkedDocsForTask(docsByTask, task.task_instance_id);
                const expanded = expandedTaskId === task.task_instance_id;
                const composerOpen = showDocComposerForTask === task.task_instance_id;
                return (
                  <TaskRow
                    key={task.task_code}
                    task={task}
                    docs={docs}
                    expanded={expanded}
                    onToggle={() => setExpandedTaskId(expanded ? null : task.task_instance_id)}
                    onStatusChange={(status: string) => onStatusChange(task.task_instance_id, status)}
                    saving={saving}
                    previewMode={previewMode}
                    composerOpen={composerOpen}
                    onComposerToggle={() => setShowDocComposerForTask(composerOpen ? null : task.task_instance_id)}
                    docDraft={docDraft}
                    setDocDraft={setDocDraft}
                    onSaveDoc={() => addTaskDocument(task.task_instance_id)}
                    onOpenDocuments={() => openDocumentsForTask(task.task_instance_id)}
                  />
                );
              })}
            </tbody>
          </table>
          <div style={{ borderTop:'1px solid #e5e7eb', padding:'14px 16px', display:'grid', gap:12 }}>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Definition of done</div>
              <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6, fontSize: 13, color: '#374151' }}>
                {(action.tasks || []).filter((task: any) => !task.optional).map((task: any) => <li key={task.task_code}>{task.task_title}</li>)}
              </ul>
            </div>
            <div>
              <div style={{ fontWeight:700, marginBottom:6 }}>Execution notes</div>
              <div style={{ padding:12, border:'1px solid #d1d5db', borderRadius:10, background:'#fff', fontSize:13, color:'#6b7280' }}>Use the task rows above to record progress, blockers, files, and save points for this action.</div>
            </div>
            <div style={{ padding:'12px 14px', borderRadius:10, background:'#eff6ff', border:'1px solid #bfdbfe', fontSize:13, color:'#1d4ed8' }}>
              💡 Next checkpoint: {action.next_task_name ? `Complete “${action.next_task_name}” to move this action forward.` : 'This action is complete and ready for the next step.'}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function BusinessReadinessClient({ assessmentId, initialData, view = 'overview' }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeView = view === 'roadmap' ? 'execution' : view;

  const [data, setData] = useState<any>(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openAction, setOpenAction] = useState<string | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [selectedPhaseCode, setSelectedPhaseCode] = useState<string>('phase_0_define');
  const [docDraft, setDocDraft] = useState({ name: '', link: '' });
  const [showDocComposerForTask, setShowDocComposerForTask] = useState<string | null>(null);
  const [collapsedActionCodes, setCollapsedActionCodes] = useState<string[]>([]);
  const [documentSearch, setDocumentSearch] = useState('');
  const [documentPhaseFilter, setDocumentPhaseFilter] = useState<'all' | string>('all');
  const [documentTypeFilter, setDocumentTypeFilter] = useState<'all' | string>('all');
  const [initForm, setInitForm] = useState({
    businessTypeCode: 'professional_services',
    primaryRegionCode: 'south_africa',
    businessName: '',
    founderName: '',
    targetCustomer: '',
    whatYouSell: '',
    hiringStaff: false,
  });
  const [previewBusinessTypeCode, setPreviewBusinessTypeCode] = useState<string>('professional_services');
  const [previewRegionCode, setPreviewRegionCode] = useState<string>('south_africa');
  const [previewEmployerIntent, setPreviewEmployerIntent] = useState<boolean>(false);

  async function load(preview?: any) {
    if (!assessmentId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('assessmentId', assessmentId);
      if (preview?.businessTypeCode) params.set('previewBusinessTypeCode', preview.businessTypeCode);
      if (preview?.regionCode) params.set('previewRegionCode', preview.regionCode);
      if (typeof preview?.employerIntent === 'boolean') params.set('previewEmployerIntent', String(preview.employerIntent));
      const res = await fetch(`/api/business-readiness?${params.toString()}`, { cache: 'no-store' });
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

  const workspace = data?.workspace || null;
  const profile = data?.profile || null;
  const businessTypes = data?.businessTypes || [];
  const regions = data?.regions || [];
  const evidence = data?.evidence || [];
  const blockers = data?.blockers || [];

  useEffect(() => {
    if (!workspace) return;
    setPreviewBusinessTypeCode((current) => current || data?.preview?.businessTypeCode || workspace.business_type_code);
    setPreviewRegionCode((current) => current || data?.preview?.regionCode || workspace.primary_region_code);
    setPreviewEmployerIntent(typeof data?.preview?.employerIntent === 'boolean' ? data.preview.employerIntent : Boolean(data?.employerIntent));
  }, [workspace?.workspace_id]);

  useEffect(() => {
    if (!workspace || !assessmentId) return;
    const currentPreview = data?.preview || {};
    if (currentPreview.businessTypeCode === previewBusinessTypeCode && currentPreview.regionCode === previewRegionCode && Boolean(currentPreview.employerIntent) === Boolean(previewEmployerIntent)) return;
    load({ businessTypeCode: previewBusinessTypeCode, regionCode: previewRegionCode, employerIntent: previewEmployerIntent });
  }, [previewBusinessTypeCode, previewRegionCode, previewEmployerIntent]);

  async function initializeWorkspace() {
    if (!assessmentId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/business-readiness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'initialize', assessmentId, ...initForm }),
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

  function openDocumentsForTask(taskInstanceId: string) {
    const taskTitle = taskContextByInstance.get(taskInstanceId)?.task?.task_title || '';
    setDocumentSearch(taskTitle);
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.set('view', 'documents');
    if (assessmentId) params.set('assessmentId', assessmentId);
    router.push(`${pathname}?${params.toString()}`);
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

  const plan = data?.previewImplementationPlan || data?.implementationPlan || [];
  const previewMode = Boolean(data?.previewMode);
  const nextActions = data?.previewNextActions || data?.nextActions || [];
  const businessTypeLabel = businessTypes.find((row: any) => row.code === (data?.preview?.businessTypeCode || workspace?.business_type_code))?.label || sentenceCase(workspace?.business_type_code);
  const regionLabel = regions.find((row: any) => row.code === (data?.preview?.regionCode || workspace?.primary_region_code))?.label || sentenceCase(workspace?.primary_region_code);

  const phaseSummaries = useMemo(() => (plan || []).map((phase: any) => {
    const actions = (phase.sections || []).flatMap((section: any) => section.actions || []);
    const totalActions = actions.length;
    const completedActions = actions.filter((row: any) => row.status === 'complete').length;
    const totalTasks = actions.reduce((sum: number, row: any) => sum + Number(row.total_tasks || 0), 0);
    const completedTasks = actions.reduce((sum: number, row: any) => sum + Number(row.completed_tasks || 0), 0);
    const progressPct = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const current = workspace?.current_phase_code === phase.phase_code;
    return { ...phase, totalActions, completedActions, totalTasks, completedTasks, progressPct, current };
  }), [plan, workspace?.current_phase_code]);

  useEffect(() => {
    if (!phaseSummaries.length) return;
    if (!selectedPhaseCode || !phaseSummaries.some((row: any) => row.phase_code === selectedPhaseCode)) {
      setSelectedPhaseCode(workspace?.current_phase_code || phaseSummaries[0].phase_code);
    }
  }, [phaseSummaries, workspace?.current_phase_code]);

  const phaseView = phaseSummaries.find((row: any) => row.phase_code === selectedPhaseCode) || phaseSummaries[0] || null;
  const phaseSections = phaseView?.sections || [];

  const phaseActions = useMemo(() => (phaseSections || []).flatMap((section: any) => (section.actions || []).map((action: any) => ({
    ...action,
    section_code: section.section_code,
    section_name: section.section_name,
    phase_code: phaseView?.phase_code,
    phase_name: phaseView?.phase_name,
  }))), [phaseSections, phaseView]);

  const currentAction = useMemo(() => {
    if (!phaseActions.length) return null;
    return phaseActions.find((row: any) => row.action_code === openAction) || phaseActions.find((row: any) => row.status !== 'complete') || phaseActions[0];
  }, [phaseActions, openAction]);

  const isActionCollapsed = (actionCode?: string | null) => !!actionCode && collapsedActionCodes.includes(actionCode);

  const toggleActionCollapse = (actionCode?: string | null) => {
    if (!actionCode) return;
    setCollapsedActionCodes((prev: string[]) => prev.includes(actionCode) ? prev.filter((code: string) => code !== actionCode) : [...prev, actionCode]);
  };

  useEffect(() => {
    if (currentAction?.action_code) setOpenAction(currentAction.action_code);
  }, [currentAction?.action_code]);

  useEffect(() => {
    if (!currentAction?.tasks?.length) return;
    if (isActionCollapsed(currentAction.action_code)) return;
    const taskIds = new Set(currentAction.tasks.map((task: any) => task.task_instance_id));
    if (!expandedTaskId || !taskIds.has(expandedTaskId)) {
      const firstOpenTask = currentAction.tasks.find((task: any) => task.status !== 'done') || currentAction.tasks[0];
      if (firstOpenTask?.task_instance_id) setExpandedTaskId(firstOpenTask.task_instance_id);
    }
  }, [currentAction?.action_code, currentAction?.tasks, expandedTaskId, collapsedActionCodes]);

  const docsByTask = useMemo(() => {
    const map = new Map<string, any[]>();
    (evidence || []).forEach((doc: any) => {
      if (!map.has(doc.task_instance_id)) map.set(doc.task_instance_id, []);
      map.get(doc.task_instance_id)!.push(doc);
    });
    return map;
  }, [evidence]);

  const taskContextByInstance = useMemo(() => {
    const map = new Map();
    (plan || []).forEach((phase: any) => {
      (phase.sections || []).forEach((section: any) => {
        (section.actions || []).forEach((action: any) => {
          (action.tasks || []).forEach((task: any) => {
            map.set(task.task_instance_id, { phase, section, action, task });
          });
        });
      });
    });
    return map;
  }, [plan]);

  const documentRows = useMemo(() => {
    const needle = documentSearch.trim().toLowerCase();
    return (evidence || []).map((doc: any) => {
      const ctx = taskContextByInstance.get(doc.task_instance_id) || {};
      return {
        ...doc,
        label: buildDocumentLabel(doc),
        phase_name: ctx.phase?.phase_name || '—',
        phase_code: ctx.phase?.phase_code || 'unknown',
        section_name: ctx.section?.section_name || '—',
        action_title: ctx.action?.action_title || 'Unlinked action',
        action_code: ctx.action?.action_code || null,
        task_title: ctx.task?.task_title || 'Unlinked task',
      };
    }).filter((doc: any) => {
      if (documentPhaseFilter !== 'all' && doc.phase_code !== documentPhaseFilter) return false;
      if (documentTypeFilter !== 'all' && doc.evidence_type !== documentTypeFilter) return false;
      if (!needle) return true;
      const hay = [doc.label, doc.phase_name, doc.section_name, doc.action_title, doc.task_title].join(' ').toLowerCase();
      return hay.includes(needle);
    });
  }, [evidence, taskContextByInstance, documentSearch, documentPhaseFilter, documentTypeFilter]);

  const documentTypes = useMemo(() => Array.from(new Set((evidence || []).map((doc: any) => doc.evidence_type).filter(Boolean))), [evidence]);

  function openActionInExecution(actionCode?: string | null, phaseCode?: string | null) {
    if (!actionCode) return;
    if (phaseCode) setSelectedPhaseCode(phaseCode);
    setOpenAction(actionCode);
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.set('view', 'execution');
    if (assessmentId) params.set('assessmentId', assessmentId);
    router.push(`${pathname}?${params.toString()}`);
  }

  const overviewCurrentAction = nextActions[0] || null;
  const nextVisible = nextActions.slice(1, 3);

  if (loading) return <div style={{ padding: 16 }}>Loading Business Readiness…</div>;
  if (!assessmentId) return <Card>No assessment selected yet.</Card>;

  if (!data?.hasWorkspace) {
    return (
      <div style={{ display: 'grid', gap: 16 }}>
        <Card>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Start Business Readiness</div>
          <SmallMuted style={{ marginTop: 6 }}>Tell Kinto what you are starting and it will generate the first execution workspace.</SmallMuted>
          <div style={{ display: 'grid', gap: 12, marginTop: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            <label>
              <SmallMuted>Business type</SmallMuted>
              <select value={initForm.businessTypeCode} onChange={(e) => setInitForm((current: any) => ({ ...current, businessTypeCode: e.target.value }))} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db', marginTop: 4 }}>{businessTypes.map((row: any) => <option key={row.code} value={row.code}>{row.label}</option>)}</select>
            </label>
            <label>
              <SmallMuted>Region</SmallMuted>
              <select value={initForm.primaryRegionCode} onChange={(e) => setInitForm((current: any) => ({ ...current, primaryRegionCode: e.target.value }))} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db', marginTop: 4 }}>{regions.map((row: any) => <option key={row.code} value={row.code}>{row.label}</option>)}</select>
            </label>
            <label>
              <SmallMuted>Business name</SmallMuted>
              <input value={initForm.businessName} onChange={(e) => setInitForm((current: any) => ({ ...current, businessName: e.target.value }))} placeholder="Example: Kinto Test Advisory" style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db', marginTop: 4 }} />
            </label>
            <label>
              <SmallMuted>Founder name</SmallMuted>
              <input value={initForm.founderName} onChange={(e) => setInitForm((current: any) => ({ ...current, founderName: e.target.value }))} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db', marginTop: 4 }} />
            </label>
            <label>
              <SmallMuted>What will you sell?</SmallMuted>
              <input value={initForm.whatYouSell} onChange={(e) => setInitForm((current: any) => ({ ...current, whatYouSell: e.target.value }))} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db', marginTop: 4 }} />
            </label>
            <label>
              <SmallMuted>Target customer</SmallMuted>
              <input value={initForm.targetCustomer} onChange={(e) => setInitForm((current: any) => ({ ...current, targetCustomer: e.target.value }))} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db', marginTop: 4 }} />
            </label>
            <label style={{ display: 'flex', gap: 10, alignItems: 'center', paddingTop: 24 }}>
              <input type="checkbox" checked={Boolean(initForm.hiringStaff)} onChange={(e) => setInitForm((current: any) => ({ ...current, hiringStaff: e.target.checked }))} />
              <span style={{ fontSize: 13, color: '#374151' }}>I plan to hire staff soon</span>
            </label>
          </div>
          <div style={{ marginTop: 14 }}>
            <button onClick={initializeWorkspace} disabled={saving} style={{ padding: '10px 14px', borderRadius: 8, border: 'none', background: '#111827', color: '#fff', fontWeight: 600 }}>{saving ? 'Creating workspace…' : 'Create workspace'}</button>
          </div>
        </Card>
        {error ? <Card><div style={{ color: '#b91c1c' }}>{error}</div></Card> : null}
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {error ? <Card style={{ borderLeftColor: '#ef4444' }}><div style={{ color: '#b91c1c' }}>{error}</div></Card> : null}

      <Card>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1.4fr) repeat(4, minmax(120px, 0.7fr))', gap: 12 }}>
          <div>
            <GroupLabel>Business context</GroupLabel>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{profile?.business_name || 'Business Readiness workspace'}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
              <StatusPill label={workspace?.launch_ready_flag ? 'ready' : 'blocked'} />
              <span style={{ fontSize: 12, color: '#6b7280' }}>{businessTypeLabel}</span>
              <span style={{ fontSize: 12, color: '#6b7280' }}>•</span>
              <span style={{ fontSize: 12, color: '#6b7280' }}>{regionLabel}</span>
              {previewMode ? <><span style={{ fontSize: 12, color: '#6b7280' }}>•</span><StatusPill label="preview" /></> : null}
            </div>
            <SmallMuted style={{ marginTop: 10 }}>{profile?.business_description || 'Execution workspace for getting this business launch-ready and operating-ready.'}</SmallMuted>
          </div>
          <div>
            <SmallMuted>Current phase</SmallMuted>
            <div style={{ fontWeight: 700, fontSize: 18, marginTop: 6 }}>{phaseSummaries.find((row: any) => row.current)?.phase_name || phaseSummaries[0]?.phase_name || '—'}</div>
            <div style={{ marginTop: 8 }}><StatusPill label={phaseSummaries.find((row: any) => row.current)?.progressPct > 0 ? 'in_progress' : 'planned'} /></div>
          </div>
          <div>
            <SmallMuted>Readiness</SmallMuted>
            <div style={{ fontWeight: 700, fontSize: 18, marginTop: 6 }}>{sentenceCase(workspace?.overall_readiness_state)}</div>
            <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>{phaseSummaries.reduce((sum: number, row: any) => sum + row.completedTasks, 0)} of {phaseSummaries.reduce((sum: number, row: any) => sum + row.totalTasks, 0)} tasks complete</div>
          </div>
          <div>
            <SmallMuted>Critical actions open</SmallMuted>
            <div style={{ fontWeight: 700, fontSize: 18, marginTop: 6 }}>{(nextActions || []).filter((row: any) => row.launch_critical).length}</div>
            <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>Needs attention before launch</div>
          </div>
          <div>
            <SmallMuted>Current focus</SmallMuted>
            <div style={{ fontWeight: 700, fontSize: 18, marginTop: 6 }}>{overviewCurrentAction?.title || currentAction?.action_title || '—'}</div>
            <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>{overviewCurrentAction?.next_task_name || currentAction?.tasks?.find((task: any) => task.status !== 'done')?.task_title || '—'}</div>
          </div>
        </div>
      </Card>

      <Card style={{ borderLeftColor: '#cbd5e1' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <GroupLabel>Content preview</GroupLabel>
            <SmallMuted style={{ marginTop: 4 }}>Check how the execution content changes by region and business type without losing the current workspace context.</SmallMuted>
          </div>
          {previewMode ? <button onClick={() => {
            setPreviewBusinessTypeCode(workspace.business_type_code);
            setPreviewRegionCode(workspace.primary_region_code);
            setPreviewEmployerIntent(Boolean(data?.employerIntent));
          }} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontWeight: 700 }}>Reset to workspace</button> : null}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(180px, 220px))', gap: 10, marginTop: 12 }}>
          <label>
            <SmallMuted>Business type</SmallMuted>
            <select value={previewBusinessTypeCode} onChange={(e) => setPreviewBusinessTypeCode(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db', marginTop: 4 }}>{businessTypes.map((row: any) => <option key={row.code} value={row.code}>{row.label}</option>)}</select>
          </label>
          <label>
            <SmallMuted>Region</SmallMuted>
            <select value={previewRegionCode} onChange={(e) => setPreviewRegionCode(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db', marginTop: 4 }}>{regions.map((row: any) => <option key={row.code} value={row.code}>{row.label}</option>)}</select>
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 28 }}>
            <input type="checkbox" checked={previewEmployerIntent} onChange={(e) => setPreviewEmployerIntent(e.target.checked)} />
            <span style={{ fontSize: 13, color: '#374151' }}>Preview hiring intent</span>
          </label>
        </div>
      </Card>

      {activeView === 'overview' ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(280px, 1fr)', gap: 16 }}>
            <Card>
              <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>Start here</div>
              <SmallMuted>{overviewCurrentAction?.reason || currentAction?.objective || 'Kinto will show the current action here.'}</SmallMuted>
              <div style={{ marginTop: 14, padding: 14, borderRadius: 12, background: '#f8fafc', border: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{overviewCurrentAction?.title || currentAction?.action_title || 'No action selected'}</div>
                  {overviewCurrentAction?.launch_critical || currentAction?.launch_critical ? <StatusPill label="critical" /> : null}
                </div>
                <div style={{ marginTop: 10, fontSize: 14, color: '#374151' }}>Start with: <strong>{overviewCurrentAction?.next_task_name || currentAction?.tasks?.find((task: any) => task.status !== 'done')?.task_title || '—'}</strong></div>
                <button onClick={() => openActionInExecution(overviewCurrentAction?.action_code || currentAction?.action_code, currentAction?.phase_code)} style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, border: 'none', background: '#111827', color: '#fff', fontWeight: 700 }}>Open in Execution</button>
              </div>
            </Card>
            <Card>
              <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>Up next</div>
              <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
                {nextVisible.length ? nextVisible.map((item: any, index: number) => (
                  <div key={item.action_code} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ fontWeight: 700 }}>{index + 1}. {item.title}</div>
                      {item.launch_critical ? <StatusPill label="critical" /> : null}
                    </div>
                    <SmallMuted style={{ marginTop: 4 }}>{item.reason}</SmallMuted>
                    <div style={{ marginTop: 8, fontSize: 13, color: '#374151' }}>Start with: <strong>{item.next_task_name || 'First task in this action'}</strong></div>
                  </div>
                )) : <SmallMuted>No next actions available.</SmallMuted>}
              </div>
            </Card>
          </div>

          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>Launch blockers</div>
                <SmallMuted>Critical actions keeping launch from turning green.</SmallMuted>
              </div>
              <button onClick={runLaunchCheck} disabled={saving} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #111827', background: '#fff', color: '#111827', fontWeight: 700 }}>{saving ? 'Refreshing…' : 'Run launch check'}</button>
            </div>
            <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
              {blockers.length ? blockers.map((row: any) => (
                <div key={row.blocker_id} style={{ padding: 12, borderRadius: 12, background: '#fef2f2', border: '1px solid #fecaca', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{row.title}</div>
                    <SmallMuted style={{ marginTop: 4 }}>{row.description}</SmallMuted>
                  </div>
                  <StatusPill label={row.severity || 'high'} />
                </div>
              )) : <SmallMuted>No blockers right now.</SmallMuted>}
            </div>
          </Card>
        </>
      ) : null}

      {activeView === 'execution' ? (
        <div style={{ display: 'grid', gap: 16 }}>
          {currentAction ? (
            <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderLeft:'3px solid #14b8a6', borderRadius:16, overflow:'hidden' }}>
              <div style={{ padding:'0.85rem 1rem 0' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', flexWrap:'wrap', marginBottom:'0.35rem' }}>
                  <span style={{ fontSize:'0.72rem', fontWeight:700, color:'#14b8a6' }}>🚀 Business Readiness</span>
                  <span style={{ fontSize:'0.65rem', padding:'0.12rem 0.4rem', borderRadius:999, background:'#f3f4f6', border:'1px solid #e5e7eb', color:'#374151', fontWeight:700 }}>{businessTypeLabel}</span>
                  <span style={{ fontSize:'0.65rem', padding:'0.12rem 0.4rem', borderRadius:999, background:'#f3f4f6', border:'1px solid #e5e7eb', color:'#374151', fontWeight:700 }}>{regionLabel}</span>
                  {currentAction.launch_critical ? <span style={{ fontSize:'0.65rem', padding:'0.12rem 0.4rem', borderRadius:999, background:'#fee2e2', border:'1px solid #fecaca', color:'#b91c1c', fontWeight:700 }}>Critical</span> : null}
                </div>
                <h3 style={{ fontWeight:700, fontSize:'1rem', margin:'0 0 0.25rem', lineHeight:1.3 }}>{currentAction.action_title}</h3>
                <p style={{ fontSize:'0.8rem', color:'#6b7280', margin:'0 0 0.65rem', lineHeight:1.35 }}>{currentAction.objective}</p>
                <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.55rem', flexWrap:'wrap' }}>
                  <div style={{ flex:1, minWidth:120 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.7rem', color:'#6b7280', marginBottom:'0.2rem' }}><span>Progress</span><span style={{ fontWeight:700 }}>{currentAction.progress_pct}%</span></div>
                    <div style={{ width:'100%', height:8, background:'#e5e7eb', borderRadius:999, overflow:'hidden' }}><div style={{ width:`${currentAction.progress_pct}%`, height:'100%', background: currentAction.progress_pct < 40 ? '#ef4444' : currentAction.progress_pct < 70 ? '#f59e0b' : '#14b8a6' }} /></div>
                  </div>
                  <StatusPill label={currentAction.status} />
                </div>
                <button type='button' onClick={() => toggleActionCollapse(currentAction.action_code)} style={{ background:'none', border:'none', color:'#6b7280', cursor:'pointer', fontWeight:700, marginBottom:'0.6rem' }}>{isActionCollapsed(currentAction.action_code) ? '▼ Expand' : '▲ Collapse'}</button>
              </div>
              {!isActionCollapsed(currentAction.action_code) ? (
              <div style={{ borderTop:'1px solid #e5e7eb', padding:'0 1rem' }}>
                <PhaseStrip phases={phaseSummaries} selectedPhaseCode={selectedPhaseCode} onSelect={(code:any) => { setSelectedPhaseCode(code); setOpenAction(null); }} />
              </div>
              ) : null}
            </div>
          ) : null}

          {(phaseSections || []).map((section: any) => (
            <div key={section.section_code} style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:16, overflow:'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12, padding:'14px 16px 0' }}>
                <div>
                  <GroupLabel>{section.section_name}</GroupLabel>
                  <SmallMuted style={{ marginTop: 4 }}>{section.actions.length} action{section.actions.length === 1 ? '' : 's'} in this section</SmallMuted>
                </div>
              </div>
              <div style={{ display: 'grid', gap: 12, padding:'0 16px 16px' }}>
                {section.actions.map((action: any) => (
                  <ActionCard
                    key={action.action_code}
                    action={{ ...action, phase_code: phaseView?.phase_code, phase_name: phaseView?.phase_name, section_code: section.section_code, section_name: section.section_name }}
                    current={currentAction?.action_code === action.action_code}
                    collapsed={isActionCollapsed(action.action_code)}
                    docsByTask={docsByTask}
                    expandedTaskId={expandedTaskId}
                    setExpandedTaskId={setExpandedTaskId}
                    onOpen={() => currentAction?.action_code === action.action_code ? toggleActionCollapse(action.action_code) : setOpenAction(action.action_code)}
                    onStatusChange={(taskInstanceId: string, status: string) => updateTask(taskInstanceId, status)}
                    saving={saving}
                    previewMode={previewMode}
                    showDocComposerForTask={showDocComposerForTask}
                    setShowDocComposerForTask={setShowDocComposerForTask}
                    docDraft={docDraft}
                    setDocDraft={setDocDraft}
                    addTaskDocument={addTaskDocument}
                    openDocumentsForTask={openDocumentsForTask}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {activeView === 'documents' ? (
        <div style={{ display: 'grid', gap: 16 }}>
          <Card>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(160px, 1fr))', gap: 12 }}>
              <div>
                <SmallMuted>Total documents</SmallMuted>
                <div style={{ fontWeight: 700, fontSize: 22, marginTop: 6 }}>{documentRows.length}</div>
              </div>
              <div>
                <SmallMuted>Linked tasks</SmallMuted>
                <div style={{ fontWeight: 700, fontSize: 22, marginTop: 6 }}>{new Set(documentRows.map((row: any) => row.task_instance_id)).size}</div>
              </div>
              <div>
                <SmallMuted>Latest saved</SmallMuted>
                <div style={{ fontWeight: 700, fontSize: 22, marginTop: 6 }}>{documentRows.map((row: any) => new Date(row.uploaded_at).getTime()).sort((a: number, b: number) => b - a)[0] ? new Date(documentRows.map((row: any) => new Date(row.uploaded_at).getTime()).sort((a: number, b: number) => b - a)[0]).toLocaleDateString() : '—'}</div>
              </div>
              <div>
                <SmallMuted>Current phase files</SmallMuted>
                <div style={{ fontWeight: 700, fontSize: 22, marginTop: 6 }}>{documentRows.filter((row: any) => row.phase_code === workspace?.current_phase_code).length}</div>
              </div>
            </div>
          </Card>
          <Card style={{ borderLeftColor: '#cbd5e1' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) minmax(180px, 220px) minmax(180px, 220px)', gap: 10, marginBottom: 12 }}>
              <input value={documentSearch} onChange={(e) => setDocumentSearch(e.target.value)} placeholder="Search documents, phases, sections, actions, or tasks" style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }} />
              <select value={documentPhaseFilter} onChange={(e) => setDocumentPhaseFilter(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}>
                <option value="all">All phases</option>
                {phaseSummaries.map((row: any) => <option key={row.phase_code} value={row.phase_code}>{row.phase_name}</option>)}
              </select>
              <select value={documentTypeFilter} onChange={(e) => setDocumentTypeFilter(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}>
                <option value="all">All types</option>
                {documentTypes.map((row: any) => <option key={row} value={row}>{sentenceCase(row)}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {documentRows.length ? documentRows.map((doc: any) => (
                <div key={doc.evidence_id} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{doc.label}</div>
                    <SmallMuted style={{ marginTop: 4 }}>{doc.phase_name} → {doc.section_name} → {doc.action_title} → {doc.task_title}</SmallMuted>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <StatusPill label={doc.evidence_type || 'file'} />
                    <button onClick={() => openActionInExecution(doc.action_code, doc.phase_code)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontWeight: 700 }}>Open task</button>
                  </div>
                </div>
              )) : <SmallMuted>No documents found for the current filters.</SmallMuted>}
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
