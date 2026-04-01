import { getAdminClient } from "@/lib/supabase/admin";
import { nowIso } from "@/lib/utils/ids";
import type { ModuleCode, PublicationStatus } from "@/lib/interoperability/enums";
import type { ModulePublication } from "@/lib/interoperability/types";

type PublicationRow = {
  id?: string;
  assessment_id: string;
  module_code: string;
  module_version: string;
  publication_status: PublicationStatus;
  published_at: string;
  summary_payload: Record<string, unknown>;
  area_scores_payload: Record<string, unknown>[];
  findings_payload: Record<string, unknown>[];
  recommendations_payload: Record<string, unknown>[];
  actions_payload: Record<string, unknown>[];
  roadmap_payload: Record<string, unknown>[];
  metrics_payload: Record<string, unknown>[];
  context_payload?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
};

function toRow(publication: ModulePublication, statusOverride?: PublicationStatus): PublicationRow {
  return {
    assessment_id: publication.assessment_id,
    module_code: publication.module_code,
    module_version: publication.module_version,
    publication_status: statusOverride || publication.publication_status,
    published_at: nowIso(),
    context_payload: publication.context as unknown as Record<string, unknown>,
    summary_payload: publication.summary as unknown as Record<string, unknown>,
    area_scores_payload: publication.area_scores as unknown as Record<string, unknown>[],
    findings_payload: publication.findings as unknown as Record<string, unknown>[],
    recommendations_payload: publication.recommendations as unknown as Record<string, unknown>[],
    actions_payload: publication.actions as unknown as Record<string, unknown>[],
    roadmap_payload: publication.roadmap_items as unknown as Record<string, unknown>[],
    metrics_payload: publication.metrics as unknown as Record<string, unknown>[]
  };
}

function fromRow(row: PublicationRow): ModulePublication {
  return {
    assessment_id: row.assessment_id,
    module_code: row.module_code as ModuleCode,
    module_version: row.module_version,
    publication_status: row.publication_status,
    published_at: row.published_at,
    context: row.context_payload as ModulePublication["context"],
    summary: row.summary_payload as ModulePublication["summary"],
    area_scores: row.area_scores_payload as ModulePublication["area_scores"],
    findings: row.findings_payload as ModulePublication["findings"],
    recommendations: row.recommendations_payload as ModulePublication["recommendations"],
    actions: row.actions_payload as ModulePublication["actions"],
    roadmap_items: row.roadmap_payload as ModulePublication["roadmap_items"],
    metrics: row.metrics_payload as ModulePublication["metrics"]
  };
}

export class ModulePublicationRepository {
  async upsertDraft(publication: ModulePublication): Promise<void> {
    const supabase = getAdminClient();
    const { error: deleteError } = await supabase
      .from("module_publications")
      .delete()
      .eq("assessment_id", publication.assessment_id)
      .eq("module_code", publication.module_code)
      .eq("publication_status", "draft");
    if (deleteError) throw deleteError;

    const { error } = await supabase.from("module_publications").insert(toRow(publication, "draft"));
    if (error) throw error;
  }

  async publish(publication: ModulePublication): Promise<void> {
    const supabase = getAdminClient();
    const { error } = await supabase.from("module_publications").insert(toRow(publication, "published"));
    if (error) throw error;
  }

  async getLatestPublished(assessmentId: string, moduleCode: ModuleCode): Promise<ModulePublication | null> {
    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("module_publications")
      .select("*")
      .eq("assessment_id", assessmentId)
      .eq("module_code", moduleCode)
      .eq("publication_status", "published")
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? fromRow(data as PublicationRow) : null;
  }

  async listLatestPublished(assessmentId: string): Promise<ModulePublication[]> {
    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("module_publications")
      .select("*")
      .eq("assessment_id", assessmentId)
      .eq("publication_status", "published")
      .order("published_at", { ascending: false });
    if (error) throw error;

    const latestByModule = new Map<string, PublicationRow>();
    for (const row of (data || []) as PublicationRow[]) {
      if (!latestByModule.has(row.module_code)) latestByModule.set(row.module_code, row);
    }
    return [...latestByModule.values()].map(fromRow);
  }
}

export const modulePublicationRepository = new ModulePublicationRepository();
