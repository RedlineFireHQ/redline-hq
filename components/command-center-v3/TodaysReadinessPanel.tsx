import Image from "next/image";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { getApparatusReadinessList, getStatusLabelForReadinessRow } from "@/lib/readiness/apparatus-readiness-data";

export default async function TodaysReadinessPanel() {
  const readinessRows = await getApparatusReadinessList();
  const scoreRows = readinessRows
    .filter((row) => row.readinessState === "evaluated")
    .map((row) => row.readiness.scorePercent)
    .filter((score): score is number => typeof score === "number");
  const readinessScore =
    scoreRows.length > 0
      ? Math.round(scoreRows.reduce((total, score) => total + score, 0) / scoreRows.length)
      : null;
  const outOfServiceCount = readinessRows.filter(
    (row) => getStatusLabelForReadinessRow(row) === "Out of Service"
  ).length;
  const checksDueCount = readinessRows.filter(
    (row) => getStatusLabelForReadinessRow(row) === "Checks Due"
  ).length;
  const configurationRequiredCount = readinessRows.filter(
    (row) => getStatusLabelForReadinessRow(row) === "Configuration Required"
  ).length;
  const unavailableCount = readinessRows.filter(
    (row) => getStatusLabelForReadinessRow(row) === "Readiness Unavailable"
  ).length;

  const largestGapCandidate = readinessRows
    .filter((row) => row.readinessState === "evaluated" && row.readiness.scorePercent !== null)
    .sort((a, b) => (a.readiness.scorePercent ?? 0) - (b.readiness.scorePercent ?? 0))[0];

  const largestGapLabel = largestGapCandidate
    ? `Complete ${largestGapCandidate.apparatus.name} Apparatus Check`
    : unavailableCount > 0
      ? "Resolve readiness data issue"
      : "Configure readiness requirements";
  let readinessGainLabel = "Scoring unavailable until configuration";
  if (largestGapCandidate && largestGapCandidate.readiness.scorePercent !== null) {
    readinessGainLabel = `${Math.max(1, Math.round(100 - largestGapCandidate.readiness.scorePercent))}% potential gain`;
  } else if (unavailableCount > 0) {
    readinessGainLabel = "Readiness data currently unavailable";
  }

  return (
    <section className="relative h-full overflow-hidden rounded-[20px] border border-[rgba(239,43,45,0.30)] bg-[#170909]">

      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_18%,rgba(239,43,45,.24),transparent_58%)]" />

      <div className="relative flex h-full flex-col px-6 py-5">

        {/* Header */}

        <p className="text-[14px] font-bold uppercase tracking-[2px] text-[#EF2B2D]">
          TODAY&apos;S READINESS
        </p>

        <p className="mt-2 max-w-[55%] text-[15px] leading-5 text-[#B3B3B3]">
          How prepared we are for today&apos;s operations.
        </p>

        {/* Main Content */}

        <div className="relative mt-2 flex-1">

          {/* Score */}

          <div className="flex items-start">

            <span className="text-[58px] font-black leading-none text-white">
              {readinessScore === null ? "--" : readinessScore}
            </span>

            <span className="mt-1 text-[22px] font-bold text-white">
              %
            </span>

          </div>

          <p className="mt-2 text-[16px] font-bold uppercase tracking-[2px] text-[#EF2B2D]">
              {outOfServiceCount > 0
                ? "OUT OF SERVICE RISK"
                  : unavailableCount > 0
                    ? "READINESS UNAVAILABLE"
                    : readinessScore === null
                      ? configurationRequiredCount > 0
                        ? "CONFIGURATION REQUIRED"
                        : "NOT SCORED"
                      : checksDueCount > 0
                  ? "CHECKS DUE"
                  : "READY TODAY"}
          </p>

          {/* Floating Shield */}

          <div className="pointer-events-none absolute right-[-95px] top-[-170px] h-[485px] w-[485px]">

            <Image
              src="/branding/images/todays-readiness-shield.png"
              alt="Today's Readiness Shield"
              fill
              priority
              className="object-contain drop-shadow-[0_0_60px_rgba(239,43,45,.45)]"
            />

          </div>

          {/* Biggest Readiness Gain */}

          <div className="mt-7 w-[50%]">

            <p className="text-[10px] font-semibold uppercase tracking-[2px] text-[#EF2B2D]/90">
              TODAY&apos;S BIGGEST READINESS GAIN
            </p>

            <h3 className="mt-2 text-[19px] font-bold leading-6 text-white">
              {largestGapLabel}
            </h3>

            <p className="text-[15px] text-[#C8C8C8]">
              Apparatus Readiness
            </p>

            <div className="mt-3 flex items-center gap-3">

              <div className="h-2.5 w-2.5 rounded-full bg-[#22C55E]" />

              <span className="text-[15px] font-bold text-[#22C55E]">
                {readinessGainLabel}
              </span>

            </div>

          </div>

        </div>

        {/* Button */}

        <Link
          href="/apparatus"
          className="
            mt-3
            flex
            h-12
            items-center
            justify-center
            gap-3
            rounded-xl
            bg-[#EF2B2D]
            text-[15px]
            font-bold
            text-white
            transition-all
            duration-300
            hover:bg-[#d91d1f]
            hover:shadow-[0_0_24px_rgba(239,43,45,.45)]
          "
        >
          View Today&apos;s Readiness

          <ArrowRight className="h-4 w-4" />

        </Link>

      </div>

    </section>
  );
}