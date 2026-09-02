create extension if not exists pgcrypto;

create table if not exists public.ems_requirement_sets (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  authority text not null check (authority in ('iowa', 'nremt')),
  certification_level text not null check (certification_level in ('emr', 'emt', 'aemt', 'paramedic')),
  version_label text not null,
  publication_status text not null default 'published' check (publication_status in ('draft', 'published', 'retired')),
  source_citation text not null,
  effective_start_date date not null,
  effective_end_date date,
  total_required_hours numeric(6,2) check (total_required_hours is null or total_required_hours >= 0),
  notes text,
  created_by uuid references public.members (id) on delete set null,
  updated_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_end_date is null or effective_end_date >= effective_start_date)
);

create unique index if not exists ems_requirement_sets_unique_version_idx
on public.ems_requirement_sets (department_id, authority, certification_level, version_label);

create index if not exists ems_requirement_sets_department_lookup_idx
on public.ems_requirement_sets (department_id, authority, certification_level, publication_status);

create table if not exists public.ems_requirement_components (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  requirement_set_id uuid not null references public.ems_requirement_sets (id) on delete cascade,
  component_code text not null,
  component_name text not null,
  sort_order integer not null default 0,
  required_hours numeric(6,2) check (required_hours is null or required_hours >= 0),
  minimum_hours numeric(6,2) check (minimum_hours is null or minimum_hours >= 0),
  maximum_hours numeric(6,2) check (maximum_hours is null or maximum_hours >= 0),
  required_percent numeric(5,2) check (required_percent is null or required_percent >= 0),
  maximum_percent numeric(5,2) check (maximum_percent is null or maximum_percent >= 0),
  pediatric_required boolean not null default false,
  pediatric_min_hours numeric(6,2) check (pediatric_min_hours is null or pediatric_min_hours >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (requirement_set_id, component_code)
);

create index if not exists ems_requirement_components_department_idx
on public.ems_requirement_components (department_id, requirement_set_id, sort_order);

create table if not exists public.ems_requirement_topics (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  requirement_component_id uuid not null references public.ems_requirement_components (id) on delete cascade,
  topic_code text not null,
  topic_name text not null,
  sort_order integer not null default 0,
  required_hours numeric(6,2) check (required_hours is null or required_hours >= 0),
  minimum_hours numeric(6,2) check (minimum_hours is null or minimum_hours >= 0),
  maximum_hours numeric(6,2) check (maximum_hours is null or maximum_hours >= 0),
  required_percent numeric(5,2) check (required_percent is null or required_percent >= 0),
  pediatric_applicable boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (requirement_component_id, topic_code)
);

create index if not exists ems_requirement_topics_department_idx
on public.ems_requirement_topics (department_id, requirement_component_id, sort_order);

create table if not exists public.ems_course_definitions (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  course_code text,
  course_name text not null check (btrim(course_name) <> ''),
  authority_scope text not null default 'none' check (authority_scope in ('iowa', 'nremt', 'both', 'none')),
  default_hours numeric(6,2) check (default_hours is null or default_hours >= 0),
  requires_certificate boolean not null default false,
  pediatric_designation text not null default 'unknown' check (pediatric_designation in ('none', 'partial', 'full', 'unknown')),
  active boolean not null default true,
  notes text,
  created_by uuid references public.members (id) on delete set null,
  updated_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ems_course_definitions_department_name_unique_idx
on public.ems_course_definitions (department_id, lower(btrim(course_name)));

create index if not exists ems_course_definitions_department_idx
on public.ems_course_definitions (department_id, active);

create table if not exists public.ems_course_applicability_rules (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  course_definition_id uuid not null references public.ems_course_definitions (id) on delete cascade,
  requirement_set_id uuid not null references public.ems_requirement_sets (id) on delete cascade,
  requirement_component_id uuid references public.ems_requirement_components (id) on delete cascade,
  requirement_topic_id uuid references public.ems_requirement_topics (id) on delete cascade,
  max_credit_hours numeric(6,2) check (max_credit_hours is null or max_credit_hours >= 0),
  allocation_priority integer not null default 100,
  approval_required boolean not null default false,
  rule_status text not null default 'active' check (rule_status in ('active', 'inactive', 'needs_authoritative_verification')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_definition_id, requirement_set_id, requirement_component_id, requirement_topic_id)
);

create index if not exists ems_course_applicability_rules_department_idx
on public.ems_course_applicability_rules (department_id, requirement_set_id, rule_status);

create table if not exists public.ems_member_track_profiles (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  track text not null check (track in ('iowa', 'nremt')),
  certification_level text not null check (certification_level in ('emr', 'emt', 'aemt', 'paramedic')),
  track_status text not null check (track_status in ('active', 'inactive', 'expired', 'not_maintained', 'needs_review')),
  maintain_track boolean not null default true,
  certification_number text,
  expiration_date date,
  effective_start_date date not null,
  effective_end_date date,
  notes text,
  created_by uuid references public.members (id) on delete set null,
  updated_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_end_date is null or effective_end_date >= effective_start_date)
);

create unique index if not exists ems_member_track_profiles_unique_period_idx
on public.ems_member_track_profiles (member_id, track, effective_start_date);

create index if not exists ems_member_track_profiles_lookup_idx
on public.ems_member_track_profiles (department_id, member_id, track, effective_end_date);

create table if not exists public.ems_member_ce_cycles (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  member_track_profile_id uuid not null references public.ems_member_track_profiles (id) on delete cascade,
  cycle_start_date date not null,
  cycle_end_date date not null,
  cycle_status text not null default 'open' check (cycle_status in ('open', 'locked', 'closed', 'archived')),
  basis_expiration_date date,
  lock_reason text,
  locked_by uuid references public.members (id) on delete set null,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cycle_end_date >= cycle_start_date)
);

