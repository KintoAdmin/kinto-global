// @ts-nocheck
import { getAssessmentById, ensureAssessmentModules, updateAssessmentModuleState } from '@/lib/repositories/assessments';
import { replaceModuleArtifacts } from '@/lib/repositories/runtime';
import { moduleIdFromCode } from '@/lib/constants/modules';
import { nowIso } from '@/lib/utils/ids';
import { BR_BUSINESS_TYPES, BR_DOMAINS, BR_LAUNCH_DOMAIN_CODES, BR_PHASES, BR_READINESS_PERCENT, BR_REGIONS, bandFromReadinessPercent, readinessLabel } from '@/lib/business-readiness/catalog';
import { createBrWorkspace, getBrWorkspaceByAssessment, getBrWorkspaceBundle, replaceBrBlockers, replaceBrDomainStates, replaceBrPhaseStates, updateBrWorkspace } from '@/lib/repositories/business-readiness';

function phaseName(code: string) {
  return BR_PHASES.find((row) => row.code === code)?.name || code;
}
function domainName(code: string) {
  return BR_DOMAINS.find((row) => row.code === code)?.name || code;
}

function buildInitialPhaseStates(workspaceId: string) {
  return BR_PHASES.map((phase, index) => ({
    phase_state_id: `${workspaceId}::${phase.code}`,
    workspace_id: workspaceId,
    phase_code: phase.code,
    phase_name: phase.name,
    sort_order: index + 1,
    status: index === 0 ? 'in_progress' : 'not_started',
    percent_complete: index === 0 ? 10 : 0,
    blocked_flag: false,
    last_derived_at: nowIso(),
  }));
}

function buildInitialDomainStates(workspaceId: string, businessName?: string | null) {
  return BR_DOMAINS.map((domain, index) => ({
    domain_state_id: `${workspaceId}::${domain.code}`,
    workspace_id: workspaceId,
    domain_code: domain.code,
    domain_name: domain.name,
    phase_code: domain.phase_code,
    sort_order: index + 1,
    readiness_state: domain.code === 'd01_business_definition' && businessName ? 'started' : 'not_started',
    percent_complete: domain.code === 'd01_business_definition' && businessName ? 25 : 0,
    blocker_flag: false,
    next_required_task_code: '',
    missing_evidence_count: 0,
    launch_critical: domain.launch_critical,
    last_derived_at: nowIso(),
  }));
}

function buildBlockers(workspaceId: string, domains: any[]) {
  const blockerDomains = domains.filter((row) => BR_LAUNCH_DOMAIN_CODES.includes(row.domain_code) && !['set_up', 'operational', 'controlled'].includes(String(row.readiness_state || '').toLowerCase()));
  return blockerDomains.slice(0, 8).map((row, index) => ({
    blocker_id: `${workspaceId}::BLOCKER::${row.domain_code}`,
    workspace_id: workspaceId,
    blocker_code: row.domain_code,
    blocker_type: 'missing_setup',
    domain_code: row.domain_code,
    title: `Complete ${row.domain_name || domainName(row.domain_code)}`,
    description: `${row.domain_name || domainName(row.domain_code)} must reach at least Set up before launch can be green.`,
    severity: index < 4 ? 'critical' : 'high',
    active_flag: true,
    sort_order: index + 1,
    created_at: nowIso(),
  }));
}

function buildNextActions(domains: any[]) {
  return domains
    .filter((row) => BR_LAUNCH_DOMAIN_CODES.includes(row.domain_code) && !['set_up', 'operational', 'controlled'].includes(String(row.readiness_state || '').toLowerCase()))
    .slice(0, 5)
    .map((row, index) => ({
      id: `${row.domain_code}::${index + 1}`,
      title: `Put ${row.domain_name || domainName(row.domain_code)} in place`,
      reason: `${row.domain_name || domainName(row.domain_code)} is still below the minimum launch threshold.`,
      phase_code: row.phase_code,
      phase_name: phaseName(row.phase_code),
      launch_critical: true,
      priority_rank: index + 1,
    }));
}

function buildSponsorSummary(workspace: any, blockers: any[], nextActions: any[]) {
  const region = BR_REGIONS.find((row) => row.code === workspace?.primary_region_code)?.label || workspace?.primary_region_code || 'selected region';
  const businessType = BR_BUSINESS_TYPES.find((row) => row.code === workspace?.business_type_code)?.label || workspace?.business_type_code || 'selected business type';
  if (!workspace) return 'Business Readiness has not been configured yet.';
  if (!blockers.length) return `The ${businessType} setup for ${region} has no active launch blockers right now. Focus next on moving remaining domains from Set up into Operational and Controlled.`;
  const top = blockers.slice(0, 3).map((row) => row.title).join(', ');
  return `This ${businessType} workspace for ${region} has been started, but launch is still blocked by ${blockers.length} critical setup gaps. The most important gaps right now are ${top}.`;
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
      blockers: [],
      nextActions: [],
      sponsorSummary: 'Start by choosing the kind of business you are building and where it will operate.',
    };
  }
  const bundle = await getBrWorkspaceBundle(workspace.workspace_id);
  const nextActions = buildNextActions(bundle.domains || []);
  return {
    assessmentId,
    workspace,
    profile: bundle.profile,
    regionProfile: bundle.regionProfile,
    catalog: { businessTypes: BR_BUSINESS_TYPES, regions: BR_REGIONS, phases: BR_PHASES, domains: BR_DOMAINS },
    phaseStates: bundle.phases || [],
    domainStates: bundle.domains || [],
    blockers: bundle.blockers || [],
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
    });
  }

  const phaseStates = buildInitialPhaseStates(workspace.workspace_id);
  const domainStates = buildInitialDomainStates(workspace.workspace_id, input.businessName);
  const blockers = buildBlockers(workspace.workspace_id, domainStates);

  await replaceBrPhaseStates(workspace.workspace_id, phaseStates);
  await replaceBrDomainStates(workspace.workspace_id, domainStates);
  await replaceBrBlockers(workspace.workspace_id, blockers);
  await updateBrWorkspace(workspace.workspace_id, { active_blocker_count: blockers.length, overall_readiness_state: 'started', launch_ready_flag: false });
  await computeAndPersistBusinessReadiness(input.assessmentId);
  return getBusinessReadinessPayload(input.assessmentId);
}

