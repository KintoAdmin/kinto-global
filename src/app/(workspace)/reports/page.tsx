// @ts-nocheck
export const dynamic = 'force-dynamic';
import { AppFrame } from '@/components/layout/app-frame';
import { resolvePageState } from '@/lib/page-state';
import { getWorkspaceSnapshot } from '@/lib/services/workspace';
import { listPersistedReports } from '@/lib/services/report';
import { buildIntegratedLayerReadiness } from '@/lib/services/integrated-layer';
import { ReportLibraryClient } from '@/components/reports/report-library-client';

type PageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

const MODULE_LABELS: Record<string, string> = {
  ops_audit: 'Operational Audit',
  revenue_leakage: 'Revenue Leakage',
  data_foundation: 'Data Foundation',
  ai_readiness: 'AI Readiness',
  ai_use_cases: 'AI Use Cases',
};

function fmt(v?: string | null) {
  if (!v) return '—';
  try { return new Date(v).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return String(v); }
}

export default async function ReportsPage({ searchParams }: PageProps) {
  const state = await resolvePageState(searchParams);
  const snapshot = await getWorkspaceSnapshot({ clientId: state.clientId, assessmentId: state.assessmentId });
  const aId = snapshot.assessment?.assessment_id;
  const cId = snapshot.client?.client_id;

  const allReports = aId ? await listPersistedReports(aId).catch(() => []) : [];
  const readiness = buildIntegratedLayerReadiness(snapshot.reports || []);

  const integratedReports = allReports.filter((r: any) => r.scope_type === 'integrated' || r.module_scope === 'FULL');
  const moduleReports = allReports.filter((r: any) => r.scope_type === 'module');

  const moduleOrder = ['ops_audit', 'revenue_leakage', 'data_foundation', 'ai_readiness', 'ai_use_cases'];

  return (
    <AppFrame pathname="/reports" clientId={cId} assessmentId={aId} clients={snapshot.clients} assessments={snapshot.assessments}>

      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">
            {snapshot.client?.client_name ?? 'No client'} · {snapshot.assessment?.assessment_name ?? 'No assessment'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className={`badge ${readiness.fullyReady ? 'badge-success' : 'badge-warn'}`}>
            {readiness.readyCount}/{readiness.totalCount} modules ready
          </span>
        </div>
      </div>

      {/* Report generation actions */}
      <ReportLibraryClient assessmentId={aId ?? null} />

      {/* Module report readiness */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">Module Report Status</h3>
            <p className="card-subtitle">DOCX and PPTX availability for each module</p>
          </div>
        </div>
        <div className="table-scroll">
          <table className="kinto-table">
            <thead>
              <tr>
                <th>Module</th>
                <th>Status</th>
                <th>Generated</th>
                <th>DOCX</th>
                <th>PPTX</th>
              </tr>
            </thead>
            <tbody>
              {moduleOrder.map(code => {
                const ms = readiness.moduleStatuses.find((s: any) => s.moduleCode === code);
                const rep = moduleReports.find((r: any) => r.module_code === code);
                const artifacts = rep?.artifacts || [];
                const docx = artifacts.find((a: any) => a.file_type === 'docx');
                const pptx = artifacts.find((a: any) => a.file_type === 'pptx');
                return (
                  <tr key={code}>
                    <td style={{ fontWeight: 600 }}>{MODULE_LABELS[code] ?? code}</td>
                    <td>
                      <span className={`badge ${ms?.ready ? 'badge-success' : 'badge-muted'}`}>
                        {ms?.ready ? '✓ Ready' : rep ? 'Generating' : 'Not generated'}
                      </span>
                    </td>
                    <td className="text-xs muted-2">{fmt(rep?.generated_at)}</td>
                    <td>
                      {docx
                        ? <a href={`/api/reports/artifacts/${encodeURIComponent(docx.artifact_id)}`} className="btn btn-sm btn-secondary" download>↓ DOCX</a>
                        : <span className="text-xs muted-2">—</span>}
                    </td>
                    <td>
                      {pptx
                        ? <a href={`/api/reports/artifacts/${encodeURIComponent(pptx.artifact_id)}`} className="btn btn-sm btn-secondary" download>↓ PPTX</a>
                        : <span className="text-xs muted-2">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Integrated reports */}
      {integratedReports.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Integrated Reports</h3>
              <p className="card-subtitle">Full cross-module executive reports</p>
            </div>
          </div>
          <div className="report-library">
            {integratedReports.map((r: any) => {
              const docx = (r.artifacts || []).find((a: any) => a.file_type === 'docx');
              const pptx = (r.artifacts || []).find((a: any) => a.file_type === 'pptx');
              return (
                <div key={r.report_instance_id} className="report-row">
                  <div className="report-row-info">
                    <div className="report-row-title">{r.report_title || 'Executive Diagnostic Report'}</div>
                    <div className="report-row-meta">Generated {fmt(r.generated_at)} · {r.report_status === 'ready' ? 'Ready' : r.report_status}</div>
                  </div>
                  <div className="report-row-actions">
                    {docx && <a href={`/api/reports/artifacts/${encodeURIComponent(docx.artifact_id)}`} className="btn btn-primary btn-sm" download>↓ DOCX</a>}
                    {pptx && <a href={`/api/reports/artifacts/${encodeURIComponent(pptx.artifact_id)}`} className="btn btn-secondary btn-sm" download>↓ PPTX</a>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {allReports.length === 0 && (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📄</div>
            <p className="empty-state-title">No reports generated yet</p>
            <p className="empty-state-sub">Use the workspace bar to generate your first report, or generate individual module reports above.</p>
          </div>
        </div>
      )}
    </AppFrame>
  );
}