create unique index if not exists ems_member_ce_cycles_unique_period_idx
on public.ems_member_ce_cycles (member_track_profile_id, cycle_start_date, cycle_end_date);

create index if not exists ems_member_ce_cycles_lookup_idx
on public.ems_member_ce_cycles (department_id, cycle_status, cycle_end_date);

create table if not exists public.ems_credit_sources (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  source_type text not null check (source_type in ('training_event_attendance', 'training_assignment_member', 'training_outside_submission', 'manual')),
  source_record_id uuid not null,
  source_occurred_at date not null,
  source_title text not null,
  source_hours numeric(6,2) not null check (source_hours >= 0),
  training_category_id uuid references public.training_categories (id) on delete set null,
  ems_core_topic text check (ems_core_topic in ('airway_respirations_ventilations', 'cardiology', 'trauma', 'medical', 'operations', 'other')),
  provider_name text,
  course_definition_id uuid references public.ems_course_definitions (id) on delete set null,
  approval_state text not null default 'approved' check (approval_state in ('approved', 'pending_review', 'rejected', 'needs_review')),
  certificate_document_id uuid references public.documents (id) on delete set null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (department_id, member_id, source_type, source_record_id)
);

create index if not exists ems_credit_sources_lookup_idx
on public.ems_credit_sources (department_id, member_id, source_occurred_at);

create index if not exists ems_credit_sources_state_idx
on public.ems_credit_sources (department_id, approval_state);

