
export function sentenceCase(value?: string | null) {
  const raw = String(value || '').replaceAll('_', ' ').trim();
  if (!raw) return '—';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function statusTone(status?: string | null) {
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

export function TaskStatusSelect({ value, onChange, disabled }: { value?: string | null; onChange: (value: string) => void; disabled?: boolean }) {
  const tone = statusTone(value);
  return (
    <select
      value={value || 'not_started'}
      onChange={(e: any) => onChange(e.target.value)}
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

export function Card({ children, style }: { children?: any; style?: any }) {
  return <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderLeft: '3px solid #14b8a6', borderRadius: 16, padding: 16, ...style }}>{children}</div>;
}

export function StatusPill({ label }: { label: string }) {
  const tone = statusTone(label);
  return (
    <span style={{ background: tone.bg, color: tone.color, border: `1px solid ${tone.border}`, borderRadius: 999, padding: '5px 10px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
      {sentenceCase(label)}
    </span>
  );
}

export function SmallMuted({ children, style }: { children?: any; style?: any }) {
  return <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.45, ...style }}>{children}</div>;
}

export function GroupLabel({ children }: { children?: any }) {
  return <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3, color: '#6b7280' }}>{children}</div>;
}

export function ProgressBar({ percent }: { percent: number }) {
  const fill = Math.max(0, Math.min(100, Number(percent || 0)));
  const color = fill >= 100 ? '#16a34a' : fill >= 40 ? '#14b8a6' : fill > 0 ? '#f59e0b' : '#d1d5db';
  return (
    <div style={{ width: '100%', height: 9, background: '#e5e7eb', borderRadius: 999, overflow: 'hidden' }}>
      <div style={{ width: `${fill}%`, height: '100%', background: color, transition: 'width 0.2s ease' }} />
    </div>
  );
}

export function PhaseStrip({ phases, selectedPhaseCode, onSelect }: { phases: any[]; selectedPhaseCode: string; onSelect: (code: string) => void }) {
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

export function buildDocumentLabel(doc: any) {
  return doc?.note_text || doc?.file_url || doc?.external_link || 'Saved document';
}

export function linkedDocsForTask(docsByTask: Map<string, any[]>, taskId?: string | null) {
  return docsByTask.get(taskId || '') || [];
}
