import assert from "node:assert/strict";
import test from "node:test";

import { calculateEmsReadiness, computeCyclePacing, isTrackFullyConfigured, type EmsTrackProfileInput } from "@/lib/ems/calculation";
import { buildMemberEmsProgress } from "@/lib/ems/member-ems-progress";

const NOW = new Date("2026-11-10T12:00:00");

function emtProfile(overrides: Partial<EmsTrackProfileInput> = {}): EmsTrackProfileInput {
  return {
    level: "emt",
    status: "active",
    expirationDate: "2027-03-31",
    cycleStartDate: "2025-03-31",
    maintainTrack: true,
    ...overrides,
  };
}

function cardiologyHours(hours: number, occurredAt = "2026-06-01") {
  return [{
    id: `cardio-${hours}-${occurredAt}`,
    occurredAt,
    hours,
    coreTopic: "cardiology" as const,
    needsReview: false,
    eligibleForIowa: true,
    eligibleForNremt: true,
  }];
}

test("a tracker without an expiration date is Not Set Up, never On Track", () => {
  const result = calculateEmsReadiness({
    iowaProfile: emtProfile({ expirationDate: null }),
    nremtProfile: emtProfile({ cycleStartDate: null }),
    trainingRecords: cardiologyHours(5),
    now: NOW,
  });

  assert.equal(result.iowa.status, "not_configured");
  assert.equal(result.nremt.status, "not_configured");
  assert.equal(isTrackFullyConfigured(emtProfile({ expirationDate: null })), false);
  assert.equal(isTrackFullyConfigured(emtProfile({ cycleStartDate: null })), false);
  assert.equal(isTrackFullyConfigured(emtProfile()), true);
});

test("a missing tracker is Not Set Up", () => {
  const result = calculateEmsReadiness({
    iowaProfile: null,
    nremtProfile: null,
    trainingRecords: [],
    now: NOW,
  });

  assert.equal(result.iowa.status, "not_configured");
});

test("two hours with roughly six months left in the cycle is Needs Attention, not On Track", () => {
  // Cycle 2025-03-31 -> 2027-03-31, now 2026-11-10: ~80% elapsed with 2/22 hours.
  const result = calculateEmsReadiness({
    iowaProfile: emtProfile(),
    nremtProfile: null,
    trainingRecords: cardiologyHours(2),
    now: NOW,
  });

  assert.equal(result.iowa.totalCompleted, 2);
  assert.equal(result.iowa.status, "needs_attention");
});

test("a brand-new cycle with no hours yet is still On Track (early-cycle grace)", () => {
  const result = calculateEmsReadiness({
    iowaProfile: emtProfile({ cycleStartDate: "2026-11-01", expirationDate: "2028-11-01" }),
    nremtProfile: null,
    trainingRecords: [],
    now: NOW,
  });

  assert.equal(result.iowa.totalCompleted, 0);
  assert.equal(result.iowa.status, "on_track");
});

test("keeping pace with the elapsed cycle fraction is On Track", () => {
  // ~50% elapsed: 2026-11-10 in a 2025-11-10 -> 2027-11-10 cycle; 18/22 completed.
  const result = calculateEmsReadiness({
    iowaProfile: emtProfile({ cycleStartDate: "2025-11-10", expirationDate: "2027-11-10" }),
    nremtProfile: null,
    trainingRecords: cardiologyHours(18),
    now: NOW,
  });

  assert.equal(result.iowa.status, "on_track");
});

test("pacing exposes days remaining in the cycle", () => {
  const pacing = computeCyclePacing("2025-03-31", "2027-03-31", NOW);
  assert.ok(pacing);
  assert.equal(pacing.daysRemaining, 141);
  assert.ok(pacing.elapsedFraction > 0.79 && pacing.elapsedFraction < 0.82);
});

test("training outside the certification cycle does not count toward it", () => {
  const progress = buildMemberEmsProgress({
    iowaProfile: {
      certification_level: "emt", track_status: "active", maintain_track: true,
      expiration_date: "2027-03-31", effective_start_date: "2025-03-31",
    },
    nremtProfile: null,
    events: [
      { id: "in-cycle", starts_at: "2026-06-01", hours_credit: 3, is_ems_training: true, ems_core_topic: "cardiology", ems_needs_review: false },
      { id: "before-cycle", starts_at: "2024-06-01", hours_credit: 5, is_ems_training: true, ems_core_topic: "cardiology", ems_needs_review: false },
      { id: "after-cycle", starts_at: "2027-06-01", hours_credit: 7, is_ems_training: true, ems_core_topic: "cardiology", ems_needs_review: false },
    ],
    outsideSubmissions: [],
  });

  assert.equal(progress.emsReadiness.iowa.totalCompleted, 3);
});

test("Iowa and National Registry cycles window records independently", () => {
  const progress = buildMemberEmsProgress({
    iowaProfile: {
      certification_level: "emt", track_status: "active", maintain_track: true,
      expiration_date: "2027-03-31", effective_start_date: "2026-01-01",
    },
    nremtProfile: {
      certification_level: "emt", track_status: "active", maintain_track: true,
      expiration_date: "2027-03-31", effective_start_date: "2024-01-01",
    },
    events: [
      // Inside the NREMT cycle but before the Iowa cycle begins.
      { id: "early", starts_at: "2025-06-01", hours_credit: 4, is_ems_training: true, ems_core_topic: "cardiology", ems_needs_review: false },
      // Inside both cycles.
      { id: "shared", starts_at: "2026-06-01", hours_credit: 2, is_ems_training: true, ems_core_topic: "cardiology", ems_needs_review: false },
    ],
    outsideSubmissions: [],
  });

  assert.equal(progress.emsReadiness.iowa.totalCompleted, 2);
  assert.ok(progress.emsReadiness.nremt.nationalComponentCompleted >= 6);
});

test("an unconfigured tracker credits no hours at all", () => {
  const progress = buildMemberEmsProgress({
    iowaProfile: {
      certification_level: "emt", track_status: "active", maintain_track: true,
      expiration_date: null,
    },
    nremtProfile: null,
    events: [
      { id: "e1", starts_at: "2026-06-01", hours_credit: 3, is_ems_training: true, ems_core_topic: "cardiology", ems_needs_review: false },
    ],
    outsideSubmissions: [],
  });

  assert.equal(progress.emsReadiness.iowa.totalCompleted, 0);
  assert.equal(progress.emsReadiness.iowa.status, "not_configured");
});
