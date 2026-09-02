import assert from "node:assert/strict";
import test from "node:test";

import { buildMemberReadinessScore, type RequirementInput } from "@/lib/readiness/member-readiness";

const qualificationReady = {
  hasAssignedRole: true,
  roleName: "Firefighter",
  requiredQualifications: ["FF1"],
  completedQualifications: ["FF1"],
  missingQualifications: [],
};

function recurringCertificationRequirement(id: string, name: string, certificationId: string): RequirementInput {
  return {
    id,
    name,
    requirement_kind: "recurring",
    period_type: "annual",
    minimum_hours: null,
    category_id: null,
    due_frequency_rule: null,
    required_topic: null,
    sort_order: 1,
    config_json: {
      requirementSource: "certification",
      certificationId,
    },
    active: true,
  };
}

function annualHoursRequirement(id: string, minimumHours: number): RequirementInput {
  return {
    id,
    name: "Iowa EMS CEHs",
    requirement_kind: "annual_hours",
    period_type: "annual",
    minimum_hours: minimumHours,
    category_id: null,
    due_frequency_rule: null,
    required_topic: null,
    sort_order: 2,
    config_json: null,
    active: true,
  };
}

function buildScore(params: {
  requirements: RequirementInput[];
  departmentHours: number;
  certStatuses: Array<{ certificationId: string; certificationName: string; status: "current" | "expiring_soon" | "expired" }>;
}) {
  return buildMemberReadinessScore({
    requirementRows: params.requirements,
    departmentHours: params.departmentHours,
    evaluationDate: "2026-12-31",
    categoryHours: [],
    categoryNameById: new Map(),
    certificationStatuses: params.certStatuses,
    qualificationReadiness: qualificationReady,
    deficiencyItems: [],
    currentMemberId: "member-1",
  });
}

test("Iowa CEH deficiency affects overall readiness score", () => {
  const requirements = [
    recurringCertificationRequirement("req-iowa-cert", "Iowa EMT Certification", "iowa-emt"),
    annualHoursRequirement("req-iowa-ceh", 20),
  ];

  const withCehComplete = buildScore({
    requirements,
    departmentHours: 20,
    certStatuses: [{ certificationId: "iowa-emt", certificationName: "Iowa EMT", status: "current" }],
  });

  const withCehDeficiency = buildScore({
    requirements,
    departmentHours: 0,
    certStatuses: [{ certificationId: "iowa-emt", certificationName: "Iowa EMT", status: "current" }],
  });

  assert.ok(withCehComplete.scorePercent !== null);
  assert.ok(withCehDeficiency.scorePercent !== null);
  assert.ok((withCehDeficiency.scorePercent ?? 0) < (withCehComplete.scorePercent ?? 0));
  assert.equal(withCehDeficiency.factors.some((factor) => factor.id === "req-iowa-ceh" && factor.completed === false), true);
});

test("Iowa certification expiration affects overall readiness score", () => {
  const requirements = [
    recurringCertificationRequirement("req-iowa-cert", "Iowa EMT Certification", "iowa-emt"),
    annualHoursRequirement("req-iowa-ceh", 20),
  ];

  const current = buildScore({
    requirements,
    departmentHours: 20,
    certStatuses: [{ certificationId: "iowa-emt", certificationName: "Iowa EMT", status: "current" }],
  });

  const expired = buildScore({
    requirements,
    departmentHours: 20,
    certStatuses: [{ certificationId: "iowa-emt", certificationName: "Iowa EMT", status: "expired" }],
  });

  assert.ok(current.scorePercent !== null);
  assert.ok(expired.scorePercent !== null);
  assert.ok((expired.scorePercent ?? 0) < (current.scorePercent ?? 0));
  assert.equal(expired.factors.some((factor) => factor.id === "req-iowa-cert" && factor.completed === false), true);
});

