"use client";

import Link from "next/link";
import DeletePediatricInspectionButton from "@/components/inventory/DeletePediatricInspectionButton";
import type { PediatricInspectionSummaryRow } from "@/lib/pediatric-bags/data";

type Props = {
  inspections: PediatricInspectionSummaryRow[];
  /** True only for department administrators; controls Delete visibility. */
  canDelete?: boolean;
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "Unknown";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown";
  }
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function PediatricCheckHistory({ inspections, canDelete = false }: Props) {
  return (
    <section className="rounded-xl border border-neutral-800 bg-[#242424] p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">History</p>
          <h2 className="mt-1 text-xl font-black text-white">Pediatric Check History</h2>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-semibold text-neutral-200">
          {inspections.length} {inspections.length === 1 ? "Inspection" : "Inspections"}
        </span>
      </div>

      {inspections.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-400">No pediatric bag checks recorded yet.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {inspections.map((inspection) => (
            <li key={inspection.id} className="flex items-stretch gap-2">
              <Link
                href={`/inventory/ems-pediatric-bags/history/${inspection.id}`}
                className="flex flex-1 flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3 transition hover:border-sky-500/40 hover:bg-[#202020]"
              >
                <div>
                  <p className="text-sm font-semibold text-white">Pediatric Bag {inspection.bagLabel}</p>
                  <p className="mt-0.5 text-xs text-neutral-400">
                    Inspector: {inspection.inspectorName} · {formatDateTime(inspection.createdAt)}
                  </p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-semibold text-neutral-200">
                  View
                </span>
              </Link>
              {canDelete ? (
                <div className="flex items-center">
                  <DeletePediatricInspectionButton inspectionId={inspection.id} bagLabel={inspection.bagLabel} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
