import { getApparatus, getOpenDeficiencyCountsByApparatusIds } from "@/lib/database";
import { getApparatusImagePath } from "@/lib/apparatus-images";
import ApparatusViewSwitcher from "../../components/apparatus/ApparatusViewSwitcher";
import PageLayout from "@/components/layout/PageLayout";
import MetricCard from "@/components/ui/MetricCard";

type ApparatusStatus = "Ready" | "Checks Due" | "Out of Service";

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

export default async function ApparatusPage() {
  const apparatusData = await getApparatus();
  const apparatusIds = apparatusData.map((unit) => String(unit.id));
  const openDeficiencyCountByApparatusId = await getOpenDeficiencyCountsByApparatusIds(apparatusIds);

  const apparatusUnits: ApparatusUnit[] = apparatusData.map((unit) => {
    const normalizedStatus =
      normalizeStatusValue(unit.last_inspection_result) ??
      normalizeStatusValue(unit.status) ??
      "ready";
    const status =
      normalizedStatus === "out_of_service"
        ? "Out of Service"
        : normalizedStatus === "needs_attention"
          ? "Checks Due"
          : "Ready";

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
      readiness: status,
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

        <ApparatusViewSwitcher
          apparatusUnits={apparatusUnits}
        />
      </div>
    </PageLayout>
  );
}