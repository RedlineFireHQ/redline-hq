import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL(
  "../../supabase/migrations/20261104093000_enforce_apparatus_inspection_write_ownership.sql",
  import.meta.url,
), "utf8");
const tests = readFileSync(new URL("../../supabase/tests/red_oak_unit_141.sql", import.meta.url), "utf8");

test("inspection ownership migration is atomic, additive and changes no history or existing grants", () => {
  assert.match(migration, /do \$migration\$/);
  assert.match(migration, /end;\n\$migration\$;\s*$/);
  assert.doesNotMatch(migration, /\b(?:insert into|delete from|truncate|drop policy|alter policy|alter table)\b/i);
  assert.doesNotMatch(migration, /\b(?:begin|commit|rollback);/i);
  assert.doesNotMatch(migration, /grant (?:insert|update|all)|for select|for delete/i);
  assert.match(migration, /already exist; review rather than overwrite/);
});

test("new INSERT and UPDATE restrictions AND with existing authorization without enabling updates", () => {
  assert.match(migration, /as restrictive for insert to public/);
  assert.match(migration, /as restrictive for update to public/);
  assert.doesNotMatch(migration, /as permissive/);
  assert.equal((migration.match(/public\.can_write_apparatus_inspection\(apparatus_id, department_id\)/g) ?? []).length, 3);
  assert.match(migration, /using \(public\.can_write_apparatus_inspection/);
});

test("authorization uses actual apparatus ownership and active authenticated membership", () => {
  assert.match(migration, /join public\.members m on m\.department_id = a\.department_id/);
  assert.match(migration, /a\.id = p_apparatus_id\s+and a\.department_id = p_department_id/);
  assert.match(migration, /auth\.uid\(\) is not null/);
  assert.match(migration, /coalesce\(m\.active, false\) = true/);
  assert.match(migration, /m\.auth_user_id = auth\.uid\(\)/);
  assert.match(migration, /m\.auth_user_id is null/);
  assert.match(migration, /from auth\.users u where u\.id = auth\.uid\(\) and u\.deleted_at is null/);
  assert.doesNotMatch(migration, /auth\.email\(\)|82f50d14|44d16b08/);
});

test("RPC and privileged writes also enforce actual parent consistency with a parent lock", () => {
  assert.match(migration, /from public\.apparatus a where a\.id = new\.apparatus_id for share/);
  assert.match(migration, /new\.department_id is distinct from v_department_id/);
  assert.match(migration, /errcode = '42501'/);
  assert.match(migration, /before insert or update on public\.apparatus_inspections/);
  assert.match(migration, /revoke all on function public\.validate_apparatus_inspection_department\(\) from public, anon, authenticated, service_role/);
});

test("database regressions exercise both forged department variants, valid direct writes and foreign updates", () => {
  for (const label of [
    "cross-department normal inspection cannot forge its department",
    "foreign user cannot insert by supplying the actual Red Oak department",
    "foreign user cannot modify another department inspection",
    "direct UPDATE remains denied and cannot retarget own inspection",
    "own department direct inspection succeeds",
    "own department user cannot submit mismatched inspection department",
    "ownership trigger rejects mismatched UPDATE even under schema-owner/RPC visibility",
  ]) {
    assert.ok(tests.includes(label), label);
  }
  assert.match(tests, /get diagnostics v_changed=row_count/);
  assert.match(tests, /v_changed=0/);
});
