"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { ApparatusChecklistResultStatus } from "@/lib/apparatus/checklist";

type ChecklistItem = {
  id: string;
  sectionName: string;
  itemLabel: string;
  isRequired: boolean;
  displayOrder: number;
};

type ProgressRow = {
  checklistItemId: string;
  status: ApparatusChecklistResultStatus;
};

type Option = { id: string; name: string };
type Participant = { memberId: string; name: string };

function uniqueParticipants(participants: Participant[]) {
  return Array.from(new Map(participants.map((participant) => [participant.memberId, participant])).values());
}

function participantIds(participants: Participant[]) {
  return uniqueParticipants(participants).map((participant) => participant.memberId).sort().join(",");
}

type MobileApparatusCheckProps = {
  apparatusId: string;
  apparatusName: string;
  departmentId: string;
  memberId: string;
  memberName: string;
  sessionOwnerMemberId: string;
  sessionId: string | null;
  checklistRequired: boolean;
  checklistItems: ChecklistItem[];
  initialProgress: ProgressRow[];
  categories: Option[];
  priorities: Option[];
  openStatusId: string;
  initialCompletedStatus: string | null;
  helperParticipants: Participant[];
  availableHelpers: Participant[];
  memberLookupError: string | null;
};

const resultOptions = [
  { value: "ready", label: "Ready for Service", tone: "border-emerald-400/50 bg-emerald-500/15 text-emerald-100" },
  { value: "needs_attention", label: "Ready for Service with Deficiencies", tone: "border-amber-400/50 bg-amber-500/15 text-amber-100" },
  { value: "out_of_service", label: "Out of Service", tone: "border-red-400/50 bg-red-500/15 text-red-100" },
] as const;

const statusOptions: Array<{ value: ApparatusChecklistResultStatus; label: string; tone: string }> = [
  { value: "checked", label: "PASS", tone: "border-emerald-400/60 bg-emerald-500/20 text-emerald-100" },
  { value: "deficiency", label: "DEFICIENCY", tone: "border-amber-400/60 bg-amber-500/20 text-amber-100" },
  { value: "not_applicable", label: "N/A", tone: "border-sky-400/60 bg-sky-500/20 text-sky-100" },
];

