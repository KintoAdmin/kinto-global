// @ts-nocheck
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function loadDotEnvFile(fileName: string) {
  const filePath = join(process.cwd(), fileName);
  if (!existsSync(filePath)) return;
  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIndex = line.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = line.slice(0, eqIndex).trim();
    const value = line.slice(eqIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && typeof process.env[key] === 'undefined') process.env[key] = value;
  }
}

loadDotEnvFile('.env.local');
loadDotEnvFile('.env');

const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';
const OUT_DIR = join(process.cwd(), 'qa-artifacts');
mkdirSync(OUT_DIR, { recursive: true });

const DEFAULT_TIMEOUT_MS = Number(process.env.QA_REQUEST_TIMEOUT_MS || 15000);
const LONG_TIMEOUT_MS = Number(process.env.QA_LONG_TIMEOUT_MS || 45000);
const XL_TIMEOUT_MS = Number(process.env.QA_XL_TIMEOUT_MS || 120000);
const HEALTH_WAIT_MS = Number(process.env.QA_HEALTH_WAIT_MS || 120000);
const HEALTH_POLL_MS = Number(process.env.QA_HEALTH_POLL_MS || 2000);

const MODULES = [
  { code: 'OPS', api: '/api/operational-audit', page: '/diagnostics/operational-audit' },
  { code: 'LEAK', api: '/api/revenue-leakage', page: '/diagnostics/revenue-leakage' },
  { code: 'DATA', api: '/api/data-foundation', page: '/diagnostics/data-foundation' },
  { code: 'AIR', api: '/api/ai-readiness', page: '/diagnostics/ai-readiness' },
  { code: 'AIUC', api: '/api/ai-use-cases', page: '/diagnostics/ai-use-cases' },
] as const;

