// @ts-nocheck
import { ensureAssessmentModules, getAssessmentById, updateAssessmentModuleState } from '@/lib/repositories/assessments';
import { replaceModuleArtifacts } from '@/lib/repositories/runtime';
import { moduleIdFromCode } from '@/lib/constants/modules';
import { nowIso } from '@/lib/utils/ids';
import {
  BR_BUSINESS_TYPES,
  BR_LAUNCH_DOMAIN_CODES,
  BR_PHASES,
  getBrDomains,
  BR_READINESS_PERCENT,
  BR_REGIONS,
  BR_TEMPLATE_VERSION,
  bandFromReadinessPercent,
  buildBrTaskTemplates,
  getBrActionBlueprints,
  getBrBusinessTypeLabel,
  getBrImplementationBlueprint,
  getBrRegionLabel,
} from '@/lib/business-readiness/catalog';
import {
  addBrEvidence,
  createBrWorkspace,
  deleteBrEvidenceByTask,
  getBrTaskInstance,
  getBrWorkspaceBundle,
  getBrWorkspaceByAssessment,
  replaceBrBlockers,
  replaceBrDomainStates,
  replaceBrPhaseStates,
  replaceBrTaskInstances,
  reviewBrEvidence,
  updateBrTaskInstance,
  updateBrWorkspace,
} from '@/lib/repositories/business-readiness';


