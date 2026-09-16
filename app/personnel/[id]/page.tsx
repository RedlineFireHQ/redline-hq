import PageLayout from "@/components/layout/PageLayout";
import DepartmentRoleSelector from "@/components/personnel/DepartmentRoleSelector";
import EditMemberButton from "@/components/personnel/EditMemberButton";
import MemberReadinessCard from "@/components/personnel/MemberReadinessCard";
import PersonnelEmsTracksSection from "@/components/personnel/PersonnelEmsTracksSection";
import PersonnelCertificationsSection from "@/components/personnel/PersonnelCertificationsSection";
import RoleRequirementsSection from "@/components/personnel/RoleRequirementsSection";
import CreateAuthAccountButton from "@/components/personnel/CreateAuthAccountButton";
import type { AppPermissionOption } from "@/lib/app-permissions";
import { department } from "@/lib/department";
import { buildCertificationTypeMetaById } from "@/lib/ems/authoritative-certifications";
import { getCurrentMember } from "@/lib/current-member";
import { canManagePersonnel, hasDepartmentPermission } from "@/lib/member-permissions";
import {
  type DeficiencyReadinessInput,
  type RequirementInput,
} from "@/lib/readiness/member-readiness";
import {
  buildAuthoritativeCoachActions,
  computeAuthoritativeMemberReadiness,
  getAuthoritativeCoachSummary,
} from "@/lib/readiness/authoritative-member-readiness";
import {
  buildCanonicalMemberCertificationRows,
  type CatalogRow,
} from "@/lib/role-requirements";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { notFound, redirect } from "next/navigation";

type CertificationTypeRow = {
  id: string;
  name: string;
  description: string | null;
  active: boolean | null;
  ems_authority: "iowa" | "nremt" | null;
  ems_certification_level: "emr" | "emt" | "aemt" | "paramedic" | null;
};

type QualificationRow = {
  id: string;
  name: string;
  description: string | null;
  active: boolean | null;
};

