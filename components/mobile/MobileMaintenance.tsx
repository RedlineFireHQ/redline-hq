"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Camera, CheckCircle2, FileText, Paperclip, Search, Wrench, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMobileWorkflow } from "@/components/mobile/MobileShell";

type MaintenanceRecord = {
  id: string;
  maintenanceNumber: string | null;
  apparatusId: string;
  apparatusName: string;
  maintenanceType: string;
  completedBy: string;
  serviceDate: string;
  description: string;
  partsUsed: string | null;
  notes: string | null;
  photos: string[];
  attachments: string[];
};

type Apparatus = { id: string; name: string; status: string | null; type: string | null };

type ServiceSpecKey =
  | "oil_type"
  | "oil_capacity"
  | "oil_filter_part_number"
  | "fuel_filter_part_number"
  | "air_filter_part_number"
  | "hydraulic_fluid"
  | "transmission_fluid"
  | "coolant_type"
  | "pump_oil"
  | "generator_oil"
  | "belt_numbers"
  | "battery_type"
  | "tire_size"
  | "other_common_parts";

type ApparatusServiceSpecs = Apparatus & Record<ServiceSpecKey, string | null>;

type Props = {
  departmentId: string;
  memberId: string;
  memberName: string;
  records: MaintenanceRecord[];
  apparatus: ApparatusServiceSpecs[];
  maintenanceTypes: string[];
  initialError: string | null;
};

type View = "list" | "form" | "success";

const serviceSpecFields: Array<{ key: ServiceSpecKey; label: string }> = [
  { key: "oil_type", label: "Oil Type" },
  { key: "oil_capacity", label: "Oil Capacity" },
  { key: "oil_filter_part_number", label: "Oil Filter Part Number" },
  { key: "fuel_filter_part_number", label: "Fuel Filter Part Number" },
  { key: "air_filter_part_number", label: "Air Filter Part Number" },
  { key: "hydraulic_fluid", label: "Hydraulic Fluid" },
  { key: "transmission_fluid", label: "Transmission Fluid" },
  { key: "coolant_type", label: "Coolant Type" },
  { key: "pump_oil", label: "Pump Oil" },
  { key: "generator_oil", label: "Generator Oil" },
  { key: "belt_numbers", label: "Belt Part Numbers" },
  { key: "battery_type", label: "Battery Type" },
  { key: "tire_size", label: "Tire Size" },
  { key: "other_common_parts", label: "Other Common Replacement Parts" },
];

