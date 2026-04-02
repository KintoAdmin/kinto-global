// @ts-nocheck
import { ensureAssessmentModules, getAssessmentById, updateAssessmentModuleState } from '@/lib/repositories/assessments';
import { replaceModuleArtifacts } from '@/lib/repositories/runtime';
import { moduleIdFromCode } from '@/lib/constants/modules';
import { nowIso } from '@/lib/utils/ids';
import {
  BR_BUSINESS_TYPES,
  BR_DOMAINS,
  BR_LAUNCH_DOMAIN_CODES,
  BR_PHASES,
  BR_READINESS_PERCENT,
  BR_REGIONS,
  bandFromReadinessPercent,
  buildBrTaskTemplates,
  getBrBusinessTypeLabel,
  getBrDomain,
  getBrPhase,
  getBrRegionLabel,
  readinessLabel,
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

function phaseName(code: string) {
  return BR_PHASES.find((row) => row.code === code)?.name || code;
}
function domainName(code: string) {
  return BR_DOMAINS.find((row) => row.code === code)?.name || code;
}

function scoreFromReadiness(state?: string | null) {
  return BR_READINESS_PERCENT[String(state || 'not_started').toLowerCase()] || 0;
}

function phaseBandFromCode(phaseCode?: string | null) {
  if (phaseCode === 'phase_0_define' || phaseCode === 'phase_1_formal' || phaseCode === 'phase_2_financial') return { code: 'P1', name: 'Stabilise and Protect' };
  if (phaseCode === 'phase_3_operating' || phaseCode === 'phase_4_control') return { code: 'P2', name: 'Standardise and Strengthen' };
  return { code: 'P3', name: 'Optimize, Automate, and AI-Enable' };
}

function buildTaskInstances(workspaceId: string, businessTypeCode: string, regionCode: string) {
  return buildBrTaskTemplates({ businessTypeCode, regionCode }).map((task, index) => ({
    task_instance_id: `${workspaceId}::${task.code}`,
    workspace_id: workspaceId,
    task_code: task.code,
    domain_code: task.domain_code,
    phase_code: task.phase_code,
    task_name: task.title,
    task_description: task.description,
    task_role: task.role,
    status: 'not_started',
    required_flag: Boolean(task.required),
    can_block_launch: Boolean(task.launch_critical),
    evidence_required_flag: Boolean(task.evidence_required),
    sort_order: Number(task.sort_order || index + 1),
    is_region_specific: Array.isArray(task.regions) && task.regions.length > 0,
    is_business_type_specific: Array.isArray(task.business_types) && task.business_types.length > 0,
    metadata: { region_codes: task.regions || [], business_type_codes: task.business_types || [] },
    created_at: nowIso(),
    updated_at: nowIso(),
  }));
}

function deriveDomainState(tasks: any[], evidence: any[]) {
  const setupRequired = tasks.filter((row) => row.required_flag && row.task_role === 'setup');
  const operateRequired = tasks.filter((row) => row.required_flag && row.task_role === 'operate');
  const controlRequired = tasks.filter((row) => row.required_flag && row.task_role === 'control');

  const started = tasks.some((row) => ['in_progress', 'done'].includes(String(row.status || '')));
  const proofMissingForTask = (task: any) => {
    if (!task.evidence_required_flag) return false;
    const linked = evidence.filter((item) => item.task_instance_id === task.task_instance_id && item.review_status !== 'needs_attention');
    return linked.length === 0;
  };
  const setupTasksDoneIgnoringProof = setupRequired.every((row) => row.status === 'done');
  const setupDone = setupRequired.every((row) => row.status === 'done' && !proofMissingForTask(row));
  const operateDone = operateRequired.every((row) => row.status === 'done');
  const controlDone = controlRequired.every((row) => row.status === 'done');

  let readiness = 'not_started';
  if (!started) readiness = 'not_started';
  else if (!setupDone) readiness = 'started';
  else if (setupDone && !operateDone) readiness = 'set_up';
  else if (setupDone && operateDone && !controlDone) readiness = 'operational';
  else readiness = 'controlled';

  const setupWeight = 50;
  const operateWeight = 30;
  const controlWeight = 20;
  const progress = (bucketTasks: any[], weight: number) => {
    if (!bucketTasks.length) return 0;
    const done = bucketTasks.filter((row) => row.status === 'done' && !proofMissingForTask(row)).length;
    return (done / bucketTasks.length) * weight;
  };
  const percentComplete = Math.round(progress(setupRequired, setupWeight) + progress(operateRequired, operateWeight) + progress(controlRequired, controlWeight));
  const missingEvidenceTasks = tasks.filter((row) => row.evidence_required_flag && row.status === 'done' && proofMissingForTask(row));
  const missingEvidenceCount = missingEvidenceTasks.length;
  const nextTask = tasks.find((row) => row.required_flag && row.status !== 'done') || tasks.find((row) => row.status !== 'done');

  return {
    readiness_state: readiness,
    percent_complete: percentComplete,
    missing_evidence_count: missingEvidenceCount,
    next_required_task_code: nextTask?.task_code || '',
    setup_tasks_done_ignoring_proof: setupTasksDoneIgnoringProof,
    next_required_task_name: nextTask?.task_name || '',
    missing_evidence_task_name: missingEvidenceTasks[0]?.task_name || '',
  };
}

function deriveWorkspaceState(workspace: any, bundle: any) {
  const tasks = bundle.tasks || [];
  const evidence = bundle.evidence || [];

  const domainStates = BR_DOMAINS.map((domain, index) => {
    const domainTasks = tasks.filter((row) => row.domain_code === domain.code);
    const derived = deriveDomainState(domainTasks, evidence);
    return {
      domain_state_id: `${workspace.workspace_id}::${domain.code}`,
      workspace_id: workspace.workspace_id,
      domain_code: domain.code,
      domain_name: domain.name,
      phase_code: domain.phase_code,
      sort_order: index + 1,
      readiness_state: derived.readiness_state,
      percent_complete: derived.percent_complete,
      blocker_flag: domain.launch_critical && !['set_up', 'operational', 'controlled'].includes(String(derived.readiness_state || '')),
      next_required_task_code: derived.next_required_task_code,
      missing_evidence_count: derived.missing_evidence_count,
      launch_critical: domain.launch_critical,
      last_derived_at: nowIso(),
    };
  });

  const basePhaseStates = BR_PHASES.map((phase, index) => {
    const rows = domainStates.filter((row) => row.phase_code === phase.code);
    const avg = rows.length ? rows.reduce((sum, row) => sum + Number(row.percent_complete || 0), 0) / rows.length : 0;
    const blocked = rows.some((row) => row.blocker_flag);
    let status = 'not_started';
    if (blocked) status = 'blocked';
    else if (rows.length && rows.every((row) => ['set_up', 'operational', 'controlled'].includes(String(row.readiness_state || '')))) status = 'complete';
    else if (rows.some((row) => Number(row.percent_complete || 0) > 0)) status = 'in_progress';
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
      return {
        ...row,
        status: 'locked',
        percent_complete: 0,
        blocked_flag: false,
      };
    }
    return row;
  });

  const blockers = domainStates
    .filter((row) => row.launch_critical && !['set_up', 'operational', 'controlled'].includes(String(row.readiness_state || '')))
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
    .map((row, index) => {
      const proofOnly = row.setup_tasks_done_ignoring_proof && row.missing_evidence_count > 0;
      return {
        blocker_id: `${workspace.workspace_id}::BLOCKER::${row.domain_code}`,
        workspace_id: workspace.workspace_id,
        blocker_code: row.domain_code,
        blocker_type: proofOnly ? 'missing_evidence' : 'missing_setup',
        domain_code: row.domain_code,
        task_code: row.next_required_task_code || '',
        title: proofOnly ? `Add proof for ${row.missing_evidence_task_name || row.domain_name}` : (row.next_required_task_name || `Complete ${row.domain_name}`),
        description: proofOnly
          ? `This step is marked done, but proof is still missing before ${row.domain_name} can count as properly set up.`
          : `${row.domain_name} still needs its core setup steps in place before launch can be green.`,
        severity: index < 4 ? 'critical' : 'high',
        active_flag: true,
        sort_order: index + 1,
        created_at: nowIso(),
      };
    });

  const requiredLaunchDomainsReady = domainStates
    .filter((row) => BR_LAUNCH_DOMAIN_CODES.includes(row.domain_code))
    .every((row) => ['set_up', 'operational', 'controlled'].includes(String(row.readiness_state || '')));
  const launchReadyFlag = requiredLaunchDomainsReady && blockers.length === 0;

  const overallScore = domainStates.length ? domainStates.reduce((sum, row) => sum + Number(row.percent_complete || 0), 0) / domainStates.length : 0;
  let overallReadinessState = 'not_started';
  if (overallScore > 0 && overallScore < 50) overallReadinessState = 'started';
  if (overallScore >= 50 && overallScore < 80) overallReadinessState = 'set_up';
  if (overallScore >= 80 && overallScore < 100) overallReadinessState = 'operational';
  if (overallScore >= 100) overallReadinessState = 'controlled';
  const currentPhase = phaseStates.find((row) => row.status !== 'complete')?.phase_code || 'phase_5_launch';

  return {
    domainStates,
    phaseStates,
    blockers,
    workspacePatch: {
      current_phase_code: currentPhase,
      overall_readiness_state: launchReadyFlag ? 'set_up' : overallReadinessState,
      launch_ready_flag: launchReadyFlag,
      active_blocker_count: blockers.length,
    },
  };
}