function now() { return new Date().toISOString(); }
function log(message: string) { console.log(`[${now()}] ${message}`); }
function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function safeJsonParse(text: string) { try { return text ? JSON.parse(text) : null; } catch { return null; } }
function buildUrl(path: string) { return `${APP_BASE_URL}${path}`; }
function stamp() { return new Date().toISOString().replace(/[:.]/g, '-'); }
function writeArtifact(name: string, payload: unknown) { writeFileSync(join(OUT_DIR, name), JSON.stringify(payload, null, 2)); }
function summarize(results: any[]) { const passed = results.filter((r) => r.ok).length; return { passed, failed: results.length - passed, total: results.length }; }

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function requestJson(path: string, options: {
  method?: string;
  body?: unknown;
  timeoutMs?: number;
  retries?: number;
  logLabel?: string;
  headers?: Record<string, string>;
} = {}) {
  const method = options.method || 'GET';
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = options.retries ?? 0;
  const logLabel = options.logLabel || `${method} ${path}`;
  let lastError: any = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const tag = `${logLabel}${attempt ? ` (retry ${attempt}/${retries})` : ''}`;
    const started = Date.now();
    log(`START ${tag}`);
    try {
      const headers: Record<string, string> = { ...(options.headers || {}) };
      let body: string | undefined;
      if (typeof options.body !== 'undefined') {
        headers['content-type'] = 'application/json';
        body = JSON.stringify(options.body);
      }
      const res = await fetchWithTimeout(buildUrl(path), { method, headers, body }, timeoutMs);
      const text = await res.text();
      const json = safeJsonParse(text);
      const data = json && typeof json === 'object' && 'data' in json ? json.data : json;
      log(`DONE  ${tag} -> ${res.status} in ${Date.now() - started}ms`);
      return { res, text, json, data, durationMs: Date.now() - started };
    } catch (error) {
      lastError = error;
      log(`FAIL  ${tag} -> ${error instanceof Error ? error.message : String(error)}`);
      if (attempt < retries) await sleep(Math.min(1000 * (attempt + 1), 3000));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function requestBinary(path: string, options: { timeoutMs?: number; retries?: number; logLabel?: string } = {}) {
  const timeoutMs = options.timeoutMs ?? LONG_TIMEOUT_MS;
  const retries = options.retries ?? 0;
  const logLabel = options.logLabel || `GET ${path}`;
  let lastError: any = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const tag = `${logLabel}${attempt ? ` (retry ${attempt}/${retries})` : ''}`;
    const started = Date.now();
    log(`START ${tag}`);
    try {
      const res = await fetchWithTimeout(buildUrl(path), {}, timeoutMs);
      const buffer = Buffer.from(await res.arrayBuffer());
      log(`DONE  ${tag} -> ${res.status} in ${Date.now() - started}ms`);
      return { res, buffer, durationMs: Date.now() - started };
    } catch (error) {
      lastError = error;
      log(`FAIL  ${tag} -> ${error instanceof Error ? error.message : String(error)}`);
      if (attempt < retries) await sleep(Math.min(1000 * (attempt + 1), 3000));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function requestHtml(path: string, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const started = Date.now();
  const res = await fetchWithTimeout(buildUrl(path), {}, timeoutMs);
  const text = await res.text();
  return { res, text, durationMs: Date.now() - started };
}

async function waitForHealthyApp(maxWaitMs = HEALTH_WAIT_MS) {
  log(`Waiting for app health at ${APP_BASE_URL}/api/health (max ${maxWaitMs}ms)`);
  const started = Date.now();
  let attempts = 0;
  let lastDetail = 'not started';
  while (Date.now() - started < maxWaitMs) {
    attempts += 1;
    try {
      const res = await fetchWithTimeout(buildUrl('/api/health'), {}, 5000);
      const text = await res.text();
      const json = safeJsonParse(text);
      if (res.ok && json?.ok) {
        log(`Health ready after ${Date.now() - started}ms (${attempts} attempts). Runtime mode: ${json?.runtimeMode || 'unknown'}`);
        return { ok: true, status: res.status, data: json, attempts, waitedMs: Date.now() - started };
      }
      lastDetail = `status=${res.status} body=${text.slice(0, 200)}`;
    } catch (error) {
      lastDetail = error instanceof Error ? error.message : String(error);
    }
    await sleep(HEALTH_POLL_MS);
  }
  throw new Error(`Health did not become ready within ${maxWaitMs}ms. Last detail: ${lastDetail}`);
}

async function check(name: string, fn: () => Promise<any>) {
  const started = Date.now();
  try {
    const result = await fn();
    const final = { name, durationMs: Date.now() - started, ...result };
    log(`${final.ok ? 'PASS' : 'FAIL'} ${name}${final.status ? ` [${final.status}]` : ''}${final.detail ? ` :: ${final.detail}` : ''}`);
    return final;
  } catch (error) {
    const final = { name, ok: false, durationMs: Date.now() - started, detail: error instanceof Error ? error.message : String(error) };
    log(`FAIL ${name} :: ${final.detail}`);
    return final;
  }
}

async function bootstrapAssessment() {
  const unique = Date.now();
  const clientPayload = {
    clientName: `QA Smoke ${unique}`,
    industry: 'Testing',
    businessModel: 'QA',
    revenueModel: 'Internal',
    companySize: 'QA',
    region: 'Local',
    notes: 'Temporary QA smoke client created by qa-full-system-no-seed.ts',
  };
  const clientReq = await requestJson('/api/clients', {
    method: 'POST',
    body: clientPayload,
    timeoutMs: LONG_TIMEOUT_MS,
    logLabel: 'bootstrap:create-client',
  });
  if (!clientReq.res.ok) throw new Error(`Create client failed: ${clientReq.text}`);
  const client = clientReq.data;
  const assessmentPayload = {
    clientId: client.client_id,
    assessmentName: `QA Smoke Assessment ${unique}`,
    assessmentDate: new Date().toISOString().slice(0, 10),
    version: 'qa-v1',
    assessmentVersion: 'qa-v1',
    reportingPeriodLabel: 'QA Smoke',
    scopeType: 'enterprise',
    scopeLabel: 'Full business',
  };
  const assessmentReq = await requestJson('/api/assessments', {
    method: 'POST',
    body: assessmentPayload,
    timeoutMs: LONG_TIMEOUT_MS,
    logLabel: 'bootstrap:create-assessment',
  });
  if (!assessmentReq.res.ok) throw new Error(`Create assessment failed: ${assessmentReq.text}`);
  return { client: clientReq.data, assessment: assessmentReq.data };
}

function firstObjectValue(obj: any) {
  if (!obj || typeof obj !== 'object') return null;
  const firstKey = Object.keys(obj)[0];
  return firstKey ? obj[firstKey] : null;
}

async function testOperationalAudit(assessmentId: string) {
  const getReq = await requestJson(`/api/operational-audit?assessmentId=${encodeURIComponent(assessmentId)}`, {
    timeoutMs: XL_TIMEOUT_MS,
    logLabel: 'ops:get',
  });
  if (!getReq.res.ok) throw new Error(`Operational Audit GET failed: ${getReq.text}`);
  const payload = getReq.data;
  const questions = payload?.bundle?.questions || [];
  const question = questions[0];
  if (!question?.question_id) throw new Error('Operational Audit payload missing questions.');
  const postQuestion = await requestJson('/api/operational-audit', {
    method: 'POST',
    timeoutMs: XL_TIMEOUT_MS,
    logLabel: 'ops:update-question',
    body: { action: 'update-question', assessmentId, questionId: question.question_id, score: 3, notes: 'QA smoke update', evidenceSummary: 'Smoke evidence' },
  });
  if (!postQuestion.res.ok) throw new Error(`Operational Audit update-question failed: ${postQuestion.text}`);

  const metricMap = payload?.bundle?.metric_map || {};
  const firstMetric = firstObjectValue(metricMap);
  if (!firstMetric?.metric_id) throw new Error('Operational Audit payload missing metrics.');
  const postMetric = await requestJson('/api/operational-audit', {
    method: 'POST',
    timeoutMs: XL_TIMEOUT_MS,
    logLabel: 'ops:update-metric',
    body: {
      action: 'update-metric',
      assessmentId,
      metricId: firstMetric.metric_id,
      workflowId: firstMetric.workflow_id,
      baselineValue: '10',
      currentValue: '12',
      targetValue: '15',
      trendDirection: 'Improving',
      ragStatus: 'Amber',
      baselineDate: '2026-01-01',
      notes: 'QA smoke metric update',
    },
  });
  if (!postMetric.res.ok) throw new Error(`Operational Audit update-metric failed: ${postMetric.text}`);
  return { ok: true, status: 200, detail: `Operational Audit GET + question update + metric update succeeded.`, data: { questionId: question.question_id, metricId: firstMetric.metric_id } };
}

async function testRevenueLeakage(assessmentId: string) {
  const getReq = await requestJson(`/api/revenue-leakage?assessmentId=${encodeURIComponent(assessmentId)}`, { timeoutMs: XL_TIMEOUT_MS, logLabel: 'leak:get' });
  if (!getReq.res.ok) throw new Error(`Revenue Leakage GET failed: ${getReq.text}`);
  const state = getReq.data?.state || {};
  const coreName = Object.keys(state.cores || {})[0];
  if (!coreName) throw new Error('Revenue Leakage state missing cores.');
  const currentActual = Number(state.cores?.[coreName]?.actual || 0);
  const nextActual = Number.isFinite(currentActual) ? currentActual + 1 : 1;
  const postReq = await requestJson('/api/revenue-leakage', {
    method: 'POST',
    timeoutMs: XL_TIMEOUT_MS,
    logLabel: 'leak:update-core',
    body: { action: 'update-core', assessmentId, coreName, field: 'actual', value: nextActual },
  });
  if (!postReq.res.ok) throw new Error(`Revenue Leakage update-core failed: ${postReq.text}`);
  return { ok: true, status: 200, detail: `Revenue Leakage GET + core update succeeded.`, data: { coreName, nextActual } };
}

async function testQuestionModule(moduleCode: string, apiPath: string, assessmentId: string) {
  const getReq = await requestJson(`${apiPath}?assessmentId=${encodeURIComponent(assessmentId)}`, {
    timeoutMs: XL_TIMEOUT_MS,
    logLabel: `${moduleCode}:get`,
  });
  if (!getReq.res.ok) throw new Error(`${moduleCode} GET failed: ${getReq.text}`);
  const questions = getReq.data?.questions || [];
  const question = questions[0];
  if (!question?.question_id) throw new Error(`${moduleCode} payload missing questions.`);
  const postReq = await requestJson(apiPath, {
    method: 'POST',
    timeoutMs: XL_TIMEOUT_MS,
    logLabel: `${moduleCode}:save`,
    body: { assessmentId, questionId: question.question_id, score: 3 },
  });
  if (!postReq.res.ok) throw new Error(`${moduleCode} save failed: ${postReq.text}`);
  return { ok: true, status: 200, detail: `${moduleCode} GET + POST succeeded.`, data: { questionId: question.question_id } };
}

async function testReports(assessmentId: string) {
  const results = [] as any[];
  results.push(await check('report:get:full', async () => {
    const req = await requestJson(`/api/assessments/${encodeURIComponent(assessmentId)}/report`, { timeoutMs: XL_TIMEOUT_MS, logLabel: 'report:get:full' });
    return { ok: req.res.ok, status: req.res.status, detail: req.res.ok ? 'Integrated report GET succeeded.' : req.text };
  }));
  results.push(await check('report:post:full', async () => {
    const req = await requestJson(`/api/assessments/${encodeURIComponent(assessmentId)}/report`, { method: 'POST', timeoutMs: XL_TIMEOUT_MS, logLabel: 'report:post:full' });
    return { ok: req.res.ok, status: req.res.status, detail: req.res.ok ? 'Integrated report POST succeeded.' : req.text };
  }));
  for (const module of MODULES) {
    results.push(await check(`report:get:${module.code}`, async () => {
      const req = await requestJson(`/api/assessments/${encodeURIComponent(assessmentId)}/report?module=${module.code}`, { timeoutMs: XL_TIMEOUT_MS, logLabel: `report:get:${module.code}` });
      return { ok: req.res.ok, status: req.res.status, detail: req.res.ok ? `${module.code} report GET succeeded.` : req.text };
    }));
    results.push(await check(`report:post:${module.code}`, async () => {
      const req = await requestJson(`/api/assessments/${encodeURIComponent(assessmentId)}/report?module=${module.code}`, { method: 'POST', timeoutMs: XL_TIMEOUT_MS, logLabel: `report:post:${module.code}` });
      return { ok: req.res.ok, status: req.res.status, detail: req.res.ok ? `${module.code} report POST succeeded.` : req.text };
    }));
  }
  return results;
}

async function testPresentations(assessmentId: string) {
  const results = [] as any[];
  results.push(await check('presentation:get:full', async () => {
    const req = await requestBinary(`/api/assessments/${encodeURIComponent(assessmentId)}/presentation`, { timeoutMs: XL_TIMEOUT_MS, logLabel: 'presentation:get:full' });
    const ok = req.res.ok && req.buffer.length > 0;
    return { ok, status: req.res.status, detail: ok ? `Integrated PPTX download succeeded (${req.buffer.length} bytes).` : `Unexpected PPTX response.` };
  }));
  for (const module of MODULES) {
    results.push(await check(`presentation:get:${module.code}`, async () => {
      const req = await requestBinary(`/api/assessments/${encodeURIComponent(assessmentId)}/presentation?module=${module.code}`, { timeoutMs: XL_TIMEOUT_MS, logLabel: `presentation:get:${module.code}` });
      const ok = req.res.ok && req.buffer.length > 0;
      return { ok, status: req.res.status, detail: ok ? `${module.code} PPTX download succeeded (${req.buffer.length} bytes).` : `Unexpected PPTX response.` };
    }));
  }
  return results;
}

async function testPages(assessmentId: string) {
  const pages = [
    { name: 'page:home', path: '/' },
    { name: 'page:workspace', path: `/workspace?assessmentId=${encodeURIComponent(assessmentId)}` },
    { name: 'page:reports', path: `/reports?assessmentId=${encodeURIComponent(assessmentId)}` },
    { name: 'page:ops', path: `/diagnostics/operational-audit?assessmentId=${encodeURIComponent(assessmentId)}` },
    { name: 'page:leak', path: `/diagnostics/revenue-leakage?assessmentId=${encodeURIComponent(assessmentId)}` },
    { name: 'page:data', path: `/diagnostics/data-foundation?assessmentId=${encodeURIComponent(assessmentId)}` },
    { name: 'page:air', path: `/diagnostics/ai-readiness?assessmentId=${encodeURIComponent(assessmentId)}` },
    { name: 'page:aiuc', path: `/diagnostics/ai-use-cases?assessmentId=${encodeURIComponent(assessmentId)}` },
    { name: 'page:roadmap', path: `/transformation/roadmap?assessmentId=${encodeURIComponent(assessmentId)}` },
    { name: 'page:progress', path: `/transformation/progress?assessmentId=${encodeURIComponent(assessmentId)}` },
  ];
  const results = [] as any[];
  for (const page of pages) {
    results.push(await check(page.name, async () => {
      const req = await requestHtml(page.path, LONG_TIMEOUT_MS);
      const ct = String(req.res.headers.get('content-type') || '');
      const ok = req.res.ok && ct.includes('text/html');
      return { ok, status: req.res.status, detail: ok ? `${page.path} rendered.` : `Unexpected render response (${ct}).` };
    }));
  }
  return results;
}

async function main() {
  const startedAt = new Date().toISOString();
  const results = [] as any[];
  const context: any = {};

  results.push(await check('preflight:health', async () => {
    const ready = await waitForHealthyApp();
    return { ok: true, status: ready.status, detail: `Health ready in ${ready.waitedMs}ms`, data: ready.data };
  }));

  results.push(await check('api:clients:list', async () => {
    const req = await requestJson('/api/clients', { timeoutMs: LONG_TIMEOUT_MS, logLabel: 'clients:list' });
    return { ok: req.res.ok && Array.isArray(req.data), status: req.res.status, detail: req.res.ok ? `Returned ${Array.isArray(req.data) ? req.data.length : 0} clients.` : req.text };
  }));

  results.push(await check('bootstrap:create-client-and-assessment', async () => {
    const boot = await bootstrapAssessment();
    context.client = boot.client;
    context.assessment = boot.assessment;
    writeArtifact('qa-full-system-no-seed-bootstrap-latest.json', boot);
    return { ok: true, status: 201, detail: `Created ${boot.client.client_id} and ${boot.assessment.assessment_id}.`, data: boot };
  }));

  const assessmentId = context.assessment?.assessment_id;
  if (!assessmentId) {
    const payload = { appBaseUrl: APP_BASE_URL, startedAt, runAt: new Date().toISOString(), summary: summarize(results), context, results };
    writeArtifact(`qa-full-system-no-seed-${stamp()}.json`, payload);
    writeArtifact('qa-full-system-no-seed-latest.json', payload);
    console.log(`\nFULL SYSTEM QA (NO SEED) SUMMARY: ${payload.summary.passed}/${payload.summary.total} passed, ${payload.summary.failed} failed.\n`);
    for (const result of results) {
      console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.status ? ` [${result.status}]` : ''}`);
      if (result.detail) console.log(`      ${result.detail}`);
    }
    process.exitCode = 1;
    return;
  }

  results.push(await check('api:assessments:list', async () => {
    const req = await requestJson(`/api/assessments?clientId=${encodeURIComponent(context.client.client_id)}`, { timeoutMs: LONG_TIMEOUT_MS, logLabel: 'assessments:list' });
    return { ok: req.res.ok && Array.isArray(req.data), status: req.res.status, detail: req.res.ok ? `Returned ${Array.isArray(req.data) ? req.data.length : 0} assessments.` : req.text };
  }));

  results.push(await check('api:workspace', async () => {
    const req = await requestJson(`/api/workspace?clientId=${encodeURIComponent(context.client.client_id)}&assessmentId=${encodeURIComponent(assessmentId)}`, { timeoutMs: XL_TIMEOUT_MS, logLabel: 'workspace:get' });
    const ok = req.res.ok && req.data?.assessment?.assessment_id === assessmentId;
    return { ok, status: req.res.status, detail: ok ? 'Workspace resolved active client and assessment.' : req.text || 'Workspace did not resolve expected assessment.' };
  }));

  results.push(await check('api:reference:OPS', async () => {
    const req = await requestJson('/api/reference/OPS', { timeoutMs: XL_TIMEOUT_MS, logLabel: 'reference:OPS' });
    const ok = req.res.ok && Array.isArray(req.data?.domains) && Array.isArray(req.data?.workflows);
    return { ok, status: req.res.status, detail: ok ? 'OPS reference route reachable.' : req.text || 'OPS reference route missing expected data.' };
  }));

  results.push(await check('module:OPS', async () => testOperationalAudit(assessmentId)));
  results.push(await check('module:LEAK', async () => testRevenueLeakage(assessmentId)));
  results.push(await check('module:DATA', async () => testQuestionModule('DATA', '/api/data-foundation', assessmentId)));
  results.push(await check('module:AIR', async () => testQuestionModule('AIR', '/api/ai-readiness', assessmentId)));
  results.push(await check('module:AIUC', async () => testQuestionModule('AIUC', '/api/ai-use-cases', assessmentId)));

  results.push(await check('api:publications:get', async () => {
    const req = await requestJson(`/api/assessments/${encodeURIComponent(assessmentId)}/publications`, { timeoutMs: XL_TIMEOUT_MS, logLabel: 'publications:get' });
    return { ok: req.res.ok, status: req.res.status, detail: req.res.ok ? 'Publications GET succeeded.' : req.text };
  }));
  results.push(await check('api:publications:post', async () => {
    const req = await requestJson(`/api/assessments/${encodeURIComponent(assessmentId)}/publications`, { method: 'POST', timeoutMs: XL_TIMEOUT_MS, logLabel: 'publications:post' });
    return { ok: req.res.ok, status: req.res.status, detail: req.res.ok ? 'Publications POST succeeded.' : req.text };
  }));

  results.push(await check('api:roadmap:get', async () => {
    const req = await requestJson(`/api/assessments/${encodeURIComponent(assessmentId)}/roadmap`, { timeoutMs: XL_TIMEOUT_MS, logLabel: 'roadmap:get' });
    return { ok: req.res.ok, status: req.res.status, detail: req.res.ok ? `Roadmap GET succeeded.` : req.text };
  }));
  results.push(await check('api:roadmap:post', async () => {
    const req = await requestJson(`/api/assessments/${encodeURIComponent(assessmentId)}/roadmap`, { method: 'POST', timeoutMs: XL_TIMEOUT_MS, logLabel: 'roadmap:post' });
    return { ok: req.res.ok, status: req.res.status, detail: req.res.ok ? `Roadmap POST succeeded.` : req.text };
  }));

  const reportResults = await testReports(assessmentId);
  results.push(...reportResults);
  const presentationResults = await testPresentations(assessmentId);
  results.push(...presentationResults);
  const pageResults = await testPages(assessmentId);
  results.push(...pageResults);

  const payload = {
    appBaseUrl: APP_BASE_URL,
    startedAt,
    runAt: new Date().toISOString(),
    summary: summarize(results),
    context,
    results,
  };

  writeArtifact(`qa-full-system-no-seed-${stamp()}.json`, payload);
  writeArtifact('qa-full-system-no-seed-latest.json', payload);

  console.log(`\nFULL SYSTEM QA (NO SEED) SUMMARY: ${payload.summary.passed}/${payload.summary.total} passed, ${payload.summary.failed} failed.\n`);
  for (const result of results) {
    console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.status ? ` [${result.status}]` : ''}`);
    if (result.detail) console.log(`      ${result.detail}`);
  }

  if (payload.summary.failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
