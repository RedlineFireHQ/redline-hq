"use client";

import Link from "next/link";
import { useState } from "react";

type ApparatusStatus = "Ready" | "Checks Due" | "Out of Service";

type ApparatusUnit = {
  id: string;
  name: string;
  type: string;
  status: ApparatusStatus;
  lastInspection: string;
  openDeficiencies: number;
  readiness: string;
  imageUrl: string | null;
};

interface ApparatusViewSwitcherProps {
  apparatusUnits: ApparatusUnit[];
}

function getStatusClasses(status: ApparatusStatus): string {
  if (status === "Ready") {
    return "border-green-500/30 bg-green-500/15 text-green-300";
  }

  if (status === "Checks Due") {
    return "border-amber-500/30 bg-amber-500/15 text-amber-300";
  }

  return "border-red-500/35 bg-red-500/15 text-red-300";
}

export default function ApparatusViewSwitcher({
  apparatusUnits,
}: ApparatusViewSwitcherProps) {
  const [viewMode, setViewMode] = useState<"card" | "table">("card");

  return (
    <>
      {/* View Toggle */}
      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#111111] p-2">
        <p className="px-3 text-sm font-medium text-neutral-400">View</p>

        <div className="inline-flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode("card")}
            className={
              viewMode === "card"
                ? "rounded-xl border border-red-500/35 bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-300"
                : "rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-neutral-300"
            }
          >
            Card View
          </button>

          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={
              viewMode === "table"
                ? "rounded-xl border border-red-500/35 bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-300"
                : "rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-neutral-300"
            }
          >
            Table View
          </button>
        </div>
      </div>

      {viewMode === "card" ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {apparatusUnits.map((unit) => (
            <div
              key={unit.id}
              className="group overflow-hidden rounded-2xl border border-white/10 bg-[#111111] text-left transition-all duration-300 hover:-translate-y-1 hover:border-red-500/40 hover:shadow-[0_18px_45px_rgba(239,43,45,.14)]"
            >
              <Link href={`/apparatus/${unit.id}`} className="block">
                <div className="relative h-40 w-full border-b border-white/10 bg-gradient-to-br from-[#1a1a1a] via-[#151515] to-[#101010]">
                  {unit.imageUrl ? (
                    <img
                      src={unit.imageUrl}
                      alt={unit.name}
                      className="absolute inset-0 h-full w-full object-cover"
                      onError={() => {
                        // Keep the card layout intact and fall back to the existing background.
                      }}
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_25%,rgba(180,0,0,.14),transparent_60%)]" />
                </div>

                <div className="space-y-4 px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-2xl font-black tracking-tight text-white">{unit.name}</h2>

                    <span
                      className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[.12em] ${getStatusClasses(unit.status)}`}
                    >
                      {unit.status}
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-neutral-500">
                        Last Inspection
                      </p>
                      <p className="mt-1 text-sm font-medium text-white">{unit.lastInspection}</p>
                    </div>

                    <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-neutral-500">
                        Open Deficiencies
                      </p>
                      <p className="mt-1 text-sm font-medium text-white">{unit.openDeficiencies}</p>
                    </div>
                  </div>
                </div>
              </Link>

              <div className="px-5 pb-4">
                <Link
                  href={`/apparatus/${unit.id}/daily-check`}
                  className="inline-flex h-[42px] w-full items-center justify-center rounded-xl border border-red-500/40 bg-gradient-to-b from-[#ff3b3b] to-[#b90d0d] px-4 text-sm font-semibold text-white shadow-[0_0_18px_rgba(239,43,45,.30)] transition-all duration-300 hover:shadow-[0_0_26px_rgba(239,43,45,.45)]"
                >
                  Apparatus Check
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#111111]">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[11px] uppercase tracking-[0.12em] text-neutral-500">
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Apparatus Name</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Last Inspection</th>
                <th className="px-4 py-3 font-semibold">Open Deficiencies</th>
                <th className="px-4 py-3 font-semibold">Readiness</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/5 text-neutral-300">
              {apparatusUnits.map((unit) => (
                <tr key={unit.id} className="transition-colors hover:bg-white/[0.03]">
                  <td className="px-4 py-4 align-top">
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[.12em] ${getStatusClasses(unit.status)}`}
                    >
                      {unit.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 align-top text-white">{unit.name}</td>
                  <td className="px-4 py-4 align-top text-white">{unit.type}</td>
                  <td className="px-4 py-4 align-top text-white">{unit.lastInspection}</td>
                  <td className="px-4 py-4 align-top text-white">{unit.openDeficiencies}</td>
                  <td className="px-4 py-4 align-top text-white">{unit.readiness}</td>
                  <td className="px-4 py-4 align-top">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/apparatus/${unit.id}`}
                        className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
                      >
                        Open Apparatus
                      </Link>
                      <Link
                        href={`/apparatus/${unit.id}/daily-check`}
                        className="rounded-lg border border-red-500/30 bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700"
                      >
                        Apparatus Check
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