function buildNextActionsFromTasks(tasks: any[], blockers: any[]) {
  const blockerTaskCodes = new Set(blockers.map((row) => row.task_code).filter(Boolean));
  return tasks
    .filter((row) => row.required_flag && row.status !== 'done')
    .sort((a, b) => {
      const blockerDelta = Number(blockerTaskCodes.has(b.task_code)) - Number(blockerTaskCodes.has(a.task_code));
      if (blockerDelta !== 0) return blockerDelta;
      const launchDelta = Number(Boolean(b.can_block_launch)) - Number(Boolean(a.can_block_launch));
      if (launchDelta !== 0) return launchDelta;
      return Number(a.sort_order || 0) - Number(b.sort_order || 0);
    })
    .slice(0, 5)
    .map((row, index) => ({
      id: `${row.task_code}::${index + 1}`,
      title: row.task_name,
      reason: row.task_description,
      phase_code: row.phase_code,
      phase_name: phaseName(row.phase_code),
      launch_critical: Boolean(row.can_block_launch),
      priority_rank: index + 1,
      task_instance_id: row.task_instance_id,
      task_code: row.task_code,
    }));
}

function buildSponsorSummary(workspace: any, blockers: any[], nextActions: any[]) {
  if (!workspace) return 'Business Readiness has not been configured yet.';
  const region = getBrRegionLabel(workspace.primary_region_code);
  const businessType = getBrBusinessTypeLabel(workspace.business_type_code);
  if (!blockers.length) return `The ${businessType} setup for ${region} has no active launch blockers right now. Focus next on moving the remaining setup into stable operation and control.`;
  const top = nextActions.slice(0, 3).map((row) => row.title).join(', ');
  return `This ${businessType} workspace for ${region} has been started, but launch is still blocked by ${blockers.length} critical setup gaps. The most important next moves are ${top}.`;
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
  return { workspace: { ...workspace, ...derived.workspacePatch }, bundle: await getBrWorkspaceBundle(workspace.workspace_id), derived };
}

