create extension if not exists pgcrypto;

create table if not exists public.department_training_settings (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  outside_training_requires_review boolean not null default true,
  created_by uuid references public.members (id) on delete set null,
  updated_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id)
);

create table if not exists public.training_categories (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  description text,
  active boolean not null default true,
  created_by uuid references public.members (id) on delete set null,
  updated_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists training_categories_department_name_unique_idx
on public.training_categories (department_id, lower(btrim(name)));

create index if not exists training_categories_department_idx
on public.training_categories (department_id);

create index if not exists training_categories_active_idx
on public.training_categories (department_id, active);

create table if not exists public.training_events (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  title text not null check (btrim(title) <> ''),
  category_id uuid references public.training_categories (id) on delete set null,
  topic text,
  training_type text,
  description text,
  location text,
  instructor_name text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  duration_minutes integer check (duration_minutes is null or duration_minutes >= 0),
  hours_credit numeric(6,2) check (hours_credit is null or hours_credit >= 0),
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'canceled', 'archived')),
  supporting_document_id uuid references public.documents (id) on delete set null,
  created_by uuid references public.members (id) on delete set null,
  updated_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);

create index if not exists training_events_department_idx
on public.training_events (department_id);

create index if not exists training_events_category_idx
on public.training_events (category_id)
where category_id is not null;

create index if not exists training_events_starts_at_idx
on public.training_events (department_id, starts_at);

create index if not exists training_events_status_idx
on public.training_events (department_id, status);

create index if not exists training_events_supporting_document_idx
on public.training_events (supporting_document_id)
where supporting_document_id is not null;

