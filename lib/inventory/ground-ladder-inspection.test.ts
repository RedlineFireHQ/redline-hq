import assert from "node:assert/strict";
import test from "node:test";

import { buildGroundLadderInspectionNotes, getGroundLadderInspectionDateFromNotes } from "./ground-ladder-inspection";

test("ground ladder inspection records always include a parseable completion stamp even with no inspection notes", () => {
  const timestamp = new Date("2026-09-06T16:33:11-05:00");

  const notes = buildGroundLadderInspectionNotes({
    existingNotes: "Existing ladder note",
    helperSummary: "Inspection helpers: C. Jones.",
    checklistSummary: "Checklist review: beams-and-rails:pass; rungs:pass.",
    inspectionNotes: "",
    result: "ready",
    timestamp,
  });

  assert.match(notes, /Inspection \(9\/6\/2026, 4:33:11 PM\): Ready for Duty\./i, "Inspection notes should always include a parseable completion stamp");
  assert.equal(getGroundLadderInspectionDateFromNotes(notes), "2026-09-06");
});
