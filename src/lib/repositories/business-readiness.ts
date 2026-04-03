// @ts-nocheck
import { getAdminClient } from '@/lib/supabase/admin';
import { nowIso } from '@/lib/utils/ids';

export async function getBrWorkspaceByAssessment(assessmentId: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase.from('br_workspaces').select('*').eq('assessment_id', assessmentId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getBrWorkspaceBundle(workspaceId: string) {
  const supabase = getAdminClient();
  const [profileRes, regionRes, phasesRes, domainsRes, blockersRes, tasksRes, evidenceRes] = await Promise.all([
    supabase.from('br_business_profiles').select('*').eq('workspace_id', workspaceId).maybeSingle(),
    supabase.from('br_region_profiles').select('*').eq('workspace_id', workspaceId).maybeSingle(),
    supabase.from('br_phase_states').select('*').eq('workspace_id', workspaceId).order('sort_order', { ascending: true }),
    supabase.from('br_domain_states').select('*').eq('workspace_id', workspaceId).order('sort_order', { ascending: true }),
    supabase.from('br_blockers').select('*').eq('workspace_id', workspaceId).eq('active_flag', true).order('sort_order', { ascending: true }),
    supabase.from('br_task_instances').select('*').eq('workspace_id', workspaceId).order('sort_order', { ascending: true }),
    supabase.from('br_evidence_items').select('*').eq('workspace_id', workspaceId).order('uploaded_at', { ascending: false }),
  ]);
  if (profileRes.error) throw profileRes.error;
  if (regionRes.error) throw regionRes.error;
  if (phasesRes.error) throw phasesRes.error;
  if (domainsRes.error) throw domainsRes.error;
  if (blockersRes.error) throw blockersRes.error;
  if (tasksRes.error) throw tasksRes.error;
  if (evidenceRes.error) throw evidenceRes.error;
  return {
    profile: profileRes.data || null,
    regionProfile: regionRes.data || null,
    phases: phasesRes.data || [],
    domains: domainsRes.data || [],
    blockers: blockersRes.data || [],
    tasks: tasksRes.data || [],
    evidence: evidenceRes.data || [],
  };
}

export async function createBrWorkspace(input: {
  assessmentId: string;
  clientId: string;
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
  const supabase = getAdminClient();
  const ts = nowIso();
  const workspaceId = `${input.assessmentId}::MOD-BR::WORKSPACE`;
  const workspace = {
    workspace_id: workspaceId,
    assessment_id: input.assessmentId,
    client_id: input.clientId,
    module_id: 'MOD-BR',
    business_type_code: input.businessTypeCode,
    primary_region_code: input.primaryRegionCode,
    sub_region_code: input.subRegionCode || '',
    current_phase_code: 'phase_0_define',
    overall_readiness_state: 'started',
    launch_ready_flag: false,
    active_blocker_count: 0,
    template_version: 'br-v9-uae-content',
    created_at: ts,
    updated_at: ts,
  };
  const profile = {
    workspace_id: workspaceId,
    business_name: input.businessName || '',
    trading_name: input.businessName || '',
    founder_name: input.founderName || '',
    business_description: input.businessDescription || input.whatYouSell || '',
    target_customer: input.targetCustomer || '',
    revenue_model: input.revenueModel || '',
    operating_channel: input.operatingChannel || '',
    notes: '',
    created_at: ts,
    updated_at: ts,
  };
  const regionProfile = {
    workspace_id: workspaceId,
    region_code: input.primaryRegionCode,
    sub_region_code: input.subRegionCode || '',
    country_code: input.primaryRegionCode,
    state_province_code: input.subRegionCode || '',
    first_operating_location: input.subRegionCode || '',
    created_at: ts,
    updated_at: ts,
  };

  const { error: wsError } = await supabase.from('br_workspaces').upsert(workspace, { onConflict: 'assessment_id' });
  if (wsError) throw wsError;
  const { error: profileError } = await supabase.from('br_business_profiles').upsert(profile, { onConflict: 'workspace_id' });
  if (profileError) throw profileError;
  const { error: regionError } = await supabase.from('br_region_profiles').upsert(regionProfile, { onConflict: 'workspace_id' });
  if (regionError) throw regionError;
  return workspace;
}

export async function replaceBrPhaseStates(workspaceId: string, rows: any[]) {
  const supabase = getAdminClient();
  const { error: deleteError } = await supabase.from('br_phase_states').delete().eq('workspace_id', workspaceId);
  if (deleteError) throw deleteError;
  if (!rows.length) return;
  const { error: upsertError } = await supabase.from('br_phase_states').insert(rows);
  if (upsertError) throw upsertError;
}

export async function replaceBrDomainStates(workspaceId: string, rows: any[]) {
  const supabase = getAdminClient();
  const { error: deleteError } = await supabase.from('br_domain_states').delete().eq('workspace_id', workspaceId);
  if (deleteError) throw deleteError;
  if (!rows.length) return;
  const { error: upsertError } = await supabase.from('br_domain_states').insert(rows);
  if (upsertError) throw upsertError;
}

export async function replaceBrBlockers(workspaceId: string, rows: any[]) {
  const supabase = getAdminClient();
  const { error: deleteError } = await supabase.from('br_blockers').delete().eq('workspace_id', workspaceId);
  if (deleteError) throw deleteError;
  if (!rows.length) return;
  const { error: insertError } = await supabase.from('br_blockers').insert(rows);
  if (insertError) throw insertError;
}

export async function replaceBrTaskInstances(workspaceId: string, rows: any[]) {
  const supabase = getAdminClient();
  const { error: deleteError } = await supabase.from('br_task_instances').delete().eq('workspace_id', workspaceId);
  if (deleteError) throw deleteError;
  if (!rows.length) return;
  const { error: insertError } = await supabase.from('br_task_instances').insert(rows);
  if (insertError) throw insertError;
}

export async function updateBrTaskInstance(taskInstanceId: string, patch: Record<string, unknown>) {
  const supabase = getAdminClient();
  const nextPatch: Record<string, unknown> = { ...patch, updated_at: nowIso() };
  if (patch.status === 'in_progress' && !patch.started_at) nextPatch.started_at = nowIso();
  if (patch.status === 'done') nextPatch.completed_at = nowIso();
  const { data, error } = await supabase.from('br_task_instances').update(nextPatch).eq('task_instance_id', taskInstanceId).select('*').single();
  if (error) throw error;
  return data;
}

export async function getBrTaskInstance(taskInstanceId: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase.from('br_task_instances').select('*').eq('task_instance_id', taskInstanceId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function addBrEvidence(input: {
  workspaceId: string;
  taskInstanceId: string;
  evidenceType?: string;
  noteText?: string;
  externalLink?: string;
  fileUrl?: string;
  uploadedBy?: string | null;
}) {
  const supabase = getAdminClient();
  const payload = {
    evidence_id: `${input.taskInstanceId}::EVIDENCE::${Date.now()}`,
    workspace_id: input.workspaceId,
    task_instance_id: input.taskInstanceId,
    evidence_type: input.evidenceType || 'note',
    note_text: input.noteText || '',
    external_link: input.externalLink || '',
    file_url: input.fileUrl || '',
    uploaded_by: input.uploadedBy || 'system',
    uploaded_at: nowIso(),
    review_status: 'accepted',
  };
  const { data, error } = await supabase.from('br_evidence_items').insert(payload).select('*').single();
  if (error) throw error;
  return data;
}

export async function reviewBrEvidence(evidenceId: string, reviewStatus: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase.from('br_evidence_items').update({ review_status: reviewStatus }).eq('evidence_id', evidenceId).select('*').single();
  if (error) throw error;
  return data;
}

export async function deleteBrEvidenceByTask(workspaceId: string, taskInstanceId: string) {
  const supabase = getAdminClient();
  const { error } = await supabase.from('br_evidence_items').delete().eq('workspace_id', workspaceId).eq('task_instance_id', taskInstanceId);
  if (error) throw error;
}

export async function updateBrWorkspace(workspaceId: string, patch: Record<string, unknown>) {
  const supabase = getAdminClient();
  const { data, error } = await supabase.from('br_workspaces').update({ ...patch, updated_at: nowIso() }).eq('workspace_id', workspaceId).select('*').single();
  if (error) throw error;
  return data;
}
