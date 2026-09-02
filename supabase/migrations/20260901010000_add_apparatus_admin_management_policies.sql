alter table public.apparatus enable row level security;

drop policy if exists apparatus_select_by_department on public.apparatus;
create policy apparatus_select_by_department
on public.apparatus
for select
using (
  department_id in (
    select m.department_id
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
  )
);

drop policy if exists apparatus_insert_by_admin on public.apparatus;
create policy apparatus_insert_by_admin
on public.apparatus
for insert
with check (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = apparatus.department_id
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

drop policy if exists apparatus_update_by_admin on public.apparatus;
create policy apparatus_update_by_admin
on public.apparatus
for update
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = apparatus.department_id
      and lower(coalesce(m.role, '')) = 'administrator'
  )
)
with check (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = apparatus.department_id
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

revoke all on table public.apparatus from public;
revoke all on table public.apparatus from anon;
grant select, insert, update on table public.apparatus to authenticated;
