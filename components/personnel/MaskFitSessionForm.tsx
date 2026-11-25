"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { FitResult, MaskSize } from "@/lib/scba-mask-fit/status";
import { isCompleteSession, searchAvailableMembers, type FitEntry, type FitMember } from "@/lib/scba-mask-fit/session";

type SavePayload = {
  p_department_id: string;
  p_session_id: string;
  p_name: string;
  p_test_date: string;
  p_tester_name: string;
  p_results: { member_id: string; result: FitResult | ""; mask_size: MaskSize | "" }[];
};

const fieldClass = "w-full rounded-xl border border-white/15 bg-neutral-950 px-3 py-2 text-white";

function isPendingPayload(value: unknown, departmentId: string): value is SavePayload {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return item.p_department_id === departmentId
    && typeof item.p_session_id === "string" && typeof item.p_name === "string"
    && typeof item.p_test_date === "string" && typeof item.p_tester_name === "string"
    && Array.isArray(item.p_results) && item.p_results.length > 0
    && item.p_results.every((result: unknown) => {
      if (!result || typeof result !== "object") return false;
      const row = result as Record<string, unknown>;
      return typeof row.member_id === "string" && (row.result === "Pass" || row.result === "Fail")
        && (row.mask_size === "S" || row.mask_size === "M" || row.mask_size === "L");
    });
}

