import assert from "node:assert/strict";
import test from "node:test";

import { getApparatusReadinessList } from "./apparatus-readiness-data";

const ELLIOTT_ID = "4d811b72-1857-4cf4-93b5-9cbbd889153f";
const RED_OAK_ID = "82f50d14-216a-4dd1-80f4-58459dc97b97";

type FakeRow = { id: string; department_id: string; name: string; lifecycle_status: string };

/**
 * Minimal Supabase query-builder stub that records the filters applied to the
 * `apparatus` table and returns rows only when the query is department-scoped.
 * Any apparatus query that does NOT filter by the requested department yields
 * every department's rows here, which the assertions below must catch.
 */
function buildApparatusCaptureClient(rows: FakeRow[]) {
  const captured: Array<{ departmentFilter: string | null }> = [];

  const builder = {
    select() {
      return this;
    },
    eq(column: string, value: unknown) {
      if (column === "department_id") {
        captured.push({ departmentFilter: String(value) });
      }
      return this;
    },
    order() {
      return this;
    },
    // Terminal: behave like an awaited PostgREST query.
    then(resolve: (value: { data: FakeRow[] }) => unknown) {
      const deptFilter = captured[captured.length - 1]?.departmentFilter ?? null;
      const data = deptFilter ? rows.filter((row) => row.department_id === deptFilter) : rows;
      return Promise.resolve(resolve({ data }));
    },
  };

  const client = {
    from(table: string) {
      if (table === "apparatus") {
        return builder;
      }
      // All secondary lookups (bay schedules, requirements, deficiencies, …)
      // return empty so the function short-circuits to evaluation-failure rows.
      const emptyBuilder = {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        in() {
          return this;
        },
        order() {
          return this;
        },
        maybeSingle() {
          return Promise.resolve({ data: null });
        },
        then(resolve: (value: { data: never[] }) => unknown) {
          return Promise.resolve(resolve({ data: [] }));
        },
      };
      return emptyBuilder;
    },
  };

  return { client: client as never, captured };
}

const SHARED_FLEET: FakeRow[] = [
  { id: "e-1", department_id: ELLIOTT_ID, name: "Engine 430", lifecycle_status: "active" },
  { id: "r-114", department_id: RED_OAK_ID, name: "114", lifecycle_status: "active" },
  { id: "r-115", department_id: RED_OAK_ID, name: "115", lifecycle_status: "active" },
];

test("Isolation: Elliott selection never returns Red Oak apparatus", async () => {
  const { client, captured } = buildApparatusCaptureClient(SHARED_FLEET);

  const rows = await getApparatusReadinessList(ELLIOTT_ID, client);

  // The query must be department-scoped to Elliott.
  assert.equal(captured.some((c) => c.departmentFilter === ELLIOTT_ID), true);
  // No returned row may belong to Red Oak.
  assert.equal(rows.every((row) => row.apparatus.department_id === ELLIOTT_ID), true);
  assert.equal(
    rows.some((row) => row.apparatus.name === "114" || row.apparatus.name === "115"),
    false,
  );
});

test("Isolation: Red Oak selection never returns Elliott apparatus", async () => {
  const { client } = buildApparatusCaptureClient(SHARED_FLEET);

  const rows = await getApparatusReadinessList(RED_OAK_ID, client);

  assert.equal(rows.every((row) => row.apparatus.department_id === RED_OAK_ID), true);
  assert.equal(
    rows.some((row) => row.apparatus.name === "Engine 430"),
    false,
  );
});

test("Isolation: missing department yields an empty fleet, never all departments", async () => {
  const { client } = buildApparatusCaptureClient(SHARED_FLEET);

  const rows = await getApparatusReadinessList(null, client);

  assert.deepEqual(rows, []);
});
