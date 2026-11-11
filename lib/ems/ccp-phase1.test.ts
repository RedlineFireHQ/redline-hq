import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateEmsReadiness,
  type EmsManualAllocation,
  type EmsTrainingRecord,
  type EmsTrackProfileInput,
} from "@/lib/ems/calculation";
import {
  EMS_CORE_TOPICS,
  IOWA_REQUIREMENTS,
  NREMT_REQUIREMENTS,
  getIowaRequirement,
  getIowaTopicRequirements,
  getEmsCertificationLevels,
  isTopicApplicableToTrack,
} from "@/lib/ems/requirements";
import { buildMemberEmsProgress } from "@/lib/ems/member-ems-progress";
import {
  applyAuthoritativeCertificationToTrackProfile,
  buildCertificationTypeMetaById,
  resolveAuthoritativeEmsCertificationsForMember,
} from "@/lib/ems/authoritative-certifications";
import { resolveCertificationStatusFromAuthority } from "@/lib/ems/certification-authority";

const profile: EmsTrackProfileInput = {
  level: "ccp", status: "active", expirationDate: "2099-01-01", cycleStartDate: "2097-01-01", maintainTrack: true,
};
const topicCodes = [
  "airway_respirations_ventilations", "cardiology", "trauma", "medical", "operations",
  "pediatric", "critical_care_paramedic",
] as const;
const hours = [6, 7, 5, 8, 4, 4, 12];
const records: EmsTrainingRecord[] = topicCodes.map((coreTopic, index) => ({
  id: coreTopic, occurredAt: "2026-01-01", hours: hours[index], coreTopic,
  needsReview: false, eligibleForIowa: true, eligibleForNremt: true,
}));

function calculate(trainingRecords = records, manualAllocations: EmsManualAllocation[] = []) {
  return calculateEmsReadiness({
    iowaProfile: profile, nremtProfile: { ...profile, level: "paramedic" }, trainingRecords, manualAllocations,
  });
}

test("Iowa CCP requires seven categories totaling 46 and NREMT Paramedic requires five totaling 30", () => {
  assert.deepEqual(IOWA_REQUIREMENTS.ccp.topicRequirements, topicCodes.map((topic, index) => ({
    topic, requiredHours: hours[index],
  })));
  assert.deepEqual(NREMT_REQUIREMENTS.paramedic.nationalTopicRequirements, IOWA_REQUIREMENTS.ccp.topicRequirements.slice(0, 5));
  assert.equal("ccp" in NREMT_REQUIREMENTS, false);
  const result = calculate();
  assert.equal(result.iowa.totalRequired, 46);
  assert.equal(result.iowa.totalCompleted, 46);
  assert.equal(result.iowa.totalRemaining, 0);
  assert.equal(result.iowa.status, "complete");
  assert.equal(result.nremt.totalRequired, 30);
  assert.equal(result.nremt.totalCompleted, 30);
  assert.equal(result.nremt.totalRemaining, 0);
  assert.equal(result.nremt.status, "complete");
  assert.equal(result.nremt.nationalTopics.length, 5);
  assert.equal(result.nremt.localStateComponentRequired, 0);
  assert.equal(result.nremt.individualComponentRequired, 0);
  assert.equal(result.nremt.pediatricRequirement.required, false);
  assert.equal(result.nremt.pediatricRequirement.status, "not_applicable");
  assert.deepEqual(result.warnings, []);
});

for (const missing of topicCodes) {
  test(`CCP remains incomplete when ${missing} is below its exact threshold`, () => {
    const result = calculate(records.map((record) => ({
      ...record, hours: record.coreTopic === missing ? record.hours - 0.01 : record.hours,
    })));
    assert.notEqual(result.iowa.status, "complete");
    assert.equal(result.iowa.totalRemaining, 0.01);
    if (missing === "pediatric" || missing === "critical_care_paramedic") {
      assert.equal(result.nremt.status, "complete");
      assert.equal(result.nremt.totalCompleted, 30);
    } else {
      assert.notEqual(result.nremt.status, "complete");
      assert.equal(result.nremt.totalRemaining, 0.01);
    }
  });
}

test("Iowa CCP and NREMT Paramedic overages cannot hide missing categories or produce individual credit", () => {
  const result = calculate(records.map((record) => ({
    ...record, hours: record.coreTopic === "airway_respirations_ventilations" ? 30 :
      record.coreTopic === "cardiology" ? 0 : record.hours,
  })));
  assert.equal(result.iowa.totalRemaining, 0);
  assert.notEqual(result.iowa.status, "complete");
  assert.equal(result.nremt.totalRemaining, 0);
  assert.notEqual(result.nremt.status, "complete");
  assert.equal(result.nremt.individualComponentCompleted, 0);
});

