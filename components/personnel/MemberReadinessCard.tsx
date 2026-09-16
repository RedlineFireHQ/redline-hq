import Link from "next/link";
import type { FormattedCoachAction } from "@/lib/readiness/authoritative-member-readiness";

interface MemberReadinessCardProps {
  score: number | null;
  message: string;
  coachActions: FormattedCoachAction[];
  coachSummary?: {
    label: string;
    sentence: string;
  } | null;
}

export default function MemberReadinessCard({
  score,
  message,
  coachActions,
  coachSummary,
}: MemberReadinessCardProps) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 lg:p-6">
      <div className="grid gap-5 lg:grid-cols-[minmax(220px,320px)_1fr] lg:items-start">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-red-500">
            Redline Ready™
          </p>

          <div className="mt-3 flex items-end gap-2">
            <span className="text-5xl font-bold leading-none lg:text-6xl">
              {score === null ? "--" : `${Math.round(score)}%`}
            </span>
          </div>

          <p className="mt-3 text-sm text-neutral-300 lg:max-w-[24ch]">{message}</p>
        </div>

        <div className="rounded-lg border border-yellow-600/30 bg-yellow-500/10 p-4 lg:p-5">
          <p className="font-semibold text-yellow-300">
            Readiness Coach™
          </p>

          {coachActions.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-300">
              {coachSummary?.sentence ?? "You're on track. Keep up your current training pace."}
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {coachActions.map((item) => (
                <div key={item.id} className="rounded-md border border-white/10 bg-black/20 p-3.5">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-yellow-300">
                    {item.categoryLabel}
                  </p>

                  <p className="mt-1.5 text-sm font-medium text-white">
                    {item.actionText}
                  </p>

                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                    {item.gainLabel ? (
                      <span className="inline-flex items-center rounded bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-300">
                        {item.gainLabel}
                      </span>
                    ) : <span />}

                    <Link
                      href={item.href}
                      className="inline-flex items-center text-xs font-semibold text-yellow-300 hover:text-yellow-200 underline underline-offset-4"
                    >
                      {item.actionButtonLabel}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}