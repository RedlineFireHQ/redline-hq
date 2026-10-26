import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getPediatricBagChecklist,
  getPediatricBagForDepartment,
  getPediatricBagsForDepartment,
  isPediatricBagSchemaMissingError,
} from "./data";

/**
 * Tests for the pediatric bags UI data layer. Focus: department isolation,
 * graceful handling when the migration is not applied, and ownership checks.
 */

const RED_OAK = "dep-red-oak";
const ELLIOTT = "dep-elliott";

type Row = Record<string, unknown>;

function createSupabaseMock(tables: Record<string, Row[]>, opts: { errorOn?: Record<string, { code?: string; message: string }> } = {}) {
  const recorded: Array<{ table: string; filters: Array<{ col: string; val: unknown }> }> = [];

  class Builder {
    private readonly table: string;
    private readonly filters: Array<{ col: string; val: unknown }> = [];
    private single = false;

    constructor(table: string) {
      this.table = table;
    }

    select() {
      return this;
    }

    eq(col: string, val: unknown) {
      this.filters.push({ col, val });
      return this;
    }

    order() {
      return this;
    }

    maybeSingle() {
      this.single = true;
      return this.execute();
    }

    private execute() {
      recorded.push({ table: this.table, filters: this.filters });
      const forced = opts.errorOn?.[this.table];
      if (forced) {
        return Promise.resolve({ data: null, error: forced });
      }
      const rows = (tables[this.table] ?? []).filter((row) =>
        this.filters.every((f) => row[f.col] === f.val),
      );
      return Promise.resolve({ data: this.single ? rows[0] ?? null : rows, error: null });
    }

    then(resolve: (v: { data: unknown; error: unknown }) => unknown, reject?: (r: unknown) => unknown) {
      return this.execute().then(resolve, reject);
    }
  }

  return {
    client: {
      from(table: string) {
        return new Builder(table);
      },
    } as unknown as SupabaseClient,
    getRecorded: () => recorded,
  };
}

function bag(id: string, dept: string, label: string): Row {
  return { id, department_id: dept, bag_label: label, display_name: `Pediatric Bag ${label}`, is_active: true };
}

test("PUI1. bag list is scoped to the active department", async () => {
  const mock = createSupabaseMock({
    pediatric_bags: [bag("b-a", RED_OAK, "A"), bag("b-b", RED_OAK, "B"), bag("e-a", ELLIOTT, "A")],
  });

  const result = await getPediatricBagsForDepartment(mock.client, RED_OAK);

  assert.equal(result.status, "ok");
  if (result.status === "ok") {
    assert.deepEqual(result.bags.map((b) => b.bagLabel), ["A", "B"]);
    assert.ok(result.bags.every((b) => b.departmentId === RED_OAK));
  }
});

test("PUI2. missing migration yields a graceful missing_schema state (not a throw)", async () => {
  const mock = createSupabaseMock({}, {
    errorOn: { pediatric_bags: { code: "42P01", message: "relation public.pediatric_bags does not exist" } },
  });

  const result = await getPediatricBagsForDepartment(mock.client, RED_OAK);
  assert.equal(result.status, "missing_schema");
  assert.deepEqual(result.bags, []);
});

test("PUI2b. an auth/connection failure is 'unavailable', not 'missing_schema'", async () => {
  const mock = createSupabaseMock({}, {
    errorOn: { pediatric_bags: { code: "401", message: "Invalid API key" } },
  });

  const result = await getPediatricBagsForDepartment(mock.client, RED_OAK);
  assert.equal(result.status, "unavailable");
  assert.deepEqual(result.bags, []);
});

test("PUI3. no department means no query is issued (never unscoped)", async () => {
  const mock = createSupabaseMock({ pediatric_bags: [bag("b-a", RED_OAK, "A")] });
  const result = await getPediatricBagsForDepartment(mock.client, null);
  assert.equal(result.status, "missing_schema");
  assert.equal(mock.getRecorded().length, 0);
});

