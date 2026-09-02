create extension if not exists pgcrypto;

create table if not exists public.training_event_attendance_evidence (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  event_attendance_id uuid not null references public.training_event_attendance (id) on delete cascade,
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

create index if not exists training_event_attendance_evidence_department_idx
on public.training_event_attendance_evidence (department_id);

create index if not exists training_event_attendance_evidence_attendance_idx
on public.training_event_attendance_evidence (event_attendance_id);

create index if not exists training_event_attendance_evidence_member_idx
on public.training_event_attendance_evidence (member_id);

create table if not exists public.training_assignment_member_evidence (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  assignment_member_id uuid not null references public.training_assignment_members (id) on delete cascade,
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

create index if not exists training_assignment_member_evidence_department_idx
on public.training_assignment_member_evidence (department_id);

create index if not exists training_assignment_member_evidence_assignment_member_idx
on public.training_assignment_member_evidence (assignment_member_id);

create index if not exists training_assignment_member_evidence_member_idx
on public.training_assignment_member_evidence (member_id);

alter table public.training_event_attendance_evidence enable row level security;
alter table public.training_assignment_member_evidence enable row level security;

drop policy if exists training_event_attendance_evidence_select_self_or_role on public.training_event_attendance_evidence;
create policy training_event_attendance_evidence_select_self_or_role
on public.training_event_attendance_evidence
for select
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_event_attendance_evidence.department_id
      and (
        m.id = training_event_attendance_evidence.member_id
        or lower(coalesce(m.role, '')) in ('administrator', 'officer')
      )
  )
);

drop policy if exists training_event_attendance_evidence_insert_self_or_role on public.training_event_attendance_evidence;
create policy training_event_attendance_evidence_insert_self_or_role
on public.training_event_attendance_evidence
for insert
with check (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_event_attendance_evidence.department_id
      and (
        m.id = training_event_attendance_evidence.member_id
        or lower(coalesce(m.role, '')) in ('administrator', 'officer')
      )
  )
  and exists (
    select 1
    from public.training_event_attendance a
    where a.id = training_event_attendance_evidence.event_attendance_id
      and a.department_id = training_event_attendance_evidence.department_id
      and a.member_id = training_event_attendance_evidence.member_id
  )
  and (
    training_event_attendance_evidence.uploaded_by is null
    or exists (
      select 1
      from public.members uploader
      where uploader.id = training_event_attendance_evidence.uploaded_by
        and uploader.department_id = training_event_attendance_evidence.department_id
    )
  )
);

drop policy if exists training_event_attendance_evidence_update_self_or_role on public.training_event_attendance_evidence;
create policy training_event_attendance_evidence_update_self_or_role
on public.training_event_attendance_evidence
for update
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_event_attendance_evidence.department_id
      and (
        m.id = training_event_attendance_evidence.member_id
        or lower(coalesce(m.role, '')) in ('administrator', 'officer')
      )
  )
)
with check (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_event_attendance_evidence.department_id
      and (
        m.id = training_event_attendance_evidence.member_id
        or lower(coalesce(m.role, '')) in ('administrator', 'officer')
      )
  )
  and exists (
    select 1
    from public.training_event_attendance a
    where a.id = training_event_attendance_evidence.event_attendance_id
      and a.department_id = training_event_attendance_evidence.department_id
      and a.member_id = training_event_attendance_evidence.member_id
  )
  and (
    training_event_attendance_evidence.uploaded_by is null
    or exists (
      select 1
      from public.members uploader
      where uploader.id = training_event_attendance_evidence.uploaded_by
        and uploader.department_id = training_event_attendance_evidence.department_id
    )
  )
);

drop policy if exists training_event_attendance_evidence_delete_self_or_role on public.training_event_attendance_evidence;
create policy training_event_attendance_evidence_delete_self_or_role
on public.training_event_attendance_evidence
for delete
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_event_attendance_evidence.department_id
      and (
        m.id = training_event_attendance_evidence.member_id
        or lower(coalesce(m.role, '')) in ('administrator', 'officer')
      )
  )
);

drop policy if exists training_assignment_member_evidence_select_self_or_role on public.training_assignment_member_evidence;
create policy training_assignment_member_evidence_select_self_or_role
on public.training_assignment_member_evidence
for select
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_assignment_member_evidence.department_id
      and (
        m.id = training_assignment_member_evidence.member_id
        or lower(coalesce(m.role, '')) in ('administrator', 'officer')
      )
  )
);

drop policy if exists training_assignment_member_evidence_insert_self_or_role on public.training_assignment_member_evidence;
create policy training_assignment_member_evidence_insert_self_or_role
on public.training_assignment_member_evidence
for insert
with check (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_assignment_member_evidence.department_id
      and (
        m.id = training_assignment_member_evidence.member_id
        or lower(coalesce(m.role, '')) in ('administrator', 'officer')
      )
  )
  and exists (
    select 1
    from public.training_assignment_members assignment_member
    where assignment_member.id = training_assignment_member_evidence.assignment_member_id
      and assignment_member.department_id = training_assignment_member_evidence.department_id
      and assignment_member.member_id = training_assignment_member_evidence.member_id
  )
  and (
    training_assignment_member_evidence.uploaded_by is null
    or exists (
      select 1
      from public.members uploader
      where uploader.id = training_assignment_member_evidence.uploaded_by
        and uploader.department_id = training_assignment_member_evidence.department_id
    )
  )
);

drop policy if exists training_assignment_member_evidence_update_self_or_role on public.training_assignment_member_evidence;
create policy training_assignment_member_evidence_update_self_or_role
on public.training_assignment_member_evidence
for update
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_assignment_member_evidence.department_id
      and (
        m.id = training_assignment_member_evidence.member_id
        or lower(coalesce(m.role, '')) in ('administrator', 'officer')
      )
  )
)
with check (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_assignment_member_evidence.department_id
      and (
        m.id = training_assignment_member_evidence.member_id
        or lower(coalesce(m.role, '')) in ('administrator', 'officer')
      )
  )
  and exists (
    select 1
    from public.training_assignment_members assignment_member
    where assignment_member.id = training_assignment_member_evidence.assignment_member_id
      and assignment_member.department_id = training_assignment_member_evidence.department_id
      and assignment_member.member_id = training_assignment_member_evidence.member_id
  )
  and (
    training_assignment_member_evidence.uploaded_by is null
    or exists (
      select 1
      from public.members uploader
      where uploader.id = training_assignment_member_evidence.uploaded_by
        and uploader.department_id = training_assignment_member_evidence.department_id
    )
  )
);

drop policy if exists training_assignment_member_evidence_delete_self_or_role on public.training_assignment_member_evidence;
create policy training_assignment_member_evidence_delete_self_or_role
on public.training_assignment_member_evidence
for delete
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_assignment_member_evidence.department_id
      and (
        m.id = training_assignment_member_evidence.member_id
        or lower(coalesce(m.role, '')) in ('administrator', 'officer')
      )
  )
);