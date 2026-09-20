"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import EmsCheckoutModal from "@/components/inventory/EmsCheckoutModal";
import EmsSupplyFormModal, {
  type EmsSupplyFormValues,
  type EmsSupplyUnitOptionValue,
} from "@/components/inventory/EmsSupplyFormModal";
import EmsInventorySwitch from "@/components/inventory/EmsInventorySwitch";
import QrLabelDialog from "@/components/qr/QrLabelDialog";

type StockStatus = "Out of Stock" | "Critical" | "Low" | "Normal";
type SupplyFilter = "All" | "Normal" | "Low" | "Critical" | "Out of Stock" | "Inactive";
type QuantityActionMode = "restock" | "adjust";

export type EmsSupplyItemRow = {
  id: string;
  item_name: string;
  item_category: string | null;
  unit_of_measure: string;
  custom_unit_of_measure: string | null;
  quantity_on_hand: number;
  reorder_threshold: number;
  critical_threshold: number | null;
  target_quantity: number | null;
  location: string | null;
  notes: string | null;
  status: "Active" | "Inactive";
  qr_identifier: string;
  created_at: string;
  updated_at: string;
};

type RecentActivityRow = {
  id: string;
  transactionType: string;
  occurredAt: string;
  quantityDelta: number;
  quantityBefore: number;
  quantityAfter: number;
  performerName: string;
  destinationType: string | null;
  destinationLabel: string | null;
  notes: string | null;
};

type EmsSupplyDetailResponse = {
  item: EmsSupplyItemRow;
  recentActivity: RecentActivityRow[];
};

type WorkspaceProps = {
  departmentName: string | null;
  checkedOutByName: string;
  apparatusOptions: Array<{ id: string; name: string }>;
  canManageSupplies: boolean;
  initialRows: EmsSupplyItemRow[];
  initialError?: string | null;
};

type QuantityActionState = {
  isOpen: boolean;
  mode: QuantityActionMode;
  quantity: string;
  reason: string;
  notes: string;
};

