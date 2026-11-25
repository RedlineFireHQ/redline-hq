"use server";

import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/current-member";
import { hasAssignedDepartmentPermission } from "@/lib/member-permissions";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { ISO_TRAINING_CLASSIFICATIONS, isoClassificationLabel } from "@/lib/training/iso-classifications";

type EventRow = {
  id: string;
  title: string;
  iso_classification: string | null;
  iso_qualifying_facility: boolean;
  starts_at: string;
  hours_credit: number | string | null;
};
type AttendanceRow = { training_event_id: string; member_id: string; attendance_status: string };
type MemberRow = { id: string; first_name: string | null; last_name: string | null; role: string | null };

const TARGETS: Record<string, string> = {
  training_facilities: "18 hrs / firefighter / year",
  company_training: "16 hrs / firefighter / month",
  officer_training: "12 hrs / officer / year + Fire Officer I or equivalent",
  driver_operator: "12 hrs / year; 60 initial hrs for new operators",
  hazmat: "6 hrs / firefighter / year",
  recruit: "240 hrs during first year",
  building_familiarization: "Annual building visits; twice yearly for high-hazard / large buildings",
};

function hours(value: number | string | null) {
  const parsed = typeof value === "number" ? value : Number.parseFloat(value ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

export default async function IsoTrainingReportPage() {
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);
  if (!currentMember?.departmentId) redirect("/login");

  const canManageTraining =
    (await hasAssignedDepartmentPermission(supabase, currentMember.departmentId, "training_program_management")) ||
    (await hasAssignedDepartmentPermission(supabase, currentMember.departmentId, "training_management"));
  if (!canManageTraining) redirect("/training");

  const admin = createSupabaseAdminClient();
  const year = new Date().getFullYear();
  const start = new Date(Date.UTC(year, 0, 1)).toISOString();
  const end = new Date(Date.UTC(year + 1, 0, 1)).toISOString();

  const [{ data: eventData, error: eventError }, { data: attendanceData, error: attendanceError }, { data: memberData, error: memberError }] = await Promise.all([
    admin.from("training_events").select("id, title, iso_classification, iso_qualifying_facility, starts_at, hours_credit").eq("department_id", currentMember.departmentId).gte("starts_at", start).lt("starts_at", end).not("iso_classification", "is", null).order("starts_at", { ascending: false }),
    admin.from("training_event_attendance").select("training_event_id, member_id, attendance_status").eq("department_id", currentMember.departmentId).eq("attendance_status", "attending"),
    admin.from("members").select("id, first_name, last_name, role").eq("department_id", currentMember.departmentId).eq("active", true).order("last_name", { ascending: true }),
  ]);

  if (eventError || attendanceError || memberError) {
    throw new Error(eventError?.message || attendanceError?.message || memberError?.message || "Unable to load ISO training records.");
  }

  const events = (eventData ?? []) as EventRow[];
  const attendance = (attendanceData ?? []) as AttendanceRow[];
  const members = (memberData ?? []) as MemberRow[];
  const eventById = new Map(events.map((event) => [event.id, event]));
  const totals = new Map<string, Map<string, number>>();
  const facilityTotals = new Map<string, number>();
  const classificationTotals = new Map<string, number>();
  const eventCounts = new Map<string, number>();

  for (const item of ISO_TRAINING_CLASSIFICATIONS) {
    classificationTotals.set(item.value, 0);
    eventCounts.set(item.value, 0);
  }

  for (const event of events) {
    const classification = event.iso_classification;
    if (!classification) continue;
    eventCounts.set(classification, (eventCounts.get(classification) ?? 0) + 1);
  }

  for (const row of attendance) {
    const event = eventById.get(row.training_event_id);
    if (!event?.iso_classification) continue;
    const credit = hours(event.hours_credit);
    const memberTotals = totals.get(row.member_id) ?? new Map<string, number>();
    memberTotals.set(event.iso_classification, (memberTotals.get(event.iso_classification) ?? 0) + credit);
    totals.set(row.member_id, memberTotals);
    classificationTotals.set(event.iso_classification, (classificationTotals.get(event.iso_classification) ?? 0) + credit);
    if (event.iso_qualifying_facility) facilityTotals.set(row.member_id, (facilityTotals.get(row.member_id) ?? 0) + credit);
  }

  const totalHours = Array.from(classificationTotals.values()).reduce((sum, value) => sum + value, 0);

  return (
    <main className="space-y-6 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/training" className="text-sm font-semibold text-red-300 hover:text-red-200">← Back to Training</Link>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-red-500">Reports</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">ISO Training Documentation</h1>
          <p className="mt-2 max-w-3xl text-sm text-neutral-400">Training events recorded for {year}, grouped by the ISO classification selected when the training was logged.</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-neutral-900 px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-neutral-400">Classified training hours</p>
          <p className="mt-1 text-2xl font-bold text-white">{totalHours.toFixed(2)} hrs</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {ISO_TRAINING_CLASSIFICATIONS.map((item) => (
          <section key={item.value} className="rounded-xl border border-white/10 bg-neutral-900 p-4">
            <p className="text-sm font-semibold text-white">{item.label}</p>
            <p className="mt-3 text-2xl font-bold text-white">{(classificationTotals.get(item.value) ?? 0).toFixed(2)} hrs</p>
            <p className="mt-1 text-xs text-neutral-400">{eventCounts.get(item.value) ?? 0} training events</p>
            <p className="mt-3 text-xs text-neutral-500">Guide reference: {TARGETS[item.value]}</p>
          </section>
        ))}
      </div>

      <section className="overflow-hidden rounded-xl border border-white/10 bg-neutral-900">
        <div className="border-b border-white/10 px-5 py-4">
          <h2 className="font-semibold text-white">Member training breakdown</h2>
          <p className="mt-1 text-xs text-neutral-400">Hours are credited to members marked as attending each training event.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-wider text-neutral-400">
              <tr><th className="px-4 py-3">Member</th>{ISO_TRAINING_CLASSIFICATIONS.map((item) => <th key={item.value} className="px-3 py-3">{item.label}</th>)}<th className="px-4 py-3">Facility hrs</th></tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const byClassification = totals.get(member.id) ?? new Map<string, number>();
                const memberTotal = Array.from(byClassification.values()).reduce((sum, value) => sum + value, 0);
                return (
                  <tr key={member.id} className="border-t border-white/5">
                    <td className="px-4 py-3 font-medium text-white">{[member.first_name, member.last_name].filter(Boolean).join(" ") || "Unnamed member"}<span className="block text-xs text-neutral-500">{member.role || "Member"}</span></td>
                    {ISO_TRAINING_CLASSIFICATIONS.map((item) => <td key={item.value} className="px-3 py-3 tabular-nums text-neutral-300">{(byClassification.get(item.value) ?? 0).toFixed(2)}</td>)}
                    <td className="px-4 py-3 tabular-nums text-neutral-300">{(facilityTotals.get(member.id) ?? 0).toFixed(2)}</td>
                  </tr>
                );
              })}
              {members.length === 0 ? <tr><td colSpan={9} className="px-4 py-8 text-center text-neutral-400">No active members found.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-amber-500/20 bg-amber-500/[0.05] p-4 text-sm text-neutral-300">
        <p className="font-semibold text-amber-200">Important documentation note</p>
        <p className="mt-1">This is an initial documentation summary, not an ISO compliance determination. It reports only training events explicitly assigned an ISO classification and attendance marked as attending. The guide's officer certification, new-driver initial qualification, recruit first-year period, and building-visit frequency requirements need additional qualification and visit-history records before Redline can determine those items automatically.</p>
        <p className="mt-2 text-xs text-neutral-500">Targets shown are from the department's ISO Fire Training Quick Guide and should be confirmed against the current applicable ISO/Verisk requirements.</p>
      </section>

      <section className="rounded-xl border border-white/10 bg-neutral-900 p-4">
        <h2 className="font-semibold text-white">Recent classified training</h2>
        <div className="mt-3 divide-y divide-white/5">
          {events.slice(0, 30).map((event) => (
            <div key={event.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div><p className="font-medium text-white">{event.title}</p><p className="mt-1 text-xs text-neutral-400">{new Date(event.starts_at).toLocaleDateString()} · {isoClassificationLabel(event.iso_classification)}{event.iso_qualifying_facility ? " · Qualifying facility" : ""}</p></div>
              <p className="text-sm tabular-nums text-neutral-300">{hours(event.hours_credit).toFixed(2)} hrs / event</p>
            </div>
          ))}
          {events.length === 0 ? <p className="py-5 text-sm text-neutral-400">No ISO-classified training has been logged this year.</p> : null}
        </div>
      </section>
    </main>
  );
}
