-- ==========================================================
-- Redline HQ
-- Inspection Results
-- Migration 001
-- ==========================================================

create table if not exists inspection_results (

    id uuid primary key default gen_random_uuid(),

    daily_check_id bigint not null references daily_checks(id) on delete cascade,

    inspection_item text not null,

    passed boolean not null,

    comment text,

    photo_url text,

    created_at timestamptz not null default now()

);

create index if not exists idx_inspection_results_daily_check
on inspection_results(daily_check_id);