import assert from "node:assert/strict";
import test from "node:test";

import {
  buildQualificationReadinessAdapter,
  getRoleRequirementComparison,
  getRoleRequirementStatus,
  type CatalogRow,
  type MemberCertificationRow,
  type MemberQualificationRow,
  type RoleRequiredCertificationRow,
  type RoleRequiredQualificationRow,
} from "@/lib/role-requirements";

const certificationTypes: CatalogRow[] = [
  { id: "ff1-cert", name: "Firefighter 1", active: true },
  { id: "hazaw-cert", name: "HazMat Awareness", active: true },
];

const qualificationTypes: CatalogRow[] = [
  { id: "ff1-qual", name: "Firefighter 1", active: true },
  { id: "hazaw-qual", name: "HazMat Awareness", active: true },
];

const roleRequiredCertifications: RoleRequiredCertificationRow[] = [
  { department_role_id: "firefighter", certification_id: "ff1-cert" },
  { department_role_id: "firefighter", certification_id: "hazaw-cert" },
];

const roleRequiredQualifications: RoleRequiredQualificationRow[] = [
  { department_role_id: "firefighter", qualification_id: "ff1-qual" },
];

test("non-expiring certification satisfies matching certification requirement", () => {
  const memberCertifications: MemberCertificationRow[] = [
    { certification_id: "ff1-cert", expires_at: null },
  ];

  const result = getRoleRequirementComparison({
    memberDepartmentRoleId: "firefighter",
    certificationTypes,
    qualificationTypes,
    roleRequiredCertifications,
    roleRequiredQualifications,
    memberCertifications,
    memberQualifications: [],
  });

  assert.deepEqual(
    result.requiredCertifications.map((row) => ({ name: row.name, isCurrent: row.isCurrent })),
    [
      { name: "Firefighter 1", isCurrent: true },
      { name: "HazMat Awareness", isCurrent: false },
    ],
  );
  assert.equal(result.requiredQualifications.length, 0);
});

test("legacy qualification row still satisfies matching certification requirement by name", () => {
  const memberQualifications: MemberQualificationRow[] = [
    { qualification_id: "ff1-qual" },
  ];

  const status = getRoleRequirementStatus({
    memberDepartmentRoleId: "firefighter",
    certificationTypes,
    qualificationTypes,
    roleRequiredCertifications,
    roleRequiredQualifications,
    memberCertifications: [],
    memberQualifications,
  });

  assert.equal(status.kind, "missing");
  assert.equal(status.missingCount, 1);
});

test("qualification readiness adapter uses only non-expiring certifications for qualification completion", () => {
  const readiness = buildQualificationReadinessAdapter({
    memberDepartmentRoleId: "firefighter",
    certificationTypes,
    qualificationTypes,
    roleRequiredCertifications,
    roleRequiredQualifications,
    memberCertifications: [
      { certification_id: "ff1-cert", expires_at: null },
      { certification_id: "hazaw-cert", expires_at: "2028-01-01" },
    ],
    memberQualifications: [],
  });

  assert.deepEqual(readiness.requiredQualifications, ["Firefighter 1", "HazMat Awareness"]);
  assert.deepEqual(readiness.completedQualifications, ["Firefighter 1"]);
  assert.deepEqual(readiness.missingQualifications, ["HazMat Awareness"]);
});