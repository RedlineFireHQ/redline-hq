"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DrugInspectionSummary } from "@/lib/drug-boxes/data";

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

type DrugInspectionHistoryProps = {
  inspections: DrugInspectionSummary[];
  canDelete: boolean;
};

/** Readable Drug Box inspection history with an admin-only delete action. */
export default function DrugInspectionHistory({ inspections, canDelete }: DrugInspectionHistoryProps) {
  return (
    <section className="rounded-xl border border-neutral-800 bg-[#242424] p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">History</p>
          <h2 className="mt-1 text-xl font-black text-white">Drug Box Inspection History</h2>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-semibold text-neutral-200">
          {inspections.length} {inspections.length === 1 ? "Inspection" : "Inspections"}
        </span>
      </div>

      {inspections.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-400">No drug box inspections recorded yet.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {inspections.map((inspection) => (
            <li key={inspection.id} className="flex items-stretch gap-2">
              <Link
                href={`/inventory/ems-drug-box/history/${inspection.id}`}
                className="flex flex-1 flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3 transition hover:border-sky-500/40 hover:bg-[#202020]"
              >
                <div>
                  <p className="text-sm font-semibold text-white">Squad {inspection.squadNumber}</p>
                  <p className="mt-0.5 text-xs text-neutral-400">
                    Inspector: {inspection.inspectorName} · {formatDateTime(inspection.createdAt)} · {inspection.checkedCount}/
                    {inspection.itemCount} present
                  </p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-semibold text-neutral-200">
                  View
                </span>
              </Link>
              {canDelete ? (
                <div className="flex items-center">
                  <DeleteDrugInspectionButton inspectionId={inspection.id} squadNumber={inspection.squadNumber} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DeleteDrugInspectionButton({ inspectionId, squadNumber }: { inspectionId: string; squadNumber: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/drug-boxes/inspections/${inspectionId}`, { method: "DELETE" });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
        setError(typeof body?.error === "string" ? body.error : "Unable to delete this inspection.");
        setDeleting(false);
        return;
      }
      setConfirming(false);
      setDeleting(false);
      router.refresh();
    } catch {
      setError("Unable to delete this inspection.");
      setDeleting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setConfirming(true);
        }}
        aria-label={`Delete Squad ${squadNumber} inspection`}
        className="rounded-xl border border-red-500/40 bg-red-950/30 px-3 py-1.5 text-xs font-semibold text-red-200 transition hover:border-red-400/60 hover:bg-red-950/50"
      >
        Delete
      </button>

      {confirming ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm drug box inspection deletion"
        >
          <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-[#242424] p-6">
            <h3 className="text-lg font-bold text-white">Delete Squad {squadNumber} inspection?</h3>
            <p className="mt-3 text-sm text-neutral-300">
              This permanently removes this inspection record and its item snapshot. This cannot be undone. The drug
              box, the checklist template, and all other inspection history are not affected.
            </p>
            {error ? (
              <p className="mt-3 rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2 text-sm text-red-200">{error}</p>
            ) : null}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirming(false)}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-white/[0.08] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void handleConfirm()}
                className="rounded-xl border border-red-500/50 bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete Inspection"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
