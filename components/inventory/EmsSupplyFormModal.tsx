"use client";

import { useMemo, useState } from "react";

export type EmsSupplyUnitOptionValue =
  | "each"
  | "box"
  | "bag"
  | "case"
  | "bottle"
  | "vial"
  | "pair"
  | "roll"
  | "kit"
  | "liter"
  | "milliliter"
  | "custom";

export type EmsSupplyFormValues = {
  itemName: string;
  itemCategory: string;
  unitOfMeasure: EmsSupplyUnitOptionValue;
  customUnitOfMeasure: string;
  reorderThreshold: string;
  criticalThreshold: string;
  targetQuantity: string;
  location: string;
  notes: string;
  status: "Active" | "Inactive";
  startingQuantity: string;
};

type EmsSupplyFormModalProps = {
  isOpen: boolean;
  mode: "add" | "edit";
  initialValues?: EmsSupplyFormValues;
  isSaving?: boolean;
  onClose: () => void;
  onSave: (values: EmsSupplyFormValues) => void;
  onRetireToggle?: () => void;
  onDelete?: () => void;
  canDelete?: boolean;
};

const UNIT_OPTIONS: Array<{ value: EmsSupplyUnitOptionValue; label: string }> = [
  { value: "each", label: "Each" },
  { value: "box", label: "Box" },
  { value: "bag", label: "Bag" },
  { value: "case", label: "Case" },
  { value: "bottle", label: "Bottle" },
  { value: "vial", label: "Vial" },
  { value: "pair", label: "Pair" },
  { value: "roll", label: "Roll" },
  { value: "kit", label: "Kit" },
  { value: "liter", label: "Liter" },
  { value: "milliliter", label: "Milliliter" },
  { value: "custom", label: "Custom" },
];

const EMPTY_VALUES: EmsSupplyFormValues = {
  itemName: "",
  itemCategory: "",
  unitOfMeasure: "each",
  customUnitOfMeasure: "",
  reorderThreshold: "",
  criticalThreshold: "",
  targetQuantity: "",
  location: "EMS Supply Locker",
  notes: "",
  status: "Active",
  startingQuantity: "",
};

export default function EmsSupplyFormModal({
  isOpen,
  mode,
  initialValues,
  isSaving = false,
  onClose,
  onSave,
  onRetireToggle,
  onDelete,
  canDelete = false,
}: EmsSupplyFormModalProps) {
  const [formValues, setFormValues] = useState<EmsSupplyFormValues>(() => {
    if (mode === "edit" && initialValues) {
      return {
        ...initialValues,
        startingQuantity: "",
      };
    }

    return EMPTY_VALUES;
  });

  const showCustomUnitField = formValues.unitOfMeasure === "custom";

  const statusBadgeClass = useMemo(() => {
    return formValues.status === "Active"
      ? "border-green-700/40 bg-green-900/20 text-green-200"
      : "border-neutral-600/40 bg-neutral-900 text-neutral-300";
  }, [formValues.status]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
      <div className="w-full max-w-3xl rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.5)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-black text-white">
              {mode === "add" ? "Add EMS Supply" : "Edit EMS Supply"}
            </h3>
            <p className="mt-1 text-sm text-neutral-400">
              Manage metadata and thresholds. Quantity changes are controlled through audited transactions.
            </p>
          </div>
          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClass}`}>
            {formValues.status}
          </span>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">
              Item Name *
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

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">
              Unit of Measure *
            </span>
            <select
              value={formValues.unitOfMeasure}
              onChange={(event) =>
                setFormValues((current) => ({
                  ...current,
                  unitOfMeasure: event.target.value as EmsSupplyUnitOptionValue,
                  customUnitOfMeasure:
                    event.target.value === "custom" ? current.customUnitOfMeasure : "",
                }))
              }
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
            >
              {UNIT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {showCustomUnitField ? (
            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">
                Custom Unit *
              </span>
              <input
                value={formValues.customUnitOfMeasure}
                onChange={(event) =>
                  setFormValues((current) => ({
                    ...current,
                    customUnitOfMeasure: event.target.value,
                  }))
                }
                placeholder="Sleeve"
                className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
              />
            </label>
          ) : null}

          {mode === "add" ? (
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">
                Starting Quantity *
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formValues.startingQuantity}
                onChange={(event) =>
                  setFormValues((current) => ({
                    ...current,
                    startingQuantity: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
              />
            </label>
          ) : null}

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">
              Reorder Threshold *
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formValues.reorderThreshold}
              onChange={(event) =>
                setFormValues((current) => ({
                  ...current,
                  reorderThreshold: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">
              Critical Threshold *
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formValues.criticalThreshold}
              onChange={(event) =>
                setFormValues((current) => ({
                  ...current,
                  criticalThreshold: event.target.value,
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
              placeholder="EMS Supply Locker"
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
            />
          </label>

          {mode === "edit" ? (
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">
                Item Status
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
          ) : null}

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

          {mode === "edit" ? (
            <div className="rounded-xl border border-amber-700/30 bg-amber-900/10 p-4 md:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">
                Quantity Protection
              </p>
              <p className="mt-1 text-sm text-amber-100/90">
                Quantity cannot be changed here. Use Restock, Return, or Adjust Quantity so all inventory movement stays audited.
              </p>
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {mode === "edit" && onRetireToggle ? (
              <button
                type="button"
                onClick={onRetireToggle}
                className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-500/20"
              >
                {formValues.status === "Active" ? "Mark Inactive" : "Mark Active"}
              </button>
            ) : null}

            {mode === "edit" && canDelete && onDelete ? (
              <button
                type="button"
                onClick={onDelete}
                className="rounded-lg border border-red-700/60 bg-red-900/20 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-900/30"
              >
                Delete Item
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
              {isSaving ? "Saving..." : mode === "add" ? "Save Supply" : "Update Supply"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
