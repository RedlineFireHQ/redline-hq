"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type LinkedRow = { template_item_key: string; item_label: string; supply_item_id: string | null };
type BatchRow = { supply_item_id: string; quantity_remaining: number; expiration_date: string | null; lot_number: string | null };
type SupplyRow = { id: string; item_name: string };

function localDateKey(date: Date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

export default function EmsContainerInspectionContents({ departmentId, containerId, containerType }: { departmentId: string; containerId: string; containerType: "pediatric_bag" | "drug_box" }) {
  const [warnings, setWarnings] = useState<Array<{ key: string; label: string; supplyName: string; lot: string | null; expiration: string; expired: boolean }>>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [contentsRes, batchesRes, suppliesRes] = await Promise.all([
        supabase.from("ems_supply_container_contents").select("template_item_key,item_label,supply_item_id").eq("department_id", departmentId).eq("container_type", containerType).eq("container_id", containerId).not("supply_item_id", "is", null),
        supabase.from("ems_supply_batches").select("supply_item_id,quantity_remaining,expiration_date,lot_number").eq("department_id", departmentId).gt("quantity_remaining", 0).not("expiration_date", "is", null),
        supabase.from("ems_supply_items").select("id,item_name").eq("department_id", departmentId),
      ]);
      if (cancelled) return;
      if (contentsRes.error || batchesRes.error || suppliesRes.error) {
        setLoaded(true);
        return;
      }
      const today = localDateKey(new Date());
      const future = new Date();
      future.setDate(future.getDate() + 90);
      const limit = localDateKey(future);
      const supplyNames = new Map(((suppliesRes.data ?? []) as SupplyRow[]).map((row) => [row.id, row.item_name]));
      const linked = (contentsRes.data ?? []) as LinkedRow[];
      const batches = (batchesRes.data ?? []) as BatchRow[];
      const next = linked.flatMap((row) => {
        if (!row.supply_item_id) return [];
        return batches.filter((batch) => batch.supply_item_id === row.supply_item_id && batch.expiration_date && batch.expiration_date <= limit)
          .map((batch) => ({ key: row.template_item_key + batch.lot_number, label: row.item_label, supplyName: supplyNames.get(row.supply_item_id!) ?? "EMS supply", lot: batch.lot_number, expiration: batch.expiration_date!, expired: batch.expiration_date! < today }));
      });
      setWarnings(next);
      setLoaded(true);
    }
    void load();
    return () => { cancelled = true; };
  }, [departmentId, containerId, containerType]);

  if (!loaded || warnings.length === 0) return null;
  const expiredCount = warnings.filter((item) => item.expired).length;
  return <section className="rounded-xl border border-amber-500/30 bg-amber-950/15 p-4">
    <h2 className="text-base font-bold text-white">EMS Supply Expiration Warnings</h2>
    <p className="mt-1 text-xs text-neutral-300">These warnings come from the department's expiration batches. Continue the normal inspection below.</p>
    <div className="mt-3 space-y-2">
      {warnings.map((item) => <div key={item.key} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
        <div><p className="text-sm font-semibold text-white">{item.label}</p><p className="text-xs text-neutral-400">Inventory: {item.supplyName}{item.lot ? ` · Lot ${item.lot}` : ""}</p></div>
        <span className={item.expired ? "text-xs font-bold text-red-300" : "text-xs font-bold text-amber-200"}>{item.expired ? "EXPIRED" : `Expires ${item.expiration}`}</span>
      </div>)}
    </div>
    {expiredCount > 0 ? <p className="mt-3 text-sm font-semibold text-red-200">{expiredCount} expired batch warning(s) require attention.</p> : null}
  </section>;
}
