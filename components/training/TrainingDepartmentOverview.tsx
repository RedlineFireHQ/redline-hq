"use client";

import Link from "next/link";
import { CalendarDays, Clock3, MapPin, UserRound } from "lucide-react";

type TrainingEvent = {
  id: string;
  title: string;
  categoryName: string;
  startsAt: string;
  hoursCredit: number | null;
  instructorName: string | null;
  location: string | null;
  status: string;
  attendedCount: number;
};

export type SelfReportedTraining = {
  id: string;
  title: string;
  categoryName: string;
  trainingDate: string;
  hours: number | null;
  submitterName: string;
};

interface TrainingDepartmentOverviewProps {
  departmentTrainingHoursThisYear: number;
  pendingReviews: number;
  events: TrainingEvent[];
  membersTrainedCount: number;
  selfReported?: SelfReportedTraining[];
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });
}

function formatHours(value: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(2) : "-";
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
    timeZone: "UTC",
  });
}

export default function TrainingDepartmentOverview({
  departmentTrainingHoursThisYear,
  pendingReviews,
  events,
  membersTrainedCount,
  selfReported = [],
}: TrainingDepartmentOverviewProps) {
  // Unified department training history: department-created events plus approved
  // self-reported training, merged and sorted by date. Self-reported rows are
  // labeled and are not linked to an event detail page (none exists for them).
  type UnifiedRow =
    | { kind: "event"; id: string; title: string; categoryName: string; date: string; hours: number | null; status: string; attendedCount: number; location: string | null }
    | { kind: "self"; id: string; title: string; categoryName: string; date: string; hours: number | null; submitterName: string };

  const unified: UnifiedRow[] = [
    ...events.map((event) => ({
      kind: "event" as const,
      id: event.id,
      title: event.title,
      categoryName: event.categoryName,
      date: event.startsAt,
      hours: event.hoursCredit,
      status: event.status,
      attendedCount: event.attendedCount,
      location: event.location,
    })),
    ...selfReported.map((submission) => ({
      kind: "self" as const,
      id: submission.id,
      title: submission.title,
      categoryName: submission.categoryName,
      date: submission.trainingDate,
      hours: submission.hours,
      submitterName: submission.submitterName,
    })),
  ].sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());

  const isEmpty = unified.length === 0;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-neutral-900 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.18em] text-neutral-400">Department Training Hours</p>
          <p className="mt-2 text-3xl font-black text-white">{departmentTrainingHoursThisYear.toFixed(2)}</p>
          <p className="mt-1 text-xs text-neutral-500">Calendar Year</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-neutral-900 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.18em] text-neutral-400">Training Events</p>
          <p className="mt-2 text-3xl font-black text-white">{events.length}</p>
          <p className="mt-1 text-xs text-neutral-500">Department Total</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-neutral-900 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.18em] text-neutral-400">Members Trained</p>
          <p className="mt-2 text-3xl font-black text-white">{membersTrainedCount}</p>
          <p className="mt-1 text-xs text-neutral-500">Department Total</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-neutral-900 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.18em] text-neutral-400">Pending Reviews</p>
          <p className="mt-2 text-3xl font-black text-white">{pendingReviews}</p>
          <p className="mt-1 text-xs text-neutral-500">Outside + assignments + attendance</p>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900">
        <div className="border-b border-neutral-800 px-5 py-4">
          <h2 className="text-xl font-semibold text-white">Training Events</h2>
          <p className="mt-1 text-sm text-neutral-400">Department training history, including approved self-reported training.</p>
        </div>

        {isEmpty ? (
          <p className="px-5 py-8 text-center text-sm text-neutral-400">No training events yet.</p>
        ) : (
          <div className="max-h-[28rem] overflow-y-auto">
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px]">
                <thead className="border-b border-neutral-800 bg-[#111111]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.16em] text-neutral-500">Training</th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.16em] text-neutral-500">Source</th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.16em] text-neutral-500">Category</th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.16em] text-neutral-500">Date/Time</th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.16em] text-neutral-500">Hours</th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.16em] text-neutral-500">Attendance</th>
                  </tr>
                </thead>
                <tbody>
                  {unified.map((row) => (
                    <tr key={`${row.kind}-${row.id}`} className="border-b border-neutral-800">
                      <td className="px-4 py-3">
                        {row.kind === "event" ? (
                          <>
                            <Link href={`/training/${row.id}`} className="font-semibold text-white hover:text-red-300">
                              {row.title}
                            </Link>
                            <p className="mt-1 text-xs text-neutral-400">{row.status.replaceAll("_", " ")}</p>
                          </>
                        ) : (
                          <>
                            <span className="font-semibold text-white">{row.title}</span>
                            <p className="mt-1 text-xs text-neutral-400">by {row.submitterName}</p>
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {row.kind === "event" ? (
                          <span className="rounded-full border border-sky-500/35 bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-sky-200">Department Event</span>
                        ) : (
                          <span className="rounded-full border border-amber-500/35 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-200">Self-Reported</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-200">{row.categoryName}</td>
                      <td className="px-4 py-3 text-sm text-neutral-200">{row.kind === "event" ? formatDateTime(row.date) : formatDateOnly(row.date)}</td>
                      <td className="px-4 py-3 text-sm text-neutral-200">{formatHours(row.hours)}</td>
                      <td className="px-4 py-3 text-sm text-neutral-200">
                        {row.kind === "event" ? `${row.attendedCount} attended` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 p-4 md:hidden">
              {unified.map((row) => (
                row.kind === "event" ? (
                  <Link key={`event-${row.id}`} href={`/training/${row.id}`} className="block rounded-xl border border-white/10 bg-[#151515] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-base font-semibold text-white">{row.title}</h3>
                      <span className="rounded-full border border-sky-500/35 bg-sky-500/15 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-sky-200">Department Event</span>
                    </div>
                    <p className="mt-1 text-xs text-neutral-400">{row.categoryName}</p>
                    <div className="mt-3 space-y-1 text-sm text-neutral-300">
                      <div className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4 text-neutral-500" />{formatDateTime(row.date)}</div>
                      <div className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4 text-neutral-500" />{formatHours(row.hours)} hrs</div>
                      <div className="inline-flex items-center gap-2"><UserRound className="h-4 w-4 text-neutral-500" />{row.attendedCount} attended</div>
                      <div className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-neutral-500" />{row.location || "No location"}</div>
                    </div>
                  </Link>
                ) : (
                  <div key={`self-${row.id}`} className="block rounded-xl border border-white/10 bg-[#151515] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-base font-semibold text-white">{row.title}</h3>
                      <span className="rounded-full border border-amber-500/35 bg-amber-500/15 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-amber-200">Self-Reported</span>
                    </div>
                    <p className="mt-1 text-xs text-neutral-400">{row.categoryName} · by {row.submitterName}</p>
                    <div className="mt-3 space-y-1 text-sm text-neutral-300">
                      <div className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4 text-neutral-500" />{formatDateOnly(row.date)}</div>
                      <div className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4 text-neutral-500" />{formatHours(row.hours)} hrs</div>
                    </div>
                  </div>
                )
              ))}
            </div>
          </div>
        )}
      </section>
    </>
  );
}
