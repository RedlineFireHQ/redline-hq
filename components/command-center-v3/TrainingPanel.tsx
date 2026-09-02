"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  applyAuthoritativeCertificationToTrackProfile,
  buildCertificationTypeMetaById,
  findCurrentTrackProfile,
  resolveAuthoritativeEmsCertificationsForMember,
} from "@/lib/ems/authoritative-certifications";
import { calculateEmsReadiness } from "@/lib/ems/calculation";
import { type EmsCoreTopicCode } from "@/lib/ems/requirements";
import { supabase } from "@/lib/supabase";
import { parseHours } from "@/lib/readiness/member-readiness";
import { calculateComplianceBucketHours } from "@/lib/training/compliance-buckets";

type TrainingCategoryRow = {
  id: string;
  name: string;
};

type TrainingEventRow = {
  id: string;
  starts_at: string;
  category_id: string | null;
  hours_credit: number | string | null;
  is_ems_training: boolean;
  ems_core_topic: string | null;
  ems_needs_review: boolean;
};

type TrainingOutsideSubmissionRow = {
  id: string;
  training_date: string;
  category_id: string | null;
  hours: number | string | null;
  is_ems_training: boolean;
  ems_core_topic: string | null;
  ems_needs_review: boolean;
};

type TrainingAssignmentMemberRow = {
  training_assignment_id: string;
  completion_status: string;
  hours_earned: number | string | null;
  completed_at: string | null;
};

type TrainingAssignmentRow = {
  id: string;
  category_id: string | null;
  hours_credit: number | string | null;
};

type CertificationCatalogRow = {
  id: string;
  ems_authority: "iowa" | "nremt" | null;
  ems_certification_level: "emr" | "emt" | "aemt" | "paramedic" | null;
};

type MemberCertificationRow = {
  certification_id: string;
  certificate_number: string | null;
  issued_at: string;
  expires_at: string | null;
};

type EmsTrackProfileRow = {
  track: "iowa" | "nremt";
  certification_level: "emr" | "emt" | "aemt" | "paramedic";
  track_status: "active" | "inactive" | "expired" | "not_maintained" | "needs_review";
  maintain_track: boolean;
  certification_number: string | null;
  expiration_date: string | null;
  effective_start_date: string;
  effective_end_date: string | null;
};

function toDateKey(value: string | null | undefined) {
  if (typeof value !== "string" || value.length < 10) {
    return null;
  }

  return value.slice(0, 10);
}

function isDateWithinInclusiveRange(dateKey: string | null, startKey: string | null, endKey: string | null) {
  if (!dateKey) {
    return false;
  }

  if (startKey && dateKey < startKey) {
    return false;
  }

  if (endKey && dateKey > endKey) {
    return false;
  }

  return true;
}

function normalizeCoreTopic(value: string | null): EmsCoreTopicCode | null {
  if (
    value === "airway_respirations_ventilations" ||
    value === "cardiology" ||
    value === "trauma" ||
    value === "medical" ||
    value === "operations"
  ) {
    return value;
  }

  return null;
}

