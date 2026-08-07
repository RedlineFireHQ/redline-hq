import SectionHeader from "./SectionHeader";

const tasks = [
  {
    title: "Complete Engine 430 Apparatus Check",
    due: "Due Today",
    priority: "HIGH",
    completed: false,
  },
  {
    title: "Review Last Night's Training",
    due: "Today",
    priority: "MEDIUM",
    completed: false,
  },
  {
    title: "Approve New Firefighter",
    due: "Pending",
    priority: "LOW",
    completed: false,
  },
  {
    title: "Order EMS Supplies",
    due: "Completed",
    priority: "DONE",
    completed: true,
  },
];

export default function MyTasks() {
  return (
    <section className="overflow-hidden rounded-3xl border border-zinc-800 bg-[#111111]">
      <SectionHeader
        eyebrow="Assignments"
        title="My Tasks"
        subtitle="Your current responsibilities"
      />

      <div className="space-y-4 p-6">
        {tasks.map((task) => (
          <div
            key={task.title}
            className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-[#171717] p-5 transition hover:border-red-500/40"
          >
            <div className="flex items-center gap-4">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-sm font-bold ${
                  task.completed
                    ? "border-green-500 bg-green-500 text-white"
                    : "border-zinc-600"
                }`}
              >
                {task.completed ? "✓" : ""}
              </div>

              <div>
                <h3 className="text-lg font-bold text-white">
                  {task.title}
                </h3>

                <div className="mt-2 flex items-center gap-3">
                  <span className="text-sm text-zinc-500">
                    {task.due}
                  </span>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold tracking-[0.2em] ${
                      task.priority === "HIGH"
                        ? "bg-red-500/15 text-red-400"
                        : task.priority === "MEDIUM"
                        ? "bg-amber-500/15 text-amber-400"
                        : task.priority === "LOW"
                        ? "bg-blue-500/15 text-blue-400"
                        : "bg-green-500/15 text-green-400"
                    }`}
                  >
                    {task.priority}
                  </span>
                </div>
              </div>
            </div>

            <button className="rounded-xl border border-zinc-700 px-5 py-2 font-semibold text-white transition hover:border-red-500 hover:text-red-400">
              Open
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}