create table if not exists public.training_event_attendance (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  training_event_id uuid not null references public.training_events (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  attendance_status text not null default 'attending' check (attendance_status in ('attending', 'absent', 'excused', 'late')),
  completion_status text not null default 'not_completed' check (completion_status in ('not_completed', 'submitted', 'pending_review', 'approved', 'rejected')),
  completed_at timestamptz,
  hours_earned numeric(6,2) check (hours_earned is null or hours_earned >= 0),
  notes text,
  recorded_by uuid references public.members (id) on delete set null,
  reviewed_by uuid references public.members (id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id, training_event_id, member_id),
  check (reviewed_at is null or reviewed_by is not null)
);

create index if not exists training_event_attendance_department_idx
on public.training_event_attendance (department_id);

create index if not exists training_event_attendance_member_idx
on public.training_event_attendance (member_id);

create index if not exists training_event_attendance_event_idx
on public.training_event_attendance (training_event_id);

create index if not exists training_event_attendance_completion_status_idx
on public.training_event_attendance (department_id, completion_status);

create table if not exists public.training_assignments (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  title text not null check (btrim(title) <> ''),
  category_id uuid references public.training_categories (id) on delete set null,
  description text,
  due_at timestamptz,
  estimated_completion_minutes integer check (estimated_completion_minutes is null or estimated_completion_minutes >= 0),
  hours_credit numeric(6,2) check (hours_credit is null or hours_credit >= 0),
  external_video_url text,
  external_audio_url text,
  supporting_document_id uuid references public.documents (id) on delete set null,
  review_required boolean not null default false,
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  created_by uuid references public.members (id) on delete set null,
  updated_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists training_assignments_department_idx
on public.training_assignments (department_id);

create index if not exists training_assignments_category_idx
on public.training_assignments (category_id)
where category_id is not null;

create index if not exists training_assignments_due_at_idx
on public.training_assignments (department_id, due_at)
where due_at is not null;

create index if not exists training_assignments_status_idx
on public.training_assignments (department_id, status);

create table if not exists public.training_assignment_members (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  training_assignment_id uuid not null references public.training_assignments (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  assigned_at timestamptz not null default now(),
  due_at timestamptz,
  completion_status text not null default 'assigned' check (completion_status in ('assigned', 'in_progress', 'submitted', 'pending_review', 'approved', 'rejected')),
  completed_at timestamptz,
  hours_earned numeric(6,2) check (hours_earned is null or hours_earned >= 0),
  completion_notes text,
  reviewed_by uuid references public.members (id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_by uuid references public.members (id) on delete set null,
  updated_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id, training_assignment_id, member_id),
  check (reviewed_at is null or reviewed_by is not null)
);

create index if not exists training_assignment_members_department_idx
on public.training_assignment_members (department_id);

create index if not exists training_assignment_members_member_idx
on public.training_assignment_members (member_id);

create index if not exists training_assignment_members_assignment_idx
on public.training_assignment_members (training_assignment_id);

create index if not exists training_assignment_members_completion_status_idx
on public.training_assignment_members (department_id, completion_status);

create table if not exists public.training_requirements (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  category_id uuid references public.training_categories (id) on delete set null,
  requirement_kind text not null check (requirement_kind in ('annual_hours', 'category_hours', 'topic', 'recurring')),
  period_type text not null check (period_type in ('annual', 'rolling_30_days', 'rolling_90_days', 'rolling_365_days', 'custom')),
  minimum_hours numeric(6,2) check (minimum_hours is null or minimum_hours >= 0),
  due_frequency_rule text,
  required_topic text,
  active boolean not null default true,
  sort_order integer not null default 0,
  config_json jsonb not null default '{}'::jsonb,
  created_by uuid references public.members (id) on delete set null,
  updated_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists training_requirements_department_idx
on public.training_requirements (department_id);

create index if not exists training_requirements_active_idx
on public.training_requirements (department_id, active);

create index if not exists training_requirements_category_idx
on public.training_requirements (category_id)
where category_id is not null;

create index if not exists training_requirements_sort_order_idx
on public.training_requirements (department_id, sort_order);

create table if not exists public.training_outside_submissions (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  title text not null check (btrim(title) <> ''),
  category_id uuid references public.training_categories (id) on delete set null,
  training_date date not null,
  hours numeric(6,2) not null check (hours >= 0),
  description text,
  notes text,
  status text not null default 'submitted' check (status in ('submitted', 'pending_review', 'approved', 'rejected')),
  review_required boolean not null,
  reviewed_by uuid references public.members (id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_by uuid references public.members (id) on delete set null,
  updated_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reviewed_at is null or reviewed_by is not null)
);

create index if not exists training_outside_submissions_department_idx
on public.training_outside_submissions (department_id);

create index if not exists training_outside_submissions_member_idx
on public.training_outside_submissions (member_id);

create index if not exists training_outside_submissions_status_idx
on public.training_outside_submissions (department_id, status);

create index if not exists training_outside_submissions_training_date_idx
on public.training_outside_submissions (department_id, training_date);

create table if not exists public.training_outside_submission_evidence (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  submission_id uuid not null references public.training_outside_submissions (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  file_name text not null check (btrim(file_name) <> ''),
  file_path text not null check (btrim(file_path) <> ''),
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  mime_type text,
  uploaded_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  check (split_part(file_path, '/', 1) = department_id::text),
  check (split_part(file_path, '/', 2) = member_id::text)
);

create index if not exists training_outside_submission_evidence_department_idx
on public.training_outside_submission_evidence (department_id);

create index if not exists training_outside_submission_evidence_submission_idx
on public.training_outside_submission_evidence (submission_id);

create index if not exists training_outside_submission_evidence_member_idx
on public.training_outside_submission_evidence (member_id);

create or replace function public.set_department_training_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.set_training_categories_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.set_training_events_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.set_training_event_attendance_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.set_training_assignments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.set_training_assignment_members_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.set_training_requirements_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.set_training_outside_submissions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.apply_training_assignment_member_status_defaults()
returns trigger
language plpgsql
as $$
declare
  assignment_requires_review boolean;
begin
  select a.review_required
  into assignment_requires_review
  from public.training_assignments a
  where a.id = new.training_assignment_id
    and a.department_id = new.department_id
  limit 1;

  assignment_requires_review := coalesce(assignment_requires_review, false);

  if new.completion_status = 'submitted' then
    if assignment_requires_review then
      new.completion_status := 'pending_review';
      new.completed_at := coalesce(new.completed_at, now());
    else
      new.completion_status := 'approved';
      new.completed_at := coalesce(new.completed_at, now());
    end if;
  end if;

  if new.completion_status not in ('approved', 'rejected') then
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.review_notes := null;
  elsif new.reviewed_by is not null and new.reviewed_at is null then
    new.reviewed_at := now();
  end if;

  return new;
end;
$$;

create or replace function public.apply_outside_training_submission_defaults()
returns trigger
language plpgsql
as $$
declare
  department_requires_review boolean;
begin
  select s.outside_training_requires_review
  into department_requires_review
  from public.department_training_settings s
  where s.department_id = new.department_id
  limit 1;

  department_requires_review := coalesce(department_requires_review, true);

  if tg_op = 'INSERT' and new.review_required is null then
    new.review_required := department_requires_review;
  end if;

  if new.review_required and new.status = 'submitted' then
    new.status := 'pending_review';
  end if;

  if not new.review_required and new.status in ('submitted', 'pending_review') then
    new.status := 'approved';
    new.reviewed_by := null;
    new.reviewed_at := coalesce(new.reviewed_at, now());
  end if;

  if new.status not in ('approved', 'rejected') then
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.review_notes := null;
  elsif new.reviewed_by is not null and new.reviewed_at is null then
    new.reviewed_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_department_training_settings_updated_at on public.department_training_settings;
create trigger trg_department_training_settings_updated_at
before update on public.department_training_settings
for each row
execute function public.set_department_training_settings_updated_at();

drop trigger if exists trg_training_categories_updated_at on public.training_categories;
create trigger trg_training_categories_updated_at
before update on public.training_categories
for each row
execute function public.set_training_categories_updated_at();

drop trigger if exists trg_training_events_updated_at on public.training_events;
create trigger trg_training_events_updated_at
before update on public.training_events
for each row
execute function public.set_training_events_updated_at();

drop trigger if exists trg_training_event_attendance_updated_at on public.training_event_attendance;
create trigger trg_training_event_attendance_updated_at
before update on public.training_event_attendance
for each row
execute function public.set_training_event_attendance_updated_at();

drop trigger if exists trg_training_assignments_updated_at on public.training_assignments;
create trigger trg_training_assignments_updated_at
before update on public.training_assignments
for each row
execute function public.set_training_assignments_updated_at();

drop trigger if exists trg_training_assignment_members_updated_at on public.training_assignment_members;
create trigger trg_training_assignment_members_updated_at
before update on public.training_assignment_members
for each row
execute function public.set_training_assignment_members_updated_at();

drop trigger if exists trg_training_requirements_updated_at on public.training_requirements;
create trigger trg_training_requirements_updated_at
before update on public.training_requirements
for each row
execute function public.set_training_requirements_updated_at();

drop trigger if exists trg_training_outside_submissions_updated_at on public.training_outside_submissions;
create trigger trg_training_outside_submissions_updated_at
before update on public.training_outside_submissions
for each row
execute function public.set_training_outside_submissions_updated_at();

drop trigger if exists trg_training_assignment_members_status_defaults on public.training_assignment_members;
create trigger trg_training_assignment_members_status_defaults
before insert or update on public.training_assignment_members
for each row
execute function public.apply_training_assignment_member_status_defaults();

drop trigger if exists trg_outside_training_submission_defaults on public.training_outside_submissions;
create trigger trg_outside_training_submission_defaults
before insert or update on public.training_outside_submissions
for each row
execute function public.apply_outside_training_submission_defaults();

alter table public.department_training_settings enable row level security;
alter table public.training_categories enable row level security;
alter table public.training_events enable row level security;
alter table public.training_event_attendance enable row level security;
alter table public.training_assignments enable row level security;
alter table public.training_assignment_members enable row level security;
alter table public.training_requirements enable row level security;
alter table public.training_outside_submissions enable row level security;
alter table public.training_outside_submission_evidence enable row level security;

drop policy if exists department_training_settings_select_by_department on public.department_training_settings;
create policy department_training_settings_select_by_department
on public.department_training_settings
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists department_training_settings_insert_by_department_admin on public.department_training_settings;
create policy department_training_settings_insert_by_department_admin
on public.department_training_settings
for insert
with check (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = department_training_settings.department_id
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

drop policy if exists department_training_settings_update_by_department_admin on public.department_training_settings;
create policy department_training_settings_update_by_department_admin
on public.department_training_settings
for update
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = department_training_settings.department_id
      and lower(coalesce(m.role, '')) = 'administrator'
  )
)
with check (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = department_training_settings.department_id
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

drop policy if exists department_training_settings_delete_by_department_admin on public.department_training_settings;
create policy department_training_settings_delete_by_department_admin
on public.department_training_settings
for delete
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = department_training_settings.department_id
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

drop policy if exists training_categories_select_by_department on public.training_categories;
create policy training_categories_select_by_department
on public.training_categories
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists training_categories_insert_by_department_admin on public.training_categories;
create policy training_categories_insert_by_department_admin
on public.training_categories
for insert
with check (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_categories.department_id
      and lower(coalesce(m.role, '')) = 'administrator'
  )
  and (
    training_categories.created_by is null
    or exists (
      select 1
      from public.members creator
      where creator.id = training_categories.created_by
        and creator.department_id = training_categories.department_id
    )
  )
  and (
    training_categories.updated_by is null
    or exists (
      select 1
      from public.members updater
      where updater.id = training_categories.updated_by
        and updater.department_id = training_categories.department_id
    )
  )
);

drop policy if exists training_categories_update_by_department_admin on public.training_categories;
create policy training_categories_update_by_department_admin
on public.training_categories
for update
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_categories.department_id
      and lower(coalesce(m.role, '')) = 'administrator'
  )
)
with check (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_categories.department_id
      and lower(coalesce(m.role, '')) = 'administrator'
  )
  and (
    training_categories.created_by is null
    or exists (
      select 1
      from public.members creator
      where creator.id = training_categories.created_by
        and creator.department_id = training_categories.department_id
    )
  )
  and (
    training_categories.updated_by is null
    or exists (
      select 1
      from public.members updater
      where updater.id = training_categories.updated_by
        and updater.department_id = training_categories.department_id
    )
  )
);

drop policy if exists training_categories_delete_by_department_admin on public.training_categories;
create policy training_categories_delete_by_department_admin
on public.training_categories
for delete
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_categories.department_id
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

drop policy if exists training_events_select_by_department on public.training_events;
create policy training_events_select_by_department
on public.training_events
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists training_events_insert_by_department_role on public.training_events;
create policy training_events_insert_by_department_role
on public.training_events
for insert
with check (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_events.department_id
      and lower(coalesce(m.role, '')) in ('administrator', 'officer')
  )
  and (
    training_events.category_id is null
    or exists (
      select 1
      from public.training_categories c
      where c.id = training_events.category_id
        and c.department_id = training_events.department_id
    )
  )
  and (
    training_events.supporting_document_id is null
    or exists (
      select 1
      from public.documents d
      where d.id = training_events.supporting_document_id
        and d.department_id = training_events.department_id
    )
  )
  and (
    training_events.created_by is null
    or exists (
      select 1
      from public.members creator
      where creator.id = training_events.created_by
        and creator.department_id = training_events.department_id
    )
  )
  and (
    training_events.updated_by is null
    or exists (
      select 1
      from public.members updater
      where updater.id = training_events.updated_by
        and updater.department_id = training_events.department_id
    )
  )
);

