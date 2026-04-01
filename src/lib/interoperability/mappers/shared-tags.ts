import type { LightweightEvidence, SharedTags } from "@/lib/interoperability/types";

function pick(...values: unknown[]): string | null {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return null;
}

function arrayValue(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    const items = value.map((item) => String(item ?? "").trim()).filter(Boolean);
    return items.length ? items : null;
  }
  const text = String(value ?? "").trim();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      const items = parsed.map((item) => String(item ?? "").trim()).filter(Boolean);
      return items.length ? items : null;
    }
  } catch {
    return [text];
  }
  return [text];
}

export function extractSharedTags(record: Record<string, unknown>): SharedTags {
  const metadata = (record.metadata && typeof record.metadata === "object" ? record.metadata : {}) as Record<string, unknown>;
  return {
    business_function: pick(record.business_function, metadata.business_function, metadata.function),
    workflow: pick(record.workflow, record.workflow_name, record.workflow_id, metadata.workflow),
    department: pick(record.department, metadata.department),
    system: pick(record.system, metadata.system, record.source_system),
    data_domain: pick(record.data_domain, metadata.data_domain),
    owner_role: pick(record.owner_role, metadata.owner_role),
    risk_area: pick(record.risk_area, metadata.risk_area),
    product_line: pick(record.product_line, metadata.product_line),
    channel: pick(record.channel, metadata.channel),
    region_tag: pick(record.region_tag, metadata.region_tag, record.region)
  };
}

export function extractEvidence(record: Record<string, unknown>): LightweightEvidence {
  const metadata = (record.metadata && typeof record.metadata === "object" ? record.metadata : {}) as Record<string, unknown>;
  return {
    notes: pick(record.notes, record.implementation_notes, record.execution_notes, metadata.notes),
    evidence_notes: pick(record.evidence_notes, record.evidence_summary, record.evidence_required, metadata.evidence_notes),
    source_reference: pick(record.source_reference, record.source_system, record.source_library_id, metadata.source_reference),
    attachment_refs: arrayValue(record.attachment_refs ?? metadata.attachment_refs)
  };
}
