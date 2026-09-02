interface MemberReadinessCardProps {
  score: number | null;
  message: string;
  coachMessage: string | null;
}

export default function MemberReadinessCard({
  score,
  message,
  coachMessage,
}: MemberReadinessCardProps) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
      <p className="text-sm uppercase tracking-[0.2em] text-red-500">
        Redline Ready™
      </p>

      <div className="mt-3 flex items-end gap-2">
        <span className="text-5xl font-bold">{score === null ? "--" : `${Math.round(score)}%`}</span>
      </div>

      <p className="mt-2 text-sm text-neutral-300">{message}</p>

      <div className="mt-4">
        <div className="rounded-lg border border-yellow-600/30 bg-yellow-500/10 p-4">
          <p className="font-semibold text-yellow-300">
            Readiness Coach™
          </p>

          <p className="mt-2 text-sm text-neutral-300">
            {coachMessage ?? "All configured readiness factors are complete."}
          </p>
        </div>
      </div>
    </div>
  );
}