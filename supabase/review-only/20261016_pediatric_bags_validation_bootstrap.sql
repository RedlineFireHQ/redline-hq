-- ===========================================================================
-- REVIEW ONLY — DO NOT EXECUTE
-- ===========================================================================
-- Minimal bootstrap schema for validating the Pediatric Bags migration on the
-- separate `redline-pediatric-validation` Supabase project.
--
-- WHY THIS EXISTS:
-- The Pediatric Bags migration
--   (supabase/migrations/20261016120000_create_pediatric_bag_checklist_foundation.sql)
-- is NOT self-contained. It assumes a base schema that predates the local
-- migration history: public.departments, public.members (with specific
-- columns), and public.member_has_app_permission(). None of those are created
-- by any local migration, so the pediatric migration cannot run on a blank
-- database without this bootstrap.
--
-- SCOPE / SAFETY:
--   * Intended ONLY for the disposable validation project, NEVER production
--     (production ref dkyjtocanutceafywdcd must not be touched).
--   * This file creates STUB versions of the real production objects. They are
--     deliberately minimal and are NOT the real production schema.
--   * Non-destructive: only CREATE ... IF NOT EXISTS / CREATE OR REPLACE. No
--     DROP, DELETE, UPDATE, TRUNCATE, or ALTER of existing data.
--
-- STUBBED BEHAVIOR (validation-only, does NOT mirror production logic):
--   * member_has_app_permission() is a stub returning a fixed value. It does
--     NOT evaluate real department role/permission grants.
--   * members/departments here carry only the columns the pediatric migration
--     references, not the full production column set.
-- ===========================================================================

-- 1. Extension required by gen_random_uuid() primary-key defaults.
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 2. departments — only the column the pediatric migration references (id).
-- ---------------------------------------------------------------------------
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. members — only the columns the pediatric migration references:
--    id, department_id, email, role, auth_user_id, active.
--    (created_at added only so the seed can order/predict; not required.)
-- ---------------------------------------------------------------------------
create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  department_id uuid references public.departments (id) on delete cascade,
  first_name text,
  last_name text,
  email text,
  role text,
  auth_user_id uuid,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. member_has_app_permission(department_id, permission_key) — STUB.
--    The real function evaluates department role/permission grants. This stub
--    returns FALSE by default, which exercises the migration's RLS fallback
--    path (role = 'administrator') without granting any permission. Flip to
--    TRUE in a specific validation scenario only if you want to exercise the
--    permission-granted path.
-- ---------------------------------------------------------------------------
create or replace function public.member_has_app_permission(
  p_department_id uuid,
  p_permission_key text
)
returns boolean
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  -- STUB: validation-only. Does NOT evaluate real permissions.
  return false;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Seed the Red Oak department row the migration's seed targets.
--    The pediatric migration seeds bags/template only for this department id.
-- ---------------------------------------------------------------------------
insert into public.departments (id, name)
values ('82f50d14-216a-4dd1-80f4-58459dc97b97', 'Red Oak Fire Department')
on conflict (id) do nothing;

-- ===========================================================================
-- END OF BOOTSTRAP — REVIEW ONLY, DO NOT EXECUTE
-- ===========================================================================