function formatNumber(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }

  const hasDecimals = Math.abs(value % 1) > 0;
  return value.toLocaleString("en-US", {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

function toDisplayUnit(row: EmsSupplyItemRow) {
  if (row.unit_of_measure === "custom") {
    return row.custom_unit_of_measure?.trim() || "Custom";
  }

  const normalized = row.unit_of_measure.trim();
  if (!normalized) {
    return "-";
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function deriveStockStatus(row: EmsSupplyItemRow): StockStatus {
  const quantityOnHand = Number(row.quantity_on_hand ?? 0);
  const reorderThreshold = Number(row.reorder_threshold ?? 0);
  const criticalThreshold =
    typeof row.critical_threshold === "number" && Number.isFinite(row.critical_threshold)
      ? row.critical_threshold
      : null;

  if (quantityOnHand <= 0) {
    return "Out of Stock";
  }

  if (criticalThreshold !== null && quantityOnHand <= criticalThreshold) {
    return "Critical";
  }

  if (quantityOnHand <= reorderThreshold) {
    return "Low";
  }

  return "Normal";
}

function stockStatusSortPriority(status: StockStatus): number {
  if (status === "Out of Stock") {
    return 0;
  }

  if (status === "Critical") {
    return 1;
  }

  if (status === "Low") {
    return 2;
  }

  return 3;
}

function compareItemNames(left: string | null | undefined, right: string | null | undefined): number {
  const leftValue = typeof left === "string" ? left.trim() : "";
  const rightValue = typeof right === "string" ? right.trim() : "";

  if (!leftValue && !rightValue) {
    return 0;
  }

  if (!leftValue) {
    return 1;
  }

  if (!rightValue) {
    return -1;
  }

  return leftValue.localeCompare(rightValue, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function statusBadgeClasses(status: StockStatus, inactive: boolean) {
  if (inactive) {
    return "border-neutral-600/40 bg-neutral-900 text-neutral-300";
  }

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

function summarySectionClasses(
  active: boolean,
  tone: "low" | "critical" | "out" | "reorder",
) {
  const base = "group relative min-w-0 px-4 py-3 text-left transition duration-200";

  if (active) {
    if (tone === "out") {
      return `${base} bg-[linear-gradient(180deg,rgba(72,26,26,0.24),rgba(72,26,26,0.08))]`;
    }

    if (tone === "critical") {
      return `${base} bg-[linear-gradient(180deg,rgba(86,30,40,0.22),rgba(86,30,40,0.08))]`;
    }

    if (tone === "reorder") {
      return `${base} bg-[linear-gradient(180deg,rgba(82,56,18,0.18),rgba(82,56,18,0.06))]`;
    }

    return `${base} bg-[linear-gradient(180deg,rgba(88,62,20,0.22),rgba(88,62,20,0.08))]`;
  }

  if (tone === "out") {
    return `${base} hover:bg-[linear-gradient(180deg,rgba(60,24,24,0.18),rgba(60,24,24,0.06))]`;
  }

  if (tone === "critical") {
    return `${base} hover:bg-[linear-gradient(180deg,rgba(72,28,38,0.16),rgba(72,28,38,0.06))]`;
  }

  if (tone === "reorder") {
    return `${base} hover:bg-[linear-gradient(180deg,rgba(66,52,20,0.14),rgba(66,52,20,0.06))]`;
  }

  return `${base} hover:bg-[linear-gradient(180deg,rgba(70,56,24,0.16),rgba(70,56,24,0.06))]`;
}

function parseNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function toFormValues(row: EmsSupplyItemRow): EmsSupplyFormValues {
  return {
    itemName: row.item_name,
    itemCategory: row.item_category ?? "",
    unitOfMeasure: row.unit_of_measure as EmsSupplyUnitOptionValue,
    customUnitOfMeasure: row.custom_unit_of_measure ?? "",
    reorderThreshold: String(row.reorder_threshold ?? 0),
    criticalThreshold:
      typeof row.critical_threshold === "number" ? String(row.critical_threshold) : "",
    location: row.location ?? "",
    notes: row.notes ?? "",
    status: row.status,
    startingQuantity: "",
  };
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function normalizeApiError(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const error = (payload as { error?: unknown }).error;
  return typeof error === "string" && error.trim() ? error : fallback;
}

function TransactionActionModal({
  state,
  isSaving,
  item,
  onClose,
  onSubmit,
  onChange,
}: {
  state: QuantityActionState;
  isSaving: boolean;
  item: EmsSupplyItemRow | null;
  onClose: () => void;
  onSubmit: () => void;
  onChange: (next: Partial<QuantityActionState>) => void;
}) {
  if (!state.isOpen || !item) {
    return null;
  }

  const heading =
    state.mode === "restock" ? "Restock Supply" : "Adjust Quantity";

  const quantityLabel =
    state.mode === "adjust" ? "New Physical Count" : "Received Quantity";

  const saveLabel =
    state.mode === "restock" ? "Submit Restock" : "Submit Adjustment";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
      <div className="w-full max-w-xl rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.5)]">
        <h3 className="text-xl font-black text-white">{heading}</h3>
        <p className="mt-1 text-sm text-neutral-400">{item.item_name}</p>

        <div className="mt-4 rounded-xl border border-white/10 bg-[#1b1b1b] p-4 text-sm text-neutral-300">
          <p>
            Current Quantity: <span className="font-semibold text-white">{formatNumber(item.quantity_on_hand)}</span>
          </p>
          <p className="mt-1">
            Unit: <span className="font-semibold text-white">{toDisplayUnit(item)}</span>
          </p>
        </div>

        <div className="mt-4 grid gap-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">
              {quantityLabel} *
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={state.quantity}
              onChange={(event) => onChange({ quantity: event.target.value })}
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
            />
          </label>

          {state.mode === "adjust" ? (
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">
                Reason *
              </span>
              <input
                value={state.reason}
                onChange={(event) => onChange({ reason: event.target.value })}
                placeholder="Physical count mismatch"
                className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
              />
            </label>
          ) : null}

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-300">
              Notes
            </span>
            <textarea
              rows={3}
              value={state.notes}
              onChange={(event) => onChange({ notes: event.target.value })}
              className="w-full rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-sm text-white focus:border-red-500/50 focus:outline-none"
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
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
            onClick={onSubmit}
            className="rounded-lg border border-red-500/40 bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving..." : saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EmsSupplyWorkspace({
  departmentName = null,
  checkedOutByName,
  apparatusOptions,
  canManageSupplies,
  initialRows,
  initialError = null,
}: WorkspaceProps) {
  const [hasInitialLoadError, setHasInitialLoadError] = useState(Boolean(initialError));
  const [rows, setRows] = useState<EmsSupplyItemRow[]>(initialRows);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<SupplyFilter>("All");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<EmsSupplyItemRow | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivityRow[]>([]);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formInstanceKey, setFormInstanceKey] = useState(0);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [isFormSaving, setIsFormSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(initialError);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionState, setActionState] = useState<QuantityActionState>({
    isOpen: false,
    mode: "restock",
    quantity: "",
    reason: "",
    notes: "",
  });
  const [isActionSaving, setIsActionSaving] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isCheckoutSubmitting, setIsCheckoutSubmitting] = useState(false);
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timeout = window.setTimeout(() => setToastMessage(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  const rowsWithStatus = useMemo(
    () =>
      rows.map((row) => ({
        ...row,
        derivedStockStatus: deriveStockStatus(row),
      })),
    [rows],
  );

  const filteredRows = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return rowsWithStatus
      .filter((row) => {
      if (statusFilter === "Inactive" && row.status !== "Inactive") {
        return false;
      }

      if (statusFilter !== "All" && statusFilter !== "Inactive") {
        if (row.status !== "Active") {
          return false;
        }

        if (row.derivedStockStatus !== statusFilter) {
          return false;
        }
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [row.item_name, row.item_category, row.location]
        .map((value) => (typeof value === "string" ? value.toLowerCase() : ""))
        .join(" ");

      return haystack.includes(normalizedSearch);
      })
      .sort((left, right) => {
        if (left.status === "Inactive" && right.status !== "Inactive") {
          return 1;
        }

        if (left.status !== "Inactive" && right.status === "Inactive") {
          return -1;
        }

        if (left.status !== "Inactive" && right.status !== "Inactive") {
          const leftPriority = stockStatusSortPriority(left.derivedStockStatus);
          const rightPriority = stockStatusSortPriority(right.derivedStockStatus);

          if (leftPriority !== rightPriority) {
            return leftPriority - rightPriority;
          }
        }

        return compareItemNames(left.item_name, right.item_name);
      });
  }, [rowsWithStatus, searchTerm, statusFilter]);

  const activeRows = useMemo(
    () => rowsWithStatus.filter((row) => row.status === "Active"),
    [rowsWithStatus],
  );

  const checkoutSupplies = useMemo(
    () =>
      activeRows.map((row) => ({
        id: row.id,
        itemName: row.item_name,
        category: row.item_category,
        location: row.location,
        quantityOnHand: Number(row.quantity_on_hand ?? 0),
        unitLabel: toDisplayUnit(row),
        stockStatus: row.derivedStockStatus,
      })),
    [activeRows],
  );

  const summary = useMemo(() => {
    const low = activeRows.filter((row) => row.derivedStockStatus === "Low").length;
    const critical = activeRows.filter((row) => row.derivedStockStatus === "Critical").length;
    const out = activeRows.filter((row) => row.derivedStockStatus === "Out of Stock").length;

    return {
      low,
      critical,
      out,
    };
  }, [activeRows]);

  const selectedSummaryFilter = useMemo(() => {
    if (statusFilter === "Low") {
      return "low";
    }
    if (statusFilter === "Critical") {
      return "critical";
    }
    if (statusFilter === "Out of Stock") {
      return "out";
    }
    return "none";
  }, [statusFilter]);

  const refreshRows = async (): Promise<boolean> => {
    try {
      const response = await fetch("/api/ems/supplies", {
        method: "GET",
      });

      const payload = (await response.json().catch(() => ({}))) as {
        rows?: EmsSupplyItemRow[];
        error?: unknown;
      };

      if (!response.ok) {
        setToastMessage(normalizeApiError(payload, "Unable to refresh EMS supplies."));
        return false;
      }

      setRows(Array.isArray(payload.rows) ? payload.rows : []);
      return true;
    } catch {
      setToastMessage("Unable to refresh EMS supplies.");
      return false;
    }
  };

  const retryInitialLoad = async () => {
    const didRefresh = await refreshRows();
    if (didRefresh) {
      setHasInitialLoadError(false);
      setToastMessage(null);
    }
  };

  const loadItemDetail = async (itemId: string) => {
    setIsDetailLoading(true);
    setSelectedItemId(itemId);
    setSelectedItem(null);
    setRecentActivity([]);
    setDetailError(null);

    try {
      const response = await fetch(`/api/ems/supplies/${itemId}`, {
        method: "GET",
      });

      const payload = (await response.json().catch(() => ({}))) as
        | ({ error?: unknown } & Partial<EmsSupplyDetailResponse>)
        | null;

      if (!response.ok || !payload || !payload.item) {
        const message = normalizeApiError(payload, "Unable to load supply detail.");
        setToastMessage(message);
        setDetailError(message);
        return;
      }

      setSelectedItem(payload.item);
      setRecentActivity(Array.isArray(payload.recentActivity) ? payload.recentActivity : []);
      setDetailError(null);
    } catch {
      setToastMessage("Unable to load supply detail.");
      setDetailError("Unable to load supply detail.");
    } finally {
      setIsDetailLoading(false);
    }
  };

  const openAddForm = () => {
    setFormMode("add");
    setFormInstanceKey((current) => current + 1);
    setIsFormOpen(true);
  };

  const openCheckout = () => {
    setIsCheckoutOpen(true);
  };

  const openEditForm = () => {
    if (!selectedItem) {
      return;
    }

    setFormMode("edit");
    setFormInstanceKey((current) => current + 1);
    setIsFormOpen(true);
  };

  const saveSupply = async (values: EmsSupplyFormValues) => {
    setIsFormSaving(true);

    const payload = {
      itemName: values.itemName,
      unitOfMeasure: values.unitOfMeasure,
      customUnitOfMeasure: values.customUnitOfMeasure,
      reorderThreshold: values.reorderThreshold,
      criticalThreshold: values.criticalThreshold,
      location: values.location,
      notes: values.notes,
      status: values.status,
      startingQuantity: values.startingQuantity,
    };

    try {
      const isAdd = formMode === "add";
      const endpoint = isAdd ? "/api/ems/supplies" : `/api/ems/supplies/${selectedItem?.id ?? ""}`;
      const method = isAdd ? "POST" : "PATCH";
      const response = await fetch(endpoint, {
        method,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responsePayload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: unknown;
        item?: EmsSupplyItemRow;
      };

      if (!response.ok || !responsePayload.ok || !responsePayload.item) {
        setToastMessage(
          normalizeApiError(
            responsePayload,
            isAdd ? "Unable to add EMS supply." : "Unable to update EMS supply.",
          ),
        );
        setIsFormSaving(false);
        return;
      }

      await refreshRows();
      if (!isAdd) {
        await loadItemDetail(responsePayload.item.id);
      }

      setIsFormSaving(false);
      setIsFormOpen(false);
      setToastMessage(isAdd ? "EMS supply added." : "EMS supply updated.");
    } catch {
      setIsFormSaving(false);
      setToastMessage(formMode === "add" ? "Unable to add EMS supply." : "Unable to update EMS supply.");
    }
  };

  const toggleItemStatus = async () => {
    if (!selectedItem) {
      return;
    }

    const nextStatus = selectedItem.status === "Active" ? "Inactive" : "Active";

    setIsFormSaving(true);
    try {
      const response = await fetch(`/api/ems/supplies/${selectedItem.id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          itemName: selectedItem.item_name,
          unitOfMeasure: selectedItem.unit_of_measure,
          customUnitOfMeasure: selectedItem.custom_unit_of_measure,
          reorderThreshold: selectedItem.reorder_threshold,
          criticalThreshold: selectedItem.critical_threshold,
          location: selectedItem.location,
          notes: selectedItem.notes,
          status: nextStatus,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        item?: EmsSupplyItemRow;
        error?: unknown;
      };

      if (!response.ok || !payload.ok || !payload.item) {
        setToastMessage(normalizeApiError(payload, "Unable to update supply status."));
        setIsFormSaving(false);
        return;
      }

      setIsFormSaving(false);
      await refreshRows();
      await loadItemDetail(payload.item.id);
      setToastMessage(nextStatus === "Inactive" ? "Supply marked inactive." : "Supply reactivated.");
    } catch {
      setIsFormSaving(false);
      setToastMessage("Unable to update supply status.");
    }
  };

  const deleteItem = async () => {
    if (!selectedItem) {
      return;
    }

    const confirmed = window.confirm(
      `Delete ${selectedItem.item_name}? This is only allowed when no transaction history exists.`,
    );

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/ems/supplies/${selectedItem.id}`, {
        method: "DELETE",
      });

      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: unknown;
      };

      if (!response.ok || !payload.ok) {
        setToastMessage(normalizeApiError(payload, "Unable to delete supply item."));
        setIsDeleting(false);
        return;
      }

      setIsDeleting(false);
      setSelectedItem(null);
      setSelectedItemId(null);
      setRecentActivity([]);
      await refreshRows();
      setToastMessage("Supply item deleted.");
    } catch {
      setIsDeleting(false);
      setToastMessage("Unable to delete supply item.");
    }
  };

  const openQuantityAction = (mode: QuantityActionMode) => {
    setActionState({
      isOpen: true,
      mode,
      quantity: "",
      reason: "",
      notes: "",
    });
  };

  const submitQuantityAction = async () => {
    if (!selectedItem) {
      return;
    }

    const quantity = parseNumber(actionState.quantity);

    if (quantity === null || quantity < 0) {
      setToastMessage(
        actionState.mode === "adjust"
          ? "Enter a valid physical count."
          : "Enter a valid quantity.",
      );
      return;
    }

    if (actionState.mode === "restock" && quantity <= 0) {
      setToastMessage("Quantity must be greater than zero.");
      return;
    }

    if (actionState.mode === "adjust" && !actionState.reason.trim()) {
      setToastMessage("Adjustment reason is required.");
      return;
    }

    setIsActionSaving(true);

    try {
      const requestBody =
        actionState.mode === "adjust"
          ? {
              transactionType: "Correction",
              supplyItemId: selectedItem.id,
              newQuantity: quantity,
              reason: actionState.reason,
              notes: actionState.notes,
            }
          : {
              transactionType: "Restock",
              items: [
                {
                  supplyItemId: selectedItem.id,
                  quantity,
                },
              ],
              destinationType: "SupplyRoom",
              destinationLabel: "Supply Room",
              notes: actionState.notes,
            };

      const response = await fetch("/api/ems/transactions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: unknown;
      };

      if (!response.ok || !payload.ok) {
        setToastMessage(normalizeApiError(payload, "Unable to apply inventory transaction."));
        setIsActionSaving(false);
        return;
      }

      setIsActionSaving(false);
      setActionState((current) => ({ ...current, isOpen: false }));
      await refreshRows();
      await loadItemDetail(selectedItem.id);
      setToastMessage(
        actionState.mode === "adjust"
          ? "Quantity adjusted with audit trail."
          : "Restock transaction recorded.",
      );
    } catch {
      setIsActionSaving(false);
      setToastMessage("Unable to apply inventory transaction.");
    }
  };

  const submitCheckout = async (payload: {
    items: Array<{ supplyItemId: string; quantity: number }>;
    destinationType: "Apparatus" | "Station" | "SupplyRoom" | "Other" | "None";
    destinationApparatusId: string | null;
    destinationLabel: string | null;
    notes: string | null;
  }): Promise<{ ok: boolean; error?: string }> => {
    setIsCheckoutSubmitting(true);

    try {
      const response = await fetch("/api/ems/transactions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          transactionType: "Checkout",
          items: payload.items.map((item) => ({
            supplyItemId: item.supplyItemId,
            quantity: item.quantity,
          })),
          destinationType: payload.destinationType,
          destinationApparatusId: payload.destinationApparatusId,
          destinationLabel: payload.destinationLabel,
          notes: payload.notes,
        }),
      });

      const responsePayload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: unknown;
      };

      if (!response.ok || !responsePayload.ok) {
        const message = normalizeApiError(
          responsePayload,
          "Inventory changed before checkout could be completed. Please review the quantities and try again.",
        );

        if (message.toLowerCase().includes("insufficient quantity")) {
          setIsCheckoutSubmitting(false);
          await refreshRows();
          return {
            ok: false,
            error:
              "Inventory changed before checkout could be completed. Please review the quantities and try again.",
          };
        }

        setIsCheckoutSubmitting(false);
        return { ok: false, error: message };
      }

      setIsCheckoutSubmitting(false);
      await refreshRows();
      if (selectedItemId) {
        await loadItemDetail(selectedItemId);
      }
      setToastMessage("Checkout complete.");
      return { ok: true };
    } catch {
      setIsCheckoutSubmitting(false);
      return {
        ok: false,
        error:
          "Inventory changed before checkout could be completed. Please review the quantities and try again.",
      };
    }
  };

  const emptyState = !hasInitialLoadError && rows.length === 0;

  const formInitialValues =
    formMode === "edit" && selectedItem ? toFormValues(selectedItem) : undefined;

  return (
    <div className="space-y-8">
      {toastMessage ? (
        <div className="fixed right-4 top-4 z-50 rounded-lg border border-red-500/40 bg-[#2E2E2E] px-4 py-3 text-sm text-red-200 shadow-lg">
          <div className="flex items-center gap-3">
            <span>{toastMessage}</span>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="text-red-200/80 transition hover:text-red-100"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-red-500">Inventory</p>
        <h1 className="mt-2 text-[2.25rem] font-[700] leading-none tracking-[-0.06em] text-white">EMS Supplies</h1>
        <p className="mt-3 max-w-2xl text-lg text-neutral-400">
          Department-defined consumable inventory for operational readiness.
        </p>
        <p className="mt-1 text-sm text-neutral-500">
          {departmentName ? `${departmentName} Supply Management` : "Supply Management"}
        </p>
      </div>

      <EmsInventorySwitch activeView="supplies" />

      <section className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-5">
        {hasInitialLoadError ? (
          <div className="rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-4 text-sm text-red-100">
            <p className="font-semibold">Unable to load EMS Supplies.</p>
            <p className="mt-1 text-red-200/90">The initial inventory request failed. Supply counts are unavailable until the data is loaded.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(20,20,20,0.84),rgba(30,30,30,0.96))] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="border-b border-white/6 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-neutral-500">Inventory Status</p>
            </div>

            <div className="grid grid-cols-2 xl:grid-cols-4">
              <button
                type="button"
                onClick={() => setStatusFilter("Low")}
                className={summarySectionClasses(selectedSummaryFilter === "low", "low")}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Reorder</p>
                  <p className="text-[1.9rem] font-[800] leading-none tracking-[-0.05em] text-amber-200">{summary.low}</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter("Critical")}
                className={`border-l border-white/6 ${summarySectionClasses(selectedSummaryFilter === "critical", "critical")}`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Critical</p>
                  <p className="text-[1.9rem] font-[800] leading-none tracking-[-0.05em] text-rose-200">{summary.critical}</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter("Out of Stock")}
                className="border-t border-white/6 xl:border-l xl:border-t-0 xl:border-white/6"
              >
                <div className={summarySectionClasses(selectedSummaryFilter === "out", "out")}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Out of Stock</p>
                    <p className="text-[1.9rem] font-[800] leading-none tracking-[-0.05em] text-red-100">{summary.out}</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}
      </section>

      {!hasInitialLoadError ? (
        <section className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0 flex-1">
              <label htmlFor="ems-supplies-search" className="sr-only">
                Search EMS supplies
              </label>
              <input
                id="ems-supplies-search"
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by item name, category, or location"
                className="w-full rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3 text-sm text-white placeholder:text-neutral-500 focus:border-red-500/50 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:min-w-[420px]">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as SupplyFilter)}
                className="rounded-xl border border-white/10 bg-[#1b1b1b] px-3 py-3 text-sm text-neutral-200 focus:border-red-500/50 focus:outline-none"
              >
                <option value="All">All</option>
                <option value="Normal">Normal</option>
                <option value="Low">Reorder</option>
                <option value="Critical">Critical</option>
                <option value="Out of Stock">Out of Stock</option>
                <option value="Inactive">Inactive</option>
              </select>

              {canManageSupplies ? (
                <button
                  type="button"
                  onClick={openAddForm}
                  className="rounded-xl border border-red-500/40 bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
                >
                  Add EMS Supply
                </button>
              ) : (
                <button
                  type="button"
                  onClick={openCheckout}
                  className="rounded-xl border border-red-500/40 bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
                >
                  Start Checkout
                </button>
              )}
            </div>
          </div>

          {canManageSupplies ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/inventory/ems-supplies/history"
                className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
              >
                History
              </Link>
              <button
                type="button"
                onClick={openCheckout}
                className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
              >
                Start Checkout
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6">
        {hasInitialLoadError ? (
          <div className="rounded-xl border border-red-500/30 bg-[#1b1b1b] px-6 py-10 text-center">
            <p className="text-lg font-bold text-red-100">EMS Supplies Could Not Be Loaded</p>
            <p className="mt-2 text-sm text-red-200/90">
              We could not load your department&apos;s EMS supply inventory.
            </p>
            <div className="mt-5">
              <button
                type="button"
                onClick={() => {
                  void retryInitialLoad();
                }}
                className="rounded-lg border border-red-500/40 bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                Retry Load
              </button>
            </div>
          </div>
        ) : emptyState ? (
          <div className="rounded-xl border border-white/10 bg-[#1b1b1b] px-6 py-10 text-center">
            <p className="text-lg font-bold text-white">No EMS Supplies Added</p>
            <p className="mt-2 text-sm text-neutral-400">
              Your department has not added any EMS inventory yet.
            </p>
            <p className="mt-1 text-sm text-neutral-500">
              Authorized inventory managers can add supplies your department wants to track.
            </p>
            {canManageSupplies ? (
              <div className="mt-5">
                <button
                  type="button"
                  onClick={openAddForm}
                  className="rounded-lg border border-red-500/40 bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
                >
                  Add EMS Supply
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="max-h-[56vh] overflow-auto">
            <table className="min-w-full border-separate border-spacing-0 text-left">
              <thead>
                <tr>
                  {[
                    "Item Name",
                    "Quantity",
                    "Unit",
                    "Stock Status",
                    "Reorder Threshold",
                    "Location",
                    "Action",
                  ].map((label) => (
                    <th
                      key={label}
                      scope="col"
                      className="border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="border-b border-white/5 px-4 py-10 text-center">
                      <p className="text-lg font-bold text-white">No Supplies Found</p>
                      <p className="mt-1 text-sm text-neutral-400">
                        No supply items currently match this search or filter.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => {
                    const derivedStatus = row.derivedStockStatus;
                    const inactive = row.status === "Inactive";
                    return (
                      <tr key={row.id} className="transition hover:bg-white/5">
                        <td className="border-b border-white/5 px-4 py-3 text-sm text-white">{row.item_name}</td>
                        <td className="border-b border-white/5 px-4 py-3 text-sm font-semibold text-white">
                          {formatNumber(row.quantity_on_hand)}
                        </td>
                        <td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">
                          {toDisplayUnit(row)}
                        </td>
                        <td className="border-b border-white/5 px-4 py-3 text-sm text-white">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadgeClasses(
                              derivedStatus,
                              inactive,
                            )}`}
                          >
                            {inactive ? "Inactive" : toDisplayStockStatus(derivedStatus)}
                          </span>
                        </td>
                        <td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">
                          {formatNumber(row.reorder_threshold)}
                        </td>
                        <td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">
                          {row.location || "-"}
                        </td>
                        <td className="border-b border-white/5 px-4 py-3 text-sm text-neutral-200">
                          <button
                            type="button"
                            onClick={() => {
                              void loadItemDetail(row.id);
                            }}
                            className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-neutral-800"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedItemId ? (
        <div className="fixed inset-0 z-40 bg-black/70 px-4 py-6">
          <div className="mx-auto h-full w-full max-w-5xl overflow-y-auto rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-neutral-500">EMS Supply Detail</p>
                <h2 className="mt-1 text-2xl font-black text-white">
                  {selectedItem?.item_name ?? "Loading..."}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedItemId(null);
                  setSelectedItem(null);
                  setRecentActivity([]);
                  setDetailError(null);
                }}
                className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
              >
                Close
              </button>
            </div>

            {isDetailLoading ? (
              <div className="mt-6 rounded-xl border border-white/10 bg-[#1b1b1b] p-6 text-sm text-neutral-300">
                Loading supply detail...
              </div>
            ) : detailError ? (
              <div className="mt-6 rounded-xl border border-red-500/30 bg-[#1b1b1b] p-6 text-sm text-red-100">
                <p className="font-semibold">EMS supply detail could not be loaded.</p>
                <p className="mt-2 text-red-200/90">{detailError}</p>
              </div>
            ) : !selectedItem ? (
              <div className="mt-6 rounded-xl border border-red-500/30 bg-[#1b1b1b] p-6 text-sm text-red-100">
                EMS supply detail could not be loaded.
              </div>
            ) : (
              <>
                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-[#1b1b1b] p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-neutral-500">Current Quantity</p>
                    <p className="mt-2 text-sm font-semibold text-white">
                      {formatNumber(selectedItem.quantity_on_hand)} {toDisplayUnit(selectedItem)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-[#1b1b1b] p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-neutral-500">Stock Status</p>
                    <p className="mt-2 text-sm font-semibold text-white">
                      {selectedItem.status === "Inactive"
                        ? "Inactive"
                        : toDisplayStockStatus(deriveStockStatus(selectedItem))}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-[#1b1b1b] p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-neutral-500">Reorder Threshold</p>
                    <p className="mt-2 text-sm font-semibold text-white">
                      {formatNumber(selectedItem.reorder_threshold)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-[#1b1b1b] p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-neutral-500">Critical Threshold</p>
                    <p className="mt-2 text-sm font-semibold text-white">
                      {typeof selectedItem.critical_threshold === "number"
                        ? formatNumber(selectedItem.critical_threshold)
                        : "-"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-[#1b1b1b] p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-neutral-500">Location</p>
                    <p className="mt-2 text-sm font-semibold text-white">{selectedItem.location || "-"}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-[#1b1b1b] p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-neutral-500">Active/Inactive</p>
                    <p className="mt-2 text-sm font-semibold text-white">{selectedItem.status}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-[#1b1b1b] p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-neutral-500">QR Identifier</p>
                    <p className="mt-2 break-all text-sm font-semibold text-white">{selectedItem.qr_identifier}</p>
                  </div>
                </div>

                <div className="mt-3 rounded-xl border border-white/10 bg-[#1b1b1b] p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-neutral-500">Notes</p>
                  <p className="mt-2 text-sm text-neutral-200">{selectedItem.notes || "-"}</p>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {canManageSupplies ? (
                    <>
                    <button
                      type="button"
                      onClick={openEditForm}
                      className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
                    >
                      Edit Supply
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsQrDialogOpen(true)}
                      className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
                    >
                      QR Code
                    </button>
                    <button
                      type="button"
                      onClick={() => openQuantityAction("restock")}
                      className="rounded-lg border border-emerald-500/30 bg-emerald-900/20 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-900/30"
                    >
                      Restock
                    </button>
                    <button
                      type="button"
                      onClick={() => openQuantityAction("adjust")}
                      className="rounded-lg border border-amber-500/30 bg-amber-900/20 px-3 py-2 text-xs font-semibold text-amber-100 transition hover:bg-amber-900/30"
                    >
                      Adjust Quantity
                    </button>
                    <button
                      type="button"
                      onClick={toggleItemStatus}
                      disabled={isFormSaving}
                      className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {selectedItem.status === "Active" ? "Mark Inactive" : "Mark Active"}
                    </button>
                    <button
                      type="button"
                      onClick={deleteItem}
                      disabled={isDeleting}
                      className="rounded-lg border border-red-700/60 bg-red-900/20 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-900/30 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isDeleting ? "Deleting..." : "Delete (If No History)"}
                    </button>
                    </>
                  ) : null}
                  <button
                    type="button"
                    onClick={openCheckout}
                    className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
                  >
                    Start Checkout
                  </button>
                </div>

                <section className="mt-6 rounded-2xl border border-neutral-800 bg-[#242424] p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-white">Recent Activity</h3>
                    <span className="text-xs uppercase tracking-[0.16em] text-neutral-500">Audit Trail</span>
                  </div>

                  {recentActivity.length === 0 ? (
                    <p className="mt-4 text-sm text-neutral-400">No recent transactions for this supply item.</p>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {recentActivity.map((row) => (
                        <div key={row.id} className="rounded-xl border border-white/10 bg-[#1b1b1b] p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-white">
                              {row.transactionType} {row.quantityDelta >= 0 ? `+${formatNumber(row.quantityDelta)}` : formatNumber(row.quantityDelta)}
                            </p>
                            <p className="text-xs text-neutral-500">{formatDateTime(row.occurredAt)}</p>
                          </div>
                          <p className="mt-1 text-xs text-neutral-400">
                            {formatNumber(row.quantityBefore)} to {formatNumber(row.quantityAfter)} by {row.performerName}
                          </p>
                          {row.destinationType || row.destinationLabel ? (
                            <p className="mt-1 text-xs text-neutral-500">
                              Destination: {[row.destinationType, row.destinationLabel]
                                .filter((value) => typeof value === "string" && value.trim())
                                .join(" - ")}
                            </p>
                          ) : null}
                          {row.notes ? <p className="mt-1 text-xs text-neutral-500">{row.notes}</p> : null}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        </div>
      ) : null}

      <EmsSupplyFormModal
        key={`${formMode}-${selectedItem?.id ?? "new"}-${formInstanceKey}`}
        isOpen={isFormOpen}
        mode={formMode}
        initialValues={formInitialValues}
        isSaving={isFormSaving}
        onClose={() => setIsFormOpen(false)}
        onSave={saveSupply}
        onRetireToggle={formMode === "edit" ? toggleItemStatus : undefined}
        onDelete={formMode === "edit" ? deleteItem : undefined}
        canDelete={canManageSupplies}
      />

      <TransactionActionModal
        state={actionState}
        isSaving={isActionSaving}
        item={selectedItem}
        onClose={() => setActionState((current) => ({ ...current, isOpen: false }))}
        onSubmit={submitQuantityAction}
        onChange={(next) => setActionState((current) => ({ ...current, ...next }))}
      />

      <EmsCheckoutModal
        isOpen={isCheckoutOpen}
        isSubmitting={isCheckoutSubmitting}
        supplies={checkoutSupplies}
        apparatusOptions={apparatusOptions}
        checkedOutByName={checkedOutByName}
        onClose={() => setIsCheckoutOpen(false)}
        onSubmit={submitCheckout}
      />
      {canManageSupplies && isQrDialogOpen && selectedItem ? <QrLabelDialog title={selectedItem.item_name} subtitle="EMS Supply" value={selectedItem.qr_identifier} onClose={() => setIsQrDialogOpen(false)} /> : null}
    </div>
  );
}
