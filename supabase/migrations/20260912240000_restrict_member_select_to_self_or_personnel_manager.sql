-- Group 5: active members may read only their own member row unless their
-- trusted membership grants personnel-management capability.
drop policy if exists members_select_authenticated_active_department on public.members;

create policy members_select_authenticated_active_department
on public.members
for select
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = public.members.department_id
      and (
        audm.member_id = public.members.id
        or audm.can_manage_personnel = true
      )
  )
);