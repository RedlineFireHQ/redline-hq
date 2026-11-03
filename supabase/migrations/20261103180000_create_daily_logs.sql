begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id),
  entry_date date,
  entry_time time without time zone,
  location text,
  activity text,
  unit text,
  created_by uuid not null references public.members(id),
  created_at timestamptz not null default clock_timestamp(),
  edited_by uuid references public.members(id),
  edited_at timestamptz,
  archived_by uuid references public.members(id),
  archived_at timestamptz,
  check ((edited_by is null) = (edited_at is null)),
  check ((archived_by is null) = (archived_at is null))
);
create index daily_logs_department_history_idx
  on public.daily_logs(department_id, entry_date desc nulls last, entry_time desc nulls last, created_at desc, id desc)
  where archived_at is null;
alter table public.daily_logs enable row level security;
revoke all on public.daily_logs from public, anon, authenticated, service_role;
grant select on public.daily_logs to authenticated;

create function public.daily_log_actor(p_department_id uuid)
returns table(member_id uuid, is_admin boolean)
language sql stable security definer set search_path = public, pg_temp as $$
  select m.id, lower(btrim(m.role)) = 'administrator'
  from public.members m
  where m.department_id = p_department_id and m.active = true
    and auth.uid() is not null and m.auth_user_id = auth.uid()
  order by m.id limit 1;
$$;
revoke all on function public.daily_log_actor(uuid) from public, anon, authenticated, service_role;
grant execute on function public.daily_log_actor(uuid) to authenticated;

create policy daily_logs_department_read on public.daily_logs for select to authenticated
using (archived_at is null and exists(select 1 from public.daily_log_actor(department_id)));

-- Only these authenticated RPCs can write; clients cannot forge audit metadata.
create function public.save_daily_log(
  p_department_id uuid, p_id uuid, p_entry_date date, p_entry_time time,
  p_location text, p_activity text, p_unit text, p_expected_version timestamptz
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_actor record;
  v_id uuid;
begin
  select * into v_actor from public.daily_log_actor(p_department_id);
  if not found then raise exception 'Active department membership is required.' using errcode = '42501'; end if;
  if p_id is null then
    insert into public.daily_logs(department_id, entry_date, entry_time, location, activity, unit, created_by)
    values(p_department_id, p_entry_date, p_entry_time, p_location, p_activity, p_unit, v_actor.member_id)
    returning id into v_id;
  else
    update public.daily_logs
    set entry_date = p_entry_date, entry_time = p_entry_time, location = p_location,
        activity = p_activity, unit = p_unit, edited_by = v_actor.member_id, edited_at = clock_timestamp()
    where id = p_id and department_id = p_department_id and archived_at is null
      and (created_by = v_actor.member_id or v_actor.is_admin)
      and coalesce(edited_at, created_at) = p_expected_version
    returning id into v_id;
    if not found then
      raise exception 'Entry unavailable, editing is not permitted, or it changed. Reload before trying again.'
        using errcode = '42501';
    end if;
  end if;
  return v_id;
end;
$$;

create function public.archive_daily_log(p_department_id uuid, p_id uuid, p_expected_version timestamptz)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor record;
begin
  select * into v_actor from public.daily_log_actor(p_department_id);
  if not found or v_actor.is_admin is not true then
    raise exception 'A department Administrator is required to archive entries.' using errcode = '42501';
  end if;
  update public.daily_logs set archived_by = v_actor.member_id, archived_at = clock_timestamp()
  where id = p_id and department_id = p_department_id and archived_at is null
    and coalesce(edited_at, created_at) = p_expected_version;
  if not found then
    raise exception 'Entry unavailable or changed. Reload before trying again.' using errcode = '42501';
  end if;
end;
$$;

create function public.search_daily_logs(p_department_id uuid, p_query text default '', p_offset integer default 0)
returns setof public.daily_logs language sql stable security invoker set search_path = public, pg_temp as $$
  select l.* from public.daily_logs l
  where l.department_id = p_department_id and l.archived_at is null
    and (
      btrim(coalesce(p_query, '')) = ''
      or strpos(lower(coalesce(l.activity, '')), lower(btrim(p_query))) > 0
      or strpos(lower(coalesce(l.location, '')), lower(btrim(p_query))) > 0
      or strpos(lower(coalesce(l.unit, '')), lower(btrim(p_query))) > 0
      or strpos(coalesce(to_char(l.entry_date, 'YYYY-MM-DD'), ''), btrim(p_query)) > 0
      or strpos(coalesce(to_char(l.entry_date, 'MM/DD/YYYY'), ''), btrim(p_query)) > 0
      or strpos(lower(coalesce(to_char(l.entry_date, 'Mon FMDD, YYYY'), '')), lower(btrim(p_query))) > 0
    )
  order by l.entry_date desc nulls last, l.entry_time desc nulls last, l.created_at desc, l.id desc
  limit 51 offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.save_daily_log(uuid,uuid,date,time,text,text,text,timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function public.archive_daily_log(uuid,uuid,timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function public.search_daily_logs(uuid,text,integer)
  from public, anon, authenticated, service_role;
grant execute on function public.save_daily_log(uuid,uuid,date,time,text,text,text,timestamptz) to authenticated;
grant execute on function public.archive_daily_log(uuid,uuid,timestamptz) to authenticated;
grant execute on function public.search_daily_logs(uuid,text,integer) to authenticated;
commit;
