// @ts-nocheck
import {
  APP_BASE_URL,
  LONG_TIMEOUT_MS,
  XL_TIMEOUT_MS,
  check,
  requestBinary,
  requestJson,
  summarize,
  waitForHealthyApp,
  writeArtifact,
} from './qa-v2-lib';

function firstQuestion(payload: any) {
  return payload?.bundle?.questions?.[0] || null;
}

function firstMetric(payload: any) {
  const metricMap = payload?.bundle?.metric_map || {};
  const firstKey = Object.keys(metricMap)[0] || '';
  return firstKey ? metricMap[firstKey] : null;
}

async function main() {
  const results: any[] = [];
  let clientId = '';
  let assessmentId = '';
  let opsPayload: any = null;

  results.push(await check('health', async () => {
    const health = await waitForHealthyApp();
    return { name: 'health', ok: Boolean(health.ok), status: health.status, detail: `App healthy at ${APP_BASE_URL}` };
  }));

  results.push(await check('clients:create', async () => {
    const created = await requestJson('/api/clients', {
      method: 'POST',
      body: { clientName: `QA Ops Full Pass ${Date.now()}` },
    });
    clientId = String(created.data?.client_id || '');
    return { name: 'clients:create', ok: created.res.ok && Boolean(clientId), status: created.res.status, detail: clientId ? `Created ${clientId}` : created.text };
  }));

  results.push(await check('assessments:create', async () => {
    const created = await requestJson('/api/assessments', {
      method: 'POST',
      body: {
        clientId,
        assessmentName: `QA Ops Assessment ${Date.now()}`,
        scopeType: 'enterprise',
        scopeLabel: 'Operational Audit Full Pass',
      },
    });
    assessmentId = String(created.data?.assessment_id || '');
    return { name: 'assessments:create', ok: created.res.ok && Boolean(assessmentId), status: created.res.status, detail: assessmentId ? `Created ${assessmentId}` : created.text };
  }));

  results.push(await check('operational-audit:load', async () => {
    const loaded = await requestJson(`/api/operational-audit?assessmentId=${encodeURIComponent(assessmentId)}`);
    opsPayload = loaded.data;
    const question = firstQuestion(opsPayload);
    return {
      name: 'operational-audit:load',
      ok: loaded.res.ok && Boolean(question?.question_id),
      status: loaded.res.status,
      detail: loaded.res.ok ? `Loaded ${opsPayload?.bundle?.questions?.length || 0} questions.` : loaded.text,
    };
  }));

  results.push(await check('operational-audit:bulk-score', async () => {
    const questions = Array.isArray(opsPayload?.bundle?.questions) ? opsPayload.bundle.questions : [];
    const updates = questions.slice(0, 12).map((question: any, index: number) => ({
      questionId: question.question_id,
      score: [2, 3, 4, 5][index % 4],
    }));
    const saved = await requestJson('/api/operational-audit', {
      method: 'POST',
      body: { action: 'bulk-score', assessmentId, updates },
      timeoutMs: LONG_TIMEOUT_MS,
    });
    const answered = Number(saved.data?.summary?.answered || 0);
    return {
      name: 'operational-audit:bulk-score',
      ok: saved.res.ok && answered >= updates.length,
      status: saved.res.status,
      detail: saved.res.ok ? `Answered now ${answered}.` : saved.text,
    };
  }));

  results.push(await check('operational-audit:update-question-notes', async () => {
    const question = firstQuestion(opsPayload);
    const saved = await requestJson('/api/operational-audit', {
      method: 'POST',
      body: {
        action: 'update-question',
        assessmentId,
        questionId: question.question_id,
        score: 2,
        notes: 'QA full-pass note',
        evidenceSummary: 'QA full-pass evidence summary',
      },
      timeoutMs: LONG_TIMEOUT_MS,
    });
    const persisted = Array.isArray(saved.data?.responses)
      ? saved.data.responses.find((row: any) => String(row.question_id) === String(question.question_id) && String(row.notes || '').includes('QA full-pass note'))
      : null;
    return {
      name: 'operational-audit:update-question-notes',
      ok: saved.res.ok && Boolean(persisted),
      status: saved.res.status,
      detail: saved.res.ok ? 'Question note persisted through shared fact save path.' : saved.text,
    };
  }));

  results.push(await check('operational-audit:update-metric', async () => {
    const metric = firstMetric(opsPayload);
    const saved = await requestJson('/api/operational-audit', {
      method: 'POST',
      body: {
        action: 'update-metric',
        assessmentId,
        metricId: metric.metric_id,
        workflowId: metric.workflow_id,
        currentValue: '68',
        targetValue: '85',
        baselineValue: '61',
        trendDirection: 'Up',
        ragStatus: 'Amber',
        notes: 'QA full-pass metric evidence',
      },
      timeoutMs: LONG_TIMEOUT_MS,
    });
    const rows = Array.isArray(saved.data?.metricCaptures) ? saved.data.metricCaptures : [];
    const persisted = rows.find((row: any) => String(row.metric_id) === String(metric.metric_id) && String(row.workflow_id || '') === String(metric.workflow_id || ''));
    return {
      name: 'operational-audit:update-metric',
      ok: saved.res.ok && Boolean(persisted),
      status: saved.res.status,
      detail: saved.res.ok ? 'Metric persisted through shared fact save path.' : saved.text,
    };
  }));

  results.push(await check('module-summary:OPS', async () => {
    const summary = await requestJson(`/api/assessments/${encodeURIComponent(assessmentId)}/modules/OPS/summary`, {
      timeoutMs: LONG_TIMEOUT_MS,
    });
    return {
      name: 'module-summary:OPS',
      ok: summary.res.ok && Array.isArray(summary.data?.roadmap) && Array.isArray(summary.data?.metrics),
      status: summary.res.status,
      detail: summary.res.ok ? `Summary exposes ${summary.data?.roadmap?.length || 0} roadmap rows and ${summary.data?.metrics?.length || 0} metrics.` : summary.text,
    };
  }));

  results.push(await check('workspace:snapshot', async () => {
    const workspace = await requestJson(`/api/workspace?clientId=${encodeURIComponent(clientId)}&assessmentId=${encodeURIComponent(assessmentId)}`, {
      timeoutMs: LONG_TIMEOUT_MS,
    });
    const moduleCard = Array.isArray(workspace.data?.modules)
      ? workspace.data.modules.find((row: any) => row.module_code === 'OPS')
      : null;
    return {
      name: 'workspace:snapshot',
      ok: workspace.res.ok && Boolean(moduleCard),
      status: workspace.res.status,
      detail: workspace.res.ok ? `Workspace score ${Math.round(Number(moduleCard?.score_pct || 0))}%.` : workspace.text,
    };
  }));

  results.push(await check('combined-roadmap:assessment-snapshot-fallback', async () => {
    const workspace = await requestJson(`/api/workspace?clientId=${encodeURIComponent(clientId)}&assessmentId=${encodeURIComponent(assessmentId)}`, {
      timeoutMs: LONG_TIMEOUT_MS,
    });
    const roadmapRows = Array.isArray(workspace.data?.assessmentSnapshot?.roadmap_payload) ? workspace.data.assessmentSnapshot.roadmap_payload : [];
    return {
      name: 'combined-roadmap:assessment-snapshot-fallback',
      ok: workspace.res.ok && roadmapRows.length > 0,
      status: workspace.res.status,
      detail: workspace.res.ok ? `Assessment snapshot carries ${roadmapRows.length} roadmap rows without requiring a separate ROADMAP recompute.` : workspace.text,
    };
  }));

  results.push(await check('report:OPS:generate', async () => {
    const report = await requestJson(`/api/assessments/${encodeURIComponent(assessmentId)}/report/OPS`, {
      method: 'POST',
      timeoutMs: XL_TIMEOUT_MS,
      retries: 1,
    });
    const artifacts = Array.isArray(report.data?.artifacts) ? report.data.artifacts : [];
    return {
      name: 'report:OPS:generate',
      ok: report.res.ok && artifacts.length > 0,
      status: report.res.status,
      detail: report.res.ok ? `Generated ${artifacts.length} artifact(s).` : report.text,
    };
  }));

  results.push(await check('report:OPS:download-docx', async () => {
    const report = await requestJson(`/api/assessments/${encodeURIComponent(assessmentId)}/report/OPS`, {
      timeoutMs: LONG_TIMEOUT_MS,
    });
    const artifacts = Array.isArray(report.data?.artifacts) ? report.data.artifacts : [];
    const docx = artifacts.find((artifact: any) => String(artifact.file_type).toLowerCase() === 'docx');
    if (!docx?.artifact_id) {
      return { name: 'report:OPS:download-docx', ok: false, detail: 'No DOCX artifact available to download.' };
    }
    const binary = await requestBinary(`/api/reports/artifacts/${encodeURIComponent(docx.artifact_id)}`, {
      timeoutMs: LONG_TIMEOUT_MS,
      retries: 1,
    });
    return {
      name: 'report:OPS:download-docx',
      ok: binary.res.ok && binary.buffer.length > 0,
      status: binary.res.status,
      detail: binary.res.ok ? `Downloaded ${binary.buffer.length} bytes.` : 'Artifact download failed.',
    };
  }));

  const summary = summarize(results);
  const payload = {
    generatedAt: new Date().toISOString(),
    appBaseUrl: APP_BASE_URL,
    assessmentId,
    clientId,
    summary,
    results,
  };

  writeArtifact('qa-operational-audit-full-pass-latest.json', payload);
  console.log(JSON.stringify(payload, null, 2));
  process.exit(summary.failed ? 1 : 0);
}

main().catch((error) => {
  const detail = error instanceof Error ? error.message : String(error);
  const payload = {
    generatedAt: new Date().toISOString(),
    appBaseUrl: APP_BASE_URL,
    fatal: true,
    detail,
  };
  writeArtifact('qa-operational-audit-full-pass-latest.json', payload);
  console.error(detail);
  process.exit(1);
});
