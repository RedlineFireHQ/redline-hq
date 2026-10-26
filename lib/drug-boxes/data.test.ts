import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createDrugInspection,
  deleteDrugInspection,
  getDrugBox,
  getDrugBoxes,
  getDrugInspection,
  getDrugInspections,
  getDrugTemplateItems,
  isDrugBoxSchemaMissingError,
} from "./data";

/**
 * Behavior tests for the Supabase-backed Drug Box data layer: fresh
 * inspections, multiple inspections per squad per day, snapshot fidelity,
 * checked/unchecked results, deletion authorization, and department isolation.
 */

const RED_OAK = "dep-red-oak";
const ELLIOTT = "dep-elliott";

type Row = Record<string, unknown>;

type Inserted = { table: string; rows: Row[] };

function createMock(tables: Record<string, Row[]>) {
  const inserted: Inserted[] = [];
  const rpcCalls: Array<{ name: string; args: unknown }> = [];

  class Builder {
    private readonly table: string;
    private filters: Array<{ col: string; val: unknown }> = [];
    private inFilters: Array<{ col: string; vals: unknown[] }> = [];
    private singleRow = false;
    private insertRows: Row[] | null = null;

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
    in(col: string, vals: unknown[]) {
      this.inFilters.push({ col, vals });
      return this;
    }
    order() {
      return this;
    }
    insert(rows: Row[] | Row) {
      this.insertRows = Array.isArray(rows) ? rows : [rows];
      return this;
    }
    maybeSingle() {
      this.singleRow = true;
      return this;
    }
    single() {
      this.singleRow = true;
      return this;
    }
    private matches(row: Row) {
      return (
        this.filters.every((f) => row[f.col] === f.val) &&
        this.inFilters.every((f) => f.vals.includes(row[f.col]))
      );
    }
    private execute(): Promise<{ data: unknown; error: unknown }> {
      if (this.insertRows) {
        const tableRows = tables[this.table] ?? (tables[this.table] = []);
        for (const r of this.insertRows) {
          const withId = { id: (r.id as string) ?? `${this.table}-${tableRows.length + 1}`, ...r };
          tableRows.push(withId);
        }
        inserted.push({ table: this.table, rows: this.insertRows });
        const last = tables[this.table][tables[this.table].length - 1];
        return Promise.resolve({ data: this.singleRow ? last : this.insertRows, error: null });
      }
      const rows = (tables[this.table] ?? []).filter((r) => this.matches(r));
      return Promise.resolve({ data: this.singleRow ? rows[0] ?? null : rows, error: null });
    }
    then(resolve: (v: { data: unknown; error: unknown }) => unknown, reject?: (r: unknown) => unknown) {
      return this.execute().then(resolve, reject);
    }
  }

  const client = {
    from(table: string) {
      return new Builder(table);
    },
    rpc(name: string, args: unknown) {
      rpcCalls.push({ name, args });
      return Promise.resolve({ data: null, error: null });
    },
  } as unknown as SupabaseClient;

  return { client, inserted, rpcCalls };
}

function box(id: string, dept: string, squad: string): Row {
  return { id, department_id: dept, squad_number: squad, display_name: `Drug Box — Squad ${squad}`, is_active: true };
}

function inspectionRow(id: string, dept: string, boxId: string, squad: string, memberId: string, extra: Partial<Row> = {}): Row {
  return {
    id,
    department_id: dept,
    drug_box_id: boxId,
    squad_number: squad,
    member_id: memberId,
    unit_number: squad,
    box_lock_number: "B",
    cs_lock_number: "C",
    ez_io_number: "E",
    assisting_personnel: [],
    created_at: "2026-03-10T14:30:00.000Z",
    ...extra,
  };
}

