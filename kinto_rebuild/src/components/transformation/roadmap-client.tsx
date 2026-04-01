'use client';

import { useState, useMemo, useEffect, useTransition } from 'react';
import {
  generateGuidance, deriveProgress, deriveConfidence, getStageProgress,
  type GuidanceTask, type TaskStatus, type InitiativeGuidance,
} from '@/lib/transformation/roadmap-guidance';

type RoadmapItem = {
  roadmap_fact_id?: string; roadmap_instance_id?: string;
  initiative_title: string; initiative_description?: string;
  phase_code: string; owner_role?: string; business_outcome?: string;
  review_frequency?: string; source_module_id?: string; module_code?: string;
  status?: string; progress_pct?: number; execution_notes?: string;
  last_reviewed_at?: string; priority_rank?: number; automation_opportunity?: string;
};
type ModuleScore = { module_code: string; module_name: string; score_pct: number; completion_pct: number };
type Props = { assessmentId: string; initialItems: RoadmapItem[]; moduleScores: ModuleScore[] };

const PHASES = [
  { code: 'P1', name: 'Stabilise & Protect',            pill: 'phase-1-pill', desc: 'Fix critical gaps, establish ownership, protect revenue' },
  { code: 'P2', name: 'Standardise & Strengthen',       pill: 'phase-2-pill', desc: 'Build consistent processes, improve data quality, deepen controls' },
  { code: 'P3', name: 'Optimise, Automate & AI-Enable', pill: 'phase-3-pill', desc: 'Scale operations, automate repeatable work, deploy AI capabilities' },
];
const STAGES = ['Discover', 'Define', 'Build', 'Validate', 'Embed'] as const;
const MOD_META: Record<string, { label: string; icon: string; color: string }> = {
  'MOD-OPS': { label: 'Operational Audit', icon: '🔍', color: '#1ABCB0' },
  'MOD-LEAK':{ label: 'Revenue Leakage',   icon: '💰', color: '#EF4444' },
  'MOD-DATA':{ label: 'Data Foundation',   icon: '🗄️', color: '#3B82F6' },
  'MOD-AIR': { label: 'AI Readiness',      icon: '🤖', color: '#8B5CF6' },
  'MOD-AIUC':{ label: 'AI Use Cases',      icon: '⚡', color: '#F59E0B' },
  OPS: { label: 'Operational Audit', icon: '🔍', color: '#1ABCB0' },
  LEAK:{ label: 'Revenue Leakage',   icon: '💰', color: '#EF4444' },
  DATA:{ label: 'Data Foundation',   icon: '🗄️', color: '#3B82F6' },
  AIR: { label: 'AI Readiness',      icon: '🤖', color: '#8B5CF6' },
  AIUC:{ label: 'AI Use Cases',      icon: '⚡', color: '#F59E0B' },
};
const ITEM_STATUSES = ['NOT_STARTED','IN_PROGRESS','AWAITING_INPUTS','BLOCKED','COMPLETE'] as const;
const ISTAT_LABEL: Record<string,string> = {
  NOT_STARTED:'Not Started', IN_PROGRESS:'In Progress',
  AWAITING_INPUTS:'Awaiting Inputs', BLOCKED:'Blocked', COMPLETE:'Complete',
};
const ISTAT_BADGE: Record<string,string> = {
  NOT_STARTED:'badge-muted', IN_PROGRESS:'badge-info',
  AWAITING_INPUTS:'badge-warn', BLOCKED:'badge-danger', COMPLETE:'badge-success',
};
const TASK_STATUSES: TaskStatus[] = ['NOT_STARTED','IN_PROGRESS','AWAITING_INPUTS','BLOCKED','COMPLETE'];
const TSTAT_LABEL: Record<string,string> = {
  NOT_STARTED:'Not Started', IN_PROGRESS:'In Progress',
  AWAITING_INPUTS:'Awaiting Inputs', BLOCKED:'Blocked', COMPLETE:'Complete',
};
const TSTAT_STYLE: Record<string,React.CSSProperties> = {
  NOT_STARTED:     { background:'var(--surface-2)', color:'var(--muted)',      border:'1px solid var(--line)' },
  IN_PROGRESS:     { background:'var(--info-bg)',    color:'var(--info)',       border:'1px solid var(--info-border)' },
  AWAITING_INPUTS: { background:'var(--warn-bg)',    color:'var(--warn)',       border:'1px solid var(--warn-border)' },
  BLOCKED:         { background:'var(--danger-bg)',  color:'var(--danger)',     border:'1px solid var(--danger-border)' },
  COMPLETE:        { background:'var(--success-bg)', color:'var(--brand-dark)', border:'1px solid var(--success-border)' },
};
const CONF_STYLE: Record<string,{bg:string;color:string;dot:string}> = {
  Low:   { bg:'var(--danger-bg)',  color:'var(--danger)',     dot:'#EF4444' },
  Medium:{ bg:'var(--warn-bg)',    color:'var(--warn)',       dot:'#F59E0B' },
  High:  { bg:'var(--success-bg)', color:'var(--brand-dark)', dot:'#1ABCB0' },
};

