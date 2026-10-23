import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20261023120000_fix_member_permission_department_resolution.sql",
);
const sql = readFileSync(migrationPath, "utf8");

test("Permission fix: redefines member_has_app_permission", () => {
  assert.match(sql, /create or replace function public\.member_has_app_permission\(/i);
});

test("Permission fix: resolves the member FOR the requested department", () => {
  // The core fix: the member lookup must be filtered to p_department_id so a
  // multi-department user's other membership is never selected.
  assert.match(sql, /where m\.department_id = p_department_id/i);
});

test("Permission fix: does not rely on the single-row access-context resolver", () => {
  // The buggy path selected one membership via resolve_requesting_member_access_context()
  // and then filtered it away. The fixed function must not invoke it. (The migration's
  // header comment references the name for documentation; only an actual FROM call counts.)
  assert.equal(/from\s+public\.resolve_requesting_member_access_context/i.test(sql), false);
});

test("Permission fix: preserves the administrator short-circuit", () => {
  assert.match(sql, /if v_role = 'administrator' then/i);
  assert.match(sql, /return true;/i);
});

test("Permission fix: preserves the active-membership requirement", () => {
  assert.match(sql, /coalesce\(m\.active, false\) = true/i);
});

test("Permission fix: preserves the special-permissions gate", () => {
  assert.match(sql, /special_permissions_enabled/i);
});

test("Permission fix: preserves the explicit member_app_permissions grant check", () => {
  assert.match(sql, /from public\.member_app_permissions/i);
  assert.match(sql, /map\.permission_key = p_permission_key/i);
});

test("Permission fix: still returns false when no matching membership exists", () => {
  assert.match(sql, /if v_member_id is null then/i);
});

test("Permission fix: re-grants execute only to authenticated", () => {
  assert.match(sql, /grant execute on function public\.member_has_app_permission\(uuid, text\) to authenticated;/i);
});
