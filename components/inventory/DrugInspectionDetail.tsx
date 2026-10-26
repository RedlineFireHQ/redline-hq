"use client";

import Link from "next/link";
import type { DrugInspectionRecord } from "@/lib/drug-boxes/data";

function formatDateTime(value: string) {
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

/** Read-only historical snapshot of one completed drug box inspection. */
export default function DrugInspectionDetail({ inspection }: { inspection: DrugInspectionRecord }) {
  const checkedCount = inspection.items.filter((item) => item.checked).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-400">Inspection Record</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-white">Squad {inspection.squadNumber}</h1>
          <p className="mt-2 text-sm text-neutral-300">
            Completed {formatDateTime(inspection.createdAt)} — this is a permanent, read-only record.
          </p>
        </div>
        <Link
          href="/inventory/ems-drug-box"
          className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-white/[0.08]"
        >
          Back to Drug Boxes
        </Link>
      </div>

      <section className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-5">
        <h2 className="text-xl font-bold text-white">Inspection Details</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">Inspector</dt>
            <dd className="mt-1 text-sm font-semibold text-white">{inspection.inspectorName}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">Unit #</dt>
            <dd className="mt-1 text-sm font-semibold text-white">{inspection.unitNumber || "—"}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">Date / Time</dt>
            <dd className="mt-1 text-sm font-semibold text-white">{formatDateTime(inspection.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">Box Lock #</dt>
            <dd className="mt-1 text-sm font-semibold text-white">{inspection.boxLockNumber || "—"}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">CS Lock #</dt>
            <dd className="mt-1 text-sm font-semibold text-white">{inspection.csLockNumber || "—"}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">EZ-IO #</dt>
            <dd className="mt-1 text-sm font-semibold text-white">{inspection.ezIoNumber || "—"}</dd>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <dt className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">Assisting Personnel</dt>
            <dd className="mt-1 text-sm font-semibold text-white">
              {inspection.assistingPersonnel.length > 0 ? inspection.assistingPersonnel.join(", ") : "—"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-5">
        <h2 className="text-xl font-bold text-white">Checklist Snapshot</h2>
        <p className="mt-1 text-sm text-neutral-400">
          {checkedCount} of {inspection.items.length} items present — exactly as recorded at inspection time.
        </p>
        <div className="mt-4 space-y-2">
          {inspection.items.map((item) => (
            <div
              key={item.itemId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2"
            >
              <div>
                <p className="text-sm font-semibold text-white">{item.itemLabel}</p>
                <p className="mt-0.5 text-xs text-neutral-400">
                  {item.sectionName} · Qty: {item.requiredQuantity}
                </p>
              </div>
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  item.checked
                    ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-200"
                    : "border-white/10 bg-white/[0.03] text-neutral-300"
                }`}
              >
                {item.checked ? "PASS" : "EXPIRED"}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
