import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

/**
 * Models the participant-aware crediting the fixed pages now rely on:
 * a member is credited for an approved submission when they are the submitter
 * OR a selected participant, counted exactly once per submission id.
 *
 * This mirrors the behavior of get_member_training_outside_submissions, which
 * returns a submission when (s.member_id = member) OR (member is in
 * training_outside_submission_members). The set-based dedup is what guarantees
 * the submitter is never double-counted when they are also a participant.
 */

type Submission = { id: string; submitterId: string; participantIds: string[]; hours: number; status: string };

function creditedSubmissionsFor(memberId: string, submissions: Submission[]): Submission[] {
  // Participant-aware membership check with dedup by submission id.
  const seen = new Set<string>();
  const credited: Submission[] = [];
  for (const s of submissions) {
    if (s.status !== "approved") continue;
    const isSubmitter = s.submitterId === memberId;
    const isParticipant = s.participantIds.includes(memberId);
    if ((isSubmitter || isParticipant) && !seen.has(s.id)) {
      seen.add(s.id);
      credited.push(s);
    }
  }
  return credited;
}

function totalHoursFor(memberId: string, submissions: Submission[]): number {
  return creditedSubmissionsFor(memberId, submissions).reduce((t, s) => t + s.hours, 0);
}

const LOREN = "loren";
const ADAM = "adam";
const RONALD = "ronald";
const OTHER = "other";

const pumpTraining: Submission = {
  id: "24e982fd",
  submitterId: LOREN,
  participantIds: [ADAM, RONALD, LOREN], // participants incl. submitter, as stored
  hours: 2.0,
  status: "approved",
};

test("Submitter (Loren) is credited exactly 2.00, not double-counted", () => {
  const credited = creditedSubmissionsFor(LOREN, [pumpTraining]);
  assert.equal(credited.length, 1);
  assert.equal(totalHoursFor(LOREN, [pumpTraining]), 2.0);
});

test("Selected participant (Adam) receives the training", () => {
  assert.equal(totalHoursFor(ADAM, [pumpTraining]), 2.0);
});

test("Selected participant (Ronald) receives the training", () => {
  assert.equal(totalHoursFor(RONALD, [pumpTraining]), 2.0);
});

test("Unselected member receives no credit", () => {
  assert.equal(totalHoursFor(OTHER, [pumpTraining]), 0);
});

test("A member who is both submitter and participant is counted once (dedup)", () => {
  // Submitter also listed as a participant (as in the real data) must not double-count.
  const both: Submission = { id: "x1", submitterId: ADAM, participantIds: [ADAM], hours: 3, status: "approved" };
  assert.equal(totalHoursFor(ADAM, [both]), 3);
});

test("Pending (not approved) submissions grant no credit", () => {
  const pending: Submission = { ...pumpTraining, status: "pending_review" };
  assert.equal(totalHoursFor(ADAM, [pending]), 0);
  assert.equal(totalHoursFor(LOREN, [pending]), 0);
});

test("Two distinct submissions each credit their own participants", () => {
  const second: Submission = { id: "y2", submitterId: ADAM, participantIds: [RONALD], hours: 1.5, status: "approved" };
  assert.equal(totalHoursFor(LOREN, [pumpTraining, second]), 2.0); // only pumpTraining
  assert.equal(totalHoursFor(ADAM, [pumpTraining, second]), 2.0 + 1.5); // participant in first, submitter in second
  assert.equal(totalHoursFor(RONALD, [pumpTraining, second]), 2.0 + 1.5); // participant in both
});

// --- Integration guards: verify each affected page actually uses the participant-aware
// mechanism. These read the real page source and assert the integration, so a regression
// that reverts to a member-only query fails. (Follows the repo's migration-file assertion
// convention: readFileSync + targeted assertions on the real source.)

const personnelSrc = readFileSync(resolve(process.cwd(), "app/personnel/[id]/page.tsx"), "utf8");
const myReadinessSrc = readFileSync(resolve(process.cwd(), "components/command-center-v3/MyReadinessPanel.tsx"), "utf8");
const trainingPanelSrc = readFileSync(resolve(process.cwd(), "components/command-center-v3/TrainingPanel.tsx"), "utf8");

test("Personnel profile credits participants via the join table (not just submitter)", () => {
  // The Personnel page must include submissions where the viewed member is a selected
  // participant, by joining/loading training_outside_submission_members for that member.
  assert.match(personnelSrc, /training_outside_submission_members/);
  // And it must still load the member's own submitted (member_id) rows.
  assert.match(personnelSrc, /\.eq\("member_id", id\)/);
});

test("My Readiness panel uses the participant-aware RPC", () => {
  assert.match(myReadinessSrc, /rpc\("get_member_training_outside_submissions"/);
});

test("Training panel uses the participant-aware RPC", () => {
  assert.match(trainingPanelSrc, /rpc\("get_member_training_outside_submissions"/);
});

test("All participant-credit paths filter to approved submissions only", () => {
  // Each source must restrict to approved results so pending/rejected never count.
  assert.match(personnelSrc, /\.eq\("status", "approved"\)/);
  assert.match(myReadinessSrc, /status === "approved"/);
  assert.match(trainingPanelSrc, /status === "approved"/);
});
