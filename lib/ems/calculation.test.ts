import test from "node:test";
import assert from "node:assert/strict";

import { calculateEmsReadiness } from "@/lib/ems/calculation";

function topic(result: ReturnType<typeof calculateEmsReadiness>, code: "airway_respirations_ventilations" | "cardiology" | "trauma" | "medical" | "operations") {
  const row = result.nremt.nationalTopics.find((item) => item.topic === code);
  assert.ok(row, `Missing topic ${code}`);
  return row;
}

test("EMT shared-credit overlap does not require 20 + 40 duplicate hours", () => {
  const result = calculateEmsReadiness({
    iowaProfile: {
      level: "emt",
      status: "active",
      expirationDate: "2027-03-31",
      maintainTrack: true,
    },
    nremtProfile: {
      level: "emt",
      status: "active",
      expirationDate: "2027-03-31",
      maintainTrack: true,
    },
    trainingRecords: [
      { id: "a", occurredAt: "2026-01-01", hours: 1, coreTopic: "airway_respirations_ventilations", needsReview: false, eligibleForIowa: true, eligibleForNremt: true },
      { id: "b", occurredAt: "2026-01-02", hours: 6, coreTopic: "cardiology", needsReview: false, eligibleForIowa: true, eligibleForNremt: true },
      { id: "c", occurredAt: "2026-01-03", hours: 2, coreTopic: "trauma", needsReview: false, eligibleForIowa: true, eligibleForNremt: true },
      { id: "d", occurredAt: "2026-01-04", hours: 6, coreTopic: "medical", needsReview: false, eligibleForIowa: true, eligibleForNremt: true },
      { id: "e", occurredAt: "2026-01-05", hours: 5, coreTopic: "operations", needsReview: false, eligibleForIowa: true, eligibleForNremt: true },
    ],
  });

  assert.equal(result.iowa.totalRequired, 20);
  assert.equal(result.iowa.totalCompleted, 20);
  assert.equal(result.iowa.totalRemaining, 0);

  assert.equal(topic(result, "airway_respirations_ventilations").remaining, 3);
  assert.equal(topic(result, "cardiology").remaining, 0);
  assert.equal(topic(result, "trauma").remaining, 1);
  assert.equal(topic(result, "medical").remaining, 0);
  assert.equal(topic(result, "operations").remaining, 0);

  assert.equal(result.nremt.nationalComponentCompleted, 20);
  assert.equal(result.nremt.totalCompleted >= 20, true);
  assert.equal(result.nremt.totalRequired, 40);
  assert.equal(result.nremt.totalRemaining <= 20, true);
});

test("NREMT optional member can stay Iowa-active and NREMT not maintained", () => {
  const result = calculateEmsReadiness({
    iowaProfile: {
      level: "emt",
      status: "active",
      expirationDate: "2027-03-31",
      maintainTrack: true,
    },
    nremtProfile: {
      level: "emt",
      status: "not_maintained",
      expirationDate: null,
      maintainTrack: false,
    },
    trainingRecords: [
      { id: "x", occurredAt: "2026-01-01", hours: 6, coreTopic: "cardiology", needsReview: false, eligibleForIowa: true, eligibleForNremt: true },
    ],
  });

  assert.equal(result.iowa.status === "on_track" || result.iowa.status === "needs_attention", true);
  assert.equal(result.nremt.status, "not_maintained");
});

test("Other/unclassified EMS training is marked needs review and not auto-awarded", () => {
  const result = calculateEmsReadiness({
    iowaProfile: {
      level: "emr",
      status: "active",
      expirationDate: "2027-03-31",
      maintainTrack: true,
    },
    nremtProfile: {
      level: "emr",
      status: "active",
      expirationDate: "2027-03-31",
      maintainTrack: true,
    },
    trainingRecords: [
      { id: "u1", occurredAt: "2026-01-01", hours: 4, coreTopic: "other", needsReview: true, eligibleForIowa: false, eligibleForNremt: false },
    ],
  });

  assert.deepEqual(result.unclassifiedRecordIds, ["u1"]);
  assert.equal(result.iowa.totalCompleted, 0);
  assert.equal(result.nremt.nationalComponentCompleted, 0);
});