test("CCP can coexist with a different certification level on the other authority", () => {
  const ccpIowa = calculateEmsReadiness({
    iowaProfile: profile, nremtProfile: { ...profile, level: "paramedic" }, trainingRecords: records,
  });
  assert.equal(ccpIowa.iowa.totalRequired, 46);
  assert.equal(ccpIowa.iowa.totalCompleted, 46);
  assert.equal(ccpIowa.nremt.totalRequired, 30);
  assert.equal(ccpIowa.nremt.totalCompleted, 30);
  assert.equal(ccpIowa.nremt.status, "complete");
  assert.deepEqual(getEmsCertificationLevels("nremt").map((level) => level.code), ["emr", "emt", "aemt", "paramedic"]);
  assert.throws(() => calculateEmsReadiness({
    iowaProfile: null, nremtProfile: profile, trainingRecords: [],
  }), /Iowa EMS level only/);
});

test("Iowa-only CCP topics cannot leak into NREMT through automatic or manual allocations", () => {
  const iowaOnly = records.slice(5);
  const manualAllocations: EmsManualAllocation[] = iowaOnly.flatMap((record) =>
    (["national_component", "local_state_component", "individual_component"] as const).map((component) => ({
      recordId: record.id, track: "nremt", component,
      topic: record.coreTopic === "other" ? null : record.coreTopic, hours: record.hours,
    })));
  const result = calculate(iowaOnly, manualAllocations);
  assert.equal(result.iowa.totalCompleted, 16);
  assert.equal(result.nremt.totalCompleted, 0);
  assert.equal(result.nremt.totalRemaining, 30);
  assert.equal(result.nremt.nationalComponentCompleted, 0);
  assert.equal(result.nremt.localStateComponentCompleted, 0);
  assert.equal(result.nremt.individualComponentCompleted, 0);
  assert.notEqual(result.nremt.status, "complete");
});

test("valid manual CCP category credits reach the same separate 46 and 30 thresholds", () => {
  const manualAllocations: EmsManualAllocation[] = records.flatMap((record) =>
    (["iowa", "nremt"] as const).map((track) => ({
      recordId: record.id, track, component: track === "iowa" ? "core" : "national_component",
      topic: record.coreTopic === "other" ? null : record.coreTopic, hours: record.hours,
    })));
  const result = calculate([], manualAllocations);
  assert.equal(result.iowa.totalCompleted, 46);
  assert.equal(result.iowa.status, "complete");
  assert.equal(result.nremt.totalCompleted, 30);
  assert.equal(result.nremt.status, "complete");
});

test("NREMT Paramedic ignores Local/State and Individual allocations even from valid national sources", () => {
  const manualAllocations: EmsManualAllocation[] = records.slice(0, 5).flatMap((record) =>
    (["local_state_component", "individual_component"] as const).map((component) => ({
      recordId: record.id, track: "nremt", component,
      topic: record.coreTopic === "other" ? null : record.coreTopic, hours: record.hours,
    })));
  const result = calculate([], manualAllocations);
  assert.equal(result.nremt.totalRequired, 30);
  assert.equal(result.nremt.totalCompleted, 0);
  assert.equal(result.nremt.localStateComponentCompleted, 0);
  assert.equal(result.nremt.individualComponentCompleted, 0);
  assert.notEqual(result.nremt.status, "complete");
});

test("no NREMT level can credit Iowa-only topics through any manual component or source relabeling", () => {
  for (const level of ["emr", "emt", "aemt", "paramedic"] as const) {
    const manualAllocations: EmsManualAllocation[] = records.slice(5).flatMap((record) =>
      (["national_component", "local_state_component", "individual_component"] as const).flatMap((component) =>
        ([record.coreTopic, null, "cardiology"] as const).map((topic) => ({
          recordId: record.id, track: "nremt" as const, component,
          topic: topic === "other" ? null : topic, hours: record.hours,
        }))));
    const result = calculateEmsReadiness({
      iowaProfile: profile, nremtProfile: { ...profile, level },
      trainingRecords: records.slice(5), manualAllocations,
    });
    assert.equal(result.iowa.totalCompleted, 16);
    assert.equal(result.nremt.totalCompleted, 0);
    assert.equal(result.nremt.localStateComponentCompleted, 0);
    assert.equal(result.nremt.individualComponentCompleted, 0);
  }
});

