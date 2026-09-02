import assert from "node:assert/strict";
import test from "node:test";

import { buildEmsAllocationPlanForTests } from "@/lib/ems/persistent-allocation";

function buildRefs(versionLabel = "2026-initial") {
  return {
    iowa: {
      requirementSetId: "set-iowa-emt",
      versionLabel,
      componentByCode: new Map([["core", "cmp-iowa-core"]]),
      topicIdByCode: new Map([
        ["airway_respirations_ventilations", "top-iowa-airway"],
        ["cardiology", "top-iowa-cardiology"],
        ["trauma", "top-iowa-trauma"],
        ["medical", "top-iowa-medical"],
        ["operations", "top-iowa-operations"],
      ]),
      cycleId: "cycle-iowa",
    },
    nremt: {
      requirementSetId: "set-nremt-emt",
      versionLabel,
      componentByCode: new Map([
        ["national_component", "cmp-nremt-national"],
        ["individual_component", "cmp-nremt-individual"],
      ]),
      topicIdByCode: new Map([
        ["airway_respirations_ventilations", "top-nremt-airway"],
        ["cardiology", "top-nremt-cardiology"],
        ["trauma", "top-nremt-trauma"],
        ["medical", "top-nremt-medical"],
        ["operations", "top-nremt-operations"],
      ]),
      cycleId: "cycle-nremt",
    },
  };
}

function baseProfiles() {
  return {
    iowaProfile: {
      level: "emt" as const,
      status: "active" as const,
      expirationDate: "2027-03-31",
      maintainTrack: true,
    },
    nremtProfile: {
      level: "emt" as const,
      status: "active" as const,
      expirationDate: "2027-03-31",
      maintainTrack: true,
    },
  };
}

test("one EMS source can produce multiple allocation records", () => {
  const refs = buildRefs();
  const profiles = baseProfiles();

  const result = buildEmsAllocationPlanForTests({
    allocatorVersion: "test-v1",
    sources: [
      {
        sourceType: "training_event_attendance",
        sourceRecordId: "src-1",
        occurredAt: "2026-01-01",
        title: "Cardiology Block",
        hours: 6,
        categoryId: null,
        coreTopic: "cardiology",
        needsReview: false,
        providerName: null,
        courseDefinitionId: null,
        metadata: {},
      },
    ],
    iowaProfile: profiles.iowaProfile,
    nremtProfile: profiles.nremtProfile,
    iowaRefs: refs.iowa,
    nremtRefs: refs.nremt,
  });

  assert.equal(result.persistedSources.length, 1);
  assert.equal(result.persistedAllocations.length, 3);
});

test("Iowa and NREMT allocations coexist for the same source record", () => {
  const refs = buildRefs();
  const profiles = baseProfiles();

  const result = buildEmsAllocationPlanForTests({
    allocatorVersion: "test-v1",
    sources: [
      {
        sourceType: "training_event_attendance",
        sourceRecordId: "src-1",
        occurredAt: "2026-01-01",
        title: "Cardiology Block",
        hours: 6,
        categoryId: null,
        coreTopic: "cardiology",
        needsReview: false,
        providerName: null,
        courseDefinitionId: null,
        metadata: {},
      },
    ],
    iowaProfile: profiles.iowaProfile,
    nremtProfile: profiles.nremtProfile,
    iowaRefs: refs.iowa,
    nremtRefs: refs.nremt,
  });

  const iowaRows = result.persistedAllocations.filter((row) => row.requirement_set_id === refs.iowa.requirementSetId);
  const nremtRows = result.persistedAllocations.filter((row) => row.requirement_set_id === refs.nremt.requirementSetId);

  assert.equal(iowaRows.length > 0, true);
  assert.equal(nremtRows.length > 0, true);
});

test("recalculation planning is deterministic and idempotent", () => {
  const refs = buildRefs();
  const profiles = baseProfiles();
  const input = {
    allocatorVersion: "test-v1",
    sources: [
      {
        sourceType: "training_event_attendance" as const,
        sourceRecordId: "src-1",
        occurredAt: "2026-01-01",
        title: "Ops Block",
        hours: 5,
        categoryId: null,
        coreTopic: "operations" as const,
        needsReview: false,
        providerName: null,
        courseDefinitionId: null,
        metadata: {},
      },
    ],
    iowaProfile: profiles.iowaProfile,
    nremtProfile: profiles.nremtProfile,
    iowaRefs: refs.iowa,
    nremtRefs: refs.nremt,
  };

  const first = buildEmsAllocationPlanForTests(input);
  const second = buildEmsAllocationPlanForTests(input);

  assert.deepEqual(second.persistedAllocations, first.persistedAllocations);
  assert.deepEqual(second.persistedSources, first.persistedSources);
});

