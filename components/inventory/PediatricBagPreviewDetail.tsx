"use client";

import Link from "next/link";
import { useState } from "react";
import InspectionDisclaimerDialog from "@/components/inventory/InspectionDisclaimerDialog";
import type { PreviewBag, PreviewSection } from "@/lib/pediatric-bags/preview";

type Props = {
  bag: PreviewBag;
  sections: PreviewSection[];
  unresolvedCount: number;
};

/**
 * Read-only preview of a single pediatric bag checklist.
 *
 * Items are large, tappable button-style cards (local visual selection only).
 * The "Complete Inspection" button opens the shared inspection disclaimer so the
 * user can review and agree — but there is NO submit action. Nothing is saved,
 * nothing is written, and no inspection is recorded. This is clearly labeled.
 */
export default function PediatricBagPreviewDetail({ bag, sections, unresolvedCount }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);

  function toggleItem(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-400">Read-Only Preview</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-white">Pediatric Bag {bag.label}</h1>
          <p className="mt-2 text-sm text-neutral-300">
            Preview of the checklist layout. Tapping an item only marks it visually on this screen — nothing is
            saved and no inspection is recorded.
          </p>
        </div>

        <Link
          href="/inventory/ems-pediatric-bags/preview"
          className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-white/[0.08]"
        >
          Back to Preview
        </Link>
      </div>

      <div className="rounded-xl border border-sky-500/40 bg-sky-950/20 px-4 py-3">
        <p className="text-sm font-semibold text-sky-200">
          Read-only preview — item taps are visual only and nothing is saved.
        </p>
        {unresolvedCount > 0 ? (
          <p className="mt-1 text-sm text-sky-100/80">
            {unresolvedCount} item{unresolvedCount === 1 ? "" : "s"} (Alcohol Preps) show the unresolved "***"
            quantity exactly as written in the source.
          </p>
        ) : null}
      </div>

      {sections.map((section) => (
        <section key={section.sectionName} className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-5">
          <h2 className="text-xl font-bold text-white">{section.sectionName}</h2>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
            {section.items.map((item) => {
              const isUnresolved = item.requiredQuantity === null;
              const isSelected = selected.has(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleItem(item.id)}
                  aria-pressed={isSelected}
                  className={`rounded-lg border p-2.5 text-left transition sm:rounded-xl sm:p-4 ${
                    isSelected
                      ? "border-emerald-500/60 bg-emerald-950/30 ring-1 ring-emerald-500/40"
                      : "border-white/10 bg-[#1b1b1b] hover:border-white/25"
                  }`}
                >
                  <p className="text-sm font-semibold leading-snug text-white sm:text-base">{item.itemLabel}</p>
                  <p className="mt-1 text-[10px] uppercase leading-tight tracking-[0.12em] text-neutral-400 sm:text-xs sm:tracking-[0.16em]">
                    {isUnresolved ? (
                      <span className="text-orange-300">Qty: *** (confirm required)</span>
                    ) : (
                      <>Qty: {item.requiredQuantity}</>
                    )}
                    {` · Source: ${item.sourceQuantityText}`}
                  </p>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      <div className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6">
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="inline-flex w-full items-center justify-center rounded-xl bg-red-600 px-8 py-4 text-lg font-bold text-white transition hover:bg-red-700"
        >
          Complete Inspection
        </button>
        <p className="mt-3 text-center text-sm text-neutral-400">
          Preview only — reviewing the disclaimer does not submit or record an inspection.
        </p>
      </div>

      <InspectionDisclaimerDialog
        open={dialogOpen}
        assetLabel={`Pediatric Bag ${bag.label} — read-only preview`}
        onCancel={() => setDialogOpen(false)}
        note="Read-only preview: you can review and agree to this disclaimer, but no inspection can be submitted or recorded here."
      />
    </div>
  );
}
