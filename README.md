This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Personnel profile headings

Personnel profile subtitles display the member's assigned Department Role from
Settings, not legacy rank or application permissions. Members without a
resolvable Department Role display "Unassigned". Role names are loaded within
the authenticated department; inactive assigned roles retain their names.

The personnel list, personnel roster report, and their search use Department
Role instead of legacy rank; there is no Rank column. Add and Edit use the
same configured Department Role selector.
New members leave legacy rank blank; editing without a legacy rank value
preserves the stored legacy field. Application permissions remain separate.
Existing inactive assignments can be retained, but new selections must be active.

Add Member calls `create_department_member_with_role` once through the creation
API. The wrapper runs the existing creation and role assignment functions inside
one transaction, verifies the saved assignment, and propagates failures so the
member and any new permission rows roll back together. It requires the local
`20261104210000_create_department_member_with_role.sql` migration before release.
This migration adds functions, two nullable member metadata columns, and a
partial unique index; it does not alter existing assignments or populate
existing members' request metadata.
The API supplies `p_department_id` from authenticated active-department context,
never from request-body department data. A new department-scoped membership
resolver validates the caller's active membership using `auth.uid()` (or the
existing email fallback), and existing `can_manage_personnel` checks still apply.
The migration creates explicit-department overloads of the installed create,
update-details, and update-role RPCs by cloning their secured logic with only
the resolver call changed. Drift checks fail closed. Original overloads remain
unchanged for compatibility. Add and Edit use the explicit-context overloads;
no transaction-wide session-context override or permission expansion is used.
Personnel Add/Edit opt into strict active-cookie membership matching: an invalid
or stale selected department is rejected rather than falling back to another
membership. All `getCurrentMember` callers require an explicit valid selection
for multi-department accounts rather than choosing the first membership.
Apply this migration before releasing the new API and confirm PostgREST has
refreshed its function cache. Do not deploy only the API.

Each Add Member draft receives a hidden UUID when opened. Before sending the
creation request, its UUID and exact basic-information/Department Role payload
are saved in browser session storage scoped to department and current member.
Closing/reopening the form or refreshing the same tab restores that pending
submission. Only a server-confirmed success clears it. A new submission after
confirmation receives a new UUID. Changing pending information blocks submission
and instructs the administrator to reopen the original draft; it never silently
rotates the UUID. Unavailable or malformed storage blocks creation explicitly.
Session storage is tab-local and ends when the browser session/tab is closed;
this does not provide cross-tab or browser-restart recovery. Unsubmitted drafts
are not stored. No UUID is displayed, and no Auth credentials are stored.

The wrapper locks by department/request UUID and stores
`members.onboarding_request_id` plus `onboarding_request_fingerprint` in the
same atomic transaction. The fingerprint is SHA-256 over normalized creation
inputs, selected Department Role, permission keys, and authenticated requester.
A repeated identical request returns the original member ID without any writes;
changed information or a different requester is rejected without modifying
the member. The unique index scopes UUIDs to each department; metadata for
legacy personnel stays NULL. No names or emails are used for duplicate rejection
or merging. Separate requests allow same-name people and shared personnel emails;
Auth email rules remain unchanged. Hard-deleting the member also removes its
request metadata; independent legacy creation RPCs do not use this protection.

Edit continues using the existing separate member-details and role RPCs and
reports explicitly if details saved but the role save failed.

Authentication bootstrap and sign-in reconcile the active-department cookie
through `/api/auth/current-member`: a sole membership is selected automatically,
a valid multi-department selection is preserved, and an invalid or missing
multi-department selection requires an explicit choice before the application
opens. Choices are checked server-side using the same membership resolver as
Personnel. Sign-out expires the httpOnly cookie through that endpoint's DELETE
handler. Desktop and mobile switches refresh the shared auth context and server
pages after the verified cookie update. `useActiveMember` consumes that shared
context so client pages also follow department switches, rather than caching
the initial membership. No database changes are required.
Test account switching and isolation with `node --import tsx --test
lib/auth/active-department.test.tsx lib/auth/auth-middleware.test.ts`.

