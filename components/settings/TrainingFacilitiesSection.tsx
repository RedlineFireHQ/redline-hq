"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getFacilityIsoCreditLevel } from "@/lib/training/iso-training";

export type TrainingFacilityRow = {
  id: string;
  name: string;
  facility_type: string;
  ownership_type: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  tower_stories: number | null;
  yard_acres: number | null;
  purpose_built_live_fire: boolean;
  formal_agreement: boolean;
  agreement_reference: string | null;
  agreement_start_date: string | null;
  agreement_end_date: string | null;
  active: boolean;
};

type FacilityForm = Omit<TrainingFacilityRow, "id">;

const EMPTY_FORM: FacilityForm = {
  name: "",
  facility_type: "drill_tower",
  ownership_type: "department_owned",
  address: "",
  city: "",
  state: "",
  zip: "",
  tower_stories: null,
  yard_acres: null,
  purpose_built_live_fire: false,
  formal_agreement: false,
  agreement_reference: "",
  agreement_start_date: "",
  agreement_end_date: "",
  active: true,
};

function qualificationLabel(facility: TrainingFacilityRow) {
  const level = getFacilityIsoCreditLevel(facility);
  return level === "full" ? "Full-credit ISO facility" : level === "partial" ? "Partial-credit ISO facility" : "Not yet qualifying";
}

interface Props {
  departmentId: string;
  currentMemberId: string;
  facilities: TrainingFacilityRow[];
}

