import { redirect } from "next/navigation";
import CertificationTypesSection from "@/components/settings/CertificationTypesSection";
import DepartmentRolesSection from "@/components/settings/DepartmentRolesSection";
import RoleRequirementsSection from "@/components/settings/RoleRequirementsSection";
import ReadinessRequirementsSection from "@/components/settings/ReadinessRequirementsSection";
import TrainingCategoriesSection from "@/components/settings/TrainingCategoriesSection";
import ApparatusInspectionSettingsSection from "@/components/settings/ApparatusInspectionSettingsSection";
import GasMonitorCalibrationSettingsSection from "@/components/settings/GasMonitorCalibrationSettingsSection";
import GroundLadderInspectionSettingsSection from "@/components/settings/GroundLadderInspectionSettingsSection";
import DeficiencyAssignmentSettingsSection from "@/components/settings/DeficiencyAssignmentSettingsSection";
import DeficiencyResolutionSettingsSection from "@/components/settings/DeficiencyResolutionSettingsSection";
import EmsSupplyNotificationSettingsSection from "@/components/settings/EmsSupplyNotificationSettingsSection";
import { getCurrentMember } from "@/lib/current-member";
import { hasDepartmentPermission } from "@/lib/member-permissions";
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

  const hasSettingsAccess = await hasDepartmentPermission(
    supabase,
    currentMember.departmentId,
    currentMember.role,
    "settings_management",
  );

  if (!hasSettingsAccess) {
    redirect("/");
  }

  const [
    { data: certificationData, error: certificationError },
    { data: trainingCategoryData, error: trainingCategoryError },
    { data: departmentRoleData, error: departmentRoleError },
    { data: roleRequiredCertificationData, error: roleRequiredCertificationError },
    { data: requirementsData, error: requirementsError },
    { data: apparatusInspectionSettingsData, error: apparatusInspectionSettingsError },
    { data: groundLadderInspectionSettingsData, error: groundLadderInspectionSettingsError },
    { data: gasMonitorCalibrationSettingsData, error: gasMonitorCalibrationSettingsError },
    { data: deficiencyCategoryData, error: deficiencyCategoryError },
    { data: memberData, error: memberError },
    { data: deficiencyAssignmentData, error: deficiencyAssignmentError },
    { data: emsSupplyRecipientData, error: emsSupplyRecipientError },
    { data: departmentSettingsData, error: departmentSettingsError },
  ] = await Promise.all([
    supabase
      .from("certifications")
      .select("id, name, description, active, ems_authority, ems_certification_level, created_at, updated_at")
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
    supabase
      .from("ground_ladder_inspection_settings")
      .select("require_checklist")
      .eq("department_id", currentMember.departmentId)
      .maybeSingle(),
    supabase
      .from("gas_monitor_calibration_settings")
      .select("calibration_interval_months")
      .eq("department_id", currentMember.departmentId)
      .maybeSingle(),
    supabase
      .from("deficiency_categories")
      .select("id, name, active")
      .order("display_order", { ascending: true }),
    supabase
      .from("members")
      .select("id, first_name, last_name, active")
      .eq("department_id", currentMember.departmentId)
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true }),
    supabase
      .from("deficiency_notification_settings")
      .select("id, category_id, member_id, active")
      .eq("department_id", currentMember.departmentId),
    supabase
      .from("department_notification_recipients")
      .select("id, member_id, active")
      .eq("department_id", currentMember.departmentId)
      .eq("notification_type", "ems_supply_low_stock")
      .maybeSingle(),
    supabase
      .from("departments")
      .select("restrict_deficiency_resolution")
      .eq("id", currentMember.departmentId)
      .maybeSingle(),
  ]);

  if (certificationError) {
    throw new Error(certificationError.message || "Unable to load certification types.");
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

  if (requirementsError) {
    throw new Error(requirementsError.message || "Unable to load readiness requirements.");
  }

  if (apparatusInspectionSettingsError) {
    throw new Error(apparatusInspectionSettingsError.message || "Unable to load apparatus inspection settings.");
  }

  if (groundLadderInspectionSettingsError) {
    throw new Error(groundLadderInspectionSettingsError.message || "Unable to load ground ladder inspection settings.");
  }

  if (gasMonitorCalibrationSettingsError) {
    throw new Error(gasMonitorCalibrationSettingsError.message || "Unable to load gas monitor calibration settings.");
  }

  if (deficiencyCategoryError) {
    throw new Error(deficiencyCategoryError.message || "Unable to load deficiency categories.");
  }

  if (memberError) {
    throw new Error(memberError.message || "Unable to load department members.");
  }

  if (deficiencyAssignmentError) {
    throw new Error(deficiencyAssignmentError.message || "Unable to load deficiency assignment settings.");
  }

  if (emsSupplyRecipientError) {
    throw new Error(emsSupplyRecipientError.message || "Unable to load EMS supply notification settings.");
  }

  if (departmentSettingsError) {
    throw new Error(departmentSettingsError.message || "Unable to load department settings.");
  }

  const emsSupplyRecipient = emsSupplyRecipientData
    ? {
        id: String(emsSupplyRecipientData.id),
        member_id:
          typeof emsSupplyRecipientData.member_id === "string" ? emsSupplyRecipientData.member_id : "",
        active: emsSupplyRecipientData.active === true,
      }
    : null;

  const deficiencyCategories = (deficiencyCategoryData ?? []).map((row) => ({
    id: String(row.id),
    name: typeof row.name === "string" ? row.name : "",
    active: typeof row.active === "boolean" ? row.active : true,
  }));

  const members = (memberData ?? []).map((row) => ({
    id: String(row.id),
    first_name: typeof row.first_name === "string" ? row.first_name : null,
    last_name: typeof row.last_name === "string" ? row.last_name : null,
    active: typeof row.active === "boolean" ? row.active : true,
  }));

  const deficiencyAssignmentSettings = (deficiencyAssignmentData ?? []).map((row) => ({
    id: typeof row.id === "number" ? row.id : Number(row.id),
    category_id: typeof row.category_id === "string" ? row.category_id : "",
    member_id: typeof row.member_id === "string" ? row.member_id : "",
    active: row.active === true,
  }));

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

  const roleRequiredCertifications: RoleRequiredCertificationRow[] = (roleRequiredCertificationData ?? []).map((row) => ({
    id: String(row.id),
    department_id: typeof row.department_id === "string" ? row.department_id : "",
    department_role_id: typeof row.department_role_id === "string" ? row.department_role_id : "",
    certification_id: typeof row.certification_id === "string" ? row.certification_id : "",
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
  const requireGroundLadderChecklist = groundLadderInspectionSettingsData?.require_checklist === true;
  const gasMonitorCalibrationIntervalMonths =
    typeof gasMonitorCalibrationSettingsData?.calibration_interval_months === "number"
      ? gasMonitorCalibrationSettingsData.calibration_interval_months
      : 6;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="mb-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-red-500">
          Settings
        </p>
        <h1
          className="mt-2 text-[2.25rem] font-[700] leading-none tracking-[-0.06em] text-white"
          style={{ fontFamily: '"Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif' }}
        >
          Department Settings
        </h1>
        <p className="mt-3 max-w-3xl text-lg text-neutral-400">
          Configure department-level options used across the app.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <CertificationTypesSection
          departmentId={currentMember.departmentId}
          currentMemberId={currentMember.id}
          certificationTypes={certificationTypes}
        />

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
          roleRequiredCertifications={roleRequiredCertifications}
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
        <DeficiencyAssignmentSettingsSection
          departmentId={currentMember.departmentId}
          categories={deficiencyCategories}
          members={members}
          assignmentSettings={deficiencyAssignmentSettings}
        />
      </div>

      <div className="mt-6">
        <DeficiencyResolutionSettingsSection
          departmentId={currentMember.departmentId}
          initialRestricted={departmentSettingsData?.restrict_deficiency_resolution === true}
        />
      </div>

      <div className="mt-6">
        <EmsSupplyNotificationSettingsSection
          departmentId={currentMember.departmentId}
          members={members}
          recipient={emsSupplyRecipient}
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

      <div className="mt-6">
        <GroundLadderInspectionSettingsSection
          departmentId={currentMember.departmentId}
          currentMemberId={currentMember.id}
          initialRequireChecklist={requireGroundLadderChecklist}
        />
      </div>

      <div className="mt-6">
        <GasMonitorCalibrationSettingsSection
          departmentId={currentMember.departmentId}
          currentMemberId={currentMember.id}
          initialCalibrationIntervalMonths={gasMonitorCalibrationIntervalMonths}
        />
      </div>
    </div>
  );
}
