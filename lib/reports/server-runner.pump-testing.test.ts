import assert from "node:assert/strict";
import test from "node:test";

import { REPORT_SOURCES } from "./registry";
import { runReport } from "./server-runner";
import type { ReportRunRequest, ReportRunResponse } from "./types";

type Row = Record<string, unknown>;
type TableData = Record<string, Row[]>;

const DEP_A = "dep-a";
const DEP_B = "dep-b";

function createSupabaseMock(tableData: TableData, failingTables: string[] = []) {
  class QueryBuilder {
    private readonly rows: Row[];
    private readonly filters: Array<(row: Row) => boolean> = [];

    constructor(private readonly tableName: string) {
      this.rows = tableData[tableName] ?? [];
    }

    select() {
      return this;
    }
    eq(key: string, value: unknown) {
      this.filters.push((row) => row[key] === value);
      return this;
    }
    in(key: string, values: unknown[]) {
      this.filters.push((row) => values.includes(row[key]));
      return this;
    }
    order() {
      return this;
    }
    then(resolve: (value: { data: Row[] | null; error: { message: string } | null }) => unknown) {
      if (failingTables.includes(this.tableName)) {
        return Promise.resolve(resolve({ data: null, error: { message: "relation does not exist" } }));
      }
      return Promise.resolve(resolve({ data: this.rows.filter((row) => this.filters.every((filter) => filter(row))), error: null }));
    }
  }

  return { from: (tableName: string) => new QueryBuilder(tableName) };
}

function pumpRequest(filters: Record<string, string> = {}): ReportRunRequest {
  return {
    category: "apparatus",
    searchTerm: "",
    dateRange: { preset: "custom", from: "2026-01-01", to: "2026-12-31" },
    filters: { report_type: "pump-testing", ...filters },
    page: 1,
    pageSize: 200,
  };
}

function context(tableData: TableData, departmentId = DEP_A, failingTables: string[] = []) {
  return { supabase: createSupabaseMock(tableData, failingTables), departmentId, departmentName: "Department A", memberRole: "administrator" } as never;
}

function seed(): TableData {
  return {
    apparatus: [
      { id: "app-1", department_id: DEP_A, name: "Engine 1" },
      { id: "app-2", department_id: DEP_A, name: "Engine 2" },
      { id: "app-x", department_id: DEP_B, name: "Other Engine" },
    ],
    members: [{ id: "m-1", department_id: DEP_A, first_name: "Jordan", last_name: "Smith" }],
    apparatus_pump_tests: [
      { id: "t-1", department_id: DEP_A, apparatus_id: "app-1", test_date: "2026-10-20", tester_type: "department_member", tester_member_id: "m-1", result: "Pass", notes: "ok", created_at: "2026-10-20T10:00:00Z" },
      { id: "t-2", department_id: DEP_A, apparatus_id: "app-1", test_date: "2026-09-10", tester_type: "department_member", tester_member_id: "m-1", result: "Fail", notes: null, created_at: "2026-09-10T10:00:00Z" },
      { id: "t-3", department_id: DEP_A, apparatus_id: "app-2", test_date: "2026-08-01", tester_type: "department_member", tester_member_id: "m-1", result: "Pass", notes: null, created_at: "2026-08-01T10:00:00Z" },
      { id: "t-x", department_id: DEP_B, apparatus_id: "app-x", test_date: "2026-10-01", tester_type: "department_member", tester_member_id: "m-1", result: "Pass", notes: null, created_at: "2026-10-01T10:00:00Z" },
    ],
    apparatus_pump_test_attachments: [
      { id: "a-1", department_id: DEP_A, pump_test_id: "t-1" },
      { id: "a-2", department_id: DEP_A, pump_test_id: "t-1" },
      { id: "a-3", department_id: DEP_A, pump_test_id: "t-3" },
      { id: "a-x", department_id: DEP_B, pump_test_id: "t-x" },
      // Wrong department on the row: must never be counted for DEP_A even if it points at DEP_A's test.
      { id: "a-bad", department_id: DEP_B, pump_test_id: "t-2" },
    ],
  };
}

function rowsOf(response: ReportRunResponse) {
  assert.ok(response.ok, "expected a successful report response");
  return response.ok ? response.rows : [];
}

test("the pump-testing report lists an Attachments column", async () => {
  const response = await runReport(pumpRequest(), context(seed()));
  assert.ok(response.ok);
  if (!response.ok) return;
  assert.ok(response.columns.some((column) => column.key === "pump_test_attachments" && column.label === "Attachments"));
  assert.ok(REPORT_SOURCES.find((source) => source.key === "apparatus")?.columns.some((column) => column.key === "pump_test_attachments"));
});

test("records with attachments show a count and a link target; others show None", async () => {
  const rows = rowsOf(await runReport(pumpRequest(), context(seed())));
  const byDetail = (id: string) => rows.find((row) => row.pump_test_detail_href === `/apparatus/pump-test-history/${id}`);

  assert.equal(rows.length, 3);
  assert.equal(byDetail("t-1")?.pump_test_attachments, "2 files");
  assert.equal(byDetail("t-3")?.pump_test_attachments, "1 file");
  assert.equal(byDetail("t-2")?.pump_test_attachments, "None");
});

test("another department's tests and attachments never appear or get counted", async () => {
  const rows = rowsOf(await runReport(pumpRequest(), context(seed())));

  assert.ok(rows.every((row) => !String(row.pump_test_detail_href).includes("t-x")));
  assert.equal(rows.find((row) => row.pump_test_detail_href === "/apparatus/pump-test-history/t-2")?.pump_test_attachments, "None");
});

test("existing filters still apply (apparatus filter and date range)", async () => {
  const oneApparatus = rowsOf(await runReport(pumpRequest({ apparatus_id: "app-2" }), context(seed())));
  assert.equal(oneApparatus.length, 1);
  assert.equal(oneApparatus[0].pump_test_attachments, "1 file");

  const request = pumpRequest();
  request.dateRange = { preset: "custom", from: "2026-10-01", to: "2026-10-31" };
  const october = rowsOf(await runReport(request, context(seed())));
  assert.equal(october.length, 1);
});

test("the report still runs, with a dash, when the attachments table is unavailable", async () => {
  const response = await runReport(pumpRequest(), context(seed(), DEP_A, ["apparatus_pump_test_attachments"]));
  const rows = rowsOf(response);

  assert.equal(rows.length, 3);
  assert.ok(rows.every((row) => row.pump_test_attachments === "-"));
  assert.equal(rows[0].pump_test_result !== undefined, true);
});

test("existing pump-test report fields are unchanged", async () => {
  const rows = rowsOf(await runReport(pumpRequest(), context(seed())));
  const latest = rows.find((row) => row.pump_test_detail_href === "/apparatus/pump-test-history/t-1");

  assert.equal(latest?.apparatus_name, "Engine 1");
  assert.equal(latest?.pump_tested_by, "Jordan Smith");
  assert.equal(latest?.pump_test_result, "Pass");
  assert.equal(latest?.pump_test_notes, "ok");
});
