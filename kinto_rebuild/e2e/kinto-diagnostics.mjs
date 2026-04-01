/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  KINTO GLOBAL — E2E DIAGNOSTIC TEST SUITE v1.0
 *
 *  Run from your project root:
 *    node e2e/kinto-diagnostics.mjs
 *    node e2e/kinto-diagnostics.mjs --base http://localhost:3000
 *    node e2e/kinto-diagnostics.mjs --base http://localhost:3000 --aid YOUR_ASSESSMENT_ID
 *
 *  What this does:
 *  ✓ Hits every API route and measures latency
 *  ✓ Traces the full data flow: save → persist → snapshot → dashboard reflects
 *  ✓ Verifies data integrity at each step (no silent data loss)
 *  ✓ Maps exactly where slowness is being held
 *  ✓ Identifies route mismatches and missing data
 *  ✓ Produces a prioritised root-cause report at the end
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { performance } from 'perf_hooks';

// ── CLI args ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const idx  = (flag) => args.indexOf(flag);
const BASE = idx('--base') >= 0 ? args[idx('--base') + 1] : 'http://localhost:3000';
const AID  = idx('--aid')  >= 0 ? args[idx('--aid')  + 1] : null;

// ── Terminal colours ──────────────────────────────────────────────────────────
const C = {
  reset:'\x1b[0m', bold:'\x1b[1m', dim:'\x1b[2m',
  green:'\x1b[32m', red:'\x1b[31m', yellow:'\x1b[33m',
  cyan:'\x1b[36m', magenta:'\x1b[35m', white:'\x1b[37m',
  bgRed:'\x1b[41m', bgGreen:'\x1b[42m', bgYellow:'\x1b[43m',
};
const ok   = (s) => `${C.green}✓${C.reset} ${s}`;
const fail = (s) => `${C.red}✗${C.reset} ${C.red}${s}${C.reset}`;
const warn = (s) => `${C.yellow}⚠${C.reset} ${s}`;
const info = (s) => `${C.cyan}→${C.reset} ${s}`;
const dim  = (s) => `${C.dim}${s}${C.reset}`;
const bold = (s) => `${C.bold}${s}${C.reset}`;
const head = (s) => `\n${C.bold}${C.cyan}══ ${s} ══${C.reset}`;
const ms   = (n) => {
  const v = Math.round(n);
  if (v < 400)  return `${C.green}${v}ms${C.reset}`;
  if (v < 1200) return `${C.yellow}${v}ms${C.reset}`;
  return `${C.red}${v}ms${C.reset}`;
};

// ── Suite state ──────────────────────────────────────────────────────────────
let passCount = 0, failCount = 0, warnCount = 0;
const timings = [];   // { label, latency, status, path, method }
const issues  = [];   // { label, path, issue, severity: ERROR|PERF|WARN|CRITICAL }
const data    = {};   // captured data keyed by label for cross-section checks

// ── Core helpers ──────────────────────────────────────────────────────────────
async function req(label, method, path, body, opts = {}) {
  const url = `${BASE}${path}`;
  const t0  = performance.now();
  let res, payload, latency, status;

  try {
    const fetchOpts = {
      method,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    };
    if (body) fetchOpts.body = JSON.stringify(body);
    res     = await fetch(url, fetchOpts);
    latency = performance.now() - t0;
    const text = await res.text();
    try { payload = JSON.parse(text); } catch { payload = { _raw: text }; }
    status  = res.status;
  } catch (err) {
    latency = performance.now() - t0;
    status  = 0;
    payload = { error: err.message };
  }

  timings.push({ label, latency, status, path, method });

  const statusStr = res?.ok
    ? `${C.green}${status}${C.reset}`
    : `${C.red}${status}${C.reset}`;

  if (res?.ok || opts.expectFail) {
    console.log(`  ${ok(label)} ${dim(method)} ${dim(path)} [${statusStr}] ${ms(latency)}`);
    passCount++;
  } else {
    console.log(`  ${fail(label)} ${dim(method)} ${dim(path)} [${statusStr}] ${ms(latency)}`);
    failCount++;
    const errMsg = payload?.error || payload?._raw?.slice(0, 120) || `HTTP ${status}`;
    issues.push({ label, path, issue: `HTTP ${status}: ${errMsg}`, severity: 'ERROR' });
  }

  return { payload, status, latency, ok: Boolean(res?.ok) };
}

function check(label, condition, detail = '') {
  if (condition) {
    passCount++;
    console.log(`  ${ok(label)}${detail ? dim(' — ' + detail) : ''}`);
  } else {
    failCount++;
    const msg = detail ? ` ${C.red}${detail}${C.reset}` : '';
    console.log(`  ${fail(label)}${msg}`);
    issues.push({ label, issue: detail || 'Assertion failed', severity: 'ERROR' });
  }
  return condition;
}

function chkWarn(label, condition, detail = '') {
  if (condition) {
    passCount++;
    console.log(`  ${ok(label)}${detail ? dim(' — ' + detail) : ''}`);
  } else {
    warnCount++;
    const msg = detail ? ` ${C.yellow}${detail}${C.reset}` : '';
    console.log(`  ${warn(label)}${msg}`);
    issues.push({ label, issue: detail || 'Check failed', severity: 'WARN' });
  }
  return condition;
}

