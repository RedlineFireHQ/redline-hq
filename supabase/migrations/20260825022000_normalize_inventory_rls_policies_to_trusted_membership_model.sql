alter table public.assets enable row level security;
alter table public.batteries enable row level security;
alter table public.battery_assignments enable row level security;
alter table public.fire_hose enable row level security;
alter table public.fire_hose_testing_sessions enable row level security;
alter table public.fire_hose_testing_results enable row level security;
alter table public.scba_cylinders enable row level security;
alter table public.scba_packs enable row level security;
alter table public.scba_pack_flow_tests enable row level security;
alter table public.scba_pack_testing_sessions enable row level security;
alter table public.pie_equipment enable row level security;
alter table public.pie_equipment_assignments enable row level security;
alter table public.ground_ladders enable row level security;
alter table public.gas_monitors enable row level security;
alter table public.gas_monitor_assignments enable row level security;
alter table public.gas_monitor_calibration_settings enable row level security;
alter table public.gas_monitor_calibration_sessions enable row level security;
alter table public.gas_monitor_calibration_session_results enable row level security;
alter table public.gas_monitor_calibrations enable row level security;
alter table public.portable_radios enable row level security;
alter table public.portable_radio_mics enable row level security;
alter table public.portable_radio_assignments enable row level security;
alter table public.portable_radio_mic_assignments enable row level security;
alter table public.thermal_imaging_cameras enable row level security;
alter table public.thermal_imaging_camera_assignments enable row level security;

drop policy if exists assets_select_by_department on public.assets;
create policy assets_select_by_department
on public.assets
for select
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = assets.department_id
  )
);

drop policy if exists assets_insert_by_department on public.assets;
create policy assets_insert_by_department
on public.assets
for insert
to authenticated
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = assets.department_id
  )
);

drop policy if exists assets_update_by_department on public.assets;
create policy assets_update_by_department
on public.assets
for update
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = assets.department_id
  )
)
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = assets.department_id
  )
);

drop policy if exists assets_delete_by_department on public.assets;
create policy assets_delete_by_department
on public.assets
for delete
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    join public.members m on m.id = audm.member_id
    where audm.auth_user_id = auth.uid()
      and audm.department_id = assets.department_id
      and coalesce(m.active, false) = true
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

drop policy if exists batteries_select_by_department on public.batteries;
create policy batteries_select_by_department
on public.batteries
for select
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = batteries.department_id
  )
);

drop policy if exists batteries_insert_by_department on public.batteries;
create policy batteries_insert_by_department
on public.batteries
for insert
to authenticated
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = batteries.department_id
  )
);

drop policy if exists batteries_update_by_department on public.batteries;
create policy batteries_update_by_department
on public.batteries
for update
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = batteries.department_id
  )
)
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = batteries.department_id
  )
);

drop policy if exists batteries_delete_by_department on public.batteries;
create policy batteries_delete_by_department
on public.batteries
for delete
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    join public.members m on m.id = audm.member_id
    where audm.auth_user_id = auth.uid()
      and audm.department_id = batteries.department_id
      and coalesce(m.active, false) = true
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

drop policy if exists battery_assignments_select_by_department on public.battery_assignments;
create policy battery_assignments_select_by_department
on public.battery_assignments
for select
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = battery_assignments.department_id
  )
);

drop policy if exists battery_assignments_insert_by_department on public.battery_assignments;
create policy battery_assignments_insert_by_department
on public.battery_assignments
for insert
to authenticated
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = battery_assignments.department_id
  )
);

drop policy if exists battery_assignments_update_by_department on public.battery_assignments;
create policy battery_assignments_update_by_department
on public.battery_assignments
for update
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = battery_assignments.department_id
  )
)
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = battery_assignments.department_id
  )
);

drop policy if exists battery_assignments_delete_by_department on public.battery_assignments;
create policy battery_assignments_delete_by_department
on public.battery_assignments
for delete
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    join public.members m on m.id = audm.member_id
    where audm.auth_user_id = auth.uid()
      and audm.department_id = battery_assignments.department_id
      and coalesce(m.active, false) = true
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

