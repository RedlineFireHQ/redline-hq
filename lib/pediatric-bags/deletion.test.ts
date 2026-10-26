import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";

import { deletePediatricInspection } from "./data";

/**
 * Tests for administrator-only inspection deletion.
 *
 * The data-layer tests run against a Supabase mock that records RPC calls, so
 * they prove active-department scoping happens BEFORE any mutation is
 * attempted. The migration/route/UI tests are structural (source inspection),
 * matching the conventions of the existing pediatric structure suites — they
 * lock the database-side and UI-side enforcement text in place. Runtime
 * enforcement inside Postgres requires applying the migration to a database;
 * that is NOT covered here and must be verified against a live project.
 */

const RED_OAK = "dep-red-oak";
const ELLIOTT = "dep-elliott";

type Row = Record<string, unknown>;

function createDeleteMock(opts: { inspections?: Row[]; rpcError?: { message: string } } = {}) {
  const rpcCalls: Array<{ name: string; args: unknown }> = [];

  class Builder {
    private readonly filters: Array<{ col: string; val: unknown }> = [];

    select() {
      return this;
    }

    eq(col: string, val: unknown) {
      this.filters.push({ col, val });
      return this;
    }

    maybeSingle() {
      const rows = (opts.inspections ?? []).filter((row) =>
        this.filters.every((f) => row[f.col] === f.val),
      );
      return Promise.resolve({ data: rows[0] ?? null, error: null });
    }
  }

  const client = {
    from() {
      return new Builder();
    },
    rpc(name: string, args: unknown) {
      rpcCalls.push({ name, args });
      return Promise.resolve({ data: null, error: opts.rpcError ?? null });
    },
  } as unknown as SupabaseClient;

  return { client, rpcCalls };
}

// --- Data-layer behavior -----------------------------------------------------

test("DEL1. no active department → forbidden, and no RPC is ever issued", async () => {
  const mock = createDeleteMock({ inspections: [{ id: "insp-1", department_id: RED_OAK }] });
  const result = await deletePediatricInspection(mock.client, "insp-1", null);
  assert.equal(result.status, "forbidden");
  assert.equal(mock.rpcCalls.length, 0);
});

test("DEL2. another department's inspection → forbidden, and no RPC is issued", async () => {
  const mock = createDeleteMock({ inspections: [{ id: "insp-1", department_id: ELLIOTT }] });
  const result = await deletePediatricInspection(mock.client, "insp-1", RED_OAK);
  assert.equal(result.status, "forbidden");
  assert.equal(mock.rpcCalls.length, 0);
});

test("DEL3. unknown inspection → not_found, and no RPC is issued", async () => {
  const mock = createDeleteMock({ inspections: [] });
  const result = await deletePediatricInspection(mock.client, "missing", RED_OAK);
  assert.equal(result.status, "not_found");
  assert.equal(mock.rpcCalls.length, 0);
});

test("DEL4. same-department inspection deletes via the RPC with only the inspection id", async () => {
  const mock = createDeleteMock({ inspections: [{ id: "insp-1", department_id: RED_OAK }] });
  const result = await deletePediatricInspection(mock.client, "insp-1", RED_OAK);
  assert.equal(result.status, "deleted");
  assert.deepEqual(mock.rpcCalls, [
    { name: "delete_pediatric_bag_inspection", args: { p_inspection_id: "insp-1" } },
  ]);
});

test("DEL5. database rejection of a non-administrator maps to forbidden", async () => {
  const mock = createDeleteMock({
    inspections: [{ id: "insp-1", department_id: RED_OAK }],
    rpcError: { message: "Only a department administrator can delete a pediatric bag inspection." },
  });
  const result = await deletePediatricInspection(mock.client, "insp-1", RED_OAK);
  assert.equal(result.status, "forbidden");
});

test("DEL6. an unresolved requester in the database maps to forbidden", async () => {
  const mock = createDeleteMock({
    inspections: [{ id: "insp-1", department_id: RED_OAK }],
    rpcError: { message: "Unable to resolve requesting member for this inspection department." },
  });
  const result = await deletePediatricInspection(mock.client, "insp-1", RED_OAK);
  assert.equal(result.status, "forbidden");
});

// --- Migration structure -----------------------------------------------------

const MIGRATION_PATH = join(
  __dirname,
  "../../supabase/migrations/20261017120000_delete_pediatric_bag_inspection.sql",
);
const RAW_MIGRATION = existsSync(MIGRATION_PATH) ? readFileSync(MIGRATION_PATH, "utf8") : "";
// Strip line comments so prose never counts as SQL.
const MIGRATION_SQL = RAW_MIGRATION.replace(/--[^\n]*/g, "");

test("DEL7. deletion migration exists and defines the SECURITY DEFINER RPC", () => {
  assert.ok(existsSync(MIGRATION_PATH), "deletion migration file is missing");
  assert.match(MIGRATION_SQL, /create or replace function public\.delete_pediatric_bag_inspection\(p_inspection_id uuid\)/);
  assert.match(MIGRATION_SQL, /security definer/i);
  assert.match(MIGRATION_SQL, /set search_path = public, auth, pg_temp/);
});

test("DEL8. RPC enforces administrator role within the inspection's own department", () => {
  // Member resolution is scoped to the inspection's department (cross-department denial).
  assert.match(MIGRATION_SQL, /m\.department_id = v_inspection\.department_id/);
  // Administrator-only gate.
  assert.match(MIGRATION_SQL, /lower\(coalesce\(m\.role, ''\)\) = 'administrator'/);
  // Active membership required.
  assert.match(MIGRATION_SQL, /coalesce\(m\.active, false\) = true/);
});

