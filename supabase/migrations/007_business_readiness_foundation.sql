create table if not exists public.br_workspaces (
  workspace_id text primary key,
  assessment_id text not null unique references public.assessments(assessment_id) on delete cascade,
  client_id text not null references public.clients(client_id) on delete cascade,
  module_id text not null references public.modules(module_id) on delete cascade,
  business_type_code text not null default '',
  primary_region_code text not null default '',
  sub_region_code text not null default '',
  current_phase_code text not null default 'phase_0_define',
  overall_readiness_state text not null default 'not_started',
  launch_ready_flag boolean not null default false,
  active_blocker_count integer not null default 0,
  template_version text not null default 'br-v1',
  created_by text not null default 'system',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create index if not exists idx_br_workspaces_assessment on public.br_workspaces (assessment_id);

create table if not exists public.br_business_profiles (
  workspace_id text primary key references public.br_workspaces(workspace_id) on delete cascade,
  business_name text not null default '',
  trading_name text not null default '',
  founder_name text not null default '',
  founder_summary text not null default '',
  business_description text not null default '',
  target_customer text not null default '',
  revenue_model text not null default '',
  operating_channel text not null default '',
  service_area text not null default '',
  notes text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.br_region_profiles (
  workspace_id text primary key references public.br_workspaces(workspace_id) on delete cascade,
  region_code text not null default '',
  sub_region_code text not null default '',
  country_code text not null default '',
  state_province_code text not null default '',
  municipality_code text not null default '',
  uae_setup_mode text not null default '',
  eu_country_code text not null default '',
  first_operating_location text not null default '',
  notes text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.br_phase_states (
  phase_state_id text primary key,
  workspace_id text not null references public.br_workspaces(workspace_id) on delete cascade,
  phase_code text not null,
  phase_name text not null default '',
  sort_order integer not null default 0,
  status text not null default 'not_started',
  percent_complete numeric(6,2) not null default 0,
  blocked_flag boolean not null default false,
  last_derived_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id, phase_code)
);
create index if not exists idx_br_phase_states_workspace on public.br_phase_states (workspace_id, sort_order);

create table if not exists public.br_domain_states (
  domain_state_id text primary key,
  workspace_id text not null references public.br_workspaces(workspace_id) on delete cascade,
  domain_code text not null,
  domain_name text not null default '',
  phase_code text not null default '',
  sort_order integer not null default 0,
  readiness_state text not null default 'not_started',
  percent_complete numeric(6,2) not null default 0,
  blocker_flag boolean not null default false,
  next_required_task_code text not null default '',
  missing_evidence_count integer not null default 0,
  launch_critical boolean not null default false,
  last_derived_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id, domain_code)
);
create index if not exists idx_br_domain_states_workspace on public.br_domain_states (workspace_id, sort_order);

create table if not exists public.br_blockers (
  blocker_id text primary key,
  workspace_id text not null references public.br_workspaces(workspace_id) on delete cascade,
  blocker_code text not null default '',
  blocker_type text not null default 'missing_setup',
  domain_code text not null default '',
  task_code text not null default '',
  title text not null default '',
  description text not null default '',
  severity text not null default 'high',
  active_flag boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  resolved_at timestamptz
);
create index if not exists idx_br_blockers_workspace on public.br_blockers (workspace_id, active_flag, sort_order);

insert into public.modules (module_id, module_code, module_name, display_order, is_active, updated_at)
values ('MOD-BR', 'BR', 'Business Readiness', 1, true, timezone('utc', now()))
on conflict (module_id) do update set
  module_code = excluded.module_code,
  module_name = excluded.module_name,
  display_order = excluded.display_order,
  is_active = excluded.is_active,
  updated_at = excluded.updated_at;