function perf(label, latency, threshold, description = '') {
  const ok_ = latency < threshold;
  if (ok_) {
    passCount++;
    console.log(`  ${ok(`${label} latency`)} ${ms(latency)}${description ? dim(' — ' + description) : ''}`);
  } else {
    warnCount++;
    console.log(`  ${warn(`${label} latency`)} ${ms(latency)}${description ? ` ${C.yellow}${description}${C.reset}` : ''}`);
    issues.push({ label: `${label} latency`, issue: `${Math.round(latency)}ms exceeds ${threshold}ms — ${description || 'check for blocking operations'}`, severity: 'PERF' });
  }
  return ok_;
}

function section(title) { console.log(head(title)); }
function note(msg) { console.log(`  ${info(msg)}`); }
function sleep(ms_) { return new Promise(r => setTimeout(r, ms_)); }

// ── Unwrap payload helper ─────────────────────────────────────────────────────
const unwrap = (p) => p?.data ?? p;

// ═══════════════════════════════════════════════════════════════════════════
//  MAIN SUITE
// ═══════════════════════════════════════════════════════════════════════════
async function run() {
  console.log(`\n${C.bold}${C.magenta}╔══════════════════════════════════════════════╗`);
  console.log(`║   KINTO GLOBAL — E2E DIAGNOSTIC SUITE       ║`);
  console.log(`╚══════════════════════════════════════════════╝${C.reset}`);
  console.log(dim(`  Target : ${BASE}`));
  console.log(dim(`  Aid    : ${AID || 'auto-detect'}`));
  console.log(dim(`  Run at : ${new Date().toLocaleString()}\n`));

  // ────────────────────────────────────────────────────────────────────────
  section('1 · HEALTH CHECK');
  // ────────────────────────────────────────────────────────────────────────
  const health = await req('Health endpoint', 'GET', '/api/health');
  check('Health returns 200', health.ok, health.payload?.status || String(health.status));
  perf('Health', health.latency, 500, 'server cold start?');

  if (!health.ok) {
    console.log(`\n  ${C.bgRed}${C.white}  Server not reachable at ${BASE}  ${C.reset}`);
    console.log(`  ${C.yellow}Make sure your app is running:  npm run dev:full${C.reset}\n`);
    process.exit(2);
  }

  // ────────────────────────────────────────────────────────────────────────
  section('2 · CLIENTS & ASSESSMENTS');
  // ────────────────────────────────────────────────────────────────────────
  const clientsRes = await req('GET /api/clients', 'GET', '/api/clients');
  check('Clients returns OK', clientsRes.ok);
  const clientList = unwrap(clientsRes.payload);
  const clients = Array.isArray(clientList) ? clientList : (clientList?.clients ?? []);
  check('At least one client exists', clients.length > 0, `found ${clients.length}`);
  data.clientId   = clients[0]?.client_id;
  data.clientName = clients[0]?.client_name;
  note(`First client: ${data.clientName} (${data.clientId})`);

  const assmtsRes = await req('GET /api/assessments', 'GET', '/api/assessments');
  check('Assessments returns OK', assmtsRes.ok);
  const assmtList_ = unwrap(assmtsRes.payload);
  const assmts = Array.isArray(assmtList_) ? assmtList_ : (assmtList_?.assessments ?? []);
  check('At least one assessment exists', assmts.length > 0, `found ${assmts.length}`);
  // If --aid was passed, verify it exists; if not, auto-create a fresh one
  let resolvedAid = AID || assmts[0]?.assessment_id;

  if (AID) {
    // Validate the passed assessment ID exists in the assessments table directly
    // (Don't rely on module GETs which fall back to latest on missing ID)
    const allAssmts = assmts; // already fetched above
    const exists = allAssmts.some((a) =>
      String(a.assessment_id || '').toLowerCase() === AID.toLowerCase()
    );
    if (!exists) {
      console.log(`  ${warn(`Assessment ID ${AID} not found in DB (may have been deleted) — auto-creating fresh assessment`)}`);
      resolvedAid = null;
    } else {
      note(`Verified assessment ${AID} exists in DB`);
    }
  }

  if (!resolvedAid) {
    // Auto-create a fresh client + assessment for clean testing
    note('Auto-creating fresh client and assessment for E2E testing…');
    const ts = Date.now();
    const newClient = await req('POST /api/clients (auto)', 'POST', '/api/clients', {
      client_name: `E2E Auto ${ts}`, industry: 'Technology', company_size: 'Medium',
    });
    const clientId = newClient.payload?.data?.client_id ?? newClient.payload?.client_id;

    if (clientId) {
      const newAssmt = await req('POST /api/assessments (auto)', 'POST', '/api/assessments', {
        client_id: clientId, assessment_name: `E2E Auto ${ts}`, scope_type: 'enterprise',
      });
      resolvedAid = newAssmt.payload?.data?.assessment_id ?? newAssmt.payload?.assessment_id;
      note(`Auto-created assessment: ${resolvedAid}`);
    }
  }

  data.assessmentId   = resolvedAid;
  data.assessmentName = assmts[0]?.assessment_name || 'Auto-created';
  note(`Using assessment: ${data.assessmentName} (${data.assessmentId})`);

  if (!data.assessmentId) {
    issues.push({ label: 'Assessment', issue: 'No assessment found — create a client and assessment before running E2E', severity: 'CRITICAL' });
    console.log(`\n  ${C.bgRed}${C.white}  CRITICAL: No assessment found  ${C.reset}\n`);
    process.exit(2);
  }

  const AID_ENC = encodeURIComponent(data.assessmentId);

  // ────────────────────────────────────────────────────────────────────────
  section('3 · WORKSPACE SNAPSHOT');
  // ────────────────────────────────────────────────────────────────────────
  const wsRes = await req('GET /api/workspace', 'GET', `/api/workspace?assessmentId=${AID_ENC}`);
  check('Workspace returns OK', wsRes.ok);
  perf('Workspace snapshot', wsRes.latency, 2000, 'includes multiple DB joins');

  const wsData = unwrap(wsRes.payload);
  check('Workspace has modules[]', Array.isArray(wsData?.modules), `got ${typeof wsData?.modules}`);
  check('Workspace has clients[]', Array.isArray(wsData?.clients), `got ${typeof wsData?.clients}`);
  check('Workspace has assessments[]', Array.isArray(wsData?.assessments), `got ${typeof wsData?.assessments}`);
  chkWarn('Assessment snapshot present', Boolean(wsData?.assessmentSnapshot),
    'null until first report is generated — expected on fresh assessment');
  chkWarn('Workspace.modules has 5 diagnostic modules', (wsData?.modules?.length ?? 0) >= 5,
    `found ${wsData?.modules?.length ?? 0} modules`);

  data.modules = wsData?.modules ?? [];
  data.wsData  = wsData;
  note(`Modules: ${data.modules.map(m => `${m.module_code}(${Math.round(m.completion_pct || 0)}%)`).join(', ')}`);

  // ────────────────────────────────────────────────────────────────────────
  section('4 · REFERENCE DATA BUNDLES');
  // ────────────────────────────────────────────────────────────────────────
  const MODULE_CODES = ['OPS', 'LEAK', 'DATA', 'AIR', 'AIUC'];
  for (const code of MODULE_CODES) {
    const r = await req(`Reference: ${code}`, 'GET', `/api/reference/${code}`);
    check(`${code} reference returns OK`, r.ok);
    perf(code + ' reference', r.latency, 800, 'should be fast — static data');
    const bundle = unwrap(r.payload);
    if (code === 'OPS') {
      chkWarn('OPS has domains', Array.isArray(bundle?.domains), `count: ${bundle?.domains?.length ?? 0}`);
      chkWarn('OPS has questions', Array.isArray(bundle?.questions), `count: ${bundle?.questions?.length ?? 0}`);
    } else if (code === 'LEAK') {
      chkWarn('LEAK has cores', Boolean(bundle?.cores?.length || bundle?.model?.cores?.length),
        `cores: ${bundle?.cores?.length ?? bundle?.model?.cores?.length ?? 0}`);
    } else if (code === 'AIUC') {
      // AIUC reference bundle uses 'usecases' key, module GET uses 'questions' — both are valid
      const aiucCount = bundle?.questions?.length || bundle?.usecases?.length || 0;
      chkWarn(`${code} has questions/usecases`, aiucCount > 0, `count: ${aiucCount}`);
    } else {
      chkWarn(`${code} has questions`, Array.isArray(bundle?.questions), `count: ${bundle?.questions?.length ?? 0}`);
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  section('5 · MODULE GET — PAYLOAD INTEGRITY');
  // ────────────────────────────────────────────────────────────────────────
  const moduleRoutes = {
    OPS:  '/api/operational-audit',
    LEAK: '/api/revenue-leakage',
    DATA: '/api/data-foundation',
    AIR:  '/api/ai-readiness',
    AIUC: '/api/ai-use-cases',
  };

  for (const [code, path] of Object.entries(moduleRoutes)) {
    const r = await req(`GET ${code}`, 'GET', `${path}?assessmentId=${AID_ENC}`);
    check(`${code} GET returns OK`, r.ok, r.payload?.error || '');
    perf(code + ' GET', r.latency, 3000, 'cold first load acceptable, subsequent should be <1s');
    const d = unwrap(r.payload);
    data[code] = d;

    if (code === 'OPS') {
      check('OPS has bundle.questions',     Array.isArray(d?.bundle?.questions), `${d?.bundle?.questions?.length ?? 0} questions`);
      check('OPS has bundle.domains',       Array.isArray(d?.bundle?.domains),   `${d?.bundle?.domains?.length ?? 0} domains`);
      check('OPS has responses[]',          Array.isArray(d?.responses),         `${d?.responses?.length ?? 0} responses`);
      check('OPS has metricCaptures[]',     Array.isArray(d?.metricCaptures),    `${d?.metricCaptures?.length ?? 0} captures`);
      chkWarn('OPS has summary.domain_scores', Array.isArray(d?.summary?.domain_scores), `${d?.summary?.domain_scores?.length ?? 0} domains scored`);
      chkWarn('OPS has summary.roadmap',       Array.isArray(d?.summary?.roadmap),       `${d?.summary?.roadmap?.length ?? 0} roadmap items`);
    } else if (code === 'LEAK') {
      check('LEAK has state',               Boolean(d?.state),                   'state object');
      check('LEAK has summary',             Boolean(d?.summary),                 'summary object');
      check('LEAK has benchmarkProfiles[]', Array.isArray(d?.benchmarkProfiles), `${d?.benchmarkProfiles?.length ?? 0} profiles`);
      chkWarn('LEAK has core_rows',         Array.isArray(d?.summary?.core_rows), `${d?.summary?.core_rows?.length ?? 0} cores`);
      chkWarn('LEAK benchmark profile set', Boolean(d?.state?.benchmarkProfile), d?.state?.benchmarkProfile || 'NONE — select one in Assessment tab');
    } else {
      check(`${code} has questions[]`,      Array.isArray(d?.questions),         `${d?.questions?.length ?? 0} questions`);
      check(`${code} has responses[]`,      Array.isArray(d?.responses),         `${d?.responses?.length ?? 0} responses`);
      check(`${code} has domainScores[]`,   Array.isArray(d?.domainScores),      `${d?.domainScores?.length ?? 0} domains`);
      chkWarn(`${code} has moduleScore`,    d?.moduleScore !== undefined,        d?.moduleScore ? `${Math.round(d.moduleScore.score_pct || 0)}%` : 'null (score questions first)');
      chkWarn(`${code} has findingsPreview`, Array.isArray(d?.findingsPreview),  `${d?.findingsPreview?.length ?? 0} findings`);
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  section('6 · OPS SCORE SAVE — LATENCY & PERSISTENCE TRACE');
  // ────────────────────────────────────────────────────────────────────────
  const opsData   = data.OPS;
  const testQ     = opsData?.bundle?.questions?.[0];
  const qId       = testQ?.question_id;

  if (!qId) {
    console.log(`  ${warn('OPS score save skipped — no questions loaded from bundle')}`);
    issues.push({ label: 'OPS questions', issue: 'Bundle returned 0 questions — check getReferenceBundle(OPS)', severity: 'ERROR' });
  } else {
    const prevScore = (opsData?.responses ?? []).find(r => r.question_id === qId)?.score_1_to_5;
    const newScore  = prevScore === 3 ? 4 : 3;
    note(`Save test: ${qId} → score ${newScore} (was ${prevScore ?? 'unscored'})`);

    // ── Save the score
    const t0   = performance.now();
    const save = await req(`POST OPS score (${qId})`, 'POST', '/api/operational-audit', {
      assessmentId: data.assessmentId,
      action: 'update-question',
      questionId: qId,
      score: newScore,
    });
    const saveMs = performance.now() - t0;

    check('OPS save returns 200', save.ok, save.payload?.error || '');
    perf('OPS save (fast-write)', saveMs, 1500,
      saveMs > 1500
        ? 'SLOW — fast-write may be blocked by synchronous recompute'
        : 'fast-write working correctly');

    // ── Verify optimistic data in response
    const savedPayload   = unwrap(save.payload);
    const respInResponse = (savedPayload?.responses ?? []).find(r => r.question_id === qId);
    chkWarn('Score reflected in immediate response',
      respInResponse?.score_1_to_5 === newScore,
      respInResponse ? `got ${respInResponse.score_1_to_5}` : 'question not in response.responses');

    // ── Wait for background recompute
    note('Waiting 2s for background recompute…');
    await sleep(2000);

    // ── Re-fetch and verify persistence
    const refetch = await req('GET OPS after save', 'GET', `/api/operational-audit?assessmentId=${AID_ENC}`);
    check('Re-fetch returns OK', refetch.ok);
    const refetchData    = unwrap(refetch.payload);
    const persistedRow   = (refetchData?.responses ?? []).find(r => r.question_id === qId);
    check('Score persisted to DB',
      persistedRow?.score_1_to_5 === newScore,
      persistedRow ? `persisted as ${persistedRow.score_1_to_5}` : 'row not found after refetch');

    // ── Check summary reflects new score
    chkWarn('OPS summary.answered updated',
      (refetchData?.summary?.answered ?? 0) >= (opsData?.summary?.answered ?? 0),
      `before: ${opsData?.summary?.answered ?? 0}, after: ${refetchData?.summary?.answered ?? 0}`);

    // ── Workspace reflects new state
    const ws2    = await req('Workspace after OPS save', 'GET', `/api/workspace?assessmentId=${AID_ENC}`);
    const ws2Data = unwrap(ws2.payload);
    const opsMod  = (ws2Data?.modules ?? []).find(m => m.module_code === 'OPS');
    chkWarn('Workspace OPS card has progress',
      (opsMod?.completion_pct ?? 0) > 0,
      `completion_pct: ${opsMod?.completion_pct ?? 'N/A'}`);

    data.postSaveWorkspace = ws2Data;
  }

  // ────────────────────────────────────────────────────────────────────────
  section('7 · OPS BULK SCORE');
  // ────────────────────────────────────────────────────────────────────────
  const bulkQs = (opsData?.bundle?.questions ?? []).slice(1, 4);
  if (bulkQs.length === 0) {
    console.log(`  ${warn('Bulk score skipped — not enough questions')}`);
  } else {
    const t0 = performance.now();
    const bulk = await req(`POST OPS bulk-score (${bulkQs.length} questions)`, 'POST', '/api/operational-audit', {
      assessmentId: data.assessmentId,
      action: 'bulk-score',
      updates: bulkQs.map(q => ({ questionId: q.question_id, score: 3 })),
    });
    const bulkMs = performance.now() - t0;
    check('Bulk score returns OK', bulk.ok, bulk.payload?.error || '');
    perf('OPS bulk save', bulkMs, 2000, `${bulkQs.length} questions`);
  }

  // ────────────────────────────────────────────────────────────────────────
  section('8 · GENERIC MODULE SAVES (DATA, AIR, AIUC)');
  // ────────────────────────────────────────────────────────────────────────
  const genericSaveRoutes = {
    DATA: '/api/data-foundation',
    AIR:  '/api/ai-readiness',
    AIUC: '/api/ai-use-cases',
  };

  for (const [code, path] of Object.entries(genericSaveRoutes)) {
    const moduleData = data[code];
    const firstQ     = moduleData?.questions?.[0];
    if (!firstQ) {
      console.log(`  ${warn(`${code} save skipped — no questions`)}`);
      issues.push({ label: `${code} questions`, issue: 'No questions returned — check module library', severity: 'WARN' });
      continue;
    }

    const t0   = performance.now();
    const save = await req(`POST ${code} score`, 'POST', path, {
      assessmentId: data.assessmentId,
      questionId: firstQ.question_id,
      score: 3,
    });
    const saveMs = performance.now() - t0;

    check(`${code} save returns OK`, save.ok, save.payload?.error || '');
    perf(`${code} save`, saveMs, 1500,
      saveMs > 1500
        ? 'SLOW — fast-write not active? check route uses fastWriteQuestionScore'
        : 'fast-write working');

    const saved = unwrap(save.payload);
    const savedRow = (saved?.responses ?? []).find(r => r.question_id === firstQ.question_id);
    chkWarn(`${code} score in response`,
      savedRow?.score_1_to_5 === 3,
      savedRow ? `score: ${savedRow.score_1_to_5}` : 'not found in response');
  }

  // ────────────────────────────────────────────────────────────────────────
  section('9 · REVENUE LEAKAGE SAVE FLOW');
  // ────────────────────────────────────────────────────────────────────────
  const leakData = data.LEAK;
  const firstCore = leakData?.summary?.core_rows?.[0]?.name
    ?? leakData?.model?.cores?.[0]?.name;

  if (!firstCore) {
    console.log(`  ${warn('LEAK save skipped — no cores available')}`);
    issues.push({ label: 'LEAK cores', issue: 'No core_rows returned — check leakage library and benchmark profile', severity: 'WARN' });
  } else {
    note(`Testing LEAK core update: "${firstCore}"`);
    const currentActual = leakData?.summary?.core_rows?.[0]?.actual ?? 0;
    const testVal = currentActual === 100 ? 90 : 100;

    const t0 = performance.now();
    const save = await req(`POST LEAK update-core`, 'POST', '/api/revenue-leakage', {
      assessmentId: data.assessmentId,
      action: 'update-core',
      coreName: firstCore,
      field: 'actual',
      value: testVal,
    });
    const saveMs = performance.now() - t0;

    check('LEAK save returns OK', save.ok, save.payload?.error || '');
    perf('LEAK save', saveMs, 2000, saveMs > 2000 ? 'SLOW — scheduleRecompute not applied? check LEAK POST handler' : 'fast-write working');

    const savedLeak = unwrap(save.payload);
    chkWarn('LEAK summary present in response', Boolean(savedLeak?.summary), 'leakage recalculates on every save');
    chkWarn('LEAK total_leakage is number', typeof savedLeak?.summary?.total_leakage === 'number',
      `type: ${typeof savedLeak?.summary?.total_leakage}`);
  }

  // ────────────────────────────────────────────────────────────────────────
  section('10 · METRIC SAVES');
  // ────────────────────────────────────────────────────────────────────────
  const metricPayload = {
    assessmentId: data.assessmentId,
    metricId: 'PLACEHOLDER',
    workflowId: '',
    currentValue: '75',
    targetValue: '85',
    trendDirection: 'Up',
    ragStatus: 'Amber',
  };

  // OPS metric save via module-level route
  const opsMetric = (data.OPS?.metricCaptures ?? [])[0]
    ?? (data.OPS?.bundle?.questions ?? []).find(q => q.metric_id)?.metric_id;
  const opsMetricId = data.OPS?.bundle?.primary_metric_by_workflow
    ? Object.values(data.OPS.bundle.primary_metric_by_workflow)[0]?.metric_id
    : null;

  if (opsMetricId) {
    const t0 = performance.now();
    const ms_ = await req('POST OPS metric', 'POST', '/api/operational-audit', {
      assessmentId: data.assessmentId,
      action: 'update-metric',
      metricId: opsMetricId,
      workflowId: Object.keys(data.OPS?.bundle?.primary_metric_by_workflow ?? {})[0] ?? '',
      currentValue: '72',
      targetValue: '85',
      trendDirection: 'Up',
      ragStatus: 'Amber',
    });
    perf('OPS metric save', performance.now() - t0, 2000);
    check('OPS metric save OK', ms_.ok, ms_.payload?.error || '');
  } else {
    note('OPS metric save skipped — no metric IDs available from bundle');
  }

  // Generic module metric route
  for (const code of ['DATA', 'AIR', 'AIUC']) {
    const mCaptures = data[code]?.metricCaptures ?? [];
    if (mCaptures.length === 0) { note(`${code} metric save skipped — no metrics`); continue; }
    const mRow = mCaptures[0];
    const t0   = performance.now();
    const mr = await req(`POST ${code} metric`, 'POST',
      `/api/assessments/${AID_ENC}/modules/${code}/metric`, {
        assessmentId: data.assessmentId,
        metricId: mRow.metric_id,
        workflowId: mRow.workflow_id ?? '',
        currentValue: '70',
        targetValue: '80',
        trendDirection: 'Flat',
        ragStatus: 'Amber',
      });
    perf(`${code} metric save`, performance.now() - t0, 3000);
    chkWarn(`${code} metric save OK`, mr.ok || mr.status === 404, `status: ${mr.status}`);
  }

  // ────────────────────────────────────────────────────────────────────────
  section('11 · MODULE SUMMARY ROUTES');
  // ────────────────────────────────────────────────────────────────────────
  for (const code of MODULE_CODES) {
    const r = await req(`GET ${code} summary`, 'GET',
      `/api/assessments/${AID_ENC}/modules/${code}/summary`);
    chkWarn(`${code} summary route OK`, r.ok || r.status === 404,
      r.ok ? 'populated' : `${r.status} — may not exist until first scoring`);
    if (r.ok) {
      const s = unwrap(r.payload);
      chkWarn(`${code} summary has score_pct`, s?.score_pct != null || s?.module_score?.score_pct != null,
        `score: ${s?.score_pct ?? s?.module_score?.score_pct ?? 'N/A'}`);
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  section('12 · REPORT ROUTES');
  // ────────────────────────────────────────────────────────────────────────
  for (const code of MODULE_CODES) {
    const r = await req(`GET ${code} report`, 'GET',
      `/api/assessments/${AID_ENC}/report/${code}`);
    chkWarn(`${code} report GET OK`, r.ok || r.status === 404,
      r.ok ? 'report exists' : 'not yet generated — expected on fresh assessment');
    if (r.ok) {
      const rData = unwrap(r.payload);
      chkWarn(`${code} report has artifacts`, Array.isArray(rData?.artifacts),
        `artifacts: ${rData?.artifacts?.length ?? 0}`);
      chkWarn(`${code} report has payload`, Boolean(rData?.payload),
        'payload is the JSON content used by the template engine');
    }
  }

  const intgReport = await req('GET integrated report', 'GET',
    `/api/assessments/${AID_ENC}/report`);
  chkWarn('Integrated report GET OK', intgReport.ok || intgReport.status === 404,
    intgReport.ok ? 'exists' : 'not yet generated');

  // ────────────────────────────────────────────────────────────────────────
  section('13 · ROADMAP & PUBLICATIONS');
  // ────────────────────────────────────────────────────────────────────────
  const roadmapRes = await req('GET assessment roadmap', 'GET',
    `/api/assessments/${AID_ENC}/roadmap`);
  chkWarn('Roadmap route OK', roadmapRes.ok || roadmapRes.status === 404, `status: ${roadmapRes.status}`);
  if (roadmapRes.ok) {
    const rData = unwrap(roadmapRes.payload);
    chkWarn('Roadmap has items', (Array.isArray(rData) ? rData : rData?.items ?? []).length > 0,
      'populates after scoring — empty on fresh assessment');
  }

  const pubsRes = await req('GET publications', 'GET',
    `/api/assessments/${AID_ENC}/publications`);
  chkWarn('Publications route OK', pubsRes.ok || pubsRes.status === 404, `status: ${pubsRes.status}`);

  // ────────────────────────────────────────────────────────────────────────
  section('14 · DATA FLOW INTEGRITY CHECKS');
  // ────────────────────────────────────────────────────────────────────────
  note('Verifying data flows correctly end-to-end');

  // OPS data flow
  const opsD    = data.OPS;
  if (opsD) {
    const qTotal  = opsD.bundle?.questions?.length ?? 0;
    const rTotal  = opsD.responses?.length ?? 0;
    const answered = opsD.responses?.filter(r => Number(r.score_1_to_5 || 0) > 0).length ?? 0;
    note(`OPS: ${qTotal} questions, ${rTotal} in DB, ${answered} scored`);
    check('OPS question count > 0', qTotal > 0, `${qTotal} questions from bundle`);
    chkWarn('OPS responses ≤ questions', rTotal <= qTotal,
      rTotal > qTotal ? `${rTotal} responses for ${qTotal} questions — orphaned rows?` : 'OK');
    const summAnswered = opsD.summary?.answered ?? 0;
    chkWarn('OPS summary.answered matches responses',
      Math.abs(summAnswered - answered) <= 2,
      `summary.answered=${summAnswered}, actual scored=${answered}${Math.abs(summAnswered - answered) > 2 ? ' — STALE SNAPSHOT' : ''}`);
  }

  // Generic module data flow
  for (const code of ['DATA', 'AIR', 'AIUC']) {
    const d = data[code];
    if (!d) continue;
    const qCount    = d.questions?.length ?? 0;
    const rCount    = d.responses?.length ?? 0;
    const answered_ = d.responses?.filter(r => Number(r.score_1_to_5 || 0) > 0).length ?? 0;
    note(`${code}: ${qCount} questions, ${answered_} scored`);
    check(`${code} has questions loaded`, qCount > 0, `${qCount} from library`);
    chkWarn(`${code} domain scores count matches library`,
      (d.domainScores?.length ?? 0) > 0,
      `${d.domainScores?.length ?? 0} domain score rows`);
  }

  // LEAK data flow
  const leakD = data.LEAK;
  if (leakD) {
    const cores = leakD.summary?.core_rows ?? [];
    check('LEAK has 9 core rows', cores.length === 9, `got ${cores.length} (expected 9)`);
    chkWarn('LEAK total_leakage calculated', typeof leakD.summary?.total_leakage === 'number',
      `value: ${leakD.summary?.total_leakage}`);
    chkWarn('LEAK has driver rows', cores.every(c => Array.isArray(c.driver_rows)),
      'each core should have driver_rows array');
    const allDrivers = cores.flatMap(c => c.driver_rows ?? []);
    note(`LEAK: ${cores.length} cores, ${allDrivers.length} total drivers`);
  }

  // Workspace → module card alignment
  for (const code of ['OPS', 'DATA', 'AIR', 'AIUC']) {
    const card     = data.modules.find(m => m.module_code === code);
    const moduleD  = data[code];
    if (!card || !moduleD) continue;
    const cardPct  = Math.round(card.completion_pct ?? 0);
    const summPct  = code === 'OPS'
      ? Math.round(moduleD.summary?.completion_pct ?? 0)
      : Math.round(moduleD.moduleScore?.completion_pct ?? 0);
    if (summPct === 0 && cardPct === 0) continue; // both zero = fresh, that's fine
    chkWarn(`${code} workspace card matches module summary`,
      Math.abs(cardPct - summPct) <= 5,
      `card: ${cardPct}%, summary: ${summPct}%${Math.abs(cardPct - summPct) > 5 ? ' — STALE SNAPSHOT (recompute lag)' : ''}`);
  }

  // ────────────────────────────────────────────────────────────────────────
  section('15 · LATENCY DEEP-DIVE');
  // ────────────────────────────────────────────────────────────────────────
  const sorted = [...timings].sort((a, b) => b.latency - a.latency);

  console.log(`\n  ${bold('Top 10 slowest operations:')}`);
  sorted.slice(0, 10).forEach(t => {
    const icon = t.latency > 3000 ? '🔴' : t.latency > 1000 ? '🟡' : '🟢';
    console.log(`  ${icon}  ${ms(t.latency).padEnd(20)} ${dim(t.method)} ${t.label}`);
  });

  const gets  = timings.filter(t => t.method === 'GET');
  const posts = timings.filter(t => t.method === 'POST');
  const avgGet  = gets.length  ? gets.reduce((s, t)  => s + t.latency, 0) / gets.length  : 0;
  const avgPost = posts.length ? posts.reduce((s, t) => s + t.latency, 0) / posts.length : 0;

  console.log(`\n  ${bold('Averages:')}`);
  console.log(`  GET  avg: ${ms(avgGet)}  (${gets.length} requests)`);
  console.log(`  POST avg: ${ms(avgPost)}  (${posts.length} requests)`);

  const slowGets  = gets.filter(t => t.latency > 1500);
  const slowPosts = posts.filter(t => t.latency > 2500);
  if (slowGets.length) {
    console.log(`\n  ${C.yellow}Slow GETs (>1.5s) — likely Supabase cold start or missing snapshot:${C.reset}`);
    slowGets.forEach(t => console.log(`  🟡 ${ms(t.latency)} ${t.label}`));
    issues.push({ label: 'Slow GETs', issue: `${slowGets.length} GET(s) over 1.5s: ${slowGets.map(t => t.label).join(', ')} — check for missing indexes or unbuilt snapshots`, severity: 'PERF' });
  }
  if (slowPosts.length) {
    console.log(`\n  ${C.red}Slow POSTs (>2.5s) — likely blocking synchronous recompute:${C.reset}`);
    slowPosts.forEach(t => console.log(`  🔴 ${ms(t.latency)} ${t.label}`));
    issues.push({ label: 'Slow POSTs', issue: `${slowPosts.length} POST(s) over 2.5s: ${slowPosts.map(t => t.label).join(', ')} — apply fast-write + background recompute pattern`, severity: 'PERF' });
  }

  // ────────────────────────────────────────────────────────────────────────
  section('16 · ROUTE COVERAGE MAP');
  // ────────────────────────────────────────────────────────────────────────
  const allRoutes = [
    ['GET',  '/api/health'],
    ['GET',  '/api/clients'],
    ['POST', '/api/clients'],
    ['GET',  '/api/assessments'],
    ['POST', '/api/assessments'],
    ['GET',  '/api/workspace'],
    ['GET',  '/api/reference/:code'],
    ['GET',  '/api/operational-audit'],
    ['POST', '/api/operational-audit (update-question)'],
    ['POST', '/api/operational-audit (bulk-score)'],
    ['POST', '/api/operational-audit (update-metric)'],
    ['GET',  '/api/revenue-leakage'],
    ['POST', '/api/revenue-leakage (update-core)'],
    ['POST', '/api/revenue-leakage (update-driver)'],
    ['POST', '/api/revenue-leakage (update-support)'],
    ['POST', '/api/revenue-leakage (set-benchmark-profile)'],
    ['GET',  '/api/data-foundation'],
    ['POST', '/api/data-foundation'],
    ['GET',  '/api/ai-readiness'],
    ['POST', '/api/ai-readiness'],
    ['GET',  '/api/ai-use-cases'],
    ['POST', '/api/ai-use-cases'],
    ['GET',  '/api/assessments/:id/modules/:code/summary'],
    ['GET',  '/api/assessments/:id/modules/:code/metric'],
    ['POST', '/api/assessments/:id/modules/:code/metric'],
    ['GET',  '/api/assessments/:id/report'],
    ['POST', '/api/assessments/:id/report'],
    ['GET',  '/api/assessments/:id/report/:code'],
    ['POST', '/api/assessments/:id/report/:code'],
    ['GET',  '/api/assessments/:id/roadmap'],
    ['GET',  '/api/assessments/:id/publications'],
    ['GET',  '/api/reports/artifacts/:id'],
    ['GET',  '/api/assessments/:id/presentation'],
  ];

  const hitRoutes = new Set(timings.map(t => `${t.method} ${t.path}`));
  const coverageRows = allRoutes.map(([method, route]) => {
    const key = `${method} ${route}`.toLowerCase();
    const hit = [...hitRoutes].some(h => {
      const clean = route.replace(/:[^/]+/g, '').replace(/\s.*/, '');
      return h.toLowerCase().includes(clean.toLowerCase());
    });
    return { method, route, hit };
  });

  const hitCount_  = coverageRows.filter(c => c.hit).length;
  const missCount_ = coverageRows.filter(c => !c.hit).length;
  console.log(`\n  Coverage: ${C.green}${hitCount_}${C.reset} hit / ${C.yellow}${missCount_}${C.reset} not tested this run`);

  const untested = coverageRows.filter(c => !c.hit);
  if (untested.length) {
    console.log(`\n  ${C.yellow}Routes not exercised this run:${C.reset}`);
    untested.forEach(r => console.log(`  ${dim('○')} ${r.method} ${r.route}`));
    console.log(dim('\n  (These require a generated report, artifact, or specific action to test)'));
  }

  // ════════════════════════════════════════════════════════════════════════
  section('RESULTS & ROOT CAUSE REPORT');
  // ════════════════════════════════════════════════════════════════════════
  const total   = passCount + failCount + warnCount;
  const pctPass = total > 0 ? Math.round((passCount / total) * 100) : 0;

  const scoreColor = pctPass >= 90 ? C.green : pctPass >= 70 ? C.yellow : C.red;
  console.log(`\n  ${bold('Results:')}`);
  console.log(`  ${C.green}✓ Passed  :${C.reset} ${passCount}`);
  console.log(`  ${C.red}✗ Failed  :${C.reset} ${failCount}`);
  console.log(`  ${C.yellow}⚠ Warnings:${C.reset} ${warnCount}`);
  console.log(`  ${bold('Score     :')} ${scoreColor}${pctPass}%${C.reset} (${total} checks total)`);

  if (issues.length === 0) {
    console.log(`\n  ${C.bgGreen}${C.white}  ALL CHECKS PASSED — NO ISSUES DETECTED  ${C.reset}\n`);
    process.exit(0);
  }

  console.log(`\n  ${bold('Root Cause Report (priority order):')}`);

  const bySeverity = { CRITICAL: [], ERROR: [], PERF: [], WARN: [] };
  issues.forEach(i => (bySeverity[i.severity] = bySeverity[i.severity] ?? []).push(i));

  const LABELS = {
    CRITICAL: `${C.bgRed}${C.white} CRITICAL ${C.reset}`,
    ERROR:    `${C.red}ERROR${C.reset}`,
    PERF:     `${C.yellow}PERFORMANCE${C.reset}`,
    WARN:     `${C.yellow}WARNING${C.reset}`,
  };
  const FIXES = {
    CRITICAL: 'Fix immediately — system non-functional until resolved',
    ERROR:    'Fix before testing further — data may be corrupt or missing',
    PERF:     'Fix for production — directly causing user-facing slowness',
    WARN:     'Investigate — data may be incomplete, stale, or misconfigured',
  };

  for (const sev of ['CRITICAL', 'ERROR', 'PERF', 'WARN']) {
    const list = bySeverity[sev];
    if (!list?.length) continue;
    console.log(`\n  ${LABELS[sev]} — ${FIXES[sev]}`);
    list.forEach(i => console.log(`  ▸ ${bold('[' + i.label + ']')} ${i.issue}`));
  }

  console.log(`\n${dim('──────────────────────────────────────────────────────────────────')}`);
  console.log(dim(`Re-run:  node e2e/kinto-diagnostics.mjs --base ${BASE} --aid ${data.assessmentId}`));
  console.log('');

  process.exit(failCount > 0 ? 1 : 0);
}

run().catch(err => {
  console.error(`\n${C.red}Suite crashed:${C.reset}`, err.message);
  console.error(err.stack);
  process.exit(2);
});
