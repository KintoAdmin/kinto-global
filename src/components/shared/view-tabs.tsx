// @ts-nocheck
import { LinkTabs, type LinkTab } from '@/components/shared/link-tabs';

type Props = {
  tabs: LinkTab[];
  activeView?: string;
  defaultView?: string;
  pathname?: string;
  clientId?: string | null;
  assessmentId?: string | null;
};

export function ViewTabs({
  tabs,
  activeView = 'overview',
  defaultView = 'overview',
  pathname = '/workspace',
  clientId,
  assessmentId
}: Props) {
  return (
    <LinkTabs
      pathname={pathname}
      tabs={tabs}
      activeView={activeView}
      defaultView={defaultView}
      clientId={clientId}
      assessmentId={assessmentId}
    />
  );
}
