import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

import { getApparatusReadinessList } from "./apparatus-readiness-data";

/**
 * Multi-department isolation tests for getApparatusReadinessList.
 *
 * The mock below simulates Postgres filter semantics over in-memory rows that
 * span two departments (Elliott + Red Oak), so a missing or wrong department
 * filter would visibly leak the other department's apparatus into the result.
 */

const ELLIOTT = "dep-elliott";
const RED_OAK = "dep-red-oak";

type Row = Record<string, unknown>;

type MockConfig = {
  apparatusRows: Row[];
  apparatusError?: { message: string } | null;
};

function apparatusRow(id: string, departmentId: string, name: string, lifecycleStatus = "active"): Row {
  return {
    id,
    department_id: departmentId,
    name,
    type: "Engine",
    include_in_department_readiness: true,
    lifecycle_status: lifecycleStatus,
    status: "in_service",
    last_inspection_at: null,
    mileage: null,
    engine_hours: null,
  };
}

function createSupabaseMock(config: MockConfig) {
  const queriedTables: string[] = [];
  const recordedFilters: Array<{ column: string; value: unknown }> = [];

  return {
    client: createClient("https://synthetic.invalid", "synthetic-key", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: async (input) => {
        const url = new URL(String(input));
        const table = url.pathname.split("/").at(-1);
        queriedTables.push(table ?? "");
        if (table === "apparatus" && config.apparatusError) {
          return Response.json(config.apparatusError, { status: 400 });
        }
        let data = table === "apparatus" ? [...config.apparatusRows] : [];
        for (const [column, expression] of url.searchParams) {
          if (!expression.startsWith("eq.")) continue;
          const raw = expression.slice(3);
          const value = raw === "true" ? true : raw === "false" ? false : raw;
          recordedFilters.push({ column, value });
          data = data.filter((row) => row[column] === value);
        }
        const order = url.searchParams.get("order")?.split(".")[0];
        if (order) data.sort((a, b) => String(a[order] ?? "").localeCompare(String(b[order] ?? "")));
        const limit = url.searchParams.get("limit");
        if (limit) data = data.slice(0, Number(limit));
        return Response.json(data);
      } },
    }),
    getQueriedTables: () => queriedTables,
    getRecordedFilters: () => recordedFilters,
  };
}

test("Red Oak readiness excludes Unit 141 but retains its administrative assignment", async () => {
  const departmentId = "82f50d14-216a-4dd1-80f4-58459dc97b97";
  const mock = createSupabaseMock({ apparatusRows: [
    apparatusRow("44d16b08-9adb-402a-bfe5-80ee5f4143c5", departmentId, "141"),
    { ...apparatusRow("daily-fixture", departmentId, "Daily Apparatus Checks"), include_in_department_readiness: false, type: "Administrative" },
    apparatusRow("other-fixture", ELLIOTT, "141"),
  ] });
  const result = await getApparatusReadinessList(departmentId, mock.client);
  assert.deepEqual(result.map((row) => row.apparatus.id), ["daily-fixture"]);
});

function twoDepartmentRows(): Row[] {
  return [
    apparatusRow("app-e2", ELLIOTT, "Engine 2"),
    apparatusRow("app-r1", RED_OAK, "Red Oak Engine 1"),
    apparatusRow("app-e1", ELLIOTT, "Engine 1"),
  ];
}

test("ARISO1. missing department id returns an empty list without querying the database", async () => {
  const mock = createSupabaseMock({ apparatusRows: twoDepartmentRows() });

  for (const missingDepartmentId of [undefined, null, ""]) {
    const result = await getApparatusReadinessList(missingDepartmentId, mock.client);
    assert.deepEqual(result, []);
  }

  assert.deepEqual(mock.getQueriedTables(), []);
  assert.deepEqual(mock.getRecordedFilters(), []);
});

test("ARISO2. Elliott scope returns only Elliott apparatus", async () => {
  const mock = createSupabaseMock({ apparatusRows: twoDepartmentRows() });

  const result = await getApparatusReadinessList(ELLIOTT, mock.client);

  assert.deepEqual(
    result.map((row) => row.apparatus.id).sort(),
    ["app-e1", "app-e2"],
  );
  assert.ok(result.every((row) => row.apparatus.department_id === ELLIOTT));
  assert.ok(
    mock.getRecordedFilters().some((filter) => filter.column === "department_id" && filter.value === ELLIOTT),
  );
});

test("ARISO3. Red Oak scope excludes Elliott apparatus", async () => {
  const mock = createSupabaseMock({ apparatusRows: twoDepartmentRows() });

  const result = await getApparatusReadinessList(RED_OAK, mock.client);

  assert.deepEqual(
    result.map((row) => row.apparatus.id),
    ["app-r1"],
  );
  assert.ok(result.every((row) => row.apparatus.department_id === RED_OAK));
  assert.ok(
    mock.getRecordedFilters().some((filter) => filter.column === "department_id" && filter.value === RED_OAK),
  );
});

test("ARISO4. department with no apparatus returns an empty list", async () => {
  const mock = createSupabaseMock({ apparatusRows: twoDepartmentRows() });

  const result = await getApparatusReadinessList("dep-empty", mock.client);

  assert.deepEqual(result, []);
});

test("ARISO5. apparatus query failure returns an empty list instead of throwing", async () => {
  const mock = createSupabaseMock({
    apparatusRows: twoDepartmentRows(),
    apparatusError: { message: "connection failed" },
  });

  const result = await getApparatusReadinessList(ELLIOTT, mock.client);

  assert.deepEqual(result, []);
});
