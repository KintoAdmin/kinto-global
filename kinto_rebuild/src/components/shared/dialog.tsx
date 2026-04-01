'use client';
import { useState, useCallback } from 'react';

// ── Simple inline dialog/modal ────────────────────────────────────────────────
// Replaces window.prompt / window.confirm / window.alert

type DialogResult<T> = { value: T; cancelled: boolean };

export function useInputDialog() {
  const [state, setState] = useState<{
    open: boolean;
    title: string;
    message?: string;
    placeholder?: string;
    defaultValue?: string;
    resolve?: (r: DialogResult<string>) => void;
  }>({ open: false, title: '' });

  const prompt = useCallback((title: string, opts?: {
    message?: string; placeholder?: string; defaultValue?: string;
  }): Promise<DialogResult<string>> => {
    return new Promise(resolve => {
      setState({ open: true, title, ...opts, resolve });
    });
  }, []);

  const confirm_ = useCallback((title: string, opts?: { message?: string }): Promise<DialogResult<boolean>> => {
    return new Promise(resolve => {
      setState({
        open: true,
        title,
        message: opts?.message,
        placeholder: '__CONFIRM__',
        resolve: (r) => resolve({ value: !r.cancelled, cancelled: r.cancelled }),
      });
    });
  }, []);

  function close(value: string, cancelled = false) {
    setState(s => {
      s.resolve?.({ value, cancelled });
      return { open: false, title: '' };
    });
  }

  return { state, prompt, confirm: confirm_, close };
}

type DialogProps = {
  open: boolean;
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
};

export function Dialog({ open, title, message, placeholder, defaultValue, onConfirm, onCancel }: DialogProps) {
  const [val, setVal] = useState(defaultValue || '');
  const isConfirm = placeholder === '__CONFIRM__';

  if (!open) return null;

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); if (!isConfirm || val) onConfirm(val); }
    if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(15,25,35,0.55)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
      }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        style={{
          background: 'var(--surface)', border: '1px solid var(--line)',
          borderRadius: 'var(--radius)', padding: '1.5rem', width: '100%', maxWidth: 420,
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        }}
        onKeyDown={handleKey}
      >
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>{title}</h3>
        {message && <p style={{ fontSize: '0.875rem', color: 'var(--muted)', margin: '0 0 1rem' }}>{message}</p>}
        {!isConfirm && (
          <input
            autoFocus
            className="kinto-input"
            style={{ width: '100%', marginBottom: '1rem' }}
            value={val}
            onChange={e => setVal(e.target.value)}
            placeholder={placeholder}
          />
        )}
        {isConfirm && !message && (
          <div style={{ height: '0.5rem' }} />
        )}
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            autoFocus={isConfirm}
            onClick={() => onConfirm(isConfirm ? 'confirmed' : val)}
            disabled={!isConfirm && !val.trim()}
          >
            {isConfirm ? 'Confirm' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
