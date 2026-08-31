"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { department } from "@/lib/department";
import {
  applyAuthoritativeCertificationToTrackProfile,
  buildCertificationTypeMetaById,
  findCurrentTrackProfile,
  resolveAuthoritativeEmsCertificationsForMember,
  resolveCertificationStatusFromTrack,
  type EmsTrackProfileAuthorityRow,
} from "@/lib/ems/authoritative-certifications";
import {
  buildMemberReadinessScore,
  calculateOverallReadinessScorePercent,
  getDeficiencyImpactPenaltyPercent,
  getDeficiencyImpactState,
  getCertificationStatus,
  parseHours,
  type CertificationStatus,
  type QualificationReadinessInput,
  type ReadinessFactor,
  type ReadinessScoreState,
  type RequirementInput,
} from "@/lib/readiness/member-readiness";
import { getRoleRequirementComparison, type CatalogRow, type RoleRequiredQualificationRow } from "@/lib/role-requirements";
import { buildScoredCertificationStatuses } from "@/lib/readiness/scored-certifications";
import { supabase } from "@/lib/supabase";
import { calculateComplianceBucketHours } from "@/lib/training/compliance-buckets";

type MemberCertificationRow = {
  id: string;
  certification_id: string;
  certificate_number: string | null;
  issued_at: string;
  expires_at: string | null;
  certification_name: string;
  status: CertificationStatus;
  is_ems_certification: boolean;
};

type CertificationCatalogRow = {
  id: string;
  name: string;
  ems_authority: "iowa" | "nremt" | null;
  ems_certification_level: "emr" | "emt" | "aemt" | "paramedic" | null;
};

type MemberTrainingAttendanceRow = {
  training_event_id: string;
};

type MemberTrainingEventRow = {
  id: string;
  category_id: string | null;
  hours_credit: number | string | null;
};

type MemberApprovedOutsideTrainingRow = {
  id: string;
  category_id: string | null;
  hours: number | string | null;
};

type TrainingAssignmentMemberRow = {
  training_assignment_id: string;
  completion_status: string;
  hours_earned: number | string | null;
};

type TrainingAssignmentRow = {
  id: string;
  category_id: string | null;
  hours_credit: number | string | null;
  status: string;
};

type CategoryRow = {
  id: string;
  name: string;
};

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

type QualificationCatalogRow = {
  id: string;
  name: string;
  active: boolean | null;
};

type MemberQualificationRow = {
  qualification_id: string;
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

type MyReadinessData = {
  readiness: number | null;
  showPercent: boolean;
  nextActionLabel: string;
  nextActionSentence: string;
  nextActionHref: string | null;
};

function roundToTenths(value: number) {
  return Math.round(value * 10) / 10;
}

function formatHoursLabel(value: number) {
  const rounded = roundToTenths(value);
  const normalized = Number.isInteger(rounded) ? String(Math.trunc(rounded)) : rounded.toFixed(1);
  return `${normalized} ${rounded === 1 ? "hour" : "hours"}`;
}

function calculateDaysBetween(from: Date, to: Date) {
  const fromStart = new Date(from);
  fromStart.setHours(0, 0, 0, 0);
  const toStart = new Date(to);
  toStart.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((toStart.getTime() - fromStart.getTime()) / (24 * 60 * 60 * 1000)));
}

function extractTrainingHours(value: string) {
  const match = value.match(/([0-9]+(?:\.[0-9]+)?)/);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  return Number.isFinite(hours) ? hours : null;
}

const CERTIFICATION_WARNING_DAYS = department.settings.certificationWarningDays;
const MEMBER_DEFICIENCIES_BUCKET_MAX = 10;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getAverageFactorCompletionForCategory(
  factors: ReadinessFactor[],
  category: ReadinessFactor["category"],
  overrideFactorId: string | null,
  overrideCompletionPercent: number,
) {
  const categoryFactors = factors.filter((factor) => factor.category === category);
  if (categoryFactors.length === 0) {
    return 0;
  }

  const total = categoryFactors.reduce((sum, factor) => {
    if (overrideFactorId && factor.id === overrideFactorId) {
      return sum + clamp(overrideCompletionPercent, 0, 100);
    }

    return sum + clamp(factor.completionPercent, 0, 100);
  }, 0);

  return clamp(total / categoryFactors.length, 0, 100);
}

