# Validation Project — Safe Rebuild & Replay Procedure (REVIEW ONLY)

**Status:** Prepared, not executed. No hosted database has been modified.
**Target project:** `redline-pediatric-validation` — ref `zkxsrkpwuzgjppogtnss`
**Never touch:** production `dkyjtocanutceafywdcd` (also linked from `redline-hq/supabase/.temp/`)

---

## 1. Why a wipe-and-replay is safe here (verified, not assumed)

The validation project currently contains:
- Stub `departments` / `members` tables (from the review-only bootstrap — **not** the production shape), and
- Red Oak validation data: 1 department row, 4 pediatric bags, 4 drug boxes, and their checklist items (backed up in `~/redline-validation-backup/`, 164 rows total, verified complete).

Key finding that makes this safe: **every backed-up row is recreatable by the existing migrations themselves.** The pediatric/drug-box seed migrations insert generated IDs guarded by the Red Oak department's presence. The only fixed value is the Red Oak department UUID, restored with one insert (§4 step 3). No other production or hand-entered data exists in this project.

## 2. Pre-flight verification (read-only, run FIRST, abort on any mismatch)

From the workspace root (which is linked to the validation project — NOT redline-hq/):

```bash
# 1. Confirm the CLI is talking to the validation project
supabase migration list --linked 2>&1 | head -5
#   → must connect to zkxsrkpwuzgjppogtnss; if it errors or shows the
#     production ref, STOP.

# 2. Positive gate — run via SQL editor on the validation project:
select current_setting('request.jwt.claims', true) is not null;  -- connectivity
select count(*) from departments;        -- expect: 1 (Red Oak)
select count(*) from pediatric_bags;     -- expect: 4
select count(*) from drug_boxes;         -- expect: 4
select count(*) from members;            -- stub members (any count)
```

Abort if the department count is not exactly 1 or if the project ref is wrong.

## 3. Wipe (the only destructive step — validation project only)

Complete loss inventory (verified against the bootstrap, migrations, and
backups — nothing else exists on this project):

| Object | Fate | Restored by |
|---|---|---|
| Stub `departments` / `members` tables | dropped | baseline migration (real shape) |
| Stub `member_has_app_permission()` | dropped | real version in migration 20260820060000 |
| Red Oak department row | dropped | §4 step 1 insert (fixed UUID from backup) |
| Pediatric bags/items + drug boxes/items (164 rows) | dropped | seed migrations re-run in §4 step 2 |
| Session/inspection/progress/result tables | dropped | were empty — no test runs were ever recorded |
| Storage buckets | **unaffected** (buckets live in the `storage` schema; the wipe drops only `public`) — and none were ever created on this project per the validation plan | n/a |

In the validation project's SQL Editor:

```sql
-- Validation project ONLY. Drops all public-schema user objects so the
-- replay starts from a truly empty database.
drop schema public cascade;
create schema public;
grant all on schema public to postgres;
grant usage on schema public to anon, authenticated, service_role;
```

## 4. Replay + restore

```bash
# From the workspace root (validation-linked):
cd "/Users/adamsmith/Documents/Redline HQ"
# Copy the migration set into place for the root link if needed, then:
supabase migration up --linked --include-all
```

Then in the validation SQL Editor:

```sql
-- 1. Restore the Red Oak department (fixed UUID — the one piece of identity
--    the seed migrations expect).
insert into public.departments (id, name, created_at)
values ('82f50d14-216a-4dd1-80f4-58459dc97b97',
        'Red Oak Fire Department',
        '2026-10-17 01:47:58.883596+00')
on conflict (id) do nothing;

-- 2. Re-run the two seed migrations in full (both are idempotent; see note
--    below):
```

**Ordering note:** `supabase migration up` runs the pediatric/drug-box seeds
*before* the department row exists, so their guards no-op. After restoring the
department, re-run the two migrations' seed sections. Because both migrations
are fully idempotent (`on conflict do nothing` / not-exists guards on every
insert), the simplest correct method is to re-run both migration files in full
in the SQL Editor — every statement is `create table if not exists` /
`create index if not exists` / `create or replace` / guarded insert, so a second
run changes nothing except landing the previously-skipped seeds:

1. Run the full contents of `redline-hq/supabase/migrations/20261016120000_create_pediatric_bag_checklist_foundation.sql`
2. Run the full contents of `redline-hq/supabase/migrations/20261018120000_create_drug_box_inspection_foundation.sql`

## 5. Post-restore verification (must all pass)

```sql
select count(*) from departments;                       -- 1
select name from departments;                           -- Red Oak Fire Department
select count(*) from pediatric_bags;                    -- 4
select count(*) from pediatric_bag_checklist_items;     -- 87
select count(*) from drug_boxes;                        -- 4
select count(*) from drug_box_checklist_items;          -- 63
select count(*) from information_schema.tables
  where table_schema = 'public';                        -- ~127 (full app schema)
-- Spot-check the fail-loud baseline post-check ran (it would have aborted
-- the replay if foundation columns were missing).
```

Row counts may differ by ±0 if the migrations' item lists changed since the
backup; a difference means the *migration* is the source of truth, not the
backup — flag it rather than forcing a match.

## 6. Known limitations of this test environment

- `generate_deficiency_number()` is the marked placeholder (real logic exists
  only in production). Deficiency numbering on validation will be nulls.
- Lookup seed rows (deficiency statuses/priorities/categories) are not in the
  backup or migrations — the deficiencies UI dropdowns will be empty until
  seeded separately.
- Cedar Bluff demo department will be created by its migration (fresh UUIDs).
  Harmless on a disposable project; delete later if unwanted.

## 7. Rollback

If anything fails mid-replay: this is a disposable project. Re-run §3 wipe and
start over. The backup in `~/redline-validation-backup/` remains untouched and
sufficient to restore the pre-rebuild state (bootstrap + seeds are all
re-derivable from repo files).