drop policy if exists "Temporary Fire Hose Access" on public.fire_hose;
drop policy if exists fire_hose_select_by_department on public.fire_hose;
create policy fire_hose_select_by_department
on public.fire_hose
for select
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = fire_hose.department_id
  )
);

drop policy if exists fire_hose_insert_by_department on public.fire_hose;
create policy fire_hose_insert_by_department
on public.fire_hose
for insert
to authenticated
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = fire_hose.department_id
  )
);

drop policy if exists fire_hose_update_by_department on public.fire_hose;
create policy fire_hose_update_by_department
on public.fire_hose
for update
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = fire_hose.department_id
  )
)
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = fire_hose.department_id
  )
);

drop policy if exists fire_hose_delete_by_department on public.fire_hose;
create policy fire_hose_delete_by_department
on public.fire_hose
for delete
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    join public.members m on m.id = audm.member_id
    where audm.auth_user_id = auth.uid()
      and audm.department_id = fire_hose.department_id
      and coalesce(m.active, false) = true
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

drop policy if exists fire_hose_testing_sessions_select_by_department on public.fire_hose_testing_sessions;
create policy fire_hose_testing_sessions_select_by_department
on public.fire_hose_testing_sessions
for select
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = fire_hose_testing_sessions.department_id
  )
);

drop policy if exists fire_hose_testing_sessions_insert_by_department on public.fire_hose_testing_sessions;
create policy fire_hose_testing_sessions_insert_by_department
on public.fire_hose_testing_sessions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = fire_hose_testing_sessions.department_id
  )
);

drop policy if exists fire_hose_testing_results_select_by_department on public.fire_hose_testing_results;
create policy fire_hose_testing_results_select_by_department
on public.fire_hose_testing_results
for select
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = fire_hose_testing_results.department_id
  )
);

drop policy if exists fire_hose_testing_results_insert_by_department on public.fire_hose_testing_results;
create policy fire_hose_testing_results_insert_by_department
on public.fire_hose_testing_results
for insert
to authenticated
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = fire_hose_testing_results.department_id
  )
);

drop policy if exists scba_cylinders_select_by_department on public.scba_cylinders;
create policy scba_cylinders_select_by_department
on public.scba_cylinders
for select
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = scba_cylinders.department_id
  )
);

drop policy if exists scba_cylinders_insert_by_department on public.scba_cylinders;
create policy scba_cylinders_insert_by_department
on public.scba_cylinders
for insert
to authenticated
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = scba_cylinders.department_id
  )
);

drop policy if exists scba_cylinders_update_by_department on public.scba_cylinders;
create policy scba_cylinders_update_by_department
on public.scba_cylinders
for update
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = scba_cylinders.department_id
  )
)
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = scba_cylinders.department_id
  )
);

drop policy if exists scba_cylinders_delete_by_department on public.scba_cylinders;
create policy scba_cylinders_delete_by_department
on public.scba_cylinders
for delete
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    join public.members m on m.id = audm.member_id
    where audm.auth_user_id = auth.uid()
      and audm.department_id = scba_cylinders.department_id
      and coalesce(m.active, false) = true
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

drop policy if exists scba_packs_select_by_department on public.scba_packs;
create policy scba_packs_select_by_department
on public.scba_packs
for select
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = scba_packs.department_id
  )
);

drop policy if exists scba_packs_insert_by_department on public.scba_packs;
create policy scba_packs_insert_by_department
on public.scba_packs
for insert
to authenticated
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = scba_packs.department_id
  )
);

drop policy if exists scba_packs_update_by_department on public.scba_packs;
create policy scba_packs_update_by_department
on public.scba_packs
for update
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = scba_packs.department_id
  )
)
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = scba_packs.department_id
  )
);

drop policy if exists scba_packs_delete_by_department on public.scba_packs;
create policy scba_packs_delete_by_department
on public.scba_packs
for delete
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    join public.members m on m.id = audm.member_id
    where audm.auth_user_id = auth.uid()
      and audm.department_id = scba_packs.department_id
      and coalesce(m.active, false) = true
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

