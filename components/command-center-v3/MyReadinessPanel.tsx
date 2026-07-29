"use client";

import {
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import PrimaryActionButton from "./PrimaryActionButton";

export default function MyReadinessPanel() {
  const readiness = 94;

  const summary = [
    {
      title: "Certifications Current",
      status: "Good",
      type: "good",
    },
    {
      title: "PPE Inspection",
      status: "Good",
      type: "good",
    },
    {
      title: "Engine 430 Daily Check",
      status: "Due Today",
      type: "warning",
    },
    {
      title: "Hazmat Refresher",
      status: "Due Jul 30",
      type: "danger",
    },
  ];

  return (
    <section className="relative h-full overflow-hidden rounded-[22px] border border-white/10 bg-[#0b0b0b] shadow-[0_20px_60px_rgba(0,0,0,.45)]">

      {/* Background */}

      <div className="absolute inset-0 bg-gradient-to-br from-[#101113] via-[#0b0b0b] to-[#111111]" />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_50%,rgba(180,0,0,.08),transparent_50%)]" />

      <div className="relative z-10 flex h-full flex-col">

        {/* Main Content */}

        <div className="grid flex-1 grid-cols-[175px_1fr]">

          {/* LEFT COLUMN */}

          <div className="border-r border-white/10 px-4 py-3.5">

            <h2 className="text-[16px] font-semibold uppercase tracking-[.12em] text-white">
              MY READINESS
            </h2>

            <div className="mt-2.5 h-px w-[135px] bg-gradient-to-r from-red-500 via-red-400 to-transparent" />

            <div className="mt-3">

              <div className="flex items-end">

                <span className="text-[68px] font-black leading-[0.85] tracking-[-0.08em] text-white">
                  {readiness}
                </span>

                <span className="mb-2 text-[28px] font-black leading-none text-white">
                  %
                </span>

              </div>

              <div className="mt-1 text-[34px] font-black uppercase leading-none tracking-[-0.05em] text-red-500">
                READY
              </div>

              <div className="mt-2.5 h-px w-[135px] bg-gradient-to-r from-red-500 via-red-400 to-transparent shadow-[0_0_12px_rgba(239,43,45,.45)]" />

              <p className="mt-4 max-w-[145px] text-[14px] leading-5 text-neutral-300">
                You're ready for today's response.
              </p>

            </div>

          </div>

          {/* RIGHT COLUMN */}

          <div className="px-5 py-3.5">

            <h2 className="text-[16px] font-semibold uppercase tracking-[.12em] text-white">
              READINESS SUMMARY
            </h2>

            <div className="mt-2.5 space-y-1.5">

              {summary.map((item) => {

                const good = item.type === "good";
                const warning = item.type === "warning";
                const danger = item.type === "danger";

                return (
                <div
                  key={item.title}
                  className={`flex items-center justify-between rounded-xl border bg-[#121212]/95 px-3 py-1.5 transition-all
                    ${
                      good
                        ? "border-green-500/40"
                        : warning
                        ? "border-yellow-500/40"
                        : "border-red-500/40"
                    }`}
                >
                  <div className="flex items-center gap-2">

                    {good ? (
                      <CheckCircle2
                        size={18}
                        className="text-green-500"
                      />
                    ) : (
                      <AlertTriangle
                        size={18}
                        className={
                          warning
                            ? "text-yellow-400"
                            : "text-red-500"
                        }
                      />
                    )}

                    <span className="text-[13px] font-medium text-white">
                      {item.title}
                    </span>

                  </div>

                  <span
                    className={`text-[12px] font-semibold
                      ${
                        good
                          ? "text-green-500"
                          : warning
                          ? "text-yellow-400"
                          : "text-red-500"
                      }`}
                  >
                    {item.status}
                  </span>

                </div>

              );

            })}

          </div>

          {/* Recommendation */}

          <div className="mt-2.5 rounded-xl border-l-4 border-red-500 bg-[#181111] px-3 py-2.5 shadow-[0_0_16px_rgba(239,43,45,.12)]">

            <div className="flex items-center gap-2.5">

              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-red-500/40 bg-red-500/10">

                <ArrowRight
                  size={16}
                  className="-rotate-45 text-red-500"
                />

              </div>

              <p className="text-[13px] leading-5 text-neutral-300">
                Complete today's apparatus check to raise readiness to
                <span className="font-semibold text-red-500">
                  {" "}100%.
                </span>
              </p>

            </div>

          </div>

        </div>

      </div>

      {/* Full Width Footer */}

      <div className="relative z-10 border-t border-white/10 px-5 py-2">
        <PrimaryActionButton label="View Readiness Details" />
      </div>

      </div>

      {/* Left Accent */}
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