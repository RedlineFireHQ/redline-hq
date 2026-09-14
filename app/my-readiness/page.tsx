import { redirect } from "next/navigation";
import Link from "next/link";
import PageLayout from "@/components/layout/PageLayout";
import HistorySection from "@/components/my-readiness/HistorySection";
import AddTrainingButton from "@/components/my-readiness/AddTrainingButton";
import { department } from "@/lib/department";
import {
  applyAuthoritativeCertificationToTrackProfile,
  buildCertificationTypeMetaById,
  findCurrentTrackProfile,
  resolveAuthoritativeEmsCertificationsForMember,
  resolveCertificationStatusFromTrack,
} from "@/lib/ems/authoritative-certifications";
import { getCurrentMember } from "@/lib/current-member";
import { calculateEmsReadiness, type EmsTrackProfileInput, type EmsTrainingRecord } from "@/lib/ems/calculation";
import { recalculateMemberEmsCreditAccounting } from "@/lib/ems/persistent-allocation";
import { type EmsCertificationLevel, type EmsCoreTopicCode } from "@/lib/ems/requirements";
import {
  buildMemberReadinessScore,
  getCertificationStatus,
  parseHours,
  type CertificationStatus,
  type QualificationReadinessInput,
  type ReadinessFactor,
  type RequirementInput,
} from "@/lib/readiness/member-readiness";
import { buildScoredCertificationStatuses } from "@/lib/readiness/scored-certifications";
import { calculateComplianceBucketHours, getTrainingComplianceBucketByCategoryId } from "@/lib/training/compliance-buckets";
import {
  buildCanonicalMemberCertificationRows,
  buildQualificationReadinessAdapter,
  getRoleRequirementComparison,
  type CatalogRow,
  type RoleRequiredCertificationRow,
  type RoleRequiredQualificationRow,
} from "@/lib/role-requirements";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type DepartmentRoleRow = {
  id: string;
  name: string;
  active: boolean;
};

type MemberRoleAssignmentRow = {
  department_role_id: string | null;
  hire_start_date: string | null;
  created_at: string | null;
};

type TrainingAttendanceRow = {
  training_event_id: string;
};

type TrainingEventRow = {
  id: string;
  title: string;
  category_id: string | null;
  starts_at: string;
  hours_credit: number | string | null;
  is_ems_training: boolean;
  ems_core_topic: string | null;
  ems_needs_review: boolean;
};

type OutsideSubmissionRow = {
  id: string;
  title: string;
  category_id: string | null;
  training_date: string;
  hours: number | string | null;
  is_ems_training: boolean;
  ems_core_topic: string | null;
  ems_needs_review: boolean;
  status: string;
  created_at: string;
};

type EmsTrackProfileRow = {
  id: string;
  track: "iowa" | "nremt";
  certification_level: "emr" | "emt" | "aemt" | "paramedic";
  track_status: "active" | "inactive" | "expired" | "not_maintained" | "needs_review";
  maintain_track: boolean;
  certification_number: string | null;
  expiration_date: string | null;
  effective_start_date: string;
  effective_end_date: string | null;
};

type AssignmentMemberRow = {
  id: string;
  training_assignment_id: string;
  completion_status: string;
  due_at: string | null;
  completed_at: string | null;
  hours_earned: number | string | null;
  completion_notes: string | null;
  created_at: string;
  updated_at: string;
};

type AssignmentRow = {
  id: string;
  title: string;
  category_id: string | null;
  due_at: string | null;
  hours_credit: number | string | null;
  is_required: boolean;
  review_required: boolean;
  status: string;
};

type TrainingCategoryRow = {
  id: string;
  name: string;
  active: boolean;
};

type EmsCourseDefinitionRow = {
  id: string;
  course_name: string;
  active: boolean;
};

type MemberCertificationRow = {
  id: string;
  certification_id: string;
  certificate_number: string | null;
  issued_at: string;
  expires_at: string | null;
  supporting_document_id: string | null;
  created_at: string;
  updated_at: string;
};

type CertificationTypeRow = {
  id: string;
  name: string;
  ems_authority: "iowa" | "nremt" | null;
  ems_certification_level: "emr" | "emt" | "aemt" | "paramedic" | null;
};

type DocumentRow = {
  id: string;
  title: string;
  category: string;
};

type HistoryItem = {
  id: string;
  occurred_at: string;
  title: string;
  detail: string;
  source:
    | "department_training"
    | "self_submitted_training"
    | "certification"
    | "deficiency"
    | "maintenance"
    | "apparatus";
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

type ApparatusInspectionRow = {
  id: string;
  created_at: string | null;
  status: string | null;
};

type ApparatusCheckSessionMemberRow = {
  session_id: string;
};

type ApparatusCheckSessionRow = {
  id: string;
  completed_inspection_id: string | null;
};

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

function certificationStatusLabel(status: CertificationStatus) {
  if (status === "expired") {
    return "Expired";
  }

  if (status === "expiring_soon") {
    return "Expiring Soon";
  }

  return "Current";
}

function certificationStatusClasses(status: CertificationStatus) {
  if (status === "expired") {
    return "border-red-500/30 bg-red-500/10 text-red-200";
  }

  if (status === "expiring_soon") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  }

  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
}

function sourceLabel(source: HistoryItem["source"]) {
  if (source === "department_training") {
    return "Department Training";
  }

  if (source === "self_submitted_training") {
    return "Self-Reported Training";
  }

  if (source === "certification") {
    return "Certification";
  }

  if (source === "deficiency") {
    return "Deficiency";
  }

  if (source === "maintenance") {
    return "Maintenance";
  }

  return "Apparatus";
}

function normalizeEmsTopic(value: string | null): EmsCoreTopicCode | null {
  if (
    value === "airway_respirations_ventilations" ||
    value === "cardiology" ||
    value === "trauma" ||
    value === "medical" ||
    value === "operations" ||
    value === "other"
  ) {
    return value;
  }

  return null;
}

function normalizeEmsLevel(value: string): EmsCertificationLevel {
  if (value === "emr" || value === "emt" || value === "aemt" || value === "paramedic") {
    return value;
  }

  return "emt";
}

function normalizeEmsStatus(value: string): "active" | "inactive" | "expired" | "not_maintained" | "needs_review" {
  if (value === "active" || value === "inactive" || value === "expired" || value === "not_maintained" || value === "needs_review") {
    return value;
  }

  return "needs_review";
}

function formatEmsTopicLabel(topic: string) {
  if (topic === "airway_respirations_ventilations") {
    return "Airway, Respirations, Ventilations";
  }

  if (topic === "cardiology") {
    return "Cardiology";
  }

  if (topic === "trauma") {
    return "Trauma";
  }

  if (topic === "medical") {
    return "Medical";
  }

  if (topic === "operations") {
    return "Operations";
  }

  return "Other";
}

function formatEmsProgressStatus(status: string) {
  if (status === "complete") {
    return "Complete";
  }

  if (status === "on_track") {
    return "On Track";
  }

  if (status === "needs_attention") {
    return "Needs Attention";
  }

  if (status === "not_maintained") {
    return "Not Maintained";
  }

  return "Not Configured";
}

function emsProgressStatusClasses(status: string) {
  if (status === "complete") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  }

  if (status === "on_track") {
    return "border-blue-500/30 bg-blue-500/10 text-blue-200";
  }

  if (status === "needs_attention") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  }

  return "border-neutral-600/40 bg-neutral-700/20 text-neutral-300";
}

function isEmsLikeCertificationName(value: string) {
  return /(ems|emt|aemt|paramedic|emergency medical|advanced life support|nremt)/i.test(value);
}

function isActionableCoachMessage(actionNeeded: string) {
  return !/^no action needed\.?$/i.test(actionNeeded.trim());
}