Test with `node --import tsx lib/personnel-role-workflow.test.tsx` and
`node --import tsx 'app/personnel/[id]/page.test.tsx'`.
For real transaction verification, cache `postgres:17` with `docker pull
postgres:17`, then run `node --import tsx --test
lib/personnel-member-atomic.database.test.ts`. This test creates a temporary
Docker database without network access or mounted customer data, loads the real
member creation/assignment migrations with synthetic identity fixtures, and
checks forced-failure rollback, permissions cleanup, later role changes,
readiness, and concurrent retries. It now loads real membership/permission
functions, with synthetic JWT claim helpers rather than a simplified member
resolver, and verifies both active departments with selected and Unassigned
roles, multi-department Edit, inactive/unauthorized rejection, and delegated
personnel-management permission. It removes its container afterward.

The Personnel roster report loads all roles in the current department, including
inactive assigned roles. This changes display/search only, not assignments or
requirements; genuinely unassigned members still display Unassigned.

## Pediatric Bag and Drug Box inspection reports

Reports > Inspections includes Pediatric Bag Inspections and Drug Box
Inspections, both separately and in All Inspections. Each completed inspection
has its own row, including its completion timestamp, bag/squad identifiers,
inspector, assisting personnel, saved checklist quantities and results, and
available notes and lock numbers. The reports read existing immutable snapshots,
not live checklist progress or templates.

Date, search, result and bag/squad filters run within the authenticated member's
department and existing report permissions. Queries paginate to avoid truncating
snapshot counts. Missing snapshots are explicitly reported as unavailable, not
ready. Pediatric recorded status is retained (including out-of-service and
needs-attention decisions); unchecked Drug Box snapshot items are reported as
expired according to the existing save model, which cannot distinguish expired
from otherwise unacceptable items. Recorded checklist deficiencies are not
claimed to be currently open department deficiency tickets.

No schema or inspection-save changes are required. Test with
`node --import tsx --test lib/reports/server-runner.pediatric-bags.test.ts lib/reports/server-runner.drug-boxes.test.ts lib/reports/registry.test.ts`.

## Apparatus photos

`lib/apparatus-images.ts` selects bundled photos by department UUID and unit
name. Every caller passes the apparatus record and the authenticated current
member's department; mismatched, missing, or unknown departments and unmapped
names return `null` for the existing no-image fallback. Both existing Elliott
department identities retain their Elliott mappings and unit-number aliases.
Cedar Bluff and Red Oak each use only their own mappings.

The 17 Red Oak photos under `public/apparatus/redoak/` are existing approved
assets, not Supabase Storage uploads. Bundled photos remain public URLs;
department-aware selection prevents incorrect photos, not direct URL access.
Validate mappings, asset files, isolation, and caller wiring with
`node --import tsx --test lib/apparatus-images.test.ts`.

## Recovered Red Oak release candidate (local only)

Personnel department positions, nullable legacy ranks and application permissions
remain separate. `Fire Chief` uses legacy `Chief`; `Exterior Firefighter` can use
an unassigned legacy rank. Administrator grants remain a separate existing
authorization operation. No positions, certifications, members or permissions
are seeded by this candidate.

The forward-only drafts `20261104090000_allow_unassigned_legacy_member_rank.sql`
and `20261104091000_scope_red_oak_apparatus_check_exclusions.sql` are unapplied.
They inspect existing function definitions, abort on expected-source drift and
preserve RPC signatures, owners, grants, security mode and authorization bodies.
Do not replay the historical apparatus migrations: their structures already
exist in Production even where migration-ledger entries are absent.

Red Oak Unit 141 retains its apparatus record and information but is excluded
from check routes, readiness and the Daily administrative template's applicable
items. Daily Apparatus Checks remains selectable despite its readiness flag.
Its Saturday-only radio/fuel checks use `America/Chicago` and are required on
Saturday in both interfaces and the proposed completion RPC. Weekday bay
schedules use Central calendar days and do not move when checks finish early.
Other departments retain ordinary checklist behavior.

