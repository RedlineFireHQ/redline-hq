import PageLayout from "@/components/layout/PageLayout";
import TaskList from "@/components/ui/TaskList";
import { getApparatusById } from "@/lib/database";
import { tasks } from "@/lib/tasks";
import Link from "next/link";
import { notFound } from "next/navigation";

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

  const statusValue =
    truck.status === "out_of_service"
      ? "Out of Service"
      : truck.status === "needs_attention"
        ? "Needs Attention"
        : truck.inService === false
          ? "Out of Service"
          : "In Service";

  const checkFrequencyValue =
    truck.check_frequency ?? truck.checkFrequency ?? "Not Set";

  const departmentValue =
    truck.department_name ??
    truck.department?.name ??
    truck.department_id ??
    "Not Set";

  const lastInspectionValue = truck.last_inspection_at
    ? new Date(truck.last_inspection_at).toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      })
    : "Not Set";

  const quickFacts = [
    { label: "Status", value: statusValue },
    { label: "Type", value: truck.type ?? "Not Set" },
    { label: "Check Frequency", value: checkFrequencyValue },
    { label: "Department", value: departmentValue },
    { label: "Last Inspection", value: lastInspectionValue },
    { label: "Year", value: truck.year ?? "Not Set" },
    { label: "Make", value: truck.make ?? "Not Set" },
    { label: "Model", value: truck.model ?? "Not Set" },
    { label: "VIN", value: truck.vin ?? "Not Set" },
    {
      label: "Pump Capacity (GPM)",
      value: truck.pump_capacity ?? truck.pumpCapacity ?? "Not Set",
    },
    {
      label: "Water Tank Capacity (Gallons)",
      value:
        truck.water_tank_capacity ??
        truck.waterTankCapacity ??
        "Not Set",
    },
    { label: "Mileage", value: truck.mileage ?? "Not Set" },
    {
      label: "Engine Hours",
      value: truck.engine_hours ?? truck.engineHours ?? "Not Set",
    },
  ];

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

          <p className="mt-3 text-lg capitalize text-neutral-400">
            {truck.type}
          </p>
        </div>

        {/* Quick Facts */}
        <div className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6">
          <h2 className="text-lg font-bold text-white">Quick Facts</h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {quickFacts.map((fact) => (
              <div
                key={fact.label}
                className="rounded-xl border border-white/10 bg-[#242424] p-4"
              >
                <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">
                  {fact.label}
                </p>

                <p className="mt-2 text-lg font-semibold text-white">{fact.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Readiness Decision */}
        <div className="rounded-2xl border border-red-900 bg-[#242424] p-8">
          <h2 className="text-3xl font-bold text-white">
            Apparatus Readiness
          </h2>

          <p className="mt-2 text-neutral-400">
            Select the operational status after completing today's inspection.
          </p>

          <div className="mt-8 space-y-5">
            <ReadinessCard
              color="green"
              title="Ready for Service"
              description="Inspection completed. Apparatus is ready for emergency response."
              buttonText="Select"
            />

            <ReadinessCard
              color="yellow"
              title="Needs Attention"
              description="Minor deficiency reported. Apparatus remains in service and responsible personnel will be notified."
              buttonText="Report Deficiency"
            />

            <ReadinessCard
              color="red"
              title="Out of Service"
              description="Major deficiency discovered. Apparatus is unavailable until repaired."
              buttonText="Take Out of Service"
            />
          </div>
        </div>

        {/* Start Inspection */}
        <div className="rounded-2xl border border-red-900 bg-gradient-to-r from-red-950 to-neutral-900 p-8">
          <h2 className="text-2xl font-bold text-white">
            Daily Apparatus Check
          </h2>

          <p className="mt-2 text-neutral-300">
            Complete today's inspection for {truck.name}.
          </p>

          <Link
            href={`/apparatus/${truck.id}/daily-check`}
            className="mt-6 inline-flex rounded-xl bg-red-600 px-8 py-4 text-lg font-bold text-white transition hover:bg-red-700"
          >
            Start Daily Check
          </Link>
        </div>

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

function ReadinessCard({
  color,
  title,
  description,
  buttonText,
}: {
  color: "green" | "yellow" | "red";
  title: string;
  description: string;
  buttonText: string;
}) {
  const colors = {
    green: {
      border: "border-green-700",
      button: "bg-green-600 hover:bg-green-700",
      icon: "🟢",
    },
    yellow: {
      border: "border-yellow-600",
      button: "bg-yellow-500 hover:bg-yellow-600 text-black",
      icon: "🟡",
    },
    red: {
      border: "border-red-700",
      button: "bg-red-600 hover:bg-red-700",
      icon: "🔴",
    },
  };

  const c = colors[color];

  return (
    <div className={`rounded-xl border ${c.border} p-6`}>
      <div className="flex items-start justify-between gap-6">
        <div>
          <h3 className="text-2xl font-bold text-white">
            {c.icon} {title}
          </h3>

          <p className="mt-3 max-w-2xl text-neutral-300">
            {description}
          </p>
        </div>

        <button
          className={`rounded-xl px-6 py-3 font-bold transition ${c.button}`}
        >
          {buttonText}
        </button>
      </div>
    </div>
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