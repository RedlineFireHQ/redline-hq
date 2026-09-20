"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type PrePlanListItem = {
  id: string;
  businessName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  occupancyId: string | null;
  access: string | null;
  criticalInformation: string | null;
  hazardCount: number;
  hydrantCount: number;
};

export default function MobilePrePlansList({ items }: { items: PrePlanListItem[] }) {
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLowerCase();
  const filteredItems = useMemo(
    () => items.filter((item) => {
      if (!normalizedSearch) return true;
      return [item.businessName, item.address, item.city, item.occupancyId ?? ""]
        .some((value) => value.toLowerCase().includes(normalizedSearch));
    }),
    [items, normalizedSearch],
  );

  return (
    <main className="min-h-screen bg-[#0b0c0e] px-4 pb-8 pt-4 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between gap-3">
          <Link href="/mobile" className="inline-flex min-h-12 items-center text-sm font-bold text-white/65">Back to Field Actions</Link>
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#ef2b2d]">Operations</span>
        </div>
        <header className="mt-5 border-b border-white/10 pb-5">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#ef2b2d]">Field Action</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Pre-Plans</h1>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm leading-6 text-white/60 sm:text-base">Find building intelligence before you arrive.</p>
            <Link href="/mobile/pre-plans/new" className="inline-flex min-h-12 items-center rounded-xl bg-[#ef2b2d] px-4 text-sm font-black uppercase tracking-wide text-white">Add Pre-Plan</Link>
          </div>
        </header>

        <label className="mt-5 block">
          <span className="sr-only">Search pre-plans</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} type="search" placeholder="Search business, address, city, or occupancy ID" className="min-h-14 w-full rounded-2xl border border-white/15 bg-[#1a1b1e] px-4 text-base text-white outline-none focus:border-red-500/70" />
        </label>

        {filteredItems.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center text-white/65">No active pre-plans match this search.</div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {filteredItems.map((item) => (
              <Link key={item.id} href={`/mobile/pre-plans/${item.id}`} className="block rounded-2xl border border-white/12 bg-[#18191c] p-5 shadow-[0_12px_24px_rgba(0,0,0,.22)] transition active:scale-[0.99] hover:border-red-500/50">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-black leading-tight">{item.businessName}</h2>
                    <p className="mt-2 text-base font-semibold leading-6 text-white/85">{item.address}<br />{item.city}, {item.state} {item.zip}</p>
                  </div>
                  <span className="text-xl text-[#ef2b2d]">›</span>
                </div>
                {item.occupancyId ? <p className="mt-4 text-xs font-bold uppercase tracking-[0.16em] text-white/45">Occupancy ID {item.occupancyId}</p> : null}
                {item.criticalInformation || item.access ? <p className="mt-3 line-clamp-2 text-sm leading-5 text-white/65">{item.criticalInformation ?? item.access}</p> : null}
                <div className="mt-5 flex flex-wrap gap-2 text-xs font-black uppercase tracking-wide">
                  {item.hazardCount > 0 ? <span className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-amber-100">{item.hazardCount} hazard{item.hazardCount === 1 ? "" : "s"}</span> : null}
                  {item.hydrantCount > 0 ? <span className="rounded-lg border border-sky-400/40 bg-sky-500/10 px-3 py-2 text-sky-100">{item.hydrantCount} hydrant{item.hydrantCount === 1 ? "" : "s"}</span> : null}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
