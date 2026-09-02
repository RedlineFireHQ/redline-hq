"use client";

import { useMemo } from "react";

type CheckRequirementDraft = {
  id?: string;
  score_profile: string;
  interval_days: string;
  is_active: boolean;
  notes: string;
};

type MaintenanceMethodDraft = {
  id?: string;
  method_type: string;
  interval_value: string;
  due_soon_threshold_value: string;
  early_overdue_threshold_value: string;
  moderate_overdue_threshold_value: string;
};

type MaintenanceRequirementDraft = {
  id?: string;
  name: string;
  maintenance_type: string;
  is_active: boolean;
  notes: string;
  methods: MaintenanceMethodDraft[];
};

type EquipmentRequirementDraft = {
  id?: string;
  equipment_source: string;
  equipment_id: string;
  display_name: string;
  is_required: boolean;
  is_critical: boolean;
  is_active: boolean;
  notes: string;
};

type ChecklistItemDraft = {
  id?: string;
  section_name: string;
  item_label: string;
  is_required: boolean;
  is_active: boolean;
  display_order: string;
};

export type ApparatusConfigurationDraft = {
  checkRequirement: CheckRequirementDraft;
  maintenanceRequirements: MaintenanceRequirementDraft[];
  equipmentRequirements: EquipmentRequirementDraft[];
  inspectionChecklistItems: ChecklistItemDraft[];
};

type ApparatusConfigurationEditorProps = {
  value: ApparatusConfigurationDraft;
  onChange: (nextValue: ApparatusConfigurationDraft) => void;
  canEdit: boolean;
  departmentCheckDefaultIntervalDays?: number | null;
  onApplyDepartmentDefaults?: () => void;
};

const EMPTY_CHECK_REQUIREMENT: CheckRequirementDraft = {
  score_profile: "",
  interval_days: "",
  is_active: true,
  notes: "",
};

const EMPTY_MAINTENANCE_METHOD: MaintenanceMethodDraft = {
  method_type: "",
  interval_value: "",
  due_soon_threshold_value: "",
  early_overdue_threshold_value: "",
  moderate_overdue_threshold_value: "",
};

const EMPTY_MAINTENANCE_REQUIREMENT: MaintenanceRequirementDraft = {
  name: "",
  maintenance_type: "",
  is_active: true,
  notes: "",
  methods: [EMPTY_MAINTENANCE_METHOD],
};

const EMPTY_EQUIPMENT_REQUIREMENT: EquipmentRequirementDraft = {
  equipment_source: "",
  equipment_id: "",
  display_name: "",
  is_required: true,
  is_critical: false,
  is_active: true,
  notes: "",
};

const EMPTY_CHECKLIST_ITEM: ChecklistItemDraft = {
  section_name: "General",
  item_label: "",
  is_required: true,
  is_active: true,
  display_order: "0",
};

function updateArrayItem<T>(items: T[], index: number, nextItem: T) {
  return items.map((item, itemIndex) => (itemIndex === index ? nextItem : item));
}

function renderSectionTitle(title: string, description: string) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-red-300">{title}</h3>
      <p className="text-sm text-neutral-400">{description}</p>
    </div>
  );
}

export function createBlankApparatusConfiguration(): ApparatusConfigurationDraft {
  return {
    checkRequirement: { ...EMPTY_CHECK_REQUIREMENT },
    maintenanceRequirements: [],
    equipmentRequirements: [],
    inspectionChecklistItems: [],
  };
}

