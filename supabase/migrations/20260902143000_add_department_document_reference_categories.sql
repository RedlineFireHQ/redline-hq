create table if not exists public.document_reference_categories (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text,
  status text not null default 'active' check (status in ('active', 'archived')),
  is_default boolean not null default false,
  created_by uuid references public.members (id) on delete set null,
  updated_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists document_reference_categories_department_slug_idx
on public.document_reference_categories (department_id, slug);

create unique index if not exists document_reference_categories_department_name_idx
on public.document_reference_categories (department_id, lower(btrim(name)));

create unique index if not exists document_reference_categories_single_default_idx
on public.document_reference_categories (department_id)
where is_default = true;

create unique index if not exists document_reference_categories_department_id_id_uidx
on public.document_reference_categories (department_id, id);

create index if not exists document_reference_categories_department_status_idx
on public.document_reference_categories (department_id, status);

create or replace function public.set_document_reference_categories_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_document_reference_categories_updated_at on public.document_reference_categories;
create trigger trg_document_reference_categories_updated_at
before update on public.document_reference_categories
for each row
execute function public.set_document_reference_categories_updated_at();

alter table public.document_reference_categories enable row level security;

drop policy if exists document_reference_categories_select_by_department on public.document_reference_categories;
create policy document_reference_categories_select_by_department
on public.document_reference_categories
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists document_reference_categories_insert_by_department on public.document_reference_categories;
create policy document_reference_categories_insert_by_department
on public.document_reference_categories
for insert
with check (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists document_reference_categories_update_by_department on public.document_reference_categories;
create policy document_reference_categories_update_by_department
on public.document_reference_categories
for update
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
)
with check (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists document_reference_categories_delete_by_department on public.document_reference_categories;
create policy document_reference_categories_delete_by_department
on public.document_reference_categories
for delete
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

alter table public.documents
  add column if not exists reference_category_id uuid,
  add column if not exists source_kind text not null default 'library';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'documents_source_kind_check'
      and conrelid = 'public.documents'::regclass
  ) then
    alter table public.documents
      add constraint documents_source_kind_check
      check (source_kind in ('library', 'pre_plan', 'personnel_qualification', 'training'));
  end if;
end $$;

create index if not exists documents_source_kind_idx
on public.documents (source_kind);

create index if not exists documents_reference_category_idx
on public.documents (reference_category_id);

alter table public.documents
  drop constraint if exists documents_reference_category_department_fkey;

alter table public.documents
  add constraint documents_reference_category_department_fkey
  foreign key (department_id, reference_category_id)
  references public.document_reference_categories (department_id, id)
  on delete set null;

insert into public.document_reference_categories (
  department_id,
  name,
  slug,
  description,
  status,
  is_default
)
select
  d.id,
  'Miscellaneous Documents',
  'miscellaneous-documents',
  'Catch-all reference category for department documents without a more specific folder.',
  'active',
  true
from public.departments d
where not exists (
  select 1
  from public.document_reference_categories existing
  where existing.department_id = d.id
    and existing.is_default = true
);

update public.documents d
set source_kind = 'personnel_qualification'
where d.category = 'Department Documents'
  and exists (
    select 1
    from public.member_qualifications mq
    where mq.supporting_document_id = d.id
  );

update public.documents d
set source_kind = 'training'
where d.category = 'Department Documents'
  and exists (
    select 1
    from public.training_assignments ta
    where ta.supporting_document_id = d.id
  );

update public.documents d
set source_kind = 'training'
where d.category = 'Department Documents'
  and exists (
    select 1
    from public.training_events te
    where te.supporting_document_id = d.id
  );

update public.documents d
set source_kind = 'pre_plan'
where d.category = 'Department Documents'
  and exists (
    select 1
    from public.document_revisions dr
    where dr.document_id = d.id
      and dr.file_path like d.department_id::text || '/pre-plans/%'
  );

update public.documents d
set reference_category_id = default_category.id
from public.document_reference_categories default_category
where d.category = 'Department Documents'
  and d.source_kind = 'library'
  and d.reference_category_id is null
  and default_category.department_id = d.department_id
  and default_category.is_default = true;