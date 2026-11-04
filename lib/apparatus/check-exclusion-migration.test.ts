import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../../supabase/migrations/20261104092000_guard_red_oak_unit_141_check_writes.sql", import.meta.url),
  "utf8",
);
const rpcDraft = readFileSync(
  new URL("../../supabase/migrations/20261104091000_scope_red_oak_apparatus_check_exclusions.sql", import.meta.url),
  "utf8",
);
const databaseTests = readFileSync(
  new URL("../../supabase/tests/red_oak_unit_141.sql", import.meta.url),
  "utf8",
);

test("migration is one atomic forward-only block without data, policy or existing grant changes", () => {
  assert.match(migration, /^--[^\n]+\ndo \$migration\$/);
  assert.match(migration, /end;\n\$migration\$;\n$/);
  assert.doesNotMatch(migration.replace(/--[^\n]*/g, ""), /\b(?:insert into|delete from|truncate|drop|alter table|create policy|alter policy|grant)\b/i);
  assert.equal((migration.match(/revoke all on function/g) ?? []).length, 1);
  assert.match(migration, /revoke all on function public\.guard_red_oak_unit_141_check_write\(\)/);
});

test("all seven concrete write tables receive INSERT and UPDATE guards, never SELECT or DELETE guards", () => {
  const tables = [
    "apparatus_check_sessions", "apparatus_check_session_members", "apparatus_inspections",
    "apparatus_inspection_checklist_progress", "apparatus_inspection_checklist_results",
    "daily_checks", "deficiencies",
  ];
  const triggerLoop = migration.slice(migration.indexOf("  execute 'revoke all"));
  for (const table of tables) {
    assert.equal((triggerLoop.match(new RegExp(`'${table}'`, "g")) ?? []).length, 1, table);
    assert.ok(migration.includes(`('${table}',`), `reference-column preflight: ${table}`);
  }
  assert.match(migration, /before insert or update on public\.%I for each row/);
  assert.doesNotMatch(migration, /before (?:select|delete)/i);
});

test("apparatus exclusion resolves the exact UUID and actual Red Oak department, not a unit-name rule", () => {
  assert.match(migration, /'44d16b08-9adb-402a-bfe5-80ee5f4143c5'::uuid = any\(apparatus_ids\)/);
  assert.match(migration, /where a\.id = '44d16b08-9adb-402a-bfe5-80ee5f4143c5'::uuid\s+and a\.department_id = '82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid/);
  assert.doesNotMatch(migration, /a\.name|row_data ->> 'department_id'/);
});

test("actual session, inspection and checklist parents are resolved under private definer visibility", () => {
  assert.match(migration, /security definer\s+set search_path = pg_catalog, public, pg_temp/);
  assert.match(migration, /'session_id'[\s\S]*'check_session_id'/);
  assert.match(migration, /'inspection_id'[\s\S]*'completed_inspection_id'/);
  assert.match(migration, /from public\.apparatus_check_sessions s where s\.id = session_id for share/);
  assert.match(migration, /where i\.id = any\(inspection_ids\) for share/);
  assert.match(migration, /where i\.id = checklist_item_id for share/);
  assert.match(migration, /array_append\(inspection_ids, parent_row\.completed_inspection_id\)/);
  assert.match(migration, /a\.atttypid is distinct from 'uuid'::regtype/);
});

test("Daily exclusion is pinned to its actual item and scoped label, including detached result snapshots", () => {
  assert.match(migration, /parent_row\.department_id = '82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid\s+and parent_row\.apparatus_id = '57c966d3-107e-4c56-92ce-996edabe7d3c'::uuid/);
  assert.match(migration, /parent_row\.id = '4267b954-ca67-4a93-ac89-14d6bda940f9'::uuid\s+or btrim\(parent_row\.item_label\) = '141'/);
  assert.match(migration, /btrim\(row_data ->> 'item_label_snapshot'\) = '141'/);
  assert.match(migration, /errcode = '23514'/);
  assert.match(migration, /constraint = 'red_oak_unit_141_check_exclusion'/);
});

test("historical deficiency edits retain authorization but cannot change their linked apparatus or reporter", () => {
  const tuple = "apparatus_id, new.department_id, new.inspection_id, new.check_session_id, new.reported_by";
  assert.equal(migration.split(`row(new.${tuple})`).length - 1, 2);
  assert.match(migration, /tg_table_name = 'deficiencies' and tg_op = 'UPDATE'/);
  assert.match(migration, /is not distinct from\s+row\(old\.[^)]+\) then\s+return new/);
  assert.doesNotMatch(migration, /execute.*enforce_deficiency_update_authorization/);
});

test("both existing helper modifications have exact drift guards and retain their signatures", () => {
  for (const signature of [
    "can_insert_apparatus_check_session_member(uuid,uuid,uuid,uuid)",
    "validate_deficiency_check_session()",
  ]) {
    assert.ok(migration.includes(`to_regprocedure('public.${signature}')`));
  }
  assert.equal((migration.match(/\/ length\(marker\) <> 1/g) ?? []).length, 2);
  assert.equal((migration.match(/execute replace\(definition, marker, replacement\)/g) ?? []).length, 2);
  assert.match(migration, /s\.department_id = '82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid\s+and s\.apparatus_id = '44d16b08-9adb-402a-bfe5-80ee5f4143c5'::uuid/);
  assert.match(migration, /v_session\.department_id = '82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid/);
});

test("RPC prerequisite and Saturday requirements remain separate from the new write guards", () => {
  assert.match(migration, /Apply the reviewed 20261104091000 RPC draft first/);
  assert.doesNotMatch(migration, /i\.is_required|Saturday Only|Radio Checks|Fuel Checks/);
  assert.match(rpcDraft, /i\.is_required = true or/);
  assert.match(rpcDraft, /i\.section_name = 'Saturday Only'/);
  assert.match(rpcDraft, /extract\(dow from current_timestamp at time zone 'America\/Chicago'\) = 6/);
});

test("prepared database suite requires explicit isolated opt-in, empty data and rollback", () => {
  assert.match(databaseTests, /\\if :\{\?REDOAK_ISOLATED_TEST\}/);
  assert.match(databaseTests, /current_database\(\) not like 'redline_redoak_141_dev_%'/);
  assert.match(databaseTests, /exists \(select 1 from auth\.users\)/);
  assert.match(databaseTests, /rollback;\s*$/);
  for (const category of [
    "direct session", "direct inspection", "Daily 141 progress", "participant",
    "deficiency", "history", "114", "115", "116", "117", "Saturday",
    "cross-department", "unauthorized",
  ]) {
    assert.ok(databaseTests.includes(category), category);
  }
});
