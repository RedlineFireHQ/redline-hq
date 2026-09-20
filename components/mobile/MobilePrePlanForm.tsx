"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

type UploadPayload = { fileName: string; mimeType: string; base64Data: string };
type HazardDraft = { hazardType: string; locationDescription: string; quantity: string; description: string; photo: File | null };
type HydrantDraft = { hydrantIdentifier: string; locationDescription: string; hydrantNotes: string; photo: File | null };

type TextField = keyof FormState;
type FormState = {
  businessName: string; address: string; city: string; state: string; zip: string; occupancyIdNumber: string;
  primaryApparatusAccess: string; criticalInformation: string;
  fireAlarmDetails: string; fireAlarmPanelLocation: string; sprinklerSystemDetails: string; riserLocation: string;
  firePumpDetails: string; firePumpLocation: string; standpipeDetails: string; standpipeLocation: string;
  fdcDetails: string; fdcLocation: string; fdcNotes: string; knoxBoxDetails: string; knoxBoxLocation: string;
  electricalShutoff: string; electricalShutoffLocation: string; electricalComments: string;
  waterShutoff: string; waterShutoffLocation: string; waterComments: string; gasShutoff: string; gasShutoffLocation: string; gasComments: string; otherWaterSupplyInfo: string;
  normalOccupantLoad: string; specialNeedsOccupants: string;
  businessPhone: string; propertyOwnerName: string; propertyOwnerPhone: string; primaryContactName: string; primaryContactPhone: string; secondaryContactName: string; secondaryContactPhone: string; additionalComments: string;
};

const emptyForm: FormState = Object.fromEntries([
  "businessName","address","city","state","zip","occupancyIdNumber","primaryApparatusAccess","criticalInformation",
  "fireAlarmDetails","fireAlarmPanelLocation","sprinklerSystemDetails","riserLocation","firePumpDetails","firePumpLocation","standpipeDetails","standpipeLocation","fdcDetails","fdcLocation","fdcNotes","knoxBoxDetails","knoxBoxLocation",
  "electricalShutoff","electricalShutoffLocation","electricalComments","waterShutoff","waterShutoffLocation","waterComments","gasShutoff","gasShutoffLocation","gasComments","otherWaterSupplyInfo","normalOccupantLoad","specialNeedsOccupants",
  "businessPhone","propertyOwnerName","propertyOwnerPhone","primaryContactName","primaryContactPhone","secondaryContactName","secondaryContactPhone","additionalComments",
].map((key) => [key, ""])) as FormState;

async function fileToUploadPayload(file: File | null): Promise<UploadPayload | null> {
  if (!file) return null;
  const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); });
  const commaIndex = dataUrl.indexOf(",");
  return { fileName: file.name, mimeType: file.type || "application/octet-stream", base64Data: commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl };
}

