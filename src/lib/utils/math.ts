export function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function scoreToPercentage(score: number): number {
  if (score <= 0) return 0;
  return round((score / 5) * 100, 1);
}

export function maturityLabel(percentage: number): string {
  if (percentage >= 80) return "Strong";
  if (percentage >= 60) return "Managed";
  if (percentage >= 40) return "Developing";
  if (percentage > 0) return "Weak";
  return "Not scored";
}

export function maturityBandFromPct(scorePct: number | null | undefined, isComplete: boolean): string {
  if (!isComplete) return "INCOMPLETE";
  if (!scorePct) return "NOT_SCORED";
  if (scorePct >= 80) return "STRONG";
  if (scorePct >= 60) return "MANAGED";
  if (scorePct >= 40) return "DEVELOPING";
  return "WEAK";
}

export function safeNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}
