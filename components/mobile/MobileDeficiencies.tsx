"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Camera, CheckCircle2, ChevronLeft, FilePlus2, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";
import { useMobileWorkflow } from "@/components/mobile/MobileShell";

type Option = { id: string; name: string };

type Deficiency = {
  id: string;
  deficiencyNumber: string | null;
  description: string | null;
  location: string | null;
  reportedAt: string | null;
  photoPath: string | null;
  reportedBy: string | null;
  category: string | null;
  priority: string | null;
  status: string | null;
  relatedItem: string | null;
};

type RelatedItem = {
  type: string;
  typeLabel: string;
  id: string;
  label: string;
  detail: string | null;
  status: string | null;
};

type Props = {
  departmentId: string;
  memberId: string;
  memberName: string;
  deficiencies: Deficiency[];
  categories: Option[];
  priorities: Option[];
  openStatusId: string;
  relatedItems: RelatedItem[];
  initialError: string | null;
};

type View = "list" | "form" | "detail" | "success";

const relatedItemTypes = [
  { type: "apparatus_id", label: "Apparatus" },
  { type: "fire_hose_id", label: "Fire Hose" },
  { type: "scba_cylinder_id", label: "SCBA Cylinder" },
  { type: "scba_pack_id", label: "SCBA Pack" },
  { type: "portable_radio_id", label: "Portable Radio" },
  { type: "portable_radio_mic_id", label: "Portable Radio Microphone" },
  { type: "thermal_imaging_camera_id", label: "Thermal Imaging Camera" },
  { type: "gas_monitor_id", label: "Gas Monitor" },
  { type: "battery_id", label: "Battery" },
  { type: "pie_equipment_id", label: "PIE Equipment" },
  { type: "ground_ladder_id", label: "Ground Ladder" },
  { type: "ems_equipment_id", label: "EMS Equipment" },
  { type: "ppe_item_id", label: "PPE" },
  { type: "rope_item_id", label: "Rope" },
  { type: "fire_extinguisher_id", label: "Fire Extinguisher" },
  { type: "misc_fire_equipment_id", label: "Miscellaneous Fire Equipment" },
];

const sideEffectTables: Record<string, string> = {
  fire_hose_id: "fire_hose",
  scba_cylinder_id: "scba_cylinders",
  scba_pack_id: "scba_packs",
  pie_equipment_id: "pie_equipment",
  gas_monitor_id: "gas_monitors",
  battery_id: "batteries",
  thermal_imaging_camera_id: "thermal_imaging_cameras",
  ground_ladder_id: "ground_ladders",
};

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function formatDate(value: string | null) {
  if (!value) return "Not reported";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

function statusClasses(status: string | null) {
  const normalized = normalize(status);
  if (normalized === "open") return "border-red-400/30 bg-red-500/12 text-red-100";
  if (normalized === "in progress") return "border-amber-300/30 bg-amber-400/12 text-amber-100";
  if (normalized === "resolved") return "border-emerald-300/30 bg-emerald-500/12 text-emerald-100";
  return "border-white/12 bg-white/8 text-white/75";
}

function priorityClasses(priority: string | null) {
  const normalized = normalize(priority);
  if (normalized === "critical") return "text-red-200";
  if (normalized === "high") return "text-orange-200";
  if (normalized === "medium") return "text-amber-100";
  if (normalized === "low") return "text-sky-100";
  return "text-white/70";
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9.-]/g, "_") || "photo.jpg";
}

function createBrowserUuid() {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }

  if (typeof cryptoApi?.getRandomValues === "function") {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
  }

  const fallback = `${Date.now().toString(16).padStart(12, "0")}${Math.floor(Math.random() * 0xffffffffffff).toString(16).padStart(12, "0")}`.slice(0, 24);
  return `${fallback.slice(0, 8)}-${fallback.slice(8, 12)}-4${fallback.slice(13, 16)}-8${fallback.slice(17, 20)}-${fallback.slice(20, 24)}${Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0")}`;
}

function emptyPayloadLinks(): Record<string, string | null> {
  return {
    apparatus_id: null,
    fire_hose_id: null,
    scba_cylinder_id: null,
    scba_pack_id: null,
    portable_radio_id: null,
    portable_radio_mic_id: null,
    thermal_imaging_camera_id: null,
    gas_monitor_id: null,
    battery_id: null,
    pie_equipment_id: null,
    ground_ladder_id: null,
    ems_equipment_id: null,
    ppe_item_id: null,
    rope_item_id: null,
    fire_extinguisher_id: null,
    misc_fire_equipment_id: null,
  };
}

