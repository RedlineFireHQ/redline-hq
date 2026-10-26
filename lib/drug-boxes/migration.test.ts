import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Structural validation for the Drug Box migration. Locks the schema, RLS
 * department scoping, the admin-only delete RPC, and the Red Oak seed in place.
 * These parse the migration source; they do NOT execute SQL against a database.
 */

const RAW = readFileSync(
  join(__dirname, "../../supabase/migrations/20261018120000_create_drug_box_inspection_foundation.sql"),
  "utf8",
);
// Strip line comments so prose never counts as SQL.
const SQL = RAW.replace(/--[^\n]*/g, "");

test("DRUGSQL1. all four drug box tables are created", () => {
  for (const table of ["drug_boxes", "drug_box_checklist_items", "drug_box_inspections", "drug_box_checklist_results"]) {
    assert.match(SQL, new RegExp(`create table if not exists public\\.${table} `), `missing create table for ${table}`);
  }
});

test("DRUGSQL2. inspection records carry squad/unit, inspector, and the three lock fields", () => {
  for (const col of ["squad_number", "unit_number", "box_lock_number", "cs_lock_number", "ez_io_number", "member_id", "department_id"]) {
    assert.match(SQL, new RegExp(`\\b${col}\\b`), `missing column ${col}`);
  }
});

test("DRUGSQL3. snapshot results freeze section, label, quantity, and checked state", () => {
  for (const col of ["section_name_snapshot", "item_label_snapshot", "required_quantity_snapshot", "is_checked", "item_order"]) {
    assert.match(SQL, new RegExp(`\\b${col}\\b`), `missing snapshot column ${col}`);
  }
});

test("DRUGSQL4. RLS is enabled on all four tables and scoped to the member's department", () => {
  for (const table of ["drug_boxes", "drug_box_checklist_items", "drug_box_inspections", "drug_box_checklist_results"]) {
    assert.match(SQL, new RegExp(`alter table public\\.${table} enable row level security`), `RLS not enabled on ${table}`);
  }
  // Policies resolve membership within the row's own department.
  const departmentScopedPolicies = SQL.match(/m\.department_id = \w+\.department_id/g) ?? [];
  assert.ok(departmentScopedPolicies.length >= 8, "expected department-scoped RLS policies");
});

test("DRUGSQL5. delete RPC is SECURITY DEFINER, admin-only, and department-scoped", () => {
  assert.match(SQL, /create or replace function public\.delete_drug_box_inspection\(p_inspection_id uuid\)/);
  assert.match(SQL, /security definer/i);
  assert.match(SQL, /set search_path = public, auth, pg_temp/);
  // Resolves the requester within the inspection's own department.
  assert.match(SQL, /m\.department_id = v_inspection\.department_id/);
  // Administrator gate.
  assert.match(SQL, /lower\(coalesce\(m\.role, ''\)\) = 'administrator'/);
});

test("DRUGSQL6. delete RPC removes only the inspection's snapshot rows and the inspection", () => {
  assert.match(SQL, /delete from public\.drug_box_checklist_results/);
  assert.match(SQL, /r\.inspection_id = v_inspection\.id/);
  assert.match(SQL, /r\.department_id = v_inspection\.department_id/);
  assert.match(SQL, /delete from public\.drug_box_inspections/);
  assert.match(SQL, /i\.id = v_inspection\.id/);
});

test("DRUGSQL7. delete RPC never touches boxes, template items, members, or departments", () => {
  for (const pattern of [
    /delete from public\.drug_boxes\b/,
    /delete from public\.drug_box_checklist_items/,
    /delete from public\.members\b/,
    /delete from public\.departments\b/,
  ]) {
    assert.doesNotMatch(SQL, pattern, `migration must not contain ${pattern}`);
  }
});

test("DRUGSQL8. delete RPC execute privilege is locked to authenticated", () => {
  assert.match(SQL, /revoke all on function public\.delete_drug_box_inspection\(uuid\) from public/);
  assert.match(SQL, /revoke all on function public\.delete_drug_box_inspection\(uuid\) from anon/);
  assert.match(SQL, /grant execute on function public\.delete_drug_box_inspection\(uuid\) to authenticated/);
});

test("DRUGSQL9. seeds the four squad boxes (114-117) for Red Oak, idempotently", () => {
  assert.match(SQL, /82f50d14-216a-4dd1-80f4-58459dc97b97/);
  for (const squad of ["'114'", "'115'", "'116'", "'117'"]) {
    assert.match(SQL, new RegExp(squad.replace(/'/g, "\\'")), `missing squad ${squad}`);
  }
  assert.match(SQL, /on conflict \(department_id, squad_number\) do nothing/);
});

test("DRUGSQL10. seeds the shared checklist template (63 items) idempotently", () => {
  const itemInserts = SQL.match(/\('82f50d14-216a-4dd1-80f4-58459dc97b97'::uuid, '(?:Section 1|Section 2|Section 3|EZ-IO)'/g) ?? [];
  assert.equal(itemInserts.length, 63, "expected 63 seeded checklist items");
  assert.match(SQL, /on conflict \(department_id, lower\(btrim\(section_name\)\), lower\(btrim\(item_label\)\)\) do nothing/);
});
