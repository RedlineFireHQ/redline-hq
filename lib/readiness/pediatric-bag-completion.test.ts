import test from "node:test";
import assert from "node:assert/strict";

import {
  countExpiredItems,
  countUnresolvedQuantityItems,
  evaluatePediatricCompletion,
  isCompletedItemStatus,
  isConfirmedRequiredItem,
  isUnresolvedQuantityItem,
  isValidFinalStatus,
  type PediatricProgressEntry,
  type PediatricTemplateItem,
} from "./pediatric-bag-completion";

/**
 * Behavioral tests for the pediatric bag completion gating rules. Unlike the
 * static SQL-assertion suite, these exercise the actual decision logic against
 * realistic template + progress data for every final-status scenario.
 */

function confirmedItem(overrides: Partial<PediatricTemplateItem> = {}): PediatricTemplateItem {
  return { requiredQuantity: 1, isRequired: true, isActive: true, ...overrides };
}

function unresolvedItem(overrides: Partial<PediatricTemplateItem> = {}): PediatricTemplateItem {
  return { requiredQuantity: null, isRequired: true, isActive: true, ...overrides };
}

function progressFor(
  items: PediatricTemplateItem[],
  status: PediatricProgressEntry["status"] = "checked",
): PediatricProgressEntry[] {
  return items.map((item) => ({ item, status }));
}

// A template exercising the unresolved-quantity safeguard generically. The
// current Red Oak inventory has no unresolved items (Alcohol Preps are confirmed
// at quantity 10), but the gate must still block a false "ready" if any future
// required item has an unconfirmed quantity. These tests exercise that safeguard.
function fullTemplate(): PediatricTemplateItem[] {
  return [
    ...Array.from({ length: 85 }, () => confirmedItem()),
    unresolvedItem(), // hypothetical unresolved item — IV Kit #1
    unresolvedItem(), // hypothetical unresolved item — IV Kit #2
  ];
}

test("PGATE1. 'ready' is refused while Alcohol Preps quantities remain unresolved", () => {
  const template = fullTemplate();
  const progress = progressFor(template.filter(isConfirmedRequiredItem), "checked");

  const decision = evaluatePediatricCompletion({ finalStatus: "ready", templateItems: template, progress });

  assert.equal(decision.allowed, false);
  if (!decision.allowed) {
    assert.match(decision.reason, /unconfirmed quantity pending review/);
  }
});

test("PGATE2. 'needs_attention' (Needs Review) is allowed with unresolved Alcohol Preps", () => {
  const template = fullTemplate();
  const progress = progressFor(template.filter(isConfirmedRequiredItem), "checked");

  const decision = evaluatePediatricCompletion({ finalStatus: "needs_attention", templateItems: template, progress });

  assert.equal(decision.allowed, true);
});

test("PGATE3. 'out_of_service' is allowed with unresolved Alcohol Preps", () => {
  const template = fullTemplate();
  const progress = progressFor(template.filter(isConfirmedRequiredItem), "checked");

  const decision = evaluatePediatricCompletion({ finalStatus: "out_of_service", templateItems: template, progress });

  assert.equal(decision.allowed, true);
});

test("PGATE4. 'ready' is allowed once all quantities are confirmed and all items checked", () => {
  const template = Array.from({ length: 87 }, () => confirmedItem()); // Alcohol Preps resolved -> confirmed
  const progress = progressFor(template, "checked");

  const decision = evaluatePediatricCompletion({ finalStatus: "ready", templateItems: template, progress });

  assert.equal(decision.allowed, true);
});

test("PGATE5. 'ready' is refused when a confirmed item is marked EXPIRED", () => {
  const template = Array.from({ length: 87 }, () => confirmedItem());
  const progress = progressFor(template, "checked");
  progress[10] = { item: template[10], status: "expired" };

  const decision = evaluatePediatricCompletion({ finalStatus: "ready", templateItems: template, progress });

  assert.equal(decision.allowed, false);
  if (!decision.allowed) {
    assert.match(decision.reason, /marked as expired/);
  }
});

