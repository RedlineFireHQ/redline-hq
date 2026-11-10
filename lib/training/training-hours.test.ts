import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMemberTrainingHoursRecords,
  calculateDepartmentTrainingMemberHours,
  isDateKeyInCalendarYear,
  summarizeTrainingHours,
  toTrainingDateKey,
} from "@/lib/training/training-hours";
import { getTrainingComplianceBucketByCategoryId } from "@/lib/training/compliance-buckets";

const CATEGORIES = [
  { id: "cat-fire", name: "Fire Suppression", compliance_bucket: "fire_annual" },
  { id: "cat-misc", name: "Miscellaneous", compliance_bucket: "other" },
  { id: "cat-ems", name: "EMS", compliance_bucket: "ems_ce" },
  { id: "cat-extrication", name: "Vehicle Extrication", compliance_bucket: null },
];

test("date keys parse and compare by calendar year", () => {
  assert.equal(toTrainingDateKey("2026-11-10"), "2026-11-10");
  assert.equal(toTrainingDateKey("2026-11-10T15:05:40+00:00"), "2026-11-10");
  assert.equal(toTrainingDateKey(null), null);
  assert.equal(toTrainingDateKey("junk"), null);
  assert.equal(isDateKeyInCalendarYear("2026-01-01", 2026), true);
  assert.equal(isDateKeyInCalendarYear("2025-12-31", 2026), false);
  assert.equal(isDateKeyInCalendarYear(null, 2026), false);
});

test("explicit compliance mapping wins over keyword fallback and keyword fallback still applies", () => {
  const nameById = new Map(CATEGORIES.map((c) => [c.id, c.name]));
  const bucketById = new Map(CATEGORIES.map((c) => [c.id, c.compliance_bucket]));

  assert.equal(getTrainingComplianceBucketByCategoryId("cat-fire", nameById, bucketById), "fire_annual");
  assert.equal(getTrainingComplianceBucketByCategoryId("cat-misc", nameById, bucketById), "other");
  assert.equal(getTrainingComplianceBucketByCategoryId("cat-ems", nameById, bucketById), "ems_ce");
  // Unclassified category falls back to the keyword matcher ("Vehicle Extrication" -> other).
  assert.equal(getTrainingComplianceBucketByCategoryId("cat-extrication", nameById, bucketById), "other");
  // Explicit reclassification: an admin marks Vehicle Extrication as Fire.
  const reclassified = new Map(bucketById);
  reclassified.set("cat-extrication", "fire_annual");
  assert.equal(getTrainingComplianceBucketByCategoryId("cat-extrication", nameById, reclassified), "fire_annual");
});

// Regression: Adam's 2026 records. Desktop My Readiness showed 19 "Fire" hours
// (Miscellaneous misclassified as Fire via the is_ems_training flag), mobile
// showed 11 (all-time keyword buckets), desktop Command Center 9. The shared
// ledger yields one consistent answer for the same inputs.
const adamInput = {
  attendanceRows: [
    { training_event_id: "evt-fire-1" },
    { training_event_id: "evt-fire-2" },
    { training_event_id: "evt-fire-3" },
    { training_event_id: "evt-extrication" },
  ],
  events: [
    { id: "evt-fire-1", category_id: "cat-fire", hours_credit: 3, starts_at: "2026-03-01T18:00:00+00:00" },
    { id: "evt-fire-2", category_id: "cat-fire", hours_credit: 3, starts_at: "2026-05-01T18:00:00+00:00" },
    { id: "evt-fire-3", category_id: "cat-fire", hours_credit: 3, starts_at: "2026-07-01T18:00:00+00:00" },
    { id: "evt-extrication", category_id: "cat-extrication", hours_credit: 6, starts_at: "2026-08-01T18:00:00+00:00" },
  ],
  outsideSubmissions: [
    // Adam's two Miscellaneous self-reports from this morning (owner records).
    { id: "sub-pipeline", category_id: "cat-misc", hours: 1, training_date: "2026-11-10", status: "approved" },
    { id: "sub-test", category_id: "cat-misc", hours: 1, training_date: "2026-11-10", status: "approved" },
    // Loren's Pump Training where Adam is a credited participant (RPC row).
    { id: "sub-pump", category_id: "cat-fire", hours: 2, training_date: "2026-10-15", status: "approved" },
    // Noise that must never count:
    { id: "sub-pending", category_id: "cat-misc", hours: 5, training_date: "2026-11-01", status: "pending_review" },
    { id: "sub-rejected", category_id: "cat-fire", hours: 5, training_date: "2026-11-01", status: "rejected" },
    { id: "sub-last-year", category_id: "cat-fire", hours: 5, training_date: "2025-06-01", status: "approved" },
  ],
  assignments: [],
  assignmentMembers: [],
  categories: CATEGORIES,
  calendarYear: 2026,
};

