import PageLayout from "@/components/layout/PageLayout";
import PerformMaintenanceButton from "@/components/maintenance/PerformMaintenanceButton";
import ApparatusHistoryCards from "@/components/apparatus/ApparatusHistoryCards";
import TaskList from "@/components/ui/TaskList";
import { getCurrentMember } from "@/lib/current-member";
import { getApparatusImagePath } from "@/lib/apparatus-images";
import { getApparatusById } from "@/lib/database";
import { tasks } from "@/lib/tasks";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import Link from "next/link";
import { notFound } from "next/navigation";

type InspectionHistoryRow = {
  id: string;
  created_at: string | null;
  status: string | null;
  notes: string | null;
  member_id: string | null;
};

type InspectionMemberRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  name: string | null;
};

type DeficiencyHistoryRow = {
  id: string;
  reported_at: string | null;
  description: string | null;
  reported_by: string | null;
  priority: string | null;
  status: string | null;
};

type DeficiencyMemberRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  name: string | null;
};

type MaintenanceHistoryRow = {
  id: string;
  maintenance_number: string | null;
  deficiency_id: string | null;
  maintenance_type: string | null;
  completed_by: string | null;
  service_date: string | null;
  description: string | null;
};

interface ApparatusPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ApparatusDetailPage({
  params,
}: ApparatusPageProps) {
  const { id } = await params;

  const truck = await getApparatusById(id);

  if (!truck) {
    notFound();
  }

  const apparatusTasks = tasks.filter(
    (task) => task.apparatusId === truck.id
  );
  const apparatusImageUrl = getApparatusImagePath(truck.name);

  const assignedAssets = [
    {
      id: "asset-holmatro-cutter-32x",
      name: "Holmatro Cutter 32X",
      category: "Rescue Tools",
      location: "Engine 430 - Driver Side Compartment B",
      inspectionStatus: "Current",
      statusClass: "text-green-300",
      lastInspection: "Jul 27, 2026",
    },
    {
      id: "asset-scba-spare-cylinder-rack",
      name: "SCBA Spare Cylinder Rack",
      category: "Air Supply",
      location: "Engine 430 - Crew Cab Rear",
      inspectionStatus: "Due This Week",
      statusClass: "text-amber-300",
      lastInspection: "Jul 22, 2026",
    },
    {
      id: "asset-tft-blitzfire-monitor",
      name: "TFT Blitzfire Monitor",
      category: "Water Flow Equipment",
      location: "Engine 430 - Top Side Tray",
      inspectionStatus: "Needs Attention",
      statusClass: "text-red-300",
      lastInspection: "Jul 10, 2026",
    },
  ];

  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);

  console.log("[apparatus-detail] deficiency history diagnostics", {
    routeApparatusId: id,
    databaseApparatusId: truck.id,
    currentMemberId: currentMember?.id ?? null,
    currentMemberName: currentMember?.name ?? null,
    currentMemberRole: currentMember?.role ?? null,
  });

  const { data: deficiencyMinimalData, error: deficiencyMinimalError } = await supabase
    .from("deficiencies")
    .select("id, apparatus_id, created_at")
    .eq("apparatus_id", truck.id)
    .order("created_at", { ascending: false })
    .limit(10);

  console.log("[apparatus-detail] deficiency minimal query result", {
    error: deficiencyMinimalError ?? null,
    length: deficiencyMinimalData?.length ?? 0,
    firstRecord: deficiencyMinimalData?.[0] ?? null,
  });

  const { data: deficiencyDiagnosticsData, error: deficiencyDiagnosticsError } = await supabase
    .from("deficiencies")
    .select("apparatus_id, department_id, status, priority, description, created_at")
    .eq("apparatus_id", truck.id)
    .order("created_at", { ascending: false })
    .limit(1);

  console.log("[apparatus-detail] deficiency diagnostics query", {
    table: "deficiencies",
    filters: ["apparatus_id = truck.id", "order created_at desc", "limit 1"],
    currentApparatusId: truck.id,
    returnedCount: deficiencyDiagnosticsData?.length ?? 0,
    firstReturnedRecord: deficiencyDiagnosticsData?.[0] ?? null,
    error: deficiencyDiagnosticsError ?? null,
  });

  const { data: newestDeficiencyData, error: newestDeficiencyError } = await supabase
    .from("deficiencies")
    .select("apparatus_id, department_id, status, priority, description, created_at")
    .order("created_at", { ascending: false })
    .limit(1);

  console.log("[apparatus-detail] newest deficiency comparison", {
    newestDeficiency: newestDeficiencyData?.[0] ?? null,
    error: newestDeficiencyError ?? null,
    matchesCurrentApparatus:
      (newestDeficiencyData?.[0] as Record<string, unknown> | undefined)?.apparatus_id === truck.id,
  });

  const { data: inspectionHistoryData } = await supabase
    .from("apparatus_inspections")
    .select("id, created_at, status, notes, member_id")
    .eq("apparatus_id", id)
    .order("created_at", { ascending: false });

  const inspectionHistory = (inspectionHistoryData ?? []) as InspectionHistoryRow[];
  const inspectionMemberIds = Array.from(
    new Set(
      inspectionHistory
        .map((inspection) => inspection.member_id)
        .filter((memberId): memberId is string => Boolean(memberId))
    )
  );

  let inspectionMemberNameById: Record<string, string> = {};

  if (inspectionMemberIds.length > 0) {
    const { data: inspectionMembersData } = await supabase
      .from("members")
      .select("id, first_name, last_name")
      .in("id", inspectionMemberIds);

    inspectionMemberNameById = (inspectionMembersData ?? []).reduce<Record<string, string>>(
      (accumulator, memberRow) => {
        const row = memberRow as Record<string, unknown>;
        const idValue = row.id;
        const memberId = typeof idValue === "string" ? idValue : "";

        if (!memberId) {
          return accumulator;
        }

        const firstName = typeof row.first_name === "string" ? row.first_name : "";
        const lastName = typeof row.last_name === "string" ? row.last_name : "";
        const fullName = `${firstName} ${lastName}`.trim();

        accumulator[memberId] = fullName;
        return accumulator;
      },
      {}
    );
  }

  const { data: deficiencyHistoryData, error: deficiencyHistoryError } = await supabase
    .from("deficiencies")
    .select(
      "id, apparatus_id, department_id, description, reported_at, created_at, reported_by, priority, status"
    )
    .eq("apparatus_id", truck.id)
    .order("created_at", { ascending: false })
    .limit(10);

  console.log("[apparatus-detail] deficiency history query result", {
    error: deficiencyHistoryError ?? null,
    data: deficiencyHistoryData ?? null,
    length: deficiencyHistoryData?.length ?? 0,
    apparatusIdFilter: truck.id,
  });

  const deficiencyHistory = (deficiencyHistoryData ?? []) as DeficiencyHistoryRow[];

  console.log("[apparatus-detail] deficiency history render source", {
    usesVariable: "deficiencyHistory",
    isArray: Array.isArray(deficiencyHistory),
    length: deficiencyHistory.length,
    willRenderEmptyState: deficiencyHistory.length === 0,
    willRenderTable: deficiencyHistory.length > 0,
    firstRecord: deficiencyHistory[0] ?? null,
  });

  const deficiencyPriorityIds = Array.from(
    new Set(
      deficiencyHistory
        .map((deficiency) => deficiency.priority)
        .filter((priorityId): priorityId is string => Boolean(priorityId))
    )
  );
  const deficiencyStatusIds = Array.from(
    new Set(
      deficiencyHistory
        .map((deficiency) => deficiency.status)
        .filter((statusId): statusId is string => Boolean(statusId))
    )
  );

  let deficiencyPriorityNameById: Record<string, string> = {};
  let deficiencyStatusNameById: Record<string, string> = {};

  const { data: maintenanceHistoryData } = await supabase
    .from("maintenance_records")
    .select(
      "id, maintenance_number, deficiency_id, maintenance_type, completed_by, service_date, description"
    )
    .eq("apparatus_id", truck.id)
    .order("service_date", { ascending: false })
    .limit(10);

  const maintenanceHistory = (maintenanceHistoryData ?? []) as MaintenanceHistoryRow[];
  const maintenanceMemberIds = Array.from(
    new Set(
      maintenanceHistory
        .map((maintenance) => maintenance.completed_by)
        .filter((memberId): memberId is string => Boolean(memberId))
    )
  );
  const maintenanceDeficiencyIds = Array.from(
    new Set(
      maintenanceHistory
        .map((maintenance) => maintenance.deficiency_id)
        .filter((deficiencyId): deficiencyId is string => Boolean(deficiencyId))
    )
  );

  let maintenanceMemberNameById: Record<string, string> = {};
  let maintenanceDeficiencyNumberById: Record<string, string> = {};

  if (maintenanceMemberIds.length > 0) {
    const { data: maintenanceMembersData } = await supabase
      .from("members")
      .select("id, first_name, last_name")
      .in("id", maintenanceMemberIds);

    maintenanceMemberNameById = (maintenanceMembersData ?? []).reduce<Record<string, string>>(
      (accumulator, memberRow) => {
        const row = memberRow as Record<string, unknown>;
        const memberId = typeof row.id === "string" ? row.id : "";

        if (!memberId) {
          return accumulator;
        }

        const firstName = typeof row.first_name === "string" ? row.first_name.trim() : "";
        const lastName = typeof row.last_name === "string" ? row.last_name.trim() : "";
        const fullName = `${firstName} ${lastName}`.trim() || memberId;

        accumulator[memberId] = fullName;
        return accumulator;
      },
      {}
    );
  }

  if (maintenanceDeficiencyIds.length > 0) {
    const { data: maintenanceDeficienciesData } = await supabase
      .from("deficiencies")
      .select("id, deficiency_number")
      .in("id", maintenanceDeficiencyIds);

    maintenanceDeficiencyNumberById = (maintenanceDeficienciesData ?? []).reduce<Record<string, string>>(
      (accumulator, deficiencyRow) => {
        const row = deficiencyRow as Record<string, unknown>;
        const deficiencyId = typeof row.id === "string" ? row.id : "";

        if (!deficiencyId) {
          return accumulator;
        }

        const deficiencyNumber =
          typeof row.deficiency_number === "string" && row.deficiency_number.trim()
            ? row.deficiency_number
            : deficiencyId;

        accumulator[deficiencyId] = deficiencyNumber;
        return accumulator;
      },
      {}
    );
  }

  if (deficiencyPriorityIds.length > 0) {
    const { data: deficiencyPriorityRows } = await supabase
      .from("deficiency_priorities")
      .select("id, name")
      .in("id", deficiencyPriorityIds);

    deficiencyPriorityNameById = (deficiencyPriorityRows ?? []).reduce<Record<string, string>>(
      (accumulator, row) => {
        const record = row as Record<string, unknown>;
        const priorityId = typeof record.id === "string" ? record.id : "";
        const priorityName = typeof record.name === "string" ? record.name : "";

        if (!priorityId) {
          return accumulator;
        }

        accumulator[priorityId] = priorityName;
        return accumulator;
      },
      {}
    );
  }

  if (deficiencyStatusIds.length > 0) {
    const { data: deficiencyStatusRows } = await supabase
      .from("deficiency_statuses")
      .select("id, name")
      .in("id", deficiencyStatusIds);

    deficiencyStatusNameById = (deficiencyStatusRows ?? []).reduce<Record<string, string>>(
      (accumulator, row) => {
        const record = row as Record<string, unknown>;
        const statusId = typeof record.id === "string" ? record.id : "";
        const statusName = typeof record.name === "string" ? record.name : "";

        if (!statusId) {
          return accumulator;
        }

        accumulator[statusId] = statusName;
        return accumulator;
      },
      {}
    );
  }

  const latestInspection = inspectionHistory[0] ?? null;
  const currentTimestamp = Date.now();
  const latestInspectionDate = latestInspection?.created_at ? new Date(latestInspection.created_at) : null;
  const hasCurrentInspection =
    latestInspectionDate !== null &&
    !Number.isNaN(latestInspectionDate.getTime()) &&
    currentTimestamp - latestInspectionDate.getTime() <= 24 * 60 * 60 * 1000;

  const openCriticalDeficiencyCount = deficiencyHistory.reduce((count, deficiency) => {
    const priorityName = deficiency.priority
      ? (deficiencyPriorityNameById[deficiency.priority] ?? "").trim().toLowerCase()
      : "";
    const statusName = deficiency.status
      ? (deficiencyStatusNameById[deficiency.status] ?? "").trim().toLowerCase()
      : "";

    const isCriticalPriority = priorityName === "critical" || priorityName === "high";
    const isOpenStatus = statusName !== "closed" && statusName !== "resolved";

    if (isCriticalPriority && isOpenStatus) {
      return count + 1;
    }

    return count;
  }, 0);

  const hasNoCriticalDeficiencies = openCriticalDeficiencyCount === 0;

  const latestMaintenance = maintenanceHistory[0] ?? null;
  const latestMaintenanceDate = latestMaintenance?.service_date ? new Date(latestMaintenance.service_date) : null;
  const hasCurrentMaintenance =
    latestMaintenanceDate !== null &&
    !Number.isNaN(latestMaintenanceDate.getTime()) &&
    currentTimestamp - latestMaintenanceDate.getTime() <= 30 * 24 * 60 * 60 * 1000;

  const pumpTestDueInDays = 18;
  const inventoryItemsExpiringCount = 2;

  const readinessPenalty =
    (hasCurrentInspection ? 0 : 30) +
    (hasNoCriticalDeficiencies ? 0 : 35) +
    (hasCurrentMaintenance ? 0 : 20) +
    (pumpTestDueInDays <= 30 ? 5 : 0) +
    (inventoryItemsExpiringCount > 0 ? 4 : 0);

  const readinessScore = Math.max(0, Math.min(100, 100 - readinessPenalty));

  return (
    <PageLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-red-500">
            Apparatus
          </p>

          <h1 className="mt-2 text-5xl font-black tracking-tight text-white">
            {truck.name}
          </h1>
        </div>

        <div className="grid gap-6 lg:grid-cols-3 lg:items-stretch">
          {/* Apparatus Readiness */}
          <div className="rounded-2xl border border-red-900 bg-[#242424] p-5 lg:col-span-2">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <h2 className="text-2xl font-bold text-white">Apparatus Readiness</h2>

                <ul className="mt-4 space-y-2 text-sm text-neutral-200">
                  <li>
                    {hasCurrentInspection
                      ? "\u2713 Apparatus Check Current"
                      : "\u26A0 Apparatus Check Overdue"}
                  </li>
                  <li>
                    {hasNoCriticalDeficiencies
                      ? "\u2713 No Critical Deficiencies"
                      : `\u26A0 ${openCriticalDeficiencyCount} Critical ${openCriticalDeficiencyCount === 1 ? "Deficiency" : "Deficiencies"} Open`}
                  </li>
                  <li>
                    {hasCurrentMaintenance
                      ? "\u2713 Maintenance Current"
                      : "\u26A0 Maintenance Review Due"}
                  </li>
                  <li>{`\u26A0 Pump Test Due in ${pumpTestDueInDays} Days`}</li>
                  <li>{`\u26A0 ${inventoryItemsExpiringCount} Inventory Items Expiring`}</li>
                </ul>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/apparatus/${truck.id}/daily-check`}
                    className="rounded-lg border border-red-500/30 bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700"
                  >
                    Start Apparatus Check
                  </Link>
                  <Link
                    href={`/deficiencies/report?apparatusId=${truck.id}`}
                    className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
                  >
                    Report Deficiency
                  </Link>
                  <PerformMaintenanceButton
                    apparatusId={truck.id}
                    returnTo={`/apparatus/${id}`}
                  />
                  <Link
                    href={`/apparatus/${truck.id}/information`}
                    className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
                  >
                    Apparatus Information
                  </Link>
                </div>
              </div>


              <div className="w-full max-w-[240px] rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3">
                <p className="text-xs uppercase tracking-[0.15em] text-neutral-500">Readiness Score</p>
                <p className="mt-1 text-4xl font-black text-white">{readinessScore}%</p>

                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-neutral-800">
                  <div
                    className="h-full rounded-full bg-red-500 transition-all"
                    style={{ width: `${readinessScore}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#1a1a1a] via-[#151515] to-[#101010] p-4">
            {apparatusImageUrl ? (
              <div className="flex h-full w-full items-center justify-center">
                <img
  src={apparatusImageUrl}
  alt={truck.name}
  className="h-auto max-h-[320px] w-full object-contain object-center"
  style={{
    position: "relative",
    zIndex: 9999,
    background: "lime",
  }}
/>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-[11px] font-semibold uppercase tracking-[.12em] text-neutral-300">
                Apparatus Photo
              </div>
            )}
            {/* <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_25%,rgba(180,0,0,.14),transparent_60%)]" /> */}
          </div>
        </div>

        <ApparatusHistoryCards
          apparatusName={truck.name}
          inspectionHistory={inspectionHistory}
          inspectionMemberNameById={inspectionMemberNameById}
          deficiencyHistory={deficiencyHistory}
          deficiencyPriorityNameById={deficiencyPriorityNameById}
          deficiencyStatusNameById={deficiencyStatusNameById}
          maintenanceHistory={maintenanceHistory}
          maintenanceMemberNameById={maintenanceMemberNameById}
          maintenanceDeficiencyNumberById={maintenanceDeficiencyNumberById}
        />

        {/* Dashboard */}
        <div className="grid gap-6 lg:grid-cols-3">
          <TaskList
            title="Today's Tasks"
            tasks={apparatusTasks}
          />

          <SectionCard title="Assigned Inventory">
            <div className="mt-1 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] uppercase tracking-[0.12em] text-neutral-500">
                    <th className="px-3 py-2 font-semibold">Inventory Name</th>
                    <th className="px-3 py-2 font-semibold">Category</th>
                    <th className="px-3 py-2 font-semibold">Assigned Location</th>
                    <th className="px-3 py-2 font-semibold">Inspection Status</th>
                    <th className="px-3 py-2 font-semibold">Last Inspection</th>
                  </tr>
                </thead>

                <tbody className="text-neutral-300">
                  {assignedAssets.map((asset, index) => (
                    <tr
                      key={asset.id}
                      className={`${index < assignedAssets.length - 1 ? "border-b border-white/5" : ""} transition-colors hover:bg-white/[0.02]`}
                    >
                      <td className="px-0 py-0">
                        <Link href={`/assets/${asset.id}`} className="block px-3 py-3 text-neutral-300 hover:text-white">
                          {asset.name}
                        </Link>
                      </td>
                      <td className="px-0 py-0">
                        <Link href={`/assets/${asset.id}`} className="block px-3 py-3 text-neutral-300 hover:text-white">
                          {asset.category}
                        </Link>
                      </td>
                      <td className="px-0 py-0">
                        <Link href={`/assets/${asset.id}`} className="block px-3 py-3 text-neutral-300 hover:text-white">
                          {asset.location}
                        </Link>
                      </td>
                      <td className="px-0 py-0">
                        <Link href={`/assets/${asset.id}`} className={`block px-3 py-3 hover:brightness-110 ${asset.statusClass}`}>
                          {asset.inspectionStatus}
                        </Link>
                      </td>
                      <td className="px-0 py-0">
                        <Link href={`/assets/${asset.id}`} className="block px-3 py-3 text-neutral-300 hover:text-white">
                          {asset.lastInspection}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard title="Recent Activity">
            <ul className="space-y-3 text-sm text-neutral-400">
              <li>✓ Monthly check completed</li>
              <li>✓ Pump inspection passed</li>
              <li>✓ Equipment inventory updated</li>
            </ul>
          </SectionCard>
        </div>
      </div>
    </PageLayout>
  );
}

function InfoCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6">
      <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">
        {title}
      </p>

      <p className="mt-3 text-2xl font-bold text-white">
        {value}
      </p>
    </div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6">
      <h2 className="text-lg font-bold text-white">
        {title}
      </h2>

      <div className="mt-5">{children}</div>
    </div>
  );
}