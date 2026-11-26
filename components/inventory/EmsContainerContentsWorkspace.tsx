"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import { PEDIATRIC_INVENTORY } from "@/lib/pediatric-bags/inventory";
import { DRUG_BOX_INVENTORY } from "@/lib/drug-boxes/inventory";

type ContainerType = "pediatric_bag" | "drug_box";
type ContainerOption = { id: string; label: string; type: ContainerType };
type SupplyOption = { id: string; item_name: string; unit_of_measure: string };
type ExistingContent = {
  id: string;
  container_type: ContainerType;
  container_id: string;
  template_item_key: string;
  supply_item_id: string | null;
  quantity_on_hand: number;
  notes: string | null;
};
type TemplateItem = { key: string; section: string; label: string; required: number | null; sourceQuantityText: string };
type Draft = { supplyItemId: string; quantityOnHand: string; notes: string };
type BatchSummary = { supply_item_id: string; quantity_remaining: number; expiration_date: string | null; lot_number: string | null };

export default function EmsContainerContentsWorkspace({
  containers,
  supplies,
  existing,
  departmentId,
}: {
  departmentId: string;
  containers: ContainerOption[];
  supplies: SupplyOption[];
  existing: ExistingContent[];
}) {
  const [selectedContainerId, setSelectedContainerId] = useState(containers[0]?.id ?? "");
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => {
    const initial: Record<string, Draft> = {};
    for (const row of existing) initial[`${row.container_id}:${row.template_item_key}`] = {
      supplyItemId: row.supply_item_id ?? "",
      quantityOnHand: String(row.quantity_on_hand ?? 0),
      notes: row.notes ?? "",
    };
    return initial;
  });
  const [saving, setSaving] = useState(false);
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  useEffect(() => {
    let cancelled = false;
    async function loadBatches() {
      const { data, error } = await supabase.from("ems_supply_batches")
        .select("supply_item_id, quantity_remaining, expiration_date, lot_number")
        .eq("department_id", departmentId).gt("quantity_remaining", 0)
        .order("expiration_date", { ascending: true, nullsFirst: false });
      if (!cancelled && !error) setBatches((data ?? []) as BatchSummary[]);
    }
    void loadBatches();
    return () => { cancelled = true; };
  }, [departmentId]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const container = containers.find((item) => item.id === selectedContainerId);
  const template: TemplateItem[] = useMemo(() => {
    if (!container) return [];
    if (container.type === "pediatric_bag") return PEDIATRIC_INVENTORY.map((item, index) => ({
      key: `pediatric-${index}`, section: item[0], label: item[1], required: item[2], sourceQuantityText: item[3],
    }));
    return DRUG_BOX_INVENTORY.map((item, index) => ({
      key: `drug-${index}`, section: item[0], label: item[1], required: item[2], sourceQuantityText: item[3],
    }));
  }, [container]);

  const grouped = useMemo(() => {
    const map = new Map<string, TemplateItem[]>();
    for (const item of template) map.set(item.section, [...(map.get(item.section) ?? []), item]);
    return [...map.entries()];
  }, [template]);

  function update(key: string, patch: Partial<Draft>) {
    setDrafts((current) => {
      const previous = current[key] ?? { supplyItemId: "", quantityOnHand: "0", notes: "" };
      return { ...current, [key]: { ...previous, ...patch } };
    });
  }

  async function save() {
    if (!container) return;
    setSaving(true); setError(null); setMessage(null);
    try {
      const rows = template.flatMap((item) => {
        const storageKey = `${container.id}:${item.key}`;
        const draft = drafts[storageKey] ?? { supplyItemId: "", quantityOnHand: "0", notes: "" };
        const qty = Number(draft.quantityOnHand);
        if (!draft.supplyItemId && (!Number.isFinite(qty) || qty === 0) && !draft.notes.trim()) return [];
        if (!Number.isFinite(qty) || qty < 0) throw new Error(`Enter a valid on-hand quantity for ${item.label}.`);
        return [{
          department_id: departmentId,
          container_type: container.type,
          container_id: container.id,
          template_item_key: item.key,
          section_name: item.section,
          item_label: item.label,
          required_quantity: item.required ?? 0,
          quantity_on_hand: qty,
          supply_item_id: draft.supplyItemId || null,
          notes: draft.notes.trim() || null,
        }];
      });
      const clearedIds = existing
        .filter((row) => row.container_id === container.id)
        .filter((row) => {
          const draft = drafts[`${container.id}:${row.template_item_key}`] ?? { supplyItemId: "", quantityOnHand: "0", notes: "" };
          return !draft.supplyItemId && Number(draft.quantityOnHand) === 0 && !draft.notes.trim();
        })
        .map((row) => row.id);
      if (clearedIds.length) {
        const { error: deleteError } = await supabase.from("ems_supply_container_contents")
          .delete().eq("department_id", departmentId).in("id", clearedIds);
        if (deleteError) throw new Error(deleteError.message);
      }
      if (rows.length) {
        const { error: saveError } = await supabase.from("ems_supply_container_contents")
          .upsert(rows, {
            onConflict: "department_id,container_type,container_id,template_item_key",
          });
        if (saveError) throw new Error(saveError.message);
      }
      setMessage("Container contents saved. Clearing a previously saved link removes that link while preserving the checklist item.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save container contents.");
    } finally {
      setSaving(false);
    }
  }

  if (!containers.length) return <p className="rounded-xl border border-neutral-800 p-5 text-sm text-neutral-400">No active EMS bags or drug boxes are configured.</p>;

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-neutral-800 bg-[#202020] p-4">
        <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400">Choose a bag or drug box</label>
        <select value={selectedContainerId} onChange={(event) => setSelectedContainerId(event.target.value)} className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-900 p-3 text-sm text-white">
          {containers.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
        <p className="mt-2 text-xs text-neutral-500">Match each checklist item to an EMS inventory item and record how many are physically inside this specific bag or box. This is a setup link only: it does not remove stock from central inventory or assign expiration batches to the container yet.</p>
      </section>
      {grouped.map(([section, items]) => (
        <section key={section} className="overflow-hidden rounded-xl border border-neutral-800 bg-[#202020]">
          <h2 className="border-b border-neutral-800 px-4 py-3 text-sm font-bold text-white">{section}</h2>
          <div className="divide-y divide-neutral-800">
            {items.map((item) => {
              const storageKey = `${container?.id ?? ""}:${item.key}`;
              const draft = drafts[storageKey] ?? { supplyItemId: "", quantityOnHand: "0", notes: "" };
              return <div key={item.key} className="grid gap-2 p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_100px]">
                <div><p className="text-sm font-medium text-white">{item.label}</p><p className="text-xs text-neutral-500">Required: {item.required ?? "Not specified"}{item.sourceQuantityText ? ` · Source: ${item.sourceQuantityText}` : ""}</p>{draft.supplyItemId ? <p className="mt-1 text-xs text-amber-200">{batches.filter(batch => batch.supply_item_id === draft.supplyItemId).length ? `${batches.filter(batch => batch.supply_item_id === draft.supplyItemId).length} tracked batch(es) · earliest expiration ${batches.find(batch => batch.supply_item_id === draft.supplyItemId && batch.expiration_date)?.expiration_date ?? "not recorded"}` : "No tracked batches for this supply yet"}</p> : null}</div>
                <select value={draft.supplyItemId} onChange={(event) => update(storageKey, { supplyItemId: event.target.value })} className="min-w-0 rounded-lg border border-neutral-700 bg-neutral-900 p-2 text-sm text-white">
                  <option value="">Not linked to EMS inventory</option>
                  {supplies.map((supply) => <option key={supply.id} value={supply.id}>{supply.item_name} ({supply.unit_of_measure})</option>)}
                </select>
                <input aria-label={`Quantity on hand for ${item.label}`} type="number" min="0" step="0.01" value={draft.quantityOnHand} onChange={(event) => update(storageKey, { quantityOnHand: event.target.value })} className="w-full rounded-lg border border-neutral-700 bg-neutral-900 p-2 text-sm text-white" />
                <input aria-label={`Notes for ${item.label}`} value={draft.notes} onChange={(event) => update(storageKey, { notes: event.target.value })} placeholder="Notes (optional)" className="rounded-lg border border-neutral-700 bg-neutral-900 p-2 text-sm text-white md:col-span-3" />
              </div>;
            })}
          </div>
        </section>
      ))}
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      {message && <p role="status" className="text-sm text-emerald-300">{message}</p>}
      <button type="button" onClick={() => void save()} disabled={saving} className="w-full rounded-xl bg-red-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{saving ? "Saving…" : "Save Container Contents"}</button>
    </div>
  );
}