function dateTimeLocalNow() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  const hours = `${now.getHours()}`.padStart(2, "0");
  const minutes = `${now.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatDate(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function fileNames(files: File[]) {
  if (files.length === 0) return "No files selected";
  return files.map((file) => file.name).join(", ");
}

export default function MobileMaintenance({
  departmentId,
  memberId,
  memberName,
  records,
  apparatus,
  maintenanceTypes,
  initialError,
}: Props) {
  const router = useRouter();
  const [view, setView] = useState<View>("list");
  const setWorkflowFocused = useMobileWorkflow();

  useEffect(() => {
    setWorkflowFocused?.(view === "form");
    return () => setWorkflowFocused?.(false);
  }, [setWorkflowFocused, view]);
  const [rows, setRows] = useState(records);
  const [searchQuery, setSearchQuery] = useState("");
  const [apparatusId, setApparatusId] = useState("");
  const [maintenanceType, setMaintenanceType] = useState(maintenanceTypes[0] ?? "Repair");
  const [serviceDate, setServiceDate] = useState(dateTimeLocalNow());
  const [description, setDescription] = useState("");
  const [partsUsed, setPartsUsed] = useState("");
  const [laborHours, setLaborHours] = useState("");
  const [mileage, setMileage] = useState("");
  const [engineHours, setEngineHours] = useState("");
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(initialError);
  const [saving, setSaving] = useState(false);
  const [successRecord, setSuccessRecord] = useState<{ id: string; number: string | null } | null>(null);
  const [isSpecsOpen, setIsSpecsOpen] = useState(false);
  const [selectedSpecsApparatusId, setSelectedSpecsApparatusId] = useState("");

  const selectedSpecsApparatus = apparatus.find((item) => item.id === selectedSpecsApparatusId) ?? null;

  const filteredRows = rows.filter((row) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return [
      row.maintenanceNumber,
      row.apparatusName,
      row.maintenanceType,
      row.description,
      row.partsUsed,
      row.notes,
    ].some((value) => normalize(value).includes(query));
  });

  function resetForm() {
    setApparatusId("");
    setMaintenanceType(maintenanceTypes[0] ?? "Repair");
    setServiceDate(dateTimeLocalNow());
    setDescription("");
    setPartsUsed("");
    setLaborHours("");
    setMileage("");
    setEngineHours("");
    setCost("");
    setNotes("");
    setPhotoFiles([]);
    setAttachmentFiles([]);
    setError(null);
  }

  function openForm() {
    resetForm();
    setView("form");
  }

  async function saveMaintenance() {
    if (!apparatusId) {
      setError("Select an apparatus.");
      return;
    }
    if (!maintenanceType.trim()) {
      setError("Select a maintenance type.");
      return;
    }
    if (!serviceDate) {
      setError("Select a service date.");
      return;
    }
    if (!description.trim()) {
      setError("Describe the work performed.");
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      apparatus_id: apparatusId,
      deficiency_id: null,
      maintenance_type: maintenanceType.trim(),
      completed_by: memberId,
      service_date: new Date(serviceDate).toISOString(),
      description: description.trim(),
      parts_used: partsUsed.trim() || null,
      labor_hours: laborHours ? Number(laborHours) : null,
      mileage: mileage ? Number(mileage) : null,
      engine_hours: engineHours ? Number(engineHours) : null,
      cost: cost ? Number(cost) : null,
      notes: notes.trim() || null,
    };

    const formData = new FormData();
    formData.set("payload", JSON.stringify(payload));
    for (const file of photoFiles) formData.append("photos", file);
    for (const file of attachmentFiles) formData.append("attachments", file);

    try {
      const response = await fetch("/api/maintenance/records", { method: "POST", body: formData });
      const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; record?: { id?: string; maintenance_number?: string | null } } | null;
      if (!response.ok || !result?.ok || !result.record?.id) {
        throw new Error(result?.error || "Unable to save maintenance. Please try again.");
      }

      const apparatusName = apparatus.find((item) => item.id === apparatusId)?.name ?? "Unknown Apparatus";
      const nextRecord: MaintenanceRecord = {
        id: result.record.id,
        maintenanceNumber: result.record.maintenance_number ?? null,
        apparatusId,
        apparatusName,
        maintenanceType,
        completedBy: memberName,
        serviceDate: payload.service_date,
        description: payload.description,
        partsUsed: payload.parts_used,
        notes: payload.notes,
        photos: photoFiles.map((file) => file.name),
        attachments: attachmentFiles.map((file) => file.name),
      };

      setRows((current) => [nextRecord, ...current]);
      setSuccessRecord({ id: result.record.id, number: result.record.maintenance_number ?? null });
      setSaving(false);
      setView("success");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save maintenance. Please try again.");
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#080808] px-4 py-5 text-white sm:px-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 pb-10">
        <Link href="/mobile" className="inline-flex min-h-12 items-center text-sm font-bold text-white/65">Back to Field Actions</Link>

        {view === "list" ? (
          <>
            <header className="rounded-[24px] border border-white/12 bg-[linear-gradient(145deg,rgba(35,35,35,0.98),rgba(10,10,10,0.98))] p-5 shadow-[0_20px_44px_rgba(0,0,0,0.36)]">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#ef2b2d]">Field Actions</p>
              <h1 className="mt-2 text-3xl font-black uppercase tracking-tight">Maintenance</h1>
              <p className="mt-2 text-sm leading-6 text-white/62">Review recent work and record completed field maintenance.</p>
              <button type="button" onClick={openForm} className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#ef2b2d] px-4 text-base font-black uppercase tracking-wide text-white shadow-[0_12px_28px_rgba(239,43,45,0.28)]">
                <Wrench className="h-5 w-5" />
                Perform Maintenance
              </button>
              <button type="button" onClick={() => setIsSpecsOpen(true)} className="mt-3 flex min-h-14 w-full items-center justify-center rounded-2xl border border-white/15 bg-[#080808] px-4 text-base font-black uppercase tracking-wide text-white/85">
                View Apparatus Service Specs
              </button>
              <label className="mt-4 block text-sm font-black text-white/80">
                Search Maintenance
                <div className="mt-2 flex min-h-14 items-center gap-2 rounded-2xl border border-white/15 bg-[#080808] px-4 focus-within:border-[#ef2b2d]">
                  <Search className="h-4 w-4 text-white/35" />
                  <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search maintenance..." className="min-h-12 flex-1 bg-transparent text-base text-white outline-none" />
                  {searchQuery ? <button type="button" onClick={() => setSearchQuery("")} className="flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-white/10 text-white/55" aria-label="Clear maintenance search"><X className="h-4 w-4" /></button> : null}
                </div>
              </label>
            </header>

            {error ? <div className="rounded-2xl border border-red-400/25 bg-red-500/12 p-4 text-sm font-bold text-red-100">{error}</div> : null}

            <section className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white/80">Maintenance History</h2>
                <span className="text-xs font-bold text-white/45">{filteredRows.length}</span>
              </div>
              {filteredRows.length === 0 ? <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm font-bold text-white/45">No maintenance records found.</div> : null}
              {filteredRows.map((record) => <MaintenanceCard key={record.id} record={record} />)}
            </section>
          </>
        ) : null}

        {isSpecsOpen ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-3 sm:items-center">
            <section className="flex max-h-[calc(100vh-24px)] w-full max-w-3xl flex-col overflow-hidden rounded-[24px] border border-white/12 bg-[#111111] shadow-[0_24px_60px_rgba(0,0,0,0.55)]">
              <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 p-5">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[#ef2b2d]">Service Specifications Reference</p>
                  <h2 className="mt-2 text-2xl font-black">Apparatus Service Specs</h2>
                  <p className="mt-2 text-sm text-white/55">Reference-only maintenance specifications for this apparatus.</p>
                </div>
                <button type="button" onClick={() => setIsSpecsOpen(false)} className="flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-white/15 text-white/70" aria-label="Close service specs"><X className="h-5 w-5" /></button>
              </div>

              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
                <label className="block text-sm font-black text-white/80">
                  Select Apparatus
                  <select value={selectedSpecsApparatusId} onChange={(event) => setSelectedSpecsApparatusId(event.target.value)} className="mt-2 min-h-14 w-full rounded-2xl border border-white/15 bg-[#080808] px-4 text-base text-white outline-none focus:border-[#ef2b2d]">
                    <option value="">Select apparatus</option>
                    {apparatus.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>

                {selectedSpecsApparatus ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-red-200">{selectedSpecsApparatus.type ?? "Apparatus"}</p>
                      <h3 className="mt-1 text-2xl font-black">{selectedSpecsApparatus.name}</h3>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {serviceSpecFields.map((field) => {
                        const value = selectedSpecsApparatus[field.key]?.trim();
                        if (!value) return null;
                        return (
                          <div key={field.key} className="rounded-2xl border border-white/10 bg-[#080808] p-4">
                            <p className="text-xs font-black uppercase tracking-[0.14em] text-white/35">{field.label}</p>
                            <p className="mt-2 text-lg font-black text-white">{value}</p>
                          </div>
                        );
                      })}
                    </div>
                    {serviceSpecFields.every((field) => !selectedSpecsApparatus[field.key]?.trim()) ? (
                      <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm font-bold text-white/45">No service specifications are recorded for this apparatus.</p>
                    ) : null}
                  </div>
                ) : (
                  <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm font-bold text-white/45">Select an apparatus to view service specifications.</p>
                )}
              </div>
            </section>
          </div>
        ) : null}

        {view === "form" ? (
          <section className="rounded-[24px] border border-white/12 bg-[#111111] p-5 shadow-[0_20px_44px_rgba(0,0,0,0.36)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#ef2b2d]">Perform Maintenance</p>
                <h1 className="mt-2 text-2xl font-black">Maintenance Record</h1>
                <p className="mt-2 text-sm text-white/55">Completed by {memberName}</p>
              </div>
              <button type="button" onClick={() => setView("list")} className="flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-white/15 text-white/70" aria-label="Close maintenance form"><X className="h-5 w-5" /></button>
            </div>

            {error ? <div className="mt-5 rounded-2xl border border-red-400/25 bg-red-500/12 p-4 text-sm font-bold text-red-100">{error}</div> : null}

            <div className="mt-5 space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-black text-white/80">
                  Apparatus <span className="text-[#ef2b2d]">Required</span>
                  <select value={apparatusId} onChange={(event) => setApparatusId(event.target.value)} className="mt-2 min-h-14 w-full rounded-2xl border border-white/15 bg-[#080808] px-4 text-base text-white outline-none focus:border-[#ef2b2d]">
                    <option value="">Select apparatus</option>
                    {apparatus.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-black text-white/80">
                  Maintenance Type <span className="text-[#ef2b2d]">Required</span>
                  <select value={maintenanceType} onChange={(event) => setMaintenanceType(event.target.value)} className="mt-2 min-h-14 w-full rounded-2xl border border-white/15 bg-[#080808] px-4 text-base text-white outline-none focus:border-[#ef2b2d]">
                    {maintenanceTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </label>
              </div>

              <label className="block text-sm font-black text-white/80">
                Service Date <span className="text-[#ef2b2d]">Required</span>
                <input type="datetime-local" value={serviceDate} onChange={(event) => setServiceDate(event.target.value)} className="mt-2 min-h-14 w-full rounded-2xl border border-white/15 bg-[#080808] px-4 text-base text-white outline-none focus:border-[#ef2b2d]" />
              </label>

              <label className="block text-sm font-black text-white/80">
                Work Performed <span className="text-[#ef2b2d]">Required</span>
                <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} placeholder="Describe the maintenance performed..." className="mt-2 w-full rounded-2xl border border-white/15 bg-[#080808] p-4 text-base leading-6 text-white outline-none focus:border-[#ef2b2d]" />
              </label>

              <label className="block text-sm font-black text-white/80">
                Parts Used
                <textarea value={partsUsed} onChange={(event) => setPartsUsed(event.target.value)} rows={3} className="mt-2 w-full rounded-2xl border border-white/15 bg-[#080808] p-4 text-base leading-6 text-white outline-none focus:border-[#ef2b2d]" />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <NumberField label="Labor Hours" value={laborHours} onChange={setLaborHours} step="0.25" />
                <NumberField label="Mileage" value={mileage} onChange={setMileage} />
                <NumberField label="Engine Hours" value={engineHours} onChange={setEngineHours} step="0.1" />
                <NumberField label="Cost" value={cost} onChange={setCost} step="0.01" />
              </div>

              <label className="block text-sm font-black text-white/80">
                Notes
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className="mt-2 w-full rounded-2xl border border-white/15 bg-[#080808] p-4 text-base leading-6 text-white outline-none focus:border-[#ef2b2d]" />
              </label>

              <section className="rounded-2xl border border-white/12 bg-white/[0.03] p-4">
                <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.16em] text-white/75"><Camera className="h-4 w-4" /> Photos</h2>
                <label className="mt-3 flex min-h-14 cursor-pointer items-center justify-center rounded-2xl border border-white/15 bg-[#080808] px-4 text-sm font-black uppercase text-white/80">
                  Add Photos
                  <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif" onChange={(event) => setPhotoFiles(Array.from(event.target.files ?? []))} className="sr-only" />
                </label>
                <p className="mt-2 text-xs text-white/45">{fileNames(photoFiles)}</p>
              </section>

              <section className="rounded-2xl border border-white/12 bg-white/[0.03] p-4">
                <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.16em] text-white/75"><Paperclip className="h-4 w-4" /> Attachments</h2>
                <label className="mt-3 flex min-h-14 cursor-pointer items-center justify-center rounded-2xl border border-white/15 bg-[#080808] px-4 text-sm font-black uppercase text-white/80">
                  Add Attachments
                  <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.doc,.docx,.xls,.xlsx,.txt" onChange={(event) => setAttachmentFiles(Array.from(event.target.files ?? []))} className="sr-only" />
                </label>
                <p className="mt-2 text-xs text-white/45">{fileNames(attachmentFiles)}</p>
              </section>

              <button type="button" disabled={saving} onClick={() => void saveMaintenance()} className="min-h-14 w-full rounded-2xl bg-[#ef2b2d] px-4 text-base font-black uppercase tracking-wide text-white disabled:bg-white/15 disabled:text-white/40">
                {saving ? "Saving..." : "Save Maintenance"}
              </button>
            </div>
          </section>
        ) : null}

        {view === "success" ? (
          <section className="rounded-[24px] border border-emerald-300/20 bg-[#111111] p-6 text-center shadow-[0_20px_44px_rgba(0,0,0,0.36)]">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-300" />
            <p className="mt-4 text-xs font-black uppercase tracking-[0.22em] text-emerald-200">Maintenance Recorded</p>
            <h1 className="mt-2 text-2xl font-black">Maintenance {successRecord?.number ?? "record"}</h1>
            <button type="button" onClick={() => setView("list")} className="mt-6 min-h-14 w-full rounded-2xl bg-[#ef2b2d] px-4 text-base font-black uppercase tracking-wide text-white">Done</button>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function NumberField({ label, value, onChange, step }: { label: string; value: string; onChange: (value: string) => void; step?: string }) {
  return (
    <label className="block text-sm font-black text-white/80">
      {label}
      <input type="number" step={step} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 min-h-14 w-full rounded-2xl border border-white/15 bg-[#080808] px-4 text-base text-white outline-none focus:border-[#ef2b2d]" />
    </label>
  );
}

function MaintenanceCard({ record }: { record: MaintenanceRecord }) {
  return (
    <Link href={`/maintenance/${record.id}`} className="block rounded-2xl border border-white/12 bg-[#121212] p-4 shadow-[0_12px_30px_rgba(0,0,0,0.22)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-white/45">{record.maintenanceNumber ?? "Maintenance"}</p>
          <h3 className="mt-1 line-clamp-2 text-base font-black leading-5 text-white">{record.description}</h3>
        </div>
        <span className="shrink-0 rounded-full border border-red-400/25 bg-red-500/12 px-2.5 py-1 text-[11px] font-black uppercase text-red-100">{record.maintenanceType}</span>
      </div>
      <div className="mt-3 grid gap-2 text-sm text-white/58 sm:grid-cols-2">
        <p><span className="text-white/35">Apparatus:</span> {record.apparatusName}</p>
        <p><span className="text-white/35">Service:</span> {formatDate(record.serviceDate)}</p>
        <p><span className="text-white/35">Completed by:</span> {record.completedBy}</p>
        <p className="flex items-center gap-1"><FileText className="h-3.5 w-3.5 text-white/35" /> {record.photos.length} photo(s), {record.attachments.length} attachment(s)</p>
      </div>
    </Link>
  );
}