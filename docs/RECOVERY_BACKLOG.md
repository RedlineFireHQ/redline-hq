# SCBA Hydrostatic Production Preflight

## Status — 2026-11-22

- After the nulls-last ordering fix was deployed, the user refreshed the
  authenticated Production Deficiencies page and confirmed
  `DEF-2026-0243` appears under All. This confirms visibility of the existing
  record; it does not verify a new end-to-end deficiency submission or
  backfill the new hydro-result link.
- Follow-up screenshots show the desktop All and Open filters on the same
  Deficiencies page. All displays six undated, unknown-status records first;
  Open excludes them and displays `DEF-2026-0243` first. Both filters operate
  on the same fetched rows; All does not exclude the deficiency. A read-only
  check under the reporter's RLS context reproduces its positions: seventh
  under the original All ordering, first under Open, and first under the
  deployed nulls-last All ordering. The screenshot showing old ordering was
  taken after deployment; an already-loaded page may retain the prior client
  bundle, but this was not verified. Refreshing and visually confirming All
  remains necessary. The existing deficiency was not modified.
- Hydrostatic follow-up: Production deficiency `DEF-2026-0243` exists,
  belongs to Cedar Bluff, and is linked to cylinder `CB-CYL-005`; it has
  category SCBA, Open status, Critical priority and history. The reporting
  member can read it under Production RLS. Six undated deficiencies sorted
  ahead of it, placing it seventh in the scrolling list; sorting null report
  dates last places it first in a read-only test. This is a demonstrated
  visibility problem, not proof of exactly what the browser displayed.
  The existing record has no direct hydro-result reference because the
  original feature did not persist one.
- Follow-up changes match flow-test result colors, sort undated deficiency
  records last, and add an optional, department/cylinder-checked FK linking
  future hydro deficiencies to the failed result. The ordinary deficiency
  workflow remains in use; the cylinder is marked Out of Service only if
  selected. If that optional update fails after insertion, the UI links to
  the saved deficiency and prevents resubmission. Existing records are not
  automatically backfilled or duplicated. Migration
  `20261122210000_scba_hydro_deficiency_link` is additive.
- The follow-up migration and its ledger entry were applied atomically to
  Production. The composite FK, context check and validation trigger were
  verified; the original deficiency remains present and unchanged, with a
  null new result link. Linking that existing record to its identified test
  remains outstanding; no duplicate deficiency was created.
- Follow-up application commit `7647a4ebfaa464c843f31635b4557c1a421e1af4`
  reached READY as Vercel deployment `dpl_FnzqtgGp2PPKUqG3qzhPM1rtM6Mc` and
  was assigned `https://redlinefirehq.com`. A fresh integrated browser page
  also timed out, so actual list appearance and the end-to-end Cedar Bluff
  workflow still require verification. The database ordering test alone does
  not establish what the user sees.
- Validation: 73 focused tests, TypeScript, PostgreSQL 17 synthetic hydro and
  deficiency tests, and an isolated webpack production build passed. Full
  changed-file lint reported four errors and three warnings, all independently
  reproduced against the unchanged baseline in the two deficiency pages;
  remaining changed files lint clean. The VS Code browser connection timed
  out, so live list appearance, visual styling, and a real authenticated
  Cedar Bluff end-to-end run remain unverified.
- SCBA application commit `2d4a1b8d69f52b4959e3263416dbfb27a980c2f9`
  was pushed to `main`. Vercel Production deployment
  `dpl_JAYGaLgJCCgMQpxoCipyjQNXYmad` reached READY and was assigned
  `https://redlinefirehq.com`. The unauthenticated hydro route redirected to
  login as expected. The VS Code integrated browser failed to connect
  (`browserType.connectOverCDP: Timeout 30000ms exceeded`); Safari's window
  did not expose a verified URL or accessible content. Therefore Cedar Bluff
  access and end-to-end sessions, corrections, deficiency creation, live
  attachment workflows and cross-department isolation were not verified in
  Production. Next action: use an authorized Cedar Bluff session and test
  those workflows and permission boundaries without altering unrelated data.
