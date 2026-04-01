// @ts-nocheck
'use client';
/**
 * ExplainButton — inline "explain this" trigger for findings, scores, actions.
 * Opens the assistant pre-loaded with context about the specific item.
 * Uses sessionStorage to pass context to the floating assistant panel.
 */
import { useState } from 'react';

interface Props {
  context: string; // What to explain
  label?: string;
  mode?: 'explainer' | 'guidance' | 'report';
  compact?: boolean;
}

export function ExplainButton({ context, label = 'Explain', mode = 'explainer', compact = false }: Props) {
  const [sent, setSent] = useState(false);

  function handleClick() {
    // Store the explain request in sessionStorage — the assistant panel picks it up
    sessionStorage.setItem('kinto_assistant_request', JSON.stringify({
      message: context,
      mode,
      timestamp: Date.now(),
    }));
    // Dispatch a custom event so the assistant panel opens immediately
    window.dispatchEvent(new CustomEvent('kinto:explain', { detail: { context, mode } }));
    setSent(true);
    setTimeout(() => setSent(false), 2000);
  }

  if (compact) {
    return (
      <button onClick={handleClick}
        title={`Ask Claude: ${context.slice(0, 60)}`}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: '0.15rem 0.3rem',
          fontSize: '0.68rem', color: sent ? 'var(--teal)' : 'var(--muted)',
          borderRadius: 4, transition: 'all 0.15s',
        }}
      >
        {sent ? '✓ Sent' : '💬'}
      </button>
    );
  }

  return (
    <button onClick={handleClick}
      style={{
        background: sent ? 'rgba(26,188,176,0.1)' : 'var(--surface-2)',
        border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)',
        padding: '0.3rem 0.65rem', cursor: 'pointer',
        fontSize: '0.72rem', fontWeight: 600, display: 'flex', alignItems: 'center',
        gap: '0.35rem', color: sent ? 'var(--teal)' : 'var(--text-2)', transition: 'all 0.15s',
      }}
    >
      <span>{sent ? '✓' : '💬'}</span>
      <span>{sent ? 'Sent to assistant' : label}</span>
    </button>
  );
}