test("NREMT maintained + expired affects overall readiness score", () => {
  const requirements = [
    recurringCertificationRequirement("req-iowa-cert", "Iowa EMT Certification", "iowa-emt"),
    recurringCertificationRequirement("req-nremt-cert", "NREMT EMT Certification", "nremt-emt"),
    annualHoursRequirement("req-iowa-ceh", 20),
  ];

  const bothCurrent = buildScore({
    requirements,
    departmentHours: 20,
    certStatuses: [
      { certificationId: "iowa-emt", certificationName: "Iowa EMT", status: "current" },
      { certificationId: "nremt-emt", certificationName: "NREMT EMT", status: "current" },
    ],
  });

  const nremtExpired = buildScore({
    requirements,
    departmentHours: 20,
    certStatuses: [
      { certificationId: "iowa-emt", certificationName: "Iowa EMT", status: "current" },
      { certificationId: "nremt-emt", certificationName: "NREMT EMT", status: "expired" },
    ],
  });

  assert.ok(bothCurrent.scorePercent !== null);
  assert.ok(nremtExpired.scorePercent !== null);
  assert.ok((nremtExpired.scorePercent ?? 0) < (bothCurrent.scorePercent ?? 0));
  assert.equal(nremtExpired.factors.some((factor) => factor.id === "req-nremt-cert" && factor.completed === false), true);
});

test("EMS certification statuses participate in the actual Redline Ready Score calculation", () => {
  const requirements = [
    recurringCertificationRequirement("req-iowa-cert", "Iowa EMT Certification", "iowa-emt"),
    annualHoursRequirement("req-iowa-ceh", 20),
  ];

  const current = buildScore({
    requirements,
    departmentHours: 20,
    certStatuses: [{ certificationId: "iowa-emt", certificationName: "Iowa EMT", status: "current" }],
  });

  const expired = buildScore({
    requirements,
    departmentHours: 20,
    certStatuses: [{ certificationId: "iowa-emt", certificationName: "Iowa EMT", status: "expired" }],
  });

  assert.ok(current.scorePercent !== null);
  assert.ok(expired.scorePercent !== null);
  assert.equal(current.configured, true);
  assert.equal(expired.configured, true);
  assert.ok((current.scorePercent ?? 0) - (expired.scorePercent ?? 0) >= 30);
});

test("General non-EMS certification requirements still work", () => {
  const requirements = [
    recurringCertificationRequirement("req-ff1-cert", "Firefighter 1 Certification", "ff1"),
    annualHoursRequirement("req-training", 12),
  ];

  const current = buildScore({
    requirements,
    departmentHours: 12,
    certStatuses: [{ certificationId: "ff1", certificationName: "Firefighter 1", status: "current" }],
  });

  const expiringSoon = buildScore({
    requirements,
    departmentHours: 12,
    certStatuses: [{ certificationId: "ff1", certificationName: "Firefighter 1", status: "expiring_soon" }],
  });

  const expired = buildScore({
    requirements,
    departmentHours: 12,
    certStatuses: [{ certificationId: "ff1", certificationName: "Firefighter 1", status: "expired" }],
  });

  assert.ok(current.scorePercent !== null);
  assert.ok(expiringSoon.scorePercent !== null);
  assert.ok(expired.scorePercent !== null);
  assert.equal(current.factors.some((factor) => factor.id === "req-ff1-cert" && factor.completed), true);
  assert.ok((expiringSoon.scorePercent ?? 0) < (current.scorePercent ?? 0));
  assert.ok((expiringSoon.scorePercent ?? 0) > (expired.scorePercent ?? 0));
  assert.equal(expiringSoon.factors.some((factor) => factor.id === "req-ff1-cert" && factor.completed === false), true);
  assert.equal(expired.factors.some((factor) => factor.id === "req-ff1-cert" && factor.completed === false), true);
});

test("A valid role with no required qualifications still produces a readiness score", () => {
  const score = buildMemberReadinessScore({
    requirementRows: [
      recurringCertificationRequirement("req-iowa-cert", "Iowa EMT Certification", "iowa-emt"),
      annualHoursRequirement("req-iowa-ceh", 20),
    ],
    departmentHours: 20,
    categoryHours: [],
    categoryNameById: new Map(),
    certificationStatuses: [{ certificationId: "iowa-emt", certificationName: "Iowa EMT", status: "current" }],
    qualificationReadiness: {
      hasAssignedRole: true,
      roleName: "Firefighter",
      requiredQualifications: [],
      completedQualifications: [],
      missingQualifications: [],
    },
    deficiencyItems: [],
    currentMemberId: "member-1",
  });

  assert.equal(score.qualificationsStatus, "no_requirements");
  assert.equal(score.qualificationsScore, 10);
  assert.equal(score.scorePercent, 100);
});
