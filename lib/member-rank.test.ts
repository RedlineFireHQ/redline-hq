import assert from "node:assert/strict";
import test from "node:test";
import { isValidMemberRank, parseOptionalMemberRank } from "./app-permissions";
import { getReportSourceConfig } from "./reports/registry";

test("missing qualifications are not replaced with a fictional legacy rank", () => {
  for (const value of [null, "", "  "]) assert.deepEqual(parseOptionalMemberRank(value), { ok: true, rank: null });
});

test("personnel report exposes separate position, legacy rank and application permission columns", () => {
  const source = getReportSourceConfig("personnel");
  assert.ok(source);
  for (const [key, label] of [
    ["role_name", "Department Position"],
    ["rank", "Legacy Rank"],
    ["application_role", "Application Permission"],
  ]) {
    assert.equal(source.columns.find((column) => column.key === key)?.label, label);
  }
  assert.equal(source.filters.find((filter) => filter.key === "role_id")?.label, "Department Position");
});

test("legacy rank validates separately from department positions and application permissions", () => {
  for (const rank of ["Chief", "Battalion Chief", "Captain", "Firefighter"]) {
    assert.deepEqual(parseOptionalMemberRank(` ${rank} `), { ok: true, rank });
    assert.equal(isValidMemberRank(rank), true);
  }
  for (const value of ["Fire Chief", "Exterior Firefighter", "Administrator", undefined, 0, {}, []]) {
    assert.deepEqual(parseOptionalMemberRank(value), { ok: false });
  }
});
