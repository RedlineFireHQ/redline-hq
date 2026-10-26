import test from "node:test";
import assert from "node:assert/strict";

import type { PediatricBagRow, PediatricInspectionSummaryRow } from "./data";
import {
  filterPediatricBags,
  filterPediatricInspections,
  findMatchingPediatricChecklistItems,
  normalizePediatricSearchQuery,
} from "./search";

/** Tests for the Pediatric Bags client-side search helpers. */

function bag(label: string): PediatricBagRow {
  return {
    id: `bag-${label.toLowerCase()}`,
    departmentId: "dep-1",
    bagLabel: label,
    displayName: `Pediatric Bag ${label}`,
    isActive: true,
  };
}

function inspection(overrides: Partial<PediatricInspectionSummaryRow>): PediatricInspectionSummaryRow {
  return {
    id: overrides.id ?? "insp-1",
    bagId: overrides.bagId ?? "bag-a",
    bagLabel: overrides.bagLabel ?? "A",
    inspectorName: overrides.inspectorName ?? "Jordan Smith",
    status: overrides.status ?? "ready",
    createdAt: overrides.createdAt ?? "2026-10-16T14:30:00.000Z",
  };
}

test("SRCH1. empty / whitespace query returns every bag", () => {
  const bags = [bag("A"), bag("B"), bag("C"), bag("D")];
  assert.equal(filterPediatricBags(bags, "").length, 4);
  assert.equal(filterPediatricBags(bags, "   ").length, 4);
});

test("SRCH2. bags match by label and display name, case-insensitive", () => {
  const bags = [bag("A"), bag("B"), bag("C"), bag("D")];
  // Every display name contains "pediatric", so a bare letter matches them
  // all; a specific phrase narrows to one card.
  assert.deepEqual(filterPediatricBags(bags, "bag c").map((b) => b.bagLabel), ["C"]);
  assert.deepEqual(filterPediatricBags(bags, "PEDIATRIC BAG B").map((b) => b.bagLabel), ["B"]);
  assert.equal(filterPediatricBags(bags, "zzz").length, 0);
});

test("SRCH3. checklist item search finds canonical items, deduped", () => {
  // "Alcohol Preps" appears twice in the source doc (IV Kit #1 and #2) and
  // must surface only once.
  const matches = findMatchingPediatricChecklistItems("alcohol prep");
  assert.deepEqual(matches, ["Alcohol Preps"]);
});

test("SRCH4. empty query matches no checklist items; unknown text matches none", () => {
  assert.deepEqual(findMatchingPediatricChecklistItems(""), []);
  assert.deepEqual(findMatchingPediatricChecklistItems("not a real item xyz"), []);
});

test("SRCH5. history matches inspector name, bag label, and status text", () => {
  const history = [
    inspection({ id: "i1", bagLabel: "A", inspectorName: "Jordan Smith", status: "ready" }),
    inspection({ id: "i2", bagLabel: "B", inspectorName: "Casey Lee", status: "needs_attention" }),
  ];

  assert.deepEqual(filterPediatricInspections(history, "").map((i) => i.id), ["i1", "i2"]);
  assert.deepEqual(filterPediatricInspections(history, "casey").map((i) => i.id), ["i2"]);
  assert.deepEqual(filterPediatricInspections(history, "bag b").map((i) => i.id), ["i2"]);
  // Status text matches its human-readable form ("needs_attention" → "needs attention").
  assert.deepEqual(filterPediatricInspections(history, "needs attention").map((i) => i.id), ["i2"]);
  assert.equal(filterPediatricInspections(history, "nobody").length, 0);
});

test("SRCH6. normalizePediatricSearchQuery trims and lowercases", () => {
  assert.equal(normalizePediatricSearchQuery("  Alcohol  "), "alcohol");
});