function simulateMemberScoreForResolvedCoachFactor(input: {
  readinessState: ReadinessScoreState;
  factorId: string;
  highestDeficiencyPenaltyPercent: number;
  resolvedQualificationName?: string;
}) {
  const { readinessState, factorId, highestDeficiencyPenaltyPercent, resolvedQualificationName } = input;
  const factor = readinessState.factors.find((item) => item.id === factorId);

  if (!factor) {
    return readinessState.scorePercent;
  }

  let certificationsCategoryPercent = getAverageFactorCompletionForCategory(
    readinessState.factors,
    "certification",
    null,
    0,
  );

  let trainingCategoryPercent = getAverageFactorCompletionForCategory(
    readinessState.factors,
    "training",
    null,
    0,
  );

  let qualificationsCategoryPercent =
    readinessState.qualificationsScore === null
      ? null
      : clamp(
          (readinessState.qualificationsScore / readinessState.qualificationsMaxScore) * 100,
          0,
          100,
        );

  let deficienciesCategoryPercent = clamp(
    ((MEMBER_DEFICIENCIES_BUCKET_MAX - readinessState.deficiencyPenaltyPercent) /
      MEMBER_DEFICIENCIES_BUCKET_MAX) *
      100,
    0,
    100,
  );

  if (factor.category === "certification") {
    certificationsCategoryPercent = getAverageFactorCompletionForCategory(
      readinessState.factors,
      "certification",
      factor.id,
      100,
    );
  } else if (factor.category === "training") {
    trainingCategoryPercent = getAverageFactorCompletionForCategory(
      readinessState.factors,
      "training",
      factor.id,
      100,
    );
  } else if (factor.category === "qualification") {
    const normalizedResolvedQualification = (resolvedQualificationName ?? "").trim().toLowerCase();
    const missingQualifications = readinessState.missingQualifications;
    const hasMatchingQualification =
      normalizedResolvedQualification.length > 0 &&
      missingQualifications.some(
        (qualificationName) => qualificationName.trim().toLowerCase() === normalizedResolvedQualification,
      );

    if (!hasMatchingQualification) {
      return readinessState.scorePercent;
    }

    const missingCount = missingQualifications.length;
    if (missingCount <= 0) {
      return readinessState.scorePercent;
    }

    if (readinessState.qualificationsScore === null) {
      return readinessState.scorePercent;
    }

    const currentQualificationsPercent = clamp(
      (readinessState.qualificationsScore / readinessState.qualificationsMaxScore) * 100,
      0,
      100,
    );
    const incompleteRatio = 1 - currentQualificationsPercent / 100;

    if (incompleteRatio <= 0) {
      return readinessState.scorePercent;
    }

    const estimatedTotalRequired = missingCount / incompleteRatio;
    const totalRequired = Math.max(1, Math.round(estimatedTotalRequired));
    const reconstructedMissing = totalRequired * incompleteRatio;

    if (Math.abs(reconstructedMissing - missingCount) > 0.01) {
      return readinessState.scorePercent;
    }

    const completedCount = totalRequired - missingCount;
    const nextCompletedCount = clamp(completedCount + 1, 0, totalRequired);
    qualificationsCategoryPercent = clamp((nextCompletedCount / totalRequired) * 100, 0, 100);
  } else if (factor.id === "deficiencies-current-responsibility") {
    const reducedPenalty = Math.max(0, readinessState.deficiencyPenaltyPercent - highestDeficiencyPenaltyPercent);
    deficienciesCategoryPercent = clamp(
      ((MEMBER_DEFICIENCIES_BUCKET_MAX - reducedPenalty) / MEMBER_DEFICIENCIES_BUCKET_MAX) * 100,
      0,
      100,
    );
  }

  if (qualificationsCategoryPercent === null) {
    return null;
  }

  return roundToTenths(
    calculateOverallReadinessScorePercent({
      certificationsCategoryPercent,
      trainingCategoryPercent,
      qualificationsCategoryPercent,
      deficienciesCategoryPercent,
    }),
  );
}