All Pass requires confirmation. Undo preserves manual changes and previous
desktop notes; partial failures are shown and successful writes remain reflected
in the interface. Bay validation runs before configuration writes, and omitted
bay fields preserve prior assignments. A valid assigned bay can supply the
weekday schedule without inventing an interval requirement.

Inspection history dates render deterministically for server hydration, then
localize to the browser's timezone.

Validation must use synthetic environment variables and in-memory fixtures,
not the original Production-linked environment file. SQL/RLS execution and
restore testing require separate isolated-database write approval. Do not
commit, deploy or apply these drafts without release approval.

The supplemental, unapplied `20261104092000_guard_red_oak_unit_141_check_writes.sql`
draft follows the apparatus RPC draft. It guards inserts/updates on sessions,
participants, inspections, progress, results, legacy `daily_checks` and
deficiencies using the exact Red Oak apparatus identity and actual referenced
parents. It also tightens the existing participant and deficiency session
helpers without changing their signatures, authorization, owners or grants.
No read policies or rows change. Existing deficiency repairs retain their
existing authorization when apparatus, department, inspection, session and
reporter associations stay unchanged.

Run the source-level checks with
`node --import tsx --test lib/apparatus/check-exclusion-migration.test.ts`.
`supabase/tests/red_oak_unit_141.sql` requires separate execution approval:
approval, run it with `psql -v REDOAK_ISOLATED_TEST=1` against an empty, owned
schema-only database named `redline_redoak_141_dev_*`, restored from the
inspected Production definitions before the two apparatus drafts. External
workers/outbound integrations must be disabled. The suite seeds only synthetic
identities, applies both drafts inside its transaction, and rolls everything
back. It tests the installed Saturday predicate at both dates; actual RPC
completion runs on the database's current Central calendar day, not a faked
shared clock. Never point this suite at Production.

Phase 5 executed the suite in a network-isolated PostgreSQL 17.6 container,
using synthetic rows and relevant schema/policies/ACLs aligned to read-only
Production definitions. Across the final Unit 141, optional-rank and calendar
RPC runs, 92 assertions passed and one isolation assertion failed as described
below. Both legacy-rank overload pairs passed NULL/blank, invalid-rank,
authorization and association-preservation tests. Friday/Saturday full RPC
tests substituted only the clock expression inside rolled-back local function
copies; they did not change the machine clock. Outbound email infrastructure
was excluded. The initial predicate-extraction test regex was corrected after
its runtime failure. All fixtures rolled back and the temporary container was
removed. These results do not authorize Production migration application.

Read-only review also found that the existing inspection INSERT policy checks
the submitted department, while its apparatus FK checks only the apparatus ID.
The new guard rejects Unit 141 even with a forged department, but intentionally
does not change unrelated apparatus authorization. The isolated suite includes
a normal-apparatus forged-department regression that actually failed in the
isolated execution: a foreign-department user inserted a Unit 114 inspection
with their own department ID. Broader isolation hardening requires separate
scope approval.

The follow-up, unapplied
`20261104093000_enforce_apparatus_inspection_write_ownership.sql` closes that
specific inspection-write failure. Restrictive INSERT/UPDATE policies AND
actual apparatus ownership and active authenticated membership with existing
authorization. Unlinked roster members retain email matching against the
authenticated user's stored Auth email, not a caller-provided email claim.
No permissive UPDATE policy is added: direct inspection edits remain denied
under the existing policy set. A write trigger locks the apparatus parent and
rejects mismatched inspection department IDs even within definer RPCs.
Existing policies, table grants, RPC signatures/security settings and history
reads remain unchanged. It neither repairs nor deletes historical rows.

