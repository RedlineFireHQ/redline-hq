import assert from "node:assert/strict";
import test from "node:test";
import { applicableChecklistItems, canStartApparatusCheck, isExcludedFromApparatusChecks, isRedOakDailyChecks } from "./check-eligibility";
import { isScheduledChecklistItemRequired } from "./daily-checks";

const redOak = "82f50d14-216a-4dd1-80f4-58459dc97b97";
const elliott = "4d811b72-1857-4cf4-93b5-9cbbd889153f";
const cedar = "44a25960-7d46-45c4-94e9-115833072da8";
const unit = { id: "44d16b08-9adb-402a-bfe5-80ee5f4143c5", department_id: redOak, name: "141" };
const daily = { id: "57c966d3-107e-4c56-92ce-996edabe7d3c", department_id: redOak, name: "Daily Apparatus Checks", type: "Administrative", include_in_department_readiness: false };

test("Red Oak Unit 141 is excluded by identity even after a name change", () => {
  assert.equal(isExcludedFromApparatusChecks(unit), true);
  assert.equal(canStartApparatusCheck(unit, redOak), false);
  assert.equal(isExcludedFromApparatusChecks({ ...unit, name: "Renamed" }), true);
});

test("same names and copied IDs do not exclude Elliott or Cedar units", () => {
  for (const department_id of [elliott, cedar]) {
    assert.equal(canStartApparatusCheck({ ...unit, department_id }, department_id), true);
    assert.equal(isRedOakDailyChecks({ ...daily, department_id }, department_id), false);
  }
});

test("authenticated department is mandatory and must match record ownership", () => {
  for (const context of [null, undefined, "", elliott, cedar]) {
    assert.equal(canStartApparatusCheck(daily, context), false);
    assert.equal(isRedOakDailyChecks(daily, context), false);
  }
});

test("Daily administrative assignment remains selectable despite its readiness flag", () => {
  assert.equal(canStartApparatusCheck(daily, redOak), true);
  assert.equal(isRedOakDailyChecks(daily, redOak), true);
  assert.equal(isRedOakDailyChecks({ ...daily, type: "Engine" }, redOak), false);
});

test("template exclusion removes only 141 from special mode without mutating inputs", () => {
  const rows = ["114", "141", "Daily", "Radio Checks"].map((itemLabel) => ({ itemLabel }));
  assert.deepEqual(applicableChecklistItems(rows, true).map((r) => r.itemLabel), ["114", "Daily", "Radio Checks"]);
  assert.deepEqual(applicableChecklistItems(rows, false), rows);
  assert.equal(rows.length, 4);
});

test("Saturday radio/fuel requirements are scoped and do not alter stored configuration", () => {
  for (const name of ["Radio Checks", "Fuel Checks"]) {
    const item = { name, sectionName: "Saturday Only", isRequired: false };
    assert.equal(isScheduledChecklistItemRequired(item, true, true), true);
    assert.equal(isScheduledChecklistItemRequired(item, true, false), false);
    assert.equal(isScheduledChecklistItemRequired(item, false, true), false);
    assert.equal(item.isRequired, false);
  }
});
