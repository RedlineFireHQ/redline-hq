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

  assert.ok(
    notes.includes(`Inspection (${timestamp.toLocaleString("en-US")}): Ready for Duty.`),
    "Inspection notes should include the completion stamp in the runtime's local timezone",
  );
  const completionStamp = notes.match(/Inspection \(([^)]+)\): Ready for Duty\./)?.[1];
  assert.ok(completionStamp, "Inspection notes should always include a parseable completion stamp");
  assert.equal(new Date(completionStamp).getTime(), timestamp.getTime(), "The completion stamp must preserve the actual instant");
  assert.equal(getGroundLadderInspectionDateFromNotes(notes), "2026-09-06");
});
