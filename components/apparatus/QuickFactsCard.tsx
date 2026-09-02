"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type QuickFactsFieldKey =
  | "type"
  | "year"
  | "make"
  | "model"
  | "vin"
  | "pump_capacity"
  | "water_tank_capacity"
  | "mileage"
  | "engine_hours";

type QuickFactsValues = {
  type: string | null;
  check_frequency: string | null;
  year: number | string | null;
  make: string | null;
  model: string | null;
  vin: string | null;
  pump_capacity: number | string | null;
  water_tank_capacity: number | string | null;
  mileage: number | string | null;
  engine_hours: number | string | null;
};

type QuickFactsCardProps = {
  apparatusId: string;
  statusLabel: string;
  departmentLabel: string;
  lastInspectionLabel: string;
  initialValues: QuickFactsValues;
};

const FIELD_CONFIG: Array<{ key: QuickFactsFieldKey; label: string }> = [
  { key: "type", label: "Type" },
  { key: "year", label: "Year" },
  { key: "make", label: "Make" },
  { key: "model", label: "Model" },
  { key: "vin", label: "VIN" },
  { key: "pump_capacity", label: "Pump Capacity (GPM)" },
  { key: "water_tank_capacity", label: "Water Tank Capacity (Gallons)" },
  { key: "mileage", label: "Mileage" },
  { key: "engine_hours", label: "Engine Hours" },
];

function normalizeCheckFrequencyValue(value: string | number | null | undefined): string {
  const candidate = value === null || value === undefined ? "" : String(value).trim();

  if (!candidate) {
    return "";
  }

  const normalized = candidate.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();

  if (["daily", "every day", "everyday"].includes(normalized)) {
    return "Daily";
  }

  if (["every 2 days", "every two days", "2 days", "2-day", "two days"].includes(normalized)) {
    return "Every 2 Days";
  }

  if (["every 3 days", "every three days", "3 days", "3-day", "three days"].includes(normalized)) {
    return "Every 3 Days";
  }

  if (["weekly", "once weekly"].includes(normalized)) {
    return "Weekly";
  }

  if (["every 2 weeks", "every two weeks", "2 weeks", "biweekly", "two weeks"].includes(normalized)) {
    return "Every 2 Weeks";
  }

  if (["monthly"].includes(normalized)) {
    return "Monthly";
  }

  if (["quarterly"].includes(normalized)) {
    return "Quarterly";
  }

  if (["custom"].includes(normalized)) {
    return "Custom";
  }

  return candidate;
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "Not Set";
  }

  if (typeof value === "string" && value.trim().toLowerCase() === "check_frequency") {
    return "Not Set";
  }

  const rendered = typeof value === "string" ? normalizeCheckFrequencyValue(value) : String(value);
  return rendered || "Not Set";
}

function normalizeStringValue(value: string | number | null | undefined): string | null {
  const candidate = value === null || value === undefined ? "" : String(value).trim();
  return candidate ? candidate : null;
}

