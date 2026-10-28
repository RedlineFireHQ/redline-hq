-- Pump-test attachments: private bucket plus a child table with one row per file.
-- Files are written and read only by server routes (service role) after the app checks the
-- caller's active department membership. No storage.objects policies are created for this
-- bucket on purpose: with row-level security on and no policy, browsers cannot list, read
-- or write these files directly.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pump-test-attachments',
  'pump-test-attachments',
  false,
  15728640,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

create table if not exists public.apparatus_pump_test_attachments (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  pump_test_id uuid not null references public.apparatus_pump_tests (id) on delete cascade,
  storage_path text not null unique,
  original_filename text not null,
  content_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 15728640),
  kind text not null check (kind in ('photo', 'document')),
  uploaded_by_member_id uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists apparatus_pump_test_attachments_pump_test_idx
  on public.apparatus_pump_test_attachments (pump_test_id);
create index if not exists apparatus_pump_test_attachments_department_idx
  on public.apparatus_pump_test_attachments (department_id);

-- An attachment must carry the same department as its pump test.
create or replace function public.enforce_pump_test_attachment_department()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.apparatus_pump_tests t
    where t.id = new.pump_test_id
      and t.department_id = new.department_id
  ) then
    raise exception 'Pump test attachment department does not match the pump test department.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_pump_test_attachment_department on public.apparatus_pump_test_attachments;
create trigger trg_enforce_pump_test_attachment_department
before insert or update on public.apparatus_pump_test_attachments
for each row
execute function public.enforce_pump_test_attachment_department();

alter table public.apparatus_pump_test_attachments enable row level security;

revoke all on table public.apparatus_pump_test_attachments from public;
revoke all on table public.apparatus_pump_test_attachments from anon;
revoke all on table public.apparatus_pump_test_attachments from authenticated;
grant select on table public.apparatus_pump_test_attachments to authenticated;

-- Read-only for active members of the same department. Inserts, updates and deletes have no
-- policy, so only the server (service role) can change attachment rows.
drop policy if exists apparatus_pump_test_attachments_select_by_department on public.apparatus_pump_test_attachments;
create policy apparatus_pump_test_attachments_select_by_department
on public.apparatus_pump_test_attachments
for select
to authenticated
using (
  exists (
    select 1
    from public.members m
    where m.department_id = apparatus_pump_test_attachments.department_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
  )
);
