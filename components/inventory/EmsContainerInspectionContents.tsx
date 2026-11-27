"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Assignment = { id: string; template_item_key: string; item_label: string; batch_id: string; quantity_on_hand: number };
type BatchRow = { id: string; supply_item_id: string; quantity_remaining: number; expiration_date: string | null; lot_number: string | null };
type SupplyRow = { id: string; item_name: string };

function localDateKey(date: Date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

export default function EmsContainerInspectionContents({ departmentId, containerId, containerType, onOverridePass }: { departmentId: string; containerId: string; containerType: "pediatric_bag" | "drug_box"; onOverridePass?: (templateItemKey: string) => void }) {
  const [warnings, setWarnings] = useState<Array<{ key: string; label: string; supplyName: string; lot: string | null; expiration: string; expired: boolean; quantity: number }>>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [settingsRes, assignmentsRes, batchesRes, suppliesRes] = await Promise.all([
        supabase.from("departments").select("ems_expiration_tracking_enabled").eq("id", departmentId).maybeSingle(),
        supabase.from("ems_container_item_batches").select("id,template_item_key,item_label,batch_id,quantity_on_hand")
          .eq("department_id", departmentId).eq("container_type", containerType).eq("container_id", containerId).gt("quantity_on_hand", 0),
        supabase.from("ems_supply_batches").select("id,supply_item_id,quantity_remaining,expiration_date,lot_number")
          .eq("department_id", departmentId).gt("quantity_remaining", 0).not("expiration_date", "is", null),
        supabase.from("ems_supply_items").select("id,item_name").eq("department_id", departmentId),
      ]);
      if (cancelled) return;
      if (settingsRes.error || assignmentsRes.error || batchesRes.error || suppliesRes.error || !settingsRes.data?.ems_expiration_tracking_enabled) { setWarnings([]); setLoaded(true); return; }
      const today = localDateKey(new Date());
      const future = new Date(); future.setDate(future.getDate() + 90);
      const limit = localDateKey(future);
      const assignments = (assignmentsRes.data ?? []) as Assignment[];
      const batches = new Map(((batchesRes.data ?? []) as BatchRow[]).map((row) => [row.id, row]));
      const supplyNames = new Map(((suppliesRes.data ?? []) as SupplyRow[]).map((row) => [row.id, row.item_name]));
      const next = assignments.flatMap((assignment) => {
        const batch = batches.get(assignment.batch_id);
        if (!batch?.expiration_date || batch.expiration_date > limit) return [];
        return [{
          key: assignment.id,
          label: assignment.item_label,
          supplyName: supplyNames.get(batch.supply_item_id) ?? assignment.item_label,
          lot: batch.lot_number,
          expiration: batch.expiration_date,
          expired: batch.expiration_date < today,
          quantity: assignment.quantity_on_hand,
        }];
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
    <h2 className="text-base font-bold text-white">Expiration Warnings In This {containerType === "drug_box" ? "Drug Box" : "Bag"}</h2>
    <p className="mt-1 text-xs text-neutral-300">These are the actual batches assigned to this container, not other stock elsewhere in the station.</p>
    <div className="mt-3 space-y-2">
      {warnings.map((item) => <div key={item.key} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
        <div><p className="text-sm font-semibold text-white">{item.label}</p><p className="text-xs text-neutral-400">{item.supplyName} · Qty {item.quantity}{item.lot ? ` · Lot ${item.lot}` : ""}</p></div>
        <div className="flex items-center gap-2"><span className={item.expired ? "text-xs font-bold text-red-300" : "text-xs font-bold text-amber-200"}>{item.expired ? "EXPIRED" : `Expires ${item.expiration}`}</span>{item.expired && onOverridePass ? <button type="button" onClick={() => onOverridePass(warnings.find((warning) => warning.key === item.key)?.key ?? item.key)} className="rounded-md border border-emerald-500/40 px-2 py-1 text-[11px] font-bold text-emerald-200 hover:bg-emerald-950/40">Mark PASS</button> : null}</div>
      </div>)}
    </div>
    {expiredCount > 0 ? <p className="mt-3 text-sm font-semibold text-red-200">{expiredCount} expired batch warning(s) require attention.</p> : null}
  </section>;
}
