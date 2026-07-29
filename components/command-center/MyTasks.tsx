export default function MyTasks() {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-red-500">
            My Tasks
          </p>

          <h2 className="mt-3 text-3xl font-bold text-white">
            Assigned To You
          </h2>

          <p className="mt-2 text-sm text-neutral-400">
            Tasks requiring your attention.
          </p>
        </div>

        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-900/40">
          <div className="text-center">
            <p className="text-lg font-bold text-red-400">4</p>
            <p className="text-[10px] uppercase text-red-300">
              Open
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-xl bg-neutral-900 p-4">
          <div className="h-3 w-3 rounded-full bg-red-500" />

          <div className="flex-1">
            <p className="font-semibold text-white">
              Complete Engine 430 Inspection
            </p>

            <p className="text-sm text-neutral-400">
              High Priority
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl bg-neutral-900 p-4">
          <div className="h-3 w-3 rounded-full bg-yellow-400" />

          <div className="flex-1">
            <p className="font-semibold text-white">
              Approve July Training Hours
            </p>

            <p className="text-sm text-neutral-400">
              Medium Priority
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl bg-neutral-900 p-4">
          <div className="h-3 w-3 rounded-full bg-yellow-400" />

          <div className="flex-1">
            <p className="font-semibold text-white">
              Review Inventory Request
            </p>

            <p className="text-sm text-neutral-400">
              Medium Priority
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}