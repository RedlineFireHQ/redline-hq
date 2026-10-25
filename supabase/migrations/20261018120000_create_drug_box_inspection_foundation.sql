-- ============================================================================
-- Red Oak Fire Department — EMS Drug Box inspection foundation.
--
-- Creates dedicated drug-box infrastructure (squad boxes, shared checklist
-- template, immutable per-item inspection snapshots) plus an admin-authorized
-- deletion RPC. Mirrors the proven Pediatric Bag patterns: department_id on
-- every table, composite FKs, RLS department scoping, SECURITY DEFINER RPCs
-- with a fixed search_path, and EXECUTE granted to authenticated only.
--
-- This is an inventory PRESENCE check, not a medication administration or
-- controlled-substance waste log. Patient/waste/signature/clinic fields from
-- the paper form are intentionally NOT modeled.
--
-- Source inventory: "EMS Drug Inventory Log (revised 08/28/2025)"
-- (docs/RO EMS Drug Inventory List - 08.28.25.doc). Squads 114–117 share the
-- one checklist template per department. Item wording/quantities are verbatim;
-- items printed without a quantity are held at quantity 1 (confirmed source
-- review).
--
-- Seeding is idempotent and scoped to Red Oak only:
--   department id 82f50d14-216a-4dd1-80f4-58459dc97b97
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. drug_boxes — the four squad boxes (114/115/116/117) per department.
-- ---------------------------------------------------------------------------

create table if not exists public.drug_boxes (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  squad_number text not null check (squad_number in ('114', '115', '116', '117')),
  display_name text not null check (btrim(display_name) <> ''),
  is_active boolean not null default true,
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (department_id, squad_number)
);

create index if not exists drug_boxes_department_idx
on public.drug_boxes (department_id, is_active);

create unique index if not exists drug_boxes_id_department_unique_idx
on public.drug_boxes (id, department_id);

-- ---------------------------------------------------------------------------
-- 2. drug_box_checklist_items — ONE shared template per department. All four
--    squads render the same item set.
-- ---------------------------------------------------------------------------

