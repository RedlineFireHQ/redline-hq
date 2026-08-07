"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type ServiceSpecifications = {
  oil_type: string | null;
  oil_capacity: string | null;
  oil_filter_part_number: string | null;
  fuel_filter_part_number: string | null;
  air_filter_part_number: string | null;
  hydraulic_fluid: string | null;
  transmission_fluid: string | null;
  coolant_type: string | null;
  pump_oil: string | null;
  generator_oil: string | null;
  belt_numbers: string | null;
  battery_type: string | null;
  tire_size: string | null;
  other_common_parts: string | null;
};

type ServiceSpecificationsCardProps = {
  apparatusId: string;
  initialSpecifications: ServiceSpecifications;
  canEdit: boolean;
};

type SpecField = {
  key: keyof ServiceSpecifications;
  label: string;
};

const specFields: SpecField[] = [
  { key: "oil_type", label: "Oil Type" },
  { key: "oil_capacity", label: "Oil Capacity" },
  { key: "oil_filter_part_number", label: "Oil Filter Part Number" },
  { key: "fuel_filter_part_number", label: "Fuel Filter Part Number" },
  { key: "air_filter_part_number", label: "Air Filter Part Number" },
  { key: "hydraulic_fluid", label: "Hydraulic Fluid" },
  { key: "transmission_fluid", label: "Transmission Fluid" },
  { key: "coolant_type", label: "Coolant Type" },
  { key: "pump_oil", label: "Pump Oil" },
  { key: "generator_oil", label: "Generator Oil" },
  { key: "belt_numbers", label: "Belt Part Numbers" },
  { key: "battery_type", label: "Battery Type" },
  { key: "tire_size", label: "Tire Size" },
  { key: "other_common_parts", label: "Other Common Replacement Parts" },
];

function normalizeInputValue(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export default function ServiceSpecificationsCard({
  apparatusId,
  initialSpecifications,
  canEdit,
}: ServiceSpecificationsCardProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [specifications, setSpecifications] = useState<ServiceSpecifications>(initialSpecifications);
  const [draftSpecifications, setDraftSpecifications] = useState<ServiceSpecifications>(initialSpecifications);

  const hasAnySpecification = useMemo(() => {
    return Object.values(specifications).some((value) => Boolean(value && value.trim()));
  }, [specifications]);

  function handleStartEdit() {
    setErrorMessage(null);
    setSuccessMessage(null);
    setDraftSpecifications(specifications);
    setIsEditing(true);
  }

  function handleCancelEdit() {
    setErrorMessage(null);
    setDraftSpecifications(specifications);
    setIsEditing(false);
  }

  async function handleSave() {
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const payload = specFields.reduce<Record<string, string | null>>((accumulator, field) => {
      accumulator[field.key] = normalizeInputValue(draftSpecifications[field.key] ?? "");
      return accumulator;
    }, {});

    const { error } = await supabase
      .from("apparatus")
      .update(payload)
      .eq("id", apparatusId);

    if (error) {
      setErrorMessage(error.message || "Unable to save service specifications.");
      setIsSaving(false);
      return;
    }

    const normalizedSavedSpecifications = specFields.reduce<ServiceSpecifications>((accumulator, field) => {
      accumulator[field.key] = payload[field.key] as string | null;
      return accumulator;
    }, {
      oil_type: null,
      oil_capacity: null,
      oil_filter_part_number: null,
      fuel_filter_part_number: null,
      air_filter_part_number: null,
      hydraulic_fluid: null,
      transmission_fluid: null,
      coolant_type: null,
      pump_oil: null,
      generator_oil: null,
      belt_numbers: null,
      battery_type: null,
      tire_size: null,
      other_common_parts: null,
    });

    setSpecifications(normalizedSavedSpecifications);
    setDraftSpecifications(normalizedSavedSpecifications);
    setSuccessMessage("Service specifications saved.");
    setIsSaving(false);
    setIsEditing(false);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-red-900 bg-[#242424] p-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">Service Specifications</h2>
          <p className="mt-2 text-neutral-400">
            Reference-only maintenance specifications for this apparatus.
          </p>
        </div>

        {canEdit ? (
          <button
            type="button"
            onClick={handleStartEdit}
            className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
          >
            Manage Service Specifications
          </button>
        ) : null}
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

      {!hasAnySpecification ? (
        <div className="mt-6 rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-4 text-sm text-neutral-400">
          No service specifications have been entered.
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {specFields.map((field) => {
          const value = specifications[field.key] ?? "";

          return (
            <div
              key={field.key}
              className="rounded-xl border border-white/10 bg-[#1b1b1b] p-4"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">{field.label}</p>

              <p className="mt-2 text-sm font-semibold text-white">
                {value.trim() ? value : "Not set"}
              </p>
            </div>
          );
        })}
      </div>

      {isEditing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-8">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Manage Service Specifications"
            className="max-h-[85vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-red-900 bg-[#242424] shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div>
                <h3 className="text-xl font-bold text-white">Manage Service Specifications</h3>
                <p className="mt-1 text-sm text-neutral-400">
                  Update maintenance reference specifications for this apparatus.
                </p>
              </div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
              <div className="grid gap-4 md:grid-cols-2">
                {specFields.map((field) => {
                  const value = draftSpecifications[field.key] ?? "";

                  return (
                    <div
                      key={field.key}
                      className="rounded-xl border border-white/10 bg-[#1b1b1b] p-4"
                    >
                      <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">{field.label}</p>
                      <input
                        type="text"
                        value={value}
                        onChange={(event) =>
                          setDraftSpecifications((current) => ({
                            ...current,
                            [field.key]: event.target.value,
                          }))
                        }
                        className="mt-2 w-full rounded-lg border border-white/10 bg-[#111111] px-3 py-2 text-sm text-white outline-none transition focus:border-red-500/50"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

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
