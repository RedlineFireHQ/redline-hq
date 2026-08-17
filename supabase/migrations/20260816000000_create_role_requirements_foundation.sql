create extension if not exists pgcrypto;

create table if not exists public.department_roles (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  name text not null,
  code text not null,
  description text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references public.members (id) on delete set null,
  updated_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint department_roles_name_not_blank check (btrim(name) <> ''),
  constraint department_roles_code_not_blank check (btrim(code) <> '')
);

create unique index if not exists department_roles_department_name_unique_idx
on public.department_roles (department_id, lower(btrim(name)));

create unique index if not exists department_roles_department_code_unique_idx
on public.department_roles (department_id, lower(btrim(code)));

create index if not exists department_roles_department_idx
on public.department_roles (department_id);

create index if not exists department_roles_active_idx
on public.department_roles (department_id, active);

create or replace function public.set_department_roles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_department_roles_updated_at on public.department_roles;
create trigger trg_department_roles_updated_at
before update on public.department_roles
for each row
execute function public.set_department_roles_updated_at();

create table if not exists public.role_required_certifications (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  department_role_id uuid not null references public.department_roles (id) on delete cascade,
  certification_id uuid not null references public.certifications (id) on delete cascade,
  notes text,
  created_by uuid references public.members (id) on delete set null,
  updated_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_role_id, certification_id)
);

create index if not exists role_required_certifications_department_idx
on public.role_required_certifications (department_id);

create index if not exists role_required_certifications_role_idx
on public.role_required_certifications (department_role_id);

create index if not exists role_required_certifications_cert_idx
on public.role_required_certifications (certification_id);

create or replace function public.set_role_required_certifications_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_role_required_certifications_updated_at on public.role_required_certifications;
create trigger trg_role_required_certifications_updated_at
before update on public.role_required_certifications
for each row
execute function public.set_role_required_certifications_updated_at();

create table if not exists public.qualifications (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  name text not null,
  description text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references public.members (id) on delete set null,
  updated_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint qualifications_name_not_blank check (btrim(name) <> '')
);

create unique index if not exists qualifications_department_name_unique_idx
on public.qualifications (department_id, lower(btrim(name)));

create index if not exists qualifications_department_idx
on public.qualifications (department_id);

create index if not exists qualifications_active_idx
on public.qualifications (department_id, active);

create or replace function public.set_qualifications_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_qualifications_updated_at on public.qualifications;
create trigger trg_qualifications_updated_at
before update on public.qualifications
for each row
execute function public.set_qualifications_updated_at();

create table if not exists public.member_qualifications (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  qualification_id uuid not null references public.qualifications (id) on delete restrict,
  earned_at date not null,
  certificate_number text,
  notes text,
  supporting_document_id uuid references public.documents (id) on delete set null,
  created_by uuid references public.members (id) on delete set null,
  updated_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_qualifications_certificate_number_valid check (certificate_number is null or btrim(certificate_number) <> '')
);

create unique index if not exists member_qualifications_department_member_qualification_unique_idx
on public.member_qualifications (department_id, member_id, qualification_id);

create index if not exists member_qualifications_department_idx
on public.member_qualifications (department_id);

create index if not exists member_qualifications_member_idx
on public.member_qualifications (member_id);

create index if not exists member_qualifications_qualification_idx
on public.member_qualifications (qualification_id);

create index if not exists member_qualifications_supporting_document_idx
on public.member_qualifications (supporting_document_id)
where supporting_document_id is not null;

create or replace function public.set_member_qualifications_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_member_qualifications_updated_at on public.member_qualifications;
create trigger trg_member_qualifications_updated_at
before update on public.member_qualifications
for each row
execute function public.set_member_qualifications_updated_at();

create table if not exists public.role_required_qualifications (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  department_role_id uuid not null references public.department_roles (id) on delete cascade,
  qualification_id uuid not null references public.qualifications (id) on delete cascade,
  notes text,
  created_by uuid references public.members (id) on delete set null,
  updated_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_role_id, qualification_id)
);

create index if not exists role_required_qualifications_department_idx
on public.role_required_qualifications (department_id);

create index if not exists role_required_qualifications_role_idx
on public.role_required_qualifications (department_role_id);

create index if not exists role_required_qualifications_qualification_idx
on public.role_required_qualifications (qualification_id);

create or replace function public.set_role_required_qualifications_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_role_required_qualifications_updated_at on public.role_required_qualifications;
create trigger trg_role_required_qualifications_updated_at
before update on public.role_required_qualifications
for each row
execute function public.set_role_required_qualifications_updated_at();

alter table public.members
  add column if not exists department_role_id uuid references public.department_roles (id) on delete set null;

create index if not exists members_department_role_id_idx
on public.members (department_role_id)
where department_role_id is not null;

alter table public.department_roles enable row level security;

drop policy if exists department_roles_select_by_department on public.department_roles;
create policy department_roles_select_by_department
on public.department_roles
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists department_roles_insert_by_department_admin on public.department_roles;
create policy department_roles_insert_by_department_admin
on public.department_roles
for insert
with check (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

drop policy if exists department_roles_update_by_department_admin on public.department_roles;
create policy department_roles_update_by_department_admin
on public.department_roles
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

drop policy if exists department_roles_delete_by_department_admin on public.department_roles;
create policy department_roles_delete_by_department_admin
on public.department_roles
for delete
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

alter table public.role_required_certifications enable row level security;

drop policy if exists role_required_certifications_select_by_department on public.role_required_certifications;
create policy role_required_certifications_select_by_department
on public.role_required_certifications
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists role_required_certifications_insert_by_department_admin on public.role_required_certifications;
create policy role_required_certifications_insert_by_department_admin
on public.role_required_certifications
for insert
with check (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and lower(coalesce(m.role, '')) = 'administrator'
  )
  and exists (
    select 1
    from public.department_roles dr
    where dr.id = department_role_id
      and dr.department_id = role_required_certifications.department_id
  )
  and exists (
    select 1
    from public.certifications c
    where c.id = certification_id
      and c.department_id = role_required_certifications.department_id
  )
);

