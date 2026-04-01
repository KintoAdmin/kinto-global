'use client';
/**
 * Kinto Global — Assistant Panel (client component)
 * 
 * Modes:
 *   support    — customer support / feature questions
 *   explainer  — explain what I'm looking at
 *   guidance   — what should I do next
 *   report     — help draft/improve written outputs
 *   monitoring — platform health triage
 * 
 * Renders as a slide-in panel anchored to the bottom-right.
 * Does not take any platform actions. Explains only.
 */

import { useState, useRef, useEffect, useCallback } from 'react';

type Mode = 'support' | 'explainer' | 'guidance' | 'report' | 'monitoring';
type Message = { role: 'user' | 'assistant'; content: string; id: string };

const MODES: { key: Mode; label: string; icon: string; description: string }[] = [
  { key: 'support',    label: 'Help',         icon: '💬', description: 'Platform questions & feature help' },
  { key: 'explainer',  label: 'Explain',       icon: '🔍', description: 'Explain this score or finding' },
  { key: 'guidance',   label: 'What next',     icon: '🧭', description: 'Prioritised next steps' },
  { key: 'report',     label: 'Write',         icon: '✍️', description: 'Draft summaries & narratives' },
  { key: 'monitoring', label: 'Health check',  icon: '📊', description: 'Spot patterns & issues' },
];

const STARTER_PROMPTS: Record<Mode, string[]> = {
  support: [
    'What does the Operational Audit module cover?',
    'How is the module score calculated?',
    'What is the difference between diagnostic score and implementation progress?',
    'How do I generate a report?',
  ],
  explainer: [
    'Explain the current assessment scores',
    'Why are some AI use cases blocked?',
    'What do the maturity bands mean?',
    'Explain the cross-cutting themes',
  ],
  guidance: [
    'What should we do first?',
    'Give me the priority sequence for this engagement',
    'What must happen before we can pilot AI use cases?',
    'Which module needs the most urgent attention?',
  ],
  report: [
    'Draft an executive summary for this assessment',
    'Write a sponsor-friendly opening for the report',
    'Summarise the top 3 findings in plain language',
    'Reframe the roadmap section for a board audience',
  ],
  monitoring: [
    'Are there any patterns I should be concerned about?',
    'Which modules look stuck or incomplete?',
    'Summarise the overall engagement health',
    'Flag anything that looks inconsistent',
  ],
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function AssistantMessage({ content }: { content: string }) {
  // Simple markdown-lite: bold, bullets
  const lines = content.split('\n');
  return (
    <div style={{ fontSize: '0.875rem', lineHeight: 1.65, color: 'var(--text)' }}>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <br key={i} />;
        if (trimmed.startsWith('## ')) return <div key={i} style={{ fontWeight: 700, fontSize: '0.95rem', marginTop: '0.75rem', marginBottom: '0.2rem', color: 'var(--text)' }}>{trimmed.slice(3)}</div>;
        if (trimmed.startsWith('### ')) return <div key={i} style={{ fontWeight: 600, marginTop: '0.5rem', marginBottom: '0.1rem' }}>{trimmed.slice(4)}</div>;
        if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
          const text = trimmed.slice(2);
          // Inline bold
          const parts = text.split(/\*\*(.*?)\*\*/);
          return (
            <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.15rem' }}>
              <span style={{ color: 'var(--teal)', flexShrink: 0, marginTop: '0.05rem' }}>▸</span>
              <span>{parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p)}</span>
            </div>
          );
        }
        if (/^\d+\.\s/.test(trimmed)) {
          const match = trimmed.match(/^(\d+)\.\s(.*)$/);
          const parts = (match?.[2] || '').split(/\*\*(.*?)\*\*/);
          return (
            <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.15rem' }}>
              <span style={{ color: 'var(--teal)', flexShrink: 0, fontWeight: 700, minWidth: '1.2rem' }}>{match?.[1]}.</span>
              <span>{parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p)}</span>
            </div>
          );
        }
        // Normal paragraph with inline bold
        const parts = trimmed.split(/\*\*(.*?)\*\*/);
        return <p key={i} style={{ margin: '0 0 0.35rem' }}>{parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p)}</p>;
      })}
    </div>
  );
}

interface Props {
  assessmentId?: string | null;
  clientId?: string | null;
}