export default function MaskFitSessionForm({ departmentId, members }: { departmentId: string; members: FitMember[] }) {
  const [name, setName] = useState("Annual SCBA Mask Fit Test");
  const [date, setDate] = useState("");
  const [tester, setTester] = useState("");
  const [search, setSearch] = useState("");
  const [entries, setEntries] = useState<FitEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState<SavePayload | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const pending = useRef(false);
  const storageKey = `scba-mask-fit-pending:${departmentId}`;
  const locked = !storageReady || saved || saving || retry !== null;

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      try {
        const stored = sessionStorage.getItem(storageKey);
        if (stored) {
          const payload: unknown = JSON.parse(stored);
          if (!isPendingPayload(payload, departmentId)) {
            setError("A previous pending submission is unreadable. Session saving is disabled to avoid creating a duplicate.");
            return;
          }
          setName(payload.p_name);
          setDate(payload.p_test_date);
          setTester(payload.p_tester_name);
          setEntries(payload.p_results.map((row) => ({
            member: members.find((member) => member.id === row.member_id) ?? { id: row.member_id, name: row.member_id },
            result: row.result,
            size: row.mask_size,
          })));
          setRetry(payload);
          setError("A previous save was not confirmed. Retry the same submission to check it without creating a duplicate.");
        }
        setStorageReady(true);
      } catch (caught) {
        setError(`Unable to restore the pending submission: ${caught instanceof Error ? caught.message : String(caught)}. Session saving is disabled.`);
      }
    });
    return () => { active = false; };
  }, [departmentId, members, storageKey]);
  const matches = searchAvailableMembers(members, entries, search);
  const complete = isCompleteSession(name, date, tester, entries);

  function updateEntry(id: string, change: Partial<FitEntry>) {
    setEntries((current) => current.map((entry) => entry.member.id === id ? { ...entry, ...change } : entry));
  }

  async function save() {
    if (!storageReady || pending.current || saved || (!complete && !retry)) return;
    const payload = retry ?? {
      p_department_id: departmentId,
      p_session_id: crypto.randomUUID(),
      p_name: name.trim(),
      p_test_date: date,
      p_tester_name: tester.trim(),
      p_results: entries.map((entry) => ({
        member_id: entry.member.id,
        result: entry.result,
        mask_size: entry.size,
      })),
    };
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(payload));
    } catch (caught) {
      setError(`Unable to prepare a safe retry: ${caught instanceof Error ? caught.message : String(caught)}. The session was not sent.`);
      return;
    }
    setRetry(payload);
    pending.current = true;
    setSaving(true);
    setError("");
    try {
      const { error: saveError } = await supabase.rpc("save_scba_mask_fit_session", payload);
      if (saveError) {
        if (/^(P0001|22...|23...|42501)$/.test(saveError.code)
          && saveError.message !== "Session identifier already exists with different data") {
          try {
            sessionStorage.removeItem(storageKey);
            setRetry(null);
            setError(`Session was not saved: ${saveError.message}`);
          } catch (caught) {
            setError(`The session was rejected, but its retry information could not be cleared: ${caught instanceof Error ? caught.message : String(caught)}.`);
          }
        } else {
          setError(`Unable to confirm the save: ${saveError.message}. Retry the same submission to avoid duplicates.`);
        }
        return;
      }
      setSaved(true);
      try {
        sessionStorage.removeItem(storageKey);
      } catch (caught) {
        setError(`Session saved, but retry information could not be cleared: ${caught instanceof Error ? caught.message : String(caught)}.`);
      }
    } catch (caught) {
      setError(`Unable to confirm the save: ${caught instanceof Error ? caught.message : String(caught)}. Retry the same submission to avoid duplicates.`);
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-neutral-900 p-5">
      <h2 className="text-xl font-semibold">New Testing Session</h2>
      <fieldset disabled={locked} className="mt-4 grid gap-4 md:grid-cols-3">
        <label>Session name<input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label>Test date<input className={fieldClass} type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        <label>Person conducting testing<input className={fieldClass} value={tester} onChange={(event) => setTester(event.target.value)} /></label>
      </fieldset>
      <label className="mt-5 block">Search Personnel
        <input className={fieldClass} value={search} disabled={locked} onChange={(event) => setSearch(event.target.value)} />
      </label>
      {search.trim() && !locked ? (
        <div className="mt-2 max-h-48 overflow-auto rounded-xl border border-white/10">
          {matches.length ? matches.map((member) => (
            <button type="button" className="block w-full px-3 py-2 text-left hover:bg-neutral-800" key={member.id}
              onClick={() => {
                setEntries((current) => current.some((entry) => entry.member.id === member.id)
                  ? current : [...current, { member, result: "", size: "" }]);
                setSearch("");
              }}>
              {member.name}
            </button>
          )) : <p className="p-3 text-sm text-neutral-400">No matching available personnel.</p>}
        </div>
      ) : null}
      <div className="mt-5 space-y-3">
        {entries.map((entry) => (
          <div key={entry.member.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 p-3">
            <span className="min-w-40 flex-1 font-semibold">{entry.member.name}</span>
            <fieldset disabled={locked} className="flex items-center gap-2">
              <legend className="text-xs text-neutral-400">Test Result</legend>
              {(["Pass", "Fail"] as const).map((result) => (
                <button key={result} type="button" aria-pressed={entry.result === result}
                  onClick={() => updateEntry(entry.member.id, { result })}
                  className={`rounded-lg border px-3 py-2 font-semibold ${result === "Pass"
                    ? entry.result === result ? "border-green-400 bg-green-700 text-white" : "border-green-700 text-green-300 hover:bg-green-900"
                    : entry.result === result ? "border-red-400 bg-red-700 text-white" : "border-red-700 text-red-300 hover:bg-red-900"}`}>
                  {result.toUpperCase()}
                </button>
              ))}
            </fieldset>
            <label className="text-sm">Mask Size
              <select className={fieldClass} disabled={locked} value={entry.size}
                onChange={(event) => updateEntry(entry.member.id, { size: event.target.value as MaskSize | "" })}>
                <option value="">Select</option><option value="S">Small (S)</option><option value="M">Medium (M)</option><option value="L">Large (L)</option>
              </select>
            </label>
            <button type="button" disabled={locked} onClick={() => setEntries((current) => current.filter((item) => item.member.id !== entry.member.id))}
              className="rounded-lg border border-white/20 px-3 py-2 disabled:opacity-50">Remove</button>
          </div>
        ))}
      </div>
      {error ? <p role="alert" className="mt-4 text-red-300">{error}</p> : null}
      {saved ? <p role="status" className="mt-4 text-green-300">Session saved.</p> : null}
      <button type="button" disabled={!storageReady || saving || saved || (!complete && !retry)} onClick={() => void save()}
        className="mt-5 rounded-xl bg-red-700 px-4 py-2 font-semibold text-white hover:bg-red-600 disabled:opacity-50">
        {saving ? "Saving..." : retry && !saved ? "Retry Save" : "Save Session"}
      </button>
    </section>
  );
}