- Production migration `20261122190000_scba_hydrostatic_testing` was applied
  with its migration ledger entry in one transaction on project
  `dkyjtocanutceafywdcd`. Post-apply checks confirmed all five tables have
  RLS enabled, the four user-visible tables require the department/testing
  permission helper for reads, authenticated users have only SELECT table
  grants, and anonymous users cannot execute the hydro functions. The private
  attachment bucket has the expected MIME restrictions and 15 MiB limit.
  All 73 existing cylinder rows matched the protected pre-migration snapshot
  exactly; no hydro sessions, results or attachments existed immediately after
  migration. Live browser, Cedar Bluff and Storage workflow verification
  remain outstanding; the isolated Storage test is not a live test.
- Rollback requires preserving any hydro records and Storage objects created
  after release and reconciling cylinder dates before removal; reverting the
  application alone does not undo cylinder updates. The scoped snapshot is
  not a restore-tested full backup.
- The entries below retain the historical sequence of preflight findings;
  references to an absent migration, unapproved login initialization or a
  mandatory physical-backup gate describe earlier states, not current status.
- Latest user instruction supersedes the earlier requirement to stop solely
  because Supabase physical backups/PITR are absent. Deployment is instead
  conditional on an additive, data-preserving migration and required security
  checks; the user requested a scoped logical export where possible.
- Migration review: application creates a unique index on the existing cylinder
  table, five new hydro tables, a new private bucket, policies, functions and
  grants. It does not update or delete existing cylinder rows when applied.
  Its grants/revokes affect the newly created hydro objects. New foreign keys
  prevent deletion of a cylinder once referenced by hydro history; the index
  may require a table lock. After deployment, the RPC deliberately updates
  tested cylinders' hydro dates and updated timestamps and creates history;
  corrections update results but retain correction snapshots. Rolling back the
  app does not undo these changes. Dropping hydro objects or restoring old
  snapshots after use would lose hydro history/attachments or overwrite newer
  customer updates; no such rollback has been executed.
- A restricted local snapshot was captured through the authorized linked CLI
  before migration at
  `/Users/adamsmith/.copilot/session-state/559711e4-23da-44b1-8792-6696d5c4cd12/files/scba-export-M1f0jN/cylinders.json`.
  It contains all 73 cylinder rows plus column, constraint, index, trigger and
  policy metadata, with mode 0600. The count was checked against the returned
  row array. It is not a full database/Storage backup and has not been
  restore-tested. Do not copy its customer data to chat, source control, or
  external systems.
- Current Production deficiency triggers were inspected: no observed trigger
  directly changes SCBA cylinder service status on deficiency creation. A
  read-only aggregate for Cedar Bluff found 23 active members, 4 with the
  required auth-to-department membership link, and 2 of those meeting the
  hydrostatic permission/admin rule. This confirms eligible accounts exist,
  not that the current browser session is one of them.
- Supabase's migration ledger has `version` (required), `statements`, and
  `name` fields. The hydro migration remains absent. Any eventual apply must
  record only this migration consistently; do not blindly push historical
  migrations.
- Isolated end-to-end Storage test passed using disposable PostgreSQL,
  GoTrue, PostgREST and Supabase Storage with synthetic data: permitted
  users in two departments uploaded, registered, downloaded and deleted files;
  users without permission and cross-department callers were denied; direct
  anonymous/authenticated access was denied; and deletion removed metadata
  and objects. This used synthetic authorization fixtures and no Storage
  object policies, not the live schema/policies. Signed URL expiration and
  browser interaction were not tested. Test services were removed.
- The Vercel Production environment lists the Supabase URL, anonymous key and
  service-role key variable names required by the existing attachment routes;
  values were neither read nor changed. Presence does not prove that the values
  are valid or that live Storage access is isolated.
- Final deployment authorization explicitly approved normal linked-CLI login
  role initialization. Read-only catalog checks ran against Production
  `dkyjtocanutceafywdcd`. The referenced department, cylinder, member and
  membership ID/date/active columns have compatible UUID/date/boolean types;
  department and cylinder IDs are primary keys; the only cylinder update
  trigger updates `updated_at`. None of the proposed hydro tables, functions,
  indexes or bucket were found, and the migration version was not recorded.
  The current inventory permission helper calls the app-permission helper,
  which checks active department membership and allows administrators or
  assigned permissions; the inspection/testing key appears in an existing
  assignment. Existing Storage policy expressions and their two helper
  functions restrict access to other named buckets. These checks are partial:
  no real hydro bucket, end-to-end Storage test, Cedar Bluff authorization, or
  successful migration execution has been verified.
