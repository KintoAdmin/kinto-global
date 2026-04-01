// @ts-nocheck
export function nowIso(): string {
  return new Date().toISOString();
}

export function slug(value: string): string {
  const clean = String(value || "")
    .trim()
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return clean.toUpperCase() || "UNKNOWN";
}

export function snakeSlug(value: string): string {
  const clean = String(value || "")
    .trim()
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return clean || "UNKNOWN";
}

export function clientIdFromName(name: string): string {
  return `CL-${slug(name)}`;
}

export function assessmentId(clientId: string, ordinal = 1): string {
  return `ASM-${slug(clientId)}-${String(ordinal).padStart(3, "0")}`;
}

export function responseId(assessmentIdValue: string, moduleId: string, questionId: string): string {
  return `${assessmentIdValue}::${moduleId}::${questionId}`;
}

export function metricCaptureId(assessmentIdValue: string, moduleId: string, metricId: string, workflowId = "NOWF"): string {
  return `${assessmentIdValue}::${moduleId}::${metricId}::${workflowId || "NOWF"}`;
}
