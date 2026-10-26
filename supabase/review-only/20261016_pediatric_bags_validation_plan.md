# Pediatric Bags — Validation Plan (Review Only)

**Status:** REVIEW ONLY — not executed. No SQL has been run against any database.

**Scope:** Validate the Pediatric Bags migration
`supabase/migrations/20261016120000_create_pediatric_bag_checklist_foundation.sql`
on the separate `redline-pediatric-validation` Supabase project only.

**Never touch:** production project `dkyjtocanutceafywdcd`.

---

## 0. Pre-flight checks (run these FIRST, before applying anything)

### 0.1 HARD STOP — verify the connection target is the validation project

This is a **scripted, blocking gate**, not a manual visual check. No SQL may run
until the target is positively verified to be `redline-pediatric-validation` and
positively verified NOT to be production.

The Supabase project reference is embedded in the database host
(`db.<project-ref>.supabase.co`). Run this as the very first statement on the
connection and require it to return exactly one row confirming the validation
project:

```sql
-- HARD STOP. Returns ok=true ONLY on the validation project.
-- Anything else (false, no rows, or an error) => ABORT. Do not run any
-- further SQL. Re-point the connection and re-run this check.
with host as (
  select inet_server_addr() is not null as has_server,
         current_setting('app.settings', true) as app_settings -- may be null
),
ref as (
  -- The project ref is recoverable from the Supabase database name/host.
  -- Prefer an explicit allow-list check below.
  select current_database() as dbname
)
select
  case
    when current_database() is not null
      -- POSITIVE match required. Replace '<VALIDATION_REF>' with the actual
      -- redline-pediatric-validation project ref before running.
      and '<VALIDATION_REF>' <> 'dkyjtocanutceafywdcd'   -- never production
      and '<VALIDATION_REF>' <> ''                        -- must be filled in
    then true
    else false
  end as ok;
```

Because a raw SQL connection cannot reliably read its own Supabase project ref,
the authoritative verification is:

1. Obtain the validation project's reference from the Supabase dashboard
   (project `redline-pediatric-validation` → Settings → General → Reference ID).
2. Confirm it differs from `dkyjtocanutceafywdcd`.
3. Confirm the connection string/host being used contains THAT reference
   (`db.<ref>.supabase.co`) — string comparison, exact match.
4. Only then proceed. If the reference cannot be positively confirmed (e.g. a
   pooled/proxied host hides it), **STOP** — do not run any SQL until the target
   is verified by exact host match.

**Limitation (documented):** if the only available connection method cannot
reliably surface the project ref to an automated check, an explicit, verified
manual host-match against the dashboard Reference ID is REQUIRED before any SQL
runs. That manual check is a hard prerequisite, not a courtesy.

### 0.2 Bootstrap object pre-flight

The bootstrap uses `IF NOT EXISTS` / `CREATE OR REPLACE`, which will **silently
no-op** if an incompatible object already exists. On a fresh project this is a
formality, but we convert the silent-acceptance risk into an explicit assertion.

Run these read-only checks against the **validation project** and confirm each
returns the expected "empty" result before proceeding:

```sql
-- All three must return NULL / no rows on a fresh project.
select to_regclass('public.departments');          -- expect: null
select to_regclass('public.members');              -- expect: null
select proname from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname = 'member_has_app_permission';    -- expect: no rows
```

**If any return a value, STOP** — the project is not empty and the bootstrap could
silently accept an incompatible shape. Investigate before continuing.

---

## 1. Bootstrap application order

1. Confirm the active CLI/connection target is the **validation** project and its
   reference is NOT `dkyjtocanutceafywdcd`.
2. Apply `supabase/review-only/20261016_pediatric_bags_validation_bootstrap.sql`.
3. Apply the pediatric migration
   `supabase/migrations/20261016120000_create_pediatric_bag_checklist_foundation.sql`.

---

## 2. Test-member setup (required for the completion RPC)

