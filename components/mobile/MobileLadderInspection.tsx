"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  buildGroundLadderInspectionNotes,
  getGroundLadderInspectionDateFromNotes,
  GROUND_LADDER_INSPECTION_ITEMS,
  type GroundLadderInspectionChecklistStatus,
  type GroundLadderInspectionResult,
} from "@/lib/inventory/ground-ladder-inspection";
import { supabase } from "@/lib/supabase";

type Ladder = {
  id: string;
  ladder_number: string;
  ladder_type: string | null;
  ladder_length_ft: number | null;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  status: string;
  notes: string | null;
};

type Assignment = { ground_ladder_id: string; assignment_type: string; apparatus_id: string | null };
type Member = { id: string; first_name: string | null; last_name: string | null };
type Helper = { memberId: string; name: string };

type Props = {
  departmentId: string;
  memberId: string;
  ladders: Ladder[];
  assignments: Assignment[];
  members: Member[];
  activeDeficiencyLadderIds: string[];
  checklistRequired: boolean;
  initialError: string | null;
};

function memberName(member: Member) {
  return `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() || member.id;
}

function formatDate(value: string | null) {
  if (!value) return "Never";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function statusClasses(status: string) {
  if (status === "In Service") return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
  if (status === "Out of Service" || status === "Lost" || status === "Stolen") return "border-red-400/30 bg-red-500/10 text-red-200";
  return "border-amber-400/30 bg-amber-500/10 text-amber-200";
}

export default function MobileLadderInspection({
  departmentId,
  memberId,
  ladders: initialLadders,
  assignments,
  members,
  activeDeficiencyLadderIds,
  checklistRequired,
  initialError,
}: Props) {
  const router = useRouter();
  const [ladders, setLadders] = useState(initialLadders);
  const [selectedLadder, setSelectedLadder] = useState<Ladder | null>(null);
  const [result, setResult] = useState<GroundLadderInspectionResult | null>(null);
  const [checklist, setChecklist] = useState<Record<string, GroundLadderInspectionChecklistStatus>>({});
  const [bulkPassSnapshot, setBulkPassSnapshot] = useState<Record<string, GroundLadderInspectionChecklistStatus | undefined> | null>(null);
  const [bulkPassManualEdits, setBulkPassManualEdits] = useState<Set<string>>(new Set());
  const [helpers, setHelpers] = useState<Helper[]>([]);
  const [helperSearch, setHelperSearch] = useState("");
  const [notes, setNotes] = useState("");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [success, setSuccess] = useState<string | null>(null);

  const activeDeficiencyIds = new Set(activeDeficiencyLadderIds);
  const availableHelpers = members.filter((member) => {
    if (member.id === memberId || helpers.some((helper) => helper.memberId === member.id)) return false;
    return memberName(member).toLowerCase().includes(helperSearch.trim().toLowerCase());
  });
  const checklistComplete = GROUND_LADDER_INSPECTION_ITEMS.every((item) => checklist[item.key] !== undefined);

  function startInspection(ladder: Ladder) {
    setSelectedLadder(ladder);
    setResult(null);
    setChecklist({});
    setBulkPassSnapshot(null);
    setBulkPassManualEdits(new Set());
    setHelpers([]);
    setHelperSearch("");
    setNotes("");
    setIsConfirmOpen(false);
    setError(null);
    setSuccess(null);
  }

  function deficiencyHref(ladder: Ladder) {
    const assignment = assignments.find((row) => row.ground_ladder_id === ladder.id);
    const params = new URLSearchParams({
      returnTo: "/mobile/ladder-inspections",
      inventoryCategory: "ground-ladders",
      inventoryItemId: ladder.id,
      inventoryItemLabel: ladder.ladder_number,
      apparatusId: assignment?.assignment_type === "Apparatus" && assignment.apparatus_id ? assignment.apparatus_id : "station-supply",
    });
    return `/deficiencies/report?${params.toString()}`;
  }

  function updateChecklistItem(key: string, value: GroundLadderInspectionChecklistStatus) {
    setChecklist((current) => ({ ...current, [key]: value }));
    if (bulkPassSnapshot) {
      setBulkPassManualEdits((current) => new Set(current).add(key));
    }
  }

  function togglePassAll() {
    if (bulkPassSnapshot) {
      setChecklist((current) => {
        const next = { ...current };
        for (const item of GROUND_LADDER_INSPECTION_ITEMS) {
          if (bulkPassManualEdits.has(item.key)) continue;
          const previous = bulkPassSnapshot[item.key];
          if (previous) next[item.key] = previous;
          else delete next[item.key];
        }
        return next;
      });
      setBulkPassSnapshot(null);
      setBulkPassManualEdits(new Set());
      return;
    }

    setBulkPassSnapshot(Object.fromEntries(GROUND_LADDER_INSPECTION_ITEMS.map((item) => [item.key, checklist[item.key]])));
    setBulkPassManualEdits(new Set());
    setChecklist((current) => ({
      ...current,
      ...Object.fromEntries(GROUND_LADDER_INSPECTION_ITEMS.map((item) => [item.key, "pass"])),
    }));
  }

  function requestCompletion() {
    if (!selectedLadder || !result) {
      setError("Select an overall inspection result.");
      return;
    }
    if (checklistRequired && !checklistComplete) {
      setError("Complete all required inspection checklist items before completing this inspection.");
      return;
    }
    if (result === "out-of-service" && !activeDeficiencyIds.has(selectedLadder.id)) {
      setError("Report at least one deficiency before placing this ladder out of service.");
      return;
    }
    setError(null);
    setIsConfirmOpen(true);
  }

  async function completeInspection() {
    if (!selectedLadder || !result) return;

    const activeAssignment = assignments.find((row) => row.ground_ladder_id === selectedLadder.id);
    const nextStatus = result === "out-of-service"
      ? "Out of Service"
      : activeAssignment && activeAssignment.assignment_type !== "Unassigned"
        ? "In Service"
        : "Unassigned";
    const helperSummary = helpers.length > 0 ? `Inspection helpers: ${helpers.map((helper) => helper.name).join(", ")}.` : "";
    const checklistSummary = Object.keys(checklist).length > 0
      ? `Checklist review: ${Object.entries(checklist).map(([key, value]) => `${key}:${value}`).join("; ")}.`
      : "";
    const nextNotes = buildGroundLadderInspectionNotes({
      existingNotes: selectedLadder.notes,
      helperSummary,
      checklistSummary,
      inspectionNotes: notes,
      result,
    });

    setSaving(true);
    setIsConfirmOpen(false);
    setError(null);
    const update = await supabase
      .from("ground_ladders")
      .update({ status: nextStatus, notes: nextNotes || null })
      .eq("id", selectedLadder.id)
      .eq("department_id", departmentId)
      .select("id")
      .single();

    if (update.error || !update.data) {
      setError(update.error?.message || "Unable to complete ladder inspection.");
      setSaving(false);
      return;
    }

    setLadders((current) => current.map((ladder) => ladder.id === selectedLadder.id
      ? { ...ladder, status: nextStatus, notes: nextNotes }
      : ladder));
    setSuccess(`Inspection completed for ${selectedLadder.ladder_number}.`);
    setSelectedLadder(null);
    setSaving(false);
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[#0b0c0e] px-4 pb-12 pt-4 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-5xl">
        <Link href="/mobile" className="inline-flex min-h-12 items-center text-sm font-bold text-white/65">Back to Field Actions</Link>
        <header className="mt-5 border-b border-white/10 pb-5">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#ef2b2d]">Field Action</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">Ladder Inspections</h1>
          <p className="mt-2 text-sm leading-6 text-white/60">Inspect a ground ladder and document its field readiness.</p>
        </header>

        {success ? <p className="mt-5 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-100">{success}</p> : null}
        {error ? <p className="mt-5 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</p> : null}

        {selectedLadder ? (
          <form onSubmit={(event) => event.preventDefault()} className="mt-5 space-y-4">
            <section className="rounded-2xl border border-white/10 bg-[#17181b] p-5 sm:p-6">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ef2b2d]">Selected Ladder</p>
              <div className="mt-2 flex items-start justify-between gap-3">
                <div><h2 className="text-2xl font-black">{selectedLadder.ladder_number}</h2><p className="mt-1 text-sm text-white/65">{[selectedLadder.ladder_type, selectedLadder.ladder_length_ft ? `${selectedLadder.ladder_length_ft} ft` : null].filter(Boolean).join(" · ")}</p><p className="mt-1 text-sm text-white/50">{[selectedLadder.manufacturer, selectedLadder.model, selectedLadder.serial_number ? `Serial ${selectedLadder.serial_number}` : null].filter(Boolean).join(" · ") || "Equipment details not recorded"}</p></div>
                <span className={`rounded-lg border px-2 py-1 text-xs font-bold ${statusClasses(selectedLadder.status)}`}>{selectedLadder.status}</span>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#17181b] p-5 sm:p-6">
              <h2 className="text-lg font-black">Overall Result</h2>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setResult("ready")} className={`min-h-20 rounded-xl border p-3 text-left ${result === "ready" ? "border-emerald-400/50 bg-emerald-500/20" : "border-white/15 bg-[#101010]"}`}><span className="block font-black text-emerald-100">Ready for Duty</span><span className="mt-1 block text-xs text-white/55">Safe to return to service</span></button>
                <button type="button" onClick={() => setResult("out-of-service")} className={`min-h-20 rounded-xl border p-3 text-left ${result === "out-of-service" ? "border-red-400/50 bg-red-500/20" : "border-white/15 bg-[#101010]"}`}><span className="block font-black text-red-100">Out of Service</span><span className="mt-1 block text-xs text-white/55">Unsafe for use</span></button>
              </div>
              {result === "out-of-service" && !activeDeficiencyIds.has(selectedLadder.id) ? <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100"><p>A linked deficiency is required before completion.</p><Link href={deficiencyHref(selectedLadder)} className="mt-2 inline-flex min-h-12 items-center rounded-xl border border-amber-300/30 px-4 font-bold">Report Deficiency</Link></div> : null}
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#17181b] p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-black">Inspection Checklist</h2><p className="mt-1 text-sm text-white/55">{Object.keys(checklist).length}/{GROUND_LADDER_INSPECTION_ITEMS.length} completed</p></div><div className="flex items-center gap-2"><span className="text-xs font-bold uppercase text-white/45">{checklistRequired ? "Required" : "Department optional"}</span><button type="button" onClick={togglePassAll} className="min-h-12 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 text-xs font-black uppercase tracking-wide text-emerald-100">{bulkPassSnapshot ? "Undo Pass All" : "Pass All"}</button></div></div>
              <div className="mt-4 space-y-3">{GROUND_LADDER_INSPECTION_ITEMS.map((item) => <div key={item.key} className="rounded-xl border border-white/10 bg-[#101010] p-3"><p className="font-bold">{item.label}</p><div className={`mt-3 grid gap-2 ${item.allowNotApplicable ? "grid-cols-3" : "grid-cols-2"}`}>{(["pass", "fail", ...(item.allowNotApplicable ? ["not_applicable"] : [])] as GroundLadderInspectionChecklistStatus[]).map((value) => <button key={value} type="button" onClick={() => updateChecklistItem(item.key, value)} className={`min-h-12 rounded-lg border text-xs font-black uppercase ${checklist[item.key] === value ? value === "pass" ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-100" : value === "fail" ? "border-amber-400/50 bg-amber-500/20 text-amber-100" : "border-sky-400/50 bg-sky-500/20 text-sky-100" : "border-white/15 text-white/60"}`}>{value === "not_applicable" ? "N/A" : value}</button>)}</div></div>)}</div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#17181b] p-5 sm:p-6">
              <h2 className="text-lg font-black">Inspection Helpers</h2><p className="mt-1 text-sm text-white/55">You are included automatically. Add anyone who helped.</p>
              <div className="mt-3 flex flex-wrap gap-2"><span className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm font-bold text-emerald-100">You</span>{helpers.map((helper) => <button key={helper.memberId} type="button" onClick={() => setHelpers((current) => current.filter((item) => item.memberId !== helper.memberId))} className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm font-bold text-emerald-100">{helper.name} · Remove</button>)}</div>
              <input value={helperSearch} onChange={(event) => setHelperSearch(event.target.value)} placeholder="Search members..." className="mt-4 min-h-14 w-full rounded-xl border border-white/15 bg-[#101010] px-4 text-base text-white" />
              <div className="mt-2 max-h-48 space-y-2 overflow-y-auto">{availableHelpers.length > 0 ? availableHelpers.map((member) => <button key={member.id} type="button" onClick={() => { setHelpers((current) => [...current, { memberId: member.id, name: memberName(member) }]); setHelperSearch(""); }} className="flex min-h-14 w-full items-center justify-between rounded-xl border border-white/10 bg-[#101010] px-4 text-left font-bold"><span>{memberName(member)}</span><span className="text-[#ef2b2d]">Add</span></button>) : <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-white/55">No available members match this search.</p>}</div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#17181b] p-5 sm:p-6">
              <label className="text-sm font-bold text-white/80">Inspection Notes (Optional)<textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Enter noteworthy observations..." className="mt-2 w-full rounded-xl border border-white/15 bg-[#101010] p-4 text-base text-white" /></label>
            </section>

            <div className="grid grid-cols-2 gap-3"><button type="button" onClick={() => setSelectedLadder(null)} className="min-h-14 rounded-xl border border-white/15 bg-[#17181b] px-4 font-bold">Cancel</button><button type="button" onClick={requestCompletion} disabled={saving || !result || (checklistRequired && !checklistComplete)} className="min-h-14 rounded-xl bg-[#ef2b2d] px-4 font-black uppercase tracking-wide disabled:opacity-50">{saving ? "Saving..." : "Complete Inspection"}</button></div>
          </form>
        ) : (
          <section className="mt-5"><div><h2 className="text-xl font-black">Department Ladders</h2><p className="mt-1 text-sm text-white/55">Select a ladder to begin.</p></div><div className="mt-4 grid gap-3 md:grid-cols-2">{ladders.map((ladder) => <article key={ladder.id} className="rounded-2xl border border-white/10 bg-[#17181b] p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="text-xl font-black">{ladder.ladder_number}</h3><p className="mt-1 text-sm text-white/65">{[ladder.ladder_type, ladder.ladder_length_ft ? `${ladder.ladder_length_ft} ft` : null].filter(Boolean).join(" · ")}</p><p className="mt-1 text-xs text-white/45">{[ladder.manufacturer, ladder.model, ladder.serial_number ? `Serial ${ladder.serial_number}` : null].filter(Boolean).join(" · ") || "Equipment details not recorded"}</p></div><span className={`rounded-lg border px-2 py-1 text-xs font-bold ${statusClasses(ladder.status)}`}>{ladder.status}</span></div><div className="mt-4 rounded-xl bg-[#101010] p-3"><p className="text-xs uppercase text-white/40">Last inspection</p><p className="mt-1 font-bold">{formatDate(getGroundLadderInspectionDateFromNotes(ladder.notes))}</p></div><button type="button" onClick={() => startInspection(ladder)} className="mt-4 min-h-14 w-full rounded-xl bg-[#ef2b2d] px-5 font-black uppercase tracking-wide">Start Inspection</button></article>)}{ladders.length === 0 ? <p className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-white/55">No active ground ladders are available.</p> : null}</div></section>
        )}
      </div>
      {isConfirmOpen ? <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4"><div role="dialog" aria-modal="true" className="w-full max-w-xl rounded-2xl border border-white/15 bg-[#202020] p-6 shadow-2xl"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ef2b2d]">Confirm inspection</p><h2 className="mt-2 text-2xl font-black">Complete this ladder inspection?</h2><p className="mt-4 text-sm leading-6 text-white/75">By completing this inspection, you certify that this ladder was inspected in accordance with department policy and any defects were documented.</p><div className="mt-6 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => setIsConfirmOpen(false)} className="min-h-14 rounded-xl border border-white/15 px-4 text-sm font-black uppercase text-white/75">Cancel</button><button type="button" disabled={saving} onClick={() => void completeInspection()} className="min-h-14 rounded-xl bg-[#ef2b2d] px-4 text-sm font-black uppercase text-white disabled:opacity-50">{saving ? "Saving..." : "Yes, complete inspection"}</button></div></div></div> : null}
    </main>
  );
}