test("Same training event contributes to both tracks without duplicate records", () => {
  const result = calculateEmsReadiness({
    iowaProfile: {
      level: "emt",
      status: "active",
      expirationDate: "2027-03-31",
      maintainTrack: true,
    },
    nremtProfile: {
      level: "emt",
      status: "active",
      expirationDate: "2027-03-31",
      maintainTrack: true,
    },
    trainingRecords: [
      { id: "shared-1", occurredAt: "2026-01-01", hours: 4, coreTopic: "airway_respirations_ventilations", needsReview: false, eligibleForIowa: true, eligibleForNremt: true },
    ],
  });

  const iowaAirway = result.iowa.topics.find((row) => row.topic === "airway_respirations_ventilations");
  assert.ok(iowaAirway);
  assert.equal(iowaAirway.completed, 4);

  const nremtAirway = result.nremt.nationalTopics.find((row) => row.topic === "airway_respirations_ventilations");
  assert.ok(nremtAirway);
  assert.equal(nremtAirway.completed, 4);
});

test("Other and needsReview records do not auto-credit NREMT individual component", () => {
  const result = calculateEmsReadiness({
    iowaProfile: {
      level: "emt",
      status: "active",
      expirationDate: "2027-03-31",
      maintainTrack: true,
    },
    nremtProfile: {
      level: "emt",
      status: "active",
      expirationDate: "2027-03-31",
      maintainTrack: true,
    },
    trainingRecords: [
      { id: "other", occurredAt: "2026-01-01", hours: 4, coreTopic: "other", needsReview: false, eligibleForIowa: true, eligibleForNremt: true },
      { id: "review", occurredAt: "2026-01-02", hours: 5, coreTopic: "cardiology", needsReview: true, eligibleForIowa: true, eligibleForNremt: true },
      { id: "core", occurredAt: "2026-01-03", hours: 6, coreTopic: "cardiology", needsReview: false, eligibleForIowa: true, eligibleForNremt: true },
    ],
  });

  assert.equal(topic(result, "cardiology").completed, 6);
  assert.equal(result.nremt.individualComponentCompleted, 1);
  assert.deepEqual(result.unclassifiedRecordIds.sort(), ["other", "review"]);
});

test("Iowa expired track date forces Iowa readiness to needs attention", () => {
  const result = calculateEmsReadiness({
    iowaProfile: {
      level: "emt",
      status: "active",
      expirationDate: "2000-01-01",
      maintainTrack: true,
    },
    nremtProfile: {
      level: "emt",
      status: "active",
      expirationDate: "2030-01-01",
      maintainTrack: true,
    },
    trainingRecords: [
      { id: "a", occurredAt: "2026-01-01", hours: 4, coreTopic: "airway_respirations_ventilations", needsReview: false, eligibleForIowa: true, eligibleForNremt: true },
      { id: "b", occurredAt: "2026-01-02", hours: 4, coreTopic: "cardiology", needsReview: false, eligibleForIowa: true, eligibleForNremt: true },
      { id: "c", occurredAt: "2026-01-03", hours: 4, coreTopic: "trauma", needsReview: false, eligibleForIowa: true, eligibleForNremt: true },
      { id: "d", occurredAt: "2026-01-04", hours: 4, coreTopic: "medical", needsReview: false, eligibleForIowa: true, eligibleForNremt: true },
      { id: "e", occurredAt: "2026-01-05", hours: 4, coreTopic: "operations", needsReview: false, eligibleForIowa: true, eligibleForNremt: true },
    ],
  });

  assert.equal(result.iowa.status, "needs_attention");
  assert.equal(result.warnings.includes("Iowa EMS certification is expired based on track expiration date."), true);
});

test("Maintained NREMT expired track date forces NREMT readiness to needs attention", () => {
  const result = calculateEmsReadiness({
    iowaProfile: {
      level: "emt",
      status: "active",
      expirationDate: "2030-01-01",
      maintainTrack: true,
    },
    nremtProfile: {
      level: "emt",
      status: "active",
      expirationDate: "2000-01-01",
      maintainTrack: true,
    },
    trainingRecords: [
      { id: "a", occurredAt: "2026-01-01", hours: 4, coreTopic: "airway_respirations_ventilations", needsReview: false, eligibleForIowa: true, eligibleForNremt: true },
      { id: "b", occurredAt: "2026-01-02", hours: 6, coreTopic: "cardiology", needsReview: false, eligibleForIowa: true, eligibleForNremt: true },
      { id: "c", occurredAt: "2026-01-03", hours: 3, coreTopic: "trauma", needsReview: false, eligibleForIowa: true, eligibleForNremt: true },
      { id: "d", occurredAt: "2026-01-04", hours: 4, coreTopic: "medical", needsReview: false, eligibleForIowa: true, eligibleForNremt: true },
      { id: "e", occurredAt: "2026-01-05", hours: 3, coreTopic: "operations", needsReview: false, eligibleForIowa: true, eligibleForNremt: true },
    ],
  });

  assert.equal(result.nremt.status, "needs_attention");
  assert.equal(result.warnings.includes("NREMT certification is expired based on track expiration date."), true);
});
