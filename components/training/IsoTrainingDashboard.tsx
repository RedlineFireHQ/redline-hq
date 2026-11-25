"use client";

import { useMemo } from "react";
import { ISO_TRAINING_CLASSIFICATIONS } from "@/lib/training/iso-training";
import type { IsoPrePlanOption } from "@/components/training/IsoTrainingFields";

type EventRow = {
  id: string;
  status: string;
  starts_at: string;
  hours_credit: number | null;
  iso_classifications: string[];
  iso_qualifying_facility: boolean;
  iso_pre_plan_id: string | null;
  iso_driver_operator_training_type: string | null;
};

type AttendanceRow = {
  training_event_id: string;
  member_id: string;
  attendance_status: string;
  hours_earned: number | null;
};

type MemberRow = {
  id: string;
  role: string | null;
  rank: string | null;
};

interface Props {
  events: EventRow[];
  attendanceRows: AttendanceRow[];
  members: MemberRow[];
  prePlans: IsoPrePlanOption[];
}

function hours(value: number) {
  return `${value.toFixed(1)} hrs`;
}

export default function IsoTrainingDashboard({ events, attendanceRows, members, prePlans }: Props) {
  const year = new Date().getFullYear();
  const summary = useMemo(() => {
    const completedEvents = events.filter((event) => event.status === "completed" && new Date(event.starts_at).getFullYear() === year);
    const officerIds = new Set(members.filter((member) => {
      const role = (member.role ?? "").toLowerCase();
      const rank = (member.rank ?? "").toLowerCase();
      return role.includes("officer") || role.includes("administrator") || /(chief|captain|lieutenant|lieut|battalion)/.test(rank);
    }).map((member) => member.id));
    const totalActiveMembers = Math.max(1, members.length);
    const rows = ISO_TRAINING_CLASSIFICATIONS.map((classification) => {
      const eligibleEvents = completedEvents.filter((event) => {
        if (!event.iso_classifications.includes(classification.code)) return false;
        if (classification.code === "training_facilities" && !event.iso_qualifying_facility) return false;
        return true;
      });
      const participantIds = new Set<string>();
      let memberHoursTotal = 0;
      for (const attendance of attendanceRows) {
        if (attendance.attendance_status !== "attending") continue;
        const event = eligibleEvents.find((item) => item.id === attendance.training_event_id);
        if (!event) continue;
        participantIds.add(attendance.member_id);
        memberHoursTotal += Math.max(0, attendance.hours_earned ?? event.hours_credit ?? 0);
      }
      const denominator = classification.code === "officer_training" ? Math.max(1, officerIds.size) : totalActiveMembers;
      const averagePerPerson = memberHoursTotal / denominator;
      return {
        ...classification,
        events: eligibleEvents.length,
        participants: participantIds.size,
        memberHours: memberHoursTotal,
        averagePerPerson,
      };
    });

    const visitsByPlan = new Map<string, number>();
    for (const event of completedEvents) {
      if (!event.iso_classifications.includes("building_familiarization") || !event.iso_pre_plan_id) continue;
      visitsByPlan.set(event.iso_pre_plan_id, (visitsByPlan.get(event.iso_pre_plan_id) ?? 0) + 1);
    }
    const activePlans = prePlans.filter((plan) => plan.lifecycle_status === "active");
    const plansMeetingVisitTarget = activePlans.filter((plan) => (visitsByPlan.get(plan.id) ?? 0) >= (plan.iso_high_hazard ? 2 : 1)).length;
    const initialDriverHours = completedEvents.filter((event) => event.iso_classifications.includes("driver_operator") && event.iso_driver_operator_training_type === "initial").reduce((sum, event) => sum + attendanceRows.filter((row) => row.training_event_id === event.id && row.attendance_status === "attending").reduce((eventSum, row) => eventSum + Math.max(0, row.hours_earned ?? event.hours_credit ?? 0), 0), 0);
    const refresherDriverHours = completedEvents.filter((event) => event.iso_classifications.includes("driver_operator") && event.iso_driver_operator_training_type === "refresher").reduce((sum, event) => sum + attendanceRows.filter((row) => row.training_event_id === event.id && row.attendance_status === "attending").reduce((eventSum, row) => eventSum + Math.max(0, row.hours_earned ?? event.hours_credit ?? 0), 0), 0);
    const company = rows.find((row) => row.code === "company_training");
    const facility = rows.find((row) => row.code === "training_facilities");
    const hazmat = rows.find((row) => row.code === "hazmat");
    const officer = rows.find((row) => row.code === "officer_training");
    const preplanCoverage = activePlans.length ? Math.round((plansMeetingVisitTarget / activePlans.length) * 100) : 0;
    return { rows, facility, company, hazmat, officer, initialDriverHours, refresherDriverHours, activePlans: activePlans.length, plansMeetingVisitTarget, preplanCoverage, totalActiveMembers };
  }, [events, attendanceRows, members, prePlans, year]);

  return (
    <section className="rounded-2xl border border-sky-500/20 bg-[#0d1720] p-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-sky-300">ISO / PPC Documentation</p>
          <h2 className="mt-1 text-xl font-bold text-white">{year} Training Classification Summary</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-300">Completed training records are grouped into the seven ISO documentation categories. A single training event can count in multiple applicable categories without creating duplicate training records.</p>
        </div>
        <span className="rounded-full border border-sky-300/20 bg-sky-300/10 px-3 py-1.5 text-xs font-semibold text-sky-200">Weights total 100%</span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><div className="text-xs text-slate-400">Qualifying facility hours / member</div><div className="mt-1 text-xl font-bold text-white">{hours(summary.facility?.averagePerPerson ?? 0)} <span className="text-xs font-medium text-slate-400">/ 18</span></div></div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><div className="text-xs text-slate-400">Company training / member</div><div className="mt-1 text-xl font-bold text-white">{hours(summary.company?.averagePerPerson ?? 0)} <span className="text-xs font-medium text-slate-400">/ 192 yearly</span></div></div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><div className="text-xs text-slate-400">HazMat / member</div><div className="mt-1 text-xl font-bold text-white">{hours(summary.hazmat?.averagePerPerson ?? 0)} <span className="text-xs font-medium text-slate-400">/ 6</span></div></div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><div className="text-xs text-slate-400">Officer training / officer</div><div className="mt-1 text-xl font-bold text-white">{hours(summary.officer?.averagePerPerson ?? 0)} <span className="text-xs font-medium text-slate-400">/ 12</span></div></div>
      </div>

      <div className="mt-5 overflow-x-auto rounded-xl border border-white/10">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white/[0.04] text-[11px] uppercase tracking-wide text-slate-400">
            <tr><th className="px-3 py-3">ISO category</th><th className="px-3 py-3">Weight</th><th className="px-3 py-3">Completed events</th><th className="px-3 py-3">Participants</th><th className="px-3 py-3">Member-hours</th><th className="px-3 py-3">Benchmark</th></tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {summary.rows.map((row) => (
              <tr key={row.code}>
                <td className="px-3 py-3 font-semibold text-white">{row.label}</td>
                <td className="px-3 py-3 text-sky-200">{row.weight}%</td>
                <td className="px-3 py-3 tabular-nums text-slate-200">{row.events}</td>
                <td className="px-3 py-3 tabular-nums text-slate-200">{row.participants}</td>
                <td className="px-3 py-3 tabular-nums text-slate-200">{hours(row.memberHours)}</td>
                <td className="px-3 py-3 text-xs text-slate-300">{row.target}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Driver / Operator</div><div className="mt-2 text-sm text-white">Initial: {hours(summary.initialDriverHours)}</div><div className="mt-1 text-sm text-white">Refresher: {hours(summary.refresherDriverHours)}</div><p className="mt-2 text-xs text-slate-400">60-hour initial benchmark; 12-hour annual refresher benchmark.</p></div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Building familiarization</div><div className="mt-2 text-lg font-bold text-white">{summary.plansMeetingVisitTarget} / {summary.activePlans} properties</div><p className="mt-1 text-xs text-slate-400">{summary.preplanCoverage}% of active pre-plans have the required annual visit count. High-hazard properties require two visits.</p></div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Officer qualification</div><div className="mt-2 text-sm text-white">12 training hours per officer per year</div><p className="mt-1 text-xs text-slate-400">Fire Officer I or equivalent certification must also be maintained and verified in Personnel certifications.</p></div>
      </div>
    </section>
  );
}
