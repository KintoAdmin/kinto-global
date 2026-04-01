/**
 * Background recompute — non-blocking debounced snapshot rebuild.
 * 
 * Pattern:
 *   1. Route saves the user's input immediately (fast-write)
 *   2. Route calls scheduleRecompute() — does NOT await it
 *   3. HTTP response returns to client in <500ms
 *   4. After DEBOUNCE_MS, recompute runs in background
 *   5. Next GET serves fresh snapshot
 * 
 * This decouples user-facing latency from compute cost entirely.
 */

import { computeAndPersistAudit } from '@/lib/services/audit';
import { computeAndPersistLeakage } from '@/lib/services/leakage';
import { computeAndPersistDataFoundation } from '@/lib/services/data-foundation';
import { computeAndPersistAiReadiness } from '@/lib/services/ai-readiness';
import { computeAndPersistAiUsecases } from '@/lib/services/ai-usecase';
import { DATA_FOUNDATION_LIBRARY } from '@/lib/data-foundation/library';
import { AI_READINESS_LIBRARY } from '@/lib/ai-readiness/library';
import { AI_USECASE_LIBRARY } from '@/lib/ai-usecases/library';
import { rebuildQuestionModuleRuntime } from '@/lib/runtime/question-module';
import type { ModuleCode } from '@/lib/constants/modules';

const DEBOUNCE_MS = 600;
const pending = new Map<string, ReturnType<typeof setTimeout>>();

function key(assessmentId: string, moduleCode: ModuleCode) {
  return `${assessmentId}::${moduleCode}`;
}

async function run(assessmentId: string, moduleCode: ModuleCode) {
  try {
    switch (moduleCode) {
      case 'OPS':
        await computeAndPersistAudit(assessmentId);
        break;
      case 'LEAK':
        await computeAndPersistLeakage(assessmentId);
        break;
      case 'DATA':
        // Try service-level compute first, fall back to runtime rebuild
        try {
          await computeAndPersistDataFoundation(assessmentId);
        } catch {
          await rebuildQuestionModuleRuntime(DATA_FOUNDATION_LIBRARY, assessmentId);
        }
        break;
      case 'AIR':
        try {
          await computeAndPersistAiReadiness(assessmentId);
        } catch {
          await rebuildQuestionModuleRuntime(AI_READINESS_LIBRARY, assessmentId);
        }
        break;
      case 'AIUC':
        try {
          await computeAndPersistAiUsecases(assessmentId);
        } catch {
          await rebuildQuestionModuleRuntime(AI_USECASE_LIBRARY, assessmentId);
        }
        break;
    }
  } catch (err) {
    // Background — log but never surface to user
    console.error(`[bg-recompute] ${assessmentId}/${moduleCode}:`, err instanceof Error ? err.message : err);
  }
}

/**
 * Schedule a debounced background recompute.
 * Multiple rapid saves coalesce into a single recompute.
 * Never blocks the caller.
 */
export function scheduleRecompute(assessmentId: string, moduleCode: ModuleCode): void {
  const k = key(assessmentId, moduleCode);
  const existing = pending.get(k);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    pending.delete(k);
    void run(assessmentId, moduleCode);
  }, DEBOUNCE_MS);
  pending.set(k, timer);
}

/**
 * Immediate recompute — awaited.
 * Use when the client explicitly requests fresh data (e.g. switching to Executive tab).
 * Cancels any pending debounced recompute for the same key.
 */
export async function recomputeNow(assessmentId: string, moduleCode: ModuleCode): Promise<void> {
  const k = key(assessmentId, moduleCode);
  const existing = pending.get(k);
  if (existing) { clearTimeout(existing); pending.delete(k); }
  await run(assessmentId, moduleCode);
}
