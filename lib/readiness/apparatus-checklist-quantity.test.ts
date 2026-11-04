import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

for (const [file, expression] of [
  ["components/apparatus/ApparatusChecklistWorkspace.tsx", /Qty: \{item\.requiredQuantity\}/],
  ["components/mobile/MobileApparatusCheck.tsx", /Qty: \{item\.requiredQuantity\}/],
  ["app/apparatus/[id]/daily-check/checklist/page.tsx", /requiredQuantity: row\.required_quantity/],
  ["app/mobile/apparatus-checks/[id]/page.tsx", /requiredQuantity: row\.required_quantity/],
] as const) {
  test(`textual quantities are preserved in ${file}`, () => {
    const source = readFileSync(join(process.cwd(), file), "utf8");
    assert.match(source, expression);
    assert.doesNotMatch(source, /(?:parseInt|parseFloat|Number)\(row\.required_quantity/);
  });
}