test("PGATE6. 'needs_attention' is allowed when an item is EXPIRED", () => {
  const template = Array.from({ length: 87 }, () => confirmedItem());
  const progress = progressFor(template, "checked");
  progress[10] = { item: template[10], status: "expired" };

  const decision = evaluatePediatricCompletion({ finalStatus: "needs_attention", templateItems: template, progress });

  assert.equal(decision.allowed, true);
});

test("PGATE7. completion with some items unchecked is allowed (recorded as needs_attention)", () => {
  const template = Array.from({ length: 87 }, () => confirmedItem());
  const progress = progressFor(template.slice(0, 80), "checked"); // 7 items unmarked

  // An admin may complete a check even when some items remain unchecked; the
  // honest non-ready outcome (needs_attention) is allowed.
  const decision = evaluatePediatricCompletion({ finalStatus: "needs_attention", templateItems: template, progress });

  assert.equal(decision.allowed, true);
});

test("PGATE7b. 'ready' is still refused when some required items are unchecked", () => {
  const template = Array.from({ length: 87 }, () => confirmedItem());
  const progress = progressFor(template.slice(0, 86), "checked"); // one item unmarked

  const decision = evaluatePediatricCompletion({ finalStatus: "ready", templateItems: template, progress });

  assert.equal(decision.allowed, false);
  if (!decision.allowed) {
    assert.match(decision.reason, /Complete all required checklist items/);
  }
});

test("PGATE8. completion is refused when no confirmed-quantity required items exist", () => {
  const template = [unresolvedItem(), unresolvedItem()]; // everything unresolved
  const decision = evaluatePediatricCompletion({ finalStatus: "needs_attention", templateItems: template, progress: [] });

  assert.equal(decision.allowed, false);
  if (!decision.allowed) {
    assert.match(decision.reason, /No active required checklist items with confirmed quantities/);
  }
});

test("PGATE9. invalid final statuses are rejected without touching other rules", () => {
  const template = fullTemplate();
  const progress = progressFor(template.filter(isConfirmedRequiredItem), "checked");

  for (const bad of ["", "READY", "complete", "needs-review", "partial", "ready "]) {
    const decision = evaluatePediatricCompletion({ finalStatus: bad, templateItems: template, progress });
    assert.equal(decision.allowed, false, `should reject status: "${bad}"`);
    if (!decision.allowed) {
      assert.match(decision.reason, /Invalid final inspection status/);
    }
  }
});

test("PGATE10. all three valid final statuses are accepted by the validator", () => {
  assert.equal(isValidFinalStatus("ready"), true);
  assert.equal(isValidFinalStatus("needs_attention"), true);
  assert.equal(isValidFinalStatus("out_of_service"), true);
  assert.equal(isValidFinalStatus("needs_review"), false); // item-level only, not a final status
});

test("PGATE11. inactive or optional items do not block completion", () => {
  const template = [
    ...Array.from({ length: 86 }, () => confirmedItem()),
    confirmedItem({ isActive: false }),   // archived item — must not gate
    confirmedItem({ isRequired: false }), // optional — must not gate
  ];
  const progress = progressFor(template.filter(isConfirmedRequiredItem), "checked");

  const decision = evaluatePediatricCompletion({ finalStatus: "ready", templateItems: template, progress });

  assert.equal(decision.allowed, true);
});

test("PGATE12. unresolved counting only counts active required NULL-quantity items", () => {
  const items = [
    unresolvedItem(),                          // counts
    unresolvedItem({ isActive: false }),       // archived — no
    unresolvedItem({ isRequired: false }),     // optional — no
    confirmedItem(),                           // confirmed — no
  ];
  assert.equal(countUnresolvedQuantityItems(items), 1);
  assert.equal(countUnresolvedQuantityItems(fullTemplate()), 2); // two hypothetical unresolved items
});

test("PGATE13. item-status helpers match the completion gate semantics", () => {
  assert.equal(isCompletedItemStatus("checked"), true);   // PASS counts
  assert.equal(isCompletedItemStatus("expired"), true);   // EXPIRED counts (documented)
  assert.equal(isCompletedItemStatus(null), false);       // unmarked never counts
  assert.equal(countExpiredItems(progressFor([confirmedItem(), confirmedItem()], "expired")), 2);
});
