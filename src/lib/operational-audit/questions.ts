// @ts-nocheck
import {
  OPS_DOMAINS as RAW_DOMAINS,
  OPS_QUESTION_LIBRARY as RAW_QUESTIONS,
  OPS_WORKFLOWS,
  getWorkflowById,
  mapScoreToFindingBand,
  type OpsDomain,
  type OpsFinding,
  type OpsQuestion,
  type OpsRecommendation,
  type OpsAction,
  type OpsRoadmap,
  OPS_FINDINGS,
  OPS_RECOMMENDATIONS,
  OPS_ACTIONS,
  OPS_ROADMAP
} from './library';

export type OperationalAuditQuestionView = {
  domain_id: string;
  domain_name: string;
  workflow_id: string;
  workflow_name: string;
  question_id: string;
  question_text: string;
  guidance: string;
  workflow_description: string;
  workflow_objective: string;
  evidence_examples: string;
  customer_impact_if_weak: string;
  linked_metric: string;
  owner_role: string;
  roadmap_phase: string;
  score_1_guidance: string;
  score_3_guidance: string;
  score_5_guidance: string;
  priority_weight: string;
};

export const OPS_DOMAINS = RAW_DOMAINS.map((domain) => ({
  domain_id: domain.domain_id,
  domain_name: domain.domain_name,
  domain_description: domain.domain_description,
  display_order: Number(domain.display_order),
  audit_focus: domain.audit_focus
}));

export const OPS_QUESTION_LIBRARY: OperationalAuditQuestionView[] = RAW_QUESTIONS.map((question) => {
  const workflow = getWorkflowById(question.workflow_id);

  return {
    domain_id: question.domain_id,
    domain_name: OPS_DOMAINS.find((domain) => domain.domain_id === question.domain_id)?.domain_name ?? question.domain_id,
    workflow_id: question.workflow_id,
    workflow_name: workflow?.workflow_name ?? question.workflow_id,
    question_id: question.question_id,
    question_text: question.question_text,
    guidance: question.audit_scoring_focus,
    workflow_description: workflow?.workflow_description ?? '',
    workflow_objective: workflow?.workflow_objective ?? '',
    evidence_examples: question.evidence_examples,
    customer_impact_if_weak: question.customer_impact_if_weak,
    linked_metric: question.linked_metric,
    owner_role: question.owner_role,
    roadmap_phase: question.roadmap_phase,
    score_1_guidance: question.score_1_guidance,
    score_3_guidance: question.score_3_guidance,
    score_5_guidance: question.score_5_guidance,
    priority_weight: question.priority_weight
  };
});

export { OPS_WORKFLOWS, OPS_FINDINGS, OPS_RECOMMENDATIONS, OPS_ACTIONS, OPS_ROADMAP, mapScoreToFindingBand };
export type { OpsDomain, OpsFinding, OpsQuestion, OpsRecommendation, OpsAction, OpsRoadmap };

export function getQuestionsForDomain(domainId: string) {
  return OPS_QUESTION_LIBRARY.filter((question) => question.domain_id === domainId);
}
