export default function QuickActions() {
  const actions = [
    "Daily Inspections",
    "Log Training",
    "Add Deficiency",
    "Reports",
    "Inventory",
    "Personnel",
    "Calendar",
    "Documents",
  ];

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 shadow-xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-red-500">
            Quick Actions
          </p>

          <h2 className="mt-3 text-4xl font-bold text-white">
            Shortcuts
          </h2>

          <p className="mt-2 text-sm text-neutral-400">
            One-click access to your most common tasks.
          </p>
        </div>

        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-900/40">
          <div className="text-center">
            <p className="text-lg font-bold text-red-400">8</p>
            <p className="text-[10px] uppercase text-red-300">
              Actions
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        {actions.map((action) => (
          <button
            key={action}
            className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3 text-left text-sm font-medium text-white transition hover:border-red-500 hover:bg-red-600"
          >
            {action}
          </button>
        ))}
      </div>
    </div>
  );
}