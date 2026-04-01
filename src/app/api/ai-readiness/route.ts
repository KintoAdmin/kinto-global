// @ts-nocheck
import { proxyToPythonIfAvailable } from '@/lib/python-engine/proxy';
import { NextResponse } from 'next/server';
import { AI_READINESS_LIBRARY } from '@/lib/ai-readiness/library';
import { getQuestionModulePayload, fastWriteQuestionScore } from '@/lib/runtime/question-module';
import { getModuleSnapshot } from '@/lib/repositories/foundation';
import { scheduleRecompute } from '@/lib/services/background-recompute';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const assessmentId = searchParams.get('assessmentId') || undefined;

    // Snapshot-first: serve from cache if it exists, only call Python on cold start
    if (assessmentId) {
      const snapshot = await getModuleSnapshot(assessmentId, 'AIR');
      const hasSnapshot = Boolean(
        snapshot?.summary_payload &&
        typeof snapshot.summary_payload === 'object' &&
        Object.keys(snapshot.summary_payload).length > 0
      );
      if (!hasSnapshot) {
        const python = await proxyToPythonIfAvailable(request, '/ai-readiness');
        if (python) return python;
      }
    }

    const payload = await getQuestionModulePayload(AI_READINESS_LIBRARY, assessmentId);
    return NextResponse.json(payload);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load AI Readiness.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  // NOTE: No Python proxy on POST — fast-write handles all saves directly.
  // Python is only used for GET cold-start (snapshot build).
  try {
    const body = await request.json();
    const { questionId, score, assessmentId } = body as { questionId?: string; score?: number; assessmentId?: string };
    if (!questionId || typeof score !== 'number') {
      return NextResponse.json({ error: 'questionId and score are required.' }, { status: 400 });
    }
    const payload = await fastWriteQuestionScore(AI_READINESS_LIBRARY, questionId, score, assessmentId);
    if (assessmentId) scheduleRecompute(assessmentId, 'AIR');
    return NextResponse.json({ ok: true, data: payload });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to save AI Readiness score.' }, { status: 500 });
  }
}
