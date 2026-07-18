interface MemberReadinessCardProps {
  score: number;
}

export default function MemberReadinessCard({
  score,
}: MemberReadinessCardProps) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
      <p className="text-sm uppercase tracking-[0.2em] text-red-500">
        Member Readiness™
      </p>

      <div className="mt-4 flex items-end gap-2">
        <span className="text-6xl font-bold">{score}%</span>
      </div>

      <p className="mt-2 text-2xl font-semibold text-green-400">
        READY FOR RESPONSE
      </p>

      <div className="mt-6 space-y-4">
        <div>
          <div className="mb-1 flex justify-between text-sm">
            <span>Training</span>
            <span>95%</span>
          </div>

          <div className="h-2 rounded-full bg-neutral-800">
            <div
              className="h-2 rounded-full bg-green-500"
              style={{ width: "95%" }}
            />
          </div>
        </div>

        <div>
          <div className="mb-1 flex justify-between text-sm">
            <span>Certifications</span>
            <span>100%</span>
          </div>

          <div className="h-2 rounded-full bg-neutral-800">
            <div
              className="h-2 rounded-full bg-green-500"
              style={{ width: "100%" }}
            />
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-yellow-600/30 bg-yellow-500/10 p-4">
          <p className="font-semibold text-yellow-300">
            Readiness Coach™
          </p>

          <p className="mt-2 text-sm text-neutral-300">
            Complete Driver Operator training to increase your readiness by 2%.
          </p>
        </div>
      </div>
    </div>
  );
}