-- Persist ISO/PPC classification on mobile/self-reported training without
-- bypassing the existing department approval workflow.
alter table public.training_outside_submissions
  add column if not exists iso_classifications text[] not null default '{}'::text[],
  add column if not exists iso_facility_id uuid references public.training_facilities(id) on delete set null,
  add column if not exists iso_pre_plan_id uuid references public.pre_plans(id) on delete set null,
  add column if not exists iso_driver_operator_training_type text,
  add column if not exists iso_facility_credit_level text not null default 'none',
  add column if not exists iso_facility_name text,
  add column if not exists iso_facility_location text,
  add column if not exists iso_facility_type text,
  add column if not exists iso_facility_agreement boolean not null default false,
  add column if not exists iso_facility_stories integer,
  add column if not exists iso_facility_acres numeric,
  add column if not exists iso_facility_purpose_built boolean not null default false,
  add column if not exists iso_facility_agreement_reference text;

alter table public.training_outside_submissions
  drop constraint if exists training_outside_submissions_iso_classifications_check;
alter table public.training_outside_submissions
  add constraint training_outside_submissions_iso_classifications_check
  check (iso_classifications <@ array[
    'training_facilities','company_training','officer_training',
    'driver_operator','hazmat','recruit','building_familiarization'
  ]::text[]);

alter table public.training_outside_submissions
  drop constraint if exists training_outside_submissions_iso_driver_type_check;
alter table public.training_outside_submissions
  add constraint training_outside_submissions_iso_driver_type_check
  check (iso_driver_operator_training_type is null or iso_driver_operator_training_type in ('initial','refresher'));

alter table public.training_outside_submissions
  drop constraint if exists training_outside_submissions_iso_facility_credit_check;
alter table public.training_outside_submissions
  add constraint training_outside_submissions_iso_facility_credit_check
  check (iso_facility_credit_level in ('full','partial','none'));

-- Store a facility eligibility snapshot for the training date and enforce
-- department ownership of both the facility and pre-plan.
create or replace function public.sync_outside_submission_iso_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_facility public.training_facilities%rowtype;
  v_agreement_valid boolean := false;
  v_credit_level text := 'none';
begin
  if cardinality(coalesce(new.iso_classifications, '{}'::text[])) = 0 then
    new.iso_classifications := '{}'::text[];
  end if;

  if new.iso_facility_id is not null then
    select * into v_facility
    from public.training_facilities f
    where f.id = new.iso_facility_id
      and f.department_id = new.department_id
      and f.active = true;
    if not found then
      raise exception 'Select an active training facility belonging to this department.';
    end if;

    v_agreement_valid :=
      v_facility.ownership_type = 'department_owned'
      or (
        v_facility.formal_agreement = true
        and nullif(btrim(v_facility.agreement_reference), '') is not null
        and (v_facility.agreement_start_date is null or v_facility.agreement_start_date <= new.training_date)
        and (v_facility.agreement_end_date is null or v_facility.agreement_end_date >= new.training_date)
      );

    if v_agreement_valid then
      v_credit_level := case
        when v_facility.facility_type = 'drill_tower' and coalesce(v_facility.tower_stories,0) >= 3 then 'full'
        when v_facility.facility_type = 'drill_tower' and coalesce(v_facility.tower_stories,0) = 2 then 'partial'
        when v_facility.facility_type = 'live_fire_burn_building' and v_facility.purpose_built_live_fire then 'full'
        when v_facility.facility_type = 'training_yard' and coalesce(v_facility.yard_acres,0) >= 2 then 'full'
        when v_facility.facility_type = 'regional_academy' and v_facility.formal_agreement and nullif(btrim(v_facility.agreement_reference), '') is not null then 'full'
        else 'none'
      end;
    end if;

    new.iso_facility_name := v_facility.name;
    new.iso_facility_location := concat_ws(', ',v_facility.address,v_facility.city,v_facility.state,v_facility.zip);
    new.iso_facility_type := v_facility.facility_type;
    new.iso_facility_agreement := v_facility.formal_agreement;
    new.iso_facility_stories := v_facility.tower_stories;
    new.iso_facility_acres := v_facility.yard_acres;
    new.iso_facility_purpose_built := v_facility.purpose_built_live_fire;
    new.iso_facility_agreement_reference := v_facility.agreement_reference;
  else
    new.iso_facility_name := null;
    new.iso_facility_location := null;
    new.iso_facility_type := null;
    new.iso_facility_agreement := false;
    new.iso_facility_stories := null;
    new.iso_facility_acres := null;
    new.iso_facility_purpose_built := false;
    new.iso_facility_agreement_reference := null;
  end if;

  if not ('training_facilities' = any(new.iso_classifications)) then
    v_credit_level := 'none';
  end if;
  new.iso_facility_credit_level := v_credit_level;

  if 'training_facilities' = any(new.iso_classifications) and v_credit_level = 'none' then
    raise exception 'Training Facilities ISO credit requires a qualifying facility and valid agreement for the training date.';
  end if;
  if 'driver_operator' = any(new.iso_classifications)
     and new.iso_driver_operator_training_type not in ('initial','refresher') then
    raise exception 'Select initial or refresher training for ISO Driver / Operator classification.';
  end if;
  if 'building_familiarization' = any(new.iso_classifications) then
    if new.iso_pre_plan_id is null or not exists (
      select 1 from public.pre_plans p
      where p.id = new.iso_pre_plan_id and p.department_id = new.department_id and p.lifecycle_status = 'active'
    ) then
      raise exception 'Select an active building pre-plan belonging to this department.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_outside_submission_iso_fields on public.training_outside_submissions;
