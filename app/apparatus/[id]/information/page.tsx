import Link from "next/link";
import { notFound } from "next/navigation";
import ServiceSpecificationsCard from "@/components/apparatus/ServiceSpecificationsCard";
import PageLayout from "@/components/layout/PageLayout";
import { getCurrentMember } from "@/lib/current-member";
import { getApparatusImagePath } from "@/lib/apparatus-images";
import { getApparatusById } from "@/lib/database";
import { createSupabaseServerClient } from "@/lib/supabase-server";

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

export default async function ApparatusInformationPage({
  params,
}: ApparatusInformationPageProps) {
  const { id } = await params;

  const truck = await getApparatusById(id);

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

  const checkFrequencyValue =
    truck.check_frequency ?? truck.checkFrequency ?? "Not Set";

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

  const quickFacts = [
    { label: "Status", value: statusValue },
    { label: "Type", value: truck.type ?? "Not Set" },
    { label: "Check Frequency", value: checkFrequencyValue },
    { label: "Department", value: departmentValue },
    { label: "Last Inspection", value: lastInspectionValue },
    { label: "Year", value: truck.year ?? "Not Set" },
    { label: "Make", value: truck.make ?? "Not Set" },
    { label: "Model", value: truck.model ?? "Not Set" },
    { label: "VIN", value: truck.vin ?? "Not Set" },
    {
      label: "Pump Capacity (GPM)",
      value: truck.pump_capacity ?? truck.pumpCapacity ?? "Not Set",
    },
    {
      label: "Water Tank Capacity (Gallons)",
      value:
        truck.water_tank_capacity ??
        truck.waterTankCapacity ??
        "Not Set",
    },
    { label: "Mileage", value: truck.mileage ?? "Not Set" },
    {
      label: "Engine Hours",
      value: truck.engine_hours ?? truck.engineHours ?? "Not Set",
    },
  ];

  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);
  const canEditServiceSpecifications =
    currentMember?.role === "administrator";

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
    <PageLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-red-500">
              Apparatus Information
            </p>
            <h1 className="mt-2 text-5xl font-black tracking-tight text-white">
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

        {/* Quick Facts */}
        <div className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6">
          <h2 className="text-lg font-bold text-white">Quick Facts</h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {quickFacts.map((fact) => (
              <div
                key={fact.label}
                className="rounded-xl border border-white/10 bg-[#242424] p-4"
              >
                <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">
                  {fact.label}
                </p>

                <p className="mt-2 text-lg font-semibold text-white">{fact.value}</p>
              </div>
            ))}
          </div>
        </div>

        <ServiceSpecificationsCard
          apparatusId={truck.id}
          initialSpecifications={serviceSpecifications}
          canEdit={canEditServiceSpecifications}
        />
      </div>
    </PageLayout>
  );
}
