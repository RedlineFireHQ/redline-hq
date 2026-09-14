-- Group 5: personnel-management read access only.
-- No INSERT, UPDATE, or DELETE policy is changed here.

drop policy if exists member_certifications_select_self_or_admin on public.member_certifications;
create policy member_certifications_select_self_or_admin
on public.member_certifications
for select
using (
  exists (
    select 1
    from public.members m
    where ((m.auth_user_id = auth.uid()) or (lower(m.email) = lower(coalesce(auth.email(), ''))))
      and m.department_id = member_certifications.department_id
      and (
        m.id = member_certifications.member_id
        or lower(coalesce(m.role, '')) = 'administrator'
      )
  )
  or exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = member_certifications.department_id
      and audm.can_manage_personnel = true
  )
);

drop policy if exists member_qualifications_select_self_or_admin on public.member_qualifications;
create policy member_qualifications_select_self_or_admin
on public.member_qualifications
for select
using (
  exists (
    select 1
    from public.members m
    where ((m.auth_user_id = auth.uid()) or (lower(m.email) = lower(coalesce(auth.email(), ''))))
      and m.department_id = member_qualifications.department_id
      and (
        m.id = member_qualifications.member_id
        or lower(coalesce(m.role, '')) = 'administrator'
      )
  )
  or exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = member_qualifications.department_id
      and audm.can_manage_personnel = true
  )
);

drop policy if exists ems_member_track_profiles_select_self_or_role on public.ems_member_track_profiles;
create policy ems_member_track_profiles_select_self_or_role
on public.ems_member_track_profiles
for select
using (
  exists (
    select 1
    from public.members m
    where ((m.auth_user_id = auth.uid()) or (lower(m.email) = lower(coalesce(auth.email(), ''))))
      and m.department_id = ems_member_track_profiles.department_id
      and (
        m.id = ems_member_track_profiles.member_id
        or lower(coalesce(m.role, '')) in ('administrator', 'officer')
      )
  )
  or exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = ems_member_track_profiles.department_id
      and audm.can_manage_personnel = true
  )
);

drop policy if exists training_assignment_members_select_self_or_permission on public.training_assignment_members;
create policy training_assignment_members_select_self_or_permission
on public.training_assignment_members
for select
using (
  exists (
    select 1
    from public.members m
    where ((m.auth_user_id = auth.uid()) or (lower(m.email) = lower(coalesce(auth.email(), ''))))
      and m.department_id = training_assignment_members.department_id
      and (
        m.id = training_assignment_members.member_id
        or public.member_has_app_permission(training_assignment_members.department_id, 'training_management')
        or public.member_has_app_permission(training_assignment_members.department_id, 'homework_assignment')
        or public.member_has_app_permission(training_assignment_members.department_id, 'training_review')
      )
  )
  or exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = training_assignment_members.department_id
      and audm.can_manage_personnel = true
  )
);

drop policy if exists training_outside_submissions_select_self_or_permission on public.training_outside_submissions;
create policy training_outside_submissions_select_self_or_permission
on public.training_outside_submissions
for select
using (
  exists (
    select 1
    from public.members m
    where lower(m.email) = lower(coalesce(auth.email(), ''))
      and m.department_id = training_outside_submissions.department_id
      and (
        m.id = training_outside_submissions.member_id
        or public.member_has_app_permission(training_outside_submissions.department_id, 'training_management')
        or public.member_has_app_permission(training_outside_submissions.department_id, 'training_review')
      )
  )
  or exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = training_outside_submissions.department_id
      and audm.can_manage_personnel = true
  )
);

drop policy if exists deficiencies_select_by_department_member on public.deficiencies;
create policy deficiencies_select_by_department_member
on public.deficiencies
for select to authenticated
using (
  public.can_view_deficiency_row(
    apparatus_id,
    fire_hose_id,
    scba_cylinder_id,
    scba_pack_id,
    pie_equipment_id,
    ems_equipment_id,
    ppe_item_id,
    rope_item_id,
    fire_extinguisher_id,
    misc_fire_equipment_id,
    gas_monitor_id,
    battery_id,
    thermal_imaging_camera_id,
    ground_ladder_id,
    reported_by
  )
  or exists (
    select 1
    from public.auth_user_department_memberships audm
    where audm.auth_user_id = auth.uid()
      and audm.department_id = deficiencies.department_id
      and audm.can_manage_personnel = true
  )
);