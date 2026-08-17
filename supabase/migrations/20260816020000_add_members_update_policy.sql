drop policy if exists members_update_by_department_admin on public.members;

create policy members_update_by_department_admin
on public.members
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
