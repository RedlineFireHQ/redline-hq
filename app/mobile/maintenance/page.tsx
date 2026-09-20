import { redirect } from "next/navigation";

import MobileMaintenance from "@/components/mobile/MobileMaintenance";
import { getCurrentMember } from "@/lib/current-member";
import { MAINTENANCE_TYPE_OPTIONS } from "@/lib/maintenance";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type MaintenanceRow = {
  id: string;
  maintenance_number: string | null;
  apparatus_id: string;
  maintenance_type: string;
  completed_by: string | null;
  service_date: string;
  description: string;
  parts_used: string | null;
  notes: string | null;
  photos: string[] | null;
  attachments: string[] | null;
  apparatus: { name: string | null } | { name: string | null }[] | null;
  completed_by_member: { first_name: string | null; last_name: string | null } | { first_name: string | null; last_name: string | null }[] | null;
};

type ApparatusRow = {
  id: string;
  name: string;
  status: string | null;
  type: string | null;
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

function firstRelation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function memberName(row: MaintenanceRow) {
  const member = firstRelation(row.completed_by_member);
  const fullName = `${member?.first_name ?? ""} ${member?.last_name ?? ""}`.trim();
  return fullName || "Not recorded";
}

export default async function MobileMaintenancePage() {
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);
  if (!currentMember?.departmentId) redirect("/login");

  const departmentId = currentMember.departmentId;
  const { data: hasPermission } = await supabase.rpc("member_has_app_permission", {
    p_department_id: departmentId,
    p_permission_key: "maintenance_field_entry",
  });

  if (!hasPermission) redirect("/mobile");

  const [recordsResult, apparatusResult] = await Promise.all([
    supabase
      .from("maintenance_records")
      .select("id, maintenance_number, apparatus_id, maintenance_type, completed_by, service_date, description, parts_used, notes, photos, attachments, apparatus:apparatus_id(name), completed_by_member:completed_by(first_name, last_name)")
      .eq("department_id", departmentId)
      .order("service_date", { ascending: false })
      .limit(50),
    supabase
      .from("apparatus")
      .select("id, name, status, type, oil_type, oil_capacity, oil_filter_part_number, fuel_filter_part_number, air_filter_part_number, hydraulic_fluid, transmission_fluid, coolant_type, pump_oil, generator_oil, belt_numbers, battery_type, tire_size, other_common_parts")
      .eq("department_id", departmentId)
      .eq("lifecycle_status", "active")
      .order("name"),
  ]);

  const records = ((recordsResult.data ?? []) as MaintenanceRow[]).map((row) => ({
    id: row.id,
    maintenanceNumber: row.maintenance_number,
    apparatusId: row.apparatus_id,
    apparatusName: firstRelation(row.apparatus)?.name ?? "Unknown Apparatus",
    maintenanceType: row.maintenance_type,
    completedBy: memberName(row),
    serviceDate: row.service_date,
    description: row.description,
    partsUsed: row.parts_used,
    notes: row.notes,
    photos: row.photos ?? [],
    attachments: row.attachments ?? [],
  }));

  return (
    <MobileMaintenance
      departmentId={departmentId}
      memberId={currentMember.id}
      memberName={currentMember.name}
      records={records}
      apparatus={(apparatusResult.data ?? []) as ApparatusRow[]}
      maintenanceTypes={[...MAINTENANCE_TYPE_OPTIONS]}
      initialError={recordsResult.error?.message ?? apparatusResult.error?.message ?? null}
    />
  );
}