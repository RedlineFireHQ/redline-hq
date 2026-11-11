import assert from "node:assert/strict";
import test from "node:test";

import { runReport } from "./server-runner";
import type { ReportRunRequest, ReportRunResponse } from "./types";

type Row = Record<string, unknown>;
type TableData = Record<string, Row[]>;

const DEP_A = "dep-a";
const DEP_B = "dep-b";

function createSupabaseMock(tableData: TableData) {
  class QueryBuilder {
    private readonly rows: Row[];
    private readonly filters: Array<(row: Row) => boolean> = [];

    constructor(tableName: string) {
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
      return Promise.resolve(resolve({ data: this.rows.filter((row) => this.filters.every((filter) => filter(row))), error: null }));
    }
  }

  return { from: (tableName: string) => new QueryBuilder(tableName) };
}

function maintenanceRequest(filters: Record<string, string> = {}, searchTerm = ""): ReportRunRequest {
  return {
    category: "maintenance",
    searchTerm,
    dateRange: { preset: "custom", from: "2026-01-01", to: "2026-12-31" },
    filters,
    page: 1,
    pageSize: 200,
  };
}

function context(tableData: TableData) {
  return { supabase: createSupabaseMock(tableData), departmentId: DEP_A, departmentName: "Department A", memberRole: "administrator" } as never;
}

function seed(): TableData {
  const base = {
    deficiency_id: null,
    description: "work",
    parts_used: null,
    labor_hours: null,
    mileage: null,
    engine_hours: null,
    cost: null,
    notes: null,
    photos: [],
    attachments: [],
    created_at: "2026-06-01T10:00:00Z",
    updated_at: "2026-06-01T10:00:00Z",
  };

  return {
    apparatus: [
      { id: "app-1", department_id: DEP_A, name: "Engine 1" },
      { id: "app-x", department_id: DEP_B, name: "Other Engine" },
    ],
    members: [
      { id: "m-1", department_id: DEP_A, first_name: "Jordan", last_name: "Smith" },
      { id: "m-2", department_id: DEP_A, first_name: "Riley", last_name: "Jones" },
    ],
    deficiencies: [],
    maintenance_records: [
      { ...base, id: "r-member-1", department_id: DEP_A, apparatus_id: "app-1", maintenance_number: "MT-1", maintenance_type: "Repair", completed_by: "m-1", external_provider_name: null, service_date: "2026-06-01T10:00:00Z" },
      { ...base, id: "r-member-2", department_id: DEP_A, apparatus_id: "app-1", maintenance_number: "MT-2", maintenance_type: "Repair", completed_by: "m-2", external_provider_name: null, service_date: "2026-06-02T10:00:00Z" },
      { ...base, id: "r-external-1", department_id: DEP_A, apparatus_id: "app-1", maintenance_number: "MT-3", maintenance_type: "Oil Change", completed_by: null, external_provider_name: "Jiffy Lube", service_date: "2026-06-03T10:00:00Z" },
      { ...base, id: "r-external-2", department_id: DEP_A, apparatus_id: "app-1", maintenance_number: "MT-4", maintenance_type: "Repair", completed_by: null, external_provider_name: "Local Mechanic", service_date: "2026-06-04T10:00:00Z" },
      // Legacy record with no performer recorded at all.
      { ...base, id: "r-none", department_id: DEP_A, apparatus_id: "app-1", maintenance_number: "MT-5", maintenance_type: "Repair", completed_by: null, external_provider_name: null, service_date: "2026-06-05T10:00:00Z" },
      // Another department: must never appear.
      { ...base, id: "r-other-dept", department_id: DEP_B, apparatus_id: "app-x", maintenance_number: "MT-X", maintenance_type: "Repair", completed_by: null, external_provider_name: "Jiffy Lube", service_date: "2026-06-06T10:00:00Z" },
    ],
  };
}

function okPayload(response: ReportRunResponse) {
  assert.equal(response.ok, true, JSON.stringify(response));
  return response as Extract<ReportRunResponse, { ok: true }>;
}

test("MXRPT1. the report shows member names and external provider names side by side", async () => {
  const payload = okPayload(await runReport(maintenanceRequest(), context(seed())));

  const byNumber = new Map(payload.rows.map((row) => [row.maintenance_number, row.performed_by]));
  assert.equal(byNumber.get("MT-1"), "Jordan Smith");
  assert.equal(byNumber.get("MT-2"), "Riley Jones");
  assert.equal(byNumber.get("MT-3"), "Jiffy Lube");
  assert.equal(byNumber.get("MT-4"), "Local Mechanic");
  assert.equal(byNumber.get("MT-5"), "-");
  assert.equal(payload.rows.some((row) => row.maintenance_number === "MT-X"), false, "Other department's records must not appear");
});

test("MXRPT2. filtering by a department member still returns only that member's records", async () => {
  const payload = okPayload(await runReport(maintenanceRequest({ completed_by: "m-1" }), context(seed())));

  assert.equal(payload.rows.length, 1);
  assert.equal(payload.rows[0].maintenance_number, "MT-1");
  assert.equal(payload.rows[0].performed_by, "Jordan Smith");
});

test("MXRPT3. the External Provider filter returns only externally performed records", async () => {
  const payload = okPayload(await runReport(maintenanceRequest({ completed_by: "external_provider" }), context(seed())));

  assert.deepEqual(
    payload.rows.map((row) => row.maintenance_number).sort(),
    ["MT-3", "MT-4"],
  );
  assert.deepEqual(
    payload.rows.map((row) => row.performed_by).sort(),
    ["Jiffy Lube", "Local Mechanic"],
  );
});

test("MXRPT4. External Provider filter excludes legacy records with no performer", async () => {
  const payload = okPayload(await runReport(maintenanceRequest({ completed_by: "external_provider" }), context(seed())));

  assert.equal(payload.rows.some((row) => row.maintenance_number === "MT-5"), false);
});

test("MXRPT5. text search matches external provider names", async () => {
  const payload = okPayload(await runReport(maintenanceRequest({}, "jiffy"), context(seed())));

  assert.equal(payload.rows.length, 1);
  assert.equal(payload.rows[0].maintenance_number, "MT-3");
});

test("MXRPT6. the All Members default still returns every record", async () => {
  const payload = okPayload(await runReport(maintenanceRequest({ completed_by: "all" }), context(seed())));

  assert.equal(payload.rows.length, 5);
});
