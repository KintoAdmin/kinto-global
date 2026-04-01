// @ts-nocheck
import { dataPath } from "@/lib/utils/files";
import { loadCsvRows } from "@/lib/utils/csv";

type MetricDef = Record<string, string>;
type AiReadinessQuestion = {
  question_id: string;
  domain_id: string;
  domain_name: string;
  workflow_id: string;
  workflow_name: string;
  question_text: string;
  question_guidance: string;
  evidence_examples: string;
  question_order: number;
};

export const AIR_METRICS: Record<string, MetricDef> = {
  "AIR-D01": {
    metric_id: "AIR-MET-D01",
    metric_name: "AI strategy ownership coverage %",
    unit: "%",
    frequency: "Monthly",
    owner_role: "Executive Sponsor",
    source_hint: "Strategy docs / governance records",
    why_it_matters: "Shows whether AI direction is anchored to owned business outcomes rather than vague interest.",
    definition: "Percentage of priority AI themes with named sponsor, owned outcome, and approved rationale."
  },
  "AIR-D02": {
    metric_id: "AIR-MET-D02",
    metric_name: "Pilot-ready workflow coverage %",
    unit: "%",
    frequency: "Monthly",
    owner_role: "Transformation Lead",
    source_hint: "Use case register / workflow assessment",
    why_it_matters: "Shows whether candidate workflows are stable and bounded enough for credible AI pilot selection.",
    definition: "Percentage of shortlisted workflows that meet minimum readiness criteria for controlled AI pilots."
  },
  "AIR-D03": {
    metric_id: "AIR-MET-D03",
    metric_name: "AI data readiness coverage %",
    unit: "%",
    frequency: "Monthly",
    owner_role: "Data Owner",
    source_hint: "Data readiness review / source inventory",
    why_it_matters: "Shows whether the structured and unstructured data needed for AI use cases is available and usable.",
    definition: "Percentage of priority AI use cases with required data identified, accessible, and sufficiently governed."
  },
  "AIR-D04": {
    metric_id: "AIR-MET-D04",
    metric_name: "Integration-ready use case coverage %",
    unit: "%",
    frequency: "Monthly",
    owner_role: "IT / Systems Lead",
    source_hint: "Architecture review / integration map",
    why_it_matters: "Shows whether AI outputs can appear inside live systems and workflows rather than outside the operating model.",
    definition: "Percentage of priority use cases with a workable insertion point, technical owner, and system path."
  },
  "AIR-D05": {
    metric_id: "AIR-MET-D05",
    metric_name: "Process-ready automation coverage %",
    unit: "%",
    frequency: "Monthly",
    owner_role: "Operations Lead",
    source_hint: "Process review / SOP library",
    why_it_matters: "Shows whether the business is fixing and standardising workflows before trying to apply AI.",
    definition: "Percentage of candidate AI workflows that are documented, controlled, and stable enough for automation or AI support."
  },
  "AIR-D06": {
    metric_id: "AIR-MET-D06",
    metric_name: "AI governance control coverage %",
    unit: "%",
    frequency: "Monthly",
    owner_role: "Risk / Compliance Lead",
    source_hint: "Governance framework / risk register",
    why_it_matters: "Shows whether policy, oversight, access, and review controls are strong enough for AI deployment.",
    definition: "Percentage of required AI governance controls defined, approved, and operating."
  },
  "AIR-D07": {
    metric_id: "AIR-MET-D07",
    metric_name: "AI adoption readiness coverage %",
    unit: "%",
    frequency: "Monthly",
    owner_role: "Change Lead",
    source_hint: "Training plan / adoption design",
    why_it_matters: "Shows whether managers and users are prepared to adopt AI into real work patterns.",
    definition: "Percentage of target teams with enablement, communication, and adoption ownership in place."
  },
  "AIR-D08": {
    metric_id: "AIR-MET-D08",
    metric_name: "AI value measurement coverage %",
    unit: "%",
    frequency: "Monthly",
    owner_role: "Finance / Transformation Lead",
    source_hint: "Business case / pilot scorecard",
    why_it_matters: "Shows whether pilots and deployments have measurable baselines, targets, and decision rules.",
    definition: "Percentage of priority AI initiatives with baseline, target metric, and scale/no-scale decision criteria defined."
  }
};

