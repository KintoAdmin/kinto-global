/**
 * In-process assessment resolution cache.
 *
 * ensureAssessmentModules does 2-3 Supabase roundtrips on every call:
 *   1. seedModuleRegistry check
 *   2. SELECT existing assessment_modules
 *   3. INSERT missing modules (if any)
 *   4. SELECT all modules (always)
 *
 * For any assessment that's already been set up, this work is wasted.
 * We cache the result so it only runs once per process lifetime.
 *
 * Cache is intentionally in-memory only (not persisted) — it resets
 * on server restart, which is the right behaviour.
 */

const _ensured = new Set<string>();
const _resolved = new Map<string, string>(); // raw input → resolved assessment_id

export function markEnsured(assessmentId: string): void {
  _ensured.add(assessmentId);
}

export function isEnsured(assessmentId: string): boolean {
  return _ensured.has(assessmentId);
}

export function cacheResolved(rawInput: string, resolvedId: string): void {
  _resolved.set(rawInput.toLowerCase(), resolvedId);
}

export function getCachedResolved(rawInput: string): string | undefined {
  return _resolved.get(rawInput.toLowerCase());
}
