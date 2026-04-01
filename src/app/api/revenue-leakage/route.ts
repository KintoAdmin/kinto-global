// @ts-nocheck
import { proxyToPythonIfAvailable } from '@/lib/python-engine/proxy';
import { jsonError, jsonOk, parseJson } from '@/lib/api/http';
import { cacheResolved, getCachedResolved } from '@/lib/repositories/assessment-cache';
import { getAssessmentById, getLatestAssessment, ensureAssessmentModules, getAssessmentModule } from '@/lib/repositories/assessments';
import { getModuleSnapshot } from '@/lib/repositories/foundation';
import {
  computeAndPersistLeakage,
  computeLeakage,
  getLeakageBundle,
  getLeakageState,
  saveLeakageState,
  setLeakageBenchmarkProfile,
} from '@/lib/services/leakage';
import type { LeakState } from '@/lib/types/domain';
import { scheduleRecompute } from '@/lib/services/background-recompute';
import { availableProfiles } from '@/lib/reference/local/leakage';

async function resolveAssessmentId(input?: string | null) {
  if (input) {
    const cached = getCachedResolved(input);
    if (cached) return cached;
    const assessment = await getAssessmentById(input);
    if (!assessment) throw new Error(`Assessment ${input} was not found.`);
    await ensureAssessmentModules(assessment.assessment_id);
    const resolved = assessment.assessment_id as string;
    cacheResolved(input, resolved);
    return resolved;
  }
  const latest = await getLatestAssessment();
  if (!latest?.assessment_id) {
    throw new Error('No assessment found. Create a client and assessment first.');
  }
  const latestId = latest.assessment_id as string;
  if (!getCachedResolved(latestId)) {
    await ensureAssessmentModules(latestId);
    cacheResolved(latestId, latestId);
  }
  return latestId;
}

function hasSnapshotContent(snapshot: any) {
  if (!snapshot) return false;
  return Boolean(
    (snapshot.summary_payload && Object.keys(snapshot.summary_payload).length) ||
    (Array.isArray(snapshot.findings_payload) && snapshot.findings_payload.length) ||
    (Array.isArray(snapshot.roadmap_payload) && snapshot.roadmap_payload.length) ||
    (Array.isArray(snapshot.metrics_payload) && snapshot.metrics_payload.length)
  );
}

