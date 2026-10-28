import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const route = read("app/api/maintenance/records/route.ts");
const hook = read("components/maintenance/useMaintenancePermission.ts");
const detailPage = read("app/maintenance/[id]/page.tsx");

test("performing maintenance needs only an active member of the active department", () => {
  assert.doesNotMatch(route, /status:\s*403|field entry permission/i);
  assert.match(route, /getCurrentMember\(supabase\)/);
  assert.match(route, /\.eq\("active", true\)/);
  assert.match(route, /\.eq\("department_id", currentMember\.departmentId\)/);
  assert.match(hook, /useActiveMember/);
  assert.doesNotMatch(hook, /member_has_app_permission/);
});

test("members without maintenance_management are recorded as the completing member", () => {
  assert.match(route, /if \(!canManageMaintenance\) \{\s*payload\.completed_by = currentMember\.id;/);
});

test("record insert uses an explicit allowlist and server-owned id and department", () => {
  const insertBlock = route.slice(route.indexOf('from("maintenance_records").insert('), route.indexOf("if (insertError)"));
  assert.doesNotMatch(insertBlock, /\.\.\.payload/);
  assert.match(insertBlock, /id: recordId,\s*department_id: currentMember\.departmentId,/);
  for (const field of [
    "apparatus_id", "deficiency_id", "maintenance_type", "completed_by", "service_date", "description",
    "parts_used", "labor_hours", "mileage", "engine_hours", "cost", "notes",
  ]) {
    assert.match(insertBlock, new RegExp(`${field}: payload\\.${field}`));
  }
  for (const protectedField of ["maintenance_number", "created_at", "updated_at"]) {
    assert.doesNotMatch(insertBlock, new RegExp(`${protectedField}:`));
  }
  assert.match(insertBlock, /photos: \[\],\s*attachments: \[\],/);
});

test("linked records are validated against the caller's department", () => {
  assert.match(route, /Apparatus is invalid for this department/);
  assert.match(route, /Deficiency is invalid for this department/);
  assert.match(route, /Completed-by member is invalid for this department/);
});

test("editing maintenance records stays restricted to maintenance_management", () => {
  assert.match(detailPage, /hasDepartmentPermission\([^)]*"maintenance_management"\)/);
  assert.match(detailPage, /canManageMaintenance \? <EditMaintenanceButton/);
});

test("mobile maintenance no longer requires maintenance_field_entry but still requires an active member", () => {
  const mobilePage = read("app/mobile/maintenance/page.tsx");
  const mobileHome = read("app/mobile/page.tsx");
  assert.doesNotMatch(mobilePage, /maintenance_field_entry/);
  assert.doesNotMatch(mobileHome, /maintenance_field_entry|hasMobileMaintenanceFieldEntry/);
  assert.match(mobilePage, /\.eq\("active", true\)/);
  assert.match(mobilePage, /\.eq\("department_id", departmentId\)/);
});

test("deficiency history link is written server-side after department validation", () => {
  const modal = read("components/maintenance/MaintenanceFormModal.tsx");
  assert.doesNotMatch(modal, /from\("deficiency_history"\)/);
  assert.match(route, /admin\.from\("deficiency_history"\)\.insert/);
});
