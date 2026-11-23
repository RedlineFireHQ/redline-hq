import assert from "node:assert/strict";
import test from "node:test";
import { hydroDeficiencyHref, hydroResultButtonClass, shouldMarkCylinderOutOfService } from "./deficiency";
import { deficiencyReportedOrder } from "../deficiencies/list-order";

test("hydro deficiency launch retains the exact result and cylinder", () => {
  const url = new URL(hydroDeficiencyHref("result-id", "cylinder-id", "Cylinder & 1"), "https://example.test");
  assert.equal(url.pathname, "/deficiencies/report");
  assert.equal(url.searchParams.get("hydroResultId"), "result-id");
  assert.equal(url.searchParams.get("inventoryItemId"), "cylinder-id");
  assert.equal(url.searchParams.get("inventoryItemLabel"), "Cylinder & 1");
  assert.equal(url.searchParams.get("hydrostatic"), "1");
});

test("hydro result buttons match flow test selected and hover colors", () => {
  assert.match(hydroResultButtonClass("Pass", false), /bg-emerald-900\/20.*hover:bg-emerald-900\/30/);
  assert.match(hydroResultButtonClass("Pass", true), /bg-emerald-600 text-white/);
  assert.match(hydroResultButtonClass("Fail", false), /bg-red-900\/20.*hover:bg-red-900\/30/);
  assert.match(hydroResultButtonClass("Fail", true), /bg-red-600 text-white/);
});

test("deficiency list puts dated reports before undated reports", () => {
  assert.deepEqual(deficiencyReportedOrder, { ascending: false, nullsFirst: false });
});

test("hydro failure changes service status only when requested", () => {
  assert.equal(shouldMarkCylinderOutOfService(true, false), false);
  assert.equal(shouldMarkCylinderOutOfService(true, true), true);
  assert.equal(shouldMarkCylinderOutOfService(false, false), true);
});
