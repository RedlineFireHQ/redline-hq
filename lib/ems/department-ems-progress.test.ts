import assert from "node:assert/strict";
import test from "node:test";

import { buildDepartmentEmsProgressRows, groupEmsRecordsByMember } from "@/lib/ems/department-ems-progress";
import { buildMemberEmsProgress } from "@/lib/ems/member-ems-progress";
import type { DepartmentEmsTrackProfileRow } from "@/lib/ems/department-ems-progress";

function iowaProfile(memberId: string, overrides: Partial<DepartmentEmsTrackProfileRow> = {}): DepartmentEmsTrackProfileRow {
  return {
    member_id: memberId,
    track: "iowa",
    certification_level: "emt",
    track_status: "active",
    maintain_track: true,
    certification_number: `IA-${memberId}`,
    expiration_date: "2028-01-01",
    effective_start_date: "2026-01-01",
    effective_end_date: null,
    ...overrides,
  };
}

function nremtProfile(memberId: string, overrides: Partial<DepartmentEmsTrackProfileRow> = {}): DepartmentEmsTrackProfileRow {
  return { ...iowaProfile(memberId, overrides), track: "nremt", certification_number: `NR-${memberId}`, ...overrides };
}

const cardiologyEvent = (id: string, startsAt = "2026-06-01", hours = 3) => ({
  id,
  starts_at: startsAt,
  hours_credit: hours,
  is_ems_training: true,
  ems_core_topic: "cardiology",
  ems_needs_review: false,
});

test("builds one row per department member with per-member record grouping", () => {
  const rows = buildDepartmentEmsProgressRows({
    members: [
      { id: "m1", name: "Alex Able" },
      { id: "m2", name: "Blair Baker" },
      { id: "m3", name: "Casey Cole" },
    ],
    trackProfiles: [iowaProfile("m1"), iowaProfile("m2")],
    events: [cardiologyEvent("e1")],
    attendance: [
      { member_id: "m1", training_event_id: "e1" },
      { member_id: "m2", training_event_id: "e1" },
    ],
    outsideSubmissions: [
      { id: "o1", member_id: "m1", training_date: "2026-07-01", hours: 2, is_ems_training: true, ems_core_topic: "trauma", ems_needs_review: false },
    ],
  });

  assert.equal(rows.length, 3);
  const [m1, m2, m3] = rows;

  assert.equal(m1.memberName, "Alex Able");
  assert.equal(m1.hasAnyTracker, true);
  assert.equal(m1.emsReadiness.iowa.totalCompleted, 5); // 3 event + 2 outside

  assert.equal(m2.emsReadiness.iowa.totalCompleted, 3); // event only, no leakage of m1's outside record

  assert.equal(m3.hasAnyTracker, false);
  assert.equal(m3.emsReadiness.iowa.status, "not_configured");
});

test("outside submissions credit the owner and participants exactly once each", () => {
  const { outsideByMember } = groupEmsRecordsByMember({
    events: [],
    attendance: [],
    outsideSubmissions: [
      {
        id: "o1",
        member_id: "owner",
        training_date: "2026-07-01",
        hours: 2,
        is_ems_training: true,
        ems_core_topic: "medical",
        ems_needs_review: false,
        // The owner also appears as a participant row (mobile RPC behavior):
        // they must still only be credited once.
        participant_member_ids: ["owner", "participant"],
      },
    ],
  });

  assert.equal(outsideByMember.get("owner")?.length, 1);
  assert.equal(outsideByMember.get("participant")?.length, 1);
});

test("Iowa and National Registry cycles stay independent within a row", () => {
  const rows = buildDepartmentEmsProgressRows({
    members: [{ id: "m1", name: "Alex Able" }],
    trackProfiles: [
      iowaProfile("m1", { effective_start_date: "2026-01-01", expiration_date: "2028-01-01" }),
      nremtProfile("m1", { effective_start_date: "2024-01-01", expiration_date: "2026-12-31" }),
    ],
    events: [
      // Inside the NREMT cycle only (before the Iowa cycle starts).
      cardiologyEvent("early", "2025-06-01", 4),
      // Inside both cycles.
      cardiologyEvent("shared", "2026-06-01", 2),
    ],
    attendance: [
      { member_id: "m1", training_event_id: "early" },
      { member_id: "m1", training_event_id: "shared" },
    ],
    outsideSubmissions: [],
  });

  assert.equal(rows[0].emsReadiness.iowa.totalCompleted, 2);
  assert.ok(rows[0].emsReadiness.nremt.nationalComponentCompleted >= 6);
});

test("training outside a member's cycle is excluded from their row", () => {
  const rows = buildDepartmentEmsProgressRows({
    members: [{ id: "m1", name: "Alex Able" }],
    trackProfiles: [iowaProfile("m1", { effective_start_date: "2026-01-01", expiration_date: "2028-01-01" })],
    events: [cardiologyEvent("too-old", "2024-06-01", 8), cardiologyEvent("in-cycle", "2026-06-01", 3)],
    attendance: [
      { member_id: "m1", training_event_id: "too-old" },
      { member_id: "m1", training_event_id: "in-cycle" },
    ],
    outsideSubmissions: [],
  });

  assert.equal(rows[0].emsReadiness.iowa.totalCompleted, 3);
});

test("a tracker without dates reports Not Set Up in the overview", () => {
  const rows = buildDepartmentEmsProgressRows({
    members: [{ id: "m1", name: "Alex Able" }],
    trackProfiles: [iowaProfile("m1", { expiration_date: null })],
    events: [cardiologyEvent("e1")],
    attendance: [{ member_id: "m1", training_event_id: "e1" }],
    outsideSubmissions: [],
  });

  assert.equal(rows[0].hasAnyTracker, true);
  assert.equal(rows[0].emsReadiness.iowa.status, "not_configured");
  assert.equal(rows[0].emsReadiness.iowa.totalCompleted, 0);
});

test("rows contain only the members passed in — no cross-department leakage at the grouping layer", () => {
  const rows = buildDepartmentEmsProgressRows({
    members: [{ id: "m1", name: "Alex Able" }],
    trackProfiles: [iowaProfile("m1"), iowaProfile("other-dept-member")],
    events: [cardiologyEvent("e1")],
    attendance: [
      { member_id: "m1", training_event_id: "e1" },
      { member_id: "other-dept-member", training_event_id: "e1" },
    ],
    outsideSubmissions: [],
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].memberId, "m1");
});

test("the overview agrees exactly with the shared member progress calculation", () => {
  const events = [cardiologyEvent("e1"), cardiologyEvent("e2", "2026-08-01", 1.5)];
  const outside = [
    { id: "o1", member_id: "m1", training_date: "2026-07-01", hours: 2, is_ems_training: true, ems_core_topic: "trauma", ems_needs_review: false },
  ];

  const rows = buildDepartmentEmsProgressRows({
    members: [{ id: "m1", name: "Alex Able" }],
    trackProfiles: [iowaProfile("m1"), nremtProfile("m1")],
    events,
    attendance: events.map((event) => ({ member_id: "m1", training_event_id: event.id })),
    outsideSubmissions: outside,
  });

  const direct = buildMemberEmsProgress({
    iowaProfile: iowaProfile("m1"),
    nremtProfile: nremtProfile("m1"),
    events,
    outsideSubmissions: outside,
  });

  assert.deepEqual(rows[0].emsReadiness, direct.emsReadiness);
});
