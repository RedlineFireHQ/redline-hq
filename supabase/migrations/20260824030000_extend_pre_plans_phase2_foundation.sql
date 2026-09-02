alter table public.pre_plans
  add column if not exists normal_occupant_load integer,
  add column if not exists special_needs_occupants text,
  add column if not exists primary_apparatus_access text,
  add column if not exists fire_alarm_details text,
  add column if not exists fire_alarm_panel_location text,
  add column if not exists sprinkler_system_details text,
  add column if not exists riser_location text,
  add column if not exists fire_pump_details text,
  add column if not exists fire_pump_location text,
  add column if not exists standpipe_details text,
  add column if not exists standpipe_location text,
  add column if not exists fdc_details text,
  add column if not exists fdc_location text,
  add column if not exists fdc_notes text,
  add column if not exists knox_box_details text,
  add column if not exists knox_box_location text,
  add column if not exists electrical_shutoff text,
  add column if not exists electrical_shutoff_location text,
  add column if not exists electrical_comments text,
  add column if not exists water_shutoff text,
  add column if not exists water_shutoff_location text,
  add column if not exists water_comments text,
  add column if not exists gas_shutoff text,
  add column if not exists gas_shutoff_location text,
  add column if not exists gas_comments text,
  add column if not exists other_water_supply_info text,
  add column if not exists critical_information text,
  add column if not exists site_plan_document_revision_id uuid,
  add column if not exists last_verified_at date,
  add column if not exists last_verified_by uuid references public.members (id) on delete set null;

alter table public.pre_plans
  drop constraint if exists pre_plans_normal_occupant_load_nonnegative;

alter table public.pre_plans
  add constraint pre_plans_normal_occupant_load_nonnegative
  check (normal_occupant_load is null or normal_occupant_load >= 0);

create index if not exists pre_plans_last_verified_at_idx
on public.pre_plans (department_id, last_verified_at desc);

create index if not exists pre_plans_last_verified_by_idx
on public.pre_plans (department_id, last_verified_by);

create index if not exists pre_plans_site_plan_document_revision_idx
on public.pre_plans (site_plan_document_revision_id);

create unique index if not exists pre_plans_department_id_id_uidx
on public.pre_plans (department_id, id);

create unique index if not exists document_revisions_department_id_id_uidx
on public.document_revisions (department_id, id);

alter table public.pre_plans
  drop constraint if exists pre_plans_site_plan_document_revision_department_fkey;

alter table public.pre_plans
  add constraint pre_plans_site_plan_document_revision_department_fkey
  foreign key (department_id, site_plan_document_revision_id)
  references public.document_revisions (department_id, id)
  on delete set null (site_plan_document_revision_id);

create index if not exists pre_plans_phase2_search_idx
on public.pre_plans using gin (
  to_tsvector(
    'english',
    coalesce(business_name, '') || ' ' ||
    coalesce(address, '') || ' ' ||
    coalesce(city, '') || ' ' ||
    coalesce(occupancy_id_number, '') || ' ' ||
    coalesce(primary_apparatus_access, '') || ' ' ||
    coalesce(fire_alarm_details, '') || ' ' ||
    coalesce(fire_alarm_panel_location, '') || ' ' ||
    coalesce(sprinkler_system_details, '') || ' ' ||
    coalesce(riser_location, '') || ' ' ||
    coalesce(fire_pump_details, '') || ' ' ||
    coalesce(fire_pump_location, '') || ' ' ||
    coalesce(standpipe_details, '') || ' ' ||
    coalesce(standpipe_location, '') || ' ' ||
    coalesce(fdc_details, '') || ' ' ||
    coalesce(fdc_location, '') || ' ' ||
    coalesce(fdc_notes, '') || ' ' ||
    coalesce(knox_box_details, '') || ' ' ||
    coalesce(knox_box_location, '') || ' ' ||
    coalesce(electrical_shutoff, '') || ' ' ||
    coalesce(electrical_shutoff_location, '') || ' ' ||
    coalesce(electrical_comments, '') || ' ' ||
    coalesce(water_shutoff, '') || ' ' ||
    coalesce(water_shutoff_location, '') || ' ' ||
    coalesce(water_comments, '') || ' ' ||
    coalesce(gas_shutoff, '') || ' ' ||
    coalesce(gas_shutoff_location, '') || ' ' ||
    coalesce(gas_comments, '') || ' ' ||
    coalesce(other_water_supply_info, '') || ' ' ||
    coalesce(critical_information, '') || ' ' ||
    coalesce(additional_comments, '')
  )
);

create table if not exists public.pre_plan_hydrants (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  pre_plan_id uuid not null,
  hydrant_identifier text,
  location_description text,
  hydrant_notes text,
  photo_document_revision_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.members (id) on delete set null,
  updated_by uuid references public.members (id) on delete set null
);