function isInCalendarYear(value: string | null | undefined, year: number) {
  if (!value) {
    return false;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return parsed.getUTCFullYear() === year;
}

function coachUrgencyScore(factor: ReadinessFactor) {
  let score = 100 - factor.completionPercent;
  const actionText = factor.actionNeeded.toLowerCase();
  const statusText = factor.statusLabel.toLowerCase();

  if (factor.category === "certification") {
    score += 24;
  } else if (factor.category === "training") {
    score += 18;
  } else if (factor.category === "qualification") {
    score += 14;
  } else {
    score += 20;
  }

  if (actionText.includes("expired") || statusText.includes("expired")) {
    score += 40;
  }

  if (actionText.includes("expiring soon") || statusText.includes("expiring soon")) {
    score += 28;
  }

  if (actionText.includes("assigned to you") || actionText.includes("penalty")) {
    score += 26;
  }

  return score;
}

function buildPrimaryCoachSentence(
  readinessScore: { configured: boolean; configurationMessage: string; coachItems: Array<{ explanation: string }> },
  actionableExplanations: string[],
) {
  if (!readinessScore.configured) {
    return readinessScore.configurationMessage;
  }

  if (actionableExplanations.length > 0) {
    return actionableExplanations[0];
  }

  const primaryItem = readinessScore.coachItems[0] ?? null;
  if (!primaryItem) {
    return "You are currently fully configured and on track.";
  }

  return primaryItem.explanation;
}

function normalizeDeficiencyStatus(
  relation: DeficiencyStatusRelation | DeficiencyStatusRelation[] | null,
) {
  const row = Array.isArray(relation) ? relation[0] : relation;
  if (!row) {
    return { name: null, active: null };
  }

  return {
    name: typeof row.name === "string" ? row.name : null,
    active: typeof row.active === "boolean" ? row.active : null,
  };
}

function normalizeDeficiencyPriority(
  relation: DeficiencyPriorityRelation | DeficiencyPriorityRelation[] | null,
) {
  const row = Array.isArray(relation) ? relation[0] : relation;
  if (!row) {
    return { name: null };
  }

  return {
    name: typeof row.name === "string" ? row.name : null,
  };
}

export default async function MyReadinessPage() {
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);

  if (!currentMember?.departmentId) {
    redirect("/login");
  }

  const [
    { data: attendanceRows, error: attendanceError },
    { data: approvedOutsideRows, error: approvedOutsideError },
    { data: allOutsideRows, error: allOutsideError },
    { data: certificationsRows, error: certificationsError },
    { data: certificationTypesRows, error: certificationTypesError },
    { data: requirementsRows, error: requirementsError },
    { data: memberRoleRow, error: memberRoleError },
    { data: departmentRolesRows, error: departmentRolesError },
    { data: qualificationTypesRows, error: qualificationTypesError },
    { data: memberQualificationsRows, error: memberQualificationsError },
    { data: roleRequiredCertificationRows, error: roleRequiredCertificationError },
    { data: roleRequiredQualificationRows, error: roleRequiredQualificationError },
    { data: assignedDeficiencyRows, error: assignedDeficiencyRowsError },
    { data: deficiencyHistoryRows, error: deficiencyHistoryError },
    { data: assignmentMemberRows, error: assignmentMemberError },
    { data: maintenanceRows, error: maintenanceError },
    { data: apparatusRows, error: apparatusError },
    { data: apparatusSessionMemberRows, error: apparatusSessionMemberError },
    { data: emsTrackProfileRows, error: emsTrackProfileError },
  ] = await Promise.all([
    supabase
      .from("training_event_attendance")
      .select("training_event_id")
      .eq("department_id", currentMember.departmentId)
      .eq("member_id", currentMember.id)
      .eq("attendance_status", "attending"),
    supabase
      .from("training_outside_submissions")
      .select("id, title, category_id, training_date, hours, is_ems_training, ems_core_topic, ems_needs_review, status, created_at")
      .eq("department_id", currentMember.departmentId)
      .eq("member_id", currentMember.id)
      .eq("status", "approved")
      .order("training_date", { ascending: false }),
    supabase
      .from("training_outside_submissions")
      .select("id, title, category_id, training_date, hours, is_ems_training, ems_core_topic, ems_needs_review, status, created_at")
      .eq("department_id", currentMember.departmentId)
      .eq("member_id", currentMember.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("member_certifications")
      .select("id, certification_id, certificate_number, issued_at, expires_at, supporting_document_id, created_at, updated_at")
      .eq("department_id", currentMember.departmentId)
      .eq("member_id", currentMember.id)
      .order("expires_at", { ascending: true }),
    supabase
      .from("certifications")
      .select("id, name, ems_authority, ems_certification_level")
      .eq("department_id", currentMember.departmentId),
    supabase
      .from("training_requirements")
      .select("id, name, requirement_kind, period_type, minimum_hours, category_id, due_frequency_rule, required_topic, active, sort_order, config_json")
      .eq("department_id", currentMember.departmentId)
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("members")
      .select("department_role_id, hire_start_date, created_at")
      .eq("department_id", currentMember.departmentId)
      .eq("id", currentMember.id)
      .single(),
    supabase
      .from("department_roles")
      .select("id, name, active")
      .eq("department_id", currentMember.departmentId),
    supabase
      .from("qualifications")
      .select("id, name, active")
      .eq("department_id", currentMember.departmentId),
    supabase
      .from("member_qualifications")
      .select("qualification_id")
      .eq("department_id", currentMember.departmentId)
      .eq("member_id", currentMember.id),
    supabase
      .from("role_required_certifications")
      .select("department_role_id, certification_id")
      .eq("department_id", currentMember.departmentId),
    supabase
      .from("role_required_qualifications")
      .select("department_role_id, qualification_id")
      .eq("department_id", currentMember.departmentId),
    supabase
      .from("deficiencies")
      .select(
        "id, deficiency_number, description, assigned_to, created_at, reported_at, status_info:deficiency_statuses!fk_deficiencies_status(name, active), priority_info:deficiency_priorities!fk_deficiencies_priority(name)",
      )
      .eq("assigned_to", currentMember.id),
    supabase
      .from("deficiency_history")
      .select("id, event_type, event_description, created_at")
      .eq("member_id", currentMember.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("training_assignment_members")
      .select(
        "id, training_assignment_id, completion_status, due_at, completed_at, hours_earned, completion_notes, created_at, updated_at",
      )
      .eq("department_id", currentMember.departmentId)
      .eq("member_id", currentMember.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("maintenance_records")
      .select("id, maintenance_number, maintenance_type, service_date, description")
      .eq("completed_by", currentMember.id)
      .order("service_date", { ascending: false })
      .limit(20),
    supabase
      .from("apparatus_inspections")
      .select("id, created_at, status")
      .eq("member_id", currentMember.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("apparatus_check_session_members")
      .select("session_id")
      .eq("member_id", currentMember.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("ems_member_track_profiles")
      .select("id, track, certification_level, track_status, maintain_track, certification_number, expiration_date, effective_start_date, effective_end_date")
      .eq("department_id", currentMember.departmentId)
      .eq("member_id", currentMember.id)
      .order("effective_start_date", { ascending: false }),
  ]);

  if (attendanceError) {
    throw new Error(attendanceError.message || "Unable to load department training attendance.");
  }

  if (approvedOutsideError || allOutsideError) {
    throw new Error(
      approvedOutsideError?.message || allOutsideError?.message || "Unable to load self-reported training.",
    );
  }

  if (certificationsError || certificationTypesError) {
    throw new Error(certificationsError?.message || certificationTypesError?.message || "Unable to load certifications.");
  }

  if (requirementsError) {
    throw new Error(requirementsError.message || "Unable to load training requirements.");
  }

  if (
    memberRoleError ||
    departmentRolesError ||
    qualificationTypesError ||
    memberQualificationsError ||
    roleRequiredCertificationError ||
    roleRequiredQualificationError
  ) {
    throw new Error(
      memberRoleError?.message ||
        departmentRolesError?.message ||
        qualificationTypesError?.message ||
        memberQualificationsError?.message ||
        roleRequiredCertificationError?.message ||
        roleRequiredQualificationError?.message ||
        "Unable to load role requirement details.",
    );
  }

  if (deficiencyHistoryError || maintenanceError || apparatusError) {
    throw new Error(
      deficiencyHistoryError?.message ||
        maintenanceError?.message ||
        apparatusError?.message ||
        "Unable to load readiness history.",
    );
  }

  if (apparatusSessionMemberError) {
    throw new Error(apparatusSessionMemberError.message || "Unable to load apparatus participation history.");
  }

  if (emsTrackProfileError) {
    throw new Error(emsTrackProfileError.message || "Unable to load EMS track profiles.");
  }

  if (assignedDeficiencyRowsError) {
    throw new Error(assignedDeficiencyRowsError.message || "Unable to load assigned deficiencies.");
  }

  if (assignmentMemberError) {
    throw new Error(assignmentMemberError.message || "Unable to load assigned training.");
  }

  const attendance = (attendanceRows ?? []) as TrainingAttendanceRow[];
  const approvedOutside = (approvedOutsideRows ?? []) as OutsideSubmissionRow[];
  const allOutside = (allOutsideRows ?? []) as OutsideSubmissionRow[];
  const rawMemberCertifications = (certificationsRows ?? []) as MemberCertificationRow[];
  const certificationTypes = (certificationTypesRows ?? []) as CertificationTypeRow[];
  const requirements = (requirementsRows ?? []) as RequirementInput[];
  const roleAssignment = (memberRoleRow ?? null) as MemberRoleAssignmentRow | null;
  const memberRequirementStartDate = roleAssignment?.hire_start_date ?? roleAssignment?.created_at ?? null;
  const departmentRoles = ((departmentRolesRows ?? []) as DepartmentRoleRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    active: row.active,
  }));
  const qualificationTypes: CatalogRow[] = ((qualificationTypesRows ?? []) as CatalogRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    active: row.active,
  }));
  const memberQualifications = ((memberQualificationsRows ?? []) as Array<{ qualification_id: string }>).map((row) => ({
    qualification_id: row.qualification_id,
  }));
  const memberCertifications = buildCanonicalMemberCertificationRows({
    certificationTypes: certificationTypes.map((row) => ({ id: row.id, name: row.name, active: true } satisfies CatalogRow)),
    qualificationTypes,
    memberCertifications: rawMemberCertifications,
    memberQualifications,
  }).map((row) => ({
    id: row.id ?? row.certification_id,
    certification_id: row.certification_id,
    certificate_number: row.certificate_number ?? null,
    issued_at: row.issued_at ?? "",
    expires_at: row.expires_at,
    supporting_document_id: row.supporting_document_id ?? null,
    created_at: row.created_at ?? row.issued_at ?? "",
    updated_at: row.updated_at ?? row.created_at ?? row.issued_at ?? "",
  }));
  const roleRequiredCertifications = ((roleRequiredCertificationRows ?? []) as RoleRequiredCertificationRow[]).map((row) => ({
    department_role_id: row.department_role_id,
    certification_id: row.certification_id,
  }));
  const roleRequiredQualifications = ((roleRequiredQualificationRows ?? []) as RoleRequiredQualificationRow[]).map((row) => ({
    department_role_id: row.department_role_id,
    qualification_id: row.qualification_id,
  }));
  const assignedDeficiencies = (assignedDeficiencyRows ?? []) as DeficiencyAssignedRow[];
  const assignmentMembers = (assignmentMemberRows ?? []) as AssignmentMemberRow[];
  const inspectorApparatusRows = (apparatusRows ?? []) as ApparatusInspectionRow[];
  const apparatusSessionMembershipRows = (apparatusSessionMemberRows ?? []) as ApparatusCheckSessionMemberRow[];
  const emsTrackProfiles = (emsTrackProfileRows ?? []) as EmsTrackProfileRow[];

  const participationSessionIds = Array.from(
    new Set(
      apparatusSessionMembershipRows
        .map((row) => row.session_id)
        .filter((sessionId): sessionId is string => typeof sessionId === "string" && sessionId.length > 0),
    ),
  );

  let helperParticipationInspectionRows: ApparatusInspectionRow[] = [];
  const inspectorInspectionIdSet = new Set(inspectorApparatusRows.map((row) => row.id));
  if (participationSessionIds.length > 0) {
    const { data: participationSessionRowsRaw, error: participationSessionRowsError } = await supabase
      .from("apparatus_check_sessions")
      .select("id, completed_inspection_id")
      .in("id", participationSessionIds)
      .not("completed_inspection_id", "is", null);

    if (participationSessionRowsError) {
      throw new Error(participationSessionRowsError.message || "Unable to load apparatus participation sessions.");
    }

    const participationSessionRows = (participationSessionRowsRaw ?? []) as ApparatusCheckSessionRow[];
    const participationInspectionIds = Array.from(
      new Set(
        participationSessionRows
          .map((row) => row.completed_inspection_id)
          .filter(
            (inspectionId): inspectionId is string =>
              typeof inspectionId === "string" && inspectionId.length > 0,
          ),
      ),
    );

    if (participationInspectionIds.length > 0) {
      const { data: helperInspectionRowsRaw, error: helperInspectionRowsError } = await supabase
        .from("apparatus_inspections")
        .select("id, created_at, status")
        .in("id", participationInspectionIds)
        .order("created_at", { ascending: false });

      if (helperInspectionRowsError) {
        throw new Error(helperInspectionRowsError.message || "Unable to load apparatus participation inspections.");
      }

      helperParticipationInspectionRows = ((helperInspectionRowsRaw ?? []) as ApparatusInspectionRow[]).filter(
        (row) => !inspectorInspectionIdSet.has(row.id),
      );
    }
  }

  const assignmentIds = Array.from(
    new Set(
      assignmentMembers
        .map((row) => row.training_assignment_id)
        .filter((id) => typeof id === "string" && id.length > 0),
    ),
  );

  let assignments: AssignmentRow[] = [];
  if (assignmentIds.length > 0) {
    const { data: assignmentRowsData, error: assignmentRowsError } = await supabase
      .from("training_assignments")
      .select("id, title, category_id, due_at, hours_credit, is_required, review_required, status")
      .eq("department_id", currentMember.departmentId)
      .in("id", assignmentIds);

    if (assignmentRowsError) {
      throw new Error(assignmentRowsError.message || "Unable to load assigned training details.");
    }

    assignments = (assignmentRowsData ?? []) as AssignmentRow[];
  }

  const attendedEventIds = Array.from(
    new Set(attendance.map((row) => row.training_event_id).filter((id) => typeof id === "string" && id.length > 0)),
  );

  let attendedEvents: TrainingEventRow[] = [];
  if (attendedEventIds.length > 0) {
    const { data: eventsRows, error: eventsError } = await supabase
      .from("training_events")
      .select("id, title, category_id, starts_at, hours_credit, is_ems_training, ems_core_topic, ems_needs_review")
      .eq("department_id", currentMember.departmentId)
      .in("id", attendedEventIds)
      .order("starts_at", { ascending: false });

    if (eventsError) {
      throw new Error(eventsError.message || "Unable to load attended training events.");
    }

    attendedEvents = (eventsRows ?? []) as TrainingEventRow[];
  }

  const categoryIds = Array.from(
    new Set(
      [
        ...attendedEvents.map((row) => row.category_id),
        ...approvedOutside.map((row) => row.category_id),
        ...assignments.map((row) => row.category_id),
      ].filter(
        (id): id is string => Boolean(id),
      ),
    ),
  );

  let categories: TrainingCategoryRow[] = [];
  if (categoryIds.length > 0) {
    const { data: categoryRows, error: categoryError } = await supabase
      .from("training_categories")
      .select("id, name")
      .eq("department_id", currentMember.departmentId)
      .in("id", categoryIds);

    if (categoryError) {
      throw new Error(categoryError.message || "Unable to load training categories.");
    }

    categories = (categoryRows ?? []) as TrainingCategoryRow[];
  }

  const [
    { data: addTrainingCategoryRows, error: addTrainingCategoryError },
    { data: emsCourseDefinitionRows, error: emsCourseDefinitionError },
  ] = await Promise.all([
    supabase
      .from("training_categories")
      .select("id, name, active")
      .eq("department_id", currentMember.departmentId)
      .order("name", { ascending: true }),
    supabase
      .from("ems_course_definitions")
      .select("id, course_name, active")
      .eq("department_id", currentMember.departmentId)
      .eq("active", true)
      .order("course_name", { ascending: true }),
  ]);

  if (addTrainingCategoryError) {
    throw new Error(addTrainingCategoryError.message || "Unable to load training categories.");
  }

  if (emsCourseDefinitionError) {
    throw new Error(emsCourseDefinitionError.message || "Unable to load EMS course definitions.");
  }

  const addTrainingCategories: TrainingCategoryRow[] = (addTrainingCategoryRows ?? []).map((row) => ({
    id: String(row.id),
    name: typeof row.name === "string" ? row.name : "",
    active: typeof row.active === "boolean" ? row.active : true,
  }));

  const emsCourseDefinitions: EmsCourseDefinitionRow[] = (emsCourseDefinitionRows ?? []).map((row) => ({
    id: String(row.id),
    course_name: typeof row.course_name === "string" ? row.course_name : "",
    active: row.active === true,
  }));

  const categoryNameById = new Map(categories.map((row) => [row.id, row.name]));
  const memberCertificationDocumentIds = Array.from(
    new Set(
      memberCertifications
        .map((row) => row.supporting_document_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  );

  let certificationDocumentRows: DocumentRow[] = [];
  if (memberCertificationDocumentIds.length > 0) {
    const { data: documentRowsData, error: documentRowsError } = await supabase
      .from("documents")
      .select("id, title, category")
      .eq("department_id", currentMember.departmentId)
      .in("id", memberCertificationDocumentIds);

    if (documentRowsError) {
      throw new Error(documentRowsError.message || "Unable to load certification documents.");
    }

    certificationDocumentRows = (documentRowsData ?? []) as DocumentRow[];
  }

  const certificationDocumentById = new Map(certificationDocumentRows.map((row) => [row.id, row]));
  const certificationNameById = new Map(certificationTypes.map((row) => [row.id, row.name]));
  const certificationTypeById = buildCertificationTypeMetaById(
    certificationTypes.map((row) => ({
      id: row.id,
      ems_authority: row.ems_authority,
      ems_certification_level: row.ems_certification_level,
    })),
  );
  const departmentRoleById = new Map(departmentRoles.map((row) => [row.id, row]));
  const certificationCatalog: CatalogRow[] = certificationTypes.map((row) => ({
    id: row.id,
    name: row.name,
    active: true,
  }));

  const memberDepartmentRoleId = typeof roleAssignment?.department_role_id === "string" ? roleAssignment.department_role_id : null;
  const selectedDepartmentRole = memberDepartmentRoleId ? departmentRoleById.get(memberDepartmentRoleId) ?? null : null;
  const roleRequirementComparison = getRoleRequirementComparison({
    memberDepartmentRoleId,
    certificationTypes: certificationCatalog,
    qualificationTypes,
    roleRequiredCertifications,
    roleRequiredQualifications,
    memberCertifications,
    memberQualifications,
  });
  const qualificationReadinessAdapter = buildQualificationReadinessAdapter({
    memberDepartmentRoleId,
    certificationTypes: certificationCatalog,
    qualificationTypes,
    roleRequiredCertifications,
    roleRequiredQualifications,
    memberCertifications,
    memberQualifications,
  });
  const qualificationReadiness: QualificationReadinessInput = {
    hasAssignedRole: memberDepartmentRoleId !== null,
    roleName: selectedDepartmentRole?.name ?? null,
    requiredQualifications: qualificationReadinessAdapter.requiredQualifications,
    completedQualifications: qualificationReadinessAdapter.completedQualifications,
    missingQualifications: qualificationReadinessAdapter.missingQualifications,
  };
  const assignmentById = new Map(assignments.map((row) => [row.id, row]));
  const approvedHomeworkMembers = assignmentMembers.filter((row) => row.completion_status === "approved");
  const requiredOutstandingHomework = assignmentMembers
    .map((row) => ({
      row,
      assignment: assignmentById.get(row.training_assignment_id) ?? null,
    }))
    .filter(({ row, assignment }) => {
      if (!assignment) {
        return false;
      }

      if (assignment.is_required !== true) {
        return false;
      }

      if (assignment.status === "archived") {
        return false;
      }

      return row.completion_status !== "approved";
    })
    .sort((left, right) => {
      const leftDue = new Date(left.row.due_at ?? left.assignment?.due_at ?? "").getTime();
      const rightDue = new Date(right.row.due_at ?? right.assignment?.due_at ?? "").getTime();
      const leftScore = Number.isFinite(leftDue) ? leftDue : Number.MAX_SAFE_INTEGER;
      const rightScore = Number.isFinite(rightDue) ? rightDue : Number.MAX_SAFE_INTEGER;
      return leftScore - rightScore;
    });

  const currentCalendarYear = new Date().getUTCFullYear();

  const complianceBucketHours = calculateComplianceBucketHours(
    [
      ...attendedEvents.map((event) => ({
        categoryId: event.category_id,
        hours: event.hours_credit,
      })),
      ...approvedOutside.map((submission) => ({
        categoryId: submission.category_id,
        hours: submission.hours,
      })),
      ...approvedHomeworkMembers.map((approvedHomework) => {
        const assignment = assignmentById.get(approvedHomework.training_assignment_id);
        const assignmentHours = assignment ? parseHours(assignment.hours_credit) : 0;
        const rowHours = parseHours(approvedHomework.hours_earned);
        return {
          categoryId: assignment?.category_id ?? null,
          hours: rowHours > 0 ? rowHours : assignmentHours,
        };
      }),
    ],
    categoryNameById,
  );

  const fireAnnualTrainingHours = complianceBucketHours.fireAnnualHours;

  const categoryHoursMap = new Map<string, { categoryId: string | null; name: string; hours: number }>();

  for (const event of attendedEvents) {
    const categoryName = event.category_id ? categoryNameById.get(event.category_id) ?? "Uncategorized" : "Uncategorized";
    const key = event.category_id || "uncategorized";
    const current = categoryHoursMap.get(key) ?? { categoryId: event.category_id, name: categoryName, hours: 0 };
    current.hours += parseHours(event.hours_credit);
    categoryHoursMap.set(key, current);
  }

  for (const submission of approvedOutside) {
    const categoryName = submission.category_id
      ? categoryNameById.get(submission.category_id) ?? "Uncategorized"
      : "Uncategorized";
    const key = submission.category_id || "uncategorized";
    const current = categoryHoursMap.get(key) ?? { categoryId: submission.category_id, name: categoryName, hours: 0 };
     current.hours += parseHours(submission.hours);
     categoryHoursMap.set(key, current);
   }

   for (const approvedHomework of approvedHomeworkMembers) {
    const assignment = assignmentById.get(approvedHomework.training_assignment_id);
    if (!assignment) {
      continue;
    }

    const categoryName = assignment.category_id
      ? categoryNameById.get(assignment.category_id) ?? "Uncategorized"
      : "Uncategorized";
    const key = assignment.category_id || "uncategorized";
    const current = categoryHoursMap.get(key) ?? { categoryId: assignment.category_id, name: categoryName, hours: 0 };
    const assignmentHours = parseHours(assignment.hours_credit);
    const rowHours = parseHours(approvedHomework.hours_earned);
    current.hours += rowHours > 0 ? rowHours : assignmentHours;
    categoryHoursMap.set(key, current);
   }

   const categoryBreakdown = Array.from(categoryHoursMap.values()).sort((a, b) => b.hours - a.hours);

  const calendarYearRecords = [
    ...attendedEvents
      .filter((event) => isInCalendarYear(event.starts_at, currentCalendarYear))
      .map((event) => ({
        id: `event-${event.id}`,
        bucket: event.is_ems_training === true ? "ems" as const : "fire" as const,
        categoryId: event.category_id,
        categoryName: event.category_id ? categoryNameById.get(event.category_id) ?? "Uncategorized" : "Uncategorized",
        hours: parseHours(event.hours_credit),
      })),
    ...approvedOutside
      .filter((submission) => isInCalendarYear(submission.training_date, currentCalendarYear))
      .map((submission) => ({
        id: `outside-${submission.id}`,
        bucket: submission.is_ems_training === true ? "ems" as const : "fire" as const,
        categoryId: submission.category_id,
        categoryName: submission.category_id ? categoryNameById.get(submission.category_id) ?? "Uncategorized" : "Uncategorized",
        hours: parseHours(submission.hours),
      })),
    ...approvedHomeworkMembers
      .map((approvedHomework) => {
        const assignment = assignmentById.get(approvedHomework.training_assignment_id);
        if (!assignment) {
          return null;
        }

        const completionDate = approvedHomework.completed_at ?? approvedHomework.updated_at ?? approvedHomework.created_at;
        if (!isInCalendarYear(completionDate, currentCalendarYear)) {
          return null;
        }

        const assignmentHours = parseHours(assignment.hours_credit);
        const rowHours = parseHours(approvedHomework.hours_earned);
        const categoryName = assignment.category_id
          ? categoryNameById.get(assignment.category_id) ?? "Uncategorized"
          : "Uncategorized";
        const classificationBucket = getTrainingComplianceBucketByCategoryId(assignment.category_id, categoryNameById);

        return {
          id: `homework-${approvedHomework.id}`,
          bucket: classificationBucket === "ems_ce" ? "ems" as const : "fire" as const,
          categoryId: assignment.category_id,
          categoryName,
          hours: rowHours > 0 ? rowHours : assignmentHours,
        };
      })
      .filter((row): row is { id: string; bucket: "fire" | "ems"; categoryId: string | null; categoryName: string; hours: number } => row !== null),
  ].filter((row) => row.hours > 0);

  const calendarYearFireTrainingHours = calendarYearRecords
    .filter((row) => row.bucket === "fire")
    .reduce((total, row) => total + row.hours, 0);
  const calendarYearEmsTrainingHours = calendarYearRecords
    .filter((row) => row.bucket === "ems")
    .reduce((total, row) => total + row.hours, 0);
  const calendarYearTotalTrainingHours = calendarYearFireTrainingHours + calendarYearEmsTrainingHours;

  const fireTrainingByCategoryMap = new Map<string, { categoryName: string; hours: number }>();
  const emsTrainingByCategoryMap = new Map<string, { categoryName: string; hours: number }>();

  for (const row of calendarYearRecords) {
    const key = row.categoryId ?? `uncategorized-${row.bucket}`;
    const sourceMap = row.bucket === "ems" ? emsTrainingByCategoryMap : fireTrainingByCategoryMap;
    const current = sourceMap.get(key) ?? { categoryName: row.categoryName, hours: 0 };
    current.hours += row.hours;
    sourceMap.set(key, current);
  }

  const fireTrainingBreakdown = Array.from(fireTrainingByCategoryMap.values()).sort((a, b) => b.hours - a.hours);
  const emsTrainingBreakdown = Array.from(emsTrainingByCategoryMap.values()).sort((a, b) => b.hours - a.hours);

  const authoritativeEmsCertifications = resolveAuthoritativeEmsCertificationsForMember({
    memberCertifications: memberCertifications.map((row) => ({
      member_id: currentMember.id,
      certification_id: row.certification_id,
      certificate_number: row.certificate_number,
      expires_at: row.expires_at,
      issued_at: row.issued_at,
    })),
    certificationTypeById,
  });

  const activeIowaProfile = applyAuthoritativeCertificationToTrackProfile({
    track: "iowa",
    profile: findCurrentTrackProfile(emsTrackProfiles, "iowa"),
    authoritativeCertification: authoritativeEmsCertifications.iowa,
  });
  const activeNremtProfile = applyAuthoritativeCertificationToTrackProfile({
    track: "nremt",
    profile: findCurrentTrackProfile(emsTrackProfiles, "nremt"),
    authoritativeCertification: authoritativeEmsCertifications.nremt,
  });

  const certificationCards = memberCertifications.map((row) => {
    const name = certificationNameById.get(row.certification_id) ?? "Unknown Certification";
    const genericStatus = getCertificationStatus(row.expires_at, department.settings.certificationWarningDays);
    const certMeta = certificationTypeById.get(row.certification_id);
    const sourceTrack = certMeta?.authority === "iowa"
      ? activeIowaProfile
      : certMeta?.authority === "nremt"
        ? activeNremtProfile
        : null;
    const status = resolveCertificationStatusFromTrack({
      track: sourceTrack,
      warningDays: department.settings.certificationWarningDays,
      genericStatus,
    });

    return {
      id: row.id,
      certificationId: row.certification_id,
      name,
      expiresAt: row.expires_at,
      status,
      issuedAt: row.issued_at,
      certificateNumber: row.certificate_number,
      supportingDocumentId: row.supporting_document_id,
      supportingDocument: row.supporting_document_id ? certificationDocumentById.get(row.supporting_document_id) ?? null : null,
      isEmsCertification:
        certMeta?.authority === "iowa" ||
        certMeta?.authority === "nremt" ||
        certMeta?.level !== null ||
        isEmsLikeCertificationName(name),
    };
  });

  const scoredCertificationStatuses = buildScoredCertificationStatuses({
    memberDepartmentRoleId,
    certificationStatuses: certificationCards.map((row) => ({
      certificationId: row.certificationId,
      certificationName: row.name,
      status: row.status,
      authority: certificationTypeById.get(row.certificationId)?.authority ?? null,
      expiresAt: row.expiresAt,
    })),
    roleRequiredCertifications,
    includeIowaAuthority: activeIowaProfile !== null,
    includeNremtAuthority: activeNremtProfile?.maintain_track === true,
    includeNonExpiringRoleRequirements: true,
    certificationNameById,
  });

  const generalCertificationCards = certificationCards.filter((row) => !row.isEmsCertification);
  const emsCertificationCards = certificationCards.filter((row) => row.isEmsCertification);

  const assignedDeficiencyIds = assignedDeficiencies.map((row) => row.id).filter((id) => typeof id === "string" && id.length > 0);
  let assignmentHistoryRows: DeficiencyAssignmentHistoryRow[] = [];

  if (assignedDeficiencyIds.length > 0) {
    const { data: assignmentRows, error: assignmentRowsError } = await supabase
      .from("deficiency_history")
      .select("deficiency_id, member_id, event_type, created_at")
      .in("deficiency_id", assignedDeficiencyIds)
      .eq("member_id", currentMember.id)
      .eq("event_type", "Assigned")
      .order("created_at", { ascending: false });

    if (assignmentRowsError) {
      throw new Error(assignmentRowsError.message || "Unable to load deficiency assignment history.");
    }

    assignmentHistoryRows = (assignmentRows ?? []) as DeficiencyAssignmentHistoryRow[];
  }

  const personalAssignmentStartedAtByDeficiencyId = new Map<string, string>();
  for (const row of assignmentHistoryRows) {
    if (!row.deficiency_id || !row.created_at) {
      continue;
    }

    if (!personalAssignmentStartedAtByDeficiencyId.has(row.deficiency_id)) {
      personalAssignmentStartedAtByDeficiencyId.set(row.deficiency_id, row.created_at);
    }
  }

  const currentGeneralCertifications = generalCertificationCards.filter((row) => row.status === "current").length;
  const expiringSoonGeneralCertifications = generalCertificationCards.filter((row) => row.status === "expiring_soon").length;
  const expiredGeneralCertifications = generalCertificationCards.filter((row) => row.status === "expired").length;
  const currentEmsCertifications = emsCertificationCards.filter((row) => row.status === "current").length;
  const expiringSoonEmsCertifications = emsCertificationCards.filter((row) => row.status === "expiring_soon").length;
  const expiredEmsCertifications = emsCertificationCards.filter((row) => row.status === "expired").length;

  const iowaProfileInput: EmsTrackProfileInput | null = activeIowaProfile
    ? {
        level: normalizeEmsLevel(activeIowaProfile.certification_level),
        status: normalizeEmsStatus(activeIowaProfile.track_status),
        expirationDate: activeIowaProfile.expiration_date,
        maintainTrack: true,
      }
    : null;

  const nremtProfileInput: EmsTrackProfileInput | null = activeNremtProfile
    ? {
        level: normalizeEmsLevel(activeNremtProfile.certification_level),
        status: normalizeEmsStatus(activeNremtProfile.track_status),
        expirationDate: activeNremtProfile.expiration_date,
        maintainTrack: activeNremtProfile.maintain_track === true,
      }
    : null;

  const emsTrainingRecords: EmsTrainingRecord[] = [
    ...attendedEvents.map((event) => ({
      id: `event-${event.id}`,
      occurredAt: event.starts_at,
      hours: parseHours(event.hours_credit),
      coreTopic: normalizeEmsTopic(event.ems_core_topic),
      needsReview: event.ems_needs_review === true,
      eligibleForIowa: event.is_ems_training === true,
      eligibleForNremt: event.is_ems_training === true,
      pediatricTagged: false,
    })),
    ...approvedOutside.map((submission) => ({
      id: `outside-${submission.id}`,
      occurredAt: submission.training_date,
      hours: parseHours(submission.hours),
      coreTopic: normalizeEmsTopic(submission.ems_core_topic),
      needsReview: submission.ems_needs_review === true,
      eligibleForIowa: submission.is_ems_training === true,
      eligibleForNremt: submission.is_ems_training === true,
      pediatricTagged: false,
    })),
  ].filter((record) => record.eligibleForIowa || record.eligibleForNremt);

  const emsReadiness = calculateEmsReadiness({
    iowaProfile: iowaProfileInput,
    nremtProfile: nremtProfileInput,
    trainingRecords: emsTrainingRecords,
  });

  const firefighterVisibleEmsWarnings = emsReadiness.warnings.filter(
    (warning) => !warning.includes("NEEDS AUTHORITATIVE VERIFICATION"),
  );

  // My Readiness warning should reflect truly unclassified topic data, not stale review flags.
  const displayUnclassifiedRecordIds = emsTrainingRecords
    .filter((record) => record.coreTopic === null || record.coreTopic === "other")
    .map((record) => record.id);

  // Keep dynamic readiness as the source for display while persisting deterministic accounting records.
  try {
    await recalculateMemberEmsCreditAccounting({
      supabase,
      departmentId: currentMember.departmentId,
      memberId: currentMember.id,
      requestedByMemberId: currentMember.id,
    });
  } catch {
    // Persistence should not block readiness rendering.
  }

  const readinessScore = buildMemberReadinessScore({
    requirementRows: requirements,
    departmentHours: fireAnnualTrainingHours,
    categoryHours: categoryBreakdown.map((row) => ({ categoryId: row.categoryId, categoryName: row.name, hours: row.hours })),
    categoryNameById,
    trainingAssignments: assignments,
    assignmentMembers,
    certificationStatuses: certificationCards.map((row) => ({
      certificationId: row.certificationId,
      certificationName: row.name,
      status: row.status,
    })),
    scoredCertificationStatuses,
    qualificationReadiness,
    currentMemberId: currentMember.id,
    memberStartDate: memberRequirementStartDate,
    deficiencyItems: assignedDeficiencies.map((row) => {
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
    }),
  });

  const readinessPercentDisplay = readinessScore.scorePercent;
  const remainingPercentDisplay = readinessScore.remainingPercent;
  const actionableCoachFactors = readinessScore.factors
    .filter((factor) => !factor.completed)
    .filter((factor) => isActionableCoachMessage(factor.actionNeeded))
    .sort((left, right) => {
      const urgencyDelta = coachUrgencyScore(right) - coachUrgencyScore(left);
      if (urgencyDelta !== 0) {
        return urgencyDelta;
      }

      const completionDelta = left.completionPercent - right.completionPercent;
      if (completionDelta !== 0) {
        return completionDelta;
      }

      return left.title.localeCompare(right.title);
    });
  const actionableCoachExplanations = actionableCoachFactors.map((factor) => factor.actionNeeded);
  const primaryCoachSentence = buildPrimaryCoachSentence(readinessScore, actionableCoachExplanations);
  const hasAdditionalCoachItems = actionableCoachFactors.length > 2;

   const historyItems: HistoryItem[] = [];

   for (const event of attendedEvents) {
     historyItems.push({
       id: `dept-${event.id}`,
       occurred_at: event.starts_at,
       title: event.title,
       detail: `${categoryNameById.get(event.category_id ?? "") ?? "Uncategorized"} • ${parseHours(event.hours_credit).toFixed(2)} hrs`,
       source: "department_training",
     });
   }

   for (const submission of allOutside) {
     historyItems.push({
       id: `self-${submission.id}`,
       occurred_at: submission.created_at,
       title: submission.title,
       detail: `${submission.status.replaceAll("_", " ")} • ${parseHours(submission.hours).toFixed(2)} hrs`,
       source: "self_submitted_training",
     });
   }

   for (const cert of memberCertifications) {
     historyItems.push({
       id: `cert-${cert.id}`,
       occurred_at: cert.updated_at || cert.created_at,
       title: certificationNameById.get(cert.certification_id) ?? "Certification Updated",
       detail: cert.expires_at ? `Expires ${formatDateOnly(cert.expires_at)}` : "No expiration date",
       source: "certification",
     });
   }

   for (const row of deficiencyHistoryRows ?? []) {
     historyItems.push({
       id: `defhist-${String(row.id)}`,
       occurred_at: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
       title: typeof row.event_type === "string" && row.event_type.trim() ? row.event_type : "Deficiency Activity",
       detail:
         typeof row.event_description === "string" && row.event_description.trim()
           ? row.event_description
           : "Deficiency activity recorded.",
       source: "deficiency",
     });
   }

   for (const row of maintenanceRows ?? []) {
     const title =
       typeof row.maintenance_number === "string" && row.maintenance_number.trim()
         ? row.maintenance_number
         : typeof row.maintenance_type === "string" && row.maintenance_type.trim()
           ? row.maintenance_type
           : "Maintenance Record";

     historyItems.push({
       id: `maint-${String(row.id)}`,
       occurred_at: typeof row.service_date === "string" ? row.service_date : new Date().toISOString(),
       title,
       detail:
         typeof row.description === "string" && row.description.trim()
           ? row.description
           : "Maintenance completed.",
       source: "maintenance",
     });
   }

   for (const row of inspectorApparatusRows) {
     historyItems.push({
       id: `app-${String(row.id)}`,
       occurred_at: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
       title: "Apparatus Inspection",
       detail: typeof row.status === "string" && row.status.trim() ? row.status : "Status unavailable",
       source: "apparatus",
     });
   }

   for (const row of helperParticipationInspectionRows) {
     historyItems.push({
       id: `app-helper-${String(row.id)}`,
       occurred_at: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
       title: "Apparatus Inspection",
       detail:
         typeof row.status === "string" && row.status.trim()
           ? `${row.status} (participant)`
           : "Status unavailable (participant)",
       source: "apparatus",
     });
   }

   historyItems.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());

   return (
     <PageLayout
       environmentBackgroundUrl="/branding-images/redline-hq-login-hero-v1.png"
       environmentBackgroundPosition="28% center"
     >
      <div className="relative space-y-6 pb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-red-500">My Readiness</p>
          <h1
            className="mt-3 text-[2.25rem] font-[700] leading-none tracking-[-0.06em] text-white"
            style={{ fontFamily: '"Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif' }}
          >
            Personal Readiness
          </h1>
          <p className="mt-2 max-w-3xl text-neutral-300">
            See where you stand and what actions will make you REDLINE READY.
          </p>
        </div>

        <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#101010]/68 p-4 md:p-5">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(180,0,0,.08),transparent_55%)]" />
          <div className="pointer-events-none absolute inset-y-4 left-0 w-px bg-gradient-to-b from-transparent via-red-600/50 to-transparent" />

          <div className="relative grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <div className="relative overflow-hidden rounded-xl border border-red-500/15 bg-[#141414] px-4 py-4">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(239,43,45,.08),transparent_48%)]" />
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
              <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-400">MY READINESS</p>
              {readinessScore.configured && readinessPercentDisplay !== null && remainingPercentDisplay !== null ? (
                <div className="mt-2">
                  <p className="text-5xl font-black leading-none text-white md:text-6xl">{readinessPercentDisplay}%</p>
                  <p className="mt-2 text-base font-semibold text-white">You&apos;re {readinessPercentDisplay}% ready</p>
                  <p className="mt-1 text-sm text-neutral-300">{remainingPercentDisplay}% to go</p>
                </div>
              ) : (
                <div className="mt-2">
                  <p className="text-xl font-black uppercase text-amber-300">Readiness Not Scored</p>
                  <p className="mt-2 text-sm text-neutral-300">{readinessScore.configurationMessage}</p>
                </div>
              )}
              </div>
            </div>

            <div className="relative overflow-hidden rounded-xl border border-red-500/15 bg-[#141414] px-4 py-4">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_24%,rgba(239,43,45,.09),transparent_52%)]" />
              <div className="pointer-events-none absolute inset-y-4 left-0 w-px bg-gradient-to-b from-transparent via-red-500/45 to-transparent" />
              <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-400">REDLINE READINESS COACH™</p>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-red-300">NEXT BEST ACTION</p>
              <p className="mt-2 text-base font-semibold leading-6 text-white md:text-lg">
                {primaryCoachSentence}
              </p>
              {readinessScore.configured && actionableCoachFactors.length > 0 ? (
                <div className={`mt-3 space-y-2 ${hasAdditionalCoachItems ? "max-h-[10.75rem] overflow-y-auto pr-1" : ""}`}>
                  {actionableCoachFactors.map((factor) => (
                    <div key={factor.id} className="min-h-[5rem] rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-red-200">{factor.title}</p>
                        <span className="text-xs text-neutral-400">{factor.completionPercent}%</span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-neutral-200">{factor.actionNeeded}</p>
                    </div>
                  ))}
                </div>
              ) : null}
              </div>
            </div>
          </div>
        </section>

         <section className="rounded-2xl border border-white/10 bg-neutral-900/70 p-6">
           <div className="flex flex-col gap-3 border-b border-neutral-800 pb-4 md:flex-row md:items-end md:justify-between">
             <div>
               <h2 className="text-2xl font-semibold text-white">EMS Continuing Education</h2>
               <p className="mt-1 text-sm text-neutral-400">Certification-cycle CE tracking for Iowa and National Registry is separate from calendar-year training totals.</p>
             </div>
             <div className="rounded-lg border border-white/10 bg-neutral-950 px-4 py-3 text-xs uppercase tracking-[0.14em] text-neutral-300">
               EMS records counted: {emsTrainingRecords.length}
             </div>
           </div>

           {activeIowaProfile === null && activeNremtProfile === null ? (
             <div className="mt-4 rounded-xl border border-dashed border-neutral-700 bg-neutral-950 p-6 text-sm text-neutral-400">
               No EMS track profile configured for this member yet. Set Iowa/NREMT status on the Personnel profile.
             </div>
           ) : (
             <>
               <div className="mt-4 grid gap-4 lg:grid-cols-2">
                 <div className="rounded-xl border border-white/10 bg-[#141414] p-4">
                   <div className="flex items-center justify-between gap-2">
                     <p className="text-base font-semibold text-white">Iowa EMS</p>
                     <span className={`rounded-full border px-2.5 py-1 text-xs uppercase tracking-[0.12em] ${emsProgressStatusClasses(emsReadiness.iowa.status)}`}>
                       {formatEmsProgressStatus(emsReadiness.iowa.status)}
                     </span>
                   </div>
                   <p className="mt-2 text-sm text-neutral-300">
                     {emsReadiness.iowa.totalCompleted.toFixed(2)} / {emsReadiness.iowa.totalRequired.toFixed(2)} hours
                   </p>
                   <p className="mt-1 text-xs text-neutral-400">
                     Level: {activeIowaProfile?.certification_level?.toUpperCase() ?? "-"} • Number: {activeIowaProfile?.certification_number || "-"}
                   </p>
                   <p className="mt-1 text-xs text-neutral-400">Expiration: {activeIowaProfile?.expiration_date ? formatDateOnly(activeIowaProfile.expiration_date) : "No expiration"}</p>
                   <p className="mt-1 text-xs text-neutral-400">Remaining: {emsReadiness.iowa.totalRemaining.toFixed(2)} hours</p>
                   <div className="mt-3 space-y-2">
                     {emsReadiness.iowa.topics.map((topic) => (
                       <div key={topic.topic} className="flex items-center justify-between text-xs text-neutral-300">
                         <span>{formatEmsTopicLabel(topic.topic)}</span>
                         <span>{topic.completed.toFixed(2)} / {topic.required.toFixed(2)} hrs</span>
                       </div>
                     ))}
                   </div>
                 </div>

                 <div className="rounded-xl border border-white/10 bg-[#141414] p-4">
                   <div className="flex items-center justify-between gap-2">
                     <p className="text-base font-semibold text-white">National Registry</p>
                     <span className={`rounded-full border px-2.5 py-1 text-xs uppercase tracking-[0.12em] ${emsProgressStatusClasses(emsReadiness.nremt.status)}`}>
                       {formatEmsProgressStatus(emsReadiness.nremt.status)}
                     </span>
                   </div>
                   <p className="mt-2 text-sm text-neutral-300">
                     {emsReadiness.nremt.totalCompleted.toFixed(2)} / {emsReadiness.nremt.totalRequired.toFixed(2)} hours
                   </p>
                   <p className="mt-1 text-xs text-neutral-400">
                     Level: {activeNremtProfile?.certification_level?.toUpperCase() ?? "-"} • Number: {activeNremtProfile?.certification_number || "-"}
                   </p>
                   <p className="mt-1 text-xs text-neutral-400">
                     Maintain Track: {activeNremtProfile?.maintain_track === true ? "Yes" : "No"} • Expiration: {activeNremtProfile?.expiration_date ? formatDateOnly(activeNremtProfile.expiration_date) : "No expiration"}
                   </p>
                   <p className="mt-1 text-xs text-neutral-400">National Component: {emsReadiness.nremt.nationalComponentCompleted.toFixed(2)} / {emsReadiness.nremt.nationalComponentRequired.toFixed(2)} hrs</p>
                   <div className="mt-3 space-y-2">
                     {emsReadiness.nremt.nationalTopics.map((topic) => (
                       <div key={topic.topic} className="flex items-center justify-between text-xs text-neutral-300">
                         <span>{formatEmsTopicLabel(topic.topic)}</span>
                         <span>{topic.completed.toFixed(2)} / {topic.required.toFixed(2)} hrs</span>
                       </div>
                     ))}
                   </div>
                 </div>
               </div>

               {firefighterVisibleEmsWarnings.length > 0 ? (
                 <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                   {firefighterVisibleEmsWarnings.map((warning) => (
                     <p key={warning}>{warning}</p>
                   ))}
                 </div>
               ) : null}

               {displayUnclassifiedRecordIds.length > 0 ? (
                 <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                   {displayUnclassifiedRecordIds.length} EMS record(s) are unclassified and marked for review.
                 </div>
               ) : null}
             </>
           )}
         </section>

         <section className="rounded-2xl border border-white/10 bg-neutral-900/70 p-5">
           <div className="flex items-center justify-between gap-3 border-b border-neutral-800 pb-4">
             <div>
               <h2 className="text-2xl font-semibold uppercase tracking-[0.04em] text-white">Training</h2>
               <p className="mt-1 text-sm text-neutral-400">Calendar Year {currentCalendarYear}</p>
             </div>
             <AddTrainingButton
               departmentId={currentMember.departmentId}
               currentMemberId={currentMember.id}
               categories={addTrainingCategories}
               emsCourseDefinitions={emsCourseDefinitions}
             />
           </div>

           <div className="mt-4 grid gap-3 md:grid-cols-3">
             <div className="rounded-xl border border-white/10 bg-[#141414] px-4 py-3">
               <p className="text-xs uppercase tracking-[0.14em] text-neutral-400">Total Training</p>
               <p className="mt-1 text-2xl font-semibold text-white">{calendarYearTotalTrainingHours.toFixed(2)} hrs</p>
             </div>
             <div className="rounded-xl border border-red-500/25 bg-[#141414] px-4 py-3">
               <p className="text-xs uppercase tracking-[0.14em] text-red-300">Fire Training</p>
               <p className="mt-1 text-2xl font-semibold text-red-100">{calendarYearFireTrainingHours.toFixed(2)} hrs</p>
             </div>
             <div className="rounded-xl border border-sky-500/20 bg-[#141414] px-4 py-3">
               <p className="text-xs uppercase tracking-[0.14em] text-sky-300">EMS Training</p>
               <p className="mt-1 text-2xl font-semibold text-sky-100">{calendarYearEmsTrainingHours.toFixed(2)} hrs</p>
             </div>
           </div>

           <div className="mt-4 rounded-xl border border-white/10 bg-[#121212] p-4">
             <div className="flex items-center justify-between gap-3">
               <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-neutral-300">Assigned Training</h3>
               {requiredOutstandingHomework.length === 0 ? (
                 <span className="text-xs uppercase tracking-[0.12em] text-emerald-300">No outstanding actions</span>
               ) : (
                 <span className="text-xs uppercase tracking-[0.12em] text-red-200">
                   {requiredOutstandingHomework.length} action{requiredOutstandingHomework.length === 1 ? "" : "s"}
                 </span>
               )}
             </div>
             {requiredOutstandingHomework.length > 0 ? (
               <div className={`mt-3 space-y-3 ${requiredOutstandingHomework.length > 2 ? "max-h-56 overflow-y-auto pr-1" : ""}`}>
                 {requiredOutstandingHomework.map(({ row, assignment }) => {
                   if (!assignment) {
                     return null;
                   }

                   const normalizedStatus = row.completion_status.trim().toLowerCase();
                   const statusLabel =
                     normalizedStatus === "pending_review" || normalizedStatus === "submitted"
                       ? "Pending Review"
                       : normalizedStatus === "in_progress"
                         ? "In Progress"
                         : normalizedStatus === "rejected"
                           ? "Needs Completion"
                           : "Needs Completion";

                   return (
                     <div key={row.id} className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-3">
                       <div className="flex flex-wrap items-start justify-between gap-3">
                         <div>
                           <p className="text-sm font-semibold text-white">{assignment.title}</p>
                           <p className="mt-1 text-xs text-neutral-300">
                             {parseHours(row.hours_earned) > 0
                               ? `${parseHours(row.hours_earned).toFixed(2)} hrs`
                               : `${parseHours(assignment.hours_credit).toFixed(2)} hrs`}
                             {row.due_at || assignment.due_at ? ` • Due ${formatDateOnly(row.due_at ?? assignment.due_at ?? "")}` : ""}
                           </p>
                         </div>
                         <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-xs uppercase tracking-[0.12em] text-red-200">
                           {statusLabel}
                         </span>
                       </div>
                       <div className="mt-3">
                         <Link
                           href="/training"
                           className="inline-flex items-center rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-red-100 transition hover:bg-red-500/20"
                         >
                           Complete Training
                         </Link>
                       </div>
                     </div>
                   );
                 })}
               </div>
             ) : (
               <p className="mt-2 text-xs text-neutral-500">Assigned requirements are current.</p>
             )}
           </div>

           <div className="mt-4 rounded-xl border border-white/10 bg-[#121212] p-4">
             <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-neutral-200">Training Breakdown</h3>
             <p className="mt-1 text-xs text-neutral-500">Where your calendar-year training hours came from.</p>
             <div className="mt-3 grid gap-3 lg:grid-cols-2 lg:items-start">
               <div className="self-start rounded-lg border border-red-500/20 bg-[#151515] p-3">
                 <p className="text-xs font-semibold uppercase tracking-[0.12em] text-red-300">Fire Training</p>
                 {fireTrainingBreakdown.length === 0 ? (
                   <p className="mt-2 text-sm text-neutral-400">No Fire training hours recorded this year.</p>
                 ) : (
                   <div className="mt-2 space-y-1.5">
                     {fireTrainingBreakdown.map((row, index) => (
                       <div key={`fire-${row.categoryName}-${index}`} className="flex items-center justify-between rounded-md border border-red-500/10 bg-white/[0.02] px-2.5 py-1.5 text-sm text-neutral-200">
                         <span>{row.categoryName}</span>
                         <span className="font-semibold text-red-100">{row.hours.toFixed(2)} hrs</span>
                       </div>
                     ))}
                   </div>
                 )}
               </div>

               <div className="self-start rounded-lg border border-sky-500/20 bg-[#151515] p-3">
                 <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-300">EMS Training</p>
                 {emsTrainingBreakdown.length === 0 ? (
                   <p className="mt-2 text-sm text-neutral-400">No EMS training hours recorded this year.</p>
                 ) : (
                   <div className="mt-2 space-y-1.5">
                     {emsTrainingBreakdown.map((row, index) => (
                       <div key={`ems-${row.categoryName}-${index}`} className="flex items-center justify-between rounded-md border border-sky-500/10 bg-white/[0.02] px-2.5 py-1.5 text-sm text-neutral-200">
                         <span>{row.categoryName}</span>
                         <span className="font-semibold text-sky-100">{row.hours.toFixed(2)} hrs</span>
                       </div>
                     ))}
                   </div>
                 )}
               </div>
             </div>
           </div>
         </section>

         <section className="rounded-2xl border border-white/10 bg-neutral-900/70 p-6">
           <div className="flex flex-col gap-3 border-b border-neutral-800 pb-4 md:flex-row md:items-end md:justify-between">
             <div>
               <h2 className="text-2xl font-semibold text-white">EMS Certifications</h2>
               <p className="mt-1 text-sm text-neutral-400">EMS credentials tied to Iowa/NREMT authority metadata.</p>
             </div>
             <div className="rounded-lg border border-white/10 bg-neutral-950 px-4 py-3 text-xs uppercase tracking-[0.14em] text-neutral-300">
               {currentEmsCertifications} current • {expiringSoonEmsCertifications} expiring • {expiredEmsCertifications} expired
             </div>
           </div>

           {emsCertificationCards.length === 0 ? (
             <div className="mt-4 rounded-xl border border-dashed border-neutral-700 bg-neutral-950 p-6 text-sm text-neutral-400">
               No EMS certifications are currently on your record.
             </div>
           ) : (
             <div className="mt-4 space-y-3">
               {emsCertificationCards.map((row) => (
                 <div key={row.id} className="rounded-xl border border-white/10 bg-[#141414] px-4 py-3">
                   <div className="flex flex-wrap items-center justify-between gap-3">
                     <p className="text-base font-semibold text-white">{row.name}</p>
                     <span className={`rounded-full border px-2.5 py-1 text-xs uppercase tracking-[0.12em] ${certificationStatusClasses(row.status)}`}>
                       {certificationStatusLabel(row.status)}
                     </span>
                   </div>
                   <div className="mt-2 grid gap-2 text-sm text-neutral-300 md:grid-cols-2">
                     <p>Certification #: {row.certificateNumber?.trim() || "-"}</p>
                     <p>Issued: {formatDateOnly(row.issuedAt)}</p>
                     <p>Expires: {row.expiresAt ? formatDateOnly(row.expiresAt) : "No expiration"}</p>
                     <p>
                       {row.supportingDocument ? (
                         <Link
                           href={`/documents/${row.supportingDocument.category}/${row.supportingDocument.id}`}
                           className="text-red-300 underline-offset-2 transition hover:text-red-200 hover:underline"
                         >
                           View Certification
                         </Link>
                       ) : (
                         <span className="text-neutral-500">Document not uploaded</span>
                       )}
                     </p>
                   </div>
                 </div>
               ))}
             </div>
           )}
         </section>

         <section className="rounded-2xl border border-white/10 bg-neutral-900/70 p-6">
           <div className="flex flex-col gap-3 border-b border-neutral-800 pb-4 md:flex-row md:items-end md:justify-between">
             <div>
               <h2 className="text-2xl font-semibold text-white">General Certifications</h2>
               <p className="mt-1 text-sm text-neutral-400">Non-EMS certifications and credentials.</p>
             </div>
             <div className="rounded-lg border border-white/10 bg-neutral-950 px-4 py-3 text-xs uppercase tracking-[0.14em] text-neutral-300">
               {currentGeneralCertifications} current • {expiringSoonGeneralCertifications} expiring • {expiredGeneralCertifications} expired
             </div>
           </div>

           {generalCertificationCards.length === 0 ? (
             <div className="mt-4 rounded-xl border border-dashed border-neutral-700 bg-neutral-950 p-6 text-sm text-neutral-400">
               No general certifications are currently on your record.
             </div>
           ) : (
             <div className="mt-4 space-y-3">
               {generalCertificationCards.map((row) => (
                 <div key={row.id} className="rounded-xl border border-white/10 bg-[#141414] px-4 py-3">
                   <div className="flex flex-wrap items-center justify-between gap-3">
                     <p className="text-base font-semibold text-white">{row.name}</p>
                     <span className={`rounded-full border px-2.5 py-1 text-xs uppercase tracking-[0.12em] ${certificationStatusClasses(row.status)}`}>
                       {certificationStatusLabel(row.status)}
                     </span>
                   </div>
                   <div className="mt-2 grid gap-2 text-sm text-neutral-300 md:grid-cols-2">
                     <p>Certification #: {row.certificateNumber?.trim() || "-"}</p>
                     <p>Issued: {formatDateOnly(row.issuedAt)}</p>
                     <p>Expires: {row.expiresAt ? formatDateOnly(row.expiresAt) : "No expiration"}</p>
                     <p>
                       {row.supportingDocument ? (
                         <Link
                           href={`/documents/${row.supportingDocument.category}/${row.supportingDocument.id}`}
                           className="text-red-300 underline-offset-2 transition hover:text-red-200 hover:underline"
                         >
                           View Certification
                         </Link>
                       ) : (
                         <span className="text-neutral-500">Document not uploaded</span>
                       )}
                     </p>
                   </div>
                 </div>
               ))}
             </div>
           )}
         </section>

        <section className="rounded-2xl border border-white/10 bg-neutral-900/70 p-6">
          <div className="border-b border-neutral-800 pb-4">
            <h2 className="text-2xl font-semibold text-white">ROLE REQUIREMENTS</h2>
            <p className="mt-1 text-sm text-neutral-400">See what your assigned department role requires and what is currently missing.</p>
          </div>

          {!memberDepartmentRoleId ? (
            <div className="mt-4 rounded-xl border border-dashed border-neutral-700 bg-neutral-950 p-6 text-sm text-neutral-400">
              No department role assigned.
            </div>
          ) : !selectedDepartmentRole ? (
            <div className="mt-4 rounded-xl border border-dashed border-neutral-700 bg-neutral-950 p-6 text-sm text-neutral-400">
              The assigned department role could not be found.
            </div>
          ) : roleRequirementComparison.status.kind === "no_requirements" ? (
            <>
              <div className="mt-4 rounded-xl border border-white/10 bg-[#141414] p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-neutral-400">Department Role</p>
                <p className="mt-1 text-lg font-semibold text-white">{selectedDepartmentRole.name}</p>
                <p className="mt-2 text-xs text-neutral-400">
                  Qualifications: {readinessScore.qualificationsScore === null
                    ? "Not scored"
                    : `${readinessScore.qualificationsScore.toFixed(1)} / ${readinessScore.qualificationsMaxScore.toFixed(1)}`}
                </p>
                {readinessScore.missingQualifications.length > 0 ? (
                  <p className="mt-1 text-xs text-amber-300">
                    Missing required qualification{readinessScore.missingQualifications.length > 1 ? "s" : ""}: {readinessScore.missingQualifications.join(", ")}
                  </p>
                ) : null}
              </div>
              <div className="mt-4 rounded-xl border border-dashed border-neutral-700 bg-neutral-950 p-6 text-sm text-neutral-400">
                No role requirements configured.
              </div>
            </>
          ) : (
            <>
              <div className="mt-4 rounded-xl border border-white/10 bg-[#141414] p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-neutral-400">Department Role</p>
                <p className="mt-1 text-lg font-semibold text-white">{selectedDepartmentRole.name}</p>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-[#121212] p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-neutral-300">Required Certifications</h3>
                  {roleRequirementComparison.requiredCertifications.length === 0 ? (
                    <p className="mt-3 text-sm text-neutral-400">No required certifications for this role.</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {roleRequirementComparison.requiredCertifications.map((item) => (
                        <div key={item.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5">
                          <p className="text-sm font-medium text-white">{item.name}</p>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${item.isCurrent ? "bg-green-500/15 text-green-300" : "bg-amber-500/15 text-amber-300"}`}>
                            {item.isCurrent ? "Current" : "Missing"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-white/10 bg-[#121212] p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-neutral-300">Required Qualifications</h3>
                  {roleRequirementComparison.requiredQualifications.length === 0 ? (
                    <p className="mt-3 text-sm text-neutral-400">No required qualifications for this role.</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {roleRequirementComparison.requiredQualifications.map((item) => (
                        <div key={item.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5">
                          <p className="text-sm font-medium text-white">{item.name}</p>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${item.isCurrent ? "bg-green-500/15 text-green-300" : "bg-amber-500/15 text-amber-300"}`}>
                            {item.isCurrent ? "Current" : "Missing"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </section>

         <HistorySection
           historyItems={historyItems.map((row) => ({
             id: row.id,
             occurred_at: row.occurred_at,
             title: row.title,
             detail: row.detail,
             sourceLabel: sourceLabel(row.source),
           }))}
         />
       </div>
     </PageLayout>
   );
 }
