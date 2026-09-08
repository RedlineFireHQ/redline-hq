import assert from "node:assert/strict";
import test from "node:test";

import { calculateComplianceBucketHours, getTrainingComplianceBucketByCategoryName } from "@/lib/training/compliance-buckets";
import { buildMemberReadinessScore, type RequirementInput } from "@/lib/readiness/member-readiness";
import { buildScoredCertificationStatuses } from "@/lib/readiness/scored-certifications";
import {
  buildQualificationReadinessAdapter,
  type CatalogRow,
  type MemberCertificationRow,
  type MemberQualificationRow,
  type RoleRequiredCertificationRow,
  type RoleRequiredQualificationRow,
} from "@/lib/role-requirements";

const roleId = "firefighter";
const certificationTypes: CatalogRow[] = [
  { id: "ff1-cert", name: "Firefighter 1", active: true },
  { id: "hazmat-cert", name: "Hazmat Awareness", active: true },
  { id: "iowa-emt", name: "Iowa EMT", active: true },
];
const qualificationTypes: CatalogRow[] = [
  { id: "rope-qual", name: "Rope Rescue Qualified", active: true },
];

function annualRequirement(): RequirementInput {
  return {
    id: "annual-fire",
    name: "Annual Fire Training",
    requirement_kind: "annual_hours",
    period_type: "annual",
    minimum_hours: 0,
    category_id: null,
    due_frequency_rule: null,
    required_topic: null,
    sort_order: 1,
    config_json: null,
    active: true,
  };
}

function roleRequiredCertification(certificationId: string): RoleRequiredCertificationRow {
  return { department_role_id: roleId, certification_id: certificationId };
}

function roleRequiredQualification(qualificationId: string): RoleRequiredQualificationRow {
  return { department_role_id: roleId, qualification_id: qualificationId };
}

function buildScore(input: {
  certificationStatuses?: Array<{
    certificationId: string;
    certificationName: string;
    status: "current" | "expiring_soon" | "expired";
  }>;
  scoredCertificationStatuses?: Array<{
    certificationId: string;
    certificationName: string;
    status: "current" | "expiring_soon" | "expired";
    expiresAt?: string | null;
  }>;
  qualificationReadiness: {
    requiredQualifications: string[];
    completedQualifications: string[];
    missingQualifications: string[];
    hasAssignedRole?: boolean;
  };
}) {
  return buildMemberReadinessScore({
    requirementRows: [annualRequirement()],
    departmentHours: 0,
    categoryHours: [],
    categoryNameById: new Map(),
    certificationStatuses: input.certificationStatuses,
    scoredCertificationStatuses: input.scoredCertificationStatuses,
    qualificationReadiness: {
      hasAssignedRole: input.qualificationReadiness.hasAssignedRole ?? true,
      roleName: "Firefighter",
      requiredQualifications: input.qualificationReadiness.requiredQualifications,
      completedQualifications: input.qualificationReadiness.completedQualifications,
      missingQualifications: input.qualificationReadiness.missingQualifications,
    },
    deficiencyItems: [],
    currentMemberId: "member-1",
  });
}

function buildCredentialReadiness(input: {
  roleRequiredCertifications?: RoleRequiredCertificationRow[];
  roleRequiredQualifications?: RoleRequiredQualificationRow[];
  memberCertifications?: MemberCertificationRow[];
  memberQualifications?: MemberQualificationRow[];
}) {
  return buildQualificationReadinessAdapter({
    memberDepartmentRoleId: roleId,
    certificationTypes,
    qualificationTypes,
    roleRequiredCertifications: input.roleRequiredCertifications ?? [],
    roleRequiredQualifications: input.roleRequiredQualifications ?? [],
    memberCertifications: input.memberCertifications ?? [],
    memberQualifications: input.memberQualifications ?? [],
  });
}

test("role-required expiring certification scores in Certifications and Currency only", () => {
  const readiness = buildCredentialReadiness({
    roleRequiredCertifications: [roleRequiredCertification("ff1-cert")],
    memberCertifications: [{ certification_id: "ff1-cert", expires_at: "2027-01-01" }],
  });
  const score = buildScore({
    certificationStatuses: [{ certificationId: "ff1-cert", certificationName: "Firefighter 1", status: "current" }],
    scoredCertificationStatuses: [{ certificationId: "ff1-cert", certificationName: "Firefighter 1", status: "current", expiresAt: "2027-01-01" }],
    qualificationReadiness: readiness,
  });

  assert.equal(score.factors.find((factor) => factor.category === "certification")?.completionPercent, 100);
  assert.equal(score.qualificationsScore, 10);
});

test("role-required non-expiring qualification scores in Qualifications only", () => {
  const readiness = buildCredentialReadiness({
    roleRequiredQualifications: [roleRequiredQualification("rope-qual")],
    memberQualifications: [{ qualification_id: "rope-qual" }],
  });
  const score = buildScore({
    scoredCertificationStatuses: [],
    qualificationReadiness: readiness,
  });

  assert.equal(score.qualificationsScore, 10);
  assert.equal(score.factors.some((factor) => factor.category === "certification"), false);
});