const template = getDrugTemplateItems();
const inputFor = (boxId: string, squad: string, checked: ReadonlySet<string>) => ({
  drugBoxId: boxId,
  squadNumber: squad,
  inspectorMemberId: "m1",
  inspectorName: "Jordan Smith",
  unitNumber: squad,
  boxLockNumber: "B",
  csLockNumber: "C",
  ezIoNumber: "E",
  assistingPersonnel: [] as string[],
  checkedItemIds: checked,
});

test("DRUGDB1. boxes are scoped to the active department", async () => {
  const mock = createMock({ drug_boxes: [box("b114", RED_OAK, "114"), box("b115", RED_OAK, "115"), box("e114", ELLIOTT, "114")] });
  const result = await getDrugBoxes(mock.client, RED_OAK);
  assert.equal(result.status, "ok");
  assert.deepEqual(result.boxes.map((b) => b.squadNumber), ["114", "115"]);
  assert.ok(result.boxes.every((b) => b.departmentId === RED_OAK));
});

test("DRUGDB2. no department means no query is issued (never unscoped)", async () => {
  const mock = createMock({ drug_boxes: [box("b114", RED_OAK, "114")] });
  const result = await getDrugBoxes(mock.client, null);
  assert.equal(result.status, "missing_schema");
  assert.deepEqual(result.boxes, []);
});

test("DRUGDB3. a completed inspection writes one inspection row + a full per-item snapshot", async () => {
  const mock = createMock({ drug_boxes: [box("b114", RED_OAK, "114")] });
  const checked = new Set([template[0].id, template[5].id]);
  const result = await createDrugInspection(mock.client, RED_OAK, inputFor("b114", "114", checked));

  assert.equal(result.status, "ok");

  // One inspection insert + one results insert (batch).
  const inspectionInsert = mock.inserted.find((i) => i.table === "drug_box_inspections");
  const resultsInsert = mock.inserted.find((i) => i.table === "drug_box_checklist_results");
  assert.ok(inspectionInsert, "expected an inspection insert");
  assert.ok(resultsInsert, "expected a snapshot insert");
  assert.equal(inspectionInsert.rows.length, 1);
  // Snapshot covers every template item exactly once.
  assert.equal(resultsInsert.rows.length, template.length);
  assert.ok(resultsInsert.rows.every((r) => r.department_id === RED_OAK));
});

test("DRUGDB4. checked/unchecked states are recorded exactly (snapshot fidelity)", async () => {
  const mock = createMock({ drug_boxes: [box("b114", RED_OAK, "114")] });
  const checked = new Set([template[0].id, template[5].id]);
  await createDrugInspection(mock.client, RED_OAK, inputFor("b114", "114", checked));

  const resultsInsert = mock.inserted.find((i) => i.table === "drug_box_checklist_results");
  assert.ok(resultsInsert);
  const byItem = new Map(resultsInsert.rows.map((r) => [r.item_label_snapshot, r.is_checked]));
  assert.equal(byItem.get(template[0].itemLabel), true);
  assert.equal(byItem.get(template[5].itemLabel), true);
  assert.equal(byItem.get(template[1].itemLabel), false);
});

test("DRUGDB5. multiple inspections for a squad create separate records (no overwrite)", async () => {
  const mock = createMock({ drug_boxes: [box("b114", RED_OAK, "114")] });
  const first = await createDrugInspection(mock.client, RED_OAK, inputFor("b114", "114", new Set([template[0].id])));
  const second = await createDrugInspection(mock.client, RED_OAK, inputFor("b114", "114", new Set()));
  assert.equal(first.status, "ok");
  assert.equal(second.status, "ok");
  if (first.status === "ok" && second.status === "ok") {
    assert.notEqual(first.inspectionId, second.inspectionId);
  }
  const inspectionInserts = mock.inserted.filter((i) => i.table === "drug_box_inspections");
  assert.equal(inspectionInserts.length, 2);
});

