import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { completeHoseTest, formatHoseTestDate, hoseNextTestLabel, hoseTestingDate } from "./fire-hose-testing";

test("completion uses one atomic RPC with the actual testing date and exact results", async () => {
  const calls: unknown[] = [];
  const client = {
    rpc: async (...args: unknown[]) => { calls.push(args); return { data: "saved-session", error: null }; },
  } as unknown as SupabaseClient;
  const values = {
    departmentId: "synthetic-department", testingDate: "2026-11-05", tester: "Local Tester",
    results: [{ hose_id: "synthetic-hose", result: "pass" as const }],
  };
  assert.equal(await completeHoseTest(client, values), "saved-session");
  assert.deepEqual(calls, [["complete_fire_hose_test", {
    p_department_id: values.departmentId, p_test_date: values.testingDate,
    p_tester: values.tester, p_results: values.results,
  }]]);
});

test("database failure and missing saved session are explicit errors", async () => {
  const values = { departmentId: "local", testingDate: "2026-11-05", tester: "Local", results: [] };
  for (const response of [{ data: null, error: { message: "Save rolled back" } }, { data: null, error: null }]) {
    const client = { rpc: async () => response } as unknown as SupabaseClient;
    await assert.rejects(completeHoseTest(client, values), /Save rolled back|saved session/);
  }
});

test("completion preserves an explicitly selected historical date without normalizing it to today", async () => {
  const calls: unknown[] = [];
  const client = {
    rpc: async (...args: unknown[]) => { calls.push(args); return { data: "historical-session", error: null }; },
  } as unknown as SupabaseClient;
  await completeHoseTest(client, {
    departmentId: "synthetic-department", testingDate: "2024-02-29", tester: "Local Tester",
    results: [{ hose_id: "synthetic-hose", result: "pass" }],
  });
  assert.deepEqual(calls, [["complete_fire_hose_test", {
    p_department_id: "synthetic-department", p_test_date: "2024-02-29",
    p_tester: "Local Tester", p_results: [{ hose_id: "synthetic-hose", result: "pass" }],
  }]]);
});

test("date display includes the actual day without shifting a date-only value", () => {
  assert.equal(formatHoseTestDate("2026-11-05"), "Nov 5, 2026");
  assert.equal(formatHoseTestDate("2028-02-29"), "Feb 29, 2028");
  assert.equal(formatHoseTestDate(null), "-");
  assert.equal(hoseNextTestLabel(null), "Pending");
});

test("due indicator uses calendar days, including due today, and preserves missing dates", () => {
  const today = new Date("2026-11-06T02:00:00Z");
  assert.equal(hoseNextTestLabel("2026-11-04", today), "Overdue");
  assert.equal(hoseNextTestLabel("2026-11-05", today), "Nov 5, 2026");
  assert.equal(hoseNextTestLabel("2027-11-05", today), "Nov 5, 2027");
  assert.equal(hoseNextTestLabel(null, today), "Pending");
});

test("hose test defaults follow the configured Central calendar, not UTC or the device", () => {
  assert.equal(hoseTestingDate(new Date("2026-11-06T00:24:00Z")), "2026-11-05");
  assert.equal(hoseTestingDate(new Date("2026-11-06T05:59:59Z")), "2026-11-05");
  assert.equal(hoseTestingDate(new Date("2026-11-06T06:00:00Z")), "2026-11-06");
  assert.equal(hoseTestingDate(new Date("2026-07-06T04:59:59Z")), "2026-07-05");
  assert.equal(hoseTestingDate(new Date("2026-07-06T05:00:00Z")), "2026-07-06");
  assert.equal(hoseTestingDate(new Date("2028-03-01T01:00:00Z")), "2028-02-29");
  assert.equal(hoseTestingDate(new Date("2026-03-08T08:00:00Z")), "2026-03-08");
  assert.equal(hoseTestingDate(new Date("2026-11-01T07:00:00Z")), "2026-11-01");
  assert.equal(hoseTestingDate(new Date("2026-11-06T00:24:00Z"), "America/Los_Angeles"), "2026-11-05");
  assert.equal(hoseNextTestLabel("2026-11-05", new Date("2026-11-06T00:24:00Z")), "Nov 5, 2026");
});

