"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { supabase } from "@/lib/supabase";

type RopeStatus = "untested" | "passed" | "failed";
type Step = "testing" | "summary";

type Rope = {
  id: string;
  rope_name: string;
  rope_identifier: string;
  rope_type: string;
  serial_number: string | null;
  length_ft: number | null;
  location_type: string;
  apparatus_id: string | null;
  other_location: string | null;
};

type Member = { id: string; first_name: string | null; last_name: string | null };
type Option = { id: string; name: string };
type Participant = { memberId: string; name: string };

type Props = {
  departmentId: string;
  memberId: string;
  memberName: string;
  ropes: Rope[];
  apparatusNameById: Record<string, string>;
  activeDeficiencyRopeIds: string[];
  members: Member[];
  deficiencyCategories: Option[];
  deficiencyPriorities: Option[];
  openStatusId: string;
  initialError: string | null;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function MobileRopeInspection({
  departmentId,
  memberId,
  memberName,
  ropes,
  apparatusNameById,
  activeDeficiencyRopeIds,
  members,
  deficiencyCategories,
  deficiencyPriorities,
  openStatusId,
  initialError,
}: Props) {
  const router = useRouter();
  const [inspectionDate, setInspectionDate] = useState(today());
  const [statuses, setStatuses] = useState<Record<string, RopeStatus>>(
    Object.fromEntries(ropes.map((rope) => [rope.id, "untested"])),
  );
  const [step, setStep] = useState<Step>("testing");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [success, setSuccess] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantSearch, setParticipantSearch] = useState("");
  const [deficiencyRope, setDeficiencyRope] = useState<Rope | null>(null);
  const [deficiencyDescription, setDeficiencyDescription] = useState("");
  const [deficiencyCategoryId, setDeficiencyCategoryId] = useState(deficiencyCategories[0]?.id ?? "");
  const [deficiencyPriorityId, setDeficiencyPriorityId] = useState(deficiencyPriorities[0]?.id ?? "");
  const [deficiencyPhoto, setDeficiencyPhoto] = useState<File | null>(null);
  const [savingDeficiency, setSavingDeficiency] = useState(false);
  const [localDeficiencyRopeIds, setLocalDeficiencyRopeIds] = useState(activeDeficiencyRopeIds);

  const activeDeficiencyIds = new Set(localDeficiencyRopeIds);
  const selectedRopes = ropes.filter((rope) => statuses[rope.id] === "passed" || statuses[rope.id] === "failed");
  const passedRopes = selectedRopes.filter((rope) => statuses[rope.id] === "passed");
  const failedRopes = selectedRopes.filter((rope) => statuses[rope.id] === "failed");
  const failedWithoutDeficiency = failedRopes.filter((rope) => !activeDeficiencyIds.has(rope.id));
  const availableParticipants = members.filter((member) => {
    if (member.id === memberId || participants.some((participant) => participant.memberId === member.id)) return false;
    const name = `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim();
    return name.toLowerCase().includes(participantSearch.trim().toLowerCase());
  });

  function rosterName(member: Member) {
    return `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() || member.id;
  }

  function locationLabel(rope: Rope) {
    if (rope.location_type === "Apparatus" && rope.apparatus_id) {
      return apparatusNameById[rope.apparatus_id] ?? "Apparatus";
    }
    if (rope.location_type === "Other") return rope.other_location || "Other";
    return rope.location_type || "Station Storage";
  }

  function toggleStatus(ropeId: string, target: "passed" | "failed") {
    const nextStatus = statuses[ropeId] === target ? "untested" : target;
    setSuccess(null);
    setStatuses((current) => ({
      ...current,
      [ropeId]: nextStatus,
    }));
    setError(null);
    if (nextStatus === "failed") {
      setDeficiencyRope(ropes.find((rope) => rope.id === ropeId) ?? null);
      setDeficiencyDescription("");
      setDeficiencyPhoto(null);
    }
  }

  async function saveDeficiency() {
    if (!deficiencyRope || !deficiencyDescription.trim() || !deficiencyCategoryId || !deficiencyPriorityId || !openStatusId) {
      setError("Add a description, category, and priority before saving the deficiency.");
      return;
    }
    setSavingDeficiency(true);
    setError(null);
    const deficiencyId = crypto.randomUUID();
    let photoPath: string | null = null;
    if (deficiencyPhoto) {
      const safeName = deficiencyPhoto.name.replace(/[^a-zA-Z0-9.-]/g, "_") || "photo.jpg";
      photoPath = `${deficiencyId}/${Date.now()}-${safeName}`;
      const upload = await supabase.storage.from("deficiency-photos").upload(photoPath, deficiencyPhoto, { cacheControl: "3600", upsert: false });
      if (upload.error) {
        setError(upload.error.message || "Unable to upload photo.");
        setSavingDeficiency(false);
        return;
      }
    }
    const now = new Date().toISOString();
    const insert = await supabase.from("deficiencies").insert({
      id: deficiencyId,
      department_id: departmentId,
      category_id: deficiencyCategoryId,
      priority: deficiencyPriorityId,
      apparatus_id: null,
      description: deficiencyDescription.trim(),
      location: null,
      reported_at: now,
      created_at: now,
      status: openStatusId,
      photo_path: photoPath,
      reported_by: memberId,
      rope_item_id: deficiencyRope.id,
    }).select("id").single();
    if (insert.error || !insert.data) {
      setError(insert.error?.message || "Unable to save deficiency.");
      setSavingDeficiency(false);
      return;
    }
    await supabase.from("deficiency_history").insert({ deficiency_id: insert.data.id, event_type: "Reported", event_description: "Deficiency reported during rope inspection.", member_id: memberId });
    setLocalDeficiencyRopeIds((current) => Array.from(new Set([...current, deficiencyRope.id])));
    setDeficiencyRope(null);
    setDeficiencyDescription("");
    setDeficiencyPhoto(null);
    setSavingDeficiency(false);
  }

  function openSummary() {
    if (selectedRopes.length === 0) {
      setError("Mark at least one rope as Passed or Failed before continuing.");
      return;
    }
    if (!inspectionDate) {
      setError("Inspection date is required.");
      return;
    }
    setError(null);
    setStep("summary");
  }

  function deficiencyHref(rope: Rope) {
    const params = new URLSearchParams({
      returnTo: "/mobile/rope-inspections",
      inventoryCategory: "rope",
      inventoryItemId: rope.id,
      inventoryItemLabel: rope.rope_identifier || rope.rope_name,
      apparatusId: "station-supply",
    });
    return `/deficiencies/report?${params.toString()}`;
  }

  async function finishInspection() {
    if (failedWithoutDeficiency.length > 0) {
      setError("Failed ropes require active deficiencies before finishing.");
      return;
    }

    setSaving(true);
    setError(null);
    const sessionInsert = await supabase
      .from("rope_testing_sessions")
      .insert({ department_id: departmentId, test_date: inspectionDate, tester: memberName || "Unknown Inspector" })
      .select("id")
      .single();

    if (sessionInsert.error || !sessionInsert.data?.id) {
      setError(sessionInsert.error?.message || "Unable to save inspection session history.");
      setSaving(false);
      return;
    }

    const sessionId = sessionInsert.data.id;
    const resultsInsert = await supabase.from("rope_testing_results").insert(selectedRopes.map((rope) => ({
      testing_session_id: sessionId,
      department_id: departmentId,
      rope_item_id: rope.id,
      rope_identifier: rope.rope_identifier,
      test_date: inspectionDate,
      tester: memberName || "Unknown Inspector",
      result: statuses[rope.id] === "failed" ? "fail" : "pass",
    })));

    if (resultsInsert.error) {
      setError(resultsInsert.error.message || "Unable to save rope inspection result history.");
      setSaving(false);
      return;
    }

    const verification = await supabase
      .from("rope_testing_results")
      .select("rope_item_id")
      .eq("testing_session_id", sessionId);
    if (verification.error || (verification.data ?? []).length !== selectedRopes.length) {
      setError(verification.error?.message || "Saved rope inspection result count does not match inspected rope count.");
      setSaving(false);
      return;
    }

    const inspectionsInsert = await supabase.from("rope_inspections").insert(selectedRopes.map((rope) => ({
      department_id: departmentId,
      rope_item_id: rope.id,
      inspection_date: inspectionDate,
      primary_inspector_member_id: memberId,
      result: statuses[rope.id] === "failed" ? "fail" : "pass",
    }))).select("id, rope_item_id");

    if (inspectionsInsert.error) {
      setError(inspectionsInsert.error.message || "Unable to save rope inspection records.");
      setSaving(false);
      return;
    }

    if (participants.length > 0) {
      const participantInsert = await supabase.from("rope_inspection_participants").insert(
        (inspectionsInsert.data ?? []).flatMap((inspection) => participants.map((participant) => ({
          department_id: departmentId,
          rope_inspection_id: inspection.id,
          member_id: participant.memberId,
          added_by_member_id: memberId,
        }))),
      );
      if (participantInsert.error) {
        setError(participantInsert.error.message || "Unable to save rope inspection participants.");
        setSaving(false);
        return;
      }
    }

    setSuccess(`Successfully inspected ${selectedRopes.length} rope${selectedRopes.length === 1 ? "" : "s"}.`);
    setStatuses(Object.fromEntries(ropes.map((rope) => [rope.id, "untested"])));
    setParticipants([]);
    setParticipantSearch("");
    setStep("testing");
    setSaving(false);
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[#0b0c0e] px-4 pb-12 pt-4 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-5xl">
        <Link href="/mobile" className="inline-flex min-h-12 items-center text-sm font-bold text-white/65">Back to Field Actions</Link>
        <header className="mt-5 border-b border-white/10 pb-5">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#ef2b2d]">Field Action</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">Rope Inspections</h1>
          <p className="mt-2 text-sm leading-6 text-white/60">Inspect one or more active department ropes.</p>
        </header>

        {success ? <p className="mt-5 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-100">{success}</p> : null}
        {error ? <p className="mt-5 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</p> : null}

        {step === "testing" ? (
          <>
            <section className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-[#17181b] p-5 sm:p-6">
              <label className="block min-w-0 text-sm font-bold text-white/80"><span className="block">Inspection Date</span>
                <input type="date" required value={inspectionDate} onChange={(event) => setInspectionDate(event.target.value)} className="mx-auto mt-2 block min-h-14 w-[calc(100%-16px)] min-w-0 max-w-full rounded-xl border border-white/15 bg-[#101010] px-4 text-base leading-none text-white [color-scheme:dark]" />
              </label>
            </section>

            <section className="mt-4 space-y-3">
              {ropes.map((rope) => {
                const status = statuses[rope.id] ?? "untested";
                return <article key={rope.id} className="rounded-2xl border border-white/10 bg-[#17181b] p-5">
                  <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-[#ef2b2d]">{rope.rope_identifier}</p><h2 className="mt-1 text-xl font-black">{rope.rope_name}</h2><p className="mt-1 text-sm text-white/65">{rope.rope_type} · {rope.length_ft ?? "-"} ft</p><p className="mt-1 text-xs text-white/45">{rope.serial_number ? `Serial ${rope.serial_number} · ` : ""}{locationLabel(rope)}</p></div><span className={`rounded-lg border px-2 py-1 text-xs font-black uppercase ${status === "passed" ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100" : status === "failed" ? "border-red-400/40 bg-red-500/10 text-red-100" : "border-white/15 bg-white/[0.04] text-white/55"}`}>{status}</span></div>
                  <div className="mt-4 grid grid-cols-2 gap-3"><button type="button" onClick={() => toggleStatus(rope.id, "passed")} className={`min-h-14 rounded-xl border font-black uppercase ${status === "passed" ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-100" : "border-white/15 bg-[#101010] text-white/65"}`}>Passed</button><button type="button" onClick={() => toggleStatus(rope.id, "failed")} className={`min-h-14 rounded-xl border font-black uppercase ${status === "failed" ? "border-red-400/50 bg-red-500/20 text-red-100" : "border-white/15 bg-[#101010] text-white/65"}`}>Failed</button></div>
                </article>;
              })}
              {ropes.length === 0 ? <p className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-white/55">No active ropes are available.</p> : null}
            </section>
            <section className="mt-5 rounded-2xl border border-white/10 bg-[#17181b] p-5 sm:p-6">
              <h2 className="text-lg font-black">Personnel / Inspection Participants</h2>
              <p className="mt-1 text-sm text-white/55">The primary inspector is included automatically.</p>
              <div className="mt-3 flex flex-wrap gap-2"><span className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm font-bold text-emerald-100">{memberName} · Primary</span>{participants.map((participant) => <button key={participant.memberId} type="button" onClick={() => setParticipants((current) => current.filter((item) => item.memberId !== participant.memberId))} className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm font-bold text-emerald-100">{participant.name} · Remove</button>)}</div>
              <input value={participantSearch} onChange={(event) => setParticipantSearch(event.target.value)} placeholder="Search department members" className="mt-4 min-h-14 w-full rounded-xl border border-white/15 bg-[#101010] px-4 text-base text-white outline-none" />
              <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">{availableParticipants.length > 0 ? availableParticipants.map((member) => <button key={member.id} type="button" onClick={() => { setParticipants((current) => Array.from(new Map([...current, { memberId: member.id, name: rosterName(member) }].map((participant) => [participant.memberId, participant])).values())); setParticipantSearch(""); }} className="flex min-h-14 w-full items-center justify-between rounded-xl border border-white/10 bg-[#101010] px-4 text-left text-sm font-bold"><span>{rosterName(member)}</span><span className="text-[#ef2b2d]">Add</span></button>) : <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-white/55">No available members match this search.</p>}</div>
            </section>
            <button type="button" onClick={openSummary} disabled={selectedRopes.length === 0} className="mt-5 min-h-16 w-full rounded-xl bg-[#ef2b2d] px-5 font-black uppercase tracking-wide disabled:bg-white/15 disabled:text-white/40">Review Inspection</button>
          </>
        ) : (
          <section className="mt-5 rounded-2xl border border-white/10 bg-[#17181b] p-5 sm:p-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ef2b2d]">Inspection Summary</p>
            <h2 className="mt-2 text-2xl font-black">Review before submitting</h2>
            <div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl bg-[#101010] p-3"><p className="text-xs uppercase text-white/40">Date</p><p className="mt-1 font-bold">{formatDate(inspectionDate)}</p></div><div className="rounded-xl bg-[#101010] p-3"><p className="text-xs uppercase text-white/40">Inspector</p><p className="mt-1 font-bold">{memberName}</p></div></div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl border border-white/10 p-3"><p className="text-2xl font-black">{selectedRopes.length}</p><p className="text-xs uppercase text-white/45">Inspected</p></div><div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-3"><p className="text-2xl font-black text-emerald-100">{passedRopes.length}</p><p className="text-xs uppercase text-white/45">Passed</p></div><div className="rounded-xl border border-red-400/25 bg-red-500/10 p-3"><p className="text-2xl font-black text-red-100">{failedRopes.length}</p><p className="text-xs uppercase text-white/45">Failed</p></div></div>
            <div className="mt-4 space-y-2">{selectedRopes.map((rope) => <div key={rope.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-[#101010] p-3"><div><p className="font-bold">{rope.rope_identifier}</p><p className="text-sm text-white/55">{rope.rope_name}</p></div><span className={`font-black uppercase ${statuses[rope.id] === "failed" ? "text-red-200" : "text-emerald-200"}`}>{statuses[rope.id] === "failed" ? "Fail" : "Pass"}</span></div>)}</div>
            {failedWithoutDeficiency.length > 0 ? <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4"><p className="font-bold text-amber-100">Failed ropes require active deficiencies before finishing.</p><div className="mt-3 space-y-2">{failedWithoutDeficiency.map((rope) => <Link key={rope.id} href={deficiencyHref(rope)} className="flex min-h-12 items-center justify-between rounded-xl border border-amber-300/30 px-3 text-sm font-bold text-amber-100"><span>{rope.rope_identifier}</span><span>Report Deficiency</span></Link>)}</div></div> : null}
            <div className="mt-6 grid grid-cols-2 gap-3"><button type="button" onClick={() => setStep("testing")} className="min-h-14 rounded-xl border border-white/15 font-black uppercase text-white/75">Back</button><button type="button" onClick={() => void finishInspection()} disabled={saving || failedWithoutDeficiency.length > 0} className="min-h-14 rounded-xl bg-[#ef2b2d] px-4 font-black uppercase tracking-wide disabled:bg-white/15 disabled:text-white/40">{saving ? "Saving..." : "Finish Inspection"}</button></div>
          </section>
        )}
      </div>
      {deficiencyRope ? <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/75 p-3 sm:items-center sm:p-6"><div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/15 bg-[#202020] p-5 shadow-2xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-300">Deficiency Report</p><h2 className="mt-1 text-2xl font-black">{deficiencyRope.rope_identifier}</h2><p className="mt-1 text-sm text-white/60">{deficiencyRope.rope_name}</p></div><button type="button" onClick={() => setDeficiencyRope(null)} className="min-h-12 min-w-12 rounded-xl border border-white/15 text-xl text-white/75" aria-label="Close deficiency panel">×</button></div><label className="mt-5 block text-sm font-bold text-white/75">Description *<textarea value={deficiencyDescription} onChange={(event) => setDeficiencyDescription(event.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-white/15 bg-[#101010] p-3 text-base text-white outline-none" placeholder="Describe what was found" /></label><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold text-white/75">Category *<select value={deficiencyCategoryId} onChange={(event) => setDeficiencyCategoryId(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-[#101010] px-3 text-white">{deficiencyCategories.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label><label className="text-sm font-bold text-white/75">Priority *<select value={deficiencyPriorityId} onChange={(event) => setDeficiencyPriorityId(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-[#101010] px-3 text-white">{deficiencyPriorities.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label></div><label className="mt-4 block text-sm font-bold text-white/75">Photo<input type="file" accept="image/*" capture="environment" onChange={(event) => setDeficiencyPhoto(event.target.files?.[0] ?? null)} className="mt-2 block min-h-12 w-full rounded-xl border border-white/15 bg-[#101010] p-3 text-sm text-white/70" /></label><button type="button" disabled={savingDeficiency} onClick={() => void saveDeficiency()} className="mt-5 min-h-14 w-full rounded-xl bg-amber-500 px-4 text-sm font-black uppercase tracking-wide text-black disabled:opacity-50">{savingDeficiency ? "Saving deficiency..." : "Save deficiency"}</button></div></div> : null}
    </main>
  );
}
