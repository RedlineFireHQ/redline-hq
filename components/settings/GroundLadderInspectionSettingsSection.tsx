"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

type GroundLadderInspectionSettingsSectionProps = {
  departmentId: string;
  currentMemberId: string;
  initialRequireChecklist: boolean;
};

export default function GroundLadderInspectionSettingsSection({
  departmentId,
  currentMemberId,
  initialRequireChecklist,
}: GroundLadderInspectionSettingsSectionProps) {
  const [requireChecklist, setRequireChecklist] = useState(initialRequireChecklist);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleSave() {
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const payload = {
      department_id: departmentId,
      require_checklist: requireChecklist,
      updated_by: currentMemberId,
      created_by: currentMemberId,
    };

    try {
      const { error } = await supabase
        .from("ground_ladder_inspection_settings")
        .upsert(payload, { onConflict: "department_id" });

      if (error) {
        setErrorMessage(error.message || "Unable to save ground ladder inspection settings.");
        return;
      }

      setSuccessMessage("Ground ladder inspection settings saved.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save ground ladder inspection settings.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
      <div>
        <h2 className="text-2xl font-semibold text-white">Ground Ladder Inspection Settings</h2>
        <p className="mt-2 text-sm text-neutral-400">
          Configure whether firefighters must complete checklist items before final ground ladder inspection submission.
        </p>
      </div>

      <div className="mt-5 rounded-xl border border-white/10 bg-[#111111] p-4">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={requireChecklist}
            onChange={(event) => setRequireChecklist(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border border-white/20 bg-[#0f0f0f] accent-red-600"
          />
          <span>
            <span className="block text-sm font-semibold text-white">Require Ground Ladder Inspection Checklist</span>
            <span className="mt-1 block text-xs text-neutral-400">
              ON: Firefighters must complete all required checklist items before they can submit the overall ladder inspection result.
              OFF: Checklist remains available but optional.
            </span>
          </span>
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
          {isSaving ? "Saving..." : "Save Ground Ladder Inspection Settings"}
        </button>
      </div>
    </section>
  );
}
