"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { bayScheduleLabel, type BayScheduleSummary } from "@/lib/apparatus-bay-schedules";
import {
  CHECK_FREQUENCY_OPTIONS,
  MAINTENANCE_INTERVAL_UNIT_OPTIONS,
  MAINTENANCE_ITEM_OPTIONS,
  type CheckFrequencyOption,
  type MaintenanceIntervalUnitOption,
  type MaintenanceItemOption,
  type SimpleApparatusConfigurationDraft,
  type SimpleMaintenanceRequirementDraft,
} from "@/lib/apparatus-configuration-simple";

const EMPTY_MAINTENANCE_REQUIREMENT: SimpleMaintenanceRequirementDraft = {
  itemName: "Oil Change",
  customItemName: "",
  intervalAmount: "",
  intervalUnit: "Months",
};

type ApparatusSimpleConfigurationFormProps = {
  value: SimpleApparatusConfigurationDraft;
  onChange: (nextValue: SimpleApparatusConfigurationDraft) => void;
  canEdit: boolean;
  departmentId: string | null;
  departmentCheckDefaultIntervalDays?: number | null;
  onApplyDepartmentDefaults?: () => void;
};

function updateMaintenanceRequirement(
  currentRequirements: SimpleMaintenanceRequirementDraft[],
  index: number,
  nextRequirement: SimpleMaintenanceRequirementDraft,
) {
  return currentRequirements.map((requirement, requirementIndex) =>
    requirementIndex === index ? nextRequirement : requirement,
  );
}

function renderFieldLabel(title: string, description?: string) {
  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-red-300">{title}</h3>
      {description ? <p className="text-sm text-neutral-400">{description}</p> : null}
    </div>
  );
}