create table if not exists public.ems_credit_allocations (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  member_cycle_id uuid references public.ems_member_ce_cycles (id) on delete set null,
  credit_source_id uuid not null references public.ems_credit_sources (id) on delete cascade,
  requirement_set_id uuid not null references public.ems_requirement_sets (id) on delete restrict,
  requirement_component_id uuid references public.ems_requirement_components (id) on delete restrict,
  requirement_topic_id uuid references public.ems_requirement_topics (id) on delete restrict,
  allocated_hours numeric(6,2) not null check (allocated_hours >= 0),
  allocation_status text not null default 'allocated' check (allocation_status in ('allocated', 'unallocated', 'superseded', 'manual_override', 'needs_review')),
  allocation_reason text,
  allocator_version text not null default 'v1',
  rule_trace_json jsonb not null default '{}'::jsonb,
  is_manual_override boolean not null default false,
  overridden_by uuid references public.members (id) on delete set null,
  overridden_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists ems_credit_allocations_lookup_idx
on public.ems_credit_allocations (department_id, member_id, credit_source_id);

create index if not exists ems_credit_allocations_requirement_idx
on public.ems_credit_allocations (department_id, requirement_set_id, requirement_component_id, requirement_topic_id);

create table if not exists public.ems_credit_recalc_jobs (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  requested_by uuid not null references public.members (id) on delete restrict,
  job_scope text not null check (job_scope in ('member_cycle', 'member_track', 'department_set')),
  scope_member_id uuid references public.members (id) on delete set null,
  scope_cycle_id uuid references public.ems_member_ce_cycles (id) on delete set null,
  scope_requirement_set_id uuid references public.ems_requirement_sets (id) on delete set null,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed', 'canceled')),
  summary_json jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists ems_credit_recalc_jobs_lookup_idx
on public.ems_credit_recalc_jobs (department_id, status, created_at);

alter table public.training_events
  add column if not exists is_ems_training boolean not null default false,
  add column if not exists ems_core_topic text,
  add column if not exists ems_course_definition_id uuid references public.ems_course_definitions (id) on delete set null,
  add column if not exists ems_needs_review boolean not null default false,
  add column if not exists ems_provider_name text;

alter table public.training_events
  drop constraint if exists training_events_ems_core_topic_check;

alter table public.training_events
  add constraint training_events_ems_core_topic_check
  check (ems_core_topic is null or ems_core_topic in ('airway_respirations_ventilations', 'cardiology', 'trauma', 'medical', 'operations', 'other'));

alter table public.training_outside_submissions
  add column if not exists is_ems_training boolean not null default false,
  add column if not exists ems_core_topic text,
  add column if not exists ems_course_definition_id uuid references public.ems_course_definitions (id) on delete set null,
  add column if not exists ems_needs_review boolean not null default false,
  add column if not exists ems_provider_name text;

alter table public.training_outside_submissions
  drop constraint if exists training_outside_submissions_ems_core_topic_check;

alter table public.training_outside_submissions
  add constraint training_outside_submissions_ems_core_topic_check
  check (ems_core_topic is null or ems_core_topic in ('airway_respirations_ventilations', 'cardiology', 'trauma', 'medical', 'operations', 'other'));

create index if not exists training_events_ems_lookup_idx
on public.training_events (department_id, is_ems_training, ems_core_topic);

create index if not exists training_outside_submissions_ems_lookup_idx
on public.training_outside_submissions (department_id, is_ems_training, ems_core_topic);

create or replace function public.set_ems_requirement_sets_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.set_ems_requirement_components_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.set_ems_requirement_topics_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.set_ems_course_definitions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.set_ems_course_applicability_rules_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.set_ems_member_track_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.set_ems_member_ce_cycles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_ems_requirement_sets_updated_at on public.ems_requirement_sets;
create trigger trg_ems_requirement_sets_updated_at
before update on public.ems_requirement_sets
for each row execute function public.set_ems_requirement_sets_updated_at();

drop trigger if exists trg_ems_requirement_components_updated_at on public.ems_requirement_components;
create trigger trg_ems_requirement_components_updated_at
before update on public.ems_requirement_components
for each row execute function public.set_ems_requirement_components_updated_at();

drop trigger if exists trg_ems_requirement_topics_updated_at on public.ems_requirement_topics;
create trigger trg_ems_requirement_topics_updated_at
before update on public.ems_requirement_topics
for each row execute function public.set_ems_requirement_topics_updated_at();

drop trigger if exists trg_ems_course_definitions_updated_at on public.ems_course_definitions;
create trigger trg_ems_course_definitions_updated_at
before update on public.ems_course_definitions
for each row execute function public.set_ems_course_definitions_updated_at();

drop trigger if exists trg_ems_course_applicability_rules_updated_at on public.ems_course_applicability_rules;
create trigger trg_ems_course_applicability_rules_updated_at
before update on public.ems_course_applicability_rules
for each row execute function public.set_ems_course_applicability_rules_updated_at();

drop trigger if exists trg_ems_member_track_profiles_updated_at on public.ems_member_track_profiles;
create trigger trg_ems_member_track_profiles_updated_at
before update on public.ems_member_track_profiles
for each row execute function public.set_ems_member_track_profiles_updated_at();

drop trigger if exists trg_ems_member_ce_cycles_updated_at on public.ems_member_ce_cycles;
create trigger trg_ems_member_ce_cycles_updated_at
before update on public.ems_member_ce_cycles
for each row execute function public.set_ems_member_ce_cycles_updated_at();

alter table public.ems_requirement_sets enable row level security;
alter table public.ems_requirement_components enable row level security;
alter table public.ems_requirement_topics enable row level security;
alter table public.ems_course_definitions enable row level security;
alter table public.ems_course_applicability_rules enable row level security;
alter table public.ems_member_track_profiles enable row level security;
alter table public.ems_member_ce_cycles enable row level security;
alter table public.ems_credit_sources enable row level security;
alter table public.ems_credit_allocations enable row level security;
alter table public.ems_credit_recalc_jobs enable row level security;

create policy ems_requirement_sets_select_by_department
on public.ems_requirement_sets
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

create policy ems_requirement_sets_manage_by_department_admin
on public.ems_requirement_sets
for all
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = ems_requirement_sets.department_id
      and lower(coalesce(m.role, '')) in ('administrator', 'officer')
  )
)
with check (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = ems_requirement_sets.department_id
      and lower(coalesce(m.role, '')) in ('administrator', 'officer')
  )
);

