"use client";

import Image from "next/image";
import { ArrowRight, CheckCircle2, AlertTriangle } from "lucide-react";

export default function ReadinessPanel() {
  const readiness = 94;

  return (
    <section className="relative h-full overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b0b] shadow-[0_20px_60px_rgba(0,0,0,.45)]">

      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#101113] via-[#0b0b0b] to-[#111111]" />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_50%,rgba(180,0,0,.18),transparent_45%)]" />

      {/* Smoke / Shield */}
      <div className="pointer-events-none absolute right-0 top-0 h-full w-[42%] opacity-70">

        <Image
          src="/images/readiness/readiness-smoke-shield.png"
          alt=""
          fill
          priority
          className="object-contain object-center"
        />

      </div>

      {/* Firefighter */}
      <div className="pointer-events-none absolute -bottom-40 right-0 h-[98%] w-[34%]">

        <Image
          src="/images/readiness/readiness-firefighter.png"
          alt="Firefighter"
          fill
          priority
          className="object-contain object-bottom"
        />

      </div>

      {/* Content */}
      <div className="relative z-10 grid h-full grid-cols-[260px_1fr] gap-10 p-8">

        {/* LEFT COLUMN */}

        <div className="flex flex-col border-r border-white/10 pr-8">

          <h2 className="text-[17px] font-semibold uppercase tracking-[.12em] text-white">
            MY READINESS
          </h2>

          <div className="mt-4 h-px w-[230px] bg-gradient-to-r from-red-500 via-red-400 to-transparent" />

          <div className="mt-10">

            <div className="flex items-end">

              <span className="text-[120px] font-black leading-none tracking-[-0.06em] text-white">
                {readiness}
              </span>

              <span className="mb-3 ml-1 text-[56px] font-bold leading-none text-white">
                %
              </span>

            </div>

            <div className="mt-2 text-[58px] font-extrabold uppercase leading-none tracking-[-0.03em] text-red-500">
              READY
            </div>

            <div className="mt-5 h-px w-[180px] bg-gradient-to-r from-red-500 via-red-400 to-transparent" />

            <p className="mt-8 max-w-[190px] text-[18px] leading-9 text-neutral-300">
              You're ready for today's response.
            </p>

          </div>

        </div>

        {/* RIGHT COLUMN */}

        <div className="relative flex flex-col pr-[280px]">

          <h3 className="text-[18px] font-semibold uppercase tracking-[.12em] text-white">
            READINESS SUMMARY
          </h3>

          <div className="mt-8 space-y-4">
                      <div className="rounded-xl border border-green-500/40 bg-[#121212]/90 px-5 py-5 backdrop-blur-sm">

              <div className="flex items-center justify-between">

                <div className="flex items-center gap-4">

                  <CheckCircle2
                    size={28}
                    className="text-green-500"
                  />

                  <span className="text-[18px] text-white">
                    Certifications Current
                  </span>

                </div>

                <span className="text-[18px] font-medium text-green-500">
                  Good
                </span>

              </div>

            </div>

            <div className="rounded-xl border border-green-500/40 bg-[#121212]/90 px-5 py-5 backdrop-blur-sm">

              <div className="flex items-center justify-between">

                <div className="flex items-center gap-4">

                  <CheckCircle2
                    size={28}
                    className="text-green-500"
                  />

                  <span className="text-[18px] text-white">
                    PPE Inspection
                  </span>

                </div>

                <span className="text-[18px] font-medium text-green-500">
                  Good
                </span>

              </div>

            </div>

            <div className="rounded-xl border border-yellow-500/40 bg-[#121212]/90 px-5 py-5 backdrop-blur-sm">

              <div className="flex items-center justify-between">

                <div className="flex items-center gap-4">

                  <AlertTriangle
                    size={28}
                    className="text-yellow-500"
                  />

                  <span className="text-[18px] text-white">
                    Engine 430 Daily Check
                  </span>

                </div>

                <span className="text-[18px] font-medium text-yellow-400">
                  Due Today
                </span>

              </div>

            </div>

            <div className="rounded-xl border border-red-500/40 bg-[#121212]/90 px-5 py-5 backdrop-blur-sm">

              <div className="flex items-center justify-between">

                <div className="flex items-center gap-4">

                  <AlertTriangle
                    size={28}
                    className="text-red-500"
                  />

                  <span className="text-[18px] text-white">
                    Hazmat Refresher
                  </span>

                </div>

                <span className="text-[18px] font-medium text-red-500">
                  Due Jul 30
                </span>

              </div>

            </div>

          </div>

          <div className="mt-7 rounded-xl border border-red-500/20 bg-[#121212]/90 px-6 py-5 backdrop-blur-sm">

            <div className="flex items-center gap-4">

              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-red-500/40 bg-red-500/10">

                <ArrowRight
                  size={26}
                  className="-rotate-45 text-red-500"
                />

              </div>

              <p className="text-[19px] leading-8 text-neutral-200">
                Complete today's apparatus check to increase readiness to
                <span className="font-semibold text-red-500"> 100%.</span>
              </p>

            </div>

          </div>
          <div className="mt-8">

            <button className="group flex h-[74px] w-[510px] items-center justify-between rounded-2xl border border-red-400/50 bg-gradient-to-b from-[#ff3b3b] to-[#b90d0d] px-8 text-white shadow-[0_0_30px_rgba(255,40,40,.28)] transition-all duration-300 hover:scale-[1.01] hover:shadow-[0_0_40px_rgba(255,40,40,.45)]">

              <span className="text-[21px] font-semibold">
                View Readiness Details
              </span>

              <ArrowRight
                size={34}
                className="transition-transform duration-300 group-hover:translate-x-1"
              />

            </button>

          </div>

        </div>

      </div>

      {/* Left red accent */}
      <div className="pointer-events-none absolute left-0 top-24 h-[320px] w-[3px] rounded-full bg-red-600/80 blur-[1px]" />

      {/* Bottom glow */}
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-28 w-[70%] -translate-x-1/2 bg-red-600/10 blur-3xl" />

      {/* Card highlight */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/5" />

      {/* Bottom separator */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" /> 
          </section>
  );
}         