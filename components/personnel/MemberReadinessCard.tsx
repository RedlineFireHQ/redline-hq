type ReadinessCoachAction = {
  id: string;
  title: string;
  needsAttention: string;
  action: string;
  impactPercent: number | null;
};

interface MemberReadinessCardProps {
  score: number | null;
  message: string;
  coachActions: ReadinessCoachAction[];
}

export default function MemberReadinessCard({
  score,
  message,
  coachActions,
}: MemberReadinessCardProps) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 lg:p-6">
      <div className="grid gap-5 lg:grid-cols-[minmax(220px,320px)_1fr] lg:items-start">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-red-500">
            Redline Ready™
          </p>

          <div className="mt-3 flex items-end gap-2">
            <span className="text-5xl font-bold leading-none lg:text-6xl">{score === null ? "--" : `${Math.round(score)}%`}</span>
          </div>

          <p className="mt-3 text-sm text-neutral-300 lg:max-w-[24ch]">{message}</p>
        </div>

        <div className="rounded-lg border border-yellow-600/30 bg-yellow-500/10 p-4 lg:p-5">
          <p className="font-semibold text-yellow-300">
            Readiness Coach™
          </p>

          {coachActions.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-300">
              All configured readiness factors are complete.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {coachActions.map((item) => (
                <div key={item.id} className="rounded-md border border-white/10 bg-black/20 p-3">
                  <p className="text-sm font-semibold text-white">{item.title}</p>

                  <p className="mt-2 text-sm text-neutral-200">
                    <span className="font-medium text-neutral-100">Needs attention:</span> {item.needsAttention}
                  </p>

                  <p className="mt-1 text-sm text-neutral-200">
                    <span className="font-medium text-neutral-100">Action:</span> {item.action}
                  </p>

                  {item.impactPercent !== null ? (
                    <p className="mt-2 text-xs uppercase tracking-[0.12em] text-yellow-200">
                      Potential readiness gain: +{item.impactPercent.toFixed(1)}%
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}