export default function MobileDeficiencies({
  departmentId,
  memberId,
  memberName,
  deficiencies,
  categories,
  priorities,
  openStatusId,
  relatedItems,
  initialError,
}: Props) {
  const router = useRouter();
  const [view, setView] = useState<View>("list");
  const setWorkflowFocused = useMobileWorkflow();

  useEffect(() => {
    setWorkflowFocused?.(view === "form");
    return () => setWorkflowFocused?.(false);
  }, [setWorkflowFocused, view]);
  const [rows, setRows] = useState(deficiencies);
  const [selectedDeficiency, setSelectedDeficiency] = useState<Deficiency | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [priorityId, setPriorityId] = useState("");
  const [selectedItem, setSelectedItem] = useState<RelatedItem | null>(null);
  const [itemType, setItemType] = useState("apparatus_id");
  const [itemSearch, setItemSearch] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initialError);
  const [saving, setSaving] = useState(false);
  const [successNumber, setSuccessNumber] = useState<string | null>(null);

  const filteredRows = rows.filter((row) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;

    return [
      row.deficiencyNumber,
      row.description,
      row.relatedItem,
      row.category,
      row.location,
      row.priority,
      row.status,
    ].some((value) => normalize(value).includes(query));
  });
  const activeRows = filteredRows.filter((row) => {
    const status = normalize(row.status);
    return status === "open" || status === "in progress";
  });
  const resolvedRows = filteredRows.filter((row) => normalize(row.status) === "resolved");
  const hasSearch = searchQuery.trim().length > 0;
  const hasSearchResults = filteredRows.length > 0;

  const filteredItems = relatedItems
    .filter((item) => item.type === itemType)
    .filter((item) => {
      const query = itemSearch.trim().toLowerCase();
      if (!query) return true;
      return [item.label, item.detail, item.status, item.typeLabel].some((value) => normalize(value).includes(query));
    })
    .slice(0, 30);

  function resetForm() {
    setDescription("");
    setCategoryId("");
    setPriorityId("");
    setSelectedItem(null);
    setItemType("apparatus_id");
    setItemSearch("");
    setPhoto(null);
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoPreviewUrl(null);
    setError(null);
  }

  function openForm() {
    resetForm();
    setView("form");
  }

  function selectPhoto(file: File | null) {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhoto(file);
    setPhotoPreviewUrl(file ? URL.createObjectURL(file) : null);
  }

  function openDetail(deficiency: Deficiency) {
    setSelectedDeficiency(deficiency);
    setView("detail");
  }

  async function saveDeficiency() {
    if (!description.trim()) {
      setError("Please describe what you found.");
      return;
    }
    if (!categoryId) {
      setError("Please select a category.");
      return;
    }
    if (!priorityId) {
      setError("Please select a priority.");
      return;
    }
    if (!openStatusId) {
      setError("Unable to find the Open status. Please try again.");
      return;
    }

    setSaving(true);
    setError(null);
    const deficiencyId = createBrowserUuid();
    let photoPath: string | null = null;

    if (photo) {
      photoPath = `${deficiencyId}/${Date.now()}-${sanitizeFileName(photo.name)}`;
      const upload = await supabase.storage.from("deficiency-photos").upload(photoPath, photo, { cacheControl: "3600", upsert: false });
      if (upload.error) {
        setError("Unable to upload the photo. Please try again.");
        setSaving(false);
        return;
      }
    }

    const now = new Date().toISOString();
    const linkFields = emptyPayloadLinks();
    if (selectedItem && selectedItem.type in linkFields) {
      linkFields[selectedItem.type as keyof typeof linkFields] = selectedItem.id;
    }

    const payload = {
      id: deficiencyId,
      department_id: departmentId,
      category_id: categoryId,
      priority: priorityId,
      description: description.trim(),
      location: null,
      reported_at: now,
      created_at: now,
      status: openStatusId,
      photo_path: photoPath,
      reported_by: memberId,
      ...linkFields,
    };

    const insert = await supabase.from("deficiencies").insert(payload).select("id, deficiency_number").single();
    if (insert.error || !insert.data) {
      setError("Unable to save the deficiency. Please try again.");
      setSaving(false);
      return;
    }

    await supabase.from("deficiency_history").insert({
      deficiency_id: insert.data.id,
      event_type: "Reported",
      event_description: "Deficiency reported.",
      member_id: memberId,
    });

    if (selectedItem && sideEffectTables[selectedItem.type]) {
      await supabase.from(sideEffectTables[selectedItem.type]).update({ status: "Out of Service" }).eq("id", selectedItem.id);
    }

    const savedRow: Deficiency = {
      id: insert.data.id,
      deficiencyNumber: typeof insert.data.deficiency_number === "string" ? insert.data.deficiency_number : null,
      description: description.trim(),
      location: null,
      reportedAt: now,
      photoPath,
      reportedBy: memberId,
      category: categories.find((category) => category.id === categoryId)?.name ?? null,
      priority: priorities.find((priority) => priority.id === priorityId)?.name ?? null,
      status: "Open",
      relatedItem: selectedItem ? `${selectedItem.typeLabel} ${selectedItem.label}` : null,
    };

    setRows((current) => [savedRow, ...current]);
    setSuccessNumber(savedRow.deficiencyNumber ?? "New deficiency");
    setSaving(false);
    setView("success");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[#080808] px-4 py-5 text-white sm:px-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 pb-10">
        <Link href="/mobile" className="inline-flex min-h-12 items-center text-sm font-bold text-white/65">Back to Field Actions</Link>

        {view === "list" ? (
          <>
            <header className="rounded-[24px] border border-white/12 bg-[linear-gradient(145deg,rgba(35,35,35,0.98),rgba(10,10,10,0.98))] p-5 shadow-[0_20px_44px_rgba(0,0,0,0.36)]">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#ef2b2d]">Mobile Field Tool</p>
              <h1 className="mt-2 text-3xl font-black uppercase tracking-tight">Deficiencies</h1>
              <p className="mt-2 text-sm leading-6 text-white/62">File field findings and review current department issues.</p>
              <button type="button" onClick={openForm} className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#ef2b2d] px-4 text-base font-black uppercase tracking-wide text-white shadow-[0_12px_28px_rgba(239,43,45,0.28)]">
                <FilePlus2 className="h-5 w-5" />
                File a Deficiency
              </button>
              <label className="mt-4 block text-sm font-black text-white/80">
                Search deficiencies
                <div className="mt-2 flex min-h-14 items-center gap-2 rounded-2xl border border-white/15 bg-[#080808] px-4 focus-within:border-[#ef2b2d]">
                  <Search className="h-4 w-4 text-white/35" />
                  <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search deficiencies..." className="min-h-12 flex-1 bg-transparent text-base text-white outline-none" />
                  {searchQuery ? (
                    <button type="button" onClick={() => setSearchQuery("")} className="flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-white/10 text-white/55" aria-label="Clear deficiency search">
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </label>
            </header>

            {error ? <div className="rounded-2xl border border-red-400/25 bg-red-500/12 p-4 text-sm font-bold text-red-100">{error}</div> : null}

            {hasSearch && !hasSearchResults ? <EmptyState label="No deficiencies found." /> : null}

            {!hasSearch || activeRows.length > 0 ? <section className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white/80">Open / In Progress</h2>
                <span className="text-xs font-bold text-white/45">{activeRows.length}</span>
              </div>
              {activeRows.length === 0 ? <EmptyState label="No open deficiencies." /> : activeRows.map((row) => <DeficiencyCard key={row.id} deficiency={row} onOpen={openDetail} />)}
            </section> : null}

            {resolvedRows.length > 0 ? (
              <section className="space-y-3 pt-2">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white/55">Resolved</h2>
                  <span className="text-xs font-bold text-white/35">{resolvedRows.length}</span>
                </div>
                {resolvedRows.slice(0, 12).map((row) => <DeficiencyCard key={row.id} deficiency={row} onOpen={openDetail} muted />)}
              </section>
            ) : null}
          </>
        ) : null}

        {view === "detail" && selectedDeficiency ? (
          <DetailView deficiency={selectedDeficiency} onBack={() => setView("list")} />
        ) : null}

        {view === "form" ? (
          <section className="rounded-[24px] border border-white/12 bg-[#111111] p-5 shadow-[0_20px_44px_rgba(0,0,0,0.36)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#ef2b2d]">File Report</p>
                <h1 className="mt-2 text-2xl font-black">File a Deficiency</h1>
                <p className="mt-2 text-sm text-white/55">Reporter: {memberName}</p>
              </div>
              <button type="button" onClick={() => setView("list")} className="flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-white/15 text-white/70" aria-label="Close deficiency form">
                <X className="h-5 w-5" />
              </button>
            </div>

            {error ? <div className="mt-5 rounded-2xl border border-red-400/25 bg-red-500/12 p-4 text-sm font-bold text-red-100">{error}</div> : null}

            <div className="mt-5 space-y-5">
              <label className="block text-sm font-black text-white/80">
                What did you find? <span className="text-[#ef2b2d]">Required</span>
                <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} placeholder="Describe the problem or deficiency..." className="mt-2 w-full rounded-2xl border border-white/15 bg-[#080808] p-4 text-base leading-6 text-white outline-none focus:border-[#ef2b2d]" />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-black text-white/80">
                  Category <span className="text-[#ef2b2d]">Required</span>
                  <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="mt-2 min-h-14 w-full rounded-2xl border border-white/15 bg-[#080808] px-4 text-base text-white outline-none focus:border-[#ef2b2d]">
                    <option value="">Select category</option>
                    {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-black text-white/80">
                  Priority <span className="text-[#ef2b2d]">Required</span>
                  <select value={priorityId} onChange={(event) => setPriorityId(event.target.value)} className="mt-2 min-h-14 w-full rounded-2xl border border-white/15 bg-[#080808] px-4 text-base text-white outline-none focus:border-[#ef2b2d]">
                    <option value="">Select priority</option>
                    {priorities.map((priority) => <option key={priority.id} value={priority.id}>{priority.name}</option>)}
                  </select>
                </label>
              </div>

              <section className="rounded-2xl border border-white/12 bg-white/[0.03] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-[0.16em] text-white/75">Related Item</h2>
                    <p className="mt-1 text-sm text-white/45">Optional</p>
                  </div>
                  {selectedItem ? <button type="button" onClick={() => setSelectedItem(null)} className="min-h-10 rounded-xl border border-white/15 px-3 text-xs font-black uppercase text-white/70">Clear</button> : null}
                </div>

                {selectedItem ? (
                  <div className="mt-4 rounded-xl border border-[#ef2b2d]/30 bg-[#ef2b2d]/10 p-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-red-200">Selected</p>
                    <p className="mt-1 font-black">{selectedItem.typeLabel} · {selectedItem.label}</p>
                    {selectedItem.detail ? <p className="mt-1 text-sm text-white/55">{selectedItem.detail}</p> : null}
                  </div>
                ) : null}

                <label className="mt-4 block text-sm font-black text-white/80">
                  Item Type
                  <select value={itemType} onChange={(event) => { setItemType(event.target.value); setItemSearch(""); }} className="mt-2 min-h-14 w-full rounded-2xl border border-white/15 bg-[#080808] px-4 text-base text-white outline-none focus:border-[#ef2b2d]">
                    {relatedItemTypes.map((type) => <option key={type.type} value={type.type}>{type.label}</option>)}
                  </select>
                </label>
                <label className="mt-4 block text-sm font-black text-white/80">
                  Search Items
                  <div className="mt-2 flex min-h-14 items-center gap-2 rounded-2xl border border-white/15 bg-[#080808] px-4 focus-within:border-[#ef2b2d]">
                    <Search className="h-4 w-4 text-white/35" />
                    <input value={itemSearch} onChange={(event) => setItemSearch(event.target.value)} placeholder="Search by number, name, or status" className="min-h-12 flex-1 bg-transparent text-base text-white outline-none" />
                  </div>
                </label>
                <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                  {filteredItems.length === 0 ? <p className="rounded-xl border border-white/10 p-3 text-sm text-white/45">No matching items.</p> : null}
                  {filteredItems.map((item) => (
                    <button key={`${item.type}:${item.id}`} type="button" onClick={() => setSelectedItem(item)} className="min-h-14 w-full rounded-xl border border-white/10 bg-[#0b0b0b] px-3 py-3 text-left active:scale-[0.99]">
                      <span className="block text-sm font-black text-white">{item.label}</span>
                      <span className="mt-1 block text-xs font-bold text-white/45">{item.typeLabel}{item.detail ? ` · ${item.detail}` : ""}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-white/12 bg-white/[0.03] p-4">
                <h2 className="text-sm font-black uppercase tracking-[0.16em] text-white/75">Photo</h2>
                <p className="mt-1 text-sm text-white/45">Optional · one photo</p>
                {photoPreviewUrl ? <img src={photoPreviewUrl} alt="Selected deficiency photo" className="mt-4 max-h-52 w-full rounded-2xl border border-white/12 object-cover" /> : null}
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/15 bg-[#080808] px-4 text-sm font-black uppercase text-white/80">
                    <Camera className="h-5 w-5" />
                    Take Photo
                    <input type="file" accept="image/*" capture="environment" onChange={(event) => selectPhoto(event.target.files?.[0] ?? null)} className="sr-only" />
                  </label>
                  <label className="flex min-h-14 cursor-pointer items-center justify-center rounded-2xl border border-white/15 bg-[#080808] px-4 text-sm font-black uppercase text-white/80">
                    Choose Photo
                    <input type="file" accept="image/*" onChange={(event) => selectPhoto(event.target.files?.[0] ?? null)} className="sr-only" />
                  </label>
                </div>
                {photo ? <button type="button" onClick={() => selectPhoto(null)} className="mt-3 min-h-11 w-full rounded-xl border border-white/15 text-sm font-black uppercase text-white/65">Remove Photo</button> : null}
              </section>

              <button type="button" disabled={saving} onClick={() => void saveDeficiency()} className="min-h-14 w-full rounded-2xl bg-[#ef2b2d] px-4 text-base font-black uppercase tracking-wide text-white disabled:bg-white/15 disabled:text-white/40">
                {saving ? "Saving..." : "Save Deficiency"}
              </button>
            </div>
          </section>
        ) : null}

        {view === "success" ? (
          <section className="rounded-[24px] border border-emerald-300/20 bg-[#111111] p-6 text-center shadow-[0_20px_44px_rgba(0,0,0,0.36)]">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-300" />
            <p className="mt-4 text-xs font-black uppercase tracking-[0.22em] text-emerald-200">Deficiency Reported</p>
            <h1 className="mt-2 text-2xl font-black">{successNumber} has been recorded.</h1>
            <button type="button" onClick={() => setView("list")} className="mt-6 min-h-14 w-full rounded-2xl bg-[#ef2b2d] px-4 text-base font-black uppercase tracking-wide text-white">Done</button>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm font-bold text-white/45">{label}</div>;
}

function DeficiencyCard({ deficiency, onOpen, muted = false }: { deficiency: Deficiency; onOpen: (deficiency: Deficiency) => void; muted?: boolean }) {
  return (
    <button type="button" onClick={() => onOpen(deficiency)} className={`w-full rounded-2xl border border-white/12 bg-[#121212] p-4 text-left shadow-[0_12px_30px_rgba(0,0,0,0.22)] ${muted ? "opacity-75" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-white/45">{deficiency.deficiencyNumber ?? "Deficiency"}</p>
          <h3 className="mt-1 line-clamp-2 text-base font-black leading-5 text-white">{deficiency.description ?? "No description"}</h3>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-black uppercase ${statusClasses(deficiency.status)}`}>{deficiency.status ?? "Unknown"}</span>
      </div>
      <div className="mt-3 grid gap-2 text-sm text-white/58 sm:grid-cols-2">
        <p><span className="text-white/35">Category:</span> {deficiency.category ?? "Uncategorized"}</p>
        <p><span className="text-white/35">Priority:</span> <span className={priorityClasses(deficiency.priority)}>{deficiency.priority ?? "Not set"}</span></p>
        <p><span className="text-white/35">Related:</span> {deficiency.relatedItem ?? "None"}</p>
        <p><span className="text-white/35">Reported:</span> {formatDate(deficiency.reportedAt)}</p>
      </div>
    </button>
  );
}

function DetailView({ deficiency, onBack }: { deficiency: Deficiency; onBack: () => void }) {
  const photoUrl = deficiency.photoPath ? supabase.storage.from("deficiency-photos").getPublicUrl(deficiency.photoPath).data.publicUrl : null;
  return (
    <section className="rounded-[24px] border border-white/12 bg-[#111111] p-5 shadow-[0_20px_44px_rgba(0,0,0,0.36)]">
      <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/12 px-3 text-sm font-bold text-white/75">
        <ChevronLeft className="h-4 w-4" />
        Back to List
      </button>
      <div className="mt-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-white/45">{deficiency.deficiencyNumber ?? "Deficiency"}</p>
          <h1 className="mt-2 text-2xl font-black">{deficiency.description ?? "No description"}</h1>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-black uppercase ${statusClasses(deficiency.status)}`}>{deficiency.status ?? "Unknown"}</span>
      </div>
      <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
        <DetailRow label="Category" value={deficiency.category ?? "Uncategorized"} />
        <DetailRow label="Priority" value={deficiency.priority ?? "Not set"} />
        <DetailRow label="Related Item" value={deficiency.relatedItem ?? "None"} />
        <DetailRow label="Reported" value={formatDate(deficiency.reportedAt)} />
        {deficiency.location ? <DetailRow label="Location" value={deficiency.location} /> : null}
      </dl>
      {photoUrl ? <img src={photoUrl} alt="Deficiency photo" className="mt-5 max-h-80 w-full rounded-2xl border border-white/12 object-cover" /> : null}
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <dt className="text-xs font-black uppercase tracking-[0.14em] text-white/35">{label}</dt>
      <dd className="mt-1 font-bold text-white/80">{value}</dd>
    </div>
  );
}