- The read-only `supabase backups list --project-ref ... --output json` returned
  `backups: null` and `pitr_enabled: false` for this project. A recoverable
  external database backup and Storage-object recovery have not been verified.
  The user previously required a recoverable Production backup and rollback
  verification before any Production migration. This concrete gate remains
  unmet; do not infer that no external backup exists. No migration, application
  deployment, commit, or push was performed. The authorized CLI query did
  initialize login roles as approved.
- Latest release validation: 75 focused hydro, pump-attachment and reporting
  tests passed; TypeScript and focused new-feature lint passed. The hydro
  migration and synthetic permission/isolation assertions passed in a
  disposable PostgreSQL 17 container. A webpack Production build passed in a
  separate temporary build directory with synthetic Supabase settings; the
  directory was removed. These checks do not prove live Storage isolation or
  current Production schema compatibility.
- Earlier deployment preflight was blocked by the prohibition on another
  login-role initialization; the user has since explicitly approved the normal
  initialization. Actual Storage isolation and a recoverable backup/rollback
  remain unverified. No Production migration, push, commit, deployment or
  Cedar Bluff end-to-end verification was performed.
- CLI role-initialization source review: CLI v2.114.0 constructs linked
  database configuration before executing `db query --linked`; absent an
  existing configured database password, it calls `initLoginRole`, which
  sends `read_only: false` to the experimental Supabase Management API
  `POST /v1/projects/{ref}/cli/login-role`. Supabase documents this endpoint
  as creating a CLI login role with a temporary password, requiring database
  write permission. The CLI puts the returned role and password into its
  in-process connection configuration; no reuse/persistence of those returned
  credentials across invocations was established. Available public client
  code and API docs do not establish whether the backend creates a distinct
  role on every call or reuses/updates a role. Do not equate another call with
  harmless reuse. No endpoint was called during this source review.
- Least disruptive options without another role initialization: an already
  authenticated dashboard session usable by the agent, an already configured
  database credential supplied through the CLI's supported password mechanism,
  or a role-free Management API SQL client that can access the existing CLI
  account credential through an approved Keychain authorization. These are
  possibilities, not verified current access. Do not extract credentials into
  chat or use a new connection/setup without the user's approval.
- Existing-access follow-up: prior successful Production metadata inspections
  used `supabase db query --linked --project-ref dkyjtocanutceafywdcd`.
  Earlier records also observed "Initialising login role"; the installed CLI's
  source shows that initialization calls the create-login-role API, so this
  previously working route conflicts with the user's current prohibition on
  creating another role. The CLI account still lists the target project;
  authentication is not shown to be expired. The database password/URL
  environment variables checked are not set. No credential was extracted
  and no linked SQL command or Production change was attempted in this
  follow-up. A supported existing database connection that avoids role creation
  is still needed for live compatibility checks.
- Latest release request: the user authorized deployment only once verification
  passes and forbade creating another Production login role. The CLI account
  can list the target project, but the prior `supabase db query --linked`
  diagnostic unexpectedly invoked "Initialising login role"; the official
  CLI source shows that initialization calls the create-login-role API.
  The diagnostic returned `SELECT 1`; the role's exact state has not been
  confirmed. Do not run that CLI SQL path again. The operator should review
  the unexpected role and any cleanup separately.
- In the latest release preflight, the official Management API documentation
  was checked for its `read_only` query parameter. An attempt to use the
  existing CLI profile credential for that API timed out at macOS Keychain
  access; no Management API SQL request was sent. Do not bypass the Keychain
  prompt or create a login role. Current function definitions, permissions,
  migration compatibility and effective Storage policy isolation remain
  unverified. No Production migration or deployment was performed.