test("DRUGDB6. cross-department box access is forbidden", async () => {
  const mock = createMock({ drug_boxes: [box("e114", ELLIOTT, "114")] });
  const result = await getDrugBox(mock.client, RED_OAK, "e114");
  // The box belongs to Elliott; Red Oak must not open it.
  assert.ok(result === "not_found" || result === "forbidden");
});

test("DRUGDB7. deletion: no department → forbidden with no RPC; cross-department → forbidden with no RPC", async () => {
  const mock = createMock({ drug_box_inspections: [inspectionRow("i1", ELLIOTT, "e114", "114", "m9")] });

  const noDept = await deleteDrugInspection(mock.client, "i1", null);
  assert.equal(noDept.status, "forbidden");
  assert.equal(mock.rpcCalls.length, 0);

  const crossDept = await deleteDrugInspection(mock.client, "i1", RED_OAK);
  assert.equal(crossDept.status, "forbidden");
  assert.equal(mock.rpcCalls.length, 0);
});

test("DRUGDB8. same-department deletion calls the admin RPC with only the inspection id", async () => {
  const mock = createMock({ drug_box_inspections: [inspectionRow("i1", RED_OAK, "b114", "114", "m1")] });
  const result = await deleteDrugInspection(mock.client, "i1", RED_OAK);
  assert.equal(result.status, "deleted");
  assert.deepEqual(mock.rpcCalls, [{ name: "delete_drug_box_inspection", args: { p_inspection_id: "i1" } }]);
});

test("DRUGDB9. missing migration surfaces a graceful missing_schema state", async () => {
  const mock = createMock({});
  assert.ok(isDrugBoxSchemaMissingError({ code: "42P01", message: "relation public.drug_boxes does not exist" }));
  assert.ok(isDrugBoxSchemaMissingError({ message: "Could not find the table 'public.drug_box_inspections' in the schema cache" }));
  assert.ok(!isDrugBoxSchemaMissingError({ code: "401", message: "Invalid API key" }));
  // getDrugInspections with a missing-table error -> missing_schema.
  const failing = {
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        order() { return Promise.resolve({ data: null, error: { code: "42P01", message: "relation public.drug_box_inspections does not exist" } }); },
        then(resolve: (v: unknown) => unknown) { return Promise.resolve({ data: null, error: { code: "42P01", message: "relation public.drug_box_inspections does not exist" } }).then(resolve); },
      };
    },
  } as unknown as SupabaseClient;
  const result = await getDrugInspections(failing, RED_OAK);
  assert.equal(result.status, "missing_schema");
});

test("DRUGDB10. inspection detail reads the snapshot and enforces department isolation", async () => {
  const items = getDrugTemplateItems().slice(0, 2).map((item, index) => ({
    inspection_id: "i1",
    checklist_item_id: item.id,
    section_name_snapshot: item.sectionName,
    item_label_snapshot: item.itemLabel,
    required_quantity_snapshot: item.requiredQuantity,
    source_quantity_text_snapshot: item.sourceQuantityText,
    is_checked: index === 0,
    item_order: index,
    department_id: RED_OAK,
  }));
  const mock = createMock({
    drug_box_inspections: [inspectionRow("i1", RED_OAK, "b114", "114", "m1")],
    drug_box_checklist_results: items,
    members: [{ id: "m1", department_id: RED_OAK, first_name: "Jordan", last_name: "Smith" }],
  });

  const detail = await getDrugInspection(mock.client, RED_OAK, "i1");
  assert.equal(detail.status, "ok");
  if (detail.status === "ok") {
    assert.equal(detail.inspection.inspectorName, "Jordan Smith");
    assert.equal(detail.inspection.items.length, 2);
    assert.equal(detail.inspection.items[0].checked, true);
    assert.equal(detail.inspection.items[1].checked, false);
  }

  // Another department cannot open it.
  const cross = await getDrugInspection(mock.client, ELLIOTT, "i1");
  assert.ok(cross.status === "forbidden" || cross.status === "not_found");
});