type MemberCertificationRow = {
  id: string;
  member_id: string;
  certification_id: string;
  certificate_number: string | null;
  issued_at: string;
  expires_at: string | null;
  supporting_document_id: string | null;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

type MemberQualificationRow = {
  id: string;
  member_id: string;
  qualification_id: string;
  earned_at: string;
  certificate_number: string | null;
  notes: string | null;
  supporting_document_id: string | null;
  created_by: string | null;
  updated_by: string | null;
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

type DepartmentDocumentRow = {
  id: string;
  title: string;
  category: string;
  document_number: string | null;
  status: string | null;
};

type MemberTrainingAttendanceRow = {
  training_event_id: string;
};

type MemberTrainingEventRow = {
  id: string;
  title: string;
  category_id: string | null;
  starts_at: string;
  hours_credit: number | string | null;
  training_type: string | null;
  instructor_name: string | null;
  location: string | null;
};

type MemberApprovedOutsideTrainingRow = {
  id: string;
  title: string;
  category_id: string | null;
  training_date: string;
  hours: number | string | null;
  description: string | null;
  notes: string | null;
};

type TrainingCategoryLookupRow = {
  id: string;
  name: string;
};

type EmsTrackRow = {
  id: string;
  track: "iowa" | "nremt";
  certification_level: "emr" | "emt" | "aemt" | "paramedic";
  track_status: "active" | "inactive" | "expired" | "not_maintained" | "needs_review";
  maintain_track: boolean;
  certification_number: string | null;
  expiration_date: string | null;
  effective_start_date: string;
  effective_end_date: string | null;
  notes: string | null;
};

type MemberTrainingHistoryItem = {
  id: string;
  title: string;
  source: "department_event" | "outside_submission";
  categoryName: string;
  completedAt: string;
  startTimeValue: string | null;
  hoursCredit: number | null;
  trainingMethod: string | null;
  instructorName: string | null;
  location: string | null;
};

type ReadinessRequirementRow = RequirementInput & {
  created_at?: string;
  updated_at?: string;
};

type TrainingAssignmentMemberRow = {
  training_assignment_id: string;
  completion_status: string;
  hours_earned: number | string | null;
};

type TrainingAssignmentRow = {
  id: string;
  title: string;
  category_id: string | null;
  hours_credit: number | string | null;
  is_required: boolean;
  review_required: boolean;
  status: string;
};

type DeficiencyStatusRelation = {
  name: string | null;
  active: boolean | null;
};

type DeficiencyPriorityRelation = {
  name: string | null;
};

type DeficiencyAssignedRow = {
  id: string;
  deficiency_number: string | null;
  description: string | null;
  assigned_to: string | null;
  created_at: string | null;
  reported_at: string | null;
  status_info: DeficiencyStatusRelation | DeficiencyStatusRelation[] | null;
  priority_info: DeficiencyPriorityRelation | DeficiencyPriorityRelation[] | null;
};

type DeficiencyAssignmentHistoryRow = {
  deficiency_id: string;
  member_id: string | null;
  event_type: string | null;
  created_at: string | null;
};

function parseHours(value: number | string | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function formatDateOnly(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatStartTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function extractOutsideMetadata(notes: string | null) {
  const result = {
    method: "",
    instructor: "",
    location: "",
  };

  if (!notes) {
    return result;
  }

  const lines = notes.split("\n").map((line) => line.trim());
  for (const line of lines) {
    if (line.toLowerCase().startsWith("method:")) {
      result.method = line.slice("Method:".length).trim();
      continue;
    }

    if (line.toLowerCase().startsWith("instructor:")) {
      result.instructor = line.slice("Instructor:".length).trim();
      continue;
    }

    if (line.toLowerCase().startsWith("location:")) {
      result.location = line.slice("Location:".length).trim();
    }
  }

  return result;
}

function normalizeDeficiencyStatus(value: DeficiencyAssignedRow["status_info"]) {
  const relation = Array.isArray(value) ? value[0] : value;
  return {
    name: typeof relation?.name === "string" ? relation.name : null,
    active: typeof relation?.active === "boolean" ? relation.active : null,
  };
}

function normalizeDeficiencyPriority(value: DeficiencyAssignedRow["priority_info"]) {
  const relation = Array.isArray(value) ? value[0] : value;
  return {
    name: typeof relation?.name === "string" ? relation.name : null,
  };
}

interface PersonnelProfilePageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function PersonnelProfilePage({
  params,
}: PersonnelProfilePageProps) {
  const { id } = await params;
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
  const isSelfProfile = id === currentMember.id;
  const canManageOwnProfile = isSelfProfile && hasPersonnelAccess;
  const canManageOwnCertifications = isSelfProfile && (await hasDepartmentPermission(
    supabase,
    currentMember.departmentId,
    currentMember.role,
    "certification_management",
  ));

  if (!isSelfProfile && !hasPersonnelAccess) {
    redirect("/");
  }

  const { data: member, error } = await supabase
    .from("members")
    .select("id, first_name, last_name, rank, email, phone, active, hire_start_date, inactive_date, special_permissions_enabled, department_role_id, auth_user_id, created_at")
    .eq("department_id", currentMember.departmentId)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Unable to load member profile.");
  }

  if (!member) {
    notFound();
  }

  const firstName = typeof member.first_name === "string" ? member.first_name.trim() : "";
  const lastName = typeof member.last_name === "string" ? member.last_name.trim() : "";
  const fullName = `${firstName} ${lastName}`.trim() || "Unknown Member";
  const rank = typeof member.rank === "string" && member.rank.trim() ? member.rank.trim() : "Unassigned";
  const email = typeof member.email === "string" && member.email.trim() ? member.email.trim() : "-";
  const phone = typeof member.phone === "string" && member.phone.trim() ? member.phone.trim() : "-";
  const hasAuthAccount = typeof member.auth_user_id === "string" && member.auth_user_id.length > 0;
  const memberActive = typeof member.active === "boolean" ? member.active : true;
  const hireStartDate = typeof member.hire_start_date === "string" ? member.hire_start_date : null;
  const memberCreatedAt = typeof member.created_at === "string" ? member.created_at : null;
  const memberRequirementStartDate = hireStartDate ?? memberCreatedAt;
  const inactiveDate = typeof member.inactive_date === "string" ? member.inactive_date : null;
  const specialPermissionsEnabled = member.special_permissions_enabled === true;

  const [
    { data: departmentRolesData, error: departmentRolesError },
    { data: certificationTypesData, error: certificationTypesError },
    { data: qualificationTypesData, error: qualificationTypesError },
    { data: memberCertificationsData, error: memberCertificationsError },
    { data: memberQualificationsData, error: memberQualificationsError },
    { data: roleRequiredCertificationsData, error: roleRequiredCertificationsError },
    { data: roleRequiredQualificationsData, error: roleRequiredQualificationsError },
    { data: departmentDocumentsData, error: departmentDocumentsError },
    { data: memberTrainingAttendanceData, error: memberTrainingAttendanceError },
    { data: approvedOutsideTrainingData, error: approvedOutsideTrainingError },
    { data: readinessRequirementsData, error: readinessRequirementsError },
    { data: approvedAssignmentMembersData, error: approvedAssignmentMembersError },
    { data: trainingAssignmentsData, error: trainingAssignmentsError },
    { data: assignedDeficienciesData, error: assignedDeficienciesError },
    { data: appPermissionsData, error: appPermissionsError },
    { data: memberPermissionRowsData, error: memberPermissionRowsError },
    { data: emsTrackProfilesData, error: emsTrackProfilesError },
  ] = await Promise.all([
    supabase
      .from("department_roles")
      .select("id, name, code, active")
      .eq("department_id", currentMember.departmentId)
      .order("active", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("certifications")
      .select("id, name, description, active, ems_authority, ems_certification_level")
      .eq("department_id", currentMember.departmentId)
      .order("name", { ascending: true }),
    supabase
      .from("qualifications")
      .select("id, name, description, active")
      .eq("department_id", currentMember.departmentId)
      .order("name", { ascending: true }),
    supabase
      .from("member_certifications")
      .select(
        "id, member_id, certification_id, certificate_number, issued_at, expires_at, supporting_document_id, notes, created_by, updated_by, created_at, updated_at",
      )
      .eq("department_id", currentMember.departmentId)
      .eq("member_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("member_qualifications")
      .select(
        "id, member_id, qualification_id, earned_at, certificate_number, notes, supporting_document_id, created_by, updated_by, created_at, updated_at",
      )
      .eq("department_id", currentMember.departmentId)
      .eq("member_id", id)
      .order("created_at", { ascending: false }),
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
      .from("documents")
      .select("id, title, category, document_number, status")
      .eq("department_id", currentMember.departmentId)
      .order("title", { ascending: true }),
    supabase
      .from("training_event_attendance")
      .select("training_event_id")
      .eq("department_id", currentMember.departmentId)
      .eq("member_id", id)
      .eq("attendance_status", "attending"),
    supabase
      .from("training_outside_submissions")
      .select("id, title, category_id, training_date, hours, description, notes")
      .eq("department_id", currentMember.departmentId)
      .eq("member_id", id)
      .eq("status", "approved")
      .order("training_date", { ascending: false }),
    supabase
      .from("training_requirements")
      .select("id, name, requirement_kind, period_type, minimum_hours, category_id, due_frequency_rule, required_topic, active, sort_order, config_json, created_at, updated_at")
      .eq("department_id", currentMember.departmentId)
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("training_assignment_members")
      .select("training_assignment_id, completion_status, hours_earned")
      .eq("department_id", currentMember.departmentId)
      .eq("member_id", id)
      .eq("completion_status", "approved"),
    supabase
      .from("training_assignments")
      .select("id, title, category_id, hours_credit, is_required, review_required, status")
      .eq("department_id", currentMember.departmentId),
    supabase
      .from("deficiencies")
      .select(
        "id, deficiency_number, description, assigned_to, created_at, reported_at, status_info:deficiency_statuses!fk_deficiencies_status(name, active), priority_info:deficiency_priorities!fk_deficiencies_priority(name)",
      )
      .eq("assigned_to", id),
    supabase
      .from("app_permissions")
      .select("key, label, description, active, sort_order")
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true }),
    supabase
      .from("member_app_permissions")
      .select("permission_key")
      .eq("department_id", currentMember.departmentId)
      .eq("member_id", id),
    supabase
      .from("ems_member_track_profiles")
      .select(
        "id, track, certification_level, track_status, maintain_track, certification_number, expiration_date, effective_start_date, effective_end_date, notes",
      )
      .eq("department_id", currentMember.departmentId)
      .eq("member_id", id)
      .order("effective_start_date", { ascending: false }),
  ]);

  if (departmentRolesError) {
    throw new Error(departmentRolesError.message || "Unable to load department roles.");
  }

  if (certificationTypesError) {
    throw new Error(certificationTypesError.message || "Unable to load certification types.");
  }

  if (qualificationTypesError) {
    throw new Error(qualificationTypesError.message || "Unable to load qualifications.");
  }

  if (memberCertificationsError) {
    throw new Error(memberCertificationsError.message || "Unable to load member certifications.");
  }

  if (memberQualificationsError) {
    throw new Error(memberQualificationsError.message || "Unable to load member qualifications.");
  }

  if (roleRequiredCertificationsError) {
    throw new Error(roleRequiredCertificationsError.message || "Unable to load role required certifications.");
  }

  if (roleRequiredQualificationsError) {
    throw new Error(roleRequiredQualificationsError.message || "Unable to load role required qualifications.");
  }

  if (departmentDocumentsError) {
    throw new Error(departmentDocumentsError.message || "Unable to load department documents.");
  }

  if (memberTrainingAttendanceError) {
    throw new Error(memberTrainingAttendanceError.message || "Unable to load member training attendance.");
  }

  if (approvedOutsideTrainingError) {
    throw new Error(approvedOutsideTrainingError.message || "Unable to load approved self-reported training.");
  }

  if (readinessRequirementsError) {
    throw new Error(readinessRequirementsError.message || "Unable to load readiness requirements.");
  }

  if (approvedAssignmentMembersError) {
    throw new Error(approvedAssignmentMembersError.message || "Unable to load approved assignment hours.");
  }

  if (trainingAssignmentsError) {
    throw new Error(trainingAssignmentsError.message || "Unable to load training assignments.");
  }

  if (assignedDeficienciesError) {
    throw new Error(assignedDeficienciesError.message || "Unable to load assigned deficiencies.");
  }

  if (appPermissionsError) {
    throw new Error(appPermissionsError.message || "Unable to load app permissions.");
  }

  if (memberPermissionRowsError) {
    throw new Error(memberPermissionRowsError.message || "Unable to load member permissions.");
  }

  if (emsTrackProfilesError) {
    throw new Error(emsTrackProfilesError.message || "Unable to load EMS track profiles.");
  }

  const permissionOptions: AppPermissionOption[] = (appPermissionsData ?? []).map((row) => ({
    key: typeof row.key === "string" ? row.key : "",
    label: typeof row.label === "string" ? row.label : "",
    description: typeof row.description === "string" ? row.description : null,
    active: typeof row.active === "boolean" ? row.active : true,
    sort_order: typeof row.sort_order === "number" ? row.sort_order : 0,
  })).filter((row) => row.key.length > 0 && row.label.length > 0);

  const memberPermissionKeys: string[] = (memberPermissionRowsData ?? [])
    .map((row) => (typeof row.permission_key === "string" ? row.permission_key : ""))
    .filter((key) => key.length > 0);

  const emsTrackProfiles: EmsTrackRow[] = (emsTrackProfilesData ?? []).map((row) => ({
    id: String(row.id),
    track: row.track === "nremt" ? "nremt" : "iowa",
    certification_level:
      row.certification_level === "emr" ||
      row.certification_level === "emt" ||
      row.certification_level === "aemt" ||
      row.certification_level === "paramedic"
        ? row.certification_level
        : "emt",
    track_status:
      row.track_status === "active" ||
      row.track_status === "inactive" ||
      row.track_status === "expired" ||
      row.track_status === "not_maintained" ||
      row.track_status === "needs_review"
        ? row.track_status
        : "needs_review",
    maintain_track: row.maintain_track === true,
    certification_number: typeof row.certification_number === "string" ? row.certification_number : null,
    expiration_date: typeof row.expiration_date === "string" ? row.expiration_date : null,
    effective_start_date: typeof row.effective_start_date === "string" ? row.effective_start_date : "",
    effective_end_date: typeof row.effective_end_date === "string" ? row.effective_end_date : null,
    notes: typeof row.notes === "string" ? row.notes : null,
  }));

  const departmentRoles = (departmentRolesData ?? []).map((row) => ({
    id: String(row.id),
    name: typeof row.name === "string" ? row.name : "",
    code: typeof row.code === "string" ? row.code : "",
    active: typeof row.active === "boolean" ? row.active : true,
  }));

  const certificationTypes: CertificationTypeRow[] = (certificationTypesData ?? []).map((row) => ({
    id: String(row.id),
    name: typeof row.name === "string" ? row.name : "",
    description: typeof row.description === "string" ? row.description : null,
    active: typeof row.active === "boolean" ? row.active : null,
    ems_authority: row.ems_authority === "iowa" || row.ems_authority === "nremt" ? row.ems_authority : null,
    ems_certification_level:
      row.ems_certification_level === "emr" ||
      row.ems_certification_level === "emt" ||
      row.ems_certification_level === "aemt" ||
      row.ems_certification_level === "paramedic"
        ? row.ems_certification_level
        : null,
  }));

  const qualificationTypes: QualificationRow[] = (qualificationTypesData ?? []).map((row) => ({
    id: String(row.id),
    name: typeof row.name === "string" ? row.name : "",
    description: typeof row.description === "string" ? row.description : null,
    active: typeof row.active === "boolean" ? row.active : null,
  }));

  const memberCertifications: MemberCertificationRow[] = (memberCertificationsData ?? []).map((row) => ({
    id: String(row.id),
    member_id: typeof row.member_id === "string" ? row.member_id : "",
    certification_id: typeof row.certification_id === "string" ? row.certification_id : "",
    certificate_number: typeof row.certificate_number === "string" ? row.certificate_number : null,
    issued_at: typeof row.issued_at === "string" ? row.issued_at : "",
    expires_at: typeof row.expires_at === "string" ? row.expires_at : null,
    supporting_document_id: typeof row.supporting_document_id === "string" ? row.supporting_document_id : null,
    notes: typeof row.notes === "string" ? row.notes : null,
    created_by: typeof row.created_by === "string" ? row.created_by : null,
    updated_by: typeof row.updated_by === "string" ? row.updated_by : null,
    created_at: typeof row.created_at === "string" ? row.created_at : "",
    updated_at: typeof row.updated_at === "string" ? row.updated_at : "",
  }));

  const memberQualifications: MemberQualificationRow[] = (memberQualificationsData ?? []).map((row) => ({
    id: String(row.id),
    member_id: typeof row.member_id === "string" ? row.member_id : "",
    qualification_id: typeof row.qualification_id === "string" ? row.qualification_id : "",
    earned_at: typeof row.earned_at === "string" ? row.earned_at : "",
    certificate_number: typeof row.certificate_number === "string" ? row.certificate_number : null,
    notes: typeof row.notes === "string" ? row.notes : null,
    supporting_document_id: typeof row.supporting_document_id === "string" ? row.supporting_document_id : null,
    created_by: typeof row.created_by === "string" ? row.created_by : null,
    updated_by: typeof row.updated_by === "string" ? row.updated_by : null,
    created_at: typeof row.created_at === "string" ? row.created_at : "",
    updated_at: typeof row.updated_at === "string" ? row.updated_at : "",
  }));

  const roleRequiredCertifications: RoleRequiredCertificationRow[] = (roleRequiredCertificationsData ?? []).map((row) => ({
    id: String(row.id),
    department_id: typeof row.department_id === "string" ? row.department_id : "",
    department_role_id: typeof row.department_role_id === "string" ? row.department_role_id : "",
    certification_id: typeof row.certification_id === "string" ? row.certification_id : "",
    created_at: typeof row.created_at === "string" ? row.created_at : "",
    updated_at: typeof row.updated_at === "string" ? row.updated_at : "",
  }));

  const roleRequiredQualifications: RoleRequiredQualificationRow[] = (roleRequiredQualificationsData ?? []).map((row) => ({
    id: String(row.id),
    department_id: typeof row.department_id === "string" ? row.department_id : "",
    department_role_id: typeof row.department_role_id === "string" ? row.department_role_id : "",
    qualification_id: typeof row.qualification_id === "string" ? row.qualification_id : "",
    created_at: typeof row.created_at === "string" ? row.created_at : "",
    updated_at: typeof row.updated_at === "string" ? row.updated_at : "",
  }));

  const departmentDocuments: DepartmentDocumentRow[] = (departmentDocumentsData ?? []).map((row) => ({
    id: String(row.id),
    title: typeof row.title === "string" ? row.title : "Untitled Document",
    category: typeof row.category === "string" ? row.category : "Document",
    document_number: typeof row.document_number === "string" ? row.document_number : null,
    status: typeof row.status === "string" ? row.status : null,
  }));

  const memberTrainingAttendance: MemberTrainingAttendanceRow[] = (memberTrainingAttendanceData ?? []).map((row) => ({
    training_event_id: typeof row.training_event_id === "string" ? row.training_event_id : "",
  }));

  const approvedOutsideTraining: MemberApprovedOutsideTrainingRow[] = (approvedOutsideTrainingData ?? []).map((row) => ({
    id: String(row.id),
    title: typeof row.title === "string" ? row.title : "Self-Reported Training",
    category_id: typeof row.category_id === "string" ? row.category_id : null,
    training_date: typeof row.training_date === "string" ? row.training_date : "",
    hours:
      typeof row.hours === "number" || typeof row.hours === "string"
        ? row.hours
        : null,
    description: typeof row.description === "string" ? row.description : null,
    notes: typeof row.notes === "string" ? row.notes : null,
  }));

  const readinessRequirements: ReadinessRequirementRow[] = (readinessRequirementsData ?? []) as ReadinessRequirementRow[];
  const approvedAssignmentMembers: TrainingAssignmentMemberRow[] = (approvedAssignmentMembersData ?? []).map((row) => ({
    training_assignment_id: typeof row.training_assignment_id === "string" ? row.training_assignment_id : "",
    completion_status: typeof row.completion_status === "string" ? row.completion_status : "",
    hours_earned: typeof row.hours_earned === "number" || typeof row.hours_earned === "string" ? row.hours_earned : null,
  }));
  const trainingAssignments: TrainingAssignmentRow[] = (trainingAssignmentsData ?? []).map((row) => ({
    id: String(row.id),
    title: typeof row.title === "string" ? row.title : "Training Assignment",
    category_id: typeof row.category_id === "string" ? row.category_id : null,
    hours_credit: typeof row.hours_credit === "number" || typeof row.hours_credit === "string" ? row.hours_credit : null,
    is_required: row.is_required === true,
    review_required: row.review_required === true,
    status: typeof row.status === "string" ? row.status : "active",
  }));
  const assignedDeficiencies: DeficiencyAssignedRow[] = (assignedDeficienciesData ?? []) as DeficiencyAssignedRow[];

  const attendedEventIds = Array.from(
    new Set(
      memberTrainingAttendance
        .map((row) => row.training_event_id)
        .filter((eventId) => eventId.length > 0),
    ),
  );

  let trainingEvents: MemberTrainingEventRow[] = [];
  if (attendedEventIds.length > 0) {
    const { data: trainingEventsData, error: trainingEventsError } = await supabase
      .from("training_events")
      .select("id, title, category_id, starts_at, hours_credit, training_type, instructor_name, location")
      .eq("department_id", currentMember.departmentId)
      .in("id", attendedEventIds)
      .order("starts_at", { ascending: false });

    if (trainingEventsError) {
      throw new Error(trainingEventsError.message || "Unable to load member training events.");
    }

    trainingEvents = (trainingEventsData ?? []).map((row) => ({
      id: String(row.id),
      title: typeof row.title === "string" ? row.title : "Untitled Training",
      category_id: typeof row.category_id === "string" ? row.category_id : null,
      starts_at: typeof row.starts_at === "string" ? row.starts_at : "",
      hours_credit:
        typeof row.hours_credit === "number" || typeof row.hours_credit === "string"
          ? row.hours_credit
          : null,
      training_type: typeof row.training_type === "string" ? row.training_type : null,
      instructor_name: typeof row.instructor_name === "string" ? row.instructor_name : null,
      location: typeof row.location === "string" ? row.location : null,
    }));
  }

  const categoryIds = Array.from(
    new Set(
      [
        ...trainingEvents.map((event) => event.category_id),
        ...approvedOutsideTraining.map((submission) => submission.category_id),
        ...trainingAssignments.map((assignment) => assignment.category_id),
      ].filter((categoryId): categoryId is string => Boolean(categoryId)),
    ),
  );

  let trainingCategoryLookup = new Map<string, string>();
  if (categoryIds.length > 0) {
    const { data: trainingCategoryData, error: trainingCategoryError } = await supabase
      .from("training_categories")
      .select("id, name")
      .eq("department_id", currentMember.departmentId)
      .in("id", categoryIds);

    if (trainingCategoryError) {
      throw new Error(trainingCategoryError.message || "Unable to load training categories.");
    }

    const categoryRows: TrainingCategoryLookupRow[] = (trainingCategoryData ?? []).map((row) => ({
      id: String(row.id),
      name: typeof row.name === "string" ? row.name : "Uncategorized",
    }));

    trainingCategoryLookup = new Map(categoryRows.map((row) => [row.id, row.name]));
  }

  const eventHistoryItems: MemberTrainingHistoryItem[] = trainingEvents.map((event) => ({
    id: `event-${event.id}`,
    title: event.title,
    source: "department_event",
    categoryName: event.category_id ? trainingCategoryLookup.get(event.category_id) ?? "Uncategorized" : "Uncategorized",
    completedAt: event.starts_at,
    startTimeValue: event.starts_at,
    hoursCredit: parseHours(event.hours_credit),
    trainingMethod: event.training_type?.replaceAll(" | ", " • ") ?? null,
    instructorName: event.instructor_name,
    location: event.location,
  }));

  const outsideHistoryItems: MemberTrainingHistoryItem[] = approvedOutsideTraining.map((submission) => {
    const metadata = extractOutsideMetadata(submission.notes);
    return {
      id: `outside-${submission.id}`,
      title: submission.title,
      source: "outside_submission",
      categoryName: submission.category_id
        ? trainingCategoryLookup.get(submission.category_id) ?? "Uncategorized"
        : "Uncategorized",
      completedAt: submission.training_date,
      startTimeValue: null,
      hoursCredit: parseHours(submission.hours),
      trainingMethod: metadata.method || null,
      instructorName: metadata.instructor || null,
      location: metadata.location || null,
    };
  });

  const trainingHistory: MemberTrainingHistoryItem[] = [...eventHistoryItems, ...outsideHistoryItems].sort(
    (left, right) => new Date(right.completedAt).getTime() - new Date(left.completedAt).getTime(),
  );

  const totalTrainingHours = trainingHistory.reduce((total, item) => total + (item.hoursCredit ?? 0), 0);

  const canonicalMemberCertificationRows = buildCanonicalMemberCertificationRows({
    certificationTypes: certificationTypes.map((row) => ({ id: row.id, name: row.name, active: row.active } satisfies CatalogRow)),
    qualificationTypes: qualificationTypes.map((row) => ({ id: row.id, name: row.name, active: row.active } satisfies CatalogRow)),
    memberCertifications: memberCertifications,
    memberQualifications: memberQualifications,
  }).map((row) => ({
    id: row.id ?? `${row.sourceTable}:${row.certification_id}`,
    member_id: row.member_id ?? String(member.id),
    certification_id: row.certification_id,
    certificate_number: row.certificate_number ?? null,
    issued_at: row.issued_at ?? "",
    expires_at: row.expires_at,
    supporting_document_id: row.supporting_document_id ?? null,
    notes: row.notes ?? null,
    created_by: row.created_by ?? null,
    updated_by: row.updated_by ?? null,
    created_at: row.created_at ?? row.issued_at ?? "",
    updated_at: row.updated_at ?? row.created_at ?? row.issued_at ?? "",
  }));

  const certificationNameById = new Map(certificationTypes.map((row) => [row.id, row.name]));
  const certificationTypeById = buildCertificationTypeMetaById(
    certificationTypes.map((row) => ({
      id: row.id,
      ems_authority: row.ems_authority,
      ems_certification_level: row.ems_certification_level,
    })),
  );
  const memberDepartmentRoleId = typeof member.department_role_id === "string" ? member.department_role_id : null;
  const departmentRoleById = new Map(departmentRoles.map((row) => [row.id, row.name]));

  const assignmentById = new Map(trainingAssignments.map((row) => [row.id, row]));
  const complianceRows: Array<{ categoryId: string | null; hours: number | string | null }> = [
    ...trainingEvents.map((row) => ({ categoryId: row.category_id, hours: row.hours_credit })),
    ...approvedOutsideTraining.map((row) => ({ categoryId: row.category_id, hours: row.hours })),
    ...approvedAssignmentMembers.map((row) => {
      const assignment = assignmentById.get(row.training_assignment_id);
      const assignmentHours = assignment ? parseHours(assignment.hours_credit) ?? 0 : 0;
      const rowHours = parseHours(row.hours_earned) ?? 0;
      return {
        categoryId: assignment?.category_id ?? null,
        hours: rowHours > 0 ? rowHours : assignmentHours,
      };
    }),
  ];
  const categoryHoursMap = new Map<string, { categoryId: string | null; categoryName: string; hours: number }>();
  for (const row of complianceRows) {
    const hours = parseHours(row.hours) ?? 0;
    if (hours <= 0 || !row.categoryId) {
      continue;
    }

    const current = categoryHoursMap.get(row.categoryId) ?? {
      categoryId: row.categoryId,
      categoryName: trainingCategoryLookup.get(row.categoryId) ?? "Category",
      hours: 0,
    };
    current.hours += hours;
    categoryHoursMap.set(row.categoryId, current);
  }

  let assignmentHistoryRows: DeficiencyAssignmentHistoryRow[] = [];
  const assignedDeficiencyIds = assignedDeficiencies.map((row) => row.id).filter((value) => value.length > 0);
  if (assignedDeficiencyIds.length > 0) {
    const { data: assignmentRows, error: assignmentRowsError } = await supabase
      .from("deficiency_history")
      .select("deficiency_id, member_id, event_type, created_at")
      .in("deficiency_id", assignedDeficiencyIds)
      .eq("member_id", id)
      .eq("event_type", "Assigned")
      .order("created_at", { ascending: false });

    if (assignmentRowsError) {
      throw new Error(assignmentRowsError.message || "Unable to load deficiency assignment history.");
    }

    assignmentHistoryRows = (assignmentRows ?? []) as DeficiencyAssignmentHistoryRow[];
  }

  const personalAssignmentStartedAtByDeficiencyId = new Map<string, string>();
  for (const row of assignmentHistoryRows) {
    if (!row.deficiency_id || !row.created_at || personalAssignmentStartedAtByDeficiencyId.has(row.deficiency_id)) {
      continue;
    }

    personalAssignmentStartedAtByDeficiencyId.set(row.deficiency_id, row.created_at);
  }

  const deficiencyItems: DeficiencyReadinessInput[] = assignedDeficiencies.map((row) => {
    const status = normalizeDeficiencyStatus(row.status_info);
    const priority = normalizeDeficiencyPriority(row.priority_info);
    return {
      id: row.id,
      deficiencyNumber: row.deficiency_number,
      description: row.description,
      priorityName: priority.name,
      assignedToMemberId: row.assigned_to,
      statusName: status.name,
      statusActive: status.active,
      createdAt: row.created_at,
      reportedAt: row.reported_at,
      personalAssignedAt: personalAssignmentStartedAtByDeficiencyId.get(row.id) ?? null,
    };
  });

  const authoritativeReadiness = computeAuthoritativeMemberReadiness({
    currentMemberId: id,
    memberStartDate: memberRequirementStartDate,
    memberDepartmentRoleId,
    roleName: memberDepartmentRoleId ? departmentRoleById.get(memberDepartmentRoleId) ?? null : null,
    canonicalMemberCertifications: canonicalMemberCertificationRows,
    certificationNameById,
    certificationTypeById,
    emsTrackProfiles,
    roleRequiredCertifications,
    certificationCatalog: certificationTypes.map((row) => ({ id: row.id, name: row.name, active: row.active } satisfies CatalogRow)),
    qualificationCatalog: qualificationTypes.map((row) => ({ id: row.id, name: row.name, active: row.active } satisfies CatalogRow)),
    roleRequiredQualifications,
    memberQualifications: memberQualifications.map((row) => ({ qualification_id: row.qualification_id })),
    requirements: readinessRequirements,
    categoryNameById: trainingCategoryLookup,
    fireAnnualComplianceRows: complianceRows,
    categoryHours: Array.from(categoryHoursMap.values()).map((row) => ({ categoryId: row.categoryId, categoryName: row.categoryName, hours: row.hours })),
    deficiencyItems,
  });
  const readinessScore = authoritativeReadiness.readiness;
  const readinessMessage = readinessScore.scorePercent === null
    ? readinessScore.configurationMessage
    : `${Math.round(readinessScore.remainingPercent ?? 0)}% to reach 100%`;
  const coachActions = buildAuthoritativeCoachActions({
    readinessState: readinessScore,
    isSelf: isSelfProfile,
    memberId: id,
    limit: 3,
  });
  const coachSummary = getAuthoritativeCoachSummary({
    readinessState: readinessScore,
    isSelf: isSelfProfile,
  });

  return (
    <PageLayout
      environmentBackgroundUrl="/branding/images/Personnelpage.png"
      environmentBackgroundPosition="left center"
    >
      <div className="mb-8">
        <h1 className="text-5xl font-bold">
          {fullName}
        </h1>

        <p className="mt-2 text-2xl text-neutral-400">
          {rank}
        </p>
      </div>

      <div className="mb-8 grid gap-6 xl:grid-cols-2">
        <div>
          <MemberReadinessCard
            score={readinessScore.scorePercent}
            message={readinessMessage}
            coachActions={coachActions}
            coachSummary={coachSummary}
          />
        </div>

        <div className="h-full rounded-xl border border-neutral-800 bg-neutral-900 p-6">
          <h2 className="mb-6 text-2xl font-semibold">
            Member Information
          </h2>

          <div className="space-y-4 text-neutral-300 lg:grid lg:grid-cols-2 lg:gap-x-10 lg:gap-y-4 lg:space-y-0">
            <p>
              <strong>Email:</strong> {email}
            </p>

            <p>
              <strong>Phone:</strong> {phone}
            </p>

            <p>
              <strong>Status:</strong> {memberActive ? "Active" : "Inactive"}
            </p>

            <p>
              <strong>Hire / Start Date:</strong> {hireStartDate ? formatDateOnly(hireStartDate) : "-"}
            </p>

            <p>
              <strong>Exit / Inactive Date:</strong> {inactiveDate ? formatDateOnly(inactiveDate) : "-"}
            </p>
          </div>

          {!isSelfProfile || canManageOwnProfile ? (
            <>
              <div className="mt-5 flex flex-wrap gap-3">
                <EditMemberButton
                  memberId={String(member.id)}
                  initialFirstName={firstName}
                  initialLastName={lastName}
                  initialEmail={email === "-" ? "" : email}
                  initialPhone={phone === "-" ? "" : phone}
                  initialRank={rank === "Unassigned" ? "Firefighter" : rank}
                  initialActive={memberActive}
                  initialHireStartDate={hireStartDate ?? ""}
                  initialInactiveDate={inactiveDate ?? ""}
                  initialSpecialPermissionsEnabled={specialPermissionsEnabled}
                  initialPermissionKeys={memberPermissionKeys}
                  permissionOptions={permissionOptions}
                />

                <CreateAuthAccountButton
                  memberId={String(member.id)}
                  memberEmail={email === "-" ? "" : email}
                  hasAuthAccount={hasAuthAccount}
                />
              </div>

              <DepartmentRoleSelector
                departmentId={currentMember.departmentId}
                memberId={String(member.id)}
                currentMemberId={currentMember.id}
                selectedRoleId={typeof member.department_role_id === "string" ? member.department_role_id : null}
                departmentRoles={departmentRoles}
              />
            </>
          ) : null}
        </div>
      </div>

      {!isSelfProfile || canManageOwnCertifications ? (
        <>
          <div className="mt-6">
            <PersonnelCertificationsSection
              editorMemberId={currentMember.id}
              departmentId={currentMember.departmentId}
              memberId={String(member.id)}
              warningDays={department.settings.certificationWarningDays}
              certificationTypes={certificationTypes}
              memberCertifications={canonicalMemberCertificationRows}
              departmentDocuments={departmentDocuments}
            />
          </div>

          <div className="mt-6">
            <PersonnelEmsTracksSection
              departmentId={currentMember.departmentId}
              memberId={String(member.id)}
              editorMemberId={currentMember.id}
              trackRows={emsTrackProfiles}
            />
          </div>
        </>
      ) : null}

      <div className="mt-6 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <div className="flex flex-col gap-3 border-b border-neutral-800 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">Training History</h2>
            <p className="mt-2 text-sm text-neutral-400">
              Completed training records for this member.
            </p>
          </div>

          <div className="rounded-lg border border-white/10 bg-neutral-950 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-neutral-400">Training Hours</p>
            <p className="mt-1 text-2xl font-bold text-white">{totalTrainingHours.toFixed(2)}</p>
          </div>
        </div>

        {trainingHistory.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-neutral-700 bg-neutral-950 p-8 text-center text-neutral-400">
            No training completed yet.
          </div>
        ) : (
          <div className="mt-5 overflow-hidden rounded-xl border border-neutral-800 bg-[#111111]">
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[980px]">
                <thead className="border-b border-neutral-800 bg-neutral-950">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.16em] text-neutral-500">Training</th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.16em] text-neutral-500">Source</th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.16em] text-neutral-500">Category</th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.16em] text-neutral-500">Date</th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.16em] text-neutral-500">Start Time</th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.16em] text-neutral-500">Hours</th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.16em] text-neutral-500">Method</th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.16em] text-neutral-500">Instructor</th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.16em] text-neutral-500">Location</th>
                  </tr>
                </thead>
                <tbody>
                  {trainingHistory.map((record) => (
                    <tr key={record.id} className="border-b border-neutral-800 transition hover:bg-neutral-800/40">
                      <td className="px-4 py-3 font-medium text-white">{record.title}</td>
                      <td className="px-4 py-3 text-sm text-neutral-200">
                        {record.source === "outside_submission" ? "Outside" : "Department"}
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-200">{record.categoryName}</td>
                      <td className="px-4 py-3 text-sm text-neutral-200">{formatDateOnly(record.completedAt)}</td>
                      <td className="px-4 py-3 text-sm text-neutral-200">{record.startTimeValue ? formatStartTime(record.startTimeValue) : "-"}</td>
                      <td className="px-4 py-3 text-sm text-neutral-200">{record.hoursCredit?.toFixed(2) ?? "-"}</td>
                      <td className="px-4 py-3 text-sm text-neutral-200">{record.trainingMethod || "-"}</td>
                      <td className="px-4 py-3 text-sm text-neutral-200">{record.instructorName || "-"}</td>
                      <td className="px-4 py-3 text-sm text-neutral-200">{record.location || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 p-4 md:hidden">
              {trainingHistory.map((record) => (
                <div key={record.id} className="rounded-xl border border-white/10 bg-[#151515] p-4">
                  <p className="text-base font-semibold text-white">{record.title}</p>
                  <p className="mt-1 text-xs text-neutral-400">
                    {record.source === "outside_submission" ? "Outside" : "Department"} • {record.categoryName}
                  </p>
                  <div className="mt-3 grid gap-1 text-sm text-neutral-300">
                    <p>Date: {formatDateOnly(record.completedAt)}</p>
                    <p>Start: {record.startTimeValue ? formatStartTime(record.startTimeValue) : "-"}</p>
                    <p>Hours: {record.hoursCredit?.toFixed(2) ?? "-"}</p>
                    <p>Method: {record.trainingMethod || "-"}</p>
                    <p>Instructor: {record.instructorName || "-"}</p>
                    <p>Location: {record.location || "-"}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6">
        <RoleRequirementsSection
          departmentRoles={departmentRoles}
          memberDepartmentRoleId={typeof member.department_role_id === "string" ? member.department_role_id : null}
          certificationTypes={certificationTypes}
          qualificationTypes={qualificationTypes}
          memberCertifications={canonicalMemberCertificationRows}
          memberQualifications={memberQualifications}
          roleRequiredCertifications={roleRequiredCertifications}
          roleRequiredQualifications={roleRequiredQualifications}
        />
      </div>
    </PageLayout>
  );
}