drop policy if exists scba_pack_flow_tests_select_by_department on public.scba_pack_flow_tests;
create policy scba_pack_flow_tests_select_by_department
on public.scba_pack_flow_tests
for select
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = scba_pack_flow_tests.department_id
  )
);

drop policy if exists scba_pack_flow_tests_insert_by_department on public.scba_pack_flow_tests;
create policy scba_pack_flow_tests_insert_by_department
on public.scba_pack_flow_tests
for insert
to authenticated
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = scba_pack_flow_tests.department_id
  )
);

drop policy if exists scba_pack_flow_tests_update_by_department on public.scba_pack_flow_tests;
create policy scba_pack_flow_tests_update_by_department
on public.scba_pack_flow_tests
for update
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = scba_pack_flow_tests.department_id
  )
)
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = scba_pack_flow_tests.department_id
  )
);

drop policy if exists scba_pack_flow_tests_delete_by_department on public.scba_pack_flow_tests;
create policy scba_pack_flow_tests_delete_by_department
on public.scba_pack_flow_tests
for delete
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    join public.members m on m.id = audm.member_id
    where audm.auth_user_id = auth.uid()
      and audm.department_id = scba_pack_flow_tests.department_id
      and coalesce(m.active, false) = true
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

drop policy if exists scba_pack_testing_sessions_select_by_department on public.scba_pack_testing_sessions;
create policy scba_pack_testing_sessions_select_by_department
on public.scba_pack_testing_sessions
for select
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = scba_pack_testing_sessions.department_id
  )
);

drop policy if exists scba_pack_testing_sessions_insert_by_department on public.scba_pack_testing_sessions;
create policy scba_pack_testing_sessions_insert_by_department
on public.scba_pack_testing_sessions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = scba_pack_testing_sessions.department_id
  )
);

drop policy if exists pie_equipment_select_by_department on public.pie_equipment;
create policy pie_equipment_select_by_department
on public.pie_equipment
for select
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = pie_equipment.department_id
  )
);

drop policy if exists pie_equipment_insert_by_department on public.pie_equipment;
create policy pie_equipment_insert_by_department
on public.pie_equipment
for insert
to authenticated
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = pie_equipment.department_id
  )
);

drop policy if exists pie_equipment_update_by_department on public.pie_equipment;
create policy pie_equipment_update_by_department
on public.pie_equipment
for update
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = pie_equipment.department_id
  )
)
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = pie_equipment.department_id
  )
);

drop policy if exists pie_equipment_delete_by_department on public.pie_equipment;
create policy pie_equipment_delete_by_department
on public.pie_equipment
for delete
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    join public.members m on m.id = audm.member_id
    where audm.auth_user_id = auth.uid()
      and audm.department_id = pie_equipment.department_id
      and coalesce(m.active, false) = true
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

drop policy if exists pie_equipment_assignments_select_by_department on public.pie_equipment_assignments;
create policy pie_equipment_assignments_select_by_department
on public.pie_equipment_assignments
for select
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = pie_equipment_assignments.department_id
  )
);

drop policy if exists pie_equipment_assignments_insert_by_department on public.pie_equipment_assignments;
create policy pie_equipment_assignments_insert_by_department
on public.pie_equipment_assignments
for insert
to authenticated
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = pie_equipment_assignments.department_id
  )
);

drop policy if exists pie_equipment_assignments_update_by_department on public.pie_equipment_assignments;
create policy pie_equipment_assignments_update_by_department
on public.pie_equipment_assignments
for update
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = pie_equipment_assignments.department_id
  )
)
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = pie_equipment_assignments.department_id
  )
);

drop policy if exists pie_equipment_assignments_delete_by_department on public.pie_equipment_assignments;
create policy pie_equipment_assignments_delete_by_department
on public.pie_equipment_assignments
for delete
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    join public.members m on m.id = audm.member_id
    where audm.auth_user_id = auth.uid()
      and audm.department_id = pie_equipment_assignments.department_id
      and coalesce(m.active, false) = true
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