drop policy if exists training_events_update_by_department_role on public.training_events;
create policy training_events_update_by_department_role
on public.training_events
for update
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_events.department_id
      and lower(coalesce(m.role, '')) in ('administrator', 'officer')
  )
)
with check (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_events.department_id
      and lower(coalesce(m.role, '')) in ('administrator', 'officer')
  )
  and (
    training_events.category_id is null
    or exists (
      select 1
      from public.training_categories c
      where c.id = training_events.category_id
        and c.department_id = training_events.department_id
    )
  )
  and (
    training_events.supporting_document_id is null
    or exists (
      select 1
      from public.documents d
      where d.id = training_events.supporting_document_id
        and d.department_id = training_events.department_id
    )
  )
  and (
    training_events.created_by is null
    or exists (
      select 1
      from public.members creator
      where creator.id = training_events.created_by
        and creator.department_id = training_events.department_id
    )
  )
  and (
    training_events.updated_by is null
    or exists (
      select 1
      from public.members updater
      where updater.id = training_events.updated_by
        and updater.department_id = training_events.department_id
    )
  )
);

drop policy if exists training_events_delete_by_department_role on public.training_events;
create policy training_events_delete_by_department_role
on public.training_events
for delete
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_events.department_id
      and lower(coalesce(m.role, '')) in ('administrator', 'officer')
  )
);