export function KintoAssistant({ assessmentId, clientId }: Props) {
  const [open, setOpen]           = useState(false);
  const [mode, setMode]           = useState<Mode>('support');
  const [messages, setMessages]   = useState<Message[]>([]);
  const [input, setInput]         = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError]         = useState('');
  const messagesEndRef             = useRef<HTMLDivElement>(null);
  const inputRef                   = useRef<HTMLTextAreaElement>(null);
  const abortRef                   = useRef<AbortController | null>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  // Listen for inline "explain this" events from ExplainButton
  useEffect(() => {
    function handleExplain(e: CustomEvent) {
      const { context, mode: reqMode } = e.detail;
      setOpen(true);
      if (reqMode) handleModeChange(reqMode as Mode);
      setTimeout(() => sendMessage(context), 300);
    }
    window.addEventListener('kinto:explain', handleExplain as EventListener);
    return () => window.removeEventListener('kinto:explain', handleExplain as EventListener);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Welcome message when mode changes
  const welcomeMessages: Record<Mode, string> = {
    support:    "Hi — I'm the Kinto assistant. Ask me anything about the platform, how to use it, or what a result means.",
    explainer:  "I can explain what you're looking at right now — scores, findings, bands, dependencies. What would you like me to walk through?",
    guidance:   "I'll give you a clear priority sequence based on your current assessment data. What would you like to focus on?",
    report:     "I can help draft executive summaries, sponsor briefings, and narrative sections. What do you need written?",
    monitoring: "I can help spot patterns and flag anything that looks inconsistent in your engagement. What should I look at?",
  };

  function handleModeChange(newMode: Mode) {
    setMode(newMode);
    setMessages([{ role: 'assistant', content: welcomeMessages[newMode], id: uid() }]);
    setError('');
    setInput('');
  }

  const sendMessage = useCallback(async (text: string) => {
    const userText = text.trim();
    if (!userText || streaming) return;

    setError('');
    const userMsg: Message = { role: 'user', content: userText, id: uid() };
    const assistantMsg: Message = { role: 'assistant', content: '', id: uid() };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setInput('');
    setStreaming(true);

    abortRef.current = new AbortController();

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          message: userText,
          mode,
          assessmentId,
          clientId,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Request failed (${res.status})`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;
        setMessages(prev => prev.map(m =>
          m.id === assistantMsg.id ? { ...m, content: accumulated } : m
        ));
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      const errMsg = err?.message || 'Something went wrong. Please try again.';
      setError(errMsg);
      setMessages(prev => prev.filter(m => m.id !== assistantMsg.id));
    } finally {
      setStreaming(false);
    }
  }, [mode, assessmentId, clientId, messages, streaming]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  const currentMode = MODES.find(m => m.key === mode)!;

  return (
    <>
      {/* ── Floating trigger button ── */}
      <button
        onClick={() => { setOpen(o => !o); if (!open && !messages.length) handleModeChange(mode); }}
        aria-label="Open Kinto AI"
        style={{
          position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 900,
          width: 52, height: 52, borderRadius: '50%',
          background: 'linear-gradient(135deg, #1ABCB0, #00C2E0)',
          border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
          justifyContent: 'center', boxShadow: '0 4px 20px rgba(26,188,176,0.45)',
          transition: 'transform 0.2s, box-shadow 0.2s',
          transform: open ? 'rotate(45deg) scale(0.92)' : 'scale(1)',
        }}
      >
        <span style={{ fontSize: open ? '1.4rem' : '1.3rem', lineHeight: 1, color: '#fff', fontWeight: 700 }}>
          {open ? '✕' : 'K'}
        </span>
      </button>

      {/* ── Assistant panel ── */}
      {open && (
        <div style={{
          position: 'fixed', bottom: '5rem', right: '1.5rem', zIndex: 900,
          width: 400, maxWidth: 'calc(100vw - 3rem)',
          height: 580, maxHeight: 'calc(100vh - 7rem)',
          background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--line)', display: 'flex', flexDirection: 'column',
          boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
          animation: 'assistantIn 0.18s ease-out',
        }}>

          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, #0F1923 0%, #1A2535 100%)',
            borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
            padding: '0.85rem 1rem 0.75rem',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.65rem' }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'linear-gradient(135deg, #1ABCB0, #00C2E0)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 800, color: '#fff',
              }}>K</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#fff' }}>Kinto Assistant</div>
                <div style={{ fontSize: '0.65rem', color: '#8899AA' }}>
                  {currentMode.icon} {currentMode.description}
                </div>
              </div>
              {streaming && (
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 3 }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{
                      width: 5, height: 5, borderRadius: '50%',
                      background: '#1ABCB0',
                      animation: `bounce 1.2s ${i * 0.2}s infinite ease-in-out`,
                    }}/>
                  ))}
                </div>
              )}
            </div>

            {/* Mode tabs */}
            <div style={{ display: 'flex', gap: '0.3rem', overflowX: 'auto' }}>
              {MODES.map(m => (
                <button key={m.key}
                  onClick={() => handleModeChange(m.key)}
                  style={{
                    border: 'none', cursor: 'pointer', borderRadius: 6,
                    padding: '0.25rem 0.55rem',
                    fontSize: '0.68rem', fontWeight: 600,
                    whiteSpace: 'nowrap',
                    background: mode === m.key ? 'rgba(26,188,176,0.25)' : 'rgba(255,255,255,0.07)',
                    color: mode === m.key ? '#1ABCB0' : '#8899AA',
                    transition: 'all 0.15s',
                  }}
                >
                  {m.icon} {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '0.85rem 1rem',
            display: 'flex', flexDirection: 'column', gap: '0.75rem',
          }}>
            {messages.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
                <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>
                  {welcomeMessages[mode]}
                </p>
                {STARTER_PROMPTS[mode].map((prompt, i) => (
                  <button key={i} onClick={() => sendMessage(prompt)}
                    style={{
                      border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)',
                      padding: '0.5rem 0.75rem', background: 'var(--surface-2)',
                      cursor: 'pointer', textAlign: 'left', fontSize: '0.8rem',
                      color: 'var(--text-2)', transition: 'all 0.15s',
                    }}
                  >{prompt}</button>
                ))}
              </div>
            )}

            {messages.map(msg => (
              <div key={msg.id} style={{
                display: 'flex', flexDirection: 'column',
                alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}>
                <div style={{
                  maxWidth: '90%',
                  padding: '0.6rem 0.85rem',
                  borderRadius: msg.role === 'user'
                    ? 'var(--radius-sm) var(--radius-sm) 4px var(--radius-sm)'
                    : 'var(--radius-sm) var(--radius-sm) var(--radius-sm) 4px',
                  background: msg.role === 'user' ? 'linear-gradient(135deg, #1ABCB0, #00C2E0)' : 'var(--surface-2)',
                  border: msg.role === 'user' ? 'none' : '1px solid var(--line)',
                }}>
                  {msg.role === 'user'
                    ? <span style={{ fontSize: '0.875rem', color: '#fff' }}>{msg.content}</span>
                    : msg.content
                      ? <AssistantMessage content={msg.content} />
                      : <span style={{ fontSize: '0.8rem', color: 'var(--muted)', fontStyle: 'italic' }}>Thinking…</span>
                  }
                </div>
              </div>
            ))}

            {error && (
              <div style={{
                background: 'var(--danger-bg)', border: '1px solid var(--danger-border)',
                borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.75rem',
                fontSize: '0.8rem', color: 'var(--danger)',
              }}>
                ⚠ {error}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{
            borderTop: '1px solid var(--line)', padding: '0.75rem',
            flexShrink: 0, display: 'flex', gap: '0.5rem', alignItems: 'flex-end',
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Ask about ${currentMode.label.toLowerCase()}…`}
              disabled={streaming}
              rows={1}
              style={{
                flex: 1, resize: 'none', border: '1px solid var(--line)',
                borderRadius: 'var(--radius-sm)', padding: '0.55rem 0.75rem',
                fontSize: '0.875rem', fontFamily: 'inherit',
                background: 'var(--surface)', color: 'var(--text)',
                outline: 'none', lineHeight: 1.5, maxHeight: '5rem', overflowY: 'auto',
                opacity: streaming ? 0.6 : 1,
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || streaming}
              style={{
                background: input.trim() && !streaming
                  ? 'linear-gradient(135deg, #1ABCB0, #00C2E0)'
                  : 'var(--surface-3)',
                border: 'none', borderRadius: 'var(--radius-sm)',
                padding: '0.55rem 0.85rem', cursor: input.trim() && !streaming ? 'pointer' : 'default',
                fontSize: '0.9rem', transition: 'all 0.15s', flexShrink: 0,
              }}
            >
              <span style={{ color: input.trim() && !streaming ? '#fff' : 'var(--muted)' }}>↑</span>
            </button>
          </div>

          {/* Boundary notice */}
          <div style={{
            borderTop: '1px solid var(--line-2)',
            padding: '0.35rem 0.85rem',
            fontSize: '0.62rem', color: 'var(--muted)',
            background: 'var(--surface-2)',
            borderRadius: '0 0 var(--radius-lg) var(--radius-lg)',
          }}>
            Kinto AI · Explains only · Never changes scores or data
          </div>
        </div>
      )}

      <style>{`
        @keyframes assistantIn {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40%            { transform: scale(1);   opacity: 1; }
        }
      `}</style>
    </>
  );
}
