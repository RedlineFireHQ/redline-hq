"use client";

import {
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  GraduationCap,
  HardHat,
  Package,
  Settings,
  ShieldCheck,
  Stethoscope,
  Truck,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import type { AppPermissionOption } from "@/lib/app-permissions";

type PermissionDefinition = {
  key: string;
  label: string;
  description: string;
};

type PermissionCategory = {
  name: string;
  description: string;
  accessNote: string;
  icon: LucideIcon;
  primary: PermissionDefinition;
  advanced?: PermissionDefinition[];
  inventoryManagement?: boolean;
};

const INVENTORY_GROUPS: Array<{ name: string; keys: string[] }> = [
  { name: "Fire Hose", keys: ["fire_hose_management", "fire_hose_inspection_testing", "fire_hose_assignment", "fire_hose_retire_delete"] },
  { name: "SCBA Packs", keys: ["scba_pack_management", "scba_pack_inspection_testing", "scba_pack_assignment", "scba_pack_retire_delete"] },
  { name: "SCBA Cylinders", keys: ["scba_cylinder_management", "scba_cylinder_inspection_testing", "scba_cylinder_assignment", "scba_cylinder_retire_delete"] },
  { name: "PPE", keys: ["ppe_management", "ppe_inspection_testing", "ppe_assignment", "ppe_retire_delete"] },
  { name: "Portable Radios", keys: ["portable_radio_management", "portable_radio_inspection_testing", "portable_radio_assignment", "portable_radio_retire_delete"] },
  { name: "Portable Radio Mics", keys: ["portable_radio_mic_management", "portable_radio_mic_inspection_testing", "portable_radio_mic_assignment", "portable_radio_mic_retire_delete"] },
  { name: "Gas Monitors", keys: ["gas_monitor_management", "gas_monitor_calibration", "gas_monitor_assignment", "gas_monitor_retire_delete"] },
  { name: "Ground Ladders", keys: ["ground_ladder_management", "ground_ladder_inspection", "ground_ladder_service_testing", "ground_ladder_assignment", "ground_ladder_retire_delete"] },
  { name: "EMS Equipment", keys: ["ems_equipment_management", "ems_equipment_inspection_testing", "ems_equipment_assignment", "ems_equipment_retire_delete"] },
  { name: "EMS Supplies", keys: ["ems_supply_management", "ems_supply_inspection", "ems_supply_assignment", "ems_supply_retire_delete"] },
  { name: "Fire Extinguishers", keys: ["fire_extinguisher_management", "fire_extinguisher_inspection_testing", "fire_extinguisher_assignment", "fire_extinguisher_retire_delete"] },
  { name: "Rope", keys: ["rope_management", "rope_inspection_testing", "rope_assignment", "rope_retire_delete"] },
  { name: "TICs", keys: ["tic_management", "tic_inspection_testing", "tic_assignment", "tic_retire_delete"] },
  { name: "Batteries", keys: ["battery_management", "battery_testing", "battery_assignment", "battery_retire_delete"] },
  { name: "PIE", keys: ["pie_equipment_management", "pie_equipment_inspection_testing", "pie_equipment_assignment", "pie_equipment_retire_delete"] },
  { name: "Misc Fire Equipment", keys: ["misc_fire_equipment_management", "misc_fire_equipment_inspection_testing", "misc_fire_equipment_assignment", "misc_fire_equipment_retire_delete"] },
];

const INVENTORY_MANAGEMENT_KEYS = INVENTORY_GROUPS.flatMap((group) =>
  group.keys.filter((key) => key.endsWith("_management")),
);

const LEGACY_COMPATIBILITY_KEYS = new Set([
  "training_management",
  "homework_assignment",
  "training_review",
  "inventory_management",
  "deficiency_management",
]);

const CATEGORIES: PermissionCategory[] = [
  { name: "Personnel", description: "Personnel management allows access to other members' records and management functions.", accessNote: "Members can always view their own profile.", icon: Users, primary: { key: "personnel_management", label: "Manage Personnel", description: "Allows this member to manage department members and member permissions." } },
  { name: "Training", description: "Manage department training programs and member development.", accessNote: "Everyone can view training and add their own training.", icon: GraduationCap, primary: { key: "training_program_management", label: "Manage Training Programs", description: "Create and manage department training events and programs." }, advanced: [{ key: "training_assignment_management", label: "Assign Training", description: "Assign required or homework training to other members." }, { key: "training_review_management", label: "Review Training", description: "Review and approve submitted training." }] },
  { name: "Certifications", description: "Manage certification records and department certification configuration.", accessNote: "Everyone can view certifications.", icon: ShieldCheck, primary: { key: "certification_management", label: "Manage Certifications", description: "Allows this member to add and manage certification records." } },
  { name: "Apparatus", description: "Manage apparatus records and operational configuration.", accessNote: "Everyone can perform apparatus daily checks, inspections, and pump tests.", icon: Truck, primary: { key: "apparatus_management", label: "Manage Apparatus", description: "Manage apparatus records and apparatus-level configuration." }, advanced: [{ key: "apparatus_checks_management", label: "Manage Apparatus Checks", description: "Manage apparatus check requirements and oversight." }, { key: "pump_testing_management", label: "Manage Pump Testing", description: "Manage pump-test records and program settings." }] },
  { name: "Maintenance", description: "Manage maintenance records and service workflows.", accessNote: "Maintenance Field Entry allows mobile field creation only. Maintenance Management allows create, edit, and manage access.", icon: Wrench, primary: { key: "maintenance_management", label: "Manage Maintenance", description: "Allows this member to manage maintenance records and workflows." }, advanced: [{ key: "maintenance_field_entry", label: "Mobile Field Entry", description: "Allows this member to create maintenance records from the mobile field workflow." }] },
  { name: "Deficiencies", description: "Manage reported conditions that need operational attention.", accessNote: "Everyone can view deficiencies.", icon: ClipboardCheck, primary: { key: "deficiency_edit_any", label: "Edit Any Deficiency", description: "Allows this member to edit deficiencies reported by other members." }, advanced: [{ key: "deficiency_resolve", label: "Resolve Deficiencies", description: "Allows this member to mark deficiencies as resolved." }] },
  { name: "Inventory", description: "Manage inventory records across department equipment categories.", accessNote: "Everyone can inspect and test department equipment. Special permissions control who can add, edit, assign, or retire inventory.", icon: Package, primary: { key: "inventory", label: "Manage Inventory", description: "Grants management access across inventory categories." }, inventoryManagement: true },
  { name: "EMS", description: "Manage department-level EMS functions and records.", accessNote: "Everyone can log their own EMS training and CE activities.", icon: Stethoscope, primary: { key: "ems_management", label: "Manage EMS", description: "Controls department-level EMS management functions." } },
  { name: "Pre-Plans", description: "Manage department pre-plans and incident information.", accessNote: "Everyone can view and create pre-plans.", icon: HardHat, primary: { key: "pre_plans_management", label: "Manage Pre-Plans", description: "Allows this member to edit, archive, and delete existing pre-plans." } },
  { name: "Reports", description: "Access department operational reporting.", accessNote: "Reports are restricted to members with this permission.", icon: FileText, primary: { key: "reports_management", label: "Manage Reports", description: "Allows this member to access department Reports." } },
  { name: "Documents", description: "Manage the department document library.", accessNote: "Everyone can view documents.", icon: BookOpenCheck, primary: { key: "documents_management", label: "Manage Documents", description: "Allows this member to upload, edit, and delete department documents." } },
  { name: "Calendar", description: "Manage department-wide calendar events.", accessNote: "Everyone can view the department calendar and manage their own personal activities.", icon: CalendarDays, primary: { key: "calendar_management", label: "Manage Calendar", description: "Allows this member to create, edit, and delete department-wide calendar events." } },
  { name: "Settings", description: "Manage department settings and configuration.", accessNote: "Settings are restricted to members with this permission.", icon: Settings, primary: { key: "settings_management", label: "Manage Settings", description: "Allows this member to access department Settings and configuration." } },
];

type SpecialPermissionsPanelProps = {
  permissionOptions: AppPermissionOption[];
  selectedPermissionKeys: string[];
  onTogglePermission: (permissionKey: string) => void;
};

export default function SpecialPermissionsPanel({
  permissionOptions,
  selectedPermissionKeys,
  onTogglePermission,
}: SpecialPermissionsPanelProps) {
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [isGrantAllConfirmationOpen, setIsGrantAllConfirmationOpen] = useState(false);
  const [isGrantAllEnabled, setIsGrantAllEnabled] = useState(false);
  const [grantAllAddedKeys, setGrantAllAddedKeys] = useState<string[]>([]);
  const optionByKey = new Map(permissionOptions.map((option) => [option.key, option]));
  const selectedKeys = new Set(selectedPermissionKeys);
  const applicablePermissionKeys = permissionOptions
    .filter((option) => !LEGACY_COMPATIBILITY_KEYS.has(option.key))
    .map((option) => option.key);
  const hasFullManagementAccess = applicablePermissionKeys.length > 0 && applicablePermissionKeys.every((key) => selectedKeys.has(key));
  const enabledCategories = CATEGORIES.filter((category) => {
    if (category.inventoryManagement) {
      return INVENTORY_MANAGEMENT_KEYS.some((key) => selectedKeys.has(key));
    }

    return [category.primary.key, ...(category.advanced ?? []).map((permission) => permission.key)]
      .some((key) => selectedKeys.has(key));
  });

  function renderToggle(key: string, label: string, description: string) {
    if (!optionByKey.has(key)) {
      return null;
    }

    return (
      <label key={key} className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-200">
        <span className="min-w-0">
          <span className="block font-semibold text-white">{label}</span>
          <span className="mt-1 block text-xs leading-5 text-neutral-400">{description}</span>
        </span>
        <input type="checkbox" checked={selectedKeys.has(key)} onChange={() => onTogglePermission(key)} className="h-4 w-4 accent-red-500" />
      </label>
    );
  }

  function toggleInventoryManagement() {
    const managementKeys = INVENTORY_MANAGEMENT_KEYS.filter((key) => optionByKey.has(key));
    const shouldEnable = !managementKeys.every((key) => selectedKeys.has(key));
    for (const key of managementKeys) {
      if (selectedKeys.has(key) !== shouldEnable) {
        onTogglePermission(key);
      }
    }
  }

  function grantAllPermissions() {
    const addedKeys = applicablePermissionKeys.filter((key) => !selectedKeys.has(key));
    for (const key of addedKeys) {
      onTogglePermission(key);
    }
    setGrantAllAddedKeys(addedKeys);
    setIsGrantAllEnabled(true);
    setIsGrantAllConfirmationOpen(false);
  }

  function removeGrantedPermissions() {
    for (const key of grantAllAddedKeys) {
      if (selectedKeys.has(key)) {
        onTogglePermission(key);
      }
    }
    setGrantAllAddedKeys([]);
    setIsGrantAllEnabled(false);
  }

  return (
    <section className="rounded-xl border border-neutral-700 bg-neutral-950/70 p-4">
      <div className="rounded-lg border border-red-500/25 bg-red-500/10 p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white">Grant All Permissions</h3>
            <p className="mt-1 max-w-xl text-sm leading-5 text-neutral-300">Gives this member access to all management functions in Redline HQ.</p>
          </div>
          <label className="flex items-center gap-3 rounded-lg border border-red-400/35 bg-black/20 px-3 py-2 text-sm font-semibold text-white">
            <span>{isGrantAllEnabled ? "Granted by this control" : "Grant All Permissions"}</span>
            <input type="checkbox" checked={isGrantAllEnabled} onChange={(event) => event.target.checked ? setIsGrantAllConfirmationOpen(true) : removeGrantedPermissions()} className="h-4 w-4 accent-red-500" />
          </label>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-4">
        <h3 className="text-sm font-bold text-white">This member can:</h3>
        {hasFullManagementAccess ? (
          <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-emerald-300"><CheckCircle2 className="h-4 w-4" />This member has full management access.</p>
        ) : enabledCategories.length > 0 ? (
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {enabledCategories.map((category) => <li key={category.name} className="flex items-center gap-2 text-sm text-neutral-200"><CheckCircle2 className="h-4 w-4 text-emerald-400" />Manage {category.name}</li>)}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-neutral-400">No special management access selected.</p>
        )}
      </div>

      <div className="mb-4 mt-5">
        <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-white">Management Access</h3>
        <p className="mt-1 text-sm text-neutral-400">Grant access by operational area. Expand Advanced only when more specific capabilities are needed.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {CATEGORIES.map((category) => {
          const Icon = category.icon;
          const advancedOptions = (category.advanced ?? []).filter((permission) => optionByKey.has(permission.key));
          const hasAdvanced = category.inventoryManagement || advancedOptions.length > 0;
          const isExpanded = expandedCategories.includes(category.name);
          const inventoryManagementEnabled = INVENTORY_MANAGEMENT_KEYS.filter((key) => optionByKey.has(key)).every((key) => selectedKeys.has(key));

          return (
            <article key={category.name} className="rounded-lg border border-neutral-700 bg-neutral-900 p-5">
              <div className="flex items-start gap-3">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-red-400" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <h4 className="font-semibold text-white">{category.name}</h4>
                  <p className="mt-1 text-sm leading-5 text-neutral-400">{category.description}</p>
                </div>
              </div>

              <div className="mt-4">
                {category.inventoryManagement ? (
                  <label className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-200">
                    <span className="min-w-0"><span className="block font-semibold text-white">{category.primary.label}</span><span className="mt-1 block text-xs leading-5 text-neutral-400">{category.primary.description}</span></span>
                    <input type="checkbox" checked={inventoryManagementEnabled} onChange={toggleInventoryManagement} className="h-4 w-4 accent-red-500" />
                  </label>
                ) : renderToggle(category.primary.key, category.primary.label, category.primary.description)}
              </div>

              <p className="mt-3 border-l-2 border-red-500/45 pl-3 text-xs leading-5 text-neutral-400">{category.accessNote}</p>

              {hasAdvanced ? (
                <div className="mt-3">
                  <button type="button" onClick={() => setExpandedCategories((current) => current.includes(category.name) ? current.filter((name) => name !== category.name) : [...current, category.name])} className="text-sm font-semibold text-red-300 hover:text-red-200">
                    {isExpanded ? "Hide Advanced" : "Advanced"}
                  </button>
                  {isExpanded ? (
                    <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                      {category.inventoryManagement
                        ? INVENTORY_GROUPS.map((group) => {
                            const permissions = group.keys.filter((key) => optionByKey.has(key));
                            return permissions.length > 0 ? (
                              <div key={group.name}>
                                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">{group.name}</p>
                                <div className="space-y-2">{permissions.filter((key) => !key.includes("inspection") && !key.includes("testing") && !key.includes("calibration")).map((key) => renderToggle(key, optionByKey.get(key)?.label ?? key, optionByKey.get(key)?.description ?? "Allows management access for this inventory category."))}</div>
                              </div>
                            ) : null;
                          })
                        : <div className="space-y-2">{advancedOptions.map((permission) => renderToggle(permission.key, permission.label, permission.description))}</div>}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {isGrantAllConfirmationOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-labelledby="grant-all-permissions-title">
          <div className="w-full max-w-lg rounded-xl border border-neutral-700 bg-neutral-900 p-6 shadow-2xl">
            <h3 id="grant-all-permissions-title" className="text-xl font-bold text-white">Grant all permissions?</h3>
            <p className="mt-3 text-sm leading-6 text-neutral-300">This will give this member access to all management functions, including personnel, settings, reports, certifications, inventory management, training management, and other administrative functions.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setIsGrantAllConfirmationOpen(false)} className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-semibold text-neutral-200 hover:bg-neutral-800">Cancel</button>
              <button type="button" onClick={grantAllPermissions} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">Grant All</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}