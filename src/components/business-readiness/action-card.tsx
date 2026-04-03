import { TaskRow } from './task-row';
import { ProgressBar, SmallMuted, StatusPill, linkedDocsForTask } from './ui';

type Props = any;
/*
  action: any;
  current: boolean;
  collapsed: boolean;
  docsByTask: Map<string, any[]>;
  expandedTaskId: string | null;
  setExpandedTaskId: (value: string | null) => void;
  onOpen: () => void;
  onStatusChange: (taskInstanceId: string, status: string) => void;
  saving: boolean;
  previewMode: boolean;
  showDocComposerForTask: string | null;
  setShowDocComposerForTask: (value: string | null) => void;
  docDraft: { name: string; link: string };
  setDocDraft: any;
  addTaskDocument: (taskInstanceId: string) => void;
  openDocumentsForTask: (taskInstanceId: string) => void;
*/

export function ActionCard({ action, current, collapsed, docsByTask, expandedTaskId, setExpandedTaskId, onOpen, onStatusChange, saving, previewMode, showDocComposerForTask, setShowDocComposerForTask, docDraft, setDocDraft, addTaskDocument, openDocumentsForTask }: Props) {
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
