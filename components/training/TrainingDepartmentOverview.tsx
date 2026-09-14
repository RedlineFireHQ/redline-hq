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

interface TrainingDepartmentOverviewProps {
  departmentTrainingHoursThisYear: number;
  pendingReviews: number;
  events: TrainingEvent[];
  membersTrainedCount: number;
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

export default function TrainingDepartmentOverview({
  departmentTrainingHoursThisYear,
  pendingReviews,
  events,
  membersTrainedCount,
}: TrainingDepartmentOverviewProps) {
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
          <p className="mt-1 text-sm text-neutral-400">Department training history.</p>
        </div>

        {events.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-neutral-400">No training events yet.</p>
        ) : (
          <div className="max-h-[28rem] overflow-y-auto">
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px]">
                <thead className="border-b border-neutral-800 bg-[#111111]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.16em] text-neutral-500">Training</th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.16em] text-neutral-500">Category</th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.16em] text-neutral-500">Date/Time</th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.16em] text-neutral-500">Hours</th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.16em] text-neutral-500">Attendance</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr key={event.id} className="border-b border-neutral-800">
                      <td className="px-4 py-3">
                        <Link href={`/training/${event.id}`} className="font-semibold text-white hover:text-red-300">
                          {event.title}
                        </Link>
                        <p className="mt-1 text-xs text-neutral-400">{event.status.replaceAll("_", " ")}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-200">{event.categoryName}</td>
                      <td className="px-4 py-3 text-sm text-neutral-200">{formatDateTime(event.startsAt)}</td>
                      <td className="px-4 py-3 text-sm text-neutral-200">{formatHours(event.hoursCredit)}</td>
                      <td className="px-4 py-3 text-sm text-neutral-200">{event.attendedCount} attended</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 p-4 md:hidden">
              {events.map((event) => (
                <Link key={event.id} href={`/training/${event.id}`} className="block rounded-xl border border-white/10 bg-[#151515] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-semibold text-white">{event.title}</h3>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-neutral-200">
                      {event.status.replaceAll("_", " ")}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-neutral-400">{event.categoryName}</p>
                  <div className="mt-3 space-y-1 text-sm text-neutral-300">
                    <div className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4 text-neutral-500" />{formatDateTime(event.startsAt)}</div>
                    <div className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4 text-neutral-500" />{formatHours(event.hoursCredit)} hrs</div>
                    <div className="inline-flex items-center gap-2"><UserRound className="h-4 w-4 text-neutral-500" />{event.attendedCount} attended</div>
                    <div className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-neutral-500" />{event.location || "No location"}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>
    </>
  );
}
