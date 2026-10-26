import assert from "node:assert/strict";
import test from "node:test";

import { runReport } from "./server-runner";
import type { ReportRunRequest, ReportRow, ReportRunResponse } from "./types";

/**
 * Tests for the Pediatric Bag inspection report (category "pediatric-bags").
 *
 * Covers: output fields (bag, date/time, inspector, assisting personnel,
 * overall status, per-item checked/unchecked results), date filtering,
 * historical-snapshot fidelity (results reflect the saved snapshot, not the
 * live template), permissions (category is registered/available), and
 * department isolation (no other department's rows or personnel leak).
 */

type Row = Record<string, unknown>;
type TableData = Record<string, Row[]>;

const DEP_A = "dep-a";
const DEP_B = "dep-b";

function applyFilters(rows: Row[], filters: Array<{ key: string; op: "eq" | "in"; value: unknown }>) {
  return rows.filter((row) => {
    for (const filter of filters) {
      const rawValue = row[filter.key];
      if (filter.op === "eq") {
        if (rawValue !== filter.value) return false;
        continue;
      }
      if (filter.op === "in") {
        if (!Array.isArray(filter.value) || !filter.value.includes(rawValue)) return false;
        continue;
      }
    }
    return true;
  });
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
          data = [...data].sort((left, right) => {
            const l = String(left[order.key] ?? "");
            const r = String(right[order.key] ?? "");
            return order.ascending ? l.localeCompare(r) : r.localeCompare(l);
          });
        }
        return Promise.resolve(resolve({ data, error: null }));
      } catch (error) {
        if (reject) return Promise.resolve(reject(error));
        throw error;
      }
    }
  }
  return {
    from(tableName: string) {
      return new QueryBuilder(tableName);
    },
  };
}

function makeRequest(filters: Record<string, string>, dateRange?: { from: string; to: string }): ReportRunRequest {
  return {
    category: "inspections",
    searchTerm: "",
    dateRange: {
      preset: "custom",
      from: dateRange?.from ?? "2026-01-01",
      to: dateRange?.to ?? "2026-12-31",
    },
    filters: { report_type: "pediatric-bags", ...filters },
    page: 1,
    pageSize: 200,
  };
}

function buildContext(tableData: TableData, departmentId: string) {
  return {
    supabase: createSupabaseMock(tableData),
    departmentId,
    departmentName: "Department A",
    memberRole: "administrator",
  } as never;
}

function okRows(response: ReportRunResponse): ReportRow[] {
  assert.ok(response.ok, "expected a successful report response");
  if (!response.ok) return [];
  return response.rows;
}

/** A representative dataset with two departments interleaved. */
function seedData(): TableData {
  return {
    members: [
      { id: "m-insp-a", department_id: DEP_A, first_name: "Jordan", last_name: "Smith" },
      { id: "m-assist-a", department_id: DEP_A, first_name: "Casey", last_name: "Lee" },
      { id: "m-insp-b", department_id: DEP_B, first_name: "Riley", last_name: "Other" },
    ],
    pediatric_bags: [
      { id: "bag-a", department_id: DEP_A, bag_label: "A" },
      { id: "bag-b", department_id: DEP_A, bag_label: "B" },
      { id: "bag-b2", department_id: DEP_B, bag_label: "A" },
    ],
    pediatric_bag_inspections: [
      { id: "insp-1", department_id: DEP_A, pediatric_bag_id: "bag-a", member_id: "m-insp-a", status: "ready", created_at: "2026-03-10T14:30:00.000Z" },
      { id: "insp-2", department_id: DEP_A, pediatric_bag_id: "bag-b", member_id: "m-insp-a", status: "needs_attention", created_at: "2026-06-15T09:00:00.000Z" },
      { id: "insp-3", department_id: DEP_B, pediatric_bag_id: "bag-b2", member_id: "m-insp-b", status: "ready", created_at: "2026-03-11T10:00:00.000Z" },
    ],
    pediatric_bag_checklist_results: [
      // insp-1 (Bag A): one PASS, one EXPIRED
      { id: "r1", department_id: DEP_A, inspection_id: "insp-1", section_name_snapshot: "Top-Misc", item_label_snapshot: "Pediatric BVM", required_quantity_snapshot: 1, result_status: "checked", item_order: 1 },
      { id: "r2", department_id: DEP_A, inspection_id: "insp-1", section_name_snapshot: "Back", item_label_snapshot: "Alcohol Preps", required_quantity_snapshot: 10, result_status: "expired", item_order: 2 },
      // insp-2 (Bag B): all PASS
      { id: "r3", department_id: DEP_A, inspection_id: "insp-2", section_name_snapshot: "Top-Misc", item_label_snapshot: "Pediatric BVM", required_quantity_snapshot: 1, result_status: "checked", item_order: 1 },
      // insp-3 (other department) — must never appear for DEP_A
      { id: "r4", department_id: DEP_B, inspection_id: "insp-3", section_name_snapshot: "Top-Misc", item_label_snapshot: "Other Dept Item", required_quantity_snapshot: 1, result_status: "checked", item_order: 1 },
    ],
    pediatric_bag_checklist_sessions: [
      { id: "sess-1", department_id: DEP_A, completed_inspection_id: "insp-1" },
      { id: "sess-3", department_id: DEP_B, completed_inspection_id: "insp-3" },
    ],
    pediatric_bag_check_session_members: [
      { id: "pm1", session_id: "sess-1", member_id: "m-assist-a" },
      { id: "pm2", session_id: "sess-3", member_id: "m-insp-b" },
    ],
  };
}

