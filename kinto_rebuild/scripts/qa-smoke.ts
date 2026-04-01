import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

type Result = {
  name: string;
  ok: boolean;
  status?: number;
  detail?: string;
  data?: unknown;
  durationMs?: number;
};

const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';
const OUT_DIR = join(process.cwd(), 'qa-artifacts');
mkdirSync(OUT_DIR, { recursive: true });

async function request(path: string, init?: RequestInit) {
  const res = await fetch(`${APP_BASE_URL}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  const data = json && typeof json === 'object' && 'data' in json ? json.data : json;
  return { res, text, json, data };
}

async function check(name: string, fn: () => Promise<Result>): Promise<Result> {
  const started = Date.now();
  try {
    const result = await fn();
    return { ...result, durationMs: Date.now() - started };
  } catch (error) {
    return {
      name,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - started,
    };
  }
}

function summarize(results: Result[]) {
  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  return { passed, failed, total: results.length };
}

function firstQuestionId(data: any): string {
  if (Array.isArray(data?.questions) && data.questions[0]?.question_id) return String(data.questions[0].question_id);
  if (Array.isArray(data?.bundle?.questions) && data.bundle.questions[0]?.question_id) return String(data.bundle.questions[0].question_id);
  if (data?.bundle?.question_map && typeof data.bundle.question_map === 'object') return String(Object.keys(data.bundle.question_map)[0] || '');
  if (data?.bundle?.questions && typeof data.bundle.questions === 'object') {
    const first = Object.values(data.bundle.questions)[0] as any;
    return String(first?.question_id || Object.keys(data.bundle.questions)[0] || '');
  }
  return '';
}

function findSavedResponse(data: any, questionId: string, expectedScore: number) {
  const rows = Array.isArray(data?.responses) ? data.responses : [];
  return rows.find((row: any) => String(row.question_id) === String(questionId) && Number(row.score_1_to_5 ?? row.score) === expectedScore);
}

function listCoreNames(data: any): string[] {
  const cores = data?.state?.cores;
  if (!cores || typeof cores !== 'object') return [];
  return Object.keys(cores);
}

async function main() {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const results: Result[] = [];

  const testClientName = `QA Client ${Date.now()}`;
  const testAssessmentName = `QA Assessment ${Date.now()}`;
  let clientId = '';
  let assessmentId = '';

  results.push(await check('health', async () => {
    const { res, json, data, text } = await request('/api/health');
    return {
      name: 'health',
      ok: res.ok,
      status: res.status,
      detail: res.ok ? 'Health route responded.' : text,
      data: data ?? json,
    };
  }));

  results.push(await check('clients:list-before', async () => {
    const { res, json, data, text } = await request('/api/clients');
    return {
      name: 'clients:list-before',
      ok: res.ok && Array.isArray(data),
      status: res.status,
      detail: res.ok ? `Returned ${Array.isArray(data) ? data.length : 0} clients.` : text,
      data: Array.isArray(data) ? { count: data.length } : json,
    };
  }));

  results.push(await check('clients:create', async () => {
    const { res, json, data, text } = await request('/api/clients', {
      method: 'POST',
      body: JSON.stringify({ clientName: testClientName }),
    });
    clientId = String(data?.client_id || '');
    return {
      name: 'clients:create',
      ok: res.ok && Boolean(clientId),
      status: res.status,
      detail: res.ok ? `Created client ${clientId}.` : text,
      data: json,
    };
  }));

  results.push(await check('assessments:create', async () => {
    const { res, json, data, text } = await request('/api/assessments', {
      method: 'POST',
      body: JSON.stringify({
        clientId,
        assessmentName: testAssessmentName,
        scopeType: 'enterprise',
        scopeLabel: 'Full business',
      }),
    });
    assessmentId = String(data?.assessment_id || '');
    return {
      name: 'assessments:create',
      ok: res.ok && Boolean(assessmentId),
      status: res.status,
      detail: res.ok ? `Created assessment ${assessmentId}.` : text,
      data: json,
    };
  }));

  results.push(await check('workspace:snapshot', async () => {
    const { res, json, data, text } = await request(`/api/workspace?clientId=${encodeURIComponent(clientId)}&assessmentId=${encodeURIComponent(assessmentId)}`);
    return {
      name: 'workspace:snapshot',
      ok: res.ok && data?.assessment?.assessment_id === assessmentId && data?.client?.client_id === clientId,
      status: res.status,
      detail: res.ok ? 'Workspace snapshot resolved active client and assessment.' : text,
      data: json,
    };
  }));

  results.push(await check('reference:OPS', async () => {
    const { res, json, data, text } = await request('/api/reference/OPS');
    return {
      name: 'reference:OPS',
      ok: res.ok && Boolean(data),
      status: res.status,
      detail: res.ok ? 'OPS reference route reachable.' : text,
      data: json,
    };
  }));

  const genericModules = [
    { name: 'data-foundation', label: 'Data Foundation', score: 4 },
    { name: 'ai-readiness', label: 'AI Readiness', score: 3 },
    { name: 'ai-use-cases', label: 'AI Use Cases', score: 5 },
  ] as const;

  for (const module of genericModules) {
    let questionId = '';
    results.push(await check(`module:${module.name}:get`, async () => {
      const { res, json, data, text } = await request(`/api/${module.name}?assessmentId=${encodeURIComponent(assessmentId)}`);
      questionId = firstQuestionId(data);
      return {
        name: `module:${module.name}:get`,
        ok: res.ok && Array.isArray(data?.questions) && Boolean(questionId),
        status: res.status,
        detail: res.ok ? `Loaded ${data?.questions?.length || 0} ${module.label} questions.` : text,
        data: { questionCount: Array.isArray(data?.questions) ? data.questions.length : 0, firstQuestionId: questionId },
      };
    }));

    results.push(await check(`module:${module.name}:save-score`, async () => {
      const { res, json, data, text } = await request(`/api/${module.name}`, {
        method: 'POST',
        body: JSON.stringify({ assessmentId, questionId, score: module.score }),
      });
      const verify = await request(`/api/${module.name}?assessmentId=${encodeURIComponent(assessmentId)}`);
      const saved = findSavedResponse(verify.data, questionId, module.score);
      return {
        name: `module:${module.name}:save-score`,
        ok: res.ok && data?.ok === true && Boolean(saved),
        status: res.status,
        detail: res.ok ? `${module.label} score save ${saved ? 'persisted' : 'did not persist'}.` : text,
        data: { saveResponse: json, verificationFound: Boolean(saved) },
      };
    }));
  }

  let opsPayload: any = null;
  let opsQuestionId = '';
  results.push(await check('module:operational-audit:load', async () => {
    const { res, data, text } = await request(`/api/operational-audit?assessmentId=${encodeURIComponent(assessmentId)}`);
    opsPayload = data;
    opsQuestionId = firstQuestionId(data);
    return {
      name: 'module:operational-audit:load',
      ok: res.ok && Boolean(data?.summary) && Boolean(opsQuestionId),
      status: res.status,
      detail: res.ok ? 'Loaded Operational Audit summary and questions.' : text,
      data: { questionCount: Array.isArray(data?.bundle?.questions) ? data.bundle.questions.length : 0, firstQuestionId: opsQuestionId },
    };
  }));

  results.push(await check('module:operational-audit:update-question', async () => {
    const { res, json, data, text } = await request('/api/operational-audit', {
      method: 'POST',
      body: JSON.stringify({ action: 'update-question', assessmentId, questionId: opsQuestionId, score: 4, notes: 'QA smoke test' }),
    });
    const saved = findSavedResponse(data, opsQuestionId, 4);
    return {
      name: 'module:operational-audit:update-question',
      ok: res.ok && Boolean(data?.summary) && Boolean(saved),
      status: res.status,
      detail: res.ok ? 'Operational Audit question update succeeded.' : text,
      data: { maturity: data?.summary?.overall_percentage || data?.summary?.overallMaturityPct, persisted: Boolean(saved) },
    };
  }));

  const firstMetricId = String(Object.keys(opsPayload?.bundle?.metric_map || {})[0] || '');
  results.push(await check('module:operational-audit:update-metric', async () => {
    const { res, data, text } = await request('/api/operational-audit', {
      method: 'POST',
      body: JSON.stringify({ action: 'update-metric', assessmentId, metricId: firstMetricId, currentValue: '75', targetValue: '90', notes: 'QA smoke metric' }),
    });
    const rows = Array.isArray(data?.metricCaptures) ? data.metricCaptures : [];
    const metric = rows.find((row: any) => String(row.metric_id) === firstMetricId);
    return {
      name: 'module:operational-audit:update-metric',
      ok: res.ok && Boolean(metric),
      status: res.status,
      detail: res.ok ? 'Operational Audit metric update succeeded.' : text,
      data: { metricId: firstMetricId, found: Boolean(metric), metricCount: rows.length },
    };
  }));

  let leakCoreName = '';
  let leakDriverName = '';
  let leakSupportKey = '';
  results.push(await check('module:revenue-leakage:load', async () => {
    const { res, data, text } = await request(`/api/revenue-leakage?assessmentId=${encodeURIComponent(assessmentId)}`);
    leakCoreName = listCoreNames(data)[0] || '';
    leakDriverName = String(Object.keys(data?.state?.cores?.[leakCoreName]?.drivers || {})[0] || '');
    leakSupportKey = String(Object.keys(data?.state?.cores?.[leakCoreName]?.support || {})[0] || '');
    return {
      name: 'module:revenue-leakage:load',
      ok: res.ok && Boolean(leakCoreName),
      status: res.status,
      detail: res.ok ? 'Revenue Leakage payload loaded.' : text,
      data: { coreCount: listCoreNames(data).length, firstCoreName: leakCoreName },
    };
  }));

  results.push(await check('module:revenue-leakage:update-core', async () => {
    const { res, data, text } = await request('/api/revenue-leakage', {
      method: 'POST',
      body: JSON.stringify({ action: 'update-core', assessmentId, coreName: leakCoreName, field: 'actual', value: 80 }),
    });
    const current = Number(data?.state?.cores?.[leakCoreName]?.actual ?? NaN);
    return {
      name: 'module:revenue-leakage:update-core',
      ok: res.ok && current === 80,
      status: res.status,
      detail: res.ok ? 'Revenue Leakage core update succeeded.' : text,
      data: { coreName: leakCoreName, actual: current },
    };
  }));

  if (leakSupportKey) {
    results.push(await check('module:revenue-leakage:update-support', async () => {
      const { res, data, text } = await request('/api/revenue-leakage', {
        method: 'POST',
        body: JSON.stringify({ action: 'update-support', assessmentId, coreName: leakCoreName, supportKey: leakSupportKey, value: 12 }),
      });
      const current = Number(data?.state?.cores?.[leakCoreName]?.support?.[leakSupportKey] ?? NaN);
      return {
        name: 'module:revenue-leakage:update-support',
        ok: res.ok && current === 12,
        status: res.status,
        detail: res.ok ? 'Revenue Leakage support update succeeded.' : text,
        data: { coreName: leakCoreName, supportKey: leakSupportKey, value: current },
      };
    }));
  }

  if (leakDriverName) {
    results.push(await check('module:revenue-leakage:update-driver', async () => {
      const { res, data, text } = await request('/api/revenue-leakage', {
        method: 'POST',
        body: JSON.stringify({ action: 'update-driver', assessmentId, coreName: leakCoreName, driverName: leakDriverName, field: 'actual', value: 65 }),
      });
      const current = Number(data?.state?.cores?.[leakCoreName]?.drivers?.[leakDriverName]?.actual ?? NaN);
      return {
        name: 'module:revenue-leakage:update-driver',
        ok: res.ok && current === 65,
        status: res.status,
        detail: res.ok ? 'Revenue Leakage driver update succeeded.' : text,
        data: { coreName: leakCoreName, driverName: leakDriverName, actual: current },
      };
    }));
  }

  results.push(await check('publications:publish-all', async () => {
    const { res, json, data, text } = await request(`/api/assessments/${encodeURIComponent(assessmentId)}/publications`, { method: 'POST' });
    return {
      name: 'publications:publish-all',
      ok: res.ok && Array.isArray(data),
      status: res.status,
      detail: res.ok ? `Published ${Array.isArray(data) ? data.length : 0} module publications.` : text,
      data: json,
    };
  }));

  results.push(await check('publications:list', async () => {
    const { res, json, data, text } = await request(`/api/assessments/${encodeURIComponent(assessmentId)}/publications`);
    return {
      name: 'publications:list',
      ok: res.ok && Array.isArray(data) && data.length > 0,
      status: res.status,
      detail: res.ok ? `Publication list returned ${Array.isArray(data) ? data.length : 0} rows.` : text,
      data: json,
    };
  }));

  results.push(await check('report:full-generate', async () => {
    const { res, json, data, text } = await request(`/api/assessments/${encodeURIComponent(assessmentId)}/report`, { method: 'POST' });
    return {
      name: 'report:full-generate',
      ok: res.ok && Boolean(data?.markdown),
      status: res.status,
      detail: res.ok ? 'Full report route succeeded.' : text,
      data: json,
    };
  }));

  results.push(await check('reports:page', async () => {
    const { res, text } = await request(`/reports?clientId=${encodeURIComponent(clientId)}&assessmentId=${encodeURIComponent(assessmentId)}`, {
      headers: { accept: 'text/html' },
    });
    return {
      name: 'reports:page',
      ok: res.ok && text.includes('Reports'),
      status: res.status,
      detail: res.ok ? 'Reports page rendered HTML.' : text.slice(0, 300),
    };
  }));

  const summary = summarize(results);
  const payload = { appBaseUrl: APP_BASE_URL, runAt: new Date().toISOString(), summary, results };
  writeFileSync(join(OUT_DIR, `qa-smoke-${ts}.json`), JSON.stringify(payload, null, 2));
  writeFileSync(join(OUT_DIR, 'qa-smoke-latest.json'), JSON.stringify(payload, null, 2));

  console.log(`\nQA SMOKE SUMMARY: ${summary.passed}/${summary.total} passed, ${summary.failed} failed.\n`);
  for (const result of results) {
    console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.status ? ` [${result.status}]` : ''}`);
    if (result.detail) console.log(`      ${result.detail}`);
  }

  if (summary.failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
