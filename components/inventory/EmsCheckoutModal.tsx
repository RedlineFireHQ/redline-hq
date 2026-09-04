"use client";

import { useMemo, useState } from "react";

type StockStatus = "Out of Stock" | "Critical" | "Low" | "Normal";

type DestinationType = "Apparatus" | "Station" | "SupplyRoom" | "Other" | "None";

type CheckoutSupply = {
  id: string;
  itemName: string;
  category: string | null;
  location: string | null;
  quantityOnHand: number;
  unitLabel: string;
  stockStatus: StockStatus;
};

type CheckoutLine = {
  supplyItemId: string;
  itemName: string;
  unitLabel: string;
  quantityOnHand: number;
  stockStatus: StockStatus;
  quantity: number;
};

type ApparatusOption = {
  id: string;
  name: string;
};

type SubmitPayload = {
  items: Array<{ supplyItemId: string; quantity: number }>;
  destinationType: DestinationType;
  destinationApparatusId: string | null;
  destinationLabel: string | null;
  notes: string | null;
};

type SubmitResult = {
  ok: boolean;
  error?: string;
};

type EmsCheckoutModalProps = {
  isOpen: boolean;
  isSubmitting: boolean;
  supplies: CheckoutSupply[];
  apparatusOptions: ApparatusOption[];
  checkedOutByName: string;
  onClose: () => void;
  onSubmit: (payload: SubmitPayload) => Promise<SubmitResult>;
};