drop policy if exists ground_ladders_select_by_department on public.ground_ladders;
create policy ground_ladders_select_by_department
on public.ground_ladders
for select
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = ground_ladders.department_id
  )
);

drop policy if exists ground_ladders_insert_by_department on public.ground_ladders;
create policy ground_ladders_insert_by_department
on public.ground_ladders
for insert
to authenticated
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = ground_ladders.department_id
  )
);

drop policy if exists ground_ladders_update_by_department on public.ground_ladders;
create policy ground_ladders_update_by_department
on public.ground_ladders
for update
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = ground_ladders.department_id
  )
)
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = ground_ladders.department_id
  )
);

drop policy if exists ground_ladders_delete_by_department on public.ground_ladders;
create policy ground_ladders_delete_by_department
on public.ground_ladders
for delete
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    join public.members m on m.id = audm.member_id
    where audm.auth_user_id = auth.uid()
      and audm.department_id = ground_ladders.department_id
      and coalesce(m.active, false) = true
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

drop policy if exists gas_monitors_select_by_department on public.gas_monitors;
create policy gas_monitors_select_by_department
on public.gas_monitors
for select
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = gas_monitors.department_id
  )
);

drop policy if exists gas_monitors_insert_by_department on public.gas_monitors;
create policy gas_monitors_insert_by_department
on public.gas_monitors
for insert
to authenticated
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = gas_monitors.department_id
  )
);

drop policy if exists gas_monitors_update_by_department on public.gas_monitors;
create policy gas_monitors_update_by_department
on public.gas_monitors
for update
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = gas_monitors.department_id
  )
)
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = gas_monitors.department_id
  )
);

drop policy if exists gas_monitors_delete_by_department on public.gas_monitors;
create policy gas_monitors_delete_by_department
on public.gas_monitors
for delete
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    join public.members m on m.id = audm.member_id
    where audm.auth_user_id = auth.uid()
      and audm.department_id = gas_monitors.department_id
      and coalesce(m.active, false) = true
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

drop policy if exists gas_monitor_assignments_select_by_department on public.gas_monitor_assignments;
create policy gas_monitor_assignments_select_by_department
on public.gas_monitor_assignments
for select
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = gas_monitor_assignments.department_id
  )
);

drop policy if exists gas_monitor_assignments_insert_by_department on public.gas_monitor_assignments;
create policy gas_monitor_assignments_insert_by_department
on public.gas_monitor_assignments
for insert
to authenticated
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = gas_monitor_assignments.department_id
  )
);

drop policy if exists gas_monitor_assignments_update_by_department on public.gas_monitor_assignments;
create policy gas_monitor_assignments_update_by_department
on public.gas_monitor_assignments
for update
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = gas_monitor_assignments.department_id
  )
)
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = gas_monitor_assignments.department_id
  )
);

drop policy if exists gas_monitor_assignments_delete_by_department on public.gas_monitor_assignments;
create policy gas_monitor_assignments_delete_by_department
on public.gas_monitor_assignments
for delete
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    join public.members m on m.id = audm.member_id
    where audm.auth_user_id = auth.uid()
      and audm.department_id = gas_monitor_assignments.department_id
      and coalesce(m.active, false) = true
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

drop policy if exists gas_monitor_calibration_settings_select_by_department on public.gas_monitor_calibration_settings;
create policy gas_monitor_calibration_settings_select_by_department
on public.gas_monitor_calibration_settings
for select
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = gas_monitor_calibration_settings.department_id
  )
);

drop policy if exists gas_monitor_calibration_settings_insert_by_department on public.gas_monitor_calibration_settings;
create policy gas_monitor_calibration_settings_insert_by_department
on public.gas_monitor_calibration_settings
for insert
to authenticated
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = gas_monitor_calibration_settings.department_id
  )
);

