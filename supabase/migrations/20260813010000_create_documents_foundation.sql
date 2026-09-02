create extension if not exists pgcrypto;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  category text not null check (
    category in (
      'SOPs',
      'EMS Protocols',
      'City / Department Policies',
      'Mutual Aid Agreements',
      'Department Documents'
    )
  ),
  title text not null check (btrim(title) <> ''),
  description text,
  document_number text,
  effective_date date,
  status text not null default 'Active' check (status in ('Active', 'Archived')),
  uploaded_by uuid references public.members (id) on delete set null,
  current_revision_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists documents_department_document_number_idx
on public.documents (department_id, document_number)
where document_number is not null and btrim(document_number) <> '';

create index if not exists documents_department_idx
on public.documents (department_id);

create index if not exists documents_category_idx
on public.documents (category);

create index if not exists documents_status_idx
on public.documents (status);

create index if not exists documents_effective_date_idx
on public.documents (effective_date);

create index if not exists documents_title_search_idx
on public.documents using gin (
  to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(document_number, ''))
);

create or replace function public.set_documents_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_documents_updated_at on public.documents;
create trigger trg_documents_updated_at
before update on public.documents
for each row
execute function public.set_documents_updated_at();

alter table public.documents enable row level security;

drop policy if exists documents_select_by_department on public.documents;
create policy documents_select_by_department
on public.documents
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists documents_insert_by_department on public.documents;
create policy documents_insert_by_department
on public.documents
for insert
with check (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists documents_update_by_department on public.documents;
create policy documents_update_by_department
on public.documents
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

drop policy if exists documents_delete_by_department on public.documents;
create policy documents_delete_by_department
on public.documents
for delete
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

create table if not exists public.document_revisions (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  revision_number integer not null check (revision_number > 0),
  file_name text not null check (btrim(file_name) <> ''),
  file_path text not null check (btrim(file_path) <> ''),
  file_size_bytes bigint not null check (file_size_bytes >= 0),
  mime_type text,
  uploaded_by uuid references public.members (id) on delete set null,
  effective_date date,
  revision_date date not null default current_date,
  notes text,
  status text not null default 'Active' check (status in ('Active', 'Archived')),
  content_text text,
  search_vector tsvector generated always as (
    to_tsvector(
      'english',
      coalesce(file_name, '') || ' ' ||
      coalesce(notes, '') || ' ' ||
      coalesce(content_text, '')
    )
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id, revision_number)
);

create index if not exists document_revisions_department_idx
on public.document_revisions (department_id);

create index if not exists document_revisions_document_idx
on public.document_revisions (document_id);

create index if not exists document_revisions_revision_date_idx
on public.document_revisions (revision_date);

create index if not exists document_revisions_status_idx
on public.document_revisions (status);

create index if not exists document_revisions_search_idx
on public.document_revisions using gin (search_vector);

create or replace function public.set_document_revisions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_document_revisions_updated_at on public.document_revisions;
create trigger trg_document_revisions_updated_at
before update on public.document_revisions
for each row
execute function public.set_document_revisions_updated_at();

alter table public.document_revisions enable row level security;

drop policy if exists document_revisions_select_by_department on public.document_revisions;
create policy document_revisions_select_by_department
on public.document_revisions
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists document_revisions_insert_by_department on public.document_revisions;
create policy document_revisions_insert_by_department
on public.document_revisions
for insert
with check (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists document_revisions_update_by_department on public.document_revisions;
create policy document_revisions_update_by_department
on public.document_revisions
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

drop policy if exists document_revisions_delete_by_department on public.document_revisions;
create policy document_revisions_delete_by_department
on public.document_revisions
for delete
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

alter table public.documents
  add column if not exists current_revision_id uuid references public.document_revisions (id) on delete set null;

create index if not exists documents_current_revision_idx
on public.documents (current_revision_id);

insert into storage.buckets (id, name, public, type)
values ('department-documents', 'department-documents', false, 'STANDARD')
on conflict (id) do nothing;

drop policy if exists department_documents_select on storage.objects;
create policy department_documents_select
on storage.objects
for select
using (
  bucket_id = 'department-documents'
  and split_part(name, '/', 1) = (
    select m.department_id::text
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
    limit 1
  )
);

drop policy if exists department_documents_insert on storage.objects;
create policy department_documents_insert
on storage.objects
for insert
with check (
  bucket_id = 'department-documents'
  and split_part(name, '/', 1) = (
    select m.department_id::text
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
    limit 1
  )
);

drop policy if exists department_documents_update on storage.objects;
create policy department_documents_update
on storage.objects
for update
using (
  bucket_id = 'department-documents'
  and split_part(name, '/', 1) = (
    select m.department_id::text
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
    limit 1
  )
)
with check (
  bucket_id = 'department-documents'
  and split_part(name, '/', 1) = (
    select m.department_id::text
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
    limit 1
  )
);

drop policy if exists department_documents_delete on storage.objects;
create policy department_documents_delete
on storage.objects
for delete
using (
  bucket_id = 'department-documents'
  and split_part(name, '/', 1) = (
    select m.department_id::text
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
    limit 1
  )
);