The completion RPC (`complete_pediatric_bag_check`) must resolve the calling
user to an active `members` row in the bag's department, or it raises
"Unable to resolve requesting member". The bootstrap creates no members, so we
must insert **test-only** rows.

All test data below is **validation-only** and clearly fictional. Use a dedicated
test auth user id (a generated UUID) — not a real person's account.

```sql
-- TEST-ONLY DATA (validation project only). Not real people.
-- A fixed test auth user id for the simulated session.
-- (Generated once; referenced by the simulated JWT claims in section 3.)
-- Example value: '11111111-1111-4111-8111-111111111111'

-- Red Oak administrator member linked to the simulated auth identity.
insert into public.members (id, department_id, first_name, last_name, email, role, auth_user_id, active)
values (
  '22222222-2222-4222-8222-222222222222',
  '82f50d14-216a-4dd1-80f4-58459dc97b97',  -- Red Oak (seeded by bootstrap)
  'Test', 'Admin',
  'test-admin@validation.example',
  'administrator',
  '11111111-1111-4111-8111-111111111111',  -- simulated auth user id
  true
);

-- A second department + member for cross-department isolation tests.
insert into public.departments (id, name)
values ('33333333-3333-4333-8333-333333333333', 'Test Other Department (validation)')
on conflict (id) do nothing;

insert into public.members (id, department_id, first_name, last_name, email, role, auth_user_id, active)
values (
  '44444444-4444-4444-8444-444444444444',
  '33333333-3333-4333-8333-333333333333',
  'Test', 'Other',
  'test-other@validation.example',
  'administrator',
  '55555555-5555-4555-8555-555555555555',  -- a DIFFERENT simulated auth user id
  true
);
```

---

## 3. Simulated Auth identity (`auth.uid()` / `auth.email()`) — under a non-privileged role

The RLS policies and RPCs read `auth.uid()` and `auth.email()`. On the
validation project we simulate the caller's identity for the duration of a test
transaction.

### 3.1 CRITICAL — RLS tests must run as a role that actually respects RLS

Setting `request.jwt.claims` only changes what `auth.uid()` / `auth.email()`
return. It does **not** change the database role. The Supabase SQL editor and a
direct `postgres` connection run as a privileged role that has `BYPASSRLS` (or
owns the tables), which **ignores RLS entirely**. A cross-department query that
returns 0 rows under such a role proves NOTHING about the policies.

Therefore, every RLS and cross-department test MUST run as a **non-privileged,
RLS-respecting role**. Two acceptable methods:

- **Preferred — PostgREST (Data API):** issue the request through the validation
  project's REST endpoint as an `authenticated`-role request carrying a signed
  test JWT. PostgREST maps the JWT to the `authenticated` role, which respects
  RLS.
- **SQL alternative — drop to the `authenticated` role in-transaction:**

```sql
begin;
-- Drop from the privileged role to the RLS-respecting `authenticated` role.
set local role authenticated;
-- Confirm the role cannot bypass RLS (see verification below).
select current_role;  -- expect: authenticated

-- Now simulate the Red Oak admin identity.
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","email":"test-admin@validation.example","role":"authenticated"}',
  true);

-- ... run the RLS / RPC checks here ...
rollback;
```

### 3.2 How the method is verified (so we know RLS is really being enforced)

Before trusting any RLS result, prove the role respects RLS:

```sql
-- 1. The active role must NOT be a superuser / BYPASSRLS.
select rolname, rolbypassrls, rolsuper
from pg_roles
where rolname = current_role;
-- expect for the test role: rolbypassrls = false, rolsuper = false

-- 2. Sanity probe: with RLS enabled and NO matching member for the simulated
--    identity, a select on a pediatric table must return 0 rows (RLS denied).
--    If it returns rows, RLS is being bypassed and ALL results are void — STOP.
```

Any RLS/isolation result produced as `postgres`, a superuser, or a `BYPASSRLS`
role is **invalid** and must be re-run under a compliant role.

### 3.3 What this CAN prove
- The RLS **policy logic** correctly matches a member's `department_id` and
  `auth_user_id`/`email` to the row's `department_id`, when enforced.
