import { redirect } from "next/navigation";
import PageLayout from "@/components/layout/PageLayout";
import { getDepartmentReadinessDataForCurrentMember } from "@/lib/readiness/department-readiness";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatPercent(value: number | null) {
  if (value === null) {
    return "--";
  }

  return `${value.toFixed(2)}%`;
}

function formatImpact(value: number | null) {
  if (value === null) {
    return "Impact not currently calculable";
  }

  return `+${value.toFixed(2)}% Department Readiness`;
}

export default async function DepartmentReadinessPage() {
  const readinessData = await getDepartmentReadinessDataForCurrentMember();

  if (!readinessData?.currentMember?.departmentId) {
    redirect("/login");
  }

  const { currentMember, result } = readinessData;

  return (
    <PageLayout>
      <div className="space-y-6">
        <section className="rounded-2xl border border-white/10 bg-[#0b0b0b] p-6 shadow-[0_20px_60px_rgba(0,0,0,.45)]">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-red-500">Command Center</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-white">Department Readiness</h1>
          <p className="mt-3 max-w-3xl whitespace-pre-line text-neutral-300">{result.statusMessage}</p>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-[#121212] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-neutral-400">Department</p>
              <p className="mt-2 text-3xl font-black text-white">{formatPercent(result.departmentScore)}</p>
            </div>

            <div className="rounded-xl border border-white/10 bg-[#121212] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-neutral-400">Personnel Readiness</p>
              <p className="mt-2 text-3xl font-black text-white">{formatPercent(result.personnelScore)}</p>
            </div>

            <div className="rounded-xl border border-white/10 bg-[#121212] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-neutral-400">Apparatus Readiness</p>
              <p className="mt-2 text-3xl font-black text-white">{formatPercent(result.apparatusScore)}</p>
            </div>

            <div className="rounded-xl border border-white/10 bg-[#121212] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-neutral-400">Scored Members</p>
              <p className="mt-2 text-3xl font-black text-white">{result.scoredMemberCount}</p>
              <p className="mt-1 text-sm text-neutral-400">{result.scoredMembersLabel}</p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {result.participationLimitation}
          </div>

        </section>

        <section className="rounded-2xl border border-white/10 bg-[#0b0b0b] p-6 shadow-[0_20px_60px_rgba(0,0,0,.45)]">
          <h2 className="text-2xl font-black uppercase tracking-[0.08em] text-white">REDLINE READINESS COACH™</h2>
          <p className="mt-2 text-neutral-400">
            {currentMember.role === "firefighter"
              ? "Actions you can take right now to improve department readiness."
              : "Top department-level actions ranked by potential readiness improvement."}
          </p>

          <div className="mt-6 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-red-400">Top 5 Actions</h3>
            {result.topCoachActions.length === 0 ? (
              <p className="rounded-xl border border-white/10 bg-[#121212] p-4 text-sm text-neutral-300">
                No actionable readiness gaps are currently available for your role.
              </p>
            ) : (
              result.topCoachActions.map((action) => (
                <a
                  key={action.id}
                  href={action.href}
                  className="block rounded-xl border border-white/10 bg-[#121212] p-4 transition hover:border-red-500/50"
                >
                  <p className="text-sm uppercase tracking-[0.14em] text-red-400">{action.category}</p>
                  <p className="mt-1 text-lg font-semibold text-white">{action.title}</p>
                  <p className="mt-2 text-sm text-neutral-300">{action.description}</p>
                  <p className="mt-3 text-sm font-semibold text-emerald-300">{formatImpact(action.potentialDepartmentImpactPercent)}</p>
                </a>
              ))
            )}
          </div>

          <div className="mt-8">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-300">All Other Actions</h3>
            <div className="mt-3 max-h-[340px] space-y-3 overflow-y-auto pr-2">
              {result.remainingCoachActions.length === 0 ? (
                <p className="rounded-xl border border-white/10 bg-[#121212] p-4 text-sm text-neutral-400">
                  No additional actions.
                </p>
              ) : (
                result.remainingCoachActions.map((action) => (
                  <a
                    key={action.id}
                    href={action.href}
                    className="block rounded-xl border border-white/10 bg-[#121212] p-4 transition hover:border-red-500/40"
                  >
                    <p className="text-base font-semibold text-white">{action.title}</p>
                    <p className="mt-1 text-sm text-neutral-300">{action.description}</p>
                    <p className="mt-2 text-sm text-emerald-300">{formatImpact(action.potentialDepartmentImpactPercent)}</p>
                  </a>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </PageLayout>
  );
}
