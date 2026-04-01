import { dataPath } from "@/lib/utils/files";
import { loadCsvRows } from "@/lib/utils/csv";
import { slug } from "@/lib/utils/ids";

type CsvRow = Record<string, string>;
type MetricDef = {
  metric_id: string;
  metric_name: string;
  unit: string;
  frequency: string;
  owner_role: string;
  source_hint: string;
  why_it_matters: string;
  definition: string;
  workflow_id: string;
  domain_id: string;
};

type UsecaseRow = Record<string, unknown> & {
  usecase_id: string;
  usecase_name?: string;
  department?: string;
  review_owner?: string;
  primary_user_role?: string;
  integration_point?: string;
  business_value_driver?: string;
  output_or_action?: string;
  usecase_description?: string;
  core_success_metric?: string;
  domain_id: string;
  workflow_id: string;
  metric_def: MetricDef;
};

type DomainRow = {
  domain_id: string;
  domain_name: string;
  description: string;
  domain_order: number;
};

export function loadAiUsecaseBundleLocal() {
  const usecasesRaw = loadCsvRows(dataPath("ai_usecase", "35_lib_usecases.csv"), ["usecase_id,"]);
  const factorsRaw = loadCsvRows(dataPath("ai_usecase", "36_lib_ucase_guid.csv"), ["factor_name,"]);

  const factors = factorsRaw
    .filter((row) => (row.factor_name || "").trim() && (row.factor_name || "").trim().toLowerCase() !== "total")
    .map((row) => ({
      factor_id: `AIUC-FAC-${slug(row.factor_name || "")}`,
      factor_name: (row.factor_name || "").trim(),
      weight_pct: Number(row.weight_pct || 0),
      what_this_factor_tests: (row.what_this_factor_tests || "").trim(),
      what_to_check: (row.what_to_check || "").trim(),
      scoring_1: (row.tailored_scoring_1_desc || "").trim(),
      scoring_2: (row.tailored_scoring_2_desc || "").trim(),
      scoring_3: (row.tailored_scoring_3_desc || "").trim(),
      scoring_4: (row.tailored_scoring_4_desc || "").trim(),
      scoring_5: (row.tailored_scoring_5_desc || "").trim()
    }));

  const factorMap = Object.fromEntries(factors.map((row) => [row.factor_name, row]));

  const domains: Record<string, DomainRow> = {};
  const usecasesByDomain: Record<string, UsecaseRow[]> = {};
  const usecases: UsecaseRow[] = usecasesRaw
    .filter((row) => (row.usecase_id || "").trim())
    .map((row) => {
      const clean = Object.fromEntries(Object.entries(row).map(([key, value]) => [key, String(value || "").trim()])) as CsvRow;
      const department = clean.department || "General";
      const domainId = `AIUC-D${slug(department)}`;
      domains[domainId] ||= {
        domain_id: domainId,
        domain_name: department,
        description: `AI use cases relevant to ${department.toLowerCase()} workflows and decision points.`,
        domain_order: Object.keys(domains).length + 1
      };
      const payload: UsecaseRow = {
        ...clean,
        usecase_id: clean.usecase_id,
        usecase_name: clean.usecase_name,
        department: clean.department,
        review_owner: clean.review_owner,
        primary_user_role: clean.primary_user_role,
        integration_point: clean.integration_point,
        business_value_driver: clean.business_value_driver,
        output_or_action: clean.output_or_action,
        usecase_description: clean.usecase_description,
        core_success_metric: clean.core_success_metric,
        domain_id: domainId,
        workflow_id: clean.usecase_id,
        metric_def: {
          metric_id: `AIUC-MET-${slug(clean.usecase_id)}`,
          metric_name: clean.core_success_metric || `${clean.usecase_name || clean.usecase_id} success metric`,
          unit: "%",
          frequency: "Monthly",
          owner_role: clean.review_owner || clean.primary_user_role || "Transformation Lead",
          source_hint: clean.integration_point || "AI use case scorecard",
          why_it_matters: clean.business_value_driver || "Shows whether the AI use case is delivering a measurable business outcome.",
          definition: clean.output_or_action || clean.usecase_description || "Track the main success outcome for this AI use case.",
          workflow_id: clean.usecase_id,
          domain_id: domainId
        }
      };
      (usecasesByDomain[domainId] ||= []).push(payload);
      return payload;
    });

  return {
    domains: Object.values(domains).sort((a, b) => Number(a.domain_order || 0) - Number(b.domain_order || 0)),
    domain_map: domains,
    usecases,
    usecases_by_domain: usecasesByDomain,
    factors,
    factor_map: factorMap
  };
}
