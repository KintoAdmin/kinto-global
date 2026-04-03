import type { Dispatch, SetStateAction } from 'react';
import { SmallMuted, StatusPill, TaskStatusSelect, buildDocumentLabel, sentenceCase } from './ui';

type DocDraft = { name: string; link: string };

type Props = any;
/*
  task: any;
  docs: any[];
  expanded: boolean;
  onToggle: () => void;
  onStatusChange: (status: string) => void;
  saving: boolean;
  previewMode: boolean;
  composerOpen: boolean;
  onComposerToggle: () => void;
  docDraft: DocDraft;
  setDocDraft: Dispatch<SetStateAction<DocDraft>>;
  onSaveDoc: () => void;
  onOpenDocuments: () => void;
*/

export function TaskRow({ task, docs, expanded, onToggle, onStatusChange, saving, previewMode, composerOpen, onComposerToggle, docDraft, setDocDraft, onSaveDoc, onOpenDocuments }: Props) {
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
                      <input value={docDraft.name} onChange={(e: any) => setDocDraft((current: any) => ({ ...current, name: e.target.value }))} placeholder="File or document name" style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }} />
                      <input value={docDraft.link} onChange={(e: any) => setDocDraft((current: any) => ({ ...current, link: e.target.value }))} placeholder="Link (optional)" style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }} />
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