test("PUI4. a bag belonging to another department is forbidden", async () => {
  const mock = createSupabaseMock({ pediatric_bags: [bag("e-a", ELLIOTT, "A")] });
  // Request Elliott's bag while active department is Red Oak.
  const result = await getPediatricBagForDepartment(mock.client, "e-a", RED_OAK);
  assert.equal(result, "forbidden");
});

test("PUI5. checklist loads the shared template scoped to the department", async () => {
  const mock = createSupabaseMock({
    pediatric_bags: [bag("b-a", RED_OAK, "A")],
    pediatric_bag_checklist_items: [
      { id: "i1", department_id: RED_OAK, section_name: "Top-Misc", item_label: "6.0 ETT", required_quantity: 1, source_quantity_text: "1", is_required: true, is_active: true, display_order: 1, created_at: "x" },
      { id: "i2", department_id: RED_OAK, section_name: "Out — IV Kit #1", item_label: "Alcohol Preps", required_quantity: 10, source_quantity_text: "10", is_required: true, is_active: true, display_order: 23, created_at: "x" },
      { id: "iX", department_id: ELLIOTT, section_name: "Top-Misc", item_label: "Other", required_quantity: 1, source_quantity_text: "1", is_required: true, is_active: true, display_order: 1, created_at: "x" },
    ],
    pediatric_bag_checklist_progress: [],
  });

  const result = await getPediatricBagChecklist(mock.client, "b-a", RED_OAK, "m1");
  assert.equal(result.status, "ok");
  if (result.status === "ok") {
    assert.equal(result.items.length, 2);
    assert.ok(result.items.every((i) => i.id !== "iX")); // Elliott's item excluded
    const alcohol = result.items.find((i) => i.itemLabel === "Alcohol Preps");
    assert.ok(alcohol);
    assert.equal(alcohol.requiredQuantity, 10);
    assert.equal(alcohol.sourceQuantityText, "10");
  }
});

test("PUI6. schema-missing detection recognizes Postgres and PostgREST signals", () => {
  assert.equal(isPediatricBagSchemaMissingError({ code: "42P01", message: "relation public.pediatric_bags does not exist" }), true);
  assert.equal(isPediatricBagSchemaMissingError({ message: "Could not find the table 'public.pediatric_bags' in the schema cache" }), true);
  assert.equal(isPediatricBagSchemaMissingError({ code: "PGRST116", message: "some other error" }), false);
  assert.equal(isPediatricBagSchemaMissingError(null), false);
});

test("PUI7. schema-missing detection covers every pediatric table, not just pediatric_bags", () => {
  // 42P01 alone is sufficient regardless of table name.
  assert.equal(isPediatricBagSchemaMissingError({ code: "42P01", message: "relation public.pediatric_bag_checklist_items does not exist" }), true);
  // PostgREST message path must match for each pediatric table.
  for (const table of [
    "pediatric_bags",
    "pediatric_bag_checklist_items",
    "pediatric_bag_checklist_sessions",
    "pediatric_bag_inspections",
    "pediatric_bag_checklist_progress",
    "pediatric_bag_checklist_results",
  ]) {
    assert.equal(
      isPediatricBagSchemaMissingError({ message: `Could not find the table 'public.${table}' in the schema cache` }),
      true,
      `should detect missing ${table}`,
    );
  }
});

test("PUI8. unrelated pediatric-sounding errors are not misclassified as missing schema", () => {
  // A permission/RLS denial mentions the table but is NOT a missing-schema error.
  assert.equal(
    isPediatricBagSchemaMissingError({ code: "42501", message: "permission denied for table pediatric_bags" }),
    false,
  );
  // A generic network/other error without the missing-table signal.
  assert.equal(isPediatricBagSchemaMissingError({ message: "pediatric_bags request timed out" }), false);
});
