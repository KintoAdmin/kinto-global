// @ts-nocheck
import { WorkspaceControls } from '@/components/layout/workspace-controls';

type ClientRow = {
  client_id: string;
  client_name: string;
};

type AssessmentRow = {
  assessment_id: string;
  assessment_name: string;
  client_id: string;
};

type Props = {
  pathname?: string;
  clients?: ClientRow[];
  assessments?: AssessmentRow[];
  selectedClientId?: string | null;
  selectedAssessmentId?: string | null;
};

export function WorkspaceBar({
  pathname = '/workspace',
  clients = [],
  assessments = [],
  selectedClientId,
  selectedAssessmentId
}: Props) {
  return (
    <WorkspaceControls
      pathname={pathname}
      clients={clients}
      assessments={assessments}
      selectedClientId={selectedClientId}
      selectedAssessmentId={selectedAssessmentId}
    />
  );
}
