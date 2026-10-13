import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { getReportSourceConfig } from "./registry";
import {
  getInventoryReportTypeOptions,
  resolveInventoryReportMode,
} from "./inventory-report";

test("fire hose exposes only real report types", () => {
  assert.deepEqual(getInventoryReportTypeOptions("fire-hose"), [
    { value: "inventory", label: "Inventory" },
    { value: "fire-hose-testing", label: "Hose Testing" },
    { value: "deficiencies", label: "Deficiencies" },
  ]);
});

test("gas monitor exposes calibration and deficiencies only", () => {
  assert.deepEqual(getInventoryReportTypeOptions("gas-monitors"), [
    { value: "inventory", label: "Inventory" },
    { value: "gas-monitor-calibration", label: "Calibration" },
    { value: "deficiencies", label: "Deficiencies" },
  ]);
});

test("all inventory keeps a simple inventory-only drill-down", () => {
  assert.deepEqual(getInventoryReportTypeOptions("all"), [
    { value: "inventory", label: "Inventory" },
  ]);
});

test("pagers exposes inventory and deficiencies report types", () => {
  assert.deepEqual(getInventoryReportTypeOptions("pagers"), [
    { value: "inventory", label: "Inventory" },
    { value: "deficiencies", label: "Deficiencies" },
  ]);
});

test("pagers is a selectable inventory category in the reports registry", () => {
  const source = getReportSourceConfig("inventory");

  assert.ok(source);
  const categoryFilter = source.filters.find((filter) => filter.key === "inventory_category");
  assert.ok(categoryFilter);
  assert.ok(categoryFilter.options?.some((option) => option.value === "pagers" && option.label === "Pagers"));
});

test("pagers report mode resolves to the expected inventory workflow", () => {
  assert.equal(resolveInventoryReportMode("pagers", "inventory").categoryKey, "pagers");
  assert.equal(resolveInventoryReportMode("pagers", "deficiencies").reportTypeKey, "deficiencies");
});

test("pagers migration creates member assignment with same-department enforcement", () => {
  const migration = readFileSync(
    join(__dirname, "../../supabase/migrations/20260918120000_create_pagers_inventory_category.sql"),
    "utf8",
  );

  assert.match(migration, /assigned_member_id uuid references public\.members \(id\)/);
  assert.match(migration, /validate_pager_assigned_member_department/);
  assert.match(migration, /m\.department_id = new\.department_id/);
  assert.match(migration, /create index if not exists pagers_assigned_member_idx/);
});

test("pagers workspace renders Assigned To dropdown and omits Pager Type field", () => {
  const workspace = readFileSync(
    join(__dirname, "../../components/inventory/PagersWorkspace.tsx"),
    "utf8",
  );

  // Assigned To dropdown present with an Unassigned option and member options.
  assert.match(workspace, />Assigned To/);
  assert.match(workspace, /<option value="">Unassigned<\/option>/);
  assert.match(workspace, /memberOptions\.map/);
  // Pager Type input removed from the form.
  assert.doesNotMatch(workspace, />Pager Type</);
  assert.doesNotMatch(workspace, /formValues\.pagerType/);
});

test("report mode resolves to the expected inventory workflow", () => {
  assert.equal(resolveInventoryReportMode("fire-hose", "fire-hose-testing").categoryKey, "fire-hose");
  assert.equal(resolveInventoryReportMode("gas-monitors", "gas-monitor-calibration").reportTypeKey, "gas-monitor-calibration");
  assert.equal(resolveInventoryReportMode("all", "inventory").reportTypeKey, "inventory");
});

test("pre-plans exposes an available updated-date report without a date-basis UI", () => {
  const source = getReportSourceConfig("pre-plans");

  assert.ok(source);
  assert.equal(source.availability, "available");
  assert.deepEqual(source.filters, []);
  assert.deepEqual(source.columns.map((column) => column.key), [
    "business_name",
    "address",
    "city",
    "state",
    "zip",
    "occupancy_id_number",
    "last_verified_at",
    "updated_at",
    "primary_contact_name",
    "primary_contact_phone",
    "normal_occupant_load",
    "hydrant_count",
    "hazard_count",
    "critical_information",
  ]);
});
