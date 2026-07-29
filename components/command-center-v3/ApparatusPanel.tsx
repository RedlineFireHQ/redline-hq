"use client";

import Image from "next/image";
import { ChevronRight, CheckCircle2 } from "lucide-react";
import PrimaryActionButton from "./PrimaryActionButton";

const apparatus = [
  {
    id: 1,
    name: "Pumper 430",
    type: "Pumper",
    image: "/apparatus/elliott/pumper-430.jpg",
    status: "Available",
    lastCheck: "Today • 6:42 AM",
    nextCheck: "August 1",
    checkedBy: "A. Smith",
  },
  {
    id: 2,
    name: "Pumper 432",
    type: "Pumper",
    image: "/apparatus/elliott/pumper-432.jpg",
    status: "Available",
    lastCheck: "Today • 6:38 AM",
    nextCheck: "August 1",
    checkedBy: "J. Williams",
  },
  {
    id: 3,
    name: "Tanker 445",
    type: "Tanker",
    image: "/apparatus/elliott/tanker-445.jpg",
    status: "Available",
    lastCheck: "Today • 6:31 AM",
    nextCheck: "August 1",
    checkedBy: "T. Johnson",
  },
  {
    id: 4,
    name: "Brush 420",
    type: "Brush",
    image: "/apparatus/elliott/brush-420.jpg",
    status: "Available",
    lastCheck: "Today • 6:26 AM",
    nextCheck: "August 1",
    checkedBy: "B. Miller",
  },
  {
    id: 5,
    name: "Brush 421",
    type: "Brush",
    image: "/apparatus/elliott/brush-421.jpg",
    status: "Available",
    lastCheck: "Today • 6:21 AM",
    nextCheck: "August 1",
    checkedBy: "A. Smith",
  },
];

export default function ApparatusPanel() {
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

          <button className="group inline-flex h-10 items-center gap-2 rounded-xl border border-red-500/40 bg-gradient-to-b from-[#ff3b3b] to-[#b90d0d] px-5 text-[13px] font-semibold text-white shadow-[0_0_18px_rgba(239,43,45,.30)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_26px_rgba(239,43,45,.45)]">

            View All Apparatus

            <ChevronRight
              size={17}
              className="transition-transform duration-300 group-hover:translate-x-1"
            />

          </button>

        </div>

        {/* Apparatus Cards */}

        <div className="overflow-x-scroll apparatus-scroll">

          <div className="flex gap-5 px-6 py-5 min-w-max">

            {apparatus.map((truck) => (

              <button
                key={truck.id}
                className="group w-[260px] flex-shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-[#111111] text-left transition-all duration-300 hover:-translate-y-1 hover:border-red-500/40 hover:shadow-[0_18px_45px_rgba(239,43,45,.18)]"
              >

                {/* Photo */}

                <div className="relative h-[150px] w-full overflow-hidden">

                  <Image
                    src={truck.image}
                    alt={truck.name}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

                  <div className="absolute left-4 top-4 rounded-full border border-red-500/30 bg-black/45 px-3 py-1 backdrop-blur-sm">

                    <span className="text-[11px] font-semibold uppercase tracking-[.12em] text-white">
                      {truck.type}
                    </span>

                  </div>

                  <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full border border-green-500/30 bg-black/45 px-3 py-1 backdrop-blur-sm">

                    <CheckCircle2
                      size={14}
                      className="text-green-400"
                    />

                    <span className="text-[12px] font-semibold text-green-300">
                      {truck.status}
                    </span>

                  </div>

                </div>

                <div className="px-4 pb-2.5 pt-2">

                  <h3 className="text-[22px] font-black tracking-[-0.04em] text-white">
                    {truck.name}
                  </h3>

                  <div className="mt-2 border-t border-white/10 pt-2">

                    <div className="text-[11px] font-semibold uppercase tracking-[.12em] text-neutral-500">
                      Last Check
                    </div>

                    <div className="mt-1 text-[14px] font-medium text-white">
                      {truck.lastCheck}
                    </div>

                  </div>

                  <div className="mt-2 border-t border-white/10 pt-2">

                    <div className="text-[11px] font-semibold uppercase tracking-[.12em] text-neutral-500">
                      Next Check
                    </div>

                    <div className="mt-1 text-[14px] font-medium text-white">
                      {truck.nextCheck}
                    </div>

                  </div>

                  <div className="mt-2 border-t border-white/10 pt-2">

                    <div className="text-[11px] font-semibold uppercase tracking-[.12em] text-neutral-500">
                      Checked By
                    </div>

                    <div className="mt-1 text-[14px] font-medium text-white">
                      {truck.checkedBy}
                    </div>

                  </div>

                  <div className="mt-2 border-t border-white/10 pt-2">
                    <PrimaryActionButton label="Apparatus Check" />

                  </div>

                </div>

              </button>
             ))}

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

      <style jsx global>{`
        .apparatus-scroll {
          scrollbar-width: auto;
          scrollbar-color: #8f8f8f #111111;
        }

        .apparatus-scroll::-webkit-scrollbar {
          height: 12px;
        }

        .apparatus-scroll::-webkit-scrollbar-track {
          background: #111111;
          border-radius: 9999px;
        }

        .apparatus-scroll::-webkit-scrollbar-thumb {
          background: linear-gradient(to bottom, #a3a3a3, #7d7d7d);
          border-radius: 9999px;
          border: 2px solid #111111;
        }

        .apparatus-scroll::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(to bottom, #c2c2c2, #949494);
        }
      `}</style>

    </section>
  );
}             