create index if not exists pre_plan_hydrants_department_idx
on public.pre_plan_hydrants (department_id);

create index if not exists pre_plan_hydrants_pre_plan_idx
on public.pre_plan_hydrants (pre_plan_id);

create index if not exists pre_plan_hydrants_identifier_search_idx
on public.pre_plan_hydrants (department_id, lower(btrim(coalesce(hydrant_identifier, ''))));

create index if not exists pre_plan_hydrants_location_search_idx
on public.pre_plan_hydrants (department_id, lower(btrim(coalesce(location_description, ''))));

create index if not exists pre_plan_hydrants_photo_document_idx
on public.pre_plan_hydrants (photo_document_revision_id);

create unique index if not exists pre_plan_hydrants_department_id_id_uidx
on public.pre_plan_hydrants (department_id, id);

create unique index if not exists pre_plan_hydrants_pre_plan_id_id_uidx
on public.pre_plan_hydrants (pre_plan_id, id);

alter table public.pre_plan_hydrants
  drop constraint if exists pre_plan_hydrants_pre_plan_department_fkey;

alter table public.pre_plan_hydrants
  add constraint pre_plan_hydrants_pre_plan_department_fkey
  foreign key (department_id, pre_plan_id)
  references public.pre_plans (department_id, id)
  on delete cascade;

alter table public.pre_plan_hydrants
  drop constraint if exists pre_plan_hydrants_photo_document_revision_department_fkey;

alter table public.pre_plan_hydrants
  add constraint pre_plan_hydrants_photo_document_revision_department_fkey
  foreign key (department_id, photo_document_revision_id)
  references public.document_revisions (department_id, id)
  on delete set null (photo_document_revision_id);

create or replace function public.set_pre_plan_hydrants_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_pre_plan_hydrants_updated_at on public.pre_plan_hydrants;
create trigger trg_pre_plan_hydrants_updated_at
before update on public.pre_plan_hydrants
for each row
execute function public.set_pre_plan_hydrants_updated_at();

alter table public.pre_plan_hydrants enable row level security;

drop policy if exists pre_plan_hydrants_select_by_department_member on public.pre_plan_hydrants;
create policy pre_plan_hydrants_select_by_department_member
on public.pre_plan_hydrants
for select
using (
  exists (
    select 1
    from public.members m
    where m.department_id = pre_plan_hydrants.department_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
  )
);

drop policy if exists pre_plan_hydrants_insert_by_department_member on public.pre_plan_hydrants;
create policy pre_plan_hydrants_insert_by_department_member
on public.pre_plan_hydrants
for insert
with check (
  exists (
    select 1
    from public.members m
    where m.department_id = pre_plan_hydrants.department_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
      and pre_plan_hydrants.created_by = m.id
      and pre_plan_hydrants.updated_by = m.id
  )
);

drop policy if exists pre_plan_hydrants_update_by_department_member on public.pre_plan_hydrants;
create policy pre_plan_hydrants_update_by_department_member
on public.pre_plan_hydrants
for update
using (
  exists (
    select 1
    from public.members m
    where m.department_id = pre_plan_hydrants.department_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
  )
)
with check (
  exists (
    select 1
    from public.members m
    where m.department_id = pre_plan_hydrants.department_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
      and pre_plan_hydrants.updated_by = m.id
  )
);

drop policy if exists pre_plan_hydrants_delete_by_department_member on public.pre_plan_hydrants;
create policy pre_plan_hydrants_delete_by_department_member
on public.pre_plan_hydrants
for delete
using (
  exists (
    select 1
    from public.members m
    where m.department_id = pre_plan_hydrants.department_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
  )
);

revoke all on table public.pre_plan_hydrants from public;
revoke all on table public.pre_plan_hydrants from anon;
grant select, insert, update, delete on table public.pre_plan_hydrants to authenticated;

create table if not exists public.pre_plan_hazards (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  pre_plan_id uuid not null,
  hazard_type text not null check (btrim(hazard_type) <> ''),
  location_description text,
  quantity text,
  description text,
  attachment_document_revision_id uuid,
  sds_document_revision_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.members (id) on delete set null,
  updated_by uuid references public.members (id) on delete set null
);

create index if not exists pre_plan_hazards_department_idx
on public.pre_plan_hazards (department_id);

create index if not exists pre_plan_hazards_pre_plan_idx
on public.pre_plan_hazards (pre_plan_id);

create index if not exists pre_plan_hazards_type_search_idx
on public.pre_plan_hazards (department_id, lower(btrim(hazard_type)));

create index if not exists pre_plan_hazards_location_search_idx
on public.pre_plan_hazards (department_id, lower(btrim(coalesce(location_description, ''))));

