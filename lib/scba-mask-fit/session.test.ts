import { strict as assert } from "node:assert";
import { test } from "node:test";
import { isCompleteSession, searchAvailableMembers, type FitEntry } from "./session";

const members = [{ id: "1", name: "Alex Smith" }, { id: "2", name: "Sam Adams" }];
const first: FitEntry = { member: members[0], result: "Fail", size: "S" };
const second: FitEntry = { member: members[1], result: "Pass", size: "L" };

test("personnel search matches names and excludes already-added members", () => {
  assert.deepEqual(searchAvailableMembers(members, [first], " smith "), []);
  assert.deepEqual(searchAvailableMembers(members, [first], "ADAMS"), [members[1]]);
  assert.deepEqual(searchAvailableMembers(members, [], ""), []);
});

test("sessions require complete, unique individual results", () => {
  assert.equal(isCompleteSession("Annual", "2026-01-01", "Tester", [first, second]), true);
  assert.equal(isCompleteSession("Annual", "2026-01-01", "Tester", [first, first]), false);
  assert.equal(isCompleteSession("Annual", "2026-01-01", "Tester", [{ ...first, size: "" }]), false);
  assert.equal(isCompleteSession("Annual", "2026-01-01", "Tester", [{ ...first, result: "" }]), false);
  assert.equal(isCompleteSession("Annual", "2026-01-01", "Tester", []), false);
});
