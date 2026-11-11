import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import PageLayout from "@/components/layout/PageLayout";
import EmsContinuingEducationSection from "@/components/ems/EmsContinuingEducationSection";
import { canViewEmsCeProgress, loadDepartmentEmsProgressRows } from "@/lib/ems/department-ems-progress-data";
import { formatEmsLevelLabel, formatEmsTopicLabel } from "@/lib/ems/requirements";
import { getCurrentMember } from "@/lib/current-member";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { EmsTrackProfileAuthorityRow } from "@/lib/ems/authoritative-certifications";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatDateOnly(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

type TopicProgressRow = { topic: string; required: number; completed: number; remaining: number };

function CategoryBreakdown({
  title,
  profile,
  status,
  cycleStartDate,
  topics,
  totals,
}: {
  title: string;
  profile: EmsTrackProfileAuthorityRow | null;
  status: string;
  cycleStartDate: string | null;
  topics: TopicProgressRow[];
  totals: { required: number; completed: number; remaining: number };
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#141414] p-5">
      <h3 className="text-lg font-semibold text-white">{title} — Category Breakdown</h3>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-neutral-300 sm:grid-cols-4">
        <div>
          <dt className="text-xs uppercase tracking-[0.12em] text-neutral-500">Level</dt>
          <dd>{profile ? formatEmsLevelLabel(profile.certification_level) : "-"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.12em] text-neutral-500">Number</dt>
          <dd>{profile?.certification_number || "-"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.12em] text-neutral-500">Issue/Renewal</dt>
          <dd>{formatDateOnly(cycleStartDate ?? profile?.effective_start_date)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.12em] text-neutral-500">Expires</dt>
          <dd>{formatDateOnly(profile?.expiration_date)}</dd>
        </div>
      </dl>

      {status === "not_configured" || status === "not_maintained" ? (
        <p className="mt-4 text-sm text-neutral-400">
          {status === "not_maintained"
            ? "This track is not maintained."
            : "This tracker has not been set up, so category progress cannot be calculated."}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-[0.14em] text-neutral-400">
                <th className="py-2 pr-4">Category</th>
                <th className="py-2 pr-4">Required</th>
                <th className="py-2 pr-4">Completed</th>
                <th className="py-2">Remaining</th>
              </tr>
            </thead>
            <tbody>
              {topics.map((topic) => (
                <tr key={topic.topic} className="border-b border-white/5 text-neutral-300">
                  <td className="py-2 pr-4">{formatEmsTopicLabel(topic.topic)}</td>
                  <td className="py-2 pr-4">{topic.required.toFixed(2)}</td>
                  <td className="py-2 pr-4">{topic.completed.toFixed(2)}</td>
                  <td className="py-2">{topic.remaining.toFixed(2)}</td>
                </tr>
              ))}
              <tr className="font-semibold text-white">
                <td className="py-2 pr-4">Total</td>
                <td className="py-2 pr-4">{totals.required.toFixed(2)}</td>
                <td className="py-2 pr-4">{totals.completed.toFixed(2)}</td>
                <td className="py-2">{totals.remaining.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default async function EmsCeProgressMemberPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
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

  const { memberId } = await params;
  // Department-bound query: a member id from another department returns no rows.
  const rows = await loadDepartmentEmsProgressRows({ departmentId: currentMember.departmentId, memberId });
  const row = rows[0];

  if (!row) {
    notFound();
  }

  const { emsReadiness } = row;

  return (
    <PageLayout>
      <div className="space-y-6">
        <section className="rounded-2xl border border-white/10 bg-[#0b0b0b] p-6">
          <Link href="/ems-ce-progress" className="text-sm text-neutral-400 hover:text-white">
            ← EMS Continuing Education Progress
          </Link>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-white">{row.memberName}</h1>
          <p className="mt-2 text-neutral-300">
            Iowa EMS and National Registry are tracked independently, each against its own certification cycle. Only
            training inside the active cycle counts.
          </p>
          <p className="mt-2 text-sm text-neutral-500">
            <Link href={`/personnel/${row.memberId}`} className="underline hover:text-neutral-300">
              Open Personnel profile
            </Link>
            {" "}to manage this member&apos;s trackers.
          </p>
        </section>

        <EmsContinuingEducationSection
          emsRecordsCounted={row.progress.emsTrainingRecords.length}
          iowaProfile={row.iowaProfile}
          nremtProfile={row.nremtProfile}
          emsReadiness={emsReadiness}
          warnings={row.progress.visibleWarnings}
          unclassifiedCount={row.progress.unclassifiedRecordIds.length}
          emptyMessage="This member has no EMS certification trackers. An authorized member can set them up from the Personnel profile."
        />

        {row.hasAnyTracker ? (
          <div className="grid gap-5 lg:grid-cols-2">
            <CategoryBreakdown
              title="Iowa EMS"
              profile={row.iowaProfile}
              status={emsReadiness.iowa.status}
              cycleStartDate={emsReadiness.iowa.cycleStartDate}
              topics={emsReadiness.iowa.topics}
              totals={{
                required: emsReadiness.iowa.totalRequired,
                completed: emsReadiness.iowa.totalCompleted,
                remaining: emsReadiness.iowa.totalRemaining,
              }}
            />
            <CategoryBreakdown
              title="National Registry"
              profile={row.nremtProfile}
              status={emsReadiness.nremt.status}
              cycleStartDate={emsReadiness.nremt.cycleStartDate}
              topics={emsReadiness.nremt.nationalTopics}
              totals={{
                required: emsReadiness.nremt.totalRequired,
                completed: emsReadiness.nremt.totalCompleted,
                remaining: emsReadiness.nremt.totalRemaining,
              }}
            />
          </div>
        ) : null}
      </div>
    </PageLayout>
  );
}
