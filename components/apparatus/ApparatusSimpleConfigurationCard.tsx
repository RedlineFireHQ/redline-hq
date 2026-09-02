"use client";

import { useState } from "react";
import ApparatusSimpleConfigurationForm from "@/components/apparatus/ApparatusSimpleConfigurationForm";
import {
  createBlankApparatusConfiguration,
  type SimpleApparatusConfigurationDraft,
} from "@/lib/apparatus-configuration-simple";

type ApparatusSimpleConfigurationCardProps = {
  apparatusId: string;
  canEdit: boolean;
  departmentCheckDefaultIntervalDays?: number | null;
  initialConfiguration?: SimpleApparatusConfigurationDraft;
};

export default function ApparatusSimpleConfigurationCard({
  apparatusId,
  canEdit,
  departmentCheckDefaultIntervalDays,
  initialConfiguration,
}: ApparatusSimpleConfigurationCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<SimpleApparatusConfigurationDraft>(
    initialConfiguration ?? createBlankApparatusConfiguration(),
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/apparatus/${apparatusId}/configuration`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(draft),
      });

      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setErrorMessage(payload.error || "Unable to save apparatus configuration.");
        return;
      }

      setIsEditing(false);
      window.location.reload();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save apparatus configuration.");
    } finally {
      setIsSaving(false);
    }
  }

  function applyDepartmentDefaults() {
    if (typeof departmentCheckDefaultIntervalDays !== "number") {
      return;
    }

    const derivedFrequency =
      departmentCheckDefaultIntervalDays === 1
        ? "Daily"
        : departmentCheckDefaultIntervalDays === 2
          ? "Every 2 Days"
          : departmentCheckDefaultIntervalDays === 3
            ? "Every 3 Days"
            : departmentCheckDefaultIntervalDays === 7
              ? "Weekly"
              : departmentCheckDefaultIntervalDays === 14
                ? "Every 2 Weeks"
                : departmentCheckDefaultIntervalDays === 30
                  ? "Monthly"
                  : departmentCheckDefaultIntervalDays === 90
                    ? "Quarterly"
                    : "Custom";

    setDraft((current) => ({
      ...current,
      checkFrequency: derivedFrequency,
      customCheckFrequency:
        derivedFrequency === "Custom" ? `Every ${departmentCheckDefaultIntervalDays} days` : "",
    }));
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-[#242424] p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Apparatus Configuration</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Check frequency and maintenance items for this apparatus.
          </p>
        </div>

        {canEdit ? (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
          >
            Manage Configuration
          </button>
        ) : null}
      </div>

      {!isEditing ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-4 text-sm text-neutral-400">
          Open configuration to review or edit check frequency and maintenance tracking.
        </div>
      ) : null}

      {errorMessage ? (
        <p className="mt-4 rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {errorMessage}
        </p>
      ) : null}

      {isEditing ? (
        <div className="mt-4 space-y-4">
          <ApparatusSimpleConfigurationForm
            value={draft}
            onChange={setDraft}
            canEdit={canEdit}
            departmentCheckDefaultIntervalDays={departmentCheckDefaultIntervalDays}
            onApplyDepartmentDefaults={applyDepartmentDefaults}
          />

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              disabled={isSaving}
              className="rounded-lg border border-white/15 bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-lg border border-red-500/30 bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Save Configuration"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
