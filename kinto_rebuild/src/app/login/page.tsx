import { LoginForm } from './login-form';
import { getAuthUser } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  // Already logged in → go to workspace
  const user = await getAuthUser();
  if (user) redirect('/workspace');

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 420,
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        boxShadow: '0 8px 40px rgba(0,0,0,0.12)',
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #0F1923 0%, #1A2535 100%)',
          padding: '2rem 2rem 1.5rem',
          textAlign: 'center',
        }}>
          {/* Logo mark */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: 'linear-gradient(135deg, #1ABCB0, #00C2E0)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="26" height="26" viewBox="0 0 22 22" fill="none">
                <circle cx="11" cy="11" r="9" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 1" opacity="0.6"/>
                <circle cx="7" cy="8" r="2" fill="white"/>
                <circle cx="15" cy="8" r="2" fill="white" opacity="0.8"/>
                <circle cx="11" cy="15" r="2" fill="white" opacity="0.7"/>
                <line x1="7" y1="8" x2="15" y2="8" stroke="white" strokeWidth="1" opacity="0.5"/>
                <line x1="7" y1="8" x2="11" y2="15" stroke="white" strokeWidth="1" opacity="0.5"/>
                <line x1="15" y1="8" x2="11" y2="15" stroke="white" strokeWidth="1" opacity="0.5"/>
              </svg>
            </div>
          </div>
          <h1 style={{ color: '#fff', fontSize: '1.35rem', fontWeight: 800, margin: 0 }}>
            Kinto Global
          </h1>
          <p style={{ color: '#8899AA', fontSize: '0.82rem', margin: '0.35rem 0 0' }}>
            Business Diagnostic Platform
          </p>
        </div>

        {/* Form */}
        <div style={{ padding: '1.75rem 2rem 2rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem', textAlign: 'center', color: 'var(--text)' }}>
            Sign in to your account
          </h2>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
