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

export const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';
export const OUT_DIR = join(process.cwd(), 'qa-artifacts');
mkdirSync(OUT_DIR, { recursive: true });

export const DEFAULT_TIMEOUT_MS = Number(process.env.QA_REQUEST_TIMEOUT_MS || 15000);
export const LONG_TIMEOUT_MS = Number(process.env.QA_LONG_TIMEOUT_MS || 45000);
export const XL_TIMEOUT_MS = Number(process.env.QA_XL_TIMEOUT_MS || 120000);
export const HEALTH_WAIT_MS = Number(process.env.QA_HEALTH_WAIT_MS || 120000);
export const HEALTH_POLL_MS = Number(process.env.QA_HEALTH_POLL_MS || 2000);

function now() {
  return new Date().toISOString();
}

function stepLog(message: string) {
  console.log(`[${now()}] ${message}`);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeJsonParse(text: string) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function buildUrl(path: string) {
  return `${APP_BASE_URL}${path}`;
}

export function writeArtifact(name: string, payload: unknown) {
  writeFileSync(join(OUT_DIR, name), JSON.stringify(payload, null, 2));
}

export function summarize(results: any[]) {
  const passed = results.filter((r) => r.ok).length;
  return { passed, failed: results.length - passed, total: results.length };
}

export async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function requestJson(path: string, options: {
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
    stepLog(`START ${tag}`);
    const started = Date.now();
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
      stepLog(`DONE  ${tag} -> ${res.status} in ${Date.now() - started}ms`);
      return { res, text, json, data, durationMs: Date.now() - started };
    } catch (error) {
      lastError = error;
      stepLog(`FAIL  ${tag} -> ${error instanceof Error ? error.message : String(error)}`);
      if (attempt < retries) await sleep(Math.min(1000 * (attempt + 1), 3000));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function requestBinary(path: string, options: {
  timeoutMs?: number;
  retries?: number;
  logLabel?: string;
} = {}) {
  const timeoutMs = options.timeoutMs ?? LONG_TIMEOUT_MS;
  const retries = options.retries ?? 0;
  const logLabel = options.logLabel || `GET ${path}`;
  let lastError: any = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const tag = `${logLabel}${attempt ? ` (retry ${attempt}/${retries})` : ''}`;
    stepLog(`START ${tag}`);
    const started = Date.now();
    try {
      const res = await fetchWithTimeout(buildUrl(path), {}, timeoutMs);
      const buffer = Buffer.from(await res.arrayBuffer());
      stepLog(`DONE  ${tag} -> ${res.status} in ${Date.now() - started}ms`);
      return { res, buffer, durationMs: Date.now() - started };
    } catch (error) {
      lastError = error;
      stepLog(`FAIL  ${tag} -> ${error instanceof Error ? error.message : String(error)}`);
      if (attempt < retries) await sleep(Math.min(1000 * (attempt + 1), 3000));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function waitForHealthyApp(maxWaitMs = HEALTH_WAIT_MS) {
  stepLog(`Waiting for app health at ${APP_BASE_URL}/api/health (max ${maxWaitMs}ms)`);
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
        stepLog(`Health ready after ${Date.now() - started}ms (${attempts} attempts). Runtime mode: ${json?.runtimeMode || 'unknown'}`);
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

export async function check(name: string, fn: () => Promise<any>) {
  const started = Date.now();
  try {
    const result = await fn();
    const final = { name, durationMs: Date.now() - started, ...result };
    stepLog(`${final.ok ? 'PASS' : 'FAIL'} ${name}${final.status ? ` [${final.status}]` : ''}${final.detail ? ` :: ${final.detail}` : ''}`);
    return final;
  } catch (error) {
    const final = {
      name,
      ok: false,
      durationMs: Date.now() - started,
      detail: error instanceof Error ? error.message : String(error),
    };
    stepLog(`FAIL ${name} :: ${final.detail}`);
    return final;
  }
}

export const QA_SCENARIOS = [
  {
    key: 'realistic',
    label: 'Realistic SME',
    clientName: 'QA Realistic Growth Services',
    assessmentName: 'QA Realistic Full-System Assessment',
    industry: 'Business Services',
    businessModel: 'B2B services',
    revenueModel: 'Retainer + project',
    companySize: 'SME',
    region: 'South Africa',
    notes: 'Balanced operating environment with clear growth gaps and moderate readiness.',
    benchmarkProfile: 'B2B Services',
    questionCycles: {
      OPS: [3, 3, 4, 2, 4, 3],
      LEAK: [3, 2, 3, 4, 3, 2],
      DATA: [2, 3, 3, 4, 2, 3],
      AIR: [2, 3, 2, 3, 4, 3],
      AIUC: [3, 3, 4, 2, 3, 4]
    },
    metricProfile: {
      pctFactor: 0.82,
      timeFactor: 1.35,
      countFactor: 0.84,
      currencyFactor: 0.88,
      genericFactor: 0.8,
      leakageActualFactor: 0.8,
      leakageSupportFactor: 0.85,
      leakageDriverFactor: 0.82,
      rag: 'Amber',
      trend: 'Mixed'
    }
  },
  {
    key: 'worst_case',
    label: 'Worst Case Stress',
    clientName: 'QA Worst Case Recovery Co',
    assessmentName: 'QA Worst Case Full-System Assessment',
    industry: 'Managed Services',
    businessModel: 'Founder-led reactive delivery',
    revenueModel: 'Project-heavy inconsistent billing',
    companySize: 'SME',
    region: 'South Africa',
    notes: 'Severe control, data, and readiness weaknesses intended to test red-path logic.',
    benchmarkProfile: 'IT Services / MSP',
    questionCycles: {
      OPS: [1, 1, 2, 1, 2, 1],
      LEAK: [1, 2, 1, 1, 2, 1],
      DATA: [1, 1, 2, 1, 2, 1],
      AIR: [1, 1, 2, 1, 2, 1],
      AIUC: [1, 2, 1, 1, 2, 1]
    },
    metricProfile: {
      pctFactor: 0.48,
      timeFactor: 2.3,
      countFactor: 0.45,
      currencyFactor: 0.55,
      genericFactor: 0.5,
      leakageActualFactor: 0.42,
      leakageSupportFactor: 0.5,
      leakageDriverFactor: 0.45,
      rag: 'Red',
      trend: 'Declining'
    }
  },
  {
    key: 'best_case',
    label: 'Best Case Managed',
    clientName: 'QA Best Case Scale Systems',
    assessmentName: 'QA Best Case Full-System Assessment',
    industry: 'Technology Services',
    businessModel: 'Process-led recurring revenue',
    revenueModel: 'Subscription + managed services',
    companySize: 'Mid-market',
    region: 'South Africa',
    notes: 'High-maturity case to prove green-path logic, readiness, and report quality.',
    benchmarkProfile: 'SaaS / Software',
    questionCycles: {
      OPS: [4, 5, 4, 5, 4, 5],
      LEAK: [4, 5, 4, 4, 5, 4],
      DATA: [4, 5, 4, 5, 4, 5],
      AIR: [4, 5, 4, 5, 4, 5],
      AIUC: [4, 5, 4, 5, 4, 5]
    },
    metricProfile: {
      pctFactor: 1.02,
      timeFactor: 0.72,
      countFactor: 1.05,
      currencyFactor: 1.08,
      genericFactor: 1.0,
      leakageActualFactor: 1.02,
      leakageSupportFactor: 1.0,
      leakageDriverFactor: 1.0,
      rag: 'Green',
      trend: 'Improving'
    }
  }
] as const;

export function scenarioScore(scenarioKey: string, moduleCode: string, index: number) {
  const scenario = QA_SCENARIOS.find((item) => item.key === scenarioKey);
  if (!scenario) return 3;
  const cycle = scenario.questionCycles[moduleCode] || [3, 3, 4, 2, 4, 3];
  return cycle[index % cycle.length];
}

function numeric(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildOpsMetricValues(metric: any, scenarioKey: string, index: number) {
  const scenario = QA_SCENARIOS.find((item) => item.key === scenarioKey)!;
  const unit = String(metric?.unit || '').toLowerCase();
  const profile = scenario.metricProfile;

  let target = 10 + (index % 5) * 2;
  let current = target * profile.genericFactor;
  let baseline = current * 0.92;

  if (unit.includes('%') || unit.includes('percent') || unit.includes('ratio')) {
    target = 90 + (index % 6);
    current = target * profile.pctFactor;
    baseline = current * 0.94;
  } else if (unit.includes('day') || unit.includes('hour') || unit.includes('minute')) {
    target = 5 + (index % 4);
    current = target * profile.timeFactor;
    baseline = current * 1.08;
  } else if (unit.includes('count') || unit.includes('volume') || unit.includes('lead')) {
    target = 100 + (index % 8) * 20;
    current = target * profile.countFactor;
    baseline = current * 0.93;
  } else if (unit.includes('currency') || unit.includes('zar') || unit.includes('revenue') || unit.includes('margin')) {
    target = 100000 + index * 2500;
    current = target * profile.currencyFactor;
    baseline = current * 0.95;
  }

  return {
    baselineValue: String(Math.round(baseline * 100) / 100),
    currentValue: String(Math.round(current * 100) / 100),
    targetValue: String(Math.round(target * 100) / 100),
    trendDirection: profile.trend,
    ragStatus: profile.rag,
    baselineDate: '2026-01-01',
    notes: `${scenario.label} seeded metric coverage.`,
  };
}

export function scaledLeakageValue(benchmark: unknown, factor: number, fallbackBase: number, index: number) {
  const base = numeric(benchmark) || fallbackBase + index * 3;
  return Math.round(base * factor * 100) / 100;
}

export async function createClientAndAssessment(scenario: any) {
  const clientRes = await requestJson('/api/clients', {
    method: 'POST',
    timeoutMs: LONG_TIMEOUT_MS,
    logLabel: `create client ${scenario.clientName}`,
    body: {
      clientName: scenario.clientName,
      industry: scenario.industry,
      businessModel: scenario.businessModel,
      revenueModel: scenario.revenueModel,
      companySize: scenario.companySize,
      region: scenario.region,
      notes: scenario.notes,
    },
  });
  if (!clientRes.res.ok) throw new Error(`Failed to create client ${scenario.clientName}: ${clientRes.text}`);
  const clientId = String(clientRes.data?.client_id || '');
  if (!clientId) throw new Error(`No client_id returned for ${scenario.clientName}.`);

  const assessmentRes = await requestJson('/api/assessments', {
    method: 'POST',
    timeoutMs: LONG_TIMEOUT_MS,
    logLabel: `create assessment for ${scenario.clientName}`,
    body: {
      clientId,
      assessmentName: scenario.assessmentName,
      assessmentDate: '2026-03-28',
      scopeType: 'enterprise',
      scopeLabel: 'Full business',
      version: 'runtime-v1',
    },
  });
  if (!assessmentRes.res.ok) throw new Error(`Failed to create assessment for ${scenario.clientName}: ${assessmentRes.text}`);
  const assessmentId = String(assessmentRes.data?.assessment_id || '');
  if (!assessmentId) throw new Error(`No assessment_id returned for ${scenario.clientName}.`);

  return { clientId, assessmentId };
}

async function seedGenericQuestionModule(routeName: string, moduleCode: string, assessmentId: string, scenarioKey: string) {
  const load = await requestJson(`/api/${routeName}?assessmentId=${encodeURIComponent(assessmentId)}`, {
    timeoutMs: LONG_TIMEOUT_MS,
    logLabel: `${routeName} load`,
  });
  if (!load.res.ok) throw new Error(`${routeName} load failed: ${load.text}`);
  const questions = Array.isArray(load.data?.questions) ? load.data.questions : [];

  stepLog(`Seeding ${routeName}: ${questions.length} questions`);
  for (let index = 0; index < questions.length; index += 1) {
    const question = questions[index];
    const score = scenarioScore(scenarioKey, moduleCode, index);
    const save = await requestJson(`/api/${routeName}`, {
      method: 'POST',
      timeoutMs: LONG_TIMEOUT_MS,
      logLabel: `${routeName} save ${index + 1}/${questions.length} (${question.question_id})`,
      body: { assessmentId, questionId: question.question_id, score },
    });
    if (!save.res.ok) throw new Error(`${routeName} save failed for ${question.question_id}: ${save.text}`);
  }

  const verify = await requestJson(`/api/${routeName}?assessmentId=${encodeURIComponent(assessmentId)}`, {
    timeoutMs: LONG_TIMEOUT_MS,
    logLabel: `${routeName} verify`,
  });
  const responses = Array.isArray(verify.data?.responses) ? verify.data.responses : [];
  return {
    routeName,
    moduleCode,
    questionsTotal: questions.length,
    questionsAnswered: responses.length,
    complete: responses.length === questions.length,
    moduleScore: verify.data?.moduleScore || null,
  };
}

async function seedOperationalAudit(assessmentId: string, scenarioKey: string) {
  const load = await requestJson(`/api/operational-audit?assessmentId=${encodeURIComponent(assessmentId)}`, {
    timeoutMs: LONG_TIMEOUT_MS,
    logLabel: 'OPS load',
  });
  if (!load.res.ok) throw new Error(`Operational Audit load failed: ${load.text}`);
  const questions = Array.isArray(load.data?.bundle?.questions) ? load.data.bundle.questions : [];
  const metricMap = load.data?.bundle?.metric_map || {};

  const updates = questions.map((question: any, index: number) => ({
    questionId: question.question_id,
    score: scenarioScore(scenarioKey, 'OPS', index),
  }));

  const scoreRes = await requestJson('/api/operational-audit', {
    method: 'POST',
    timeoutMs: LONG_TIMEOUT_MS,
    logLabel: `OPS bulk-score ${questions.length} questions`,
    body: { action: 'bulk-score', assessmentId, updates },
  });
  if (!scoreRes.res.ok) throw new Error(`Operational Audit bulk-score failed: ${scoreRes.text}`);

  const metricDefs = Object.values(metricMap);
  stepLog(`Seeding OPS metrics: ${metricDefs.length} metrics`);
  for (let index = 0; index < metricDefs.length; index += 1) {
    const metricDef: any = metricDefs[index];
    const values = buildOpsMetricValues(metricDef, scenarioKey, index);
    const metricRes = await requestJson('/api/operational-audit', {
      method: 'POST',
      timeoutMs: LONG_TIMEOUT_MS,
      logLabel: `OPS metric ${index + 1}/${metricDefs.length} (${metricDef.metric_id})`,
      body: {
        action: 'update-metric',
        assessmentId,
        metricId: metricDef.metric_id,
        workflowId: metricDef.workflow_id,
        ...values,
      },
    });
    if (!metricRes.res.ok) throw new Error(`Operational Audit metric update failed for ${metricDef.metric_id}: ${metricRes.text}`);
  }

  const verify = await requestJson(`/api/operational-audit?assessmentId=${encodeURIComponent(assessmentId)}`, {
    timeoutMs: LONG_TIMEOUT_MS,
    logLabel: 'OPS verify',
  });
  const responses = Array.isArray(verify.data?.responses) ? verify.data.responses : [];
  const metrics = Array.isArray(verify.data?.metricCaptures) ? verify.data.metricCaptures : [];
  return {
    moduleCode: 'OPS',
    questionsTotal: questions.length,
    questionsAnswered: responses.length,
    metricsTotal: metricDefs.length,
    metricsCaptured: metrics.length,
    complete: responses.length === questions.length && metrics.length === metricDefs.length,
    summary: verify.data?.summary || null,
  };
}

async function seedRevenueLeakage(assessmentId: string, scenarioKey: string) {
  const scenario = QA_SCENARIOS.find((item) => item.key === scenarioKey)!;
  let load = await requestJson(`/api/revenue-leakage?assessmentId=${encodeURIComponent(assessmentId)}`, {
    timeoutMs: LONG_TIMEOUT_MS,
    logLabel: 'LEAK load',
  });
  if (!load.res.ok) throw new Error(`Revenue Leakage load failed: ${load.text}`);

  const profiles = Array.isArray(load.data?.benchmarkProfiles) ? load.data.benchmarkProfiles : [];
  const profileName = profiles.find((name: string) => name === scenario.benchmarkProfile) || profiles[0] || '';
  if (profileName) {
    const profileRes = await requestJson('/api/revenue-leakage', {
      method: 'POST',
      timeoutMs: LONG_TIMEOUT_MS,
      logLabel: `LEAK set benchmark profile ${profileName}`,
      body: { action: 'set-benchmark-profile', assessmentId, profileName },
    });
    if (!profileRes.res.ok) throw new Error(`Revenue Leakage benchmark profile failed: ${profileRes.text}`);
    load = await requestJson(`/api/revenue-leakage?assessmentId=${encodeURIComponent(assessmentId)}`, {
      timeoutMs: LONG_TIMEOUT_MS,
      logLabel: 'LEAK reload after benchmark',
    });
  }

  const state = load.data?.state || { cores: {} };
  const coreEntries = Object.entries(state.cores || {});
  let supportCount = 0;
  let driverCount = 0;

  stepLog(`Seeding LEAK: ${coreEntries.length} cores`);
  for (let coreIndex = 0; coreIndex < coreEntries.length; coreIndex += 1) {
    const [coreName, coreState]: any = coreEntries[coreIndex];
    const actual = scaledLeakageValue(coreState?.benchmark, scenario.metricProfile.leakageActualFactor, 50, coreIndex);
    const coreRes = await requestJson('/api/revenue-leakage', {
      method: 'POST',
      timeoutMs: LONG_TIMEOUT_MS,
      logLabel: `LEAK core ${coreIndex + 1}/${coreEntries.length} (${coreName})`,
      body: { action: 'update-core', assessmentId, coreName, field: 'actual', value: actual },
    });
    if (!coreRes.res.ok) throw new Error(`Revenue Leakage core update failed for ${coreName}: ${coreRes.text}`);

    for (const [supportKey, supportValue] of Object.entries(coreState?.support || {})) {
      supportCount += 1;
      const value = scaledLeakageValue(supportValue, scenario.metricProfile.leakageSupportFactor, 20, supportCount);
      const supportRes = await requestJson('/api/revenue-leakage', {
        method: 'POST',
        timeoutMs: LONG_TIMEOUT_MS,
        logLabel: `LEAK support ${coreName}/${supportKey}`,
        body: { action: 'update-support', assessmentId, coreName, supportKey, value },
      });
      if (!supportRes.res.ok) throw new Error(`Revenue Leakage support update failed for ${coreName}/${supportKey}: ${supportRes.text}`);
    }

    for (const [driverName, driverState]: any of Object.entries(coreState?.drivers || {})) {
      driverCount += 1;
      const value = scaledLeakageValue(driverState?.benchmark, scenario.metricProfile.leakageDriverFactor, 25, driverCount);
      const driverRes = await requestJson('/api/revenue-leakage', {
        method: 'POST',
        timeoutMs: LONG_TIMEOUT_MS,
        logLabel: `LEAK driver ${coreName}/${driverName}`,
        body: { action: 'update-driver', assessmentId, coreName, driverName, field: 'actual', value },
      });
      if (!driverRes.res.ok) throw new Error(`Revenue Leakage driver update failed for ${coreName}/${driverName}: ${driverRes.text}`);
    }
  }

  const verify = await requestJson(`/api/revenue-leakage?assessmentId=${encodeURIComponent(assessmentId)}`, {
    timeoutMs: LONG_TIMEOUT_MS,
    logLabel: 'LEAK verify',
  });
  const verifyState = verify.data?.state || { cores: {} };
  const completeCoreCount = Object.values(verifyState.cores || {}).filter((core: any) => {
    const hasActual = Number(core.actual || 0) !== 0;
    const supportsOk = Object.values(core.support || {}).every((value: any) => Number(value || 0) !== 0);
    const driversOk = Object.values(core.drivers || {}).every((driver: any) => Number(driver.actual || 0) !== 0);
    return hasActual && supportsOk && driversOk;
  }).length;
  return {
    moduleCode: 'LEAK',
    benchmarkProfile: profileName,
    coresTotal: coreEntries.length,
    coresComplete: completeCoreCount,
    supportCount,
    driverCount,
    complete: Boolean(verify.data?.summary?.is_complete ?? (completeCoreCount === coreEntries.length)),
    summary: verify.data?.summary || null,
  };
}

export async function seedScenario(scenario: any) {
  stepLog(`\n=== SEED SCENARIO: ${scenario.label} ===`);
  const ids = await createClientAndAssessment(scenario);

  const workspace = await requestJson(`/api/workspace?clientId=${encodeURIComponent(ids.clientId)}&assessmentId=${encodeURIComponent(ids.assessmentId)}`, {
    timeoutMs: LONG_TIMEOUT_MS,
    logLabel: `workspace resolve ${scenario.label}`,
  });
  if (!workspace.res.ok) throw new Error(`Workspace resolution failed for ${scenario.clientName}: ${workspace.text}`);

  const ops = await seedOperationalAudit(ids.assessmentId, scenario.key);
  const leak = await seedRevenueLeakage(ids.assessmentId, scenario.key);
  const data = await seedGenericQuestionModule('data-foundation', 'DATA', ids.assessmentId, scenario.key);
  const air = await seedGenericQuestionModule('ai-readiness', 'AIR', ids.assessmentId, scenario.key);
  const aiuc = await seedGenericQuestionModule('ai-use-cases', 'AIUC', ids.assessmentId, scenario.key);

  const pubs = await requestJson(`/api/assessments/${encodeURIComponent(ids.assessmentId)}/publications`, {
    method: 'POST',
    timeoutMs: XL_TIMEOUT_MS,
    retries: 1,
    logLabel: `publish all modules ${scenario.label}`,
  });
  if (!pubs.res.ok) throw new Error(`Publication generation failed for ${scenario.clientName}: ${pubs.text}`);

  const roadmap = await requestJson(`/api/assessments/${encodeURIComponent(ids.assessmentId)}/roadmap`, {
    method: 'POST',
    timeoutMs: XL_TIMEOUT_MS,
    retries: 1,
    logLabel: `combined roadmap ${scenario.label}`,
  });
  if (!roadmap.res.ok) throw new Error(`Combined roadmap generation failed for ${scenario.clientName}: ${roadmap.text}`);

  return {
    scenario: scenario.key,
    label: scenario.label,
    clientId: ids.clientId,
    assessmentId: ids.assessmentId,
    modules: { ops, leak, data, air, aiuc },
  };
}

const MODULE_SCOPES = ['OPS', 'LEAK', 'DATA', 'AIR', 'AIUC'] as const;
const MODULE_REFERENCE_CODES = ['OPS', 'LEAK', 'DATA', 'AIR', 'AIUC', 'ROADMAP'] as const;
const DIAGNOSTIC_PAGES = [
  { path: '/workspace', label: 'Workspace', pattern: /Assessment Overview|Executive Dashboard|Report Preview|Workspace/i },
  { path: '/reports', label: 'Reports', pattern: /Reports|Executive Summary|Strategic Priorities/i },
  { path: '/diagnostics/operational-audit', label: 'Operational Audit Page', pattern: /Operational Audit/i },
  { path: '/diagnostics/revenue-leakage', label: 'Revenue Leakage Page', pattern: /Revenue Leakage/i },
  { path: '/diagnostics/data-foundation', label: 'Data Foundation Page', pattern: /Data Foundation/i },
  { path: '/diagnostics/ai-readiness', label: 'AI Readiness Page', pattern: /AI Readiness/i },
  { path: '/diagnostics/ai-use-cases', label: 'AI Use Cases Page', pattern: /AI Use Cases/i },
  { path: '/transformation/roadmap', label: 'Roadmap Page', pattern: /Roadmap|Transformation/i },
  { path: '/transformation/progress', label: 'Progress Tracker Page', pattern: /Progress Tracker|Tracked measures/i },
] as const;

export async function verifyAssessment(run: any) {
  const { clientId, assessmentId, scenario } = run;
  const results: any[] = [];

  results.push(await check(`${scenario}:clients:list`, async () => {
    const { res, data, text } = await requestJson('/api/clients', { timeoutMs: LONG_TIMEOUT_MS, logLabel: `${scenario} clients list` });
    return {
      ok: res.ok && Array.isArray(data),
      status: res.status,
      detail: res.ok ? `Returned ${Array.isArray(data) ? data.length : 0} clients.` : text,
      data: { count: Array.isArray(data) ? data.length : 0 },
    };
  }));

  results.push(await check(`${scenario}:assessments:list`, async () => {
    const { res, data, text } = await requestJson(`/api/assessments?clientId=${encodeURIComponent(clientId)}`, { timeoutMs: LONG_TIMEOUT_MS, logLabel: `${scenario} assessments list` });
    return {
      ok: res.ok && Array.isArray(data) && data.some((row: any) => row.assessment_id === assessmentId),
      status: res.status,
      detail: res.ok ? `Returned ${Array.isArray(data) ? data.length : 0} assessments for client.` : text,
      data: { count: Array.isArray(data) ? data.length : 0 },
    };
  }));

  results.push(await check(`${scenario}:workspace`, async () => {
    const { res, data, text } = await requestJson(`/api/workspace?clientId=${encodeURIComponent(clientId)}&assessmentId=${encodeURIComponent(assessmentId)}`, {
      timeoutMs: LONG_TIMEOUT_MS,
      logLabel: `${scenario} workspace verify`,
    });
    return {
      ok: res.ok && data?.assessment?.assessment_id === assessmentId,
      status: res.status,
      detail: res.ok ? 'Workspace resolved active assessment.' : text,
      data: { modules: Array.isArray(data?.modules) ? data.modules.length : 0 },
    };
  }));

  for (const moduleCode of MODULE_REFERENCE_CODES) {
    results.push(await check(`${scenario}:reference:${moduleCode}`, async () => {
      const { res, data, text } = await requestJson(`/api/reference/${moduleCode}`, {
        timeoutMs: LONG_TIMEOUT_MS,
        logLabel: `${scenario} reference ${moduleCode}`,
      });
      return {
        ok: res.ok && !!data,
        status: res.status,
        detail: res.ok ? `${moduleCode} reference reachable.` : text,
      };
    }));
  }

  results.push(await check(`${scenario}:ops:coverage`, async () => {
    const { res, data, text } = await requestJson(`/api/operational-audit?assessmentId=${encodeURIComponent(assessmentId)}`, {
      timeoutMs: LONG_TIMEOUT_MS,
      logLabel: `${scenario} OPS coverage`,
    });
    const qTotal = Array.isArray(data?.bundle?.questions) ? data.bundle.questions.length : 0;
    const mTotal = data?.bundle?.metric_map ? Object.keys(data.bundle.metric_map).length : 0;
    const qAnswered = Array.isArray(data?.responses) ? data.responses.length : 0;
    const mCaptured = Array.isArray(data?.metricCaptures) ? data.metricCaptures.length : 0;
    return {
      ok: res.ok && qAnswered === qTotal && mCaptured === mTotal,
      status: res.status,
      detail: res.ok ? `OPS coverage ${qAnswered}/${qTotal} questions and ${mCaptured}/${mTotal} metrics.` : text,
      data: { qTotal, qAnswered, mTotal, mCaptured },
    };
  }));

  for (const [routeName, code] of [['data-foundation', 'DATA'], ['ai-readiness', 'AIR'], ['ai-use-cases', 'AIUC']] as const) {
    results.push(await check(`${scenario}:${routeName}:coverage`, async () => {
      const { res, data, text } = await requestJson(`/api/${routeName}?assessmentId=${encodeURIComponent(assessmentId)}`, {
        timeoutMs: LONG_TIMEOUT_MS,
        logLabel: `${scenario} ${routeName} coverage`,
      });
      const qTotal = Array.isArray(data?.questions) ? data.questions.length : 0;
      const qAnswered = Array.isArray(data?.responses) ? data.responses.length : 0;
      return {
        ok: res.ok && qAnswered === qTotal && Boolean(data?.moduleScore),
        status: res.status,
        detail: res.ok ? `${routeName} coverage ${qAnswered}/${qTotal} questions.` : text,
        data: { qTotal, qAnswered, moduleScore: data?.moduleScore?.score_pct || null },
      };
    }));
  }

  results.push(await check(`${scenario}:revenue-leakage:coverage`, async () => {
    const { res, data, text } = await requestJson(`/api/revenue-leakage?assessmentId=${encodeURIComponent(assessmentId)}`, {
      timeoutMs: LONG_TIMEOUT_MS,
      logLabel: `${scenario} LEAK coverage`,
    });
    const cores = Object.values(data?.state?.cores || {});
    const complete = cores.filter((core: any) => Number(core.actual || 0) !== 0 && Object.values(core.support || {}).every((v: any) => Number(v || 0) !== 0) && Object.values(core.drivers || {}).every((driver: any) => Number(driver.actual || 0) !== 0)).length;
    return {
      ok: res.ok && complete === cores.length && Boolean(data?.summary),
      status: res.status,
      detail: res.ok ? `Revenue Leakage coverage ${complete}/${cores.length} cores complete.` : text,
      data: { coresTotal: cores.length, coresComplete: complete, readiness: data?.moduleScore?.readiness_status || null },
    };
  }));

  results.push(await check(`${scenario}:publications:generate`, async () => {
    const { res, data, text } = await requestJson(`/api/assessments/${encodeURIComponent(assessmentId)}/publications`, {
      method: 'POST',
      timeoutMs: XL_TIMEOUT_MS,
      retries: 1,
      logLabel: `${scenario} publications generate`,
    });
    return {
      ok: res.ok,
      status: res.status,
      detail: res.ok ? 'Publication generation completed.' : text,
    };
  }));

  results.push(await check(`${scenario}:publications:list`, async () => {
    const { res, data, text } = await requestJson(`/api/assessments/${encodeURIComponent(assessmentId)}/publications`, {
      timeoutMs: LONG_TIMEOUT_MS,
      logLabel: `${scenario} publications list`,
    });
    return {
      ok: res.ok && Array.isArray(data) && data.length >= 5,
      status: res.status,
      detail: res.ok ? `Publication list returned ${Array.isArray(data) ? data.length : 0} rows.` : text,
      data: { count: Array.isArray(data) ? data.length : 0 },
    };
  }));

  results.push(await check(`${scenario}:report:full:post`, async () => {
    const { res, data, text } = await requestJson(`/api/assessments/${encodeURIComponent(assessmentId)}/report`, {
      method: 'POST',
      timeoutMs: XL_TIMEOUT_MS,
      retries: 1,
      logLabel: `${scenario} integrated report POST`,
    });
    return {
      ok: res.ok && Boolean(data?.framework?.executive_summary?.headline) && Boolean(data?.markdown),
      status: res.status,
      detail: res.ok ? 'Integrated report generated.' : text,
      data: { findings: data?.framework?.quality?.findings_count || 0 },
    };
  }));

  results.push(await check(`${scenario}:report:full:get`, async () => {
    const { res, data, text } = await requestJson(`/api/assessments/${encodeURIComponent(assessmentId)}/report`, {
      timeoutMs: LONG_TIMEOUT_MS,
      retries: 1,
      logLabel: `${scenario} integrated report GET`,
    });
    return {
      ok: res.ok && Boolean(data?.framework?.executive_summary?.headline),
      status: res.status,
      detail: res.ok ? 'Integrated report retrieved.' : text,
    };
  }));

  for (const moduleCode of MODULE_SCOPES) {
    results.push(await check(`${scenario}:report:${moduleCode}:post`, async () => {
      const { res, data, text } = await requestJson(`/api/assessments/${encodeURIComponent(assessmentId)}/report?module=${moduleCode}`, {
        method: 'POST',
        timeoutMs: XL_TIMEOUT_MS,
        retries: 1,
        logLabel: `${scenario} report POST ${moduleCode}`,
      });
      return {
        ok: res.ok && Boolean(data?.framework?.executive_summary?.headline),
        status: res.status,
        detail: res.ok ? `Standalone report generated for ${moduleCode}.` : text,
      };
    }));

    results.push(await check(`${scenario}:report:${moduleCode}:get`, async () => {
      const { res, data, text } = await requestJson(`/api/assessments/${encodeURIComponent(assessmentId)}/report?module=${moduleCode}`, {
        timeoutMs: LONG_TIMEOUT_MS,
        retries: 1,
        logLabel: `${scenario} report GET ${moduleCode}`,
      });
      return {
        ok: res.ok && Boolean(data?.framework?.executive_summary?.headline),
        status: res.status,
        detail: res.ok ? `Standalone report retrieved for ${moduleCode}.` : text,
      };
    }));
  }

  results.push(await check(`${scenario}:presentation:full`, async () => {
    const { res, buffer } = await requestBinary(`/api/assessments/${encodeURIComponent(assessmentId)}/presentation`, {
      timeoutMs: XL_TIMEOUT_MS,
      retries: 1,
      logLabel: `${scenario} integrated PPTX`,
    });
    return {
      ok: res.ok && String(res.headers.get('content-type') || '').includes('presentationml') && buffer.length > 5000,
      status: res.status,
      detail: res.ok ? `Integrated PPTX generated (${buffer.length} bytes).` : buffer.toString('utf8', 0, 200),
      data: { bytes: buffer.length },
    };
  }));

  for (const moduleCode of MODULE_SCOPES) {
    results.push(await check(`${scenario}:presentation:${moduleCode}`, async () => {
      const { res, buffer } = await requestBinary(`/api/assessments/${encodeURIComponent(assessmentId)}/presentation?module=${moduleCode}`, {
        timeoutMs: XL_TIMEOUT_MS,
        retries: 1,
        logLabel: `${scenario} PPTX ${moduleCode}`,
      });
      return {
        ok: res.ok && String(res.headers.get('content-type') || '').includes('presentationml') && buffer.length > 5000,
        status: res.status,
        detail: res.ok ? `Standalone PPTX generated for ${moduleCode} (${buffer.length} bytes).` : buffer.toString('utf8', 0, 200),
        data: { bytes: buffer.length },
      };
    }));
  }

  results.push(await check(`${scenario}:roadmap:post`, async () => {
    const { res, data, text } = await requestJson(`/api/assessments/${encodeURIComponent(assessmentId)}/roadmap`, {
      method: 'POST',
      timeoutMs: XL_TIMEOUT_MS,
      retries: 1,
      logLabel: `${scenario} roadmap POST`,
    });
    return {
      ok: res.ok,
      status: res.status,
      detail: res.ok ? 'Combined roadmap generated.' : text,
    };
  }));

  results.push(await check(`${scenario}:roadmap:get`, async () => {
    const { res, data, text } = await requestJson(`/api/assessments/${encodeURIComponent(assessmentId)}/roadmap`, {
      timeoutMs: LONG_TIMEOUT_MS,
      logLabel: `${scenario} roadmap GET`,
    });
    return {
      ok: res.ok && Array.isArray(data) && data.length > 0,
      status: res.status,
      detail: res.ok ? `Roadmap route returned ${Array.isArray(data) ? data.length : 0} rows.` : text,
      data: { count: Array.isArray(data) ? data.length : 0 },
    };
  }));

  const query = `clientId=${encodeURIComponent(clientId)}&assessmentId=${encodeURIComponent(assessmentId)}`;
  for (const page of DIAGNOSTIC_PAGES) {
    results.push(await check(`${scenario}:page:${page.path}`, async () => {
      const res = await fetchWithTimeout(buildUrl(`${page.path}?${query}`), { headers: { accept: 'text/html' } }, LONG_TIMEOUT_MS);
      const text = await res.text();
      return {
        ok: res.ok && page.pattern.test(text),
        status: res.status,
        detail: res.ok ? `Rendered ${page.label}.` : text.slice(0, 200),
      };
    }));
  }

  return results;
}
