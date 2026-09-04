"use client";

import Link from "next/link";

type EmsInventorySwitchProps = {
  activeView: "supplies" | "equipment";
  outOfServiceCount?: number;
};

function tabClasses(isActive: boolean) {
  const base = "rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition";

  if (isActive) {
    return `${base} border-red-500/50 bg-red-600 text-white`;
  }

  return `${base} border-white/10 bg-[#1b1b1b] text-neutral-300 hover:bg-[#242424]`;
}

export default function EmsInventorySwitch({ activeView, outOfServiceCount }: EmsInventorySwitchProps) {
  return (
    <section className="rounded-xl border border-neutral-800 bg-[#242424] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">EMS Inventory</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link href="/inventory/ems-supplies" className={tabClasses(activeView === "supplies")}>
              Supplies
            </Link>
            <Link href="/inventory/ems-equipment" className={tabClasses(activeView === "equipment")}>
              Equipment
            </Link>
          </div>
        </div>

        {typeof outOfServiceCount === "number" ? (
          <div className="rounded-lg border border-red-500/40 bg-red-950/30 px-3 py-2 text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-red-200">Out of Service</p>
            <p className="text-sm font-black text-red-100">{outOfServiceCount}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