drop policy if exists role_required_certifications_update_by_department_admin on public.role_required_certifications;
create policy role_required_certifications_update_by_department_admin
on public.role_required_certifications
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
  and exists (
    select 1
    from public.department_roles dr
    where dr.id = department_role_id
      and dr.department_id = role_required_certifications.department_id
  )
  and exists (
    select 1
    from public.certifications c
    where c.id = certification_id
      and c.department_id = role_required_certifications.department_id
  )
);

drop policy if exists role_required_certifications_delete_by_department_admin on public.role_required_certifications;
create policy role_required_certifications_delete_by_department_admin
on public.role_required_certifications
for delete
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

alter table public.qualifications enable row level security;

drop policy if exists qualifications_select_by_department on public.qualifications;
create policy qualifications_select_by_department
on public.qualifications
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists qualifications_insert_by_department_admin on public.qualifications;
create policy qualifications_insert_by_department_admin
on public.qualifications
for insert
with check (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

drop policy if exists qualifications_update_by_department_admin on public.qualifications;
create policy qualifications_update_by_department_admin
on public.qualifications
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

drop policy if exists qualifications_delete_by_department_admin on public.qualifications;
create policy qualifications_delete_by_department_admin
on public.qualifications
for delete
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

alter table public.member_qualifications enable row level security;

drop policy if exists member_qualifications_select_self_or_admin on public.member_qualifications;
create policy member_qualifications_select_self_or_admin
on public.member_qualifications
for select
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = member_qualifications.department_id
      and (
        m.id = member_qualifications.member_id
        or lower(coalesce(m.role, '')) = 'administrator'
      )
  )
);

drop policy if exists member_qualifications_insert_by_department_admin on public.member_qualifications;
create policy member_qualifications_insert_by_department_admin
on public.member_qualifications
for insert
with check (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = member_qualifications.department_id
      and lower(coalesce(m.role, '')) = 'administrator'
  )
  and exists (
    select 1
    from public.members target_member
    where target_member.id = member_qualifications.member_id
      and target_member.department_id = member_qualifications.department_id
  )
  and exists (
    select 1
    from public.qualifications q
    where q.id = member_qualifications.qualification_id
      and q.department_id = member_qualifications.department_id
  )
  and (
    member_qualifications.supporting_document_id is null
    or exists (
      select 1
      from public.documents d
      where d.id = member_qualifications.supporting_document_id
        and d.department_id = member_qualifications.department_id
    )
  )
);

drop policy if exists member_qualifications_update_by_department_admin on public.member_qualifications;
create policy member_qualifications_update_by_department_admin
on public.member_qualifications
for update
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = member_qualifications.department_id
      and lower(coalesce(m.role, '')) = 'administrator'
  )
)
with check (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = member_qualifications.department_id
      and lower(coalesce(m.role, '')) = 'administrator'
  )
  and exists (
    select 1
    from public.members target_member
    where target_member.id = member_qualifications.member_id
      and target_member.department_id = member_qualifications.department_id
  )
  and exists (
    select 1
    from public.qualifications q
    where q.id = member_qualifications.qualification_id
      and q.department_id = member_qualifications.department_id
  )
  and (
    member_qualifications.supporting_document_id is null
    or exists (
      select 1
      from public.documents d
      where d.id = member_qualifications.supporting_document_id
        and d.department_id = member_qualifications.department_id
    )
  )
);

drop policy if exists member_qualifications_delete_by_department_admin on public.member_qualifications;
create policy member_qualifications_delete_by_department_admin
on public.member_qualifications
for delete
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = member_qualifications.department_id
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

alter table public.role_required_qualifications enable row level security;

drop policy if exists role_required_qualifications_select_by_department on public.role_required_qualifications;
create policy role_required_qualifications_select_by_department
on public.role_required_qualifications
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists role_required_qualifications_insert_by_department_admin on public.role_required_qualifications;
create policy role_required_qualifications_insert_by_department_admin
on public.role_required_qualifications
for insert
with check (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and lower(coalesce(m.role, '')) = 'administrator'
  )
  and exists (
    select 1
    from public.department_roles dr
    where dr.id = department_role_id
      and dr.department_id = role_required_qualifications.department_id
  )
  and exists (
    select 1
    from public.qualifications q
    where q.id = qualification_id
      and q.department_id = role_required_qualifications.department_id
  )
);

drop policy if exists role_required_qualifications_update_by_department_admin on public.role_required_qualifications;
create policy role_required_qualifications_update_by_department_admin
on public.role_required_qualifications
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
  and exists (
    select 1
    from public.department_roles dr
    where dr.id = department_role_id
      and dr.department_id = role_required_qualifications.department_id
  )
  and exists (
    select 1
    from public.qualifications q
    where q.id = qualification_id
      and q.department_id = role_required_qualifications.department_id
  )
);

drop policy if exists role_required_qualifications_delete_by_department_admin on public.role_required_qualifications;
create policy role_required_qualifications_delete_by_department_admin
on public.role_required_qualifications
for delete
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);
