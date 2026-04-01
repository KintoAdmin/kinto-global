alter table if exists public.report_instances
  add column if not exists title text not null default '',
  add column if not exists summary_text text not null default '',
  add column if not exists report_status text not null default 'queued',
  add column if not exists latest_version integer not null default 0,
  add column if not exists last_error text not null default '',
  add column if not exists scope_type text not null default 'integrated',
  add column if not exists module_code text;

alter table if exists public.report_instances
  drop constraint if exists report_instances_status_check;

alter table if exists public.report_instances
  add constraint report_instances_status_check
  check (report_status in ('queued', 'generating', 'ready', 'failed'));

create table if not exists public.report_artifacts (
  artifact_id text primary key,
  report_instance_id text not null references public.report_instances(report_instance_id) on delete cascade,
  assessment_id text not null references public.assessments(assessment_id) on delete cascade,
  module_scope text not null,
  module_code text,
  file_type text not null,
  file_name text not null,
  storage_path text not null,
  file_size bigint not null default 0,
  generated_version integer not null default 1,
  created_at timestamptz not null default timezone('utc', now())
);

alter table if exists public.report_artifacts
  drop constraint if exists report_artifacts_file_type_check;

alter table if exists public.report_artifacts
  add constraint report_artifacts_file_type_check
  check (file_type in ('json', 'docx', 'pptx'));

create index if not exists idx_report_artifacts_report on public.report_artifacts (report_instance_id, created_at desc);
create index if not exists idx_report_artifacts_assessment on public.report_artifacts (assessment_id, created_at desc);