function modM(id?: string|null) { return MOD_META[id||''] ?? { label:'Multi-module', icon:'📊', color:'#94A3B8' }; }
function normS(s?: string|null) {
  const v = String(s||'').toUpperCase().replace(/[\s-]/g,'_');
  return (ITEM_STATUSES as readonly string[]).includes(v) ? v : 'NOT_STARTED';
}
function iid(item: RoadmapItem) { return item.roadmap_fact_id||item.roadmap_instance_id||item.initiative_title; }
function gid(item: RoadmapItem) { return iid(item).slice(0,32).replace(/[^a-z0-9]/gi,'_'); }

function loadStore(aid: string): Record<string,InitiativeGuidance> {
  try { const r = sessionStorage.getItem(`kinto_rg_${aid}`); return r ? JSON.parse(r) : {}; } catch { return {}; }
}
function saveStore(aid: string, store: Record<string,InitiativeGuidance>) {
  try { sessionStorage.setItem(`kinto_rg_${aid}`, JSON.stringify(store)); } catch {}
}

// ── TaskRow ──────────────────────────────────────────────────────────────────
function TaskRow({ task, onUpdate }: { task: GuidanceTask; onUpdate: (t: GuidanceTask) => void }) {
  const [evD, setEvD] = useState(task.evidence_note);
  const [ntD, setNtD] = useState(task.notes);
  const [blD, setBlD] = useState(task.blocker);
  const [open, setOpen] = useState(false);
  useEffect(() => { setEvD(task.evidence_note); }, [task.evidence_note]);
  useEffect(() => { setNtD(task.notes); }, [task.notes]);
  useEffect(() => { setBlD(task.blocker); }, [task.blocker]);
  const done = task.status === 'COMPLETE';
  const hasEv = Boolean(task.evidence_note.trim());
  return (<>
    <tr style={{ borderBottom:'1px solid var(--line)', opacity: task.status==='BLOCKED' ? 0.75 : 1 }}>
      <td style={{ padding:'0.5rem 0.6rem', verticalAlign:'middle', width:'38%' }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:'0.5rem' }}>
          <input type="checkbox" checked={done}
            onChange={e => onUpdate({ ...task, status: e.target.checked ? 'COMPLETE' : 'IN_PROGRESS' })}
            style={{ marginTop:3, accentColor:'var(--brand)', flexShrink:0, cursor:'pointer' }} />
          <div>
            <button type="button" onClick={() => setOpen(o=>!o)}
              style={{ background:'none', border:'none', cursor:'pointer', textAlign:'left', padding:0,
                fontWeight: done ? 500 : 600, fontSize:'0.82rem',
                color: done ? 'var(--muted)' : 'var(--text)',
                textDecoration: done ? 'line-through' : 'none' }}>
              {task.title}
            </button>
            {task.readiness_warning && task.status==='NOT_STARTED' && (
              <div style={{ fontSize:'0.65rem', color:'var(--warn)', marginTop:'0.1rem' }}>⚠ {task.readiness_warning}</div>
            )}
          </div>
        </div>
      </td>
      <td style={{ padding:'0.5rem 0.4rem', verticalAlign:'middle' }}>
        <span style={{ fontSize:'0.68rem', color:'var(--muted-2)', fontWeight:600 }}>{task.type}</span>
      </td>
      <td style={{ padding:'0.5rem 0.4rem', verticalAlign:'middle', textAlign:'center' }}>
        <span style={{ fontSize:'0.72rem', fontWeight:700,
          color: task.priority===1 ? 'var(--danger)' : task.priority===2 ? 'var(--warn)' : 'var(--muted)' }}>{task.priority}</span>
      </td>
      <td style={{ padding:'0.5rem 0.4rem', verticalAlign:'middle' }}>
        <select value={task.status} onChange={e => onUpdate({ ...task, status: e.target.value as TaskStatus })}
          style={{ ...TSTAT_STYLE[task.status], fontSize:'0.68rem', fontWeight:700,
            padding:'0.18rem 0.35rem', borderRadius:999, cursor:'pointer', appearance:'none', minWidth:88, textAlign:'center' }}>
          {TASK_STATUSES.map(s => <option key={s} value={s}>{TSTAT_LABEL[s]}</option>)}
        </select>
      </td>
      <td style={{ padding:'0.5rem 0.4rem', verticalAlign:'middle', maxWidth:160 }}>
        {hasEv
          ? <span style={{ fontSize:'0.7rem', color:'var(--brand-dark)', display:'flex', alignItems:'center', gap:'0.2rem' }}>
              ✓ <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:120 }}>{task.evidence_note}</span>
            </span>
          : <span style={{ fontSize:'0.68rem', color:'var(--muted-2)', fontStyle:'italic' }}>{task.evidence_label}</span>}
      </td>
      <td style={{ padding:'0.5rem 0.4rem', verticalAlign:'middle' }}>
        {task.blocker
          ? <span style={{ fontSize:'0.68rem', color:'var(--danger)', display:'flex', alignItems:'center', gap:'0.2rem' }}>🚧 <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:80 }}>{task.blocker}</span></span>
          : <span style={{ fontSize:'0.65rem', color:'var(--line)' }}>—</span>}
      </td>
      <td style={{ padding:'0.5rem 0.4rem', verticalAlign:'middle' }}>
        <button type="button" onClick={() => setOpen(o=>!o)}
          style={{ background:'none', border:'none', cursor:'pointer', fontSize:'0.7rem', color:'var(--muted)' }}>
          {open ? '▲' : '▼'}
        </button>
      </td>
    </tr>
    {open && (
      <tr style={{ background:'var(--surface-2)' }}>
        <td colSpan={7} style={{ padding:'0.65rem 1rem 0.75rem 2.5rem' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'0.65rem' }}>
            <div className="field-block">
              <span className="field-label">Evidence — {task.evidence_label}</span>
              <input className="kinto-input" style={{ fontSize:'0.78rem' }} value={evD}
                onChange={e => setEvD(e.target.value)}
                onBlur={() => onUpdate({ ...task, evidence_note: evD })}
                placeholder="Describe or link the evidence…" />
            </div>
            <div className="field-block">
              <span className="field-label">Blocker</span>
              <input className="kinto-input" style={{ fontSize:'0.78rem' }} value={blD}
                onChange={e => setBlD(e.target.value)}
                onBlur={() => onUpdate({ ...task, blocker: blD })}
                placeholder="What is blocking this task?" />
            </div>
            <div className="field-block">
              <span className="field-label">Notes</span>
              <input className="kinto-input" style={{ fontSize:'0.78rem' }} value={ntD}
                onChange={e => setNtD(e.target.value)}
                onBlur={() => onUpdate({ ...task, notes: ntD })}
                placeholder="Context, decisions, next steps…" />
            </div>
          </div>
        </td>
      </tr>
    )}
  </>);
}

