import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getCurrentMember } from "@/lib/current-member";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Value = string | number | null;
type Plan = Record<string, Value> & { id: string; business_name: string; address: string; city: string; state: string; zip: string };
type Hydrant = { id: string; hydrant_identifier: string | null; location_description: string | null; hydrant_notes: string | null; photo_document_revision_id: string | null };
type Hazard = { id: string; hazard_type: string; location_description: string | null; quantity: string | null; description: string | null; attachment_document_revision_id: string | null; sds_document_revision_id: string | null };
type LinkRow = { id: string; link_type: string; notes: string | null; related_component: string | null; document_revision_id: string };
type Revision = { id: string; document_id: string; file_name: string; file_path: string; mime_type: string | null };
type Document = { id: string; title: string; category: string };

const PLAN_FIELDS = [
  ["Fire Alarm", "fire_alarm_details"], ["Alarm Panel / Annunciator", "fire_alarm_panel_location"],
  ["Sprinkler System", "sprinkler_system_details"], ["Riser Location", "riser_location"],
  ["Fire Pump", "fire_pump_details"], ["Fire Pump Location", "fire_pump_location"],
  ["Standpipe", "standpipe_details"], ["Standpipe Location", "standpipe_location"],
  ["FDC", "fdc_details"], ["FDC Location", "fdc_location"], ["FDC Notes", "fdc_notes"],
  ["Knox Box", "knox_box_details"], ["Knox Box Location", "knox_box_location"],
  ["Electrical Shutoff", "electrical_shutoff"], ["Electrical Location", "electrical_shutoff_location"], ["Electrical Comments", "electrical_comments"],
  ["Water Shutoff", "water_shutoff"], ["Water Location", "water_shutoff_location"], ["Water Comments", "water_comments"],
  ["Gas Shutoff", "gas_shutoff"], ["Gas Location", "gas_shutoff_location"], ["Gas Comments", "gas_comments"],
] as const;

function text(value: Value) {
  return value === null || value === undefined || String(value).trim() === "" ? null : String(value).trim();
}

function InfoSection({ title, children, tone = "default" }: { title: string; children: React.ReactNode; tone?: "default" | "critical" }) {
  return <section className={`rounded-2xl border p-5 ${tone === "critical" ? "border-red-400/50 bg-red-950/25" : "border-white/10 bg-[#17181b]"}`}><h2 className={`text-xs font-black uppercase tracking-[0.2em] ${tone === "critical" ? "text-red-200" : "text-white/60"}`}>{title}</h2><div className="mt-4 space-y-4">{children}</div></section>;
}

function Field({ label, value }: { label: string; value: Value }) {
  const rendered = text(value);
  return rendered ? <div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/45">{label}</p><p className="mt-1 text-base leading-6 text-white">{rendered}</p></div> : null;
}