drop policy if exists training_event_attendance_select_self_or_role on public.training_event_attendance;
create policy training_event_attendance_select_self_or_role
on public.training_event_attendance
for select
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_event_attendance.department_id
      and (
        m.id = training_event_attendance.member_id
        or lower(coalesce(m.role, '')) in ('administrator', 'officer')
      )
  )
);

drop policy if exists training_event_attendance_insert_by_department_role on public.training_event_attendance;
create policy training_event_attendance_insert_by_department_role
on public.training_event_attendance
for insert
with check (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_event_attendance.department_id
      and lower(coalesce(m.role, '')) in ('administrator', 'officer')
  )
  and exists (
    select 1
    from public.training_events e
    where e.id = training_event_attendance.training_event_id
      and e.department_id = training_event_attendance.department_id
  )
  and exists (
    select 1
    from public.members target_member
    where target_member.id = training_event_attendance.member_id
      and target_member.department_id = training_event_attendance.department_id
  )
  and (
    training_event_attendance.recorded_by is null
    or exists (
      select 1
      from public.members recorder
      where recorder.id = training_event_attendance.recorded_by
        and recorder.department_id = training_event_attendance.department_id
    )
  )
  and (
    training_event_attendance.reviewed_by is null
    or exists (
      select 1
      from public.members reviewer
      where reviewer.id = training_event_attendance.reviewed_by
        and reviewer.department_id = training_event_attendance.department_id
    )
  )
);

drop policy if exists training_event_attendance_update_by_department_role on public.training_event_attendance;
create policy training_event_attendance_update_by_department_role
on public.training_event_attendance
for update
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_event_attendance.department_id
      and lower(coalesce(m.role, '')) in ('administrator', 'officer')
  )
)
with check (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_event_attendance.department_id
      and lower(coalesce(m.role, '')) in ('administrator', 'officer')
  )
  and exists (
    select 1
    from public.training_events e
    where e.id = training_event_attendance.training_event_id
      and e.department_id = training_event_attendance.department_id
  )
  and exists (
    select 1
    from public.members target_member
    where target_member.id = training_event_attendance.member_id
      and target_member.department_id = training_event_attendance.department_id
  )
  and (
    training_event_attendance.recorded_by is null
    or exists (
      select 1
      from public.members recorder
      where recorder.id = training_event_attendance.recorded_by
        and recorder.department_id = training_event_attendance.department_id
    )
  )
  and (
    training_event_attendance.reviewed_by is null
    or exists (
      select 1
      from public.members reviewer
      where reviewer.id = training_event_attendance.reviewed_by
        and reviewer.department_id = training_event_attendance.department_id
    )
  )
);

