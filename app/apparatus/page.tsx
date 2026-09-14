import { getApparatus, getOpenDeficiencyCountsByApparatusIds } from "@/lib/database";
import { getApparatusImagePath } from "@/lib/apparatus-images";
import { getApparatusReadinessList, getStatusLabelForReadiness } from "@/lib/readiness/apparatus-readiness-data";
import ApparatusViewSwitcher from "../../components/apparatus/ApparatusViewSwitcher";
import AddApparatusButton from "@/components/apparatus/AddApparatusButton";
import PageLayout from "@/components/layout/PageLayout";
import MetricCard from "@/components/ui/MetricCard";
import { getCurrentMember } from "@/lib/current-member";
import { canManageApparatus } from "@/lib/member-permissions";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import Link from "next/link";

type ApparatusStatus = "Ready" | "Checks Due" | "Out of Service" | "Configuration Required";

type ApparatusUnit = {
  id: string;
  name: string;
  type: string;
  status: ApparatusStatus;
  lastInspection: string;
  openDeficiencies: number;
  readiness: string;
  imageUrl: string | null;
};

function normalizeStatusValue(value: unknown): "ready" | "needs_attention" | "out_of_service" | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");

  if (normalized === "out_of_service") {
    return "out_of_service";
  }

  if (normalized === "needs_attention" || normalized === "deficiency") {
    return "needs_attention";
  }

  if (normalized === "ready") {
    return "ready";
  }

  return null;
}

function statusLabelFromLegacyStatus(value: unknown): ApparatusStatus {
  const normalizedStatus = normalizeStatusValue(value) ?? "ready";
  return normalizedStatus === "out_of_service"
    ? "Out of Service"
    : normalizedStatus === "needs_attention"
      ? "Checks Due"
      : "Ready";
}

export default async function ApparatusPage() {
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);
  const canAddApparatus = currentMember?.departmentId
    ? await canManageApparatus(supabase, currentMember.departmentId, currentMember.role)
    : false;
  const departmentCheckDefault = currentMember?.departmentId
    ? await supabase
        .from("apparatus_check_department_defaults")
        .select("interval_days")
        .eq("department_id", currentMember.departmentId)
        .eq("is_active", true)
        .order("effective_start_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const apparatusData = await getApparatus(supabase);
  const apparatusIds = apparatusData.map((unit) => String(unit.id));
  const openDeficiencyCountByApparatusId = await getOpenDeficiencyCountsByApparatusIds(apparatusIds);
  const readinessRows = await getApparatusReadinessList();
  const readinessByApparatusId = readinessRows.reduce<Record<string, (typeof readinessRows)[number]["readiness"]>>(
    (accumulator, row) => {
      accumulator[row.apparatus.id] = row.readiness;
      return accumulator;
    },
    {}
  );

  const apparatusUnits: ApparatusUnit[] = apparatusData.map((unit) => {
    const readiness = readinessByApparatusId[String(unit.id)];
    const status = readiness
      ? getStatusLabelForReadiness(readiness)
      : statusLabelFromLegacyStatus(
          normalizeStatusValue(unit.last_inspection_result) ?? normalizeStatusValue(unit.status)
        );

    const lastInspection = unit.last_inspection_at
      ? new Date(unit.last_inspection_at).toLocaleDateString("en-US", {
          month: "short",
          day: "2-digit",
          year: "numeric",
        })
      : "N/A";

    const openDeficiencies = openDeficiencyCountByApparatusId[String(unit.id)] ?? 0;

    return {
      id: String(unit.id),
      name: unit.name,
      type: unit.type ?? "Unknown",
      status,
      lastInspection,
      openDeficiencies,
      readiness: readiness?.scorePercent === null || readiness?.scorePercent === undefined
        ? "NOT SCORED"
        : `${Math.round(readiness.scorePercent)}%`,
      imageUrl: getApparatusImagePath(unit.name),
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
    <PageLayout
      environmentBackgroundUrl="/branding/images/apparatuspageimage.png"
      environmentBackgroundPosition="left center"
    >
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-red-500">
              Fleet Readiness
            </p>

            <h1
              className="mt-2 text-[2.25rem] font-[700] leading-none tracking-[-0.06em] text-white"
              style={{ fontFamily: '"Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif' }}
            >
              Apparatus
            </h1>

            <p className="mt-3 max-w-2xl text-lg text-neutral-400">
              Fleet readiness built for fireground operations.
            </p>
          </div>

          <div className="flex flex-col items-end gap-3">
            <div className="flex flex-wrap items-center justify-end gap-3">
              <AddApparatusButton
                canAdd={canAddApparatus}
                departmentCheckDefaultIntervalDays={
                  typeof departmentCheckDefault.data?.interval_days === "number"
                    ? departmentCheckDefault.data.interval_days
                    : null
                }
              />
              <Link
                href="/apparatus/pump-test"
                className="inline-flex items-center justify-center rounded-xl border border-red-500/25 bg-red-600/10 px-4 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-600/20"
              >
                Pump Test
              </Link>
              <Link
                href="/apparatus/pump-test-history"
                className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
              >
                Pump Test History
              </Link>
              <Link
                href="/apparatus/archived"
                className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
              >
                View Archived Apparatus
              </Link>
            </div>
            <div className="grid w-full max-w-[860px] grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
              <div className="[transform-origin:center] [transform:scale(0.92)]">
                <MetricCard
                  title="Total Apparatus"
                  value={totalApparatus}
                />
              </div>

            <div className="[transform-origin:center] [transform:scale(0.92)]">
              <MetricCard
                title="Ready"
                value={readyCount}
                color="text-green-400"
              />
            </div>

            <div className="[transform-origin:center] [transform:scale(0.92)]">
              <MetricCard
                title="Checks Due"
                value={checksDueCount}
                color="text-amber-400"
              />
            </div>

            <div className="[transform-origin:center] [transform:scale(0.92)]">
              <MetricCard
                title="Open Deficiencies"
                value={openDeficienciesCount}
                color="text-orange-400"
              />
            </div>

              <div className="[transform-origin:center] [transform:scale(0.92)]">
                <MetricCard
                  title="Out of Service"
                  value={outOfServiceCount}
                  color="text-red-500"
                />
              </div>
            </div>
          </div>
        </div>

        <ApparatusViewSwitcher
          apparatusUnits={apparatusUnits}
        />
      </div>
    </PageLayout>
  );
}