The updated isolated suite applies this draft after the existing Unit 141
drafts. Final PostgreSQL execution passed 61 inspection/Unit 141 assertions,
42 optional-rank assertions and nine Friday/Saturday completion assertions
(112 total, zero failures). The calendar RPC tests substituted only the clock
expression in transaction-local copies and rolled back; no shared clock was
changed. An intermediate synthetic test UUID typo was fixed before the final
successful run. Local ownership/checklist/readiness source tests passed 26
cases; TypeScript and focused ESLint passed. Validate the new source checks
with `node --import tsx --test lib/apparatus/inspection-write-ownership.test.ts`.
These are local release-candidate results, not authorization to apply any
Production migration. The Production recovery-point blocker remains separate.

## Daily Log

The forward-only `20261103180000_create_daily_logs.sql` migration adds the
department activity journal at `/daily-log` and `/mobile/daily-log`. All five
entry fields are optional; new forms default date/time to the user's local
clock. History sorts entered dates/times descending, then creation time, with
undated entries last. Search covers Activity, Location, Unit and entered dates
(`MM/DD/YYYY`, `YYYY-MM-DD`, or abbreviated month dates). Results page in groups
of 50; long activity text has a bounded, expandable reader.

Active department members may read and add entries. Only the original creator
or an active department Administrator may edit; only an active department
Administrator may archive. The database derives identity from `auth.uid()` and
the department's active membership, stamps audit metadata itself, and rejects
stale edits. Archival hides entries from history/search but retains content,
creator/creation time, editor/edit time and archiver/archive time internally.
No hard-delete or direct write grant is exposed to application roles. Audit
member references do not cascade on member deletion.
Daily Log is the last Field Actions button on mobile.

Validate with `node --import tsx --test lib/daily-log.test.ts`. Run
`supabase/tests/daily_logs.sql` after restoring the schema and applying the new
migration in an empty, owned local database named `redline_daily_log_dev_*`.
The SQL tests use synthetic users and roll back every fixture. Do not apply
this migration to Production as part of local validation.

## Operational certification and EMS emails (development; disabled)

The forward migrations `20261103031000_enforce_ems_notification_department.sql`
and `20261103032000_operational_email_notifications.sql` are development-only
until separately approved for deployment. Do not reapply historical assignment
email migrations or enable these features as part of an authentication release.

Both rows in the private `operational_email_rollouts` table default to
`enabled = false`: `certification_expiration` and `ems_supply_withdrawal`.
The worker can read, but cannot update, these controls. No browser settings or
environment-variable override enables them. Production migration application,
rollout enablement, and real email tests each require owner approval.

Certification reminders run on the exact Chicago calendar date 60, 30, 14, or
7 days before a finite expiration date, independent of readiness warning
settings. There is no historical backfill or catch-up of missed milestone days.
An already-started provider delivery uses the bounded retry policy. Credentials
without expiration dates receive no reminder. Only the active, same-department
holder receives an email, with no administrative copies or fallback.

Catalog credentials use their recorded expiration. Current EMS profiles without
a catalog representation can supply their own date. EMS mirrors require exactly
one matching authority, level, nonblank certificate number, and expiration date.
Conflicting/multiple representations and potential legacy `EMT` mirrors are
recorded as `needs_review`; matching dates or names alone never merge credentials.
Catalog/profile disagreement, foreign ownership, and missing authoritative
identity must be reviewed separately without automatically editing personnel.
Legacy candidates must first be identified as EMS credentials (the existing
generic `EMT` catalog identity); matching dates or numbers never implicate
unrelated fire/other credentials. Same-authority/level catalog records sharing
an expiration require review if either normalized certificate number is missing.
Expiration date changes start a new cycle; unique source and canonical event
keys prevent repeated scans from sending the same milestone twice.

EMS emails originate from committed `Checkout` transaction items with a negative
delta and a resulting quantity at or below the reorder threshold. Each item ID
is a separate event, including every additional withdrawal while already low.
Returns, restocks, corrections, inventory creation, and threshold-only changes
do not generate withdrawal emails. Existing in-app alerts still occur only on
threshold crossings. The composite recipient/member department foreign key
also prevents moving a designated member to another department. The isolation
migration stops on existing mismatches; it never reassigns or deletes settings.

