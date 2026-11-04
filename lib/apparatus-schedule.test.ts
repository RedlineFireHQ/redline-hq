import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import { applyApparatusConfiguration, validateApparatusSchedule } from "./apparatus-configuration-simple";

function mockClient(bayAvailable: boolean) {
  const requests: { url: URL; method: string }[] = [];
  const client = createClient("https://synthetic.invalid", "synthetic-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input, init) => {
      const url = new URL(String(input));
      const method = init?.method ?? "GET";
      requests.push({ url, method });
      if (url.pathname.endsWith("/department_bay_schedules")) return Response.json(bayAvailable ? [{ id: "bay-fixture" }] : []);
      return Response.json([]);
    } },
  });
  return { client, requests };
}
test("invalid/cross-department bay is rejected before any configuration writes", async () => {
  const { client, requests } = mockClient(false);
  const result = await applyApparatusConfiguration(client, "department-fixture", "apparatus-fixture", {
    checkFrequency: "Weekly", customCheckFrequency: "", maintenanceRequirements: [], checklistRequiredOverride: null, bayScheduleId: "other-bay",
  });
  assert.equal(result.ok, false);
  assert.equal(requests.every((r) => r.method === "GET"), true);
  assert.equal(requests[0].url.searchParams.get("department_id"), "eq.department-fixture");
  assert.equal(requests[0].url.searchParams.get("is_active"), "eq.true");
});
test("valid bay-only schedule does not create a fictional interval requirement", async () => {
  const { client, requests } = mockClient(true);
  const result = await applyApparatusConfiguration(client, "department-fixture", "apparatus-fixture", {
    checkFrequency: "", customCheckFrequency: "", maintenanceRequirements: [], checklistRequiredOverride: null, bayScheduleId: "bay-fixture",
  });
  assert.equal(result.ok, true);
  assert.equal(requests.some((r) => r.url.pathname.endsWith("/apparatus_check_requirements")), false);
  assert.equal(requests.at(-1)?.url.searchParams.get("department_id"), "eq.department-fixture");
});
test("ordinary interval validation remains mandatory when no bay is selected", async () => {
  const { client, requests } = mockClient(true);
  assert.equal((await validateApparatusSchedule(client, "department-fixture", { checkFrequency: "", bayScheduleId: null })).ok, false);
  assert.equal((await validateApparatusSchedule(client, "department-fixture", { checkFrequency: "Invalid", bayScheduleId: "bay-fixture" })).ok, false);
  assert.equal(requests.length, 0);
});
