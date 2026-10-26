"use client";

import { useState } from "react";

/**
 * InspectionDisclaimerDialog — presentational confirmation dialog mirroring the
 * apparatus daily-check "Confirm Inspection Completion" dialog
 * (app/apparatus/[id]/daily-check/page.tsx), with the disclaimer wording adapted
 * to the pediatric bag.
 *
 * This is a NEW reusable, display-only component. It does NOT modify the
 * existing apparatus flow, and it performs no submission itself — the parent
 * decides what "confirm" means. In the read-only preview there is no submit
 * action at all.
 */

export const PEDIATRIC_INSPECTION_DISCLAIMER =
  "By completing this inspection, you certify that you have inspected this pediatric bag according to your department's inspection procedures. Any deficiencies identified during the inspection have been reported.";

type InspectionDisclaimerDialogProps = {
  open: boolean;
  assetLabel: string;
  onCancel: () => void;
  /** When provided, a confirm action is shown. Omit for read-only preview. */
  onConfirm?: () => void;
  /** Optional note shown inside the dialog (e.g. read-only limitation). */
  note?: string;
};

export default function InspectionDisclaimerDialog({
  open,
  assetLabel,
  onCancel,
  onConfirm,
  note,
}: InspectionDisclaimerDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Confirm inspection completion"
        className="w-full max-w-xl rounded-2xl border border-neutral-700 bg-[#171717] p-6 shadow-2xl"
      >
        <h3 className="text-xl font-bold text-white">Confirm Inspection Completion</h3>
        <p className="mt-2 text-sm text-neutral-400">{assetLabel}</p>
        <p className="mt-4 text-sm text-neutral-300">{PEDIATRIC_INSPECTION_DISCLAIMER}</p>

        {note ? (
          <p className="mt-4 rounded-lg border border-sky-500/30 bg-sky-950/30 px-3 py-2 text-sm text-sky-200">
            {note}
          </p>
        ) : null}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-neutral-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
          >
            Cancel
          </button>
          {onConfirm ? (
            <button
              type="button"
              onClick={onConfirm}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              Yes, Complete Inspection
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * Hook-free helper: the preview uses local state; this just keeps the dialog
 * API obvious. (No side effects.)
 */
export function useInspectionDisclaimerDialog() {
  const [open, setOpen] = useState(false);
  return {
    open,
    openDialog: () => setOpen(true),
    closeDialog: () => setOpen(false),
  };
}