Enqueue recovery retains the original withdrawal, threshold, and designated
recipient snapshot. Changing a designation invalidates the old delivery; only
subsequent withdrawals use the new recipient. Final preparation checks source
ownership and eligibility again. Provider messages, recipients, and idempotency
keys freeze before the first attempt; an accepted/in-flight email cannot be
recalled. Do not reroute uncertain retries.

The single existing five-minute cron balances deficiency, certification, and
withdrawal queues in round-robin order, starting with deficiencies. All queues
use the existing Resend sender/key, exclusive leases, abortable timeouts,
exponential backoff, at most eight attempts, and a 23-hour provider retry window.
Deficiency assignment emails are available to all existing departments after
`20261103154500_enable_assignment_emails_all_departments.sql`. Assignment,
ownership, active same-department recipient, and valid-email checks remain
mandatory at enqueue and dispatch. This migration does not automatically replay
historical notifications. A new queue failure is explicit and does not prevent
healthy queues from processing.
Inspect `failed`, `needs_review`, and enqueue-recovery states operationally;
`sent` means provider acceptance, not confirmed inbox delivery.

All-department assignment regression coverage is in
`supabase/tests/notification_assignment_all_departments.sql`, using an empty,
owned schema-only database named `redline_assignment_email_dev_20261103` after
the assignment and operational migrations and the forward expansion migration.
It rolls back synthetic fixtures and never sends email. The older
`notification_assignment_emails.sql` retains the pre-expansion Cedar-only
baseline and must run before the expansion migration.

Local validation uses synthetic records in an owned schema-only database named
`redline_operational_email_dev_20261103`, never Production or copied customer rows.
Run `supabase/tests/operational_email_notifications.sql` through local psql.
It rolls back fixtures and temporary rollout enablement. The concurrency tests
require `REDLINE_NOTIFICATION_TEST_CONTAINER=<owned-local-container-id>`:
`npx tsx --test supabase/tests/operational_email_concurrency.test.ts`.
They commit synthetic fixtures only in that owned database; discard the database
after validation. Notification application tests use mocked providers:
`npx tsx --test lib/notifications/*.test.ts`. Never point tests at a live provider.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Authentication emails (local repair; deployment pending)

Keep the browser Supabase client on its default PKCE flow. Administrator
invitations must use the link format in `supabase/templates/invite.html`;
password recovery uses `supabase/templates/recovery.html`. Both proposed
Production templates explicitly target `https://redlinefirehq.com`, not
`.SiteURL` or `.ConfirmationURL`. This avoids the current localhost fallback.
Do not install these templates unchanged in a local or non-Production project;
replace the origin with that environment's trusted application origin.

The invitation link sends Supabase's single-use token hash to `/auth/invite`.
This server-only endpoint verifies `type=invite`, establishes the normal SSR
session cookies, and redirects to `/change-password?first=1`. It does not accept
implicit access-token fragments or arbitrary redirect destinations.

The recovery callback `/auth/recovery` verifies `type=recovery` token hashes
and redirects to the existing `/change-password?recovery=1` screen. Token-hash
links do not depend on the browser that requested recovery. The callback also
supports existing PKCE authorization codes, including `sb_flow_id`, using the
normal SSR verifier cookies; these older links must open in the same browser
that requested recovery. Middleware forwards `/login?code=...` callbacks before
normal signed-in login redirects. A missing verifier or rejected token shows
an explicit error instead of an ordinary login form. Both callbacks require a
matching Auth user/session, use fixed internal destinations, and return
no-store/no-referrer responses. They do not create or claim department
memberships. An invitation still needs its existing authorized member association;
no department or permission is accepted from callback parameters.

Password entry and validation live only on `/change-password`. The existing
eight-character minimum, confirmation check, provider errors, and forced
first-login metadata handling are preserved. Ordinary desktop/mobile sign-in
destinations remain unchanged. No token, password, or full Auth response should
be logged.

### Production configuration and approval-required deployment

