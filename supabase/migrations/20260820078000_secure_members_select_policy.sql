drop policy if exists "Enable read access for all users" on public.members;

create policy members_select_authenticated_active_department
on public.members
for select
to authenticated
using (
  exists (
    select 1
    from public.resolve_authenticated_member_context(null::uuid) ctx
    where ctx.status = 'ok'
      and ctx.department_id = public.members.department_id
  )
);