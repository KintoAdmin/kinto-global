import { proxyToPythonIfAvailable } from '@/lib/python-engine/proxy';
import { NextResponse } from 'next/server';
import { AI_USECASE_LIBRARY } from '@/lib/ai-usecases/library';
import { getQuestionModulePayload, fastWriteQuestionScore } from '@/lib/runtime/question-module';
import { getModuleSnapshot } from '@/lib/repositories/foundation';
import { scheduleRecompute } from '@/lib/services/background-recompute';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const assessmentId = searchParams.get('assessmentId') || undefined;

    // Snapshot-first: serve from cache if it exists, only call Python on cold start
    if (assessmentId) {
      const snapshot = await getModuleSnapshot(assessmentId, 'AIUC');
      const hasSnapshot = Boolean(
        snapshot?.summary_payload &&
        typeof snapshot.summary_payload === 'object' &&
        Object.keys(snapshot.summary_payload).length > 0
      );
      if (!hasSnapshot) {
        const python = await proxyToPythonIfAvailable(request, '/ai-use-cases');
        if (python) return python;
      }
    }

    const payload = await getQuestionModulePayload(AI_USECASE_LIBRARY, assessmentId);
    return NextResponse.json(payload);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load AI Use Cases.' }, { status: 500 });
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
    const payload = await fastWriteQuestionScore(AI_USECASE_LIBRARY, questionId, score, assessmentId);
    if (assessmentId) scheduleRecompute(assessmentId, 'AIUC');
    return NextResponse.json({ ok: true, data: payload });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to save AI Use Cases score.' }, { status: 500 });
  }
}
