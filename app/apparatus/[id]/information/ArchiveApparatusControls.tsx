"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ArchiveApparatusControlsProps = {
  apparatusId: string;
  apparatusName: string;
  canManage: boolean;
  isArchived: boolean;
};

export default function ArchiveApparatusControls({
  apparatusId,
  apparatusName,
  canManage,
  isArchived,
}: ArchiveApparatusControlsProps) {
  const router = useRouter();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!canManage) {
    return null;
  }

  async function handleAction(action: "archive" | "restore") {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/apparatus/${apparatusId}/${action}`, {
        method: "POST",
      });

      const payload = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !payload.ok) {
        setErrorMessage(payload.error || `Unable to ${action} apparatus.`);
        setIsSubmitting(false);
        return;
      }

      setIsConfirmOpen(false);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : `Unable to ${action} apparatus.`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-[#1d1d1d] p-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            window.dispatchEvent(new CustomEvent("redline:open-apparatus-edit"));
          }}
          className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
        >
          Edit Information
        </button>

        {!isArchived ? (
          <button
            type="button"
            onClick={() => setIsConfirmOpen(true)}
            className="rounded-lg border border-red-500/40 bg-red-600/80 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-500"
          >
            Archive Apparatus
          </button>
        ) : (
          <button
            type="button"
            onClick={() => handleAction("restore")}
            className="rounded-lg border border-emerald-500/40 bg-emerald-600/80 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Restoring..." : "Restore Apparatus"}
          </button>
        )}
      </div>

      {errorMessage ? (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {errorMessage}
        </p>
      ) : null}

      {isConfirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4">
          <div className="w-full max-w-md rounded-2xl border border-red-900 bg-[#242424] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
            <h3 className="text-xl font-bold text-white">Archive Apparatus</h3>
            <p className="mt-3 text-sm text-neutral-300">
              This will remove <span className="font-semibold text-white">{apparatusName}</span> from active department operations while preserving its historical records.
            </p>

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsConfirmOpen(false)}
                className="rounded-lg border border-white/15 bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleAction("archive")}
                className="rounded-lg border border-red-500/40 bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Archiving..." : "Confirm Archive"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
