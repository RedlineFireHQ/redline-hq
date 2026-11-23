import test from "node:test";
import assert from "node:assert/strict";
import { hydrostaticDueDate } from "./date";

test("hydrostatic retest is five calendar years after the test", () => {
  assert.equal(hydrostaticDueDate("2026-11-22"), "2031-11-22");
  assert.equal(hydrostaticDueDate("2024-02-29"), "2029-02-28");
  assert.equal(hydrostaticDueDate("2023-12-31"), "2028-12-31");
  assert.throws(() => hydrostaticDueDate("2023-02-29"));
});