drop policy if exists training_event_attendance_delete_by_department_role on public.training_event_attendance;
create policy training_event_attendance_delete_by_department_role
on public.training_event_attendance
for delete
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_event_attendance.department_id
      and lower(coalesce(m.role, '')) in ('administrator', 'officer')
  )
);

drop policy if exists training_assignments_select_by_department on public.training_assignments;
create policy training_assignments_select_by_department
on public.training_assignments
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists training_assignments_insert_by_department_role on public.training_assignments;
create policy training_assignments_insert_by_department_role
on public.training_assignments
for insert
with check (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_assignments.department_id
      and lower(coalesce(m.role, '')) in ('administrator', 'officer')
  )
  and (
    training_assignments.category_id is null
    or exists (
      select 1
      from public.training_categories c
      where c.id = training_assignments.category_id
        and c.department_id = training_assignments.department_id
    )
  )
  and (
    training_assignments.supporting_document_id is null
    or exists (
      select 1
      from public.documents d
      where d.id = training_assignments.supporting_document_id
        and d.department_id = training_assignments.department_id
    )
  )
  and (
    training_assignments.created_by is null
    or exists (
      select 1
      from public.members creator
      where creator.id = training_assignments.created_by
        and creator.department_id = training_assignments.department_id
    )
  )
  and (
    training_assignments.updated_by is null
    or exists (
      select 1
      from public.members updater
      where updater.id = training_assignments.updated_by
        and updater.department_id = training_assignments.department_id
    )
  )
);

drop policy if exists training_assignments_update_by_department_role on public.training_assignments;
create policy training_assignments_update_by_department_role
on public.training_assignments
for update
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_assignments.department_id
      and lower(coalesce(m.role, '')) in ('administrator', 'officer')
  )
)
with check (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_assignments.department_id
      and lower(coalesce(m.role, '')) in ('administrator', 'officer')
  )
  and (
    training_assignments.category_id is null
    or exists (
      select 1
      from public.training_categories c
      where c.id = training_assignments.category_id
        and c.department_id = training_assignments.department_id
    )
  )
  and (
    training_assignments.supporting_document_id is null
    or exists (
      select 1
      from public.documents d
      where d.id = training_assignments.supporting_document_id
        and d.department_id = training_assignments.department_id
    )
  )
  and (
    training_assignments.created_by is null
    or exists (
      select 1
      from public.members creator
      where creator.id = training_assignments.created_by
        and creator.department_id = training_assignments.department_id
    )
  )
  and (
    training_assignments.updated_by is null
    or exists (
      select 1
      from public.members updater
      where updater.id = training_assignments.updated_by
        and updater.department_id = training_assignments.department_id
    )
  )
);

drop policy if exists training_assignments_delete_by_department_role on public.training_assignments;
create policy training_assignments_delete_by_department_role
on public.training_assignments
for delete
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_assignments.department_id
      and lower(coalesce(m.role, '')) in ('administrator', 'officer')
  )
);

drop policy if exists training_assignment_members_select_self_or_role on public.training_assignment_members;
create policy training_assignment_members_select_self_or_role
on public.training_assignment_members
for select
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_assignment_members.department_id
      and (
        m.id = training_assignment_members.member_id
        or lower(coalesce(m.role, '')) in ('administrator', 'officer')
      )
  )
);

drop policy if exists training_assignment_members_insert_by_department_role on public.training_assignment_members;
create policy training_assignment_members_insert_by_department_role
on public.training_assignment_members
for insert
with check (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_assignment_members.department_id
      and lower(coalesce(m.role, '')) in ('administrator', 'officer')
  )
  and exists (
    select 1
    from public.training_assignments a
    where a.id = training_assignment_members.training_assignment_id
      and a.department_id = training_assignment_members.department_id
  )
  and exists (
    select 1
    from public.members target_member
    where target_member.id = training_assignment_members.member_id
      and target_member.department_id = training_assignment_members.department_id
  )
  and (
    training_assignment_members.created_by is null
    or exists (
      select 1
      from public.members creator
      where creator.id = training_assignment_members.created_by
        and creator.department_id = training_assignment_members.department_id
    )
  )
  and (
    training_assignment_members.updated_by is null
    or exists (
      select 1
      from public.members updater
      where updater.id = training_assignment_members.updated_by
        and updater.department_id = training_assignment_members.department_id
    )
  )
  and (
    training_assignment_members.reviewed_by is null
    or exists (
      select 1
      from public.members reviewer
      where reviewer.id = training_assignment_members.reviewed_by
        and reviewer.department_id = training_assignment_members.department_id
    )
  )
);

