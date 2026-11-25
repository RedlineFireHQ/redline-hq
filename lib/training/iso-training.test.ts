import assert from "node:assert/strict";
import test from "node:test";
import { calculateIsoMemberHours, facilityQualifiesForIso, getFacilityIsoCreditLevel, normalizeIsoClassifications } from "@/lib/training/iso-training";

test("ISO facility qualification applies the supplied tower, burn-building, and yard thresholds", () => {
  assert.equal(facilityQualifiesForIso({ facility_type: "drill_tower", ownership_type: "department_owned", tower_stories: 2, yard_acres: null, purpose_built_live_fire: false, formal_agreement: false, agreement_reference: null }), true);
  assert.equal(facilityQualifiesForIso({ facility_type: "drill_tower", ownership_type: "department_owned", tower_stories: 1, yard_acres: null, purpose_built_live_fire: false, formal_agreement: false, agreement_reference: null }), false);
  assert.equal(facilityQualifiesForIso({ facility_type: "live_fire_burn_building", ownership_type: "department_owned", tower_stories: null, yard_acres: null, purpose_built_live_fire: true, formal_agreement: false, agreement_reference: null }), true);
  assert.equal(facilityQualifiesForIso({ facility_type: "live_fire_burn_building", ownership_type: "department_owned", tower_stories: null, yard_acres: null, purpose_built_live_fire: false, formal_agreement: false, agreement_reference: null }), false);
  assert.equal(facilityQualifiesForIso({ facility_type: "training_yard", ownership_type: "department_owned", tower_stories: null, yard_acres: 2, purpose_built_live_fire: false, formal_agreement: false, agreement_reference: null }), true);
  assert.equal(facilityQualifiesForIso({ facility_type: "training_yard", ownership_type: "department_owned", tower_stories: null, yard_acres: 1.9, purpose_built_live_fire: false, formal_agreement: false, agreement_reference: null }), false);
});

test("two-story towers are partial credit and three-story towers are full credit", () => {
  const base = { ownership_type: "department_owned", yard_acres: null, purpose_built_live_fire: false, formal_agreement: false, agreement_reference: null };
  assert.equal(getFacilityIsoCreditLevel({ ...base, facility_type: "drill_tower", tower_stories: 2 }), "partial");
  assert.equal(getFacilityIsoCreditLevel({ ...base, facility_type: "drill_tower", tower_stories: 3 }), "full");
});

test("outside facility agreements must be valid on the training date", () => {
  const facility = {
    facility_type: "drill_tower",
    ownership_type: "neighboring_department",
    tower_stories: 3,
    yard_acres: null,
    purpose_built_live_fire: false,
    formal_agreement: true,
    agreement_reference: "MOU 2026",
    agreement_start_date: "2026-01-01",
    agreement_end_date: "2026-12-31",
  };
  assert.equal(getFacilityIsoCreditLevel(facility, "2026-06-01"), "full");
  assert.equal(getFacilityIsoCreditLevel(facility, "2027-01-01"), "none");
});

test("neighboring and regional facilities require a formal agreement reference", () => {
  const base = { facility_type: "drill_tower", tower_stories: 3, yard_acres: null, purpose_built_live_fire: false };
  assert.equal(facilityQualifiesForIso({ ...base, ownership_type: "neighboring_department", formal_agreement: false, agreement_reference: null }), false);
  assert.equal(facilityQualifiesForIso({ ...base, ownership_type: "neighboring_department", formal_agreement: true, agreement_reference: "MOU 2026" }), true);
  assert.equal(facilityQualifiesForIso({ facility_type: "regional_academy", ownership_type: "regional_academy", tower_stories: null, yard_acres: null, purpose_built_live_fire: false, formal_agreement: true, agreement_reference: "Regional Training Agreement" }), true);
});

test("ISO classifications are normalized, de-duplicated, and ignore unknown values", () => {
  assert.deepEqual(normalizeIsoClassifications(["hazmat", "company_training", "hazmat", "unknown"]), ["hazmat", "company_training"]);
});

test("one completed event can feed multiple ISO categories, but non-qualifying facilities never earn facility hours", () => {
  const totals = calculateIsoMemberHours({
    year: 2026,
    events: [
      { id: "qualified", status: "completed", starts_at: "2026-04-01T18:00:00.000Z", hours_credit: 3, iso_classifications: ["training_facilities", "company_training"], iso_qualifying_facility: true },
      { id: "station", status: "completed", starts_at: "2026-04-02T18:00:00.000Z", hours_credit: 2, iso_classifications: ["training_facilities", "company_training"], iso_qualifying_facility: false },
      { id: "scheduled", status: "scheduled", starts_at: "2026-04-03T18:00:00.000Z", hours_credit: 4, iso_classifications: ["company_training"], iso_qualifying_facility: false },
    ],
    attendance: [
      { training_event_id: "qualified", member_id: "member-1", attendance_status: "attending", hours_earned: null },
      { training_event_id: "station", member_id: "member-1", attendance_status: "attending", hours_earned: null },
      { training_event_id: "scheduled", member_id: "member-1", attendance_status: "attending", hours_earned: null },
    ],
  });
  assert.equal(totals.get("member-1")?.training_facilities, 3);
  assert.equal(totals.get("member-1")?.company_training, 5);
});
