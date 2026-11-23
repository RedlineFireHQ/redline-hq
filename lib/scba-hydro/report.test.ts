import test from "node:test";
import assert from "node:assert/strict";
import { runInventoryReport } from "@/lib/reports/inventory-report";
import { getReportSourceConfig } from "@/lib/reports/registry";
import type { ReportRunRequest } from "@/lib/reports/types";

test("hydrostatic report shows every result and excludes other departments", async () => {
  const rows = [
    { id: "one", department_id: "a", result: "Pass", scba_hydro_sessions: { test_date: "2024-02-29", tester_name: "Alex", company_name: "Testing Co" }, scba_cylinders: { cylinder_number: "C1", serial_number: "S1" } },
    { id: "two", department_id: "a", result: "Fail", scba_hydro_sessions: { test_date: "2025-01-10", tester_name: "Sam", company_name: "Testing Co" }, scba_cylinders: { cylinder_number: "C1", serial_number: "S1" } },
    { id: "other", department_id: "b", result: "Pass", scba_hydro_sessions: { test_date: "2025-01-10", tester_name: "Other", company_name: "Other" }, scba_cylinders: { cylinder_number: "C2" } },
  ];
  const mock = {
    from(table: string) {
      assert.equal(table, "scba_hydro_results");
      let department = "";
      return {
        select() { return this; },
        eq(_key: string, value: string) { department = value; return this; },
        order() { return Promise.resolve({ data: rows.filter((row) => row.department_id === department), error: null }); },
      };
    },
  };
  const request: ReportRunRequest = { category: "inventory", searchTerm: "", dateRange: { preset: "custom", from: "2024-01-01", to: "2025-12-31" },
    filters: { inventory_category: "scba-cylinders", inventory_report_type: "scba-cylinder-hydrostatic-testing" }, page: 1, pageSize: 50 };
  const source = getReportSourceConfig("inventory");
  assert.ok(source);
  const response = await runInventoryReport(request, { supabase: mock as never, departmentId: "a", departmentName: "A" }, source, "2024-01-01T00:00:00Z", "2026-01-01T00:00:00Z");
  assert.ok(response.ok);
  if (!response.ok) return;
  assert.equal(response.rows.length, 2);
  assert.deepEqual(response.rows.map((row) => row.result), ["Pass", "Fail"]);
  assert.equal(response.rows[0].tester, "Alex");
  assert.equal(response.rows[0].company, "Testing Co");
  assert.match(String(response.rows[0].next_due), /2029/);
});
