-- v55 interoperability foundation

alter table if exists public.assessments
  add column if not exists assessment_version text,
  add column if not exists reporting_period_label text,
  add column if not exists scope_type text not null default 'enterprise',
  add column if not exists scope_label text;

update public.assessments
set assessment_version = coalesce(nullif(assessment_version, ''), nullif(version, ''))
where coalesce(assessment_version, '') = '';

alter table if exists public.assessments
  drop constraint if exists assessments_scope_type_check;

alter table if exists public.assessments
  add constraint assessments_scope_type_check
  check (scope_type in (
    'enterprise',
    'business_unit',
    'department',
    'function',
    'region',
    'product_line',
    'workflow',
    'other'
  ));

alter table if exists public.metric_captures
  add column if not exists metric_code text,
  add column if not exists category text,
  add column if not exists direction text,
  add column if not exists baseline_value_numeric numeric,
  add column if not exists current_value_numeric numeric,
  add column if not exists target_value_numeric numeric,
  add column if not exists benchmark_value_numeric numeric,
  add column if not exists variance_value_numeric numeric,
  add column if not exists period_label text,
  add column if not exists business_function text,
  add column if not exists workflow_name text,
  add column if not exists department text,
  add column if not exists system text,
  add column if not exists data_domain text,
  add column if not exists risk_area text,
  add column if not exists product_line text,
  add column if not exists channel text,
  add column if not exists region_tag text,
  add column if not exists evidence_notes text,
  add column if not exists source_reference text,
  add column if not exists attachment_refs jsonb not null default '[]'::jsonb;

alter table if exists public.domain_scores
  add column if not exists business_function text,
  add column if not exists workflow text,
  add column if not exists department text,
  add column if not exists system text,
  add column if not exists data_domain text,
  add column if not exists owner_role text,
  add column if not exists risk_area text,
  add column if not exists product_line text,
  add column if not exists channel text,
  add column if not exists region_tag text,
  add column if not exists notes text,
  add column if not exists evidence_notes text,
  add column if not exists source_reference text,
  add column if not exists attachment_refs jsonb not null default '[]'::jsonb;

alter table if exists public.finding_instances
  add column if not exists business_function text,
  add column if not exists workflow text,
  add column if not exists department text,
  add column if not exists system text,
  add column if not exists data_domain text,
  add column if not exists owner_role text,
  add column if not exists risk_area text,
  add column if not exists product_line text,
  add column if not exists channel text,
  add column if not exists region_tag text,
  add column if not exists notes text,
  add column if not exists evidence_notes text,
  add column if not exists source_reference text,
  add column if not exists attachment_refs jsonb not null default '[]'::jsonb;

alter table if exists public.recommendation_instances
  add column if not exists business_function text,
  add column if not exists workflow text,
  add column if not exists department text,
  add column if not exists system text,
  add column if not exists data_domain text,
  add column if not exists risk_area text,
  add column if not exists product_line text,
  add column if not exists channel text,
  add column if not exists region_tag text,
  add column if not exists notes text,
  add column if not exists evidence_notes text,
  add column if not exists source_reference text,
  add column if not exists attachment_refs jsonb not null default '[]'::jsonb;

alter table if exists public.action_instances
  add column if not exists business_function text,
  add column if not exists workflow text,
  add column if not exists department text,
  add column if not exists system text,
  add column if not exists data_domain text,
  add column if not exists risk_area text,
  add column if not exists product_line text,
  add column if not exists channel text,
  add column if not exists region_tag text,
  add column if not exists notes text,
  add column if not exists evidence_notes text,
  add column if not exists source_reference text,
  add column if not exists attachment_refs jsonb not null default '[]'::jsonb;

alter table if exists public.roadmap_instances
  add column if not exists business_function text,
  add column if not exists workflow text,
  add column if not exists department text,
  add column if not exists system text,
  add column if not exists data_domain text,
  add column if not exists risk_area text,
  add column if not exists product_line text,
  add column if not exists channel text,
  add column if not exists region_tag text,
  add column if not exists notes text,
  add column if not exists evidence_notes text,
  add column if not exists source_reference text,
  add column if not exists attachment_refs jsonb not null default '[]'::jsonb;

create table if not exists public.module_publications (
  id uuid primary key default gen_random_uuid(),
  assessment_id text not null references public.assessments(assessment_id) on delete cascade,
  module_code text not null,
  module_version text not null,
  publication_status text not null default 'draft',
  published_at timestamptz not null default timezone('utc', now()),
  context_payload jsonb not null default '{}'::jsonb,
  summary_payload jsonb not null default '{}'::jsonb,
  area_scores_payload jsonb not null default '[]'::jsonb,
  findings_payload jsonb not null default '[]'::jsonb,
  recommendations_payload jsonb not null default '[]'::jsonb,
  actions_payload jsonb not null default '[]'::jsonb,
  roadmap_payload jsonb not null default '[]'::jsonb,
  metrics_payload jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table if exists public.module_publications
  drop constraint if exists module_publications_module_code_check;

alter table if exists public.module_publications
  add constraint module_publications_module_code_check
  check (module_code in (
    'ops_audit',
    'revenue_leakage',
    'data_foundation',
    'ai_readiness',
    'ai_use_cases'
  ));

alter table if exists public.module_publications
  drop constraint if exists module_publications_status_check;

alter table if exists public.module_publications
  add constraint module_publications_status_check
  check (publication_status in ('draft', 'published'));

create index if not exists idx_module_publications_assessment
  on public.module_publications (assessment_id);

create index if not exists idx_module_publications_module_code
  on public.module_publications (module_code);

create index if not exists idx_module_publications_assessment_module
  on public.module_publications (assessment_id, module_code, published_at desc);
