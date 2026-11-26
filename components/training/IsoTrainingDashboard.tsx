"use client";

import { useMemo, useState } from "react";
import { ISO_TRAINING_CLASSIFICATIONS, calculateIsoMemberHours } from "@/lib/training/iso-training";
import type { IsoPrePlanOption } from "@/components/training/IsoTrainingFields";

type EventRow = {
  id: string;
  status: string;
  starts_at: string;
  hours_credit: number | null;
  iso_classifications: string[];
  iso_qualifying_facility: boolean;
  iso_facility_credit_level: string;
  iso_facility_stories: number | null;
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
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  rank: string | null;
  hire_start_date: string | null;
  certifications: string | null;
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
  const [isOpen, setIsOpen] = useState(false);
  const year = new Date().getFullYear();
  const summary = useMemo(() => {
    const completedEvents = events.filter((event) => event.status === "completed" && new Date(event.starts_at).getFullYear() === year);
    const officerIds = new Set(members.filter((member) => {
      const role = (member.role ?? "").toLowerCase();
      const rank = (member.rank ?? "").toLowerCase();
      return role.includes("officer") || role.includes("administrator") || /(chief|captain|lieutenant|lieut|battalion)/.test(rank);
    }).map((member) => member.id));
    const totalActiveMembers = Math.max(1, members.length);
    const now = new Date();
    const recruitMembers = members.filter((member) => {
      if (!member.hire_start_date) return false;
      const start = new Date(`${member.hire_start_date}T00:00:00`);
      const days = (now.getTime() - start.getTime()) / 86400000;
      const hasFirefighterI = (member.certifications ?? "").toLowerCase().includes("firefighter i");
      return Number.isFinite(start.getTime()) && days >= 0 && days <= 365 && !hasFirefighterI;
    });
    const recruitIds = new Set(recruitMembers.map((member) => member.id));
    let fullFacilityHours = 0;
    let partialFacilityHours = 0;
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
        if (classification.code === "officer_training" && !officerIds.has(attendance.member_id)) continue;
        if (classification.code === "recruit" && !recruitIds.has(attendance.member_id)) continue;
        const event = eligibleEvents.find((item) => item.id === attendance.training_event_id);
        if (!event) continue;
        participantIds.add(attendance.member_id);
        const earned = Math.max(0, attendance.hours_earned ?? event.hours_credit ?? 0);
        memberHoursTotal += earned;
        if (classification.code === "training_facilities") {
          if (event.iso_facility_credit_level === "partial") partialFacilityHours += earned;
          else if (event.iso_facility_credit_level === "full") fullFacilityHours += earned;
        }
      }
      const denominator = classification.code === "officer_training" ? Math.max(1, officerIds.size) : classification.code === "recruit" ? Math.max(1, recruitMembers.length) : totalActiveMembers;
      const averagePerPerson = memberHoursTotal / denominator;
      return {
        ...classification,
        events: eligibleEvents.length,
        participants: participantIds.size,
        memberHours: memberHoursTotal,
        averagePerPerson,
      };
    });

    const memberHours = calculateIsoMemberHours({ events, attendance: attendanceRows, year });
    const visitsByPlan = new Map<string, number>();
    for (const event of completedEvents) {
      if (!event.iso_classifications.includes("building_familiarization") || !event.iso_pre_plan_id) continue;
      visitsByPlan.set(event.iso_pre_plan_id, (visitsByPlan.get(event.iso_pre_plan_id) ?? 0) + 1);
    }
    const activePlans = prePlans.filter((plan) => plan.lifecycle_status === "active");
    const plansMeetingVisitTarget = activePlans.filter((plan) => (visitsByPlan.get(plan.id) ?? 0) >= (plan.iso_high_hazard ? 2 : 1)).length;
    const driverHoursByMember = new Map<string, { initial: number; refresher: number }>();
    for (const attendance of attendanceRows) {
      if (attendance.attendance_status !== "attending") continue;
      const event = completedEvents.find((item) => item.id === attendance.training_event_id);
      if (!event || !event.iso_classifications.includes("driver_operator")) continue;
      const type = event.iso_driver_operator_training_type;
      if (type !== "initial" && type !== "refresher") continue;
      const current = driverHoursByMember.get(attendance.member_id) ?? { initial: 0, refresher: 0 };
      const earned = Math.max(0, attendance.hours_earned ?? event.hours_credit ?? 0);
      current[type] += earned;
      driverHoursByMember.set(attendance.member_id, current);
    }
    const initialDriverParticipants = [...driverHoursByMember.values()].filter((value) => value.initial > 0).length;
    const refresherDriverParticipants = [...driverHoursByMember.values()].filter((value) => value.refresher > 0).length;
    const initialDriverHours = [...driverHoursByMember.values()].reduce((sum, value) => sum + value.initial, 0);
    const refresherDriverHours = [...driverHoursByMember.values()].reduce((sum, value) => sum + value.refresher, 0);
    const initialDriverAverageHours = initialDriverParticipants ? initialDriverHours / initialDriverParticipants : 0;
    const refresherDriverAverageHours = refresherDriverParticipants ? refresherDriverHours / refresherDriverParticipants : 0;
    const company = rows.find((row) => row.code === "company_training");
    const facility = rows.find((row) => row.code === "training_facilities");
    const hazmat = rows.find((row) => row.code === "hazmat");
    const officer = rows.find((row) => row.code === "officer_training");
    const recruitMemberHours = recruitMembers.reduce((sum, member) => sum + (memberHours.get(member.id)?.recruit ?? 0), 0);
    const recruitAverageHours = recruitMembers.length ? recruitMemberHours / recruitMembers.length : 0;
    const elapsedMonths = year === now.getFullYear() ? now.getMonth() + 1 : 12;
    const companyAverageMonthlyHours = (company?.averagePerPerson ?? 0) / Math.max(1, elapsedMonths);
    const preplanCoverage = activePlans.length ? Math.round((plansMeetingVisitTarget / activePlans.length) * 100) : 0;
    return { rows, facility, company, hazmat, officer, recruitAverageHours, recruitCount: recruitMembers.length, companyAverageMonthlyHours, fullFacilityHours, partialFacilityHours, initialDriverHours, refresherDriverHours, initialDriverAverageHours, refresherDriverAverageHours, initialDriverParticipants, refresherDriverParticipants, activePlans: activePlans.length, plansMeetingVisitTarget, preplanCoverage, totalActiveMembers, memberHours };
  }, [events, attendanceRows, members, prePlans, year]);

  const memberRows = members.map((member) => {
    const totals = summary.memberHours.get(member.id);
    const fullName = [member.first_name, member.last_name].filter(Boolean).join(" ").trim() || "Unnamed member";
    return { id: member.id, name: fullName, totals: totals ?? { training_facilities: 0, company_training: 0, officer_training: 0, driver_operator: 0, hazmat: 0, recruit: 0, building_familiarization: 0 } };
  }).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <section className="rounded-2xl border border-sky-500/20 bg-[#0d1720] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-300">ISO / PPC Compliance</p>
          <p className="mt-1 text-sm text-slate-300">Open the department compliance dashboard to review ISO categories, benchmarks, and individual member progress.</p>
        </div>
        <button type="button" onClick={() => setIsOpen((current) => !current)} aria-expanded={isOpen} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-sky-300/30 bg-sky-300/10 px-4 py-2.5 text-sm font-semibold text-sky-100 transition hover:bg-sky-300/15">
          {isOpen ? "Close ISO Compliance" : "Open ISO / PPC Compliance"}
          <span aria-hidden="true">{isOpen ? "−" : "+"}</span>
        </button>
      </div>
      {isOpen ? (
      <div className="mt-5 border-t border-sky-300/15 pt-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-sky-300">ISO / PPC Documentation</p>
          <h2 className="mt-1 text-xl font-bold text-white">{year} Training Classification Summary</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-300">Completed training records are grouped into the seven ISO documentation categories. A single event can count in multiple applicable categories without creating duplicate records. Two-story towers are shown separately as partial-credit facilities.</p>
        </div>
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

      <div className="mt-5">
        <div className="mb-3">
          <h3 className="text-base font-bold text-white">Individual Personnel ISO Progress</h3>
          <p className="mt-1 text-xs text-slate-400">Completed training hours credited to each member by ISO classification for {year}. Members with no qualifying hours remain listed.</p>
        </div>
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-white/[0.04] uppercase tracking-wide text-slate-400">
              <tr><th className="px-3 py-3">Personnel</th>{ISO_TRAINING_CLASSIFICATIONS.map((item) => <th key={item.code} className="min-w-[120px] px-3 py-3">{item.label}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {memberRows.map((member) => (
                <tr key={member.id}>
                  <td className="whitespace-nowrap px-3 py-3 font-semibold text-white">{member.name}</td>
                  {ISO_TRAINING_CLASSIFICATIONS.map((item) => <td key={item.code} className="px-3 py-3 tabular-nums text-slate-200">{hours(member.totals[item.code])}</td>)}
                </tr>
              ))}
              {memberRows.length === 0 ? <tr><td colSpan={8} className="px-3 py-5 text-center text-slate-400">No active personnel found.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
      </div>
      ) : null}
    </section>
  );
}
