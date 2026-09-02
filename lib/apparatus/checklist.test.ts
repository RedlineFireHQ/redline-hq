import assert from "node:assert/strict";
import test from "node:test";

import {
  getChecklistProgress,
  isChecklistSubmissionAllowed,
  isChecklistStatusComplete,
  type ApparatusChecklistItem,
  type ApparatusChecklistProgressRow,
} from "@/lib/apparatus/checklist";

const ITEMS: ApparatusChecklistItem[] = [
  { id: "i1", isRequired: true },
  { id: "i2", isRequired: true },
  { id: "i3", isRequired: false },
];

test("Checklist status complete supports checked/deficiency/not_applicable", () => {
  assert.equal(isChecklistStatusComplete("checked"), true);
  assert.equal(isChecklistStatusComplete("deficiency"), true);
  assert.equal(isChecklistStatusComplete("not_applicable"), true);
  assert.equal(isChecklistStatusComplete(null), false);
});

test("Checklist progress counts required completion only", () => {
  const rows: ApparatusChecklistProgressRow[] = [
    { checklistItemId: "i1", status: "checked" },
    { checklistItemId: "i3", status: "deficiency" },
  ];

  const progress = getChecklistProgress(ITEMS, rows);
  assert.equal(progress.requiredCount, 2);
  assert.equal(progress.completedRequired, 1);
  assert.equal(progress.remainingRequired, 1);
});

test("Checklist required OFF does not block submission", () => {
  const allowed = isChecklistSubmissionAllowed({
    requireChecklist: false,
    items: ITEMS,
    progressRows: [],
  });

  assert.equal(allowed, true);
});

test("Checklist required ON blocks until all required items complete", () => {
  const incomplete = isChecklistSubmissionAllowed({
    requireChecklist: true,
    items: ITEMS,
    progressRows: [{ checklistItemId: "i1", status: "checked" }],
  });
  assert.equal(incomplete, false);

  const complete = isChecklistSubmissionAllowed({
    requireChecklist: true,
    items: ITEMS,
    progressRows: [
      { checklistItemId: "i1", status: "checked" },
      { checklistItemId: "i2", status: "not_applicable" },
    ],
  });
  assert.equal(complete, true);
});

test("Checklist required ON blocks when no required items configured", () => {
  const allowed = isChecklistSubmissionAllowed({
    requireChecklist: true,
    items: [],
    progressRows: [],
  });

  assert.equal(allowed, false);
});
