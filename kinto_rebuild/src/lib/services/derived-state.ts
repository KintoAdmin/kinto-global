export function hasValueSignal(value: unknown) {
  if (value == null) return false;
  if (typeof value === 'number') return Number.isFinite(value);
  const text = String(value).trim();
  return text !== '';
}

export function metricRowCaptured(row: Record<string, unknown> | null | undefined) {
  if (!row) return false;
  return hasValueSignal(row.baseline_value)
    || hasValueSignal(row.current_value)
    || hasValueSignal(row.target_value)
    || hasValueSignal(row.baselineValue)
    || hasValueSignal(row.currentValue)
    || hasValueSignal(row.targetValue)
    || Boolean(row.captured);
}

export function countCapturedMetricRows(rows: Array<Record<string, unknown> | null | undefined>) {
  return rows.filter((row) => metricRowCaptured(row)).length;
}

export function countQuestionAnswers(rows: Array<{ score?: unknown; score_1_to_5?: unknown } | null | undefined>) {
  return rows.filter((row) => Number(row?.score_1_to_5 ?? row?.score ?? 0) > 0).length;
}

export function completionPct(answered: number, total: number) {
  if (!total) return 0;
  return Number(((answered / total) * 100).toFixed(2));
}

export function deriveModuleCoverage(input: {
  questionsAnswered: number;
  questionsTotal: number;
  metricsCaptured?: number;
  metricsTotal?: number;
}) {
  const questionsAnswered = Number(input.questionsAnswered || 0);
  const questionsTotal = Number(input.questionsTotal || 0);
  const metricsCaptured = Number(input.metricsCaptured || 0);
  const metricsTotal = Number(input.metricsTotal || 0);
  const questionCompletionPct = completionPct(questionsAnswered, questionsTotal);
  const metricCompletionPct = metricsTotal > 0 ? completionPct(metricsCaptured, metricsTotal) : 100;
  const complete = questionsTotal > 0
    && questionsAnswered === questionsTotal
    && (metricsTotal === 0 || metricsCaptured === metricsTotal);
  const parts = metricsTotal > 0 ? [questionCompletionPct, metricCompletionPct] : [questionCompletionPct];
  const combinedCompletionPct = Number((parts.reduce((sum, value) => sum + value, 0) / parts.length).toFixed(2));

  return {
    questionsAnswered,
    questionsTotal,
    metricsCaptured,
    metricsTotal,
    questionCompletionPct,
    metricCompletionPct,
    completionPct: combinedCompletionPct,
    complete,
  };
}
