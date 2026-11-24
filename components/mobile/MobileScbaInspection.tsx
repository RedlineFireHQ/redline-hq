"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Pack = { id: string; pack_number: string; manufacturer: string | null; model: string | null; serial_number: string | null; status: string };
const INSPECTION_STEPS = [
  "Check the unit for cleanliness and obvious damage.",
  "Check the cylinder to see that it is full.",
  "Turn the cylinder valve on completely, listen to ensure that the low pressure alarm sounds, and all applicable indicators operate correctly.",
  "Compare gauges and related indicators to ensure that they read within allowable variances.",
  "Check hoses and connections.",
  "Check the facepiece to ensure that it is clean and in good condition and straps are fully extended.",
  "Check the harness to ensure that it is in good condition and that all straps are fully extended.",
  "Check the bypass and mainline valve (if applicable) to ensure that they are operational.",
  "Turn off cylinder valve. Bleed off air by opening bypass valve, listen for low-pressure alarm.",
  "Close bypass valve."
] as const;
const INSPECTION_TYPES = ["Daily Inspection", "Post-Fire Inspection", "Post-Training Inspection", "Miscellaneous Use Inspection"] as const;

export default function MobileScbaInspection({ departmentId, memberId, memberName, departmentName, packs, initialError }: {
  departmentId: string; memberId: string; memberName: string; departmentName: string; packs: Pack[]; initialError: string | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [inspectionType, setInspectionType] = useState<(typeof INSPECTION_TYPES)[number]>("Daily Inspection");
  const [confirmed, setConfirmed] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(initialError);
  const [success, setSuccess] = useState<string | null>(null);
  const [completedSession, setCompletedSession] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => packs.filter(p => [p.pack_number,p.manufacturer,p.model,p.serial_number].filter(Boolean).join(" ").toLowerCase().includes(search.toLowerCase())), [packs,search]);


  function togglePack(id: string) { setSelected(old => old.includes(id) ? old.filter(x => x !== id) : [...old,id]); }
  function deficiencyHref(pack: Pack) {
    const params = new URLSearchParams({ returnTo: "/mobile/scba-inspections", inventoryCategory: "scba-packs", inventoryItemId: pack.id, inventoryItemLabel: pack.pack_number, apparatusId: "station-supply" });
    return "/deficiencies/report?" + params.toString();
  }
  async function saveInspection(isConfirmed = confirmed) {
    if (!selected.length) { setError("Select at least one SCBA pack."); return; }
    if (!isConfirmed) { setError("Confirm that you followed all inspection steps."); return; }
    setSaving(true); setError(null); setSuccess(null);
    const { data: session, error: sessionError } = await supabase.from("scba_inspection_sessions").insert({
      department_id: departmentId, inspection_type: inspectionType, inspected_by: memberId, notes: notes.trim() || null,
    }).select("id").single();
    if (sessionError || !session) { setError(sessionError?.message || "Unable to save inspection session."); setSaving(false); return; }
    const payload = selected.map(packId => ({
      session_id: session.id, department_id: departmentId, scba_pack_id: packId,
      result: "Completed", checklist: { stepsReviewed: true, sopConfirmed: true }, notes: notes.trim() || null,
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
        <label className="block text-sm font-bold">Inspection Type<select value={inspectionType} onChange={e=>setInspectionType(e.target.value as (typeof INSPECTION_TYPES)[number])} className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-[#101010] px-3 text-base">{INSPECTION_TYPES.map(type => <option key={type}>{type}</option>)}</select></label>
        <label className="mt-4 block text-sm font-bold">Select SCBA Packs <span className="text-white/50">({selected.length} selected)</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search pack number or serial..." className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-[#101010] px-3 text-base" /></label>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">{filtered.map(pack=><label key={pack.id} className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border p-3 ${selected.includes(pack.id)?"border-[#ef2b2d] bg-red-500/10":"border-white/10 bg-[#101010]"}`}><input type="checkbox" checked={selected.includes(pack.id)} onChange={()=>togglePack(pack.id)} className="h-5 w-5 accent-red-500"/><span className="min-w-0"><strong className="block">{pack.pack_number}</strong><small className="text-white/55">{[pack.manufacturer,pack.model,pack.serial_number ? `SN ${pack.serial_number}` : null].filter(Boolean).join(" · ") || pack.status}</small></span></label>)}</div>
        {packs.length===0 ? <p className="mt-3 text-sm text-white/55">No active SCBA packs are listed in inventory.</p> : null}
      </section>
            {selected.length ? <section className="mt-4 rounded-2xl border border-amber-400/25 bg-amber-500/5 p-4"><h2 className="font-black text-amber-100">Report a Deficiency</h2><p className="mt-1 text-sm text-white/55">Found a problem with one of these packs? Report it directly against that pack.</p><div className="mt-3 flex flex-wrap gap-2">{packs.filter(p=>selected.includes(p.id)).map(pack=><Link key={pack.id} href={deficiencyHref(pack)} className="inline-flex min-h-11 items-center rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 text-sm font-bold text-amber-100">Report · {pack.pack_number}</Link>)}</div></section> : null}
<section className="mt-4 rounded-2xl border border-white/10 bg-[#17181b] p-4"><h2 className="text-xl font-black">Inspection Steps</h2><ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6 text-white/85">{INSPECTION_STEPS.map((step,index)=><li key={index} className="pl-1">{step}</li>)}</ol><button type="button" onClick={()=>setShowConfirmation(true)} disabled={!selected.length} className="mt-5 min-h-14 w-full rounded-xl bg-[#ef2b2d] px-4 font-black uppercase tracking-wide disabled:opacity-40">Check Complete</button></section>
      <section className="mt-4 rounded-2xl border border-white/10 bg-[#17181b] p-4"><label className="block text-sm font-bold">Inspection Notes (Optional)<textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Additional observations..." className="mt-2 w-full rounded-xl border border-white/15 bg-[#101010] p-3 text-base"/></label><p className="mt-3 text-xs text-white/45">Inspected by {memberName}. Date and time are recorded automatically.</p></section>
      {completedSession ? <section className="mt-4 rounded-2xl border border-white/10 bg-[#17181b] p-4"><h2 className="font-black">Report a Deficiency</h2><p className="mt-1 text-sm text-white/55">If any pack needs repair or follow-up, report it against that specific pack.</p><div className="mt-3 space-y-2">{packs.filter(p=>selected.includes(p.id)).map(pack=><Link key={pack.id} href={deficiencyHref(pack)} className="flex min-h-12 items-center justify-between rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 font-bold text-amber-100">Report Deficiency · {pack.pack_number}<span>›</span></Link>)}</div></section> : null}
      {showConfirmation ? <div role="dialog" aria-modal="true" aria-labelledby="scba-confirm-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"><section className="w-full max-w-lg rounded-2xl border border-white/15 bg-[#17181b] p-5 shadow-2xl"><h2 id="scba-confirm-title" className="text-xl font-black">Confirm SCBA Inspection</h2><p className="mt-3 text-sm leading-6 text-white/75">Per department SOPs/policies, I followed all the inspection steps.</p><div className="mt-5 grid grid-cols-2 gap-3"><button type="button" onClick={()=>setShowConfirmation(false)} className="min-h-12 rounded-xl border border-white/15 font-bold">Go Back</button><button type="button" disabled={saving} onClick={()=>{setConfirmed(true);setShowConfirmation(false);void saveInspection(true);}} className="min-h-12 rounded-xl bg-[#ef2b2d] font-black">{saving?"Saving...":"Yes — Check Complete"}</button></div></section></div> : null}
    </div>
  </main>;
}