async function buildPayload(assessmentId: string) {
  const bundle = (await getLeakageBundle()) as {
    model: { cores: any[] };
    benchmarks: Record<string, string>[];
  };
  const state = await getLeakageState(assessmentId, { persistIfMissing: false });
  let module = await getAssessmentModule(assessmentId, 'LEAK');
  let snapshot = await getModuleSnapshot(assessmentId, 'LEAK');
  let summary = (module?.summary_payload as Record<string, any> | null) || (snapshot?.summary_payload as Record<string, any> | null) || null;

  if (!hasSnapshotContent(snapshot) || !summary || !Object.keys(summary).length) {
    summary = await computeAndPersistLeakage(assessmentId);
    module = await getAssessmentModule(assessmentId, 'LEAK');
    snapshot = await getModuleSnapshot(assessmentId, 'LEAK');
  }

  const safeSummary = summary || computeLeakage(bundle, state);

  return {
    assessmentId,
    model: bundle.model,
    benchmarkProfiles: availableProfiles(bundle.benchmarks),
    state,
    summary: safeSummary,
    moduleScore: {
      score_pct: Number(snapshot?.score_pct || 0),
      maturity_band: snapshot?.maturity_band || null,
      domains_completed: Number((safeSummary as any)?.complete_cores || 0),
      domains_total: Number((safeSummary as any)?.total_cores || 0),
      is_complete: Boolean((safeSummary as any)?.is_complete),
    },
    findings: Array.isArray(snapshot?.findings_payload) ? snapshot.findings_payload : [],
    roadmap: Array.isArray(snapshot?.roadmap_payload) ? snapshot.roadmap_payload : [],
    metrics: Array.isArray(snapshot?.metrics_payload) ? snapshot.metrics_payload : [],
  };
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function cloneState(state: LeakState): LeakState {
  return JSON.parse(JSON.stringify(state)) as LeakState;
}

type RevenueLeakageAction =
  | { action: 'set-benchmark-profile'; assessmentId?: string; profileName: string }
  | { action: 'update-profile'; assessmentId?: string; profile: Record<string, string> }
  | { action: 'update-core'; assessmentId?: string; coreName: string; field: 'actual' | 'benchmark'; value: number }
  | { action: 'update-support'; assessmentId?: string; coreName: string; supportKey: string; value: number }
  | { action: 'update-driver'; assessmentId?: string; coreName: string; driverName: string; field: 'actual' | 'benchmark'; value: number };

// Fast payload: computes leakage in-memory from current state (no DB writes).
// Returns within ~50ms. Background recompute will persist the full snapshot.
async function buildPayloadFast(assessmentId: string, state: LeakState) {
  const bundle = (await getLeakageBundle()) as { model: { cores: any[] }; benchmarks: Record<string, string>[] };
  const snapshot = await getModuleSnapshot(assessmentId, 'LEAK');
  const summary = computeLeakage(bundle, state);
  return {
    assessmentId,
    model: bundle.model,
    benchmarkProfiles: availableProfiles(bundle.benchmarks),
    state,
    summary,
    moduleScore: {
      score_pct: Number(snapshot?.score_pct || 0),
      maturity_band: snapshot?.maturity_band || null,
      domains_completed: Number((summary as any)?.complete_cores || 0),
      domains_total: Number((summary as any)?.total_cores || 0),
      is_complete: Boolean((summary as any)?.is_complete),
    },
    findings: Array.isArray(snapshot?.findings_payload) ? snapshot.findings_payload : [],
    roadmap: Array.isArray(snapshot?.roadmap_payload) ? snapshot.roadmap_payload : [],
    metrics: Array.isArray(snapshot?.metrics_payload) ? snapshot.metrics_payload : [],
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const assessmentId = await resolveAssessmentId(searchParams.get('assessmentId'));

    // Snapshot-first: only call Python on cold start (no snapshot yet)
    const snapshot = await getModuleSnapshot(assessmentId, 'LEAK');
    const hasSnapshot = hasSnapshotContent(snapshot);

    if (!hasSnapshot) {
      const python = await proxyToPythonIfAvailable(request, '/revenue-leakage');
      if (python) return python;
    }

    const payload = await buildPayload(assessmentId);
    return jsonOk(payload);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  // NOTE: No Python proxy on POST — fast-write handles all saves directly.
  try {
    const body = await parseJson<RevenueLeakageAction>(request);
    const assessmentId = await resolveAssessmentId(body.assessmentId);

    if (body.action === 'set-benchmark-profile') {
      await setLeakageBenchmarkProfile(assessmentId, body.profileName);
      scheduleRecompute(assessmentId, 'LEAK');
      return jsonOk(await buildPayload(assessmentId));
    }

    const current = await getLeakageState(assessmentId);
    const next = cloneState(current);

    if (body.action === 'update-profile') {
      next.profile = { ...next.profile, ...body.profile };
      await saveLeakageState(assessmentId, next);
      scheduleRecompute(assessmentId, 'LEAK');
      return jsonOk(await buildPayloadFast(assessmentId, next));
    }

    if (body.action === 'update-core') {
      const core = next.cores[body.coreName];
      if (!core) throw new Error(`Core ${body.coreName} not found.`);
      core[body.field] = toNumber(body.value);
      await saveLeakageState(assessmentId, next);
      scheduleRecompute(assessmentId, 'LEAK');
      return jsonOk(await buildPayloadFast(assessmentId, next));
    }

    if (body.action === 'update-support') {
      const core = next.cores[body.coreName];
      if (!core) throw new Error(`Core ${body.coreName} not found.`);
      core.support = { ...(core.support || {}), [body.supportKey]: toNumber(body.value) };
      await saveLeakageState(assessmentId, next);
      scheduleRecompute(assessmentId, 'LEAK');
      return jsonOk(await buildPayloadFast(assessmentId, next));
    }

    if (body.action === 'update-driver') {
      const core = next.cores[body.coreName];
      if (!core) throw new Error(`Core ${body.coreName} not found.`);
      const existingDriver = core.drivers?.[body.driverName] || { actual: 0, benchmark: 0 };
      core.drivers = {
        ...(core.drivers || {}),
        [body.driverName]: {
          ...existingDriver,
          [body.field]: toNumber(body.value),
        },
      };
      await saveLeakageState(assessmentId, next);
      scheduleRecompute(assessmentId, 'LEAK');
      return jsonOk(await buildPayloadFast(assessmentId, next));
    }

    throw new Error('Unsupported Revenue Leakage action.');
  } catch (error) {
    return jsonError(error);
  }
}
