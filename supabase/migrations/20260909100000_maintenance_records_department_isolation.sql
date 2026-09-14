-- Add department_id tenant isolation to public.maintenance_records.
-- Previously this table had no department_id and RLS allowed every
-- authenticated user to select/insert/update every row (USING (true)).

alter table public.maintenance_records
  add column if not exists department_id uuid references public.departments (id) on delete cascade;

-- Backfill every existing record from its (required, not-null) apparatus relationship.
update public.maintenance_records mr
set department_id = a.department_id
from public.apparatus a
where mr.apparatus_id = a.id
  and mr.department_id is distinct from a.department_id;

alter table public.maintenance_records
  alter column department_id set not null;

create index if not exists maintenance_records_department_id_idx
on public.maintenance_records (department_id);

alter table public.maintenance_records enable row level security;

revoke all on table public.maintenance_records from public;
revoke all on table public.maintenance_records from anon;
grant select, insert, update, delete on table public.maintenance_records to authenticated;

drop policy if exists maintenance_records_select_all on public.maintenance_records;
drop policy if exists maintenance_records_insert_all on public.maintenance_records;
drop policy if exists maintenance_records_update_all on public.maintenance_records;

drop policy if exists maintenance_records_select_by_department on public.maintenance_records;
create policy maintenance_records_select_by_department
on public.maintenance_records
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists maintenance_records_insert_by_department on public.maintenance_records;
create policy maintenance_records_insert_by_department
on public.maintenance_records
for insert
with check (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists maintenance_records_update_by_department on public.maintenance_records;
create policy maintenance_records_update_by_department
on public.maintenance_records
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
