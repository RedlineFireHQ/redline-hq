-- ===========================================================================
-- REVIEW ONLY — DO NOT EXECUTE FROM THE REPOSITORY
-- ===========================================================================
-- Purpose: capture the three deficiency lookup lists from PRODUCTION so the
-- rebuilt validation/staging database can report deficiencies (the app aborts
-- deficiency inserts when no "Open" status exists).
--
-- Safety:
--   * SELECT-only. No inserts, updates, deletes, or DDL.
--   * These are configuration lists, not customer data (no people, no
--     departments, no operational records).
--   * Column lists below match the production schema export exactly, so each
--     query selects only columns that exist.
--
-- How to run (you run these — in the PRODUCTION project's SQL Editor):
--   1. Open the production project (dkyjtocanutceafywdcd) → SQL Editor →
--      New query.
--   2. Paste and run ONE section at a time.
--   3. Use "Download results as CSV" after each run and save the three files.
--   4. Share the files (or their contents) — I will turn them into a seed
--      migration with fixed IDs so staging/validation match production.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Deficiency statuses (the "Open" row is required for reporting to work)
-- ---------------------------------------------------------------------------
select
  name,
  description,
  display_order,
  active
from public.deficiency_statuses
order by display_order;

-- ---------------------------------------------------------------------------
-- 2. Deficiency priorities
-- ---------------------------------------------------------------------------
select
  name,
  description,
  display_order,
  active
from public.deficiency_priorities
order by display_order;

-- ---------------------------------------------------------------------------
-- 3. Deficiency categories
-- ---------------------------------------------------------------------------
select
  name,
  description,
  display_order,
  active
from public.deficiency_categories
order by display_order;

-- ===========================================================================
-- Expected result: a small handful of rows per table (single digits each).
-- If any table returns ZERO rows, stop and tell me — that changes the plan.
-- ===========================================================================