test("unapproved CCP/Pediatric training is excluded without changing expiration handling", () => {
  const result = calculate(records.map((record) => ({ ...record, needsReview: true })));
  assert.equal(result.iowa.totalCompleted, 0);
  assert.equal(result.nremt.totalCompleted, 0);
  const expired = calculateEmsReadiness({
    iowaProfile: { ...profile, expirationDate: "2000-01-01" },
    nremtProfile: { ...profile, level: "paramedic", expirationDate: "2000-01-01" },
    trainingRecords: records,
  });
  assert.equal(expired.iowa.status, "needs_attention");
  assert.equal(expired.nremt.status, "needs_attention");
});

test("historical Iowa requirements and all National Registry requirements remain preserved", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-31T12:00:00Z") });
  const frozen = [
    { level: "emr", iowaTotal: 8, iowa: [1, 2, 1, 3, 1], nremtTotal: 16, national: [1.5, 2, 1, 2.5, 1] },
    { level: "emt", iowaTotal: 20, iowa: [1, 6, 2, 6, 5], nremtTotal: 40, national: [4, 5, 3, 6, 2] },
    { level: "aemt", iowaTotal: 25, iowa: [2, 7, 3, 8, 5], nremtTotal: 50, national: [5, 6, 4, 7, 3] },
    { level: "paramedic", iowaTotal: 30, iowa: [3, 9, 3, 9, 6], nremtTotal: 30, national: [6, 7, 5, 8, 4] },
  ] as const;
  for (const row of frozen) {
    const iowa = getIowaRequirement(row.level);
    const nremt = NREMT_REQUIREMENTS[row.level];
    assert.equal(iowa.totalRequiredHours, row.iowaTotal);
    assert.deepEqual(iowa.topicRequirements.map((topic) => topic.topic), topicCodes.slice(0, 5));
    assert.deepEqual(iowa.topicRequirements.map((topic) => topic.requiredHours), row.iowa);
    assert.equal(nremt.totalNccpRequiredHours, row.nremtTotal);
    assert.equal(nremt.nationalComponentRequiredHours, row.national.reduce((sum: number, hours) => sum + hours, 0));
    assert.deepEqual(nremt.nationalTopicRequirements.map((topic) => topic.topic), topicCodes.slice(0, 5));
    assert.deepEqual(nremt.nationalTopicRequirements.map((topic) => topic.requiredHours), row.national);
    assert.equal(nremt.localStateComponentRequiredHours, row.level === "paramedic" ? 0 : null);
    assert.equal(nremt.individualComponentRequiredHours, row.level === "paramedic" ? 0 : null);
    assert.equal(nremt.pediatricRequirement.ruleStatus, row.level === "paramedic" ? "confirmed" : "needs_authoritative_verification");
    assert.equal(nremt.pediatricRequirement.required, row.level !== "paramedic");
    const result = calculateEmsReadiness({
      iowaProfile: { ...profile, level: row.level }, nremtProfile: null,
      trainingRecords: iowa.topicRequirements.map((topic) => ({
        ...records[0], id: topic.topic, coreTopic: topic.topic, hours: topic.requiredHours,
      })),
    });
    assert.equal(result.iowa.totalCompleted, row.iowaTotal);
    assert.equal(result.iowa.totalRequired, row.iowaTotal);
    assert.equal(result.iowa.status, "complete");
  }
});

test("Pediatric is selectable and credited for every Iowa level with its current minimum", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-11-02T12:00:00Z") });
  const pediatricHours = { emr: 1, emt: 2, aemt: 3, paramedic: 4, ccp: 4 };
  assert.ok(EMS_CORE_TOPICS.some((topic) => topic.code === "pediatric" && topic.label === "Pediatric"));
  for (const level of ["emr", "emt", "aemt", "paramedic", "ccp"] as const) {
    assert.ok(isTopicApplicableToTrack("pediatric", "iowa", level));
    assert.equal(isTopicApplicableToTrack("critical_care_paramedic", "iowa", level), level === "ccp");
    if (level !== "ccp") assert.equal(isTopicApplicableToTrack("pediatric", "nremt", level), false);
    const pediatric = getIowaTopicRequirements(level).find((topic) => topic.topic === "pediatric");
    assert.equal(pediatric?.requiredHours, pediatricHours[level]);
    const result = calculateEmsReadiness({
      iowaProfile: { ...profile, level }, nremtProfile: { ...profile, level: "paramedic" }, trainingRecords: records.slice(5),
    });
    assert.equal(result.iowa.totalCompleted, level === "ccp" ? 16 : 4);
    assert.equal(result.nremt.totalCompleted, 0);
  }
});