create policy ems_requirement_components_select_by_department
on public.ems_requirement_components
for select
using (
  department_id in (
    select m.department_id from public.members m where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

create policy ems_requirement_components_manage_by_department_admin
on public.ems_requirement_components
for all
using (
  exists (
    select 1 from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = ems_requirement_components.department_id
      and lower(coalesce(m.role, '')) in ('administrator', 'officer')
  )
)
with check (
  exists (
    select 1 from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = ems_requirement_components.department_id
      and lower(coalesce(m.role, '')) in ('administrator', 'officer')
  )
);

create policy ems_requirement_topics_select_by_department
on public.ems_requirement_topics
for select
using (
  department_id in (
    select m.department_id from public.members m where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

create policy ems_requirement_topics_manage_by_department_admin
on public.ems_requirement_topics
for all
using (
  exists (
    select 1 from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = ems_requirement_topics.department_id
      and lower(coalesce(m.role, '')) in ('administrator', 'officer')
  )
)
with check (
  exists (
    select 1 from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = ems_requirement_topics.department_id
      and lower(coalesce(m.role, '')) in ('administrator', 'officer')
  )
);

create policy ems_course_definitions_select_by_department
on public.ems_course_definitions
for select
using (
  department_id in (
    select m.department_id from public.members m where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

create policy ems_course_definitions_manage_by_department_admin
on public.ems_course_definitions
for all
using (
  exists (
    select 1 from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = ems_course_definitions.department_id
      and lower(coalesce(m.role, '')) in ('administrator', 'officer')
  )
)
with check (
  exists (
    select 1 from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = ems_course_definitions.department_id
      and lower(coalesce(m.role, '')) in ('administrator', 'officer')
  )
);

create policy ems_course_applicability_rules_select_by_department
on public.ems_course_applicability_rules
for select
using (
  department_id in (
    select m.department_id from public.members m where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

create policy ems_course_applicability_rules_manage_by_department_admin
on public.ems_course_applicability_rules
for all
using (
  exists (
    select 1 from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = ems_course_applicability_rules.department_id
      and lower(coalesce(m.role, '')) in ('administrator', 'officer')
  )
)
with check (
  exists (
    select 1 from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = ems_course_applicability_rules.department_id
      and lower(coalesce(m.role, '')) in ('administrator', 'officer')
  )
);

create policy ems_member_track_profiles_select_self_or_role
on public.ems_member_track_profiles
for select
using (
  exists (
    select 1 from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = ems_member_track_profiles.department_id
      and (m.id = ems_member_track_profiles.member_id or lower(coalesce(m.role, '')) in ('administrator', 'officer'))
  )
);

create policy ems_member_track_profiles_manage_by_role
on public.ems_member_track_profiles
for all
using (
  exists (
    select 1 from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = ems_member_track_profiles.department_id
      and lower(coalesce(m.role, '')) in ('administrator', 'officer')
  )
)
with check (
  exists (
    select 1 from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = ems_member_track_profiles.department_id
      and lower(coalesce(m.role, '')) in ('administrator', 'officer')
  )
);

create policy ems_member_ce_cycles_select_self_or_role
on public.ems_member_ce_cycles
for select
using (
  exists (
    select 1
    from public.ems_member_track_profiles p
    join public.members m on m.department_id = p.department_id
    where p.id = ems_member_ce_cycles.member_track_profile_id
      and lower(m.email) = lower(coalesce(auth.email(), ''))
      and (m.id = p.member_id or lower(coalesce(m.role, '')) in ('administrator', 'officer'))
  )
);

create policy ems_member_ce_cycles_manage_by_role
on public.ems_member_ce_cycles
for all
using (
  exists (
    select 1 from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = ems_member_ce_cycles.department_id
      and lower(coalesce(m.role, '')) in ('administrator', 'officer')
  )
)
with check (
  exists (
    select 1 from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = ems_member_ce_cycles.department_id
      and lower(coalesce(m.role, '')) in ('administrator', 'officer')
  )
);

create policy ems_credit_sources_select_self_or_role
on public.ems_credit_sources
for select
using (
  exists (
    select 1 from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = ems_credit_sources.department_id
      and (m.id = ems_credit_sources.member_id or lower(coalesce(m.role, '')) in ('administrator', 'officer'))
  )
);

create policy ems_credit_sources_manage_by_role
on public.ems_credit_sources
for all
using (
  exists (
    select 1 from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = ems_credit_sources.department_id
      and lower(coalesce(m.role, '')) in ('administrator', 'officer')
  )
)
with check (
  exists (
    select 1 from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = ems_credit_sources.department_id
      and lower(coalesce(m.role, '')) in ('administrator', 'officer')
  )
);

create policy ems_credit_allocations_select_self_or_role
on public.ems_credit_allocations
for select
using (
  exists (
    select 1 from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = ems_credit_allocations.department_id
      and (m.id = ems_credit_allocations.member_id or lower(coalesce(m.role, '')) in ('administrator', 'officer'))
  )
);

create policy ems_credit_allocations_manage_by_role
on public.ems_credit_allocations
for all
using (
  exists (
    select 1 from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = ems_credit_allocations.department_id
      and lower(coalesce(m.role, '')) in ('administrator', 'officer')
  )
)
with check (
  exists (
    select 1 from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = ems_credit_allocations.department_id
      and lower(coalesce(m.role, '')) in ('administrator', 'officer')
  )
);

create policy ems_credit_recalc_jobs_select_by_role
on public.ems_credit_recalc_jobs
for select
using (
  exists (
    select 1 from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = ems_credit_recalc_jobs.department_id
      and lower(coalesce(m.role, '')) in ('administrator', 'officer')
  )
);

create policy ems_credit_recalc_jobs_manage_by_role
on public.ems_credit_recalc_jobs
for all
using (
  exists (
    select 1 from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = ems_credit_recalc_jobs.department_id
      and lower(coalesce(m.role, '')) in ('administrator', 'officer')
  )
)
with check (
  exists (
    select 1 from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = ems_credit_recalc_jobs.department_id
      and lower(coalesce(m.role, '')) in ('administrator', 'officer')
  )
);

with seeded_sets as (
  insert into public.ems_requirement_sets (
    department_id,
    authority,
    certification_level,
    version_label,
    publication_status,
    source_citation,
    effective_start_date,
    total_required_hours,
    notes
  )
  select
    d.id,
    authority,
    level,
    '2026-initial',
    'published',
    source,
    date '2026-01-01',
    total_hours,
    notes
  from public.departments d
  cross join (
    values
      ('iowa', 'emr', 8.0::numeric, 'User-provided Iowa EMS renewal requirements (initial implementation).', null::text),
      ('iowa', 'emt', 20.0::numeric, 'User-provided Iowa EMS renewal requirements (initial implementation).', null::text),
      ('iowa', 'aemt', 25.0::numeric, 'User-provided Iowa EMS renewal requirements (initial implementation).', null::text),
      ('iowa', 'paramedic', 30.0::numeric, 'User-provided Iowa EMS renewal requirements (initial implementation).', null::text),
      ('nremt', 'emr', 16.0::numeric, 'User-provided National Registry/NCCP requirements (initial implementation).', 'Local/State and Individual component distribution NEEDS AUTHORITATIVE VERIFICATION.'),
      ('nremt', 'emt', 40.0::numeric, 'User-provided National Registry/NCCP requirements (initial implementation).', 'Local/State and Individual component distribution NEEDS AUTHORITATIVE VERIFICATION.'),
      ('nremt', 'aemt', 50.0::numeric, 'User-provided National Registry/NCCP requirements (initial implementation).', 'Local/State and Individual component distribution NEEDS AUTHORITATIVE VERIFICATION.'),
      ('nremt', 'paramedic', 60.0::numeric, 'User-provided National Registry/NCCP requirements (initial implementation).', 'Local/State and Individual component distribution NEEDS AUTHORITATIVE VERIFICATION.')
  ) as seed(authority, level, total_hours, source, notes)
  on conflict (department_id, authority, certification_level, version_label) do nothing
  returning id, department_id, authority, certification_level
),
all_sets as (
  select id, department_id, authority, certification_level
  from seeded_sets
  union all
  select s.id, s.department_id, s.authority, s.certification_level
  from public.ems_requirement_sets s
  where s.version_label = '2026-initial'
),
seeded_components as (
  insert into public.ems_requirement_components (
    department_id,
    requirement_set_id,
    component_code,
    component_name,
    sort_order,
    required_hours,
    pediatric_required,
    pediatric_min_hours,
    active
  )
  select
    s.department_id,
    s.id,
    c.component_code,
    c.component_name,
    c.sort_order,
    c.required_hours,
    c.pediatric_required,
    c.pediatric_min_hours,
    true
  from all_sets s
  join (
    values
      ('iowa', 'core', 'Iowa Core Topics', 1, null::numeric, false, null::numeric),
      ('nremt', 'national_component', 'National Component', 1, null::numeric, true, null::numeric),
      ('nremt', 'local_state_component', 'Local/State Component', 2, null::numeric, false, null::numeric),
      ('nremt', 'individual_component', 'Individual Component', 3, null::numeric, false, null::numeric)
  ) as c(authority, component_code, component_name, sort_order, required_hours, pediatric_required, pediatric_min_hours)
    on c.authority = s.authority
  on conflict (requirement_set_id, component_code) do nothing
  returning id, department_id, requirement_set_id, component_code
),
all_components as (
  select id, department_id, requirement_set_id, component_code
  from seeded_components
  union all
  select c.id, c.department_id, c.requirement_set_id, c.component_code
  from public.ems_requirement_components c
  join all_sets s on s.id = c.requirement_set_id
)
insert into public.ems_requirement_topics (
  department_id,
  requirement_component_id,
  topic_code,
  topic_name,
  sort_order,
  required_hours,
  pediatric_applicable,
  active
)
select
  c.department_id,
  c.id,
  t.topic_code,
  t.topic_name,
  t.sort_order,
  case
    when rs.authority = 'iowa' and rs.certification_level = 'emr' and t.topic_code = 'airway_respirations_ventilations' then 1.0
    when rs.authority = 'iowa' and rs.certification_level = 'emr' and t.topic_code = 'cardiology' then 2.0
    when rs.authority = 'iowa' and rs.certification_level = 'emr' and t.topic_code = 'trauma' then 1.0
    when rs.authority = 'iowa' and rs.certification_level = 'emr' and t.topic_code = 'medical' then 3.0
    when rs.authority = 'iowa' and rs.certification_level = 'emr' and t.topic_code = 'operations' then 1.0

    when rs.authority = 'iowa' and rs.certification_level = 'emt' and t.topic_code = 'airway_respirations_ventilations' then 1.0
    when rs.authority = 'iowa' and rs.certification_level = 'emt' and t.topic_code = 'cardiology' then 6.0
    when rs.authority = 'iowa' and rs.certification_level = 'emt' and t.topic_code = 'trauma' then 2.0
    when rs.authority = 'iowa' and rs.certification_level = 'emt' and t.topic_code = 'medical' then 6.0
    when rs.authority = 'iowa' and rs.certification_level = 'emt' and t.topic_code = 'operations' then 5.0

    when rs.authority = 'iowa' and rs.certification_level = 'aemt' and t.topic_code = 'airway_respirations_ventilations' then 2.0
    when rs.authority = 'iowa' and rs.certification_level = 'aemt' and t.topic_code = 'cardiology' then 7.0
    when rs.authority = 'iowa' and rs.certification_level = 'aemt' and t.topic_code = 'trauma' then 3.0
    when rs.authority = 'iowa' and rs.certification_level = 'aemt' and t.topic_code = 'medical' then 8.0
    when rs.authority = 'iowa' and rs.certification_level = 'aemt' and t.topic_code = 'operations' then 5.0

    when rs.authority = 'iowa' and rs.certification_level = 'paramedic' and t.topic_code = 'airway_respirations_ventilations' then 3.0
    when rs.authority = 'iowa' and rs.certification_level = 'paramedic' and t.topic_code = 'cardiology' then 9.0
    when rs.authority = 'iowa' and rs.certification_level = 'paramedic' and t.topic_code = 'trauma' then 3.0
    when rs.authority = 'iowa' and rs.certification_level = 'paramedic' and t.topic_code = 'medical' then 9.0
    when rs.authority = 'iowa' and rs.certification_level = 'paramedic' and t.topic_code = 'operations' then 6.0

    when rs.authority = 'nremt' and rs.certification_level = 'emr' and c.component_code = 'national_component' and t.topic_code = 'airway_respirations_ventilations' then 1.5
    when rs.authority = 'nremt' and rs.certification_level = 'emr' and c.component_code = 'national_component' and t.topic_code = 'cardiology' then 2.0
    when rs.authority = 'nremt' and rs.certification_level = 'emr' and c.component_code = 'national_component' and t.topic_code = 'trauma' then 1.0
    when rs.authority = 'nremt' and rs.certification_level = 'emr' and c.component_code = 'national_component' and t.topic_code = 'medical' then 2.5
    when rs.authority = 'nremt' and rs.certification_level = 'emr' and c.component_code = 'national_component' and t.topic_code = 'operations' then 1.0

    when rs.authority = 'nremt' and rs.certification_level = 'emt' and c.component_code = 'national_component' and t.topic_code = 'airway_respirations_ventilations' then 4.0
    when rs.authority = 'nremt' and rs.certification_level = 'emt' and c.component_code = 'national_component' and t.topic_code = 'cardiology' then 5.0
    when rs.authority = 'nremt' and rs.certification_level = 'emt' and c.component_code = 'national_component' and t.topic_code = 'trauma' then 3.0
    when rs.authority = 'nremt' and rs.certification_level = 'emt' and c.component_code = 'national_component' and t.topic_code = 'medical' then 6.0
    when rs.authority = 'nremt' and rs.certification_level = 'emt' and c.component_code = 'national_component' and t.topic_code = 'operations' then 2.0

    when rs.authority = 'nremt' and rs.certification_level = 'aemt' and c.component_code = 'national_component' and t.topic_code = 'airway_respirations_ventilations' then 5.0
    when rs.authority = 'nremt' and rs.certification_level = 'aemt' and c.component_code = 'national_component' and t.topic_code = 'cardiology' then 6.0
    when rs.authority = 'nremt' and rs.certification_level = 'aemt' and c.component_code = 'national_component' and t.topic_code = 'trauma' then 4.0
    when rs.authority = 'nremt' and rs.certification_level = 'aemt' and c.component_code = 'national_component' and t.topic_code = 'medical' then 7.0
    when rs.authority = 'nremt' and rs.certification_level = 'aemt' and c.component_code = 'national_component' and t.topic_code = 'operations' then 3.0

    when rs.authority = 'nremt' and rs.certification_level = 'paramedic' and c.component_code = 'national_component' and t.topic_code = 'airway_respirations_ventilations' then 6.0
    when rs.authority = 'nremt' and rs.certification_level = 'paramedic' and c.component_code = 'national_component' and t.topic_code = 'cardiology' then 7.0
    when rs.authority = 'nremt' and rs.certification_level = 'paramedic' and c.component_code = 'national_component' and t.topic_code = 'trauma' then 5.0
    when rs.authority = 'nremt' and rs.certification_level = 'paramedic' and c.component_code = 'national_component' and t.topic_code = 'medical' then 8.0
    when rs.authority = 'nremt' and rs.certification_level = 'paramedic' and c.component_code = 'national_component' and t.topic_code = 'operations' then 4.0

    else null
  end,
  case when rs.authority = 'nremt' and c.component_code = 'national_component' then true else false end,
  true
from all_components c
join public.ems_requirement_sets rs on rs.id = c.requirement_set_id
join (
  values
    ('airway_respirations_ventilations', 'Airway, Respirations, Ventilations', 1),
    ('cardiology', 'Cardiology', 2),
    ('trauma', 'Trauma', 3),
    ('medical', 'Medical', 4),
    ('operations', 'Operations', 5)
) as t(topic_code, topic_name, sort_order)
  on (
    (rs.authority = 'iowa' and c.component_code = 'core')
    or (rs.authority = 'nremt' and c.component_code = 'national_component')
  )
on conflict (requirement_component_id, topic_code) do nothing;

insert into public.ems_requirement_components (
  department_id,
  requirement_set_id,
  component_code,
  component_name,
  sort_order,
  required_hours,
  active
)
select
  rs.department_id,
  rs.id,
  'national_component',
  'National Component',
  1,
  case rs.certification_level
    when 'emr' then 8.0
    when 'emt' then 20.0
    when 'aemt' then 25.0
    when 'paramedic' then 30.0
    else null
  end,
  true
from public.ems_requirement_sets rs
where rs.authority = 'nremt'
  and rs.version_label = '2026-initial'
on conflict (requirement_set_id, component_code)
do update set required_hours = excluded.required_hours;

insert into public.ems_course_definitions (
  department_id,
  course_name,
  authority_scope,
  active,
  notes
)
select
  d.id,
  c.course_name,
  'none',
  true,
  'Initial seeded course label. Applicability and maximum credit NEEDS AUTHORITATIVE VERIFICATION unless explicitly configured.'
from public.departments d
cross join (
  values
    ('CPR-HCP'),
    ('ACLS'),
    ('PALS'),
    ('PEPP'),
    ('AMLS'),
    ('EMPACT'),
    ('ITLS'),
    ('PHTLS'),
    ('TECC'),
    ('ATLS'),
    ('EMS Safety'),
    ('EVOC/EVOS'),
    ('TIMS'),
    ('HAZMAT'),
    ('ICS Courses'),
    ('Other')
) as c(course_name)
on conflict (department_id, lower(btrim(course_name))) do nothing;