- The existing shared Supabase page identifies the project as
  `dkyjtocanutceafywdcd` and displays a sign-in URL. The VS Code browser
  integration timed out when attempting to read it; the URL alone is not proof
  of the current authentication state. The user subsequently reported signing
  in and sharing the project page, but another attempt to read the shared page
  timed out. The user confirmed that the URL contains the intended project
  reference; this is user-reported, not independently observed. No
  authenticated Production access was obtained in this preflight.
- The new migration and attachment implementation were inspected locally. The
  user reports that the read-only column query found all four requested
  Production tables and that `scba_cylinders` contains `id`, `department_id`,
  `cylinder_number`, `last_hydrostatic_test_date`,
  `next_hydrostatic_test_due_date`, `status`, and other inventory fields.
  The names needed by the migration are present according to that report;
  column types, nullability and membership columns were not included in the
  report, so full schema compatibility is not established. Constraints,
  triggers, object collisions, permissions, policies, Storage configuration
  and recovery capability remain unverified. Local tests and the November 2
  schema export are not evidence of the current live state.
- The user reports that the read-only bucket metadata query returned no rows
  for `scba-hydro-attachments`. If still absent when applied, the migration
  would create it private (`public = false`), with a 15 MiB object limit and
  PDF, JPEG, PNG, WebP, HEIC and HEIF allowed MIME types. This does not itself
  prove department isolation. The migration creates no `storage.objects`
  policies; existing potentially broad Production policies are still unknown.
  The locally revised attachment metadata policies require active department
  membership and the testing permission. Application routes check the active
  department/session and testing permission before using the server-side admin
  client.
  Uploads use signed upload tokens and downloads use 120-second signed URLs;
  bearer links can be used by anyone holding them until expiry. Verify actual
  cross-department isolation end-to-end before release.
- The user reports that the read-only Production `storage.objects` policies
  have no hydro-specific policy, are scoped to other named buckets and show no
  obvious blanket policy. The policy expressions were not supplied here, so
  that assessment cannot be independently confirmed. No test establishes
  effective access to the proposed bucket, including inherited privileges.
- Local code review and subsequent authorization correction:
  - Upload-token creation, attachment registration and deletion call
    `hydroActor`: it resolves an authenticated active member,
    checks the selected-department session through the user client/RLS, and
    calls `member_has_inventory_permission` for
    `scba_cylinder_inspection_testing` before using the admin client.
  - Attachment GET previously did not check the testing permission. The local
    revision requires the same permission for every attachment route and scopes
    metadata lookup to the session and department before generating a signed
    URL. Session, result, correction and attachment metadata SELECT policies
    now require both active linked membership and testing permission. This is
    an intentional read-access change requested by the user.
  - Session creation/correction uses `save_scba_hydro_session` directly from
    the client. The security-definer RPC requires `auth.uid()` and calls the
    inventory permission helper, then scopes the session and cylinders by
    department. The local revision uses the same membership-and-permission
    helper as reads and rejects false or SQL NULL. Current Production helper
    semantics and permission records remain unverified. Reads use RLS, not
    this RPC.
  - Signed upload tokens and download URLs are generated only after their
    respective route checks, but bearer tokens are usable until expiration
    without a fresh application membership/permission check. No real Storage
    or cross-department end-to-end test has yet verified these paths.
- Local verification of the revised migration on disposable PostgreSQL 17
  passed synthetic SQL assertions covering allowed, missing, NULL and inactive
  permissions, cross-department reads and writes, history, and attachment
  metadata. Nine hydro TypeScript tests passed, including mocked route access
  for attachment operations and cross-department paths; TypeScript and lint of
  the revised TypeScript files passed using matching release-source
  dependencies. These mocks and synthetic SQL do not establish actual Supabase
  Storage or Production isolation.
- Supabase integration discovery did not expose a Supabase MCP SQL tool. The
  existing browser automation timed out; a read-only VS Code accessibility
  inspection showed a Supabase sign-in page rather than an authenticated
  project page. The user says the authorization-function SQL results were
  provided, but their actual rows are not present in the accessible chat or
  dashboard view, so function bodies, effective grants, and permission records
  cannot be independently verified.
