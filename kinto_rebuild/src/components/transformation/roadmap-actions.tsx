'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { buildRoute } from '@/lib/routes';

type Props = {
  assessmentId: string;
  hasItems: boolean;
  scoredModules: number;
  clientId?: string | null;
};

export function RoadmapActions({ assessmentId, hasItems, scoredModules, clientId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/assessments/${encodeURIComponent(assessmentId)}/roadmap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!r.ok) {
        const p = await r.json().catch(() => null);
        throw new Error(p?.error || `Generation failed (${r.status})`);
      }
      // Reload page with fresh server data
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      {error && (
        <span style={{ fontSize: '0.75rem', color: 'var(--danger)' }}>{error}</span>
      )}
      {scoredModules === 0 && !hasItems && (
        <span className="text-xs muted-2">Score modules first to generate roadmap</span>
      )}
      <button
        type="button"
        onClick={generate}
        disabled={busy || scoredModules === 0}
        className={`btn btn-sm ${hasItems ? 'btn-secondary' : 'btn-primary'}`}
        title={scoredModules === 0 ? 'Complete at least one diagnostic module to generate the roadmap' : undefined}
      >
        {busy
          ? <><span style={{ display: 'inline-block', width: 11, height: 11, borderRadius: '50%', border: '2px solid currentColor', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite', marginRight: 5 }} />Generating…</>
          : hasItems ? '↻ Regenerate Roadmap' : '+ Generate Roadmap'
        }
      </button>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
