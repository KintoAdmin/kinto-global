// @ts-nocheck
'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Mode = 'signin' | 'signup' | 'forgot';

export function LoginForm() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(''); setSuccess('');

    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = '/workspace';

      } else if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            data: { full_name: name },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        setSuccess('Check your email — we sent you a confirmation link.');

      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback`,
        });
        if (error) throw error;
        setSuccess('Check your email — we sent you a password reset link.');
      }
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.65rem 0.85rem',
    border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)',
    fontSize: '0.9rem', background: 'var(--surface)',
    color: 'var(--text)', fontFamily: 'inherit', outline: 'none',
    boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '0.78rem', fontWeight: 600,
    color: 'var(--text-2)', marginBottom: '0.35rem',
  };

  if (success) {
    return (
      <div style={{ textAlign: 'center', padding: '1rem 0' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📬</div>
        <p style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '0.5rem' }}>Email sent</p>
        <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '1.25rem' }}>{success}</p>
        <button onClick={() => { setSuccess(''); setMode('signin'); }}
          style={{ fontSize: '0.82rem', color: 'var(--teal)', background: 'none', border: 'none', cursor: 'pointer' }}>
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {mode === 'signup' && (
        <label>
          <span style={labelStyle}>Your name</span>
          <input style={inputStyle} type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="Jane Smith" required autoComplete="name" />
        </label>
      )}

      <label>
        <span style={labelStyle}>Email address</span>
        <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="you@company.com" required autoComplete="email" />
      </label>

      {mode !== 'forgot' && (
        <label>
          <span style={labelStyle}>Password</span>
          <input style={inputStyle} type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder={mode === 'signup' ? 'Choose a password (8+ characters)' : 'Your password'}
            required minLength={mode === 'signup' ? 8 : 1}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
        </label>
      )}

      {error && (
        <div style={{
          background: 'var(--danger-bg)', border: '1px solid var(--danger-border)',
          borderRadius: 'var(--radius-sm)', padding: '0.6rem 0.85rem',
          fontSize: '0.82rem', color: 'var(--danger)',
        }}>{error}</div>
      )}

      <button type="submit" disabled={busy} style={{
        background: busy ? 'var(--surface-3)' : 'linear-gradient(135deg, #1ABCB0, #00C2E0)',
        color: busy ? 'var(--muted)' : '#fff',
        border: 'none', borderRadius: 'var(--radius-sm)',
        padding: '0.75rem 1rem', fontSize: '0.9rem', fontWeight: 700,
        cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit',
        transition: 'all 0.15s',
      }}>
        {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
      </button>

      {/* Mode switcher */}
      <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--muted)', display: 'flex', justifyContent: 'center', gap: '1rem' }}>
        {mode === 'signin' && (
          <>
            <button type="button" onClick={() => { setMode('signup'); setError(''); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--teal)', fontSize: '0.8rem' }}>
              Create account
            </button>
            <span>·</span>
            <button type="button" onClick={() => { setMode('forgot'); setError(''); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '0.8rem' }}>
              Forgot password?
            </button>
          </>
        )}
        {mode !== 'signin' && (
          <button type="button" onClick={() => { setMode('signin'); setError(''); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--teal)', fontSize: '0.8rem' }}>
            Back to sign in
          </button>
        )}
      </div>
    </form>
  );
}
