# Fire hose test dates - local candidate, not released

## Existing implementation and root cause

`fire_hose.last_test_date` and `fire_hose.next_test_date` already exist.
Despite its name, migration `20260809040000_sync_fire_hose_last_test_date.sql`
only adds the last-test column; it does not install a synchronization trigger.
The inventory did not select/display last-test dates.

Both desktop sessions and mobile Quick Test previously updated inventory dates
before inserting history, advanced next-test dates for failures, and calculated
anniversaries in JavaScript. Partial saves could leave dates without saved
history. Desktop Create Deficiencies also saved results before Finish.

## Proposed implementation

Both Finish actions call `complete_fire_hose_test` once. The security-invoker
PostgreSQL function retains caller RLS, locks selected hoses in stable order,
inserts the session and results, and updates inventory in the same transaction.
Any rejected result, denied write or database error rolls everything back.
There is no service-role client and no policy/permission change.

The function explicitly requires trusted department membership and the existing
`fire_hose_inspection_testing` permission (or its existing inventory-management
override), in addition to the unchanged RLS checks on every operation.

Passing results use the greatest passing test date in matching sessions marked
`completed_at` by the new atomic operation. Legacy sessions remain unmarked and
are excluded, including future-dated legacy passes. An existing newer inventory
last-test date protects BOTH existing dates from backdated submissions; it is not
silently treated as incorrect or recalculated. Next Test Date for a winning new
completion is that date plus one calendar year. February 29 becomes
February 28 in a non-leap year, with no timezone conversion. Older backdated
tests remain in history without regressing dates. Failed results retain both
dates and mark the hose Out of Service; active deficiencies remain blocking.
Starting, abandoning and navigating to create deficiencies save no test results.

Initial inventory loads and client refreshes select the existing date column.
The seven columns put Last Test Date between In Service Date and Next Test Date.
Test dates display the day, month and year. Overdue next dates retain the actual
date plus an Overdue label; existing due filters/count rules remain unchanged.
Small screens scroll within the table instead of compressing seven columns.

## Approval required: draft database migration

`20261105193000_complete_fire_hose_tests_atomically.sql` has NOT been applied to
Production. It adds one RPC, grants execution to authenticated users only, and
adds nullable `fire_hose_testing_sessions.completed_at` with no default or
historical population. It does NOT backfill dates, update existing inventory
rows, delete history, change RLS or change existing statuses.

ALL existing rows retain their stored dates on migration;
a missing last date displays `-` and a missing next date displays `Pending`.
Legacy pass/session matching is insufficient completion evidence: the deployed
Create Deficiencies action saved tests before Finish, and abandoned sessions
could retain passing results. Departments must verify or separately reconcile
missing historical dates. No historical-date editing feature is added here.

The removed proposal was previewed with Production GET requests only. Two full
reads agreed: it would have changed 27 hoses (Cedar Bluff Fire & Rescue 8,
Elliott Fire Department 19, both other departments 0). The private session
artifact `hose-backfill-production-readonly-preview.json` lists exact hose IDs,
inventory numbers, old/proposed dates and supporting history IDs by department.
The revised migration changes zero existing inventory dates in every department.
`supabase/tests/fire_hose_legacy_backfill_preview.sql` reproduces the removed
proposal as a read-only grouped query; it is NOT a recommended backfill.

The migration must be approved and applied before releasing the application
changes. Without the RPC, Finish shows an error rather than falling back to the
unsafe old save flow. Rollback of a release should retain the corrected historical
dates and history, not reverse or delete customer records.

## Local validation

Use synthetic fixtures only. The SQL integration fixture runs in a disposable
network-isolated PostgreSQL container; it never uses customer data or credentials.
Run `npx tsx --test lib/fire-hose-testing.test.ts`, TypeScript, focused ESLint and
the production build. SQL cases cover migration preservation, pass/fail, abandonment,
subsequent/backdated tests, atomic rollback, department isolation and leap years.

Work is isolated from the unrelated dirty main checkout and based on deployed
commit `149c1860fc7ed07a2f26b4122ff626e0e7781bbf`. No commit or release is authorized.

### Results

- TypeScript and the production build passed.
- All six original application tests passed again, plus one new migration
  regression (seven total). The original timezone checks remain applicable.
  The original 23 SQL checks were repeated (replacing the unsafe backfill
  expectation with preservation); ten focused cases increased the passing
  assertion count to 33. A separate two-connection concurrency check passed.
- The actual desktop and mobile Finish buttons were tested against synthetic
  PostgreSQL data: desktop saved November 5, 2026 / November 5, 2027; mobile saved
  November 6, 2026 / November 6, 2027. Each used one completion RPC and appended
  the expected history. Start, mark, summary, Cancel and Create Deficiencies
  issued no completion RPC. Missing required deficiencies blocked Finish.
- Final review repeated desktop completion with November 5, 2026 / November 5,
  2027. Mobile completion with November 6, 2029 / November 6, 2030 passed; an
  earlier backdated mobile submission correctly retained a newer completed date.
  Both created marked sessions with one RPC per Finish. The real inventory
  page's due count changed from 2 to 1 after desktop Finish in the final fixtures.
- In the initial implementation test the due count changed from 1 to 0 after the passed test
  and asynchronous server refresh. Existing history reports and mobile inventory
  continue to consume the same persisted fields, not another calculated source.
- At a 1440-pixel viewport, all seven columns fit without horizontal scrolling.
  At 390 pixels, the 960-pixel table scrolled within its container and the page
  itself did not overflow. This used emulator Chrome viewport emulation, not a
  physical phone; the installed Redline app was not redirected.
