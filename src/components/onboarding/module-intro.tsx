// @ts-nocheck
'use client';
/**
 * Module Intro Banner
 * Shown at the top of a module assessment tab.
 * Explains what the module covers, how scoring works, and what the outputs are.
 * Collapses after the first scoring action. Dismissible permanently.
 */
import { useState, useEffect } from 'react';

interface Props {
  moduleCode: string;
  moduleName: string;
  hasScores: boolean;
}

const MODULE_INTROS: Record<string, {
  purpose: string;
  how: string;
  outputs: string;
  tip: string;
}> = {
  'OPS': {
    purpose: 'Operational Audit evaluates the quality of your client\'s operating model across up to nine domains including business foundation, demand generation, sales execution, delivery, billing, and management control.',
    how: 'Score each question 1–5 based on what you observe in live operations — not what the client says they do. 1 means it is not in place. 5 means it is fully controlled and consistently applied. Score the evidence you can see, not the intention.',
    outputs: 'Findings, recommendations, and actions generate automatically as you score. Lower scores produce more advisory content. The Advisory tab shows everything in priority order once scoring is complete.',
    tip: 'You don\'t need to score every question. Score the domains most relevant to this engagement. Advisory outputs will reflect what has been scored.',
  },
  'LEAK': {
    purpose: 'Revenue Leakage quantifies where the business is losing revenue it has already earned or should be earning. It covers nine leakage cores: lead volume, conversion, deal size, pricing, unbilled revenue, billing errors, churn, expansion gaps, and bad debt.',
    how: 'Start by selecting a benchmark profile. Then enter the actual numbers for each core — what the business is currently achieving versus what the target or benchmark is. The engine calculates the leakage exposure and produces a financial impact figure.',
    outputs: 'A quantified leakage estimate per core and in total. This is the most commercially powerful module for opening client conversations because the output is a specific number, not a maturity score.',
    tip: 'Even partial data produces useful outputs. Enter what you have. The leakage engine shows 0 for uncaptured cores rather than guessing.',
  },
  'DATA': {
    purpose: 'Data Foundation assesses whether the business\'s data can be trusted for decisions, operations, and AI initiatives. It covers seven domains: source of truth, capture discipline, data quality, workflow visibility, KPI logic, reporting maturity, and governance.',
    how: 'Score each question 1–5 based on what you observe about how data is actually managed and used in the business — not the theoretical design. Ask to see a report being built, a dashboard being reviewed, or a KPI being explained.',
    outputs: 'Domain scores and priority findings. Weak DATA scores also affect the AI Use Cases module — use cases that depend on unreliable data will be flagged as blocked or conditional.',
    tip: 'Data Foundation is often the module that surprises clients the most. Many businesses believe their data is better than it is. Evidence-led scoring here is particularly important.',
  },
  'AIR': {
    purpose: 'AI Readiness assesses whether the business has the strategy, data, process, technology, governance, and change capacity to deploy AI responsibly and effectively. It predicts which AI use cases are viable now versus which ones need preparation first.',
    how: 'Score each readiness dimension 1–5. Be honest about current state versus aspiration. An AI readiness score below 60% will flag AI use cases as blocked or conditional — this is the correct output, not a failure.',
    outputs: 'A readiness status — Pilot Ready, Conditional, or Blocked — and a set of prioritised actions that resolve the specific blockers. The AI Use Cases module reads the AIR score to sequence which pilots are viable.',
    tip: 'Most businesses score 40–65% on AI readiness. That is not a bad result — it means they are developing. The value is in knowing exactly which gaps need to close before deployment.',
  },
  'AIUC': {
    purpose: 'AI Use Cases scores each potential AI initiative on value and feasibility, then classifies it as Pilot Now, Prepare First, Fix Foundations First, or Not Suitable — based on the scores from OPS, DATA, and AIR.',
    how: 'Score each use case across the value and feasibility factors. The module reads your OPS, DATA, and AIR scores to determine readiness. A use case may score highly on value but be blocked by data or process gaps — the module surfaces this explicitly.',
    outputs: 'A prioritised portfolio of AI use cases with a deployment sequence. Pilot-ready use cases can be acted on immediately. Conditional and blocked use cases show exactly what must be resolved first.',
    tip: 'This module is most powerful when OPS, DATA, and AIR have been scored first. The cross-module dependencies are what make the prioritisation output genuinely useful rather than a generic AI wish list.',
  },
};

export function ModuleIntro({ moduleCode, moduleName, hasScores }: Props) {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    try {
      const key = `kinto_intro_${moduleCode}`;
      const dismissed = localStorage.getItem(key) === 'true';
      setVisible(!dismissed);
    } catch {
      setVisible(true);
    }
  }, [moduleCode]);

  // Auto-collapse after scoring starts
  useEffect(() => {
    if (hasScores) setExpanded(false);
  }, [hasScores]);

  function dismiss() {
    try { localStorage.setItem(`kinto_intro_${moduleCode}`, 'true'); } catch {}
    setVisible(false);
  }

  if (!visible) return null;

  const intro = MODULE_INTROS[moduleCode];
  if (!intro) return null;

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderLeft: '3px solid #1ABCB0',
      borderRadius: 'var(--radius)',
      marginBottom: '1rem',
      overflow: 'hidden',
    }}>
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.9rem' }}>ℹ️</span>
          <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text)' }}>
            How to use {moduleName}
          </span>
          {!expanded && <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>· click to expand</span>}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            onClick={e => { e.stopPropagation(); dismiss(); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.72rem', color: 'var(--muted)', padding: '0.15rem 0.35rem' }}
          >
            Dismiss
          </button>
          <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--line)', padding: '0.85rem 1rem', display: 'grid', gap: '0.75rem' }}>
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#1ABCB0', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>What this module covers</div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-2)', margin: 0, lineHeight: 1.6 }}>{intro.purpose}</p>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#1ABCB0', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>How to score it</div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-2)', margin: 0, lineHeight: 1.6 }}>{intro.how}</p>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#1ABCB0', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>What you get</div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-2)', margin: 0, lineHeight: 1.6 }}>{intro.outputs}</p>
          </div>
          <div style={{ background: 'rgba(26,188,176,0.06)', border: '1px solid rgba(26,188,176,0.2)', borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.75rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-2)' }}>
              <strong style={{ color: '#1ABCB0' }}>💡 Tip: </strong>{intro.tip}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
