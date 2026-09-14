create or replace function public.maintenance_record_parent_integrity(
  p_department_id uuid,
  p_apparatus_id uuid,
  p_deficiency_id uuid,
  p_completed_by uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.apparatus a
    where a.id = p_apparatus_id
      and a.department_id = p_department_id
  )
  and (
    p_deficiency_id is null
    or exists (
      select 1 from public.deficiencies d
      where d.id = p_deficiency_id
        and d.department_id = p_department_id
    )
  )
  and (
    p_completed_by is null
    or exists (
      select 1 from public.members m
      where m.id = p_completed_by
        and m.department_id = p_department_id
    )
  );
$$;

comment on function public.maintenance_record_parent_integrity(uuid, uuid, uuid, uuid) is
  'Verifies Maintenance apparatus, optional deficiency, and optional completed-by member all belong to the submitted department under a trusted server-side lookup.';

revoke all on function public.maintenance_record_parent_integrity(uuid, uuid, uuid, uuid) from public;
revoke all on function public.maintenance_record_parent_integrity(uuid, uuid, uuid, uuid) from anon;
grant execute on function public.maintenance_record_parent_integrity(uuid, uuid, uuid, uuid) to authenticated;

drop policy if exists maintenance_records_insert_by_permission on public.maintenance_records;
create policy maintenance_records_insert_by_permission
on public.maintenance_records for insert to authenticated
with check (
  public.member_has_app_permission(department_id, 'maintenance_management')
  and public.maintenance_record_parent_integrity(department_id, apparatus_id, deficiency_id, completed_by)
);

drop policy if exists maintenance_records_update_by_permission on public.maintenance_records;
create policy maintenance_records_update_by_permission
on public.maintenance_records for update to authenticated
using (public.member_has_app_permission(department_id, 'maintenance_management'))
with check (
  public.member_has_app_permission(department_id, 'maintenance_management')
  and public.maintenance_record_parent_integrity(department_id, apparatus_id, deficiency_id, completed_by)
);