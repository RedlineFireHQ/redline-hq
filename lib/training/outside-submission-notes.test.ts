import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOutsideSubmissionNotes,
  parseOutsideSubmissionNotes,
} from "@/lib/training/outside-submission-notes";

test("round trip: what either app writes, the desktop display can read back", () => {
  const notes = buildOutsideSubmissionNotes({
    trainingMethod: "Hands-On | Classroom",
    instructorName: "Capt. Loren Taylor",
    location: "Station 2",
  });

  assert.equal(notes, "Method: Hands-On | Classroom\nInstructor: Capt. Loren Taylor\nLocation: Station 2");

  const parsed = parseOutsideSubmissionNotes(notes);
  assert.equal(parsed.trainingMethod, "Hands-On | Classroom");
  assert.equal(parsed.instructorName, "Capt. Loren Taylor");
  assert.equal(parsed.location, "Station 2");
});

test("partial details survive: missing fields stay null instead of blanking others", () => {
  const notes = buildOutsideSubmissionNotes({ trainingMethod: "", instructorName: "", location: "Training Grounds" });
  assert.equal(notes, "Location: Training Grounds");

  const parsed = parseOutsideSubmissionNotes(notes);
  assert.equal(parsed.trainingMethod, null);
  assert.equal(parsed.instructorName, null);
  assert.equal(parsed.location, "Training Grounds");
});

test("empty input produces null notes and parses to empty details", () => {
  assert.equal(buildOutsideSubmissionNotes({ trainingMethod: " ", instructorName: "", location: "" }), null);

  for (const value of [null, undefined, "", "   "]) {
    const parsed = parseOutsideSubmissionNotes(value);
    assert.equal(parsed.trainingMethod, null);
    assert.equal(parsed.instructorName, null);
    assert.equal(parsed.location, null);
  }
});

test("historical mobile-format notes parse correctly (regression for blank desktop fields)", () => {
  // Exact shape the mobile form produced before the shared builder existed.
  const historicalMobileNotes = [
    "Method: Hands-On",
    "Instructor: Chief Adams",
    "Location: Cedar Bluff Station 1",
  ].join("\n");

  const parsed = parseOutsideSubmissionNotes(historicalMobileNotes);
  assert.equal(parsed.trainingMethod, "Hands-On");
  assert.equal(parsed.instructorName, "Chief Adams");
  assert.equal(parsed.location, "Cedar Bluff Station 1");
});

test("values containing colons are preserved intact", () => {
  const parsed = parseOutsideSubmissionNotes("Location: Station 4: North Bay\nInstructor: Lt. Smith: FTO");
  assert.equal(parsed.location, "Station 4: North Bay");
  assert.equal(parsed.instructorName, "Lt. Smith: FTO");
});

test("unknown or malformed lines are ignored without losing known fields", () => {
  const parsed = parseOutsideSubmissionNotes(
    "Random free text\nMethod: Online\nSomething else entirely\n: no key\nInstructor: Bob",
  );
  assert.equal(parsed.trainingMethod, "Online");
  assert.equal(parsed.instructorName, "Bob");
  assert.equal(parsed.location, null);
});

test("only the first occurrence of a key wins (user text cannot override)", () => {
  const parsed = parseOutsideSubmissionNotes("Instructor: Real Instructor\nInstructor: Fake Override");
  assert.equal(parsed.instructorName, "Real Instructor");
});