drop policy if exists gas_monitor_calibration_settings_update_by_department on public.gas_monitor_calibration_settings;
create policy gas_monitor_calibration_settings_update_by_department
on public.gas_monitor_calibration_settings
for update
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = gas_monitor_calibration_settings.department_id
  )
)
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = gas_monitor_calibration_settings.department_id
  )
);

drop policy if exists gas_monitor_calibration_settings_delete_by_department on public.gas_monitor_calibration_settings;
create policy gas_monitor_calibration_settings_delete_by_department
on public.gas_monitor_calibration_settings
for delete
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    join public.members m on m.id = audm.member_id
    where audm.auth_user_id = auth.uid()
      and audm.department_id = gas_monitor_calibration_settings.department_id
      and coalesce(m.active, false) = true
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

drop policy if exists gas_monitor_calibration_sessions_select_by_department on public.gas_monitor_calibration_sessions;
create policy gas_monitor_calibration_sessions_select_by_department
on public.gas_monitor_calibration_sessions
for select
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = gas_monitor_calibration_sessions.department_id
  )
);

drop policy if exists gas_monitor_calibration_sessions_insert_by_department on public.gas_monitor_calibration_sessions;
create policy gas_monitor_calibration_sessions_insert_by_department
on public.gas_monitor_calibration_sessions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = gas_monitor_calibration_sessions.department_id
  )
);

drop policy if exists gas_monitor_calibration_sessions_update_by_department on public.gas_monitor_calibration_sessions;
create policy gas_monitor_calibration_sessions_update_by_department
on public.gas_monitor_calibration_sessions
for update
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = gas_monitor_calibration_sessions.department_id
  )
)
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = gas_monitor_calibration_sessions.department_id
  )
);

drop policy if exists gas_monitor_calibration_sessions_delete_by_department on public.gas_monitor_calibration_sessions;
create policy gas_monitor_calibration_sessions_delete_by_department
on public.gas_monitor_calibration_sessions
for delete
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    join public.members m on m.id = audm.member_id
    where audm.auth_user_id = auth.uid()
      and audm.department_id = gas_monitor_calibration_sessions.department_id
      and coalesce(m.active, false) = true
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

drop policy if exists gas_monitor_calibration_session_results_select_by_department on public.gas_monitor_calibration_session_results;
create policy gas_monitor_calibration_session_results_select_by_department
on public.gas_monitor_calibration_session_results
for select
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = gas_monitor_calibration_session_results.department_id
  )
);

drop policy if exists gas_monitor_calibration_session_results_insert_by_department on public.gas_monitor_calibration_session_results;
create policy gas_monitor_calibration_session_results_insert_by_department
on public.gas_monitor_calibration_session_results
for insert
to authenticated
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = gas_monitor_calibration_session_results.department_id
  )
);

drop policy if exists gas_monitor_calibration_session_results_update_by_department on public.gas_monitor_calibration_session_results;
create policy gas_monitor_calibration_session_results_update_by_department
on public.gas_monitor_calibration_session_results
for update
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = gas_monitor_calibration_session_results.department_id
  )
)
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = gas_monitor_calibration_session_results.department_id
  )
);

drop policy if exists gas_monitor_calibration_session_results_delete_by_department on public.gas_monitor_calibration_session_results;
create policy gas_monitor_calibration_session_results_delete_by_department
on public.gas_monitor_calibration_session_results
for delete
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    join public.members m on m.id = audm.member_id
    where audm.auth_user_id = auth.uid()
      and audm.department_id = gas_monitor_calibration_session_results.department_id
      and coalesce(m.active, false) = true
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

drop policy if exists gas_monitor_calibrations_select_by_department on public.gas_monitor_calibrations;
create policy gas_monitor_calibrations_select_by_department
on public.gas_monitor_calibrations
for select
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = gas_monitor_calibrations.department_id
  )
);

drop policy if exists gas_monitor_calibrations_insert_by_department on public.gas_monitor_calibrations;
create policy gas_monitor_calibrations_insert_by_department
on public.gas_monitor_calibrations
for insert
to authenticated
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = gas_monitor_calibrations.department_id
  )
);