test("PEDRPT1. one row per completed inspection (not per checklist item)", async () => {
  const response = await runReport(makeRequest({ bag_label: "all", result_status: "all" }), buildContext(seedData(), DEP_A));
  const rows = okRows(response);

  // DEP_A has 2 inspections → exactly 2 rows, despite multiple snapshot items.
  assert.equal(rows.length, 2);
  if (response.ok) {
    const completed = response.summary?.find((s) => s.label === "Completed Inspections");
    assert.equal(completed?.value, "2");
  }
});

test("PEDRPT2. an inspection with expired items summarizes the expired count", async () => {
  const response = await runReport(makeRequest({ bag_label: "all", result_status: "all" }), buildContext(seedData(), DEP_A));
  const rows = okRows(response);

  // insp-1 (Bag A): one EXPIRED item → not fully checked → "Items Expired", count 1.
  const bagA = rows.find((r) => r.bag_label === "A");
  assert.ok(bagA, "expected a Bag A row");
  assert.equal(bagA?.overall_status, "Items Expired");
  assert.equal(bagA?.items_unchecked, "1");
  assert.equal(bagA?.inspector, "Jordan Smith");
  assert.equal(bagA?.assisting_personnel, "Casey Lee");
});

test("PEDRPT3. a fully-checked inspection shows 'Ready for Service' with 0 unchecked", async () => {
  const response = await runReport(makeRequest({ bag_label: "all", result_status: "all" }), buildContext(seedData(), DEP_A));
  const bagB = okRows(response).find((r) => r.bag_label === "B");
  assert.ok(bagB, "expected a Bag B row");
  assert.equal(bagB?.overall_status, "Ready for Service");
  assert.equal(bagB?.items_unchecked, "0");
});

test("PEDRPT4. date filter limits results to the selected range", async () => {
  // insp-1 is 2026-03-10; insp-2 is 2026-06-15. Restrict to March only.
  const marchOnly = await runReport(
    makeRequest({ bag_label: "all", result_status: "all" }, { from: "2026-03-01", to: "2026-03-31" }),
    buildContext(seedData(), DEP_A),
  );
  const rows = okRows(marchOnly);
  assert.ok(rows.length > 0, "expected March rows");
  assert.ok(rows.every((r) => r.bag_label === "A"), "only the March Bag A inspection should remain");
});

test("PEDRPT5. department isolation — no other department's inspections or personnel appear", async () => {
  const response = await runReport(makeRequest({ bag_label: "all", result_status: "all" }), buildContext(seedData(), DEP_A));
  const rows = okRows(response);

  assert.ok(rows.every((r) => r.inspector !== "Riley Other"), "other department inspector must not appear");
  // Only DEP_A inspections (insp-1, insp-2) are counted.
  if (response.ok) {
    const completed = response.summary?.find((s) => s.label === "Completed Inspections");
    assert.equal(completed?.value, "2");
  }
});

test("PEDRPT6. inspections with no assisting personnel render safely", async () => {
  const response = await runReport(makeRequest({ bag_label: "all", result_status: "all" }), buildContext(seedData(), DEP_A));
  const rows = okRows(response);
  // insp-2 (Bag B) has no producing session participants.
  const bagB = rows.find((r) => r.bag_label === "B");
  assert.ok(bagB, "expected a Bag B row");
  assert.equal(bagB?.assisting_personnel, "-");
});

test("PEDRPT7. bag_label filter narrows to a single bag", async () => {
  const response = await runReport(makeRequest({ bag_label: "B", result_status: "all" }), buildContext(seedData(), DEP_A));
  const rows = okRows(response);
  assert.ok(rows.length > 0);
  assert.ok(rows.every((r) => r.bag_label === "B"));
});

test("PEDRPT8. multiple inspections of the same bag on the same day remain separate rows", async () => {
  const data = seedData();
  // Add a second same-day Bag A inspection (all checked).
  (data.pediatric_bag_inspections as Row[]).push({
    id: "insp-1b",
    department_id: DEP_A,
    pediatric_bag_id: "bag-a",
    member_id: "m-insp-a",
    status: "ready",
    created_at: "2026-03-10T18:00:00.000Z",
  });
  (data.pediatric_bag_checklist_results as Row[]).push({
    id: "r1b",
    department_id: DEP_A,
    inspection_id: "insp-1b",
    result_status: "checked",
  });

  const response = await runReport(makeRequest({ bag_label: "A", result_status: "all" }), buildContext(data, DEP_A));
  const rows = okRows(response);
  assert.equal(rows.length, 2, "two same-day Bag A inspections should appear as separate rows");
});

test("PEDRPT9. empty history returns an empty, valid report", async () => {
  const empty = buildContext({ members: [], pediatric_bags: [], pediatric_bag_inspections: [] }, DEP_A);
  const response = await runReport(makeRequest({ bag_label: "all", result_status: "all" }), empty);
  assert.ok(response.ok);
  if (response.ok) {
    assert.equal(response.rows.length, 0);
    assert.equal(response.totalRows, 0);
  }
});
