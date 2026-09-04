"use client";

import { useMemo, useState } from "react";

export type PpeMemberOption = {
  id: string;
  label: string;
};

export type PpeApparatusOption = {
  id: string;
  label: string;
};

export type PpeAssignmentType = "Station Supply" | "Department Member" | "Apparatus";

export type PpeFormValues = {
  itemName: string;
  assignmentType: PpeAssignmentType;
  assignedMemberId: string;
  apparatusId: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  assetId: string;
  size: string;
  dateManufactured: string;
  placedInServiceDate: string;
  expirationDate: string;
  status: "Active" | "Inactive" | "Out of Service";
  notes: string;
  photoFile: File | null;
  removePhoto: boolean;
};

type PpeFormModalProps = {
  isOpen: boolean;
  mode: "add" | "edit";
  memberOptions: PpeMemberOption[];
  apparatusOptions: PpeApparatusOption[];
  initialValues?: Omit<PpeFormValues, "photoFile" | "removePhoto">;
  existingPhotoUrl?: string | null;
  isSaving?: boolean;
  canDelete?: boolean;
  onClose: () => void;
  onSave: (values: PpeFormValues) => void;
  onDelete?: () => void;
};

const EMPTY_VALUES: PpeFormValues = {
  itemName: "",
  assignmentType: "Department Member",
  assignedMemberId: "",
  apparatusId: "",
  manufacturer: "",
  model: "",
  serialNumber: "",
  assetId: "",
  size: "",
  dateManufactured: "",
  placedInServiceDate: "",
  expirationDate: "",
  status: "Active",
  notes: "",
  photoFile: null,
  removePhoto: false,
};

function formatDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildEmptyValues(): PpeFormValues {
  return {
    ...EMPTY_VALUES,
    placedInServiceDate: formatDateInputValue(new Date()),
  };
}

export default function PpeFormModal({
  isOpen,
  mode,
  memberOptions,
  apparatusOptions,
  initialValues,
  existingPhotoUrl = null,
  isSaving = false,
  canDelete = false,
  onClose,
  onSave,
  onDelete,
}: PpeFormModalProps) {
  const [formValues, setFormValues] = useState<PpeFormValues>(() => {
    if (mode === "edit" && initialValues) {
      return {
        ...initialValues,
        photoFile: null,
        removePhoto: false,
      };
    }

    return buildEmptyValues();
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
      <div className="flex max-h-[calc(100vh-3rem)] w-full max-w-5xl flex-col rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.5)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-black text-white">
              {mode === "add" ? "Add PPE Item" : "Edit PPE Item"}
            </h3>
            <p className="mt-1 text-sm text-neutral-400">
              Personal protective equipment inventory record.
            </p>
          </div>
          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClass}`}>
            {formValues.status}
          </span>
        </div>

        <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="grid gap-3 md:grid-cols-2">
          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">
              PPE Item Name *
            </span>
            <input
              value={formValues.itemName}
              onChange={(event) =>
                setFormValues((current) => ({
                  ...current,
                  itemName: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
            />
          </label>

          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">
              Assignment Type *
            </span>
            <select
              value={formValues.assignmentType}
              onChange={(event) =>
                setFormValues((current) => ({
                  ...current,
                  assignmentType:
                    event.target.value === "Station Supply" ||
                    event.target.value === "Apparatus"
                      ? event.target.value
                      : "Department Member",
                  assignedMemberId: event.target.value === "Department Member" ? current.assignedMemberId : "",
                  apparatusId: event.target.value === "Apparatus" ? current.apparatusId : "",
                }))
              }
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
            >
              <option value="Station Supply">Station Supply</option>
              <option value="Department Member">Department Member</option>
              <option value="Apparatus">Apparatus</option>
            </select>
          </label>

          {formValues.assignmentType === "Department Member" ? (
            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">
                Department Member *
              </span>
              <select
                value={formValues.assignedMemberId}
                onChange={(event) =>
                  setFormValues((current) => ({
                    ...current,
                    assignedMemberId: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
              >
                <option value="">Select member</option>
                {memberOptions.map((member) => (
                  <option key={member.id} value={member.id}>{member.label}</option>
                ))}
              </select>
            </label>
          ) : null}

          {formValues.assignmentType === "Apparatus" ? (
            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">
                Apparatus *
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
                  <option key={apparatus.id} value={apparatus.id}>{apparatus.label}</option>
                ))}
              </select>
            </label>
          ) : null}

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
              Size
            </span>
            <input
              value={formValues.size}
              onChange={(event) =>
                setFormValues((current) => ({
                  ...current,
                  size: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">
              Date Manufactured
            </span>
            <input
              type="date"
              value={formValues.dateManufactured}
              onChange={(event) =>
                setFormValues((current) => ({
                  ...current,
                  dateManufactured: event.target.value,
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
              Expiration Date
            </span>
            <input
              type="date"
              value={formValues.expirationDate}
              onChange={(event) =>
                setFormValues((current) => ({
                  ...current,
                  expirationDate: event.target.value,
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
                  status:
                    event.target.value === "Inactive" || event.target.value === "Out of Service"
                      ? event.target.value
                      : "Active",
                }))
              }
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Out of Service">Out of Service</option>
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
                <img src={effectivePhotoUrl} alt="PPE preview" className="h-56 w-full object-cover" />
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 bg-[#1b1b1b] p-6 text-sm text-neutral-500">
                No photo selected.
              </div>
            )}
          </div>
        </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-between gap-2 border-t border-white/10 pt-4">
          <div>
            {mode === "edit" && canDelete && onDelete ? (
              <button
                type="button"
                disabled={isSaving}
                onClick={onDelete}
                className="rounded-lg border border-red-600/40 bg-red-950/30 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-900/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Delete PPE Item
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
              {isSaving ? "Saving..." : mode === "add" ? "Create PPE Item" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