Read-only verification on November 2, 2026 confirmed custom Resend SMTP is
enabled, the saved invitation/recovery templates contain the direct links above,
and both `https://redlinefirehq.com/login` and
`https://redlinefirehq.com/auth/recovery` are allowlisted. These settings were
configured separately by the owner; deploying this code does not modify them.
The Site URL remains `http://localhost:3000`. These two direct-link templates do
not use that fallback; other Auth flows may still do so.

Retain the existing `/login` redirect, SMTP configuration, and Site URL.
Do not change `DEMO_REQUEST_SENDER` or `RESEND_API_KEY`. No database migration or
RLS change is required for this authentication repair. Deployment and live
test emails still require separate approval.

The approved invitation scope is Supabase-generated invitation emails only.
The existing personnel account-creation endpoint still creates an account with
a temporary password; it does not send an invitation and is unchanged here.

An alternative for invitations is the supported server-side
`auth.admin.generateLink({ type: "invite", email, options: { data } })` API and
the existing verified provider, rendering `.TokenHash` from
`properties.hashed_token` into the trusted callback URL. Include
`data: { first_name, last_name, must_change_password: true }`; do not supply a
password, send the default `action_link`, or log the returned tokens. No new
sender service or public reset endpoint is implemented here. Choosing this
alternative instead of SMTP requires a separate reviewed delivery design,
particularly for recovery abuse/rate limiting.

After approved deployment/configuration, authorize new controlled test emails
separately. Verify real delivery, password update, subsequent sign-in, and live
department isolation using only approved test identities. Until then these are
locally tested flows, not a claim of Production success.

Run local authentication tests with
`npx tsx --test lib/auth/invitation-flow.test.ts lib/auth/recovery-flow.test.ts lib/auth/email-auth-integration.test.ts lib/auth/auth-middleware.test.ts`.
The integration tests use the real Supabase SSR SDK with an in-memory Auth
transport; they do not contact Supabase, send emails, or create accounts.

## Learn More

### Deficiency assignment emails

**Initial Production rollout: Cedar Bluff Fire & Rescue only**
(`44a25960-7d46-45c4-94e9-115833072da8`). A private, immutable database
allowlist is enforced before enqueue/recovery and again at claim and final
dispatch. Elliott, Red Oak, and every other department remain excluded from email
generation and sending, including preexisting or forged outbox rows. Their
existing assignment and in-app notification behavior is unchanged. Browser
settings cannot enable another department; expansion requires an approved
migration. There is no historical backfill.

The local migration `20261102210000_queue_deficiency_assignment_emails.sql`
adds a private `notification_email_deliveries` outbox. It queues only new
`deficiency_assigned` in-app events; it does not backfill old notifications or
replace existing assignment, category-assignment, history, notification triggers,
or notification permissions. An unassigned deficiency or unchanged assignment
does not create an assignment event. Reassignment creates an event for the new
assignee only.

The queue snapshots the assigned member's email and deficiency details. Only an
active member in the same department is eligible. Department ownership is resolved
independently from every populated equipment, reporter, inspection, and check-session
link, not from the deficiency's writable `department_id`. All links must resolve
and agree with the deficiency, notification, and assignee departments; missing,
unresolved, ambiguous, or mismatched ownership is recorded as `skipped`.
Priority names are resolved through the actual `deficiency_priorities` UUID FK.
These checks do not modify existing assignment or in-app notification rules.

The worker checks eligibility at claim and again at the final prepare/dispatch
RPC, including already-frozen retries. Prepare waits for in-progress assignment
and member updates using row locks, then validates with a fresh snapshot and
rechecks its lease. Changes before that gate cancel the delivery without a provider
call. The gate and provider submission are not one distributed transaction:
changes after dispatch authorization cannot recall an email already in flight.
Canceled deliveries are never redirected to another recipient.

`GET /api/cron/notification-emails` uses service-role-only queue RPCs and requires
`Authorization: Bearer <CRON_SECRET>`. This exact route bypasses browser-session
middleware; all other authentication behavior is unchanged. Set a random
Production `CRON_SECRET` of at least 16 characters before deployment. The worker
reuses `RESEND_API_KEY` and **exactly** `DEMO_REQUEST_SENDER`; do not change the
existing sender configuration. Links use the trusted `https://redlinefirehq.com`
origin, not request headers or client-supplied destinations.

