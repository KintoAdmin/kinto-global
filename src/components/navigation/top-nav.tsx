// @ts-nocheck
import { TopNavLinks } from '@/components/layout/top-nav-links';

type Props = {
  pathname?: string;
  clientId?: string | null;
  assessmentId?: string | null;
};

export function TopNav({ pathname = '/workspace', clientId, assessmentId }: Props) {
  return <TopNavLinks pathname={pathname} clientId={clientId} assessmentId={assessmentId} />;
}
