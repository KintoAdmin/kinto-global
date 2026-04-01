// @ts-nocheck
import Link from 'next/link';
import { buildRoute } from '@/lib/routes';

const groups = [
  {
    label: 'Workspace',
    links: [
      { href: '/workspace', label: 'Workspace' },
      { href: '/reports', label: 'Reports' }
    ]
  },
  {
    label: 'Diagnostics',
    links: [
      { href: '/diagnostics/operational-audit', label: 'Operational Audit' },
      { href: '/diagnostics/revenue-leakage', label: 'Revenue Leakage' },
      { href: '/diagnostics/data-foundation', label: 'Data Foundation' },
      { href: '/diagnostics/ai-readiness', label: 'AI Readiness' },
      { href: '/diagnostics/ai-use-cases', label: 'AI Use Cases' }
    ]
  },
  {
    label: 'Transformation',
    links: [
      { href: '/transformation/roadmap', label: 'Roadmap' },
      { href: '/transformation/progress', label: 'Progress' }
    ]
  }
];

type Props = {
  pathname: string;
  clientId?: string | null;
  assessmentId?: string | null;
};

export function TopNavLinks({ pathname, clientId, assessmentId }: Props) {
  return (
    <header className="top-nav">
      <div className="brand">
        <span className="brand-pill">Kinto</span>
        <span>Diagnostic Platform</span>
      </div>
      <nav className="nav-groups" aria-label="Primary">
        {groups.map((group) => (
          <div key={group.label} className="nav-group">
            <span className="nav-label">{group.label}</span>
            {group.links.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={buildRoute(link.href, { clientId, assessmentId })}
                  className={`nav-link${active ? ' active' : ''}`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </header>
  );
}