drop policy if exists training_assignment_members_update_by_department_role on public.training_assignment_members;
create policy training_assignment_members_update_by_department_role
on public.training_assignment_members
for update
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_assignment_members.department_id
      and lower(coalesce(m.role, '')) in ('administrator', 'officer')
  )
)
with check (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_assignment_members.department_id
      and lower(coalesce(m.role, '')) in ('administrator', 'officer')
  )
  and exists (
    select 1
    from public.training_assignments a
    where a.id = training_assignment_members.training_assignment_id
      and a.department_id = training_assignment_members.department_id
  )
  and exists (
    select 1
    from public.members target_member
    where target_member.id = training_assignment_members.member_id
      and target_member.department_id = training_assignment_members.department_id
  )
  and (
    training_assignment_members.created_by is null
    or exists (
      select 1
      from public.members creator
      where creator.id = training_assignment_members.created_by
        and creator.department_id = training_assignment_members.department_id
    )
  )
  and (
    training_assignment_members.updated_by is null
    or exists (
      select 1
      from public.members updater
      where updater.id = training_assignment_members.updated_by
        and updater.department_id = training_assignment_members.department_id
    )
  )
  and (
    training_assignment_members.reviewed_by is null
    or exists (
      select 1
      from public.members reviewer
      where reviewer.id = training_assignment_members.reviewed_by
        and reviewer.department_id = training_assignment_members.department_id
    )
  )
);

drop policy if exists training_assignment_members_update_self_submission on public.training_assignment_members;
create policy training_assignment_members_update_self_submission
on public.training_assignment_members
for update
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.id = training_assignment_members.member_id
      and m.department_id = training_assignment_members.department_id
  )
)
with check (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.id = training_assignment_members.member_id
      and m.department_id = training_assignment_members.department_id
  )
  and exists (
    select 1
    from public.training_assignments a
    where a.id = training_assignment_members.training_assignment_id
      and a.department_id = training_assignment_members.department_id
  )
  and training_assignment_members.completion_status in ('assigned', 'in_progress', 'submitted', 'pending_review')
  and training_assignment_members.reviewed_by is null
  and training_assignment_members.reviewed_at is null
  and training_assignment_members.review_notes is null
);

drop policy if exists training_assignment_members_delete_by_department_role on public.training_assignment_members;
create policy training_assignment_members_delete_by_department_role
on public.training_assignment_members
for delete
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_assignment_members.department_id
      and lower(coalesce(m.role, '')) in ('administrator', 'officer')
  )
);

drop policy if exists training_requirements_select_by_department on public.training_requirements;
create policy training_requirements_select_by_department
on public.training_requirements
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists training_requirements_insert_by_department_admin on public.training_requirements;
create policy training_requirements_insert_by_department_admin
on public.training_requirements
for insert
with check (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_requirements.department_id
      and lower(coalesce(m.role, '')) = 'administrator'
  )
  and (
    training_requirements.category_id is null
    or exists (
      select 1
      from public.training_categories c
      where c.id = training_requirements.category_id
        and c.department_id = training_requirements.department_id
    )
  )
  and (
    training_requirements.created_by is null
    or exists (
      select 1
      from public.members creator
      where creator.id = training_requirements.created_by
        and creator.department_id = training_requirements.department_id
    )
  )
  and (
    training_requirements.updated_by is null
    or exists (
      select 1
      from public.members updater
      where updater.id = training_requirements.updated_by
        and updater.department_id = training_requirements.department_id
    )
  )
);

drop policy if exists training_requirements_update_by_department_admin on public.training_requirements;
create policy training_requirements_update_by_department_admin
on public.training_requirements
for update
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_requirements.department_id
      and lower(coalesce(m.role, '')) = 'administrator'
  )
)
with check (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_requirements.department_id
      and lower(coalesce(m.role, '')) = 'administrator'
  )
  and (
    training_requirements.category_id is null
    or exists (
      select 1
      from public.training_categories c
      where c.id = training_requirements.category_id
        and c.department_id = training_requirements.department_id
    )
  )
  and (
    training_requirements.created_by is null
    or exists (
      select 1
      from public.members creator
      where creator.id = training_requirements.created_by
        and creator.department_id = training_requirements.department_id
    )
  )
  and (
    training_requirements.updated_by is null
    or exists (
      select 1
      from public.members updater
      where updater.id = training_requirements.updated_by
        and updater.department_id = training_requirements.department_id
    )
  )
);

drop policy if exists training_requirements_delete_by_department_admin on public.training_requirements;
create policy training_requirements_delete_by_department_admin
on public.training_requirements
for delete
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_requirements.department_id
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

drop policy if exists training_outside_submissions_select_self_or_role on public.training_outside_submissions;
create policy training_outside_submissions_select_self_or_role
on public.training_outside_submissions
for select
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_outside_submissions.department_id
      and (
        m.id = training_outside_submissions.member_id
        or lower(coalesce(m.role, '')) in ('administrator', 'officer')
      )
  )
);

