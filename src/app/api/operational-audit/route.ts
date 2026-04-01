import { proxyToPythonIfAvailable } from '@/lib/python-engine/proxy';
import { jsonError, jsonOk, parseJson } from '@/lib/api/http';
import { cacheResolved, getCachedResolved } from '@/lib/repositories/assessment-cache';
import { getAssessmentById, getLatestAssessment, ensureAssessmentModules } from '@/lib/repositories/assessments';
import { listMetricCaptures, listQuestionResponses, upsertMetricCapture, upsertQuestionResponse } from '@/lib/repositories/runtime';
import { getModuleSnapshot } from '@/lib/repositories/foundation';
import { buildAuditSummary } from '@/lib/services/audit';
import { getReferenceBundle } from '@/lib/reference/bundle';
import { parseNumeric, calculateVarianceToTarget } from '@/lib/services/common';
import { scheduleRecompute } from '@/lib/services/background-recompute';

async function resolveAssessmentId(input?: string | null) {
  if (input) {
    // Check in-process cache first — avoids 2-3 DB roundtrips per save
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
  if (!latest?.assessment_id) throw new Error('No assessment found. Create a client and assessment first.');
  const latestId = latest.assessment_id as string;
  const latestCached = getCachedResolved(latestId);
  if (!latestCached) {
    await ensureAssessmentModules(latestId);
    cacheResolved(latestId, latestId);
  }
  return latestId;
}

async function buildPayload(assessmentId: string) {
  const bundle = (await getReferenceBundle('OPS')) as any;
  const [responses, metricCaptures, snapshot] = await Promise.all([
    listQuestionResponses(assessmentId, 'OPS'),
    listMetricCaptures(assessmentId, 'OPS'),
    getModuleSnapshot(assessmentId, 'OPS'),
  ]);
  // Use cached snapshot if available, otherwise build lightweight summary
  const summary = snapshot?.summary_payload || await buildAuditSummary(assessmentId);
  return { assessmentId, bundle: { domains: bundle.domains, workflows_by_domain: bundle.workflows_by_domain, steps_by_workflow: bundle.steps_by_workflow, questions_by_step: bundle.questions_by_step, questions: bundle.questions, roadmap_rows: bundle.roadmap_rows, primary_metric_by_workflow: bundle.primary_metric_by_workflow, metric_map: bundle.metric_map }, responses, metricCaptures, summary };
}

type UpdateQuestionAction = { action: 'update-question'; assessmentId?: string; questionId: string; score?: number; notes?: string; evidenceSummary?: string };
type BulkScoreAction = { action: 'bulk-score'; assessmentId?: string; updates: Array<{ questionId: string; score: number }> };
type UpdateMetricAction = { action: 'update-metric'; assessmentId?: string; metricId: string; workflowId?: string; baselineValue?: string; targetValue?: string; currentValue?: string; trendDirection?: string; ragStatus?: string; baselineDate?: string; notes?: string };
type RequestBody = UpdateQuestionAction | BulkScoreAction | UpdateMetricAction;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawAid = searchParams.get('assessmentId');
    const assessmentId = await resolveAssessmentId(rawAid);

    // Snapshot-first: if we have a valid cached snapshot, skip Python entirely.
    // Python only runs on cold start (empty snapshot) — not on every request.
    const snapshot = await getModuleSnapshot(assessmentId, 'OPS');
    const hasSnapshot = Boolean(
      snapshot?.summary_payload && typeof snapshot.summary_payload === 'object' && Object.keys(snapshot.summary_payload).length > 0
    );

    if (!hasSnapshot) {
      // Cold start — let Python handle it (builds and persists snapshot)
      const python = await proxyToPythonIfAvailable(request, '/operational-audit');
      if (python) return python;
    }

    return jsonOk(await buildPayload(assessmentId));
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  // NOTE: No Python proxy on POST — fast-write handles all saves directly.
  // Python is only used for GET cold-start (snapshot build).
  try {
    const body = await parseJson<RequestBody>(request);
    const assessmentId = await resolveAssessmentId(body.assessmentId);
    const bundle = (await getReferenceBundle('OPS')) as any;

    if (body.action === 'update-question') {
      const question = bundle.question_map?.[body.questionId];
      if (!question) throw new Error(`Question ${body.questionId} was not found.`);
      const responseRows = await listQuestionResponses(assessmentId, 'OPS');
      const existing = responseRows.find((r: any) => r.question_id === body.questionId) || {};
      // Fast write — no blocking recompute
      await upsertQuestionResponse(assessmentId, 'OPS', {
        questionId: body.questionId,
        domainId: question.domain_id,
        workflowId: question.workflow_id,
        score: typeof body.score === 'number' ? body.score : Number(existing.score_1_to_5 || 0),
        notes: typeof body.notes === 'string' ? body.notes : String(existing.notes || ''),
        evidenceSummary: typeof body.evidenceSummary === 'string' ? body.evidenceSummary : String(existing.evidence_summary || ''),
      });
      // Schedule background recompute — non-blocking
      scheduleRecompute(assessmentId, 'OPS');
      // Slim return: just the responses (client uses optimistic update for everything else)
      // Avoids 3 parallel DB reads on every keystroke
      const responses = await listQuestionResponses(assessmentId, 'OPS');
      return jsonOk({ ok: true, assessmentId, responses });
    }

    if (body.action === 'bulk-score') {
      const responseRows = await listQuestionResponses(assessmentId, 'OPS');
      const responseMap = Object.fromEntries(responseRows.map((r: any) => [r.question_id, r]));
      // Write all scores fast
      await Promise.all(body.updates.map(async (update) => {
        const question = bundle.question_map?.[update.questionId];
        if (!question) return;
        const existing = responseMap[update.questionId] || {};
        await upsertQuestionResponse(assessmentId, 'OPS', {
          questionId: update.questionId,
          domainId: question.domain_id,
          workflowId: question.workflow_id,
          score: Number(update.score || 0),
          notes: String(existing.notes || ''),
          evidenceSummary: String(existing.evidence_summary || ''),
        });
      }));
      scheduleRecompute(assessmentId, 'OPS');
      return jsonOk({ ok: true, assessmentId });
    }

    if (body.action === 'update-metric') {
      const metricDef = bundle.metric_map?.[body.metricId];
      if (!metricDef) throw new Error(`Metric ${body.metricId} was not found.`);
      const metricRows = await listMetricCaptures(assessmentId, 'OPS');
      const metricCapture = metricRows.find((r: any) => r.metric_id === body.metricId && String(r.workflow_id || '') === String(body.workflowId || metricDef.workflow_id || '')) || {};
      const unit = String(metricDef.unit || metricCapture.unit || '');
      const currentValue = body.currentValue ?? String(metricCapture.current_value || '');
      const targetValue = body.targetValue ?? String(metricCapture.target_value || '');
      const parsedCurrent = parseNumeric(currentValue);
      const parsedTarget = parseNumeric(targetValue);
      const inferredRag = (() => {
        if (body.ragStatus) return body.ragStatus;
        if (parsedCurrent == null || parsedTarget == null) return String(metricCapture.rag_status || 'Not captured');
        if (unit === '%' || unit.toLowerCase() === 'ratio') {
          if (parsedCurrent >= parsedTarget) return 'Green';
          if (parsedCurrent >= parsedTarget * 0.8) return 'Amber';
          return 'Red';
        }
        return String(metricCapture.rag_status || 'Not captured');
      })();
      await upsertMetricCapture(assessmentId, 'OPS', {
        metricId: body.metricId,
        metricName: metricDef.metric_name,
        domainId: metricDef.domain_id,
        workflowId: body.workflowId || metricDef.workflow_id,
        baselineValue: body.baselineValue ?? String(metricCapture.baseline_value || ''),
        baselineDate: body.baselineDate ?? String(metricCapture.baseline_date || ''),
        currentValue, targetValue,
        varianceToTarget: calculateVarianceToTarget(currentValue, targetValue, unit),
        unit,
        trendDirection: body.trendDirection ?? String(metricCapture.trend_direction || ''),
        reviewFrequency: metricDef.frequency || metricCapture.review_frequency || '',
        ownerRole: metricDef.owner_role || metricCapture.owner_role || '',
        ragStatus: inferredRag,
        evidenceStrength: String(metricCapture.evidence_strength || 'MEASURED'),
        sourceSystem: String(metricCapture.source_system || 'Operational Audit Workspace'),
        notes: body.notes ?? String(metricCapture.notes || ''),
      });
      scheduleRecompute(assessmentId, 'OPS');
      // Return just updated metrics for fast UI refresh
      const updatedMetrics = await listMetricCaptures(assessmentId, 'OPS');
      return jsonOk({ ok: true, assessmentId, metricCaptures: updatedMetrics });
    }

    throw new Error('Unsupported Operational Audit action.');
  } catch (error) { return jsonError(error); }
}