export async function computeAndPersistBusinessReadiness(assessmentId: string) {
  const workspace = await getBrWorkspaceByAssessment(assessmentId);
  if (!workspace) return null;
  const bundle = await getBrWorkspaceBundle(workspace.workspace_id);
  const domains = bundle.domains || [];
  const blockers = bundle.blockers || [];
  const phaseStates = bundle.phases || [];
  const nextActions = buildNextActions(domains);

  const domainScores = domains.map((row: any) => ({
    domain_score_id: `${assessmentId}::${moduleIdFromCode('BR')}::${row.domain_code}`,
    assessment_id: assessmentId,
    module_id: moduleIdFromCode('BR'),
    domain_id: row.domain_code,
    domain_name: row.domain_name || domainName(row.domain_code),
    raw_score_total: BR_READINESS_PERCENT[String(row.readiness_state || 'not_started').toLowerCase()] || 0,
    max_score_total: 100,
    score_pct: Number(row.percent_complete || BR_READINESS_PERCENT[String(row.readiness_state || 'not_started').toLowerCase()] || 0),
    maturity_band: bandFromReadinessPercent(Number(row.percent_complete || BR_READINESS_PERCENT[String(row.readiness_state || 'not_started').toLowerCase()] || 0)),
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
    blocker_count: blockers.length,
    launch_ready: blockers.length === 0,
    business_type_code: workspace.business_type_code,
    primary_region_code: workspace.primary_region_code,
  };

  const moduleScore = {
    module_score_id: `${assessmentId}::${moduleIdFromCode('BR')}`,
    assessment_id: assessmentId,
    module_id: moduleIdFromCode('BR'),
    raw_score_total: Math.round(scorePct),
    max_score_total: 100,
    score_pct: Number(scorePct.toFixed(2)),
    maturity_band: bandFromReadinessPercent(Number(scorePct || 0)),
    domains_completed: completedDomains,
    domains_total: domainScores.length,
    questions_answered: completedDomains,
    questions_total: domainScores.length,
    is_complete: blockers.length === 0 && completedDomains >= BR_LAUNCH_DOMAIN_CODES.length,
    readiness_status: blockers.length === 0 ? 'READY' : 'IN_PROGRESS',
    critical_exposures: blockers.length,
  };

  const findings = blockers.map((row: any, index: number) => ({
    finding_instance_id: `${assessmentId}::${moduleIdFromCode('BR')}::FINDING::${index + 1}`,
    assessment_id: assessmentId,
    module_id: moduleIdFromCode('BR'),
    domain_id: row.domain_code,
    severity_band: row.severity,
    finding_title: row.title,
    finding_narrative: row.description,
    business_impact: 'This gap keeps the business below the minimum launch-ready threshold.',
    is_priority: true,
  }));

  const actions = nextActions.map((row: any, index: number) => ({
    action_instance_id: `${assessmentId}::${moduleIdFromCode('BR')}::ACTION::${index + 1}`,
    assessment_id: assessmentId,
    module_id: moduleIdFromCode('BR'),
    action_title: row.title,
    action_text: row.reason,
    owner_role: 'Founder / Owner',
    timeline_band: index < 3 ? 'Immediate' : '30 Days',
    indicative_timeline: index < 3 ? 'Immediate' : '30 Days',
    priority_level: index < 3 ? 'High' : 'Medium',
  }));

  const roadmap = nextActions.map((row: any, index: number) => ({
    roadmap_instance_id: `${assessmentId}::${moduleIdFromCode('BR')}::ROADMAP::${index + 1}`,
    assessment_id: assessmentId,
    module_id: moduleIdFromCode('BR'),
    source_action_instance_id: `${assessmentId}::${moduleIdFromCode('BR')}::ACTION::${index + 1}`,
    phase_code: index < 3 ? 'P1' : index < 5 ? 'P2' : 'P3',
    phase_name: index < 3 ? 'Stabilise and Protect' : index < 5 ? 'Standardise and Strengthen' : 'Optimize, Automate, and AI-Enable',
    initiative_title: row.title,
    initiative_description: row.reason,
    owner_role: 'Founder / Owner',
    business_outcome: 'Moves the business closer to launch readiness.',
    priority_rank: index + 1,
    execution_status: blockers.length ? 'READY' : 'NOT_STARTED',
    dependency_summary: '',
    metadata: { br_internal_phase_code: row.phase_code, br_internal_phase_name: row.phase_name, br_launch_critical: true },
  }));

  await replaceModuleArtifacts(assessmentId, 'BR', { domainScores, moduleScore, findings, recommendations: [], actions, roadmap });
  await updateAssessmentModuleState(assessmentId, 'BR', {
    workspace_id: workspace.workspace_id,
    business_type_code: workspace.business_type_code,
    region_code: workspace.primary_region_code,
    current_phase_code: workspace.current_phase_code,
    launch_ready_flag: blockers.length === 0,
    active_blocker_count: blockers.length,
  }, {
    moduleStatus: blockers.length === 0 ? 'COMPLETE' : 'IN_PROGRESS',
    completionPct: Math.round(scorePct),
    summaryPayload,
  });

  return { domainScores, moduleScore, findings, actions, roadmap, summaryPayload };
}
