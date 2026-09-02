"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ApparatusSimpleConfigurationForm from "@/components/apparatus/ApparatusSimpleConfigurationForm";
import {
  createBlankApparatusConfiguration,
  type SimpleApparatusConfigurationDraft,
} from "@/lib/apparatus-configuration-simple";

type AddApparatusButtonProps = {
  canAdd: boolean;
  departmentCheckDefaultIntervalDays?: number | null;
};

type AddApparatusFormState = {
  name: string;
  type: string;
  year: string;
  make: string;
  model: string;
  vin: string;
  pumpCapacity: string;
  waterTankCapacity: string;
  mileage: string;
  engineHours: string;
};

const initialFormState: AddApparatusFormState = {
  name: "",
  type: "",
  year: "",
  make: "",
  model: "",
  vin: "",
  pumpCapacity: "",
  waterTankCapacity: "",
  mileage: "",
  engineHours: "",
};

export default function AddApparatusButton({
  canAdd,
  departmentCheckDefaultIntervalDays,
}: AddApparatusButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formState, setFormState] = useState<AddApparatusFormState>(initialFormState);
  const [configuration, setConfiguration] = useState<SimpleApparatusConfigurationDraft>(
    createBlankApparatusConfiguration(),
  );

  function closeModal() {
    setIsOpen(false);
    setIsSaving(false);
    setErrorMessage(null);
    setFormState(initialFormState);
    setConfiguration(createBlankApparatusConfiguration());
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSaving(true);

    try {
      const response = await fetch("/api/apparatus", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: formState.name,
          type: formState.type,
          year: formState.year,
          make: formState.make,
          model: formState.model,
          vin: formState.vin,
          pumpCapacity: formState.pumpCapacity,
          waterTankCapacity: formState.waterTankCapacity,
          mileage: formState.mileage,
          engineHours: formState.engineHours,
          configuration,
        }),
      });

      const payload = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !payload.ok) {
        setErrorMessage(payload.error || "Unable to create apparatus.");
        return;
      }

      closeModal();
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create apparatus.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!canAdd) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center justify-center rounded-xl border border-red-500/40 bg-gradient-to-b from-[#ff3b3b] to-[#b90d0d] px-4 py-2 text-sm font-semibold text-white shadow-[0_0_18px_rgba(239,43,45,.30)] transition hover:shadow-[0_0_26px_rgba(239,43,45,.45)]"
      >
        + Add Apparatus
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-neutral-700 bg-[#111111] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
            <div className="mb-5">
              <h2 className="text-2xl font-bold text-white">Add Apparatus</h2>
              <p className="mt-1 text-sm text-neutral-400">
                Create a new apparatus record for this department.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm text-neutral-300">
                  Name
                  <input
                    value={formState.name}
                    onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none transition focus:border-red-500/60"
                    placeholder="Engine 430"
                    required
                  />
                </label>

                <label className="text-sm text-neutral-300">
                  Type
                  <input
                    value={formState.type}
                    onChange={(event) => setFormState((current) => ({ ...current, type: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none transition focus:border-red-500/60"
                    placeholder="Engine"
                  />
                </label>

                <label className="text-sm text-neutral-300">
                  Year
                  <input
                    type="number"
                    min="1900"
                    max="2100"
                    value={formState.year}
                    onChange={(event) => setFormState((current) => ({ ...current, year: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none transition focus:border-red-500/60"
                  />
                </label>

                <label className="text-sm text-neutral-300">
                  Make
                  <input
                    value={formState.make}
                    onChange={(event) => setFormState((current) => ({ ...current, make: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none transition focus:border-red-500/60"
                  />
                </label>

                <label className="text-sm text-neutral-300">
                  Model
                  <input
                    value={formState.model}
                    onChange={(event) => setFormState((current) => ({ ...current, model: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none transition focus:border-red-500/60"
                  />
                </label>

                <label className="text-sm text-neutral-300">
                  VIN
                  <input
                    value={formState.vin}
                    onChange={(event) => setFormState((current) => ({ ...current, vin: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none transition focus:border-red-500/60"
                  />
                </label>

                <label className="text-sm text-neutral-300">
                  Pump Capacity (GPM)
                  <input
                    type="number"
                    value={formState.pumpCapacity}
                    onChange={(event) => setFormState((current) => ({ ...current, pumpCapacity: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none transition focus:border-red-500/60"
                  />
                </label>

                <label className="text-sm text-neutral-300">
                  Water Tank Capacity (Gallons)
                  <input
                    type="number"
                    value={formState.waterTankCapacity}
                    onChange={(event) => setFormState((current) => ({ ...current, waterTankCapacity: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none transition focus:border-red-500/60"
                  />
                </label>

                <label className="text-sm text-neutral-300">
                  Mileage
                  <input
                    type="number"
                    value={formState.mileage}
                    onChange={(event) => setFormState((current) => ({ ...current, mileage: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none transition focus:border-red-500/60"
                  />
                </label>

                <label className="text-sm text-neutral-300">
                  Engine Hours
                  <input
                    type="number"
                    step="0.1"
                    value={formState.engineHours}
                    onChange={(event) => setFormState((current) => ({ ...current, engineHours: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none transition focus:border-red-500/60"
                  />
                </label>

              </div>

              <ApparatusSimpleConfigurationForm
                value={configuration}
                onChange={setConfiguration}
                canEdit={true}
                departmentCheckDefaultIntervalDays={departmentCheckDefaultIntervalDays}
                onApplyDepartmentDefaults={() => {
                  if (departmentCheckDefaultIntervalDays === null || departmentCheckDefaultIntervalDays === undefined) {
                    return;
                  }

                  const nextFrequency =
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

                  setConfiguration((current) => ({
                    ...current,
                    checkFrequency: nextFrequency,
                    customCheckFrequency:
                      nextFrequency === "Custom"
                        ? `Every ${departmentCheckDefaultIntervalDays} days`
                        : "",
                  }));
                }}
              />

              {errorMessage ? (
                <p className="rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2 text-sm text-red-200">
                  {errorMessage}
                </p>
              ) : null}

              <div className="flex items-center justify-end gap-3 border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-white/15 bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-lg border border-red-500/30 bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? "Creating..." : "Create Apparatus"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
