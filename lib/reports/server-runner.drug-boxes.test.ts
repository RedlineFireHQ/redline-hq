import assert from "node:assert/strict";
import test from "node:test";

import { runReport } from "./server-runner";
import type { ReportRow, ReportRunRequest, ReportRunResponse } from "./types";

/**
 * Tests for the Drug Box inspection report (Inspections → report_type
 * "drug-boxes"). The report shows ONE row per completed inspection with an
 * overall result and a missing-item count; it never emits a row per checklist
 * item. Date filter, squad filter, department isolation, and multiple
 * same-day inspections are covered.
 */

type Row = Record<string, unknown>;
type TableData = Record<string, Row[]>;

const DEP_A = "dep-a";
const DEP_B = "dep-b";

function applyFilters(rows: Row[], filters: Array<{ key: string; op: "eq" | "in"; value: unknown }>) {
  return rows.filter((row) =>
    filters.every((f) => (f.op === "eq" ? row[f.key] === f.value : Array.isArray(f.value) && f.value.includes(row[f.key]))),
  );
}

function createSupabaseMock(tableData: TableData) {
  class QueryBuilder {
    private readonly rows: Row[];
    private readonly filters: Array<{ key: string; op: "eq" | "in"; value: unknown }> = [];
    private readonly orderBy: Array<{ key: string; ascending: boolean }> = [];
    constructor(tableName: string) {
      this.rows = tableData[tableName] ?? [];
    }
    select() {
      return this;
    }
    eq(key: string, value: unknown) {
      this.filters.push({ key, op: "eq", value });
      return this;
    }
    in(key: string, values: unknown[]) {
      this.filters.push({ key, op: "in", value: values });
      return this;
    }
    order(key: string, options?: { ascending?: boolean }) {
      this.orderBy.push({ key, ascending: options?.ascending !== false });
      return this;
    }
    then(resolve: (value: { data: Row[]; error: null }) => unknown, reject?: (reason: unknown) => unknown) {
      try {
        let data = applyFilters(this.rows, this.filters);
        for (const order of this.orderBy) {
          data = [...data].sort((l, r) => {
            const lv = String(l[order.key] ?? "");
            const rv = String(r[order.key] ?? "");
            return order.ascending ? lv.localeCompare(rv) : rv.localeCompare(lv);
          });
        }
        return Promise.resolve(resolve({ data, error: null }));
      } catch (error) {
        if (reject) return Promise.resolve(reject(error));
        throw error;
      }
    }
  }
  return { from: (t: string) => new QueryBuilder(t) };
}

function makeRequest(filters: Record<string, string>, dateRange?: { from: string; to: string }): ReportRunRequest {
  return {
    category: "inspections",
    searchTerm: "",
    dateRange: { preset: "custom", from: dateRange?.from ?? "2026-01-01", to: dateRange?.to ?? "2026-12-31" },
    filters: { report_type: "drug-boxes", ...filters },
    page: 1,
    pageSize: 200,
  };
}

function buildContext(tableData: TableData, departmentId: string) {
  return { supabase: createSupabaseMock(tableData), departmentId, departmentName: "Department A", memberRole: "administrator" } as never;
}

function okRows(response: ReportRunResponse): ReportRow[] {
  assert.ok(response.ok, "expected a successful report response");
  if (!response.ok) return [];
  return response.rows;
}

function snapshot(inspectionId: string, dept: string, total: number, missing: number): Row[] {
  const rows: Row[] = [];
  for (let i = 0; i < total; i++) {
    rows.push({ inspection_id: inspectionId, department_id: dept, is_checked: i >= missing, item_order: i });
  }
  return rows;
}

