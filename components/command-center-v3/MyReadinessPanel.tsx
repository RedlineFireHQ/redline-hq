"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, AlertTriangle } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { department } from "@/lib/department";
import {
  buildMemberReadinessScore,
  getCertificationStatus,
  parseHours,
  type RequirementInput,
} from "@/lib/readiness/member-readiness";
import { supabase } from "@/lib/supabase";
import PrimaryActionButton from "./PrimaryActionButton";

type SummaryItemType = "good" | "warning" | "danger";

type SummaryItem = {
  title: string;
  status: string;
  type: SummaryItemType;
};

type MemberCertificationRow = {
  id: string;
  certification_id: string;
  expires_at: string | null;
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

type CategoryRow = {
  id: string;
  name: string;
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
  statusLabel: string;
  message: string;
  summary: SummaryItem[];
  recommendation: string;
};

const CERTIFICATION_WARNING_DAYS = department.settings.certificationWarningDays;

function calculateMyReadiness(input: {
  certifications: MemberCertificationRow[];
  departmentHours: number;
  approvedSelfSubmittedHours: number;
  requirements: RequirementInput[];
  categoryHours: Array<{ categoryId: string | null; categoryName: string; hours: number }>;
  categoryNameById: Map<string, string>;
  memberId: string;
  assignedDeficiencies: DeficiencyAssignedRow[];
  personalAssignmentStartedAtByDeficiencyId: Map<string, string>;
}): MyReadinessData {
  const totalCertifications = input.certifications.length;
  let currentCount = 0;
  let expiringCount = 0;
  let expiredCount = 0;

  for (const row of input.certifications) {
    const status = getCertificationStatus(row.expires_at, CERTIFICATION_WARNING_DAYS);
    if (status === "current") {
      currentCount += 1;
    }

    if (status === "expiring_soon") {
      expiringCount += 1;
    }

    if (status === "expired") {
      expiredCount += 1;
    }
  }

  const readinessScore = buildMemberReadinessScore({
    requirementRows: input.requirements,
    departmentHours: input.departmentHours,
    categoryHours: input.categoryHours,
    categoryNameById: input.categoryNameById,
    certificationStatuses: input.certifications.map((row) => ({
      certificationId: row.certification_id,
      certificationName: "Certification",
      status: getCertificationStatus(row.expires_at, CERTIFICATION_WARNING_DAYS),
    })),
    currentMemberId: input.memberId,
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
      statusLabel: "UNCONFIGURED",
      message: readinessScore.configurationMessage,
      summary: [
        { title: "Readiness Model", status: "Not Configured", type: "warning" },
        { title: "Current Certifications", status: `${currentCount}/${totalCertifications}`, type: totalCertifications > 0 ? "good" : "warning" },
        { title: "Department Training Hours", status: `${input.departmentHours.toFixed(2)} hrs`, type: input.departmentHours > 0 ? "good" : "warning" },
        { title: "Approved Self-Submitted", status: `${input.approvedSelfSubmittedHours.toFixed(2)} hrs`, type: input.approvedSelfSubmittedHours > 0 ? "good" : "warning" },
      ],
      recommendation: "Ask your department admin to configure readiness requirements.",
    };
  }

  const scorePercent = readinessScore.scorePercent ?? 0;
  const incompleteFactors = readinessScore.factors.filter((factor) => !factor.completed).length;

  return {
    readiness: scorePercent,
    showPercent: true,
    statusLabel: incompleteFactors === 0 ? "COMPLETE" : "IN PROGRESS",
    message: `${readinessScore.remainingPercent}% remaining to reach 100%.`,
    summary: [
      {
        title: "Configured Requirements",
        status: `${readinessScore.completedRequirements + readinessScore.incompleteRequirements}`,
        type: readinessScore.completedRequirements + readinessScore.incompleteRequirements > 0 ? "good" : "warning",
      },
      {
        title: "Completed Factors",
        status: `${readinessScore.completedRequirements}/${readinessScore.completedRequirements + readinessScore.incompleteRequirements}`,
        type: incompleteFactors === 0 ? "good" : "warning",
      },
      {
        title: "Current Certifications",
        status: `${currentCount}/${totalCertifications}`,
        type: expiredCount > 0 ? "danger" : expiringCount > 0 ? "warning" : "good",
      },
      {
        title: "Readiness Coach",
        status:
          readinessScore.coachItems.length > 0
            ? readinessScore.coachItems[0].title
            : "Complete",
        type: readinessScore.coachItems.length > 0 ? "warning" : "good",
      },
    ],
    recommendation:
      readinessScore.coachItems.length > 0
        ? readinessScore.coachItems[0].explanation
        : "All configured readiness factors are complete.",
  };
}

export default function MyReadinessPanel() {
  const { member } = useAuth();
  const memberId = typeof member?.id === "string" ? member.id : "";
  const departmentId = typeof member?.department_id === "string" ? member.department_id : "";

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [records, setRecords] = useState<MemberCertificationRow[]>([]);
  const [departmentTrainingHours, setDepartmentTrainingHours] = useState(0);
  const [approvedSelfSubmittedHours, setApprovedSelfSubmittedHours] = useState(0);
  const [requirements, setRequirements] = useState<RequirementInput[]>([]);
  const [categoryHours, setCategoryHours] = useState<Array<{ categoryId: string | null; categoryName: string; hours: number }>>([]);
  const [categoryNameById, setCategoryNameById] = useState<Map<string, string>>(new Map());
  const [assignedDeficiencies, setAssignedDeficiencies] = useState<DeficiencyAssignedRow[]>([]);
  const [personalAssignmentStartedAtByDeficiencyId, setPersonalAssignmentStartedAtByDeficiencyId] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let isMounted = true;

    async function loadMyReadinessData() {
      if (!memberId || !departmentId) {
        if (isMounted) {
          setRecords([]);
          setDepartmentTrainingHours(0);
          setApprovedSelfSubmittedHours(0);
          setRequirements([]);
          setCategoryHours([]);
          setCategoryNameById(new Map());
          setAssignedDeficiencies([]);
          setPersonalAssignmentStartedAtByDeficiencyId(new Map());
          setIsLoading(false);
          setLoadError("Sign in to view your personal readiness.");
        }
        return;
      }

      const [
        { data: certificationsData, error: certificationsError },
        { data: attendanceData, error: attendanceError },
        { data: outsideData, error: outsideError },
        { data: requirementsData, error: requirementsError },
        { data: deficienciesData, error: deficienciesError },
      ] = await Promise.all([
        supabase
          .from("member_certifications")
          .select("id, certification_id, expires_at")
          .eq("department_id", departmentId)
          .eq("member_id", memberId),
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

      if (certificationsError || attendanceError || outsideError || requirementsError || deficienciesError) {
        setLoadError(
          certificationsError?.message ||
            attendanceError?.message ||
            outsideError?.message ||
            deficienciesError?.message ||
            requirementsError?.message ||
            "Unable to load your readiness data.",
        );
        setRecords([]);
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

      const nextRows: MemberCertificationRow[] = (certificationsData ?? []).map((row) => ({
        id: String(row.id),
        certification_id: typeof row.certification_id === "string" ? row.certification_id : "",
        expires_at: typeof row.expires_at === "string" ? row.expires_at : null,
      }));

      const attendanceRows: MemberTrainingAttendanceRow[] = (attendanceData ?? []).map((row) => ({
        training_event_id: typeof row.training_event_id === "string" ? row.training_event_id : "",
      }));

      const approvedRows: MemberApprovedOutsideTrainingRow[] = (outsideData ?? []).map((row) => ({
        id: String(row.id),
        category_id: typeof row.category_id === "string" ? row.category_id : null,
        hours: typeof row.hours === "number" || typeof row.hours === "string" ? row.hours : null,
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
          setRecords([]);
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

        for (const row of (assignmentRows ?? []) as DeficiencyAssignmentHistoryRow[]) {
          if (!row.deficiency_id || !row.created_at) {
            continue;
          }

          if (!personalAssignedAtByDeficiencyId.has(row.deficiency_id)) {
            personalAssignedAtByDeficiencyId.set(row.deficiency_id, row.created_at);
          }
        }
      }

      let departmentHours = 0;
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

        attendedEvents = (eventsData ?? []).map((row) => ({
          id: String(row.id),
          category_id: typeof row.category_id === "string" ? row.category_id : null,
          hours_credit: typeof row.hours_credit === "number" || typeof row.hours_credit === "string" ? row.hours_credit : null,
        }));

        departmentHours = attendedEvents.reduce((total, row) => total + parseHours(row.hours_credit), 0);
      }

      const approvedHours = approvedRows.reduce((total, row) => total + parseHours(row.hours), 0);
      const categoryIds = Array.from(
        new Set(
          [
            ...attendedEvents.map((row) => row.category_id),
            ...approvedRows.map((row) => row.category_id),
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

      setRecords(nextRows);
      setDepartmentTrainingHours(departmentHours);
      setApprovedSelfSubmittedHours(approvedHours);
      setRequirements(activeRequirements);
      setCategoryHours(Array.from(categoryHoursMap.values()));
      setCategoryNameById(categoryNameMap);
      setAssignedDeficiencies(assignedDeficiencyRows);
      setPersonalAssignmentStartedAtByDeficiencyId(personalAssignedAtByDeficiencyId);
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
        statusLabel: "LOADING",
        message: "Loading your personal readiness...",
        summary: [
          { title: "Training Requirements", status: "Loading...", type: "warning" as SummaryItemType },
          { title: "Current Certifications", status: "Loading...", type: "warning" as SummaryItemType },
          { title: "Department Training Hours", status: "Loading...", type: "warning" as SummaryItemType },
          { title: "Approved Self-Submitted", status: "Loading...", type: "warning" as SummaryItemType },
        ],
        recommendation: "Please wait while your readiness data loads.",
      };
    }

    if (loadError) {
      return {
        readiness: null,
        showPercent: false,
        statusLabel: "UNAVAILABLE",
        message: loadError,
        summary: [
          { title: "Training Requirements", status: "Unavailable", type: "warning" as SummaryItemType },
          { title: "Current Certifications", status: "Unavailable", type: "warning" as SummaryItemType },
          { title: "Department Training Hours", status: "Unavailable", type: "warning" as SummaryItemType },
          { title: "Approved Self-Submitted", status: "Unavailable", type: "warning" as SummaryItemType },
        ],
        recommendation: "Check your account access and try again.",
      };
    }

    return calculateMyReadiness({
      certifications: records,
      departmentHours: departmentTrainingHours,
      approvedSelfSubmittedHours,
      requirements,
      categoryHours,
      categoryNameById,
      memberId,
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
    personalAssignmentStartedAtByDeficiencyId,
    records,
    requirements,
  ]);

  const summary = readinessData.summary;

  return (
    <section className="relative h-full overflow-hidden rounded-[22px] border border-white/10 bg-[#0b0b0b] shadow-[0_20px_60px_rgba(0,0,0,.45)]">
      <div className="absolute inset-0 bg-gradient-to-br from-[#101113] via-[#0b0b0b] to-[#111111]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_50%,rgba(180,0,0,.08),transparent_50%)]" />

      <div className="relative z-10 flex h-full flex-col">
        <div className="grid flex-1 grid-cols-[175px_1fr]">
          <div className="border-r border-white/10 px-4 py-3.5">
            <h2 className="text-[16px] font-semibold uppercase tracking-[.12em] text-white">MY READINESS</h2>
            <div className="mt-2.5 h-px w-[135px] bg-gradient-to-r from-red-500 via-red-400 to-transparent" />

            <div className="mt-3">
              <div className="flex items-end">
                <span className="text-[68px] font-black leading-[0.85] tracking-[-0.08em] text-white">
                  {readinessData.showPercent ? readinessData.readiness : "--"}
                </span>
                {readinessData.showPercent ? (
                  <span className="mb-2 text-[28px] font-black leading-none text-white">%</span>
                ) : null}
              </div>

              <div className="mt-1 text-[28px] font-black uppercase leading-none tracking-[-0.04em] text-red-500">
                {readinessData.statusLabel}
              </div>

              <div className="mt-2.5 h-px w-[135px] bg-gradient-to-r from-red-500 via-red-400 to-transparent shadow-[0_0_12px_rgba(239,43,45,.45)]" />

              <p className="mt-4 max-w-[145px] text-[14px] leading-5 text-neutral-300">{readinessData.message}</p>
            </div>
          </div>

          <div className="px-5 py-3.5">
            <h2 className="text-[16px] font-semibold uppercase tracking-[.12em] text-white">READINESS SUMMARY</h2>

            <div className="mt-2.5 space-y-1.5">
              {summary.map((item) => {
                const good = item.type === "good";
                const warning = item.type === "warning";

                return (
                  <div
                    key={item.title}
                    className={`flex items-center justify-between rounded-xl border bg-[#121212]/95 px-3 py-1.5 transition-all ${
                      good ? "border-green-500/40" : warning ? "border-yellow-500/40" : "border-red-500/40"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {good ? (
                        <CheckCircle2 size={18} className="text-green-500" />
                      ) : (
                        <AlertTriangle size={18} className={warning ? "text-yellow-400" : "text-red-500"} />
                      )}

                      <span className="text-[13px] font-medium text-white">{item.title}</span>
                    </div>

                    <span
                      className={`text-[12px] font-semibold ${
                        good ? "text-green-500" : warning ? "text-yellow-400" : "text-red-500"
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-2.5 rounded-xl border-l-4 border-red-500 bg-[#181111] px-3 py-2.5 shadow-[0_0_16px_rgba(239,43,45,.12)]">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-red-500/40 bg-red-500/10">
                  <ArrowRight size={16} className="-rotate-45 text-red-500" />
                </div>

                <p className="text-[13px] leading-5 text-neutral-300">{readinessData.recommendation}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 border-t border-white/10 px-5 py-2">
          <PrimaryActionButton label="View Readiness Details" href="/my-readiness" />
        </div>
      </div>

      <div className="pointer-events-none absolute left-0 top-16 h-[180px] w-[2px] rounded-full bg-red-600/70 blur-[1px]" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-20 w-[60%] -translate-x-1/2 bg-red-600/10 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 rounded-[22px] ring-1 ring-inset ring-white/5" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </section>
  );
}
