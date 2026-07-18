export default function ReadinessCard() {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-8 shadow-xl">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm uppercase tracking-widest text-red-500">
            Redline Readiness™
          </p>

          <h2 className="mt-3 text-6xl font-bold text-white">
            91%
          </h2>

          <p className="mt-2 text-xl font-semibold text-green-400">
            REDLINE READY
          </p>

          <p className="mt-4 max-w-sm text-neutral-400">
            Your department is operating at a high level of readiness.
            Training completion is currently the biggest opportunity for improvement.
          </p>

          <button className="mt-8 rounded-lg border border-red-600 px-5 py-3 font-medium text-white transition hover:bg-red-600">
            View Readiness Breakdown
          </button>
        </div>

        <div className="flex h-56 w-56 items-center justify-center rounded-full border-[14px] border-red-600">
          <div className="text-center">
            <p className="text-6xl font-bold text-white">
              91%
            </p>

            <p className="mt-2 text-sm uppercase tracking-wider text-neutral-400">
              READY
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}