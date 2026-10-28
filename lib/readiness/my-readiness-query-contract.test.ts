import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const readinessPage = readFileSync(resolve(process.cwd(), "app/my-readiness/page.tsx"), "utf8");
const allocationHelper = readFileSync(resolve(process.cwd(), "lib/ems/persistent-allocation.ts"), "utf8");
const accessMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261027130000_restore_authenticated_department_reads.sql"),
  "utf8",
);

test("My Readiness embeds use the deployed deficiency foreign-key constraint names", () => {
  assert.match(readinessPage, /deficiency_statuses!deficiencies_status_fkey/);
  assert.match(readinessPage, /deficiency_priorities!deficiencies_priority_fkey/);
  assert.doesNotMatch(readinessPage, /!fk_deficiencies_(?:status|priority)/);
});

test("member history queries are explicitly scoped to the current department where supported", () => {
  assert.match(readinessPage, /from\("deficiencies"\)[\s\S]*?\.eq\("department_id", currentMember\.departmentId\)[\s\S]*?\.eq\("assigned_to", currentMember\.id\)/);
  assert.match(readinessPage, /from\("maintenance_records"\)[\s\S]*?\.eq\("department_id", currentMember\.departmentId\)[\s\S]*?\.eq\("completed_by", currentMember\.id\)/);
  assert.match(readinessPage, /from\("apparatus_inspections"\)[\s\S]*?\.eq\("department_id", currentMember\.departmentId\)[\s\S]*?\.eq\("member_id", currentMember\.id\)/);
  assert.match(readinessPage, /from\("apparatus_check_session_members"\)[\s\S]*?\.eq\("department_id", currentMember\.departmentId\)[\s\S]*?\.eq\("member_id", currentMember\.id\)/);
  assert.match(allocationHelper, /from\("ems_requirement_components"\)[\s\S]*?\.eq\("department_id", departmentId\)/);
  assert.match(allocationHelper, /from\("ems_requirement_topics"\)[\s\S]*?\.eq\("department_id", departmentId\)/);
});

test("conditional My Readiness reads have grants and Auth-ID-aware department policies", () => {
  for (const table of [
    "documents",
    "ems_course_definitions",
    "ems_member_ce_cycles",
    "ems_requirement_sets",
    "ems_requirement_components",
    "ems_requirement_topics",
  ]) {
    assert.match(accessMigration, new RegExp(`public\\.${table}`));
  }

  assert.match(accessMigration, /m\.auth_user_id = auth\.uid\(\)/);
  assert.match(accessMigration, /m\.department_id = ems_requirement_components\.department_id/);
  assert.match(accessMigration, /m\.department_id = ems_requirement_topics\.department_id/);
  assert.match(accessMigration, /p\.department_id = ems_member_ce_cycles\.department_id/);
  assert.doesNotMatch(accessMigration, /grant\s+select\s+on\s+table[\s\S]*?\bto\s+anon/i);
});