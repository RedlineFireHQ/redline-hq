import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PEDIATRIC_INSPECTION_DISCLAIMER } from "@/components/inventory/InspectionDisclaimerDialog";

/**
 * Verify the pediatric preview disclaimer matches the apparatus inspection
 * disclaimer wording exactly, except for the asset noun ("apparatus" ->
 * "pediatric bag"). This guards against the preview drifting from the
 * established certification language.
 */

const APPARATUS_PAGE = readFileSync(
  join(__dirname, "../../app/apparatus/[id]/daily-check/page.tsx"),
  "utf8",
);

test("DISC1. apparatus source contains the canonical certification sentence", () => {
  assert.ok(
    APPARATUS_PAGE.includes(
      "you certify that you have inspected this apparatus according to your department",
    ),
    "apparatus disclaimer not found in source",
  );
  assert.ok(
    APPARATUS_PAGE.includes("Any deficiencies identified during the inspection have been reported."),
    "apparatus deficiency sentence not found",
  );
});

test("DISC2. pediatric disclaimer matches apparatus wording with only the asset noun changed", () => {
  const expectedApparatus =
    "By completing this inspection, you certify that you have inspected this apparatus according to your department's inspection procedures. Any deficiencies identified during the inspection have been reported.";

  // Normalizing the pediatric asset noun back to "apparatus" must reproduce the
  // exact apparatus sentence.
  const normalized = PEDIATRIC_INSPECTION_DISCLAIMER.replace("this pediatric bag", "this apparatus");
  assert.equal(normalized, expectedApparatus);
});

test("DISC3. pediatric disclaimer is addressed to the pediatric bag", () => {
  assert.ok(PEDIATRIC_INSPECTION_DISCLAIMER.includes("this pediatric bag"));
  assert.ok(PEDIATRIC_INSPECTION_DISCLAIMER.includes("deficiencies identified during the inspection have been reported"));
});