export default function TrainingPanel() {
  const { member } = useAuth();
  const memberId = typeof member?.id === "string" ? member.id : "";
  const departmentId = typeof member?.department_id === "string" ? member.department_id : "";

  const [fireTrainingHours, setFireTrainingHours] = useState<number | null>(null);
  const [iowaEmsHours, setIowaEmsHours] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadTrainingHours() {
      if (!memberId || !departmentId) {
        if (isMounted) {
          setFireTrainingHours(null);
          setIowaEmsHours(null);
        }
        return;
      }

      const [
        { data: attendanceRows, error: attendanceError },
        { data: eventRows, error: eventError },
        { data: approvedOutsideRows, error: approvedOutsideError },
        { data: assignmentMemberRows, error: assignmentMemberError },
        { data: assignmentRows, error: assignmentRowsError },
        { data: categoryRows, error: categoryRowsError },
        { data: certificationRows, error: certificationRowsError },
        { data: certificationCatalogRows, error: certificationCatalogError },
        { data: emsTrackProfileRows, error: emsTrackProfileError },
      ] = await Promise.all([
        supabase
          .from("training_event_attendance")
          .select("training_event_id")
          .eq("department_id", departmentId)
          .eq("member_id", memberId)
          .eq("attendance_status", "attending"),
        supabase
          .from("training_events")
          .select("id, starts_at, category_id, hours_credit, is_ems_training, ems_core_topic, ems_needs_review")
          .eq("department_id", departmentId),
        supabase
          .from("training_outside_submissions")
          .select("id, training_date, category_id, hours, is_ems_training, ems_core_topic, ems_needs_review")
          .eq("department_id", departmentId)
          .eq("member_id", memberId)
          .eq("status", "approved"),
        supabase
          .from("training_assignment_members")
          .select("training_assignment_id, completion_status, hours_earned, completed_at")
          .eq("department_id", departmentId)
          .eq("member_id", memberId),
        supabase
          .from("training_assignments")
          .select("id, category_id, hours_credit")
          .eq("department_id", departmentId),
        supabase
          .from("training_categories")
          .select("id, name")
          .eq("department_id", departmentId),
        supabase
          .from("member_certifications")
          .select("certification_id, certificate_number, issued_at, expires_at")
          .eq("department_id", departmentId)
          .eq("member_id", memberId),
        supabase
          .from("certifications")
          .select("id, ems_authority, ems_certification_level")
          .eq("department_id", departmentId),
        supabase
          .from("ems_member_track_profiles")
          .select("track, certification_level, track_status, maintain_track, certification_number, expiration_date, effective_start_date, effective_end_date")
          .eq("department_id", departmentId)
          .eq("member_id", memberId)
          .order("effective_start_date", { ascending: false }),
      ]);

      if (
        attendanceError ||
        eventError ||
        approvedOutsideError ||
        assignmentMemberError ||
        assignmentRowsError ||
        categoryRowsError ||
        certificationRowsError ||
        certificationCatalogError ||
        emsTrackProfileError
      ) {
        if (isMounted) {
          setFireTrainingHours(null);
          setIowaEmsHours(null);
        }
        return;
      }

      const attendance = (attendanceRows ?? []) as Array<{ training_event_id: string }>;
      const events = (eventRows ?? []) as TrainingEventRow[];
      const approvedOutside = (approvedOutsideRows ?? []) as TrainingOutsideSubmissionRow[];
      const assignmentMembers = (assignmentMemberRows ?? []) as TrainingAssignmentMemberRow[];
      const assignments = (assignmentRows ?? []) as TrainingAssignmentRow[];
      const categories = (categoryRows ?? []) as TrainingCategoryRow[];
      const memberCertifications = (certificationRows ?? []) as MemberCertificationRow[];
      const certificationCatalog = (certificationCatalogRows ?? []) as CertificationCatalogRow[];
      const emsTrackProfiles = (emsTrackProfileRows ?? []) as EmsTrackProfileRow[];

      const attendedEventIds = Array.from(
        new Set(attendance.map((row) => row.training_event_id).filter((id) => typeof id === "string" && id.length > 0)),
      );

      const attendedEvents = events.filter((event) => attendedEventIds.includes(event.id));
      const assignmentById = new Map(assignments.map((row) => [row.id, row]));
      const categoryNameById = new Map(categories.map((row) => [row.id, row.name]));

      const currentYear = new Date().getFullYear();
      const currentYearStartKey = `${currentYear}-01-01`;
      const currentYearEndKey = `${currentYear}-12-31`;

      const fireComplianceRows = [
        ...attendedEvents
          .filter((row) => isDateWithinInclusiveRange(toDateKey(row.starts_at), currentYearStartKey, currentYearEndKey))
          .map((row) => ({ categoryId: row.category_id, hours: row.hours_credit })),
        ...approvedOutside
          .filter((row) => isDateWithinInclusiveRange(toDateKey(row.training_date), currentYearStartKey, currentYearEndKey))
          .map((row) => ({ categoryId: row.category_id, hours: row.hours })),
        ...assignmentMembers
          .filter((row) => row.completion_status === "approved")
          .filter((row) => isDateWithinInclusiveRange(toDateKey(row.completed_at), currentYearStartKey, currentYearEndKey))
          .map((row) => {
            const assignment = assignmentById.get(row.training_assignment_id);
            const assignmentHours = assignment ? parseHours(assignment.hours_credit) : 0;
            const rowHours = parseHours(row.hours_earned);
            return {
              categoryId: assignment?.category_id ?? null,
              hours: rowHours > 0 ? rowHours : assignmentHours,
            };
          }),
      ];

      const fireTrainingHoursTotal = calculateComplianceBucketHours(fireComplianceRows, categoryNameById).fireAnnualHours;

      const certificationTypeById = buildCertificationTypeMetaById(
        certificationCatalog.map((row) => ({
          id: row.id,
          ems_authority: row.ems_authority,
          ems_certification_level: row.ems_certification_level,
        })),
      );

      const authoritativeEmsCertifications = resolveAuthoritativeEmsCertificationsForMember({
        memberCertifications: memberCertifications.map((row) => ({
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
        profile: findCurrentTrackProfile(emsTrackProfiles, "iowa"),
        authoritativeCertification: authoritativeEmsCertifications.iowa,
      });

      const iowaCycleStartKey = toDateKey(activeIowaProfile?.effective_start_date ?? null);
      const iowaCycleEndKey = toDateKey(activeIowaProfile?.expiration_date ?? null);

      const iowaEmsRecords = [
        ...attendedEvents
          .filter((row) => row.is_ems_training === true)
          .filter((row) => isDateWithinInclusiveRange(toDateKey(row.starts_at), iowaCycleStartKey, iowaCycleEndKey))
          .map((row) => ({
            id: `event-${row.id}`,
            occurredAt: row.starts_at,
            hours: parseHours(row.hours_credit),
            coreTopic: normalizeCoreTopic(row.ems_core_topic),
            needsReview: row.ems_needs_review === true,
            eligibleForIowa: true,
            eligibleForNremt: false,
          })),
        ...approvedOutside
          .filter((row) => row.is_ems_training === true)
          .filter((row) => isDateWithinInclusiveRange(toDateKey(row.training_date), iowaCycleStartKey, iowaCycleEndKey))
          .map((row) => ({
            id: `outside-${row.id}`,
            occurredAt: row.training_date,
            hours: parseHours(row.hours),
            coreTopic: normalizeCoreTopic(row.ems_core_topic),
            needsReview: row.ems_needs_review === true,
            eligibleForIowa: true,
            eligibleForNremt: false,
          })),
      ];

      const iowaReadiness = calculateEmsReadiness({
        iowaProfile: activeIowaProfile
          ? {
              level: activeIowaProfile.certification_level,
              status: activeIowaProfile.track_status,
              expirationDate: activeIowaProfile.expiration_date,
              maintainTrack: activeIowaProfile.maintain_track === true,
            }
          : null,
        nremtProfile: null,
        trainingRecords: iowaEmsRecords,
      });

      if (isMounted) {
        setFireTrainingHours(fireTrainingHoursTotal);
        setIowaEmsHours(activeIowaProfile ? iowaReadiness.iowa.totalCompleted : null);
      }
    }

    void loadTrainingHours();

    return () => {
      isMounted = false;
    };
  }, [departmentId, memberId]);

  const yourHoursLabel = useMemo(() => {
    if (fireTrainingHours === null) {
      return "--";
    }

    return Number.isInteger(fireTrainingHours) ? String(fireTrainingHours) : fireTrainingHours.toFixed(1);
  }, [fireTrainingHours]);

  const departmentHoursLabel = useMemo(() => {
    if (iowaEmsHours === null) {
      return "--";
    }

    return Number.isInteger(iowaEmsHours) ? String(iowaEmsHours) : iowaEmsHours.toFixed(1);
  }, [iowaEmsHours]);

  return (
    <section className="relative overflow-hidden rounded-[22px] border border-white/10 bg-[#101010] shadow-[0_20px_60px_rgba(0,0,0,.45)]">

      {/* Background */}

      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(10,10,10,1)_0%,rgba(14,10,10,1)_52%,rgba(30,8,8,.92)_100%)]" />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_38%,rgba(239,43,45,.16),transparent_48%)]" />

      <div className="relative z-10 flex flex-col">

        {/* Header */}

        <div className="px-5 pt-3 text-center">

          <h2 className="text-[14px] font-bold uppercase tracking-[0.30em] text-white">
            TRAINING
          </h2>

        </div>

        {/* Metrics */}

        <div className="grid grid-cols-2 gap-2 px-5 pt-2">

          {/* Your Hours */}

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2">

            <div className="text-[10px] uppercase tracking-[.12em] text-neutral-500">
              FIRE TRAINING
            </div>

            <div className="mt-1 text-[34px] font-black leading-none tracking-[-0.05em] text-white">
              {yourHoursLabel}
            </div>

            <div className="mt-0.5 text-[11px] font-semibold text-green-400">
              Calendar Year
            </div>

          </div>

          {/* Department */}

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2">

            <div className="text-[10px] uppercase tracking-[.12em] text-neutral-500">
              IOWA EMS
            </div>

            <div className="mt-1 text-[34px] font-black leading-none tracking-[-0.05em] text-white">
              {departmentHoursLabel}
            </div>

            <div className="mt-0.5 text-[11px] text-neutral-400">
              Certification Cycle
            </div>

          </div>

        </div>

         {/* Footer */}

        <div className="px-5 pb-2 pt-2">
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new Event("redline-open-add-training-event"));
            }}
            className="group inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-[#3A3A3A] bg-[#131313] px-4 text-[13px] font-semibold text-white transition-all duration-300 hover:border-[#5A5A5A] hover:bg-[#171717] hover:shadow-[0_0_0_1px_rgba(239,43,45,0.25)]"
          >
            Log Training
            <ArrowRight size={15} className="text-[#EF2B2D] transition-colors duration-300 group-hover:text-[#ff6b6b]" />
          </button>

        </div>

      </div>

      {/* Left Accent Glow */}

      <div className="pointer-events-none absolute left-0 top-16 h-[180px] w-[2px] rounded-full bg-red-600/70 blur-[1px]" />

      {/* Bottom Glow */}

      <div className="pointer-events-none absolute bottom-0 left-1/2 h-20 w-[60%] -translate-x-1/2 bg-red-600/10 blur-3xl" />

      {/* Subtle Border Glow */}

      <div className="pointer-events-none absolute inset-0 rounded-[22px] ring-1 ring-inset ring-white/5" />

      {/* Bottom Divider */}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

    </section>
  );
}       