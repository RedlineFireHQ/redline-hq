export default function DepartmentAlerts() {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-red-500">
            Department Alerts
          </p>

          <h2 className="mt-3 text-3xl font-bold text-white">
            Attention Needed
          </h2>

          <p className="mt-2 text-sm text-neutral-400">
            Current department alerts.
          </p>
        </div>

        <div className="rounded-full bg-red-900/40 px-4 py-2">
          <span className="text-sm font-semibold text-red-300">
            4 Alerts
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border border-red-900 bg-red-950/30 px-4 py-3">
          <p className="text-xs uppercase tracking-widest text-red-400">
            Critical
          </p>

          <p className="mt-1 font-semibold text-white">
            3 Certifications Expire This Month
          </p>
        </div>

        <div className="rounded-xl border border-yellow-700 bg-yellow-950/20 px-4 py-3">
          <p className="text-xs uppercase tracking-widest text-yellow-400">
            Maintenance
          </p>

          <p className="mt-1 font-semibold text-white">
            Engine 432 Service Due
          </p>
        </div>

        <div className="rounded-xl border border-blue-700 bg-blue-950/20 px-4 py-3">
          <p className="text-xs uppercase tracking-widest text-blue-400">
            Reminder
          </p>

          <p className="mt-1 font-semibold text-white">
            Monthly Safety Meeting Tomorrow
          </p>
        </div>
      </div>
    </div>
  );
}