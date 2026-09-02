import {
  type CatalogRow,
  type DepartmentRoleRow,
  type MemberCertificationRow,
  type MemberQualificationRow,
  type RoleRequiredCertificationRow,
  type RoleRequiredQualificationRow,
  isCertificationCurrent,
} from "@/lib/role-requirements";

interface RoleRequirementsSectionProps {
  departmentRoles: DepartmentRoleRow[];
  memberDepartmentRoleId: string | null;
  certificationTypes: CatalogRow[];
  qualificationTypes: CatalogRow[];
  memberCertifications: MemberCertificationRow[];
  memberQualifications: MemberQualificationRow[];
  roleRequiredCertifications: RoleRequiredCertificationRow[];
  roleRequiredQualifications: RoleRequiredQualificationRow[];
}

function getRequirementStatusBadge(isCurrent: boolean) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${
        isCurrent
          ? "border-green-500/30 bg-green-500/10 text-green-300"
          : "border-red-500/30 bg-red-500/10 text-red-300"
      }`}
    >
      {isCurrent ? "REQUIRED — CURRENT" : "REQUIRED — MISSING"}
    </span>
  );
}

function RequirementRow({
  name,
  isCurrent,
}: {
  name: string;
  isCurrent: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-neutral-950 px-4 py-3">
      <p className="font-medium text-white">{name}</p>
      {getRequirementStatusBadge(isCurrent)}
    </div>
  );
}

export default function RoleRequirementsSection({
  departmentRoles,
  memberDepartmentRoleId,
  certificationTypes,
  qualificationTypes,
  memberCertifications,
  memberQualifications,
  roleRequiredCertifications,
  roleRequiredQualifications,
}: RoleRequirementsSectionProps) {
  const selectedRole = memberDepartmentRoleId
    ? departmentRoles.find((role) => role.id === memberDepartmentRoleId) ?? null
    : null;

  const certificationLookup = new Map(certificationTypes.map((row) => [row.id, row]));
  const qualificationLookup = new Map(qualificationTypes.map((row) => [row.id, row]));

  const currentCertificationIds = new Set(
    memberCertifications
      .filter((record) => isCertificationCurrent(record.expires_at))
      .map((record) => record.certification_id),
  );

  const currentQualificationIds = new Set(memberQualifications.map((record) => record.qualification_id));

  const selectedRoleCertRequirements = selectedRole
    ? roleRequiredCertifications.filter((row) => row.department_role_id === selectedRole.id)
    : [];
  const selectedRoleQualRequirements = selectedRole
    ? roleRequiredQualifications.filter((row) => row.department_role_id === selectedRole.id)
    : [];

  const hasAnyRequirements = selectedRoleCertRequirements.length > 0 || selectedRoleQualRequirements.length > 0;

  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
      <div className="flex flex-col gap-4 border-b border-neutral-800 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">ROLE REQUIREMENTS</h2>
          <p className="mt-2 max-w-3xl text-sm text-neutral-400">
            Compare the member&apos;s assigned department role against the certifications and qualifications that role requires.
          </p>
        </div>
      </div>

      {!memberDepartmentRoleId ? (
        <div className="mt-5 rounded-xl border border-dashed border-neutral-700 bg-neutral-950 p-8 text-center text-neutral-400">
          No department role assigned.
        </div>
      ) : !selectedRole ? (
        <div className="mt-5 rounded-xl border border-dashed border-neutral-700 bg-neutral-950 p-8 text-center text-neutral-400">
          The assigned department role could not be found.
        </div>
      ) : !hasAnyRequirements ? (
        <div className="mt-5 rounded-xl border border-dashed border-neutral-700 bg-neutral-950 p-8 text-center text-neutral-400">
          No role requirements configured.
        </div>
      ) : (
        <>
          <div className="mt-5 rounded-xl border border-neutral-800 bg-[#111111] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">
              Department Role
            </p>
            <p className="mt-2 text-xl font-semibold text-white">{selectedRole.name}</p>
            {selectedRole.active ? null : (
              <p className="mt-2 text-xs uppercase tracking-[0.16em] text-amber-300">Inactive Role</p>
            )}
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-neutral-800 bg-[#111111] p-5">
              <div className="flex flex-col gap-2 border-b border-neutral-800 pb-4">
                <h3 className="text-xl font-semibold text-white">Required Certifications</h3>
                <p className="text-sm text-neutral-400">Required items are compared against the member&apos;s current certification records.</p>
              </div>

              {selectedRoleCertRequirements.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-neutral-700 bg-neutral-950 p-6 text-center text-sm text-neutral-400">
                  No required certifications for this role.
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {selectedRoleCertRequirements.map((requirement) => {
                    const certification = certificationLookup.get(requirement.certification_id);
                    const isCurrent = currentCertificationIds.has(requirement.certification_id);
                    const displayName = certification?.name ?? "Unknown Certification";

                    return (
                      <RequirementRow
                        key={`${requirement.department_role_id}-${requirement.certification_id}`}
                        name={displayName}
                        isCurrent={isCurrent}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-neutral-800 bg-[#111111] p-5">
              <div className="flex flex-col gap-2 border-b border-neutral-800 pb-4">
                <h3 className="text-xl font-semibold text-white">Required Qualifications</h3>
                <p className="text-sm text-neutral-400">Required items are compared against the member&apos;s earned qualification records.</p>
              </div>

              {selectedRoleQualRequirements.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-neutral-700 bg-neutral-950 p-6 text-center text-sm text-neutral-400">
                  No required qualifications for this role.
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {selectedRoleQualRequirements.map((requirement) => {
                    const qualification = qualificationLookup.get(requirement.qualification_id);
                    const isCurrent = currentQualificationIds.has(requirement.qualification_id);
                    const displayName = qualification?.name ?? "Unknown Qualification";

                    return (
                      <RequirementRow
                        key={`${requirement.department_role_id}-${requirement.qualification_id}`}
                        name={displayName}
                        isCurrent={isCurrent}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
