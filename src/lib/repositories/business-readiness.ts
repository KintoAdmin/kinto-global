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
  const [profileRes, regionRes, phasesRes, domainsRes, blockersRes] = await Promise.all([
    supabase.from('br_business_profiles').select('*').eq('workspace_id', workspaceId).maybeSingle(),
    supabase.from('br_region_profiles').select('*').eq('workspace_id', workspaceId).maybeSingle(),
    supabase.from('br_phase_states').select('*').eq('workspace_id', workspaceId).order('sort_order', { ascending: true }),
    supabase.from('br_domain_states').select('*').eq('workspace_id', workspaceId).order('sort_order', { ascending: true }),
    supabase.from('br_blockers').select('*').eq('workspace_id', workspaceId).eq('active_flag', true).order('sort_order', { ascending: true })
  ]);
  if (profileRes.error) throw profileRes.error;
  if (regionRes.error) throw regionRes.error;
  if (phasesRes.error) throw phasesRes.error;
  if (domainsRes.error) throw domainsRes.error;
  if (blockersRes.error) throw blockersRes.error;
  return {
    profile: profileRes.data || null,
    regionProfile: regionRes.data || null,
    phases: phasesRes.data || [],
    domains: domainsRes.data || [],
    blockers: blockersRes.data || [],
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
    template_version: 'br-v1',
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
  const { error: upsertError } = await supabase.from('br_phase_states').upsert(rows, { onConflict: 'workspace_id,phase_code' });
  if (upsertError) throw upsertError;
}

export async function replaceBrDomainStates(workspaceId: string, rows: any[]) {
  const supabase = getAdminClient();
  const { error: upsertError } = await supabase.from('br_domain_states').upsert(rows, { onConflict: 'workspace_id,domain_code' });
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

export async function updateBrWorkspace(workspaceId: string, patch: Record<string, unknown>) {
  const supabase = getAdminClient();
  const { data, error } = await supabase.from('br_workspaces').update({ ...patch, updated_at: nowIso() }).eq('workspace_id', workspaceId).select('*').single();
  if (error) throw error;
  return data;
}
