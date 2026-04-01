// @ts-nocheck
import type {
  AreaType,
  AssessmentStatus,
  Band,
  DirectionType,
  ExecutionStatus,
  ModuleCode,
  Priority,
  PublicationStatus,
  ScopeType,
  Timeline,
  UnitType
} from "@/lib/interoperability/enums";

export type SharedAssessmentContext = {
  client_id: string;
  client_name: string;
  industry: string | null;
  business_model: string | null;
  company_size: string | null;
  region: string | null;
  assessment_id: string;
  assessment_name: string;
  assessment_status: AssessmentStatus;
  assessment_date: string | null;
  assessment_version: string | null;
  reporting_period_label: string | null;
  scope_type: ScopeType;
  scope_label: string | null;
};

export type SharedTags = {
  business_function?: string | null;
  workflow?: string | null;
  department?: string | null;
  system?: string | null;
  data_domain?: string | null;
  owner_role?: string | null;
  risk_area?: string | null;
  product_line?: string | null;
  channel?: string | null;
  region_tag?: string | null;
};

export type LightweightEvidence = {
  notes?: string | null;
  evidence_notes?: string | null;
  source_reference?: string | null;
  attachment_refs?: string[] | null;
};

export type SharedScoreFields = {
  raw_score: number | null;
  normalized_percent: number | null;
  band: Band | null;
};

export type ModuleSummary = SharedTags &
  LightweightEvidence &
  SharedScoreFields & {
    assessment_id: string;
    module_code: ModuleCode;
    module_name: string;
    completion_percent: number;
    status: AssessmentStatus | "ready_for_report";
    executive_summary: string | null;
  };

export type AreaScore = SharedTags &
  LightweightEvidence &
  SharedScoreFields & {
    assessment_id: string;
    module_code: ModuleCode;
    area_code: string;
    area_name: string;
    area_type: AreaType;
    weight: number | null;
  };

export type FindingArtifact = SharedTags &
  LightweightEvidence & {
    assessment_id: string;
    module_code: ModuleCode;
    finding_code: string;
    title: string;
    summary: string;
    severity: Priority;
    business_impact: string | null;
    priority: Priority;
  };

export type RecommendationArtifact = SharedTags &
  LightweightEvidence & {
    assessment_id: string;
    module_code: ModuleCode;
    recommendation_code: string;
    finding_code: string | null;
    title: string;
    summary: string;
    priority: Priority;
    expected_outcome: string | null;
  };

export type ActionArtifact = SharedTags &
  LightweightEvidence & {
    assessment_id: string;
    module_code: ModuleCode;
    action_code: string;
    recommendation_code: string | null;
    title: string;
    summary: string;
    owner_role: string | null;
    timeline: Timeline | null;
    effort: string | null;
    success_measure: string | null;
    execution_status: ExecutionStatus;
  };

export type RoadmapArtifact = SharedTags &
  LightweightEvidence & {
    assessment_id: string;
    module_code: ModuleCode;
    roadmap_code: string;
    phase: Timeline;
    title: string;
    summary: string;
    priority: Priority;
    owner_role: string | null;
    timeline: Timeline | null;
    dependency_summary: string | null;
    execution_status: ExecutionStatus;
  };

export type MetricArtifact = SharedTags &
  LightweightEvidence & {
    assessment_id: string;
    module_code: ModuleCode;
    metric_code: string;
    metric_name: string;
    category: string | null;
    unit: UnitType;
    direction: DirectionType;
    baseline_value: number | null;
    current_value: number | null;
    target_value: number | null;
    benchmark_value: number | null;
    variance_value: number | null;
    period_label: string | null;
  };

export type ModulePublication = {
  assessment_id: string;
  module_code: ModuleCode;
  module_version: string;
  publication_status: PublicationStatus;
  published_at: string;
  context: SharedAssessmentContext;
  summary: ModuleSummary;
  area_scores: AreaScore[];
  findings: FindingArtifact[];
  recommendations: RecommendationArtifact[];
  actions: ActionArtifact[];
  roadmap_items: RoadmapArtifact[];
  metrics: MetricArtifact[];
};
