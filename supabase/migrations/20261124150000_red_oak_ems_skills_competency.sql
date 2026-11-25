begin;

-- Red Oak-only EMS skills competency verification.
-- The department UUID is intentionally fixed so this capability cannot be
-- enabled accidentally for another department through client-supplied IDs.
create table public.red_oak_ems_competency_verifications (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null default '82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid
    references public.departments(id),
  member_id uuid not null,
  verification_year integer not null check (verification_year between 2000 and 2200),
  certification_level text not null check (length(btrim(certification_level)) > 0),
  evaluator text not null check (length(btrim(evaluator)) > 0),
  skill_results jsonb not null,
  remediation_skills text not null default '',
  remediation_training_completed text not null default '',
  re_verification_date date,
  re_verification_outcome text not null default '',
  overall_status text not null check (overall_status in ('Competent', 'Remediation Required', 'Incomplete')),
  member_signature text not null default '',
  member_signature_date date,
  evaluator_signature text not null default '',
  evaluator_signature_date date,
  cqi_service_director_review text not null default '',
  cqi_service_director_review_date date,
  created_by uuid not null references public.members(id),
  updated_by uuid not null references public.members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id, member_id, verification_year),
  foreign key (member_id) references public.members(id),
  foreign key (created_by) references public.members(id),
  foreign key (updated_by) references public.members(id)
);

create index red_oak_ems_competency_year_idx
  on public.red_oak_ems_competency_verifications(department_id, verification_year desc, member_id);

alter table public.red_oak_ems_competency_verifications enable row level security;
revoke all on public.red_oak_ems_competency_verifications from public, anon, authenticated;
grant select on public.red_oak_ems_competency_verifications to authenticated;

create policy red_oak_ems_competency_read
on public.red_oak_ems_competency_verifications
for select to authenticated
using (
  department_id = '82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid
  and public.can_manage_personnel(department_id)
);

create function public.save_red_oak_ems_competency_verification(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_department_id constant uuid := '82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid;
  v_user_id uuid := auth.uid();
  v_actor_id uuid;
  v_member_id uuid;
  v_verification_id uuid;
  v_year integer;
  v_skills jsonb;
  v_status text;
  v_item jsonb;
  v_expected text[] := array[
    'vital-signs',
    'airway-basic',
    'cpr-aed',
    'medication-administration',
    'immobilization',
    'airway-advanced',
    'iv-io-access',
    'needle-cricothyrotomy',
    'needle-thoracostomy'
  ];
  v_seen text[] := '{}';
begin
  if v_user_id is null or jsonb_typeof(p_payload) is distinct from 'object' then
    raise exception 'A signed-in user and valid verification are required' using errcode = '42501';
  end if;
  if public.can_manage_personnel(v_department_id) is not true then
    raise exception 'Only authorized Red Oak personnel managers may save competency verifications' using errcode = '42501';
  end if;

  select id into v_actor_id
  from public.members
  where department_id = v_department_id
    and (
      auth_user_id = v_user_id
      or lower(coalesce(email, '')) = lower(coalesce(auth.jwt()->>'email', ''))
    )
    and coalesce(active, false)
  order by id limit 1;
  if v_actor_id is null then
    raise exception 'Active Red Oak membership is required' using errcode = '42501';
  end if;

  v_member_id := nullif(p_payload->>'member_id', '')::uuid;
  v_year := nullif(p_payload->>'verification_year', '')::integer;
  v_skills := p_payload->'skill_results';
  v_status := p_payload->>'overall_status';
  v_verification_id := coalesce(nullif(p_payload->>'id', '')::uuid, gen_random_uuid());

  if v_member_id is null or v_year not between 2000 and 2200
    or nullif(btrim(p_payload->>'certification_level'), '') is null
    or nullif(btrim(p_payload->>'evaluator'), '') is null
    or v_status not in ('Competent', 'Remediation Required', 'Incomplete')
    or jsonb_typeof(v_skills) is distinct from 'array'
    or jsonb_array_length(v_skills) <> 9 then
    raise exception 'Complete the member, year, certification level, evaluator, all nine skill statuses, and final status';
  end if;

  if not exists (
    select 1 from public.members
    where id = v_member_id and department_id = v_department_id
  ) then
    raise exception 'Selected member does not belong to Red Oak Fire Department' using errcode = '42501';
  end if;

  for v_item in select value from jsonb_array_elements(v_skills) loop
    if coalesce(v_item->>'skill_key', '') <> all(v_expected)
      or coalesce(v_item->>'status', '') not in ('Competent', 'Remediation Required', 'N/A')
      or nullif(btrim(v_item->>'evaluator'), '') is null
      or nullif(btrim(v_item->>'date'), '') is null then
      raise exception 'Each skill requires a valid status, evaluator, and date';
    end if;
    if (v_item->>'skill_key') = any(v_seen) then
      raise exception 'Duplicate skill result';
    end if;
    v_seen := array_append(v_seen, v_item->>'skill_key');
  end loop;
  if cardinality(v_seen) <> 9 then
    raise exception 'All nine required skills must be included';
  end if;

  insert into public.red_oak_ems_competency_verifications (
    id, department_id, member_id, verification_year, certification_level, evaluator,
    skill_results, remediation_skills, remediation_training_completed,
    re_verification_date, re_verification_outcome, overall_status,
    member_signature, member_signature_date, evaluator_signature, evaluator_signature_date,
    cqi_service_director_review, cqi_service_director_review_date, created_by, updated_by
  ) values (
    v_verification_id, v_department_id, v_member_id, v_year,
    btrim(p_payload->>'certification_level'), btrim(p_payload->>'evaluator'),
    v_skills, coalesce(p_payload->>'remediation_skills', ''),
    coalesce(p_payload->>'remediation_training_completed', ''),
    nullif(p_payload->>'re_verification_date', '')::date,
    coalesce(p_payload->>'re_verification_outcome', ''), v_status,
    coalesce(p_payload->>'member_signature', ''),
    nullif(p_payload->>'member_signature_date', '')::date,
    coalesce(p_payload->>'evaluator_signature', ''),
    nullif(p_payload->>'evaluator_signature_date', '')::date,
    coalesce(p_payload->>'cqi_service_director_review', ''),
    nullif(p_payload->>'cqi_service_director_review_date', '')::date,
    v_actor_id, v_actor_id
  )
  on conflict (department_id, member_id, verification_year) do update set
    certification_level = excluded.certification_level,
    evaluator = excluded.evaluator,
    skill_results = excluded.skill_results,
    remediation_skills = excluded.remediation_skills,
    remediation_training_completed = excluded.remediation_training_completed,
    re_verification_date = excluded.re_verification_date,
    re_verification_outcome = excluded.re_verification_outcome,
    overall_status = excluded.overall_status,
    member_signature = excluded.member_signature,
    member_signature_date = excluded.member_signature_date,
    evaluator_signature = excluded.evaluator_signature,
    evaluator_signature_date = excluded.evaluator_signature_date,
    cqi_service_director_review = excluded.cqi_service_director_review,
    cqi_service_director_review_date = excluded.cqi_service_director_review_date,
    updated_by = v_actor_id,
    updated_at = now()
  returning id into v_verification_id;

  return v_verification_id;
end;
$$;

revoke all on function public.save_red_oak_ems_competency_verification(jsonb) from public, anon, authenticated;
grant execute on function public.save_red_oak_ems_competency_verification(jsonb) to authenticated;

commit;