function calculateMyReadiness(input: {
  certifications: MemberCertificationRow[];
  scoredCertificationStatuses: Array<{ certificationId: string; certificationName: string; status: CertificationStatus }>;
  departmentHours: number;
  approvedSelfSubmittedHours: number;
  requirements: RequirementInput[];
  categoryHours: Array<{ categoryId: string | null; categoryName: string; hours: number }>;
  categoryNameById: Map<string, string>;
  qualificationReadiness: QualificationReadinessInput;
  memberId: string;
  memberStartDate: string | null;
  assignedDeficiencies: DeficiencyAssignedRow[];
  personalAssignmentStartedAtByDeficiencyId: Map<string, string>;
}): MyReadinessData {
  const readinessScore = buildMemberReadinessScore({
    requirementRows: input.requirements,
    departmentHours: input.departmentHours,
    categoryHours: input.categoryHours,
    categoryNameById: input.categoryNameById,
    certificationStatuses: input.certifications.map((row) => ({
      certificationId: row.certification_id,
      certificationName: row.certification_name,
      status: row.status,
    })),
    scoredCertificationStatuses: input.scoredCertificationStatuses,
    qualificationReadiness: input.qualificationReadiness,
    currentMemberId: input.memberId,
    memberStartDate: input.memberStartDate,
    deficiencyItems: input.assignedDeficiencies.map((row) => {
      const statusRelation = Array.isArray(row.status_info) ? row.status_info[0] : row.status_info;
      const priorityRelation = Array.isArray(row.priority_info) ? row.priority_info[0] : row.priority_info;

      return {
        id: row.id,
        deficiencyNumber: row.deficiency_number,
        description: row.description,
        priorityName: typeof priorityRelation?.name === "string" ? priorityRelation.name : null,
        assignedToMemberId: row.assigned_to,
        statusName: typeof statusRelation?.name === "string" ? statusRelation.name : null,
        statusActive: typeof statusRelation?.active === "boolean" ? statusRelation.active : null,
        createdAt: row.created_at,
        reportedAt: row.reported_at,
        personalAssignedAt: input.personalAssignmentStartedAtByDeficiencyId.get(row.id) ?? null,
      };
    }),
  });

  if (!readinessScore.configured) {
    return {
      readiness: null,
      showPercent: false,
      nextActionLabel: "NEXT BEST ACTION",
      nextActionSentence: "Ask your department admin to configure readiness requirements.",
      nextActionHref: "/my-readiness",
    };
  }

  if (readinessScore.scorePercent === null || readinessScore.remainingPercent === null) {
    return {
      readiness: null,
      showPercent: false,
      nextActionLabel: "NEXT BEST ACTION",
      nextActionSentence: readinessScore.configurationMessage,
      nextActionHref: "/my-readiness",
    };
  }

  const scorePercent = readinessScore.scorePercent;
  const primaryCoachItem = readinessScore.coachItems[0] ?? null;
  const factor = primaryCoachItem
    ? readinessScore.factors.find((item) => item.id === primaryCoachItem.factorId) ?? null
    : null;

  const highestDeficiencyPenaltyPercent = input.assignedDeficiencies.reduce((highestPenalty, item) => {
    const timestamp =
      input.personalAssignmentStartedAtByDeficiencyId.get(item.id) ?? item.reported_at ?? item.created_at;
    const parsed = timestamp ? new Date(timestamp) : null;

    if (!parsed || Number.isNaN(parsed.getTime())) {
      return highestPenalty;
    }

    const ageDays = calculateDaysBetween(parsed, new Date());
    const impactState = getDeficiencyImpactState(
      typeof (Array.isArray(item.priority_info) ? item.priority_info[0]?.name : item.priority_info?.name) === "string"
        ? (Array.isArray(item.priority_info) ? item.priority_info[0]?.name : item.priority_info?.name) ?? null
        : null,
      ageDays,
    );
    const penaltyPercent = getDeficiencyImpactPenaltyPercent(impactState);
    return penaltyPercent > highestPenalty ? penaltyPercent : highestPenalty;
  }, 0);

  const simulatedScore = primaryCoachItem
    ? simulateMemberScoreForResolvedCoachFactor({
        readinessState: readinessScore,
        factorId: primaryCoachItem.factorId,
        highestDeficiencyPenaltyPercent,
        resolvedQualificationName: factor?.category === "qualification" ? factor.title : undefined,
      })
    : scorePercent;

  const gainPercent =
    typeof simulatedScore === "number"
      ? Math.max(0, roundToTenths(simulatedScore - scorePercent))
      : 0;

  let actionPrefix = "Complete your next readiness action";
  if (primaryCoachItem && factor?.category === "training") {
    const trainingHours = extractTrainingHours(primaryCoachItem.remainingValue);
    actionPrefix = trainingHours !== null
      ? `Complete ${formatHoursLabel(trainingHours)} of training`
      : "Complete required annual training";
  } else if (primaryCoachItem && factor?.category === "certification") {
    actionPrefix = `Complete ${primaryCoachItem.title.toLowerCase()}`;
  } else if (primaryCoachItem && factor?.category === "qualification") {
    actionPrefix = `Complete ${primaryCoachItem.title}`;
  } else if (primaryCoachItem && factor?.id === "deficiencies-current-responsibility") {
    actionPrefix = "Resolve your highest-impact assigned deficiency";
  }

  const nextActionSentence =
    primaryCoachItem && gainPercent > 0
      ? `${actionPrefix} to improve your readiness by ${gainPercent}%.`
      : primaryCoachItem
        ? `${actionPrefix} to improve your readiness.`
        : "You are currently fully configured and on track.";

  return {
    readiness: scorePercent,
    showPercent: true,
    nextActionLabel: "NEXT BEST ACTION",
    nextActionSentence,
    nextActionHref: primaryCoachItem?.href ?? "/my-readiness",
  };
}

