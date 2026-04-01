// @ts-nocheck
import Link from 'next/link';
import { getWorkspaceSnapshot } from '@/lib/services/workspace';

function moduleHref(code: string, clientId?: string | null, assessmentId?: string | null) {
  const map: Record<string, string> = {
    OPS: '/diagnostics/operational-audit',
    LEAK: '/diagnostics/revenue-leakage',
    DATA: '/diagnostics/data-foundation',
    AIR: '/diagnostics/ai-readiness',
    AIUC: '/diagnostics/ai-use-cases',
    ROADMAP: '/transformation/roadmap',
  };
  const path = map[code] || '/workspace';
  const p = new URLSearchParams();
  if (clientId) p.set('clientId', clientId);
  if (assessmentId) p.set('assessmentId', assessmentId);
  const q = p.toString();
  return q ? `${path}?${q}` : path;
}

function moduleIcon(code: string) {
  const icons: Record<string, string> = {
    OPS: '🔍', LEAK: '💰', DATA: '🗄️', AIR: '🤖', AIUC: '⚡', ROADMAP: '🗺️',
  };
  return icons[code] || '📊';
}

function bandClass(pct: number): string {
  if (pct <= 0) return '';
  if (pct < 40) return 'score-band-critical';
  if (pct < 65) return 'score-band-developing';
  return 'score-band-strong';
}

function bandLabel(pct: number, status?: string | null): string {
  if (pct <= 0) return String(status || 'NOT STARTED').replaceAll('_', ' ');
  if (pct < 40) return 'Critical / Weak';
  if (pct < 65) return 'Developing';
  return 'Strong / Managed';
}

type Props = { assessmentId?: string | null; clientId?: string | null };

export async function ModuleSummaryCards({ assessmentId, clientId }: Props = {}) {
  const snapshot = await getWorkspaceSnapshot({ clientId: clientId ?? undefined, assessmentId: assessmentId ?? undefined });
  const aId = snapshot.assessment?.assessment_id || assessmentId || null;
  const cId = snapshot.client?.client_id || clientId || null;
  const items = snapshot.modules || [];
  const diagnostic = items.filter((m: any) => m.module_code !== 'ROADMAP');

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
      {diagnostic.map((item: any) => {
        const scorePct = Math.round(Number(item.score_pct || 0));
        const completionPct = Math.round(Number(item.completion_pct || 0));
        const displayPct = scorePct > 0 ? scorePct : completionPct;
        const isComplete = String(item.module_status || '').toUpperCase() === 'COMPLETE';
        const isStarted = completionPct > 0;

        return (
          <Link key={item.module_id} href={moduleHref(item.module_code, cId, aId)} style={{ textDecoration: 'none' }}>
            <div className="module-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="module-card-icon">{moduleIcon(item.module_code)}</div>
                {isComplete && (
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--brand-dark)', background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 999, padding: '0.15rem 0.5rem' }}>
                    Complete
                  </span>
                )}
              </div>
              <div className="module-card-name">{item.module_name}</div>
              <div className="module-card-score">
                {displayPct > 0 ? `${displayPct}%` : '—'}
              </div>
              <div className="module-card-progress">
                <div className="module-card-progress-fill" style={{ width: `${completionPct}%` }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="module-card-status">{completionPct}% complete</span>
                {scorePct > 0 && (
                  <span className={`score-band ${bandClass(scorePct)}`} style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem' }}>
                    {bandLabel(scorePct)}
                  </span>
                )}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
