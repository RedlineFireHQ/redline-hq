import { redirect } from "next/navigation";

import MobileDeficiencies from "@/components/mobile/MobileDeficiencies";
import { getCurrentMember } from "@/lib/current-member";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Option = { id: string; name: string };

type DeficiencyRelation = { name?: string | null; active?: boolean | null } | Array<{ name?: string | null; active?: boolean | null }> | null;
type ItemRelation = Record<string, unknown> | Record<string, unknown>[] | null;

type DeficiencyRow = {
  id: string;
  deficiency_number: string | null;
  description: string | null;
  location: string | null;
  reported_at: string | null;
  created_at: string | null;
  photo_path: string | null;
  reported_by: string | null;
  reported_by_member: DeficiencyRelation;
  apparatus_id: string | null;
  fire_hose_id: string | null;
  scba_cylinder_id: string | null;
  scba_pack_id: string | null;
  portable_radio_id: string | null;
  portable_radio_mic_id: string | null;
  thermal_imaging_camera_id: string | null;
  gas_monitor_id: string | null;
  battery_id: string | null;
  pie_equipment_id: string | null;
  ground_ladder_id: string | null;
  ems_equipment_id: string | null;
  ppe_item_id: string | null;
  rope_item_id: string | null;
  fire_extinguisher_id: string | null;
  misc_fire_equipment_id: string | null;
  category: DeficiencyRelation;
  priority_info: DeficiencyRelation;
  status_info: DeficiencyRelation;
  apparatus: ItemRelation;
  fire_hose: ItemRelation;
  scba_cylinder: ItemRelation;
  scba_pack: ItemRelation;
  portable_radio: ItemRelation;
  portable_radio_mic: ItemRelation;
  thermal_imaging_camera: ItemRelation;
  gas_monitor: ItemRelation;
  battery: ItemRelation;
  pie_equipment: ItemRelation;
  ground_ladder: ItemRelation;
  ems_equipment: ItemRelation;
  ppe_item: ItemRelation;
  rope_item: ItemRelation;
  fire_extinguisher: ItemRelation;
  misc_fire_equipment: ItemRelation;
};

type RelatedItem = {
  type: string;
  typeLabel: string;
  id: string;
  label: string;
  detail: string | null;
  status: string | null;
};

function relationRecord(relation: ItemRelation) {
  if (Array.isArray(relation)) return relation[0] ?? null;
  return relation;
}

function relationName(relation: DeficiencyRelation) {
  const row = Array.isArray(relation) ? relation[0] : relation;
  return typeof row?.name === "string" ? row.name : null;
}