export async function getBusinessReadinessPayload(assessmentId: string) {
  const assessment = await getAssessmentById(assessmentId);
  if (!assessment) throw new Error(`Assessment ${assessmentId} was not found.`);
  const workspace = await getBrWorkspaceByAssessment(assessmentId);
  if (!workspace) {
    return {
      assessmentId,
      workspace: null,
      catalog: { businessTypes: BR_BUSINESS_TYPES, regions: BR_REGIONS, phases: BR_PHASES, domains: BR_DOMAINS },
      phaseStates: [],
      domainStates: [],
      tasks: [],
      blockers: [],
      evidence: [],
      nextActions: [],
      sponsorSummary: 'Start by choosing the kind of business you are building and where it will operate.',
    };
  }
  const { bundle } = await persistDerivedWorkspaceState(assessmentId) || { bundle: await getBrWorkspaceBundle(workspace.workspace_id) };
  const nextActions = buildNextActionsFromTasks(bundle.tasks || [], bundle.blockers || []);
  return {
    assessmentId,
    workspace: await getBrWorkspaceByAssessment(assessmentId),
    profile: bundle.profile,
    regionProfile: bundle.regionProfile,
    catalog: { businessTypes: BR_BUSINESS_TYPES, regions: BR_REGIONS, phases: BR_PHASES, domains: BR_DOMAINS },
    phaseStates: bundle.phases || [],
    domainStates: bundle.domains || [],
    tasks: bundle.tasks || [],
    blockers: bundle.blockers || [],
    evidence: bundle.evidence || [],
    nextActions,
    sponsorSummary: buildSponsorSummary(workspace, bundle.blockers || [], nextActions),
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
  if (!assessment) throw new Error(`Assessment ${input.assessmentId} was not found.`);
  await ensureAssessmentModules(input.assessmentId);

  let workspace = await getBrWorkspaceByAssessment(input.assessmentId);
  if (!workspace) {
    workspace = await createBrWorkspace({
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
    });
  } else {
    workspace = await updateBrWorkspace(workspace.workspace_id, {
      business_type_code: input.businessTypeCode,
      primary_region_code: input.primaryRegionCode,
      sub_region_code: input.subRegionCode || '',
      current_phase_code: 'phase_0_define',
      template_version: 'br-v2',
    });
  }

  const taskInstances = buildTaskInstances(workspace.workspace_id, input.businessTypeCode, input.primaryRegionCode);
  await replaceBrTaskInstances(workspace.workspace_id, taskInstances);
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
  const task = await getBrTaskInstance(input.taskInstanceId);
  if (!task) throw new Error('Task not found.');
  if (input.replaceExisting) await deleteBrEvidenceByTask(workspace.workspace_id, input.taskInstanceId);
  await addBrEvidence({
    workspaceId: workspace.workspace_id,
    taskInstanceId: input.taskInstanceId,
    evidenceType: input.evidenceType || 'note',
    noteText: input.noteText || '',
    externalLink: input.externalLink || '',
  });
  if (task.status !== 'done') {
    await updateBrTaskInstance(input.taskInstanceId, { status: 'done' });
  }
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
  const domains = bundle.domains || [];
  const blockers = bundle.blockers || [];
  const phaseStates = bundle.phases || [];
  const tasks = bundle.tasks || [];
  const nextActions = buildNextActionsFromTasks(tasks, blockers);

  const domainScores = domains.map((row: any) => ({
    domain_score_id: `${assessmentId}::${moduleIdFromCode('BR')}::${row.domain_code}`,
    assessment_id: assessmentId,
    module_id: moduleIdFromCode('BR'),
    domain_id: row.domain_code,
    domain_name: row.domain_name || domainName(row.domain_code),
    raw_score_total: scoreFromReadiness(row.readiness_state),
    max_score_total: 100,
    score_pct: Number(row.percent_complete || scoreFromReadiness(row.readiness_state)),
    maturity_band: bandFromReadinessPercent(Number(row.percent_complete || scoreFromReadiness(row.readiness_state))),
    questions_answered: Number(row.percent_complete || 0) > 0 ? 1 : 0,
    questions_total: 1,
    is_complete: ['set_up', 'operational', 'controlled'].includes(String(row.readiness_state || '').toLowerCase()),
    metadata: { readiness_state: row.readiness_state, phase_code: row.phase_code, launch_critical: row.launch_critical },
  }));

  const scorePct = domainScores.length ? domainScores.reduce((sum: number, row: any) => sum + Number(row.score_pct || 0), 0) / domainScores.length : 0;
  const completedDomains = domainScores.filter((row: any) => Number(row.score_pct || 0) >= 50).length;
  const summaryPayload = {
    executive_narrative: [buildSponsorSummary(workspace, blockers, nextActions)],
    phase_states: phaseStates.map((row: any) => ({ phase_code: row.phase_code, phase_name: row.phase_name, status: row.status, percent_complete: row.percent_complete })),
    next_actions: nextActions,
    launch_ready_flag: Boolean(workspace.launch_ready_flag),
    blocker_count: blockers.length,
    region_label: getBrRegionLabel(workspace.primary_region_code),
    business_type_label: getBrBusinessTypeLabel(workspace.business_type_code),
  };

  const findings = blockers.map((row: any, index: number) => ({
    finding_instance_id: `${assessmentId}::MOD-BR::FINDING::${index + 1}`,
    assessment_id: assessmentId,
    module_id: moduleIdFromCode('BR'),
    domain_id: row.domain_code,
    workflow_id: row.task_code || row.domain_code,
    question_id: row.task_code || row.domain_code,
    source_library_id: row.task_code || row.domain_code,
    severity_band: String(row.severity || 'high').toUpperCase(),
    finding_title: row.title,
    finding_narrative: row.description,
    business_impact: 'This setup gap can delay launch readiness and weaken early operating control.',
    likely_root_cause: 'The required readiness step is either incomplete or still missing proof.',
    evidence_required: row.blocker_type === 'missing_evidence' ? 'Yes' : 'Possibly',
    evidence_strength: row.blocker_type === 'missing_evidence' ? 'Missing' : 'Partial',
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
    source_library_id: row.task_code || row.id,
    recommendation_title: row.title,
    recommendation_text: row.reason,
    expected_outcome: 'This should move the business closer to launch readiness.',
    implementation_notes: `Start in ${row.phase_name}.`,
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
    source_library_id: row.task_code || row.id,
    action_title: row.title,
    action_text: row.reason,
    owner_role: 'Founder / Owner',
    action_deliverable: row.title,
    success_measure: 'Task completed with the required proof where relevant.',
    effort_level: row.launch_critical ? 'MEDIUM' : 'LOW',
    timeline_band: row.launch_critical ? 'P1' : 'P2',
    indicative_timeline: row.launch_critical ? 'Immediate' : '30 days',
    priority_level: row.launch_critical ? 'HIGH' : 'MEDIUM',
    metadata: { task_instance_id: row.task_instance_id, phase_code: row.phase_code },
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
      source_library_id: row.task_code || row.id,
      phase_code: band.code,
      phase_name: band.name,
      initiative_title: row.title,
      initiative_text: row.reason,
      owner_role: 'Founder / Owner',
      priority_rank: index + 1,
      dependency_code: '',
      dependency_summary: '',
      target_outcome: 'Move the business one step closer to proper launch readiness.',
      success_measure: 'Step completed and reflected in Business Readiness.',
      execution_status: 'NOT_STARTED',
      status: 'NOT_STARTED',
      progress_pct: 0,
      execution_notes: '',
      source_module_id: moduleIdFromCode('BR'),
      source_finding_instance_id: findings[index]?.finding_instance_id || '',
      source_action_instance_id: actions[index]?.action_instance_id || '',
      initiative_description: row.reason,
      linked_metric_id: row.task_code || '',
      baseline_value: 'Not done',
      target_value: 'Done',
      review_frequency: band.code === 'P3' ? 'Monthly' : 'Weekly',
      business_outcome: row.launch_critical ? 'Clear launch blocker or setup gap' : 'Strengthen readiness and control',
      priority_effective: index + 1,
      dependency_flags: '',
      source_module_ids: moduleIdFromCode('BR'),
      source_row_ids: row.id,
      metadata: {
        br_domain_code: tasks.find((task) => task.task_instance_id === row.task_instance_id)?.domain_code || '',
        br_internal_phase_code: row.phase_code,
        br_internal_phase_name: row.phase_name,
        br_task_code: row.task_code || '',
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
    domains_total: domains.length,
    questions_answered: tasks.filter((row: any) => row.status === 'done').length,
    questions_total: tasks.length,
    is_complete: workspace.launch_ready_flag,
    readiness_status: readinessLabel(workspace.overall_readiness_state),
    critical_exposures: blockers.filter((row: any) => row.severity === 'critical').length,
    calculated_at: nowIso(),
    metadata: { launch_ready_flag: workspace.launch_ready_flag, blocker_count: blockers.length },
  };

  await replaceModuleArtifacts(assessmentId, 'BR', {
    domainScores,
    moduleScore,
    findings,
    recommendations,
    actions,
    roadmap,
    summaryPayload,
    moduleStatus: workspace.launch_ready_flag ? 'COMPLETE' : blockers.length ? 'IN_PROGRESS' : 'NOT_STARTED',
    completionPct: Math.min(100, Math.round(scorePct)),
  });

  await updateAssessmentModuleState(assessmentId, 'BR', {
    workspace_id: workspace.workspace_id,
    business_type_code: workspace.business_type_code,
    region_code: workspace.primary_region_code,
    current_phase_code: workspace.current_phase_code,
    launch_ready_flag: workspace.launch_ready_flag,
    blocker_count: blockers.length,
    next_actions: nextActions,
  }, {
    moduleStatus: workspace.launch_ready_flag ? 'COMPLETE' : blockers.length ? 'IN_PROGRESS' : 'NOT_STARTED',
    completionPct: Math.min(100, Math.round(scorePct)),
    summaryPayload,
  });

  return { scorePct, blockers: blockers.length, launchReadyFlag: workspace.launch_ready_flag };
}
