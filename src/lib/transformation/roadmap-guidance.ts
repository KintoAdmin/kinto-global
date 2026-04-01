// @ts-nocheck
/**
 * Kinto Global — Roadmap Guidance Engine
 *
 * Generates structured implementation guidance for each roadmap initiative.
 * Structure: Initiative → Stages (Discover/Define/Build/Validate/Embed) → Tasks
 *
 * Key design decisions:
 * - NOT hard-locked sequential — tasks are guided, not gated
 * - Readiness warnings shown when later stages started early
 * - Progress derived from task completion + evidence, not manual % alone
 * - Confidence score (Low/Medium/High) separate from progress %
 * - Tasks typed: Foundation | Design | Implementation | Validation | Governance
 */

export type TaskType = 'Foundation' | 'Design' | 'Implementation' | 'Validation' | 'Governance';
export type TaskStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'AWAITING_INPUTS' | 'BLOCKED' | 'COMPLETE';

export type GuidanceTask = {
  task_id: string;
  stage: 'Discover' | 'Define' | 'Build' | 'Validate' | 'Embed';
  title: string;
  type: TaskType;
  priority: number;          // 1 = highest within stage
  evidence_label: string;    // What evidence confirms this task
  status: TaskStatus;
  evidence_note: string;     // Consultant fills in
  blocker: string;           // Consultant fills in
  notes: string;             // Consultant fills in
  readiness_warning?: string; // System-generated guidance prompt
};

export type InitiativeGuidance = {
  initiative_id: string;
  definition_of_done: string[];
  tasks: GuidanceTask[];
  next_checkpoint: string;
};

// ── Task templates keyed by initiative pattern ──────────────────────────────
// Templates are keyed by keyword patterns in the initiative title/description
// Each template produces 10-15 tasks across 5 stages

const STAGE_TABS = ['Discover', 'Define', 'Build', 'Validate', 'Embed'] as const;

function taskId(initiativeId: string, stage: string, n: number) {
  return `${initiativeId}::${stage.slice(0, 3).toUpperCase()}::${n}`;
}

function buildTasks(
  initiativeId: string,
  stageMap: Record<string, Omit<GuidanceTask, 'task_id' | 'status' | 'evidence_note' | 'blocker' | 'notes'>[]>
): GuidanceTask[] {
  const tasks: GuidanceTask[] = [];
  for (const [stage, defs] of Object.entries(stageMap)) {
    defs.forEach((d, i) => {
      tasks.push({
        ...d,
        task_id: taskId(initiativeId, stage, i + 1),
        status: 'NOT_STARTED',
        evidence_note: '',
        blocker: '',
        notes: '',
      } as GuidanceTask);
    });
  }
  return tasks;
}

// ── Pattern matchers → guidance templates ───────────────────────────────────

function matchesAny(text: string, patterns: string[]): boolean {
  const t = text.toLowerCase();
  return patterns.some(p => t.includes(p));
}

