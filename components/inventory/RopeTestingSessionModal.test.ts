import assert from "node:assert/strict";
import test from "node:test";

import { getFailedRowsMissingDeficiency } from "./RopeTestingSessionModal";

test("failed ropes without an active deficiency are identified", () => {
  const rows = [
    {
      id: "rope-1",
      ropeIdentifier: "R1",
      ropeName: "Primary rope",
      ropeType: "Life Safety",
      length: "50 ft",
      hasActiveDeficiency: false,
    },
    {
      id: "rope-2",
      ropeIdentifier: "R2",
      ropeName: "Reserve rope",
      ropeType: "Utility",
      length: "75 ft",
      hasActiveDeficiency: true,
    },
  ];

  const missingDeficiencies = getFailedRowsMissingDeficiency(rows, {
    "rope-1": "failed",
    "rope-2": "failed",
  });

  assert.deepEqual(missingDeficiencies.map((row) => row.id), ["rope-1"]);
});
