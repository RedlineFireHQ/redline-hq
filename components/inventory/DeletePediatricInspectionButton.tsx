"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type DeletePediatricInspectionButtonProps = {
  inspectionId: string;
  bagLabel: string;
  /** Optional destination after a successful delete (used on the detail page). */
  redirectAfterDelete?: string;
};

/**
 * Administrator-only delete action for one pediatric bag inspection. Requires
 * an explicit confirmation step before any request is made; the actual
 * authorization is enforced again by the API route and the database RPC —
 * this button is only rendered for administrators.
 */
export default function DeletePediatricInspectionButton({
  inspectionId,
  bagLabel,
  redirectAfterDelete,
}: DeletePediatricInspectionButtonProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openConfirmation() {
    setError(null);
    setConfirming(true);
  }

  function closeConfirmation() {
    if (!deleting) {
      setConfirming(false);
      setError(null);
    }
  }

  async function handleConfirmDelete() {
    setDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/pediatric-bags/inspections/${inspectionId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
        setError(typeof body?.error === "string" ? body.error : "Unable to delete this inspection.");
        setDeleting(false);
        return;
      }

      setConfirming(false);
      setDeleting(false);
      router.refresh();
      if (redirectAfterDelete) {
        router.push(redirectAfterDelete);
      }
    } catch {
      setError("Unable to delete this inspection.");
      setDeleting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openConfirmation}
        aria-label={`Delete Pediatric Bag ${bagLabel} inspection`}
        className="rounded-xl border border-red-500/40 bg-red-950/30 px-3 py-1.5 text-xs font-semibold text-red-200 transition hover:border-red-400/60 hover:bg-red-950/50"
      >
        Delete
      </button>

      {confirming ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm inspection deletion"
        >
          <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-[#242424] p-6">
            <h3 className="text-lg font-bold text-white">Delete Pediatric Bag {bagLabel} inspection?</h3>
            <p className="mt-3 text-sm text-neutral-300">
              This permanently removes this inspection record and its item snapshot. This cannot be undone.
              The bag, the checklist template, and all other inspection history are not affected.
            </p>

            {error ? (
              <p className="mt-3 rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2 text-sm text-red-200">
                {error}
              </p>
            ) : null}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeConfirmation}
                disabled={deleting}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-white/[0.08] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
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
