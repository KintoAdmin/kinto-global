// @ts-nocheck
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type Dictionary<T = unknown> = Record<string, T>;

export interface ReferenceRecordRow {
  id?: string;
  module_code: string;
  record_type: string;
  record_key: string;
  parent_key: string;
  order_index: number;
  payload: Record<string, unknown>;
}

export interface ClientProfileInput {
  clientName: string;
  industry?: string;
  businessModel?: string;
  revenueModel?: string;
  companySize?: string;
  region?: string;
  primaryContactName?: string;
  primaryContactEmail?: string;
  notes?: string;
}

export interface LeakDriverDefinition {
  name: string;
  direction: string;
}

export interface LeakCoreDefinition {
  name: string;
  category: string;
  direction: string;
  actual_label: string;
  benchmark_label: string;
  leakage_formula_label: string;
  drivers: LeakDriverDefinition[];
  advisory: Record<string, string>;
}

export interface LeakDriverState {
  actual: number;
  benchmark: number;
}

export interface LeakCoreState {
  actual: number;
  benchmark: number;
  support: Record<string, number>;
  drivers: Record<string, LeakDriverState>;
}

export interface LeakState {
  profile: Record<string, string>;
  cores: Record<string, LeakCoreState>;
  benchmarkProfile?: string;
}

export interface LeakDriverRow {
  name: string;
  direction: string;
  actual: number;
  benchmark: number;
  within: boolean;
}

export interface LeakCoreRow {
  name: string;
  category: string;
  actual_label: string;
  benchmark_label: string;
  actual: number;
  benchmark: number;
  leakage: number;
  severity: string;
  status: string;
  driver_score: number;
  drivers_within: number;
  drivers_total: number;
  driver_rows: LeakDriverRow[];
  formula: string;
  advisory: Record<string, string>;
  support: Record<string, number>;
}

export interface AuditQuestionResponseInput {
  questionId: string;
  domainId?: string;
  workflowId?: string;
  score: number;
  notes?: string;
  evidenceSummary?: string;
  assessorConfidence?: string;
}

export interface MetricCaptureInput {
  metricId: string;
  metricName?: string;
  domainId?: string;
  workflowId?: string;
  baselineValue?: string;
  baselineDate?: string;
  currentValue?: string;
  targetValue?: string;
  varianceToTarget?: string;
  unit?: string;
  trendDirection?: string;
  reviewFrequency?: string;
  ownerRole?: string;
  ragStatus?: string;
  evidenceStrength?: string;
  sourceSystem?: string;
  notes?: string;
}

export interface RuntimeSummary {
  overall_pct: number;
  overall_maturity: string;
  answered: number;
  total: number;
  [key: string]: unknown;
}
