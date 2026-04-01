// @ts-nocheck
import { MODULE_LABELS, type ModuleCode } from '@/lib/interoperability/enums';

const MODULE_ORDER: ModuleCode[] = [
  'ops_audit',
  'revenue_leakage',
  'data_foundation',
  'ai_readiness',
  'ai_use_cases'
];

function artifactByType(report: any, fileType: string) {
  return (report?.artifacts || []).find((artifact: any) => artifact.file_type === fileType);
}

export function buildIntegratedLayerReadiness(reports: any[] = []) {
  const moduleReports = reports.filter((row: any) => row.scope_type === 'module');
  const moduleStatuses = MODULE_ORDER.map((moduleCode) => {
    const report = moduleReports.find((row: any) => row.module_code === moduleCode);
    const docx = artifactByType(report, 'docx');
    const pptx = artifactByType(report, 'pptx');
    const ready = Boolean(report && report.report_status === 'ready' && docx && pptx);
    return {
      moduleCode,
      label: MODULE_LABELS[moduleCode],
      ready,
      reportStatus: report?.report_status || 'not_generated',
      generatedAt: report?.generated_at || null,
      hasDocx: Boolean(docx),
      hasPptx: Boolean(pptx),
      report,
    };
  });

  const readyCount = moduleStatuses.filter((row) => row.ready).length;
  const missing = moduleStatuses.filter((row) => !row.ready);
  const integrated = reports.find((row: any) => row.scope_type === 'integrated' || row.module_scope === 'FULL') || null;

  return {
    readyCount,
    totalCount: moduleStatuses.length,
    fullyReady: missing.length === 0,
    missingModules: missing,
    moduleStatuses,
    integrated,
  };
}
