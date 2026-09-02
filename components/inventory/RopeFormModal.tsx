"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

export type RopeApparatusOption = {
  id: string;
  name: string | null;
};

export type RopeFormValues = {
  ropeName: string;
  ropeIdentifier: string;
  ropeType: "Life Safety" | "Utility";
  serialNumber: string;
  lengthFt: string;
  diameterMm: string;
  placedInServiceDate: string;
  locationType: "Apparatus" | "Station Storage" | "Other";
  apparatusId: string;
  otherLocation: string;
  status: "Active" | "Inactive";
  notes: string;
  photoFile: File | null;
  removePhoto: boolean;
};

type RopeFormModalProps = {
  isOpen: boolean;
  mode: "add" | "edit";
  initialValues?: Omit<RopeFormValues, "photoFile" | "removePhoto">;
  apparatusOptions: RopeApparatusOption[];
  existingPhotoUrl?: string | null;
  isSaving?: boolean;
  canDelete?: boolean;
  onClose: () => void;
  onSave: (values: RopeFormValues) => void;
  onDelete?: () => void;
};

const EMPTY_VALUES: RopeFormValues = {
  ropeName: "",
  ropeIdentifier: "",
  ropeType: "Life Safety",
  serialNumber: "",
  lengthFt: "",
  diameterMm: "",
  placedInServiceDate: "",
  locationType: "Station Storage",
  apparatusId: "",
  otherLocation: "",
  status: "Active",
  notes: "",
  photoFile: null,
  removePhoto: false,
};

export default function RopeFormModal({
  isOpen,
  mode,
  initialValues,
  apparatusOptions,
  existingPhotoUrl = null,
  isSaving = false,
  canDelete = false,
  onClose,
  onSave,
  onDelete,
}: RopeFormModalProps) {
  const [formValues, setFormValues] = useState<RopeFormValues>(() => {
    if (mode === "edit" && initialValues) {
      return { ...initialValues, photoFile: null, removePhoto: false };
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

  const statusBadgeClass =
    formValues.status === "Active"
      ? "border-green-700/40 bg-green-900/20 text-green-200"
      : "border-neutral-600/40 bg-neutral-900 text-neutral-300";

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
      <div className="flex max-h-[calc(100vh-3rem)] w-full max-w-5xl flex-col rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.5)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-black text-white">{mode === "add" ? "Add Rope" : "Edit Rope"}</h3>
            <p className="mt-1 text-sm text-neutral-400">Department rope inventory record.</p>
          </div>
          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClass}`}>
            {formValues.status}
          </span>
        </div>

        <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">
                Rope Name *
              </span>
              <input
                value={formValues.ropeName}
                onChange={(event) =>
                  setFormValues((current) => ({
                    ...current,
                    ropeName: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">
                Rope Identifier *
              </span>
              <input
                value={formValues.ropeIdentifier}
                onChange={(event) =>
                  setFormValues((current) => ({
                    ...current,
                    ropeIdentifier: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">
                Rope Type *
              </span>
              <select
                value={formValues.ropeType}
                onChange={(event) =>
                  setFormValues((current) => ({
                    ...current,
                    ropeType: event.target.value === "Utility" ? "Utility" : "Life Safety",
                  }))
                }
                className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
              >
                <option value="Life Safety">Life Safety</option>
                <option value="Utility">Utility</option>
              </select>
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
                Length (ft)
              </span>
              <input
                type="number"
                min="0"
                value={formValues.lengthFt}
                onChange={(event) =>
                  setFormValues((current) => ({
                    ...current,
                    lengthFt: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">
                Diameter (mm)
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formValues.diameterMm}
                onChange={(event) =>
                  setFormValues((current) => ({
                    ...current,
                    diameterMm: event.target.value,
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
              <select
                value={formValues.locationType}
                onChange={(event) => {
                  const nextLocationType =
                    event.target.value === "Apparatus"
                      ? "Apparatus"
                      : event.target.value === "Other"
                        ? "Other"
                        : "Station Storage";

                  setFormValues((current) => ({
                    ...current,
                    locationType: nextLocationType,
                    apparatusId: nextLocationType === "Apparatus" ? current.apparatusId : "",
                    otherLocation: nextLocationType === "Other" ? current.otherLocation : "",
                  }));
                }}
                className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
              >
                <option value="Station Storage">Station Storage</option>
                <option value="Apparatus">Apparatus</option>
                <option value="Other">Other</option>
              </select>
            </label>

            {formValues.locationType === "Apparatus" ? (
              <label className="block md:col-span-2">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">
                  Apparatus
                </span>
                <select
                  value={formValues.apparatusId}
                  onChange={(event) =>
                    setFormValues((current) => ({
                      ...current,
                      apparatusId: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
                >
                  <option value="">Select apparatus</option>
                  {apparatusOptions.map((apparatus) => (
                    <option key={apparatus.id} value={apparatus.id}>
                      {apparatus.name || "Unnamed Apparatus"}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {formValues.locationType === "Other" ? (
              <label className="block md:col-span-2">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">
                  Other Location
                </span>
                <input
                  value={formValues.otherLocation}
                  onChange={(event) =>
                    setFormValues((current) => ({
                      ...current,
                      otherLocation: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
                />
              </label>
            ) : null}

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
            </label>

            {effectivePhotoUrl ? (
              <div className="md:col-span-2">
                <Image
                  src={effectivePhotoUrl}
                  alt="Rope preview"
                  width={1200}
                  height={720}
                  unoptimized
                  className="h-48 w-full rounded-xl border border-white/10 object-cover"
                />
                <button
                  type="button"
                  onClick={() => setFormValues((current) => ({ ...current, photoFile: null, removePhoto: true }))}
                  className="mt-2 rounded-md border border-white/10 px-3 py-1 text-xs font-semibold text-neutral-200 transition hover:bg-white/5"
                >
                  Remove Photo
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg border border-white/15 bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {canDelete && onDelete ? (
              <button
                type="button"
                onClick={onDelete}
                disabled={isSaving}
                className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Delete
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => onSave(formValues)}
              disabled={isSaving}
              className="rounded-lg border border-red-500/40 bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? "Saving..." : mode === "add" ? "Add Rope" : "Save Rope"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}