// @ts-nocheck
import { z } from "zod";

const trimmedString = z.string().trim();
const optionalTrimmed = z.union([trimmedString, z.null(), z.undefined()]).transform((value) => (value == null ? undefined : value));

export const clientUpsertSchema = z.object({
  clientName: trimmedString.min(1),
  industry: optionalTrimmed,
  businessModel: optionalTrimmed,
  revenueModel: optionalTrimmed,
  companySize: optionalTrimmed,
  region: optionalTrimmed,
  primaryContactName: optionalTrimmed,
  primaryContactEmail: optionalTrimmed,
  notes: optionalTrimmed
});

export const assessmentCreateSchema = z.object({
  clientId: trimmedString.min(1),
  assessmentName: trimmedString.min(1),
  assessmentDate: optionalTrimmed,
  version: optionalTrimmed,
  assessmentVersion: optionalTrimmed,
  reportingPeriodLabel: optionalTrimmed,
  scopeType: optionalTrimmed,
  scopeLabel: optionalTrimmed
});

export const moduleStateUpdateSchema = z.object({
  runtimeState: z.record(z.string(), z.unknown()),
  moduleStatus: optionalTrimmed,
  completionPct: z.number().min(0).max(100).optional(),
  summaryPayload: z.record(z.string(), z.unknown()).optional()
});

export const questionResponseSchema = z.object({
  questionId: trimmedString.min(1),
  domainId: optionalTrimmed,
  workflowId: optionalTrimmed,
  score: z.number().min(0).max(5),
  notes: optionalTrimmed,
  evidenceSummary: optionalTrimmed,
  assessorConfidence: optionalTrimmed
});

export const metricCaptureSchema = z.object({
  metricId: trimmedString.min(1),
  metricName: optionalTrimmed,
  domainId: optionalTrimmed,
  workflowId: optionalTrimmed,
  baselineValue: optionalTrimmed,
  baselineDate: optionalTrimmed,
  currentValue: optionalTrimmed,
  targetValue: optionalTrimmed,
  varianceToTarget: optionalTrimmed,
  unit: optionalTrimmed,
  trendDirection: optionalTrimmed,
  reviewFrequency: optionalTrimmed,
  ownerRole: optionalTrimmed,
  ragStatus: optionalTrimmed,
  evidenceStrength: optionalTrimmed,
  sourceSystem: optionalTrimmed,
  notes: optionalTrimmed
});

export const roadmapUpdateSchema = z.object({
  status: optionalTrimmed,
  progressPct: z.number().min(0).max(100).optional(),
  executionNotes: optionalTrimmed,
  lastReviewedAt: optionalTrimmed
});
