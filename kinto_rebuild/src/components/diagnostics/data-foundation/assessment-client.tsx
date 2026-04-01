// @ts-nocheck
'use client';

import { GenericQuestionModuleClient } from '@/components/diagnostics/shared/generic-question-module-client';

type Props = {
  assessmentId?: string;
  view?: 'assessment' | 'executive' | 'metrics' | 'report';
};

export function DataFoundationAssessmentClient({ assessmentId, view = 'assessment' }: Props) {
  return (
    <GenericQuestionModuleClient
      routePath="/api/data-foundation"
      assessmentId={assessmentId}
      moduleCode="DATA"
      moduleLabel="Data Foundation"
      moduleIntro="This module is client-ready for assessment, executive dashboard, metrics, and persisted report delivery."
      moduleCountLine="The Data Foundation structure covers source systems, capture discipline, data quality, KPI logic, reporting maturity, governance, ownership, and decision visibility."
      metricsStructureLabel="Metrics, controls, and score structure"
      weakestDomainLabel="Priority data weaknesses"
      strongestDomainLabel="Most stable data domains"
      reportNarrative="Executive readout: the current assessment shows the strength of source capture, reporting control, KPI definition, governance discipline, and management visibility across the data foundation. Use the weakest domains and findings summary below to prioritise remediation before scaling automation or AI."
      view={view}
    />
  );
}
