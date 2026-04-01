// @ts-nocheck
/**
 * Kinto Global — Universal Priority Scoring
 * Single source of truth for ordering findings, recommendations, actions, and roadmap items.
 * Used in: report.ts, advisory-view, roadmap ordering.
 */

/**
 * Converts any severity/priority label to a numeric weight.
 * Lower = higher priority.
 */
export function severityWeight(value: unknown): number {
  const v = String(value || '').toLowerCase().replace(/[_\s-]/g, '');
  if (v === 'critical') return 1;
  if (v === 'high')     return 2;
  if (v === 'medium' || v === 'moderate' || v === 'developing') return 3;
  if (v === 'low')      return 4;
  return 5;
}

/**
 * Converts phase code/name to sort order.
 * P1 first, P3 last. Unknown phases go last.
 */
export function phaseWeight(value: unknown): number {
  const v = String(value || '').toUpperCase();
  if (v.startsWith('P1') || v.includes('STABILISE') || v.includes('PROTECT')) return 1;
  if (v.startsWith('P2') || v.includes('STANDARD') || v.includes('STRENGTHEN')) return 2;
  if (v.startsWith('P3') || v.includes('OPTIM') || v.includes('AI-ENABLE')) return 3;
  return 4;
}

/**
 * Sort comparator: phase first, then severity, then priority_rank.
 */
export function sortByPriorityPhase<T extends Record<string, unknown>>(a: T, b: T): number {
  const pA = phaseWeight(a.phase ?? a.phase_code ?? a.roadmap_phase);
  const pB = phaseWeight(b.phase ?? b.phase_code ?? b.roadmap_phase);
  if (pA !== pB) return pA - pB;

  const sA = severityWeight(a.severity ?? a.priority ?? a.priority_level ?? a.severity_band);
  const sB = severityWeight(b.severity ?? b.priority ?? b.priority_level ?? b.severity_band);
  if (sA !== sB) return sA - sB;

  const rA = Number(a.priority_rank ?? a.number ?? 9999);
  const rB = Number(b.priority_rank ?? b.number ?? 9999);
  return rA - rB;
}

/**
 * Sort comparator: severity/priority only (no phase — for findings within a section).
 */
export function sortBySeverity<T extends Record<string, unknown>>(a: T, b: T): number {
  const sA = severityWeight(a.severity ?? a.priority ?? a.priority_level ?? a.severity_band);
  const sB = severityWeight(b.severity ?? b.priority ?? b.priority_level ?? b.severity_band);
  if (sA !== sB) return sA - sB;
  const rA = Number(a.priority_rank ?? a.number ?? a.score ?? 9999);
  const rB = Number(b.priority_rank ?? b.number ?? b.score ?? 9999);
  return rA - rB;
}
