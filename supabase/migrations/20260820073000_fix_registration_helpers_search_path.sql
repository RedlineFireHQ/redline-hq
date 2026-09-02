create or replace function public.resolve_department_registration_code(
  p_registration_code text
)
returns table (
  department_id uuid,
  department_name text,
  code_version integer
)
language plpgsql
security definer
stable
set search_path = public, extensions, pg_temp
as $$
declare
  v_hash text;
begin
  if btrim(coalesce(p_registration_code, '')) = '' then
    return;
  end if;

  v_hash := encode(extensions.digest(lower(btrim(p_registration_code)), 'sha256'), 'hex');

  return query
    select
      drc.department_id,
      d.name as department_name,
      drc.code_version
    from public.department_registration_codes drc
    join public.departments d on d.id = drc.department_id
    where drc.code_hash = v_hash
    limit 1;
end;
$$;

revoke all on function public.resolve_department_registration_code(text) from public;
revoke all on function public.resolve_department_registration_code(text) from anon;
grant execute on function public.resolve_department_registration_code(text) to authenticated;

create or replace function public.regenerate_department_registration_code(
  p_department_id uuid
)
returns table (
  registration_code text,
  code_version integer
)
language plpgsql
security definer
volatile
set search_path = public, extensions, pg_temp
as $$
declare
  v_requester_member_id uuid;
  v_department_name text;
  v_next_version integer;
  v_code text;
begin
  select ctx.member_id
  into v_requester_member_id
  from public.resolve_requesting_member_access_context() ctx
  where ctx.department_id = p_department_id
  limit 1;

  if v_requester_member_id is null then
    raise exception 'Unauthorized: requester membership not found.';
  end if;

  if not exists (
    select 1
    from public.members m
    where m.id = v_requester_member_id
      and m.department_id = p_department_id
      and lower(coalesce(m.role, '')) = 'administrator'
  ) then
    raise exception 'Forbidden: administrator access is required to regenerate the department registration code.';
  end if;

  select d.name
  into v_department_name
  from public.departments d
  where d.id = p_department_id;

  if v_department_name is null then
    raise exception 'Validation error: department not found.';
  end if;

  select coalesce(drc.code_version, 0) + 1
  into v_next_version
  from public.department_registration_codes drc
  where drc.department_id = p_department_id;

  v_code := public.build_department_registration_code(v_department_name);

  insert into public.department_registration_codes (
    department_id,
    code_hash,
    code_version,
    code_last4,
    generated_at,
    generated_by
  )
  values (
    p_department_id,
    encode(extensions.digest(lower(v_code), 'sha256'), 'hex'),
    coalesce(v_next_version, 1),
    right(v_code, 4),
    now(),
    v_requester_member_id
  )
  on conflict (department_id) do update
  set code_hash = excluded.code_hash,
      code_version = excluded.code_version,
      code_last4 = excluded.code_last4,
      generated_at = excluded.generated_at,
      generated_by = excluded.generated_by;

  return query
    select v_code::text as registration_code, coalesce(v_next_version, 1) as code_version;
end;
$$;

revoke all on function public.regenerate_department_registration_code(uuid) from public;
revoke all on function public.regenerate_department_registration_code(uuid) from anon;
grant execute on function public.regenerate_department_registration_code(uuid) to authenticated;
