"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { department } from "@/lib/department";
import {
  buildCertificationTypeMetaById,
  type EmsTrackProfileAuthorityRow,
} from "@/lib/ems/authoritative-certifications";
import {
  calculateOverallReadinessScorePercent,
  getDeficiencyImpactPenaltyPercent,
  getDeficiencyImpactState,
  parseHours,
  type ReadinessFactor,
  type ReadinessScoreState,
  type RequirementInput,
  type TrainingAssignmentInput,
  type TrainingAssignmentMemberInput,
} from "@/lib/readiness/member-readiness";
import {
  buildAuthoritativeCoachActions,
  computeAuthoritativeMemberReadiness,
  getAuthoritativeCoachSummary,
} from "@/lib/readiness/authoritative-member-readiness";
import {
  buildCanonicalMemberCertificationRows,
  type CatalogRow,
  type RoleRequiredQualificationRow,
} from "@/lib/role-requirements";
import { supabase } from "@/lib/supabase";

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

function calculateDaysBetween(from: Date, to: Date) {
  const fromStart = new Date(from);
  fromStart.setHours(0, 0, 0, 0);
  const toStart = new Date(to);
  toStart.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((toStart.getTime() - fromStart.getTime()) / (24 * 60 * 60 * 1000)));
}

const CERTIFICATION_WARNING_DAYS = department.settings.certificationWarningDays;
const MEMBER_DEFICIENCIES_BUCKET_MAX = 10;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function calculateMyReadiness(input: {
  readinessScore: ReadinessScoreState;
  assignedDeficiencies: DeficiencyAssignedRow[];
  personalAssignmentStartedAtByDeficiencyId: Map<string, string>;
}): MyReadinessData {
  const { readinessScore } = input;

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

  const summary = getAuthoritativeCoachSummary({
    readinessState: readinessScore,
    highestDeficiencyPenaltyPercent,
    isSelf: true,
  });

  return {
    readiness: scorePercent,
    showPercent: true,
    nextActionLabel: summary.label,
    nextActionSentence: summary.sentence,
    nextActionHref: summary.href,
  };
}

