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
  id?: string;
  member_id?: string;
  certification_id: string;
  certificate_number?: string | null;
  issued_at?: string;
  expires_at: string | null;
  supporting_document_id?: string | null;
  notes?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type MemberQualificationRow = {
  id?: string;
  member_id?: string;
  qualification_id: string;
  earned_at?: string;
  certificate_number?: string | null;
  notes?: string | null;
  supporting_document_id?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
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

export type QualificationReadinessAdapter = {
  requiredQualifications: string[];
  completedQualifications: string[];
  missingQualifications: string[];
};

export type CanonicalMemberCertificationRow = MemberCertificationRow & {
  sourceTable: "member_certifications" | "member_qualifications";
};

function parseLocalDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

function getTodayLocalDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function normalizeRequirementName(value: string) {
  return value.trim().toLowerCase();
}

export function buildCanonicalMemberCertificationRows(params: {
  certificationTypes: CatalogRow[];
  qualificationTypes: CatalogRow[];
  memberCertifications: MemberCertificationRow[];
  memberQualifications: MemberQualificationRow[];
}): CanonicalMemberCertificationRow[] {
  const certificationLookup = new Map(params.certificationTypes.map((row) => [row.id, row.name]));
  const qualificationLookup = new Map(params.qualificationTypes.map((row) => [row.id, row.name]));
  const certificationIdsByNormalizedName = new Map<string, string[]>();

  for (const certification of params.certificationTypes) {
    const normalizedName = normalizeRequirementName(certification.name);
    if (!normalizedName) {
      continue;
    }

    const current = certificationIdsByNormalizedName.get(normalizedName) ?? [];
    current.push(certification.id);
    certificationIdsByNormalizedName.set(normalizedName, current);
  }

  const canonicalRows: CanonicalMemberCertificationRow[] = params.memberCertifications.map((row) => ({
    ...row,
    sourceTable: "member_certifications",
  }));

  const seenCertificationIds = new Set(canonicalRows.map((row) => row.certification_id));
  const seenNormalizedNames = new Set(
    canonicalRows
      .map((row) => certificationLookup.get(row.certification_id) ?? "")
      .map(normalizeRequirementName)
      .filter((value) => value.length > 0),
  );

  for (const qualification of params.memberQualifications) {
    const qualificationName = qualificationLookup.get(qualification.qualification_id) ?? "";
    const normalizedName = normalizeRequirementName(qualificationName);
    if (!normalizedName) {
      continue;
    }

    const matchingCertificationIds = certificationIdsByNormalizedName.get(normalizedName) ?? [];
    if (matchingCertificationIds.length !== 1) {
      continue;
    }

    const certificationId = matchingCertificationIds[0];
    if (seenCertificationIds.has(certificationId) || seenNormalizedNames.has(normalizedName)) {
      continue;
    }

    canonicalRows.push({
      id: qualification.id ? `legacy:${qualification.id}` : `legacy:${qualification.qualification_id}`,
      member_id: qualification.member_id,
      certification_id: certificationId,
      certificate_number: qualification.certificate_number ?? null,
      issued_at: qualification.earned_at ?? qualification.created_at ?? "",
      expires_at: null,
      supporting_document_id: qualification.supporting_document_id ?? null,
      notes: qualification.notes ?? null,
      created_by: qualification.created_by ?? null,
      updated_by: qualification.updated_by ?? null,
      created_at: qualification.created_at ?? null,
      updated_at: qualification.updated_at ?? null,
      sourceTable: "member_qualifications",
    });
    seenCertificationIds.add(certificationId);
    seenNormalizedNames.add(normalizedName);
  }

  return canonicalRows;
}

function buildRoleRequirementState(params: {
  memberDepartmentRoleId: string | null;
  certificationTypes: CatalogRow[];
  qualificationTypes: CatalogRow[];
  roleRequiredCertifications: RoleRequiredCertificationRow[];
  roleRequiredQualifications: RoleRequiredQualificationRow[];
  memberCertifications: MemberCertificationRow[];
  memberQualifications: MemberQualificationRow[];
}) {
  const certificationLookup = new Map(params.certificationTypes.map((row) => [row.id, row.name]));
  const qualificationLookup = new Map(params.qualificationTypes.map((row) => [row.id, row.name]));
  const canonicalMemberCertifications = buildCanonicalMemberCertificationRows({
    certificationTypes: params.certificationTypes,
    qualificationTypes: params.qualificationTypes,
    memberCertifications: params.memberCertifications,
    memberQualifications: params.memberQualifications,
  });

  const currentCertificationIds = new Set(
    canonicalMemberCertifications
      .filter((record) => isCertificationCurrent(record.expires_at))
      .map((record) => record.certification_id),
  );
  const currentCertificationNames = new Set(
    canonicalMemberCertifications
      .filter((record) => isCertificationCurrent(record.expires_at))
      .map((record) => certificationLookup.get(record.certification_id) ?? "")
      .map(normalizeRequirementName)
      .filter((value) => value.length > 0),
  );
  const currentNonExpiringCertificationNames = new Set(
    canonicalMemberCertifications
      .filter((record) => record.expires_at === null)
      .map((record) => certificationLookup.get(record.certification_id) ?? "")
      .map(normalizeRequirementName)
      .filter((value) => value.length > 0),
  );

  const currentQualificationIds = new Set(params.memberQualifications.map((record) => record.qualification_id));
  const currentQualificationNames = new Set(
    params.memberQualifications
      .map((record) => qualificationLookup.get(record.qualification_id) ?? "")
      .map(normalizeRequirementName)
      .filter((value) => value.length > 0),
  );

  const selectedRoleCertRequirements = params.memberDepartmentRoleId
    ? params.roleRequiredCertifications
        .filter((row) => row.department_role_id === params.memberDepartmentRoleId)
        .map((row) => {
          const name = certificationLookup.get(row.certification_id) ?? "Unknown Certification";
          const normalizedName = normalizeRequirementName(name);
          return {
            id: row.certification_id,
            name,
            normalizedName,
            isCurrent: currentCertificationIds.has(row.certification_id),
          };
        })
    : [];

  const certificationRequirementNames = new Set(
    selectedRoleCertRequirements.map((row) => row.normalizedName).filter((value) => value.length > 0),
  );

  const selectedRoleQualRequirements = params.memberDepartmentRoleId
    ? params.roleRequiredQualifications
        .filter((row) => row.department_role_id === params.memberDepartmentRoleId)
        .map((row) => {
          const name = qualificationLookup.get(row.qualification_id) ?? "Unknown Qualification";
          const normalizedName = normalizeRequirementName(name);
          return {
            id: row.qualification_id,
            name,
            normalizedName,
            isCurrent:
              currentQualificationIds.has(row.qualification_id) ||
              currentCertificationNames.has(normalizedName),
          };
        })
        .filter((row) => !certificationRequirementNames.has(row.normalizedName))
    : [];

  return {
    selectedRoleCertRequirements,
    selectedRoleQualRequirements,
    currentQualificationNames,
    currentNonExpiringCertificationNames,
  };
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
  certificationTypes?: CatalogRow[];
  qualificationTypes?: CatalogRow[];
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

  const state = buildRoleRequirementState({
    memberDepartmentRoleId,
    certificationTypes: params.certificationTypes ?? [],
    qualificationTypes: params.qualificationTypes ?? [],
    roleRequiredCertifications,
    roleRequiredQualifications,
    memberCertifications,
    memberQualifications,
  });

  const selectedRoleCertRequirements = state.selectedRoleCertRequirements;
  const selectedRoleQualRequirements = state.selectedRoleQualRequirements;

  const requiredCount = selectedRoleCertRequirements.length + selectedRoleQualRequirements.length;
  if (requiredCount === 0) {
    return { kind: "no_requirements", label: "No requirements", missingCount: 0 };
  }

  const missingCount = selectedRoleCertRequirements.filter((row) => !row.isCurrent).length +
    selectedRoleQualRequirements.filter((row) => !row.isCurrent).length;

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
    certificationTypes,
    qualificationTypes,
    roleRequiredCertifications,
    roleRequiredQualifications,
    memberCertifications,
    memberQualifications,
  });

  const state = buildRoleRequirementState({
    memberDepartmentRoleId,
    certificationTypes,
    qualificationTypes,
    roleRequiredCertifications,
    roleRequiredQualifications,
    memberCertifications,
    memberQualifications,
  });

  const requiredCertifications = state.selectedRoleCertRequirements.map((row) => ({
    id: row.id,
    name: row.name,
    isCurrent: row.isCurrent,
  }));

  const requiredQualifications = state.selectedRoleQualRequirements.map((row) => ({
    id: row.id,
    name: row.name,
    isCurrent: row.isCurrent,
  }));

  return {
    status,
    requiredCertifications,
    requiredQualifications,
  };
}