export default function MyReadinessPanel() {
  const { member } = useAuth();
  const memberId = typeof member?.id === "string" ? member.id : "";
  const departmentId = typeof member?.department_id === "string" ? member.department_id : "";

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [records, setRecords] = useState<MemberCertificationRow[]>([]);
  const [, setEmsSummaryStatus] = useState("Not Configured");
  const [departmentTrainingHours, setDepartmentTrainingHours] = useState(0);
  const [approvedSelfSubmittedHours, setApprovedSelfSubmittedHours] = useState(0);
  const [requirements, setRequirements] = useState<RequirementInput[]>([]);
  const [scoredCertificationStatuses, setScoredCertificationStatuses] = useState<Array<{ certificationId: string; certificationName: string; status: CertificationStatus }>>([]);
  const [categoryHours, setCategoryHours] = useState<Array<{ categoryId: string | null; categoryName: string; hours: number }>>([]);
  const [categoryNameById, setCategoryNameById] = useState<Map<string, string>>(new Map());
  const [qualificationReadiness, setQualificationReadiness] = useState<QualificationReadinessInput>({
    hasAssignedRole: false,
    roleName: null,
    requiredQualifications: [],
    completedQualifications: [],
    missingQualifications: [],
  });
  const [assignedDeficiencies, setAssignedDeficiencies] = useState<DeficiencyAssignedRow[]>([]);
  const [personalAssignmentStartedAtByDeficiencyId, setPersonalAssignmentStartedAtByDeficiencyId] = useState<Map<string, string>>(new Map());
  const [memberStartDate, setMemberStartDate] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadMyReadinessData() {
      if (!memberId || !departmentId) {
        if (isMounted) {
          setRecords([]);
          setEmsSummaryStatus("Not Configured");
          setDepartmentTrainingHours(0);
          setApprovedSelfSubmittedHours(0);
          setRequirements([]);
          setScoredCertificationStatuses([]);
          setCategoryHours([]);
          setCategoryNameById(new Map());
          setQualificationReadiness({ hasAssignedRole: false, roleName: null, requiredQualifications: [], completedQualifications: [], missingQualifications: [] });
          setAssignedDeficiencies([]);
          setPersonalAssignmentStartedAtByDeficiencyId(new Map());
          setMemberStartDate(null);
          setIsLoading(false);
          setLoadError("Sign in to view your personal readiness.");
        }
        return;
      }

      const [
        { data: certificationsData, error: certificationsError },
        { data: certificationCatalogData, error: certificationCatalogError },
        { data: emsTrackProfileData, error: emsTrackProfileError },
        { data: roleAssignmentData, error: roleAssignmentError },
        { data: departmentRolesData, error: departmentRolesError },
        { data: qualificationsData, error: qualificationsError },
        { data: memberQualificationsData, error: memberQualificationsError },
        { data: roleRequiredQualificationsData, error: roleRequiredQualificationsError },
        { data: roleRequiredCertificationsData, error: roleRequiredCertificationsError },
        { data: attendanceData, error: attendanceError },
        { data: outsideData, error: outsideError },
        { data: assignmentMembersData, error: assignmentMembersError },
        { data: assignmentsData, error: assignmentsError },
        { data: requirementsData, error: requirementsError },
        { data: deficienciesData, error: deficienciesError },
      ] = await Promise.all([
        supabase
          .from("member_certifications")
          .select("id, certification_id, certificate_number, issued_at, expires_at")
          .eq("department_id", departmentId)
          .eq("member_id", memberId),
        supabase
          .from("certifications")
          .select("id, name, ems_authority, ems_certification_level")
          .eq("department_id", departmentId),
        supabase
          .from("ems_member_track_profiles")
          .select("track, certification_level, track_status, maintain_track, certification_number, expiration_date, effective_start_date, effective_end_date")
          .eq("department_id", departmentId)
          .eq("member_id", memberId)
          .order("effective_start_date", { ascending: false }),
        supabase
          .from("members")
          .select("department_role_id, hire_start_date, created_at")
          .eq("department_id", departmentId)
          .eq("id", memberId)
          .single(),
        supabase
          .from("department_roles")
          .select("id, name, active")
          .eq("department_id", departmentId),
        supabase
          .from("qualifications")
          .select("id, name, active")
          .eq("department_id", departmentId),
        supabase
          .from("member_qualifications")
          .select("qualification_id")
          .eq("department_id", departmentId)
          .eq("member_id", memberId),
        supabase
          .from("role_required_qualifications")
          .select("department_role_id, qualification_id")
          .eq("department_id", departmentId),
        supabase
          .from("role_required_certifications")
          .select("department_role_id, certification_id")
          .eq("department_id", departmentId),
        supabase
          .from("training_event_attendance")
          .select("training_event_id")
          .eq("department_id", departmentId)
          .eq("member_id", memberId)
          .eq("attendance_status", "attending"),
        supabase
          .from("training_outside_submissions")
          .select("id, category_id, hours")
          .eq("department_id", departmentId)
          .eq("member_id", memberId)
          .eq("status", "approved"),
        supabase
          .from("training_assignment_members")
          .select("training_assignment_id, completion_status, hours_earned")
          .eq("department_id", departmentId)
          .eq("member_id", memberId)
          .eq("completion_status", "approved"),
        supabase
          .from("training_assignments")
          .select("id, category_id, hours_credit, status")
          .eq("department_id", departmentId),
        supabase
          .from("training_requirements")
          .select("id, name, requirement_kind, period_type, minimum_hours, category_id, due_frequency_rule, required_topic, active, sort_order, config_json")
          .eq("department_id", departmentId)
          .eq("active", true)
          .order("sort_order", { ascending: true }),
        supabase
          .from("deficiencies")
          .select(
            "id, deficiency_number, description, assigned_to, created_at, reported_at, status_info:deficiency_statuses!fk_deficiencies_status(name, active), priority_info:deficiency_priorities!fk_deficiencies_priority(name)",
          )
          .eq("assigned_to", memberId),
      ]);

      if (!isMounted) {
        return;
      }

      if (
        certificationsError ||
        certificationCatalogError ||
        emsTrackProfileError ||
        roleAssignmentError ||
        departmentRolesError ||
        qualificationsError ||
        memberQualificationsError ||
        roleRequiredQualificationsError ||
        roleRequiredCertificationsError ||
        attendanceError ||
        outsideError ||
        assignmentMembersError ||
        assignmentsError ||
        requirementsError ||
        deficienciesError
      ) {
        setLoadError(
          certificationsError?.message ||
            certificationCatalogError?.message ||
            emsTrackProfileError?.message ||
            roleAssignmentError?.message ||
            departmentRolesError?.message ||
            qualificationsError?.message ||
            memberQualificationsError?.message ||
            roleRequiredQualificationsError?.message ||
            roleRequiredCertificationsError?.message ||
            attendanceError?.message ||
            outsideError?.message ||
            assignmentMembersError?.message ||
            assignmentsError?.message ||
            deficienciesError?.message ||
            requirementsError?.message ||
            "Unable to load your readiness data.",
        );
        setRecords([]);
        setEmsSummaryStatus("Not Configured");
        setDepartmentTrainingHours(0);
        setApprovedSelfSubmittedHours(0);
        setRequirements([]);
        setScoredCertificationStatuses([]);
        setCategoryHours([]);
        setCategoryNameById(new Map());
        setQualificationReadiness({ hasAssignedRole: false, roleName: null, requiredQualifications: [], completedQualifications: [], missingQualifications: [] });
        setAssignedDeficiencies([]);
        setPersonalAssignmentStartedAtByDeficiencyId(new Map());
        setMemberStartDate(null);
        setIsLoading(false);
        return;
      }

      const roleAssignmentRow = roleAssignmentData as MemberRoleAssignmentRow | null;
      const resolvedMemberStartDate = roleAssignmentRow?.hire_start_date ?? roleAssignmentRow?.created_at ?? null;

      const certificationCatalogRows = (certificationCatalogData ?? []) as CertificationCatalogRow[];
      const departmentRoles = (departmentRolesData ?? []) as DepartmentRoleRow[];
      const qualificationTypes = ((qualificationsData ?? []) as QualificationCatalogRow[]).map((row) => ({
        id: row.id,
        name: row.name,
        active: row.active,
      } satisfies CatalogRow));
      const memberQualifications = ((memberQualificationsData ?? []) as MemberQualificationRow[]).map((row) => ({
        qualification_id: row.qualification_id,
      }));
      const roleRequiredQualifications = ((roleRequiredQualificationsData ?? []) as RoleRequiredQualificationRow[]).map((row) => ({
        department_role_id: row.department_role_id,
        qualification_id: row.qualification_id,
      }));
      const memberDepartmentRoleId = typeof (roleAssignmentData as MemberRoleAssignmentRow | null)?.department_role_id === "string"
        ? (roleAssignmentData as MemberRoleAssignmentRow).department_role_id
        : null;
      const selectedDepartmentRole = memberDepartmentRoleId
        ? departmentRoles.find((row) => row.id === memberDepartmentRoleId) ?? null
        : null;
      const roleRequirementComparison = getRoleRequirementComparison({
        memberDepartmentRoleId,
        certificationTypes: certificationCatalogRows.map((row) => ({ id: row.id, name: row.name, active: true } satisfies CatalogRow)),
        qualificationTypes,
        roleRequiredCertifications: ((roleRequiredCertificationsData ?? []) as Array<{ department_role_id: string; certification_id: string }>).map((row) => ({
          department_role_id: row.department_role_id,
          certification_id: row.certification_id,
        })),
        roleRequiredQualifications,
        memberCertifications: [],
        memberQualifications,
      });
      const certificationNameById = new Map(certificationCatalogRows.map((row) => [row.id, row.name]));
      const certificationTypeById = buildCertificationTypeMetaById(
        certificationCatalogRows.map((row) => ({
          id: row.id,
          ems_authority: row.ems_authority,
          ems_certification_level: row.ems_certification_level,
        })),
      );
      const emsProfiles = (emsTrackProfileData ?? []) as EmsTrackProfileAuthorityRow[];

      const certificationRows = (certificationsData ?? []).map((row) => ({
        id: String(row.id),
        certification_id: typeof row.certification_id === "string" ? row.certification_id : "",
        certificate_number: typeof row.certificate_number === "string" ? row.certificate_number : null,
        issued_at: typeof row.issued_at === "string" ? row.issued_at : "",
        expires_at: typeof row.expires_at === "string" ? row.expires_at : null,
      }));

      const authoritativeEmsCertifications = resolveAuthoritativeEmsCertificationsForMember({
        memberCertifications: certificationRows.map((row) => ({
          member_id: memberId,
          certification_id: row.certification_id,
          certificate_number: row.certificate_number,
          expires_at: row.expires_at,
          issued_at: row.issued_at,
        })),
        certificationTypeById,
      });

      const activeIowaProfile = applyAuthoritativeCertificationToTrackProfile({
        track: "iowa",
        profile: findCurrentTrackProfile(emsProfiles, "iowa"),
        authoritativeCertification: authoritativeEmsCertifications.iowa,
      });
      const activeNremtProfile = applyAuthoritativeCertificationToTrackProfile({
        track: "nremt",
        profile: findCurrentTrackProfile(emsProfiles, "nremt"),
        authoritativeCertification: authoritativeEmsCertifications.nremt,
      });

      const nextRows: MemberCertificationRow[] = certificationRows.map((row) => {
        const certificationId = typeof row.certification_id === "string" ? row.certification_id : "";
        const certificationName = certificationNameById.get(certificationId) ?? "Certification";
        const certificationMeta = certificationTypeById.get(certificationId);
        const genericStatus = getCertificationStatus(
          typeof row.expires_at === "string" ? row.expires_at : null,
          CERTIFICATION_WARNING_DAYS,
        );
        const sourceTrack = certificationMeta?.authority === "iowa"
          ? activeIowaProfile
          : certificationMeta?.authority === "nremt"
            ? activeNremtProfile
            : null;
        const status = resolveCertificationStatusFromTrack({
          track: sourceTrack,
          genericStatus,
          warningDays: CERTIFICATION_WARNING_DAYS,
        });

        return {
          id: row.id,
          certification_id: certificationId,
          expires_at: typeof row.expires_at === "string" ? row.expires_at : null,
          certificate_number: row.certificate_number,
          issued_at: row.issued_at,
          certification_name: certificationName,
          status,
          is_ems_certification: certificationMeta?.authority === "iowa" || certificationMeta?.authority === "nremt",
        };
      });
      const scoredCertificationStatuses = buildScoredCertificationStatuses({
        memberDepartmentRoleId,
        certificationStatuses: nextRows.map((row) => ({
          certificationId: row.certification_id,
          certificationName: row.certification_name,
          status: row.status,
          authority: certificationTypeById.get(row.certification_id)?.authority ?? null,
        })),
        roleRequiredCertifications: ((roleRequiredCertificationsData ?? []) as Array<{ department_role_id: string; certification_id: string }>).map((row) => ({
          department_role_id: row.department_role_id,
          certification_id: row.certification_id,
        })),
        includeIowaAuthority: activeIowaProfile !== null,
        includeNremtAuthority: activeNremtProfile?.maintain_track === true,
        certificationNameById,
      });

      const describeTrack = (profile: EmsTrackProfileAuthorityRow | null, fallback: string) => {
        if (!profile) {
          return `${fallback}: Missing`;
        }

        const status = resolveCertificationStatusFromTrack({
          track: profile,
          warningDays: CERTIFICATION_WARNING_DAYS,
          genericStatus: "expired",
        });
        const label = status === "expired" ? "Expired" : status === "expiring_soon" ? "Expiring" : "Current";
        return `${fallback}: ${label}`;
      };

      const nextEmsSummaryStatus = `${describeTrack(activeIowaProfile, "Iowa")}, ${describeTrack(activeNremtProfile, "NREMT")}`;

      const attendanceRows: MemberTrainingAttendanceRow[] = (attendanceData ?? []).map((row) => ({
        training_event_id: typeof row.training_event_id === "string" ? row.training_event_id : "",
      }));

      const approvedRows: MemberApprovedOutsideTrainingRow[] = (outsideData ?? []).map((row) => ({
        id: String(row.id),
        category_id: typeof row.category_id === "string" ? row.category_id : null,
        hours: typeof row.hours === "number" || typeof row.hours === "string" ? row.hours : null,
      }));
      const approvedAssignmentMembers: TrainingAssignmentMemberRow[] = (assignmentMembersData ?? []).map((row) => ({
        training_assignment_id: typeof row.training_assignment_id === "string" ? row.training_assignment_id : "",
        completion_status: typeof row.completion_status === "string" ? row.completion_status : "",
        hours_earned: typeof row.hours_earned === "number" || typeof row.hours_earned === "string" ? row.hours_earned : null,
      }));
      const assignmentsById = new Map(
        ((assignmentsData ?? []) as Array<{ id: string; category_id: string | null; hours_credit: number | string | null; status: string }>).map((row) => [
          row.id,
          {
            id: row.id,
            category_id: row.category_id,
            hours_credit: row.hours_credit,
            status: row.status,
          } satisfies TrainingAssignmentRow,
        ]),
      );

      const activeRequirements = (requirementsData ?? []) as RequirementInput[];
      const assignedDeficiencyRows = (deficienciesData ?? []) as DeficiencyAssignedRow[];

      const assignedDeficiencyIds = assignedDeficiencyRows
        .map((row) => row.id)
        .filter((id) => typeof id === "string" && id.length > 0);

      const personalAssignedAtByDeficiencyId = new Map<string, string>();
      if (assignedDeficiencyIds.length > 0) {
        const { data: assignmentRows, error: assignmentRowsError } = await supabase
          .from("deficiency_history")
          .select("deficiency_id, member_id, event_type, created_at")
          .in("deficiency_id", assignedDeficiencyIds)
          .eq("member_id", memberId)
          .eq("event_type", "Assigned")
          .order("created_at", { ascending: false });

        if (assignmentRowsError) {
          setLoadError(assignmentRowsError.message || "Unable to load your readiness data.");
          setRecords([]);
          setEmsSummaryStatus("Not Configured");
          setDepartmentTrainingHours(0);
          setApprovedSelfSubmittedHours(0);
          setRequirements([]);
          setScoredCertificationStatuses([]);
          setCategoryHours([]);
          setCategoryNameById(new Map());
          setAssignedDeficiencies([]);
          setPersonalAssignmentStartedAtByDeficiencyId(new Map());
          setIsLoading(false);
          return;
        }

        for (const row of (assignmentRows ?? []) as DeficiencyAssignmentHistoryRow[]) {
          if (!row.deficiency_id || !row.created_at) {
            continue;
          }

          if (!personalAssignedAtByDeficiencyId.has(row.deficiency_id)) {
            personalAssignedAtByDeficiencyId.set(row.deficiency_id, row.created_at);
          }
        }
      }

      const categoryHoursMap = new Map<string, { categoryId: string | null; categoryName: string; hours: number }>();
      const attendedEventIds = Array.from(
        new Set(attendanceRows.map((row) => row.training_event_id).filter((id) => id.length > 0)),
      );

      let attendedEvents: MemberTrainingEventRow[] = [];
      if (attendedEventIds.length > 0) {
        const { data: eventsData, error: eventsError } = await supabase
          .from("training_events")
          .select("id, category_id, hours_credit")
          .eq("department_id", departmentId)
          .in("id", attendedEventIds);

        if (eventsError) {
          setLoadError(eventsError.message || "Unable to load your readiness data.");
          setRecords([]);
          setEmsSummaryStatus("Not Configured");
          setDepartmentTrainingHours(0);
          setApprovedSelfSubmittedHours(0);
          setRequirements([]);
          setScoredCertificationStatuses([]);
          setCategoryHours([]);
          setCategoryNameById(new Map());
          setAssignedDeficiencies([]);
          setPersonalAssignmentStartedAtByDeficiencyId(new Map());
          setIsLoading(false);
          return;
        }

        attendedEvents = (eventsData ?? []).map((row) => ({
          id: String(row.id),
          category_id: typeof row.category_id === "string" ? row.category_id : null,
          hours_credit: typeof row.hours_credit === "number" || typeof row.hours_credit === "string" ? row.hours_credit : null,
        }));

      }

      const approvedHours = approvedRows.reduce((total, row) => total + parseHours(row.hours), 0);
      const categoryIds = Array.from(
        new Set(
          [
            ...attendedEvents.map((row) => row.category_id),
            ...approvedRows.map((row) => row.category_id),
            ...approvedAssignmentMembers.map((row) => assignmentsById.get(row.training_assignment_id)?.category_id ?? null),
          ].filter((id): id is string => Boolean(id)),
        ),
      );

      let categories: CategoryRow[] = [];
      if (categoryIds.length > 0) {
        const { data: categoriesData, error: categoriesError } = await supabase
          .from("training_categories")
          .select("id, name")
          .eq("department_id", departmentId)
          .in("id", categoryIds);

        if (categoriesError) {
          setLoadError(categoriesError.message || "Unable to load your readiness data.");
          setRecords([]);
          setEmsSummaryStatus("Not Configured");
          setDepartmentTrainingHours(0);
          setApprovedSelfSubmittedHours(0);
          setRequirements([]);
          setCategoryHours([]);
          setCategoryNameById(new Map());
          setAssignedDeficiencies([]);
          setPersonalAssignmentStartedAtByDeficiencyId(new Map());
          setIsLoading(false);
          return;
        }

        categories = (categoriesData ?? []).map((row) => ({
          id: String(row.id),
          name: typeof row.name === "string" ? row.name : "Category",
        }));
      }

      const categoryNameMap = new Map(categories.map((row) => [row.id, row.name]));

      for (const row of attendedEvents) {
        const key = row.category_id || "uncategorized";
        const categoryName = row.category_id ? categoryNameMap.get(row.category_id) || "Uncategorized" : "Uncategorized";
        const current = categoryHoursMap.get(key) ?? { categoryId: row.category_id, categoryName, hours: 0 };
        current.hours += parseHours(row.hours_credit);
        categoryHoursMap.set(key, current);
      }

      for (const row of approvedRows) {
        const key = row.category_id || "uncategorized";
        const categoryName = row.category_id ? categoryNameMap.get(row.category_id) || "Uncategorized" : "Uncategorized";
        const current = categoryHoursMap.get(key) ?? { categoryId: row.category_id, categoryName, hours: 0 };
        current.hours += parseHours(row.hours);
        categoryHoursMap.set(key, current);
      }

      for (const row of approvedAssignmentMembers) {
        const assignment = assignmentsById.get(row.training_assignment_id);
        if (!assignment || assignment.status === "archived") {
          continue;
        }

        const assignmentHours = parseHours(assignment.hours_credit);
        const rowHours = parseHours(row.hours_earned);
        const creditedHours = rowHours > 0 ? rowHours : assignmentHours;
        const key = assignment.category_id || "uncategorized";
        const categoryName = assignment.category_id ? categoryNameMap.get(assignment.category_id) || "Uncategorized" : "Uncategorized";
        const current = categoryHoursMap.get(key) ?? { categoryId: assignment.category_id, categoryName, hours: 0 };
        current.hours += creditedHours;
        categoryHoursMap.set(key, current);
      }

      const complianceRows = [
        ...attendedEvents.map((row) => ({ categoryId: row.category_id, hours: row.hours_credit })),
        ...approvedRows.map((row) => ({ categoryId: row.category_id, hours: row.hours })),
        ...approvedAssignmentMembers.map((row) => {
          const assignment = assignmentsById.get(row.training_assignment_id);
          const assignmentHours = assignment ? parseHours(assignment.hours_credit) : 0;
          const rowHours = parseHours(row.hours_earned);
          return {
            categoryId: assignment?.category_id ?? null,
            hours: rowHours > 0 ? rowHours : assignmentHours,
          };
        }),
      ];
      const departmentHours = calculateComplianceBucketHours(complianceRows, categoryNameMap).fireAnnualHours;

      setRecords(nextRows);
      setEmsSummaryStatus(nextEmsSummaryStatus);
      setDepartmentTrainingHours(departmentHours);
      setApprovedSelfSubmittedHours(approvedHours);
      setRequirements(activeRequirements);
      setScoredCertificationStatuses(scoredCertificationStatuses);
      setCategoryHours(Array.from(categoryHoursMap.values()));
      setCategoryNameById(categoryNameMap);
      setQualificationReadiness({
        hasAssignedRole: memberDepartmentRoleId !== null,
        roleName: selectedDepartmentRole?.name ?? null,
        requiredQualifications: roleRequirementComparison.requiredQualifications.map((item) => item.name),
        completedQualifications: roleRequirementComparison.requiredQualifications.filter((item) => item.isCurrent).map((item) => item.name),
        missingQualifications: roleRequirementComparison.requiredQualifications.filter((item) => !item.isCurrent).map((item) => item.name),
      });
      setAssignedDeficiencies(assignedDeficiencyRows);
      setPersonalAssignmentStartedAtByDeficiencyId(personalAssignedAtByDeficiencyId);
      setMemberStartDate(resolvedMemberStartDate);
      setLoadError(null);
      setIsLoading(false);
    }

    void loadMyReadinessData();

    return () => {
      isMounted = false;
    };
  }, [departmentId, memberId]);

  const readinessData = useMemo(() => {
    if (isLoading) {
      return {
        readiness: null,
        showPercent: false,
        nextActionLabel: "NEXT BEST ACTION",
        nextActionSentence: "Loading your personal readiness...",
        nextActionHref: null,
      };
    }

    if (loadError) {
      return {
        readiness: null,
        showPercent: false,
        nextActionLabel: "NEXT BEST ACTION",
        nextActionSentence: "Check your account access and try again.",
        nextActionHref: "/my-readiness",
      };
    }

    return calculateMyReadiness({
      certifications: records,
      scoredCertificationStatuses,
      departmentHours: departmentTrainingHours,
      approvedSelfSubmittedHours,
      requirements,
      categoryHours,
      categoryNameById,
      qualificationReadiness,
      memberId,
      memberStartDate,
      assignedDeficiencies,
      personalAssignmentStartedAtByDeficiencyId,
    });
  }, [
    approvedSelfSubmittedHours,
    assignedDeficiencies,
    categoryHours,
    categoryNameById,
    departmentTrainingHours,
    isLoading,
    loadError,
    memberId,
    memberStartDate,
    qualificationReadiness,
    personalAssignmentStartedAtByDeficiencyId,
    records,
    requirements,
    scoredCertificationStatuses,
  ]);

  return (
    <section className="relative h-[calc(100%+5px)] overflow-hidden rounded-[22px] border border-white/10 bg-[#0b0b0b] pb-[50px] shadow-[0_20px_60px_rgba(0,0,0,.45)]">
      <div className="absolute inset-0 bg-gradient-to-br from-[#101113] via-[#0b0b0b] to-[#111111]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_50%,rgba(180,0,0,.08),transparent_50%)]" />

      <div className="relative z-10 flex h-full flex-col px-5 py-4">
        <div className="mb-4 flex items-center gap-4">
          <div className="h-px flex-1 bg-[#EF2B2D]/60" />

          <span className="text-[13px] font-bold tracking-[0.30em] text-white">
            MY READINESS
          </span>

          <div className="h-px flex-1 bg-[#EF2B2D]/60" />
        </div>

        <div className="flex flex-1 flex-col items-center text-center">
          <div className="flex items-end justify-center">
            <span className="text-[54px] font-black leading-[0.9] tracking-[-0.08em] text-white">
              {readinessData.showPercent ? readinessData.readiness : "--"}
            </span>
            {readinessData.showPercent ? (
              <span className="mb-1 text-[18px] font-black leading-none text-white">%</span>
            ) : null}
          </div>

          <div className="mt-4 h-px w-full bg-gradient-to-r from-transparent via-[#EF2B2D]/80 to-transparent" />

          <h2 className="mt-4 text-[15px] font-semibold uppercase tracking-[.14em] text-white">REDLINE READINESS COACH™</h2>
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#EF2B2D]">{readinessData.nextActionLabel}</p>
          <p className="mt-1.5 max-w-[540px] text-[18px] font-semibold leading-7 text-white">{readinessData.nextActionSentence}</p>

          <div className="mt-auto w-full translate-y-[50px] pt-4">
            <Link
              href={readinessData.nextActionHref ?? "/my-readiness"}
              className="group inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-[#3A3A3A] bg-[#131313] px-4 text-[13px] font-semibold text-white transition-all duration-300 hover:border-[#5A5A5A] hover:bg-[#171717] hover:shadow-[0_0_0_1px_rgba(239,43,45,0.25)]"
            >
              View My Readiness
              <ArrowRight size={15} className="text-[#EF2B2D] transition-colors duration-300 group-hover:text-[#ff6b6b]" />
            </Link>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute left-0 top-16 h-[180px] w-[2px] rounded-full bg-red-600/70 blur-[1px]" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-20 w-[60%] -translate-x-1/2 bg-red-600/10 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 rounded-[22px] ring-1 ring-inset ring-white/5" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </section>
  );
}
