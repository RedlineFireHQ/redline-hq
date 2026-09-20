"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { supabase } from "@/lib/supabase";

type HoseStatus = "untested" | "passed" | "failed";
type Step = "testing" | "summary";

type Hose = {
  id: string;
  inventory_number: string;
  hose_size: number | string | null;
  hose_length: number | null;
  booster_reel: boolean | null;
  apparatus: string | null;
  status: string;
  next_test_date: string | null;
};

type Option = { id: string; name: string };
type Member = { id: string; first_name: string | null; last_name: string | null };
type Participant = { memberId: string; name: string };

type Props = {
  departmentId: string;
  memberId: string;
  memberName: string;
  hoses: Hose[];
  activeDeficiencyHoseIds: string[];
  deficiencyCategories: Option[];
  deficiencyPriorities: Option[];
  openStatusId: string;
  members: Member[];
  initialError: string | null;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addOneYearIso(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  parsed.setFullYear(parsed.getFullYear() + 1);
  return parsed.toISOString().slice(0, 10);
}

function formatDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatSize(value: number | string | null) {
  if (value === null) return "-";
  return `${Number(value)}\"`;
}

export default function MobileHoseQuickTest({
  departmentId,
  memberId,
  memberName,
  hoses,
  activeDeficiencyHoseIds,
  deficiencyCategories,
  deficiencyPriorities,
  openStatusId,
  members,
  initialError,
}: Props) {
  const router = useRouter();
  const [testingDate, setTestingDate] = useState(today());
  const [statuses, setStatuses] = useState<Record<string, HoseStatus>>(Object.fromEntries(hoses.map((hose) => [hose.id, "untested"])));
  const [quickInput, setQuickInput] = useState("");
  const [selectedHoseId, setSelectedHoseId] = useState("");
  const [step, setStep] = useState<Step>("testing");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [success, setSuccess] = useState<string | null>(null);
  const [deficiencyHose, setDeficiencyHose] = useState<Hose | null>(null);
  const [deficiencyDescription, setDeficiencyDescription] = useState("");
  const [deficiencyCategoryId, setDeficiencyCategoryId] = useState(deficiencyCategories[0]?.id ?? "");
  const [deficiencyPriorityId, setDeficiencyPriorityId] = useState(deficiencyPriorities[0]?.id ?? "");
  const [deficiencyPhoto, setDeficiencyPhoto] = useState<File | null>(null);
  const [savingDeficiency, setSavingDeficiency] = useState(false);
  const [localDeficiencyHoseIds, setLocalDeficiencyHoseIds] = useState(activeDeficiencyHoseIds);
  const [selectedHoseIds, setSelectedHoseIds] = useState<Set<string>>(new Set());
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantSearch, setParticipantSearch] = useState("");

  const activeDeficiencyIds = new Set(localDeficiencyHoseIds);
  const matches = useMemo(() => {
    const query = quickInput.trim().toLowerCase();
    if (!query) return [];
    return hoses.filter((hose) => hose.inventory_number.toLowerCase().includes(query));
  }, [hoses, quickInput]);
  const effectiveSelectedHoseId = matches.length === 1 ? matches[0].id : selectedHoseId;
  const selectedHose = hoses.find((hose) => hose.id === effectiveSelectedHoseId) ?? null;
  const testedHoses = hoses.filter((hose) => selectedHoseIds.has(hose.id) && statuses[hose.id] !== "untested");
  const passedHoses = hoses.filter((hose) => selectedHoseIds.has(hose.id) && statuses[hose.id] === "passed");
  const failedHoses = hoses.filter((hose) => selectedHoseIds.has(hose.id) && statuses[hose.id] === "failed");
  const remainingCount = Array.from(selectedHoseIds).filter((hoseId) => statuses[hoseId] === "untested").length;
  const failedWithoutDeficiency = failedHoses.filter((hose) => !activeDeficiencyIds.has(hose.id));
  const availableParticipants = members.filter((member) => {
    if (member.id === memberId || participants.some((participant) => participant.memberId === member.id)) return false;
    const name = `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim();
    return name.toLowerCase().includes(participantSearch.trim().toLowerCase());
  });

  function rosterName(member: Member) {
    return `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() || member.id;
  }

  function selectMatch(hose: Hose) {
    setSelectedHoseIds((current) => new Set(current).add(hose.id));
    setSelectedHoseId(hose.id);
    setQuickInput(hose.inventory_number);
  }

  function markSelected(status: "passed" | "failed") {
    if (!selectedHose) return;
    setSuccess(null);
    setSelectedHoseIds((current) => new Set(current).add(selectedHose.id));
    setStatuses((current) => ({ ...current, [selectedHose.id]: status }));
    setQuickInput("");
    setSelectedHoseId("");
    setError(null);
    if (status === "failed") {
      setDeficiencyHose(selectedHose);
      setDeficiencyDescription("");
      setDeficiencyPhoto(null);
    }
  }

  async function saveDeficiency() {
    if (!deficiencyHose || !deficiencyDescription.trim() || !deficiencyCategoryId || !deficiencyPriorityId || !openStatusId) {
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
      fire_hose_id: deficiencyHose.id,
    }).select("id").single();
    if (insert.error || !insert.data) {
      setError(insert.error?.message || "Unable to save deficiency.");
      setSavingDeficiency(false);
      return;
    }
    await supabase.from("deficiency_history").insert({ deficiency_id: insert.data.id, event_type: "Reported", event_description: "Deficiency reported during hose Quick Test.", member_id: memberId });
    setLocalDeficiencyHoseIds((current) => Array.from(new Set([...current, deficiencyHose.id])));
    setDeficiencyHose(null);
    setDeficiencyDescription("");
    setDeficiencyPhoto(null);
    setSavingDeficiency(false);
  }

  function openSummary() {
    if (testedHoses.length === 0) {
      setError("Mark at least one hose as Passed or Failed before continuing.");
      return;
    }
    if (!testingDate) {
      setError("Testing date is required.");
      return;
    }
    setError(null);
    setStep("summary");
  }

  async function finishTest() {
    if (failedWithoutDeficiency.length > 0) {
      setError("Failed hoses require active deficiencies before finishing.");
      return;
    }
    setSaving(true);
    setError(null);
    const nextTestDate = addOneYearIso(testingDate);

    for (const hose of testedHoses) {
      const hasActiveDeficiency = activeDeficiencyIds.has(hose.id);
      const nextStatus = statuses[hose.id] === "failed" || hasActiveDeficiency ? "Out of Service" : "Ready";
      const update = await supabase.from("fire_hose").update({ next_test_date: nextTestDate, status: nextStatus }).eq("id", hose.id).eq("department_id", departmentId).select("id, next_test_date, status").single();
      if (update.error || !update.data || update.data.next_test_date !== nextTestDate || update.data.status !== nextStatus) {
        setError(update.error?.message || `Unable to save hose test result for ${hose.inventory_number}.`);
        setSaving(false);
        return;
      }
    }

    const sessionInsert = await supabase.from("fire_hose_testing_sessions").insert({ department_id: departmentId, test_date: testingDate, tester: memberName || "Unknown Tester" }).select("id").single();
    if (sessionInsert.error || !sessionInsert.data?.id) {
      setError(sessionInsert.error?.message || "Unable to save testing session history.");
      setSaving(false);
      return;
    }

    const sessionId = sessionInsert.data.id;
    const resultsPayload = testedHoses.map((hose) => ({ testing_session_id: sessionId, department_id: departmentId, hose_id: hose.id, inventory_number: hose.inventory_number, test_date: testingDate, tester: memberName || "Unknown Tester", result: statuses[hose.id] === "failed" ? "fail" : "pass" }));
    const resultsInsert = await supabase.from("fire_hose_testing_results").insert(resultsPayload);
    if (resultsInsert.error) {
      setError(resultsInsert.error.message || "Unable to save hose test result history.");
      setSaving(false);
      return;
    }
    const verification = await supabase.from("fire_hose_testing_results").select("hose_id, result, tester, testing_session_id").eq("testing_session_id", sessionId).eq("department_id", departmentId);
    const expectedByHoseId = new Map(resultsPayload.map((row) => [row.hose_id, row.result]));
    const mismatch = (verification.data ?? []).length !== resultsPayload.length || (verification.data ?? []).some((row) => expectedByHoseId.get(row.hose_id) !== row.result || row.tester !== (memberName || "Unknown Tester") || row.testing_session_id !== sessionId);
    if (verification.error || mismatch) {
      setError(verification.error?.message || "Saved hose testing results did not match expected values.");
      setSaving(false);
      return;
    }

    setSuccess(`Successfully tested ${testedHoses.length} hose${testedHoses.length === 1 ? "" : "s"}.`);
    setStatuses(Object.fromEntries(hoses.map((hose) => [hose.id, "untested"])));
    setSelectedHoseIds(new Set());
    setParticipants([]);
    setParticipantSearch("");
    setQuickInput("");
    setSelectedHoseId("");
    setStep("testing");
    setSaving(false);
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[#0b0c0e] px-4 pb-12 pt-4 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-4xl">
        <Link href="/mobile" className="inline-flex min-h-12 items-center text-sm font-bold text-white/65">Back to Field Actions</Link>
        <header className="mt-5 border-b border-white/10 pb-5"><p className="text-xs font-bold uppercase tracking-[0.22em] text-[#ef2b2d]">Field Action</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">Hose Testing</h1><p className="mt-2 text-sm text-white/60">Quick Test · scan, mark, continue.</p></header>
        {success ? <p className="mt-5 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-100">{success}</p> : null}
        {error ? <p className="mt-5 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</p> : null}

        {step === "testing" ? <>
          <section className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-[#17181b] p-5 sm:p-6"><label className="block min-w-0 text-sm font-bold text-white/80"><span className="block">Testing Date</span><input type="date" required value={testingDate} onChange={(event) => setTestingDate(event.target.value)} className="mx-auto mt-2 block h-11 w-[calc(100%-16px)] min-w-0 max-w-full rounded-xl border border-white/15 bg-[#101010] px-3 py-1 text-base leading-none text-white [color-scheme:dark]" /></label></section>
          <section className="mt-4 rounded-2xl border border-white/10 bg-[#17181b] p-5 sm:p-6"><h2 className="text-xl font-black">Fire Hose Quick Test</h2><label className="mt-4 block text-sm font-bold text-white/80">Inventory Number<input autoFocus value={quickInput} onChange={(event) => { setQuickInput(event.target.value); setSelectedHoseId(""); }} className="mt-2 min-h-14 w-full rounded-xl border border-white/15 bg-[#101010] px-4 text-lg font-bold text-white" /></label>{quickInput.trim() && matches.length > 1 ? <div className="mt-2 max-h-48 space-y-2 overflow-y-auto">{matches.map((hose) => <button key={hose.id} type="button" onClick={() => selectMatch(hose)} className="min-h-14 w-full rounded-xl border border-white/10 bg-[#101010] px-4 text-left font-bold">{hose.inventory_number}</button>)}</div> : null}{selectedHose ? <div className="mt-4 rounded-xl border border-white/10 bg-[#101010] p-4"><p className="text-xs uppercase text-white/45">Selected hose</p><h3 className="mt-1 text-xl font-black">{selectedHose.inventory_number}</h3><p className="mt-1 text-sm text-white/60">{formatSize(selectedHose.hose_size)} · {selectedHose.booster_reel ? "Booster Reel" : `${selectedHose.hose_length ?? "-"} ft`} · {selectedHose.apparatus || "Station Supply"}</p><div className="mt-4 grid grid-cols-2 gap-3"><button type="button" onClick={() => markSelected("passed")} className="min-h-16 rounded-xl border border-emerald-400/40 bg-emerald-500/15 font-black uppercase text-emerald-100">Pass</button><button type="button" onClick={() => markSelected("failed")} className="min-h-16 rounded-xl border border-red-400/40 bg-red-500/15 font-black uppercase text-red-100">Fail</button></div></div> : quickInput.trim() ? <p className="mt-3 text-sm text-white/55">No single hose selected. Choose a matching inventory number.</p> : null}</section>
          <section className="mt-4 rounded-2xl border border-white/10 bg-[#17181b] p-5"><h2 className="text-sm font-black uppercase tracking-wide text-white/60">Today&apos;s Progress</h2><div className="mt-3 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-[#101010] p-3"><p className="text-2xl font-black text-emerald-200">{passedHoses.length}</p><p className="text-xs uppercase text-white/45">Passed</p></div><div className="rounded-xl bg-[#101010] p-3"><p className="text-2xl font-black text-red-200">{failedHoses.length}</p><p className="text-xs uppercase text-white/45">Failed</p></div><div className="rounded-xl bg-[#101010] p-3"><p className="text-2xl font-black">{remainingCount}</p><p className="text-xs uppercase text-white/45">Remaining</p></div></div>{testedHoses.length > 0 ? <div className="mt-3 flex flex-wrap gap-2">{testedHoses.map((hose) => <button key={hose.id} type="button" onClick={() => selectMatch(hose)} className={`min-h-11 rounded-xl border px-3 text-sm font-bold ${statuses[hose.id] === "failed" ? "border-red-400/30 text-red-100" : "border-emerald-400/30 text-emerald-100"}`}>{hose.inventory_number} · {statuses[hose.id] === "failed" ? "Fail" : "Pass"}</button>)}</div> : null}</section>
          <section className="mt-4 rounded-2xl border border-white/10 bg-[#17181b] p-5 sm:p-6"><h2 className="text-lg font-black">Personnel / Inspection Participants</h2><p className="mt-1 text-sm text-white/55">The primary tester is included automatically.</p><div className="mt-3 flex flex-wrap gap-2"><span className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm font-bold text-emerald-100">{memberName} · Primary</span>{participants.map((participant) => <button key={participant.memberId} type="button" onClick={() => setParticipants((current) => current.filter((item) => item.memberId !== participant.memberId))} className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm font-bold text-emerald-100">{participant.name} · Remove</button>)}</div><input value={participantSearch} onChange={(event) => setParticipantSearch(event.target.value)} placeholder="Search department members" className="mt-4 min-h-14 w-full rounded-xl border border-white/15 bg-[#101010] px-4 text-base text-white outline-none" /><div className="mt-3 max-h-64 space-y-2 overflow-y-auto">{availableParticipants.length > 0 ? availableParticipants.map((member) => <button key={member.id} type="button" onClick={() => { setParticipants((current) => Array.from(new Map([...current, { memberId: member.id, name: rosterName(member) }].map((participant) => [participant.memberId, participant])).values())); setParticipantSearch(""); }} className="flex min-h-14 w-full items-center justify-between rounded-xl border border-white/10 bg-[#101010] px-4 text-left text-sm font-bold"><span>{rosterName(member)}</span><span className="text-[#ef2b2d]">Add</span></button>) : <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-white/55">No available members match this search.</p>}</div></section>
          <button type="button" disabled={testedHoses.length === 0} onClick={openSummary} className="mt-5 min-h-16 w-full rounded-xl bg-[#ef2b2d] px-5 font-black uppercase tracking-wide disabled:bg-white/15 disabled:text-white/40">Finish Quick Test</button>
        </> : <section className="mt-5 rounded-2xl border border-white/10 bg-[#17181b] p-5 sm:p-6"><p className="text-xs font-black uppercase tracking-[0.18em] text-[#ef2b2d]">Quick Test Summary</p><h2 className="mt-2 text-2xl font-black">Review before submitting</h2><div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl bg-[#101010] p-3"><p className="text-xs uppercase text-white/40">Date</p><p className="mt-1 font-bold">{formatDate(testingDate)}</p></div><div className="rounded-xl bg-[#101010] p-3"><p className="text-xs uppercase text-white/40">Tester</p><p className="mt-1 font-bold">{memberName}</p></div></div><div className="mt-4 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl border border-white/10 p-3"><p className="text-2xl font-black">{testedHoses.length}</p><p className="text-xs uppercase text-white/45">Tested</p></div><div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-3"><p className="text-2xl font-black text-emerald-100">{passedHoses.length}</p><p className="text-xs uppercase text-white/45">Passed</p></div><div className="rounded-xl border border-red-400/25 bg-red-500/10 p-3"><p className="text-2xl font-black text-red-100">{failedHoses.length}</p><p className="text-xs uppercase text-white/45">Failed</p></div></div><div className="mt-4 space-y-2">{testedHoses.map((hose) => <div key={hose.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-[#101010] p-3"><div><p className="font-bold">{hose.inventory_number}</p><p className="text-sm text-white/55">{formatSize(hose.hose_size)} · {hose.booster_reel ? "Booster Reel" : `${hose.hose_length ?? "-"} ft`}</p></div><span className={`font-black uppercase ${statuses[hose.id] === "failed" ? "text-red-200" : "text-emerald-200"}`}>{statuses[hose.id] === "failed" ? "Fail" : "Pass"}</span></div>)}</div>{failedWithoutDeficiency.length > 0 ? <p className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 font-bold text-amber-100">Failed hoses require active deficiencies before finishing.</p> : null}<div className="mt-6 grid grid-cols-2 gap-3"><button type="button" onClick={() => setStep("testing")} className="min-h-14 rounded-xl border border-white/15 font-black uppercase text-white/75">Back</button><button type="button" disabled={saving || failedWithoutDeficiency.length > 0} onClick={() => void finishTest()} className="min-h-14 rounded-xl bg-[#ef2b2d] px-4 font-black uppercase tracking-wide disabled:bg-white/15 disabled:text-white/40">{saving ? "Saving..." : "Finish"}</button></div></section>}
      </div>
      {deficiencyHose ? <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/75 p-3 sm:items-center sm:p-6"><div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/15 bg-[#202020] p-5 shadow-2xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-300">Deficiency Report</p><h2 className="mt-1 text-2xl font-black">{deficiencyHose.inventory_number}</h2></div><button type="button" onClick={() => setDeficiencyHose(null)} className="min-h-12 min-w-12 rounded-xl border border-white/15 text-xl text-white/75" aria-label="Close deficiency panel">×</button></div><label className="mt-5 block text-sm font-bold text-white/75">Description *<textarea value={deficiencyDescription} onChange={(event) => setDeficiencyDescription(event.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-white/15 bg-[#101010] p-3 text-base text-white" placeholder="Describe what was found" /></label><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold text-white/75">Category *<select value={deficiencyCategoryId} onChange={(event) => setDeficiencyCategoryId(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-[#101010] px-3 text-white">{deficiencyCategories.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label><label className="text-sm font-bold text-white/75">Priority *<select value={deficiencyPriorityId} onChange={(event) => setDeficiencyPriorityId(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-[#101010] px-3 text-white">{deficiencyPriorities.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label></div><label className="mt-4 block text-sm font-bold text-white/75">Photo<input type="file" accept="image/*" capture="environment" onChange={(event) => setDeficiencyPhoto(event.target.files?.[0] ?? null)} className="mt-2 block min-h-12 w-full rounded-xl border border-white/15 bg-[#101010] p-3 text-sm text-white/70" /></label><button type="button" disabled={savingDeficiency} onClick={() => void saveDeficiency()} className="mt-5 min-h-14 w-full rounded-xl bg-amber-500 px-4 font-black uppercase text-black disabled:opacity-50">{savingDeficiency ? "Saving deficiency..." : "Save deficiency"}</button></div></div> : null}
    </main>
  );
}
