create or replace function public.save_scba_mask_fit_session(p_department_id uuid, p_session_id uuid, p_name text, p_test_date date, p_tester_name text, p_results jsonb)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_member_id uuid;
  v_existing public.scba_mask_fit_sessions%rowtype;
  v_row jsonb;
  v_ids uuid[] := '{}';
  v_id uuid;
  v_count integer;
begin
  if auth.uid() is null or public.can_manage_personnel(p_department_id) is not true then
    raise exception 'Not authorized to manage personnel' using errcode = '42501';
  end if;
  select id into v_member_id from public.members
    where department_id = p_department_id and auth_user_id = auth.uid()
      and coalesce(active, false) order by id limit 1;
  if v_member_id is null then
    raise exception 'Active department membership required' using errcode = '42501';
  end if;
  if p_session_id is null or p_test_date is null or p_test_date > (now() at time zone 'America/Chicago')::date
    or nullif(btrim(p_name), '') is null or nullif(btrim(p_tester_name), '') is null
    or jsonb_typeof(p_results) is distinct from 'array' or jsonb_array_length(p_results) = 0 then
    raise exception 'A valid session, test date, tester, and at least one result are required';
  end if;
  for v_row in select value from jsonb_array_elements(p_results) loop
    v_id := (v_row->>'member_id')::uuid;
    if v_id is null or v_id = any(v_ids)
      or coalesce(v_row->>'result', '') not in ('Pass', 'Fail')
      or coalesce(v_row->>'mask_size', '') not in ('S', 'M', 'L') then
      raise exception 'Invalid or duplicate member result';
    end if;
    if not exists (select 1 from public.members where id = v_id and department_id = p_department_id) then
      raise exception 'Member does not belong to this department';
    end if;
    v_ids := array_append(v_ids, v_id);
  end loop;

  insert into public.scba_mask_fit_sessions (id, department_id, name, test_date, tester_name, created_by)
  values (p_session_id, p_department_id, btrim(p_name), p_test_date, btrim(p_tester_name), v_member_id)
  on conflict (id) do nothing;
  get diagnostics v_count = row_count;
  if v_count = 0 then
    select * into v_existing from public.scba_mask_fit_sessions where id = p_session_id for update;
    if v_existing.department_id <> p_department_id or v_existing.created_by <> v_member_id
      or v_existing.name <> btrim(p_name) or v_existing.test_date <> p_test_date
      or v_existing.tester_name <> btrim(p_tester_name)
      or (select count(*) from public.scba_mask_fit_results where session_id = p_session_id) <> cardinality(v_ids)
      or exists (
        select 1 from jsonb_array_elements(p_results) item
        where not exists (
          select 1 from public.scba_mask_fit_results r
          where r.session_id = p_session_id and r.member_id = (item->>'member_id')::uuid
            and r.result = item->>'result' and r.mask_size = item->>'mask_size'
        )
      ) then
      raise exception 'Session identifier already exists with different data';
    end if;
    return p_session_id;
  end if;
  insert into public.scba_mask_fit_results (department_id, session_id, member_id, result, mask_size)
    select p_department_id, p_session_id, (item->>'member_id')::uuid, item->>'result', item->>'mask_size'
    from jsonb_array_elements(p_results) item;
  return p_session_id;
end;
$function$;

create or replace function public.search_scba_mask_fit_history(
  p_department_id uuid, p_member_id uuid default null, p_personnel text default '',
  p_session text default '', p_from date default null, p_to date default null,
  p_result text default null, p_offset integer default 0, p_limit integer default 25,
  p_session_id uuid default null
)
returns table(result_id uuid, member_id uuid, member_name text, session_id uuid, session_name text,
  test_date date, tester_name text, result text, mask_size text, total_count bigint)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_can_manage boolean := public.can_manage_personnel(p_department_id) is true;
begin
  return query
  select r.id, r.member_id, concat_ws(' ', m.first_name, m.last_name), s.id, s.name,
    s.test_date, s.tester_name, r.result, r.mask_size, count(*) over ()
  from public.scba_mask_fit_results r
  join public.scba_mask_fit_sessions s on s.id = r.session_id and s.department_id = r.department_id
  join public.members m on m.id = r.member_id and m.department_id = r.department_id
  where r.department_id = p_department_id
    and v_user_id is not null
    and (v_can_manage or (m.auth_user_id = v_user_id and coalesce(m.active, false)))
    and (p_member_id is null or r.member_id = p_member_id)
    and (p_session_id is null or s.id = p_session_id)
    and (nullif(btrim(p_personnel), '') is null or concat_ws(' ', m.first_name, m.last_name) ilike '%' || p_personnel || '%')
    and (nullif(btrim(p_session), '') is null or s.name ilike '%' || p_session || '%')
    and (p_from is null or s.test_date >= p_from)
    and (p_to is null or s.test_date <= p_to)
    and (p_result is null or r.result = p_result)
  order by s.test_date desc, s.created_at desc, r.id desc
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(greatest(coalesce(p_limit, 25), 1), 500);
end;
$function$;

revoke all on function public.save_scba_mask_fit_session(uuid,uuid,text,date,text,jsonb) from public, anon;
revoke all on function public.search_scba_mask_fit_history(uuid,uuid,text,text,date,date,text,integer,integer,uuid) from public, anon;
grant execute on function public.save_scba_mask_fit_session(uuid,uuid,text,date,text,jsonb) to authenticated, service_role;
grant execute on function public.search_scba_mask_fit_history(uuid,uuid,text,text,date,date,text,integer,integer,uuid) to authenticated, service_role;
