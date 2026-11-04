-- Explicit-context overloads leave existing RPC signatures and callers unchanged.
create or replace function public.resolve_requesting_member_access_context(p_department_id uuid)
returns table(member_id uuid, department_id uuid, role text, special_permissions_enabled boolean)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.id, m.department_id, lower(coalesce(m.role, '')),
    coalesce(m.special_permissions_enabled, false)
  from public.members m
  where m.department_id = p_department_id
    and coalesce(m.active, false) = true
    and (
      (auth.uid() is not null and m.auth_user_id = auth.uid())
      or (auth.uid() is null and lower(m.email) = lower(coalesce(auth.email(), '')))
    )
  order by case when auth.uid() is not null and m.auth_user_id = auth.uid() then 0 else 1 end, m.id
  limit 1;
$$;

revoke all on function public.resolve_requesting_member_access_context(uuid) from public, anon;
grant execute on function public.resolve_requesting_member_access_context(uuid) to authenticated;

-- Clone the installed secured logic, changing only its department resolver.
-- Fail closed if a prerequisite has drifted rather than silently replacing it.
do $migration$
declare
  signature text;
  definition text;
  parameter_suffix text;
  new_signature text;
begin
  foreach signature in array array[
    'public.create_department_member(text,text,text,text,text,boolean,boolean,text[],date,date)',
    'public.update_department_member(uuid,text,text,text,text,text,boolean,boolean,text[],date,date)',
    'public.update_department_member_role(uuid,uuid)'
  ] loop
    if to_regprocedure(signature) is null then
      raise exception 'Required member RPC is missing: %', signature;
    end if;
    definition := pg_get_functiondef(to_regprocedure(signature));
    parameter_suffix := case when signature like '%update_department_member_role%'
      then 'p_department_role_id uuid)' else 'p_inactive_date date)' end;
    if strpos(definition, parameter_suffix) = 0
      or (length(definition) - length(replace(definition,
        'public.resolve_requesting_member_access_context()', '')))
        / length('public.resolve_requesting_member_access_context()') <> 1
      or strpos(definition, 'public.can_manage_personnel(v_department_id)') = 0
      or strpos(definition, 'SECURITY DEFINER') = 0 then
      raise exception 'Member RPC definition has drifted; review before cloning: %', signature;
    end if;
    definition := replace(definition, parameter_suffix,
      replace(parameter_suffix, ')', ', p_department_id uuid)'));
    definition := replace(definition, 'public.resolve_requesting_member_access_context()',
      'public.resolve_requesting_member_access_context(p_department_id)');
    execute definition;
    new_signature := regexp_replace(signature, '\)$', ',uuid)');
    execute 'revoke all on function ' || new_signature || ' from public, anon';
    execute 'grant execute on function ' || new_signature || ' to authenticated';
  end loop;
end;
$migration$;

alter table public.members
  add column if not exists onboarding_request_id uuid,
  add column if not exists onboarding_request_fingerprint text;

create unique index if not exists members_department_onboarding_request_unique
  on public.members(department_id, onboarding_request_id)
  where onboarding_request_id is not null;

create or replace function public.create_department_member_with_role(
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_rank text,
  p_active boolean,
  p_special_permissions_enabled boolean,
  p_permission_keys text[],
  p_hire_start_date date,
  p_inactive_date date,
  p_department_role_id uuid,
  p_department_id uuid,
  p_request_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_department_id uuid;
  v_requester_member_id uuid;
  v_member_id uuid;
  v_fingerprint text;
  v_existing_fingerprint text;
begin
  select ctx.member_id, ctx.department_id into v_requester_member_id, v_department_id
  from public.resolve_requesting_member_access_context(p_department_id) ctx
  limit 1;

  if v_requester_member_id is null or v_department_id is null then
    raise exception 'Unauthorized: requester membership not found.';
  end if;
  if not public.can_manage_personnel(v_department_id) then
    raise exception 'Forbidden: personnel management permission is required.';
  end if;

  if p_request_id is null then
    raise exception 'An internal submission identifier is required. Reopen Add Member.';
  end if;
  v_fingerprint := encode(sha256(convert_to(jsonb_build_array(
    v_requester_member_id, btrim(p_first_name), btrim(p_last_name),
    nullif(btrim(coalesce(p_email, '')), ''), nullif(btrim(coalesce(p_phone, '')), ''),
    nullif(btrim(coalesce(p_rank, '')), ''), coalesce(p_active, true),
    coalesce(p_special_permissions_enabled, false),
    array(select distinct btrim(value) from unnest(coalesce(p_permission_keys, '{}'::text[])) value
      where btrim(value) <> '' order by btrim(value)),
    p_hire_start_date, p_inactive_date, p_department_role_id
  )::text, 'UTF8')), 'hex');
  perform pg_advisory_xact_lock(hashtextextended(
    'member-onboarding:' || v_department_id::text || ':' || p_request_id::text, 0));
  select m.id, m.onboarding_request_fingerprint
    into v_member_id, v_existing_fingerprint
  from public.members m
  where m.department_id = v_department_id and m.onboarding_request_id = p_request_id;
  if found then
    if v_existing_fingerprint is distinct from v_fingerprint then
      raise exception 'This submission was already saved with different information. No changes were made. Review the original profile or start a new Add Member submission.';
    end if;
    return v_member_id;
  end if;

  if p_department_role_id is not null then
    perform 1 from public.department_roles dr
    where dr.id = p_department_role_id and dr.department_id = v_department_id
      and dr.active = true
    for share;
    if not found then
      raise exception 'Validation error: select an active Department Role from your department.';
    end if;
  end if;

  v_member_id := public.create_department_member(
    p_first_name, p_last_name, p_email, p_phone, p_rank, p_active,
    p_special_permissions_enabled, p_permission_keys, p_hire_start_date, p_inactive_date,
    v_department_id
  );
  perform public.update_department_member_role(v_member_id, p_department_role_id, v_department_id);

  if not exists (
    select 1 from public.members m
    where m.id = v_member_id and m.department_id = v_department_id
      and m.department_role_id is not distinct from p_department_role_id
  ) then
    raise exception 'Department Role assignment did not affect the new member.';
  end if;

  update public.members
  set onboarding_request_id = p_request_id, onboarding_request_fingerprint = v_fingerprint
  where id = v_member_id and department_id = v_department_id;

  return v_member_id;
end;
$$;

revoke all on function public.create_department_member_with_role(text,text,text,text,text,boolean,boolean,text[],date,date,uuid,uuid,uuid) from public, anon;
grant execute on function public.create_department_member_with_role(text,text,text,text,text,boolean,boolean,text[],date,date,uuid,uuid,uuid) to authenticated;
