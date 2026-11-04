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
import { orderApparatusCheckSections } from "@/lib/apparatus/section-order";
import {
  bulkPassTargets,
  isScheduledChecklistItemRequired,
  deficiencyPrefill,
  needsAllPassConfirmation,
  statusLabelsFor,
  unmarkedActionLabel,
  visibleSectionNames,
} from "@/lib/apparatus/daily-checks";
import { useCheckSaturday } from "@/components/apparatus/use-check-saturday";

type ChecklistItemRow = {
  id: string;
  sectionName: string;
  itemLabel: string;
  isRequired: boolean;
  displayOrder: number;
  requiredQuantity: string | null;
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
  specialMode?: boolean;
  checklistInstructions?: string | null;
  initialSaturday?: boolean;
};

export default function ApparatusChecklistWorkspace({
  departmentId,
  apparatusId,
  apparatusName,
  currentMemberId,
  checklistRequired,
  returnTo,
  items,
  progressRows,
  specialMode = false,
  checklistInstructions = null,
  initialSaturday = false,
}: ApparatusChecklistWorkspaceProps) {
  const router = useRouter();
  const [progressState, setProgressState] = useState<ChecklistProgressStateRow[]>(progressRows);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [bulkPassSnapshot, setBulkPassSnapshot] = useState<Map<string, ChecklistProgressStateRow | undefined> | null>(null);
  const [isAllPassConfirmOpen, setIsAllPassConfirmOpen] = useState(false);
  const saturday = useCheckSaturday(initialSaturday);
  const [bulkPassManualEdits, setBulkPassManualEdits] = useState<Set<string>>(new Set());

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

    const sectionOrder = visibleSectionNames(orderApparatusCheckSections(Array.from(groups.keys())), !specialMode || saturday);

    return sectionOrder.map((sectionName) => ({
      sectionName,
      items: (groups.get(sectionName) ?? []).sort((left, right) => left.displayOrder - right.displayOrder),
    }));
  }, [items, specialMode, saturday]);

  const labels = statusLabelsFor(specialMode);

  const progress = useMemo(() => {
    return getChecklistProgress(
      items.map((item) => ({ id: item.id, isRequired: isScheduledChecklistItemRequired(item, specialMode, saturday) })),
      progressState,
    );
  }, [items, progressState, specialMode, saturday]);

  const requiredComplete = progress.requiredCount > 0 && progress.completedRequired >= progress.requiredCount;

  // Bulk All Pass: mark every visible applicable item as checked. On weekdays the
  // hidden Saturday-only section is excluded so optional items are not stamped.
  async function markAllPass() {
    setSaveError(null);
    const applicableItems = bulkPassSnapshot
      ? items.filter((item) => bulkPassSnapshot.has(item.id))
      : bulkPassTargets(items, !specialMode || saturday);
    setSavingItemId("all");

    if (bulkPassSnapshot) {
      const restoreResults = await Promise.all(
        applicableItems.map((item) => {
          if (bulkPassManualEdits.has(item.id)) return Promise.resolve({ error: null });
          const previousRow = bulkPassSnapshot.get(item.id);
          if (previousRow) {
            return supabase
              .from("apparatus_inspection_checklist_progress")
              .upsert(
                {
                  department_id: departmentId,
                  apparatus_id: apparatusId,
                  member_id: currentMemberId,
                  checklist_item_id: item.id,
                  status: previousRow.status,
                  note: previousRow.note,
                },
                { onConflict: "department_id,apparatus_id,member_id,checklist_item_id" },
              );
          }
          return supabase
            .from("apparatus_inspection_checklist_progress")
            .delete()
            .eq("department_id", departmentId)
            .eq("apparatus_id", apparatusId)
            .eq("member_id", currentMemberId)
            .eq("checklist_item_id", item.id);
        }),
      );
      const failedRestore = restoreResults.find((result) => result.error);
      if (failedRestore?.error) {
        setSaveError(failedRestore.error.message || "Unable to undo All Pass.");
      }
      setProgressState((current) => {
          const nextById = new Map(current.map((row) => [row.checklistItemId, row]));
          for (const [index, item] of applicableItems.entries()) {
            if (restoreResults[index].error) continue;
            if (bulkPassManualEdits.has(item.id)) continue;
            const previousRow = bulkPassSnapshot.get(item.id);
            if (previousRow) {
              nextById.set(item.id, previousRow);
            } else {
              nextById.delete(item.id);
            }
          }
          return Array.from(nextById.values());
      });
      const failedIds = new Set(applicableItems.filter((_, index) => restoreResults[index].error).map((item) => item.id));
      const remainingSnapshot = new Map([...bulkPassSnapshot].filter(([id]) => failedIds.has(id)));
      setBulkPassSnapshot(remainingSnapshot.size > 0 ? remainingSnapshot : null);
      setBulkPassManualEdits(new Set());
      setSavingItemId(null);
      return;
    }

    const snapshot = new Map<string, ChecklistProgressStateRow | undefined>();
    for (const item of applicableItems) {
      snapshot.set(item.id, progressState.find((row) => row.checklistItemId === item.id));
    }
    const results = await Promise.all(
      applicableItems.map((item) =>
        supabase
          .from("apparatus_inspection_checklist_progress")
          .upsert(
            {
              department_id: departmentId,
              apparatus_id: apparatusId,
              member_id: currentMemberId,
              checklist_item_id: item.id,
              status: "checked",
              note: null,
            },
            { onConflict: "department_id,apparatus_id,member_id,checklist_item_id" },
          ),
      ),
    );
    const failed = results.find((result) => result.error);
    if (failed?.error) {
      setSaveError(failed.error.message || "Unable to mark all items as pass.");
    }
    for (const [index, item] of applicableItems.entries()) {
      if (results[index].error) snapshot.delete(item.id);
    }
    setProgressState((current) => {
        const nextById = new Map(current.map((row) => [row.checklistItemId, row]));
        for (const [index, item] of applicableItems.entries()) {
          if (results[index].error) {
            continue;
          }
          nextById.set(item.id, { checklistItemId: item.id, status: "checked", note: null });
        }
        return Array.from(nextById.values());
    });
    setBulkPassSnapshot(snapshot.size > 0 ? snapshot : null);
    setBulkPassManualEdits(new Set());
    setSavingItemId(null);
  }

  function handleMarkAllPassRequest() {
    if (needsAllPassConfirmation(bulkPassSnapshot !== null)) {
      setIsAllPassConfirmOpen(true);
      return;
    }
    void markAllPass();
  }

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
    if (bulkPassSnapshot) setBulkPassManualEdits((current) => new Set(current).add(itemId));

    setSavingItemId(null);
  }

  // Clear an item back to Not Checked: remove its persisted progress row so the
  // apparatus checklist (which reloads persisted rows) reopens unselected.
  async function clearItemStatus(itemId: string) {
    setSaveError(null);
    setSavingItemId(itemId);

    const { error } = await supabase
      .from("apparatus_inspection_checklist_progress")
      .delete()
      .eq("department_id", departmentId)
      .eq("apparatus_id", apparatusId)
      .eq("member_id", currentMemberId)
      .eq("checklist_item_id", itemId);

    if (error) {
      setSaveError(error.message || "Unable to clear checklist item.");
      setSavingItemId(null);
      return;
    }

    setProgressState((current) => current.filter((row) => row.checklistItemId !== itemId));
    if (bulkPassSnapshot) setBulkPassManualEdits((current) => new Set(current).add(itemId));
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

      {checklistInstructions ? (
        <section className="rounded-2xl border border-red-500/30 bg-red-500/[0.08] p-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-400">Daily check instructions</p>
          <p className="mt-2 text-sm leading-6 text-neutral-200">{checklistInstructions}</p>
        </section>
      ) : null}

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

        {specialMode ? (
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              disabled={savingItemId !== null || items.length === 0}
              onClick={handleMarkAllPassRequest}
              className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs font-black uppercase tracking-wide text-emerald-100 transition hover:bg-emerald-500/20 disabled:opacity-50"
            >
              {bulkPassSnapshot ? "Undo All Pass" : "All Pass"}
            </button>
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

            <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
              {group.items.map((item) => {
                const currentStatus = statusByItemId.get(item.id) ?? null;

                // Whole-card toggle matching the pediatric bag checklist:
                // tap cycles unselected -> checked (Present) -> deficiency
                // (Missing) -> not_applicable -> clear. The card is the control;
                // there are no inner status buttons.
                function cycleStatus(current: ApparatusChecklistResultStatus | null): ApparatusChecklistResultStatus | null {
                  if (current === null) return "checked";
                  if (current === "checked") return "deficiency";
                  if (current === "deficiency") return "not_applicable";
                  return null; // not_applicable -> clear
                }

                const nextStatus = cycleStatus(currentStatus);

                const isPresent = currentStatus === "checked";
                const isMissing = currentStatus === "deficiency";
                const isNa = currentStatus === "not_applicable";
                const stateLabel = isPresent ? labels.checked : isMissing ? labels.deficiency : isNa ? labels.notApplicable : null;

                return (
                  <div key={item.id}>
                  <button
                    type="button"
                    disabled={savingItemId !== null}
                    aria-pressed={isPresent || isMissing || isNa}
                    aria-label={`${item.itemLabel}: ${isPresent ? `marked ${labels.checked}` : isMissing ? `marked ${labels.deficiency}` : isNa ? "marked Not Applicable" : unmarkedActionLabel(specialMode)}`}
                    onClick={() => {
                      if (nextStatus === null) {
                        void clearItemStatus(item.id);
                      } else {
                        void saveItemStatus(item.id, nextStatus);
                      }
                    }}
                    className={`rounded-lg border p-2.5 text-left transition sm:rounded-xl sm:p-4 ${
                      isPresent
                        ? "border-emerald-500/60 bg-emerald-950/40 ring-1 ring-emerald-500/40"
                        : isMissing
                          ? "border-red-500/60 bg-red-950/40 ring-1 ring-red-500/40"
                          : isNa
                            ? "border-sky-500/60 bg-sky-950/40 ring-1 ring-sky-500/40"
                            : "border-white/10 bg-[#1b1b1b] hover:border-white/25"
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold leading-snug text-white sm:text-base">
                        {item.itemLabel}
                        {item.requiredQuantity ? (
                          <span className="ml-2 inline-block rounded-full border border-sky-500/35 bg-sky-500/15 px-2 py-0.5 align-middle text-[11px] font-bold text-sky-100">
                            Qty: {item.requiredQuantity}
                          </span>
                        ) : null}
                      </p>
                      {stateLabel ? (
                        <span
                          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${
                            isPresent
                              ? "border-emerald-500/50 bg-emerald-950/40 text-emerald-200"
                              : isMissing
                                ? "border-red-500/50 bg-red-950/40 text-red-200"
                                : "border-sky-500/50 bg-sky-950/40 text-sky-200"
                          }`}
                        >
                          {stateLabel}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[10px] uppercase leading-tight tracking-[0.12em] text-neutral-400 sm:text-xs sm:tracking-[0.16em]">
                      {isScheduledChecklistItemRequired(item, specialMode, saturday) ? "Required" : "Optional"}
                    </p>
                  </button>
                  {specialMode && isMissing ? (
                    <Link
                      href={`/deficiencies/report?${new URLSearchParams({
                        apparatusId,
                        returnTo,
                        description: deficiencyPrefill(item.itemLabel, true),
                        checkSessionId: new URL(returnTo, "http://localhost").searchParams.get("checkSessionId") ?? "",
                      })}`}
                      className="mt-2 block text-sm font-semibold text-amber-200"
                    >
                      Report deficiency for Unit {item.itemLabel}
                    </Link>
                  ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}

      {isAllPassConfirmOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-white/15 bg-[#202020] p-6 shadow-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">Confirm All Pass</p>
            <h2 className="mt-2 text-2xl font-black text-white">Mark every apparatus as passed?</h2>
            <p className="mt-4 text-sm leading-6 text-neutral-300">
              Only confirm after you have checked every listed apparatus. Any apparatus that did not pass must be flagged
              individually so a deficiency can be documented for the affected unit.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => setIsAllPassConfirmOpen(false)} className="min-h-14 rounded-xl border border-white/15 px-4 text-sm font-black uppercase text-white/75">Cancel</button>
              <button type="button" onClick={() => { setIsAllPassConfirmOpen(false); void markAllPass(); }} className="min-h-14 rounded-xl bg-emerald-500 px-4 text-sm font-black uppercase text-black">Yes, all passed</button>
            </div>
          </div>
        </div>
      ) : null}

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
