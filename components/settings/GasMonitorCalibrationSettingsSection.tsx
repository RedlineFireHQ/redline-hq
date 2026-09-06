"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

type GasMonitorCalibrationSettingsSectionProps = {
  departmentId: string;
  currentMemberId: string;
  initialCalibrationIntervalMonths: number;
};

export default function GasMonitorCalibrationSettingsSection({
  departmentId,
  initialCalibrationIntervalMonths,
}: GasMonitorCalibrationSettingsSectionProps) {
  const [calibrationIntervalMonths, setCalibrationIntervalMonths] = useState<number>(
    Number.isFinite(initialCalibrationIntervalMonths) && initialCalibrationIntervalMonths > 0
      ? initialCalibrationIntervalMonths
      : 6,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleSave() {
    const parsedValue = Number(calibrationIntervalMonths);

    if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
      setErrorMessage("Calibration interval must be a positive whole number of months.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const payload = {
      department_id: departmentId,
      calibration_interval_months: parsedValue,
    };

    const { error } = await supabase
      .from("gas_monitor_calibration_settings")
      .upsert(payload, { onConflict: "department_id" });

    if (error) {
      setErrorMessage(error.message || "Unable to save gas monitor calibration interval.");
      setIsSaving(false);
      return;
    }

    setSuccessMessage(`Gas monitor calibration interval saved: ${parsedValue} month${parsedValue === 1 ? "" : "s"}.`);
    setIsSaving(false);
  }

  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
      <div>
        <h2 className="text-2xl font-semibold text-white">Gas Monitor Calibration</h2>
        <p className="mt-2 text-sm text-neutral-400">
          Set how often gas monitors must be calibrated.
        </p>
      </div>

      <div className="mt-5 rounded-xl border border-white/10 bg-[#111111] p-4">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-white">Gas Monitor Calibration Interval</span>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1}
              step={1}
              value={calibrationIntervalMonths}
              onChange={(event) => {
                const nextValue = event.target.value;
                if (nextValue === "") {
                  setCalibrationIntervalMonths(1);
                  return;
                }

                const parsed = Number(nextValue);
                setCalibrationIntervalMonths(Number.isFinite(parsed) ? parsed : 1);
              }}
              className="w-32 rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
            />
            <span className="text-sm text-neutral-400">months</span>
          </div>
          <p className="mt-2 text-xs text-neutral-500">Enter a positive whole number of months, such as 1, 3, 6, or 12.</p>
        </label>
      </div>

      {errorMessage ? (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {successMessage}
        </div>
      ) : null}

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          disabled={isSaving}
          onClick={() => {
            void handleSave();
          }}
          className="rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-100 transition hover:border-red-400 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.04] disabled:text-neutral-400"
        >
          {isSaving ? "Saving..." : "Save Gas Monitor Calibration Settings"}
        </button>
      </div>
    </section>
  );
}
