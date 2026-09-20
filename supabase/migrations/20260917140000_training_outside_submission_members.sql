create table if not exists public.training_outside_submission_members (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  submission_id uuid not null references public.training_outside_submissions (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  created_by uuid not null references public.members (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (department_id, submission_id, member_id),
  constraint training_outside_submission_members_member_fk foreign key (member_id) references public.members (id) on delete cascade
);

create index if not exists training_outside_submission_members_member_idx on public.training_outside_submission_members (department_id, member_id, created_at desc);
create index if not exists training_outside_submission_members_submission_idx on public.training_outside_submission_members (department_id, submission_id);

alter table public.training_outside_submission_members enable row level security;

drop policy if exists training_outside_submission_members_select_by_department_member on public.training_outside_submission_members;
create policy training_outside_submission_members_select_by_department_member on public.training_outside_submission_members for select using (
  exists (select 1 from public.members m where m.department_id = training_outside_submission_members.department_id and coalesce(m.active, false) = true and (m.auth_user_id = auth.uid() or lower(m.email) = lower(coalesce(auth.email(), ''))))
);

drop policy if exists training_outside_submission_members_insert_owner on public.training_outside_submission_members;
create policy training_outside_submission_members_insert_owner on public.training_outside_submission_members for insert with check (
  exists (select 1 from public.members m join public.training_outside_submissions s on s.id = training_outside_submission_members.submission_id and s.department_id = training_outside_submission_members.department_id where m.id = s.member_id and m.department_id = s.department_id and coalesce(m.active, false) = true and training_outside_submission_members.created_by = m.id and (m.auth_user_id = auth.uid() or lower(m.email) = lower(coalesce(auth.email(), ''))))
  and exists (select 1 from public.members participant where participant.id = training_outside_submission_members.member_id and participant.department_id = training_outside_submission_members.department_id and coalesce(participant.active, false) = true)
);

create or replace function public.create_outside_training_submission(
  p_department_id uuid,
  p_title text,
  p_category_id uuid,
  p_training_date date,
  p_hours numeric,
  p_is_ems_training boolean,
  p_ems_core_topic text,
  p_ems_course_definition_id uuid,
  p_ems_needs_review boolean,
  p_ems_provider_name text,
  p_description text,
  p_notes text,
  p_participant_ids uuid[]
) returns uuid language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare v_owner_id uuid; v_submission_id uuid; v_participant_id uuid;
begin
  select m.id into v_owner_id from public.members m where m.department_id = p_department_id and coalesce(m.active,false)=true and (m.auth_user_id=auth.uid() or lower(m.email)=lower(coalesce(auth.email(),''))) limit 1;
  if v_owner_id is null then raise exception 'Active department member is required.'; end if;
  if p_title is null or btrim(p_title) = '' or p_category_id is null or p_training_date is null or p_hours is null or p_hours <= 0 then raise exception 'Training title, category, date, and positive hours are required.'; end if;
  if not exists (select 1 from public.training_categories c where c.id=p_category_id and c.department_id=p_department_id and c.active=true) then raise exception 'Training category is not active in this department.'; end if;
  if exists (select 1 from unnest(coalesce(p_participant_ids, '{}'::uuid[])) pid where not exists (select 1 from public.members m where m.id=pid and m.department_id=p_department_id and coalesce(m.active,false)=true)) then raise exception 'All participants must be active members of this department.'; end if;
  insert into public.training_outside_submissions (department_id,member_id,title,category_id,training_date,hours,is_ems_training,ems_core_topic,ems_course_definition_id,ems_needs_review,ems_provider_name,description,notes,status,created_by,updated_by)
  values (p_department_id,v_owner_id,btrim(p_title),p_category_id,p_training_date,p_hours,p_is_ems_training,p_ems_core_topic,p_ems_course_definition_id,p_ems_needs_review,p_ems_provider_name,p_description,p_notes,'submitted',v_owner_id,v_owner_id) returning id into v_submission_id;
  if not (v_owner_id = any(coalesce(p_participant_ids, '{}'::uuid[]))) then
    insert into public.training_outside_submission_members (department_id,submission_id,member_id,created_by) values (p_department_id,v_submission_id,v_owner_id,v_owner_id);
  end if;
  foreach v_participant_id in array coalesce(p_participant_ids, '{}'::uuid[]) loop
    insert into public.training_outside_submission_members (department_id,submission_id,member_id,created_by) values (p_department_id,v_submission_id,v_participant_id,v_owner_id) on conflict do nothing;
  end loop;
  return v_submission_id;
end;
$$;

revoke all on function public.create_outside_training_submission(uuid,text,uuid,date,numeric,boolean,text,uuid,boolean,text,text,text,uuid[]) from public;
revoke all on function public.create_outside_training_submission(uuid,text,uuid,date,numeric,boolean,text,uuid,boolean,text,text,text,uuid[]) from anon;
grant execute on function public.create_outside_training_submission(uuid,text,uuid,date,numeric,boolean,text,uuid,boolean,text,text,text,uuid[]) to authenticated;

create or replace function public.get_member_training_outside_submissions(p_department_id uuid, p_member_id uuid)
returns setof public.training_outside_submissions
language sql security definer stable set search_path = public, auth, pg_temp as $$
  select s.* from public.training_outside_submissions s
  where s.department_id = p_department_id
    and (s.member_id = p_member_id or exists (select 1 from public.training_outside_submission_members sm where sm.department_id = s.department_id and sm.submission_id = s.id and sm.member_id = p_member_id))
    and exists (select 1 from public.members requester where requester.id = p_member_id and requester.department_id = p_department_id and coalesce(requester.active,false)=true and (requester.auth_user_id=auth.uid() or lower(requester.email)=lower(coalesce(auth.email(),''))))
  order by s.training_date desc, s.created_at desc;
$$;

revoke all on function public.get_member_training_outside_submissions(uuid,uuid) from public;
revoke all on function public.get_member_training_outside_submissions(uuid,uuid) from anon;
grant execute on function public.get_member_training_outside_submissions(uuid,uuid) to authenticated;

create or replace function public.get_active_department_training_members(p_department_id uuid)
returns table (id uuid, first_name text, last_name text)
language sql security definer stable set search_path = public, auth, pg_temp as $$
  select m.id, m.first_name, m.last_name
  from public.members m
  where m.department_id = p_department_id
    and coalesce(m.active,false) = true
    and exists (select 1 from public.members requester where requester.department_id = p_department_id and (requester.auth_user_id=auth.uid() or lower(requester.email)=lower(coalesce(auth.email(),''))))
  order by m.last_name, m.first_name;
$$;

revoke all on function public.get_active_department_training_members(uuid) from public;
revoke all on function public.get_active_department_training_members(uuid) from anon;
grant execute on function public.get_active_department_training_members(uuid) to authenticated;