- Raw focused lint reports five errors and one warning in
  `InventoryCategoryWorkspace.tsx`. Their rule/message signatures are identical
  to the deployed baseline: state updates in effects, declaration order,
  effect dependencies and an unescaped apostrophe. No new lint findings were
  introduced. The other four checked source/test files are lint-clean.

The existing lint failures remain a release-check concern; they were not
silenced or repaired as unrelated work. Raw lint is NOT green. A release must
explicitly resolve the lint gate or accept a baseline-only exception; this
review does not authorize either. Production was only read for the preview,
never migrated or changed.

## Final recommendation

- OMIT historical backfill: saved legacy passes are not completion evidence.
- The revised, no-backfill migration is suitable for approval with its new
  nullable completion marker and preservation semantics understood.
- Both application completion paths use the RPC; inventory add/edit/retire
  payloads do not write either date, and no other hose completion writer was found.
- No permissions, grants on existing tables or RLS policies are removed/widened.
  Tests use synthetic membership/policy fixtures, not a clone of Production's
  entire policy stack; a live policy/schema preflight remains a release step.
- NO-GO for immediate Production release: approval is absent and raw lint still
  fails. Production schema/RPC deployment and live workflow have not been tested.
  Existing authorized direct table writes remain allowed by existing policies;
  this does not retroactively block old cached clients. Release must refresh old
  tabs so they use the revised Finish flow.

## Files and fields

- `app/inventory/fire-hose/page.tsx`: initial query, seventh column, date mapping.
- `components/inventory/InventoryCategoryWorkspace.tsx`: refresh query, display,
  final-save integration, no premature save before deficiency navigation.
- `components/mobile/MobileHoseQuickTest.tsx`: shared atomic final-save integration.
- `lib/fire-hose-testing.ts` and `.test.ts`: RPC contract, date display and tests.
- `supabase/migrations/20261105193000_complete_fire_hose_tests_atomically.sql`:
  draft transaction function and nullable completion marker; NO backfill.
- `supabase/tests/fire_hose_test_dates.sql`: disposable SQL fixture/regressions.
- `supabase/tests/fire_hose_legacy_backfill_preview.sql`: read-only removed-proposal preview.
- This document.

Inventory fields: `fire_hose.id`, `department_id`, `last_test_date`,
`next_test_date`, `status`; inventory details are not altered by completion.
History fields: session `id`, `department_id`, `test_date`, `tester`, new nullable
`completed_at`; result
`testing_session_id`, `department_id`, `hose_id`, `inventory_number`, `test_date`,
`tester`, `result`. Existing history rows are never updated or deleted.

## Supplied Production schema compatibility - November 5, 2026

The user supplied actual column names/types for the three hose tables and
confirmed that `completed_at` is absent. All RPC references to those tables
match: hose and history identifiers are UUIDs; test dates are dates; result,
tester and inventory number are text. The only added column is nullable
session `completed_at`. Numeric `hose_size` is compatible with the existing
desktop/mobile display code and is not modified by the RPC.

The SQL fixture originally inherited text `hose_size` from the old base
migration. It now uses numeric to match the supplied Production schema.
The history fixture already uses UUID keys and the supplied timestamp columns.
The migration is additive and performs no historical row updates or deletions.

Two local fail-closed safeguards were added: testing permission must be TRUE
(NULL is not authorization), and all submitted results must be visible and
match their saved marked session before inventory is updated. RLS-hidden or
trigger-skipped results now raise an error and roll back instead of returning
success with missing or stale date evidence. Existing RLS and grants on tables
are unchanged.

Latest focused checks: eight application tests, 38 SQL assertions using the
numeric-hose/UUID-history fixture, TypeScript, changed-test ESLint and
`git diff --check` passed. A fresh two-connection concurrency check also passed:
both histories saved and the older completion retained the newer dates.
No application source changed in this compatibility pass; the earlier production
build and desktop/mobile workflow results remain the prior validation evidence.

Column compatibility is confirmed against the supplied schema. Unconditional
Production approval is still NOT established by column lists: they do not
include deployed `auth.uid()` / `member_has_inventory_permission(uuid,text)`,
trusted membership and deficiency table definitions, effective RLS/grants,
UUID/timestamp defaults, constraints or trigger definitions. Repository
definitions and synthetic fixtures support the implementation but cannot prove
those omitted deployed objects. This is the specific evidence limitation, not
a request to run another SQL script. No Production connection or operation was
performed during this pass.

## Central calendar timezone correction - November 5, 2026

The original desktop modal and mobile Quick Test defaulted their date inputs
with `new Date().toISOString()`, taking the UTC day. After 6 PM Central Standard
Time that incorrectly selected tomorrow. The shared `hoseTestingDate` helper
now formats the instant using the existing application department timezone,
`America/Chicago`, independent of the server/browser timezone. This matches the
existing Central calendar convention; no per-department timezone database field
or new configuration is introduced. Both workflows use it only for defaults;
explicit input selections, resumed historical dates and RPC date payloads remain
unchanged. Due-day comparisons use the same department calendar.

The database calendar-year anniversary remains unchanged, including February
29 -> February 28. No new schema migration is required. Focused tests cover
the reported 6:24 PM rollover, Central midnight, summer time, DST boundaries,
leap day, host-timezone independence and selected historical dates.

Read-only Production preview identified two marked Cedar Bluff sessions at
6:31:47 PM and 6:32:46 PM Central on November 5, with six passing results and
six inventories carrying November 6 / November 6 next year. The exact
ID-scoped correction draft and snapshot are kept as private session artifacts,
not automatic migrations. Production record corrections require Adam's approval;
deployment of the code fix must not execute that draft.