`vercel.json` schedules the worker every five minutes (requires Vercel Pro).
Deployment requires separate authorization: apply the reviewed migration first,
configure `CRON_SECRET`, then deploy. No remote configuration or migration is
performed by these local changes. Do not invoke the worker locally against a
Production Supabase URL. The migration is transactional, with a five-second lock
timeout and 30-second statement timeout. It fails explicitly before recreating
an existing outbox; do not rerun it manually or use `IF NOT EXISTS` to hide schema
drift. Successful installation must be tracked by migration history.

An outbox insert failure is isolated from the existing assignment and in-app
notification. A database warning and private `notification_email_enqueue_failures`
record retain the notification ID, reserved event order, SQLSTATE, attempts and
retry time. Claims recover at most ten due enqueue failures with backoff and an
eight-attempt `needs_review` limit; recovery cannot reorder old A-to-B-to-A events.
These records have RLS and service-role SELECT only, with no ordinary-user access.
If the database cannot persist even a recovery record, the original transaction
fails explicitly rather than silently losing an assignment email. No historical
notifications are backfilled.

Each notification has one unique queue row. Atomic `FOR UPDATE SKIP LOCKED`
claims use a two-minute lease and unique lease token. The exact rendered request,
including sender and recipient, is frozen before the first provider call and
reused with `notification-email/<delivery-id>` as Resend's idempotency key.
Provider errors/timeouts retain retry state with exponential backoff; stale
leases can be reclaimed. At most eight attempts are allowed, and uncertain
deliveries stop at 23 hours, before Resend's 24-hour idempotency retention ends.
`needs_review` must be reconciled with Resend logs before any manual resend;
never reset its attempt timestamp, payload, or idempotency key blindly. If Resend
accepts a request but saving success fails, the reclaimed lease uses the same
frozen request and provider key within that window, so Resend returns the original
acceptance instead of sending a second email.

Inspect `status`, `attempt_count`, `last_error`, `provider_message_id`,
`first_attempt_at`, and `sent_at` through privileged operations. `sent` means
Resend accepted the email, not confirmed inbox delivery. Bounce/delivery webhooks
are not included. No Chief/admin/reporter fallback, CC, BCC, supply emails, or
certification reminders are implemented. The worker handles at most ten events
per invocation with a 40-second loop budget, five-second RPC timeouts and a
ten-second provider timeout that aborts the underlying Resend HTTP request.
The final iteration can extend beyond the loop budget; the route has a 60-second
Vercel limit. Aborting cannot undo provider acceptance, so the same idempotency
safeguards apply. Backlogs may require multiple cron runs.

Run `npx tsx --test lib/notifications/assignment-email.test.ts` for mocked
provider/worker tests (no emails sent). Run
`psql -X -v ON_ERROR_STOP=1 -d notification_email_test -f supabase/tests/notification_email_local_fixture.sql`
only against a new disposable local database. The fixture loads the actual
existing assignment triggers and the new migration, then runs rollback-only
assignment, retry, lease, duplicate, permission, enqueue-failure recovery, existing
notification RLS, post-claim eligibility changes, and ownership-isolation assertions.
The fixture uses the real priority FK shape and broad default grants to verify
explicit revocations. It is not a Production migration or a full-schema integration
test. Before authorized deployment, rehearse against a schema-only copy of the
live database in an isolated local database; no additional website is required.
The minimal fixture alone does not establish the absence of Production schema drift.

### EMS continuing education

`lib/ems/requirements.ts` defines the shared Iowa/National Registry requirement
tables used by Personnel and My Readiness. CCP (`ccp`) has Iowa requirements of
Airway 6, Cardiology 7, Trauma 5, Medical 8, Operations 4, Pediatric 4, and Critical
Care Paramedic 12 (46 total). National Registry Paramedic uses only the first five
categories (30 total); Pediatric and Critical Care Paramedic credit cannot
contribute to that track, including through manual allocations.

