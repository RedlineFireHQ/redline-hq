"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ArchivePrePlanControlsProps = {
  prePlanId: string;
  prePlanName: string;
  canManage: boolean;
};

export default function ArchivePrePlanControls({
  prePlanId,
  prePlanName,
  canManage,
}: ArchivePrePlanControlsProps) {
  const router = useRouter();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!canManage) {
    return null;
  }

  async function archivePrePlan() {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/pre-plans/${prePlanId}`, { method: "POST" });
      const payload = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !payload.ok) {
        setErrorMessage(payload.error || "Unable to archive pre-plan.");
        return;
      }

      router.push("/pre-plans");
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to archive pre-plan.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsConfirmOpen(true)}
        className="inline-flex items-center justify-center rounded-lg border border-red-500/40 bg-red-600/80 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500"
      >
        Archive Pre-Plan
      </button>

      {isConfirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4">
          <div className="w-full max-w-md rounded-2xl border border-red-900 bg-[#242424] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
            <h3 className="text-xl font-bold text-white">Archive Pre-Plan</h3>
            <p className="mt-3 text-sm text-neutral-300">
              This will remove <span className="font-semibold text-white">{prePlanName}</span> from the active pre-plan list while preserving its operational details, photos, documents, hydrants, and hazards.
            </p>

            {errorMessage ? (
              <p className="mt-4 rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2 text-sm text-red-200">
                {errorMessage}
              </p>
            ) : null}

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsConfirmOpen(false)}
                disabled={isSubmitting}
                className="rounded-lg border border-white/15 bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void archivePrePlan()}
                disabled={isSubmitting}
                className="rounded-lg border border-red-500/40 bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Archiving..." : "Confirm Archive"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
