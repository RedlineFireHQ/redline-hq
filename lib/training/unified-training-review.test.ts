import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

/**
 * Regression coverage for the unified department training history (Stage A) and
 * the department-scoped Training Entry — Bypass Review permission (Stage B).
 *
 * These tests assert the production integration points directly from source
 * (repo's readFileSync convention) plus the trigger logic shape. Where a test
 * can only simulate expected behavior rather than execute the real query, that
 * limitation is labeled on the test.
 */

const overviewSrc = readFileSync(resolve(process.cwd(), "components/training/TrainingDepartmentOverview.tsx"), "utf8");
const workspaceSrc = readFileSync(resolve(process.cwd(), "components/training/TrainingWorkspace.tsx"), "utf8");
const pageSrc = readFileSync(resolve(process.cwd(), "app/training/page.tsx"), "utf8");
const migrationSql = readFileSync(resolve(process.cwd(), "supabase/migrations/20261024120000_training_entry_bypass_review.sql"), "utf8");
const permissionPanelSrc = readFileSync(resolve(process.cwd(), "components/personnel/SpecialPermissionsPanel.tsx"), "utf8");

// --- Stage A: unified department training history ---

test("Unified history: department events and approved self-reported training both render", () => {
  // Both display surfaces merge the two sources.
  assert.match(overviewSrc, /selfReported/);
  assert.match(workspaceSrc, /approvedSelfReported/);
});

test("Unified history: only approved self-reported submissions are included", () => {
  // The page filters the display set to approved before passing it down.
  assert.match(pageSrc, /\.filter\(\(row\) => row\.status === "approved"\)/);
  assert.match(pageSrc, /\.eq\("status", "approved"\)/);
});

test("Unified history: every entry carries a source label", () => {
  assert.match(overviewSrc, /Department Event/);
  assert.match(overviewSrc, /Self-Reported/);
  assert.match(workspaceSrc, /Department Event/);
  assert.match(workspaceSrc, /Self-Reported/);
});

