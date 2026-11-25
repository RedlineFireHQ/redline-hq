import { strict as assert } from "node:assert";
import { test } from "node:test";
import { annualDueDate, fitStatus, fitTestLocalDate, latestTests, type FitTest } from "./status";

test("Central date follows local midnight, year boundary and daylight saving time", () => {
  assert.equal(fitTestLocalDate(new Date("2027-01-01T05:59:59Z")), "2026-12-31");
  assert.equal(fitTestLocalDate(new Date("2027-01-01T06:00:00Z")), "2027-01-01");
  assert.equal(fitTestLocalDate(new Date("2026-07-01T04:59:59Z")), "2026-06-30");
  assert.equal(fitTestLocalDate(new Date("2026-07-01T05:00:00Z")), "2026-07-01");
  assert.equal(fitStatus({ date: "2025-12-31", result: "Pass" }, fitTestLocalDate(new Date("2027-01-01T05:59:59Z"))), "Current");
  assert.equal(fitStatus({ date: "2025-12-31", result: "Pass" }, fitTestLocalDate(new Date("2027-01-01T06:00:00Z"))), "Overdue");
});

test("annual dates use calendar years including leap day", () => {
  assert.equal(annualDueDate("2024-02-29"), "2025-02-28");
  assert.equal(annualDueDate("2025-12-31"), "2026-12-31");
  assert.throws(() => annualDueDate("2025-02-29"));
});

test("failures require action and a passing test expires after its due date", () => {
  assert.equal(fitStatus(null, "2026-01-01"), "No recorded test");
  assert.equal(fitStatus({ date: "2025-01-01", result: "Pass" }, "2026-01-01"), "Current");
  assert.equal(fitStatus({ date: "2025-01-01", result: "Pass" }, "2026-01-02"), "Overdue");
  assert.equal(fitStatus({ date: "2025-12-31", result: "Fail" }, "2026-01-01"), "Failed - action required");
});

test("latest selection preserves every input record and uses deterministic ties", () => {
  const base: FitTest = { memberId: "a", date: "2025-01-01", result: "Fail", maskSize: "S", tester: "Tester", sessionId: "a", sessionName: "Annual", createdAt: "2025-01-01T10:00:00Z" };
  const records: FitTest[] = [base, { ...base, result: "Pass", sessionId: "b", createdAt: "2025-01-01T11:00:00Z" }];
  assert.equal(latestTests(records).get("a")?.result, "Pass");
  assert.equal(records.length, 2);
  assert.equal(records[0].result, "Fail");
});
