import test from "node:test";
import assert from "node:assert/strict";

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