create index if not exists pre_plan_hazards_attachment_document_idx
on public.pre_plan_hazards (attachment_document_revision_id);

create index if not exists pre_plan_hazards_sds_document_idx
on public.pre_plan_hazards (sds_document_revision_id);

create index if not exists pre_plan_hazards_search_idx
on public.pre_plan_hazards using gin (
  to_tsvector(
    'english',
    coalesce(hazard_type, '') || ' ' ||
    coalesce(location_description, '') || ' ' ||
    coalesce(quantity, '') || ' ' ||
    coalesce(description, '')
  )
);

create unique index if not exists pre_plan_hazards_department_id_id_uidx
on public.pre_plan_hazards (department_id, id);

create unique index if not exists pre_plan_hazards_pre_plan_id_id_uidx
on public.pre_plan_hazards (pre_plan_id, id);

alter table public.pre_plan_hazards
  drop constraint if exists pre_plan_hazards_pre_plan_department_fkey;

alter table public.pre_plan_hazards
  add constraint pre_plan_hazards_pre_plan_department_fkey
  foreign key (department_id, pre_plan_id)
  references public.pre_plans (department_id, id)
  on delete cascade;

alter table public.pre_plan_hazards
  drop constraint if exists pre_plan_hazards_attachment_document_revision_department_fkey;

alter table public.pre_plan_hazards
  add constraint pre_plan_hazards_attachment_document_revision_department_fkey
  foreign key (department_id, attachment_document_revision_id)
  references public.document_revisions (department_id, id)
  on delete set null (attachment_document_revision_id);

alter table public.pre_plan_hazards
  drop constraint if exists pre_plan_hazards_sds_document_revision_department_fkey;

alter table public.pre_plan_hazards
  add constraint pre_plan_hazards_sds_document_revision_department_fkey
  foreign key (department_id, sds_document_revision_id)
  references public.document_revisions (department_id, id)
  on delete set null (sds_document_revision_id);

create or replace function public.set_pre_plan_hazards_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_pre_plan_hazards_updated_at on public.pre_plan_hazards;
create trigger trg_pre_plan_hazards_updated_at
before update on public.pre_plan_hazards
for each row
execute function public.set_pre_plan_hazards_updated_at();

alter table public.pre_plan_hazards enable row level security;

drop policy if exists pre_plan_hazards_select_by_department_member on public.pre_plan_hazards;
create policy pre_plan_hazards_select_by_department_member
on public.pre_plan_hazards
for select
using (
  exists (
    select 1
    from public.members m
    where m.department_id = pre_plan_hazards.department_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
  )
);

drop policy if exists pre_plan_hazards_insert_by_department_member on public.pre_plan_hazards;
create policy pre_plan_hazards_insert_by_department_member
on public.pre_plan_hazards
for insert
with check (
  exists (
    select 1
    from public.members m
    where m.department_id = pre_plan_hazards.department_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
      and pre_plan_hazards.created_by = m.id
      and pre_plan_hazards.updated_by = m.id
  )
);

drop policy if exists pre_plan_hazards_update_by_department_member on public.pre_plan_hazards;
create policy pre_plan_hazards_update_by_department_member
on public.pre_plan_hazards
for update
using (
  exists (
    select 1
    from public.members m
    where m.department_id = pre_plan_hazards.department_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
  )
)
with check (
  exists (
    select 1
    from public.members m
    where m.department_id = pre_plan_hazards.department_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
      and pre_plan_hazards.updated_by = m.id
  )
);

drop policy if exists pre_plan_hazards_delete_by_department_member on public.pre_plan_hazards;
create policy pre_plan_hazards_delete_by_department_member
on public.pre_plan_hazards
for delete
using (
  exists (
    select 1
    from public.members m
    where m.department_id = pre_plan_hazards.department_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
  )
);

revoke all on table public.pre_plan_hazards from public;
revoke all on table public.pre_plan_hazards from anon;
grant select, insert, update, delete on table public.pre_plan_hazards to authenticated;

create table if not exists public.pre_plan_document_links (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  pre_plan_id uuid not null,
  document_revision_id uuid not null,
  link_type text not null check (
    link_type in (
      'photo',
      'sds_msds',
      'floor_plan',
      'building_plan',
      'site_plan',
      'document',
      'other'
    )
  ),
  related_hazard_id uuid,
  related_hydrant_id uuid,
  related_component text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.members (id) on delete set null,
  updated_by uuid references public.members (id) on delete set null,
  check (related_component is null or btrim(related_component) <> '')
);

create index if not exists pre_plan_document_links_department_idx
on public.pre_plan_document_links (department_id);

create index if not exists pre_plan_document_links_pre_plan_idx
on public.pre_plan_document_links (pre_plan_id);