function formatNumber(value: number) {
  const hasDecimals = Math.abs(value % 1) > 0;
  return value.toLocaleString("en-US", {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

function statusBadgeClasses(status: StockStatus) {
  if (status === "Out of Stock") {
    return "border-red-700/40 bg-red-900/20 text-red-200";
  }

  if (status === "Critical") {
    return "border-red-700/40 bg-red-900/20 text-red-300";
  }

  if (status === "Low") {
    return "border-amber-700/40 bg-amber-900/20 text-amber-300";
  }

  return "border-green-700/40 bg-green-900/20 text-green-300";
}

function toDisplayStockStatus(status: StockStatus): string {
  if (status === "Low") {
    return "Reorder";
  }

  return status;
}

function parsePositiveNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

export default function EmsCheckoutModal({
  isOpen,
  isSubmitting,
  supplies,
  apparatusOptions,
  checkedOutByName,
  onClose,
  onSubmit,
}: EmsCheckoutModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSupplyId, setSelectedSupplyId] = useState<string>("");
  const [addQuantityInput, setAddQuantityInput] = useState("");
  const [checkoutLines, setCheckoutLines] = useState<CheckoutLine[]>([]);
  const [destinationType, setDestinationType] = useState<DestinationType>("None");
  const [destinationApparatusId, setDestinationApparatusId] = useState("");
  const [destinationLabel, setDestinationLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [reviewMode, setReviewMode] = useState(false);
  const [successMode, setSuccessMode] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [successSummary, setSuccessSummary] = useState<{
    itemCount: number;
    destinationText: string;
  } | null>(null);

  const activeSupplies = useMemo(
    () => supplies.filter((supply) => supply.quantityOnHand > 0 || supply.stockStatus !== "Out of Stock"),
    [supplies],
  );

  const filteredSupplies = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return activeSupplies.filter((supply) => {
      if (!normalizedSearch) {
        return true;
      }

      const haystack = [supply.itemName, supply.category, supply.location]
        .map((value) => (typeof value === "string" ? value.toLowerCase() : ""))
        .join(" ");

      return haystack.includes(normalizedSearch);
    });
  }, [activeSupplies, searchTerm]);

  const selectedSupply = useMemo(
    () => activeSupplies.find((supply) => supply.id === selectedSupplyId) ?? null,
    [activeSupplies, selectedSupplyId],
  );

  const reservedQuantityByItemId = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of checkoutLines) {
      map.set(line.supplyItemId, (map.get(line.supplyItemId) ?? 0) + line.quantity);
    }
    return map;
  }, [checkoutLines]);

  const availableToAdd = useMemo(() => {
    if (!selectedSupply) {
      return 0;
    }

    const alreadyReserved = reservedQuantityByItemId.get(selectedSupply.id) ?? 0;
    return Math.max(0, selectedSupply.quantityOnHand - alreadyReserved);
  }, [reservedQuantityByItemId, selectedSupply]);

  const destinationValidationError = useMemo(() => {
    if (destinationType === "Apparatus" && !destinationApparatusId) {
      return "Select an apparatus destination.";
    }

    if (destinationType === "Other" && !destinationLabel.trim()) {
      return "Enter a destination for Other.";
    }

    return null;
  }, [destinationApparatusId, destinationLabel, destinationType]);

  const totalLineItems = checkoutLines.length;

  const destinationPreview = useMemo(() => {
    if (destinationType === "None") {
      return "None";
    }

    if (destinationType === "Apparatus") {
      const match = apparatusOptions.find((option) => option.id === destinationApparatusId);
      return match?.name || "Apparatus";
    }

    if (destinationType === "Station") {
      return destinationLabel.trim() || "Station";
    }

    if (destinationType === "SupplyRoom") {
      return destinationLabel.trim() || "Supply Room";
    }

    return destinationLabel.trim() || "Other";
  }, [apparatusOptions, destinationApparatusId, destinationLabel, destinationType]);

  const resetWorkflow = () => {
    setSearchTerm("");
    setSelectedSupplyId("");
    setAddQuantityInput("");
    setCheckoutLines([]);
    setDestinationType("None");
    setDestinationApparatusId("");
    setDestinationLabel("");
    setNotes("");
    setReviewMode(false);
    setSuccessMode(false);
    setInlineError(null);
    setSuccessSummary(null);
  };

  const handleClose = () => {
    resetWorkflow();
    onClose();
  };

  const handleSelectSupply = (supplyId: string) => {
    setSelectedSupplyId(supplyId);
    setAddQuantityInput("");
    setInlineError(null);
  };

  const handleAddToCheckout = () => {
    if (!selectedSupply) {
      setInlineError("Select an EMS supply first.");
      return;
    }

    const quantity = parsePositiveNumber(addQuantityInput);

    if (quantity === null) {
      setInlineError("Enter a valid quantity.");
      return;
    }

    if (quantity <= 0) {
      setInlineError("Quantity must be greater than zero.");
      return;
    }

    if (quantity > availableToAdd) {
      setInlineError(`Only ${formatNumber(availableToAdd)} available.`);
      return;
    }

    setCheckoutLines((current) => {
      const existing = current.find((line) => line.supplyItemId === selectedSupply.id);
      if (!existing) {
        return [
          ...current,
          {
            supplyItemId: selectedSupply.id,
            itemName: selectedSupply.itemName,
            unitLabel: selectedSupply.unitLabel,
            quantityOnHand: selectedSupply.quantityOnHand,
            stockStatus: selectedSupply.stockStatus,
            quantity,
          },
        ];
      }

      return current.map((line) =>
        line.supplyItemId === selectedSupply.id
          ? {
              ...line,
              quantity: line.quantity + quantity,
            }
          : line,
      );
    });

    setAddQuantityInput("");
    setInlineError(null);
  };

  const handleSummaryQuantityChange = (supplyItemId: string, value: string) => {
    const parsed = parsePositiveNumber(value);

    if (parsed === null || parsed <= 0) {
      setInlineError("Summary quantity must be greater than zero.");
      return;
    }

    setCheckoutLines((current) => {
      const target = current.find((line) => line.supplyItemId === supplyItemId);
      if (!target) {
        return current;
      }

      const reservedByOthers = current
        .filter((line) => line.supplyItemId === supplyItemId && line !== target)
        .reduce((total, line) => total + line.quantity, 0);

      const maxForTarget = Math.max(0, target.quantityOnHand - reservedByOthers);

      if (parsed > maxForTarget) {
        setInlineError(`Only ${formatNumber(maxForTarget)} available.`);
        return current;
      }

      setInlineError(null);
      return current.map((line) =>
        line.supplyItemId === supplyItemId
          ? {
              ...line,
              quantity: parsed,
            }
          : line,
      );
    });
  };

  const handleRemoveLine = (supplyItemId: string) => {
    setCheckoutLines((current) => current.filter((line) => line.supplyItemId !== supplyItemId));
    setInlineError(null);
  };

  const handleReview = () => {
    if (checkoutLines.length === 0) {
      setInlineError("Add at least one item before review.");
      return;
    }

    if (destinationValidationError) {
      setInlineError(destinationValidationError);
      return;
    }

    setInlineError(null);
    setReviewMode(true);
  };

  const handleConfirmCheckout = async () => {
    if (checkoutLines.length === 0) {
      setInlineError("Add at least one item before checkout.");
      return;
    }

    if (destinationValidationError) {
      setInlineError(destinationValidationError);
      setReviewMode(false);
      return;
    }

    const payload: SubmitPayload = {
      items: checkoutLines.map((line) => ({
        supplyItemId: line.supplyItemId,
        quantity: line.quantity,
      })),
      destinationType,
      destinationApparatusId: destinationType === "Apparatus" ? destinationApparatusId : null,
      destinationLabel:
        destinationType === "None"
          ? null
          : destinationType === "Apparatus"
            ? null
            : destinationType === "SupplyRoom"
              ? destinationLabel.trim() || "Supply Room"
              : destinationType === "Station"
                ? destinationLabel.trim() || "Station"
                : destinationLabel.trim() || null,
      notes: notes.trim() || null,
    };

    const result = await onSubmit(payload);

    if (!result.ok) {
      const fallback =
        "Inventory changed before checkout could be completed. Please review the quantities and try again.";
      setInlineError(result.error || fallback);
      setReviewMode(false);
      return;
    }

    setSuccessSummary({
      itemCount: checkoutLines.length,
      destinationText: destinationPreview,
    });
    setSuccessMode(true);
    setReviewMode(false);
    setInlineError(null);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 px-4 py-6">
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-red-400">EMS Checkout</p>
            <h2 className="mt-1 text-2xl font-black text-white">Start Checkout</h2>
            <p className="mt-1 text-sm text-neutral-400">You are removing supplies from EMS inventory.</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
          >
            Cancel
          </button>
        </div>

        {inlineError ? (
          <div className="mt-4 rounded-lg border border-red-500/40 bg-red-900/20 px-3 py-2 text-sm text-red-200">
            {inlineError}
          </div>
        ) : null}

        {successMode ? (
          <div className="mt-6 rounded-2xl border border-emerald-700/40 bg-emerald-900/20 p-6">
            <h3 className="text-xl font-black text-emerald-100">Checkout Complete</h3>
            <p className="mt-2 text-sm text-emerald-100/90">
              {successSummary?.itemCount ?? 0} items removed from EMS inventory.
            </p>
            <p className="mt-2 text-sm text-emerald-100/90">Destination: {successSummary?.destinationText ?? "None"}</p>
            <div className="mt-5">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg border border-emerald-500/40 bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
              >
                Done
              </button>
            </div>
          </div>
        ) : reviewMode ? (
          <div className="mt-6 overflow-y-auto">
            <div className="rounded-2xl border border-neutral-800 bg-[#1f1f1f] p-5">
              <h3 className="text-lg font-black text-white">Confirm EMS Checkout</h3>
              <p className="mt-2 text-sm text-neutral-400">Review items and destination before final submission.</p>

              <div className="mt-4 space-y-2 rounded-xl border border-white/10 bg-[#1b1b1b] p-4">
                {checkoutLines.map((line) => (
                  <div key={line.supplyItemId} className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold text-white">{line.itemName}</span>
                    <span className="text-neutral-300">
                      {formatNumber(line.quantity)} {line.unitLabel}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-2 text-sm text-neutral-300">
                <p>
                  Destination: <span className="font-semibold text-white">{destinationPreview}</span>
                </p>
                <p>
                  Checked out by: <span className="font-semibold text-white">{checkedOutByName}</span>
                </p>
                {notes.trim() ? (
                  <p>
                    Notes: <span className="font-semibold text-white">{notes.trim()}</span>
                  </p>
                ) : null}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setReviewMode(false)}
                  className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    void handleConfirmCheckout();
                  }}
                  className="rounded-lg border border-red-500/40 bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Submitting..." : "Confirm Checkout"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-6 grid min-h-0 flex-1 gap-4 lg:grid-cols-[1.2fr_1fr]">
            <div className="flex min-h-0 flex-col rounded-2xl border border-neutral-800 bg-[#1f1f1f] p-5">
              <h3 className="text-lg font-black text-white">Add Supply</h3>
              <div className="mt-3">
                <label htmlFor="ems-checkout-search" className="sr-only">
                  Search EMS supplies
                </label>
                <input
                  id="ems-checkout-search"
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search by item name or location"
                  className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-red-500/50 focus:outline-none"
                />
              </div>

              <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-xl border border-white/10 bg-[#1b1b1b]">
                {filteredSupplies.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-neutral-400">
                    No matching supplies.
                  </div>
                ) : (
                  filteredSupplies.map((supply) => {
                    const isSelected = supply.id === selectedSupplyId;
                    const reserved = reservedQuantityByItemId.get(supply.id) ?? 0;
                    const available = Math.max(0, supply.quantityOnHand - reserved);
                    return (
                      <button
                        key={supply.id}
                        type="button"
                        onClick={() => handleSelectSupply(supply.id)}
                        className={`w-full border-b border-white/5 px-4 py-3 text-left transition last:border-b-0 ${
                          isSelected ? "bg-white/10" : "hover:bg-white/5"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-white">{supply.itemName}</p>
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClasses(supply.stockStatus)}`}>
                            {toDisplayStockStatus(supply.stockStatus)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-neutral-400">
                          {formatNumber(available)} {supply.unitLabel} available
                        </p>
                        <p className="mt-0.5 text-xs text-neutral-500">
                          {supply.location?.trim() || "No location"}
                        </p>
                      </button>
                    );
                  })
                )}
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-[#1b1b1b] p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-neutral-500">Selected Supply</p>
                {selectedSupply ? (
                  <>
                    <p className="mt-1 text-sm font-semibold text-white">{selectedSupply.itemName}</p>
                    <p className="mt-0.5 text-xs text-neutral-400">
                      {formatNumber(availableToAdd)} {selectedSupply.unitLabel} available to add
                    </p>
                    <div className="mt-3 flex flex-wrap items-end gap-2">
                      <label className="min-w-[170px] flex-1">
                        <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-neutral-400">How many are you taking?</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={addQuantityInput}
                          onChange={(event) => setAddQuantityInput(event.target.value)}
                          className="w-full rounded-lg border border-white/10 bg-[#111111] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={handleAddToCheckout}
                        className="rounded-lg border border-red-500/40 bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700"
                      >
                        Add to Checkout
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-neutral-400">Select a supply item to add quantity.</p>
                )}
              </div>
            </div>

            <div className="flex min-h-0 flex-col rounded-2xl border border-neutral-800 bg-[#1f1f1f] p-5">
              <h3 className="text-lg font-black text-white">Checkout Summary</h3>
              <p className="mt-1 text-xs uppercase tracking-[0.14em] text-neutral-500">Items: {totalLineItems}</p>

              <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-xl border border-white/10 bg-[#1b1b1b] p-3">
                {checkoutLines.length === 0 ? (
                  <p className="text-sm text-neutral-400">No items added yet.</p>
                ) : (
                  <div className="space-y-2">
                    {checkoutLines.map((line) => (
                      <div key={line.supplyItemId} className="rounded-lg border border-white/10 bg-[#111111] p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-white">{line.itemName}</p>
                            <p className="text-xs text-neutral-400">{formatNumber(line.quantityOnHand)} {line.unitLabel} total available</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(line.supplyItemId)}
                            className="rounded border border-red-700/50 px-2 py-1 text-[11px] font-semibold text-red-200 hover:bg-red-900/30"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.quantity}
                            onChange={(event) => handleSummaryQuantityChange(line.supplyItemId, event.target.value)}
                            className="w-24 rounded border border-white/10 bg-[#1b1b1b] px-2 py-1 text-sm text-white focus:border-red-500/50 focus:outline-none"
                          />
                          <span className="text-xs text-neutral-300">{line.unitLabel}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-[#1b1b1b] p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-neutral-500">Destination</p>
                <select
                  value={destinationType}
                  onChange={(event) => {
                    setDestinationType(event.target.value as DestinationType);
                    setInlineError(null);
                  }}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-[#111111] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
                >
                  <option value="Apparatus">Apparatus</option>
                  <option value="Station">Station</option>
                  <option value="SupplyRoom">Supply Room</option>
                  <option value="Other">Other</option>
                  <option value="None">None</option>
                </select>

                {destinationType === "Apparatus" ? (
                  <select
                    value={destinationApparatusId}
                    onChange={(event) => setDestinationApparatusId(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-white/10 bg-[#111111] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
                  >
                    <option value="">Select apparatus</option>
                    {apparatusOptions.map((option) => (
                      <option key={option.id} value={option.id}>{option.name}</option>
                    ))}
                  </select>
                ) : null}

                {destinationType === "Station" || destinationType === "SupplyRoom" || destinationType === "Other" ? (
                  <input
                    value={destinationLabel}
                    onChange={(event) => setDestinationLabel(event.target.value)}
                    placeholder={
                      destinationType === "Station"
                        ? "Station destination"
                        : destinationType === "SupplyRoom"
                          ? "Supply room destination"
                          : "Other destination"
                    }
                    className="mt-2 w-full rounded-lg border border-white/10 bg-[#111111] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
                  />
                ) : null}

                <label className="mt-3 block">
                  <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-neutral-500">Notes (Optional)</span>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-[#111111] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
                  />
                </label>

                <p className="mt-3 text-xs text-neutral-400">
                  Checked out by: <span className="font-semibold text-white">{checkedOutByName}</span>
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleReview}
                  className="rounded-lg border border-red-500/40 bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700"
                >
                  Review Checkout
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
