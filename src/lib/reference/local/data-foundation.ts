import { dataPath } from "@/lib/utils/files";
import { loadCsvRows } from "@/lib/utils/csv";

export const DATA_METRICS: Record<string, Record<string, string>> = {
  D01: {
    metric_id: "DFD-MET-D01",
    metric_name: "Source-of-truth coverage %",
    unit: "%",
    frequency: "Monthly",
    owner_role: "RevOps / Systems",
    source_hint: "System inventory / reporting source map",
    why_it_matters: "Shows whether core commercial and management objects are governed from approved source systems.",
    definition: "Percentage of critical business objects and KPIs with a formally approved source of truth."
  },
  D02: {
    metric_id: "DFD-MET-D02",
    metric_name: "Required field completion %",
    unit: "%",
    frequency: "Weekly",
    owner_role: "Ops / RevOps",
    source_hint: "CRM / ERP / service system",
    why_it_matters: "Shows whether users capture required ownership, stage, status, amount, and next-step data at the point of work.",
    definition: "Percentage of required operational and commercial fields completed in the controlled system."
  },
  D03: {
    metric_id: "DFD-MET-D03",
    metric_name: "Data accuracy %",
    unit: "%",
    frequency: "Monthly",
    owner_role: "Data Owner / Ops",
    source_hint: "Sample audit / reconciliation",
    why_it_matters: "Shows whether records are correct enough to support decision-making and downstream automation.",
    definition: "Percentage of sampled records confirmed accurate after audit or reconciliation."
  },
  D04: {
    metric_id: "DFD-MET-D04",
    metric_name: "Workflow visibility coverage %",
    unit: "%",
    frequency: "Monthly",
    owner_role: "Operations Lead",
    source_hint: "Workflow reporting / audit logs",
    why_it_matters: "Shows whether management can see stage, ownership, dates, and exceptions across critical workflows.",
    definition: "Percentage of critical workflows with usable stage, owner, status, and exception visibility in live data."
  },
  D05: {
    metric_id: "DFD-MET-D05",
    metric_name: "KPI definition coverage %",
    unit: "%",
    frequency: "Quarterly",
    owner_role: "Finance / RevOps",
    source_hint: "KPI dictionary / reporting governance",
    why_it_matters: "Shows whether performance metrics are defined consistently enough to trust cross-team reporting.",
    definition: "Percentage of critical KPIs with documented definitions, logic, owner, and approved source mapping."
  },
  D06: {
    metric_id: "DFD-MET-D06",
    metric_name: "Reporting timeliness %",
    unit: "%",
    frequency: "Monthly",
    owner_role: "Finance / Reporting",
    source_hint: "Reporting calendar / BI tool",
    why_it_matters: "Shows whether decision-makers receive trusted reports when needed, not after the fact.",
    definition: "Percentage of scheduled recurring reports delivered on time and fit for use."
  },
  D07: {
    metric_id: "DFD-MET-D07",
    metric_name: "Data owner coverage %",
    unit: "%",
    frequency: "Quarterly",
    owner_role: "Leadership / Data Owner",
    source_hint: "Ownership matrix / governance records",
    why_it_matters: "Shows whether critical data objects and KPI areas have named accountable owners.",
    definition: "Percentage of critical data objects and reporting domains with a named accountable owner."
  }
};

export function loadDataFoundationBundleLocal() {
  const domainsRaw = loadCsvRows(dataPath("data_foundation", "dfd_domains.csv"), ["domain id,"]);
  const domains = domainsRaw
    .map((row) => ({
      domain_id: (row["Domain ID"] || "").trim(),
      domain_name: (row["Domain Name"] || "").trim(),
      description: (row.Description || "").trim(),
      weight_pct: Number(row["Weight %"] || 0),
      audit_module: (row["Audit Module"] || "").trim(),
      metric_def: DATA_METRICS[(row["Domain ID"] || "").trim()] || {}
    }))
    .filter((row) => row.domain_id);

  const domainMap = Object.fromEntries(domains.map((row) => [row.domain_id, row]));

  const questionsRaw = loadCsvRows(dataPath("data_foundation", "dfd_questions.csv"), ["question id,"]);
  const questions = questionsRaw
    .filter((row) => (row.Active || "Y").trim().toUpperCase() === "Y")
    .map((row) => ({
      question_id: (row["Question ID"] || "").trim(),
      domain_id: (row["Domain ID"] || "").trim(),
      domain_name: (row["Domain Name"] || "").trim(),
      workflow_id: (row["Domain ID"] || "").trim(),
      workflow_name: (row["Domain Name"] || "").trim(),
      question_text: (row["Question Text"] || "").trim(),
      evidence_type: (row["Evidence Type"] || "").trim(),
      weight_within_domain: Number(row["Weight Within Domain"] || 1)
    }));

  const questionsByDomain: Record<string, typeof questions> = {};
  const questionMap = Object.fromEntries(
    questions.map((row) => {
      (questionsByDomain[row.domain_id] ||= []).push(row);
      return [row.question_id, row];
    })
  );

  const findingsByDomainTrigger: Record<string, Record<string, string>> = {};
  for (const row of loadCsvRows(dataPath("data_foundation", "dfd_findings_library.csv"), ["finding id,"])) {
    const domainId = (row["Domain ID"] || "").trim();
    const trigger = (row["Score Trigger"] || "").trim();
    if (!domainId || !trigger) continue;
    findingsByDomainTrigger[`${domainId}::${trigger}`] = {
      finding_id: (row["Finding ID"] || "").trim(),
      domain_id: domainId,
      domain_name: (row["Domain Name"] || "").trim(),
      score_trigger: trigger,
      finding_title: (row["Finding Title"] || "").trim(),
      finding_text: (row["Finding Summary Template"] || "").trim(),
      common_root_causes: (row["Common Root Cause Themes"] || "").trim()
    };
  }

  const recommendationsByFinding: Record<string, Record<string, string>> = {};
  for (const row of loadCsvRows(dataPath("data_foundation", "dfd_recommendations_library.csv"), ["recommendation id,"])) {
    recommendationsByFinding[(row["Related Finding ID"] || "").trim()] = {
      recommendation_id: (row["Recommendation ID"] || "").trim(),
      related_finding_id: (row["Related Finding ID"] || "").trim(),
      domain_id: (row["Domain ID"] || "").trim(),
      recommendation_summary: (row["Recommendation Summary"] || "").trim(),
      priority: (row.Priority || "").trim(),
      roadmap_phase: (row["Roadmap Phase"] || "").trim()
    };
  }

  const actionsByRecommendation: Record<string, Record<string, string>[]> = {};
  for (const row of loadCsvRows(dataPath("data_foundation", "dfd_actions_library.csv"), ["action id,"])) {
    const key = (row["Recommendation ID"] || "").trim();
    (actionsByRecommendation[key] ||= []).push({
      action_id: (row["Action ID"] || "").trim(),
      recommendation_id: key,
      domain_id: (row["Domain ID"] || "").trim(),
      action_summary: (row["Action Summary"] || "").trim(),
      owner_type: (row["Owner Type"] || "").trim(),
      effort_level: (row["Effort Level"] || "").trim(),
      expected_outcome: (row["Expected Outcome"] || "").trim()
    });
  }

  return {
    domains,
    domain_map: domainMap,
    questions,
    questions_by_domain: questionsByDomain,
    question_map: questionMap,
    findings_by_domain_trigger: findingsByDomainTrigger,
    recommendations_by_finding: recommendationsByFinding,
    actions_by_recommendation: actionsByRecommendation
  };
}
