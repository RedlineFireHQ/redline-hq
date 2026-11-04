import assert from "node:assert/strict";
import { test } from "node:test";

import {
  bulkPassTargets,
  deficiencyPrefill,
  isSaturday,
  needsAllPassConfirmation,
  statusLabelsFor,
  unmarkedActionLabel,
  visibleSectionNames,
  DAILY_CHECKS_SATURDAY_SECTION,
} from "./daily-checks";

test("statusLabelsFor returns PASS/FAIL in special mode", () => {
  const labels = statusLabelsFor(true);
  assert.equal(labels.checked, "PASS");
  assert.equal(labels.deficiency, "FAIL");
  assert.equal(labels.notApplicable, "N/A");
});

test("statusLabelsFor returns PRESENT/MISSING for normal apparatus", () => {
  const labels = statusLabelsFor(false);
  assert.equal(labels.checked, "PRESENT");
  assert.equal(labels.deficiency, "MISSING");
  assert.equal(labels.notApplicable, "N/A");
});

test("unmarkedActionLabel differs by mode", () => {
  assert.equal(unmarkedActionLabel(true), "Tap to mark Pass / Fail / N/A");
  assert.equal(unmarkedActionLabel(false), "Tap to mark");
});

test("isSaturday uses Red Oak's Central calendar, independent of host timezone", () => {
  assert.equal(isSaturday(new Date("2026-10-17T18:00:00Z")), true);
  assert.equal(isSaturday(new Date("2026-10-20T18:00:00Z")), false);
  assert.equal(isSaturday(new Date("2026-10-18T04:59:59Z")), true);
  assert.equal(isSaturday(new Date("2026-10-18T05:00:00Z")), false);
});

test("visibleSectionNames hides Saturday section on weekdays", () => {
  const sections = ["Apparatus", DAILY_CHECKS_SATURDAY_SECTION];
  assert.deepEqual(visibleSectionNames(sections, false), ["Apparatus"]);
  assert.deepEqual(visibleSectionNames(sections, true), ["Apparatus", DAILY_CHECKS_SATURDAY_SECTION]);
});

test("bulkPassTargets excludes Saturday-only items on weekdays", () => {
  const items = [
    { id: "a", sectionName: "Apparatus" },
    { id: "b", sectionName: DAILY_CHECKS_SATURDAY_SECTION },
  ];
  assert.deepEqual(bulkPassTargets(items, false).map((i) => i.id), ["a"]);
  assert.deepEqual(bulkPassTargets(items, true).map((i) => i.id), ["a", "b"]);
});

test("deficiencyPrefill names the unit only in special mode", () => {
  assert.equal(deficiencyPrefill("117", true), "Unit 117 — ");
  assert.equal(deficiencyPrefill("117", false), "");
});

test("All Pass requires confirmation only when not undoing", () => {
  assert.equal(needsAllPassConfirmation(false), true);
  assert.equal(needsAllPassConfirmation(true), false);
});