create table if not exists public.drug_box_checklist_items (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  section_name text not null check (btrim(section_name) <> ''),
  item_label text not null check (btrim(item_label) <> ''),
  required_quantity integer not null check (required_quantity >= 1),
  source_quantity_text text,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists drug_box_checklist_items_unique_idx
on public.drug_box_checklist_items (department_id, lower(btrim(section_name)), lower(btrim(item_label)));

create index if not exists drug_box_checklist_items_department_idx
on public.drug_box_checklist_items (department_id, is_active, display_order, created_at);

-- ---------------------------------------------------------------------------
-- 3. drug_box_inspections — permanent per-box completion history. Each
--    completion is a separate row (multiple inspections per squad per day are
--    allowed). Captures date/time (created_at), inspector, squad/unit, and the
--    three lock/identification fields.
-- ---------------------------------------------------------------------------

create table if not exists public.drug_box_inspections (
  id uuid primary key default gen_random_uuid(),
  drug_box_id uuid not null,
  department_id uuid not null,
  member_id uuid not null references public.members (id) on delete cascade,
  squad_number text not null,
  unit_number text not null default '',
  box_lock_number text not null default '',
  cs_lock_number text not null default '',
  ez_io_number text not null default '',
  assisting_personnel jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint drug_box_inspections_box_fk
    foreign key (drug_box_id, department_id)
    references public.drug_boxes (id, department_id)
    on delete cascade
);

create index if not exists drug_box_inspections_box_idx
on public.drug_box_inspections (department_id, drug_box_id, created_at desc);

create index if not exists drug_box_inspections_member_idx
on public.drug_box_inspections (department_id, member_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 4. drug_box_checklist_results — immutable per-item snapshot captured at
--    completion time (section, label, quantity, checked state frozen).
-- ---------------------------------------------------------------------------

create table if not exists public.drug_box_checklist_results (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.drug_box_inspections (id) on delete cascade,
  department_id uuid not null references public.departments (id) on delete cascade,
  drug_box_id uuid not null,
  checklist_item_id uuid references public.drug_box_checklist_items (id) on delete set null,
  section_name_snapshot text not null,
  item_label_snapshot text not null,
  required_quantity_snapshot integer,
  source_quantity_text_snapshot text,
  is_checked boolean not null default false,
  item_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint drug_box_checklist_results_box_fk
    foreign key (drug_box_id, department_id)
    references public.drug_boxes (id, department_id)
    on delete cascade
);

create index if not exists drug_box_checklist_results_inspection_idx
on public.drug_box_checklist_results (inspection_id, item_order, created_at);

-- ---------------------------------------------------------------------------
-- 5. Row level security. Every policy scopes to the requesting member's own
--    department (via auth.uid()/auth.email() matched to public.members).
-- ---------------------------------------------------------------------------

alter table public.drug_boxes enable row level security;
alter table public.drug_box_checklist_items enable row level security;
alter table public.drug_box_inspections enable row level security;
alter table public.drug_box_checklist_results enable row level security;

-- drug_boxes: read by department members; manage by administrator.
drop policy if exists drug_boxes_select_by_department on public.drug_boxes;
create policy drug_boxes_select_by_department
on public.drug_boxes
for select
using (
  exists (
    select 1 from public.members m
    where m.department_id = drug_boxes.department_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
  )
);

drop policy if exists drug_boxes_write_by_admin on public.drug_boxes;
create policy drug_boxes_write_by_admin
on public.drug_boxes
for all
using (
  exists (
    select 1 from public.members m
    where m.department_id = drug_boxes.department_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
      and lower(coalesce(m.role, '')) = 'administrator'
  )
)
with check (
  exists (
    select 1 from public.members m
    where m.department_id = drug_boxes.department_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

-- drug_box_checklist_items: read by department members; manage by administrator.
drop policy if exists drug_box_checklist_items_select_by_department on public.drug_box_checklist_items;
create policy drug_box_checklist_items_select_by_department
on public.drug_box_checklist_items
for select
using (
  exists (
    select 1 from public.members m
    where m.department_id = drug_box_checklist_items.department_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
  )
);

drop policy if exists drug_box_checklist_items_write_by_admin on public.drug_box_checklist_items;
create policy drug_box_checklist_items_write_by_admin
on public.drug_box_checklist_items
for all
using (
  exists (
    select 1 from public.members m
    where m.department_id = drug_box_checklist_items.department_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
      and lower(coalesce(m.role, '')) = 'administrator'
  )
)
with check (
  exists (
    select 1 from public.members m
    where m.department_id = drug_box_checklist_items.department_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
      and lower(coalesce(m.role, '')) = 'administrator'
  )
);

-- drug_box_inspections: read by department members; insert by department member
-- (the inspector). No update/delete via policy — deletion goes through the
-- SECURITY DEFINER admin RPC below.
drop policy if exists drug_box_inspections_select_by_department on public.drug_box_inspections;
create policy drug_box_inspections_select_by_department
on public.drug_box_inspections
for select
using (
  exists (
    select 1 from public.members m
    where m.department_id = drug_box_inspections.department_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
  )
);

drop policy if exists drug_box_inspections_insert_by_department on public.drug_box_inspections;
create policy drug_box_inspections_insert_by_department
on public.drug_box_inspections
for insert
with check (
  exists (
    select 1 from public.members m
    where m.department_id = drug_box_inspections.department_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
  )
);

-- drug_box_checklist_results: read by department members; insert by department member.
drop policy if exists drug_box_checklist_results_select_by_department on public.drug_box_checklist_results;
create policy drug_box_checklist_results_select_by_department
on public.drug_box_checklist_results
for select
using (
  exists (
    select 1 from public.members m
    where m.department_id = drug_box_checklist_results.department_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
  )
);

drop policy if exists drug_box_checklist_results_insert_by_department on public.drug_box_checklist_results;
create policy drug_box_checklist_results_insert_by_department
on public.drug_box_checklist_results
for insert
with check (
  exists (
    select 1 from public.members m
    where m.department_id = drug_box_checklist_results.department_id
      and coalesce(m.active, false) = true
      and (
        (auth.uid() is not null and m.auth_user_id = auth.uid())
        or lower(coalesce(m.email, '')) = lower(coalesce(auth.email(), ''))
      )
  )
);

-- ---------------------------------------------------------------------------
-- 6. Administrator-only deletion of a single inspection + its snapshot rows.
--    Resolves the requesting member WITHIN THE INSPECTION'S OWN DEPARTMENT and
--    requires an active Administrator. Never touches boxes, template items,
--    members, departments, or other inspections.
-- ---------------------------------------------------------------------------

create or replace function public.delete_drug_box_inspection(p_inspection_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_inspection public.drug_box_inspections%rowtype;
  v_requester_id uuid;
  v_requester_email text;
  v_is_administrator boolean := false;
  v_results_deleted integer := 0;
begin
  if p_inspection_id is null then
    raise exception 'Inspection id is required.';
  end if;

  select i.*
  into v_inspection
  from public.drug_box_inspections i
  where i.id = p_inspection_id
  limit 1;

  if not found then
    raise exception 'Drug box inspection not found.';
  end if;

  if v_inspection.department_id is null then
    raise exception 'Inspection department is required.';
  end if;

  if auth.uid() is not null then
    select m.id
    into v_requester_id
    from public.members m
    where m.auth_user_id = auth.uid()
      and m.department_id = v_inspection.department_id
      and coalesce(m.active, false) = true
    order by m.id
    limit 1;
  end if;

  if v_requester_id is null then
    select lower(coalesce(u.email, ''))
    into v_requester_email
    from auth.users u
    where u.id = auth.uid()
      and u.deleted_at is null
    limit 1;

    if coalesce(v_requester_email, '') = '' then
      v_requester_email := lower(coalesce(auth.email(), ''));
    end if;

    if coalesce(v_requester_email, '') <> '' then
      select m.id
      into v_requester_id
      from public.members m
      where lower(coalesce(m.email, '')) = v_requester_email
        and m.department_id = v_inspection.department_id
        and coalesce(m.active, false) = true
      order by case when auth.uid() is not null and m.auth_user_id = auth.uid() then 0 else 1 end, m.id
      limit 1;
    end if;
  end if;

  if v_requester_id is null then
    raise exception 'Unable to resolve requesting member for this inspection department.';
  end if;

  select lower(coalesce(m.role, '')) = 'administrator'
  into v_is_administrator
  from public.members m
  where m.id = v_requester_id;

  if not coalesce(v_is_administrator, false) then
    raise exception 'Only a department administrator can delete a drug box inspection.';
  end if;

  delete from public.drug_box_checklist_results r
  where r.inspection_id = v_inspection.id
    and r.department_id = v_inspection.department_id;

  get diagnostics v_results_deleted = row_count;

  delete from public.drug_box_inspections i
  where i.id = v_inspection.id
    and i.department_id = v_inspection.department_id;

  return jsonb_build_object(
    'inspection_id', v_inspection.id,
    'deleted', true,
    'results_deleted', v_results_deleted
  );
end;
$$;

revoke all on function public.delete_drug_box_inspection(uuid) from public;
revoke all on function public.delete_drug_box_inspection(uuid) from anon;
grant execute on function public.delete_drug_box_inspection(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Red Oak seed: the four squad boxes + the shared checklist template.
--    Idempotent; scoped to department 82f50d14-216a-4dd1-80f4-58459dc97b97.
-- ---------------------------------------------------------------------------

insert into public.drug_boxes (department_id, squad_number, display_name, is_active)
select seed.department_id, seed.squad_number, seed.display_name, true
from (
  values
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, '114', 'Drug Box — Squad 114'),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, '115', 'Drug Box — Squad 115'),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, '116', 'Drug Box — Squad 116'),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, '117', 'Drug Box — Squad 117')
) as seed(department_id, squad_number, display_name)
where exists (select 1 from public.departments d where d.id = seed.department_id)
on conflict (department_id, squad_number) do nothing;

insert into public.drug_box_checklist_items (department_id, section_name, item_label, required_quantity, source_quantity_text, is_active, display_order)
select seed.department_id, seed.section_name, seed.item_label, seed.required_quantity, seed.source_quantity_text, true, seed.display_order
from (
  values
    -- Section 1 (first band) — left column then right column
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Section 1', 'Epi 1:10,000 1mg prefilled', 6, '6', 0),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Section 1', 'Lidocaine 100mg prefilled', 3, '3', 1),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Section 1', 'Dextrose 50% 25gm prefill', 2, '2', 2),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Section 1', 'Glucagon 1mg Vial', 1, '1', 3),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Section 1', 'Insta Glucose 24gm tube', 1, '1', 4),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Section 1', 'Sodium Bicarb 50mEq prefill', 1, '1', 5),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Section 1', '20cc syringe', 2, '2', 6),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Section 1', '10cc syringe', 2, '2', 7),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Section 1', '5cc syringe', 2, '2', 8),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Section 1', 'Narcan 2mg prefilled', 2, '2', 9),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Section 1', 'Mag Sulfate 2gm Premix Bag', 2, '2', 10),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Section 1', 'Atropine 1mg prefilled', 4, '4', 11),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Section 1', 'Fentanyl (max of 400mcg)', 1, 'max of 400mcg', 12),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Section 1', 'Morphine Sulfate 10mg (max of 20mg)', 2, '2 (max of 20mg)', 13),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Section 1', 'Versed 10mg vial', 2, '2', 14),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Section 1', 'Ketamine 500mg vial', 2, '2', 15),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Section 1', 'Nebulizer setups', 2, '2', 16),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Section 1', 'Minidrip Sets', 2, '2', 17),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Section 1', 'Prefilled Saline flush & veni loop', 1, '1', 18),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Section 1', 'Lidocaine 2gm/500ml premix', 1, '1', 19),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Section 1', 'Dopamine 400mg/250ml Premix IV', 1, '1', 20),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Section 1', 'D10W 250mL', 2, '2', 21),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Section 1', 'D5W 250 ml', 1, '1', 22),
    -- Section 2 (second band)
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Section 2', 'Carpujet', 1, '1', 23),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Section 2', 'Thiamine 200mg vial', 1, '1', 24),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Section 2', 'Diphenhydramine 50mg vial', 1, '1', 25),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Section 2', 'Romazicon .5mg vial', 2, '2', 26),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Section 2', 'Zofran 4mg vial', 2, '2', 27),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Section 2', 'Tranexamic Acid 1,000mg vial', 1, '1', 28),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Section 2', '18G x 1 ½" filtered needle', 2, '2', 29),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Section 2', 'Epi 1:1,000 1mg ampule', 2, '2', 30),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Section 2', 'Cordarone 150mg vial', 3, '3', 31),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Section 2', 'Adenosine 6mg vial', 3, '3', 32),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Section 2', 'Nitro Spray .4mg spray', 1, '1', 33),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Section 2', 'ASA 81mg chewable', 1, '1 bottle', 34),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Section 2', '100mL Normal Saline 0.9%', 1, '1', 35),
    -- Section 3 (third band)
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Section 3', 'Albuterol 2.5mg/3.0ml', 2, '2', 36),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Section 3', 'Racemic Epi 2.25%/3ml', 1, '1', 37),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Section 3', '1cc syringe', 2, '2', 38),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Section 3', '3cc syringe', 2, '2', 39),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Section 3', 'Mad Device', 2, '2', 40),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Section 3', '25 x 5/8 needle', 2, '2', 41),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Section 3', '18 x 1 ½ needle', 4, '4', 42),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Section 3', '23 x 1 needle', 3, '3', 43),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Section 3', 'Solu-Medrol 125 mg vial', 1, '1', 44),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Section 3', 'Etomidate 40 mg vial', 1, '1', 45),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Section 3', 'Rocuronium 50mg vial', 3, '3', 46),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Section 3', 'Lopressor 5mg vial', 2, '2', 47),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Section 3', 'Labetalol 100mg vial', 1, '1', 48),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Section 3', 'Catheter setups 16-18-20', 3, '3', 49),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Section 3', 'Catheter setups 2-22, 2-24', 1, '1', 50),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'Section 3', '2 x10cc 1x20cc syringes 3x18G Needles', 1, '1', 51),
    -- EZ-IO (labeled block)
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'EZ-IO', 'Pressure Infuser', 1, '1', 52),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'EZ-IO', '3cc syringes', 2, '2', 53),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'EZ-IO', 'Xylocaine-MPF 2% 100mg vial', 2, '2', 54),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'EZ-IO', '15g x 15mm pedi needle (pink)', 2, '2', 55),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'EZ-IO', '15g x 25mm adult needle (blue)', 2, '2', 56),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'EZ-IO', '10cc prefilled saline flush', 1, '1', 57),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'EZ-IO', '10cc Syringes', 2, '2', 58),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'EZ-IO', '18g x 1 ½" needle', 2, '2', 59),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'EZ-IO', 'Drill driver', 1, '1', 60),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'EZ-IO', '15gx45mm (obese) needle', 1, '1', 61),
    ('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, 'EZ-IO', 'alcohol wipes & IO start tags', 1, '1', 62)
) as seed(department_id, section_name, item_label, required_quantity, source_quantity_text, display_order)
where exists (select 1 from public.departments d where d.id = seed.department_id)
on conflict (department_id, lower(btrim(section_name)), lower(btrim(item_label))) do nothing;