function getTemplate(title: string, description: string, moduleCode: string): {
  tasks: Omit<GuidanceTask, 'task_id' | 'status' | 'evidence_note' | 'blocker' | 'notes'>[][];
  dod: string[];
  checkpoint: string;
} | null {
  const text = `${title} ${description}`.toLowerCase();

  // ── BILLING / INVOICING ──────────────────────────────────────────────────
  if (matchesAny(text, ['billing', 'invoice', 'delivery-to-bill', 'billing trigger'])) {
    return {
      tasks: [
        // Discover
        [
          { stage: 'Discover', title: 'Map current trigger points', type: 'Foundation', priority: 1, evidence_label: 'Current-state process map', readiness_warning: undefined },
          { stage: 'Discover', title: 'Identify missed or inconsistent handoffs', type: 'Foundation', priority: 2, evidence_label: 'Handoff gap analysis', readiness_warning: undefined },
          { stage: 'Discover', title: 'Capture current exception patterns', type: 'Foundation', priority: 3, evidence_label: 'Exception log or interview notes', readiness_warning: undefined },
        ],
        // Define
        [
          { stage: 'Define', title: 'Assign trigger ownership', type: 'Design', priority: 1, evidence_label: 'Named owner in governance matrix', readiness_warning: 'Recommended to complete discovery tasks first for higher confidence' },
          { stage: 'Define', title: 'Define trigger criteria and approval checkpoints', type: 'Design', priority: 2, evidence_label: 'Decision matrix / SOP section', readiness_warning: undefined },
          { stage: 'Define', title: 'Define escalation and exception path', type: 'Design', priority: 3, evidence_label: 'Escalation flowchart or documented rules', readiness_warning: undefined },
        ],
        // Build
        [
          { stage: 'Build', title: 'Publish trigger SOP and handoff standard', type: 'Implementation', priority: 1, evidence_label: 'Published SOP document', readiness_warning: 'Design tasks should be defined before SOP publication' },
          { stage: 'Build', title: 'Implement review checkpoints in billing workflow', type: 'Implementation', priority: 2, evidence_label: 'Updated workflow or system configuration', readiness_warning: undefined },
          { stage: 'Build', title: 'Align downstream teams on new handoff standard', type: 'Implementation', priority: 3, evidence_label: 'Communication confirmation or training record', readiness_warning: undefined },
        ],
        // Validate
        [
          { stage: 'Validate', title: 'Pilot new trigger on one billing cycle', type: 'Validation', priority: 1, evidence_label: 'Pilot results summary', readiness_warning: 'Validation quality limited until SOP is published' },
          { stage: 'Validate', title: 'Confirm no missed triggers in pilot', type: 'Validation', priority: 2, evidence_label: 'Billing exception report from pilot', readiness_warning: undefined },
          { stage: 'Validate', title: 'Review exception handling quality', type: 'Validation', priority: 3, evidence_label: 'Exception review meeting notes', readiness_warning: undefined },
        ],
        // Embed
        [
          { stage: 'Embed', title: 'Start recurring billing accuracy KPI review', type: 'Governance', priority: 1, evidence_label: 'KPI dashboard or review cadence confirmation', readiness_warning: 'Automation assessment is more reliable after process stability is confirmed' },
          { stage: 'Embed', title: 'Confirm adoption in live operations', type: 'Governance', priority: 2, evidence_label: 'Adoption audit or ops manager sign-off', readiness_warning: undefined },
          { stage: 'Embed', title: 'Monitor exceptions and corrective actions', type: 'Governance', priority: 3, evidence_label: 'Exception trend report (monthly)', readiness_warning: undefined },
        ],
      ].flat() as any,
      dod: [
        'Trigger has a named owner and documented approval criteria',
        'SOP published and distributed to all relevant teams',
        'No missed billing triggers in two consecutive cycles',
        'Exception handling routed through defined approval logic',
        'Weekly billing accuracy review running consistently',
      ],
      checkpoint: 'Pilot results reviewed after first billing cycle',
    };
  }

  // ── QUALIFICATION / PIPELINE / OPPORTUNITY ───────────────────────────────
  if (matchesAny(text, ['qualif', 'pipeline', 'opportunity', 'lead', 'prospect', 'crm', 'follow-up', 'follow up'])) {
    return {
      tasks: [
        [
          { stage: 'Discover', title: 'Audit current qualification criteria in use', type: 'Foundation', priority: 1, evidence_label: 'Current criteria document or interview notes', readiness_warning: undefined },
          { stage: 'Discover', title: 'Identify inconsistencies across teams or reps', type: 'Foundation', priority: 2, evidence_label: 'Inconsistency log from pipeline review', readiness_warning: undefined },
          { stage: 'Discover', title: 'Capture stale or incorrectly staged opportunities', type: 'Foundation', priority: 3, evidence_label: 'CRM audit report', readiness_warning: undefined },
        ],
        [
          { stage: 'Define', title: 'Define qualification criteria by opportunity type', type: 'Design', priority: 1, evidence_label: 'Agreed criteria document', readiness_warning: 'Recommended to complete discovery before defining new criteria' },
          { stage: 'Define', title: 'Assign accountability for stale opportunities', type: 'Design', priority: 2, evidence_label: 'Named owner per opportunity stage', readiness_warning: undefined },
          { stage: 'Define', title: 'Define follow-up SLA by pipeline stage', type: 'Design', priority: 3, evidence_label: 'SLA table or CRM configuration note', readiness_warning: undefined },
        ],
        [
          { stage: 'Build', title: 'Document minimum CRM next-step requirements', type: 'Implementation', priority: 1, evidence_label: 'CRM field requirements published', readiness_warning: undefined },
          { stage: 'Build', title: 'Configure CRM to enforce qualification fields', type: 'Implementation', priority: 2, evidence_label: 'CRM configuration confirmation', readiness_warning: 'Design criteria must be agreed before CRM configuration' },
          { stage: 'Build', title: 'Run qualification alignment session with team', type: 'Implementation', priority: 3, evidence_label: 'Session attendance record', readiness_warning: undefined },
        ],
        [
          { stage: 'Validate', title: 'Review pipeline quality after one sprint/month', type: 'Validation', priority: 1, evidence_label: 'Pipeline review snapshot', readiness_warning: undefined },
          { stage: 'Validate', title: 'Confirm stale opportunity rate has reduced', type: 'Validation', priority: 2, evidence_label: 'Before/after stale opportunity count', readiness_warning: undefined },
        ],
        [
          { stage: 'Embed', title: 'Implement weekly pipeline aging review', type: 'Governance', priority: 1, evidence_label: 'Meeting cadence and attendance confirmation', readiness_warning: undefined },
          { stage: 'Embed', title: 'Monitor adherence to follow-up standard', type: 'Governance', priority: 2, evidence_label: 'Monthly CRM adherence report', readiness_warning: undefined },
        ],
      ].flat() as any,
      dod: [
        'Qualification criteria documented and agreed across all teams',
        'CRM enforces minimum next-step requirements',
        'Stale opportunity rate below agreed threshold',
        'Weekly pipeline aging review running consistently',
        'Follow-up SLA adherence tracked and reported',
      ],
      checkpoint: 'Pipeline quality review after first full month',
    };
  }

  // ── DATA / KPI / REPORTING ───────────────────────────────────────────────
  if (matchesAny(text, ['data', 'kpi', 'report', 'dashboard', 'metric', 'field definition', 'reconcil', 'mapping'])) {
    return {
      tasks: [
        [
          { stage: 'Discover', title: 'Map current data sources and owners', type: 'Foundation', priority: 1, evidence_label: 'Data source inventory', readiness_warning: undefined },
          { stage: 'Discover', title: 'Identify field definition inconsistencies', type: 'Foundation', priority: 2, evidence_label: 'Field discrepancy log', readiness_warning: undefined },
          { stage: 'Discover', title: 'Capture current reporting gaps and pain points', type: 'Foundation', priority: 3, evidence_label: 'Gap analysis notes', readiness_warning: undefined },
        ],
        [
          { stage: 'Define', title: 'Agree field definitions across systems', type: 'Design', priority: 1, evidence_label: 'Agreed data dictionary', readiness_warning: 'Recommended to complete discovery before defining standards' },
          { stage: 'Define', title: 'Assign data ownership per domain', type: 'Design', priority: 2, evidence_label: 'Data ownership matrix', readiness_warning: undefined },
          { stage: 'Define', title: 'Define KPI calculation standards and refresh logic', type: 'Design', priority: 3, evidence_label: 'KPI definition document', readiness_warning: undefined },
        ],
        [
          { stage: 'Build', title: 'Align upstream systems on agreed field definitions', type: 'Implementation', priority: 1, evidence_label: 'System alignment confirmation', readiness_warning: 'Field definitions must be agreed before implementation' },
          { stage: 'Build', title: 'Build or update KPI dashboard', type: 'Implementation', priority: 2, evidence_label: 'Published dashboard link', readiness_warning: undefined },
          { stage: 'Build', title: 'Document reconciliation rules and exception handling', type: 'Implementation', priority: 3, evidence_label: 'Reconciliation SOP', readiness_warning: undefined },
        ],
        [
          { stage: 'Validate', title: 'Test KPI accuracy against source data', type: 'Validation', priority: 1, evidence_label: 'Accuracy test results', readiness_warning: undefined },
          { stage: 'Validate', title: 'Confirm reconciliation reduces manual effort', type: 'Validation', priority: 2, evidence_label: 'Before/after effort comparison', readiness_warning: undefined },
        ],
        [
          { stage: 'Embed', title: 'Start recurring data quality review', type: 'Governance', priority: 1, evidence_label: 'Review cadence confirmation', readiness_warning: undefined },
          { stage: 'Embed', title: 'Monitor KPI traceability and data exceptions', type: 'Governance', priority: 2, evidence_label: 'Monthly data exception report', readiness_warning: undefined },
        ],
      ].flat() as any,
      dod: [
        'Field definitions agreed and documented across all relevant systems',
        'KPI calculations standardised with known refresh logic',
        'Reconciliation runs without manual intervention',
        'Data quality review cadence established and running',
        'KPI dashboard reflects single source of truth',
      ],
      checkpoint: 'Dashboard accuracy test after first full reporting cycle',
    };
  }

  // ── AI / AUTOMATION / TECHNOLOGY ─────────────────────────────────────────
  if (matchesAny(text, ['ai', 'automat', 'machine learning', 'intelligence', 'model', 'workflow automat'])) {
    return {
      tasks: [
        [
          { stage: 'Discover', title: 'Define business problem and success outcomes', type: 'Foundation', priority: 1, evidence_label: 'Problem statement document', readiness_warning: undefined },
          { stage: 'Discover', title: 'Assess data availability and quality for AI use case', type: 'Foundation', priority: 2, evidence_label: 'Data readiness assessment', readiness_warning: undefined },
          { stage: 'Discover', title: 'Identify current manual process being automated', type: 'Foundation', priority: 3, evidence_label: 'Current-state process map', readiness_warning: undefined },
        ],
        [
          { stage: 'Define', title: 'Define AI governance and oversight model', type: 'Design', priority: 1, evidence_label: 'AI governance framework document', readiness_warning: 'Governance must be defined before AI deployment' },
          { stage: 'Define', title: 'Agree sponsorship model and executive sign-off', type: 'Design', priority: 2, evidence_label: 'Executive sponsor confirmation', readiness_warning: undefined },
          { stage: 'Define', title: 'Define success metrics and evaluation criteria', type: 'Design', priority: 3, evidence_label: 'Success metrics document', readiness_warning: undefined },
        ],
        [
          { stage: 'Build', title: 'Develop or configure AI/automation capability', type: 'Implementation', priority: 1, evidence_label: 'Development completion note or vendor confirmation', readiness_warning: 'Operational stability (OPS score > 60%) recommended before AI deployment' },
          { stage: 'Build', title: 'Integrate with relevant data sources and systems', type: 'Implementation', priority: 2, evidence_label: 'Integration test confirmation', readiness_warning: 'Data foundation (DATA score > 60%) recommended for reliable AI outcomes' },
          { stage: 'Build', title: 'Train relevant staff on AI output interpretation', type: 'Implementation', priority: 3, evidence_label: 'Training attendance record', readiness_warning: undefined },
        ],
        [
          { stage: 'Validate', title: 'Run pilot and measure against success metrics', type: 'Validation', priority: 1, evidence_label: 'Pilot results report', readiness_warning: undefined },
          { stage: 'Validate', title: 'Review edge cases and model failure modes', type: 'Validation', priority: 2, evidence_label: 'Edge case review notes', readiness_warning: undefined },
        ],
        [
          { stage: 'Embed', title: 'Start model performance monitoring cadence', type: 'Governance', priority: 1, evidence_label: 'Monitoring dashboard or review cadence', readiness_warning: undefined },
          { stage: 'Embed', title: 'Define retraining or refresh trigger criteria', type: 'Governance', priority: 2, evidence_label: 'Refresh criteria document', readiness_warning: undefined },
        ],
      ].flat() as any,
      dod: [
        'AI use case has defined success metrics and baseline comparison',
        'Governance and oversight model agreed and documented',
        'Pilot results meet or exceed defined success threshold',
        'Monitoring cadence running with defined alerting triggers',
        'Staff trained and able to interpret AI outputs correctly',
      ],
      checkpoint: 'Pilot results reviewed at 30 days post-deployment',
    };
  }

  // ── PROCESS / OWNERSHIP / GOVERNANCE (default) ───────────────────────────
  return {
    tasks: [
      [
        { stage: 'Discover', title: 'Document current state of this process area', type: 'Foundation', priority: 1, evidence_label: 'Current-state process map or interview notes', readiness_warning: undefined },
        { stage: 'Discover', title: 'Identify gaps, inconsistencies, and root causes', type: 'Foundation', priority: 2, evidence_label: 'Gap and root cause analysis', readiness_warning: undefined },
      ],
      [
        { stage: 'Define', title: 'Assign clear ownership for this initiative', type: 'Design', priority: 1, evidence_label: 'Named owner with agreed accountability', readiness_warning: 'Recommended to complete discovery before defining target state' },
        { stage: 'Define', title: 'Define target standard and acceptance criteria', type: 'Design', priority: 2, evidence_label: 'Target state document or SOP', readiness_warning: undefined },
      ],
      [
        { stage: 'Build', title: 'Implement agreed changes or publish SOP', type: 'Implementation', priority: 1, evidence_label: 'Published SOP or change confirmation', readiness_warning: 'Target standard should be defined before implementation begins' },
        { stage: 'Build', title: 'Communicate changes to all relevant stakeholders', type: 'Implementation', priority: 2, evidence_label: 'Communication record', readiness_warning: undefined },
      ],
      [
        { stage: 'Validate', title: 'Confirm implementation is working as intended', type: 'Validation', priority: 1, evidence_label: 'Review outcome or spot-check results', readiness_warning: undefined },
        { stage: 'Validate', title: 'Address any gaps or resistance identified in validation', type: 'Validation', priority: 2, evidence_label: 'Remediation notes', readiness_warning: undefined },
      ],
      [
        { stage: 'Embed', title: 'Start recurring review to confirm sustained adoption', type: 'Governance', priority: 1, evidence_label: 'Review cadence and adoption confirmation', readiness_warning: undefined },
        { stage: 'Embed', title: 'Measure and report against agreed KPI', type: 'Governance', priority: 2, evidence_label: 'KPI report showing improvement trend', readiness_warning: undefined },
      ],
    ].flat() as any,
    dod: [
      'Named owner has accepted accountability for this initiative',
      'Target standard documented and communicated',
      'Implementation confirmed working through validation review',
      'Sustained adoption confirmed at 60-day check',
      'KPI tracking shows measurable improvement against baseline',
    ],
    checkpoint: 'Adoption review at 60 days post-implementation',
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export function generateGuidance(
  initiativeId: string,
  title: string,
  description: string,
  moduleCode: string,
  existingTasks?: GuidanceTask[]
): InitiativeGuidance {
  const template = getTemplate(title, description, moduleCode);
  if (!template) {
    return {
      initiative_id: initiativeId,
      definition_of_done: ['Initiative owner confirmed', 'Target outcome delivered and measured'],
      tasks: [],
      next_checkpoint: 'Review at next advisory session',
    };
  }

  // Merge with existing task state (preserve status/notes if already saved)
  const existingMap = new Map((existingTasks || []).map(t => [t.task_id, t]));
  const tasks = template.tasks.map((t: any) => {
    const taskId_ = taskId(initiativeId, t.stage, t.priority);
    const existing = existingMap.get(taskId_);
    return {
      ...t,
      task_id: taskId_,
      status:         existing?.status         ?? 'NOT_STARTED',
      evidence_note:  existing?.evidence_note  ?? '',
      blocker:        existing?.blocker        ?? '',
      notes:          existing?.notes          ?? '',
    } as GuidanceTask;
  });

  return {
    initiative_id: initiativeId,
    definition_of_done: template.dod,
    tasks,
    next_checkpoint: template.checkpoint,
  };
}

// ── Progress derivation ───────────────────────────────────────────────────────
// Progress is derived from tasks, not purely manual.
// Weights: Foundation/Design tasks = 1.5× (higher impact), Validation/Governance = 1.0×

const TYPE_WEIGHT: Record<TaskType, number> = {
  Foundation: 1.5,
  Design: 1.5,
  Implementation: 1.0,
  Validation: 1.0,
  Governance: 1.0,
};

const STATUS_SCORE: Record<TaskStatus, number> = {
  NOT_STARTED: 0,
  IN_PROGRESS: 0.4,
  AWAITING_INPUTS: 0.4,
  BLOCKED: 0.2,
  COMPLETE: 1.0,
};

export function deriveProgress(tasks: GuidanceTask[]): number {
  if (!tasks.length) return 0;
  let totalWeight = 0;
  let earned = 0;
  for (const t of tasks) {
    const w = TYPE_WEIGHT[t.type] ?? 1.0;
    const score = STATUS_SCORE[t.status] ?? 0;
    // Evidence adds 20% bonus to a completed task
    const evidenceBonus = (t.status === 'COMPLETE' && t.evidence_note.trim()) ? 0.2 * w : 0;
    totalWeight += w;
    earned += score * w + evidenceBonus;
  }
  return Math.min(100, Math.round((earned / totalWeight) * 100));
}

export function deriveConfidence(tasks: GuidanceTask[]): 'Low' | 'Medium' | 'High' {
  if (!tasks.length) return 'Low';
  const complete = tasks.filter(t => t.status === 'COMPLETE');
  const withEvidence = complete.filter(t => t.evidence_note.trim());
  const total = tasks.length;
  const evidenceRatio = complete.length > 0 ? withEvidence.length / complete.length : 0;
  const completionRatio = complete.length / total;

  if (completionRatio >= 0.7 && evidenceRatio >= 0.6) return 'High';
  if (completionRatio >= 0.3 || (complete.length > 0 && evidenceRatio >= 0.3)) return 'Medium';
  return 'Low';
}

export function getStageProgress(tasks: GuidanceTask[], stage: string): number {
  const stageTasks = tasks.filter(t => t.stage === stage);
  if (!stageTasks.length) return 0;
  const complete = stageTasks.filter(t => t.status === 'COMPLETE').length;
  return Math.round((complete / stageTasks.length) * 100);
}