drop policy if exists training_outside_submissions_insert_by_self_or_role on public.training_outside_submissions;
create policy training_outside_submissions_insert_by_self_or_role
on public.training_outside_submissions
for insert
with check (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_outside_submissions.department_id
      and (
        m.id = training_outside_submissions.member_id
        or lower(coalesce(m.role, '')) in ('administrator', 'officer')
      )
  )
  and (
    training_outside_submissions.category_id is null
    or exists (
      select 1
      from public.training_categories c
      where c.id = training_outside_submissions.category_id
        and c.department_id = training_outside_submissions.department_id
    )
  )
  and (
    training_outside_submissions.reviewed_by is null
    or exists (
      select 1
      from public.members reviewer
      where reviewer.id = training_outside_submissions.reviewed_by
        and reviewer.department_id = training_outside_submissions.department_id
        and lower(coalesce(reviewer.role, '')) in ('administrator', 'officer')
    )
  )
  and (
    training_outside_submissions.created_by is null
    or exists (
      select 1
      from public.members creator
      where creator.id = training_outside_submissions.created_by
        and creator.department_id = training_outside_submissions.department_id
    )
  )
  and (
    training_outside_submissions.updated_by is null
    or exists (
      select 1
      from public.members updater
      where updater.id = training_outside_submissions.updated_by
        and updater.department_id = training_outside_submissions.department_id
    )
  )
);

drop policy if exists training_outside_submissions_update_by_department_role on public.training_outside_submissions;
create policy training_outside_submissions_update_by_department_role
on public.training_outside_submissions
for update
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_outside_submissions.department_id
      and lower(coalesce(m.role, '')) in ('administrator', 'officer')
  )
)
with check (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_outside_submissions.department_id
      and lower(coalesce(m.role, '')) in ('administrator', 'officer')
  )
  and (
    training_outside_submissions.category_id is null
    or exists (
      select 1
      from public.training_categories c
      where c.id = training_outside_submissions.category_id
        and c.department_id = training_outside_submissions.department_id
    )
  )
  and (
    training_outside_submissions.reviewed_by is null
    or exists (
      select 1
      from public.members reviewer
      where reviewer.id = training_outside_submissions.reviewed_by
        and reviewer.department_id = training_outside_submissions.department_id
        and lower(coalesce(reviewer.role, '')) in ('administrator', 'officer')
    )
  )
  and (
    training_outside_submissions.created_by is null
    or exists (
      select 1
      from public.members creator
      where creator.id = training_outside_submissions.created_by
        and creator.department_id = training_outside_submissions.department_id
    )
  )
  and (
    training_outside_submissions.updated_by is null
    or exists (
      select 1
      from public.members updater
      where updater.id = training_outside_submissions.updated_by
        and updater.department_id = training_outside_submissions.department_id
    )
  )
);

drop policy if exists training_outside_submissions_update_self_before_review on public.training_outside_submissions;
create policy training_outside_submissions_update_self_before_review
on public.training_outside_submissions
for update
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.id = training_outside_submissions.member_id
      and m.department_id = training_outside_submissions.department_id
  )
)
with check (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.id = training_outside_submissions.member_id
      and m.department_id = training_outside_submissions.department_id
  )
  and training_outside_submissions.status in ('submitted', 'pending_review')
  and training_outside_submissions.reviewed_by is null
  and training_outside_submissions.reviewed_at is null
  and (
    training_outside_submissions.category_id is null
    or exists (
      select 1
      from public.training_categories c
      where c.id = training_outside_submissions.category_id
        and c.department_id = training_outside_submissions.department_id
    )
  )
);

drop policy if exists training_outside_submissions_delete_by_department_role on public.training_outside_submissions;
create policy training_outside_submissions_delete_by_department_role
on public.training_outside_submissions
for delete
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_outside_submissions.department_id
      and lower(coalesce(m.role, '')) in ('administrator', 'officer')
  )
);

drop policy if exists training_outside_submission_evidence_select_self_or_role on public.training_outside_submission_evidence;
create policy training_outside_submission_evidence_select_self_or_role
on public.training_outside_submission_evidence
for select
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_outside_submission_evidence.department_id
      and (
        m.id = training_outside_submission_evidence.member_id
        or lower(coalesce(m.role, '')) in ('administrator', 'officer')
      )
  )
);

drop policy if exists training_outside_submission_evidence_insert_self_or_role on public.training_outside_submission_evidence;
create policy training_outside_submission_evidence_insert_self_or_role
on public.training_outside_submission_evidence
for insert
with check (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_outside_submission_evidence.department_id
      and (
        m.id = training_outside_submission_evidence.member_id
        or lower(coalesce(m.role, '')) in ('administrator', 'officer')
      )
  )
  and exists (
    select 1
    from public.training_outside_submissions submission
    where submission.id = training_outside_submission_evidence.submission_id
      and submission.department_id = training_outside_submission_evidence.department_id
      and submission.member_id = training_outside_submission_evidence.member_id
  )
  and (
    training_outside_submission_evidence.uploaded_by is null
    or exists (
      select 1
      from public.members uploader
      where uploader.id = training_outside_submission_evidence.uploaded_by
        and uploader.department_id = training_outside_submission_evidence.department_id
    )
  )
);