export default function ApparatusSimpleConfigurationForm({
  value,
  onChange,
  canEdit,
  departmentId,
  departmentCheckDefaultIntervalDays,
  onApplyDepartmentDefaults,
}: ApparatusSimpleConfigurationFormProps) {
  const canUseDepartmentDefaults =
    typeof departmentCheckDefaultIntervalDays === "number" && Number.isFinite(departmentCheckDefaultIntervalDays);

  // Bay options are scoped to the member's department by row-level security.
  const [bayOptions, setBayOptions] = useState<BayScheduleSummary[]>([]);
  const [bayError, setBayError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadBayOptions() {
      if (!departmentId) {
        setBayError("An authenticated department is required to load bay schedules.");
        return;
      }
      const { data, error } = await supabase
        .from("department_bay_schedules")
        .select("id, bay_label, check_weekday")
        .eq("department_id", departmentId)
        .eq("is_active", true)
        .order("bay_label", { ascending: true });

      if (!isMounted) {
        return;
      }
      if (error) {
        setBayError(error.message || "Unable to load bay schedules.");
        return;
      }
      setBayError(null);

      setBayOptions(
        ((data ?? []) as Array<{ id: string; bay_label: string | null; check_weekday: number | null }>)
          .filter((row) => typeof row.id === "string" && typeof row.bay_label === "string" && typeof row.check_weekday === "number")
          .map((row) => ({ id: row.id, bayLabel: row.bay_label as string, checkWeekday: row.check_weekday as number })),
      );
    }

    loadBayOptions();

    return () => {
      isMounted = false;
    };
  }, [departmentId]);

  function setCheckFrequency(checkFrequency: CheckFrequencyOption | "") {
    onChange({
      ...value,
      checkFrequency,
      customCheckFrequency:
        checkFrequency === "Custom" ? value.customCheckFrequency : "",
    });
  }

  function addMaintenanceRequirement() {
    onChange({
      ...value,
      maintenanceRequirements: [...value.maintenanceRequirements, { ...EMPTY_MAINTENANCE_REQUIREMENT }],
    });
  }

  return (
    <div className="space-y-6 rounded-2xl border border-white/10 bg-[#1b1b1b] p-5">
      <div className="flex items-center justify-between gap-3">
        {renderFieldLabel(
          "Apparatus Configuration",
          "Use plain-language settings the department can understand. The system translates them behind the scenes.",
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

      <section className="space-y-3 rounded-xl border border-white/10 bg-[#111111] p-4">
        {renderFieldLabel("Check Frequency", "When should the apparatus check come due?")}

        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm text-neutral-300 md:col-span-2">
            Frequency
            <select
              value={value.checkFrequency}
              onChange={(event) => setCheckFrequency(event.target.value as CheckFrequencyOption | "")}
              disabled={!canEdit}
              required={canEdit && !value.bayScheduleId}
              className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none transition focus:border-red-500/60 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <option value="">Select a frequency or use an assigned bay</option>
              {CHECK_FREQUENCY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          {value.checkFrequency === "Custom" ? (
            <label className="text-sm text-neutral-300 md:col-span-2">
              Custom Frequency
              <input
                type="text"
                value={value.customCheckFrequency}
                onChange={(event) =>
                  onChange({
                    ...value,
                    customCheckFrequency: event.target.value,
                  })
                }
                disabled={!canEdit}
                required={canEdit}
                className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none transition focus:border-red-500/60 disabled:cursor-not-allowed disabled:opacity-70"
                placeholder="Example: Every 10 days"
              />
            </label>
          ) : null}
        </div>

        {canUseDepartmentDefaults && typeof departmentCheckDefaultIntervalDays === "number" ? (
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
            Department default available
          </p>
        ) : null}
      </section>

      {bayError ? <p role="alert" className="text-sm text-red-200">{bayError}</p> : null}
      {bayOptions.length > 0 || value.bayScheduleId ? (
        <section className="space-y-3 rounded-xl border border-white/10 bg-[#111111] p-4">
          {renderFieldLabel(
            "Bay Assignment",
            "Assigning a bay anchors this apparatus's scheduled check to the bay's weekday instead of the interval since its last check.",
          )}
          <select
            aria-label="Bay assignment"
            value={value.bayScheduleId ?? ""}
            onChange={(event) =>
              onChange({
                ...value,
                bayScheduleId: event.target.value || null,
              })
            }
            disabled={!canEdit}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none transition focus:border-red-500/60 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {value.bayScheduleId && !bayOptions.some((bay) => bay.id === value.bayScheduleId) ? (
              <option value={value.bayScheduleId}>Current bay unavailable - choose an active bay before saving</option>
            ) : null}
            <option value="">No bay assignment (use check frequency)</option>
            {bayOptions.map((bay) => (
              <option key={bay.id} value={bay.id}>
                {bayScheduleLabel(bay)}
              </option>
            ))}
          </select>
        </section>
      ) : null}

      <section className="space-y-3 rounded-xl border border-white/10 bg-[#111111] p-4">
        {renderFieldLabel(
          "Checklist Requirement",
          "Choose whether this apparatus follows the department default or uses its own requirement.",
        )}
        <select
          value={value.checklistRequiredOverride === null ? "default" : value.checklistRequiredOverride ? "required" : "not-required"}
          onChange={(event) =>
            onChange({
              ...value,
              checklistRequiredOverride:
                event.target.value === "default" ? null : event.target.value === "required",
            })
          }
          disabled={!canEdit}
          className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none transition focus:border-red-500/60 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <option value="default">Use Department Default</option>
          <option value="required">Require Checklist</option>
          <option value="not-required">Do Not Require Checklist</option>
        </select>
      </section>

      <section className="space-y-4 rounded-xl border border-white/10 bg-[#111111] p-4">
        {renderFieldLabel(
          "Maintenance",
          "Add only the maintenance items this apparatus should track. Each item can use months, miles, or engine hours.",
        )}

        {value.maintenanceRequirements.length === 0 ? (
          <p className="text-sm text-neutral-400">No maintenance items added.</p>
        ) : null}

        <div className="space-y-4">
          {value.maintenanceRequirements.map((requirement, requirementIndex) => {
            const isOther = requirement.itemName.trim().toLowerCase() === "other";

            return (
              <div key={requirement.id ?? requirementIndex} className="rounded-xl border border-white/10 bg-[#151515] p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="text-sm text-neutral-300">
                    Maintenance Item
                    <select
                      value={requirement.itemName}
                      onChange={(event) =>
                        onChange({
                          ...value,
                          maintenanceRequirements: updateMaintenanceRequirement(
                            value.maintenanceRequirements,
                            requirementIndex,
                            {
                              ...requirement,
                              itemName: event.target.value as MaintenanceItemOption,
                              customItemName: event.target.value === "Other" ? requirement.customItemName : "",
                            },
                          ),
                        })
                      }
                      disabled={!canEdit}
                      className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none transition focus:border-red-500/60 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {MAINTENANCE_ITEM_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  {isOther ? (
                    <label className="text-sm text-neutral-300">
                      Custom Item Name
                      <input
                        type="text"
                        value={requirement.customItemName}
                        onChange={(event) =>
                          onChange({
                            ...value,
                            maintenanceRequirements: updateMaintenanceRequirement(
                              value.maintenanceRequirements,
                              requirementIndex,
                              {
                                ...requirement,
                                customItemName: event.target.value,
                              },
                            ),
                          })
                        }
                        disabled={!canEdit}
                        className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none transition focus:border-red-500/60 disabled:cursor-not-allowed disabled:opacity-70"
                        placeholder="Describe the maintenance item"
                      />
                    </label>
                  ) : null}

                  <label className="text-sm text-neutral-300">
                    Every
                    <input
                      type="number"
                      min="1"
                      value={requirement.intervalAmount}
                      onChange={(event) =>
                        onChange({
                          ...value,
                          maintenanceRequirements: updateMaintenanceRequirement(
                            value.maintenanceRequirements,
                            requirementIndex,
                            {
                              ...requirement,
                              intervalAmount: event.target.value,
                            },
                          ),
                        })
                      }
                      disabled={!canEdit}
                      className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none transition focus:border-red-500/60 disabled:cursor-not-allowed disabled:opacity-70"
                    />
                  </label>

                  <label className="text-sm text-neutral-300">
                    Unit
                    <select
                      value={requirement.intervalUnit}
                      onChange={(event) =>
                        onChange({
                          ...value,
                          maintenanceRequirements: updateMaintenanceRequirement(
                            value.maintenanceRequirements,
                            requirementIndex,
                            {
                              ...requirement,
                              intervalUnit: event.target.value as MaintenanceIntervalUnitOption,
                            },
                          ),
                        })
                      }
                      disabled={!canEdit}
                      className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none transition focus:border-red-500/60 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <option value="">Select unit</option>
                      {MAINTENANCE_INTERVAL_UNIT_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

              </div>
            );
          })}
        </div>

        {canEdit ? (
          <button
            type="button"
            onClick={addMaintenanceRequirement}
            className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
          >
            + Add Maintenance
          </button>
        ) : null}
      </section>
    </div>
  );
}