Pediatric is selectable in EMS training entry on desktop and mobile, and appears
in every Iowa level's CE progress. Effective November 1, 2026, Iowa requirements
are:

| Category | EMR | EMT | AEMT | Paramedic |
| --- | ---: | ---: | ---: | ---: |
| Airway | 1.5 | 4 | 5 | 6 |
| Cardiology | 2 | 5 | 6 | 7 |
| Trauma | 1 | 3 | 4 | 5 |
| Medical | 2.5 | 6 | 7 | 8 |
| Operations | 1 | 2 | 3 | 4 |
| Pediatric | 1 | 2 | 3 | 4 |
| Total | 9 | 22 | 28 | 34 |

Earlier Iowa definitions remain available before the effective date, with
Pediatric optional at zero required hours. Critical Care Paramedic CE credit applies only to Iowa
CCP. National Registry Paramedic requires 30 hours total, with zero Local/State
and Individual hours; all five category minimums must be met. Other National
Registry levels are unchanged. CCP is an Iowa-only level, not a National Registry option.

Personnel certification creation/editing, new-member onboarding, and Settings
catalog creation/editing expose **Authority** and **Certification Level**.
Choose Iowa EMS → Critical Care Paramedic to save
`certifications.ems_authority = 'iowa'` and
`certifications.ems_certification_level = 'ccp'`. Member credentials reference
that catalog entry through `member_certifications.certification_id`; no new
authority, add-on credential class, or third CE track is introduced. National
Registry Paramedic is independently selectable as authority `nremt`, level
`paramedic`, alongside Iowa CCP for the same member.

Changing one member's level reuses or creates the matching catalog entry and
changes only that member credential's reference. It does not reclassify the
shared Paramedic catalog entry. Editing a catalog entry in Settings intentionally
applies its classification to all assigned members. Conflicting same-name
entries with missing/different metadata must be corrected explicitly in Settings.

Existing authoritative-credential precedence is unchanged: the most recently
issued classified credential per authority supplies the effective level,
number, and expiration to Personnel and My Readiness. Edit the existing member
credential when correcting its level; track-only selections cannot contradict
an assigned authoritative credential. New-member onboarding initializes its
existing authority track's level from the assigned credential.

The local migration `20261102173000_add_ems_ccp_and_pediatric_phase1.sql` expands
the existing level/topic checks and seeds Iowa CCP requirements, optional Iowa
Pediatric topics, and the published `2026-paramedic-30` National Registry Paramedic
requirement version. Historical `2026-initial` rows remain unchanged; the allocator
selects the current published version by effective date. The new Paramedic version
has five national topics totaling 30 and explicit zero-hour Local/State and
Individual components. No NREMT CCP requirement is seeded, and database checks
reject NREMT CCP credentials and profiles. The migration must be reviewed and
applied before using these new values
against a database. This task does not apply it to remote Supabase.

The local migration `20261102194500_update_iowa_ems_requirements_nov2026.sql`
adds published `2026-iowa-nov1` versions effective `2026-11-01` for Iowa EMR,
EMT, AEMT and Paramedic, with one core component and six required topics each.
It only inserts new version rows; all historical definitions, training records,
Iowa CCP and National Registry requirements remain unchanged. The shared
TypeScript lookup also selects Iowa definitions by effective date; historical
training dates do not prevent those records from counting under current requirements.
Apply the Phase 1 migration first if needed, then this migration before deploying
the application update. These local implementation changes do not apply remote
migrations. No credential/authority selection, allocation/exclusion rules,
renewal cycles or automatic expiration alerts change here.

Run the focused TypeScript tests with `npm run test:ems`. After applying the
migration to a disposable local database, run `supabase/tests/ems_ccp_phase1.sql`
with `psql -v ON_ERROR_STOP=1` to verify the seeded category hours and totals.
After the November update migration, also run
`supabase/tests/ems_iowa_nov2026.sql` to verify exact category hours, effective
dates and totals.

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
