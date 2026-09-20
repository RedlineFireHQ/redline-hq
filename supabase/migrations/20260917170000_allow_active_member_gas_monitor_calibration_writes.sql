drop policy if exists gas_monitor_calibrations_insert_special_permission
on public.gas_monitor_calibrations;
drop policy if exists gas_monitor_calibrations_update_special_permission
on public.gas_monitor_calibrations;

create policy gas_monitor_calibrations_insert_active_member
on public.gas_monitor_calibrations
for insert to authenticated
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    join public.members actor on actor.id = audm.member_id
    where audm.auth_user_id = auth.uid()
      and audm.department_id = gas_monitor_calibrations.department_id
      and actor.department_id = gas_monitor_calibrations.department_id
      and coalesce(actor.active, false) = true
  )
  and exists (
    select 1 from public.gas_monitors monitor
    where monitor.id = gas_monitor_calibrations.gas_monitor_id
      and monitor.department_id = gas_monitor_calibrations.department_id
  )
  and (gas_monitor_calibrations.tester_member_id is null or exists (
    select 1 from public.members tester
    where tester.id = gas_monitor_calibrations.tester_member_id
      and tester.department_id = gas_monitor_calibrations.department_id
  ))
  and (gas_monitor_calibrations.created_by is null or exists (
    select 1 from public.members creator
    where creator.id = gas_monitor_calibrations.created_by
      and creator.department_id = gas_monitor_calibrations.department_id
  ))
);

create policy gas_monitor_calibrations_update_active_member
on public.gas_monitor_calibrations
for update to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    join public.members actor on actor.id = audm.member_id
    where audm.auth_user_id = auth.uid()
      and audm.department_id = gas_monitor_calibrations.department_id
      and actor.department_id = gas_monitor_calibrations.department_id
      and coalesce(actor.active, false) = true
  )
)
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    join public.members actor on actor.id = audm.member_id
    where audm.auth_user_id = auth.uid()
      and audm.department_id = gas_monitor_calibrations.department_id
      and actor.department_id = gas_monitor_calibrations.department_id
      and coalesce(actor.active, false) = true
  )
  and exists (
    select 1 from public.gas_monitors monitor
    where monitor.id = gas_monitor_calibrations.gas_monitor_id
      and monitor.department_id = gas_monitor_calibrations.department_id
  )
  and (gas_monitor_calibrations.tester_member_id is null or exists (
    select 1 from public.members tester
    where tester.id = gas_monitor_calibrations.tester_member_id
      and tester.department_id = gas_monitor_calibrations.department_id
  ))
  and (gas_monitor_calibrations.created_by is null or exists (
    select 1 from public.members creator
    where creator.id = gas_monitor_calibrations.created_by
      and creator.department_id = gas_monitor_calibrations.department_id
  ))
);

drop policy if exists gas_monitor_calibration_sessions_insert_special_permission
on public.gas_monitor_calibration_sessions;
drop policy if exists gas_monitor_calibration_sessions_update_special_permission
on public.gas_monitor_calibration_sessions;

create policy gas_monitor_calibration_sessions_insert_active_member
on public.gas_monitor_calibration_sessions
for insert to authenticated
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    join public.members actor on actor.id = audm.member_id
    where audm.auth_user_id = auth.uid()
      and audm.department_id = gas_monitor_calibration_sessions.department_id
      and actor.department_id = gas_monitor_calibration_sessions.department_id
      and coalesce(actor.active, false) = true
  )
  and (gas_monitor_calibration_sessions.tester_member_id is null or exists (
    select 1 from public.members tester
    where tester.id = gas_monitor_calibration_sessions.tester_member_id
      and tester.department_id = gas_monitor_calibration_sessions.department_id
  ))
  and (gas_monitor_calibration_sessions.created_by is null or exists (
    select 1 from public.members creator
    where creator.id = gas_monitor_calibration_sessions.created_by
      and creator.department_id = gas_monitor_calibration_sessions.department_id
  ))
);

