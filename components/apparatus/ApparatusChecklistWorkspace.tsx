"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  getChecklistProgress,
  type ApparatusChecklistProgressRow,
  type ApparatusChecklistResultStatus,
} from "@/lib/apparatus/checklist";

type ChecklistItemRow = {
  id: string;
  sectionName: string;
  itemLabel: string;
  isRequired: boolean;
  displayOrder: number;
};

type ChecklistProgressStateRow = ApparatusChecklistProgressRow & {
  note: string | null;
};

type ApparatusChecklistWorkspaceProps = {
  departmentId: string;
  apparatusId: string;
  apparatusName: string;
  currentMemberId: string;
  checklistRequired: boolean;
  returnTo: string;
  items: ChecklistItemRow[];
  progressRows: ChecklistProgressStateRow[];
};

const STATUS_BUTTONS: Array<{ value: ApparatusChecklistResultStatus; label: string; className: string }> = [
  {
    value: "checked",
    label: "Pass / Checked",
    className: "border-emerald-500/35 bg-emerald-500/15 text-emerald-200",
  },
  {
    value: "deficiency",
    label: "Deficiency / Failed",
    className: "border-amber-500/35 bg-amber-500/15 text-amber-100",
  },
  {
    value: "not_applicable",
    label: "Not Applicable",
    className: "border-sky-500/35 bg-sky-500/15 text-sky-100",
  },
];

function getStatusLabel(value: ApparatusChecklistResultStatus | null) {
  if (value === "checked") {
    return "Pass / Checked";
  }

  if (value === "deficiency") {
    return "Deficiency / Failed";
  }

  if (value === "not_applicable") {
    return "Not Applicable";
  }

  return "Not Marked";
}

export default function ApparatusChecklistWorkspace({
  departmentId,
  apparatusId,
  apparatusName,
  currentMemberId,
  checklistRequired,
  returnTo,
  items,
  progressRows,
}: ApparatusChecklistWorkspaceProps) {
  const router = useRouter();
  const [progressState, setProgressState] = useState<ChecklistProgressStateRow[]>(progressRows);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);

  const statusByItemId = useMemo(() => {
    const map = new Map<string, ApparatusChecklistResultStatus>();
    for (const row of progressState) {
      map.set(row.checklistItemId, row.status);
    }
    return map;
  }, [progressState]);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, ChecklistItemRow[]>();
    for (const item of items) {
      const key = item.sectionName || "General";
      const current = groups.get(key) ?? [];
      current.push(item);
      groups.set(key, current);
    }

    return Array.from(groups.entries()).map(([sectionName, sectionItems]) => ({
      sectionName,
      items: sectionItems.sort((left, right) => left.displayOrder - right.displayOrder),
    }));
  }, [items]);

  const progress = useMemo(() => {
    return getChecklistProgress(
      items.map((item) => ({ id: item.id, isRequired: item.isRequired })),
      progressState,
    );
  }, [items, progressState]);

  const requiredComplete = progress.requiredCount > 0 && progress.completedRequired >= progress.requiredCount;

  async function saveItemStatus(itemId: string, status: ApparatusChecklistResultStatus) {
    setSaveError(null);
    setSavingItemId(itemId);

    const payload = {
      department_id: departmentId,
      apparatus_id: apparatusId,
      member_id: currentMemberId,
      checklist_item_id: itemId,
      status,
      note: null,
    };

    const { data, error } = await supabase
      .from("apparatus_inspection_checklist_progress")
      .upsert(payload, { onConflict: "department_id,apparatus_id,member_id,checklist_item_id" })
      .select("checklist_item_id, status, note")
      .single();

    if (error) {
      setSaveError(error.message || "Unable to save checklist item.");
      setSavingItemId(null);
      return;
    }

    const nextRow: ChecklistProgressStateRow = {
      checklistItemId:
        typeof data?.checklist_item_id === "string" ? data.checklist_item_id : itemId,
      status: (data?.status as ApparatusChecklistResultStatus) ?? status,
      note: typeof data?.note === "string" ? data.note : null,
    };

    setProgressState((current) => {
      const nextById = new Map(current.map((row) => [row.checklistItemId, row]));
      nextById.set(nextRow.checklistItemId, nextRow);
      return Array.from(nextById.values());
    });

    setSavingItemId(null);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-500">Apparatus Check Checklist</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-white">{apparatusName}</h1>
          <p className="mt-2 text-sm text-neutral-300">
            Mark each inspection item. Use Deficiency / Failed when an issue is found.
          </p>
        </div>

        <Link
          href={returnTo}
          className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-white/[0.08]"
        >
          Back to Overall Result
        </Link>
      </div>

      <div className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">Required Items</p>
            <p className="mt-1 text-2xl font-bold text-white">{progress.requiredCount}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">Completed Required</p>
            <p className="mt-1 text-2xl font-bold text-white">{progress.completedRequired}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">Remaining Required</p>
            <p className={`mt-1 text-2xl font-bold ${progress.remainingRequired > 0 ? "text-amber-300" : "text-emerald-300"}`}>
              {progress.remainingRequired}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3 text-sm text-neutral-200">
          {checklistRequired ? (
            requiredComplete ? (
              <p className="text-emerald-300">Checklist Required is ON. All required checklist items are complete.</p>
            ) : (
              <p className="text-amber-300">
                Checklist Required is ON. Complete all required items before submitting the apparatus inspection.
              </p>
            )
          ) : (
            <p className="text-neutral-300">Checklist Required is OFF. This checklist is optional for final submission.</p>
          )}
        </div>

        {saveError ? (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            {saveError}
          </div>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-700 bg-neutral-900/40 p-8 text-center">
          <p className="text-lg font-semibold text-white">No checklist items configured for this apparatus.</p>
          <p className="mt-2 text-sm text-neutral-400">
            Ask an administrator to configure apparatus checklist items.
          </p>
        </div>
      ) : (
        groupedItems.map((group) => (
          <section key={group.sectionName} className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-5">
            <h2 className="text-xl font-bold text-white">{group.sectionName}</h2>

            <div className="mt-4 space-y-3">
              {group.items.map((item) => {
                const currentStatus = statusByItemId.get(item.id) ?? null;
                const isSaving = savingItemId === item.id;

                return (
                  <article key={item.id} className="rounded-xl border border-white/10 bg-[#1b1b1b] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-white">{item.itemLabel}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-neutral-400">
                          {item.isRequired ? "Required" : "Optional"}
                        </p>
                      </div>

                      <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-semibold text-neutral-200">
                        {getStatusLabel(currentStatus)}
                      </span>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      {STATUS_BUTTONS.map((button) => {
                        const isSelected = currentStatus === button.value;
                        return (
                          <button
                            key={button.value}
                            type="button"
                            disabled={isSaving}
                            onClick={() => {
                              void saveItemStatus(item.id, button.value);
                            }}
                            className={`rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                              isSelected
                                ? button.className
                                : "border-white/15 bg-white/[0.03] text-neutral-200 hover:bg-white/[0.08]"
                            } disabled:cursor-not-allowed disabled:opacity-60`}
                          >
                            {button.label}
                          </button>
                        );
                      })}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))
      )}

      <div className="flex justify-end pb-2">
        <button
          type="button"
          onClick={() => {
            router.push(returnTo);
            router.refresh();
          }}
          className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/20"
        >
          Return to Overall Inspection
        </button>
      </div>
    </div>
  );
}
