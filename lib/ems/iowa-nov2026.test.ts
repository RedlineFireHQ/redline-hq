import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { afterEach, beforeEach, mock } from "node:test";

import { calculateEmsReadiness, type EmsTrackProfileInput, type EmsTrainingRecord } from "@/lib/ems/calculation";
import { buildMemberEmsProgress } from "@/lib/ems/member-ems-progress";
import { buildEmsAllocationPlanForTests } from "@/lib/ems/persistent-allocation";
import { getIowaRequirement, getIowaTopicRequirements, IOWA_REQUIREMENTS } from "@/lib/ems/requirements";

const topics = [
  "airway_respirations_ventilations", "cardiology", "trauma", "medical", "operations", "pediatric",
] as const;
const levels = [
  { level: "emr", hours: [1.5, 2, 1, 2.5, 1, 1], total: 9, oldTotal: 8 },
  { level: "emt", hours: [4, 5, 3, 6, 2, 2], total: 22, oldTotal: 20 },
  { level: "aemt", hours: [5, 6, 4, 7, 3, 3], total: 28, oldTotal: 25 },
  { level: "paramedic", hours: [6, 7, 5, 8, 4, 4], total: 34, oldTotal: 30 },
] as const;
const profile: EmsTrackProfileInput = {
  level: "paramedic", status: "active", expirationDate: "2099-01-01", cycleStartDate: "2020-01-01", maintainTrack: true,
};

function records(hours: readonly number[]): EmsTrainingRecord[] {
  return topics.map((coreTopic, index) => ({
    id: coreTopic, coreTopic, occurredAt: "2026-01-01", hours: hours[index],
    needsReview: false, eligibleForIowa: true, eligibleForNremt: true,
  }));
}

beforeEach(() => {
  mock.timers.enable({ apis: ["Date"], now: new Date("2026-11-02T12:00:00Z") });
});

afterEach(() => mock.timers.reset());

for (const row of levels) {
  test(`Iowa ${row.level} requires the exact six categories totaling ${row.total}`, () => {
    const requirement = getIowaRequirement(row.level);
    assert.deepEqual(requirement, {
      totalRequiredHours: row.total,
      topicRequirements: topics.map((topic, index) => ({ topic, requiredHours: row.hours[index] })),
    });
    assert.deepEqual(requirement, IOWA_REQUIREMENTS[row.level]);
    assert.equal(requirement.topicRequirements.reduce((sum, topic) => sum + topic.requiredHours, 0), row.total);
    const result = calculateEmsReadiness({
      iowaProfile: { ...profile, level: row.level }, nremtProfile: null, trainingRecords: records(row.hours),
    });
    assert.equal(result.iowa.totalRequired, row.total);
    assert.equal(result.iowa.totalCompleted, row.total);
    assert.equal(result.iowa.totalRemaining, 0);
    assert.equal(result.iowa.status, "complete");
  });

  test(`Iowa ${row.level} cannot complete with any category below its exact threshold`, () => {
    for (const missing of topics) {
      const result = calculateEmsReadiness({
        iowaProfile: { ...profile, level: row.level }, nremtProfile: null,
        trainingRecords: records(row.hours).map((record) => ({
          ...record, hours: record.coreTopic === missing ? record.hours - 0.01 : record.hours,
        })),
      });
      assert.equal(result.iowa.totalRemaining, 0.01, missing);
      assert.notEqual(result.iowa.status, "complete", missing);
      assert.equal(result.iowa.topics.find((topic) => topic.topic === missing)?.complete, false);
    }
    const noPediatric = calculateEmsReadiness({
      iowaProfile: { ...profile, level: row.level }, nremtProfile: null,
      trainingRecords: records(row.hours).map((record) => ({
        ...record, hours: record.coreTopic === "pediatric" ? 0 :
          record.coreTopic === "medical" ? record.hours + row.hours[5] : record.hours,
      })),
    });
    assert.equal(noPediatric.iowa.totalRemaining, 0);
    assert.notEqual(noPediatric.iowa.status, "complete", "Other category overages cannot replace Pediatric");
  });

  test(`shared display and persisted accounting agree for Iowa ${row.level}`, () => {
    const trainingRecords = records(row.hours);
    const before = structuredClone(trainingRecords);
    const result = buildMemberEmsProgress({
      iowaProfile: {
        certification_level: row.level, track_status: "active", expiration_date: "2099-01-01", effective_start_date: "2020-01-01", maintain_track: true,
      },
      nremtProfile: {
        certification_level: "paramedic", track_status: "active", expiration_date: "2099-01-01", effective_start_date: "2020-01-01", maintain_track: true,
      },
      events: trainingRecords.slice(0, 5).map((record) => ({
        id: record.id, starts_at: record.occurredAt, hours_credit: String(record.hours),
        is_ems_training: true, ems_core_topic: record.coreTopic, ems_needs_review: false,
      })),
      outsideSubmissions: [{
        id: "pediatric", training_date: "2026-01-01", hours: row.hours[5],
        is_ems_training: true, ems_core_topic: "pediatric", ems_needs_review: false,
      }],
    });
    const plan = buildEmsAllocationPlanForTests({
      iowaProfile: { ...profile, level: row.level }, nremtProfile: profile,
      allocatorVersion: "test-iowa-nov2026",
      iowaRefs: {
        requirementSetId: `iowa-${row.level}`, versionLabel: "2026-iowa-nov1", cycleId: null,
        componentByCode: new Map([["core", "iowa-core"]]),
        topicIdByCode: new Map(topics.map((topic) => [topic, `iowa-${topic}`])),
      },
      nremtRefs: {
        requirementSetId: "nremt-paramedic", versionLabel: "2026-paramedic-30", cycleId: null,
        componentByCode: new Map([["national_component", "nremt-national"]]),
        topicIdByCode: new Map(topics.slice(0, 5).map((topic) => [topic, `nremt-${topic}`])),
      },
      sources: trainingRecords.map((record) => ({
        sourceType: "training_event_attendance", sourceRecordId: record.id, title: record.id,
        occurredAt: record.occurredAt, hours: record.hours, coreTopic: record.coreTopic, needsReview: false,
        categoryId: null, providerName: null, courseDefinitionId: null, metadata: {},
      })),
    });
    assert.deepEqual(result.emsReadiness, plan.readiness);
    assert.equal(result.emsReadiness.iowa.totalRequired, row.total);
    assert.equal(result.emsReadiness.iowa.status, "complete");
    const iowaAllocations = plan.persistedAllocations.filter((allocation) => allocation.requirement_set_id === `iowa-${row.level}`);
    assert.equal(iowaAllocations.length, 6);
    assert.equal(iowaAllocations.reduce((sum, allocation) => sum + allocation.allocated_hours, 0), row.total);
    assert.ok(iowaAllocations.some((allocation) => allocation.requirement_topic_id === "iowa-pediatric"));
    assert.deepEqual(trainingRecords, before, "Historical training records must not be changed");
  });
}

