-- ===========================================================================
-- Create the deficiency-photos storage bucket (the one bucket never created
-- by any migration — it was made by hand in the production dashboard).
--
-- Idempotent: safe to run against a project where the bucket already exists.
-- SECURITY: private (public = false), matching the access model enforced by
-- the storage RLS policies added later (20260912290000 et al.), which gate
-- reads/writes by department path prefix. File-size / MIME limits are left at
-- project defaults — production limits were dashboard-configured and are
-- documented in the staging runbook, not here.
-- ===========================================================================

insert into storage.buckets (id, name, public)
values ('deficiency-photos', 'deficiency-photos', false)
on conflict (id) do nothing;
