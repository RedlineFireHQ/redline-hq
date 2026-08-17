export type DepartmentRoleRow = {
  id: string;
  name: string;
  active: boolean;
};

export type CatalogRow = {
  id: string;
  name: string;
  active: boolean | null;
};

export type MemberCertificationRow = {
  certification_id: string;
  expires_at: string | null;
};

export type MemberQualificationRow = {
  qualification_id: string;
};

export type RoleRequiredCertificationRow = {
  department_role_id: string;
  certification_id: string;
};

export type RoleRequiredQualificationRow = {
  department_role_id: string;
  qualification_id: string;
};

export type RoleRequirementStatus =
  | {
      kind: "no_role";
      label: "No role";
      missingCount: 0;
    }
  | {
      kind: "no_requirements";
      label: "No requirements";
      missingCount: 0;
    }
  | {
      kind: "complete";
      label: "Complete";
      missingCount: 0;
    }
  | {
      kind: "missing";
      label: `${number} Missing`;
      missingCount: number;
    };

export type RoleRequirementComparisonItem = {
  id: string;
  name: string;
  isCurrent: boolean;
};

export type RoleRequirementComparison = {
  status: RoleRequirementStatus;
  requiredCertifications: RoleRequirementComparisonItem[];
  requiredQualifications: RoleRequirementComparisonItem[];
};

function parseLocalDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

function getTodayLocalDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function isCertificationCurrent(expiresAt: string | null) {
  if (!expiresAt) {
    return true;
  }

  const parsed = parseLocalDate(expiresAt);
  if (Number.isNaN(parsed.getTime())) {
    return true;
  }

  return parsed.getTime() >= getTodayLocalDate().getTime();
}

export function getRoleRequirementStatus(params: {
  memberDepartmentRoleId: string | null;
  roleRequiredCertifications: RoleRequiredCertificationRow[];
  roleRequiredQualifications: RoleRequiredQualificationRow[];
  memberCertifications: MemberCertificationRow[];
  memberQualifications: MemberQualificationRow[];
}): RoleRequirementStatus {
  const {
    memberDepartmentRoleId,
    roleRequiredCertifications,
    roleRequiredQualifications,
    memberCertifications,
    memberQualifications,
  } = params;

  if (!memberDepartmentRoleId) {
    return { kind: "no_role", label: "No role", missingCount: 0 };
  }

  const currentCertificationIds = new Set(
    memberCertifications
      .filter((record) => isCertificationCurrent(record.expires_at))
      .map((record) => record.certification_id),
  );

  const currentQualificationIds = new Set(memberQualifications.map((record) => record.qualification_id));

  const selectedRoleCertRequirements = roleRequiredCertifications.filter(
    (row) => row.department_role_id === memberDepartmentRoleId,
  );
  const selectedRoleQualRequirements = roleRequiredQualifications.filter(
    (row) => row.department_role_id === memberDepartmentRoleId,
  );

  const requiredCount = selectedRoleCertRequirements.length + selectedRoleQualRequirements.length;
  if (requiredCount === 0) {
    return { kind: "no_requirements", label: "No requirements", missingCount: 0 };
  }

  let missingCount = 0;
  for (const requirement of selectedRoleCertRequirements) {
    if (!currentCertificationIds.has(requirement.certification_id)) {
      missingCount += 1;
    }
  }

  for (const requirement of selectedRoleQualRequirements) {
    if (!currentQualificationIds.has(requirement.qualification_id)) {
      missingCount += 1;
    }
  }

  if (missingCount === 0) {
    return { kind: "complete", label: "Complete", missingCount: 0 };
  }

  return {
    kind: "missing",
    label: `${missingCount} Missing`,
    missingCount,
  };
}

export function getRoleRequirementComparison(params: {
  memberDepartmentRoleId: string | null;
  certificationTypes: CatalogRow[];
  qualificationTypes: CatalogRow[];
  roleRequiredCertifications: RoleRequiredCertificationRow[];
  roleRequiredQualifications: RoleRequiredQualificationRow[];
  memberCertifications: MemberCertificationRow[];
  memberQualifications: MemberQualificationRow[];
}): RoleRequirementComparison {
  const {
    memberDepartmentRoleId,
    certificationTypes,
    qualificationTypes,
    roleRequiredCertifications,
    roleRequiredQualifications,
    memberCertifications,
    memberQualifications,
  } = params;

  const status = getRoleRequirementStatus({
    memberDepartmentRoleId,
    roleRequiredCertifications,
    roleRequiredQualifications,
    memberCertifications,
    memberQualifications,
  });

  const certificationLookup = new Map(certificationTypes.map((row) => [row.id, row.name]));
  const qualificationLookup = new Map(qualificationTypes.map((row) => [row.id, row.name]));

  const currentCertificationIds = new Set(
    memberCertifications
      .filter((record) => isCertificationCurrent(record.expires_at))
      .map((record) => record.certification_id),
  );
  const currentQualificationIds = new Set(memberQualifications.map((record) => record.qualification_id));

  const requiredCertifications = memberDepartmentRoleId
    ? roleRequiredCertifications
        .filter((row) => row.department_role_id === memberDepartmentRoleId)
        .map((row) => ({
          id: row.certification_id,
          name: certificationLookup.get(row.certification_id) ?? "Unknown Certification",
          isCurrent: currentCertificationIds.has(row.certification_id),
        }))
    : [];

  const requiredQualifications = memberDepartmentRoleId
    ? roleRequiredQualifications
        .filter((row) => row.department_role_id === memberDepartmentRoleId)
        .map((row) => ({
          id: row.qualification_id,
          name: qualificationLookup.get(row.qualification_id) ?? "Unknown Qualification",
          isCurrent: currentQualificationIds.has(row.qualification_id),
        }))
    : [];

  return {
    status,
    requiredCertifications,
    requiredQualifications,
  };
}

