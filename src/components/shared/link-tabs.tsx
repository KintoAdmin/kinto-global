import Link from 'next/link';
import { buildRoute } from '@/lib/routes';

export type LinkTab = { key: string; label: string };

type Props = {
  pathname: string;
  tabs: LinkTab[];
  activeView: string;
  defaultView?: string;
  clientId?: string | null;
  assessmentId?: string | null;
};

export function LinkTabs({ pathname, tabs, activeView, defaultView = 'overview', clientId, assessmentId }: Props) {
  return (
    <>
      {tabs.map((tab) => {
        const active = activeView === tab.key;
        const href = buildRoute(pathname, { clientId: clientId ?? null, assessmentId: assessmentId ?? null, view: tab.key === defaultView ? null : tab.key });
        return (
          <Link key={tab.key} href={href} className={`view-tab${active ? ' active' : ''}`}>
            {tab.label}
          </Link>
        );
      })}
    </>
  );
}