export function buildQualificationReadinessAdapter(params: {
  memberDepartmentRoleId: string | null;
  certificationTypes: CatalogRow[];
  qualificationTypes: CatalogRow[];
  roleRequiredCertifications: RoleRequiredCertificationRow[];
  roleRequiredQualifications: RoleRequiredQualificationRow[];
  memberCertifications: MemberCertificationRow[];
  memberQualifications: MemberQualificationRow[];
}): QualificationReadinessAdapter {
  const state = buildRoleRequirementState(params);
  const nonExpiringCertificationIds = new Set(
    params.memberCertifications
      .filter((record) => record.expires_at === null)
      .map((record) => record.certification_id),
  );

  const requiredNames = new Map<string, string>();
  for (const requirement of state.selectedRoleCertRequirements) {
    if (
      requirement.normalizedName.length > 0 &&
      nonExpiringCertificationIds.has(requirement.id)
    ) {
      requiredNames.set(requirement.normalizedName, requirement.name);
    }
  }

  for (const requirement of state.selectedRoleQualRequirements) {
    if (requirement.normalizedName.length > 0 && !requiredNames.has(requirement.normalizedName)) {
      requiredNames.set(requirement.normalizedName, requirement.name);
    }
  }

  const completedNames = new Map<string, string>();
  for (const [normalizedName, displayName] of requiredNames) {
    if (
      state.currentNonExpiringCertificationNames.has(normalizedName) ||
      state.currentQualificationNames.has(normalizedName)
    ) {
      completedNames.set(normalizedName, displayName);
    }
  }

  return {
    requiredQualifications: Array.from(requiredNames.values()),
    completedQualifications: Array.from(completedNames.values()),
    missingQualifications: Array.from(requiredNames.entries())
      .filter(([normalizedName]) => !completedNames.has(normalizedName))
      .map(([, displayName]) => displayName),
  };
}