test("Iowa requirements switch on November 1, not training date or credential renewal", () => {
  for (const instant of ["2026-10-31T23:59:59.999Z", "2026-11-01T00:00:00.000Z"]) {
    mock.timers.setTime(new Date(instant).getTime());
    const historical = instant.startsWith("2026-10-31");
    for (const row of levels) {
      const result = calculateEmsReadiness({
        iowaProfile: { ...profile, level: row.level }, nremtProfile: null, trainingRecords: [],
      });
      assert.equal(result.iowa.totalRequired, historical ? row.oldTotal : row.total);
      assert.equal(result.iowa.topics.find((topic) => topic.topic === "pediatric")?.required, historical ? 0 : row.hours[5]);
      assert.equal(getIowaTopicRequirements(row.level).length, 6);
    }
  }
});

test("every National Registry calculation is identical before and after the Iowa effective date", () => {
  const trainingRecords = [
    ...records([6, 7, 5, 8, 4, 4]),
    { ...records([6, 7, 5, 8, 4, 4])[0], id: "ccp", coreTopic: "critical_care_paramedic" as const, hours: 12 },
  ];
  const manualAllocations = (["national_component", "local_state_component", "individual_component"] as const)
    .map((component) => ({
      recordId: "pediatric", track: "nremt" as const, topic: "cardiology" as const, component, hours: 4,
    }));
  for (const row of levels) {
    const input = {
      iowaProfile: { ...profile, level: row.level }, nremtProfile: { ...profile, level: row.level },
      trainingRecords, manualAllocations,
    };
    mock.timers.setTime(new Date("2026-10-31T12:00:00Z").getTime());
    const previous = calculateEmsReadiness(input).nremt;
    mock.timers.setTime(new Date("2026-11-01T12:00:00Z").getTime());
    const current = calculateEmsReadiness(input).nremt;
    // daysRemaining legitimately differs by one day between the two instants.
    const stripDays = ({ daysRemaining: _ignored, ...rest }: typeof previous) => rest;
    assert.deepEqual(stripDays(current), stripDays(previous));
    assert.equal(current.totalRequired, { emr: 16, emt: 40, aemt: 50, paramedic: 30 }[row.level]);
    assert.equal(current.nationalTopics.length, 5);
  }
});

test("Iowa CCP remains exactly 46 and independently assigned National Registry Paramedic remains 30", () => {
  assert.deepEqual(getIowaRequirement("ccp", new Date("2026-10-31")), getIowaRequirement("ccp", new Date("2026-11-01")));
  const result = calculateEmsReadiness({
    iowaProfile: { ...profile, level: "ccp" }, nremtProfile: profile,
    trainingRecords: [
      ...records([6, 7, 5, 8, 4, 4]),
      { ...records([6, 7, 5, 8, 4, 4])[0], id: "ccp", coreTopic: "critical_care_paramedic", hours: 12 },
    ],
  });
  assert.equal(result.iowa.totalRequired, 46);
  assert.equal(result.iowa.totalCompleted, 46);
  assert.equal(result.iowa.status, "complete");
  assert.equal(result.nremt.totalRequired, 30);
  assert.equal(result.nremt.totalCompleted, 30);
  assert.equal(result.nremt.status, "complete");
});

test("Personnel and My Readiness retain the same progress builder and CE component", () => {
  for (const file of ["app/personnel/[id]/page.tsx", "app/my-readiness/page.tsx"]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /buildMemberEmsProgress\(\{/);
    assert.match(source, /<EmsContinuingEducationSection/);
    assert.match(source, /emsReadiness=\{(?:emsProgress\.)?emsReadiness\}/);
  }
});
