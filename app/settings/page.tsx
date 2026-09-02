import { redirect } from "next/navigation";
import PageLayout from "@/components/layout/PageLayout";
import CertificationTypesSection from "@/components/settings/CertificationTypesSection";
import DepartmentRolesSection from "@/components/settings/DepartmentRolesSection";
import RoleRequirementsSection from "@/components/settings/RoleRequirementsSection";
import ReadinessRequirementsSection from "@/components/settings/ReadinessRequirementsSection";
import TrainingCategoriesSection from "@/components/settings/TrainingCategoriesSection";
import ApparatusInspectionSettingsSection from "@/components/settings/ApparatusInspectionSettingsSection";
import { getCurrentMember } from "@/lib/current-member";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type CertificationTypeRow = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  ems_authority: "iowa" | "nremt" | null;
  ems_certification_level: "emr" | "emt" | "aemt" | "paramedic" | null;
  created_at: string;
  updated_at: string;
};

type QualificationRow = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type TrainingCategoryRow = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type RoleRequiredCertificationRow = {
  id: string;
  department_id: string;
  department_role_id: string;
  certification_id: string;
  created_at: string;
  updated_at: string;
};

type RoleRequiredQualificationRow = {
  id: string;
  department_id: string;
  department_role_id: string;
  qualification_id: string;
  created_at: string;
  updated_at: string;
};

