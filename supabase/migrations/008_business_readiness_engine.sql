create table if not exists public.br_task_instances (
  task_instance_id text primary key,
  workspace_id text not null references public.br_workspaces(workspace_id) on delete cascade,
  task_code text not null,
  domain_code text not null default '',
  phase_code text not null default '',
  task_name text not null default '',
  task_description text not null default '',
  task_role text not null default 'setup',
  status text not null default 'not_started',
  required_flag boolean not null default true,
  can_block_launch boolean not null default false,
  evidence_required_flag boolean not null default false,
  sort_order integer not null default 0,
  is_region_specific boolean not null default false,
  is_business_type_specific boolean not null default false,
  notes text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  started_at timestamptz,
  completed_at timestamptz,
  unique (workspace_id, task_code)
);
create index if not exists idx_br_task_instances_workspace on public.br_task_instances (workspace_id, sort_order);
create index if not exists idx_br_task_instances_domain on public.br_task_instances (workspace_id, domain_code, sort_order);

create table if not exists public.br_evidence_items (
  evidence_id text primary key,
  workspace_id text not null references public.br_workspaces(workspace_id) on delete cascade,
  task_instance_id text not null references public.br_task_instances(task_instance_id) on delete cascade,
  evidence_type text not null default 'note',
  note_text text not null default '',
  external_link text not null default '',
  file_url text not null default '',
  uploaded_by text not null default 'system',
  uploaded_at timestamptz not null default timezone('utc', now()),
  review_status text not null default 'pending'
);
create index if not exists idx_br_evidence_items_workspace on public.br_evidence_items (workspace_id, uploaded_at desc);
create index if not exists idx_br_evidence_items_task on public.br_evidence_items (task_instance_id, uploaded_at desc);