export default function ApparatusConfigurationEditor({
  value,
  onChange,
  canEdit,
  departmentCheckDefaultIntervalDays,
  onApplyDepartmentDefaults,
}: ApparatusConfigurationEditorProps) {
  const hasAnyConfiguration = useMemo(() => {
    return Boolean(
      value.checkRequirement.interval_days.trim() ||
        value.maintenanceRequirements.length > 0 ||
        value.equipmentRequirements.length > 0 ||
        value.inspectionChecklistItems.length > 0,
    );
  }, [value]);

  const canUseDepartmentDefaults =
    typeof departmentCheckDefaultIntervalDays === "number" && Number.isFinite(departmentCheckDefaultIntervalDays);

  function setCheckRequirement(next: CheckRequirementDraft) {
    onChange({ ...value, checkRequirement: next });
  }

  function setMaintenanceRequirements(next: MaintenanceRequirementDraft[]) {
    onChange({ ...value, maintenanceRequirements: next });
  }

  function setEquipmentRequirements(next: EquipmentRequirementDraft[]) {
    onChange({ ...value, equipmentRequirements: next });
  }

  function setChecklistItems(next: ChecklistItemDraft[]) {
    onChange({ ...value, inspectionChecklistItems: next });
  }

  return (
    <div className="space-y-6 rounded-2xl border border-white/10 bg-[#1b1b1b] p-5">
      <div className="flex items-center justify-between gap-3">
        {renderSectionTitle(
          "Apparatus Configuration",
          "These records are explicit department requirements. Leave a section blank if the apparatus is not ready for that configuration yet.",
        )}

        {canUseDepartmentDefaults ? (
          <button
            type="button"
            onClick={onApplyDepartmentDefaults}
            disabled={!canEdit}
            className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Use Department Defaults
          </button>
        ) : null}
      </div>

      {!hasAnyConfiguration ? (
        <p className="rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-sm text-neutral-400">
          No explicit apparatus configuration has been added yet.
        </p>
      ) : null}

      <section className="space-y-3 rounded-xl border border-white/10 bg-[#111111] p-4">
        {renderSectionTitle(
          "Apparatus Check Requirements",
          "Fields: score_profile, interval_days, is_active, notes. The department default only supplies interval_days when available.",
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm text-neutral-300">
            Score Profile
            <select
              value={value.checkRequirement.score_profile}
              onChange={(event) => setCheckRequirement({ ...value.checkRequirement, score_profile: event.target.value })}
              disabled={!canEdit}
              className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none transition focus:border-red-500/60 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <option value="">Select profile</option>
              <option value="daily">daily</option>
              <option value="monthly">monthly</option>
            </select>
          </label>

          <label className="text-sm text-neutral-300">
            Interval Days
            <input
              type="number"
              min="1"
              value={value.checkRequirement.interval_days}
              onChange={(event) => setCheckRequirement({ ...value.checkRequirement, interval_days: event.target.value })}
              disabled={!canEdit}
              className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none transition focus:border-red-500/60 disabled:cursor-not-allowed disabled:opacity-70"
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-neutral-300">
            <input
              type="checkbox"
              checked={value.checkRequirement.is_active}
              onChange={(event) => setCheckRequirement({ ...value.checkRequirement, is_active: event.target.checked })}
              disabled={!canEdit}
              className="h-4 w-4 rounded border border-white/20 bg-neutral-950 accent-red-600 disabled:cursor-not-allowed"
            />
            Active
          </label>

          <label className="text-sm text-neutral-300 md:col-span-2">
            Notes
            <textarea
              value={value.checkRequirement.notes}
              onChange={(event) => setCheckRequirement({ ...value.checkRequirement, notes: event.target.value })}
              disabled={!canEdit}
              className="mt-1 min-h-20 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none transition focus:border-red-500/60 disabled:cursor-not-allowed disabled:opacity-70"
            />
          </label>
        </div>

        {canUseDepartmentDefaults && typeof departmentCheckDefaultIntervalDays === "number" ? (
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
            Department default interval_days available: {departmentCheckDefaultIntervalDays}
          </p>
        ) : null}
      </section>

      <section className="space-y-3 rounded-xl border border-white/10 bg-[#111111] p-4">
        {renderSectionTitle(
          "Maintenance Requirements",
          "Fields: name, maintenance_type, is_active, notes. Each requirement can have one or more methods.",
        )}

        {value.maintenanceRequirements.length === 0 ? (
          <p className="text-sm text-neutral-400">No maintenance requirements added.</p>
        ) : null}

        <div className="space-y-4">
          {value.maintenanceRequirements.map((requirement, requirementIndex) => (
            <div key={requirement.id ?? requirementIndex} className="space-y-3 rounded-lg border border-white/10 bg-[#151515] p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm text-neutral-300">
                  Name
                  <input
                    type="text"
                    value={requirement.name}
                    onChange={(event) =>
                      setMaintenanceRequirements(
                        updateArrayItem(value.maintenanceRequirements, requirementIndex, {
                          ...requirement,
                          name: event.target.value,
                        }),
                      )
                    }
                    disabled={!canEdit}
                    className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none transition focus:border-red-500/60 disabled:cursor-not-allowed disabled:opacity-70"
                  />
                </label>

                <label className="text-sm text-neutral-300">
                  Maintenance Type
                  <input
                    type="text"
                    value={requirement.maintenance_type}
                    onChange={(event) =>
                      setMaintenanceRequirements(
                        updateArrayItem(value.maintenanceRequirements, requirementIndex, {
                          ...requirement,
                          maintenance_type: event.target.value,
                        }),
                      )
                    }
                    disabled={!canEdit}
                    className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none transition focus:border-red-500/60 disabled:cursor-not-allowed disabled:opacity-70"
                  />
                </label>

                <label className="flex items-center gap-2 text-sm text-neutral-300">
                  <input
                    type="checkbox"
                    checked={requirement.is_active}
                    onChange={(event) =>
                      setMaintenanceRequirements(
                        updateArrayItem(value.maintenanceRequirements, requirementIndex, {
                          ...requirement,
                          is_active: event.target.checked,
                        }),
                      )
                    }
                    disabled={!canEdit}
                    className="h-4 w-4 rounded border border-white/20 bg-neutral-950 accent-red-600 disabled:cursor-not-allowed"
                  />
                  Active
                </label>

                <label className="text-sm text-neutral-300 md:col-span-2">
                  Notes
                  <textarea
                    value={requirement.notes}
                    onChange={(event) =>
                      setMaintenanceRequirements(
                        updateArrayItem(value.maintenanceRequirements, requirementIndex, {
                          ...requirement,
                          notes: event.target.value,
                        }),
                      )
                    }
                    disabled={!canEdit}
                    className="mt-1 min-h-20 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none transition focus:border-red-500/60 disabled:cursor-not-allowed disabled:opacity-70"
                  />
                </label>
              </div>

              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Methods</p>
                {requirement.methods.map((method, methodIndex) => (
                  <div key={method.id ?? methodIndex} className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
                    <label className="text-sm text-neutral-300 lg:col-span-1">
                      Method Type
                      <select
                        value={method.method_type}
                        onChange={(event) => {
                          const nextMethods = requirement.methods.map((currentMethod, currentIndex) =>
                            currentIndex === methodIndex
                              ? { ...currentMethod, method_type: event.target.value }
                              : currentMethod,
                          );
                          setMaintenanceRequirements(
                            updateArrayItem(value.maintenanceRequirements, requirementIndex, {
                              ...requirement,
                              methods: nextMethods,
                            }),
                          );
                        }}
                        disabled={!canEdit}
                        className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none transition focus:border-red-500/60 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        <option value="">Select method</option>
                        <option value="time_days">time_days</option>
                        <option value="mileage">mileage</option>
                        <option value="engine_hours">engine_hours</option>
                      </select>
                    </label>

                    <label className="text-sm text-neutral-300">
                      Interval Value
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={method.interval_value}
                        onChange={(event) => {
                          const nextMethods = requirement.methods.map((currentMethod, currentIndex) =>
                            currentIndex === methodIndex
                              ? { ...currentMethod, interval_value: event.target.value }
                              : currentMethod,
                          );
                          setMaintenanceRequirements(
                            updateArrayItem(value.maintenanceRequirements, requirementIndex, {
                              ...requirement,
                              methods: nextMethods,
                            }),
                          );
                        }}
                        disabled={!canEdit}
                        className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none transition focus:border-red-500/60 disabled:cursor-not-allowed disabled:opacity-70"
                      />
                    </label>

                    <label className="text-sm text-neutral-300">
                      Due Soon Threshold
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={method.due_soon_threshold_value}
                        onChange={(event) => {
                          const nextMethods = requirement.methods.map((currentMethod, currentIndex) =>
                            currentIndex === methodIndex
                              ? { ...currentMethod, due_soon_threshold_value: event.target.value }
                              : currentMethod,
                          );
                          setMaintenanceRequirements(
                            updateArrayItem(value.maintenanceRequirements, requirementIndex, {
                              ...requirement,
                              methods: nextMethods,
                            }),
                          );
                        }}
                        disabled={!canEdit}
                        className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none transition focus:border-red-500/60 disabled:cursor-not-allowed disabled:opacity-70"
                      />
                    </label>

                    <label className="text-sm text-neutral-300">
                      Early Overdue Threshold
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={method.early_overdue_threshold_value}
                        onChange={(event) => {
                          const nextMethods = requirement.methods.map((currentMethod, currentIndex) =>
                            currentIndex === methodIndex
                              ? { ...currentMethod, early_overdue_threshold_value: event.target.value }
                              : currentMethod,
                          );
                          setMaintenanceRequirements(
                            updateArrayItem(value.maintenanceRequirements, requirementIndex, {
                              ...requirement,
                              methods: nextMethods,
                            }),
                          );
                        }}
                        disabled={!canEdit}
                        className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none transition focus:border-red-500/60 disabled:cursor-not-allowed disabled:opacity-70"
                      />
                    </label>

                    <label className="text-sm text-neutral-300">
                      Moderate Overdue Threshold
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={method.moderate_overdue_threshold_value}
                        onChange={(event) => {
                          const nextMethods = requirement.methods.map((currentMethod, currentIndex) =>
                            currentIndex === methodIndex
                              ? { ...currentMethod, moderate_overdue_threshold_value: event.target.value }
                              : currentMethod,
                          );
                          setMaintenanceRequirements(
                            updateArrayItem(value.maintenanceRequirements, requirementIndex, {
                              ...requirement,
                              methods: nextMethods,
                            }),
                          );
                        }}
                        disabled={!canEdit}
                        className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none transition focus:border-red-500/60 disabled:cursor-not-allowed disabled:opacity-70"
                      />
                    </label>
                  </div>
                ))}

                {canEdit ? (
                  <button
                    type="button"
                    onClick={() =>
                      setMaintenanceRequirements(
                        updateArrayItem(value.maintenanceRequirements, requirementIndex, {
                          ...requirement,
                          methods: [...requirement.methods, { ...EMPTY_MAINTENANCE_METHOD }],
                        }),
                      )
                    }
                    className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
                  >
                    Add Method
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        {canEdit ? (
          <button
            type="button"
            onClick={() => setMaintenanceRequirements([...value.maintenanceRequirements, { ...EMPTY_MAINTENANCE_REQUIREMENT }])}
            className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
          >
            Add Maintenance Requirement
          </button>
        ) : null}
      </section>

      <section className="space-y-3 rounded-xl border border-white/10 bg-[#111111] p-4">
        {renderSectionTitle(
          "Required Equipment",
          "Fields: equipment_source, equipment_id, display_name, is_required, is_critical, is_active, notes.",
        )}

        {value.equipmentRequirements.length === 0 ? (
          <p className="text-sm text-neutral-400">No equipment requirements added.</p>
        ) : null}

        <div className="space-y-4">
          {value.equipmentRequirements.map((requirement, requirementIndex) => (
            <div key={requirement.id ?? requirementIndex} className="grid gap-3 rounded-lg border border-white/10 bg-[#151515] p-4 md:grid-cols-2">
              <label className="text-sm text-neutral-300">
                Equipment Source
                <select
                  value={requirement.equipment_source}
                  onChange={(event) =>
                    setEquipmentRequirements(
                      updateArrayItem(value.equipmentRequirements, requirementIndex, {
                        ...requirement,
                        equipment_source: event.target.value,
                      }),
                    )
                  }
                  disabled={!canEdit}
                  className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none transition focus:border-red-500/60 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <option value="">Select source</option>
                  <option value="asset">asset</option>
                  <option value="fire_hose">fire_hose</option>
                  <option value="scba_cylinder">scba_cylinder</option>
                  <option value="scba_pack">scba_pack</option>
                  <option value="pie_equipment">pie_equipment</option>
                  <option value="gas_monitor">gas_monitor</option>
                  <option value="battery">battery</option>
                  <option value="thermal_imaging_camera">thermal_imaging_camera</option>
                  <option value="ground_ladder">ground_ladder</option>
                  <option value="portable_radio">portable_radio</option>
                  <option value="portable_radio_mic">portable_radio_mic</option>
                </select>
              </label>

              <label className="text-sm text-neutral-300">
                Equipment ID
                <input
                  type="text"
                  value={requirement.equipment_id}
                  onChange={(event) =>
                    setEquipmentRequirements(
                      updateArrayItem(value.equipmentRequirements, requirementIndex, {
                        ...requirement,
                        equipment_id: event.target.value,
                      }),
                    )
                  }
                  disabled={!canEdit}
                  className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none transition focus:border-red-500/60 disabled:cursor-not-allowed disabled:opacity-70"
                />
              </label>

              <label className="text-sm text-neutral-300">
                Display Name
                <input
                  type="text"
                  value={requirement.display_name}
                  onChange={(event) =>
                    setEquipmentRequirements(
                      updateArrayItem(value.equipmentRequirements, requirementIndex, {
                        ...requirement,
                        display_name: event.target.value,
                      }),
                    )
                  }
                  disabled={!canEdit}
                  className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none transition focus:border-red-500/60 disabled:cursor-not-allowed disabled:opacity-70"
                />
              </label>

              <label className="text-sm text-neutral-300 md:col-span-2">
                Notes
                <textarea
                  value={requirement.notes}
                  onChange={(event) =>
                    setEquipmentRequirements(
                      updateArrayItem(value.equipmentRequirements, requirementIndex, {
                        ...requirement,
                        notes: event.target.value,
                      }),
                    )
                  }
                  disabled={!canEdit}
                  className="mt-1 min-h-20 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none transition focus:border-red-500/60 disabled:cursor-not-allowed disabled:opacity-70"
                />
              </label>

              <label className="flex items-center gap-2 text-sm text-neutral-300">
                <input
                  type="checkbox"
                  checked={requirement.is_required}
                  onChange={(event) =>
                    setEquipmentRequirements(
                      updateArrayItem(value.equipmentRequirements, requirementIndex, {
                        ...requirement,
                        is_required: event.target.checked,
                      }),
                    )
                  }
                  disabled={!canEdit}
                  className="h-4 w-4 rounded border border-white/20 bg-neutral-950 accent-red-600 disabled:cursor-not-allowed"
                />
                Required
              </label>

              <label className="flex items-center gap-2 text-sm text-neutral-300">
                <input
                  type="checkbox"
                  checked={requirement.is_critical}
                  onChange={(event) =>
                    setEquipmentRequirements(
                      updateArrayItem(value.equipmentRequirements, requirementIndex, {
                        ...requirement,
                        is_critical: event.target.checked,
                      }),
                    )
                  }
                  disabled={!canEdit}
                  className="h-4 w-4 rounded border border-white/20 bg-neutral-950 accent-red-600 disabled:cursor-not-allowed"
                />
                Critical
              </label>

              <label className="flex items-center gap-2 text-sm text-neutral-300">
                <input
                  type="checkbox"
                  checked={requirement.is_active}
                  onChange={(event) =>
                    setEquipmentRequirements(
                      updateArrayItem(value.equipmentRequirements, requirementIndex, {
                        ...requirement,
                        is_active: event.target.checked,
                      }),
                    )
                  }
                  disabled={!canEdit}
                  className="h-4 w-4 rounded border border-white/20 bg-neutral-950 accent-red-600 disabled:cursor-not-allowed"
                />
                Active
              </label>
            </div>
          ))}
        </div>

        {canEdit ? (
          <button
            type="button"
            onClick={() => setEquipmentRequirements([...value.equipmentRequirements, { ...EMPTY_EQUIPMENT_REQUIREMENT }])}
            className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
          >
            Add Required Equipment
          </button>
        ) : null}
      </section>

      <section className="space-y-3 rounded-xl border border-white/10 bg-[#111111] p-4">
        {renderSectionTitle(
          "Inspection Checklist Items",
          "Fields: section_name, item_label, is_required, is_active, display_order.",
        )}

        {value.inspectionChecklistItems.length === 0 ? (
          <p className="text-sm text-neutral-400">No checklist items added.</p>
        ) : null}

        <div className="space-y-4">
          {value.inspectionChecklistItems.map((item, itemIndex) => (
            <div key={item.id ?? itemIndex} className="grid gap-3 rounded-lg border border-white/10 bg-[#151515] p-4 md:grid-cols-2">
              <label className="text-sm text-neutral-300">
                Section Name
                <input
                  type="text"
                  value={item.section_name}
                  onChange={(event) =>
                    setChecklistItems(
                      updateArrayItem(value.inspectionChecklistItems, itemIndex, {
                        ...item,
                        section_name: event.target.value,
                      }),
                    )
                  }
                  disabled={!canEdit}
                  className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none transition focus:border-red-500/60 disabled:cursor-not-allowed disabled:opacity-70"
                />
              </label>

              <label className="text-sm text-neutral-300">
                Item Label
                <input
                  type="text"
                  value={item.item_label}
                  onChange={(event) =>
                    setChecklistItems(
                      updateArrayItem(value.inspectionChecklistItems, itemIndex, {
                        ...item,
                        item_label: event.target.value,
                      }),
                    )
                  }
                  disabled={!canEdit}
                  className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none transition focus:border-red-500/60 disabled:cursor-not-allowed disabled:opacity-70"
                />
              </label>

              <label className="text-sm text-neutral-300">
                Display Order
                <input
                  type="number"
                  value={item.display_order}
                  onChange={(event) =>
                    setChecklistItems(
                      updateArrayItem(value.inspectionChecklistItems, itemIndex, {
                        ...item,
                        display_order: event.target.value,
                      }),
                    )
                  }
                  disabled={!canEdit}
                  className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none transition focus:border-red-500/60 disabled:cursor-not-allowed disabled:opacity-70"
                />
              </label>

              <label className="flex items-center gap-2 text-sm text-neutral-300">
                <input
                  type="checkbox"
                  checked={item.is_required}
                  onChange={(event) =>
                    setChecklistItems(
                      updateArrayItem(value.inspectionChecklistItems, itemIndex, {
                        ...item,
                        is_required: event.target.checked,
                      }),
                    )
                  }
                  disabled={!canEdit}
                  className="h-4 w-4 rounded border border-white/20 bg-neutral-950 accent-red-600 disabled:cursor-not-allowed"
                />
                Required
              </label>

              <label className="flex items-center gap-2 text-sm text-neutral-300">
                <input
                  type="checkbox"
                  checked={item.is_active}
                  onChange={(event) =>
                    setChecklistItems(
                      updateArrayItem(value.inspectionChecklistItems, itemIndex, {
                        ...item,
                        is_active: event.target.checked,
                      }),
                    )
                  }
                  disabled={!canEdit}
                  className="h-4 w-4 rounded border border-white/20 bg-neutral-950 accent-red-600 disabled:cursor-not-allowed"
                />
                Active
              </label>
            </div>
          ))}
        </div>

        {canEdit ? (
          <button
            type="button"
            onClick={() => setChecklistItems([...value.inspectionChecklistItems, { ...EMPTY_CHECKLIST_ITEM }])}
            className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
          >
            Add Checklist Item
          </button>
        ) : null}
      </section>
    </div>
  );
}
