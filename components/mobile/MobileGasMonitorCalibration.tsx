"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { supabase } from "@/lib/supabase";

type Monitor = {
  id: string;
  monitor_number: string;
  serial_number: string;
  manufacturer: string | null;
  model: string | null;
  status: string;
};

type Member = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type Props = {
  departmentId: string;
  memberId: string;
  monitors: Monitor[];
  members: Member[];
  latestCalibrationByMonitorId: Record<string, string>;
  calibrationIntervalMonths: number;
  initialError: string | null;
};

type TesterMode = "member" | "external";
type Result = "Passed" | "Failed";

function today() {
  const value = new Date();
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function addMonthsToIsoDate(dateValue: string, months: number) {
  const baseDate = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(baseDate.getTime())) return null;

  const day = baseDate.getUTCDate();
  const targetDate = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth() + months, day));
  if (targetDate.getUTCDate() !== day) targetDate.setUTCDate(0);
  return targetDate.toISOString().slice(0, 10);
}

function isOnOrBeforeToday(dateValue: string | null) {
  if (!dateValue) return false;
  const parsed = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return false;
  const current = new Date();
  current.setHours(0, 0, 0, 0);
  return parsed.getTime() <= current.getTime();
}

function formatDate(value: string | null) {
  if (!value) return "Not recorded";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function memberName(member: Member) {
  return `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() || member.id;
}

function statusClasses(status: string) {
  if (status === "In Service") return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
  if (status === "Out of Service" || status === "Lost" || status === "Stolen") return "border-red-400/30 bg-red-500/10 text-red-200";
  return "border-amber-400/30 bg-amber-500/10 text-amber-200";
}

export default function MobileGasMonitorCalibration({
  departmentId,
  memberId,
  monitors,
  members,
  latestCalibrationByMonitorId,
  calibrationIntervalMonths,
  initialError,
}: Props) {
  const router = useRouter();
  const [selectedMonitor, setSelectedMonitor] = useState<Monitor | null>(null);
  const [calibrationDate, setCalibrationDate] = useState(today());
  const [testerMode, setTesterMode] = useState<TesterMode>("member");
  const [testerMemberId, setTesterMemberId] = useState(memberId);
  const [externalTesterName, setExternalTesterName] = useState("");
  const [result, setResult] = useState<Result>("Passed");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [success, setSuccess] = useState<string | null>(null);

  const rows = monitors.map((monitor) => {
    const lastCalibration = latestCalibrationByMonitorId[monitor.id] ?? null;
    const nextDue = lastCalibration ? addMonthsToIsoDate(lastCalibration, calibrationIntervalMonths) : null;
    return {
      ...monitor,
      lastCalibration,
      nextDue,
      due: !nextDue || isOnOrBeforeToday(nextDue),
    };
  }).sort((left, right) => Number(right.due) - Number(left.due) || left.monitor_number.localeCompare(right.monitor_number, undefined, { numeric: true }));

  function openCalibration(monitor: Monitor) {
    setSelectedMonitor(monitor);
    setCalibrationDate(today());
    setTesterMode("member");
    setTesterMemberId(memberId);
    setExternalTesterName("");
    setResult("Passed");
    setNotes("");
    setError(null);
    setSuccess(null);
  }

  async function saveCalibration(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedMonitor || !calibrationDate) {
      setError("Calibration date and monitor are required.");
      return;
    }
    if (testerMode === "member" && !testerMemberId) {
      setError("Select a department member for calibration.");
      return;
    }
    if (testerMode === "external" && !externalTesterName.trim()) {
      setError("Tester name is required for external calibration entries.");
      return;
    }

    setSaving(true);
    setError(null);
    const insert = await supabase.from("gas_monitor_calibrations").insert({
      department_id: departmentId,
      gas_monitor_id: selectedMonitor.id,
      calibration_date: calibrationDate,
      result,
      tester_mode: testerMode === "member" ? "Department Person" : "External",
      tester_member_id: testerMode === "member" ? testerMemberId : null,
      external_tester_name: testerMode === "external" ? externalTesterName.trim() : null,
      external_tester_company: null,
      notes: notes.trim() || null,
      created_by: memberId,
    }).select("id").single();

    if (insert.error || !insert.data) {
      setError(insert.error?.message || "Unable to save calibration.");
      setSaving(false);
      return;
    }

    const monitorNumber = selectedMonitor.monitor_number;
    setSelectedMonitor(null);
    setSuccess(`Calibration saved for Monitor ${monitorNumber}.`);
    setSaving(false);
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[#0b0c0e] px-4 pb-12 pt-4 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-5xl">
        <Link href="/mobile" className="inline-flex min-h-12 items-center text-sm font-bold text-white/65">
          Back to Field Actions
        </Link>
        <header className="mt-5 border-b border-white/10 pb-5">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#ef2b2d]">Field Action</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">Gas Monitor Calibration</h1>
          <p className="mt-2 text-sm leading-6 text-white/60">Select a monitor and record its calibration result.</p>
        </header>

        {success ? <p className="mt-5 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-100">{success}</p> : null}
        {error ? <p className="mt-5 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</p> : null}

        {selectedMonitor ? (
          <form onSubmit={saveCalibration} className="mt-5 space-y-4">
            <section className="rounded-2xl border border-white/10 bg-[#17181b] p-5 sm:p-6">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ef2b2d]">Selected Monitor</p>
              <h2 className="mt-2 text-2xl font-black">{selectedMonitor.monitor_number}</h2>
              <p className="mt-1 text-sm text-white/65">{[selectedMonitor.manufacturer, selectedMonitor.model].filter(Boolean).join(" ") || "Manufacturer not recorded"}</p>
              <p className="mt-1 text-sm text-white/50">Serial {selectedMonitor.serial_number}</p>
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#17181b] p-5 sm:p-6">
              <h2 className="text-lg font-black">Calibration Record</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="text-sm font-bold text-white/80">Calibration Date *
                  <input required type="date" value={calibrationDate} onChange={(event) => setCalibrationDate(event.target.value)} className="mt-2 min-h-14 w-full rounded-xl border border-white/15 bg-[#101010] px-4 text-base text-white [color-scheme:dark]" />
                </label>
                <div>
                  <p className="text-sm font-bold text-white/80">Result *</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {(["Passed", "Failed"] as Result[]).map((value) => <button key={value} type="button" onClick={() => setResult(value)} className={`min-h-14 rounded-xl border px-4 font-black ${result === value ? value === "Passed" ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-100" : "border-red-400/50 bg-red-500/20 text-red-100" : "border-white/15 bg-[#101010] text-white/65"}`}>{value}</button>)}
                  </div>
                </div>
                <div className="md:col-span-2">
                  <p className="text-sm font-bold text-white/80">Tested By *</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setTesterMode("member")} className={`min-h-14 rounded-xl border px-3 font-bold ${testerMode === "member" ? "border-red-400/50 bg-red-500/15 text-white" : "border-white/15 bg-[#101010] text-white/65"}`}>Department Person</button>
                    <button type="button" onClick={() => setTesterMode("external")} className={`min-h-14 rounded-xl border px-3 font-bold ${testerMode === "external" ? "border-red-400/50 bg-red-500/15 text-white" : "border-white/15 bg-[#101010] text-white/65"}`}>External</button>
                  </div>
                </div>
                {testerMode === "member" ? <label className="md:col-span-2 text-sm font-bold text-white/80">Department Member *
                  <select required value={testerMemberId} onChange={(event) => setTesterMemberId(event.target.value)} className="mt-2 min-h-14 w-full rounded-xl border border-white/15 bg-[#101010] px-4 text-base text-white"><option value="">Select department member</option>{members.map((member) => <option key={member.id} value={member.id}>{memberName(member)}</option>)}</select>
                </label> : <label className="md:col-span-2 text-sm font-bold text-white/80">External Tester Name *
                  <input required value={externalTesterName} onChange={(event) => setExternalTesterName(event.target.value)} className="mt-2 min-h-14 w-full rounded-xl border border-white/15 bg-[#101010] px-4 text-base text-white" />
                </label>}
                <label className="md:col-span-2 text-sm font-bold text-white/80">Notes
                  <textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-2 w-full rounded-xl border border-white/15 bg-[#101010] p-4 text-base text-white" />
                </label>
              </div>
            </section>

            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setSelectedMonitor(null)} className="min-h-14 rounded-xl border border-white/15 bg-[#17181b] px-4 font-bold">Cancel</button>
              <button type="submit" disabled={saving} className="min-h-14 rounded-xl bg-[#ef2b2d] px-4 font-black uppercase tracking-wide disabled:opacity-50">{saving ? "Saving..." : "Save Calibration"}</button>
            </div>
          </form>
        ) : (
          <section className="mt-5">
            <div className="flex items-end justify-between gap-3">
              <div><h2 className="text-xl font-black">Monitors</h2><p className="mt-1 text-sm text-white/55">Due monitors are listed first.</p></div>
              <span className="text-xs font-bold uppercase tracking-wide text-white/45">{calibrationIntervalMonths} month interval</span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {rows.map((monitor) => <article key={monitor.id} className={`rounded-2xl border bg-[#17181b] p-5 ${monitor.due ? "border-amber-400/35" : "border-white/10"}`}>
                <div className="flex items-start justify-between gap-3"><div><h3 className="text-xl font-black">{monitor.monitor_number}</h3><p className="mt-1 text-sm text-white/65">{[monitor.manufacturer, monitor.model].filter(Boolean).join(" ") || "Manufacturer not recorded"}</p><p className="mt-1 text-xs text-white/45">Serial {monitor.serial_number}</p></div>{monitor.due ? <span className="rounded-lg border border-amber-400/40 bg-amber-500/15 px-2 py-1 text-xs font-black uppercase text-amber-100">Due</span> : <span className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-xs font-black uppercase text-emerald-100">Current</span>}</div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-sm"><div className="rounded-xl bg-[#101010] p-3"><p className="text-xs uppercase text-white/40">Last calibration</p><p className="mt-1 font-bold">{formatDate(monitor.lastCalibration)}</p></div><div className="rounded-xl bg-[#101010] p-3"><p className="text-xs uppercase text-white/40">Next due</p><p className="mt-1 font-bold">{formatDate(monitor.nextDue)}</p></div></div>
                <div className="mt-3 flex items-center justify-between gap-3"><span className={`rounded-lg border px-2 py-1 text-xs font-bold ${statusClasses(monitor.status)}`}>{monitor.status}</span><button type="button" onClick={() => openCalibration(monitor)} className="min-h-14 min-w-36 rounded-xl bg-[#ef2b2d] px-5 font-black uppercase tracking-wide text-white">Calibrate</button></div>
              </article>)}
              {rows.length === 0 ? <p className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-white/55">No active gas monitors are available.</p> : null}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
