import type { SupabaseClient } from "@supabase/supabase-js";

export type MobileInventoryItem = {
  id: string;
  category: string;
  categoryKey: string;
  name: string;
  status: string;
  location: string;
  quantity: string;
  identifier: string;
  serialNumber: string;
  manufacturer: string;
  model: string;
  notes: string;
  deficiencyCount: number;
  detailHref: string;
  relatedHref?: string;
};

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "-";
}

function number(value: unknown) {
  return typeof value === "number" || typeof value === "string" ? String(value) : "-";
}

function item(params: Partial<MobileInventoryItem> & Pick<MobileInventoryItem, "id" | "category" | "categoryKey" | "name" | "detailHref">): MobileInventoryItem {
  return {
    status: "-", location: "-", quantity: "-", identifier: "-", serialNumber: "-", manufacturer: "-", model: "-", notes: "-", deficiencyCount: 0,
    ...params,
  };
}

export async function loadMobileInventory(supabase: SupabaseClient, departmentId: string): Promise<MobileInventoryItem[]> {
  const [deficiencies, fireHose, cylinders, packs, radios, mics, extinguishers, cameras, gasMonitors, ropes, misc, emsEquipment, batteries, ladders, pie, ppe] = await Promise.all([
    supabase.from("deficiencies").select("fire_hose_id, scba_cylinder_id, scba_pack_id, portable_radio_id, portable_radio_mic_id, thermal_imaging_camera_id, gas_monitor_id, battery_id, ground_ladder_id, pie_equipment_id, ems_equipment_id, ppe_item_id, rope_item_id, fire_extinguisher_id, misc_fire_equipment_id, status_info:deficiency_statuses!fk_deficiencies_status(active)").eq("department_id", departmentId),
    supabase.from("fire_hose").select("id, inventory_number, hose_size, hose_length, apparatus, status, next_test_date, notes").eq("department_id", departmentId),
    supabase.from("scba_cylinders").select("id, cylinder_number, cylinder_type, serial_number, manufacturer, model, status, notes, next_hydrostatic_test_due_date").eq("department_id", departmentId),
    supabase.from("scba_packs").select("id, pack_number, serial_number, manufacturer, model, status, notes, next_flow_test_due_date").eq("department_id", departmentId),
    supabase.from("portable_radios").select("id, radio_number, radio_unit_id, serial_number, manufacturer, model, status, notes").eq("department_id", departmentId),
    supabase.from("portable_radio_mics").select("id, mic_number, serial_number, manufacturer, model, status, notes").eq("department_id", departmentId),
    supabase.from("fire_extinguishers").select("id, extinguisher_number, extinguisher_type, location_type, other_location, status, notes").eq("department_id", departmentId),
    supabase.from("thermal_imaging_cameras").select("id, camera_number, serial_number, manufacturer, model, status, notes").eq("department_id", departmentId),
    supabase.from("gas_monitors").select("id, monitor_number, serial_number, manufacturer, model, status, notes").eq("department_id", departmentId),
    supabase.from("rope_items").select("id, rope_name, rope_identifier, rope_type, serial_number, length_ft, diameter_mm, location_type, other_location, status, notes").eq("department_id", departmentId),
    supabase.from("misc_fire_equipment").select("id, equipment_name, asset_number, location_type, other_location, manufacturer, model, status, notes").eq("department_id", departmentId),
    supabase.from("ems_equipment").select("id, equipment_name, equipment_number, serial_number, manufacturer, model, location, status, notes").eq("department_id", departmentId),
    supabase.from("batteries").select("id, battery_number, serial_number, manufacturer, model, battery_type, location, status, notes").eq("department_id", departmentId),
    supabase.from("ground_ladders").select("id, ladder_number, ladder_type, ladder_length_ft, serial_number, manufacturer, model, status, notes").eq("department_id", departmentId),
    supabase.from("pie_equipment").select("id, equipment_number, serial_number, manufacturer, model, equipment_type, power_source, location, status, notes").eq("department_id", departmentId),
    supabase.from("ppe_items").select("id, item_name, asset_number, assigned_member_id, manufacturer, model, serial_number, size, location, status, notes").eq("department_id", departmentId),
  ]);

  const results = [deficiencies, fireHose, cylinders, packs, radios, mics, extinguishers, cameras, gasMonitors, ropes, misc, emsEquipment, batteries, ladders, pie, ppe];
  const error = results.find((result) => result.error)?.error;
  if (error) throw new Error(error.message || "Unable to load inventory.");

  const deficiencyCounts = new Map<string, number>();
  for (const row of deficiencies.data ?? []) {
    const relation = Array.isArray(row.status_info) ? row.status_info[0] : row.status_info;
    if (relation?.active !== true) continue;
    for (const key of ["fire_hose_id", "scba_cylinder_id", "scba_pack_id", "portable_radio_id", "portable_radio_mic_id", "thermal_imaging_camera_id", "gas_monitor_id", "battery_id", "ground_ladder_id", "pie_equipment_id", "ems_equipment_id", "ppe_item_id", "rope_item_id", "fire_extinguisher_id", "misc_fire_equipment_id"]) {
      const value = row[key as keyof typeof row];
      if (typeof value === "string") deficiencyCounts.set(value, (deficiencyCounts.get(value) ?? 0) + 1);
    }
  }

  const output: MobileInventoryItem[] = [];
  const add = (rows: unknown[] | null | undefined, categoryKey: string, category: string, mapper: (row: Record<string, unknown>) => MobileInventoryItem) => {
    for (const raw of rows ?? []) {
      const row = raw as Record<string, unknown>;
      const mapped = mapper(row);
      output.push({ ...mapped, categoryKey, category, deficiencyCount: deficiencyCounts.get(mapped.id) ?? 0 });
    }
  };

  add(fireHose.data, "fire-hose", "Fire Hose", (row) => item({ id: text(row.id), category: "Fire Hose", categoryKey: "fire-hose", name: text(row.inventory_number), identifier: text(row.inventory_number), location: text(row.apparatus), status: text(row.status), notes: text(row.notes), relatedHref: "/mobile/hose-testing", detailHref: `/mobile/inventory/fire-hose/${row.id}` }));
  add(cylinders.data, "scba-cylinders", "SCBA Cylinders", (row) => item({ id: text(row.id), category: "SCBA Cylinders", categoryKey: "scba-cylinders", name: text(row.cylinder_number), identifier: text(row.cylinder_number), serialNumber: text(row.serial_number), manufacturer: text(row.manufacturer), model: text(row.model), status: text(row.status), notes: text(row.notes), detailHref: `/mobile/inventory/scba-cylinders/${row.id}` }));
  add(packs.data, "scba-packs", "SCBA Packs", (row) => item({ id: text(row.id), category: "SCBA Packs", categoryKey: "scba-packs", name: text(row.pack_number), identifier: text(row.pack_number), serialNumber: text(row.serial_number), manufacturer: text(row.manufacturer), model: text(row.model), status: text(row.status), notes: text(row.notes), detailHref: `/mobile/inventory/scba-packs/${row.id}` }));
  add(radios.data, "portable-radios", "Portable Radios", (row) => item({ id: text(row.id), category: "Portable Radios", categoryKey: "portable-radios", name: text(row.radio_number), identifier: text(row.radio_unit_id), serialNumber: text(row.serial_number), manufacturer: text(row.manufacturer), model: text(row.model), status: text(row.status), notes: text(row.notes), detailHref: `/mobile/inventory/portable-radios/${row.id}` }));
  add(mics.data, "portable-radio-mics", "Portable Radio Mics", (row) => item({ id: text(row.id), category: "Portable Radio Mics", categoryKey: "portable-radio-mics", name: text(row.mic_number), identifier: text(row.mic_number), serialNumber: text(row.serial_number), manufacturer: text(row.manufacturer), model: text(row.model), status: text(row.status), notes: text(row.notes), detailHref: `/mobile/inventory/portable-radio-mics/${row.id}` }));
  add(extinguishers.data, "fire-extinguishers", "Fire Extinguishers", (row) => item({ id: text(row.id), category: "Fire Extinguishers", categoryKey: "fire-extinguishers", name: text(row.extinguisher_number), identifier: text(row.extinguisher_number), location: text(row.other_location ?? row.location_type), status: text(row.status), notes: text(row.notes), detailHref: `/mobile/inventory/fire-extinguishers/${row.id}` }));
  add(cameras.data, "thermal-cameras", "Thermal Cameras", (row) => item({ id: text(row.id), category: "Thermal Cameras", categoryKey: "thermal-cameras", name: text(row.camera_number), identifier: text(row.camera_number), serialNumber: text(row.serial_number), manufacturer: text(row.manufacturer), model: text(row.model), status: text(row.status), notes: text(row.notes), detailHref: `/mobile/inventory/thermal-cameras/${row.id}` }));
  add(gasMonitors.data, "gas-monitors", "Gas Monitors", (row) => item({ id: text(row.id), category: "Gas Monitors", categoryKey: "gas-monitors", name: text(row.monitor_number), identifier: text(row.monitor_number), serialNumber: text(row.serial_number), manufacturer: text(row.manufacturer), model: text(row.model), status: text(row.status), notes: text(row.notes), relatedHref: "/mobile/gas-monitor-calibration", detailHref: `/mobile/inventory/gas-monitors/${row.id}` }));
  add(ropes.data, "rope", "Rope", (row) => item({ id: text(row.id), category: "Rope", categoryKey: "rope", name: text(row.rope_name), identifier: text(row.rope_identifier), serialNumber: text(row.serial_number), location: text(row.other_location ?? row.location_type), quantity: `${number(row.length_ft)} ft`, status: text(row.status), notes: text(row.notes), relatedHref: "/mobile/rope-inspections", detailHref: `/mobile/inventory/rope/${row.id}` }));
  add(misc.data, "misc-fire-equipment", "Misc Fire Equipment", (row) => item({ id: text(row.id), category: "Misc Fire Equipment", categoryKey: "misc-fire-equipment", name: text(row.equipment_name), identifier: text(row.asset_number), manufacturer: text(row.manufacturer), model: text(row.model), location: text(row.other_location ?? row.location_type), status: text(row.status), notes: text(row.notes), detailHref: `/mobile/inventory/misc-fire-equipment/${row.id}` }));
  add(emsEquipment.data, "ems-equipment", "EMS Equipment", (row) => item({ id: text(row.id), category: "EMS Equipment", categoryKey: "ems-equipment", name: text(row.equipment_name), identifier: text(row.equipment_number), serialNumber: text(row.serial_number), manufacturer: text(row.manufacturer), model: text(row.model), location: text(row.location), status: text(row.status), notes: text(row.notes), detailHref: `/mobile/inventory/ems-equipment/${row.id}` }));
  add(batteries.data, "batteries", "Batteries", (row) => item({ id: text(row.id), category: "Batteries", categoryKey: "batteries", name: text(row.battery_number), identifier: text(row.battery_number), serialNumber: text(row.serial_number), manufacturer: text(row.manufacturer), model: text(row.model), location: text(row.location), status: text(row.status), notes: text(row.notes), detailHref: `/mobile/inventory/batteries/${row.id}` }));
  add(ladders.data, "ground-ladders", "Ground Ladders", (row) => item({ id: text(row.id), category: "Ground Ladders", categoryKey: "ground-ladders", name: text(row.ladder_number), identifier: text(row.ladder_number), serialNumber: text(row.serial_number), manufacturer: text(row.manufacturer), model: text(row.model), quantity: `${number(row.ladder_length_ft)} ft`, status: text(row.status), notes: text(row.notes), relatedHref: "/mobile/ladder-inspections", detailHref: `/mobile/inventory/ground-ladders/${row.id}` }));
  add(pie.data, "pie", "PIE Equipment", (row) => item({ id: text(row.id), category: "PIE Equipment", categoryKey: "pie", name: text(row.equipment_number), identifier: text(row.equipment_number), serialNumber: text(row.serial_number), manufacturer: text(row.manufacturer), model: text(row.model), location: text(row.location), status: text(row.status), notes: text(row.notes), detailHref: `/mobile/inventory/pie/${row.id}` }));
  add(ppe.data, "ppe", "PPE", (row) => item({ id: text(row.id), category: "PPE", categoryKey: "ppe", name: text(row.item_name), identifier: text(row.asset_number), serialNumber: text(row.serial_number), manufacturer: text(row.manufacturer), model: text(row.model), location: text(row.location), status: text(row.status), notes: text(row.notes), detailHref: `/mobile/inventory/ppe/${row.id}` }));
  return output.filter((row) => row.id !== "-" && row.name !== "-").sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: "base" }));
}

export async function loadMobileInventoryItem(supabase: SupabaseClient, departmentId: string, categoryKey: string, id: string) {
  const items = await loadMobileInventory(supabase, departmentId);
  return items.find((item) => item.categoryKey === categoryKey && item.id === id) ?? null;
}
