import assert from "node:assert/strict";
import test from "node:test";

import { normalizeRopeStatus } from "./rope-status";

test("rope status preserves Out of Service", () => {
  assert.equal(normalizeRopeStatus("Active"), "Active");
  assert.equal(normalizeRopeStatus("Inactive"), "Inactive");
  assert.equal(normalizeRopeStatus("Out of Service"), "Out of Service");
  assert.equal(normalizeRopeStatus("out of service"), "Out of Service");
});