drop policy if exists gas_monitor_calibrations_update_by_department on public.gas_monitor_calibrations;
create policy gas_monitor_calibrations_update_by_department
on public.gas_monitor_calibrations
for update
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = gas_monitor_calibrations.department_id
  )
)
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = gas_monitor_calibrations.department_id
  )
);

drop policy if exists gas_monitor_calibrations_delete_by_department on public.gas_monitor_calibrations;
create policy gas_monitor_calibrations_delete_by_department
on public.gas_monitor_calibrations
for delete
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    join public.members m on m.id = audm.member_id
    where audm.auth_user_id = auth.uid()
      and audm.department_id = gas_monitor_calibrations.department_id
      and coalesce(m.active, false) = true
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

drop policy if exists portable_radios_select_by_department on public.portable_radios;
create policy portable_radios_select_by_department
on public.portable_radios
for select
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = portable_radios.department_id
  )
);

drop policy if exists portable_radios_insert_by_department on public.portable_radios;
create policy portable_radios_insert_by_department
on public.portable_radios
for insert
to authenticated
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = portable_radios.department_id
  )
);

drop policy if exists portable_radios_update_by_department on public.portable_radios;
create policy portable_radios_update_by_department
on public.portable_radios
for update
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = portable_radios.department_id
  )
)
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = portable_radios.department_id
  )
);

drop policy if exists portable_radios_delete_by_department on public.portable_radios;
create policy portable_radios_delete_by_department
on public.portable_radios
for delete
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    join public.members m on m.id = audm.member_id
    where audm.auth_user_id = auth.uid()
      and audm.department_id = portable_radios.department_id
      and coalesce(m.active, false) = true
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

drop policy if exists portable_radio_mics_select_by_department on public.portable_radio_mics;
create policy portable_radio_mics_select_by_department
on public.portable_radio_mics
for select
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = portable_radio_mics.department_id
  )
);

drop policy if exists portable_radio_mics_insert_by_department on public.portable_radio_mics;
create policy portable_radio_mics_insert_by_department
on public.portable_radio_mics
for insert
to authenticated
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = portable_radio_mics.department_id
  )
);

drop policy if exists portable_radio_mics_update_by_department on public.portable_radio_mics;
create policy portable_radio_mics_update_by_department
on public.portable_radio_mics
for update
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = portable_radio_mics.department_id
  )
)
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = portable_radio_mics.department_id
  )
);

drop policy if exists portable_radio_mics_delete_by_department on public.portable_radio_mics;
create policy portable_radio_mics_delete_by_department
on public.portable_radio_mics
for delete
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    join public.members m on m.id = audm.member_id
    where audm.auth_user_id = auth.uid()
      and audm.department_id = portable_radio_mics.department_id
      and coalesce(m.active, false) = true
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

drop policy if exists portable_radio_assignments_select_by_department on public.portable_radio_assignments;
create policy portable_radio_assignments_select_by_department
on public.portable_radio_assignments
for select
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = portable_radio_assignments.department_id
  )
);

drop policy if exists portable_radio_assignments_insert_by_department on public.portable_radio_assignments;
create policy portable_radio_assignments_insert_by_department
on public.portable_radio_assignments
for insert
to authenticated
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = portable_radio_assignments.department_id
  )
);

drop policy if exists portable_radio_assignments_update_by_department on public.portable_radio_assignments;
create policy portable_radio_assignments_update_by_department
on public.portable_radio_assignments
for update
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = portable_radio_assignments.department_id
  )
)
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = portable_radio_assignments.department_id
  )
);

drop policy if exists portable_radio_assignments_delete_by_department on public.portable_radio_assignments;
create policy portable_radio_assignments_delete_by_department
on public.portable_radio_assignments
for delete
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    join public.members m on m.id = audm.member_id
    where audm.auth_user_id = auth.uid()
      and audm.department_id = portable_radio_assignments.department_id
      and coalesce(m.active, false) = true
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

