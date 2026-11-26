"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type LinkedRow = { template_item_key: string; item_label: string; required_quantity: number; quantity_on_hand: number; supply_item_id: string | null };
type BatchRow = { supply_item_id: string; quantity_remaining: number; expiration_date: string | null; lot_number: string | null };
type SupplyRow = { id: string; item_name: string; unit_of_measure: string };

export default function EmsContainerInspectionContents({ departmentId, containerId, containerType }: { departmentId: string; containerId: string; containerType: "pediatric_bag" | "drug_box" }) {
  const [rows, setRows] = useState<LinkedRow[]>([]);
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [supplies, setSupplies] = useState<SupplyRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [contentsRes, batchesRes, suppliesRes] = await Promise.all([
        supabase.from("ems_supply_container_contents").select("template_item_key,item_label,required_quantity,quantity_on_hand,supply_item_id").eq("department_id", departmentId).eq("container_type", containerType).eq("container_id", containerId),
        supabase.from("ems_supply_batches").select("supply_item_id,quantity_remaining,expiration_date,lot_number").eq("department_id", departmentId).gt("quantity_remaining", 0).order("expiration_date", { ascending: true, nullsFirst: false }),
        supabase.from("ems_supply_items").select("id,item_name,unit_of_measure").eq("department_id", departmentId),
      ]);
      if (cancelled) return;
      if (!contentsRes.error) setRows((contentsRes.data ?? []) as LinkedRow[]);
      if (!batchesRes.error) setBatches((batchesRes.data ?? []) as BatchRow[]);
      if (!suppliesRes.error) setSupplies((suppliesRes.data ?? []) as SupplyRow[]);
      setLoaded(true);
    }
    void load();
    return () => { cancelled = true; };
  }, [departmentId, containerId, containerType]);

  if (!loaded || rows.length === 0) return null;
  const supplyById = new Map(supplies.map((item) => [item.id, item]));
  const today = new Date().toISOString().slice(0, 10);
  const enriched = rows.map((row) => {
    const itemBatches = row.supply_item_id ? batches.filter((batch) => batch.supply_item_id === row.supply_item_id) : [];
    const expired = itemBatches.filter((batch) => batch.expiration_date && batch.expiration_date < today);
    const expiring = itemBatches.filter((batch) => batch.expiration_date === today);
    const supply = row.supply_item_id ? supplyById.get(row.supply_item_id) : undefined;
    const status = !row.supply_item_id ? "Not linked" : Number(row.quantity_on_hand) < Number(row.required_quantity) ? "Below required quantity" : expired.length ? "Expired batch in inventory" : "Linked";
    return { row, itemBatches, expired, expiring, supply, status };
  });
  const attention = enriched.filter((item) => item.status !== "Linked");
  return <section className="rounded-2xl border border-sky-500/25 bg-sky-950/10 p-4">
    <h2 className="text-lg font-bold text-white">Linked Inventory &amp; Expiration</h2>
    <p className="mt-1 text-xs text-neutral-400">Reference information from the container setup and central batch inventory. This does not automatically change inspection results or consume stock.</p>
    {attention.length > 0 ? <p className="mt-3 text-sm font-semibold text-amber-200">{attention.length} linked-content item(s) need attention.</p> : <p className="mt-3 text-sm text-emerald-200">Linked content quantities meet their configured required amounts.</p>}
    <div className="mt-3 space-y-2">
      {enriched.map(({ row, itemBatches, expired, expiring, supply, status }) => <div key={row.template_item_key} className="rounded-lg border border-white/10 bg-black/20 p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div><p className="text-sm font-semibold text-white">{row.item_label}</p><p className="text-xs text-neutral-400">{supply?.item_name ?? "No EMS supply linked"} · In container: {row.quantity_on_hand} · Required: {row.required_quantity}</p></div>
          <span className={status === "Linked" ? "text-xs text-emerald-300" : "text-xs font-semibold text-amber-300"}>{status}</span>
        </div>
        {row.supply_item_id ? <p className="mt-2 text-xs text-neutral-400">{itemBatches.length} active batch(es) · {itemBatches.reduce((sum, batch) => sum + Number(batch.quantity_remaining), 0)} remaining in central inventory{expired.length ? ` · ${expired.length} expired batch(es)` : ""}{expiring.length ? " · expires today" : ""}{itemBatches.find((batch) => batch.expiration_date && batch.expiration_date >= today)?.expiration_date ? ` · next expiry ${itemBatches.find((batch) => batch.expiration_date && batch.expiration_date >= today)?.expiration_date}` : ""}</p> : null}
      </div>)}
    </div>
  </section>;
}