drop policy if exists training_outside_submission_evidence_update_self_or_role on public.training_outside_submission_evidence;
create policy training_outside_submission_evidence_update_self_or_role
on public.training_outside_submission_evidence
for update
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_outside_submission_evidence.department_id
      and (
        m.id = training_outside_submission_evidence.member_id
        or lower(coalesce(m.role, '')) in ('administrator', 'officer')
      )
  )
)
with check (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_outside_submission_evidence.department_id
      and (
        m.id = training_outside_submission_evidence.member_id
        or lower(coalesce(m.role, '')) in ('administrator', 'officer')
      )
  )
  and exists (
    select 1
    from public.training_outside_submissions submission
    where submission.id = training_outside_submission_evidence.submission_id
      and submission.department_id = training_outside_submission_evidence.department_id
      and submission.member_id = training_outside_submission_evidence.member_id
  )
  and (
    training_outside_submission_evidence.uploaded_by is null
    or exists (
      select 1
      from public.members uploader
      where uploader.id = training_outside_submission_evidence.uploaded_by
        and uploader.department_id = training_outside_submission_evidence.department_id
    )
  )
);

drop policy if exists training_outside_submission_evidence_delete_self_or_role on public.training_outside_submission_evidence;
create policy training_outside_submission_evidence_delete_self_or_role
on public.training_outside_submission_evidence
for delete
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_outside_submission_evidence.department_id
      and (
        m.id = training_outside_submission_evidence.member_id
        or lower(coalesce(m.role, '')) in ('administrator', 'officer')
      )
  )
);

insert into public.department_training_settings (department_id)
select d.id
from public.departments d
on conflict (department_id) do nothing;

insert into storage.buckets (id, name, public, type)
values ('training-evidence', 'training-evidence', false, 'STANDARD')
on conflict (id) do nothing;

drop policy if exists training_evidence_select on storage.objects;
create policy training_evidence_select
on storage.objects
for select
using (
  bucket_id = 'training-evidence'
  and (
    exists (
      select 1
      from public.members m
      where lower(m.email) = lower(coalesce(auth.email(), ''))
        and m.department_id::text = split_part(name, '/', 1)
        and lower(coalesce(m.role, '')) in ('administrator', 'officer')
    )
    or exists (
      select 1
      from public.members m
      where lower(m.email) = lower(coalesce(auth.email(), ''))
        and m.department_id::text = split_part(name, '/', 1)
        and m.id::text = split_part(name, '/', 2)
    )
  )
);

drop policy if exists training_evidence_insert on storage.objects;
create policy training_evidence_insert
on storage.objects
for insert
with check (
  bucket_id = 'training-evidence'
  and (
    exists (
      select 1
      from public.members m
      where lower(m.email) = lower(coalesce(auth.email(), ''))
        and m.department_id::text = split_part(name, '/', 1)
        and lower(coalesce(m.role, '')) in ('administrator', 'officer')
    )
    or exists (
      select 1
      from public.members m
      where lower(m.email) = lower(coalesce(auth.email(), ''))
        and m.department_id::text = split_part(name, '/', 1)
        and m.id::text = split_part(name, '/', 2)
    )
  )
);

drop policy if exists training_evidence_update on storage.objects;
create policy training_evidence_update
on storage.objects
for update
using (
  bucket_id = 'training-evidence'
  and (
    exists (
      select 1
      from public.members m
      where lower(m.email) = lower(coalesce(auth.email(), ''))
        and m.department_id::text = split_part(name, '/', 1)
        and lower(coalesce(m.role, '')) in ('administrator', 'officer')
    )
    or exists (
      select 1
      from public.members m
      where lower(m.email) = lower(coalesce(auth.email(), ''))
        and m.department_id::text = split_part(name, '/', 1)
        and m.id::text = split_part(name, '/', 2)
    )
  )
)
with check (
  bucket_id = 'training-evidence'
  and (
    exists (
      select 1
      from public.members m
      where lower(m.email) = lower(coalesce(auth.email(), ''))
        and m.department_id::text = split_part(name, '/', 1)
        and lower(coalesce(m.role, '')) in ('administrator', 'officer')
    )
    or exists (
      select 1
      from public.members m
      where lower(m.email) = lower(coalesce(auth.email(), ''))
        and m.department_id::text = split_part(name, '/', 1)
        and m.id::text = split_part(name, '/', 2)
    )
  )
);

drop policy if exists training_evidence_delete on storage.objects;
create policy training_evidence_delete
on storage.objects
for delete
using (
  bucket_id = 'training-evidence'
  and (
    exists (
      select 1
      from public.members m
      where lower(m.email) = lower(coalesce(auth.email(), ''))
        and m.department_id::text = split_part(name, '/', 1)
        and lower(coalesce(m.role, '')) in ('administrator', 'officer')
    )
    or exists (
      select 1
      from public.members m
      where lower(m.email) = lower(coalesce(auth.email(), ''))
        and m.department_id::text = split_part(name, '/', 1)
        and m.id::text = split_part(name, '/', 2)
    )
  )
);