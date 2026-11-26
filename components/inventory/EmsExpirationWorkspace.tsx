"use client";

import { useEffect, useMemo, useState } from "react";

type Supply = { id: string; item_name: string; unit_of_measure: string; custom_unit_of_measure: string | null };
type Batch = {
  id: string; supply_item_id: string; lot_number: string | null;
  quantity_received: number; quantity_remaining: number; expiration_date: string | null;
  received_at: string; storage_location: string | null; notes: string | null;
  supply_item: Supply | Supply[];
};

function daysUntil(date: string) {
  const target = new Date(date + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}
function expiryLabel(date: string | null) {
  if (!date) return "No expiration date";
  const days = daysUntil(date);
  if (days < 0) return `Expired ${Math.abs(days)} day(s) ago`;
  if (days === 0) return "Expires today";
  if (days <= 30) return `Expires in ${days} days`;
  return new Date(date + "T00:00:00").toLocaleDateString();
}
function itemOf(batch: Batch): Supply | null {
  return Array.isArray(batch.supply_item) ? batch.supply_item[0] ?? null : batch.supply_item ?? null;
}

export default function EmsExpirationWorkspace({ supplies, canManage }: { supplies: Supply[]; canManage: boolean }) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supplyItemId, setSupplyItemId] = useState(supplies[0]?.id ?? "");
  const [quantity, setQuantity] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [lotNumber, setLotNumber] = useState("");
  const [storageLocation, setStorageLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [replaceBatchId, setReplaceBatchId] = useState<string | null>(null);
  const [replacementQuantity, setReplacementQuantity] = useState("");
  const [replacementExpiration, setReplacementExpiration] = useState("");
  const [replacementLot, setReplacementLot] = useState("");
  const [replacementReason, setReplacementReason] = useState("");

  async function refresh() {
    setLoading(true);
    const response = await fetch("/api/ems/supply-batches");
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) setError(payload.error || "Unable to load EMS batches.");
    else { setBatches(payload.batches ?? []); setError(null); }
    setLoading(false);
  }
  useEffect(() => { void refresh(); }, []);

  const summary = useMemo(() => {
    const dated = batches.filter(batch => batch.expiration_date);
    return {
      expired: dated.filter(batch => daysUntil(batch.expiration_date!) < 0).length,
      soon: dated.filter(batch => daysUntil(batch.expiration_date!) >= 0 && daysUntil(batch.expiration_date!) <= 90).length,
      earliest: dated.map(batch => batch.expiration_date!).sort()[0] ?? null,
      latest: dated.map(batch => batch.expiration_date!).sort().at(-1) ?? null,
    };
  }, [batches]);

  async function replaceBatch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!replaceBatchId) return;
    setSaving(true); setError(null);
    const response = await fetch(`/api/ems/supply-batches/${replaceBatchId}/replace`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ quantity: replacementQuantity, expirationDate: replacementExpiration, lotNumber: replacementLot, reason: replacementReason }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) setError(payload.error || "Unable to record replacement.");
    else {
      setReplaceBatchId(null); setReplacementQuantity(""); setReplacementExpiration(""); setReplacementLot(""); setReplacementReason("");
      await refresh();
    }
    setSaving(false);
  }

  async function addBatch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(null);
    const response = await fetch("/api/ems/supply-batches", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ supplyItemId, quantity, expirationDate, lotNumber, storageLocation, notes }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) setError(payload.error || "Unable to save batch.");
    else {
      setQuantity(""); setExpirationDate(""); setLotNumber(""); setNotes("");
      await refresh();
    }
    setSaving(false);
  }

  return <div className="space-y-5">
    <section className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-red-500/25 bg-red-950/20 p-4"><p className="text-xs font-bold uppercase tracking-wide text-red-200">Expired batches</p><p className="mt-1 text-3xl font-black text-white">{summary.expired}</p></div>
      <div className="rounded-xl border border-amber-500/25 bg-amber-950/20 p-4"><p className="text-xs font-bold uppercase tracking-wide text-amber-200">Expiring within 90 days</p><p className="mt-1 text-3xl font-black text-white">{summary.soon}</p></div>
      <div className="rounded-xl border border-white/10 bg-[#242424] p-4"><p className="text-xs font-bold uppercase tracking-wide text-neutral-400">Date range on hand</p><p className="mt-2 text-sm font-semibold text-white">{summary.earliest ?? "—"} <span className="text-neutral-500">to</span> {summary.latest ?? "—"}</p></div>
    </section>

    {canManage && supplies.length > 0 ? <form onSubmit={addBatch} className="rounded-xl border border-white/10 bg-[#242424] p-5">
      <h2 className="text-lg font-black text-white">Receive EMS supply batch</h2>
      <p className="mt-1 text-sm text-neutral-400">Receiving a batch increases the department's on-hand inventory and records its lot and expiration details in the stock transaction history.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm text-neutral-300 sm:col-span-2 lg:col-span-3">Supply item
          <select value={supplyItemId} onChange={e=>setSupplyItemId(e.target.value)} required className="mt-1 min-h-11 w-full rounded-lg border border-white/10 bg-[#171717] px-3 text-white">
            {supplies.map(s=><option key={s.id} value={s.id}>{s.item_name}</option>)}
          </select>
        </label>
        <label className="text-sm text-neutral-300">Quantity received<input type="number" min="0.01" step="0.01" required value={quantity} onChange={e=>setQuantity(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-white/10 bg-[#171717] px-3 text-white"/></label>
        <label className="text-sm text-neutral-300">Expiration date<input type="date" value={expirationDate} onChange={e=>setExpirationDate(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-white/10 bg-[#171717] px-3 text-white"/></label>
        <label className="text-sm text-neutral-300">Lot / batch number<input value={lotNumber} onChange={e=>setLotNumber(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-white/10 bg-[#171717] px-3 text-white"/></label>
        <label className="text-sm text-neutral-300">Storage location<input value={storageLocation} onChange={e=>setStorageLocation(e.target.value)} placeholder="Station, cabinet, bag..." className="mt-1 min-h-11 w-full rounded-lg border border-white/10 bg-[#171717] px-3 text-white"/></label>
        <label className="text-sm text-neutral-300 sm:col-span-2">Notes<input value={notes} onChange={e=>setNotes(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-white/10 bg-[#171717] px-3 text-white"/></label>
      </div>
      <button disabled={saving} className="mt-4 min-h-11 rounded-lg bg-red-600 px-5 font-bold text-white disabled:opacity-50">{saving ? "Saving..." : "Receive batch"}</button>
    </form> : null}

    {error ? <p role="alert" className="rounded-lg border border-red-500/30 bg-red-950/20 p-3 text-sm text-red-200">{error}</p> : null}
    <section className="overflow-hidden rounded-xl border border-white/10 bg-[#242424]">
      <div className="border-b border-white/10 p-4"><h2 className="font-black text-white">Supply batches</h2><p className="text-sm text-neutral-400">Each row is a separate received batch.</p></div>
      {loading ? <p className="p-5 text-sm text-neutral-400">Loading batches...</p> : batches.length === 0 ? <p className="p-5 text-sm text-neutral-400">No batches have been recorded yet. Existing inventory quantities remain unchanged until batches are entered.</p> :
      <div className="divide-y divide-white/10">{batches.map(batch=>{
        const supply=itemOf(batch); const days=batch.expiration_date ? daysUntil(batch.expiration_date) : null;
        const tone=days!==null&&days<0?"text-red-300":days!==null&&days<=90?"text-amber-300":"text-emerald-300";
        return <div key={batch.id}><article key={batch.id} className="grid gap-2 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
          <div><h3 className="font-bold text-white">{supply?.item_name ?? "EMS supply"}</h3><p className="text-xs text-neutral-400">{batch.lot_number ? `Lot ${batch.lot_number} · ` : ""}{batch.storage_location || "Location not specified"}</p><p className={`mt-1 text-sm font-semibold ${tone}`}>{expiryLabel(batch.expiration_date)}</p></div>
          <div className="text-left sm:text-right"><p className="font-bold text-white">{Number(batch.quantity_remaining)} remaining</p><p className="text-xs text-neutral-400">{Number(batch.quantity_received)} received</p>{canManage && batch.expiration_date && days !== null && days < 0 ? <button type="button" onClick={() => { setReplaceBatchId(replaceBatchId === batch.id ? null : batch.id); setReplacementQuantity(String(batch.quantity_remaining)); setReplacementExpiration(""); setReplacementLot(""); setReplacementReason("Expired item replaced during EMS inventory check"); }} className="mt-2 rounded-md border border-red-500/40 px-3 py-1.5 text-xs font-bold text-red-200 hover:bg-red-950/40">{replaceBatchId === batch.id ? "Cancel replacement" : "Replace item"}</button> : null}</div>
        </article>{replaceBatchId === batch.id ? <form onSubmit={replaceBatch} className="mx-4 mb-4 grid gap-3 rounded-lg border border-red-500/30 bg-red-950/10 p-4 sm:grid-cols-2 lg:grid-cols-4"><p className="text-sm text-neutral-200 sm:col-span-2 lg:col-span-4">Record the quantity removed from this old batch and the replacement stock received. Total on-hand inventory stays the same, and both batch records remain in the history.</p><label className="text-xs text-neutral-300">Quantity replaced<input required type="number" min="0.01" max={batch.quantity_remaining} step="0.01" value={replacementQuantity} onChange={e=>setReplacementQuantity(e.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-white/10 bg-[#171717] px-3 text-white"/></label><label className="text-xs text-neutral-300">New expiration date<input required type="date" value={replacementExpiration} onChange={e=>setReplacementExpiration(e.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-white/10 bg-[#171717] px-3 text-white"/></label><label className="text-xs text-neutral-300">New lot / batch number (optional)<input value={replacementLot} onChange={e=>setReplacementLot(e.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-white/10 bg-[#171717] px-3 text-white"/></label><label className="text-xs text-neutral-300">Reason / note<input value={replacementReason} onChange={e=>setReplacementReason(e.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-white/10 bg-[#171717] px-3 text-white"/></label><button disabled={saving} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50 sm:col-span-2 lg:col-span-4">{saving ? "Recording replacement..." : "Confirm replacement"}</button></form> : null}</div>
      })}</div>}
    </section>
  </div>;
}