test("a non-expiring member certification cannot satisfy both readiness buckets", () => {
  const readiness = buildCredentialReadiness({
    roleRequiredCertifications: [roleRequiredCertification("ff1-cert")],
    memberCertifications: [{ certification_id: "ff1-cert", expires_at: null }],
  });
  const scoredCertificationStatuses = buildScoredCertificationStatuses({
    memberDepartmentRoleId: roleId,
    certificationStatuses: [
      {
        certificationId: "ff1-cert",
        certificationName: "Firefighter 1",
        status: "current",
        authority: null,
        expiresAt: null,
      },
    ],
    roleRequiredCertifications: [roleRequiredCertification("ff1-cert")],
    includeIowaAuthority: false,
    includeNremtAuthority: false,
  });
  const score = buildScore({
    certificationStatuses: [{ certificationId: "ff1-cert", certificationName: "Firefighter 1", status: "current" }],
    scoredCertificationStatuses,
    qualificationReadiness: readiness,
  });

  assert.equal(score.factors.filter((factor) => factor.category === "certification").length, 0);
  assert.equal(score.qualificationsScore, 10);
});

test("role with certification requirements but no qualification requirements keeps the qualification bucket complete", () => {
  const readiness = buildCredentialReadiness({
    roleRequiredCertifications: [roleRequiredCertification("ff1-cert")],
    memberCertifications: [{ certification_id: "ff1-cert", expires_at: "2027-01-01" }],
  });
  const score = buildScore({
    certificationStatuses: [{ certificationId: "ff1-cert", certificationName: "Firefighter 1", status: "current" }],
    scoredCertificationStatuses: [{ certificationId: "ff1-cert", certificationName: "Firefighter 1", status: "current", expiresAt: "2027-01-01" }],
    qualificationReadiness: readiness,
  });

  assert.equal(score.qualificationsScore, 10);
});

test("role with qualification requirements but no certification requirements scores the qualification bucket", () => {
  const readiness = buildCredentialReadiness({
    roleRequiredQualifications: [roleRequiredQualification("rope-qual")],
    memberQualifications: [{ qualification_id: "rope-qual" }],
  });
  const score = buildScore({
    scoredCertificationStatuses: [],
    qualificationReadiness: readiness,
  });

  assert.equal(score.qualificationsScore, 10);
  assert.equal(score.factors.filter((factor) => factor.category === "certification").length, 0);
});

test("role with no requirements gives full qualification-bucket credit", () => {
  const readiness = buildCredentialReadiness({});
  const score = buildScore({
    scoredCertificationStatuses: [],
    qualificationReadiness: readiness,
  });

  assert.deepEqual(readiness.requiredQualifications, []);
  assert.equal(score.qualificationsStatus, "no_requirements");
  assert.equal(score.qualificationsScore, 10);
});

test("currently valid expiring certification is not completed as a non-expiring qualification", () => {
  const readiness = buildCredentialReadiness({
    roleRequiredQualifications: [roleRequiredQualification("rope-qual")],
    memberCertifications: [{ certification_id: "ff1-cert", expires_at: "2027-01-01" }],
  });

  assert.deepEqual(readiness.completedQualifications, []);
  assert.deepEqual(readiness.missingQualifications, ["Rope Rescue Qualified"]);
});

test("EMS certification validity remains in the 40% certification scope", () => {
  const current = buildScoredCertificationStatuses({
    memberDepartmentRoleId: roleId,
    certificationStatuses: [{ certificationId: "iowa-emt", certificationName: "Iowa EMT", status: "current", authority: "iowa" }],
    roleRequiredCertifications: [],
    includeIowaAuthority: true,
    includeNremtAuthority: false,
  });
  const expired = buildScoredCertificationStatuses({
    memberDepartmentRoleId: roleId,
    certificationStatuses: [{ certificationId: "iowa-emt", certificationName: "Iowa EMT", status: "expired", authority: "iowa" }],
    roleRequiredCertifications: [],
    includeIowaAuthority: true,
    includeNremtAuthority: false,
  });

  assert.equal(current.length, 1);
  assert.equal(current[0]?.status, "current");
  assert.equal(expired[0]?.status, "expired");
});

test("EMS continuing education is separate from fire annual training", () => {
  const totals = calculateComplianceBucketHours(
    [
      { categoryId: "ems", hours: 20 },
      { categoryId: "fire-suppression", hours: 20 },
    ],
    new Map([
      ["ems", "EMS"],
      ["fire-suppression", "Fire Suppression"],
    ]),
  );

  assert.equal(totals.emsContinuingEducationHours, 20);
  assert.equal(totals.fireAnnualHours, 20);
});

test("EMS flag/category mismatch documents the current category-authoritative behavior", () => {
  assert.equal(getTrainingComplianceBucketByCategoryName("Fire Suppression"), "fire_annual");
  assert.equal(getTrainingComplianceBucketByCategoryName("EMS"), "ems_ce");
  // The current bucket API has no is_ems_training input; category name is authoritative.
});
