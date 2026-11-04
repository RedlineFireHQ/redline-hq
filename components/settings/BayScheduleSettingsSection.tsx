"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  WEEKDAY_NAMES,
  bayScheduleLabel,
  isValidCheckWeekday,
  type BayScheduleSummary,
} from "@/lib/apparatus-bay-schedules";

export type BayScheduleRow = BayScheduleSummary & {
  isActive: boolean;
};

type BayScheduleSettingsSectionProps = {
  departmentId: string;
  currentMemberId: string;
  initialBaySchedules: BayScheduleRow[];
};

export default function BayScheduleSettingsSection({
  departmentId,
  currentMemberId,
  initialBaySchedules,
}: BayScheduleSettingsSectionProps) {
  const router = useRouter();
  const [baySchedules, setBaySchedules] = useState<BayScheduleRow[]>(initialBaySchedules);
  const [newBayLabel, setNewBayLabel] = useState("");
  const [newBayWeekday, setNewBayWeekday] = useState<string>("1");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleAddBay() {
    setErrorMessage(null);
    setSuccessMessage(null);

    const bayLabel = newBayLabel.trim();
    const checkWeekday = Number(newBayWeekday);

    if (!bayLabel) {
      setErrorMessage("Enter a bay label before adding it.");
      return;
    }

    if (!isValidCheckWeekday(checkWeekday)) {
      setErrorMessage("Choose a valid check weekday.");
      return;
    }

    setIsSaving(true);

    const { data, error } = await supabase
      .from("department_bay_schedules")
      .insert({
        department_id: departmentId,
        bay_label: bayLabel,
        check_weekday: checkWeekday,
        is_active: true,
        created_by: currentMemberId,
        updated_by: currentMemberId,
      })
      .select("id, bay_label, check_weekday, is_active")
      .single();

    setIsSaving(false);

    if (error || !data) {
      setErrorMessage(error?.message || "Unable to add bay schedule.");
      return;
    }

    const inserted = data as { id: string; bay_label: string; check_weekday: number; is_active: boolean };
    setBaySchedules((current) =>
      [...current, { id: inserted.id, bayLabel: inserted.bay_label, checkWeekday: inserted.check_weekday, isActive: inserted.is_active }]
        .sort((left, right) => left.bayLabel.localeCompare(right.bayLabel)),
    );
    setNewBayLabel("");
    setSuccessMessage("Bay schedule added.");
    router.refresh();
  }

  async function handleUpdateBay(bayId: string, updates: { check_weekday?: number; is_active?: boolean }) {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSaving(true);

    const { error } = await supabase
      .from("department_bay_schedules")
      .update({ ...updates, updated_by: currentMemberId })
      .eq("id", bayId)
      .eq("department_id", departmentId);

    setIsSaving(false);

    if (error) {
      setErrorMessage(error.message || "Unable to update bay schedule.");
      return;
    }

    setBaySchedules((current) =>
      current.map((bay) =>
        bay.id === bayId
          ? {
              ...bay,
              checkWeekday: typeof updates.check_weekday === "number" ? updates.check_weekday : bay.checkWeekday,
              isActive: typeof updates.is_active === "boolean" ? updates.is_active : bay.isActive,
            }
          : bay,
      ),
    );
    setSuccessMessage("Bay schedule updated.");
    router.refresh();
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-[#242424] p-6">
      <div>
        <h2 className="text-lg font-bold text-white">Apparatus Bay Schedules</h2>
        <p className="mt-1 text-sm text-neutral-400">
          Map each bay to its recurring scheduled check weekday. Apparatus assigned to a bay are due on that weekday each week.
        </p>
      </div>

      {errorMessage ? (
        <p className="mt-4 rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {errorMessage}
        </p>
      ) : null}

      {successMessage ? (
        <p className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-3 py-2 text-sm text-emerald-200">
          {successMessage}
        </p>
      ) : null}

      <div className="mt-5 space-y-3">
        {baySchedules.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-4 text-sm text-neutral-400">
            No bay schedules configured. Apparatus continue to use interval-based check scheduling until bays are added and assigned.
          </p>
        ) : (
          baySchedules.map((bay) => (
            <div
              key={bay.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-white">{bayScheduleLabel(bay)}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-neutral-500">
                  {bay.isActive ? "Active" : "Inactive"}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={String(bay.checkWeekday)}
                  onChange={(event) => handleUpdateBay(bay.id, { check_weekday: Number(event.target.value) })}
                  disabled={isSaving}
                  className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white outline-none transition focus:border-red-500/60 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {WEEKDAY_NAMES.map((name, index) => (
                    <option key={name} value={String(index)}>
                      {name}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => handleUpdateBay(bay.id, { is_active: !bay.isActive })}
                  disabled={isSaving}
                  className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {bay.isActive ? "Deactivate" : "Reactivate"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-end gap-3 rounded-xl border border-white/10 bg-[#111111] p-4">
        <label className="text-sm text-neutral-300">
          Bay Label
          <input
            type="text"
            value={newBayLabel}
            onChange={(event) => setNewBayLabel(event.target.value)}
            placeholder="Example: Bay 1"
            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none transition focus:border-red-500/60"
          />
        </label>

        <label className="text-sm text-neutral-300">
          Scheduled Check Day
          <select
            value={newBayWeekday}
            onChange={(event) => setNewBayWeekday(event.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none transition focus:border-red-500/60"
          >
            {WEEKDAY_NAMES.map((name, index) => (
              <option key={name} value={String(index)}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={handleAddBay}
          disabled={isSaving}
          className="rounded-lg border border-red-500/30 bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Saving..." : "Add Bay"}
        </button>
      </div>
    </section>
  );
}
