import Link from "next/link";
import { redirect } from "next/navigation";
import PageLayout from "@/components/layout/PageLayout";
import { emsProgressStatusClasses, formatEmsProgressStatus } from "@/components/ems/EmsContinuingEducationSection";
import { canViewEmsCeProgress, loadDepartmentEmsProgressRows } from "@/lib/ems/department-ems-progress-data";
import type { DepartmentEmsProgressRow } from "@/lib/ems/department-ems-progress";
import { getCurrentMember } from "@/lib/current-member";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const STATUS_FILTERS = [
  { key: "all", label: "All Members" },
  { key: "needs_attention", label: "Needs Attention" },
  { key: "not_set_up", label: "Not Set Up" },
  { key: "on_track", label: "On Track" },
  { key: "complete", label: "Complete" },
  { key: "no_tracker", label: "No Tracker" },
] as const;

type StatusFilterKey = (typeof STATUS_FILTERS)[number]["key"];

function normalizeFilter(value: string | undefined): StatusFilterKey {
  return (STATUS_FILTERS.find((filter) => filter.key === value)?.key ?? "all") as StatusFilterKey;
}

function trackMatchesFilter(status: string, filter: StatusFilterKey) {
  if (filter === "not_set_up") {
    return status === "not_configured";
  }

  return status === filter;
}

function rowMatchesFilter(row: DepartmentEmsProgressRow, filter: StatusFilterKey) {
  if (filter === "all") {
    return true;
  }

  if (filter === "no_tracker") {
    return !row.hasAnyTracker;
  }

  if (!row.hasAnyTracker) {
    return false;
  }

  return (
    trackMatchesFilter(row.emsReadiness.iowa.status, filter) ||
    trackMatchesFilter(row.emsReadiness.nremt.status, filter)
  );
}

function formatDateOnly(value: string | null) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function trackSummaryLine(track: { status: string; totalCompleted: number; totalRequired: number; totalRemaining: number }) {
  if (track.status === "not_configured" || track.status === "not_maintained") {
    return "-";
  }

  return `${track.totalCompleted.toFixed(1)} / ${track.totalRequired.toFixed(1)} hrs • ${track.totalRemaining.toFixed(1)} remaining`;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-block rounded-full border px-2.5 py-1 text-xs uppercase tracking-[0.12em] ${emsProgressStatusClasses(status)}`}>
      {formatEmsProgressStatus(status)}
    </span>
  );
}

export default async function EmsCeProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);

  if (!currentMember?.departmentId) {
    redirect("/login");
  }

  const authorized = await canViewEmsCeProgress(supabase, currentMember.departmentId, currentMember.role);
  if (!authorized) {
    redirect("/");
  }

  const filter = normalizeFilter((await searchParams).status);
  const allRows = await loadDepartmentEmsProgressRows({ departmentId: currentMember.departmentId });
  const rows = allRows.filter((row) => rowMatchesFilter(row, filter));

  return (
    <PageLayout>
      <div className="space-y-6">
        <section className="rounded-2xl border border-white/10 bg-[#0b0b0b] p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-red-500">EMS</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-white">EMS Continuing Education Progress</h1>
          <p className="mt-3 max-w-3xl text-neutral-300">
            Department-wide view of each member&apos;s Iowa EMS and National Registry continuing education cycles. Select a
            member for a full category breakdown. This is separate from the Personnel Certifications expiration report.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {STATUS_FILTERS.map((option) => (
              <Link
                key={option.key}
                href={option.key === "all" ? "/ems-ce-progress" : `/ems-ce-progress?status=${option.key}`}
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  filter === option.key
                    ? "border-red-500/60 bg-red-500/10 text-red-200"
                    : "border-white/10 bg-neutral-900 text-neutral-300 hover:border-white/30"
                }`}
              >
                {option.label}
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-neutral-900/70">
          {rows.length === 0 ? (
            <p className="p-6 text-neutral-400">No members match this filter.</p>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-xs uppercase tracking-[0.14em] text-neutral-400">
                      <th className="px-6 py-4">Member</th>
                      <th className="px-4 py-4">Iowa EMS</th>
                      <th className="px-4 py-4">Iowa Progress</th>
                      <th className="px-4 py-4">Iowa Expires</th>
                      <th className="px-4 py-4">National Registry</th>
                      <th className="px-4 py-4">NR Progress</th>
                      <th className="px-4 py-4">NR Expires</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.memberId} className="border-b border-white/5 hover:bg-white/5">
                        <td className="px-6 py-3">
                          <Link href={`/ems-ce-progress/${row.memberId}`} className="font-semibold text-white hover:text-red-300">
                            {row.memberName}
                          </Link>
                        </td>
                        {row.hasAnyTracker ? (
                          <>
                            <td className="px-4 py-3"><StatusBadge status={row.emsReadiness.iowa.status} /></td>
                            <td className="px-4 py-3 text-neutral-300">{trackSummaryLine(row.emsReadiness.iowa)}</td>
                            <td className="px-4 py-3 text-neutral-300">{formatDateOnly(row.iowaProfile?.expiration_date ?? null)}</td>
                            <td className="px-4 py-3"><StatusBadge status={row.emsReadiness.nremt.status} /></td>
                            <td className="px-4 py-3 text-neutral-300">{trackSummaryLine(row.emsReadiness.nremt)}</td>
                            <td className="px-4 py-3 text-neutral-300">{formatDateOnly(row.nremtProfile?.expiration_date ?? null)}</td>
                          </>
                        ) : (
                          <td className="px-4 py-3 text-neutral-500" colSpan={6}>No EMS trackers</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="space-y-3 p-4 md:hidden">
                {rows.map((row) => (
                  <Link
                    key={row.memberId}
                    href={`/ems-ce-progress/${row.memberId}`}
                    className="block rounded-xl border border-white/10 bg-[#141414] p-4 hover:border-white/30"
                  >
                    <p className="font-semibold text-white">{row.memberName}</p>
                    {row.hasAnyTracker ? (
                      <div className="mt-3 space-y-2 text-sm text-neutral-300">
                        <div className="flex items-center justify-between gap-2">
                          <span>Iowa EMS</span>
                          <StatusBadge status={row.emsReadiness.iowa.status} />
                        </div>
                        <p className="text-xs text-neutral-400">
                          {trackSummaryLine(row.emsReadiness.iowa)} • Expires {formatDateOnly(row.iowaProfile?.expiration_date ?? null)}
                        </p>
                        <div className="flex items-center justify-between gap-2">
                          <span>National Registry</span>
                          <StatusBadge status={row.emsReadiness.nremt.status} />
                        </div>
                        <p className="text-xs text-neutral-400">
                          {trackSummaryLine(row.emsReadiness.nremt)} • Expires {formatDateOnly(row.nremtProfile?.expiration_date ?? null)}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-neutral-500">No EMS trackers</p>
                    )}
                  </Link>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </PageLayout>
  );
}
