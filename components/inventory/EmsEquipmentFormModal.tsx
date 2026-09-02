"use client";

import { useMemo, useState } from "react";

export type EmsEquipmentFormValues = {
  equipmentName: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  assetId: string;
  placedInServiceDate: string;
  location: string;
  status: "Active" | "Inactive";
  notes: string;
  photoFile: File | null;
  removePhoto: boolean;
};

type EmsEquipmentFormModalProps = {
  isOpen: boolean;
  mode: "add" | "edit";
  initialValues?: Omit<EmsEquipmentFormValues, "photoFile" | "removePhoto">;
  existingPhotoUrl?: string | null;
  isSaving?: boolean;
  canDelete?: boolean;
  onClose: () => void;
  onSave: (values: EmsEquipmentFormValues) => void;
  onDelete?: () => void;
};

const EMPTY_VALUES: EmsEquipmentFormValues = {
  equipmentName: "",
  manufacturer: "",
  model: "",
  serialNumber: "",
  assetId: "",
  placedInServiceDate: "",
  location: "EMS Supply Locker",
  status: "Active",
  notes: "",
  photoFile: null,
  removePhoto: false,
};

export default function EmsEquipmentFormModal({
  isOpen,
  mode,
  initialValues,
  existingPhotoUrl = null,
  isSaving = false,
  canDelete = false,
  onClose,
  onSave,
  onDelete,
}: EmsEquipmentFormModalProps) {
  const [formValues, setFormValues] = useState<EmsEquipmentFormValues>(() => {
    if (mode === "edit" && initialValues) {
      return {
        ...initialValues,
        photoFile: null,
        removePhoto: false,
      };
    }

    return EMPTY_VALUES;
  });

  const selectedPhotoPreviewUrl = useMemo(() => {
    if (!formValues.photoFile) {
      return null;
    }

    return URL.createObjectURL(formValues.photoFile);
  }, [formValues.photoFile]);

  const effectivePhotoUrl = selectedPhotoPreviewUrl
    ? selectedPhotoPreviewUrl
    : formValues.removePhoto
      ? null
      : existingPhotoUrl;

  const statusBadgeClass = formValues.status === "Active"
    ? "border-green-700/40 bg-green-900/20 text-green-200"
    : "border-neutral-600/40 bg-neutral-900 text-neutral-300";

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
      <div className="w-full max-w-4xl rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.5)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-black text-white">
              {mode === "add" ? "Add EMS Equipment" : "Edit EMS Equipment"}
            </h3>
            <p className="mt-1 text-sm text-neutral-400">
              Durable EMS equipment inventory record.
            </p>
          </div>
          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClass}`}>
            {formValues.status}
          </span>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">
              Equipment Name *
            </span>
            <input
              value={formValues.equipmentName}
              onChange={(event) =>
                setFormValues((current) => ({
                  ...current,
                  equipmentName: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">
              Manufacturer
            </span>
            <input
              value={formValues.manufacturer}
              onChange={(event) =>
                setFormValues((current) => ({
                  ...current,
                  manufacturer: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">
              Model
            </span>
            <input
              value={formValues.model}
              onChange={(event) =>
                setFormValues((current) => ({
                  ...current,
                  model: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">
              Serial Number
            </span>
            <input
              value={formValues.serialNumber}
              onChange={(event) =>
                setFormValues((current) => ({
                  ...current,
                  serialNumber: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">
              Asset / ID Number
            </span>
            <input
              value={formValues.assetId}
              onChange={(event) =>
                setFormValues((current) => ({
                  ...current,
                  assetId: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">
              Date Placed In Service
            </span>
            <input
              type="date"
              value={formValues.placedInServiceDate}
              onChange={(event) =>
                setFormValues((current) => ({
                  ...current,
                  placedInServiceDate: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">
              Location
            </span>
            <input
              value={formValues.location}
              onChange={(event) =>
                setFormValues((current) => ({
                  ...current,
                  location: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">
              Status
            </span>
            <select
              value={formValues.status}
              onChange={(event) =>
                setFormValues((current) => ({
                  ...current,
                  status: event.target.value === "Inactive" ? "Inactive" : "Active",
                }))
              }
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </label>

          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">
              Notes
            </span>
            <textarea
              rows={3}
              value={formValues.notes}
              onChange={(event) =>
                setFormValues((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
            />
          </label>

          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">
              Photo
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setFormValues((current) => ({
                  ...current,
                  photoFile: file,
                  removePhoto: file ? false : current.removePhoto,
                }));
              }}
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white file:mr-3 file:rounded file:border-0 file:bg-neutral-700 file:px-2 file:py-1 file:text-white focus:border-red-500/50 focus:outline-none"
            />
            {existingPhotoUrl ? (
              <button
                type="button"
                onClick={() =>
                  setFormValues((current) => ({
                    ...current,
                    removePhoto: !current.removePhoto,
                    photoFile: current.removePhoto ? current.photoFile : null,
                  }))
                }
                className="mt-2 rounded-lg border border-white/15 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-neutral-800"
              >
                {formValues.removePhoto ? "Keep Existing Photo" : "Remove Existing Photo"}
              </button>
            ) : null}
          </label>

          <div className="md:col-span-2">
            {effectivePhotoUrl ? (
              <div className="overflow-hidden rounded-xl border border-white/10 bg-[#1b1b1b]">
                <img src={effectivePhotoUrl} alt="Equipment preview" className="h-56 w-full object-cover" />
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 bg-[#1b1b1b] p-6 text-sm text-neutral-500">
                No photo selected.
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-between gap-2">
          <div>
            {mode === "edit" && canDelete && onDelete ? (
              <button
                type="button"
                disabled={isSaving}
                onClick={onDelete}
                className="rounded-lg border border-red-600/40 bg-red-950/30 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-900/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Delete Equipment
              </button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => onSave(formValues)}
              className="rounded-lg border border-red-500/40 bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Saving..." : mode === "add" ? "Create Equipment" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