test("both test workflows use department-calendar defaults and retain explicitly selected dates", () => {
  const desktop = readFileSync(new URL("../components/inventory/HoseTestingSessionModal.tsx", import.meta.url), "utf8");
  const mobile = readFileSync(new URL("../components/mobile/MobileHoseQuickTest.tsx", import.meta.url), "utf8");
  for (const source of [desktop, mobile]) {
    assert.match(source, /useState\(\(\) => hoseTestingDate\(\)\)/);
    assert.match(source, /setTestingDate\(event\.target\.value\)/);
    assert.doesNotMatch(source, /toISOString\(\)\.(slice|split)/);
  }
  assert.match(desktop, /resumeValues\.testingDate \|\| hoseTestingDate\(\)/);
});

test("inventory column order and initial/refresh queries include existing last-test field", () => {
  const page = readFileSync(new URL("../app/inventory/fire-hose/page.tsx", import.meta.url), "utf8");
  const columns = [...page.matchAll(/\{ key: "(\w+)", label: "[^"]+" \}/g)].map((match) => match[1]);
  assert.deepEqual(columns, ["inventoryNumber", "hoseSize", "length", "inServiceDate", "lastTestDate", "nextTestDate", "status"]);
  const workspace = readFileSync(new URL("../components/inventory/InventoryCategoryWorkspace.tsx", import.meta.url), "utf8");
  for (const source of [page, workspace]) {
    assert.match(source, /in_service_date, last_test_date, next_test_date, status/);
    assert.match(source, /lastTestDate: formatHoseTestDate\(row.last_test_date\)/);
    assert.match(source, /row.status === "Testing Due" \|\| row.nextTestDate === "Overdue"/);
  }
  assert.match(workspace, /max-h-\[700px\] overflow-auto/);
  assert.match(workspace, /min-w-\[960px\]/);
});

test("only explicit finish saves history; deficiency navigation does not complete a test", () => {
  const workspace = readFileSync(new URL("../components/inventory/InventoryCategoryWorkspace.tsx", import.meta.url), "utf8");
  const deficiencyNavigation = workspace.slice(workspace.indexOf("const createDeficienciesForFailedHoses"), workspace.indexOf("const saveHose ="));
  assert.doesNotMatch(deficiencyNavigation, /saveTestingSession|completeHoseTest|\.insert\(|\.update\(/);
  assert.match(deficiencyNavigation, /sessionStorage.setItem/);
  assert.equal((workspace.match(/await completeHoseTest\(/g) ?? []).length, 1);
  const mobile = readFileSync(new URL("../components/mobile/MobileHoseQuickTest.tsx", import.meta.url), "utf8");
  assert.equal((mobile.match(/await completeHoseTest\(/g) ?? []).length, 1);
  assert.doesNotMatch(mobile, /addOneYearIso|from\("fire_hose"\)\.update/);
  assert.ok(mobile.indexOf("await completeHoseTest(") > mobile.indexOf("async function finishTest()"));
});

test("migration excludes legacy completion guesses and does not backfill existing dates", () => {
  const migration = readFileSync(new URL("../supabase/migrations/20261105193000_complete_fire_hose_tests_atomically.sql", import.meta.url), "utf8");
  assert.match(migration, /add column completed_at timestamptz;/);
  assert.doesNotMatch(migration, /completed_at timestamptz\s+default|with latest_pass as/);
  assert.match(migration, /s\.completed_at is not null/);
  assert.match(migration, /auth_user_department_memberships/);
  assert.match(migration, /member_has_inventory_permission\(p_department_id, 'fire_hose_inspection_testing'\)/);
  assert.match(migration, /when last_test_date is null or v_last_test_date >= last_test_date/);
  const afterFunction = migration.slice(migration.indexOf("$$;", migration.indexOf("create function")) + 3);
  assert.doesNotMatch(afterFunction, /\bupdate\s+public\.fire_hose/i);
  assert.doesNotMatch(migration, /\b(create|drop|alter)\s+policy\b/i);
});

test("completion fails closed for unverifiable saved results and nullable permission responses", () => {
  const migration = readFileSync(new URL("../supabase/migrations/20261105193000_complete_fire_hose_tests_atomically.sql", import.meta.url), "utf8");
  assert.match(migration, /member_has_inventory_permission\(p_department_id, 'fire_hose_inspection_testing'\) is not true/);
  assert.match(migration, /where s\.id = v_session_id and r\.department_id = p_department_id and r\.test_date = p_test_date/);
  assert.match(migration, /expected\.hose_id = r\.hose_id and expected\.result = r\.result/);
  assert.ok(migration.indexOf("Completed test results could not be verified") < migration.indexOf("if v_result.result = 'pass'"));
});
