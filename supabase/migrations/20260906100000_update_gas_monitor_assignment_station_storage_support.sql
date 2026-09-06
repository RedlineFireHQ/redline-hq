alter table public.gas_monitor_assignments
  drop constraint if exists gas_monitor_assignments_assignment_type_check,
  drop constraint if exists gas_monitor_assignments_check;

alter table public.gas_monitor_assignments
  add constraint gas_monitor_assignments_assignment_type_check
    check (assignment_type in ('Member', 'Apparatus', 'Station Storage', 'Unassigned')) not valid,
  add constraint gas_monitor_assignments_check
    check (
      (assignment_type = 'Member' and member_id is not null and apparatus_id is null)
      or (assignment_type = 'Apparatus' and apparatus_id is not null and member_id is null)
      or (assignment_type = 'Station Storage' and member_id is null and apparatus_id is null)
      or (assignment_type = 'Unassigned' and member_id is null and apparatus_id is null)
    ) not valid;
