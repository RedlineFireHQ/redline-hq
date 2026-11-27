"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { DRUG_BOX_INVENTORY } from "@/lib/drug-boxes/inventory";

type ContainerType = "pediatric_bag" | "drug_box";
type ContainerOption = { id: string; label: string; type: ContainerType };
type SupplyOption = { id: string; item_name: string; unit_of_measure: string };
type BatchOption = { id: string; supply_item_id: string; expiration_date: string | null; lot_number: string | null; quantity_remaining: number };
type Assignment = { id: string; container_type: ContainerType; container_id: string; template_item_key: string; item_label: string; batch_id: string; quantity_on_hand: number };
type TemplateItem = { key: string; section: string; label: string; required: number | null; sourceQuantityText: string };

export default function EmsContainerContentsWorkspace({ departmentId, containers, supplies }: { departmentId: string; containers: ContainerOption[]; supplies: SupplyOption[]; existing?: unknown[] }) {
  const [selectedContainerId, setSelectedContainerId] = useState(containers[0]?.id ?? "");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { batchId: string; quantity: string }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pediatricTemplate, setPediatricTemplate] = useState<TemplateItem[]>([]);

  const container = containers.find((item) => item.id === selectedContainerId);
  const template: TemplateItem[] = useMemo(() => {
    if (!container) return [];
    if (container.type === "pediatric_bag") return pediatricTemplate;
    return DRUG_BOX_INVENTORY.map((item, index) => ({
      key: `drug-item-${index}`,
      section: item[0],
      label: item[1],
      required: item[2],
      sourceQuantityText: item[3],
    }));
  }, [container, pediatricTemplate]);
  useEffect(() => {
    let cancelled = false;
    async function loadPediatricTemplate() {
      if (!container || container.type !== "pediatric_bag") {
        setPediatricTemplate([]);
        return;
      }
      const { data, error: templateError } = await supabase
        .from("pediatric_bag_checklist_items")
        .select("id,section_name,item_label,required_quantity,source_quantity_text")
        .eq("department_id", departmentId)
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (cancelled) return;
      if (templateError) {
        setError(templateError.message || "Unable to load the pediatric bag checklist.");
        setPediatricTemplate([]);
        return;
      }
      setPediatricTemplate((data ?? []).map((row) => ({
        key: row.id,
        section: row.section_name || "General",
        label: row.item_label,
        required: row.required_quantity,
        sourceQuantityText: row.source_quantity_text || "",
      })));
    }
    void loadPediatricTemplate();
    return () => { cancelled = true; };
  }, [departmentId, container?.id, container?.type]);
  const grouped = useMemo(() => {
    const map = new Map<string, TemplateItem[]>();
    for (const item of template) map.set(item.section, [...(map.get(item.section) ?? []), item]);
    return [...map.entries()];
  }, [template]);

  function normalizeSupplyName(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9.]+/g, " ").trim().split(/\s+/).filter(Boolean).sort().join(" ");
  }

  async function load() {
    setLoading(true);
    const [assignmentResult, batchResult] = await Promise.all([
      supabase.from("ems_container_item_batches").select("id,container_type,container_id,template_item_key,item_label,batch_id,quantity_on_hand").eq("department_id", departmentId),
      supabase.from("ems_supply_batches").select("id,supply_item_id,expiration_date,lot_number,quantity_remaining").eq("department_id", departmentId).gt("quantity_remaining", 0).order("expiration_date", { ascending: true, nullsFirst: false }),
    ]);
    if (assignmentResult.error || batchResult.error) setError(assignmentResult.error?.message ?? batchResult.error?.message ?? "Unable to load expiration records.");
    else {
      const rows = (assignmentResult.data ?? []) as Assignment[];
      setAssignments(rows);
      setBatches((batchResult.data ?? []) as BatchOption[]);
      const next: Record<string, { batchId: string; quantity: string }> = {};
      for (const row of rows) if (row.container_id === selectedContainerId) next[row.template_item_key] = { batchId: row.batch_id, quantity: String(row.quantity_on_hand) };
      setDrafts(next);
    }
    setLoading(false);
  }
  useEffect(() => { void load(); }, [departmentId, selectedContainerId]);

  useEffect(() => {
    const next: Record<string, { batchId: string; quantity: string }> = {};
    for (const row of assignments) if (row.container_id === selectedContainerId) next[row.template_item_key] = { batchId: row.batch_id, quantity: String(row.quantity_on_hand) };
    setDrafts(next);
  }, [selectedContainerId, assignments]);

  function update(key: string, patch: Partial<{ batchId: string; quantity: string }>) {
    setDrafts((current) => ({ ...current, [key]: { batchId: current[key]?.batchId ?? "", quantity: current[key]?.quantity ?? "0", ...patch } }));
  }

  async function save() {
    if (!container) return;
    setSaving(true); setError(""); setMessage("");
    let validationError = "";
    const rows = template.flatMap((item) => {
      const draft = drafts[item.key];
      if (!draft?.batchId) return [];
      const qty = Number(draft.quantity);
      if (!Number.isFinite(qty) || qty <= 0) { validationError = `Enter a quantity greater than zero for ${item.label}.`; return []; }
      const batch = batches.find((candidate) => candidate.id === draft.batchId);
      if (!batch) { validationError = `Choose a valid recorded batch for ${item.label}.`; return []; }
      return [{ department_id: departmentId, container_type: container.type, container_id: container.id, template_item_key: item.key, item_label: item.label, batch_id: draft.batchId, quantity_on_hand: qty }];
    });
    if (validationError) { setError(validationError); setSaving(false); return; }
    const { error: upsertError } = rows.length
      ? await supabase.from("ems_container_item_batches").upsert(rows, { onConflict: "department_id,container_type,container_id,template_item_key,batch_id" })
      : { error: null };
    if (upsertError) { setError(upsertError.message); setSaving(false); return; }
    const retainedAssignments = new Set(rows.map((row) => `${row.template_item_key}:${row.batch_id}`));
    const staleRows = assignments.filter((row) => row.container_type === container.type && row.container_id === container.id && !retainedAssignments.has(`${row.template_item_key}:${row.batch_id}`));
    if (staleRows.length) {
      const { error: cleanupError } = await supabase.from("ems_container_item_batches").delete().in("id", staleRows.map((row) => row.id));
      if (cleanupError) { setError(`Assignments saved, but old selections could not be cleared: ${cleanupError.message}`); setSaving(false); return; }
    }
    await load();
    setMessage("Saved. This bag or box now has its own expiration records.");
    setSaving(false);
  }

  if (!containers.length) return <p className="rounded-xl border border-neutral-800 p-5 text-sm text-neutral-400">No active EMS bags or drug boxes are configured.</p>;
  return <div className="space-y-5">
    <section className="rounded-xl border border-neutral-800 bg-[#202020] p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">One-time setup</p>
      <h2 className="mt-1 text-lg font-bold text-white">Choose a bag or drug box</h2>
      <p className="mt-2 text-sm text-neutral-400">Select from {supplies.length} department supply item(s) and their recorded batches. Leave an item blank if you are not tracking its expiration.</p>
      <div className="mt-4 flex flex-wrap gap-2">{containers.map((item) => <button key={item.id} type="button" onClick={() => setSelectedContainerId(item.id)} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${selectedContainerId === item.id ? "border-red-500 bg-red-950/30 text-white" : "border-neutral-700 text-neutral-300"}`}>{item.label}</button>)}</div>
    </section>
    {loading ? <p className="p-4 text-sm text-neutral-400">Loading supplies...</p> : grouped.map(([section, items]) => <section key={section} className="overflow-hidden rounded-xl border border-neutral-800 bg-[#202020]">
      <h2 className="border-b border-neutral-800 px-4 py-3 text-sm font-bold text-white">{section}</h2>
      <div className="divide-y divide-neutral-800">{items.map((item) => {
        const draft = drafts[item.key] ?? { batchId: "", quantity: String(item.required ?? 1) };
        const itemKey = normalizeSupplyName(item.label);\n        const options = batches.filter((batch) => {\n          const supply = supplies.find((candidate) => candidate.id === batch.supply_item_id);\n          return supply ? normalizeSupplyName(supply.item_name) === itemKey : false;\n        });
        return <div key={item.key} className="grid gap-2 p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_90px] md:items-center">
          <div><p className="text-sm font-semibold text-white">{item.label}</p><p className="text-xs text-neutral-500">Required: {item.required ?? "Not specified"}{item.sourceQuantityText ? ` · Source: ${item.sourceQuantityText}` : ""}</p></div>
          <select value={draft.batchId} onChange={(event) => update(item.key, { batchId: event.target.value })} className="min-w-0 rounded-lg border border-neutral-700 bg-neutral-900 p-2 text-sm text-white">
            <option value="">Not tracking expiration</option>
            {options.map((batch) => <option key={batch.id} value={batch.id}>{batch.expiration_date ? `Exp ${batch.expiration_date}` : "No date"} · Qty {batch.quantity_remaining}{batch.lot_number ? ` · Lot ${batch.lot_number}` : ""}</option>)}
          </select>
          <input aria-label={`Quantity in ${item.label}`} type="number" min="0" step="0.01" value={draft.quantity} onChange={(event) => update(item.key, { quantity: event.target.value })} className="w-full rounded-lg border border-neutral-700 bg-neutral-900 p-2 text-sm text-white" />
        </div>;
      })}</div>
    </section>)}
    {error ? <p role="alert" className="text-sm text-red-300">{error}</p> : null}
    {message ? <p role="status" className="text-sm text-emerald-300">{message}</p> : null}
    <button type="button" onClick={() => void save()} disabled={saving || loading} className="w-full rounded-xl bg-red-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{saving ? "Saving..." : "Save Bag / Box Expiration Setup"}</button>
  </div>;
}