test("regression: one consistent member summary for Adam's records", () => {
  const records = buildMemberTrainingHoursRecords(adamInput);
  const summary = summarizeTrainingHours(records);

  // Every approved current-year record counts toward total: 9 + 6 + 1 + 1 + 2 = 19.
  assert.equal(summary.totalHours, 19);
  // Fire compliance hours: Fire Suppression events (9) + Pump Training participant credit (2).
  assert.equal(summary.fireHours, 11);
  assert.equal(summary.emsHours, 0);
  // Miscellaneous (2) keeps its identity in Other, plus unclassified Vehicle Extrication (6).
  assert.equal(summary.otherHours, 8);

  // Categories retain their identity.
  const byName = new Map(summary.byCategory.map((row) => [row.categoryName, row.hours]));
  assert.equal(byName.get("Fire Suppression"), 11);
  assert.equal(byName.get("Vehicle Extrication"), 6);
  assert.equal(byName.get("Miscellaneous"), 2);
});

test("pending and rejected records never count; prior years are excluded from the labeled year", () => {
  const records = buildMemberTrainingHoursRecords(adamInput);
  assert.equal(records.some((row) => row.id === "outside-sub-pending"), false);
  assert.equal(records.some((row) => row.id === "outside-sub-rejected"), false);
  assert.equal(records.some((row) => row.id === "outside-sub-last-year"), false);

  const lifetime = buildMemberTrainingHoursRecords({ ...adamInput, calendarYear: null });
  assert.equal(lifetime.some((row) => row.id === "outside-sub-last-year"), true);
  assert.equal(lifetime.some((row) => row.id === "outside-sub-pending"), false);
});

test("hours are never double-counted when duplicate rows appear", () => {
  const records = buildMemberTrainingHoursRecords({
    ...adamInput,
    // Duplicate attendance rows and duplicate submission rows (e.g. a member who
    // is both owner and listed participant arrives once per RPC, but guard anyway).
    attendanceRows: [...adamInput.attendanceRows, { training_event_id: "evt-fire-1" }],
    outsideSubmissions: [...adamInput.outsideSubmissions, adamInput.outsideSubmissions[0]],
  });
  const summary = summarizeTrainingHours(records);
  assert.equal(summary.totalHours, 19);
});

test("department member-hours credit every attendee and every distinct submission participant once", () => {
  const total = calculateDepartmentTrainingMemberHours({
    events: adamInput.events,
    attendanceRows: [
      // Two members attending the same 3-hour event -> 6 member-hours.
      { training_event_id: "evt-fire-1", attendance_status: "attending" },
      { training_event_id: "evt-fire-1", attendance_status: "attending" },
      { training_event_id: "evt-fire-2", attendance_status: "attending" },
      // Non-attending statuses never count.
      { training_event_id: "evt-fire-3", attendance_status: "absent" },
    ],
    outsideSubmissions: [
      // Owner Loren + participants Adam and Brandon, with Loren also duplicated
      // in the participant list (mobile RPC inserts the owner there): 2 hrs x 3 distinct members.
      { id: "sub-pump", member_id: "loren", training_date: "2026-10-15", hours: 2, status: "approved" },
      // Pending/rejected/off-year must not count.
      { id: "sub-pending", member_id: "bob", training_date: "2026-11-01", hours: 5, status: "pending_review" },
      { id: "sub-last-year", member_id: "bob", training_date: "2025-06-01", hours: 5, status: "approved" },
    ],
    outsideParticipants: [
      { submission_id: "sub-pump", member_id: "loren" },
      { submission_id: "sub-pump", member_id: "adam" },
      { submission_id: "sub-pump", member_id: "brandon" },
    ],
    assignments: [],
    assignmentMembers: [],
    calendarYear: 2026,
  });

  assert.equal(total, 3 + 3 + 3 + 2 * 3);
});

test("department isolation: calculations only ever see rows for one department", () => {
  // The ledger is a pure function over department-scoped query results; passing
  // another department's rows is the only way to mix data. Verify that a grant
  // of hours in one input never leaks into a separate department's input.
  const deptA = buildMemberTrainingHoursRecords(adamInput);
  const deptB = buildMemberTrainingHoursRecords({
    attendanceRows: [],
    events: [],
    outsideSubmissions: [],
    assignments: [],
    assignmentMembers: [],
    categories: [],
    calendarYear: 2026,
  });
  assert.equal(summarizeTrainingHours(deptA).totalHours, 19);
  assert.equal(summarizeTrainingHours(deptB).totalHours, 0);
});