function Field({ label, value, onChange, required = false, type = "text", placeholder }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string; placeholder?: string }) {
  return <label className="block text-sm font-bold text-white/80"><span>{label}{required ? " *" : ""}</span><input required={required} type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-[#101010] px-4 text-base text-white outline-none focus:border-red-500/70" /></label>;
}

function Section({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-white/10 bg-[#17181b] p-4 sm:p-5"><button type="button" onClick={onToggle} className="flex min-h-12 w-full items-center justify-between text-left"><span className="text-sm font-black uppercase tracking-[0.14em] text-white">{title}</span><span className="text-xl text-[#ef2b2d]">{open ? "−" : "+"}</span></button>{open ? <div className="mt-4 grid gap-4 md:grid-cols-2">{children}</div> : null}</section>;
}

export default function MobilePrePlanForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [buildingPhoto, setBuildingPhoto] = useState<File | null>(null);
  const [additionalPhotos, setAdditionalPhotos] = useState<File[]>([]);
  const [hazards, setHazards] = useState<HazardDraft[]>([]);
  const [hydrants, setHydrants] = useState<HydrantDraft[]>([]);
  const [openSection, setOpenSection] = useState("building");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (key: TextField) => (value: string) => setForm((current) => ({ ...current, [key]: value }));
  const toggle = (key: string) => setOpenSection((current) => current === key ? "" : key);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(null); setSaving(true);
    try {
      const buildingUpload = await fileToUploadPayload(buildingPhoto);
      const photoUploads = await Promise.all(additionalPhotos.map(fileToUploadPayload));
      const payload = {
        ...form,
        normalOccupantLoad: form.normalOccupantLoad || null,
        sitePlanDocumentRevisionId: null,
        sitePlanUpload: null,
        hydrants: await Promise.all(hydrants.map(async (row) => ({ id: null, hydrantIdentifier: row.hydrantIdentifier || null, locationDescription: row.locationDescription || null, hydrantNotes: row.hydrantNotes || null, photoDocumentRevisionId: null, photoUpload: await fileToUploadPayload(row.photo) }))),
        hazards: await Promise.all(hazards.map(async (row) => ({ id: null, hazardType: row.hazardType || null, locationDescription: row.locationDescription || null, quantity: row.quantity || null, description: row.description || null, attachmentDocumentRevisionId: null, sdsDocumentRevisionId: null, supportingDocumentUpload: await fileToUploadPayload(row.photo) }))),
        photoReferences: [
          ...(buildingUpload ? [{ id: null, documentRevisionId: null, notes: "Building Front Photo", relatedComponent: "building_front", photoUpload: buildingUpload }] : []),
          ...(photoUploads.filter(Boolean).map((upload) => ({ id: null, documentRevisionId: null, notes: "Additional Pre-Plan Photo", relatedComponent: "additional_photo", photoUpload: upload }))),
        ],
        documentReferences: [],
      };
      const response = await fetch("/api/pre-plans", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as { ok?: boolean; prePlanId?: string; error?: string };
      if (!response.ok || !result.ok || !result.prePlanId) throw new Error(result.error || "Unable to save pre-plan.");
      router.push(`/mobile/pre-plans/${result.prePlanId}`);
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : "Unable to save pre-plan."); setSaving(false); }
  }

  return <main className="min-h-screen bg-[#0b0c0e] px-4 pb-10 pt-4 text-white sm:px-6 lg:px-10"><div className="mx-auto max-w-5xl"><div className="flex items-center justify-between gap-3"><Link href="/mobile/pre-plans" className="inline-flex min-h-12 items-center text-sm font-bold text-white/65">Back to Pre-Plans</Link><span className="text-xs font-bold uppercase tracking-[0.18em] text-[#ef2b2d]">Field Create</span></div><header className="mt-5 border-b border-white/10 pb-5"><h1 className="text-3xl font-black sm:text-4xl">Add Pre-Plan</h1><p className="mt-2 text-sm text-white/60">Capture the building intelligence your crew needs.</p></header>{error ? <p className="mt-4 rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-100">{error}</p> : null}<form onSubmit={submit} className="mt-5 space-y-4">
    <Section title="Building" open={openSection === "building"} onToggle={() => toggle("building")}><Field label="Business / Property Name" value={form.businessName} onChange={set("businessName")} required /><Field label="Occupancy ID" value={form.occupancyIdNumber} onChange={set("occupancyIdNumber")} /><Field label="Address" value={form.address} onChange={set("address")} required /><Field label="City" value={form.city} onChange={set("city")} required /><Field label="State" value={form.state} onChange={set("state")} required /><Field label="ZIP" value={form.zip} onChange={set("zip")} required /></Section>
    <Section title="Recognition / Photos" open={openSection === "photos"} onToggle={() => toggle("photos")}><label className="block text-sm font-bold text-white/80 md:col-span-2">Building Front / Primary Photo<input type="file" accept="image/*" capture="environment" onChange={(event) => setBuildingPhoto(event.target.files?.[0] ?? null)} className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-[#101010] p-3 text-sm text-white/75" />{buildingPhoto ? <span className="mt-2 block text-xs text-emerald-200">Selected: {buildingPhoto.name}</span> : null}</label><label className="block text-sm font-bold text-white/80 md:col-span-2">Additional Photos<input type="file" accept="image/*" multiple capture="environment" onChange={(event) => setAdditionalPhotos(Array.from(event.target.files ?? []))} className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-[#101010] p-3 text-sm text-white/75" />{additionalPhotos.length ? <span className="mt-2 block text-xs text-emerald-200">{additionalPhotos.length} photo(s) selected</span> : null}</label></Section>
    <Section title="Access & Critical Information" open={openSection === "access"} onToggle={() => toggle("access")}><label className="block text-sm font-bold text-white/80 md:col-span-2">Primary Apparatus Access<textarea value={form.primaryApparatusAccess} onChange={(event) => setForm((current) => ({ ...current, primaryApparatusAccess: event.target.value }))} rows={4} className="mt-2 w-full rounded-xl border border-white/15 bg-[#101010] p-4 text-base text-white outline-none" /></label><label className="block text-sm font-bold text-white/80 md:col-span-2">Critical Information<textarea value={form.criticalInformation} onChange={(event) => setForm((current) => ({ ...current, criticalInformation: event.target.value }))} rows={4} className="mt-2 w-full rounded-xl border border-white/15 bg-[#101010] p-4 text-base text-white outline-none" /></label></Section>
    <Section title="Fire Protection Systems" open={openSection === "fire"} onToggle={() => toggle("fire")}><Field label="Fire Alarm" value={form.fireAlarmDetails} onChange={set("fireAlarmDetails")} /><Field label="Alarm / Panel Location" value={form.fireAlarmPanelLocation} onChange={set("fireAlarmPanelLocation")} /><Field label="Sprinkler / Riser" value={form.sprinklerSystemDetails} onChange={set("sprinklerSystemDetails")} /><Field label="Riser Location" value={form.riserLocation} onChange={set("riserLocation")} /><Field label="Fire Pump" value={form.firePumpDetails} onChange={set("firePumpDetails")} /><Field label="Fire Pump Location" value={form.firePumpLocation} onChange={set("firePumpLocation")} /><Field label="Standpipe" value={form.standpipeDetails} onChange={set("standpipeDetails")} /><Field label="Standpipe Location" value={form.standpipeLocation} onChange={set("standpipeLocation")} /><Field label="FDC" value={form.fdcDetails} onChange={set("fdcDetails")} /><Field label="FDC Location" value={form.fdcLocation} onChange={set("fdcLocation")} /><Field label="Knox Box" value={form.knoxBoxDetails} onChange={set("knoxBoxDetails")} /><Field label="Knox Box Location" value={form.knoxBoxLocation} onChange={set("knoxBoxLocation")} /></Section>
    <Section title="Utilities / Shutoffs" open={openSection === "utilities"} onToggle={() => toggle("utilities")}><Field label="Electrical" value={form.electricalShutoff} onChange={set("electricalShutoff")} /><Field label="Electrical Location" value={form.electricalShutoffLocation} onChange={set("electricalShutoffLocation")} /><Field label="Water" value={form.waterShutoff} onChange={set("waterShutoff")} /><Field label="Water Location" value={form.waterShutoffLocation} onChange={set("waterShutoffLocation")} /><Field label="Gas" value={form.gasShutoff} onChange={set("gasShutoff")} /><Field label="Gas Location" value={form.gasShutoffLocation} onChange={set("gasShutoffLocation")} /><Field label="Other Water Supply" value={form.otherWaterSupplyInfo} onChange={set("otherWaterSupplyInfo")} /></Section>
    <Section title="Occupancy Information" open={openSection === "occupancy"} onToggle={() => toggle("occupancy")}><Field label="Normal Occupant Load" type="number" value={form.normalOccupantLoad} onChange={set("normalOccupantLoad")} /><label className="block text-sm font-bold text-white/80 md:col-span-2">Special-Needs Occupants<textarea value={form.specialNeedsOccupants} onChange={(event) => setForm((current) => ({ ...current, specialNeedsOccupants: event.target.value }))} rows={3} className="mt-2 w-full rounded-xl border border-white/15 bg-[#101010] p-4 text-base text-white outline-none" /></label></Section>
    <Section title="Hazards" open={openSection === "hazards"} onToggle={() => toggle("hazards")}><div className="md:col-span-2 space-y-3">{hazards.map((hazard, index) => <div key={index} className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4"><Field label="Hazard Type" value={hazard.hazardType} onChange={(value) => setHazards((current) => current.map((row, i) => i === index ? { ...row, hazardType: value } : row))} /><Field label="Location" value={hazard.locationDescription} onChange={(value) => setHazards((current) => current.map((row, i) => i === index ? { ...row, locationDescription: value } : row))} /><Field label="Quantity" value={hazard.quantity} onChange={(value) => setHazards((current) => current.map((row, i) => i === index ? { ...row, quantity: value } : row))} /><label className="mt-3 block text-sm font-bold">Description<textarea value={hazard.description} onChange={(event) => setHazards((current) => current.map((row, i) => i === index ? { ...row, description: event.target.value } : row))} rows={3} className="mt-2 w-full rounded-xl border border-white/15 bg-[#101010] p-3 text-white" /></label><label className="mt-3 block text-sm font-bold">Photo / Attachment<input type="file" accept="image/*,.pdf" capture="environment" onChange={(event) => setHazards((current) => current.map((row, i) => i === index ? { ...row, photo: event.target.files?.[0] ?? null } : row))} className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-[#101010] p-3 text-sm text-white/75" /></label><button type="button" onClick={() => setHazards((current) => current.filter((_, i) => i !== index))} className="min-h-11 rounded-lg border border-white/15 px-3 text-xs font-black uppercase">Remove Hazard</button></div>)}<button type="button" onClick={() => setHazards((current) => [...current, { hazardType: "", locationDescription: "", quantity: "", description: "", photo: null }])} className="min-h-12 rounded-xl border border-amber-400/40 px-4 text-sm font-black uppercase text-amber-100">Add Hazard</button></div></Section>
    <Section title="Hydrants / Water Supply" open={openSection === "hydrants"} onToggle={() => toggle("hydrants")}><div className="md:col-span-2 space-y-3">{hydrants.map((hydrant, index) => <div key={index} className="rounded-xl border border-sky-400/30 bg-sky-500/10 p-4"><Field label="Identifier" value={hydrant.hydrantIdentifier} onChange={(value) => setHydrants((current) => current.map((row, i) => i === index ? { ...row, hydrantIdentifier: value } : row))} /><Field label="Location" value={hydrant.locationDescription} onChange={(value) => setHydrants((current) => current.map((row, i) => i === index ? { ...row, locationDescription: value } : row))} /><Field label="Notes" value={hydrant.hydrantNotes} onChange={(value) => setHydrants((current) => current.map((row, i) => i === index ? { ...row, hydrantNotes: value } : row))} /><label className="mt-3 block text-sm font-bold">Hydrant Photo<input type="file" accept="image/*" capture="environment" onChange={(event) => setHydrants((current) => current.map((row, i) => i === index ? { ...row, photo: event.target.files?.[0] ?? null } : row))} className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-[#101010] p-3 text-sm text-white/75" /></label><button type="button" onClick={() => setHydrants((current) => current.filter((_, i) => i !== index))} className="mt-3 min-h-11 rounded-lg border border-white/15 px-3 text-xs font-black uppercase">Remove Hydrant</button></div>)}<button type="button" onClick={() => setHydrants((current) => [...current, { hydrantIdentifier: "", locationDescription: "", hydrantNotes: "", photo: null }])} className="min-h-12 rounded-xl border border-sky-400/40 px-4 text-sm font-black uppercase text-sky-100">Add Hydrant</button></div></Section>
    <Section title="Contacts / Notes" open={openSection === "contacts"} onToggle={() => toggle("contacts")}><Field label="Business Phone" type="tel" value={form.businessPhone} onChange={set("businessPhone")} /><Field label="Property Owner" value={form.propertyOwnerName} onChange={set("propertyOwnerName")} /><Field label="Property Owner Phone" type="tel" value={form.propertyOwnerPhone} onChange={set("propertyOwnerPhone")} /><Field label="Primary Contact" value={form.primaryContactName} onChange={set("primaryContactName")} /><Field label="Primary Contact Phone" type="tel" value={form.primaryContactPhone} onChange={set("primaryContactPhone")} /><label className="block text-sm font-bold text-white/80 md:col-span-2">Additional Comments<textarea value={form.additionalComments} onChange={(event) => setForm((current) => ({ ...current, additionalComments: event.target.value }))} rows={4} className="mt-2 w-full rounded-xl border border-white/15 bg-[#101010] p-4 text-base text-white outline-none" /></label></Section>
    <button type="submit" disabled={saving} className="sticky bottom-3 min-h-16 w-full rounded-2xl bg-[#ef2b2d] px-5 text-base font-black uppercase tracking-wide text-white shadow-2xl disabled:opacity-50">{saving ? "Saving Pre-Plan..." : "Save Pre-Plan"}</button>
  </form></div></main>;
}
