export default function TodaysMission() {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-red-500">
            Today's Mission
          </p>

          <h2 className="mt-3 text-4xl font-bold text-white">
            Focus Areas
          </h2>

          <p className="mt-2 text-sm text-neutral-400">
            Highest priority items for today.
          </p>
        </div>

        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-900/40">
          <div className="text-center">
            <p className="text-lg font-bold text-red-400">4</p>
            <p className="text-[10px] uppercase text-red-300">
              Items
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border border-red-900 bg-red-950/30 p-4">
          <div className="flex gap-3">
            <div className="mt-2 h-3 w-3 rounded-full bg-red-500" />

            <div>
              <p className="font-semibold text-white">
                Engine 430 Inspection Overdue
              </p>

              <p className="text-sm text-neutral-400">
                Complete today's inspection.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-yellow-800 bg-yellow-950/20 p-4">
          <div className="flex gap-3">
            <div className="mt-2 h-3 w-3 rounded-full bg-yellow-400" />

            <div>
              <p className="font-semibold text-white">
                EMS Training Needed
              </p>

              <p className="text-sm text-neutral-400">
                Four members remaining.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-4">
          <div className="flex gap-3">
            <div className="mt-2 h-3 w-3 rounded-full bg-neutral-500" />

            <div>
              <p className="font-semibold text-white">
                Inventory Audit
              </p>

              <p className="text-sm text-neutral-400">
                Due in three days.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}