create extension if not exists pgcrypto;

alter table public.certifications
  add column if not exists description text,
  add column if not exists active boolean not null default true,
  add column if not exists created_by uuid references public.members (id) on delete set null,
  add column if not exists updated_by uuid references public.members (id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'certifications_name_not_blank'
  ) then
    alter table public.certifications
      add constraint certifications_name_not_blank
      check (btrim(name) <> '');
  end if;
end $$;

create unique index if not exists certifications_department_name_unique_idx
on public.certifications (department_id, lower(btrim(name)));

create index if not exists certifications_department_idx
on public.certifications (department_id);

create index if not exists certifications_active_idx
on public.certifications (department_id, active);

create index if not exists certifications_created_by_idx
on public.certifications (created_by)
where created_by is not null;

create index if not exists certifications_updated_by_idx
on public.certifications (updated_by)
where updated_by is not null;

create or replace function public.set_certifications_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_certifications_updated_at on public.certifications;
create trigger trg_certifications_updated_at
before update on public.certifications
for each row
execute function public.set_certifications_updated_at();

alter table public.certifications enable row level security;

drop policy if exists certifications_select_by_department on public.certifications;
create policy certifications_select_by_department
on public.certifications
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists certifications_insert_by_department_admin on public.certifications;
create policy certifications_insert_by_department_admin
on public.certifications
for insert
with check (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

drop policy if exists certifications_update_by_department_admin on public.certifications;
create policy certifications_update_by_department_admin
on public.certifications
for update
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and lower(coalesce(m.role, '')) = 'administrator'
  )
)
with check (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

drop policy if exists certifications_delete_by_department_admin on public.certifications;
create policy certifications_delete_by_department_admin
on public.certifications
for delete
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

create table if not exists public.member_certifications (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  certification_id uuid not null references public.certifications (id) on delete restrict,
  certificate_number text,
  issued_at date not null,
  expires_at date,
  supporting_document_id uuid references public.documents (id) on delete set null,
  notes text,
  created_by uuid references public.members (id) on delete set null,
  updated_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (certificate_number is null or btrim(certificate_number) <> ''),
  check (expires_at is null or expires_at >= issued_at)
);

create unique index if not exists member_certifications_department_member_certification_unique_idx
on public.member_certifications (department_id, member_id, certification_id);

create index if not exists member_certifications_department_idx
on public.member_certifications (department_id);

create index if not exists member_certifications_member_idx
on public.member_certifications (member_id);

create index if not exists member_certifications_certification_idx
on public.member_certifications (certification_id);

create index if not exists member_certifications_expires_at_idx
on public.member_certifications (expires_at)
where expires_at is not null;

create index if not exists member_certifications_supporting_document_idx
on public.member_certifications (supporting_document_id)
where supporting_document_id is not null;

create index if not exists member_certifications_created_by_idx
on public.member_certifications (created_by)
where created_by is not null;

create index if not exists member_certifications_updated_by_idx
on public.member_certifications (updated_by)
where updated_by is not null;

create or replace function public.set_member_certifications_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_member_certifications_updated_at on public.member_certifications;
create trigger trg_member_certifications_updated_at
before update on public.member_certifications
for each row
execute function public.set_member_certifications_updated_at();

alter table public.member_certifications enable row level security;

drop policy if exists member_certifications_select_self_or_admin on public.member_certifications;
create policy member_certifications_select_self_or_admin
on public.member_certifications
for select
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = member_certifications.department_id
      and (
        m.id = member_certifications.member_id
        or lower(coalesce(m.role, '')) = 'administrator'
      )
  )
);

drop policy if exists member_certifications_insert_by_department_admin on public.member_certifications;
create policy member_certifications_insert_by_department_admin
on public.member_certifications
for insert
with check (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = member_certifications.department_id
      and lower(coalesce(m.role, '')) = 'administrator'
  )
  and exists (
    select 1
    from public.members target_member
    where target_member.id = member_certifications.member_id
      and target_member.department_id = member_certifications.department_id
  )
  and exists (
    select 1
    from public.certifications certification_type
    where certification_type.id = member_certifications.certification_id
      and certification_type.department_id = member_certifications.department_id
  )
  and (
    member_certifications.supporting_document_id is null
    or exists (
      select 1
      from public.documents supporting_document
      where supporting_document.id = member_certifications.supporting_document_id
        and supporting_document.department_id = member_certifications.department_id
    )
  )
  and (
    member_certifications.created_by is null
    or exists (
      select 1
      from public.members created_member
      where created_member.id = member_certifications.created_by
        and created_member.department_id = member_certifications.department_id
    )
  )
  and (
    member_certifications.updated_by is null
    or exists (
      select 1
      from public.members updated_member
      where updated_member.id = member_certifications.updated_by
        and updated_member.department_id = member_certifications.department_id
    )
  )
);

drop policy if exists member_certifications_update_by_department_admin on public.member_certifications;
create policy member_certifications_update_by_department_admin
on public.member_certifications
for update
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = member_certifications.department_id
      and lower(coalesce(m.role, '')) = 'administrator'
  )
)
with check (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = member_certifications.department_id
      and lower(coalesce(m.role, '')) = 'administrator'
  )
  and exists (
    select 1
    from public.members target_member
    where target_member.id = member_certifications.member_id
      and target_member.department_id = member_certifications.department_id
  )
  and exists (
    select 1
    from public.certifications certification_type
    where certification_type.id = member_certifications.certification_id
      and certification_type.department_id = member_certifications.department_id
  )
  and (
    member_certifications.supporting_document_id is null
    or exists (
      select 1
      from public.documents supporting_document
      where supporting_document.id = member_certifications.supporting_document_id
        and supporting_document.department_id = member_certifications.department_id
    )
  )
  and (
    member_certifications.created_by is null
    or exists (
      select 1
      from public.members created_member
      where created_member.id = member_certifications.created_by
        and created_member.department_id = member_certifications.department_id
    )
  )
  and (
    member_certifications.updated_by is null
    or exists (
      select 1
      from public.members updated_member
      where updated_member.id = member_certifications.updated_by
        and updated_member.department_id = member_certifications.department_id
    )
  )
);

drop policy if exists member_certifications_delete_by_department_admin on public.member_certifications;
create policy member_certifications_delete_by_department_admin
on public.member_certifications
for delete
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = member_certifications.department_id
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);