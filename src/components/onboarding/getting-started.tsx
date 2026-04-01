// @ts-nocheck
'use client';
/**
 * Kinto Global — Getting Started Guide
 * 
 * Shown on the workspace when:
 *   a) No client exists yet (brand new user)
 *   b) No assessment exists yet (client created but not started)
 * 
 * Walks the user through the exact sequence they need to follow.
 * Dismissible per session via localStorage.
 */
import { useState, useEffect } from 'react';

interface Props {
  hasClient: boolean;
  hasAssessment: boolean;
  hasScoredModules: boolean;
  hasRoadmap: boolean;
  clientName?: string | null;
}

const STEPS = [
  {
    id: 'create-client',
    number: 1,
    title: 'Create a client',
    detail: 'Click "+ Client" in the top bar. Enter the client\'s company name. This creates a workspace for that engagement.',
    done: (p: Props) => p.hasClient,
    cta: 'Click "+ Client" in the bar above',
    icon: '👤',
  },
  {
    id: 'create-assessment',
    number: 2,
    title: 'Create an assessment',
    detail: 'With the client selected, click "+ Assessment". This creates a diagnostic session you can score against the five modules.',
    done: (p: Props) => p.hasAssessment,
    cta: 'Click "+ Assessment" in the bar above',
    icon: '📋',
  },
  {
    id: 'score-modules',
    number: 3,
    title: 'Score one or more modules',
    detail: 'Use the sidebar to open a module. Start with Operational Audit or Revenue Leakage — they produce the strongest first outputs. Score questions 1–5. Advisory findings generate automatically.',
    done: (p: Props) => p.hasScoredModules,
    cta: 'Open a module in the sidebar',
    icon: '🔍',
  },
  {
    id: 'generate-roadmap',
    number: 4,
    title: 'Generate the roadmap',
    detail: 'Once at least one module has scores, click "Generate Roadmap" from the workspace bar. This creates your prioritised implementation plan. P1 actions are the immediate priorities.',
    done: (p: Props) => p.hasRoadmap,
    cta: 'Click "Generate Roadmap" in the bar above',
    icon: '🗺️',
  },
  {
    id: 'generate-report',
    number: 5,
    title: 'Generate a report',
    detail: 'Go to Reports in the sidebar. Generate the integrated report for a full cross-module executive output, or generate a standalone module report for a single-topic engagement. Both produce DOCX and PPTX.',
    done: (_: Props) => false, // never auto-complete — always available
    cta: 'Open Reports in the sidebar',
    icon: '📄',
  },
];

const MODULES = [
  { key: 'operational-audit', name: 'Operational Audit', icon: '🔍', desc: 'How well the business is run. Process ownership, execution quality, KPI visibility.' },
  { key: 'revenue-leakage', name: 'Revenue Leakage', icon: '💰', desc: 'Where revenue is being lost. Conversion, pricing, billing, churn, and collections gaps.' },
  { key: 'data-foundation', name: 'Data Foundation', icon: '🗄️', desc: 'Whether data can be trusted. Source of truth, quality, KPI logic, reporting maturity.' },
  { key: 'ai-readiness', name: 'AI Readiness', icon: '🤖', desc: 'Whether the business is prepared to deploy AI responsibly and effectively.' },
  { key: 'ai-use-cases', name: 'AI Use Cases', icon: '⚡', desc: 'Which AI opportunities are viable now, which need preparation, and which should wait.' },
];

