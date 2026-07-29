interface TaskItem {
  id: string;
  title: string;
  status: "pending" | "completed" | "overdue";
  priority: "low" | "medium" | "high";
  due: string;
}

interface TaskListProps {
  title: string;
  tasks: TaskItem[];
}

export default function TaskList({
  title,
  tasks,
}: TaskListProps) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6">
      <h2 className="text-lg font-bold text-white">
        {title}
      </h2>

      <div className="mt-5 space-y-3">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="rounded-lg border border-neutral-800 p-4"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-white">
                {task.title}
              </span>

              <span
                className={`rounded-full px-2 py-1 text-xs font-semibold uppercase ${
                  task.status === "completed"
                    ? "bg-green-600 text-white"
                    : task.status === "overdue"
                    ? "bg-red-600 text-white"
                    : "bg-amber-500 text-black"
                }`}
              >
                {task.status}
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-neutral-400">
                📅 {task.due}
              </span>

              <span
                className={`font-semibold ${
                  task.priority === "high"
                    ? "text-red-400"
                    : task.priority === "medium"
                    ? "text-amber-400"
                    : "text-green-400"
                }`}
              >
                {task.priority.toUpperCase()} PRIORITY
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}