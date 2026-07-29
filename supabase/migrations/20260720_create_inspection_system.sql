-- ============================================
-- Redline HQ Inspection System
-- ============================================

-- ============================================
-- Inspection Forms
-- One form per apparatus type or department
-- ============================================

create table if not exists inspection_forms (
    id uuid primary key default gen_random_uuid(),

    department_id uuid references departments(id) on delete cascade,

    name text not null,

    apparatus_type text not null,

    active boolean not null default true,

    created_at timestamptz not null default now()
);

create index if not exists inspection_forms_department_idx
on inspection_forms(department_id);


-- ============================================
-- Inspection Items
-- Every inspection item is a row
-- ============================================

create table if not exists inspection_items (
    id uuid primary key default gen_random_uuid(),

    inspection_form_id uuid
        references inspection_forms(id)
        on delete cascade,

    display_order integer not null,

    label text not null,

    required boolean not null default true,

    created_at timestamptz not null default now()
);

create index if not exists inspection_items_form_idx
on inspection_items(inspection_form_id);


-- ============================================
-- Completed Inspections
-- One record every time a firefighter performs
-- an inspection.
-- ============================================

create table if not exists inspections (
    id uuid primary key default gen_random_uuid(),

    apparatus_id uuid
        references apparatus(id)
        on delete cascade,

    member_id uuid
        references members(id)
        on delete set null,

    inspection_form_id uuid
        references inspection_forms(id)
        on delete restrict,

    inspection_date date not null,

    started_at timestamptz default now(),

    completed_at timestamptz,

    status text not null default 'in_progress'
        check (status in ('in_progress', 'completed')),

    notes text
);

create index if not exists inspections_apparatus_idx
on inspections(apparatus_id);

create index if not exists inspections_member_idx
on inspections(member_id);

create index if not exists inspections_date_idx
on inspections(inspection_date);


-- ============================================
-- Inspection Results
-- One answer for every inspection item.
-- ============================================

create table if not exists inspection_results (
    id uuid primary key default gen_random_uuid(),

    inspection_id uuid
        references inspections(id)
        on delete cascade,

    inspection_item_id uuid
        references inspection_items(id)
        on delete cascade,

    passed boolean not null,

    notes text
);

create index if not exists inspection_results_inspection_idx
on inspection_results(inspection_id);

create index if not exists inspection_results_item_idx
on inspection_results(inspection_item_id);