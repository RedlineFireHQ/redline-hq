-- Hydrostatic records are written only through the checked, atomic RPCs below.
create unique index if not exists scba_cylinders_id_department_hydro_idx
  on public.scba_cylinders (id, department_id);

create table public.scba_hydro_sessions (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id),
  test_date date not null,
  tester_name text not null check (length(btrim(tester_name)) > 0),
  company_name text not null check (length(btrim(company_name)) > 0),
  notes text,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, department_id)
);

create table public.scba_hydro_results (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null,
  session_id uuid not null,
  cylinder_id uuid not null,
  result text not null check (result in ('Pass', 'Fail')),
  created_at timestamptz not null default now(),
  unique (session_id, cylinder_id),
  foreign key (session_id, department_id) references public.scba_hydro_sessions(id, department_id),
  foreign key (cylinder_id, department_id) references public.scba_cylinders(id, department_id)
);

create index scba_hydro_results_cylinder_idx on public.scba_hydro_results(department_id, cylinder_id);

create table public.scba_hydro_baselines (
  cylinder_id uuid primary key,
  department_id uuid not null,
  last_date date,
  due_date date,
  foreign key (cylinder_id, department_id) references public.scba_cylinders(id, department_id)
);

create table public.scba_hydro_corrections (
  id bigint generated always as identity primary key,
  department_id uuid not null,
  session_id uuid not null,
  changed_by uuid not null,
  changed_at timestamptz not null default now(),
  prior_session jsonb not null,
  prior_results jsonb not null,
  foreign key (session_id, department_id) references public.scba_hydro_sessions(id, department_id)
);