test("the Personnel/My Readiness builder preserves CCP levels and both new topics", () => {
  const dbProfile = {
    certification_level: "ccp", track_status: "active", maintain_track: true, expiration_date: "2099-01-01", effective_start_date: "2020-01-01",
  };
  const result = buildMemberEmsProgress({
    iowaProfile: dbProfile, nremtProfile: { ...dbProfile, certification_level: "paramedic" },
    events: records.slice(0, 6).map((record) => ({
      id: record.id, starts_at: record.occurredAt, hours_credit: record.hours,
      is_ems_training: true, ems_core_topic: record.coreTopic, ems_needs_review: false,
    })),
    outsideSubmissions: [{
      id: "ccp", training_date: "2026-01-01", hours: 12, is_ems_training: true,
      ems_core_topic: "critical_care_paramedic", ems_needs_review: false,
    }],
  });
  assert.equal(result.emsReadiness.iowa.totalRequired, 46);
  assert.equal(result.emsReadiness.iowa.totalCompleted, 46);
  assert.equal(result.emsReadiness.nremt.totalRequired, 30);
  assert.equal(result.emsReadiness.nremt.totalCompleted, 30);
  assert.equal(result.emsReadiness.nremt.status, "complete");
  assert.deepEqual(result.visibleWarnings, []);
  assert.deepEqual(result.unclassifiedRecordIds, []);
});

test("authoritative metadata rejects National Registry CCP instead of projecting an unsupported track", () => {
  assert.throws(() => buildCertificationTypeMetaById([
    { id: "unsupported", ems_authority: "nremt", ems_certification_level: "ccp" },
  ]), /Iowa EMS level only/);
});

test("independent Iowa CCP and NREMT Paramedic manual trackers survive profile projection untouched", () => {
  const certificationTypeById = buildCertificationTypeMetaById([
    { id: "iowa-ccp", ems_authority: "iowa", ems_certification_level: "ccp" },
    { id: "nremt-ccp", ems_authority: "nremt", ems_certification_level: "paramedic" },
  ]);
  const authoritative = resolveAuthoritativeEmsCertificationsForMember({
    certificationTypeById,
    memberCertifications: ["iowa", "nremt"].map((track) => ({
      member_id: "member", certification_id: `${track}-ccp`, certificate_number: `${track}-123`,
      issued_at: "2026-01-01", expires_at: "2099-01-01",
    })),
  });
  for (const track of ["iowa", "nremt"] as const) {
    // Manual mode: a missing tracker is never synthesized from credentials...
    assert.equal(applyAuthoritativeCertificationToTrackProfile({
      track, profile: null, authoritativeCertification: authoritative[track],
    }), null);
    // ...and a manually configured tracker keeps its own independent values.
    const manualProfile = {
      track, certification_level: track === "iowa" ? ("ccp" as const) : ("paramedic" as const),
      track_status: "active" as const, maintain_track: true, certification_number: `${track}-manual`,
      expiration_date: "2098-06-30", effective_start_date: "2026-07-01", effective_end_date: null,
    };
    const projected = applyAuthoritativeCertificationToTrackProfile({
      track, profile: manualProfile, authoritativeCertification: authoritative[track],
    });
    assert.equal(projected?.certification_level, track === "iowa" ? "ccp" : "paramedic");
    assert.equal(projected?.certification_number, `${track}-manual`);
    assert.equal(projected?.expiration_date, "2098-06-30");
  }
});

test("CCP name inference does not fall through to ordinary Paramedic", () => {
  for (const certificationName of ["Iowa Critical Care Paramedic", "CCP"]) {
    const ccpProfile = {
      track: "iowa" as const, certification_level: "ccp" as const, track_status: "active" as const,
      maintain_track: true, certification_number: "123", expiration_date: "2099-01-01", effective_end_date: null,
    };
    const args = {
      certificationName, genericStatus: "expired" as const, warningDays: 60,
      iowaProfile: ccpProfile, nremtProfile: { ...ccpProfile, track: "nremt" as const, certification_level: "paramedic" as const },
    };
    assert.equal(resolveCertificationStatusFromAuthority(args), "current");
    assert.equal(resolveCertificationStatusFromAuthority({
      ...args, iowaProfile: { ...ccpProfile, certification_level: "paramedic" },
      nremtProfile: { ...ccpProfile, track: "nremt", certification_level: "paramedic" },
    }), "expired");
  }
});
