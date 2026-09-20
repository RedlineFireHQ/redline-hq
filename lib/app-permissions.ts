export const MEMBER_RANK_OPTIONS = [
  "Firefighter",
  "Driver Operator",
  "Lieutenant",
  "Captain",
  "Battalion Chief",
  "Assistant Chief",
  "Chief",
] as const;

export type MemberRank = (typeof MEMBER_RANK_OPTIONS)[number];

export const APP_PERMISSION_KEYS = [
  "personnel_management",
  "certification_management",
  "settings_management",
  "reports_management",
  "documents_management",
  "pre_plans_management",
  "calendar_management",
  "ems_management",
  "training_program_management",
  "training_assignment_management",
  "homework_assignment",
  "training_management",
  "training_review",
  "training_review_management",
  "apparatus_management",
  "apparatus_checks_management",
  "pump_testing_management",
  "maintenance_management",
  "maintenance_field_entry",
  "deficiency_edit_any",
  "deficiency_resolve",
  "deficiency_management",
  "fire_hose_management",
  "fire_hose_inspection_testing",
  "fire_hose_assignment",
  "fire_hose_retire_delete",
  "scba_pack_management",
  "scba_pack_inspection_testing",
  "scba_pack_assignment",
  "scba_pack_retire_delete",
  "scba_cylinder_management",
  "scba_cylinder_inspection_testing",
  "scba_cylinder_assignment",
  "scba_cylinder_retire_delete",
  "ppe_management",
  "ppe_inspection_testing",
  "ppe_assignment",
  "ppe_retire_delete",
  "portable_radio_management",
  "portable_radio_inspection_testing",
  "portable_radio_assignment",
  "portable_radio_retire_delete",
  "portable_radio_mic_management",
  "portable_radio_mic_inspection_testing",
  "portable_radio_mic_assignment",
  "portable_radio_mic_retire_delete",
  "gas_monitor_management",
  "gas_monitor_calibration",
  "gas_monitor_assignment",
  "gas_monitor_retire_delete",
  "ground_ladder_management",
  "ground_ladder_inspection",
  "ground_ladder_service_testing",
  "ground_ladder_assignment",
  "ground_ladder_retire_delete",
  "ems_equipment_management",
  "ems_equipment_inspection_testing",
  "ems_equipment_assignment",
  "ems_equipment_retire_delete",
  "ems_supply_management",
  "ems_supply_inspection",
  "ems_supply_assignment",
  "ems_supply_retire_delete",
  "fire_extinguisher_management",
  "fire_extinguisher_inspection_testing",
  "fire_extinguisher_assignment",
  "fire_extinguisher_retire_delete",
  "rope_management",
  "rope_inspection_testing",
  "rope_assignment",
  "rope_retire_delete",
  "tic_management",
  "tic_inspection_testing",
  "tic_assignment",
  "tic_retire_delete",
  "battery_management",
  "battery_testing",
  "battery_assignment",
  "battery_retire_delete",
  "pie_equipment_management",
  "pie_equipment_inspection_testing",
  "pie_equipment_assignment",
  "pie_equipment_retire_delete",
  "misc_fire_equipment_management",
  "misc_fire_equipment_inspection_testing",
  "misc_fire_equipment_assignment",
  "misc_fire_equipment_retire_delete",
  "inventory_management",
] as const;

export type AppPermissionKey = (typeof APP_PERMISSION_KEYS)[number];

export type AppPermissionOption = {
  key: string;
  label: string;
  description: string | null;
  active: boolean;
  sort_order: number;
};

export function getAppPermissionCategory(permissionKey: string): string {
  if (permissionKey.startsWith("training_") || permissionKey === "homework_assignment") return "Training";
  if (permissionKey.startsWith("apparatus_") || permissionKey === "maintenance_management" || permissionKey === "maintenance_field_entry" || permissionKey === "pump_testing_management") return "Apparatus";
  if (permissionKey.startsWith("deficiency_")) return "Deficiencies";
  if (permissionKey.includes("fire_hose")) return "Fire Hose";
  if (permissionKey.includes("scba_pack")) return "SCBA Packs";
  if (permissionKey.includes("scba_cylinder")) return "SCBA Cylinders";
  if (permissionKey.startsWith("ppe_")) return "PPE";
  if (permissionKey.includes("portable_radio_mic")) return "Portable Radio Mics";
  if (permissionKey.includes("portable_radio")) return "Portable Radios";
  if (permissionKey.includes("gas_monitor")) return "Gas Monitors";
  if (permissionKey.includes("ground_ladder")) return "Ground Ladders";
  if (permissionKey.includes("ems_equipment")) return "EMS Equipment";
  if (permissionKey.includes("ems_supply")) return "EMS Supplies";
  if (permissionKey.includes("fire_extinguisher")) return "Fire Extinguishers";
  if (permissionKey.startsWith("rope_")) return "Rope";
  if (permissionKey.startsWith("tic_")) return "Thermal Imaging Cameras";
  if (permissionKey.startsWith("battery_")) return "Batteries";
  if (permissionKey.startsWith("pie_equipment")) return "PIE Equipment";
  if (permissionKey.startsWith("misc_fire_equipment")) return "Miscellaneous Fire Equipment";
  if (permissionKey === "inventory_management") return "Legacy Permissions";
  return "Core";
}

export function isValidMemberRank(value: unknown): value is MemberRank {
  return typeof value === "string" && MEMBER_RANK_OPTIONS.includes(value as MemberRank);
}

export function normalizePermissionKeys(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const cleaned = values
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value.length > 0);

  return Array.from(new Set(cleaned));
}