create table public.scba_hydro_attachments (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null,
  session_id uuid not null,
  storage_path text not null unique,
  original_filename text not null,
  content_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 15728640),
  created_at timestamptz not null default now(),
  foreign key (session_id, department_id) references public.scba_hydro_sessions(id, department_id)
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('scba-hydro-attachments', 'scba-hydro-attachments', false, 15728640,
  array['application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do nothing;
do $$
begin
  if exists (select 1 from storage.buckets where id = 'scba-hydro-attachments' and public) then
    raise exception 'SCBA hydrostatic attachment bucket must be private';
  end if;
end;
$$;

alter table public.scba_hydro_sessions enable row level security;
alter table public.scba_hydro_results enable row level security;
alter table public.scba_hydro_baselines enable row level security;
alter table public.scba_hydro_corrections enable row level security;
alter table public.scba_hydro_attachments enable row level security;

revoke all on public.scba_hydro_sessions, public.scba_hydro_results,
  public.scba_hydro_baselines, public.scba_hydro_corrections,
  public.scba_hydro_attachments from public, anon, authenticated;
revoke all on sequence public.scba_hydro_corrections_id_seq from public, anon, authenticated, service_role;
grant select on public.scba_hydro_sessions, public.scba_hydro_results,
  public.scba_hydro_corrections, public.scba_hydro_attachments to authenticated;
grant select, insert, delete on public.scba_hydro_attachments to service_role;

create function public.scba_hydro_can_read(p_department_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select auth.uid() is not null
    and public.member_has_inventory_permission(p_department_id, 'scba_cylinder_inspection_testing') is true
    and exists (
    select 1 from public.auth_user_department_memberships m
      join public.members u on u.id = m.member_id and u.department_id = m.department_id
    where m.auth_user_id = auth.uid() and coalesce(u.active, false) and m.department_id = p_department_id
  )
$$;
revoke all on function public.scba_hydro_can_read(uuid) from public, anon, authenticated;
grant execute on function public.scba_hydro_can_read(uuid) to authenticated;

create policy scba_hydro_sessions_read on public.scba_hydro_sessions for select to authenticated
  using (public.scba_hydro_can_read(department_id));
create policy scba_hydro_results_read on public.scba_hydro_results for select to authenticated
  using (public.scba_hydro_can_read(department_id));
create policy scba_hydro_corrections_read on public.scba_hydro_corrections for select to authenticated
  using (public.scba_hydro_can_read(department_id));
create policy scba_hydro_attachments_read on public.scba_hydro_attachments for select to authenticated
  using (public.scba_hydro_can_read(department_id));

create function public.save_scba_hydro_session(
  p_department_id uuid, p_session_id uuid, p_test_date date, p_tester_name text,
  p_company_name text, p_notes text, p_results jsonb
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_session_id uuid;
  v_existing public.scba_hydro_sessions%rowtype;
  v_result jsonb;
  v_cylinder uuid;
  v_ids uuid[] := '{}';
  v_latest date;
  v_baseline public.scba_hydro_baselines%rowtype;
begin
  if public.scba_hydro_can_read(p_department_id) is not true then
    raise exception 'Not authorized for SCBA cylinder testing' using errcode = '42501';
  end if;
  if p_test_date is null or nullif(btrim(p_tester_name), '') is null or nullif(btrim(p_company_name), '') is null
    or jsonb_typeof(p_results) is distinct from 'array' or jsonb_array_length(p_results) = 0 then
    raise exception 'Test date, tester, company and at least one result are required';
  end if;
  for v_result in select value from jsonb_array_elements(p_results) loop
    v_cylinder := (v_result->>'cylinder_id')::uuid;
    if v_cylinder is null or v_cylinder = any(v_ids) or coalesce(v_result->>'result', '') not in ('Pass', 'Fail') then
      raise exception 'Invalid or duplicate cylinder result';
    end if;
    v_ids := array_append(v_ids, v_cylinder);
  end loop;
  if p_session_id is not null then
    select * into v_existing from public.scba_hydro_sessions
      where id = p_session_id and department_id = p_department_id for update;
    if not found then raise exception 'Session not found'; end if;
    if (select count(*) from public.scba_hydro_results where session_id = p_session_id) <> cardinality(v_ids)
      or exists (select 1 from public.scba_hydro_results where session_id = p_session_id and not (cylinder_id = any(v_ids))) then
      raise exception 'Corrections must preserve the tested cylinder list';
    end if;
  end if;
  -- Stable ordering prevents concurrent sessions locking cylinders in opposite orders.
  for v_cylinder in select unnest(v_ids) order by 1 loop
    perform 1 from public.scba_cylinders where id = v_cylinder and department_id = p_department_id for update;
    if not found then raise exception 'Cylinder not found in department'; end if;
    insert into public.scba_hydro_baselines (cylinder_id, department_id, last_date, due_date)
      select id, department_id, last_hydrostatic_test_date, next_hydrostatic_test_due_date
      from public.scba_cylinders where id = v_cylinder and department_id = p_department_id
      on conflict (cylinder_id) do nothing;
    update public.scba_hydro_baselines b set last_date = c.last_hydrostatic_test_date,
      due_date = c.next_hydrostatic_test_due_date
      from public.scba_cylinders c
      where b.cylinder_id = v_cylinder and c.id = b.cylinder_id and c.department_id = p_department_id
        and c.last_hydrostatic_test_date is not null
        and (b.last_date is null or c.last_hydrostatic_test_date > b.last_date)
        and c.last_hydrostatic_test_date > coalesce((
          select max(s.test_date) from public.scba_hydro_results r
            join public.scba_hydro_sessions s on s.id = r.session_id and s.department_id = r.department_id
          where r.cylinder_id = v_cylinder and r.department_id = p_department_id
        ), '-infinity'::date);
  end loop;
  if p_session_id is null then
    insert into public.scba_hydro_sessions (department_id, test_date, tester_name, company_name, notes, created_by)
      values (p_department_id, p_test_date, btrim(p_tester_name), btrim(p_company_name), nullif(btrim(p_notes), ''), auth.uid())
      returning id into v_session_id;
    for v_result in select value from jsonb_array_elements(p_results) loop
      insert into public.scba_hydro_results (department_id, session_id, cylinder_id, result)
      values (p_department_id, v_session_id, (v_result->>'cylinder_id')::uuid, v_result->>'result');
    end loop;
  else
    v_session_id := p_session_id;
    insert into public.scba_hydro_corrections (department_id, session_id, changed_by, prior_session, prior_results)
      select p_department_id, p_session_id, auth.uid(), to_jsonb(v_existing),
        jsonb_agg(to_jsonb(r) order by r.cylinder_id)
      from public.scba_hydro_results r where r.session_id = p_session_id;
    update public.scba_hydro_sessions set test_date = p_test_date, tester_name = btrim(p_tester_name),
      company_name = btrim(p_company_name), notes = nullif(btrim(p_notes), ''), updated_at = now()
      where id = p_session_id and department_id = p_department_id;
    for v_result in select value from jsonb_array_elements(p_results) loop
      update public.scba_hydro_results set result = v_result->>'result'
      where session_id = p_session_id and department_id = p_department_id and cylinder_id = (v_result->>'cylinder_id')::uuid;
    end loop;
  end if;
  for v_cylinder in select unnest(v_ids) order by 1 loop
    select * into v_baseline from public.scba_hydro_baselines where cylinder_id = v_cylinder;
    select max(s.test_date) into v_latest from public.scba_hydro_results r
      join public.scba_hydro_sessions s on s.id = r.session_id and s.department_id = r.department_id
      where r.cylinder_id = v_cylinder and r.department_id = p_department_id;
    if v_baseline.last_date is not null and (v_latest is null or v_baseline.last_date > v_latest) then
      update public.scba_cylinders set last_hydrostatic_test_date = v_baseline.last_date,
        next_hydrostatic_test_due_date = v_baseline.due_date where id = v_cylinder and department_id = p_department_id;
    else
      update public.scba_cylinders set last_hydrostatic_test_date = v_latest,
        next_hydrostatic_test_due_date = (v_latest + interval '5 years')::date where id = v_cylinder and department_id = p_department_id;
    end if;
  end loop;
  return v_session_id;
end;
$$;

revoke all on function public.save_scba_hydro_session(uuid, uuid, date, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.save_scba_hydro_session(uuid, uuid, date, text, text, text, jsonb) to authenticated;
