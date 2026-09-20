import Link from "next/link";
import { notFound } from "next/navigation";
import ArchiveApparatusControls from "@/app/apparatus/[id]/information/ArchiveApparatusControls";
import ApparatusQrLabelButton from "@/components/apparatus/ApparatusQrLabelButton";
import QuickFactsCard from "@/components/apparatus/QuickFactsCard";
import ServiceSpecificationsCard from "@/components/apparatus/ServiceSpecificationsCard";
import ApparatusSimpleConfigurationCard from "@/components/apparatus/ApparatusSimpleConfigurationCard";
import PageLayout from "@/components/layout/PageLayout";
import { getCurrentMember } from "@/lib/current-member";
import { canManageApparatus as hasApparatusManagementPermission } from "@/lib/member-permissions";
import { getApparatusImagePath } from "@/lib/apparatus-images";
import { getApparatusById } from "@/lib/database";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { SimpleApparatusConfigurationDraft } from "@/lib/apparatus-configuration-simple";

type ServiceSpecifications = {
  oil_type: string | null;
  oil_capacity: string | null;
  oil_filter_part_number: string | null;
  fuel_filter_part_number: string | null;
  air_filter_part_number: string | null;
  hydraulic_fluid: string | null;
  transmission_fluid: string | null;
  coolant_type: string | null;
  pump_oil: string | null;
  generator_oil: string | null;
  belt_numbers: string | null;
  battery_type: string | null;
  tire_size: string | null;
  other_common_parts: string | null;
};

interface ApparatusInformationPageProps {
  params: Promise<{
    id: string;
  }>;
}

type ArchivedApparatusRow = {
  id: string;
  name: string | null;
  type: string | null;
  department_id: string | null;
  lifecycle_status: "active" | "archived" | null;
};

async function getArchivedApparatusForDepartment(
  departmentId: string | null,
  supabaseClient: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): Promise<ArchivedApparatusRow[]> {
  if (!departmentId) {
    return [];
  }

  const { data, error } = await supabaseClient
    .from("apparatus")
    .select("id, name, type, department_id, lifecycle_status")
    .eq("department_id", departmentId)
    .eq("lifecycle_status", "archived")
    .order("name");

  if (error) {
    console.error("[apparatus-information] archived apparatus query failed", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      departmentId,
    });
    return [];
  }

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: typeof row.id === "string" ? row.id : String(row.id ?? ""),
    name: typeof row.name === "string" ? row.name : null,
    type: typeof row.type === "string" ? row.type : null,
    department_id: typeof row.department_id === "string" ? row.department_id : null,
    lifecycle_status:
      row.lifecycle_status === "active" || row.lifecycle_status === "archived"
        ? row.lifecycle_status
        : null,
  }));
}

