alter table public.fire_extinguishers enable row level security;

drop policy if exists fire_extinguishers_select_by_department on public.fire_extinguishers;
drop policy if exists fire_extinguishers_write_by_department_admin on public.fire_extinguishers;
drop policy if exists fire_extinguishers_select_by_department_member on public.fire_extinguishers;
drop policy if exists fire_extinguishers_insert_by_department_member on public.fire_extinguishers;
drop policy if exists fire_extinguishers_update_by_department_member on public.fire_extinguishers;
drop policy if exists fire_extinguishers_delete_by_department_member on public.fire_extinguishers;

create policy fire_extinguishers_select_by_department_member
on public.fire_extinguishers
for select
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = fire_extinguishers.department_id
  )
);

create policy fire_extinguishers_insert_by_department_member
on public.fire_extinguishers
for insert
to authenticated
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = fire_extinguishers.department_id
  )
);

create policy fire_extinguishers_update_by_department_member
on public.fire_extinguishers
for update
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = fire_extinguishers.department_id
  )
)
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = fire_extinguishers.department_id
  )
);

create policy fire_extinguishers_delete_by_department_member
on public.fire_extinguishers
for delete
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = fire_extinguishers.department_id
  )
);
