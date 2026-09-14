import { redirect } from "next/navigation";
import CertificationTypesSection from "@/components/settings/CertificationTypesSection";
import RoleRequirementsSection from "@/components/settings/RoleRequirementsSection";
import { getCurrentMember } from "@/lib/current-member";
import { hasDepartmentPermission } from "@/lib/member-permissions";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type CertificationTypeRow = {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type DepartmentRoleRow = {
  id: string;
  name: string;
  code: string;
  active: boolean;
  sort_order: number;
};

type RoleRequiredCertificationRow = {
  id: string;
  department_id: string;
  department_role_id: string;
  certification_id: string;
  created_at: string;
  updated_at: string;
};

export default async function CertificationManagementPage() {
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);

  if (!currentMember?.departmentId) {
    redirect("/login");
  }

  const hasCertificationAccess = await hasDepartmentPermission(
    supabase,
    currentMember.departmentId,
    currentMember.role,
    "certification_management",
  );

  if (!hasCertificationAccess) {
    redirect("/");
  }

  const [certificationResult, roleResult, requirementResult] = await Promise.all([
    supabase
      .from("certifications")
      .select("id, name, active, created_at, updated_at")
      .eq("department_id", currentMember.departmentId)
      .order("name", { ascending: true }),
    supabase
      .from("department_roles")
      .select("id, name, code, active, sort_order")
      .eq("department_id", currentMember.departmentId)
      .order("active", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("role_required_certifications")
      .select("id, department_id, department_role_id, certification_id, created_at, updated_at")
      .eq("department_id", currentMember.departmentId)
      .order("department_role_id", { ascending: true })
      .order("certification_id", { ascending: true }),
  ]);

  if (certificationResult.error) {
    throw new Error(certificationResult.error.message || "Unable to load certifications.");
  }
  if (roleResult.error) {
    throw new Error(roleResult.error.message || "Unable to load department roles.");
  }
  if (requirementResult.error) {
    throw new Error(requirementResult.error.message || "Unable to load role requirements.");
  }

  const certificationTypes = (certificationResult.data ?? []) as CertificationTypeRow[];
  const departmentRoles = (roleResult.data ?? []) as DepartmentRoleRow[];
  const roleRequiredCertifications = (requirementResult.data ?? []) as RoleRequiredCertificationRow[];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-red-500">Management</p>
        <h1 className="mt-2 text-[2.25rem] font-bold leading-none tracking-[-0.06em] text-white">Certification Management</h1>
        <p className="mt-3 max-w-3xl text-lg text-neutral-400">Manage the certification catalog and the certifications required for department roles.</p>
      </div>

      <CertificationTypesSection
        departmentId={currentMember.departmentId}
        currentMemberId={currentMember.id}
        certificationTypes={certificationTypes}
      />
      <RoleRequirementsSection
        departmentId={currentMember.departmentId}
        currentMemberId={currentMember.id}
        departmentRoles={departmentRoles}
        certifications={certificationTypes}
        roleRequiredCertifications={roleRequiredCertifications}
      />
    </div>
  );
}