test("editing CEHs updates allocation totals", () => {
  const refs = buildRefs();
  const profiles = baseProfiles();

  const before = buildEmsAllocationPlanForTests({
    allocatorVersion: "test-v1",
    sources: [
      {
        sourceType: "training_event_attendance",
        sourceRecordId: "src-1",
        occurredAt: "2026-01-01",
        title: "Cardiology",
        hours: 6,
        categoryId: null,
        coreTopic: "cardiology",
        needsReview: false,
        providerName: null,
        courseDefinitionId: null,
        metadata: {},
      },
    ],
    iowaProfile: profiles.iowaProfile,
    nremtProfile: profiles.nremtProfile,
    iowaRefs: refs.iowa,
    nremtRefs: refs.nremt,
  });

  const after = buildEmsAllocationPlanForTests({
    allocatorVersion: "test-v1",
    sources: [
      {
        sourceType: "training_event_attendance",
        sourceRecordId: "src-1",
        occurredAt: "2026-01-01",
        title: "Cardiology",
        hours: 4,
        categoryId: null,
        coreTopic: "cardiology",
        needsReview: false,
        providerName: null,
        courseDefinitionId: null,
        metadata: {},
      },
    ],
    iowaProfile: profiles.iowaProfile,
    nremtProfile: profiles.nremtProfile,
    iowaRefs: refs.iowa,
    nremtRefs: refs.nremt,
  });

  const beforeIowa = before.persistedAllocations.find((row) => row.requirement_set_id === refs.iowa.requirementSetId);
  const afterIowa = after.persistedAllocations.find((row) => row.requirement_set_id === refs.iowa.requirementSetId);

  assert.equal(beforeIowa?.allocated_hours, 6);
  assert.equal(afterIowa?.allocated_hours, 4);
});

test("editing core topic updates topic allocation mapping", () => {
  const refs = buildRefs();
  const profiles = baseProfiles();

  const trauma = buildEmsAllocationPlanForTests({
    allocatorVersion: "test-v1",
    sources: [
      {
        sourceType: "training_event_attendance",
        sourceRecordId: "src-1",
        occurredAt: "2026-01-01",
        title: "Scenario",
        hours: 2,
        categoryId: null,
        coreTopic: "trauma",
        needsReview: false,
        providerName: null,
        courseDefinitionId: null,
        metadata: {},
      },
    ],
    iowaProfile: profiles.iowaProfile,
    nremtProfile: profiles.nremtProfile,
    iowaRefs: refs.iowa,
    nremtRefs: refs.nremt,
  });

  const traumaTopicIds = new Set(trauma.persistedAllocations.map((row) => row.requirement_topic_id));
  assert.equal(traumaTopicIds.has("top-iowa-trauma"), true);
  assert.equal(traumaTopicIds.has("top-nremt-trauma"), true);
});

test("Other does not receive automatic EMS certification credit", () => {
  const refs = buildRefs();
  const profiles = baseProfiles();

  const result = buildEmsAllocationPlanForTests({
    allocatorVersion: "test-v1",
    sources: [
      {
        sourceType: "training_event_attendance",
        sourceRecordId: "src-1",
        occurredAt: "2026-01-01",
        title: "Other Topic",
        hours: 4,
        categoryId: null,
        coreTopic: "other",
        needsReview: false,
        providerName: null,
        courseDefinitionId: null,
        metadata: {},
      },
    ],
    iowaProfile: profiles.iowaProfile,
    nremtProfile: profiles.nremtProfile,
    iowaRefs: refs.iowa,
    nremtRefs: refs.nremt,
  });

  assert.equal(result.persistedAllocations.length, 0);
});

test("needsReview records do not receive automatic EMS certification credit", () => {
  const refs = buildRefs();
  const profiles = baseProfiles();

  const result = buildEmsAllocationPlanForTests({
    allocatorVersion: "test-v1",
    sources: [
      {
        sourceType: "training_event_attendance",
        sourceRecordId: "src-1",
        occurredAt: "2026-01-01",
        title: "Review Topic",
        hours: 5,
        categoryId: null,
        coreTopic: "cardiology",
        needsReview: true,
        providerName: null,
        courseDefinitionId: null,
        metadata: {},
      },
    ],
    iowaProfile: profiles.iowaProfile,
    nremtProfile: profiles.nremtProfile,
    iowaRefs: refs.iowa,
    nremtRefs: refs.nremt,
  });

  assert.equal(result.persistedAllocations.length, 0);
});

test("NREMT not maintained creates no NREMT allocations", () => {
  const refs = buildRefs();
  const profiles = baseProfiles();

  const result = buildEmsAllocationPlanForTests({
    allocatorVersion: "test-v1",
    sources: [
      {
        sourceType: "training_event_attendance",
        sourceRecordId: "src-1",
        occurredAt: "2026-01-01",
        title: "Ops",
        hours: 5,
        categoryId: null,
        coreTopic: "operations",
        needsReview: false,
        providerName: null,
        courseDefinitionId: null,
        metadata: {},
      },
    ],
    iowaProfile: profiles.iowaProfile,
    nremtProfile: {
      ...profiles.nremtProfile,
      status: "not_maintained",
      maintainTrack: false,
    },
    iowaRefs: refs.iowa,
    nremtRefs: refs.nremt,
  });

  assert.equal(result.persistedAllocations.every((row) => row.requirement_set_id !== refs.nremt.requirementSetId), true);
});

