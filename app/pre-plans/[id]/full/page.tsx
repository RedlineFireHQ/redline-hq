import Link from "next/link";
import { notFound } from "next/navigation";
import PageLayout from "@/components/layout/PageLayout";
import ArchivePrePlanControls from "@/components/pre-plans/ArchivePrePlanControls";
import { getCurrentMember } from "@/lib/current-member";
import { canManagePrePlans } from "@/lib/member-permissions";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type PrePlanRecord = {
  id: string;
  business_name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  business_phone: string | null;
  occupancy_id_number: string | null;
  property_owner_name: string | null;
  property_owner_phone: string | null;
  primary_contact_name: string | null;
  primary_contact_phone: string | null;
  secondary_contact_name: string | null;
  secondary_contact_phone: string | null;
  additional_comments: string | null;
  normal_occupant_load: number | null;
  special_needs_occupants: string | null;
  primary_apparatus_access: string | null;
  fire_alarm_details: string | null;
  fire_alarm_panel_location: string | null;
  sprinkler_system_details: string | null;
  riser_location: string | null;
  fire_pump_details: string | null;
  fire_pump_location: string | null;
  standpipe_details: string | null;
  standpipe_location: string | null;
  fdc_details: string | null;
  fdc_location: string | null;
  fdc_notes: string | null;
  knox_box_details: string | null;
  knox_box_location: string | null;
  electrical_shutoff: string | null;
  electrical_shutoff_location: string | null;
  electrical_comments: string | null;
  water_shutoff: string | null;
  water_shutoff_location: string | null;
  water_comments: string | null;
  gas_shutoff: string | null;
  gas_shutoff_location: string | null;
  gas_comments: string | null;
  other_water_supply_info: string | null;
  critical_information: string | null;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
};

type HydrantRow = {
  id: string;
  hydrant_identifier: string | null;
  location_description: string | null;
  hydrant_notes: string | null;
};

type HazardRow = {
  id: string;
  hazard_type: string;
  location_description: string | null;
  quantity: string | null;
  description: string | null;
};

interface FullPrePlanPageProps {
  params: Promise<{ id: string }>;
}