export function GettingStarted({ hasClient, hasAssessment, hasScoredModules, hasRoadmap, clientName }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    try {
      const d = localStorage.getItem('kinto_gs_dismissed');
      if (d === 'true') setDismissed(true);
    } catch { /* localStorage may not be available */ }
  }, []);

  function dismiss() {
    try { localStorage.setItem('kinto_gs_dismissed', 'true'); } catch {}
    setDismissed(true);
  }

  // Auto-show if no client or no assessment
  const shouldShow = !dismissed || (!hasClient || !hasAssessment);
  if (!shouldShow) return null;

  const props = { hasClient, hasAssessment, hasScoredModules, hasRoadmap, clientName };
  const completedSteps = STEPS.filter(s => s.done(props)).length;
  const currentStep = STEPS.find(s => !s.done(props));
  const totalSteps = STEPS.length;

  if (dismissed && (hasClient && hasAssessment)) return null;

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderLeft: '3px solid #1ABCB0',
      borderRadius: 'var(--radius)',
      overflow: 'hidden',
      marginBottom: '0.25rem',
    }}>
      {/* Header */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.85rem 1rem', cursor: 'pointer',
          background: completedSteps > 0 ? 'linear-gradient(90deg, rgba(26,188,176,0.06) 0%, transparent 100%)' : 'var(--surface)',
        }}
        onClick={() => setExpanded(e => !e)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.1rem' }}>🚀</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)' }}>
              Getting started with Kinto
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '0.1rem' }}>
              {completedSteps === 0
                ? 'Follow these steps to run your first diagnostic engagement'
                : `${completedSteps} of ${totalSteps - 1} setup steps done${currentStep ? ` · Next: ${currentStep.title}` : ''}`}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Progress pills */}
          <div style={{ display: 'flex', gap: 4 }}>
            {STEPS.slice(0, 4).map((s, i) => (
              <div key={s.id} style={{
                width: 8, height: 8, borderRadius: '50%',
                background: s.done(props) ? '#1ABCB0' : i === completedSteps ? 'var(--line-2)' : 'var(--surface-3)',
                border: i === completedSteps && !s.done(props) ? '2px solid #1ABCB0' : 'none',
                transition: 'all 0.3s',
              }} />
            ))}
          </div>
          <button
            onClick={e => { e.stopPropagation(); dismiss(); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--muted)', padding: '0.2rem 0.4rem' }}
            title="Dismiss this guide"
          >
            ✕
          </button>
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Steps */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--line)' }}>
          {/* Step list */}
          <div style={{ padding: '0.75rem 1rem', display: 'grid', gap: '0.5rem' }}>
            {STEPS.map((step, i) => {
              const done = step.done(props);
              const isCurrent = step === currentStep;
              const isPast = done;
              const isFuture = !done && !isCurrent;

              return (
                <div key={step.id} style={{
                  display: 'grid',
                  gridTemplateColumns: '2rem 1fr',
                  gap: '0.6rem',
                  padding: '0.6rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  background: isCurrent ? 'rgba(26,188,176,0.06)' : isPast ? 'var(--surface-2)' : 'transparent',
                  border: isCurrent ? '1px solid rgba(26,188,176,0.3)' : '1px solid transparent',
                  opacity: isFuture && !isCurrent ? 0.55 : 1,
                }}>
                  {/* Step number / check */}
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: done ? '0.9rem' : '0.75rem',
                    fontWeight: 700,
                    background: done ? '#1ABCB0' : isCurrent ? 'rgba(26,188,176,0.15)' : 'var(--surface-3)',
                    color: done ? 'white' : isCurrent ? '#1ABCB0' : 'var(--muted)',
                    border: isCurrent && !done ? '2px solid #1ABCB0' : 'none',
                  }}>
                    {done ? '✓' : step.number}
                  </div>

                  {/* Step content */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem', color: done ? 'var(--muted)' : 'var(--text)', textDecoration: done ? 'line-through' : 'none' }}>
                        {step.icon} {step.title}
                      </span>
                      {isCurrent && <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#1ABCB0', background: 'rgba(26,188,176,0.12)', padding: '0.1rem 0.4rem', borderRadius: 999 }}>← Do this now</span>}
                    </div>
                    {isCurrent && (
                      <p style={{ fontSize: '0.78rem', color: 'var(--muted)', margin: '0.2rem 0 0', lineHeight: 1.5 }}>
                        {step.detail}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Module guide */}
          {hasAssessment && !hasScoredModules && (
            <div style={{ borderTop: '1px solid var(--line)', padding: '0.75rem 1rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                The five modules — start with any one
              </div>
              <div style={{ display: 'grid', gap: '0.4rem' }}>
                {MODULES.map(m => (
                  <div key={m.key} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', padding: '0.4rem 0' }}>
                    <span style={{ fontSize: '1rem', flexShrink: 0, marginTop: '0.05rem' }}>{m.icon}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text)' }}>{m.name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '0.05rem' }}>{m.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '0.6rem', borderTop: '1px solid var(--line)', paddingTop: '0.5rem' }}>
                💡 <strong>Tip:</strong> You don&apos;t need to complete all five modules. One module is a complete engagement in its own right. Start with the area most relevant to your client.
              </p>
            </div>
          )}

          {/* Score scale explainer */}
          {hasAssessment && !hasScoredModules && (
            <div style={{ borderTop: '1px solid var(--line)', padding: '0.6rem 1rem', background: 'var(--surface-2)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', marginBottom: '0.3rem' }}>SCORING GUIDE</div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {[
                  { score: '1', label: 'Not in place', color: 'var(--danger)' },
                  { score: '2', label: 'Weak/partial', color: 'var(--warn)' },
                  { score: '3', label: 'Developing', color: '#D97706' },
                  { score: '4', label: 'Mostly working', color: '#059669' },
                  { score: '5', label: 'Fully controlled', color: 'var(--teal)' },
                ].map(s => (
                  <div key={s.score} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem' }}>
                    <span style={{ fontWeight: 800, color: s.color, minWidth: '0.8rem' }}>{s.score}</span>
                    <span style={{ color: 'var(--muted)' }}>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