test("Unified history: self-reported rows are never inserted into training_events", () => {
  // The merge is display-only: the mapping that builds the unified rows must not write
  // anywhere. (TrainingWorkspace legitimately inserts into training_events when a manager
  // creates a department event — that handler is out of scope for this merge.)
  const overviewMerge = overviewSrc.match(/const unified[\s\S]*?\.sort\(/);
  const workspaceMerge = workspaceSrc.match(/const unifiedHistory[\s\S]*?\.sort\(/);
  assert.ok(overviewMerge && workspaceMerge);
  assert.equal(/\.insert\(|insert into/i.test(overviewMerge[0]), false);
  assert.equal(/\.insert\(|insert into/i.test(workspaceMerge[0]), false);
});

test("Unified history: self-reported rows render date-only values (no bogus midnight time)", () => {
  // training_date is a date-only column; the app convention for it is formatDateOnly
  // (see the existing My Self-Reported Training list and review queue).
  assert.match(workspaceSrc, /formatDateOnly\(submission\.trainingDate\)/);
  assert.match(overviewSrc, /formatDateOnly\(row\.date\)/);
});

test("Unified history: self-reported entries are not linked to a nonexistent event detail page", () => {
  // Self-reported rows must not produce a /training/[id] link (no such detail page).
  // They render as plain <div> cards keyed `self-<id>`; only events use <Link>.
  assert.match(workspaceSrc, /<div\s+key=\{`self-/);
  assert.match(overviewSrc, /<div\s+key=\{`self-/);
});

test("Unified history: queries remain department-scoped", () => {
  // Every new submissions query in the page must carry the department filter.
  const submissionQueries = pageSrc.match(/from\("training_outside_submissions"\)[\s\S]{0,400}?\.order\(/g) ?? [];
  assert.ok(submissionQueries.length > 0);
  for (const query of submissionQueries) {
    assert.match(query, /\.eq\("department_id", currentMember\.departmentId\)/);
  }
});

// --- Stage B: training_entry_bypass_review permission ---

test("Permission: catalog gains training_entry_bypass_review with the approved label", () => {
  assert.match(migrationSql, /'training_entry_bypass_review'/);
  assert.match(migrationSql, /'Training Entry — Bypass Review'/);
});

test("Permission: trigger checks the submitter's grant for the submission's department", () => {
  // Scoped to (new.department_id, new.member_id) — cannot read another department's grant
  // or another member's grant.
  assert.match(migrationSql, /map\.department_id = new\.department_id/);
  assert.match(migrationSql, /map\.member_id = new\.member_id/);
  assert.match(migrationSql, /map\.permission_key = 'training_entry_bypass_review'/);
});

test("Permission: members without the grant keep the existing department review policy", () => {
  assert.match(migrationSql, /outside_training_requires_review/);
  assert.match(migrationSql, /new\.review_required := department_requires_review;/);
});

test("Permission: auto-approval is marked as system-generated and never impersonates a reviewer", () => {
  assert.match(migrationSql, /new\.review_notes := 'Auto-approved by system'/);
  // The marker only applies when reviewed_by is null (no human reviewer).
  assert.match(migrationSql, /new\.reviewed_by is null/);
  // The marker is write-once and non-destructive: it never overwrites an existing note.
  assert.match(migrationSql, /new\.review_notes is null/);
});

// --- approval_path: explicit, authoritative audit field ---

test("Audit: approval_path column is nullable with a check constraint on allowed values", () => {
  // Nullable (no NOT NULL) so historical rows can stay NULL; only the three known
  // paths are permitted.
  assert.match(migrationSql, /add column if not exists approval_path text/);
  assert.match(migrationSql, /check \(approval_path in \('system_bypass', 'system_department', 'human'\)\)/);
  // Must NOT be declared NOT NULL — legacy rows keep NULL.
  assert.equal(/approval_path text not null/i.test(migrationSql), false);
});

test("Audit: bypass auto-approval is labeled system_bypass and department auto-approval system_department", () => {
  // Both auto-approval transitions set the path from the bypass decision.
  const transitions = migrationSql.match(/new\.approval_path := case when member_bypasses_review then 'system_bypass' else 'system_department' end;/g) ?? [];
  // One for the INSERT path, one for the resubmission (UPDATE submitted) path.
  assert.equal(transitions.length, 2);
});

test("Audit: human approval is labeled only when a reviewer is present and review was required", () => {
  // The 'human' branch requires reviewed_by (never impersonated) AND review_required,
  // so a legacy/system NULL is never silently reclassified as human.
  assert.match(migrationSql, /new\.status = 'approved' and new\.reviewed_by is not null and new\.review_required then[\s\S]*?new\.approval_path := 'human'/);
});

test("Audit: non-approved records never carry an approval path (no pending/rejected mislabeled as approved)", () => {
  // draft/submitted/pending_review reset to NULL, and rejected resets to NULL.
  assert.match(migrationSql, /new\.status in \('draft', 'submitted', 'pending_review'\) then[\s\S]*?new\.approval_path := null;/);
  assert.match(migrationSql, /new\.status = 'rejected' then[\s\S]*?new\.approval_path := null;/);
});

test("Audit: approval_path is authoritative; review_notes is not used to determine the path", () => {
  // The path is set from reviewed_by / review_required / the bypass decision — never
  // from review_notes text. No transition should read review_notes to decide the path.
  const approvalBlocks = migrationSql.match(/new\.approval_path := [^;]+;/g) ?? [];
  assert.ok(approvalBlocks.length > 0);
  for (const block of approvalBlocks) {
    assert.equal(/review_notes/.test(block), false);
  }
});

test("Permission: trigger is security definer with a fixed search_path (RLS-safe grant lookup)", () => {
  assert.match(migrationSql, /security definer/i);
  assert.match(migrationSql, /set search_path = public, pg_temp/i);
});

test("Permission: bypass grant does not authorize reviewing others' submissions", () => {
  // The review-queue update policies gate on training_review / training_review_management /
  // training_management only — the new key must not appear in any review/write policy.
  const policiesSrc = readFileSync(resolve(process.cwd(), "supabase/migrations/20260912260000_align_training_permission_boundaries.sql"), "utf8");
  assert.equal(/training_entry_bypass_review/.test(policiesSrc), false);
});

test("Permission: grant lookup is scoped to the submission's own department and member (isolation)", () => {
  // The exists() lookup uses new.department_id + new.member_id only, so a grant in one
  // department can never auto-approve a submission in another for a multi-dept member.
  const lookup = migrationSql.match(/select exists \([\s\S]*?member_bypasses_review;/);
  assert.ok(lookup);
  assert.match(lookup[0], /map\.department_id = new\.department_id/);
  assert.match(lookup[0], /map\.member_id = new\.member_id/);
  // Every department/member comparison in the lookup is anchored to the row being
  // inserted (new.*) — no hardcoded or cross-department/member reference.
  const comparisons = lookup[0].match(/map\.(department_id|member_id)\s*=\s*([a-z_.]+)/g) ?? [];
  assert.ok(comparisons.length >= 2);
  for (const comparison of comparisons) {
    assert.match(comparison, /= new\./);
  }
});

test("Permission: submitter identity, reviewed_by/reviewed_at, and member notes are preserved", () => {
  // The trigger never touches new.member_id (submitter identity) and never assigns
  // new.notes (the member's own notes column is separate from review_notes).
  assert.equal(/new\.member_id\s*:=/.test(migrationSql), false);
  assert.equal(/new\.notes\s*:=/.test(migrationSql), false);
  // reviewed_by is only ever assigned the value null (cleared for non-approved rows);
  // the trigger never sets it to a human reviewer id.
  const reviewedByAssignments = migrationSql.match(/new\.reviewed_by\s*:=\s*[^;]+;/g) ?? [];
  for (const assignment of reviewedByAssignments) {
    assert.match(assignment, /:=\s*null;/);
  }
  // review_notes is only ever set to the system marker (write-once), never cleared.
  assert.equal(/new\.review_notes\s*:=\s*null/.test(migrationSql), false);
});

test("Permission: settings panel exposes the grant under Training with clear admin wording", () => {
  assert.match(permissionPanelSrc, /training_entry_bypass_review/);
  assert.match(permissionPanelSrc, /Training Entry — Bypass Review/);
  assert.match(permissionPanelSrc, /Does not allow reviewing others' submissions/);
});

// --- Simulation-labeled logic test: trigger decision shape ---
// NOTE: This models the trigger's decision logic; it does not execute the real
// PL/pgSQL function. It exists to pin the intended decision table. The live
// function behavior must be verified against the database after deployment.

type TriggerDecision = { reviewRequired: boolean; status: string; approvalPath: string | null };

function decideSubmission(opts: { memberBypasses: boolean; departmentRequiresReview: boolean }): TriggerDecision {
  const reviewRequired = opts.memberBypasses ? false : opts.departmentRequiresReview;
  if (reviewRequired) {
    return { reviewRequired: true, status: "pending_review", approvalPath: null };
  }
  return {
    reviewRequired: false,
    status: "approved",
    approvalPath: opts.memberBypasses ? "system_bypass" : "system_department",
  };
}

test("Decision table (simulated): bypass member is auto-approved as system_bypass", () => {
  assert.deepEqual(decideSubmission({ memberBypasses: true, departmentRequiresReview: true }), {
    reviewRequired: false,
    status: "approved",
    approvalPath: "system_bypass",
  });
});

test("Decision table (simulated): member without bypass follows the department policy", () => {
  assert.deepEqual(decideSubmission({ memberBypasses: false, departmentRequiresReview: true }), {
    reviewRequired: true,
    status: "pending_review",
    approvalPath: null,
  });
  assert.deepEqual(decideSubmission({ memberBypasses: false, departmentRequiresReview: false }), {
    reviewRequired: false,
    status: "approved",
    approvalPath: "system_department",
  });
});

test("Decision table (simulated): legacy records keep an unknown (NULL) approval path", () => {
  // The column is added without a default and no historical rows are updated, so any
  // record approved before this migration keeps approval_path NULL (path unknown).
  assert.equal(/update public\.training_outside_submissions set approval_path/i.test(migrationSql), false);
  assert.equal(/approval_path text not null/i.test(migrationSql), false);
});
