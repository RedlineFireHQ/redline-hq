import PageLayout from "../components/layout/PageLayout";
import ReadinessCard from "../components/command-center/ReadinessCard";

import { department } from "../lib/department";
import { apparatus } from "../lib/apparatus";
import { members } from "../lib/members";
import { tasks } from "../lib/tasks";

export default function Home() {
  const activeMembers = members.filter((member) => member.active).length;

  const pendingTasks = tasks.filter(
    (task) => task.status === "pending"
  );

  return (
    <PageLayout>
      <div className="space-y-8">
        <ReadinessCard />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
            <p className="text-sm uppercase tracking-wide text-neutral-500">
              Department
            </p>

            <h2 className="mt-2 text-2xl font-bold text-white">
              {department.name}
            </h2>

            <p className="mt-2 text-neutral-400">
              {department.type.charAt(0).toUpperCase() +
                department.type.slice(1)}{" "}
              Department
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
            <p className="text-sm uppercase tracking-wide text-neutral-500">
              Apparatus
            </p>

            <h2 className="mt-2 text-4xl font-bold text-white">
              {apparatus.length}
            </h2>

            <p className="mt-2 text-neutral-400">
              Vehicles in Fleet
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
            <p className="text-sm uppercase tracking-wide text-neutral-500">
              Active Members
            </p>

            <h2 className="mt-2 text-4xl font-bold text-white">
              {activeMembers}
            </h2>

            <p className="mt-2 text-neutral-400">
              Members Currently Active
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
          <h2 className="text-2xl font-semibold text-white">
            Today's Operations
          </h2>

          <div className="mt-6 space-y-4">
            {pendingTasks.map((task) => (
              <div
                key={task.id}
                className="rounded-lg border border-neutral-800 bg-neutral-900 p-4"
              >
                <div className="font-semibold text-white">
                  {task.title}
                </div>

                <div className="mt-1 text-sm text-neutral-400">
                  {task.assignedApparatus ??
                    task.assignedMemberId ??
                    "Department"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}