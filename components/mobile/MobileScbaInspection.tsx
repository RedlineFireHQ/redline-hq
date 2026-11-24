"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Pack = { id: string; pack_number: string; manufacturer: string | null; model: string | null; serial_number: string | null; status: string };
type Check = { key: string; label: string };
const CHECKS: Check[] = [
  { key: "condition", label: "Harness, straps, buckles, and overall pack condition" },
  { key: "cylinder", label: "Cylinder condition, pressure, and secure installation" },
  { key: "connections", label: "Regulator, hoses, and connections" },
  { key: "facepiece", label: "Facepiece, lens, seal, and straps" },
  { key: "gauge", label: "Pressure gauge and HUD indicators" },
  { key: "alarms", label: "PASS device and audible/visual alarms" },
  { key: "function", label: "Functional check completed per department SOP and manufacturer instructions" },
];

export default function MobileScbaInspection({ departmentId, memberId, memberName, departmentName, packs, initialError }: {
  departmentId: string; memberId: string; memberName: string; departmentName: string; packs: Pack[]; initialError: string | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [inspectionType, setInspectionType] = useState("Daily");
  const [checks, setChecks] = useState<Record<string, "Pass" | "Needs Attention" | "N/A">>({});
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(initialError);
  const [success, setSuccess] = useState<string | null>(null);
  const [completedSession, setCompletedSession] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => packs.filter(p => [p.pack_number,p.manufacturer,p.model,p.serial_number].filter(Boolean).join(" ").toLowerCase().includes(search.toLowerCase())), [packs,search]);
  const complete = CHECKS.every(c => checks[c.key] !== undefined);
  const hasIssue = Object.values(checks).some(v => v === "Needs Attention");

  function togglePack(id: string) { setSelected(old => old.includes(id) ? old.filter(x => x !== id) : [...old,id]); }
  function deficiencyHref(pack: Pack) {
    const params = new URLSearchParams({ returnTo: "/mobile/scba-inspections", inventoryCategory: "scba-packs", inventoryItemId: pack.id, inventoryItemLabel: pack.pack_number, apparatusId: "station-supply" });
    return "/deficiencies/report?" + params.toString();
  }
  async function saveInspection() {
    if (!selected.length) { setError("Select at least one SCBA pack."); return; }
    if (!complete) { setError("Complete each inspection step before saving."); return; }
    setSaving(true); setError(null); setSuccess(null);
    const { data: session, error: sessionError } = await supabase.from("scba_inspection_sessions").insert({
      department_id: departmentId, inspection_type: inspectionType, inspected_by: memberId, notes: notes.trim() || null,
    }).select("id").single();
    if (sessionError || !session) { setError(sessionError?.message || "Unable to save inspection session."); setSaving(false); return; }
    const payload = selected.map(packId => ({
      session_id: session.id, department_id: departmentId, scba_pack_id: packId,
      result: hasIssue ? "Needs Attention" : "Pass", checklist: checks, notes: notes.trim() || null,
    }));
    const { error: resultError } = await supabase.from("scba_inspection_results").insert(payload);
    if (resultError) {
      await supabase.from("scba_inspection_sessions").delete().eq("id", session.id).eq("department_id", departmentId);
      setError(resultError.message || "Unable to save pack inspection records."); setSaving(false); return;
    }
    setCompletedSession(session.id);
    setSuccess(`Inspection saved for ${selected.length} SCBA pack${selected.length === 1 ? "" : "s"}.`);
    setSaving(false); router.refresh();
  }

  return <main className="min-h-screen bg-[#0b0c0e] px-4 pb-12 pt-4 text-white sm:px-6">
    <div className="mx-auto max-w-3xl">
      <Link href="/mobile" className="inline-flex min-h-12 items-center text-sm font-bold text-white/65">Back to Field Actions</Link>
      <header className="mt-4 border-b border-white/10 pb-5"><p className="text-xs font-bold uppercase tracking-[0.22em] text-[#ef2b2d]">Field Action · {departmentName}</p><h1 className="mt-2 text-3xl font-black">SCBA Inspection</h1><p className="mt-2 text-sm text-white/60">Record an inspection for one or more SCBA packs. Follow your department SOP and the manufacturer's instructions.</p></header>
      {error ? <p role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">{error}</p> : null}
      {success ? <p className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">{success}</p> : null}
      <section className="mt-5 rounded-2xl border border-white/10 bg-[#17181b] p-4">
        <label className="block text-sm font-bold">Inspection Type<select value={inspectionType} onChange={e=>setInspectionType(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-[#101010] px-3 text-base"><option>Daily</option><option>Post-Fire</option><option>Post-Training</option><option>Miscellaneous Use</option></select></label>
        <label className="mt-4 block text-sm font-bold">Select SCBA Packs <span className="text-white/50">({selected.length} selected)</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search pack number or serial..." className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-[#101010] px-3 text-base" /></label>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">{filtered.map(pack=><label key={pack.id} className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border p-3 ${selected.includes(pack.id)?"border-[#ef2b2d] bg-red-500/10":"border-white/10 bg-[#101010]"}`}><input type="checkbox" checked={selected.includes(pack.id)} onChange={()=>togglePack(pack.id)} className="h-5 w-5 accent-red-500"/><span className="min-w-0"><strong className="block">{pack.pack_number}</strong><small className="text-white/55">{[pack.manufacturer,pack.model,pack.serial_number ? `SN ${pack.serial_number}` : null].filter(Boolean).join(" · ") || pack.status}</small></span></label>)}</div>
        {packs.length===0 ? <p className="mt-3 text-sm text-white/55">No active SCBA packs are listed in inventory.</p> : null}
      </section>
      <section className="mt-4 rounded-2xl border border-white/10 bg-[#17181b] p-4"><div><h2 className="text-xl font-black">Inspection Steps</h2><p className="mt-1 text-xs text-white/50">Use the current department checklist and manufacturer instructions as the controlling standard.</p></div>
        <div className="mt-4 space-y-3">{CHECKS.map(check=><div key={check.key} className="rounded-xl border border-white/10 bg-[#101010] p-3"><p className="font-semibold">{check.label}</p><div className="mt-3 grid grid-cols-3 gap-2">{(["Pass","Needs Attention","N/A"] as const).map(value=><button key={value} type="button" onClick={()=>setChecks(old=>({...old,[check.key]:value}))} className={`min-h-11 rounded-lg border text-xs font-bold ${checks[check.key]===value ? value==="Pass"?"border-emerald-400 bg-emerald-500/15 text-emerald-100":value==="Needs Attention"?"border-amber-400 bg-amber-500/15 text-amber-100":"border-sky-400 bg-sky-500/15 text-sky-100":"border-white/15 text-white/60"}`}>{value}</button>)}</div></div>)}</div>
      </section>
      <section className="mt-4 rounded-2xl border border-white/10 bg-[#17181b] p-4"><label className="block text-sm font-bold">Inspection Notes (Optional)<textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Additional observations..." className="mt-2 w-full rounded-xl border border-white/15 bg-[#101010] p-3 text-base"/></label><p className="mt-3 text-xs text-white/45">Inspected by {memberName}. Date and time are recorded automatically.</p></section>
      <button type="button" onClick={saveInspection} disabled={saving || !selected.length || !complete} className="mt-4 min-h-14 w-full rounded-xl bg-[#ef2b2d] px-4 font-black uppercase tracking-wide disabled:opacity-40">{saving?"Saving inspection...":"Save SCBA Inspection"}</button>
      {completedSession ? <section className="mt-4 rounded-2xl border border-white/10 bg-[#17181b] p-4"><h2 className="font-black">Report a Deficiency</h2><p className="mt-1 text-sm text-white/55">If any pack needs repair or follow-up, report it against that specific pack.</p><div className="mt-3 space-y-2">{packs.filter(p=>selected.includes(p.id)).map(pack=><Link key={pack.id} href={deficiencyHref(pack)} className="flex min-h-12 items-center justify-between rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 font-bold text-amber-100">Report Deficiency · {pack.pack_number}<span>›</span></Link>)}</div></section> : null}
    </div>
  </main>;
}