function parseProfileNotes(notes?: string | null) {
  try {
    const parsed = JSON.parse(String(notes || '{}'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function getEmployerIntent(profile?: any) {
  const notes = parseProfileNotes(profile?.notes);
  return Boolean(notes?.hiring_staff);
}

function scoreFromReadiness(state?: string | null) {
  return BR_READINESS_PERCENT[String(state || 'not_started').toLowerCase()] || 0;
}

function phaseBandFromCode(phaseCode?: string | null) {
  if (phaseCode === 'phase_0_define' || phaseCode === 'phase_1_formal' || phaseCode === 'phase_2_financial') return { code: 'P1', name: 'Stabilise and Protect' };
  if (phaseCode === 'phase_3_operating' || phaseCode === 'phase_4_control') return { code: 'P2', name: 'Standardise and Strengthen' };
  return { code: 'P3', name: 'Optimize, Automate, and AI-Enable' };
}

function buildTaskInstances(workspaceId: string, businessTypeCode: string, regionCode: string, employerIntent = false) {
  return buildBrTaskTemplates({ businessTypeCode, regionCode, employerIntent }).map((task, index) => ({
    task_instance_id: `${workspaceId}::${task.code}`,
    workspace_id: workspaceId,
    task_code: task.code,
    domain_code: task.domain_code,
    phase_code: task.phase_code,
    task_name: task.title,
    task_description: task.description,
    task_role: task.role || 'setup',
    status: 'not_started',
    required_flag: Boolean(task.required),
    can_block_launch: Boolean(task.launch_critical),
    evidence_required_flag: false,
    sort_order: Number(task.sort_order || index + 1),
    is_region_specific: false,
    is_business_type_specific: false,
    metadata: {
      action_code: task.action_code,
      action_title: task.action_title,
      section_name: task.section_name,
      instructions: task.instructions,
      requirements: task.requirements || [],
      where_to_do_this: task.where_to_do_this || [],
      record_and_save: task.record_and_save || [],
      optional: Boolean(task.optional),
    },
    created_at: nowIso(),
    updated_at: nowIso(),
  }));
}

function deriveSectionState(tasks: any[]) {
  const required = tasks.filter((row) => row.required_flag !== false);
  const doneCount = required.filter((row) => row.status === 'done').length;
  const started = required.some((row) => ['in_progress', 'done'].includes(String(row.status || '')));
  const percent = required.length ? Math.round((doneCount / required.length) * 100) : 0;
  let readiness = 'not_started';
  if (!started) readiness = 'not_started';
  else if (doneCount < required.length) readiness = 'started';
  else readiness = 'set_up';
  const nextTask = required.find((row) => row.status !== 'done') || null;
  return {
    readiness_state: readiness,
    percent_complete: percent,
    next_required_task_code: nextTask?.task_code || '',
    next_required_task_name: nextTask?.task_name || '',
  };
}

function buildActionSummaries(workspace: any, bundle: any) {
  const tasks = bundle.tasks || [];
  const blueprint = getBrActionBlueprints({ businessTypeCode: workspace.business_type_code, regionCode: workspace.primary_region_code, employerIntent: getEmployerIntent(bundle.profile) });
  return blueprint.map((action, index) => {
    const actionTasks = action.tasks.map((task) => tasks.find((row) => row.task_code === task.task_code)).filter(Boolean);
    const requiredTasks = actionTasks.filter((row) => row.required_flag !== false);
    const totalTasks = requiredTasks.length;
    const completedTasks = requiredTasks.filter((row) => row.status === 'done').length;
    const started = requiredTasks.some((row) => ['in_progress', 'done'].includes(String(row.status || '')));
    let status = 'not_started';
    if (completedTasks === totalTasks && totalTasks > 0) status = 'complete';
    else if (started) status = 'in_progress';
    const nextTask = requiredTasks.find((row) => row.status !== 'done') || null;
    return {
      action_id: action.action_code,
      action_code: action.action_code,
      action_title: action.action_title,
      objective: action.objective,
      launch_critical: Boolean(action.launch_critical),
      phase_code: action.phase_code,
      phase_name: action.phase_name,
      section_code: action.section_code,
      section_name: action.section_name,
      status,
      total_tasks: totalTasks,
      completed_tasks: completedTasks,
      progress_pct: totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0,
      next_task_code: nextTask?.task_code || '',
      next_task_name: nextTask?.task_name || '',
      sort_order: index + 1,
      tasks: action.tasks.map((task, taskIndex) => {
        const taskRow = tasks.find((row) => row.task_code === task.task_code) || null;
        return {
          task_code: task.task_code,
          task_title: task.task_title,
          instructions: task.instructions,
          requirements: task.requirements || [],
          where_to_do_this: task.where_to_do_this || [],
          record_and_save: task.record_and_save || [],
          optional: Boolean(task.optional),
          status: taskRow?.status || 'not_started',
          task_instance_id: taskRow?.task_instance_id || '',
          sort_order: taskIndex + 1,
        };
      }),
    };
  });
}

function deriveWorkspaceState(workspace: any, bundle: any) {
  const tasks = bundle.tasks || [];
  const actionSummaries = buildActionSummaries(workspace, bundle);
  const domainLibrary = getBrDomains({ employerIntent: getEmployerIntent(bundle.profile) });

  const domainStates = domainLibrary.map((domain, index) => {
    const domainTasks = tasks.filter((row) => row.domain_code === domain.code);
    const derived = deriveSectionState(domainTasks);
    const domainActions = actionSummaries.filter((row) => row.section_code === domain.code);
    const blockerFlag = domainActions.some((row) => row.launch_critical && row.status !== 'complete');
    return {
      domain_state_id: `${workspace.workspace_id}::${domain.code}`,
      workspace_id: workspace.workspace_id,
      domain_code: domain.code,
      domain_name: domain.name,
      phase_code: domain.phase_code,
      sort_order: index + 1,
      readiness_state: derived.readiness_state,
      percent_complete: derived.percent_complete,
      blocker_flag: blockerFlag,
      next_required_task_code: derived.next_required_task_code,
      missing_evidence_count: 0,
      launch_critical: domain.launch_critical,
      last_derived_at: nowIso(),
    };
  });

  const basePhaseStates = BR_PHASES.map((phase, index) => {
    const rows = domainStates.filter((row) => row.phase_code === phase.code);
    const avg = rows.length ? rows.reduce((sum, row) => sum + Number(row.percent_complete || 0), 0) / rows.length : 0;
    const blocked = rows.some((row) => row.blocker_flag);
    let status = 'not_started';
    if (rows.every((row) => Number(row.percent_complete || 0) === 100)) status = 'complete';
    else if (rows.some((row) => Number(row.percent_complete || 0) > 0)) status = blocked ? 'blocked' : 'in_progress';
    return {
      phase_state_id: `${workspace.workspace_id}::${phase.code}`,
      workspace_id: workspace.workspace_id,
      phase_code: phase.code,
      phase_name: phase.name,
      sort_order: index + 1,
      status,
      percent_complete: Math.round(avg),
      blocked_flag: blocked,
      last_derived_at: nowIso(),
    };
  });

  const firstIncompleteIndex = basePhaseStates.findIndex((row) => row.status !== 'complete');
  const phaseStates = basePhaseStates.map((row, index) => {
    if (firstIncompleteIndex >= 0 && index > firstIncompleteIndex) {
      return { ...row, status: 'locked', percent_complete: 0, blocked_flag: false };
    }
    return row;
  });

  const blockers = actionSummaries
    .filter((row) => row.launch_critical && row.status !== 'complete')
    .sort((a, b) => {
      const phaseDelta = BR_PHASES.findIndex((row) => row.code === a.phase_code) - BR_PHASES.findIndex((row) => row.code === b.phase_code);
      if (phaseDelta !== 0) return phaseDelta;
      return Number(a.sort_order || 0) - Number(b.sort_order || 0);
    })
    .map((row, index) => ({
      blocker_id: `${workspace.workspace_id}::BLOCKER::${row.action_code}`,
      workspace_id: workspace.workspace_id,
      blocker_code: row.action_code,
      blocker_type: 'missing_setup',
      domain_code: row.section_code,
      task_code: row.next_task_code || '',
      title: row.action_title,
      description: row.next_task_name ? `Still needs: ${row.next_task_name}.` : row.objective,
      severity: index < 3 ? 'critical' : 'high',
      active_flag: true,
      sort_order: index + 1,
      created_at: nowIso(),
    }));

  const requiredLaunchDomainsReady = domainStates
    .filter((row) => BR_LAUNCH_DOMAIN_CODES.includes(row.domain_code))
    .every((row) => Number(row.percent_complete || 0) === 100);
  const launchReadyFlag = requiredLaunchDomainsReady && blockers.length === 0;
  const overallScore = domainStates.length ? domainStates.reduce((sum, row) => sum + Number(row.percent_complete || 0), 0) / domainStates.length : 0;
  const currentPhase = phaseStates.find((row) => row.status !== 'complete' && row.status !== 'locked')?.phase_code || 'phase_5_launch';

  let overallReadinessState = 'not_started';
  if (overallScore > 0 && overallScore < 100) overallReadinessState = 'started';
  if (overallScore === 100) overallReadinessState = 'set_up';

  return {
    domainStates,
    phaseStates,
    blockers,
    actionSummaries,
    workspacePatch: {
      current_phase_code: currentPhase,
      overall_readiness_state: launchReadyFlag ? 'set_up' : overallReadinessState,
      launch_ready_flag: launchReadyFlag,
      active_blocker_count: blockers.length,
    },
  };
}

function buildNextActionsFromActions(actions: any[]) {
  return actions
    .filter((row) => row.status !== 'complete')
    .sort((a, b) => {
      const launchDelta = Number(Boolean(b.launch_critical)) - Number(Boolean(a.launch_critical));
      if (launchDelta !== 0) return launchDelta;
      const phaseDelta = BR_PHASES.findIndex((row) => row.code === a.phase_code) - BR_PHASES.findIndex((row) => row.code === b.phase_code);
      if (phaseDelta !== 0) return phaseDelta;
      return Number(a.sort_order || 0) - Number(b.sort_order || 0);
    })
    .slice(0, 5)
    .map((row, index) => ({
      id: `${row.action_code}::${index + 1}`,
      title: row.action_title,
      reason: row.objective,
      phase_code: row.phase_code,
      phase_name: row.phase_name,
      launch_critical: row.launch_critical,
      priority_rank: index + 1,
      action_code: row.action_code,
      next_task_code: row.next_task_code,
      next_task_name: row.next_task_name,
    }));
}

function buildImplementationPlan(workspace: any, bundle: any) {
  const actionMap = new Map(buildActionSummaries(workspace, bundle).map((row) => [row.action_code, row]));
  const blueprint = getBrImplementationBlueprint({ businessTypeCode: workspace.business_type_code, regionCode: workspace.primary_region_code, employerIntent: getEmployerIntent(bundle.profile) });
  return blueprint.map((phase) => ({
    phase_code: phase.phase_code,
    phase_name: phase.phase_name,
    sections: phase.sections.map((section) => ({
      section_code: section.section_code,
      section_name: section.section_name,
      actions: section.actions.map((action) => {
        const summary = actionMap.get(action.action_code);
        return {
          action_code: action.action_code,
          action_title: action.action_title,
          objective: action.objective,
          launch_critical: Boolean(action.launch_critical),
          status: summary?.status || 'not_started',
          completed_tasks: summary?.completed_tasks || 0,
          total_tasks: summary?.total_tasks || action.tasks.length,
          progress_pct: summary?.progress_pct || 0,
          tasks: summary?.tasks || [],
        };
      }),
    })),
  }));
}

function buildSponsorSummary(workspace: any, blockers: any[], nextActions: any[]) {
  if (!workspace) return 'Business Readiness has not been configured yet.';
  const region = getBrRegionLabel(workspace.primary_region_code);
  const businessType = getBrBusinessTypeLabel(workspace.business_type_code);
  if (!blockers.length) return `The ${businessType} setup for ${region} has no active launch blockers right now. Focus next on finishing the remaining setup actions so the business can launch cleanly.`;
  const top = nextActions.slice(0, 3).map((row) => row.title.toLowerCase()).join(', ');
  return `The ${businessType} setup for ${region} is still in progress. The main priorities right now are ${top}. Those actions should be completed before launch moves forward.`;
}

async function persistDerivedWorkspaceState(assessmentId: string) {
  const workspace = await getBrWorkspaceByAssessment(assessmentId);
  if (!workspace) return null;
  const bundle = await getBrWorkspaceBundle(workspace.workspace_id);
  const derived = deriveWorkspaceState(workspace, bundle);
  await replaceBrDomainStates(workspace.workspace_id, derived.domainStates);
  await replaceBrPhaseStates(workspace.workspace_id, derived.phaseStates);
  await replaceBrBlockers(workspace.workspace_id, derived.blockers);
  await updateBrWorkspace(workspace.workspace_id, derived.workspacePatch);
  return derived;
}

async function ensureCurrentTemplate(assessmentId: string) {
  const workspace = await getBrWorkspaceByAssessment(assessmentId);
  if (!workspace) return null;
  if (workspace.template_version === BR_TEMPLATE_VERSION) return workspace;
  const bundle = await getBrWorkspaceBundle(workspace.workspace_id);
  const taskInstances = buildTaskInstances(workspace.workspace_id, workspace.business_type_code, workspace.primary_region_code, getEmployerIntent(bundle.profile));
  await replaceBrTaskInstances(workspace.workspace_id, taskInstances);
  return updateBrWorkspace(workspace.workspace_id, { template_version: BR_TEMPLATE_VERSION, current_phase_code: 'phase_0_define' });
}

export async function getBusinessReadinessPayload(assessmentId: string) {
  await ensureAssessmentModules(assessmentId);
  await ensureCurrentTemplate(assessmentId);
  let workspace = await getBrWorkspaceByAssessment(assessmentId);
  if (!workspace) {
    return {
      hasWorkspace: false,
      businessTypes: BR_BUSINESS_TYPES,
      regions: BR_REGIONS,
    };
  }
  await persistDerivedWorkspaceState(assessmentId);
  workspace = await getBrWorkspaceByAssessment(assessmentId);
  const bundle = await getBrWorkspaceBundle(workspace.workspace_id);
  const actionSummaries = buildActionSummaries(workspace, bundle);
  const nextActions = buildNextActionsFromActions(actionSummaries);
  const implementationPlan = buildImplementationPlan(workspace, bundle);
  return {
    hasWorkspace: true,
    workspace,
    profile: bundle.profile,
    regionProfile: bundle.regionProfile,
    employerIntent: getEmployerIntent(bundle.profile),
    phaseStates: bundle.phases || [],
    sectionStates: bundle.domains || [],
    blockers: bundle.blockers || [],
    tasks: bundle.tasks || [],
    evidence: bundle.evidence || [],
    nextActions,
    actionSummaries,
    implementationPlan,
    summary: buildSponsorSummary(workspace, bundle.blockers || [], nextActions),
    businessTypes: BR_BUSINESS_TYPES,
    regions: BR_REGIONS,
  };
}

export async function initializeBusinessReadiness(input: {
  assessmentId: string;
  businessTypeCode: string;
  primaryRegionCode: string;
  subRegionCode?: string | null;
  businessName?: string | null;
  founderName?: string | null;
  businessDescription?: string | null;
  targetCustomer?: string | null;
  revenueModel?: string | null;
  operatingChannel?: string | null;
  whatYouSell?: string | null;
}) {
  const assessment = await getAssessmentById(input.assessmentId);
  if (!assessment?.client_id) throw new Error('Assessment not found.');
  await ensureAssessmentModules(input.assessmentId);

  const workspace = await createBrWorkspace({
    assessmentId: input.assessmentId,
    clientId: assessment.client_id,
    businessTypeCode: input.businessTypeCode,
    primaryRegionCode: input.primaryRegionCode,
    subRegionCode: input.subRegionCode,
    businessName: input.businessName,
    founderName: input.founderName,
    businessDescription: input.businessDescription,
    targetCustomer: input.targetCustomer,
    revenueModel: input.revenueModel,
    operatingChannel: input.operatingChannel,
    whatYouSell: input.whatYouSell,
    hiringStaff: input.hiringStaff,
  });

  const taskInstances = buildTaskInstances(workspace.workspace_id, input.businessTypeCode, input.primaryRegionCode, Boolean(input.hiringStaff));
  await replaceBrTaskInstances(workspace.workspace_id, taskInstances);
  await updateBrWorkspace(workspace.workspace_id, { template_version: BR_TEMPLATE_VERSION });
  await persistDerivedWorkspaceState(input.assessmentId);
  await computeAndPersistBusinessReadiness(input.assessmentId);
  return getBusinessReadinessPayload(input.assessmentId);
}

export async function setBusinessReadinessTaskStatus(input: { assessmentId: string; taskInstanceId: string; status: string; notes?: string | null; }) {
  const workspace = await getBrWorkspaceByAssessment(input.assessmentId);
  if (!workspace) throw new Error('Business Readiness workspace has not been created yet.');
  await updateBrTaskInstance(input.taskInstanceId, { status: input.status, notes: input.notes || undefined });
  await persistDerivedWorkspaceState(input.assessmentId);
  await computeAndPersistBusinessReadiness(input.assessmentId);
  return getBusinessReadinessPayload(input.assessmentId);
}

export async function addBusinessReadinessEvidence(input: { assessmentId: string; taskInstanceId: string; noteText?: string | null; externalLink?: string | null; evidenceType?: string | null; replaceExisting?: boolean; }) {
  const workspace = await getBrWorkspaceByAssessment(input.assessmentId);
  if (!workspace) throw new Error('Business Readiness workspace has not been created yet.');
  if (input.replaceExisting) await deleteBrEvidenceByTask(workspace.workspace_id, input.taskInstanceId);
  await addBrEvidence({
    workspaceId: workspace.workspace_id,
    taskInstanceId: input.taskInstanceId,
    evidenceType: input.evidenceType || 'note',
    noteText: input.noteText || '',
    externalLink: input.externalLink || '',
  });
  await persistDerivedWorkspaceState(input.assessmentId);
  await computeAndPersistBusinessReadiness(input.assessmentId);
  return getBusinessReadinessPayload(input.assessmentId);
}

export async function setBusinessReadinessEvidenceReview(input: { assessmentId: string; evidenceId: string; reviewStatus: string; }) {
  await reviewBrEvidence(input.evidenceId, input.reviewStatus);
  await persistDerivedWorkspaceState(input.assessmentId);
  await computeAndPersistBusinessReadiness(input.assessmentId);
  return getBusinessReadinessPayload(input.assessmentId);
}

export async function runBusinessReadinessLaunchCheck(assessmentId: string) {
  await persistDerivedWorkspaceState(assessmentId);
  await computeAndPersistBusinessReadiness(assessmentId);
  return getBusinessReadinessPayload(assessmentId);
}

export async function computeAndPersistBusinessReadiness(assessmentId: string) {
  const workspace = await getBrWorkspaceByAssessment(assessmentId);
  if (!workspace) return null;
  const bundle = await getBrWorkspaceBundle(workspace.workspace_id);
  const actionSummaries = buildActionSummaries(workspace, bundle);
  const nextActions = buildNextActionsFromActions(actionSummaries);
  const domains = bundle.domains || [];
  const blockers = bundle.blockers || [];
  const phaseStates = bundle.phases || [];

  const domainScores = domains.map((row: any) => ({
    domain_score_id: `${assessmentId}::${moduleIdFromCode('BR')}::${row.domain_code}`,
    assessment_id: assessmentId,
    module_id: moduleIdFromCode('BR'),
    domain_id: row.domain_code,
    domain_name: row.domain_name,
    raw_score_total: Number(row.percent_complete || scoreFromReadiness(row.readiness_state)),
    max_score_total: 100,
    score_pct: Number(row.percent_complete || scoreFromReadiness(row.readiness_state)),
    maturity_band: bandFromReadinessPercent(Number(row.percent_complete || 0)),
    questions_answered: Number(row.percent_complete || 0) > 0 ? 1 : 0,
    questions_total: 1,
    is_complete: Number(row.percent_complete || 0) === 100,
    metadata: { readiness_state: row.readiness_state, phase_code: row.phase_code, launch_critical: row.launch_critical },
  }));

  const scorePct = domainScores.length ? domainScores.reduce((sum: number, row: any) => sum + Number(row.score_pct || 0), 0) / domainScores.length : 0;
  const completedDomains = domainScores.filter((row: any) => Number(row.score_pct || 0) >= 100).length;
  const summaryPayload = {
    executive_narrative: [buildSponsorSummary(workspace, blockers, nextActions)],
    phase_states: phaseStates.map((row: any) => ({ phase_code: row.phase_code, phase_name: row.phase_name, status: row.status, percent_complete: row.percent_complete })),
    next_actions: nextActions,
    launch_ready_flag: Boolean(workspace.launch_ready_flag),
    blocker_count: blockers.length,
    region_label: getBrRegionLabel(workspace.primary_region_code),
    business_type_label: getBrBusinessTypeLabel(workspace.business_type_code),
    employer_intent: getEmployerIntent(bundle.profile),
  };

  const findings = blockers.map((row: any, index: number) => ({
    finding_instance_id: `${assessmentId}::MOD-BR::FINDING::${index + 1}`,
    assessment_id: assessmentId,
    module_id: moduleIdFromCode('BR'),
    domain_id: row.domain_code,
    workflow_id: row.task_code || row.blocker_code,
    question_id: row.task_code || row.blocker_code,
    source_library_id: row.task_code || row.blocker_code,
    severity_band: String(row.severity || 'high').toUpperCase(),
    finding_title: row.title,
    finding_narrative: row.description,
    business_impact: 'This setup gap can delay launch readiness and weaken early operating control.',
    likely_root_cause: 'The required Business Readiness action is still incomplete.',
    evidence_required: 'No',
    evidence_strength: 'Not applicable',
    is_priority: true,
    metadata: { blocker_type: row.blocker_type },
    created_at: nowIso(),
    updated_at: nowIso(),
  }));

  const recommendations = nextActions.map((row: any, index: number) => ({
    recommendation_instance_id: `${assessmentId}::MOD-BR::REC::${index + 1}`,
    assessment_id: assessmentId,
    module_id: moduleIdFromCode('BR'),
    linked_finding_instance_id: findings[index]?.finding_instance_id || '',
    source_library_id: row.action_code || row.id,
    recommendation_title: row.title,
    recommendation_text: row.reason,
    expected_outcome: 'This should move the business one step closer to clean launch readiness.',
    implementation_notes: row.next_task_name ? `Start with: ${row.next_task_name}.` : `Start in ${row.phase_name}.`,
    priority_rank: index + 1,
    priority_level: index === 0 ? 'HIGH' : 'MEDIUM',
    owner_role: 'Founder / Owner',
    metadata: { launch_critical: row.launch_critical, phase_code: row.phase_code },
    created_at: nowIso(),
    updated_at: nowIso(),
  }));

  const actions = nextActions.map((row: any, index: number) => ({
    action_instance_id: `${assessmentId}::MOD-BR::ACTION::${index + 1}`,
    assessment_id: assessmentId,
    module_id: moduleIdFromCode('BR'),
    linked_recommendation_instance_id: recommendations[index]?.recommendation_instance_id || '',
    source_library_id: row.action_code || row.id,
    action_title: row.title,
    action_text: row.reason,
    owner_role: 'Founder / Owner',
    action_deliverable: row.title,
    success_measure: row.next_task_name ? `Complete: ${row.next_task_name}` : 'Finish the action.',
    effort_level: row.launch_critical ? 'MEDIUM' : 'LOW',
    timeline_band: row.launch_critical ? 'P1' : 'P2',
    indicative_timeline: row.launch_critical ? 'Immediate' : '30 days',
    priority_level: row.launch_critical ? 'HIGH' : 'MEDIUM',
    metadata: { action_code: row.action_code, phase_code: row.phase_code },
    created_at: nowIso(),
    updated_at: nowIso(),
  }));

  const roadmap = nextActions.map((row: any, index: number) => {
    const band = phaseBandFromCode(row.phase_code);
    return {
      roadmap_instance_id: `${assessmentId}::MOD-BR::ROADMAP::${index + 1}`,
      assessment_id: assessmentId,
      module_id: moduleIdFromCode('BR'),
      linked_action_instance_id: actions[index]?.action_instance_id || '',
      source_library_id: row.action_code || row.id,
      phase_code: band.code,
      phase_name: band.name,
      initiative_title: row.title,
      initiative_text: row.reason,
      owner_role: 'Founder / Owner',
      priority_rank: index + 1,
      dependency_code: '',
      dependency_summary: '',
      target_outcome: 'Move the business one step closer to proper launch readiness.',
      success_measure: row.next_task_name ? `Complete: ${row.next_task_name}` : 'Finish the action.',
      execution_status: 'NOT_STARTED',
      status: 'NOT_STARTED',
      progress_pct: 0,
      execution_notes: '',
      source_module_id: moduleIdFromCode('BR'),
      source_finding_instance_id: findings[index]?.finding_instance_id || '',
      source_action_instance_id: actions[index]?.action_instance_id || '',
      initiative_description: row.reason,
      linked_metric_id: row.action_code || '',
      baseline_value: 'Not done',
      target_value: 'Done',
      review_frequency: band.code === 'P3' ? 'Monthly' : 'Weekly',
      business_outcome: row.launch_critical ? 'Clear launch blocker or setup gap' : 'Strengthen readiness and control',
      priority_effective: index + 1,
      dependency_flags: '',
      source_module_ids: moduleIdFromCode('BR'),
      source_row_ids: row.id,
      metadata: {
        br_internal_phase_code: row.phase_code,
        br_internal_phase_name: row.phase_name,
        br_action_code: row.action_code,
        br_launch_critical: Boolean(row.launch_critical),
        br_region_code: workspace.primary_region_code,
        br_business_type: workspace.business_type_code,
      },
      created_at: nowIso(),
      updated_at: nowIso(),
    };
  });

  const moduleScore = {
    module_score_id: `${assessmentId}::${moduleIdFromCode('BR')}`,
    assessment_id: assessmentId,
    module_id: moduleIdFromCode('BR'),
    raw_score_total: scorePct,
    max_score_total: 100,
    score_pct: Number(scorePct.toFixed(2)),
    maturity_band: bandFromReadinessPercent(scorePct),
    domains_completed: completedDomains,
    domains_total: domainScores.length,
    questions_answered: actionSummaries.filter((row) => row.status !== 'not_started').length,
    questions_total: actionSummaries.length,
    is_complete: Boolean(workspace.launch_ready_flag),
    readiness_status: workspace.launch_ready_flag ? 'READY' : 'IN_PROGRESS',
    metadata: {
      blocker_count: blockers.length,
      launch_ready_flag: workspace.launch_ready_flag,
      current_phase_code: workspace.current_phase_code,
    },
  };

  const runtimeState = {
    workspaceId: workspace.workspace_id,
    businessTypeCode: workspace.business_type_code,
    regionCode: workspace.primary_region_code,
    currentPhaseCode: workspace.current_phase_code,
    launchReadyFlag: workspace.launch_ready_flag,
    activeBlockerCount: blockers.length,
    templateVersion: workspace.template_version,
  };

  await updateAssessmentModuleState(assessmentId, 'BR', runtimeState, {
    moduleStatus: workspace.launch_ready_flag ? 'COMPLETE' : 'IN_PROGRESS',
    completionPct: Math.round(scorePct),
    summaryPayload,
  });

  await replaceModuleArtifacts(assessmentId, 'BR', {
    domainScores,
    moduleScore,
    findings,
    recommendations,
    actions,
    roadmap,
  });

  return { domainScores, moduleScore, findings, recommendations, actions, roadmap, summaryPayload };
}
