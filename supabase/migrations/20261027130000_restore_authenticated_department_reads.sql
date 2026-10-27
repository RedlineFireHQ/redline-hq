-- Restore the authenticated read privileges and RLS state expected by the app.
-- Policies remain the authorization boundary; no write privileges are granted.

alter table public.departments enable row level security;
alter table public.members enable row level security;
alter table public.apparatus_inspections enable row level security;
alter table public.deficiency_statuses enable row level security;
alter table public.deficiency_priorities enable row level security;

drop policy if exists deficiency_statuses_select_for_member_department
  on public.deficiency_statuses;
create policy deficiency_statuses_select_for_member_department
on public.deficiency_statuses
for select
to authenticated
using (
  exists (
    select 1
    from public.deficiencies d
    join public.auth_user_department_memberships audm
      on audm.department_id = d.department_id
     and audm.auth_user_id = auth.uid()
    where d.status = deficiency_statuses.id
  )
);

drop policy if exists deficiency_priorities_select_for_member_department
  on public.deficiency_priorities;
create policy deficiency_priorities_select_for_member_department
on public.deficiency_priorities
for select
to authenticated
using (
  exists (
    select 1
    from public.deficiencies d
    join public.auth_user_department_memberships audm
      on audm.department_id = d.department_id
     and audm.auth_user_id = auth.uid()
    where d.priority = deficiency_priorities.id
  )
);

grant select on table
  public.departments,
  public.members,
  public.apparatus,
  public.auth_user_department_memberships,
  public.apparatus_inspections,
  public.apparatus_check_requirements,
  public.apparatus_check_department_defaults,
  public.apparatus_inspection_checklist_items,
  public.apparatus_inspection_checklist_progress,
  public.apparatus_inspection_checklist_results,
  public.apparatus_maintenance_requirements,
  public.apparatus_maintenance_requirement_methods,
  public.apparatus_equipment_requirements,
  public.department_bay_schedules,
  public.deficiencies,
  public.deficiency_statuses,
  public.deficiency_priorities,
  public.maintenance_records,
  public.training_categories,
  public.training_requirements,
  public.training_events,
  public.training_event_attendance,
  public.training_outside_submissions,
  public.training_assignments,
  public.training_assignment_members,
  public.certifications,
  public.member_certifications,
  public.ems_member_track_profiles,
  public.department_roles,
  public.qualifications,
  public.member_qualifications,
  public.role_required_qualifications,
  public.role_required_certifications,
  public.batteries,
  public.ems_equipment,
  public.ems_supply_items,
  public.fire_extinguishers,
  public.fire_hose,
  public.gas_monitors,
  public.ground_ladders,
  public.misc_fire_equipment,
  public.pagers,
  public.pie_equipment,
  public.portable_radios,
  public.ppe_items,
  public.rope_items,
  public.scba_cylinders,
  public.scba_packs,
  public.thermal_imaging_cameras
to authenticated;