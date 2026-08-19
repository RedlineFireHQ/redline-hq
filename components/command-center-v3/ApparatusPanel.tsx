import Image from "next/image";
import { ChevronRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import PrimaryActionButton from "./PrimaryActionButton";
import { getApparatusReadinessList, getStatusLabelForReadinessRow } from "@/lib/readiness/apparatus-readiness-data";
import { getApparatusImagePath } from "@/lib/apparatus-images";

function statusChipClasses(
  statusLabel: "Ready" | "Checks Due" | "Out of Service" | "Configuration Required" | "Readiness Unavailable"
) {
  if (statusLabel === "Out of Service") {
    return "border-red-500/35 bg-red-500/20";
  }

  if (statusLabel === "Readiness Unavailable") {
    return "border-zinc-400/35 bg-zinc-500/15";
  }

  if (statusLabel === "Configuration Required") {
    return "border-sky-500/35 bg-sky-500/15";
  }

  if (statusLabel === "Checks Due") {
    return "border-amber-500/30 bg-amber-500/15";
  }

  return "border-green-500/30 bg-black/45";
}

export default async function ApparatusPanel() {
  const readinessRows = await getApparatusReadinessList();

  return (
    <section className="relative overflow-hidden rounded-[22px] border border-white/10 bg-[#101010] shadow-[0_20px_60px_rgba(0,0,0,.45)]">

      {/* Background */}

      <div className="absolute inset-0 bg-gradient-to-br from-[#171717] via-[#121212] to-[#171717]" />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_35%,rgba(180,0,0,.08),transparent_55%)]" />

      <div className="relative z-10">

        {/* Header */}

        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">

          <div>

            <h2 className="text-[21px] font-black uppercase tracking-[.14em] text-white">
              APPARATUS
            </h2>

            <div className="mt-2 h-px w-[150px] bg-gradient-to-r from-red-500 via-red-400 to-transparent" />

            <p className="mt-3 text-[19px] font-medium text-neutral-200">
              Fleet Readiness at a Glance
            </p>

          </div>

          <Link
            href="/apparatus"
            className="group inline-flex h-10 items-center gap-2 rounded-xl border border-red-500/40 bg-gradient-to-b from-[#ff3b3b] to-[#b90d0d] px-5 text-[13px] font-semibold text-white shadow-[0_0_18px_rgba(239,43,45,.30)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_26px_rgba(239,43,45,.45)]"
          >

            View All Apparatus

            <ChevronRight
              size={17}
              className="transition-transform duration-300 group-hover:translate-x-1"
            />

          </Link>

        </div>

        {/* Apparatus Cards */}

        <div className="overflow-x-scroll apparatus-scroll">

          <div className="flex gap-5 px-6 py-5 min-w-max">

              {readinessRows.map((row) => {
                const { apparatus, readiness } = row;
                const statusLabel = getStatusLabelForReadinessRow(row);
              const lastCheck = apparatus.last_inspection_at
                ? new Date(apparatus.last_inspection_at).toLocaleString("en-US", {
                    month: "short",
                    day: "2-digit",
                    hour: "numeric",
                    minute: "2-digit",
                  })
                : "Not completed";
                const checksScore = readiness.bucketScores.apparatusChecks;
                const nextCheck =
                  statusLabel === "Readiness Unavailable"
                    ? "Unavailable"
                    : checksScore === null
                      ? "Config Required"
                      : checksScore === 20
                        ? "Current"
                        : "Due / Overdue";
                const scoreLabel =
                  statusLabel === "Readiness Unavailable"
                    ? "UNAVAILABLE"
                    : readiness.scorePercent === null
                      ? "NOT SCORED"
                      : `${Math.round(readiness.scorePercent)}%`;

              return (
                <div
                  key={apparatus.id}
                  className="group w-[260px] flex-shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-[#111111] text-left transition-all duration-300 hover:-translate-y-1 hover:border-red-500/40 hover:shadow-[0_18px_45px_rgba(239,43,45,.18)]"
                >

                {/* Photo */}

                <div className="relative h-[150px] w-full overflow-hidden">

                  <Image
                    src={getApparatusImagePath(apparatus.name) ?? "/branding/images/redline-shield.png"}
                    alt={apparatus.name}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

                  <div className="absolute left-4 top-4 rounded-full border border-red-500/30 bg-black/45 px-3 py-1 backdrop-blur-sm">

                    <span className="text-[11px] font-semibold uppercase tracking-[.12em] text-white">
                      {apparatus.type ?? "Apparatus"}
                    </span>

                  </div>

                  <div className={`absolute bottom-4 left-4 flex items-center gap-2 rounded-full border px-3 py-1 backdrop-blur-sm ${statusChipClasses(statusLabel)}`}>

                    <CheckCircle2
                      size={14}
                        className={statusLabel === "Out of Service" ? "text-red-300" : statusLabel === "Readiness Unavailable" ? "text-zinc-300" : statusLabel === "Configuration Required" ? "text-sky-300" : statusLabel === "Checks Due" ? "text-amber-300" : "text-green-400"}
                    />

                      <span className={`text-[12px] font-semibold ${statusLabel === "Out of Service" ? "text-red-200" : statusLabel === "Readiness Unavailable" ? "text-zinc-200" : statusLabel === "Configuration Required" ? "text-sky-200" : statusLabel === "Checks Due" ? "text-amber-200" : "text-green-300"}`}>
                      {statusLabel}
                    </span>

                  </div>

                </div>

                <div className="px-4 pb-2.5 pt-2">

                  <h3 className="text-[22px] font-black tracking-[-0.04em] text-white">
                    {apparatus.name}
                  </h3>

                  <div className="mt-2 border-t border-white/10 pt-2">

                    <div className="text-[11px] font-semibold uppercase tracking-[.12em] text-neutral-500">
                      Last Check
                    </div>

                    <div className="mt-1 text-[14px] font-medium text-white">
                      {lastCheck}
                    </div>

                  </div>

                  <div className="mt-2 border-t border-white/10 pt-2">

                    <div className="text-[11px] font-semibold uppercase tracking-[.12em] text-neutral-500">
                      Next Check
                    </div>

                    <div className="mt-1 text-[14px] font-medium text-white">
                      {nextCheck}
                    </div>

                  </div>

                  <div className="mt-2 border-t border-white/10 pt-2">

                    <div className="text-[11px] font-semibold uppercase tracking-[.12em] text-neutral-500">
                      Readiness
                    </div>

                    <div className="mt-1 text-[14px] font-medium text-white">
                      {scoreLabel}
                    </div>

                  </div>

                  <div className="mt-2 border-t border-white/10 pt-2">
                    <PrimaryActionButton label="Apparatus Check" href={`/apparatus/${apparatus.id}/daily-check`} />

                  </div>

                </div>

              </div>
              );
            })}

          </div>

        </div>

      </div>

      {/* Left Accent Glow */}

      <div className="pointer-events-none absolute left-0 top-16 h-[220px] w-[2px] rounded-full bg-red-600/70 blur-[1px]" />

      {/* Bottom Glow */}

      <div className="pointer-events-none absolute bottom-0 left-1/2 h-24 w-[60%] -translate-x-1/2 bg-red-600/10 blur-3xl" />

      {/* Border Glow */}

      <div className="pointer-events-none absolute inset-0 rounded-[22px] ring-1 ring-inset ring-white/5" />

      {/* Bottom Divider */}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

    </section>
  );
}             