// ── InitiativeCard ────────────────────────────────────────────────────────────
function InitiativeCard({ item, assessmentId, onSave, saving }: {
  item: RoadmapItem; assessmentId: string;
  onSave: (id: string, patch: { status?: string; progressPct?: number; executionNotes?: string }) => Promise<void>;
  saving: string | null;
}) {
  const iId  = iid(item);
  const gId_ = gid(item);
  const busy = saving === iId;
  const mod  = modM(item.source_module_id || item.module_code);
  const ph   = PHASES.find(p => p.code === (item.phase_code || 'P2'));

  const [guidance, setGuidance] = useState<InitiativeGuidance>(() => {
    const s = loadStore(assessmentId);
    return s[gId_] ?? generateGuidance(gId_, item.initiative_title, item.initiative_description||'', item.module_code||'');
  });
  const [stage, setStage]     = useState('Discover');
  const [expanded, setExp]    = useState(false);
  const [notes, setNotes]     = useState(item.execution_notes||'');
  const [status, setStatus]   = useState(normS(item.status));

  const dp   = useMemo(() => deriveProgress(guidance.tasks), [guidance.tasks]);
  const conf = useMemo(() => deriveConfidence(guidance.tasks), [guidance.tasks]);
  const cs   = CONF_STYLE[conf];
  const stageTasks = useMemo(() => guidance.tasks.filter(t => t.stage === stage), [guidance.tasks, stage]);

  function updateTasks(tasks: GuidanceTask[]) {
    const ng = { ...guidance, tasks };
    setGuidance(ng);
    const s = loadStore(assessmentId); s[gId_] = ng; saveStore(assessmentId, s);
  }

  async function handleStatus(next: string) {
    setStatus(next);
    const ap = next==='COMPLETE' ? 100 : next==='NOT_STARTED' ? 0 : undefined;
    await onSave(iId, { status: next, ...(ap !== undefined ? { progressPct: ap } : {}) });
  }

  async function handleComplete() {
    updateTasks(guidance.tasks.map(t => ({ ...t, status:'COMPLETE' as TaskStatus })));
    await handleStatus('COMPLETE');
  }

  return (
    <div style={{ background:'var(--surface)',
      border:`1px solid ${status==='COMPLETE' ? 'var(--success-border)' : status==='BLOCKED' ? 'var(--danger-border)' : 'var(--line)'}`,
      borderLeft:`3px solid ${mod.color}`, borderRadius:'var(--radius)', overflow:'hidden' }}>
      <div style={{ padding:'0.85rem 1rem 0' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', flexWrap:'wrap', marginBottom:'0.35rem' }}>
          <span style={{ fontSize:'0.72rem', fontWeight:700, color:mod.color }}>{mod.icon} {mod.label}</span>
          {item.owner_role && <span className="badge badge-muted" style={{ fontSize:'0.65rem' }}>👤 {item.owner_role}</span>}
          {item.review_frequency && <span className="badge badge-muted" style={{ fontSize:'0.65rem' }}>📅 {item.review_frequency}</span>}
          {ph && <span className={`roadmap-phase-pill ${ph.pill}`} style={{ fontSize:'0.65rem', padding:'0.12rem 0.4rem' }}>{ph.code}</span>}
        </div>
        <h3 style={{ fontWeight:700, fontSize:'1rem', margin:'0 0 0.25rem', lineHeight:1.3 }}>{item.initiative_title}</h3>
        {item.business_outcome && <p style={{ fontSize:'0.8rem', color:'var(--muted-2)', margin:'0 0 0.65rem', lineHeight:1.35 }}>{item.business_outcome}</p>}
        <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.55rem', flexWrap:'wrap' }}>
          <div style={{ flex:1, minWidth:120 }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.7rem', color:'var(--muted-2)', marginBottom:'0.2rem' }}>
              <span>Progress</span><span style={{ fontWeight:700 }}>{dp}%</span>
            </div>
            <div className="progress-bar-shell" style={{ height:8 }}>
              <div className={`progress-bar-fill${dp<40?' danger':dp<70?' warn':''}`} style={{ width:`${dp}%`, transition:'width 0.4s ease' }} />
            </div>
          </div>
          <select value={status} disabled={busy} onChange={e => void handleStatus(e.target.value)}
            className={`badge ${ISTAT_BADGE[status]}`}
            style={{ cursor:'pointer', border:'none', fontWeight:600, fontSize:'0.72rem',
              padding:'0.2rem 0.5rem', borderRadius:999, appearance:'none', minWidth:100 }}>
            {ITEM_STATUSES.map(s => <option key={s} value={s}>{ISTAT_LABEL[s]}</option>)}
          </select>
          <span style={{ ...cs, fontSize:'0.68rem', fontWeight:700, padding:'0.18rem 0.5rem', borderRadius:999,
            display:'flex', alignItems:'center', gap:'0.25rem' }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:cs.dot, display:'inline-block' }} />
            {conf} Confidence
          </span>
          {busy && <span style={{ fontSize:'0.65rem', color:'var(--brand-dark)', display:'flex', alignItems:'center', gap:3 }}>
            <span style={{ display:'inline-block', width:8, height:8, borderRadius:'50%',
              border:'1.5px solid var(--brand)', borderTopColor:'transparent', animation:'spin 0.7s linear infinite' }} />
            Saving
          </span>}
        </div>
        <button type="button" onClick={() => setExp(e=>!e)}
          style={{ background:'none', border:'none', cursor:'pointer', fontSize:'0.72rem', color:'var(--muted)',
            padding:'0.3rem 0 0.65rem', display:'flex', alignItems:'center', gap:'0.3rem' }}>
          {expanded ? '▲ Collapse' : '▼ Expand implementation plan'}
          <span style={{ fontSize:'0.65rem', color:'var(--muted-2)', marginLeft:'0.25rem' }}>
            ({guidance.tasks.filter(t=>t.status==='COMPLETE').length}/{guidance.tasks.length} tasks)
          </span>
        </button>
      </div>

      {expanded && <div style={{ borderTop:'1px solid var(--line)' }}>
        {/* Stage tabs */}
        <div style={{ display:'flex', borderBottom:'1px solid var(--line)', padding:'0 1rem', overflowX:'auto' }}>
          {STAGES.map(st => {
            const sT = guidance.tasks.filter(t=>t.stage===st).length;
            const sD = guidance.tasks.filter(t=>t.stage===st && t.status==='COMPLETE').length;
            const sP = sT > 0 ? Math.round((sD/sT)*100) : 0;
            const active = stage === st;
            return <button key={st} type="button" onClick={() => setStage(st)}
              style={{ background:'none', border:'none', cursor:'pointer', padding:'0.6rem 0.85rem',
                fontSize:'0.8rem', fontWeight: active ? 700 : 500,
                color: active ? 'var(--brand-dark)' : 'var(--muted)',
                borderBottom: active ? '2px solid var(--brand)' : '2px solid transparent',
                whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:'0.3rem' }}>
              {st}
              {sT > 0 && <span style={{ fontSize:'0.6rem', fontWeight:700, padding:'0.1rem 0.3rem', borderRadius:999,
                background: sP===100 ? 'var(--success-bg)' : 'var(--surface-2)',
                color: sP===100 ? 'var(--brand-dark)' : 'var(--muted-2)',
                border:`1px solid ${sP===100 ? 'var(--success-border)' : 'var(--line)'}` }}>
                {sD}/{sT}
              </span>}
            </button>;
          })}
        </div>

        {/* Task table */}
        {stageTasks.length > 0
          ? <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.82rem' }}>
                <thead>
                  <tr style={{ background:'var(--surface-2)', borderBottom:'1px solid var(--line)' }}>
                    {['Task','Type','P','Status','Evidence','Blocker',''].map((h,i) =>
                      <th key={i} style={{ padding:'0.4rem 0.6rem', textAlign: i===2?'center':'left',
                        fontSize:'0.68rem', fontWeight:700, color:'var(--muted)',
                        ...(i===0 ? {width:'38%'} : i===6 ? {width:30} : {}) }}>{h}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {stageTasks.map(t => <TaskRow key={t.task_id} task={t}
                    onUpdate={updated => updateTasks(guidance.tasks.map(x => x.task_id===updated.task_id ? updated : x))} />)}
                </tbody>
              </table>
            </div>
          : <p style={{ fontSize:'0.8rem', color:'var(--muted-2)', padding:'0.75rem 1rem', fontStyle:'italic' }}>No tasks in this stage.</p>}

        {/* Bottom panel */}
        <div style={{ padding:'0.85rem 1rem', display:'grid', gap:'0.75rem',
          borderTop:'1px solid var(--line)', background:'var(--surface-2)' }}>
          {guidance.definition_of_done.length > 0 && <div>
            <div style={{ fontWeight:700, fontSize:'0.82rem', marginBottom:'0.4rem' }}>Definition of done:</div>
            <ul style={{ margin:0, paddingLeft:'1.1rem' }}>
              {guidance.definition_of_done.map((d,i) =>
                <li key={i} style={{ fontSize:'0.78rem', color:'var(--muted)', marginBottom:'0.2rem' }}>{d}</li>)}
            </ul>
          </div>}
          <div className="field-block">
            <span className="field-label">Execution notes</span>
            <textarea className="kinto-textarea" rows={2} style={{ fontSize:'0.8rem' }}
              value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="What is blocked, decisions made, and what happens next…"
              onBlur={() => { if (notes !== (item.execution_notes||'')) void onSave(iId, { executionNotes: notes }); }} />
          </div>
          {guidance.next_checkpoint && <div style={{ display:'flex', alignItems:'center', gap:'0.5rem',
            fontSize:'0.75rem', color:'var(--muted-2)',
            background:'var(--info-bg)', border:'1px solid var(--info-border)',
            borderRadius:'var(--radius-sm)', padding:'0.4rem 0.65rem' }}>
            <span>💡</span><span><strong>Next checkpoint:</strong> {guidance.next_checkpoint}</span>
          </div>}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setExp(false)} style={{ fontSize:'0.75rem' }}>Collapse</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void handleComplete()}
              disabled={busy || status==='COMPLETE'} style={{ fontSize:'0.75rem' }}>✓ Complete Initiative</button>
          </div>
        </div>
      </div>}
    </div>
  );
}

// ── RoadmapClient ─────────────────────────────────────────────────────────────
export function RoadmapClient({ assessmentId, initialItems, moduleScores }: Props) {
  const [items, setItems]     = useState<RoadmapItem[]>(initialItems);
  const [saving, setSaving]   = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [fMod, setFMod]       = useState('ALL');
  const [fStat, setFStat]     = useState('ALL');
  const [fPhase, setFPhase]   = useState('ALL');
  const [search, setSearch]   = useState('');
  const [view, setView]       = useState<'board'|'table'>('board');
  const [, startT]            = useTransition();

  async function saveItem(id: string, patch: { status?: string; progressPct?: number; executionNotes?: string }) {
    setSaving(id); setError(null);
    setItems(prev => prev.map(i => iid(i)===id ? {
      ...i,
      ...('status' in patch ? {status: patch.status} : {}),
      ...('progressPct' in patch ? {progress_pct: patch.progressPct} : {}),
      ...('executionNotes' in patch ? {execution_notes: patch.executionNotes} : {}),
    } : i));
    try {
      const r = await fetch(`/api/assessments/${encodeURIComponent(assessmentId)}/roadmap/${encodeURIComponent(id)}`,
        { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(patch) });
      const p = await r.json().catch(()=>null);
      if (!r.ok || p?.error) throw new Error(p?.error || `HTTP ${r.status}`);
    } catch(err) {
      setError(err instanceof Error ? err.message : 'Save failed');
      setItems(initialItems);
    } finally { startT(() => setSaving(null)); }
  }

  const allMods = useMemo(() => {
    const seen = new Set<string>();
    return items.reduce<Array<{id:string;label:string;icon:string}>>((acc,i) => {
      const id = i.source_module_id||i.module_code||'';
      if (id && !seen.has(id)) { seen.add(id); const m=modM(id); acc.push({id,label:m.label,icon:m.icon}); }
      return acc;
    }, []);
  }, [items]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return items.filter(i => {
      const mId = i.source_module_id||i.module_code||'';
      if (fMod!=='ALL' && mId!==fMod) return false;
      if (fStat!=='ALL' && normS(i.status)!==fStat) return false;
      if (fPhase!=='ALL' && (i.phase_code||'P2')!==fPhase) return false;
      if (s) { const h=[i.initiative_title,i.owner_role,i.business_outcome,i.execution_notes].join(' ').toLowerCase(); if (!h.includes(s)) return false; }
      return true;
    });
  }, [items,fMod,fStat,fPhase,search]);

  const byPhase = useMemo(() => PHASES.map(ph => ({ ...ph, items: filtered.filter(i=>(i.phase_code||'P2')===ph.code) })), [filtered]);

  const stats = useMemo(() => {
    const t=items.length, c=items.filter(i=>normS(i.status)==='COMPLETE').length,
      ip=items.filter(i=>normS(i.status)==='IN_PROGRESS').length,
      bl=items.filter(i=>normS(i.status)==='BLOCKED').length,
      aw=items.filter(i=>normS(i.status)==='AWAITING_INPUTS').length,
      p=t>0?Math.round((c/t)*100):0;
    const byMod:Record<string,{total:number;complete:number;pct:number}>={};
    for (const i of items) {
      const mId=i.source_module_id||i.module_code||'X';
      if (!byMod[mId]) byMod[mId]={total:0,complete:0,pct:0};
      byMod[mId].total++;
      if (normS(i.status)==='COMPLETE') byMod[mId].complete++;
    }
    for (const m of Object.keys(byMod)) { byMod[m].pct=byMod[m].total>0?Math.round((byMod[m].complete/byMod[m].total)*100):0; }
    return {total:t,complete:c,inprog:ip,blocked:bl,awaiting:aw,pct:p,byMod};
  }, [items]);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      {error && <div style={{ padding:'0.65rem 1rem', background:'var(--danger-bg)', border:'1px solid var(--danger-border)',
        borderRadius:'var(--radius-sm)', color:'var(--danger)', fontSize:'0.85rem',
        display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span>⚠ {error}</span>
        <button onClick={()=>setError(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--danger)' }}>✕</button>
      </div>}

      {/* KPI strip */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(130px, 1fr))', gap:'0.75rem' }}>
        {[
          {label:'Total Actions',  value:String(stats.total),   sub:'All phases · all modules'},
          {label:'Complete',       value:String(stats.complete),sub:`${stats.pct}% done`, accent:stats.pct===100},
          {label:'In Progress',    value:String(stats.inprog),  sub:'Active now'},
          {label:'Awaiting Inputs',value:String(stats.awaiting),sub:'Pending', warn:stats.awaiting>0},
          {label:'Blocked',        value:String(stats.blocked), sub:'Needs attention', danger:stats.blocked>0},
        ].map(k => <div key={k.label} className={`stat-card${(k as any).accent?' stat-card-accent':''}`}>
          <div className="stat-card-label">{k.label}</div>
          <div className="stat-card-value" style={{ fontSize:'1.25rem',
            color:(k as any).danger&&stats.blocked>0?'var(--danger)':(k as any).warn&&stats.awaiting>0?'var(--warn)':undefined }}>{k.value}</div>
          <div className="stat-card-sub">{k.sub}</div>
        </div>)}
      </div>

      {/* Overall progress bar */}
      {stats.total > 0 && <div style={{ padding:'0.75rem 1rem', background:'var(--surface)',
        border:'1px solid var(--line)', borderRadius:'var(--radius)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.4rem', fontSize:'0.85rem' }}>
          <span style={{ fontWeight:600 }}>Overall Transformation Progress</span>
          <span style={{ fontWeight:700 }}>{stats.pct}%</span>
        </div>
        <div className="progress-bar-shell" style={{ height:10 }}>
          <div className="progress-bar-fill" style={{ width:`${stats.pct}%`, transition:'width 0.4s ease' }} />
        </div>
        <p style={{ fontSize:'0.72rem', color:'var(--muted-2)', marginTop:'0.3rem' }}>{stats.complete} of {stats.total} initiatives complete</p>
      </div>}

      {/* Diagnostic vs Implementation */}
      {moduleScores.length > 0 && stats.total > 0 && <div className="card">
        <div className="card-header"><div>
          <h3 className="card-title">Diagnostic Score vs Implementation Progress</h3>
          <p className="card-subtitle">Assessment maturity alongside roadmap execution by module</p>
        </div></div>
        <div style={{ display:'grid', gap:0 }}>
          {moduleScores.map((m,idx) => {
            const mod=modM(m.module_code);
            const rd=stats.byMod[`MOD-${m.module_code}`]||stats.byMod[m.module_code]||{total:0,complete:0,pct:0};
            const dp_=Math.round(m.score_pct||0), ip_=rd.pct, gap=ip_-dp_;
            return <div key={m.module_code} style={{ display:'grid', gridTemplateColumns:'170px 1fr 1fr 70px',
              gap:'0.85rem', alignItems:'center', padding:'0.55rem 0',
              borderBottom:idx<moduleScores.length-1?'1px solid var(--line)':'none' }}>
              <span style={{ fontWeight:600, fontSize:'0.82rem', display:'flex', alignItems:'center', gap:'0.35rem' }}>{mod.icon} {m.module_name}</span>
              <div>
                <div style={{ fontSize:'0.67rem', color:'var(--muted-2)', marginBottom:'0.2rem' }}>Diagnostic score</div>
                <div style={{ display:'flex', alignItems:'center', gap:'0.45rem' }}>
                  <div className="progress-bar-shell" style={{ flex:1, height:7 }}>
                    <div className={`progress-bar-fill${dp_<40?' danger':dp_<65?' warn':''}`} style={{ width:`${dp_}%` }} />
                  </div>
                  <span style={{ fontWeight:700, minWidth:32, fontSize:'0.78rem' }}>{dp_>0?`${dp_}%`:'—'}</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize:'0.67rem', color:'var(--muted-2)', marginBottom:'0.2rem' }}>Roadmap ({rd.complete}/{rd.total})</div>
                <div style={{ display:'flex', alignItems:'center', gap:'0.45rem' }}>
                  <div className="progress-bar-shell" style={{ flex:1, height:7 }}>
                    <div className="progress-bar-fill" style={{ width:`${ip_}%`, background:mod.color }} />
                  </div>
                  <span style={{ fontWeight:700, minWidth:32, fontSize:'0.78rem' }}>{rd.total>0?`${ip_}%`:'—'}</span>
                </div>
              </div>
              <div style={{ textAlign:'right' }}>
                {dp_>0 && rd.total>0 && <span style={{ fontSize:'0.7rem', fontWeight:700, color:gap>=0?'var(--brand-dark)':'var(--warn)' }}>
                  {gap>0?`+${gap}%`:gap<0?`${gap}%`:'Even'}
                </span>}
              </div>
            </div>;
          })}
        </div>
      </div>}

      {/* Filters */}
      <div style={{ background:'var(--surface)', border:'1px solid var(--line)', borderRadius:'var(--radius)', padding:'0.85rem 1rem' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(150px, 1fr))', gap:'0.65rem', alignItems:'end' }}>
          <div className="field-block">
            <span className="field-label">Phase</span>
            <select className="kinto-select" value={fPhase} onChange={e=>setFPhase(e.target.value)}>
              <option value="ALL">All phases</option>
              {PHASES.map(p=><option key={p.code} value={p.code}>{p.code} — {p.name}</option>)}
            </select>
          </div>
          <div className="field-block">
            <span className="field-label">Module</span>
            <select className="kinto-select" value={fMod} onChange={e=>setFMod(e.target.value)}>
              <option value="ALL">All modules</option>
              {allMods.map(m=><option key={m.id} value={m.id}>{m.icon} {m.label}</option>)}
            </select>
          </div>
          <div className="field-block">
            <span className="field-label">Status</span>
            <select className="kinto-select" value={fStat} onChange={e=>setFStat(e.target.value)}>
              <option value="ALL">All statuses</option>
              {ITEM_STATUSES.map(s=><option key={s} value={s}>{ISTAT_LABEL[s]}</option>)}
            </select>
          </div>
          <div className="field-block">
            <span className="field-label">Search</span>
            <input className="kinto-input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Initiative, owner, outcome…" />
          </div>
          <div style={{ display:'flex', gap:'0.35rem', alignSelf:'end' }}>
            <button type="button" className={`btn btn-sm ${view==='board'?'btn-primary':'btn-secondary'}`} onClick={()=>setView('board')}>Board</button>
            <button type="button" className={`btn btn-sm ${view==='table'?'btn-primary':'btn-secondary'}`} onClick={()=>setView('table')}>Table</button>
          </div>
        </div>
        {filtered.length !== items.length && <p style={{ fontSize:'0.72rem', color:'var(--muted-2)', margin:'0.5rem 0 0' }}>
          Showing {filtered.length} of {items.length} initiatives
          <button onClick={()=>{setFMod('ALL');setFStat('ALL');setFPhase('ALL');setSearch('');}}
            style={{ marginLeft:'0.5rem', background:'none', border:'none', cursor:'pointer', color:'var(--brand-dark)', fontSize:'0.72rem', fontWeight:700 }}>Clear</button>
        </p>}
      </div>

      {items.length === 0 && <div className="card"><div className="empty-state">
        <div className="empty-state-icon">🗺️</div>
        <p className="empty-state-title">No roadmap generated yet</p>
        <p className="empty-state-sub">Complete module assessments, then click Generate Roadmap.</p>
      </div></div>}

      {/* Board view */}
      {view==='board' && items.length>0 && <>
        {byPhase.map(ph => {
          const phC=ph.items.filter(i=>normS(i.status)==='COMPLETE').length;
          const phP=ph.items.length>0?Math.round((phC/ph.items.length)*100):0;
          return <div key={ph.code} style={{ display:'grid', gap:'0.75rem' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', paddingBottom:'0.55rem',
              borderBottom:'2px solid var(--line)', flexWrap:'wrap' }}>
              <span className={`roadmap-phase-pill ${ph.pill}`} style={{ minWidth:34, textAlign:'center' }}>{ph.code}</span>
              <div style={{ flex:1, minWidth:160 }}>
                <h3 style={{ margin:0, fontSize:'0.95rem' }}>{ph.name}</h3>
                <p style={{ margin:0, fontSize:'0.72rem', color:'var(--muted-2)' }}>{ph.desc}</p>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', flexShrink:0 }}>
                <span className="text-xs muted-2">{ph.items.length} initiatives</span>
                {ph.items.length>0 && <>
                  <div className="progress-bar-shell" style={{ width:70, height:7 }}>
                    <div className="progress-bar-fill" style={{ width:`${phP}%` }} />
                  </div>
                  <span style={{ fontWeight:700, fontSize:'0.78rem', minWidth:34 }}>{phP}%</span>
                </>}
              </div>
            </div>
            {ph.items.length===0
              ? <p style={{ fontSize:'0.8rem', color:'var(--muted-2)', fontStyle:'italic' }}>No initiatives match current filters.</p>
              : <div style={{ display:'grid', gap:'0.65rem' }}>
                  {ph.items.map(i => <InitiativeCard key={iid(i)} item={i} assessmentId={assessmentId} onSave={saveItem} saving={saving} />)}
                </div>}
          </div>;
        })}
      </>}

      {/* Table view */}
      {view==='table' && items.length>0 && <div className="card"><div className="table-scroll">
        <table className="kinto-table">
          <thead><tr>
            {['Initiative','Phase','Module','Owner','Progress','Confidence','Status'].map(h =>
              <th key={h}>{h}</th>)}
          </tr></thead>
          <tbody>
            {filtered.map(item => {
              const id_=iid(item), gId__=gid(item);
              const st=loadStore(assessmentId);
              const g=st[gId__]??generateGuidance(gId__,item.initiative_title,item.initiative_description||'',item.module_code||'');
              const dp_=deriveProgress(g.tasks), dc_=deriveConfidence(g.tasks);
              const s=normS(item.status), mod_=modM(item.source_module_id||item.module_code);
              const ph_=PHASES.find(p=>p.code===(item.phase_code||'P2'));
              const cs_=CONF_STYLE[dc_];
              return <tr key={id_}>
                <td><div style={{ fontWeight:600, fontSize:'0.875rem' }}>{item.initiative_title}</div>
                  {item.business_outcome && <div className="text-xs muted-2">{item.business_outcome}</div>}</td>
                <td>{ph_&&<span className={`roadmap-phase-pill ${ph_.pill}`} style={{ fontSize:'0.65rem' }}>{ph_.code}</span>}</td>
                <td><span style={{ fontSize:'0.78rem', fontWeight:600, color:mod_.color }}>{mod_.icon} {mod_.label}</span></td>
                <td className="text-xs muted-2">{item.owner_role||'—'}</td>
                <td style={{ minWidth:100 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'0.4rem' }}>
                    <div className="progress-bar-shell" style={{ flex:1, height:6 }}>
                      <div className="progress-bar-fill" style={{ width:`${dp_}%` }} />
                    </div>
                    <span style={{ fontSize:'0.75rem', fontWeight:700, minWidth:32 }}>{dp_}%</span>
                  </div>
                </td>
                <td><span style={{ ...cs_, fontSize:'0.68rem', fontWeight:700, padding:'0.15rem 0.4rem', borderRadius:999,
                  display:'inline-flex', alignItems:'center', gap:4 }}>
                  <span style={{ width:5, height:5, borderRadius:'50%', background:cs_.dot, display:'inline-block' }} />{dc_}
                </span></td>
                <td><select value={s} disabled={saving===id_}
                  onChange={e => { const n=e.target.value; const ap=n==='COMPLETE'?100:n==='NOT_STARTED'?0:undefined;
                    void saveItem(id_,{status:n,...(ap!==undefined?{progressPct:ap}:{})}); }}
                  className={`badge ${ISTAT_BADGE[s]}`}
                  style={{ cursor:'pointer', border:'none', fontWeight:600, fontSize:'0.7rem',
                    padding:'0.2rem 0.45rem', borderRadius:999, appearance:'none', minWidth:90 }}>
                  {ITEM_STATUSES.map(st_=><option key={st_} value={st_}>{ISTAT_LABEL[st_]}</option>)}
                </select></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div></div>}
    </div>
  );
}