export function loadAiReadinessBundleLocal() {
  const domains = loadCsvRows(dataPath("ai_readiness", "30_lib_domains.csv"), ["domain_id,"])
    .map((row) => ({
      domain_id: (row.domain_id || "").trim(),
      domain_name: (row.domain_name || "").trim(),
      description: (row.domain_description || "").trim(),
      weight_pct: Number(row.domain_weight || 0),
      phase_owner: (row.phase_owner || "").trim(),
      domain_order: Number(row.domain_order || 0),
      metric_def: AIR_METRICS[(row.domain_id || "").trim()] || {}
    }))
    .filter((row) => row.domain_id)
    .sort((a, b) => a.domain_order - b.domain_order);

  const domainMap = Object.fromEntries(domains.map((row) => [row.domain_id, row]));

  const questionsByDomain: Record<string, AiReadinessQuestion[]> = {};
  const questions: AiReadinessQuestion[] = loadCsvRows(dataPath("ai_readiness", "31_lib_questions.csv"), ["question_id,"])
    .map((row) => ({
      question_id: (row.question_id || "").trim(),
      domain_id: (row.domain_id || "").trim(),
      domain_name: domainMap[(row.domain_id || "").trim()]?.domain_name || (row.domain_id || "").trim(),
      workflow_id: (row.domain_id || "").trim(),
      workflow_name: domainMap[(row.domain_id || "").trim()]?.domain_name || (row.domain_id || "").trim(),
      question_text: (row.question_text || "").trim(),
      question_guidance: (row.question_guidance || "").trim(),
      evidence_examples: (row.evidence_examples || "").trim(),
      question_order: Number(row.question_order || 0)
    }))
    .filter((row) => row.question_id && row.domain_id);

  const questionMap = Object.fromEntries(
    questions.map((row) => {
      (questionsByDomain[row.domain_id] ||= []).push(row);
      return [row.question_id, row];
    })
  );
  Object.values(questionsByDomain).forEach((rows) => rows.sort((a, b) => Number(a.question_order || 0) - Number(b.question_order || 0)));

  const findingsByDomainTrigger: Record<string, Record<string, string>> = {};
  loadCsvRows(dataPath("ai_readiness", "32_lib_findings.csv"), ["finding_id,"]).forEach((row) => {
    const key = `${(row.domain_id || "").trim()}::${(row.severity_band || "").trim()}`;
    findingsByDomainTrigger[key] = {
      finding_id: (row.finding_id || "").trim(),
      domain_id: (row.domain_id || "").trim(),
      severity_band: (row.severity_band || "").trim(),
      finding_title: (row.finding_title || "").trim(),
      finding_text: (row.finding_summary || "").trim(),
      business_impact: (row.business_impact || "").trim(),
      executive_headline: (row.executive_headline || "").trim()
    };
  });

  const recommendationsByDomainTrigger: Record<string, Record<string, string>> = {};
  loadCsvRows(dataPath("ai_readiness", "33_lib_recos.csv"), ["recommendation_id,"]).forEach((row) => {
    const key = `${(row.domain_id || "").trim()}::${(row.severity_band || "").trim()}`;
    recommendationsByDomainTrigger[key] = {
      recommendation_id: (row.recommendation_id || "").trim(),
      domain_id: (row.domain_id || "").trim(),
      severity_band: (row.severity_band || "").trim(),
      recommendation_summary: (row.recommendation_summary || "").trim(),
      recommendation_detail: (row.recommendation_detail || "").trim(),
      priority: (row.priority_level || "").trim(),
      default_owner_role: (row.default_owner_role || "").trim(),
      default_timeline_band: (row.default_timeline_band || "").trim(),
      default_phase: (row.default_phase || "").trim()
    };
  });

  const actionsByRecommendation: Record<string, Record<string, string>[]> = {};
  loadCsvRows(dataPath("ai_readiness", "34_lib_actions.csv"), ["action_id,"]).forEach((row) => {
    const recommendationId = (row.recommendation_id || "").trim();
    (actionsByRecommendation[recommendationId] ||= []).push({
      action_id: (row.action_id || "").trim(),
      recommendation_id: recommendationId,
      action_summary: (row.action_summary || "").trim(),
      owner_role: (row.owner_role || "").trim(),
      timeline_band: (row.timeline_band || "").trim(),
      roadmap_phase: (row.roadmap_phase || "").trim(),
      action_success_marker: (row.action_success_marker || "").trim()
    });
  });

  const usecases = loadCsvRows(dataPath("ai_readiness", "35_lib_usecases.csv"), ["usecase_id,"]).map((row) =>
    Object.fromEntries(Object.entries(row).map(([key, value]) => [key, String(value || "").trim()]))
  );

  return {
    domains,
    domain_map: domainMap,
    questions,
    questions_by_domain: questionsByDomain,
    question_map: questionMap,
    findings_by_domain_trigger: findingsByDomainTrigger,
    recommendations_by_domain_trigger: recommendationsByDomainTrigger,
    actions_by_recommendation: actionsByRecommendation,
    usecases
  };
}
