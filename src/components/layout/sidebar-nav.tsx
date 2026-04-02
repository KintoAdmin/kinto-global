// @ts-nocheck
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { buildRoute } from '@/lib/routes';

const NAV = [
  {
    section: 'Overview',
    links: [
      { href: '/workspace', label: 'Workspace',  icon: '⊞' },
      { href: '/reports',   label: 'Reports',    icon: '📄' },
      { href: '/profile',   label: 'Profile',    icon: '👤' },
    ],
  },
  {
    section: 'Readiness',
    links: [
      { href: '/readiness/business-readiness', label: 'Business Readiness', icon: '🚀' },
    ],
  },
  {
    section: 'Diagnostics',
    links: [
      { href: '/diagnostics/operational-audit', label: 'Operational Audit', icon: '🔍' },
      { href: '/diagnostics/revenue-leakage',   label: 'Revenue Leakage',   icon: '💰' },
      { href: '/diagnostics/data-foundation',   label: 'Data Foundation',   icon: '🗄️' },
      { href: '/diagnostics/ai-readiness',      label: 'AI Readiness',      icon: '🤖' },
      { href: '/diagnostics/ai-use-cases',      label: 'AI Use Cases',      icon: '⚡' },
    ],
  },
  {
    section: 'Transformation',
    links: [
      { href: '/transformation/roadmap', label: 'Roadmap', icon: '🗺️' },
    ],
  },
];

type Props = { clientId?: string | null; assessmentId?: string | null };


function SignOutButton() {
  async function handleSignOut() {
    const { createClient } = await import('@/lib/supabase/client');
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  }
  return (
    <button
      onClick={handleSignOut}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.4rem',
        background: 'none', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 6, padding: '0.35rem 0.65rem',
        color: 'var(--sidebar-muted)', cursor: 'pointer',
        fontSize: '0.72rem', marginTop: '0.5rem', width: '100%',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'white'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = ''; }}
    >
      <span>↪</span> Sign out
    </button>
  );
}

export function SidebarNav({ clientId, assessmentId }: Props) {
  const pathname = usePathname() ?? '';
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-mark">
          <div className="sidebar-logo-icon">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <circle cx="11" cy="11" r="9" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 1" opacity="0.6"/>
              <circle cx="7"  cy="8"  r="2" fill="white"/>
              <circle cx="15" cy="8"  r="2" fill="white" opacity="0.8"/>
              <circle cx="11" cy="15" r="2" fill="white" opacity="0.7"/>
              <line x1="7" y1="8" x2="15" y2="8" stroke="white" strokeWidth="1" opacity="0.5"/>
              <line x1="7" y1="8" x2="11" y2="15" stroke="white" strokeWidth="1" opacity="0.5"/>
              <line x1="15" y1="8" x2="11" y2="15" stroke="white" strokeWidth="1" opacity="0.5"/>
            </svg>
          </div>
          <div className="sidebar-logo-text">
            <span className="sidebar-logo-name">Kinto</span>
            <span className="sidebar-logo-sub">Global Platform</span>
          </div>
        </div>
      </div>
      <nav className="sidebar-nav" aria-label="Main navigation">
        {NAV.map((group) => (
          <div key={group.section} className="sidebar-section">
            <div className="sidebar-section-label">{group.section}</div>
            {group.links.map((link) => {
              const active = pathname === link.href || pathname.startsWith(link.href + '/') || pathname.startsWith(link.href + '?');
              const href = buildRoute(link.href, { clientId: clientId ?? null, assessmentId: assessmentId ?? null });
              return (
                <Link key={link.href} href={href} className={`sidebar-link${active ? ' active' : ''}`}>
                  <span style={{ fontSize: '0.9rem', lineHeight: 1 }}>{link.icon}</span>
                  {link.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="sidebar-footer-text">Visionary Minds<br />Ingenious Designs</div>
        <SignOutButton />
      </div>
    </aside>
  );
}
