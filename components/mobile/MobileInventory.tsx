"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, ChevronRight, Search } from "lucide-react";
import type { MobileInventoryItem } from "@/lib/mobile-inventory";

type Props = { items: MobileInventoryItem[]; initialError: string | null };

export default function MobileInventory({ items, initialError }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const categories = useMemo(() => Array.from(new Map(items.map((item) => [item.categoryKey, item.category])).entries()), [items]);
  const filtered = useMemo(() => items.filter((item) => {
    const haystack = [item.name, item.category, item.status, item.location, item.identifier, item.serialNumber].join(" ").toLowerCase();
    return (category === "all" || item.categoryKey === category) && (!query.trim() || haystack.includes(query.trim().toLowerCase()));
  }), [category, items, query]);

  return <main className="min-h-screen overflow-x-hidden bg-[#080808] px-4 py-5 text-white sm:px-6"><div className="mx-auto max-w-3xl space-y-5 pb-6"><Link href="/mobile" className="inline-flex min-h-12 items-center text-sm font-bold text-white/65">Back to Field Actions</Link><header className="rounded-[24px] border border-white/12 bg-[linear-gradient(145deg,rgba(35,35,35,0.98),rgba(10,10,10,0.98))] p-5 shadow-[0_20px_44px_rgba(0,0,0,0.36)]"><p className="text-xs font-black uppercase tracking-[0.22em] text-[#ef2b2d]">Cedar Bluff Fire & Rescue</p><h1 className="mt-2 text-3xl font-black">Inventory</h1><p className="mt-2 text-sm leading-6 text-white/60">Find equipment and see where it is.</p><label className="mt-5 block text-sm font-black text-white/80"><span className="sr-only">Search inventory</span><div className="flex min-h-14 items-center gap-2 rounded-2xl border border-white/15 bg-[#080808] px-4 focus-within:border-[#ef2b2d]"><Search className="h-4 w-4 text-white/35" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search inventory..." className="min-h-12 flex-1 bg-transparent text-base text-white outline-none" /></div></label></header>{initialError ? <div className="rounded-2xl border border-red-400/25 bg-red-500/12 p-4 text-sm font-bold text-red-100">Unable to load all inventory records.</div> : null}<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{[["all", "All Inventory"], ...categories].map(([value, label]) => <button key={value} type="button" onClick={() => setCategory(value)} className={`min-h-11 rounded-xl border px-3 text-xs font-black uppercase ${category === value ? "border-[#ef2b2d] bg-[#ef2b2d]/15 text-white" : "border-white/10 bg-[#121212] text-white/55"}`}>{label}</button>)}</div><section className="space-y-3"><div className="flex items-center justify-between px-1"><h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/45">Inventory Items</h2><span className="text-xs font-bold text-white/40">{filtered.length}</span></div>{filtered.length === 0 ? <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm font-bold text-white/50">No inventory items match your search.</div> : filtered.map((item) => <InventoryCard key={`${item.categoryKey}:${item.id}`} item={item} />)}</section></div></main>;
}

function InventoryCard({ item }: { item: MobileInventoryItem }) {
  return <Link href={`/mobile/inventory/${item.categoryKey}/${item.id}`} className="block rounded-2xl border border-white/12 bg-[#121212] p-4 shadow-[0_12px_30px_rgba(0,0,0,0.22)]"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-black uppercase tracking-[0.16em] text-[#ef2b2d]">{item.category}</p><h3 className="mt-1 break-words text-base font-black text-white">{item.name}</h3></div><ChevronRight className="mt-1 h-5 w-5 shrink-0 text-white/35" /></div><div className="mt-3 grid gap-2 text-sm text-white/60 sm:grid-cols-2"><p><span className="text-white/35">Status:</span> {item.status}</p><p><span className="text-white/35">Location:</span> {item.location}</p><p><span className="text-white/35">Quantity:</span> {item.quantity}</p><p><span className="text-white/35">Identifier:</span> {item.identifier}</p></div>{item.deficiencyCount > 0 ? <p className="mt-3 flex items-center gap-2 text-sm font-bold text-amber-200"><AlertTriangle className="h-4 w-4" />{item.deficiencyCount} open {item.deficiencyCount === 1 ? "deficiency" : "deficiencies"}</p> : null}</Link>;
}
