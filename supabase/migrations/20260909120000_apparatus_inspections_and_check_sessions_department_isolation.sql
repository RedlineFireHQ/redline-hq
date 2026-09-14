-- Fixes for Demo Department Blocker #2 (single-department / RLS isolation audit).
--
-- 1) apparatus_inspections had RLS enabled but only two leftover
--    "during development" policies with `USING (true)` / `WITH CHECK (true)`.
--    Any authenticated user (of any department) could read or insert rows in
--    this table directly via the Supabase REST API, regardless of the
--    department-scoped SECURITY DEFINER RPC (save_apparatus_inspection) the
--    app actually uses. This is a genuine cross-department data exposure and
--    is replaced with the same member/department-scoping pattern already
--    used on the sibling `apparatus` table.
--
-- 2) apparatus_check_sessions INSERT/UPDATE policies only verified that the
--    session's member_id belonged to the requesting user; they never
--    verified that the session's department_id matched that member's own
--    department. The application's only write path (get_or_create_apparatus_check_session /
--    complete_apparatus_check RPCs) already derives department_id from the
--    apparatus row and validates it, but a direct REST call could otherwise
--    write a session row tagged with an arbitrary department_id. This
--    tightens the existing self-scoped policies to also require the
--    session's department_id to match the member's own department_id.

drop policy if exists "Allow inserts during development" on public.apparatus_inspections;
drop policy if exists "Allow reads during development" on public.apparatus_inspections;

drop policy if exists apparatus_inspections_select_by_department on public.apparatus_inspections;
create policy apparatus_inspections_select_by_department
on public.apparatus_inspections
for select
using (
  exists (
    select 1
    from public.members m
    where m.department_id = apparatus_inspections.department_id
      and (
        m.auth_user_id = auth.uid()
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
  )
);

drop policy if exists apparatus_inspections_insert_by_department on public.apparatus_inspections;
create policy apparatus_inspections_insert_by_department
on public.apparatus_inspections
for insert
with check (
  exists (
    select 1
    from public.members m
    where m.department_id = apparatus_inspections.department_id
      and (
        m.auth_user_id = auth.uid()
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
  )
);

drop policy if exists apparatus_check_sessions_insert_self on public.apparatus_check_sessions;
create policy apparatus_check_sessions_insert_self
on public.apparatus_check_sessions
for insert
with check (
  exists (
    select 1
    from public.members m
    where m.id = apparatus_check_sessions.member_id
      and m.department_id = apparatus_check_sessions.department_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or (lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), '')))
      )
  )
);

drop policy if exists apparatus_check_sessions_update_self on public.apparatus_check_sessions;
create policy apparatus_check_sessions_update_self
on public.apparatus_check_sessions
for update
using (
  exists (
    select 1
    from public.members m
    where m.id = apparatus_check_sessions.member_id
      and m.department_id = apparatus_check_sessions.department_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or (lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), '')))
      )
  )
)
with check (
  exists (
    select 1
    from public.members m
    where m.id = apparatus_check_sessions.member_id
      and m.department_id = apparatus_check_sessions.department_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or (lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), '')))
      )
  )
);