test("DEL9. RPC deletes only inspection-specific records, department-scoped", () => {
  // Snapshot rows deleted first, scoped to BOTH the inspection and its department.
  assert.match(MIGRATION_SQL, /delete from public\.pediatric_bag_checklist_results/);
  assert.match(MIGRATION_SQL, /r\.inspection_id = v_inspection\.id/);
  assert.match(MIGRATION_SQL, /r\.department_id = v_inspection\.department_id/);
  // Then the inspection itself, also department-scoped.
  assert.match(MIGRATION_SQL, /delete from public\.pediatric_bag_inspections/);
  assert.match(MIGRATION_SQL, /i\.id = v_inspection\.id/);
  assert.match(MIGRATION_SQL, /i\.department_id = v_inspection\.department_id/);
});

test("DEL10. RPC never touches bags, template items, sessions, participants, members, or departments", () => {
  const forbidden = [
    /delete from public\.pediatric_bags\b/,
    /delete from public\.pediatric_bag_checklist_items/,
    /delete from public\.pediatric_bag_checklist_sessions/,
    /delete from public\.pediatric_bag_check_session_members/,
    /delete from public\.members\b/,
    /delete from public\.departments\b/,
  ];
  for (const pattern of forbidden) {
    assert.doesNotMatch(MIGRATION_SQL, pattern, `migration must not contain ${pattern}`);
  }
});

test("DEL11. RPC execute privilege is locked to authenticated members", () => {
  assert.match(MIGRATION_SQL, /revoke all on function public\.delete_pediatric_bag_inspection\(uuid\) from public/);
  assert.match(MIGRATION_SQL, /revoke all on function public\.delete_pediatric_bag_inspection\(uuid\) from anon/);
  assert.match(MIGRATION_SQL, /grant execute on function public\.delete_pediatric_bag_inspection\(uuid\) to authenticated/);
});

// --- Route + UI structure ----------------------------------------------------

const ROUTE_SOURCE = readFileSync(
  join(__dirname, "../../app/api/pediatric-bags/inspections/[inspectionId]/route.ts"),
  "utf8",
);

test("DEL12. API route requires an authenticated administrator of the active department", () => {
  // Resolves the cookie-derived active member; never trusts client-supplied ids.
  assert.match(ROUTE_SOURCE, /getCurrentMember\(supabase\)/);
  assert.match(ROUTE_SOURCE, /currentMember\.role !== "administrator"/);
  // Active-department scope is passed to the data layer.
  assert.match(ROUTE_SOURCE, /deletePediatricInspection\(supabase, inspectionId, currentMember\.departmentId\)/);
  assert.match(ROUTE_SOURCE, /export async function DELETE/);
});

const HISTORY_SOURCE = readFileSync(
  join(__dirname, "../../components/inventory/PediatricCheckHistory.tsx"),
  "utf8",
);

test("DEL13. history list shows Delete only when canDelete is true", () => {
  assert.match(HISTORY_SOURCE, /canDelete\??: boolean/);
  assert.match(HISTORY_SOURCE, /canDelete = false/);
  assert.match(HISTORY_SOURCE, /\{canDelete \? \(/);
  assert.match(HISTORY_SOURCE, /DeletePediatricInspectionButton/);
});

const DELETE_BUTTON_SOURCE = readFileSync(
  join(__dirname, "../../components/inventory/DeletePediatricInspectionButton.tsx"),
  "utf8",
);

test("DEL14. delete action always requires an explicit confirmation step first", () => {
  // Two-step flow: clicking Delete only opens a confirmation dialog; the
  // request fires exclusively from the dialog's confirm handler.
  assert.match(DELETE_BUTTON_SOURCE, /role="dialog"/);
  assert.match(DELETE_BUTTON_SOURCE, /aria-modal="true"/);
  assert.match(DELETE_BUTTON_SOURCE, /setConfirming\(true\)/);
  assert.match(DELETE_BUTTON_SOURCE, />\s*Cancel\s*<\/button>/);
  assert.match(DELETE_BUTTON_SOURCE, /Delete Inspection/);
  assert.match(DELETE_BUTTON_SOURCE, /method: "DELETE"/);
  assert.match(DELETE_BUTTON_SOURCE, /\/api\/pediatric-bags\/inspections\/\$\{inspectionId\}/);
});

test("DEL15. history refreshes after a successful deletion", () => {
  assert.match(DELETE_BUTTON_SOURCE, /router\.refresh\(\)/);
});

const DETAIL_PAGE_SOURCE = readFileSync(
  join(__dirname, "../../app/inventory/ems-pediatric-bags/history/[inspectionId]/page.tsx"),
  "utf8",
);

test("DEL16. inspection detail page renders Delete for administrators only", () => {
  assert.match(DETAIL_PAGE_SOURCE, /currentMember\.role === "administrator"/);
  assert.match(DETAIL_PAGE_SOURCE, /DeletePediatricInspectionButton/);
});

const SECTION_SOURCE = readFileSync(
  join(__dirname, "../../components/inventory/PediatricBagsSection.tsx"),
  "utf8",
);

test("DEL17. EMS Supplies section enables delete only for an administrator of the active department", () => {
  assert.match(SECTION_SOURCE, /currentMember\?\.role === "administrator"/);
  assert.match(SECTION_SOURCE, /currentMember\.departmentId === departmentId/);
});