function asText(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function Field({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#1b1b1b] px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">{label}</p>
      <p className="mt-1 text-sm text-white">{value ?? "-"}</p>
    </div>
  );
}

export default async function FullPrePlanPage({ params }: FullPrePlanPageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);
  const departmentId = currentMember?.departmentId ?? null;

  if (!departmentId) {
    notFound();
  }

  const { data, error } = await supabase
    .from("pre_plans")
    .select(
      "id, business_name, address, city, state, zip, business_phone, occupancy_id_number, property_owner_name, property_owner_phone, primary_contact_name, primary_contact_phone, secondary_contact_name, secondary_contact_phone, additional_comments, normal_occupant_load, special_needs_occupants, primary_apparatus_access, fire_alarm_details, fire_alarm_panel_location, sprinkler_system_details, riser_location, fire_pump_details, fire_pump_location, standpipe_details, standpipe_location, fdc_details, fdc_location, fdc_notes, knox_box_details, knox_box_location, electrical_shutoff, electrical_shutoff_location, electrical_comments, water_shutoff, water_shutoff_location, water_comments, gas_shutoff, gas_shutoff_location, gas_comments, other_water_supply_info, critical_information, last_verified_at, created_at, updated_at",
    )
    .eq("id", id)
    .eq("department_id", departmentId)
    .maybeSingle();

  if (error || !data) {
    notFound();
  }

  const record = data as PrePlanRecord;
  const canManagePrePlansForDepartment = await canManagePrePlans(
    supabase,
    departmentId,
    currentMember?.role,
  );

  const [hydrantsResult, hazardsResult] = await Promise.all([
    supabase
      .from("pre_plan_hydrants")
      .select("id, hydrant_identifier, location_description, hydrant_notes")
      .eq("department_id", departmentId)
      .eq("pre_plan_id", record.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("pre_plan_hazards")
      .select("id, hazard_type, location_description, quantity, description")
      .eq("department_id", departmentId)
      .eq("pre_plan_id", record.id)
      .order("created_at", { ascending: true }),
  ]);

  const hydrants = (hydrantsResult.data ?? []) as HydrantRow[];
  const hazards = (hazardsResult.data ?? []) as HazardRow[];

  return (
    <PageLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-500">Pre-Plan</p>
            <h1 className="mt-1 text-4xl font-black tracking-tight text-white">{record.business_name}</h1>
            <p className="mt-2 text-sm text-neutral-400">Full Pre-Plan Details</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/pre-plans/${record.id}`}
              className="inline-flex rounded-lg border border-white/15 bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
            >
              Back to Quick View
            </Link>
            {canManagePrePlansForDepartment ? (
              <Link
                href={`/pre-plans/${record.id}/edit`}
                className="inline-flex rounded-lg border border-red-500/40 bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                Edit Pre-Plan
              </Link>
            ) : null}
            <ArchivePrePlanControls
              prePlanId={record.id}
              prePlanName={record.business_name}
              canManage={canManagePrePlansForDepartment}
            />
          </div>
        </div>

        <section className="rounded-2xl border border-white/10 bg-[#111111] p-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Business Name" value={record.business_name} />
            <Field label="Address" value={record.address} />
            <Field label="City" value={record.city} />
            <Field label="State" value={record.state} />
            <Field label="ZIP" value={record.zip} />
            <Field label="Business Phone" value={record.business_phone} />
            <Field label="Occupancy ID Number" value={record.occupancy_id_number} />
            <Field label="Property Owner Name" value={record.property_owner_name} />
            <Field label="Property Owner Phone" value={record.property_owner_phone} />
            <Field label="Primary Contact Name" value={record.primary_contact_name} />
            <Field label="Primary Contact Phone" value={record.primary_contact_phone} />
            <Field label="Secondary Contact Name" value={record.secondary_contact_name} />
            <Field label="Secondary Contact Phone" value={record.secondary_contact_phone} />
            <Field label="Normal Occupant Load" value={record.normal_occupant_load} />
            <Field label="Special-Needs Occupants" value={record.special_needs_occupants} />
            <Field label="Primary Apparatus Access" value={record.primary_apparatus_access} />
            <Field label="Fire Alarm" value={record.fire_alarm_details} />
            <Field label="Alarm Panel / Annunciator" value={record.fire_alarm_panel_location} />
            <Field label="Sprinkler System" value={record.sprinkler_system_details} />
            <Field label="Riser Location" value={record.riser_location} />
            <Field label="Fire Pump" value={record.fire_pump_details} />
            <Field label="Fire Pump Location" value={record.fire_pump_location} />
            <Field label="Standpipe" value={record.standpipe_details} />
            <Field label="Standpipe Location" value={record.standpipe_location} />
            <Field label="FDC" value={record.fdc_details} />
            <Field label="FDC Location" value={record.fdc_location} />
            <Field label="FDC Notes" value={record.fdc_notes} />
            <Field label="Knox Box" value={record.knox_box_details} />
            <Field label="Knox Box Location" value={record.knox_box_location} />
            <Field label="Electrical Shutoff" value={record.electrical_shutoff} />
            <Field label="Electrical Location" value={record.electrical_shutoff_location} />
            <Field label="Electrical Comments" value={record.electrical_comments} />
            <Field label="Water Shutoff" value={record.water_shutoff} />
            <Field label="Water Location" value={record.water_shutoff_location} />
            <Field label="Water Comments" value={record.water_comments} />
            <Field label="Gas Shutoff" value={record.gas_shutoff} />
            <Field label="Gas Location" value={record.gas_shutoff_location} />
            <Field label="Gas Comments" value={record.gas_comments} />
            <Field label="Other Water Supply Information" value={record.other_water_supply_info} />
            <Field label="Critical Information" value={record.critical_information} />
            <Field label="Last Verified" value={formatDateTime(record.last_verified_at)} />
            <Field label="Created" value={formatDateTime(record.created_at)} />
            <Field label="Updated" value={formatDateTime(record.updated_at)} />
            <Field label="Additional Comments" value={record.additional_comments} />
          </div>
        </section>

        {hydrants.length > 0 ? (
          <section className="rounded-2xl border border-white/10 bg-[#111111] p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-300">Hydrants</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {hydrants.map((hydrant, index) => (
                <div key={hydrant.id} className="rounded-xl border border-white/10 bg-[#171717] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Hydrant {index + 1}</p>
                  <div className="mt-2 space-y-1 text-sm text-white">
                    {asText(hydrant.hydrant_identifier) ? <p>Identifier: {asText(hydrant.hydrant_identifier)}</p> : null}
                    {asText(hydrant.location_description) ? <p>Location: {asText(hydrant.location_description)}</p> : null}
                    {asText(hydrant.hydrant_notes) ? <p>Notes: {asText(hydrant.hydrant_notes)}</p> : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {hazards.length > 0 ? (
          <section className="rounded-2xl border border-white/10 bg-[#111111] p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-300">Hazards</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {hazards.map((hazard, index) => (
                <div key={hazard.id} className="rounded-xl border border-white/10 bg-[#171717] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Hazard {index + 1}</p>
                  <div className="mt-2 space-y-1 text-sm text-white">
                    <p>Type: {hazard.hazard_type}</p>
                    {asText(hazard.location_description) ? <p>Location: {asText(hazard.location_description)}</p> : null}
                    {asText(hazard.quantity) ? <p>Quantity: {asText(hazard.quantity)}</p> : null}
                    {asText(hazard.description) ? <p>Description: {asText(hazard.description)}</p> : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </PageLayout>
  );
}
