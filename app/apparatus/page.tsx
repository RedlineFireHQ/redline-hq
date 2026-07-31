import Link from "next/link";
import { getApparatus } from "@/lib/database";
import PageLayout from "@/components/layout/PageLayout";
import MetricCard from "@/components/ui/MetricCard";

type ApparatusStatus = "Ready" | "Checks Due" | "Out of Service";

type ApparatusUnit = {
  id: string;
  unit: string;
  status: ApparatusStatus;
  lastInspection: string;
  openDeficiencies: number;
};

function getStatusClasses(status: ApparatusStatus): string {
  if (status === "Ready") {
    return "border-green-500/30 bg-green-500/15 text-green-300";
  }

  if (status === "Checks Due") {
    return "border-amber-500/30 bg-amber-500/15 text-amber-300";
  }

  return "border-red-500/35 bg-red-500/15 text-red-300";
}

export default async function ApparatusPage() {
  const apparatusData = await getApparatus();

  const apparatusUnits: ApparatusUnit[] = apparatusData.map((unit) => {
    const status =
      unit.status === "out_of_service"
        ? "Out of Service"
        : unit.status === "needs_attention"
          ? "Checks Due"
          : "Ready";

    const lastInspection = unit.last_inspection_at
      ? new Date(unit.last_inspection_at).toLocaleDateString("en-US", {
          month: "short",
          day: "2-digit",
          year: "numeric",
        })
      : "N/A";

    const openDeficiencies =
      typeof unit.open_deficiencies_count === "number"
        ? unit.open_deficiencies_count
        : 0;

    return {
      id: String(unit.id),
      unit: unit.name,
      status,
      lastInspection,
      openDeficiencies,
    };
  });

  const totalApparatus = apparatusUnits.length;
  const readyCount = apparatusUnits.filter((unit) => unit.status === "Ready").length;
  const checksDueCount = apparatusUnits.filter(
    (unit) => unit.status === "Checks Due"
  ).length;
  const outOfServiceCount = apparatusUnits.filter(
    (unit) => unit.status === "Out of Service"
  ).length;
  const openDeficienciesCount = apparatusUnits.reduce(
    (total, unit) => total + unit.openDeficiencies,
    0
  );

  return (
    <PageLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-red-500">
              Command Center
            </p>

            <h1 className="mt-2 text-5xl font-black tracking-tight text-white">
              Apparatus
            </h1>

            <p className="mt-3 max-w-2xl text-lg text-neutral-400">
              Fleet readiness built for fireground operations.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <MetricCard
              title="Total Apparatus"
              value={totalApparatus}
            />

            <MetricCard
              title="Ready"
              value={readyCount}
              color="text-green-400"
            />

            <MetricCard
              title="Checks Due"
              value={checksDueCount}
              color="text-amber-400"
            />

            <MetricCard
              title="Open Deficiencies"
              value={openDeficienciesCount}
              color="text-orange-400"
            />

            <MetricCard
              title="Out of Service"
              value={outOfServiceCount}
              color="text-red-500"
            />
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#111111] p-2">
          <p className="px-3 text-sm font-medium text-neutral-400">View</p>

          <div className="inline-flex items-center gap-2">
            <button
              type="button"
              className="rounded-xl border border-red-500/35 bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-300"
            >
              Card View
            </button>

            <button
              type="button"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-neutral-300"
            >
              Table View
            </button>
          </div>
        </div>

        {/* Card View */}
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {apparatusUnits.map((unit) => (
            <Link
              key={unit.id}
              href={`/apparatus/${unit.id}`}
              className="group overflow-hidden rounded-2xl border border-white/10 bg-[#111111] text-left transition-all duration-300 hover:-translate-y-1 hover:border-red-500/40 hover:shadow-[0_18px_45px_rgba(239,43,45,.14)]"
            >
              <div className="relative h-40 w-full border-b border-white/10 bg-gradient-to-br from-[#1a1a1a] via-[#151515] to-[#101010]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_25%,rgba(180,0,0,.14),transparent_60%)]" />

                <div className="absolute left-4 top-4 rounded-full border border-white/15 bg-black/35 px-3 py-1 text-[11px] font-semibold uppercase tracking-[.12em] text-neutral-300">
                  Apparatus Photo
                </div>
              </div>

              <div className="space-y-4 px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-2xl font-black tracking-tight text-white">{unit.unit}</h2>

                  <span
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[.12em] ${getStatusClasses(unit.status)}`}
                  >
                    {unit.status}
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-neutral-500">
                      Last Inspection
                    </p>
                    <p className="mt-1 text-sm font-medium text-white">{unit.lastInspection}</p>
                  </div>

                  <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-neutral-500">
                      Open Deficiencies
                    </p>
                    <p className="mt-1 text-sm font-medium text-white">{unit.openDeficiencies}</p>
                  </div>
                </div>

                <button
                  type="button"
                  className="inline-flex h-[42px] w-full items-center justify-center rounded-xl border border-red-500/40 bg-gradient-to-b from-[#ff3b3b] to-[#b90d0d] px-4 text-sm font-semibold text-white shadow-[0_0_18px_rgba(239,43,45,.30)] transition-all duration-300 hover:shadow-[0_0_26px_rgba(239,43,45,.45)]"
                >
                  Apparatus Check
                </button>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </PageLayout>
  );
}