- The completion RPC's member-resolution and department-ownership checks behave
  correctly.

### 3.4 What this CANNOT prove (no false sense of security)
- It does **not** exercise a real Supabase Auth login/session token, JWT signing,
  or the GoTrue layer.
- It does **not** prove the policies hold under a real authenticated browser
  session.
- **Therefore:** one real logged-in cross-department check remains REQUIRED at the
  production gate (see section 6).

---

## 4. Test scenarios

### 4.1 Schema / structure (confirmed DB behavior)
- All six pediatric tables exist with expected columns.
- The four composite FKs `(…, department_id) → pediatric_bags(id, department_id)`
  create cleanly (proves the unique-index fix).
- `pgcrypto` present; `gen_random_uuid()` defaults work.

### 4.2 Seeding (confirmed DB behavior)
- Exactly 4 bags (A/B/C/D) for Red Oak; `unique(department_id, bag_label)` holds.
- Exactly 87 checklist items across the 17 sections in source order.
- Both Alcohol Preps rows have `required_quantity IS NULL` and
  `source_quantity_text = '***'`.
- **Idempotency:** re-running the seed leaves 4 bags + 87 items (no duplicates).

### 4.3 Completion safeguards (simulated-auth policy behavior)
As the simulated Red Oak admin:
- `complete_pediatric_bag_check` with `ready` while Alcohol Preps are unresolved
  → **raises** (cannot falsely mark Ready for Service).
- Same check with `needs_attention` → **allowed** (honest "Needs Review").
- A deficiency-marked confirmed item + `ready` → **raises**.
- All confirmed items marked + all quantities resolved + `ready` → **allowed**
  (only after a test updates the two Alcohol Preps quantities, as a controlled
  scenario).

### 4.4 Administrator access (simulated-auth policy behavior)
- A Red Oak `role='administrator'` member can read and manage the template/bags
  (exercises the RLS role fallback while the permission stub returns false).

### 4.5 Cross-department isolation (simulated-auth policy behavior — REQUIRES compliant role)

**These tests are valid ONLY under the non-privileged, RLS-respecting role
defined in section 3.1–3.2.** Run them as the simulated "other department"
member, after verifying the role does not bypass RLS:

- Cannot read Red Oak bags, template, progress, inspections, or results.
- Cannot write Red Oak rows.
- The completion RPC raises for a Red Oak bag.

Any result produced as `postgres` / superuser / `BYPASSRLS` is void and must be
re-run under the compliant role.

### 4.6 NOT covered (permission-granted path)
- The non-admin `inventory_management` permission path is **untested** because the
  bootstrap's `member_has_app_permission()` is hard-coded to `false`. This path is
  covered indirectly by the administrator role path plus existing unit tests.
  Flag it explicitly in results.

---

## 5. Results classification

Report every check under exactly one of these three headings:

1. **Confirmed database behavior** — table/FK/seed/constraint results that hold
   regardless of auth (sections 4.1, 4.2). These are real Postgres behavior.
2. **Simulated-auth policy behavior** — RLS/RPC results under a simulated JWT
   (sections 4.3, 4.4, 4.5). These prove policy *logic*, not a real session.
3. **Still required against production** — anything the validation project cannot
   prove (see section 6).

---

## 6. Checks still required against real production (deferred)

These MUST be verified with the real schema and a real login before production
sign-off. The validation project cannot prove them:

- A real authenticated Red Oak admin can complete a check end-to-end, and a real
  Elliott/Elliott-Volunteer/Cedar-Bluff user cannot see or touch Red Oak data.
- The real `member_has_app_permission()` grants the permission-based write path
  correctly (the stub does not test this).
- Interaction with the full production base schema (real `members` columns,
  triggers, existing RLS on shared tables).
- PostgREST schema-cache exposure of the new tables to the app.

---

## Safety notes
- This plan executes ONLY on the isolated validation project.
- No production object is read, linked, or modified.
- The bootstrap and migration files are unchanged by this plan.
