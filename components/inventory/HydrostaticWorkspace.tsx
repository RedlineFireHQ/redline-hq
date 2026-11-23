"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { hydrostaticDueDate } from "@/lib/scba-hydro/date";
import { setAllHydroResults, setHydroResult } from "@/lib/scba-hydro/results";
import { hydroDeficiencyHref, hydroResultButtonClass } from "@/lib/scba-hydro/deficiency";

type Cylinder = { id: string; cylinder_number: string; status: string };
type Result = { id: string; cylinder_id: string; result: "Pass" | "Fail" };
type Attachment = { id: string; original_filename: string };
type Session = {
  id: string; test_date: string; tester_name: string; company_name: string;
  notes: string | null; scba_hydro_results: Result[]; scba_hydro_attachments: Attachment[];
};
type Form = { testDate: string; tester: string; company: string; notes: string; results: Record<string, "Pass" | "Fail" | ""> };

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function emptyForm(): Form {
  return { testDate: today(), tester: "", company: "", notes: "", results: {} };
}

const fieldClass = "w-full rounded-lg border border-white/10 bg-[#141414] px-3 py-2 text-sm text-white";
const buttonClass = "rounded-lg border border-white/20 bg-neutral-900 px-3 py-2 text-sm text-white hover:bg-neutral-800";

