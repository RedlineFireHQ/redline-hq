"use client";

import Image from "next/image";
import { ArrowRight } from "lucide-react";

export default function ReadinessPanel() {
  const readiness = 91;
  const size = 176;
  const stroke = 16;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (readiness / 100) * circumference;

  return (
    <section className="relative h-full overflow-hidden rounded-[20px] border border-white/10 bg-[#090909] shadow-lg">
      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_50%,rgba(239,43,45,.22),transparent_42%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,#090909_0%,#090909_58%,rgba(9,9,9,.65)_76%,rgba(9,9,9,.15)_100%)]" />

      {/* Firefighter */}
      <div className="pointer-events-none absolute right-[6px] bottom-[-110px] h-[155%] w-[60%] overflow-hidden opacity-95">
        <Image
          src="/images/readiness-hero.png"
          alt="Firefighter"
          fill
          priority
          sizes="40vw"
          className="object-contain object-right scale-[1.25]"
        />
      </div>

      <div className="relative z-10 flex h-full flex-col p-6">
        {/* Panel Title */}
        <div className="mb-5 flex items-center gap-4">
          <div className="h-px flex-1 bg-[#EF2B2D]/60" />

          <span className="text-[13px] font-bold tracking-[0.30em] text-white">
            REDLINE READINESS
          </span>

          <div className="h-px flex-1 bg-[#EF2B2D]/60" />
        </div>

        <div className="flex flex-1 items-start">
          {/* Gauge */}
          <div className="relative -mt-3 mr-8 flex h-[176px] w-[176px] shrink-0 items-center justify-center">
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 176 176"
            >
              <circle
                cx="88"
                cy="88"
                r={radius}
                stroke="rgba(255,255,255,.08)"
                strokeWidth={stroke}
                fill="none"
              />

              <circle
                cx="88"
                cy="88"
                r={radius}
                stroke="#EF2B2D"
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                fill="none"
                style={{
                  transform: "rotate(-90deg)",
                  transformOrigin: "88px 88px",
                }}
              />
            </svg>

            <div className="text-center">
              <div className="text-5xl font-bold text-white">
                {readiness}%
              </div>

              <div className="mt-1 text-xs tracking-[0.35em] text-zinc-400">
                READY
              </div>
            </div>
          </div>

          {/* Text */}
          <div className="z-20 -ml-1 flex flex-col">
            <p className="text-[16px] text-[#C8C8CE]">
              Our department is
            </p>

            <h2 className="mt-2 text-[52px] font-extrabold leading-none text-[#EF2B2D]">
              REDLINE READY
            </h2>

            <button className="mt-10 inline-flex h-[54px] w-fit items-center gap-3 rounded-2xl border border-[#EF2B2D] px-8 font-semibold text-white transition hover:bg-[#EF2B2D]/10">
              View Readiness Details
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}