type DepartmentRoleRow = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type ReadinessRequirementRow = {
  id: string;
  name: string;
  requirement_kind: string;
  period_type: string;
  minimum_hours: number | string | null;
  category_id: string | null;
  due_frequency_rule: string | null;
  required_topic: string | null;
  active: boolean;
  sort_order: number;
  config_json: unknown;
  created_at: string;
  updated_at: string;
};

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);

  if (!currentMember?.departmentId) {
    redirect("/login");
  }

  if (currentMember.role !== "administrator") {
    redirect("/");
  }

  const [
    { data: certificationData, error: certificationError },
    { data: qualificationData, error: qualificationError },
    { data: trainingCategoryData, error: trainingCategoryError },
    { data: departmentRoleData, error: departmentRoleError },
    { data: roleRequiredCertificationData, error: roleRequiredCertificationError },
    { data: roleRequiredQualificationData, error: roleRequiredQualificationError },
    { data: requirementsData, error: requirementsError },
    { data: apparatusInspectionSettingsData, error: apparatusInspectionSettingsError },
  ] = await Promise.all([
    supabase
      .from("certifications")
      .select("id, name, description, active, ems_authority, ems_certification_level, created_at, updated_at")
      .eq("department_id", currentMember.departmentId)
      .order("name", { ascending: true }),
    supabase
      .from("qualifications")
      .select("id, name, description, active, created_at, updated_at")
      .eq("department_id", currentMember.departmentId)
      .order("name", { ascending: true }),
    supabase
      .from("training_categories")
      .select("id, name, description, active, created_at, updated_at")
      .eq("department_id", currentMember.departmentId)
      .order("active", { ascending: false })
      .order("created_at", { ascending: true }),
    supabase
      .from("department_roles")
      .select("id, name, code, description, active, sort_order, created_at, updated_at")
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
    supabase
      .from("role_required_qualifications")
      .select("id, department_id, department_role_id, qualification_id, created_at, updated_at")
      .eq("department_id", currentMember.departmentId)
      .order("department_role_id", { ascending: true })
      .order("qualification_id", { ascending: true }),
    supabase
      .from("training_requirements")
      .select("id, name, requirement_kind, period_type, minimum_hours, category_id, due_frequency_rule, required_topic, active, sort_order, config_json, created_at, updated_at")
      .eq("department_id", currentMember.departmentId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("apparatus_inspection_settings")
      .select("require_checklist")
      .eq("department_id", currentMember.departmentId)
      .maybeSingle(),
  ]);

  if (certificationError) {
    throw new Error(certificationError.message || "Unable to load certification types.");
  }

  if (qualificationError) {
    throw new Error(qualificationError.message || "Unable to load qualifications.");
  }

  if (trainingCategoryError) {
    throw new Error(trainingCategoryError.message || "Unable to load training categories.");
  }

  if (departmentRoleError) {
    throw new Error(departmentRoleError.message || "Unable to load department roles.");
  }

  if (roleRequiredCertificationError) {
    throw new Error(roleRequiredCertificationError.message || "Unable to load required certifications.");
  }

  if (roleRequiredQualificationError) {
    throw new Error(roleRequiredQualificationError.message || "Unable to load required qualifications.");
  }

  if (requirementsError) {
    throw new Error(requirementsError.message || "Unable to load readiness requirements.");
  }

  if (apparatusInspectionSettingsError) {
    throw new Error(apparatusInspectionSettingsError.message || "Unable to load apparatus inspection settings.");
  }

  const certificationTypes: CertificationTypeRow[] = (certificationData ?? []).map((row) => ({
    id: String(row.id),
    name: typeof row.name === "string" ? row.name : "",
    description: typeof row.description === "string" ? row.description : null,
    active: typeof row.active === "boolean" ? row.active : true,
    ems_authority: row.ems_authority === "iowa" || row.ems_authority === "nremt" ? row.ems_authority : null,
    ems_certification_level:
      row.ems_certification_level === "emr" ||
      row.ems_certification_level === "emt" ||
      row.ems_certification_level === "aemt" ||
      row.ems_certification_level === "paramedic"
        ? row.ems_certification_level
        : null,
    created_at: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
    updated_at: typeof row.updated_at === "string" ? row.updated_at : new Date().toISOString(),
  }));

  const trainingCategories: TrainingCategoryRow[] = (trainingCategoryData ?? []).map((row) => ({
    id: String(row.id),
    name: typeof row.name === "string" ? row.name : "",
    description: typeof row.description === "string" ? row.description : null,
    active: typeof row.active === "boolean" ? row.active : true,
    created_at: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
    updated_at: typeof row.updated_at === "string" ? row.updated_at : new Date().toISOString(),
  }));

  const qualifications: QualificationRow[] = (qualificationData ?? []).map((row) => ({
    id: String(row.id),
    name: typeof row.name === "string" ? row.name : "",
    description: typeof row.description === "string" ? row.description : null,
    active: typeof row.active === "boolean" ? row.active : true,
    created_at: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
    updated_at: typeof row.updated_at === "string" ? row.updated_at : new Date().toISOString(),
  }));

  const roleRequiredCertifications: RoleRequiredCertificationRow[] = (roleRequiredCertificationData ?? []).map((row) => ({
    id: String(row.id),
    department_id: typeof row.department_id === "string" ? row.department_id : "",
    department_role_id: typeof row.department_role_id === "string" ? row.department_role_id : "",
    certification_id: typeof row.certification_id === "string" ? row.certification_id : "",
    created_at: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
    updated_at: typeof row.updated_at === "string" ? row.updated_at : new Date().toISOString(),
  }));

  const roleRequiredQualifications: RoleRequiredQualificationRow[] = (roleRequiredQualificationData ?? []).map((row) => ({
    id: String(row.id),
    department_id: typeof row.department_id === "string" ? row.department_id : "",
    department_role_id: typeof row.department_role_id === "string" ? row.department_role_id : "",
    qualification_id: typeof row.qualification_id === "string" ? row.qualification_id : "",
    created_at: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
    updated_at: typeof row.updated_at === "string" ? row.updated_at : new Date().toISOString(),
  }));

  const departmentRoles: DepartmentRoleRow[] = (departmentRoleData ?? []).map((row) => ({
    id: String(row.id),
    name: typeof row.name === "string" ? row.name : "",
    code: typeof row.code === "string" ? row.code : "",
    description: typeof row.description === "string" ? row.description : null,
    active: typeof row.active === "boolean" ? row.active : true,
    sort_order: typeof row.sort_order === "number" ? row.sort_order : 0,
    created_at: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
    updated_at: typeof row.updated_at === "string" ? row.updated_at : new Date().toISOString(),
  }));

  const readinessRequirements: ReadinessRequirementRow[] = (requirementsData ?? []).map((row) => ({
    id: String(row.id),
    name: typeof row.name === "string" ? row.name : "",
    requirement_kind: typeof row.requirement_kind === "string" ? row.requirement_kind : "annual_hours",
    period_type: typeof row.period_type === "string" ? row.period_type : "annual",
    minimum_hours: typeof row.minimum_hours === "number" || typeof row.minimum_hours === "string" ? row.minimum_hours : null,
    category_id: typeof row.category_id === "string" ? row.category_id : null,
    due_frequency_rule: typeof row.due_frequency_rule === "string" ? row.due_frequency_rule : null,
    required_topic: typeof row.required_topic === "string" ? row.required_topic : null,
    active: typeof row.active === "boolean" ? row.active : true,
    sort_order: typeof row.sort_order === "number" ? row.sort_order : 0,
    config_json: row.config_json,
    created_at: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
    updated_at: typeof row.updated_at === "string" ? row.updated_at : new Date().toISOString(),
  }));

  const requireApparatusChecklist = apparatusInspectionSettingsData?.require_checklist === true;

  return (
    <PageLayout>
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-red-500">
          Settings
        </p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-white">
          Department Settings
        </h1>
        <p className="mt-2 max-w-3xl text-neutral-400">
          Configure department-level options used across the app.
        </p>
      </div>

      <CertificationTypesSection
        departmentId={currentMember.departmentId}
        currentMemberId={currentMember.id}
        certificationTypes={certificationTypes}
      />

      <div className="mt-6">
        <DepartmentRolesSection
          departmentId={currentMember.departmentId}
          currentMemberId={currentMember.id}
          departmentRoles={departmentRoles}
        />
      </div>

      <div className="mt-6">
        <RoleRequirementsSection
          departmentId={currentMember.departmentId}
          currentMemberId={currentMember.id}
          departmentRoles={departmentRoles}
          certifications={certificationTypes}
          qualifications={qualifications}
          roleRequiredCertifications={roleRequiredCertifications}
          roleRequiredQualifications={roleRequiredQualifications}
        />
      </div>

      <div className="mt-6">
        <TrainingCategoriesSection
          departmentId={currentMember.departmentId}
          currentMemberId={currentMember.id}
          trainingCategories={trainingCategories}
        />
      </div>

      <div className="mt-6">
        <ReadinessRequirementsSection
          departmentId={currentMember.departmentId}
          currentMemberId={currentMember.id}
          trainingCategories={trainingCategories}
          certificationTypes={certificationTypes}
          readinessRequirements={readinessRequirements}
        />
      </div>

      <div className="mt-6">
        <ApparatusInspectionSettingsSection
          departmentId={currentMember.departmentId}
          currentMemberId={currentMember.id}
          initialRequireChecklist={requireApparatusChecklist}
        />
      </div>
    </PageLayout>
  );
}
