"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PediatricParticipantsPanel, {
  type PediatricParticipant,
} from "@/components/inventory/PediatricParticipantsPanel";
import type {
  PediatricItemStatus,
  PediatricProgressRow,
  PediatricTemplateItemRow,
} from "@/lib/pediatric-bags/data";
import { evaluatePediatricCompletion } from "@/lib/readiness/pediatric-bag-completion";

type PediatricBagChecklistWorkspaceProps = {
  departmentId: string;
  bagId: string;
  bagLabel: string;
  inspectorName: string;
  currentMemberId: string;
  items: PediatricTemplateItemRow[];
  progressRows: PediatricProgressRow[];
  availableMembers: PediatricParticipant[];
};

// Each inventory item is a single fully-clickable card. Clicking marks the item
// present/checked (green). The whole card is the control; there are no inner
// status buttons.

export default function PediatricBagChecklistWorkspace({
  departmentId,
  bagId,
  bagLabel,
  inspectorName,
  currentMemberId,
  items,
  progressRows: _progressRows,
  availableMembers,
}: PediatricBagChecklistWorkspaceProps) {
  const router = useRouter();
  // A new inspection always starts with every item unchecked. The persisted
  // pediatric_bag_checklist_progress rows are tied to a check session, not to a
  // completed inspection, so a previously completed bag would otherwise reopen
  // with its last checks still applied. We intentionally start from an empty
  // local checklist state and ignore the preloaded `progressRows`.
  const [progressState, setProgressState] = useState<PediatricProgressRow[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [completionMessage, setCompletionMessage] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

  // Create/get the in-progress check session on mount so personnel can be added
  // before completion and so completion reuses the same session.
  useEffect(() => {
    let cancelled = false;
    async function initSession() {
      const { data, error } = await supabase.rpc("get_or_create_pediatric_bag_check_session", {
        p_pediatric_bag_id: bagId,
        p_existing_session_id: null,
        p_selected_result: null,
      });
      if (cancelled) {
        return;
      }
      if (error || typeof data !== "string") {
        setSessionError(error?.message || "Unable to start this pediatric bag check session.");
        return;
      }
      setSessionId(data);
    }
    void initSession();
    return () => {
      cancelled = true;
    };
  }, [bagId]);

  const statusByItemId = useMemo(() => {
    const map = new Map<string, PediatricItemStatus>();
    for (const row of progressState) {
      map.set(row.checklistItemId, row.status);
    }
    return map;
  }, [progressState]);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, PediatricTemplateItemRow[]>();
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

  const unresolvedQuantityCount = useMemo(
    () => items.filter((item) => item.isRequired && item.requiredQuantity === null).length,
    [items],
  );

  const decision = useMemo(() => {
    return evaluatePediatricCompletion({
      finalStatus: "needs_attention",
      templateItems: items.map((item) => ({
        requiredQuantity: item.requiredQuantity,
        isRequired: item.isRequired,
        isActive: true,
      })),
      progress: items.map((item) => ({
        item: { requiredQuantity: item.requiredQuantity, isRequired: item.isRequired, isActive: true },
        status: statusByItemId.get(item.id) ?? null,
      })),
    });
  }, [items, statusByItemId]);

  async function saveItemStatus(itemId: string, status: PediatricItemStatus) {
    setSaveError(null);
    setSavingItemId(itemId);

    const { data, error } = await supabase
      .from("pediatric_bag_checklist_progress")
      .upsert(
        {
          department_id: departmentId,
          pediatric_bag_id: bagId,
          member_id: currentMemberId,
          checklist_item_id: itemId,
          status,
          note: null,
        },
        { onConflict: "department_id,pediatric_bag_id,member_id,checklist_item_id" },
      )
      .select("checklist_item_id, status")
      .single();

    if (error) {
      setSaveError(error.message || "Unable to save checklist item.");
      setSavingItemId(null);
      return;
    }

    const nextRow: PediatricProgressRow = {
      checklistItemId:
        typeof data?.checklist_item_id === "string" ? data.checklist_item_id : itemId,
      status: (data?.status as PediatricItemStatus) ?? status,
    };

    setProgressState((current) => {
      const nextById = new Map(current.map((row) => [row.checklistItemId, row]));
      nextById.set(nextRow.checklistItemId, nextRow);
      return Array.from(nextById.values());
    });

    setSavingItemId(null);
  }

  // Toggle a card: clicking cycles the item through EXPIRED → PASS → clear.
  // EXPIRED marks the item expired (documented); PASS marks it present. The
  // Toggle a card: first click marks PASS (green), second click marks EXPIRED
  // (red), third click returns to PASS. The item starts unselected; the first
  // click always selects PASS. The snapshot is captured from this session's
  // state at completion time.
  function toggleItem(itemId: string) {
    const current = statusByItemId.get(itemId) ?? null;
    if (current === "checked") {
      // PASS → EXPIRED.
      void saveItemStatus(itemId, "expired");
      return;
    }
    // EXPIRED or unselected → PASS.
    void saveItemStatus(itemId, "checked");
  }

  async function completeCheck() {
    setCompleting(true);
    setCompletionMessage(null);

    // No overall condition selector: the recorded outcome is derived entirely
    // from the checklist itself. Any unmarked item, EXPIRED item, or unconfirmed
    // quantity means the bag is not fully ready; otherwise it is ready.
    const uncheckedCount = items.filter((item) => !statusByItemId.get(item.id)).length;
    const unresolvedCount = items.filter(
      (item) => item.isRequired && item.requiredQuantity === null,
    ).length;
    const expiredCount = items.filter(
      (item) => statusByItemId.get(item.id) === "expired",
    ).length;
    const derivedStatus: "ready" | "needs_attention" =
      uncheckedCount > 0 || unresolvedCount > 0 || expiredCount > 0 ? "needs_attention" : "ready";

    // Reuse the session created on mount so personnel added during this check
    // are recorded on the same session/inspection.
    const { data: resolvedSessionId, error: sessionError } = await supabase.rpc(
      "get_or_create_pediatric_bag_check_session",
      { p_pediatric_bag_id: bagId, p_existing_session_id: sessionId, p_selected_result: derivedStatus },
    );

    if (sessionError || typeof resolvedSessionId !== "string") {
      setCompletionMessage(sessionError?.message || "Unable to start this pediatric bag check.");
      setCompleting(false);
      return;
    }

    const { error: completeError } = await supabase.rpc("complete_pediatric_bag_check", {
      p_session_id: resolvedSessionId,
      p_final_status: derivedStatus,
      p_notes: null,
    });

    if (completeError) {
      setCompletionMessage(completeError.message || "Unable to complete this pediatric bag check.");
      setCompleting(false);
      return;
    }

    // Only reached after a successful save (every error path above returns
    // early). Navigate back to the Pediatric Bags view in EMS Supplies so the
    // user lands on the four-bag overview instead of staying on the completed
    // checklist.
    router.push("/inventory/ems-supplies?view=pediatric-bags");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-500">Pediatric Bag Checklist</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-white">Pediatric Bag {bagLabel}</h1>
          <p className="mt-2 text-sm text-neutral-300">
            Inspector: {inspectorName}. Mark each item individually. Use Deficiency when an item is short or missing.
          </p>
        </div>

        <Link
          href="/inventory/ems-pediatric-bags"
          className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-white/[0.08]"
        >
          Back to Pediatric Bags
        </Link>
      </div>

      {unresolvedQuantityCount > 0 ? (
        <div className="rounded-xl border border-orange-500/40 bg-orange-950/20 px-4 py-3">
          <p className="text-sm font-semibold text-orange-200">
            {unresolvedQuantityCount} item{unresolvedQuantityCount === 1 ? "" : "s"} (Alcohol Preps) have an
            unconfirmed quantity marked "***" in the source inventory.
          </p>
          <p className="mt-1 text-sm text-orange-100/80">
            These items are flagged for follow-up until Red Oak confirms the quantity.
          </p>
        </div>
      ) : null}

      {saveError ? (
        <div className="rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          {saveError}
        </div>
      ) : null}

      {groupedItems.map((group) => (
        <section key={group.sectionName} className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-5">
          <h2 className="text-xl font-bold text-white">{group.sectionName}</h2>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
            {group.items.map((item) => {
              const currentStatus = statusByItemId.get(item.id) ?? null;
              const isSaving = savingItemId === item.id;
              const isUnresolved = item.requiredQuantity === null;

              const isPass = currentStatus === "checked";
              const isExpired = currentStatus === "expired";
              const stateLabel = isPass ? "PASS" : isExpired ? "EXPIRED" : "TAP TO MARK";

              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={isSaving}
                  aria-pressed={isPass || isExpired}
                  aria-label={`${item.itemLabel}: ${isPass ? "marked PASS" : isExpired ? "marked EXPIRED" : "mark EXPIRED"}`}
                  onClick={() => {
                    toggleItem(item.id);
                  }}
                  className={`rounded-lg border p-2.5 text-left transition sm:rounded-xl sm:p-4 ${
                    isPass
                      ? "border-emerald-500/60 bg-emerald-950/40 ring-1 ring-emerald-500/40"
                      : isExpired
                        ? "border-red-500/60 bg-red-950/40 ring-1 ring-red-500/40"
                        : "border-white/10 bg-[#1b1b1b] hover:border-white/25"
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold leading-snug text-white sm:text-base">{item.itemLabel}</p>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${
                        isPass
                          ? "border-emerald-500/50 bg-emerald-950/40 text-emerald-200"
                          : isExpired
                            ? "border-red-500/50 bg-red-950/40 text-red-200"
                            : "border-white/15 bg-white/[0.03] text-neutral-400"
                      }`}
                    >
                      {stateLabel}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] uppercase leading-tight tracking-[0.12em] text-neutral-400 sm:text-xs sm:tracking-[0.16em]">
                    {isUnresolved ? (
                      <span className="text-orange-300">Qty: *** (confirm required)</span>
                    ) : (
                      <>Qty: {item.requiredQuantity}</>
                    )}
                    {item.sourceQuantityText ? ` · Source: ${item.sourceQuantityText}` : ""}
                  </p>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {sessionId ? (
        <PediatricParticipantsPanel
          departmentId={departmentId}
          sessionId={sessionId}
          currentMemberId={currentMemberId}
          currentMemberName={inspectorName}
          initialParticipants={[]}
          availableMembers={availableMembers}
        />
      ) : sessionError ? (
        <div className="rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          {sessionError}
        </div>
      ) : null}

      <section className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6">
        <h2 className="text-2xl font-bold text-white">Complete This Check</h2>
        <p className="mt-3 text-sm text-neutral-300">
          By completing this inspection, you certify that you have inspected this pediatric bag according to your
          department&apos;s inspection procedures and marked each item above. Any deficiencies you identified have
          been recorded on the individual items.
        </p>

        {!decision.allowed ? (
          <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">
            {decision.reason}
          </p>
        ) : null}

        {completionMessage ? (
          <p className="mt-4 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-neutral-200">
            {completionMessage}
          </p>
        ) : null}

        <button
          type="button"
          disabled={completing}
          onClick={() => {
            void completeCheck();
          }}
          className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-red-600 px-8 py-4 text-lg font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-900/60 disabled:text-white/70"
        >
          {completing ? "Recording…" : "Complete Inspection"}
        </button>
      </section>
    </div>
  );
}