export default function MyReadinessPanel() {
  const { member } = useAuth();
  const memberId = typeof member?.id === "string" ? member.id : "";
  const departmentId = typeof member?.department_id === "string" ? member.department_id : "";

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [readinessScore, setReadinessScore] = useState<ReadinessScoreState | null>(null);
  const [assignedDeficiencies, setAssignedDeficiencies] = useState<DeficiencyAssignedRow[]>([]);
  const [personalAssignmentStartedAtByDeficiencyId, setPersonalAssignmentStartedAtByDeficiencyId] = useState<Map<string, string>>(new Map());


  useEffect(() => {
    let isMounted = true;

    async function loadMyReadinessData() {
      if (!memberId || !departmentId) {
        if (isMounted) {
          setReadinessScore(null);
          setAssignedDeficiencies([]);
          setPersonalAssignmentStartedAtByDeficiencyId(new Map());
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
          .select("id, training_assignment_id, completion_status, due_at, completed_at, hours_earned")
          .eq("department_id", departmentId)
          .eq("member_id", memberId),
        supabase
          .from("training_assignments")
          .select("id, title, category_id, due_at, hours_credit, is_required, review_required, status")
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
        setReadinessScore(null);
        setAssignedDeficiencies([]);
        setPersonalAssignmentStartedAtByDeficiencyId(new Map());
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
      const certificationNameById = new Map(certificationCatalogRows.map((row) => [row.id, row.name]));
      const certificationTypeById = buildCertificationTypeMetaById(
        certificationCatalogRows.map((row) => ({
          id: row.id,
          ems_authority: row.ems_authority,
          ems_certification_level: row.ems_certification_level,
        })),
      );
      const emsProfiles = (emsTrackProfileData ?? []) as EmsTrackProfileAuthorityRow[];

      const rawCertificationRows = (certificationsData ?? []).map((row) => ({
        id: String(row.id),
        certification_id: typeof row.certification_id === "string" ? row.certification_id : "",
        certificate_number: typeof row.certificate_number === "string" ? row.certificate_number : null,
        issued_at: typeof row.issued_at === "string" ? row.issued_at : "",
        expires_at: typeof row.expires_at === "string" ? row.expires_at : null,
      }));
      const certificationRows = buildCanonicalMemberCertificationRows({
        certificationTypes: certificationCatalogRows.map((row) => ({ id: row.id, name: row.name, active: true } satisfies CatalogRow)),
        qualificationTypes,
        memberCertifications: rawCertificationRows,
        memberQualifications,
      }).map((row) => ({
        id: row.id ?? row.certification_id,
        certification_id: row.certification_id,
        certificate_number: row.certificate_number ?? null,
        issued_at: row.issued_at ?? "",
        expires_at: row.expires_at,
      }));

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
          setReadinessScore(null);
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

      const attendanceRows: MemberTrainingAttendanceRow[] = (attendanceData ?? []).map((row) => ({
        training_event_id: typeof row.training_event_id === "string" ? row.training_event_id : "",
      }));

      const approvedRows: MemberApprovedOutsideTrainingRow[] = (outsideData ?? []).map((row) => ({
        id: String(row.id),
        category_id: typeof row.category_id === "string" ? row.category_id : null,
        hours: typeof row.hours === "number" || typeof row.hours === "string" ? row.hours : null,
      }));

      const assignmentMemberRows: TrainingAssignmentMemberInput[] = (assignmentMembersData ?? []).map((row) => ({
        id: typeof row.id === "string" ? row.id : String(row.id ?? ""),
        training_assignment_id: typeof row.training_assignment_id === "string" ? row.training_assignment_id : "",
        completion_status: typeof row.completion_status === "string" ? row.completion_status : "",
        due_at: typeof row.due_at === "string" ? row.due_at : null,
        completed_at: typeof row.completed_at === "string" ? row.completed_at : null,
        hours_earned: typeof row.hours_earned === "number" || typeof row.hours_earned === "string" ? row.hours_earned : null,
      }));

      const trainingAssignmentRows: TrainingAssignmentInput[] = ((assignmentsData ?? []) as Array<{
        id: string;
        title?: string | null;
        category_id: string | null;
        due_at?: string | null;
        hours_credit: number | string | null;
        is_required?: boolean | null;
        review_required?: boolean | null;
        status: string;
      }>).map((row) => ({
        id: row.id,
        title: typeof row.title === "string" ? row.title : "Assigned Training",
        category_id: row.category_id,
        due_at: typeof row.due_at === "string" ? row.due_at : null,
        hours_credit: row.hours_credit,
        is_required: row.is_required === true,
        review_required: row.review_required === true,
        status: row.status,
      }));

      const approvedAssignmentMembers: TrainingAssignmentMemberRow[] = assignmentMemberRows
        .filter((row) => row.completion_status === "approved")
        .map((row) => ({
          training_assignment_id: row.training_assignment_id,
          completion_status: row.completion_status,
          hours_earned: row.hours_earned,
        }));

      const assignmentsById = new Map(
        trainingAssignmentRows.map((row) => [
          row.id,
          {
            id: row.id,
            category_id: row.category_id,
            hours_credit: row.hours_credit,
            status: row.status,
          } satisfies TrainingAssignmentRow,
        ]),
      );

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
          setReadinessScore(null);
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
          setReadinessScore(null);
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
      const categoryHoursMap = new Map<string, { categoryId: string | null; categoryName: string; hours: number }>();

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

      const authoritativeResult = computeAuthoritativeMemberReadiness({
        currentMemberId: memberId,
        memberStartDate: resolvedMemberStartDate,
        memberDepartmentRoleId,
        roleName: selectedDepartmentRole?.name ?? null,
        canonicalMemberCertifications: certificationRows,
        certificationNameById,
        certificationTypeById,
        emsTrackProfiles: emsProfiles,
        roleRequiredCertifications: ((roleRequiredCertificationsData ?? []) as Array<{ department_role_id: string; certification_id: string }>).map((row) => ({
          department_role_id: row.department_role_id,
          certification_id: row.certification_id,
        })),
        certificationCatalog: certificationCatalogRows.map((row) => ({ id: row.id, name: row.name, active: true } satisfies CatalogRow)),
        qualificationCatalog: qualificationTypes,
        roleRequiredQualifications,
        memberQualifications,
        requirements: activeRequirements,
        categoryNameById: categoryNameMap,
        fireAnnualComplianceRows: complianceRows,
        categoryHours: Array.from(categoryHoursMap.values()),
        trainingAssignments: trainingAssignmentRows,
        assignmentMembers: assignmentMemberRows,
        deficiencyItems: assignedDeficiencyRows.map((row) => {
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
            personalAssignedAt: personalAssignedAtByDeficiencyId.get(row.id) ?? null,
          };
        }),
      });

      setReadinessScore(authoritativeResult.readiness);
      setAssignedDeficiencies(assignedDeficiencyRows);
      setPersonalAssignmentStartedAtByDeficiencyId(personalAssignedAtByDeficiencyId);
      setLoadError(null);
      setIsLoading(false);
    }

    void loadMyReadinessData();

    const refreshOnReturn = () => {
      void loadMyReadinessData();
    };

    window.addEventListener("focus", refreshOnReturn);
    window.addEventListener("pageshow", refreshOnReturn);

    return () => {
      isMounted = false;
      window.removeEventListener("focus", refreshOnReturn);
      window.removeEventListener("pageshow", refreshOnReturn);
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

    if (loadError || !readinessScore) {
      return {
        readiness: null,
        showPercent: false,
        nextActionLabel: "NEXT BEST ACTION",
        nextActionSentence: loadError ?? "Check your account access and try again.",
        nextActionHref: "/my-readiness",
      };
    }

    return calculateMyReadiness({
      readinessScore,
      assignedDeficiencies,
      personalAssignmentStartedAtByDeficiencyId,
    });
  }, [
    assignedDeficiencies,
    isLoading,
    loadError,
    personalAssignmentStartedAtByDeficiencyId,
    readinessScore,
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
              {readinessData.nextActionHref === "/training" ? "Go to Training" : "View My Readiness"}
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