- The user reports that **Database > Backups** identifies the project as Free
  and says, "Free Plan does not include project backups"; no scheduled backup
  or backup timestamp is displayed. The user did not start or select a
  restore. This is user-reported, not independently observed. No independently
  recoverable external backup or tested restore has been established; their
  absence is not proven. The recoverable-backup release gate is not met.
- The user reports running the requested read-only schema query. Apart from the
  later CLI diagnostic and its unexpected role initialization noted above, the
  assistant did not make a Production data/schema change, commit, push,
  migration or deployment. No service-role key was used for preflight. Only
  the SCBA worktree was changed; the separate, earlier recovery ledger remains
  untouched.
- The attachment implementation uses a server-side admin client configured
  with `SUPABASE_SERVICE_ROLE_KEY` for Storage and attachment metadata.
  That bypasses Storage RLS; route authorization and signed-URL handling are
  therefore critical. Do not expose a key or use one during this preflight.
  Determine separately whether this existing application dependency is
  acceptable before release; the user's restriction on this preflight is not
  evidence of permission to use a key manually.

## Read-only checks after dashboard sign-in

The user confirmed the project reference and has run the column query in item
1; request its type and membership-column details if needed, rather than
repeating it. In SQL Editor use the remaining `SELECT` statements individually
and do not include customer rows or credentials in shared results. Read-only
catalog access in the dashboard does not prove that the eventual migration
operator has the same privileges.

### Schema and migration prerequisites

1. List the required columns and types:

   ```sql
   select table_name, column_name, data_type, udt_name, is_nullable
   from information_schema.columns
   where table_schema = 'public'
     and table_name in ('departments', 'scba_cylinders', 'members',
                        'auth_user_department_memberships')
   order by table_name, ordinal_position;
   ```

   Confirm UUID department/cylinder/member/auth IDs and membership joins;
   `members.active` is boolean; cylinder last and next hydro dates are dates;
   and `departments.id` and `scba_cylinders.id` can be referenced. Inspect
   existing constraints, indexes, triggers and policies for compatibility and
   verify no existing cylinder trigger changes status or blocks date updates.

   ```sql
   select c.relname, pg_get_constraintdef(k.oid) as definition
   from pg_constraint k join pg_class c on c.oid = k.conrelid
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname in ('departments', 'scba_cylinders', 'members',
                       'auth_user_department_memberships')
   order by c.relname, k.conname;

   select schemaname, tablename, indexname, indexdef from pg_indexes
   where schemaname = 'public' and tablename = 'scba_cylinders'
   order by indexname;

   select c.relname, t.tgname, pg_get_triggerdef(t.oid) as definition,
          pg_get_functiondef(t.tgfoid) as trigger_function
   from pg_trigger t join pg_class c on c.oid = t.tgrelid
   join pg_namespace n on n.oid = c.relnamespace
   where not t.tgisinternal and n.nspname = 'public'
     and c.relname = 'scba_cylinders' order by t.tgname;
   ```

2. Inspect all overloads, owners, definer status, grants and actual bodies of
   the authorization helpers and their dependencies. Confirm active-member and
   selected-department behavior, `inventory_management` fallback if present,
   the permission key `scba_cylinder_inspection_testing`, and effective
   authorization for both writes and reads. Inspect dependent helper bodies
   shown by these definitions as well.

   ```sql
   select p.oid::regprocedure as signature, pg_get_userbyid(p.proowner) as owner,
          p.prosecdef, p.proconfig, p.proacl, pg_get_functiondef(p.oid) as definition
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where (n.nspname = 'public' and p.proname in
          ('member_has_inventory_permission', 'member_has_app_permission',
           'scba_hydro_can_read', 'save_scba_hydro_session'))
      or (n.nspname = 'auth' and p.proname = 'uid')
   order by 1;
   ```

