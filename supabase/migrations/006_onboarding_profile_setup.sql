-- Migration 006 — User profile, onboarding, and richer engagement context

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  workspace_name text not null default '',
  operating_mode text,
  job_title text not null default '',
  phone text not null default '',
  onboarding_completed boolean not null default false,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.user_profiles enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_profiles' and policyname = 'own_user_profile'
  ) then
    create policy "own_user_profile"
      on public.user_profiles
      for all using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end $$;

alter table public.clients
  add column if not exists trading_name text not null default '',
  add column if not exists website_url text not null default '',
  add column if not exists sub_industry text not null default '',
  add column if not exists country text not null default '',
  add column if not exists employee_band text not null default '',
  add column if not exists annual_revenue_band text not null default '',
  add column if not exists services_summary text not null default '';

alter table public.assessments
  add column if not exists reporting_period_label text not null default '',
  add column if not exists scope_type text not null default 'enterprise',
  add column if not exists scope_label text not null default '',
  add column if not exists assessment_version text not null default 'runtime-v1',
  add column if not exists assessment_objective text not null default '',
  add column if not exists priority_outcomes text not null default '',
  add column if not exists pain_points text not null default '',
  add column if not exists departments_in_scope text not null default '',
  add column if not exists systems_in_scope text not null default '',
  add column if not exists locations_in_scope text not null default '';