export default async function ApparatusInformationPage({
  params,
}: ApparatusInformationPageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const truck = await getApparatusById(id, supabase);

  if (!truck) {
    notFound();
  }
  const apparatusImageUrl = getApparatusImagePath(truck.name);

  const statusValue =
    truck.status === "out_of_service"
      ? "Out of Service"
      : truck.status === "needs_attention"
        ? "Needs Attention"
        : truck.inService === false
          ? "Out of Service"
          : "In Service";

  const departmentValue =
    truck.department_name ??
    truck.department?.name ??
    truck.department_id ??
    "Not Set";

  const lastInspectionValue = truck.last_inspection_at
    ? new Date(truck.last_inspection_at).toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      })
    : "Not Set";

  const currentMember = await getCurrentMember(supabase);
  const canManageThisApparatus = currentMember?.departmentId
    ? await hasApparatusManagementPermission(supabase, currentMember.departmentId, currentMember.role)
    : false;
  const canEditServiceSpecifications = canManageThisApparatus;
  const canManageApparatusForThisTruck = canManageThisApparatus;
  const isArchived = truck.lifecycle_status === "archived";
  const archivedApparatus = currentMember?.departmentId
    ? await getArchivedApparatusForDepartment(currentMember.departmentId, supabase)
    : [];

  const [checkRequirementResult, maintenanceRequirementRowsResult, maintenanceMethodRowsResult, departmentDefaultResult] = currentMember?.departmentId
    ? await Promise.all([
        supabase
          .from("apparatus_check_requirements")
          .select("id, score_profile, interval_days")
          .eq("apparatus_id", truck.id)
          .maybeSingle(),
        supabase
          .from("apparatus_maintenance_requirements")
          .select("id, name")
          .eq("apparatus_id", truck.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("apparatus_maintenance_requirement_methods")
          .select("id, apparatus_maintenance_requirement_id, method_type, interval_value")
          .eq("department_id", currentMember.departmentId)
          .order("created_at", { ascending: true }),
        supabase
          .from("apparatus_check_department_defaults")
          .select("interval_days")
          .eq("department_id", currentMember.departmentId)
          .eq("is_active", true)
          .order("effective_start_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])
    : [
        { data: null, error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: null, error: null },
      ];

  const maintenanceByRequirementId = new Map<string, Array<Record<string, unknown>>>();
  for (const methodRow of (maintenanceMethodRowsResult.data ?? []) as Array<Record<string, unknown>>) {
    const parentId = typeof methodRow.apparatus_maintenance_requirement_id === "string" ? methodRow.apparatus_maintenance_requirement_id : "";
    if (!parentId) {
      continue;
    }

    const bucket = maintenanceByRequirementId.get(parentId) ?? [];
    bucket.push(methodRow);
    maintenanceByRequirementId.set(parentId, bucket);
  }

  const currentCheckIntervalDays = typeof checkRequirementResult.data?.interval_days === "number"
    ? checkRequirementResult.data.interval_days
    : null;

  const currentCheckFrequency =
    currentCheckIntervalDays === 1
      ? "Daily"
      : currentCheckIntervalDays === 2
        ? "Every 2 Days"
        : currentCheckIntervalDays === 3
          ? "Every 3 Days"
          : currentCheckIntervalDays === 7
            ? "Weekly"
            : currentCheckIntervalDays === 14
              ? "Every 2 Weeks"
              : currentCheckIntervalDays === 30
                ? "Monthly"
                : currentCheckIntervalDays === 90
                  ? "Quarterly"
                  : currentCheckIntervalDays !== null
                    ? "Custom"
                    : "";

  const initialConfiguration: SimpleApparatusConfigurationDraft = {
    checkFrequency: currentCheckFrequency,
    customCheckFrequency:
      currentCheckFrequency === "Custom" && currentCheckIntervalDays !== null
        ? `Every ${currentCheckIntervalDays} days`
        : "",
    checklistRequiredOverride:
      typeof truck.checklist_required_override === "boolean" ? truck.checklist_required_override : null,
    maintenanceRequirements: ((maintenanceRequirementRowsResult.data ?? []) as Array<Record<string, unknown>>).map((row) => {
      const methods = maintenanceByRequirementId.get(typeof row.id === "string" ? row.id : "") ?? [];
      const firstMethod = methods[0] ?? null;
      const intervalValue = typeof firstMethod?.interval_value === "number" ? firstMethod.interval_value : null;
      const methodType = typeof firstMethod?.method_type === "string" ? firstMethod.method_type : "time_days";

      const intervalUnit =
        methodType === "mileage"
          ? "Miles"
          : methodType === "engine_hours"
            ? "Engine Hours"
            : "Months";

      return {
        id: typeof row.id === "string" ? row.id : undefined,
        itemName: typeof row.name === "string" ? row.name : "Oil Change",
        customItemName: "",
        intervalAmount:
          intervalValue !== null && intervalUnit === "Months"
            ? String(Math.round(intervalValue / 30))
            : intervalValue !== null
              ? String(intervalValue)
              : "",
        intervalUnit,
      };
    }),
  };

  const departmentCheckDefaultIntervalDays = typeof departmentDefaultResult.data?.interval_days === "number" ? departmentDefaultResult.data.interval_days : null;

  const quickFactsValues = {
    type: typeof truck.type === "string" ? truck.type : null,
    check_frequency: typeof truck.check_frequency === "string" ? truck.check_frequency : null,
    year: typeof truck.year === "number" ? truck.year : null,
    make: typeof truck.make === "string" ? truck.make : null,
    model: typeof truck.model === "string" ? truck.model : null,
    vin: typeof truck.vin === "string" ? truck.vin : null,
    pump_capacity: typeof truck.pump_capacity === "number" ? truck.pump_capacity : null,
    water_tank_capacity: typeof truck.water_tank_capacity === "number" ? truck.water_tank_capacity : null,
    mileage: typeof truck.mileage === "number" ? truck.mileage : null,
    engine_hours: typeof truck.engine_hours === "number" ? truck.engine_hours : null,
  };

  const serviceSpecifications: ServiceSpecifications = {
    oil_type: typeof truck.oil_type === "string" ? truck.oil_type : null,
    oil_capacity: typeof truck.oil_capacity === "string" ? truck.oil_capacity : null,
    oil_filter_part_number:
      typeof truck.oil_filter_part_number === "string" ? truck.oil_filter_part_number : null,
    fuel_filter_part_number:
      typeof truck.fuel_filter_part_number === "string" ? truck.fuel_filter_part_number : null,
    air_filter_part_number:
      typeof truck.air_filter_part_number === "string" ? truck.air_filter_part_number : null,
    hydraulic_fluid:
      typeof truck.hydraulic_fluid === "string" ? truck.hydraulic_fluid : null,
    transmission_fluid:
      typeof truck.transmission_fluid === "string" ? truck.transmission_fluid : null,
    coolant_type: typeof truck.coolant_type === "string" ? truck.coolant_type : null,
    pump_oil: typeof truck.pump_oil === "string" ? truck.pump_oil : null,
    generator_oil:
      typeof truck.generator_oil === "string" ? truck.generator_oil : null,
    belt_numbers: typeof truck.belt_numbers === "string" ? truck.belt_numbers : null,
    battery_type: typeof truck.battery_type === "string" ? truck.battery_type : null,
    tire_size: typeof truck.tire_size === "string" ? truck.tire_size : null,
    other_common_parts:
      typeof truck.other_common_parts === "string" ? truck.other_common_parts : null,
  };

  return (
    <PageLayout
      environmentBackgroundUrl="/branding/images/apparatuspageimage.png"
      environmentBackgroundPosition="left center"
    >
      <div className="space-y-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-red-500">
              Apparatus Information
            </p>
            <h1
              className="mt-2 text-[2.25rem] font-[700] leading-none tracking-[-0.06em] text-white"
              style={{ fontFamily: '"Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif' }}
            >
              {truck.name}
            </h1>
            <p className="mt-3 text-lg capitalize text-neutral-400">
              {truck.type}
            </p>
          </div>

          <Link
            href={`/apparatus/${truck.id}`}
            className="inline-flex items-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.08]"
          >
            Back to Apparatus
          </Link>
        </div>

        <div className="relative h-56 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#1a1a1a] via-[#151515] to-[#101010]">
          {apparatusImageUrl ? (
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${apparatusImageUrl})` }}
            />
          ) : null}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_25%,rgba(180,0,0,.14),transparent_60%)]" />
          <div className="absolute left-4 top-4 rounded-full border border-white/15 bg-black/35 px-3 py-1 text-[11px] font-semibold uppercase tracking-[.12em] text-neutral-300">
            Apparatus Photo
          </div>
        </div>

        {canManageApparatusForThisTruck ? (
          <div className="space-y-4">
            <ArchiveApparatusControls
              apparatusId={truck.id}
              apparatusName={truck.name}
              canManage={canManageApparatusForThisTruck}
              isArchived={isArchived}
            />

            {isArchived ? (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-300">Archived Apparatus</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span className="text-sm text-amber-100">This apparatus is archived and removed from active department operations.</span>
                </div>

                {archivedApparatus.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Archived in this department</p>
                    <div className="flex flex-wrap gap-2">
                      {archivedApparatus.map((item) => (
                        <Link
                          key={item.id}
                          href={`/apparatus/${item.id}/information`}
                          className="rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-xs font-medium text-neutral-200 transition hover:border-white/20 hover:bg-[#222]"
                        >
                          {item.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            {!isArchived ? <ApparatusQrLabelButton apparatusId={truck.id} apparatusName={truck.name} /> : null}
          </div>
        ) : null}

        <QuickFactsCard
          apparatusId={truck.id}
          statusLabel={statusValue}
          departmentLabel={departmentValue}
          lastInspectionLabel={lastInspectionValue}
          initialValues={quickFactsValues}
        />

        <ServiceSpecificationsCard
          apparatusId={truck.id}
          initialSpecifications={serviceSpecifications}
          initialIncludeInDepartmentReadiness={
            typeof truck.include_in_department_readiness === "boolean"
              ? truck.include_in_department_readiness
              : true
          }
          canEdit={canEditServiceSpecifications}
        />

        <ApparatusSimpleConfigurationCard
          apparatusId={truck.id}
          canEdit={canManageThisApparatus}
          departmentCheckDefaultIntervalDays={departmentCheckDefaultIntervalDays}
          initialConfiguration={initialConfiguration}
        />
      </div>
    </PageLayout>
  );
}
