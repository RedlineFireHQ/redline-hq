import assert from "node:assert/strict";
import test from "node:test";
import { resolveInventoryOverviewCategories } from "./inventory-overview";

const categories = [
  { name: "Fire Hose", detail: "Department-scoped inventory", countLabel: "sections", countTables: ["fire_hose"] },
  { name: "EMS Inventory", detail: "Department-scoped inventory", countLabel: "tracked items", countTables: ["ems_supply_items", "ems_equipment"] },
  { name: "Rope", detail: "Department-scoped inventory" },
];

test("inventory overview uses the selected department counts, including zero", () => {
  const resolved = resolveInventoryOverviewCategories(
    categories,
    new Map([
      ["fire_hose", 20],
      ["ems_supply_items", 13],
      ["ems_equipment", 3],
    ]),
  );

  assert.equal(resolved[0].detail, "20 sections");
  assert.equal(resolved[1].detail, "16 tracked items");
  assert.equal(resolved[2].detail, "Department-scoped inventory");

  const empty = resolveInventoryOverviewCategories(categories, new Map([["fire_hose", 0]]));
  assert.equal(empty[0].detail, "0 sections");
});

test("inventory overview does not show static counts without a department or after query errors", () => {
  const noDepartment = resolveInventoryOverviewCategories(categories, null);
  assert.equal(noDepartment[0].detail, "Select a department to view count");

  const unavailable = resolveInventoryOverviewCategories(categories, new Map([["fire_hose", null]]));
  assert.equal(unavailable[0].detail, "Count unavailable");
});