drop policy if exists portable_radio_mic_assignments_select_by_department on public.portable_radio_mic_assignments;
create policy portable_radio_mic_assignments_select_by_department
on public.portable_radio_mic_assignments
for select
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = portable_radio_mic_assignments.department_id
  )
);

drop policy if exists portable_radio_mic_assignments_insert_by_department on public.portable_radio_mic_assignments;
create policy portable_radio_mic_assignments_insert_by_department
on public.portable_radio_mic_assignments
for insert
to authenticated
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = portable_radio_mic_assignments.department_id
  )
);

drop policy if exists portable_radio_mic_assignments_update_by_department on public.portable_radio_mic_assignments;
create policy portable_radio_mic_assignments_update_by_department
on public.portable_radio_mic_assignments
for update
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = portable_radio_mic_assignments.department_id
  )
)
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = portable_radio_mic_assignments.department_id
  )
);

drop policy if exists portable_radio_mic_assignments_delete_by_department on public.portable_radio_mic_assignments;
create policy portable_radio_mic_assignments_delete_by_department
on public.portable_radio_mic_assignments
for delete
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    join public.members m on m.id = audm.member_id
    where audm.auth_user_id = auth.uid()
      and audm.department_id = portable_radio_mic_assignments.department_id
      and coalesce(m.active, false) = true
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

drop policy if exists thermal_imaging_cameras_select_by_department on public.thermal_imaging_cameras;
create policy thermal_imaging_cameras_select_by_department
on public.thermal_imaging_cameras
for select
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = thermal_imaging_cameras.department_id
  )
);

drop policy if exists thermal_imaging_cameras_insert_by_department on public.thermal_imaging_cameras;
create policy thermal_imaging_cameras_insert_by_department
on public.thermal_imaging_cameras
for insert
to authenticated
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = thermal_imaging_cameras.department_id
  )
);

drop policy if exists thermal_imaging_cameras_update_by_department on public.thermal_imaging_cameras;
create policy thermal_imaging_cameras_update_by_department
on public.thermal_imaging_cameras
for update
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = thermal_imaging_cameras.department_id
  )
)
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = thermal_imaging_cameras.department_id
  )
);

drop policy if exists thermal_imaging_cameras_delete_by_department on public.thermal_imaging_cameras;
create policy thermal_imaging_cameras_delete_by_department
on public.thermal_imaging_cameras
for delete
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    join public.members m on m.id = audm.member_id
    where audm.auth_user_id = auth.uid()
      and audm.department_id = thermal_imaging_cameras.department_id
      and coalesce(m.active, false) = true
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

drop policy if exists thermal_imaging_camera_assignments_select_by_department on public.thermal_imaging_camera_assignments;
create policy thermal_imaging_camera_assignments_select_by_department
on public.thermal_imaging_camera_assignments
for select
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = thermal_imaging_camera_assignments.department_id
  )
);

drop policy if exists thermal_imaging_camera_assignments_insert_by_department on public.thermal_imaging_camera_assignments;
create policy thermal_imaging_camera_assignments_insert_by_department
on public.thermal_imaging_camera_assignments
for insert
to authenticated
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = thermal_imaging_camera_assignments.department_id
  )
);

drop policy if exists thermal_imaging_camera_assignments_update_by_department on public.thermal_imaging_camera_assignments;
create policy thermal_imaging_camera_assignments_update_by_department
on public.thermal_imaging_camera_assignments
for update
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = thermal_imaging_camera_assignments.department_id
  )
)
with check (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = thermal_imaging_camera_assignments.department_id
  )
);

drop policy if exists thermal_imaging_camera_assignments_delete_by_department on public.thermal_imaging_camera_assignments;
create policy thermal_imaging_camera_assignments_delete_by_department
on public.thermal_imaging_camera_assignments
for delete
to authenticated
using (
  exists (
    select 1
    from public.auth_user_department_memberships audm
    join public.members m on m.id = audm.member_id
    where audm.auth_user_id = auth.uid()
      and audm.department_id = thermal_imaging_camera_assignments.department_id
      and coalesce(m.active, false) = true
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);