function normalizeNumberValue(value: string | number | null | undefined): number | null {
  const candidate = value === null || value === undefined ? "" : String(value).trim();
  if (!candidate) {
    return null;
  }

  const parsed = Number(candidate);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function QuickFactsCard({
  apparatusId,
  statusLabel,
  departmentLabel,
  lastInspectionLabel,
  initialValues,
}: QuickFactsCardProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [values, setValues] = useState<QuickFactsValues>(initialValues);
  const [draft, setDraft] = useState<QuickFactsValues>(initialValues);

  useEffect(() => {
    const handleOpen = () => {
      setErrorMessage(null);
      setDraft(values);
      setIsEditing(true);
    };

    window.addEventListener("redline:open-apparatus-edit", handleOpen);
    return () => {
      window.removeEventListener("redline:open-apparatus-edit", handleOpen);
    };
  }, [values]);

  const readOnlyFacts = useMemo(
    () => [
      { label: "Status", value: statusLabel },
      { label: "Department", value: departmentLabel },
      { label: "Last Inspection", value: lastInspectionLabel },
      { label: "Check Frequency", value: displayValue(values.check_frequency) },
    ],
    [statusLabel, departmentLabel, lastInspectionLabel, values.check_frequency],
  );

  function handleCancelEdit() {
    setErrorMessage(null);
    setDraft(values);
    setIsEditing(false);
  }

  async function handleSave() {
    setIsSaving(true);
    setErrorMessage(null);

    const payload: Record<string, string | number | null> = {
      type: normalizeStringValue(draft.type),
      year: draft.year === null || draft.year === undefined || draft.year === "" ? null : Number(draft.year),
      make: normalizeStringValue(draft.make),
      model: normalizeStringValue(draft.model),
      vin: normalizeStringValue(draft.vin),
      pump_capacity: normalizeNumberValue(draft.pump_capacity),
      water_tank_capacity: normalizeNumberValue(draft.water_tank_capacity),
      mileage: normalizeNumberValue(draft.mileage),
      engine_hours: normalizeNumberValue(draft.engine_hours),
    };

    try {
      const response = await fetch(`/api/apparatus/${apparatusId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      let errorDetail = "Unable to update quick facts.";
      let parsedBody: { ok?: boolean; error?: string; message?: string } | null = null;

      try {
        const rawText = await response.text();
        if (rawText) {
          try {
            parsedBody = JSON.parse(rawText) as { ok?: boolean; error?: string; message?: string };
          } catch {
            errorDetail = rawText.trim() || `HTTP ${response.status}: Unable to update quick facts.`;
          }
        }
      } catch {
        errorDetail = `HTTP ${response.status}: Unable to update quick facts.`;
      }

      if (!response.ok || !parsedBody?.ok) {
        const serverError = parsedBody?.error || parsedBody?.message || errorDetail;
        setErrorMessage(`Save failed (HTTP ${response.status}): ${serverError}`);
        setIsSaving(false);
        return;
      }

      setValues(draft);
      setIsEditing(false);
      setIsSaving(false);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update quick facts.";
      setErrorMessage(`Save failed: ${message}`);
      setIsSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-white">Quick Facts</h2>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {readOnlyFacts.map((fact) => (
          <div key={fact.label} className="rounded-xl border border-white/10 bg-[#242424] p-4">
            <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">{fact.label}</p>
            <p className="mt-2 text-lg font-semibold text-white">{fact.value}</p>
          </div>
        ))}

        {FIELD_CONFIG.map((field) => (
          <div key={field.key} className="rounded-xl border border-white/10 bg-[#242424] p-4">
            <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">{field.label}</p>
            <p className="mt-2 text-lg font-semibold text-white">{displayValue(values[field.key])}</p>
          </div>
        ))}
      </div>

      {isEditing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-8">
          <div className="max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-red-900 bg-[#242424] shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div>
                <h3 className="text-xl font-bold text-white">Edit Quick Facts</h3>
                <p className="mt-1 text-sm text-neutral-400">Update the apparatus details stored on this record.</p>
              </div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
              <div className="grid gap-4 md:grid-cols-2">
                {FIELD_CONFIG.map((field) => {
                  return (
                    <label key={field.key} className="rounded-xl border border-white/10 bg-[#1b1b1b] p-4 text-sm text-neutral-300">
                      <span className="text-xs uppercase tracking-[0.2em] text-neutral-500">{field.label}</span>
                      <input
                        type={
                          field.key === "year" ||
                          field.key === "pump_capacity" ||
                          field.key === "water_tank_capacity" ||
                          field.key === "mileage" ||
                          field.key === "engine_hours"
                            ? "number"
                            : "text"
                        }
                        value={draft[field.key] ?? ""}
                        step={field.key === "pump_capacity" || field.key === "water_tank_capacity" || field.key === "engine_hours" || field.key === "mileage" ? "any" : undefined}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            [field.key]: event.target.value,
                          }))
                        }
                        className="mt-2 w-full rounded-lg border border-white/10 bg-[#111111] px-3 py-2 text-sm text-white outline-none transition focus:border-red-500/50"
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            {errorMessage ? (
              <div className="border-t border-red-500/30 bg-red-950/30 px-6 py-3 text-sm text-red-100">
                {errorMessage}
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-3 border-t border-white/10 px-6 py-4">
              <button
                type="button"
                onClick={handleCancelEdit}
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
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
