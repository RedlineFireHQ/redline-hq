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

        {/* Status Cards */}
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <InfoCard
            title="Status"
            value={truck.inService ? "In Service" : "Out of Service"}
          />

          <InfoCard
            title="Check Frequency"
            value={truck.checkFrequency ?? "Not Set"}
          />

          <InfoCard
            title="Maintenance"
            value="Current"
          />

          <InfoCard
            title="Monthly Check"
            value="Due Soon"
          />
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

          <SectionCard title="Assigned Members">
            <p className="text-neutral-300">
              2 firefighters assigned
            </p>

            <ul className="mt-4 space-y-2 text-sm text-neutral-400">
              <li>• Captain Smith</li>
              <li>• FF Johnson</li>
            </ul>
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