create policy gas_monitor_calibration_sessions_update_active_member
on public.gas_monitor_calibration_sessions
for update to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    join public.members actor on actor.id = audm.member_id
    where audm.auth_user_id = auth.uid()
      and audm.department_id = gas_monitor_calibration_sessions.department_id
      and actor.department_id = gas_monitor_calibration_sessions.department_id
      and coalesce(actor.active, false) = true
  )
)
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    join public.members actor on actor.id = audm.member_id
    where audm.auth_user_id = auth.uid()
      and audm.department_id = gas_monitor_calibration_sessions.department_id
      and actor.department_id = gas_monitor_calibration_sessions.department_id
      and coalesce(actor.active, false) = true
  )
  and (gas_monitor_calibration_sessions.tester_member_id is null or exists (
    select 1 from public.members tester
    where tester.id = gas_monitor_calibration_sessions.tester_member_id
      and tester.department_id = gas_monitor_calibration_sessions.department_id
  ))
  and (gas_monitor_calibration_sessions.created_by is null or exists (
    select 1 from public.members creator
    where creator.id = gas_monitor_calibration_sessions.created_by
      and creator.department_id = gas_monitor_calibration_sessions.department_id
  ))
);

drop policy if exists gas_monitor_calibration_session_results_insert_special_permission
on public.gas_monitor_calibration_session_results;
drop policy if exists gas_monitor_calibration_session_results_update_special_permission
on public.gas_monitor_calibration_session_results;

create policy gas_monitor_calibration_session_results_insert_active_member
on public.gas_monitor_calibration_session_results
for insert to authenticated
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    join public.members actor on actor.id = audm.member_id
    where audm.auth_user_id = auth.uid()
      and audm.department_id = gas_monitor_calibration_session_results.department_id
      and actor.department_id = gas_monitor_calibration_session_results.department_id
      and coalesce(actor.active, false) = true
  )
  and exists (
    select 1 from public.gas_monitor_calibration_sessions session
    where session.id = gas_monitor_calibration_session_results.calibration_session_id
      and session.department_id = gas_monitor_calibration_session_results.department_id
  )
  and exists (
    select 1 from public.gas_monitors monitor
    where monitor.id = gas_monitor_calibration_session_results.gas_monitor_id
      and monitor.department_id = gas_monitor_calibration_session_results.department_id
  )
  and (gas_monitor_calibration_session_results.tester_member_id is null or exists (
    select 1 from public.members tester
    where tester.id = gas_monitor_calibration_session_results.tester_member_id
      and tester.department_id = gas_monitor_calibration_session_results.department_id
  ))
  and (gas_monitor_calibration_session_results.created_by is null or exists (
    select 1 from public.members creator
    where creator.id = gas_monitor_calibration_session_results.created_by
      and creator.department_id = gas_monitor_calibration_session_results.department_id
  ))
);

create policy gas_monitor_calibration_session_results_update_active_member
on public.gas_monitor_calibration_session_results
for update to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    join public.members actor on actor.id = audm.member_id
    where audm.auth_user_id = auth.uid()
      and audm.department_id = gas_monitor_calibration_session_results.department_id
      and actor.department_id = gas_monitor_calibration_session_results.department_id
      and coalesce(actor.active, false) = true
  )
)
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    join public.members actor on actor.id = audm.member_id
    where audm.auth_user_id = auth.uid()
      and audm.department_id = gas_monitor_calibration_session_results.department_id
      and actor.department_id = gas_monitor_calibration_session_results.department_id
      and coalesce(actor.active, false) = true
  )
  and exists (
    select 1 from public.gas_monitor_calibration_sessions session
    where session.id = gas_monitor_calibration_session_results.calibration_session_id
      and session.department_id = gas_monitor_calibration_session_results.department_id
  )
  and exists (
    select 1 from public.gas_monitors monitor
    where monitor.id = gas_monitor_calibration_session_results.gas_monitor_id
      and monitor.department_id = gas_monitor_calibration_session_results.department_id
  )
  and (gas_monitor_calibration_session_results.tester_member_id is null or exists (
    select 1 from public.members tester
    where tester.id = gas_monitor_calibration_session_results.tester_member_id
      and tester.department_id = gas_monitor_calibration_session_results.department_id
  ))
  and (gas_monitor_calibration_session_results.created_by is null or exists (
    select 1 from public.members creator
    where creator.id = gas_monitor_calibration_session_results.created_by
      and creator.department_id = gas_monitor_calibration_session_results.department_id
  ))
);