test("allocation rows carry requirement version trace", () => {
  const refs = buildRefs("2027-update");
  const profiles = baseProfiles();

  const result = buildEmsAllocationPlanForTests({
    allocatorVersion: "test-v2",
    sources: [
      {
        sourceType: "training_event_attendance",
        sourceRecordId: "src-1",
        occurredAt: "2026-01-01",
        title: "Cardiology",
        hours: 6,
        categoryId: null,
        coreTopic: "cardiology",
        needsReview: false,
        providerName: null,
        courseDefinitionId: null,
        metadata: {},
      },
    ],
    iowaProfile: profiles.iowaProfile,
    nremtProfile: profiles.nremtProfile,
    iowaRefs: refs.iowa,
    nremtRefs: refs.nremt,
  });

  assert.equal(
    result.persistedAllocations.every(
      (row) => (row.rule_trace_json as { requirement_version_label?: string }).requirement_version_label === "2027-update",
    ),
    true,
  );
});

test("EMT shared-credit example produces expected Iowa and NREMT totals", () => {
  const refs = buildRefs();
  const profiles = baseProfiles();

  const result = buildEmsAllocationPlanForTests({
    allocatorVersion: "test-v1",
    sources: [
      {
        sourceType: "training_event_attendance",
        sourceRecordId: "a",
        occurredAt: "2026-01-01",
        title: "Airway",
        hours: 1,
        categoryId: null,
        coreTopic: "airway_respirations_ventilations",
        needsReview: false,
        providerName: null,
        courseDefinitionId: null,
        metadata: {},
      },
      {
        sourceType: "training_event_attendance",
        sourceRecordId: "b",
        occurredAt: "2026-01-02",
        title: "Cardiology",
        hours: 6,
        categoryId: null,
        coreTopic: "cardiology",
        needsReview: false,
        providerName: null,
        courseDefinitionId: null,
        metadata: {},
      },
      {
        sourceType: "training_event_attendance",
        sourceRecordId: "c",
        occurredAt: "2026-01-03",
        title: "Trauma",
        hours: 2,
        categoryId: null,
        coreTopic: "trauma",
        needsReview: false,
        providerName: null,
        courseDefinitionId: null,
        metadata: {},
      },
      {
        sourceType: "training_event_attendance",
        sourceRecordId: "d",
        occurredAt: "2026-01-04",
        title: "Medical",
        hours: 6,
        categoryId: null,
        coreTopic: "medical",
        needsReview: false,
        providerName: null,
        courseDefinitionId: null,
        metadata: {},
      },
      {
        sourceType: "training_event_attendance",
        sourceRecordId: "e",
        occurredAt: "2026-01-05",
        title: "Operations",
        hours: 5,
        categoryId: null,
        coreTopic: "operations",
        needsReview: false,
        providerName: null,
        courseDefinitionId: null,
        metadata: {},
      },
    ],
    iowaProfile: profiles.iowaProfile,
    nremtProfile: profiles.nremtProfile,
    iowaRefs: refs.iowa,
    nremtRefs: refs.nremt,
  });

  assert.equal(result.readiness.iowa.totalCompleted, 20);
  assert.equal(result.readiness.iowa.totalRemaining, 0);
  assert.equal(result.readiness.nremt.nationalComponentCompleted, 20);
  assert.equal(result.readiness.nremt.totalCompleted, 24);
  assert.equal(result.readiness.nremt.totalRemaining, 16);
});

test("excess core-topic credit flows to NREMT individual component", () => {
  const refs = buildRefs();
  const profiles = baseProfiles();

  const result = buildEmsAllocationPlanForTests({
    allocatorVersion: "test-v1",
    sources: [
      {
        sourceType: "training_event_attendance",
        sourceRecordId: "ops",
        occurredAt: "2026-01-01",
        title: "Operations",
        hours: 5,
        categoryId: null,
        coreTopic: "operations",
        needsReview: false,
        providerName: null,
        courseDefinitionId: null,
        metadata: {},
      },
    ],
    iowaProfile: profiles.iowaProfile,
    nremtProfile: profiles.nremtProfile,
    iowaRefs: refs.iowa,
    nremtRefs: refs.nremt,
  });

  const individual = result.persistedAllocations.find((row) => row.requirement_component_id === "cmp-nremt-individual");
  assert.equal(individual?.allocated_hours, 3);
});

test("deleted training source no longer contributes allocations", () => {
  const refs = buildRefs();
  const profiles = baseProfiles();

  const result = buildEmsAllocationPlanForTests({
    allocatorVersion: "test-v1",
    sources: [],
    iowaProfile: profiles.iowaProfile,
    nremtProfile: profiles.nremtProfile,
    iowaRefs: refs.iowa,
    nremtRefs: refs.nremt,
  });

  assert.equal(result.persistedAllocations.length, 0);
  assert.equal(result.persistedSources.length, 0);
});
