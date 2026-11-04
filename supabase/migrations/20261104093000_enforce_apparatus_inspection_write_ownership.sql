-- Add ownership restrictions without rewriting history or granting new writes.
do $migration$
begin
  if not exists (
    select 1 from pg_class
    where oid = 'public.apparatus_inspections'::regclass and relrowsecurity
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'apparatus_inspections'
      and policyname = 'apparatus_inspections_insert_by_department' and cmd = 'INSERT'
  ) then
    raise exception 'Expected apparatus inspection INSERT authorization is missing; review before changing.';
  end if;
  if to_regprocedure('public.can_write_apparatus_inspection(uuid,uuid)') is not null
    or to_regprocedure('public.validate_apparatus_inspection_department()') is not null
    or exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'apparatus_inspections'
        and policyname in (
          'apparatus_inspections_insert_actual_department',
          'apparatus_inspections_update_actual_department'
        )
    ) or exists (
      select 1 from pg_trigger
      where tgrelid = 'public.apparatus_inspections'::regclass
        and tgname = 'trg_validate_apparatus_inspection_department'
    ) then
    raise exception 'Inspection ownership safeguards already exist; review rather than overwrite.';
  end if;
create function public.can_write_apparatus_inspection(p_apparatus_id uuid, p_department_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $function$
  select auth.uid() is not null and exists (
    select 1
    from public.apparatus a
    join public.members m on m.department_id = a.department_id
    where a.id = p_apparatus_id
      and a.department_id = p_department_id
      and coalesce(m.active, false) = true
      and (
        m.auth_user_id = auth.uid()
        or (
          m.auth_user_id is null
          and lower(nullif(btrim(m.email), '')) = (
            select lower(nullif(btrim(u.email), ''))
            from auth.users u where u.id = auth.uid() and u.deleted_at is null
          )
        )
      )
  );
$function$;
revoke all on function public.can_write_apparatus_inspection(uuid,uuid) from public, anon, authenticated, service_role;
grant execute on function public.can_write_apparatus_inspection(uuid,uuid) to anon, authenticated, service_role;

-- Restrictive policies AND with existing permissive authorization; UPDATE
-- remains denied unless an existing, separately approved permissive policy allows it.
create policy apparatus_inspections_insert_actual_department
on public.apparatus_inspections as restrictive for insert to public
with check (public.can_write_apparatus_inspection(apparatus_id, department_id));

create policy apparatus_inspections_update_actual_department
on public.apparatus_inspections as restrictive for update to public
using (public.can_write_apparatus_inspection(apparatus_id, department_id))
with check (public.can_write_apparatus_inspection(apparatus_id, department_id));

create function public.validate_apparatus_inspection_department()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
declare
  v_department_id uuid;
begin
  select a.department_id into v_department_id
  from public.apparatus a where a.id = new.apparatus_id for share;
  if v_department_id is null or new.department_id is distinct from v_department_id then
    raise exception using
      errcode = '42501',
      message = 'Forbidden: inspection department must match the apparatus owner department.';
  end if;
  return new;
end;
$function$;
revoke all on function public.validate_apparatus_inspection_department() from public, anon, authenticated, service_role;

-- Also enforce consistency inside SECURITY DEFINER RPCs, which bypass RLS.
create trigger trg_validate_apparatus_inspection_department
before insert or update on public.apparatus_inspections
for each row execute function public.validate_apparatus_inspection_department();
end;
$migration$;