export default async function MobilePrePlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);
  if (!currentMember?.departmentId) redirect("/login");

  const { data, error } = await supabase.from("pre_plans").select("*").eq("id", id).eq("department_id", currentMember.departmentId).eq("lifecycle_status", "active").maybeSingle();
  if (error || !data) notFound();
  const plan = data as Plan;
  const [{ data: hydrantRows }, { data: hazardRows }, { data: linkRows }] = await Promise.all([
    supabase.from("pre_plan_hydrants").select("id, hydrant_identifier, location_description, hydrant_notes, photo_document_revision_id").eq("department_id", currentMember.departmentId).eq("pre_plan_id", id).order("created_at", { ascending: true }),
    supabase.from("pre_plan_hazards").select("id, hazard_type, location_description, quantity, description, attachment_document_revision_id, sds_document_revision_id").eq("department_id", currentMember.departmentId).eq("pre_plan_id", id).order("created_at", { ascending: true }),
    supabase.from("pre_plan_document_links").select("id, link_type, notes, related_component, document_revision_id").eq("department_id", currentMember.departmentId).eq("pre_plan_id", id).order("created_at", { ascending: true }),
  ]);
  const hydrants = (hydrantRows ?? []) as Hydrant[];
  const hazards = (hazardRows ?? []) as Hazard[];
  const links = (linkRows ?? []) as LinkRow[];
  const revisionIds = Array.from(new Set([
    plan.site_plan_document_revision_id as string | null,
    ...links.map((link) => link.document_revision_id),
    ...hydrants.map((hydrant) => hydrant.photo_document_revision_id),
    ...hazards.flatMap((hazard) => [hazard.attachment_document_revision_id, hazard.sds_document_revision_id]),
  ].filter((value): value is string => Boolean(value))));
  const { data: revisionRows } = revisionIds.length > 0 ? await supabase.from("document_revisions").select("id, document_id, file_name, file_path, mime_type").eq("department_id", currentMember.departmentId).in("id", revisionIds) : { data: [] };
  const revisions = (revisionRows ?? []) as Revision[];
  const documentIds = Array.from(new Set(revisions.map((revision) => revision.document_id)));
  const { data: documentRows } = documentIds.length > 0 ? await supabase.from("documents").select("id, title, category").eq("department_id", currentMember.departmentId).in("id", documentIds) : { data: [] };
  const documents = (documentRows ?? []) as Document[];
  const documentById = new Map(documents.map((document) => [document.id, document]));
  const revisionById = new Map(revisions.map((revision) => [revision.id, revision]));
  const linkedRevisionEntries = [
    ...links.map((link) => ({ revisionId: link.document_revision_id, label: null as string | null, link })),
    ...hydrants.filter((hydrant) => hydrant.photo_document_revision_id).map((hydrant) => ({ revisionId: hydrant.photo_document_revision_id as string, label: `Hydrant ${hydrant.hydrant_identifier ?? "Photo"}`, link: null })),
    ...hazards.flatMap((hazard) => [
      hazard.attachment_document_revision_id ? { revisionId: hazard.attachment_document_revision_id, label: `${hazard.hazard_type} Attachment`, link: null } : null,
      hazard.sds_document_revision_id ? { revisionId: hazard.sds_document_revision_id, label: `${hazard.hazard_type} SDS`, link: null } : null,
    ].filter((entry): entry is { revisionId: string; label: string; link: null } => Boolean(entry))),
    ...(plan.site_plan_document_revision_id ? [{ revisionId: String(plan.site_plan_document_revision_id), label: "Site Plan", link: null }] : []),
  ];
  const linksWithUrls = await Promise.all(linkedRevisionEntries.map(async (entry) => {
    const revision = revisionById.get(entry.revisionId);
    const url = revision?.file_path ? (await supabase.storage.from("department-documents").createSignedUrl(revision.file_path, 3600)).data?.signedUrl ?? null : null;
    return { ...entry, revision, url };
  }));
  const primaryPhoto = linksWithUrls.find((entry) =>
    entry.link?.link_type === "photo" && entry.link.related_component?.trim().toLowerCase() === "building_front" && entry.url,
  );
  const address = `${plan.address}, ${plan.city}, ${plan.state} ${plan.zip}`;

  return <main className="min-h-screen bg-[#0b0c0e] px-4 pb-10 pt-4 text-white sm:px-6 lg:px-10"><div className="mx-auto max-w-5xl"><div className="flex items-center justify-between gap-3"><Link href="/mobile/pre-plans" className="inline-flex min-h-12 items-center text-sm font-bold text-white/65">Back to Pre-Plans</Link><span className="text-xs font-bold uppercase tracking-[0.18em] text-[#ef2b2d]">Pre-Plan</span></div><header className="mt-5 border-b border-white/10 pb-5"><div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(240px,340px)] lg:items-center"><div><h1 className="text-3xl font-black leading-tight sm:text-5xl">{plan.business_name}</h1><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer" className="mt-4 block text-xl font-black leading-7 text-sky-200 underline decoration-sky-300/40 underline-offset-4 sm:text-2xl">{address}</a>{text(plan.occupancy_id_number) ? <p className="mt-3 text-xs font-bold uppercase tracking-[0.16em] text-white/50">Occupancy ID {text(plan.occupancy_id_number)}</p> : null}</div>{primaryPhoto?.url ? <a href={primaryPhoto.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-2xl border border-white/10 bg-[#17181b] shadow-[0_16px_32px_rgba(0,0,0,.28)]"><img src={primaryPhoto.url} alt={`${plan.business_name} building front`} className="block aspect-[4/3] w-full object-cover" /></a> : null}</div></header>

    <div className="mt-5 grid gap-5 lg:grid-cols-2">
      {text(plan.critical_information) ? <InfoSection title="Critical Information" tone="critical"><p className="text-lg font-bold leading-7 text-red-50">{text(plan.critical_information)}</p></InfoSection> : null}
      {text(plan.primary_apparatus_access) ? <InfoSection title="Primary Apparatus Access"><p className="text-lg font-bold leading-7">{text(plan.primary_apparatus_access)}</p></InfoSection> : null}
      <InfoSection title={`Hazards${hazards.length ? ` (${hazards.length})` : ""}`} tone={hazards.length ? "critical" : "default"}>{hazards.length ? hazards.map((hazard) => <div key={hazard.id} className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4"><p className="text-lg font-black text-amber-100">{hazard.hazard_type}</p><Field label="Location" value={hazard.location_description} /><Field label="Quantity" value={hazard.quantity} /><Field label="Description" value={hazard.description} /></div>) : <p className="text-base text-white/55">No hazards recorded.</p>}</InfoSection>
      <InfoSection title="Fire Protection Systems">{PLAN_FIELDS.slice(0, 13).map(([label, key]) => <Field key={key} label={label} value={plan[key]} />)}</InfoSection>
      <InfoSection title="Utilities / Shutoffs">{PLAN_FIELDS.slice(13).map(([label, key]) => <Field key={key} label={label} value={plan[key]} />)}</InfoSection>
      <InfoSection title="Hydrants / Water Supply">{hydrants.length ? hydrants.map((hydrant) => <div key={hydrant.id} className="rounded-xl border border-sky-400/25 bg-sky-500/10 p-4"><p className="text-lg font-black text-sky-100">{text(hydrant.hydrant_identifier) ?? "Hydrant"}</p><Field label="Location" value={hydrant.location_description} /><Field label="Notes" value={hydrant.hydrant_notes} /></div>) : <Field label="Other Water Supply" value={plan.other_water_supply_info} />}</InfoSection>
      <InfoSection title="Occupancy Information"><Field label="Normal Occupant Load" value={plan.normal_occupant_load} /><Field label="Special-Needs Occupants" value={plan.special_needs_occupants} /></InfoSection>
      <InfoSection title="Contacts"><Field label="Business Phone" value={plan.business_phone} />{[["Property Owner",plan.property_owner_name,plan.property_owner_phone],["Primary Contact",plan.primary_contact_name,plan.primary_contact_phone],["Secondary Contact",plan.secondary_contact_name,plan.secondary_contact_phone]].map(([label,name,phone]) => name || phone ? <div key={label as string}><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/45">{label}</p>{name ? <p className="mt-1 text-base">{name}</p> : null}{phone ? <a className="mt-1 inline-flex min-h-11 items-center text-lg font-bold text-sky-200 underline" href={`tel:${phone}`}>{phone}</a> : null}</div> : null)}</InfoSection>
      {text(plan.additional_comments) ? <InfoSection title="Notes / Additional Comments"><p className="text-base leading-7">{text(plan.additional_comments)}</p></InfoSection> : null}
      {linksWithUrls.length ? <InfoSection title="Photos / Documents">{linksWithUrls.map((entry, index) => entry.url ? <a key={`${entry.revision?.id ?? index}`} href={entry.url} target="_blank" rel="noreferrer" className="flex min-h-14 items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 text-base font-bold"><span>{entry.label ?? (entry.link ? documentById.get(entry.revision?.document_id ?? "")?.title ?? entry.revision?.file_name ?? "Document" : entry.revision?.file_name ?? "Document")}</span><span className="text-[#ef2b2d]">Open</span></a> : null)}</InfoSection> : null}
    </div></div></main>;
}
