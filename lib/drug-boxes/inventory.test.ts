import test from "node:test";
import assert from "node:assert/strict";

import {
  DRUG_BOX_INVENTORY,
  DRUG_BOX_SECTION_ORDER,
  DRUG_BOX_SQUAD_NUMBERS,
} from "./inventory";

/**
 * Structural tests for the canonical Red Oak Drug Box inventory
 * (docs/RO EMS Drug Inventory List - 08.28.25.doc).
 */

test("DRUGINV1. the four squads are 114, 115, 116, 117 (unit numbers, not letters)", () => {
  assert.deepEqual([...DRUG_BOX_SQUAD_NUMBERS], ["114", "115", "116", "117"]);
});

test("DRUGINV2. sections are the four form bands in source order", () => {
  assert.deepEqual([...DRUG_BOX_SECTION_ORDER], ["Section 1", "Section 2", "Section 3", "EZ-IO"]);
});

test("DRUGINV3. every entry belongs to a declared section and has a positive quantity", () => {
  const sections = new Set(DRUG_BOX_SECTION_ORDER);
  assert.ok(DRUG_BOX_INVENTORY.length > 0);
  for (const [section, label, qty] of DRUG_BOX_INVENTORY) {
    assert.ok(sections.has(section), `unexpected section: ${section}`);
    assert.ok(label.trim().length > 0, "item label must be present");
    assert.ok(typeof qty === "number" && qty >= 1, `quantity must be >= 1 for ${label}`);
  }
});

test("DRUGINV4. the EZ-IO section is present with its items", () => {
  const ezio = DRUG_BOX_INVENTORY.filter(([section]) => section === "EZ-IO");
  assert.ok(ezio.length >= 10, "EZ-IO section should include its items");
  const labels = ezio.map(([, label]) => label);
  assert.ok(labels.includes("Pressure Infuser"));
  assert.ok(labels.includes("Drill driver"));
  assert.ok(labels.some((l) => l.includes("Xylocaine")));
});

test("DRUGINV5. key medications appear with their exact quantities", () => {
  const byLabel = new Map(DRUG_BOX_INVENTORY.map(([, label, qty]) => [label, qty]));
  assert.equal(byLabel.get("Epi 1:10,000 1mg prefilled"), 6);
  assert.equal(byLabel.get("Atropine 1mg prefilled"), 4);
  assert.equal(byLabel.get("Cordarone 150mg vial"), 3);
  assert.equal(byLabel.get("Rocuronium 50mg vial"), 3);
  assert.equal(byLabel.get("Ketamine 500mg vial"), 2);
});

test("DRUGINV6. section order in the inventory matches DRUG_BOX_SECTION_ORDER", () => {
  const seen: string[] = [];
  for (const [section] of DRUG_BOX_INVENTORY) {
    if (!seen.includes(section)) {
      seen.push(section);
    }
  }
  assert.deepEqual(seen, [...DRUG_BOX_SECTION_ORDER]);
});
