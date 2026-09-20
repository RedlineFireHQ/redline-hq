"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, ChevronRight, HeartPulse, Search, ScanLine } from "lucide-react";

type StockStatus = "Out of Stock" | "Critical" | "Low" | "Normal";

type SupplyItem = {
  id: string;
  item_name: string;
  item_category: string | null;
  unit_of_measure: string;
  custom_unit_of_measure: string | null;
  quantity_on_hand: number;
  reorder_threshold: number;
  critical_threshold: number | null;
  target_quantity: number | null;
  location: string | null;
  notes: string | null;
  status: "Active" | "Inactive";
  created_at: string;
  updated_at: string;
};

type RecentActivity = {
  id: string;
  transactionType: string;
  occurredAt: string;
  quantityDelta: number;
  quantityBefore: number;
  quantityAfter: number;
  performerName: string;
  destinationType: string | null;
  destinationLabel: string | null;
  notes: string | null;
};

function formatNumber(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function displayUnit(item: Pick<SupplyItem, "unit_of_measure" | "custom_unit_of_measure">) {
  if (item.unit_of_measure === "custom") return item.custom_unit_of_measure?.trim() || "Custom";
  const unit = item.unit_of_measure.trim();
  return unit ? unit.charAt(0).toUpperCase() + unit.slice(1) : "Unit";
}

function stockStatus(item: Pick<SupplyItem, "quantity_on_hand" | "reorder_threshold" | "critical_threshold">): StockStatus {
  const quantity = Number(item.quantity_on_hand ?? 0);
  const critical = typeof item.critical_threshold === "number" && Number.isFinite(item.critical_threshold)
    ? item.critical_threshold
    : null;
  if (quantity <= 0) return "Out of Stock";
  if (critical !== null && quantity <= critical) return "Critical";
  if (quantity <= Number(item.reorder_threshold ?? 0)) return "Low";
  return "Normal";
}

function statusClasses(status: StockStatus) {
  if (status === "Out of Stock" || status === "Critical") return "border-red-400/25 bg-red-500/10 text-red-200";
  if (status === "Low") return "border-amber-400/25 bg-amber-500/10 text-amber-200";
  return "border-emerald-400/25 bg-emerald-500/10 text-emerald-200";
}

function statusLabel(status: StockStatus) {
  return status === "Low" ? "Low Stock" : status;
}

function SupplyCard({ item }: { item: SupplyItem }) {
  const status = stockStatus(item);
  return (
    <Link href={`/mobile/ems-supplies/${item.id}`} className="block rounded-[20px] border border-white/12 bg-[#121212] p-4 shadow-[0_12px_30px_rgba(0,0,0,0.22)] transition active:scale-[0.99]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ef2b2d]">{item.item_category || "EMS supply"}</p>
          <h2 className="mt-1 break-words text-[17px] font-black leading-tight text-white">{item.item_name}</h2>
        </div>
        <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-white/35" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/35">Available</p><p className="mt-1 font-bold text-white">{formatNumber(item.quantity_on_hand)} {displayUnit(item)}</p></div>
        <div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/35">Status</p><span className={`mt-1 inline-flex rounded-full border px-2 py-1 text-xs font-bold ${statusClasses(status)}`}>{statusLabel(status)}</span></div>
        <div className="col-span-2"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/35">Location</p><p className="mt-1 truncate text-white/70">{item.location || "Location not recorded"}</p></div>
      </div>
    </Link>
  );
}

function Summary({ items }: { items: SupplyItem[] }) {
  const counts = items.reduce((result, item) => {
    result[stockStatus(item)] += 1;
    return result;
  }, { Normal: 0, Low: 0, Critical: 0, "Out of Stock": 0 } as Record<StockStatus, number>);
  return <div className="grid grid-cols-4 divide-x divide-white/10 rounded-[18px] border border-white/10 bg-white/[0.035] px-1 py-3">
    {[["Supplies", items.length, "text-white"], ["Low", counts.Low, "text-amber-200"], ["Critical", counts.Critical, "text-red-200"], ["Out", counts["Out of Stock"], "text-red-200"]].map(([label, value, color]) => <div key={String(label)} className="min-w-0 px-2 text-center"><p className="text-[9px] font-black uppercase tracking-[0.12em] text-white/38">{label}</p><p className={`mt-1 text-xl font-black ${color}`}>{value}</p></div>)}
  </div>;
}

export default function MobileEmsSupplies() {
  const [items, setItems] = useState<SupplyItem[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"All" | StockStatus>("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/ems/supplies", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; rows?: SupplyItem[]; error?: string };
        if (!response.ok || !payload.ok) throw new Error(payload.error || "Unable to load EMS supplies.");
        if (active) setItems((payload.rows || []).filter((item) => item.status === "Active"));
      })
      .catch((requestError) => { if (active) setError(requestError instanceof Error ? requestError.message : "Unable to load EMS supplies."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesFilter = filter === "All" || stockStatus(item) === filter;
      const haystack = `${item.item_name} ${item.item_category || ""}`.toLowerCase();
      return matchesFilter && (!normalizedQuery || haystack.includes(normalizedQuery));
    });
  }, [filter, items, query]);

  return <main className="min-h-screen overflow-x-hidden bg-[#080808] px-4 py-5 text-white sm:px-6"><div className="mx-auto max-w-2xl space-y-4 pb-4">
    <Link href="/mobile" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-white/60"><ArrowLeft className="h-4 w-4" />Field Actions</Link>
    <header className="relative overflow-hidden rounded-[24px] border border-white/12 bg-[linear-gradient(145deg,rgba(37,21,22,0.98),rgba(12,12,12,0.98))] p-5 shadow-[0_20px_44px_rgba(0,0,0,0.38)]"><span className="absolute -right-10 -top-10 h-36 w-36 rounded-full border border-red-400/10" /><div className="relative"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-red-400/25 bg-red-500/10 text-[#ff6565]"><HeartPulse className="h-6 w-6" /></span><div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#ff6565]">EMS Operations</p><h1 className="mt-1 text-3xl font-black tracking-tight">EMS Supplies</h1></div></div><p className="mt-4 max-w-sm text-sm leading-6 text-white/60">Find a medical supply, check its availability, and see where it is stored.</p><div className="mt-5 grid grid-cols-2 gap-2"><button type="button" disabled aria-disabled="true" className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 text-xs font-black uppercase tracking-[0.1em] text-white/35"><ScanLine className="h-4 w-4" />Scan Supply<span className="sr-only">Coming soon</span></button><a href="#supply-browser" className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#ef2b2d] px-3 text-xs font-black uppercase tracking-[0.1em] text-white shadow-[0_8px_20px_rgba(239,43,45,0.2)]"><Search className="h-4 w-4" />Search Supplies</a></div></div></header>
    <Summary items={items} />
    <section id="supply-browser" className="space-y-3"><div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ef2b2d]">Reference browser</p><h2 className="mt-1 text-xl font-black">Find a supply</h2></div><span className="text-xs font-bold text-white/40">{filteredItems.length} shown</span></div>
      <label className="flex min-h-14 items-center gap-3 rounded-2xl border border-white/12 bg-[#121212] px-4 focus-within:border-[#ef2b2d]"><Search className="h-5 w-5 shrink-0 text-white/35" /><span className="sr-only">Search supplies</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or category" className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-white/35" /></label>
      <div className="flex flex-wrap gap-2">{(["All", "Low", "Critical", "Out of Stock"] as const).map((option) => <button key={option} type="button" onClick={() => setFilter(option)} className={`min-h-10 rounded-xl border px-3 text-xs font-black uppercase tracking-[0.08em] ${filter === option ? "border-[#ef2b2d] bg-[#ef2b2d]/15 text-white" : "border-white/10 bg-[#121212] text-white/55"}`}>{option === "All" ? "All" : statusLabel(option)}</button>)}</div>
      {loading ? <div className="rounded-2xl border border-white/10 bg-[#121212] p-5 text-sm text-white/55">Loading supplies...</div> : null}
      {error ? <div className="rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm font-bold text-red-100">Unable to load supplies. {error}</div> : null}
      {!loading && !error && filteredItems.length === 0 ? <div className="rounded-2xl border border-white/10 bg-[#121212] p-6 text-center"><AlertTriangle className="mx-auto h-6 w-6 text-white/35" /><p className="mt-3 font-bold text-white">No supplies found</p><p className="mt-1 text-sm text-white/45">Try a different search or filter.</p></div> : null}
      <div className="space-y-3">{filteredItems.map((item) => <SupplyCard key={item.id} item={item} />)}</div>
    </section>
  </div></main>;
}

export type { RecentActivity, SupplyItem, StockStatus };
export { displayUnit, formatNumber, statusClasses, statusLabel, stockStatus };
