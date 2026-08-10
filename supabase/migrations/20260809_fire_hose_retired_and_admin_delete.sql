do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'fire_hose_status_check'
      and conrelid = 'public.fire_hose'::regclass
  ) then
    alter table public.fire_hose
      drop constraint fire_hose_status_check;
  end if;
end;
$$;

alter table public.fire_hose
  add constraint fire_hose_status_check
  check (status in ('Ready', 'Testing Due', 'Out of Service', 'Retired'));

drop policy if exists fire_hose_delete_by_department on public.fire_hose;
create policy fire_hose_delete_by_department
on public.fire_hose
for delete
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = fire_hose.department_id
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);
