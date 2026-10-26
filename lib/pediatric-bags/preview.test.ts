import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { PEDIATRIC_INVENTORY, PEDIATRIC_SECTION_ORDER } from "./inventory";
import {
  countUnresolvedPreviewItems,
  getPreviewBag,
  getPreviewBags,
  getPreviewSections,
} from "./preview";

/**
 * Tests for the read-only preview. The preview must reflect the canonical shared
 * inventory exactly — no duplication, correct order, unresolved quantities
 * preserved.
 */

test("PREV1. preview exposes all four bags A/B/C/D", () => {
  const bags = getPreviewBags();
  assert.deepEqual(bags.map((b) => b.label), ["A", "B", "C", "D"]);
});

test("PREV2. preview renders all 17 sections in source order", () => {
  const sections = getPreviewSections();
  assert.deepEqual(sections.map((s) => s.sectionName), [...PEDIATRIC_SECTION_ORDER]);
  assert.equal(sections.length, 17);
});

test("PREV3. preview contains all 87 items, matching the canonical inventory", () => {
  const sections = getPreviewSections();
  const total = sections.reduce((sum, s) => sum + s.items.length, 0);
  assert.equal(total, 87);
  assert.equal(PEDIATRIC_INVENTORY.length, 87);
});

test("PREV4. preview preserves item wording and quantities verbatim", () => {
  const sections = getPreviewSections();
  const flat = sections.flatMap((s) => s.items.map((i) => [s.sectionName, i.itemLabel, i.requiredQuantity, i.sourceQuantityText]));
  // Order must match the canonical inventory exactly.
  assert.deepEqual(flat, PEDIATRIC_INVENTORY.map(([s, l, q, t]) => [s, l, q, t]));
});

test("PREV5. Alcohol Preps are confirmed at quantity 10 in both IV kits", () => {
  const sections = getPreviewSections();
  const alcohol = sections
    .flatMap((s) => s.items)
    .filter((i) => i.itemLabel === "Alcohol Preps");
  assert.equal(alcohol.length, 2);
  for (const item of alcohol) {
    assert.equal(item.requiredQuantity, 10);
    assert.equal(item.sourceQuantityText, "10");
  }
  // No unresolved ("***") quantities remain in the current inventory.
  assert.equal(countUnresolvedPreviewItems(), 0);
});

test("PREV6. getPreviewBag resolves labels case-insensitively and rejects others", () => {
  assert.equal(getPreviewBag("a")?.label, "A");
  assert.equal(getPreviewBag("D")?.label, "D");
  assert.equal(getPreviewBag("E"), null);
  assert.equal(getPreviewBag(""), null);
});

test("PREV7. combined multi-size entries remain single items (not split)", () => {
  const labels = getPreviewSections().flatMap((s) => s.items.map((i) => i.itemLabel));
  assert.ok(labels.includes("King 2.0 & 2.5"));
  assert.ok(labels.includes("#1 Miller, #2 Mac"));
  // The individual sizes must NOT appear as standalone items.
  assert.ok(!labels.includes("King 2.0"));
  assert.ok(!labels.includes("King 2.5"));
  assert.ok(!labels.includes("#1 Miller"));
});

test("PREV8. each bag maps to a distinct, existing artwork image", () => {
  const bags = getPreviewBags();
  const paths = bags.map((b) => b.imagePath);

  // All four present and distinct.
  assert.equal(paths.length, 4);
  assert.equal(new Set(paths).size, 4);

  // Each points at a real file under public/branding/images/.
  for (const bag of bags) {
    assert.ok(bag.imagePath.startsWith("/branding/images/"), `${bag.label} imagePath not under branding/images`);
    const fsPath = join(process.cwd(), "public", decodeURIComponent(bag.imagePath));
    assert.ok(existsSync(fsPath), `image file missing for bag ${bag.label}: ${fsPath}`);
  }
});

test("PREV9. the real bag picker maps each bag label to a distinct existing artwork file", () => {
  const picker = readFileSync(
    join(process.cwd(), "components/inventory/PediatricBagPicker.tsx"),
    "utf8",
  );

  // The approved artwork filenames must each appear in the real picker, keyed by label.
  const expected: Record<string, string> = {
    A: "Pediatric%20Bag%20A%20Emergency%20Emblem.png",
    B: "Futuristic%20Pediatric%20Bag%20B%20Emblem.png",
    C: "Industrial%20Pediatric%20Bag%20C%20Emblem.png",
    D: "Industrial%20Pediatric%20bag%20d%20EMS%20Emblem.png",
  };

  for (const [label, file] of Object.entries(expected)) {
    assert.ok(picker.includes(`${label}: `), `picker missing label key ${label}`);
    assert.ok(picker.includes(file), `picker missing artwork for ${label}`);
    assert.ok(
      existsSync(join(process.cwd(), "public/branding/images", decodeURIComponent(file))),
      `artwork file missing on disk: ${file}`,
    );
  }
});