3. Check all intended object names for collisions and inspect effective roles,
   grants, owners and RLS on the pre-existing referenced tables. An existing
   hydro object or incompatible index needs explicit review, not overwrite.

   ```sql
   select name, to_regclass('public.' || name) as existing_object
   from unnest(array['scba_cylinders_id_department_hydro_idx',
     'scba_hydro_sessions', 'scba_hydro_results', 'scba_hydro_baselines',
     'scba_hydro_corrections', 'scba_hydro_corrections_id_seq',
     'scba_hydro_attachments', 'scba_hydro_results_cylinder_idx']) as names(name);

   select n.nspname, c.relname, pg_get_userbyid(c.relowner) as owner,
          c.relrowsecurity, c.relforcerowsecurity, c.relacl
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where (n.nspname = 'public' and c.relname in
     ('departments', 'scba_cylinders', 'members', 'auth_user_department_memberships'))
      or (n.nspname = 'storage' and c.relname in ('buckets', 'objects'))
   order by n.nspname, c.relname;

   select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
   from pg_policies
   where (schemaname = 'public' and tablename in
     ('departments', 'scba_cylinders', 'members', 'auth_user_department_memberships'))
      or (schemaname = 'storage' and tablename = 'objects')
   order by schemaname, tablename, policyname;
   ```

   Establish the actual migration execution identity and its effective
   privileges: `CREATE` in `public`, ownership or required permissions for
   existing tables/index creation and foreign-key references, bucket insertion,
   function creation, and permission to grant/revoke to the intended roles.
   Also verify RLS/function-owner behavior for the security-definer functions
   and that intended application roles can execute/read only what is required.
   Do not assume dashboard SQL Editor permissions equal deployment permissions.

### Attachment storage and isolation

4. Inspect the proposed bucket, if it already exists:

   ```sql
   select id, name, public, file_size_limit, allowed_mime_types
   from storage.buckets where id = 'scba-hydro-attachments';
   ```

   The migration creates a private bucket with a 15 MiB limit and PDF, JPEG,
   PNG, WebP, HEIC and HEIF types; `ON CONFLICT DO NOTHING` only rejects a
   pre-existing *public* bucket, so a pre-existing bucket's actual size and
   MIME restrictions must be checked separately. Review every existing
   `storage.objects` policy above, including broad permissive policies that
   match this new bucket. There are no new `storage.objects` policies in this
   migration.

5. Before deployment, verify real end-to-end behavior in an isolated
   non-Production Supabase environment: two departments, active/inactive
   members, an authorized tester and a member without testing permission.
   Check session/result/attachment metadata, upload, read, download, delete,
   cross-department IDs and paths, direct Storage access, public URLs and
   signed-URL expiry. Confirm user routes authorize before invoking their
   server-side admin client. Existing mock and synthetic tests do not establish
   actual Storage isolation. Do not upload test files to Production during
   this preflight.

### Backup and rollback

6. In the verified project's **Database > Backups** dashboard, inspect the
   latest successful recoverable backup, timestamp, retention, and available
   restore destination/options; inspect **Point in Time** if available.
   Record what the project actually offers, who can restore it, and evidence
   that a restore can succeed. Do not start a backup, restore, or settings
   change in this preflight. Confirm a tested recovery route and acceptable
   recovery point/downtime with the operator; a visible backup alone does not
   prove recoverability.
7. Inventory a separate recoverable copy of Storage object bytes and a way to
   reconcile them with database metadata. Supabase documents that database
   backups include Storage metadata, not Storage objects. A database restore
   can discard unrelated customer writes made after its recovery point.
8. Prepare and rehearse a release-specific rollback: stop hydro writes under
   a proven operator-controlled process, preserve/export any new hydro
   sessions, results, audit records, cylinder date changes and attachment
   objects, roll the app back to its prior compatible deployment, and
   reconcile any affected data before considering schema reversal. Do not
   drop tables, delete objects, or restore a whole database without separately
   approved, tested steps; prior app rollback alone does not undo the migration
   or repair data. If a data-preserving procedure cannot be demonstrated, do
   not deploy.

References: Supabase [Database Backups](https://supabase.com/docs/guides/platform/backups)
and [Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control).
These describe platform capabilities, not verified project settings.

## Exact next action

No-go until authenticated read-only access without role initialization is
available, a recoverable database and Storage backup plus tested rollback are
established, and the revised feature passes isolated real Supabase Storage and
cross-department end-to-end testing. Review the unexpected CLI role with the
operator; obtain access through an authorized existing credential path without
bypassing Keychain. Then verify remaining schema/permission prerequisites and
Cedar Bluff authorization before release. Do not create another login role,
expose credentials, or change Production before these gates pass.