create trigger trg_sync_outside_submission_iso_fields
before insert or update of department_id, training_date, iso_classifications,
  iso_facility_id, iso_pre_plan_id, iso_driver_operator_training_type
on public.training_outside_submissions
for each row execute function public.sync_outside_submission_iso_fields();

-- Replace the old 13-argument RPC rather than leaving an ambiguous overload
-- with defaults. Existing callers remain compatible because the new fields
-- have defaults; the mobile client supplies them explicitly.
drop function if exists public.create_outside_training_submission(
  uuid,text,uuid,date,numeric,boolean,text,uuid,boolean,text,text,text,uuid[]
);

create function public.create_outside_training_submission(
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
  p_participant_ids uuid[],
  p_iso_classifications text[] default '{}'::text[],
  p_iso_facility_id uuid default null,
  p_iso_pre_plan_id uuid default null,
  p_iso_driver_operator_training_type text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_owner_id uuid;
  v_submission_id uuid;
  v_participant_id uuid;
begin
  select m.id into v_owner_id
  from public.members m
  where m.department_id = p_department_id
    and coalesce(m.active,false) = true
    and (m.auth_user_id = auth.uid() or lower(m.email) = lower(coalesce(auth.email(),'')))
  limit 1;
  if v_owner_id is null then raise exception 'Active department member is required.'; end if;
  if p_title is null or btrim(p_title) = '' or p_category_id is null
     or p_training_date is null or p_hours is null or p_hours <= 0 then
    raise exception 'Training title, category, date, and positive hours are required.';
  end if;
  if not exists (
    select 1 from public.training_categories c
    where c.id = p_category_id and c.department_id = p_department_id and c.active = true
  ) then raise exception 'Training category is not active in this department.'; end if;
  if exists (
    select 1 from unnest(coalesce(p_participant_ids,'{}'::uuid[])) pid
    where not exists (
      select 1 from public.members m
      where m.id = pid and m.department_id = p_department_id and coalesce(m.active,false) = true
    )
  ) then raise exception 'All participants must be active members of this department.'; end if;

  insert into public.training_outside_submissions (
    department_id,member_id,title,category_id,training_date,hours,
    is_ems_training,ems_core_topic,ems_course_definition_id,ems_needs_review,
    ems_provider_name,description,notes,status,created_by,updated_by,
    iso_classifications,iso_facility_id,iso_pre_plan_id,iso_driver_operator_training_type
  )
  values (
    p_department_id,v_owner_id,btrim(p_title),p_category_id,p_training_date,p_hours,
    p_is_ems_training,p_ems_core_topic,p_ems_course_definition_id,p_ems_needs_review,
    p_ems_provider_name,p_description,p_notes,'submitted',v_owner_id,v_owner_id,
    coalesce(p_iso_classifications,'{}'::text[]),p_iso_facility_id,p_iso_pre_plan_id,p_iso_driver_operator_training_type
  )
  returning id into v_submission_id;

  if not (v_owner_id = any(coalesce(p_participant_ids,'{}'::uuid[]))) then
    insert into public.training_outside_submission_members (department_id,submission_id,member_id,created_by)
    values (p_department_id,v_submission_id,v_owner_id,v_owner_id);
  end if;
  foreach v_participant_id in array coalesce(p_participant_ids,'{}'::uuid[]) loop
    insert into public.training_outside_submission_members (department_id,submission_id,member_id,created_by)
    values (p_department_id,v_submission_id,v_participant_id,v_owner_id)
    on conflict do nothing;
  end loop;
  return v_submission_id;
end;
$$;

revoke all on function public.create_outside_training_submission(
  uuid,text,uuid,date,numeric,boolean,text,uuid,boolean,text,text,text,uuid[],text[],uuid,uuid,text
) from public, anon;
grant execute on function public.create_outside_training_submission(
  uuid,text,uuid,date,numeric,boolean,text,uuid,boolean,text,text,text,uuid[],text[],uuid,uuid,text
) to authenticated;
