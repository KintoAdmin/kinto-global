// @ts-nocheck
import { ReactNode, Suspense } from 'react';
import { KintoAssistant } from '@/components/assistant/kinto-assistant';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import { WorkspaceControls } from '@/components/layout/workspace-controls';
import { FirstLoginWizard } from '@/components/onboarding/first-login-wizard';

type Props = {
  pathname: string;
  clientId?: string | null;
  assessmentId?: string | null;
  clients: Array<{ client_id: string; client_name: string }>;
  assessments: Array<{ assessment_id: string; assessment_name: string; client_id: string }>;
  children: ReactNode;
};

export function AppFrame({ pathname, clientId, assessmentId, clients, assessments, children }: Props) {
  return (
    <div className="app-shell">
      <Suspense>
        <SidebarNav clientId={clientId} assessmentId={assessmentId} />
      </Suspense>
      <div className="main-content">
        <Suspense>
          <WorkspaceControls
            clients={clients}
            assessments={assessments}
            activeClientId={clientId ?? ''}
            activeAssessmentId={assessmentId ?? ''}
          />
        </Suspense>
        <main className="page-shell">
          {children}
        </main>
      </div>
      <FirstLoginWizard />
      {/* Global assistant — floats bottom-right, available on every page */}
      <KintoAssistant assessmentId={assessmentId} clientId={clientId} />
    </div>
  );
}
