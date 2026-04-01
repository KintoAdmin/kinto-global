// @ts-nocheck
import { getAdminClient } from "@/lib/supabase/admin";
import { getAuthUserId } from "@/lib/supabase/server";
import { clientIdFromName, nowIso } from "@/lib/utils/ids";
import type { ClientProfileInput } from "@/lib/types/domain";

export async function listClients() {
  const supabase = getAdminClient();
  const userId = await getAuthUserId();
  const query = supabase.from("clients").select("*").order("client_name", { ascending: true });
  // If user is authenticated, scope to their data; otherwise return all (dev fallback)
  if (userId) query.eq("consultant_id", userId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getClientById(clientId: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertClient(input: ClientProfileInput) {
  const supabase = getAdminClient();
  const userId = await getAuthUserId();
  const clientId = clientIdFromName(input.clientName);
  const payload = {
    client_id: clientId,
    client_name: input.clientName,
    industry: input.industry || "",
    sub_industry: input.subIndustry || "",
    business_model: input.businessModel || "",
    revenue_model: input.revenueModel || "",
    company_size: input.companySize || "",
    employee_band: input.employeeBand || "",
    annual_revenue_band: input.annualRevenueBand || "",
    region: input.region || "",
    country: input.country || "",
    trading_name: input.tradingName || "",
    website_url: input.websiteUrl || "",
    primary_contact_name: input.primaryContactName || "",
    primary_contact_email: input.primaryContactEmail || "",
    services_summary: input.servicesSummary || "",
    notes: input.notes || "",
    status: "ACTIVE",
    consultant_id: userId || null,
    updated_at: nowIso()
  };
  const { data, error } = await supabase.from("clients").upsert(payload).select("*").single();
  if (error) throw error;
  return data;
}

export async function deleteClient(clientId: string) {
  const supabase = getAdminClient();
  const existing = await getClientById(clientId);
  if (!existing) return null;
  const { error } = await supabase.from("clients").delete().eq("client_id", clientId);
  if (error) throw error;
  return existing;
}