function seed(): TableData {
  return {
    members: [
      { id: "m1", department_id: DEP_A, first_name: "Jordan", last_name: "Smith" },
      { id: "m2", department_id: DEP_B, first_name: "Riley", last_name: "Other" },
    ],
    drug_box_inspections: [
      // Squad 114 all present; Squad 114 again same day with 2 missing; Squad 115 with 1 missing; DEP_B inspection.
      { id: "i1", department_id: DEP_A, squad_number: "114", member_id: "m1", unit_number: "114", box_lock_number: "B1", cs_lock_number: "C1", ez_io_number: "E1", created_at: "2026-03-10T09:00:00.000Z" },
      { id: "i2", department_id: DEP_A, squad_number: "114", member_id: "m1", unit_number: "114", box_lock_number: "B2", cs_lock_number: "C2", ez_io_number: "E2", created_at: "2026-03-10T15:00:00.000Z" },
      { id: "i3", department_id: DEP_A, squad_number: "115", member_id: "m1", unit_number: "115", box_lock_number: "B3", cs_lock_number: "C3", ez_io_number: "E3", created_at: "2026-06-01T10:00:00.000Z" },
      { id: "i4", department_id: DEP_B, squad_number: "114", member_id: "m2", unit_number: "114", box_lock_number: "BX", cs_lock_number: "CX", ez_io_number: "EX", created_at: "2026-03-11T10:00:00.000Z" },
    ],
    drug_box_checklist_results: [
      ...snapshot("i1", DEP_A, 63, 0), // all present
      ...snapshot("i2", DEP_A, 63, 2), // 2 missing
      ...snapshot("i3", DEP_A, 63, 1), // 1 missing
      ...snapshot("i4", DEP_B, 63, 5), // other department
    ],
  };
}

test("DRUGRPT1. one row per completed inspection (not per checklist item)", async () => {
  const response = await runReport(makeRequest({ squad_number: "all" }), buildContext(seed(), DEP_A));
  const rows = okRows(response);
  // DEP_A has 3 inspections → exactly 3 rows, despite 63 items each.
  assert.equal(rows.length, 3);
  if (response.ok) {
    const completed = response.summary?.find((s) => s.label === "Completed Inspections");
    assert.equal(completed?.value, "3");
  }
});

test("DRUGRPT2. an all-PASS inspection shows 'Ready for Service' with 0 expired in a single row", async () => {
  const response = await runReport(makeRequest({ squad_number: "all" }), buildContext(seed(), DEP_A));
  const allPresent = okRows(response).find((r) => r.box_lock_number === "B1");
  assert.ok(allPresent, "expected the all-present Squad 114 inspection row");
  assert.equal(allPresent?.overall_result, "Ready for Service");
  assert.equal(allPresent?.items_missing, "0");
  assert.equal(allPresent?.squad_number, "114");
  assert.equal(allPresent?.inspector, "Jordan Smith");
});

test("DRUGRPT3. an inspection with EXPIRED items shows 'Items Expired' + the count", async () => {
  const response = await runReport(makeRequest({ squad_number: "all" }), buildContext(seed(), DEP_A));
  const missing = okRows(response).find((r) => r.box_lock_number === "B2");
  assert.ok(missing, "expected the 2-expired Squad 114 inspection row");
  assert.equal(missing?.overall_result, "Items Expired");
  assert.equal(missing?.items_missing, "2");
});

test("DRUGRPT4. multiple inspections for the same squad on the same day appear independently", async () => {
  const response = await runReport(makeRequest({ squad_number: "114" }), buildContext(seed(), DEP_A));
  const rows = okRows(response);
  assert.equal(rows.length, 2, "Squad 114 should have two same-day inspections");
  const locks = rows.map((r) => r.box_lock_number).sort();
  assert.deepEqual(locks, ["B1", "B2"]);
});

test("DRUGRPT5. department isolation — another department's inspections never appear", async () => {
  const response = await runReport(makeRequest({ squad_number: "all" }), buildContext(seed(), DEP_A));
  const rows = okRows(response);
  assert.ok(rows.every((r) => r.box_lock_number !== "BX"), "other department rows must not appear");
  assert.ok(rows.every((r) => r.inspector !== "Riley Other"));
});

test("DRUGRPT6. date filter limits which inspections appear", async () => {
  // Only the June inspection (i3, squad 115) falls in June.
  const juneOnly = await runReport(makeRequest({ squad_number: "all" }, { from: "2026-06-01", to: "2026-06-30" }), buildContext(seed(), DEP_A));
  const rows = okRows(juneOnly);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.squad_number, "115");
});
