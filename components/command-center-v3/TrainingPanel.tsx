"use client";

import {
  Clock3,
} from "lucide-react";
import PrimaryActionButton from "./PrimaryActionButton";

export default function TrainingPanel() {
  const yourHours = 92.5;
  const departmentHours = 1842;

  return (
    <section className="relative h-full overflow-hidden rounded-[22px] border border-white/10 bg-[#101010] shadow-[0_20px_60px_rgba(0,0,0,.45)]">

      {/* Background */}

      <div className="absolute inset-0 bg-gradient-to-br from-[#171717] via-[#121212] to-[#171717]" />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_35%,rgba(180,0,0,.08),transparent_55%)]" />

      <div className="relative z-10 flex h-full flex-col">

        {/* Header */}

        <div className="border-b border-white/10 px-5 py-3">

          <h2 className="text-[16px] font-semibold uppercase tracking-[.12em] text-white">
            TRAINING
          </h2>

        </div>

        {/* Metrics */}

        <div className="grid grid-cols-2 gap-3 px-5 pt-3">

          {/* Your Hours */}

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">

            <div className="text-[11px] uppercase tracking-[.12em] text-neutral-500">
              YOUR HOURS
            </div>

            <div className="mt-2 text-[42px] font-black leading-none tracking-[-0.05em] text-white">
              {yourHours}
            </div>

            <div className="mt-1 text-[12px] font-semibold text-green-400">
              Calendar Year
            </div>

          </div>

          {/* Department */}

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">

            <div className="text-[11px] uppercase tracking-[.12em] text-neutral-500">
              DEPARTMENT
            </div>

            <div className="mt-2 text-[42px] font-black leading-none tracking-[-0.05em] text-white">
              {departmentHours.toLocaleString()}
            </div>

            <div className="mt-1 text-[12px] text-neutral-400">
              Calendar Year
            </div>

          </div>

        </div>

        {/* Quick Training */}

        <div className="mt-3 flex-1 px-5">

          <div className="rounded-xl border-l-4 border-red-500 bg-[#181111] p-3 shadow-[0_0_16px_rgba(239,43,45,.12)]">

            <div className="text-[11px] font-semibold uppercase tracking-[.12em] text-neutral-400">
              QUICK TRAINING
            </div>

            <div className="mt-2 text-[16px] font-semibold text-white">
              Pump Operations
            </div>

            <div className="mt-2 text-[13px] leading-6 text-neutral-300">
              Complete a 12-minute refresher to improve your readiness.
            </div>

            <div className="mt-3 inline-flex items-center rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1">

              <Clock3
                size={14}
                className="mr-2 text-red-400"
              />

              <span className="text-[12px] font-medium text-red-300">
                12 Minutes
              </span>

            </div>

          </div>

        </div>
         {/* Footer */}

        <div className="border-t border-white/10 px-5 py-2">
          <PrimaryActionButton label="Log Training" />

        </div>

      </div>

      {/* Left Accent Glow */}

      <div className="pointer-events-none absolute left-0 top-16 h-[180px] w-[2px] rounded-full bg-red-600/70 blur-[1px]" />

      {/* Bottom Glow */}

      <div className="pointer-events-none absolute bottom-0 left-1/2 h-20 w-[60%] -translate-x-1/2 bg-red-600/10 blur-3xl" />

      {/* Subtle Border Glow */}

      <div className="pointer-events-none absolute inset-0 rounded-[22px] ring-1 ring-inset ring-white/5" />

      {/* Bottom Divider */}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

    </section>
  );
}       