function text(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function relatedLabel(row: DeficiencyRow) {
  if (row.apparatus_id) return text(relationRecord(row.apparatus), "name") ?? "Apparatus";
  if (row.fire_hose_id) return `Fire Hose ${text(relationRecord(row.fire_hose), "inventory_number") ?? "Unknown"}`;
  if (row.scba_cylinder_id) return `SCBA Cylinder ${text(relationRecord(row.scba_cylinder), "cylinder_number") ?? "Unknown"}`;
  if (row.scba_pack_id) return `SCBA Pack ${text(relationRecord(row.scba_pack), "pack_number") ?? "Unknown"}`;
  if (row.portable_radio_id) return `Portable Radio ${text(relationRecord(row.portable_radio), "radio_number") ?? "Unknown"}`;
  if (row.portable_radio_mic_id) return `Radio Mic ${text(relationRecord(row.portable_radio_mic), "mic_number") ?? "Unknown"}`;
  if (row.thermal_imaging_camera_id) return `Thermal Camera ${text(relationRecord(row.thermal_imaging_camera), "camera_number") ?? "Unknown"}`;
  if (row.gas_monitor_id) return `Gas Monitor ${text(relationRecord(row.gas_monitor), "monitor_number") ?? "Unknown"}`;
  if (row.battery_id) return `Battery ${text(relationRecord(row.battery), "battery_number") ?? "Unknown"}`;
  if (row.pie_equipment_id) return `PIE ${text(relationRecord(row.pie_equipment), "equipment_number") ?? "Unknown"}`;
  if (row.ground_ladder_id) return `Ground Ladder ${text(relationRecord(row.ground_ladder), "ladder_number") ?? "Unknown"}`;
  if (row.ems_equipment_id) return text(relationRecord(row.ems_equipment), "equipment_name") ?? "EMS Equipment";
  if (row.ppe_item_id) return text(relationRecord(row.ppe_item), "item_name") ?? "PPE";
  if (row.rope_item_id) return text(relationRecord(row.rope_item), "rope_identifier") ?? text(relationRecord(row.rope_item), "rope_name") ?? "Rope";
  if (row.fire_extinguisher_id) return `Fire Extinguisher ${text(relationRecord(row.fire_extinguisher), "extinguisher_number") ?? "Unknown"}`;
  if (row.misc_fire_equipment_id) return text(relationRecord(row.misc_fire_equipment), "equipment_name") ?? text(relationRecord(row.misc_fire_equipment), "asset_number") ?? "Misc Fire Equipment";
  return null;
}

function reportedByName(row: DeficiencyRow) {
  const relation = Array.isArray(row.reported_by_member) ? row.reported_by_member[0] : row.reported_by_member;
  const record = relation as { first_name?: unknown; last_name?: unknown } | null;
  const firstName = typeof record?.first_name === "string" ? record.first_name.trim() : "";
  const lastName = typeof record?.last_name === "string" ? record.last_name.trim() : "";
  return `${firstName} ${lastName}`.trim() || null;
}

function mapDeficiency(row: DeficiencyRow) {
  return {
    id: row.id,
    deficiencyNumber: row.deficiency_number,
    description: row.description,
    location: row.location,
    reportedAt: row.reported_at ?? row.created_at,
    photoPath: row.photo_path,
    reportedBy: row.reported_by,
    reportedByName: reportedByName(row),
    category: relationName(row.category),
    priority: relationName(row.priority_info),
    status: relationName(row.status_info),
    relatedItem: relatedLabel(row),
  };
}

function makeItem(type: string, typeLabel: string, row: Record<string, unknown>, labelKeys: string[], detailKeys: string[] = []): RelatedItem {
  const label = labelKeys.map((key) => text(row, key)).find(Boolean) ?? "Unnamed Item";
  const detail = detailKeys.map((key) => text(row, key)).filter(Boolean).join(" · ") || null;
  return {
    type,
    typeLabel,
    id: typeof row.id === "string" ? row.id : String(row.id ?? ""),
    label,
    detail,
    status: text(row, "status"),
  };
}

function mapItems(type: string, typeLabel: string, rows: unknown[] | null | undefined, labelKeys: string[], detailKeys: string[] = []) {
  return (rows ?? [])
    .map((row) => makeItem(type, typeLabel, row as Record<string, unknown>, labelKeys, detailKeys))
    .filter((item) => item.id);
}

export default async function MobileDeficienciesPage() {
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);
  if (!currentMember?.departmentId) redirect("/login");

  const departmentId = currentMember.departmentId;
  const [
    deficienciesResult,
    categoriesResult,
    prioritiesResult,
    statusesResult,
    apparatusResult,
    hoseResult,
    cylinderResult,
    packResult,
    radioResult,
    radioMicResult,
    cameraResult,
    monitorResult,
    batteryResult,
    pieResult,
    ladderResult,
    emsResult,
    ppeResult,
    ropeResult,
    extinguisherResult,
    miscResult,
  ] = await Promise.all([
    supabase
      .from("deficiencies")
      .select("id, deficiency_number, description, location, reported_at, created_at, photo_path, reported_by, apparatus_id, fire_hose_id, scba_cylinder_id, scba_pack_id, portable_radio_id, portable_radio_mic_id, thermal_imaging_camera_id, gas_monitor_id, battery_id, pie_equipment_id, ground_ladder_id, ems_equipment_id, ppe_item_id, rope_item_id, fire_extinguisher_id, misc_fire_equipment_id, category:deficiency_categories!fk_deficiencies_category(name), priority_info:deficiency_priorities!fk_deficiencies_priority(name), status_info:deficiency_statuses!fk_deficiencies_status(name), reported_by_member:reported_by(first_name, last_name), apparatus:apparatus_id(name), fire_hose:fire_hose_id(inventory_number), scba_cylinder:scba_cylinder_id(cylinder_number), scba_pack:scba_pack_id(pack_number), portable_radio:portable_radio_id(radio_number), portable_radio_mic:portable_radio_mic_id(mic_number), thermal_imaging_camera:thermal_imaging_camera_id(camera_number), gas_monitor:gas_monitor_id(monitor_number), battery:battery_id(battery_number), pie_equipment:pie_equipment_id(equipment_number, equipment_category, equipment_type), ground_ladder:ground_ladder_id(ladder_number), ems_equipment:ems_equipment_id(equipment_name), ppe_item:ppe_item_id(item_name), rope_item:rope_item_id(rope_name, rope_identifier), fire_extinguisher:fire_extinguisher_id(extinguisher_number), misc_fire_equipment:misc_fire_equipment_id(equipment_name, asset_number)")
      .eq("department_id", departmentId)
      .order("reported_at", { ascending: false }),
    supabase.from("deficiency_categories").select("id, name").eq("active", true).order("display_order"),
    supabase.from("deficiency_priorities").select("id, name").eq("active", true).order("display_order"),
    supabase.from("deficiency_statuses").select("id, name").order("display_order"),
    supabase.from("apparatus").select("id, name, status, type").eq("department_id", departmentId).eq("lifecycle_status", "active").order("name"),
    supabase.from("fire_hose").select("id, inventory_number, status, hose_size, hose_length").eq("department_id", departmentId).order("inventory_number"),
    supabase.from("scba_cylinders").select("id, cylinder_number, cylinder_type, status").eq("department_id", departmentId).order("cylinder_number"),
    supabase.from("scba_packs").select("id, pack_number, manufacturer, model, status").eq("department_id", departmentId).order("pack_number"),
    supabase.from("portable_radios").select("id, radio_number, manufacturer, model, status").eq("department_id", departmentId).order("radio_number"),
    supabase.from("portable_radio_mics").select("id, mic_number, manufacturer, model, status").eq("department_id", departmentId).order("mic_number"),
    supabase.from("thermal_imaging_cameras").select("id, camera_number, manufacturer, model, status").eq("department_id", departmentId).order("camera_number"),
    supabase.from("gas_monitors").select("id, monitor_number, manufacturer, model, status").eq("department_id", departmentId).order("monitor_number"),
    supabase.from("batteries").select("id, battery_number, manufacturer, model, status").eq("department_id", departmentId).order("battery_number"),
    supabase.from("pie_equipment").select("id, equipment_number, equipment_category, equipment_type, status").eq("department_id", departmentId).order("equipment_number"),
    supabase.from("ground_ladders").select("id, ladder_number, ladder_type, status").eq("department_id", departmentId).order("ladder_number"),
    supabase.from("ems_equipment").select("id, equipment_name, equipment_number, status").eq("department_id", departmentId).order("equipment_name"),
    supabase.from("ppe_items").select("id, item_name, asset_number, status").eq("department_id", departmentId).order("item_name"),
    supabase.from("rope_items").select("id, rope_name, rope_identifier, rope_type, status").eq("department_id", departmentId).order("rope_identifier"),
    supabase.from("fire_extinguishers").select("id, extinguisher_number, extinguisher_type, status").eq("department_id", departmentId).order("extinguisher_number"),
    supabase.from("misc_fire_equipment").select("id, equipment_name, asset_number, status").eq("department_id", departmentId).order("equipment_name"),
  ]);

  const initialError = [
    deficienciesResult.error,
    categoriesResult.error,
    prioritiesResult.error,
    statusesResult.error,
    apparatusResult.error,
    hoseResult.error,
    cylinderResult.error,
    packResult.error,
    radioResult.error,
    radioMicResult.error,
    cameraResult.error,
    monitorResult.error,
    batteryResult.error,
    pieResult.error,
    ladderResult.error,
    emsResult.error,
    ppeResult.error,
    ropeResult.error,
    extinguisherResult.error,
    miscResult.error,
  ].find(Boolean)?.message ?? null;
  const statuses = (statusesResult.data ?? []) as Option[];
  const openStatus = statuses.find((status) => status.name.trim().toLowerCase() === "open");

  const relatedItems = [
    ...mapItems("apparatus_id", "Apparatus", apparatusResult.data, ["name"], ["type", "status"]),
    ...mapItems("fire_hose_id", "Fire Hose", hoseResult.data, ["inventory_number"], ["hose_size", "hose_length", "status"]),
    ...mapItems("scba_cylinder_id", "SCBA Cylinder", cylinderResult.data, ["cylinder_number"], ["cylinder_type", "status"]),
    ...mapItems("scba_pack_id", "SCBA Pack", packResult.data, ["pack_number"], ["manufacturer", "model", "status"]),
    ...mapItems("portable_radio_id", "Portable Radio", radioResult.data, ["radio_number"], ["manufacturer", "model", "status"]),
    ...mapItems("portable_radio_mic_id", "Portable Radio Microphone", radioMicResult.data, ["mic_number"], ["manufacturer", "model", "status"]),
    ...mapItems("thermal_imaging_camera_id", "Thermal Imaging Camera", cameraResult.data, ["camera_number"], ["manufacturer", "model", "status"]),
    ...mapItems("gas_monitor_id", "Gas Monitor", monitorResult.data, ["monitor_number"], ["manufacturer", "model", "status"]),
    ...mapItems("battery_id", "Battery", batteryResult.data, ["battery_number"], ["manufacturer", "model", "status"]),
    ...mapItems("pie_equipment_id", "PIE Equipment", pieResult.data, ["equipment_number"], ["equipment_category", "equipment_type", "status"]),
    ...mapItems("ground_ladder_id", "Ground Ladder", ladderResult.data, ["ladder_number"], ["ladder_type", "status"]),
    ...mapItems("ems_equipment_id", "EMS Equipment", emsResult.data, ["equipment_name", "equipment_number"], ["equipment_number", "status"]),
    ...mapItems("ppe_item_id", "PPE", ppeResult.data, ["item_name", "asset_number"], ["asset_number", "status"]),
    ...mapItems("rope_item_id", "Rope", ropeResult.data, ["rope_identifier", "rope_name"], ["rope_name", "rope_type", "status"]),
    ...mapItems("fire_extinguisher_id", "Fire Extinguisher", extinguisherResult.data, ["extinguisher_number"], ["extinguisher_type", "status"]),
    ...mapItems("misc_fire_equipment_id", "Miscellaneous Fire Equipment", miscResult.data, ["equipment_name", "asset_number"], ["asset_number", "status"]),
  ];

  return (
    <MobileDeficiencies
      departmentId={departmentId}
      memberId={currentMember.id}
      memberName={currentMember.name}
      deficiencies={((deficienciesResult.data ?? []) as DeficiencyRow[]).map(mapDeficiency)}
      categories={(categoriesResult.data ?? []) as Option[]}
      priorities={(prioritiesResult.data ?? []) as Option[]}
      openStatusId={openStatus?.id ?? ""}
      relatedItems={relatedItems}
      initialError={initialError}
    />
  );
}