create index if not exists pre_plan_document_links_document_revision_idx
on public.pre_plan_document_links (document_revision_id);

create index if not exists pre_plan_document_links_type_idx
on public.pre_plan_document_links (link_type);

create index if not exists pre_plan_document_links_hazard_idx
on public.pre_plan_document_links (related_hazard_id);

create index if not exists pre_plan_document_links_hydrant_idx
on public.pre_plan_document_links (related_hydrant_id);

create index if not exists pre_plan_document_links_component_search_idx
on public.pre_plan_document_links (department_id, lower(btrim(coalesce(related_component, ''))));

alter table public.pre_plan_document_links
  drop constraint if exists pre_plan_document_links_pre_plan_department_fkey;

alter table public.pre_plan_document_links
  add constraint pre_plan_document_links_pre_plan_department_fkey
  foreign key (department_id, pre_plan_id)
  references public.pre_plans (department_id, id)
  on delete cascade;

alter table public.pre_plan_document_links
  drop constraint if exists pre_plan_document_links_document_revision_department_fkey;

alter table public.pre_plan_document_links
  add constraint pre_plan_document_links_document_revision_department_fkey
  foreign key (department_id, document_revision_id)
  references public.document_revisions (department_id, id)
  on delete cascade;

alter table public.pre_plan_document_links
  drop constraint if exists pre_plan_document_links_related_hazard_department_fkey;

alter table public.pre_plan_document_links
  add constraint pre_plan_document_links_related_hazard_department_fkey
  foreign key (department_id, related_hazard_id)
  references public.pre_plan_hazards (department_id, id)
  on delete cascade;

alter table public.pre_plan_document_links
  drop constraint if exists pre_plan_document_links_related_hydrant_department_fkey;

alter table public.pre_plan_document_links
  add constraint pre_plan_document_links_related_hydrant_department_fkey
  foreign key (department_id, related_hydrant_id)
  references public.pre_plan_hydrants (department_id, id)
  on delete cascade;

alter table public.pre_plan_document_links
  drop constraint if exists pre_plan_document_links_related_hazard_pre_plan_fkey;

alter table public.pre_plan_document_links
  add constraint pre_plan_document_links_related_hazard_pre_plan_fkey
  foreign key (pre_plan_id, related_hazard_id)
  references public.pre_plan_hazards (pre_plan_id, id)
  on delete cascade;

alter table public.pre_plan_document_links
  drop constraint if exists pre_plan_document_links_related_hydrant_pre_plan_fkey;

alter table public.pre_plan_document_links
  add constraint pre_plan_document_links_related_hydrant_pre_plan_fkey
  foreign key (pre_plan_id, related_hydrant_id)
  references public.pre_plan_hydrants (pre_plan_id, id)
  on delete cascade;

create or replace function public.set_pre_plan_document_links_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_pre_plan_document_links_updated_at on public.pre_plan_document_links;
create trigger trg_pre_plan_document_links_updated_at
before update on public.pre_plan_document_links
for each row
execute function public.set_pre_plan_document_links_updated_at();

alter table public.pre_plan_document_links enable row level security;

drop policy if exists pre_plan_document_links_select_by_department_member on public.pre_plan_document_links;
create policy pre_plan_document_links_select_by_department_member
on public.pre_plan_document_links
for select
using (
  exists (
    select 1
    from public.members m
    where m.department_id = pre_plan_document_links.department_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
  )
);

drop policy if exists pre_plan_document_links_insert_by_department_member on public.pre_plan_document_links;
create policy pre_plan_document_links_insert_by_department_member
on public.pre_plan_document_links
for insert
with check (
  exists (
    select 1
    from public.members m
    where m.department_id = pre_plan_document_links.department_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
      and pre_plan_document_links.created_by = m.id
      and pre_plan_document_links.updated_by = m.id
  )
);

drop policy if exists pre_plan_document_links_update_by_department_member on public.pre_plan_document_links;
create policy pre_plan_document_links_update_by_department_member
on public.pre_plan_document_links
for update
using (
  exists (
    select 1
    from public.members m
    where m.department_id = pre_plan_document_links.department_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
  )
)
with check (
  exists (
    select 1
    from public.members m
    where m.department_id = pre_plan_document_links.department_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
      and pre_plan_document_links.updated_by = m.id
  )
);

drop policy if exists pre_plan_document_links_delete_by_department_member on public.pre_plan_document_links;
create policy pre_plan_document_links_delete_by_department_member
on public.pre_plan_document_links
for delete
using (
  exists (
    select 1
    from public.members m
    where m.department_id = pre_plan_document_links.department_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
  )
);

revoke all on table public.pre_plan_document_links from public;
revoke all on table public.pre_plan_document_links from anon;
grant select, insert, update, delete on table public.pre_plan_document_links to authenticated;