export default function TrainingFacilitiesSection({ departmentId, currentMemberId, facilities }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(facilities);
  const [form, setForm] = useState<FacilityForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ordered = useMemo(() => [...rows].sort((a, b) => a.name.localeCompare(b.name)), [rows]);

  function startAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setOpen(true);
  }

  function startEdit(row: TrainingFacilityRow) {
    setEditingId(row.id);
    setForm({
      ...row,
      address: row.address ?? "",
      city: row.city ?? "",
      state: row.state ?? "",
      zip: row.zip ?? "",
      agreement_reference: row.agreement_reference ?? "",
      agreement_start_date: row.agreement_start_date ?? "",
      agreement_end_date: row.agreement_end_date ?? "",
    });
    setError(null);
    setOpen(true);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setError("Facility name is required.");
      return;
    }
    if (form.ownership_type !== "department_owned" && (!form.formal_agreement || !form.agreement_reference?.trim())) {
      setError("A formal agreement and agreement reference are required for a neighboring or regional facility.");
      return;
    }
    if (form.facility_type === "drill_tower" && (form.tower_stories ?? 0) < 2) {
      setError("A qualifying drill tower must have at least 2 stories. Three or more stories meet the full-credit benchmark.");
      return;
    }
    if (form.facility_type === "training_yard" && (form.yard_acres ?? 0) < 2) {
      setError("A qualifying dedicated training yard must be at least 2 acres.");
      return;
    }
    if (form.facility_type === "live_fire_burn_building" && !form.purpose_built_live_fire) {
      setError("A live-fire/burn building must be purpose-built.");
      return;
    }

    setSaving(true);
    setError(null);
    const payload = {
      department_id: departmentId,
      name,
      facility_type: form.facility_type,
      ownership_type: form.ownership_type,
      address: form.address?.trim() || null,
      city: form.city?.trim() || null,
      state: form.state?.trim() || null,
      zip: form.zip?.trim() || null,
      tower_stories: form.facility_type === "drill_tower" ? form.tower_stories : null,
      yard_acres: form.facility_type === "training_yard" ? form.yard_acres : null,
      purpose_built_live_fire: form.facility_type === "live_fire_burn_building" && form.purpose_built_live_fire,
      formal_agreement: form.ownership_type === "department_owned" ? false : form.formal_agreement,
      agreement_reference: form.ownership_type === "department_owned" ? null : form.agreement_reference?.trim() || null,
      agreement_start_date: form.ownership_type === "department_owned" ? null : form.agreement_start_date || null,
      agreement_end_date: form.ownership_type === "department_owned" ? null : form.agreement_end_date || null,
      active: form.active,
      updated_by: currentMemberId,
    };

    const result = editingId
      ? await supabase.from("training_facilities").update(payload).eq("department_id", departmentId).eq("id", editingId).select("*").single()
      : await supabase.from("training_facilities").insert({ ...payload, created_by: currentMemberId }).select("*").single();

    if (result.error || !result.data) {
      setError(result.error?.message || "Unable to save training facility.");
      setSaving(false);
      return;
    }

    const saved = result.data as TrainingFacilityRow;
    setRows((current) => editingId ? current.map((row) => row.id === editingId ? saved : row) : [...current, saved]);
    setOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSaving(false);
    router.refresh();
  }

  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
      <div className="flex flex-col gap-4 border-b border-neutral-800 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">ISO Training Facilities</h2>
          <p className="mt-2 max-w-3xl text-sm text-neutral-400">
            Save qualifying drill facilities once and reuse them on training records. Neighboring-department and regional facilities require a formal agreement.
          </p>
        </div>
        <button type="button" onClick={startAdd} className="rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-100 hover:bg-red-500/20">
          + Add Facility
        </button>
      </div>

      <div className="mt-5 space-y-3">
        {ordered.length === 0 ? <p className="rounded-xl border border-dashed border-neutral-700 p-5 text-sm text-neutral-400">No training facilities saved yet.</p> : ordered.map((row) => (
          <div key={row.id} className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-[#111111] p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-semibold text-white">{row.name}</div>
              <div className="mt-1 text-xs text-neutral-400">{row.facility_type.replaceAll("_", " ")} · {row.ownership_type.replaceAll("_", " ")}</div>
              <div className="mt-1 text-xs text-neutral-400">{[row.address, row.city, row.state, row.zip].filter(Boolean).join(", ") || "No address recorded"}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className={`rounded-full border px-2.5 py-1 text-xs ${qualifies(row) ? "border-green-500/30 bg-green-500/10 text-green-300" : "border-amber-500/30 bg-amber-500/10 text-amber-200"}`}>{qualificationLabel(row)}</span>
                {!row.active ? <span className="rounded-full border border-neutral-700 px-2.5 py-1 text-xs text-neutral-400">Inactive</span> : null}
              </div>
            </div>
            <button type="button" onClick={() => startEdit(row)} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white hover:bg-white/[0.06]">Edit</button>
          </div>
        ))}
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 px-4 py-6 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" className="my-auto w-full max-w-3xl rounded-2xl border border-white/10 bg-[#101010] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div><h3 className="text-xl font-bold text-white">{editingId ? "Edit Training Facility" : "Add Training Facility"}</h3><p className="mt-1 text-sm text-neutral-400">The facility qualification rules are applied automatically when it is selected on a training record.</p></div>
              <button type="button" onClick={() => setOpen(false)} className="text-neutral-400 hover:text-white">Close</button>
            </div>
            <form onSubmit={save} className="mt-5 space-y-4">
              {error ? <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div> : null}
              <div className="grid gap-4 md:grid-cols-2">
                <label className="md:col-span-2 block"><span className="mb-1 block text-xs font-semibold uppercase text-neutral-400">Facility name *</span><input value={form.name} onChange={(e) => setForm(v => ({...v,name:e.target.value}))} className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white" /></label>
                <label className="block"><span className="mb-1 block text-xs font-semibold uppercase text-neutral-400">Facility type *</span><select value={form.facility_type} onChange={(e) => setForm(v => ({...v,facility_type:e.target.value}))} className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white"><option value="drill_tower">Drill tower</option><option value="live_fire_burn_building">Purpose-built live-fire / burn building</option><option value="training_yard">Dedicated training yard</option><option value="regional_academy">Regional academy</option><option value="other">Other (not qualifying)</option></select></label>
                <label className="block"><span className="mb-1 block text-xs font-semibold uppercase text-neutral-400">Facility ownership *</span><select value={form.ownership_type} onChange={(e) => setForm(v => ({...v,ownership_type:e.target.value,formal_agreement:e.target.value === "department_owned" ? false : v.formal_agreement}))} className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white"><option value="department_owned">Our department</option><option value="neighboring_department">Neighboring department</option><option value="regional_academy">Regional academy</option></select></label>
                {form.facility_type === "drill_tower" ? <label className="block"><span className="mb-1 block text-xs font-semibold uppercase text-neutral-400">Tower stories *</span><input type="number" min="2" step="1" value={form.tower_stories ?? ""} onChange={(e) => setForm(v => ({...v,tower_stories:e.target.value ? Number(e.target.value) : null}))} className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white" /><span className="mt-1 block text-xs text-neutral-500">2 stories: partial-credit benchmark. 3+ stories: full-credit benchmark.</span></label> : null}
                {form.facility_type === "training_yard" ? <label className="block"><span className="mb-1 block text-xs font-semibold uppercase text-neutral-400">Dedicated yard acreage *</span><input type="number" min="2" step="0.1" value={form.yard_acres ?? ""} onChange={(e) => setForm(v => ({...v,yard_acres:e.target.value ? Number(e.target.value) : null}))} className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white" /><span className="mt-1 block text-xs text-neutral-500">At least 2 acres required.</span></label> : null}
                {form.facility_type === "live_fire_burn_building" ? <label className="flex items-center gap-2 text-sm text-white"><input type="checkbox" checked={form.purpose_built_live_fire} onChange={(e) => setForm(v => ({...v,purpose_built_live_fire:e.target.checked}))} className="accent-red-600" /> Purpose-built live-fire / burn building</label> : null}
                <label className="block"><span className="mb-1 block text-xs font-semibold uppercase text-neutral-400">Street address</span><input value={form.address ?? ""} onChange={(e) => setForm(v => ({...v,address:e.target.value}))} className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white" /></label>
                <label className="block"><span className="mb-1 block text-xs font-semibold uppercase text-neutral-400">City</span><input value={form.city ?? ""} onChange={(e) => setForm(v => ({...v,city:e.target.value}))} className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white" /></label>
                <label className="block"><span className="mb-1 block text-xs font-semibold uppercase text-neutral-400">State</span><input value={form.state ?? ""} onChange={(e) => setForm(v => ({...v,state:e.target.value}))} className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white" /></label>
                <label className="block"><span className="mb-1 block text-xs font-semibold uppercase text-neutral-400">ZIP</span><input value={form.zip ?? ""} onChange={(e) => setForm(v => ({...v,zip:e.target.value}))} className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white" /></label>
              </div>
              {form.ownership_type !== "department_owned" ? <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3"><div className="text-sm font-semibold text-amber-100">Formal agreement required</div><label className="flex items-center gap-2 text-sm text-white"><input type="checkbox" checked={form.formal_agreement} onChange={(e) => setForm(v => ({...v,formal_agreement:e.target.checked}))} className="accent-red-600" /> Formal agreement is in place</label><label className="block"><span className="mb-1 block text-xs font-semibold uppercase text-neutral-400">Agreement name / reference *</span><input value={form.agreement_reference ?? ""} onChange={(e) => setForm(v => ({...v,agreement_reference:e.target.value}))} className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white" /></label><div className="grid gap-3 md:grid-cols-2"><label className="block"><span className="mb-1 block text-xs font-semibold uppercase text-neutral-400">Agreement start</span><input type="date" value={form.agreement_start_date ?? ""} onChange={(e) => setForm(v => ({...v,agreement_start_date:e.target.value}))} className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white [color-scheme:dark]" /></label><label className="block"><span className="mb-1 block text-xs font-semibold uppercase text-neutral-400">Agreement end</span><input type="date" value={form.agreement_end_date ?? ""} onChange={(e) => setForm(v => ({...v,agreement_end_date:e.target.value}))} className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2.5 text-sm text-white [color-scheme:dark]" /></label></div></div> : null}
              <label className="flex items-center gap-2 text-sm text-white"><input type="checkbox" checked={form.active} onChange={(e) => setForm(v => ({...v,active:e.target.checked}))} className="accent-red-600" /> Available for future training records</label>
              <div className="flex justify-end gap-3 border-t border-white/10 pt-4"><button type="button" onClick={() => setOpen(false)} disabled={saving} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-neutral-300">Cancel</button><button type="submit" disabled={saving} className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving..." : "Save Facility"}</button></div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
