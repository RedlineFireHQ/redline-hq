import { redirect } from "next/navigation";
import PageLayout from "@/components/layout/PageLayout";
import AddMemberButton from "@/components/personnel/AddMemberButton";
import PersonnelMembersTable from "@/components/personnel/PersonnelMembersTable";
import type { AppPermissionOption } from "@/lib/app-permissions";
import { getCurrentMember } from "@/lib/current-member";
import { canManagePersonnel } from "@/lib/member-permissions";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  buildCanonicalMemberCertificationRows,
  getRoleRequirementStatus,
  type CatalogRow,
  type DepartmentRoleRow,
  type MemberCertificationRow,
  type MemberQualificationRow,
  type RoleRequiredCertificationRow,
  type RoleRequiredQualificationRow,
} from "@/lib/role-requirements";

type PersonnelMemberRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  rank: string | null;
  active: boolean | null;
  status: string | null;
  department_role_id: string | null;
  department_role_name: string | null;
  role_requirement_label: string;
};

type MemberCertificationQueryRow = {
  member_id: string | null;
  certification_id: string | null;
  expires_at: string | null;
};

type MemberQualificationQueryRow = {
  member_id: string | null;
  qualification_id: string | null;
};

export default async function PersonnelPage() {
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);

  if (!currentMember?.departmentId) {
    redirect("/login");
  }

  const hasPersonnelAccess = await canManagePersonnel(
    supabase,
    currentMember.departmentId,
    currentMember.role,
  );

  if (!hasPersonnelAccess) {
    redirect("/");
  }

  const { data, error } = await supabase
    .from("members")
    .select("id, first_name, last_name, rank, active, status, department_role_id")
    .eq("department_id", currentMember.departmentId)
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });
  const [{ data: departmentRolesData }, { data: certificationTypesData }, { data: qualificationTypesData }, { data: memberCertificationsData }, { data: memberQualificationsData }, { data: roleRequiredCertificationsData }, { data: roleRequiredQualificationsData }, { data: appPermissionsData, error: appPermissionsError }] = await Promise.all([
    supabase
      .from("department_roles")
      .select("id, name, active")
      .eq("department_id", currentMember.departmentId),
    supabase
      .from("certifications")
      .select("id, name, active")
      .eq("department_id", currentMember.departmentId),
    supabase
      .from("qualifications")
      .select("id, name, active")
      .eq("department_id", currentMember.departmentId),
    supabase
      .from("member_certifications")
      .select("member_id, certification_id, expires_at")
      .eq("department_id", currentMember.departmentId),
    supabase
      .from("member_qualifications")
      .select("member_id, qualification_id")
      .eq("department_id", currentMember.departmentId),
    supabase
      .from("role_required_certifications")
      .select("department_role_id, certification_id")
      .eq("department_id", currentMember.departmentId),
    supabase
      .from("role_required_qualifications")
      .select("department_role_id, qualification_id")
      .eq("department_id", currentMember.departmentId),
    supabase
      .from("app_permissions")
      .select("key, label, description, active, sort_order")
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true }),
  ]);

  if (appPermissionsError) {
    throw new Error(appPermissionsError.message || "Unable to load app permissions.");
  }

  const permissionOptions: AppPermissionOption[] = (appPermissionsData ?? []).map((row) => ({
    key: typeof row.key === "string" ? row.key : "",
    label: typeof row.label === "string" ? row.label : "",
    description: typeof row.description === "string" ? row.description : null,
    active: typeof row.active === "boolean" ? row.active : true,
    sort_order: typeof row.sort_order === "number" ? row.sort_order : 0,
  })).filter((row) => row.key.length > 0 && row.label.length > 0);

  const departmentRoles: DepartmentRoleRow[] = (departmentRolesData ?? []).map((row) => ({
    id: String(row.id),
    name: typeof row.name === "string" ? row.name : "",
    active: typeof row.active === "boolean" ? row.active : true,
  }));
  const certificationTypes: CatalogRow[] = (certificationTypesData ?? []).map((row) => ({
    id: String(row.id),
    name: typeof row.name === "string" ? row.name : "",
    active: typeof row.active === "boolean" ? row.active : true,
  }));
  const qualificationTypes: CatalogRow[] = (qualificationTypesData ?? []).map((row) => ({
    id: String(row.id),
    name: typeof row.name === "string" ? row.name : "",
    active: typeof row.active === "boolean" ? row.active : true,
  }));

  const memberCertificationsByMemberId = new Map<string, MemberCertificationRow[]>();
  for (const row of (memberCertificationsData ?? []) as MemberCertificationQueryRow[]) {
    if (typeof row.member_id !== "string" || typeof row.certification_id !== "string") {
      continue;
    }

    const currentRows = memberCertificationsByMemberId.get(row.member_id) ?? [];
    currentRows.push({
      certification_id: row.certification_id,
      expires_at: typeof row.expires_at === "string" ? row.expires_at : null,
    });
    memberCertificationsByMemberId.set(row.member_id, currentRows);
  }

  const memberQualificationsByMemberId = new Map<string, MemberQualificationRow[]>();
  for (const row of (memberQualificationsData ?? []) as MemberQualificationQueryRow[]) {
    if (typeof row.member_id !== "string" || typeof row.qualification_id !== "string") {
      continue;
    }

    const currentRows = memberQualificationsByMemberId.get(row.member_id) ?? [];
    currentRows.push({
      qualification_id: row.qualification_id,
    });
    memberQualificationsByMemberId.set(row.member_id, currentRows);
  }

  const roleRequiredCertifications: RoleRequiredCertificationRow[] = (roleRequiredCertificationsData ?? []).map((row) => ({
    department_role_id: typeof row.department_role_id === "string" ? row.department_role_id : "",
    certification_id: typeof row.certification_id === "string" ? row.certification_id : "",
  }));

  const roleRequiredQualifications: RoleRequiredQualificationRow[] = (roleRequiredQualificationsData ?? []).map((row) => ({
    department_role_id: typeof row.department_role_id === "string" ? row.department_role_id : "",
    qualification_id: typeof row.qualification_id === "string" ? row.qualification_id : "",
  }));

  const effectiveMemberCertifications = buildCanonicalMemberCertificationRows({
    certificationTypes,
    qualificationTypes,
    memberCertifications: Array.from(memberCertificationsByMemberId.entries()).flatMap(([memberId, rows]) =>
      rows.map((row) => ({
        member_id: memberId,
        certification_id: row.certification_id,
        expires_at: row.expires_at,
      })),
    ),
    memberQualifications: Array.from(memberQualificationsByMemberId.entries()).flatMap(([memberId, rows]) =>
      rows.map((row) => ({
        member_id: memberId,
        qualification_id: row.qualification_id,
      })),
    ),
  });

  const effectiveMemberCertificationsByMemberId = new Map<string, MemberCertificationRow[]>();
  for (const row of effectiveMemberCertifications) {
    if (!row.member_id) {
      continue;
    }

    const currentRows = effectiveMemberCertificationsByMemberId.get(row.member_id) ?? [];
    currentRows.push({
      certification_id: row.certification_id,
      expires_at: row.expires_at,
    });
    effectiveMemberCertificationsByMemberId.set(row.member_id, currentRows);
  }

  const departmentRoleLookup = new Map(departmentRoles.map((role) => [role.id, role.name]));

  if (error) {
    throw new Error(error.message || "Unable to load personnel members.");
  }

  const members: PersonnelMemberRow[] = (data ?? []).map((row) => ({
    id: String(row.id),
    first_name: typeof row.first_name === "string" ? row.first_name : null,
    last_name: typeof row.last_name === "string" ? row.last_name : null,
    rank: typeof row.rank === "string" ? row.rank : null,
    active: typeof row.active === "boolean" ? row.active : null,
    status: typeof row.status === "string" ? row.status : null,
    department_role_id: typeof row.department_role_id === "string" ? row.department_role_id : null,
    department_role_name:
      typeof row.department_role_id === "string"
        ? departmentRoleLookup.get(row.department_role_id) ?? null
        : null,
    role_requirement_label: getRoleRequirementStatus({
      memberDepartmentRoleId: typeof row.department_role_id === "string" ? row.department_role_id : null,
      certificationTypes,
      qualificationTypes,
      roleRequiredCertifications,
      roleRequiredQualifications,
      memberCertifications: effectiveMemberCertificationsByMemberId.get(String(row.id)) ?? [],
      memberQualifications: memberQualificationsByMemberId.get(String(row.id)) ?? [],
    }).label,
  }));

  return (
    <PageLayout
      environmentBackgroundUrl="/branding/images/Personnelpage.png"
      environmentBackgroundPosition="left center"
    >
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold">Personnel</h1>

          <p className="mt-2 text-neutral-400">
            Manage firefighters, officers, certifications, and availability.
          </p>
        </div>

        <AddMemberButton
          permissionOptions={permissionOptions}
          departmentId={currentMember.departmentId}
          currentMemberId={currentMember.id}
        />
      </div>

      <PersonnelMembersTable members={members} />
    </PageLayout>
  );
}