export default function MobileApparatusCheck({
  apparatusId,
  apparatusName,
  departmentId,
  memberId,
  memberName,
  sessionOwnerMemberId,
  sessionId,
  checklistRequired,
  checklistItems,
  initialProgress,
  categories,
  priorities,
  openStatusId,
  initialCompletedStatus,
  helperParticipants,
  availableHelpers,
  memberLookupError,
}: MobileApparatusCheckProps) {
  const router = useRouter();
  const [progress, setProgress] = useState(new Map(initialProgress.map((row) => [row.checklistItemId, row.status])));
  const [selectedResult, setSelectedResult] = useState<string | null>(null);
  const [isChecklistOpen, setIsChecklistOpen] = useState(false);
  const [bulkPassSnapshot, setBulkPassSnapshot] = useState<Map<string, ApparatusChecklistResultStatus | undefined> | null>(null);
  const [bulkPassManualEdits, setBulkPassManualEdits] = useState<Set<string>>(new Set());
  const [currentHelpers, setCurrentHelpers] = useState(() => uniqueParticipants(helperParticipants));
  const [locallyAddedHelperIds, setLocallyAddedHelperIds] = useState<Set<string>>(() => new Set());
  const [locallyRemovedHelpers, setLocallyRemovedHelpers] = useState<Participant[]>([]);
  const [helperSearch, setHelperSearch] = useState("");
  const [helperError, setHelperError] = useState<string | null>(null);
  const [pendingHelperId, setPendingHelperId] = useState<string | null>(null);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDeficiencyOpen, setIsDeficiencyOpen] = useState(false);
  const [deficiencyItem, setDeficiencyItem] = useState<ChecklistItem | null>(null);
  const [deficiencyDescription, setDeficiencyDescription] = useState("");
  const [deficiencyCategoryId, setDeficiencyCategoryId] = useState(categories[0]?.id ?? "");
  const [deficiencyPriorityId, setDeficiencyPriorityId] = useState(priorities[0]?.id ?? "");
  const [deficiencyPhoto, setDeficiencyPhoto] = useState<File | null>(null);
  const [isSavingDeficiency, setIsSavingDeficiency] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const syncedParticipantPropsRef = useRef({
    sessionId,
    memberId,
    helperIds: participantIds(helperParticipants),
    availableIds: participantIds(availableHelpers),
  });

  const groupedItems = checklistItems.reduce<Map<string, ChecklistItem[]>>((groups, item) => {
    const section = groups.get(item.sectionName || "General") ?? [];
    section.push(item);
    groups.set(item.sectionName || "General", section);
    return groups;
  }, new Map());
  const requiredItems = checklistItems.filter((item) => item.isRequired);
  const completedRequired = requiredItems.filter((item) => progress.has(item.id)).length;
  const requiredComplete = !checklistRequired || (requiredItems.length > 0 && completedRequired === requiredItems.length);
  const availableMemberOptions = uniqueParticipants([
    ...availableHelpers,
    ...locallyRemovedHelpers,
  ]).filter((helper) => !currentHelpers.some((current) => current.memberId === helper.memberId) && !locallyAddedHelperIds.has(helper.memberId));
  const filteredAvailableHelpers = uniqueParticipants(availableMemberOptions).filter((helper) =>
    helper.name.toLowerCase().includes(helperSearch.trim().toLowerCase()),
  );
  const returnTo = `/mobile/apparatus-checks/${apparatusId}`;

  useEffect(() => {
    if (pendingHelperId) {
      return;
    }

    const nextSignature = {
      sessionId,
      memberId,
      helperIds: participantIds(helperParticipants),
      availableIds: participantIds(availableHelpers),
    };
    const previousSignature = syncedParticipantPropsRef.current;
    const propsChanged =
      previousSignature.sessionId !== nextSignature.sessionId ||
      previousSignature.memberId !== nextSignature.memberId ||
      previousSignature.helperIds !== nextSignature.helperIds ||
      previousSignature.availableIds !== nextSignature.availableIds;

    if (!propsChanged) {
      return;
    }

    setCurrentHelpers(uniqueParticipants(helperParticipants));
    setLocallyAddedHelperIds(new Set());
    setLocallyRemovedHelpers([]);
    syncedParticipantPropsRef.current = nextSignature;
  }, [availableHelpers, helperParticipants, memberId, pendingHelperId, sessionId]);

  async function saveChecklistStatus(item: ChecklistItem, status: ApparatusChecklistResultStatus) {
    setError(null);
    setSavingItemId(item.id);
    const { error: saveError } = await supabase
      .from("apparatus_inspection_checklist_progress")
      .upsert(
        {
          department_id: departmentId,
          apparatus_id: apparatusId,
          member_id: memberId,
          checklist_item_id: item.id,
          status,
          note: null,
        },
        { onConflict: "department_id,apparatus_id,member_id,checklist_item_id" },
      );
    if (saveError) {
      setError(saveError.message || "Unable to save this checklist item.");
      setSavingItemId(null);
      return;
    }
    setProgress((current) => new Map(current).set(item.id, status));
    if (bulkPassSnapshot) {
      setBulkPassManualEdits((current) => new Set(current).add(item.id));
    }
    setSavingItemId(null);
    if (status === "deficiency") {
      setDeficiencyItem(item);
      setIsDeficiencyOpen(true);
    }
  }

  async function markAllPass() {
    setError(null);
    const applicableItems = checklistItems;
    setSavingItemId("all");

    if (bulkPassSnapshot) {
      const restoreResults = await Promise.all(
        applicableItems.map((item) => {
          if (bulkPassManualEdits.has(item.id)) {
            return Promise.resolve({ error: null });
          }

          const previousStatus = bulkPassSnapshot.get(item.id);
          if (previousStatus) {
            return supabase
              .from("apparatus_inspection_checklist_progress")
              .upsert(
                {
                  department_id: departmentId,
                  apparatus_id: apparatusId,
                  member_id: memberId,
                  checklist_item_id: item.id,
                  status: previousStatus,
                  note: null,
                },
                { onConflict: "department_id,apparatus_id,member_id,checklist_item_id" },
              );
          }

          return supabase
            .from("apparatus_inspection_checklist_progress")
            .delete()
            .eq("department_id", departmentId)
            .eq("apparatus_id", apparatusId)
            .eq("member_id", memberId)
            .eq("checklist_item_id", item.id)
            .select("checklist_item_id")
            .then((result) => ({
              error: result.error ?? (result.data?.length === 1 ? null : new Error("Checklist progress row was not deleted.")),
            }));
        }),
      );
      const failedRestore = restoreResults.find((result) => result.error);
      if (failedRestore?.error) {
        setError(failedRestore.error.message || "Unable to undo Mark All Pass.");
      } else {
        setProgress((current) => {
          const next = new Map(current);
          for (const item of applicableItems) {
            if (!bulkPassManualEdits.has(item.id)) {
              const previousStatus = bulkPassSnapshot.get(item.id);
              if (previousStatus) next.set(item.id, previousStatus);
              else next.delete(item.id);
            }
          }
          return next;
        });
        setBulkPassSnapshot(null);
        setBulkPassManualEdits(new Set());
      }
      setSavingItemId(null);
      return;
    }

    const snapshot = new Map<string, ApparatusChecklistResultStatus | undefined>();
    for (const item of applicableItems) {
      snapshot.set(item.id, progress.get(item.id));
    }
    const results = await Promise.all(
      applicableItems.map((item) =>
        supabase
          .from("apparatus_inspection_checklist_progress")
          .upsert(
            {
              department_id: departmentId,
              apparatus_id: apparatusId,
              member_id: memberId,
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
      setError(failed.error.message || "Unable to mark all checklist items as pass.");
    } else {
      setProgress((current) => {
        const next = new Map(current);
        for (const item of applicableItems) next.set(item.id, "checked");
        return next;
      });
      setBulkPassSnapshot(snapshot);
      setBulkPassManualEdits(new Set());
    }
    setSavingItemId(null);
  }

  async function updateHelper(member: Participant, action: "add" | "remove") {
    if (!sessionId) return;
    setHelperError(null);
    setPendingHelperId(member.memberId);
    if (action === "add") {
      const { data: authenticatedUser, error: authenticatedUserError } = await supabase.auth.getUser();
      if (
        authenticatedUserError ||
        !authenticatedUser.user?.id ||
        !memberId ||
        sessionOwnerMemberId !== memberId ||
        !(await supabase
          .from("members")
          .select("id")
          .eq("id", sessionOwnerMemberId)
          .eq("auth_user_id", authenticatedUser.user.id)
          .maybeSingle()).data
      ) {
        setHelperError("Your active session changed. Refreshing participant data...");
        setPendingHelperId(null);
        router.refresh();
        return;
      }
    }
    const query = action === "add"
      ? supabase.from("apparatus_check_session_members").upsert(
          [{ session_id: sessionId, department_id: departmentId, member_id: member.memberId, added_by_member_id: sessionOwnerMemberId }],
          { onConflict: "session_id,member_id", ignoreDuplicates: true },
        )
      : supabase.from("apparatus_check_session_members").delete().eq("session_id", sessionId).eq("member_id", member.memberId);
    const { error: helperMutationError } = await query;
    if (helperMutationError) {
      setHelperError(helperMutationError.message || "Unable to update participants.");
    } else if (action === "add") {
      setCurrentHelpers((current) => uniqueParticipants([...current, member]));
      setLocallyAddedHelperIds((current) => new Set(current).add(member.memberId));
      setLocallyRemovedHelpers((current) => current.filter((item) => item.memberId !== member.memberId));
      setHelperSearch("");
    } else {
      setCurrentHelpers((current) => current.filter((item) => item.memberId !== member.memberId));
      setLocallyAddedHelperIds((current) => {
        const next = new Set(current);
        next.delete(member.memberId);
        return next;
      });
      setLocallyRemovedHelpers((current) => uniqueParticipants([...current, member]));
    }
    setPendingHelperId(null);
  }

  async function saveDeficiency() {
    if (!sessionId || !deficiencyDescription.trim() || !deficiencyCategoryId || !deficiencyPriorityId || !openStatusId) {
      setError("Add a description, category, and priority before saving the deficiency.");
      return;
    }
    setIsSavingDeficiency(true);
    setError(null);
    const deficiencyId = crypto.randomUUID();
    let photoPath: string | null = null;
    if (deficiencyPhoto) {
      const safeName = deficiencyPhoto.name.replace(/[^a-zA-Z0-9.-]/g, "_") || "photo.jpg";
      photoPath = `${deficiencyId}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("deficiency-photos").upload(photoPath, deficiencyPhoto, { cacheControl: "3600", upsert: false });
      if (uploadError) {
        setError(uploadError.message || "Unable to upload the photo.");
        setIsSavingDeficiency(false);
        return;
      }
    }
    const { error: insertError } = await supabase.from("deficiencies").insert({
      id: deficiencyId,
      department_id: departmentId,
      apparatus_id: apparatusId,
      reported_by: memberId,
      category_id: deficiencyCategoryId,
      priority: deficiencyPriorityId,
      status: openStatusId,
      description: deficiencyDescription.trim(),
      photo_path: photoPath,
      check_session_id: sessionId,
    });
    if (insertError) {
      setError(insertError.message || "Unable to save the deficiency.");
      setIsSavingDeficiency(false);
      return;
    }
    await supabase.from("deficiency_history").insert({
      deficiency_id: deficiencyId,
      event_type: "Reported",
      event_description: "Deficiency reported during apparatus check.",
      member_id: memberId,
    });
    setIsDeficiencyOpen(false);
    setDeficiencyDescription("");
    setDeficiencyPhoto(null);
    setIsSavingDeficiency(false);
  }

  async function submitCheck() {
    if (!sessionId || !selectedResult || !requiredComplete) return;
    setIsSubmitting(true);
    const { error: submitError } = await supabase.rpc("complete_apparatus_check", {
      p_session_id: sessionId,
      p_final_status: selectedResult,
      p_notes: null,
      p_mileage: null,
      p_engine_hours: null,
    });
    if (submitError) {
      setError(submitError.message || "Unable to complete this apparatus check.");
      setIsSubmitting(false);
      setIsConfirmOpen(false);
      return;
    }
    router.push("/mobile/apparatus-checks");
  }

  if (initialCompletedStatus) {
    return (
      <main className="min-h-screen bg-[#101010] px-4 py-6 text-white sm:px-8">
        <div className="mx-auto max-w-3xl rounded-3xl border border-emerald-400/30 bg-emerald-500/10 p-6 sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Check complete</p>
          <h1 className="mt-3 text-3xl font-black">{apparatusName}</h1>
          <p className="mt-3 text-white/75">This apparatus already has a completed check for today.</p>
          <Link href="/mobile/apparatus-checks" className="mt-8 inline-flex min-h-14 items-center rounded-xl bg-white px-5 text-sm font-black uppercase tracking-wide text-black">Choose another apparatus</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#101010] px-4 pb-8 pt-4 text-white sm:px-8 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
          <Link href="/mobile/apparatus-checks" className="inline-flex min-h-12 items-center text-sm font-bold text-white/65">Back to apparatus</Link>
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#ef2b2d]">Operational check</span>
        </div>

        <header className="py-5 sm:flex sm:items-end sm:justify-between sm:gap-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/50">Apparatus</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">{apparatusName}</h1>
          </div>
        </header>

        {error ? <div className="mb-4 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100">{error}</div> : null}

        <section className="rounded-2xl border border-white/10 bg-[#1b1b1b] p-4 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ef2b2d]">Overall result</p>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            {resultOptions.map((option) => (
              <button key={option.value} type="button" onClick={() => setSelectedResult(option.value)} className={`min-h-16 rounded-xl border p-4 text-left text-sm font-black uppercase leading-5 transition active:scale-[0.99] ${selectedResult === option.value ? option.tone : "border-white/15 bg-white/[0.04] text-white/80"}`}>
                {option.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => { setDeficiencyItem(null); setIsDeficiencyOpen(true); }} className="mt-4 min-h-12 rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 text-sm font-black uppercase tracking-wide text-amber-100">
            Document a deficiency
          </button>
        </section>

        {checklistRequired ? (
          <section className="mt-5 rounded-2xl border border-white/10 bg-[#1b1b1b] p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ef2b2d]">Required checklist</p>
                <h2 className="mt-1 text-2xl font-black">{completedRequired}/{requiredItems.length} required complete</h2>
              </div>
              <button type="button" onClick={() => setIsChecklistOpen((current) => !current)} className="min-h-14 rounded-xl bg-white px-5 text-sm font-black uppercase tracking-wide text-black">
                {isChecklistOpen ? "Close Checklist" : "Open Checklist"}
              </button>
            </div>
            {!requiredComplete ? <p className="mt-3 text-sm font-semibold text-amber-200">Complete every required item before submitting.</p> : null}
          </section>
        ) : null}

        {checklistRequired && isChecklistOpen ? (
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div className="lg:col-span-2 flex justify-end">
              <button type="button" disabled={savingItemId !== null || checklistItems.length === 0} onClick={() => void markAllPass()} className="min-h-12 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 text-xs font-black uppercase tracking-wide text-emerald-100 disabled:opacity-50">
                {bulkPassSnapshot ? "Undo Mark All Pass" : "Mark All Pass"}
              </button>
            </div>
          {Array.from(groupedItems.entries()).map(([section, items]) => (
            <section key={section} className="rounded-2xl border border-white/10 bg-[#1b1b1b] p-4 sm:p-5">
              <h2 className="text-xl font-black">{section}</h2>
              <div className="mt-4 space-y-3">
                {items.sort((left, right) => left.displayOrder - right.displayOrder).map((item) => {
                  const currentStatus = progress.get(item.id);
                  return (
                    <article key={item.id} className="rounded-xl border border-white/10 bg-[#101010] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-bold leading-6">{item.itemLabel}</p>
                          {item.isRequired ? <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.15em] text-white/45">Required</p> : null}
                        </div>
                        <span className="text-xs font-bold uppercase text-white/45">{currentStatus === "checked" ? "Pass" : currentStatus === "deficiency" ? "Deficiency" : currentStatus === "not_applicable" ? "N/A" : "Open"}</span>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {statusOptions.map((option) => (
                          <button key={option.value} type="button" disabled={savingItemId === item.id} onClick={() => void saveChecklistStatus(item, option.value)} className={`min-h-14 rounded-lg border px-2 text-[11px] font-black leading-tight tracking-wide transition active:scale-[0.98] ${currentStatus === option.value ? option.tone : "border-white/15 bg-white/[0.04] text-white/75"}`}>
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
          </div>
        ) : null}

        {sessionId ? (
          <section className="mt-5 rounded-2xl border border-white/10 bg-[#1b1b1b] p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ef2b2d]">Participants</p>
                <h2 className="mt-1 text-xl font-black">Completed by {memberName}</h2>
                <p className="mt-1 text-sm text-white/60">{currentHelpers.length > 0 ? `Assisted by ${currentHelpers.map((helper) => helper.name).join(", ")}` : "No helpers added"}</p>
              </div>
              <span className="text-sm font-bold text-white/60">{currentHelpers.length + 1} total</span>
            </div>
            {helperError || memberLookupError ? <p className="mt-3 rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">{helperError ?? memberLookupError}</p> : null}
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
              <input value={helperSearch} onChange={(event) => setHelperSearch(event.target.value)} placeholder="Search department members" className="min-h-12 rounded-xl border border-white/15 bg-[#101010] px-4 text-base text-white outline-none" />
              <span className="hidden items-center text-xs text-white/45 sm:flex">Add helpers for participation credit</span>
            </div>
            {availableMemberOptions.length === 0 ? (
              <p className="mt-3 text-sm text-white/60">All available members are already added.</p>
            ) : filteredAvailableHelpers.length === 0 ? (
              <p className="mt-3 text-sm text-white/60">No members match that search.</p>
            ) : (
              <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                {filteredAvailableHelpers.map((helper) => (
                  <button key={helper.memberId} type="button" disabled={pendingHelperId === helper.memberId} onClick={() => void updateHelper(helper, "add")} className="flex min-h-14 w-full items-center justify-between rounded-xl border border-white/10 bg-[#101010] px-4 text-left text-sm font-bold active:scale-[0.99]">
                    <span>{helper.name}</span>
                    <span className="text-[#ef2b2d]">Add</span>
                  </button>
                ))}
              </div>
            )}
            {currentHelpers.length > 0 ? <div className="mt-3 flex flex-wrap gap-2">{currentHelpers.map((helper) => <button key={helper.memberId} type="button" disabled={pendingHelperId === helper.memberId} onClick={() => void updateHelper(helper, "remove")} className="min-h-11 rounded-xl border border-white/15 bg-white/[0.04] px-3 text-sm font-bold text-white/80">{helper.name} ×</button>)}</div> : null}
          </section>
        ) : null}
      </div>

      <div className="mt-5 border-t border-white/10 bg-[#111]/95 p-3 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <p className="hidden text-sm font-semibold text-white/65 sm:block">{selectedResult ? "Ready to submit when the check is complete." : "Select the overall result."}</p>
          <button type="button" disabled={!selectedResult || !requiredComplete || isSubmitting} onClick={() => setIsConfirmOpen(true)} className="min-h-14 w-full rounded-xl bg-[#ef2b2d] px-5 text-base font-black uppercase tracking-wide text-white disabled:cursor-not-allowed disabled:bg-white/15 disabled:text-white/40 sm:ml-auto sm:w-auto sm:min-w-64">
            {isSubmitting ? "Submitting..." : "Complete Check"}
          </button>
        </div>
      </div>

      {isDeficiencyOpen ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/75 p-3 sm:items-center sm:p-6">
          <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/15 bg-[#202020] p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-300">Deficiency report</p><h2 className="mt-1 text-2xl font-black">{deficiencyItem?.itemLabel ?? apparatusName}</h2></div><button type="button" onClick={() => setIsDeficiencyOpen(false)} className="min-h-12 min-w-12 rounded-xl border border-white/15 text-xl text-white/75" aria-label="Close deficiency panel">×</button></div>
            <label className="mt-5 block text-sm font-bold text-white/75">Description<textarea value={deficiencyDescription} onChange={(event) => setDeficiencyDescription(event.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-white/15 bg-[#101010] p-3 text-base text-white outline-none" placeholder="Describe what was found" /></label>
            <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold text-white/75">Category<select value={deficiencyCategoryId} onChange={(event) => setDeficiencyCategoryId(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-[#101010] px-3 text-white">{categories.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label><label className="text-sm font-bold text-white/75">Priority<select value={deficiencyPriorityId} onChange={(event) => setDeficiencyPriorityId(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-[#101010] px-3 text-white">{priorities.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label></div>
            <label className="mt-4 block text-sm font-bold text-white/75">Photo<input type="file" accept="image/*" capture="environment" onChange={(event) => setDeficiencyPhoto(event.target.files?.[0] ?? null)} className="mt-2 block min-h-12 w-full rounded-xl border border-white/15 bg-[#101010] p-3 text-sm text-white/70" /></label>
            <button type="button" disabled={isSavingDeficiency} onClick={() => void saveDeficiency()} className="mt-5 min-h-14 w-full rounded-xl bg-amber-500 px-4 text-sm font-black uppercase tracking-wide text-black disabled:opacity-50">{isSavingDeficiency ? "Saving deficiency..." : "Save deficiency"}</button>
          </div>
        </div>
      ) : null}

      {isConfirmOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4"><div className="w-full max-w-xl rounded-2xl border border-white/15 bg-[#202020] p-6 shadow-2xl"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ef2b2d]">Confirm inspection</p><h2 className="mt-2 text-2xl font-black">Complete this apparatus check?</h2><p className="mt-4 text-sm leading-6 text-white/75">By completing this inspection, you certify that you have inspected this apparatus according to your department&apos;s inspection procedures. Any deficiencies identified during the inspection have been reported.</p><div className="mt-6 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => setIsConfirmOpen(false)} className="min-h-14 rounded-xl border border-white/15 px-4 text-sm font-black uppercase text-white/75">Cancel</button><button type="button" onClick={() => void submitCheck()} className="min-h-14 rounded-xl bg-[#ef2b2d] px-4 text-sm font-black uppercase text-white">Yes, complete check</button></div></div></div>
      ) : null}
    </main>
  );
}