export default function HydrostaticWorkspace({ departmentId, cylinderId, resultId }: { departmentId: string | null; cylinderId: string | null; resultId: string | null }) {
  const [cylinders, setCylinders] = useState<Cylinder[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [form, setForm] = useState<Form>(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(departmentId ? null : "Unable to determine your department.");
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!departmentId) return;
    const [cylinderQuery, sessionQuery] = await Promise.all([
      supabase.from("scba_cylinders").select("id, cylinder_number, status").eq("department_id", departmentId).order("cylinder_number"),
      supabase.from("scba_hydro_sessions").select("id, test_date, tester_name, company_name, notes, scba_hydro_results(id, cylinder_id, result), scba_hydro_attachments(id, original_filename)")
        .eq("department_id", departmentId).order("test_date", { ascending: false }).order("created_at", { ascending: false }),
    ]);
    if (cylinderQuery.error || sessionQuery.error) {
      setError(cylinderQuery.error?.message || sessionQuery.error?.message || "Unable to load testing history.");
      return;
    }
    setCylinders((cylinderQuery.data ?? []) as Cylinder[]);
    setSessions((sessionQuery.data ?? []) as Session[]);
  }, [departmentId]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  function editSession(session: Session) {
    setEditing(session.id);
    setForm({ testDate: session.test_date, tester: session.tester_name, company: session.company_name,
      notes: session.notes ?? "", results: Object.fromEntries(session.scba_hydro_results.map((r) => [r.cylinder_id, r.result])) });
    setShowForm(true);
    setError(null);
  }

  async function save() {
    if (!departmentId || !form.testDate || !form.tester.trim() || !form.company.trim()) {
      setError("Test date, external tester and testing company are required.");
      return;
    }
    const results = Object.entries(form.results).filter(([, result]) => result).map(([cylinder_id, result]) => ({ cylinder_id, result }));
    if (!results.length) { setError("Select at least one cylinder result."); return; }
    setBusy(true);
    setError(null);
    const { error: saveError } = await supabase.rpc("save_scba_hydro_session", {
      p_department_id: departmentId, p_session_id: editing, p_test_date: form.testDate,
      p_tester_name: form.tester, p_company_name: form.company, p_notes: form.notes, p_results: results,
    });
    setBusy(false);
    if (saveError) { setError(saveError.message); return; }
    setShowForm(false);
    setEditing(null);
    setForm(emptyForm());
    setNotice("Session saved. Failed results do not change cylinder status; use Report Deficiency if needed. Attach files below.");
    await load();
  }

  async function upload(sessionId: string, file: File) {
    setBusy(true); setError(null);
    try {
      const slots = await fetch(`/api/scba-hydro/${sessionId}/attachments/uploads`, { method: "POST",
        headers: { "content-type": "application/json" }, body: JSON.stringify({ name: file.name, size: file.size, type: file.type }) });
      const slot = await slots.json() as { path?: string; token?: string; error?: string };
      if (!slots.ok || !slot.path || !slot.token) throw new Error(slot.error || "Unable to prepare upload.");
      const uploaded = await supabase.storage.from("scba-hydro-attachments").uploadToSignedUrl(slot.path, slot.token, file);
      if (uploaded.error) throw new Error(uploaded.error.message);
      const response = await fetch(`/api/scba-hydro/${sessionId}/attachments`, { method: "POST",
        headers: { "content-type": "application/json" }, body: JSON.stringify({ path: slot.path, name: file.name, type: file.type }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Upload failed.");
      await load();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Upload failed.");
    } finally { setBusy(false); }
  }

  async function remove(sessionId: string, attachmentId: string) {
    if (!window.confirm("Remove this attachment?")) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/scba-hydro/${sessionId}/attachments/${attachmentId}`, { method: "DELETE" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to remove attachment.");
      await load();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to remove attachment.");
    } finally { setBusy(false); }
  }

  const selectable = editing ? cylinders.filter((c) => c.id in form.results) : cylinders.filter((c) => c.status !== "Retired");
  const displayedSessions = sessions.filter((s) =>
    (!cylinderId || s.scba_hydro_results.some((r) => r.cylinder_id === cylinderId)) &&
    (!resultId || s.scba_hydro_results.some((r) => r.id === resultId && (!cylinderId || r.cylinder_id === cylinderId))));
  return <div className="mx-auto max-w-6xl space-y-5 p-5 text-white">
    <Link href="/inventory/scba-cylinders" className="text-sm text-red-300">Back to SCBA Cylinders</Link>
    <h1 className="text-3xl font-bold">Hydrostatic Testing</h1>
    <p className="text-sm text-neutral-300">Retest interval: five years. Composite-cylinder service life is tracked separately.</p>
    {error && <p role="alert" className="rounded border border-red-500 p-3 text-red-200">{error}</p>}
    {notice && <p className="rounded border border-green-700 p-3 text-green-200">{notice}</p>}
    <button className={buttonClass} onClick={() => { setEditing(null); setForm(emptyForm()); setShowForm(true); setError(null); }}>+ Hydrostatic Testing Session</button>
    {showForm && <section className="space-y-4 rounded-xl border border-neutral-700 bg-[#2E2E2E] p-5">
      <h2 className="text-xl font-bold">{editing ? "Correct Completed Session" : "Hydrostatic Testing Session"}</h2>
      <div className="grid gap-3 md:grid-cols-3">
        <label>Test date *<input className={fieldClass} type="date" value={form.testDate} onChange={(e) => setForm({ ...form, testDate: e.target.value })} /></label>
        <label>External tester *<input className={fieldClass} value={form.tester} onChange={(e) => setForm({ ...form, tester: e.target.value })} /></label>
        <label>Testing company *<input className={fieldClass} value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></label>
      </div>
      <label className="block">Session notes<textarea className={fieldClass} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
      {!editing && <div className="flex gap-2">
        {(["Pass", "Fail", ""] as const).map((value) => <button key={value || "clear"} className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${value === "Pass" ? "border-emerald-500/30 bg-emerald-900/20 text-emerald-100 hover:bg-emerald-900/30" : value === "Fail" ? "border-red-500/30 bg-red-900/20 text-red-100 hover:bg-red-900/30" : "border-white/15 bg-neutral-900 text-white hover:bg-neutral-800"}`} onClick={() => setForm({ ...form, results: setAllHydroResults(selectable.map((c) => c.id), value) })}>{value ? `Select All ${value}` : "Clear All"}</button>)}
      </div>}
      <div className="max-h-80 overflow-auto">{selectable.map((cylinder) => <div key={cylinder.id} className="flex items-center justify-between gap-3 border-b border-white/10 py-2">
        <span>{cylinder.cylinder_number} <span className="text-neutral-400">({cylinder.status})</span></span>
        <div className="flex gap-2">{(["Pass", "Fail"] as const).map((result) => <button key={result}
          aria-pressed={form.results[cylinder.id] === result}
          className={hydroResultButtonClass(result, form.results[cylinder.id] === result)}
          onClick={() => setForm({ ...form, results: setHydroResult(form.results, cylinder.id, result, !editing) })}>{result}</button>)}</div>
      </div>)}</div>
      <div className="flex gap-2"><button disabled={busy} className={buttonClass} onClick={() => void save()}>Save Session</button>
        <button disabled={busy} className={buttonClass} onClick={() => setShowForm(false)}>Cancel</button></div>
    </section>}
    <h2 className="text-xl font-bold">{cylinderId ? `History: ${cylinders.find((c) => c.id === cylinderId)?.cylinder_number ?? "Cylinder"}` : "Completed sessions and cylinder history"}</h2>
    {(cylinderId || resultId) && <Link className="text-blue-300 underline" href="/inventory/scba-cylinders/hydrostatic-testing">Show all sessions</Link>}
    {displayedSessions.length === 0 && <p className="text-neutral-400">No recorded hydrostatic sessions.</p>}
    {displayedSessions.map((session) => <section key={session.id} className="space-y-3 rounded-xl border border-neutral-700 bg-[#2E2E2E] p-5">
      <div className="flex flex-wrap justify-between gap-2"><h3 className="font-bold">{session.test_date} — {session.tester_name}, {session.company_name}</h3>
        <button className={buttonClass} disabled={busy} onClick={() => editSession(session)}>Correct Session</button></div>
      {session.notes && <p className="text-sm">{session.notes}</p>}
      {session.scba_hydro_results.map((result) => {
        const cylinder = cylinders.find((c) => c.id === result.cylinder_id);
        return <div key={result.id} className="flex flex-wrap items-center gap-3 border-t border-white/10 py-2">
          <strong>{cylinder?.cylinder_number ?? result.cylinder_id}</strong><span>{result.result}</span>
          <span className="text-neutral-400">Test: {session.test_date} · Retest due: {hydrostaticDueDate(session.test_date)}</span>
          {result.result === "Fail" && <Link className="text-red-300 underline" href={hydroDeficiencyHref(result.id, result.cylinder_id, cylinder?.cylinder_number ?? "Cylinder")}>Report Deficiency</Link>}
        </div>;
      })}
      <div className="space-y-2 border-t border-white/10 pt-3">
        <p>Session attachments</p>
        {session.scba_hydro_attachments.map((file) => <div className="flex flex-wrap gap-3" key={file.id}>
          <a className="text-blue-300 underline" href={`/api/scba-hydro/${session.id}/attachments/${file.id}`} target="_blank" rel="noreferrer">{file.original_filename}</a>
          <a className="text-blue-300 underline" href={`/api/scba-hydro/${session.id}/attachments/${file.id}?download=1`}>Download</a>
          <button disabled={busy} onClick={() => void remove(session.id, file.id)} className="text-red-300 underline">Remove</button>
        </div>)}
        <label className="block text-sm">Upload PDF or photo (maximum 15 MB)
          <input disabled={busy} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif" onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(session.id, file); e.target.value = ""; }} />
        </label>
      </div>
    </section>)}
  </div>;
}
