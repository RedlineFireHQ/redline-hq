"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PpeFormModal, {
  type PpeFormValues,
  type PpeMemberOption,
} from "@/components/inventory/PpeFormModal";
import type { PpeReadinessResult } from "@/lib/inventory/ppe-readiness";

export type PpeRow = {
  id: string;
  item_name: string;
  assigned_member_id: string;
  assigned_member_name: string | null;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  asset_number: string | null;
  size: string | null;
  date_manufactured: string | null;
  placed_in_service_date: string | null;
  expiration_date: string | null;
  location: string | null;
  status: "Active" | "Inactive";
  notes: string | null;
  photo_path: string | null;
  created_at: string;
  updated_at: string;
};

type PpeDetailResponse = {
  item: PpeRow;
  photoUrl: string | null;
};

type PpeDeficiencyRow = {
  id: string;
  deficiency_number: string | null;
  description: string | null;
  reported_at: string | null;
  status_name: string | null;
};

type PpeDeficienciesResponse = {
  rows: PpeDeficiencyRow[];
};

type WorkspaceProps = {
  departmentName: string | null;
  canManagePpe: boolean;
  memberOptions: PpeMemberOption[];
  initialRows: PpeRow[];
  readinessState: PpeReadinessResult;
  initialError?: string | null;
};

type StatusFilter = "All" | "Active" | "Inactive";

function compareNames(left: string | null | undefined, right: string | null | undefined): number {
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

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function statusBadgeClasses(status: StatusFilter) {
  if (status === "Active") {
    return "border-green-700/40 bg-green-900/20 text-green-300";
  }

  return "border-neutral-600/40 bg-neutral-900 text-neutral-300";
}

function summaryCardClasses(active: boolean, tone: "all" | "active" | "inactive") {
  const base = "rounded-xl border px-4 py-3 text-left transition";

  if (active) {
    return `${base} border-white/20 bg-white/[0.06]`;
  }

  if (tone === "active") {
    return `${base} border-green-700/30 bg-green-950/20 hover:bg-green-950/30`;
  }

  if (tone === "inactive") {
    return `${base} border-neutral-700/30 bg-neutral-900/40 hover:bg-neutral-900/60`;
  }

  return `${base} border-white/10 bg-[#1b1b1b] hover:bg-[#202020]`;
}

function normalizeApiError(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const error = (payload as { error?: unknown }).error;
  return typeof error === "string" && error.trim() ? error : fallback;
}

function normalizeDeficiencyStatus(value: string | null | undefined) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!normalized) {
    return "Unknown";
  }
  if (normalized === "in progress") {
    return "In Progress";
  }
  if (normalized === "open") {
    return "Open";
  }
  if (normalized === "resolved") {
    return "Resolved";
  }
  if (normalized === "closed") {
    return "Closed";
  }
  return value?.trim() || "Unknown";
}

function isOpenDeficiency(value: string | null | undefined) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return normalized !== "resolved" && normalized !== "closed";
}

function deficiencyStatusClasses(value: string | null | undefined) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "open") {
    return "border-red-700/40 bg-red-900/20 text-red-300";
  }
  if (normalized === "in progress") {
    return "border-amber-700/40 bg-amber-900/20 text-amber-300";
  }
  if (normalized === "resolved" || normalized === "closed") {
    return "border-emerald-700/40 bg-emerald-900/20 text-emerald-300";
  }
  return "border-neutral-600/40 bg-neutral-900 text-neutral-300";
}

function formatPpeReadinessPercent(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "NOT RATED";
  }

  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

function toFormValues(row: PpeRow): PpeFormValues {
  return {
    itemName: row.item_name,
    assignedMemberId: row.assigned_member_id,
    manufacturer: row.manufacturer ?? "",
    model: row.model ?? "",
    serialNumber: row.serial_number ?? "",
    assetId: row.asset_number ?? "",
    size: row.size ?? "",
    dateManufactured: row.date_manufactured ?? "",
    placedInServiceDate: row.placed_in_service_date ?? "",
    expirationDate: row.expiration_date ?? "",
    location: row.location ?? "",
    status: row.status,
    notes: row.notes ?? "",
    photoFile: null,
    removePhoto: false,
  };
}

async function fileToUploadPayload(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return {
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    base64Data: btoa(binary),
  };
}

export default function PpeWorkspace({
  departmentName,
  canManagePpe,
  memberOptions,
  initialRows,
  readinessState,
  initialError = null,
}: WorkspaceProps) {
  const router = useRouter();
  const [rows, setRows] = useState<PpeRow[]>(initialRows);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [memberFilter, setMemberFilter] = useState("All");
  const [toastMessage, setToastMessage] = useState<string | null>(initialError);

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<PpeRow | null>(null);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const [selectedDeficiencies, setSelectedDeficiencies] = useState<PpeDeficiencyRow[]>([]);
  const [isDeficienciesLoading, setIsDeficienciesLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [isFormSaving, setIsFormSaving] = useState(false);
  const [formInstanceKey, setFormInstanceKey] = useState(0);

  const activeRows = useMemo(
    () => rows.filter((row) => row.status === "Active"),
    [rows],
  );

  const inactiveRows = useMemo(
    () => rows.filter((row) => row.status === "Inactive"),
    [rows],
  );

  const filteredRows = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return rows
      .filter((row) => {
        if (statusFilter !== "All" && row.status !== statusFilter) {
          return false;
        }

        if (memberFilter !== "All" && row.assigned_member_id !== memberFilter) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        const searchableFields = [
          row.item_name,
          row.assigned_member_name,
          row.manufacturer,
          row.model,
          row.serial_number,
          row.asset_number,
        ];

        return searchableFields.some((field) => (field ?? "").toLowerCase().includes(normalizedSearch));
      })
      .sort((left, right) => compareNames(left.item_name, right.item_name));
  }, [rows, searchTerm, statusFilter, memberFilter]);

  const selectedSummaryFilter = statusFilter === "All" ? "all" : statusFilter === "Active" ? "active" : "inactive";

  const formInitialValues =
    formMode === "edit" && selectedItem ? toFormValues(selectedItem) : undefined;

  const openDeficiencyCount = useMemo(
    () => selectedDeficiencies.filter((row) => isOpenDeficiency(row.status_name)).length,
    [selectedDeficiencies],
  );

  const openDeficiencies = useMemo(
    () => selectedDeficiencies.filter((row) => isOpenDeficiency(row.status_name)),
    [selectedDeficiencies],
  );

  const deficiencyHistory = useMemo(
    () => selectedDeficiencies.filter((row) => !isOpenDeficiency(row.status_name)),
    [selectedDeficiencies],
  );

  const launchDeficiencyReport = () => {
    if (!selectedItem) {
      return;
    }

    const params = new URLSearchParams({
      inventoryCategory: "ppe",
      inventoryItemId: selectedItem.id,
      inventoryItemLabel: selectedItem.item_name,
      returnTo: "/inventory/ppe",
    });

    router.push(`/deficiencies/report?${params.toString()}`);
  };

  const loadDetail = async (itemId: string) => {
    setSelectedItemId(itemId);
    setIsDetailLoading(true);
    setIsDeficienciesLoading(true);
    setSelectedDeficiencies([]);

    try {
      const [detailResponse, deficienciesResponse] = await Promise.all([
        fetch(`/api/ppe/${itemId}`, { method: "GET" }),
        fetch(`/api/ppe/${itemId}/deficiencies`, { method: "GET" }),
      ]);

      const payload = (await detailResponse.json().catch(() => ({}))) as
        | ({ error?: unknown } & Partial<PpeDetailResponse>)
        | null;

      if (!detailResponse.ok || !payload || !payload.item) {
        setToastMessage(normalizeApiError(payload, "Unable to load PPE item detail."));
        return;
      }

      setSelectedItem(payload.item);
      setSelectedPhotoUrl(typeof payload.photoUrl === "string" ? payload.photoUrl : null);

      const deficienciesPayload = (await deficienciesResponse.json().catch(() => ({}))) as
        | ({ error?: unknown } & Partial<PpeDeficienciesResponse>)
        | null;

      if (!deficienciesResponse.ok || !deficienciesPayload || !Array.isArray(deficienciesPayload.rows)) {
        setSelectedDeficiencies([]);
      } else {
        setSelectedDeficiencies(deficienciesPayload.rows);
      }
    } catch {
      setToastMessage("Unable to load PPE item detail.");
    } finally {
      setIsDeficienciesLoading(false);
      setIsDetailLoading(false);
    }
  };

  const openAddForm = () => {
    setFormMode("add");
    setFormInstanceKey((current) => current + 1);
    setIsFormOpen(true);
  };

  const openEditForm = () => {
    if (!selectedItem || !canManagePpe) {
      return;
    }

    setFormMode("edit");
    setFormInstanceKey((current) => current + 1);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    if (isFormSaving) {
      return;
    }

    setIsFormOpen(false);
  };

  const handleDelete = async () => {
    if (!selectedItem || !canManagePpe || isFormSaving) {
      return;
    }

    const confirmed = window.confirm(`Delete ${selectedItem.item_name}? This action cannot be undone.`);
    if (!confirmed) {
      return;
    }

    setIsFormSaving(true);

    try {
      const response = await fetch(`/api/ppe/${selectedItem.id}`, { method: "DELETE" });
      const payload = (await response.json().catch(() => ({}))) as { error?: unknown };

      if (!response.ok) {
        setToastMessage(normalizeApiError(payload, "Unable to delete PPE item."));
        return;
      }

      setRows((current) => current.filter((row) => row.id !== selectedItem.id));
      setSelectedItemId(null);
      setSelectedItem(null);
      setSelectedPhotoUrl(null);
      setSelectedDeficiencies([]);
      setIsFormOpen(false);
      setToastMessage("PPE item deleted.");
    } finally {
      setIsFormSaving(false);
    }
  };

  const handleSave = async (values: PpeFormValues) => {
    if (!canManagePpe || isFormSaving) {
      return;
    }

    if (!values.itemName.trim()) {
      setToastMessage("PPE item name is required.");
      return;
    }

    if (!values.assignedMemberId.trim()) {
      setToastMessage("Assigned member is required.");
      return;
    }

    setIsFormSaving(true);

    try {
      const photoUpload = values.photoFile ? await fileToUploadPayload(values.photoFile) : null;
      const requestPayload = {
        itemName: values.itemName,
        assignedMemberId: values.assignedMemberId,
        manufacturer: values.manufacturer,
        model: values.model,
        serialNumber: values.serialNumber,
        assetId: values.assetId,
        size: values.size,
        dateManufactured: values.dateManufactured,
        placedInServiceDate: values.placedInServiceDate,
        expirationDate: values.expirationDate,
        location: values.location,
        status: values.status,
        notes: values.notes,
        photoUpload,
        removePhoto: values.removePhoto,
      };

      const endpoint = formMode === "add" ? "/api/ppe" : `/api/ppe/${selectedItem?.id ?? ""}`;
      const method = formMode === "add" ? "POST" : "PATCH";

      const response = await fetch(endpoint, {
        method,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(requestPayload),
      });

      const payload = (await response.json().catch(() => ({}))) as
        | ({ error?: unknown } & { item?: PpeRow })
        | null;

      if (!response.ok || !payload?.item) {
        setToastMessage(normalizeApiError(payload, formMode === "add" ? "Unable to create PPE item." : "Unable to update PPE item."));
        return;
      }

      const savedItem = payload.item;

      setRows((current) => {
        if (formMode === "add") {
          return [...current, savedItem].sort((left, right) => compareNames(left.item_name, right.item_name));
        }

        return current
          .map((row) => (row.id === savedItem.id ? savedItem : row))
          .sort((left, right) => compareNames(left.item_name, right.item_name));
      });

      setSelectedItemId(savedItem.id);
      if (formMode === "add") {
        setSearchTerm("");
        setStatusFilter("All");
        setMemberFilter("All");
      }
      await loadDetail(savedItem.id);
      setIsFormOpen(false);
      setToastMessage(formMode === "add" ? "PPE item created." : "PPE item updated.");
    } finally {
      setIsFormSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#090909] px-6 py-10 text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        {toastMessage ? (
          <div className="rounded-xl border border-red-500/30 bg-red-900/20 px-4 py-3 text-sm text-red-100">
            <div className="flex items-center justify-between gap-3">
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
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-red-500">Inventory</p>
          <h1 className="mt-2 text-5xl font-black tracking-tight text-white">PPE Inventory</h1>
          <p className="mt-3 max-w-2xl text-lg text-neutral-400">
            Department-scoped personal protective equipment records assigned to firefighters.
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            {departmentName ? `${departmentName} PPE Management` : "PPE Management"}
          </p>
        </div>

        <section className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-5">
          <div className="grid gap-3 sm:grid-cols-4">
            <button
              type="button"
              onClick={() => setStatusFilter("All")}
              className={summaryCardClasses(selectedSummaryFilter === "all", "all")}
            >
              <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Total PPE</p>
              <p className="mt-2 text-2xl font-black text-white">{rows.length}</p>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter("Active")}
              className={summaryCardClasses(selectedSummaryFilter === "active", "active")}
            >
              <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Active</p>
              <p className="mt-2 text-2xl font-black text-green-300">{activeRows.length}</p>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter("Inactive")}
              className={summaryCardClasses(selectedSummaryFilter === "inactive", "inactive")}
            >
              <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Inactive</p>
              <p className="mt-2 text-2xl font-black text-neutral-200">{inactiveRows.length}</p>
            </button>

            <div className="rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">PPE Readiness</p>
              <p className="mt-2 text-2xl font-black text-white">
                {formatPpeReadinessPercent(readinessState.readinessPercent)}
              </p>
              <p className="mt-1 text-xs text-neutral-400">
                {readinessState.isRated
                  ? "Based on active PPE and open deficiencies."
                  : "Add active PPE to establish a readiness score."}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0 flex-1">
              <label htmlFor="ppe-search" className="sr-only">
                Search PPE inventory
              </label>
              <input
                id="ppe-search"
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by item name, assigned member, manufacturer, model, serial number, or asset ID"
                className="w-full rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3 text-sm text-white placeholder:text-neutral-500 focus:border-red-500/50 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:min-w-[560px]">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                className="rounded-xl border border-white/10 bg-[#1b1b1b] px-3 py-3 text-sm text-neutral-200 focus:border-red-500/50 focus:outline-none"
              >
                <option value="All">All</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>

              <select
                value={memberFilter}
                onChange={(event) => setMemberFilter(event.target.value)}
                className="rounded-xl border border-white/10 bg-[#1b1b1b] px-3 py-3 text-sm text-neutral-200 focus:border-red-500/50 focus:outline-none"
              >
                <option value="All">All Members</option>
                {memberOptions.map((member) => (
                  <option key={member.id} value={member.id}>{member.label}</option>
                ))}
              </select>

              {canManagePpe ? (
                <button
                  type="button"
                  onClick={openAddForm}
                  className="rounded-xl border border-red-500/40 bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
                >
                  Add PPE Item
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  className="rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3 text-sm font-semibold text-neutral-500"
                >
                  View Only
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-[minmax(0,1fr)_400px] md:items-start">
          <div className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-0 overflow-hidden">
            <div className="h-[calc(8*4rem+3rem)] max-h-[56vh] min-h-[26rem] overflow-y-auto">
              <table className="min-w-full divide-y divide-white/5 text-left">
                <thead className="sticky top-0 z-10 bg-[#242424] text-xs uppercase tracking-[0.14em] text-neutral-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">PPE Item</th>
                    <th className="px-4 py-3 font-semibold">Assigned Member</th>
                    <th className="px-4 py-3 font-semibold">Serial / Asset ID</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredRows.map((row) => (
                    <tr
                      key={row.id}
                      className={`cursor-pointer transition hover:bg-white/[0.02] ${selectedItemId === row.id ? "bg-white/[0.04]" : ""}`}
                      onClick={() => loadDetail(row.id)}
                    >
                      <td className="px-4 py-3 align-top text-sm text-white">
                        <p className="font-semibold">{row.item_name}</p>
                        <p className="mt-1 text-xs text-neutral-400">
                          {[row.manufacturer, row.model].filter(Boolean).join(" • ") || "-"}
                        </p>
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-neutral-300">{row.assigned_member_name || "Unknown Member"}</td>
                      <td className="px-4 py-3 align-top text-sm text-neutral-300">
                        <p>{row.serial_number || "-"}</p>
                        <p className="mt-1 text-xs text-neutral-500">{row.asset_number || "-"}</p>
                      </td>
                      <td className="px-4 py-3 align-top text-sm">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadgeClasses(row.status)}`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredRows.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-neutral-500">
                  No PPE items found for the current filters.
                </div>
              ) : null}
            </div>
          </div>

          <aside className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-5 md:sticky md:top-5">
            <p className="text-xs uppercase tracking-[0.16em] text-neutral-500">PPE Detail</p>

            {!selectedItemId ? (
              <p className="mt-4 text-sm text-neutral-400">
                Select a PPE item to review details.
              </p>
            ) : isDetailLoading ? (
              <p className="mt-4 text-sm text-neutral-400">Loading detail...</p>
            ) : !selectedItem ? (
              <p className="mt-4 text-sm text-neutral-400">No PPE detail available.</p>
            ) : (
              <div className="mt-4 space-y-4">
                {selectedPhotoUrl ? (
                  <img
                    src={selectedPhotoUrl}
                    alt={`${selectedItem.item_name} photo`}
                    className="h-48 w-full rounded-xl border border-white/10 object-cover"
                  />
                ) : (
                  <div className="flex h-40 items-center justify-center rounded-xl border border-white/10 bg-[#1b1b1b] text-xs uppercase tracking-[0.16em] text-neutral-500">
                    No Photo
                  </div>
                )}

                <div>
                  <h3 className="text-xl font-black text-white">{selectedItem.item_name}</h3>
                  <p className="mt-1 text-sm text-neutral-400">Assigned Member: {selectedItem.assigned_member_name || "Unknown Member"}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-neutral-500">Manufacturer</p>
                    <p className="mt-1 text-neutral-200">{selectedItem.manufacturer || "-"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-neutral-500">Model</p>
                    <p className="mt-1 text-neutral-200">{selectedItem.model || "-"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-neutral-500">Serial Number</p>
                    <p className="mt-1 text-neutral-200">{selectedItem.serial_number || "-"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-neutral-500">Asset / ID</p>
                    <p className="mt-1 text-neutral-200">{selectedItem.asset_number || "-"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-neutral-500">Size</p>
                    <p className="mt-1 text-neutral-200">{selectedItem.size || "-"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-neutral-500">Status</p>
                    <p className="mt-1 text-neutral-200">{selectedItem.status}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-neutral-500">Date Manufactured</p>
                    <p className="mt-1 text-neutral-200">{formatDate(selectedItem.date_manufactured)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-neutral-500">Date Placed In Service</p>
                    <p className="mt-1 text-neutral-200">{formatDate(selectedItem.placed_in_service_date)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-neutral-500">Expiration Date</p>
                    <p className="mt-1 text-neutral-200">{formatDate(selectedItem.expiration_date)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-neutral-500">Location</p>
                    <p className="mt-1 text-neutral-200">{selectedItem.location || "-"}</p>
                  </div>
                </div>

                <div>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-neutral-500">Notes</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-300">{selectedItem.notes || "-"}</p>
                </div>

                <div className="rounded-xl border border-white/10 bg-[#1b1b1b] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.12em] text-neutral-500">Deficiencies</p>
                      <p className="mt-1 text-sm font-semibold text-white">Open Deficiencies: {openDeficiencyCount}</p>
                    </div>
                    <button
                      type="button"
                      onClick={launchDeficiencyReport}
                      className="rounded-lg border border-red-500/40 bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700"
                    >
                      Report Deficiency
                    </button>
                  </div>

                  {isDeficienciesLoading ? (
                    <p className="mt-3 text-sm text-neutral-400">Loading deficiencies...</p>
                  ) : openDeficiencies.length === 0 ? (
                    <p className="mt-3 text-sm text-neutral-400">No open deficiencies.</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {openDeficiencies.map((deficiency) => (
                        <button
                          key={deficiency.id}
                          type="button"
                          onClick={() => router.push(`/operations/deficiencies/${deficiency.id}`)}
                          className="w-full rounded-lg border border-white/10 bg-[#202020] p-3 text-left transition hover:bg-[#252525]"
                        >
                          <p className="text-sm font-semibold text-white">
                            {deficiency.description || deficiency.deficiency_number || "Deficiency"}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${deficiencyStatusClasses(deficiency.status_name)}`}>
                              {normalizeDeficiencyStatus(deficiency.status_name)}
                            </span>
                            <span className="text-xs text-neutral-500">{formatDate(deficiency.reported_at)}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {deficiencyHistory.length > 0 ? (
                    <div className="mt-4 border-t border-white/10 pt-3">
                      <p className="text-[11px] uppercase tracking-[0.12em] text-neutral-500">History</p>
                      <div className="mt-2 space-y-2">
                        {deficiencyHistory.map((deficiency) => (
                          <button
                            key={deficiency.id}
                            type="button"
                            onClick={() => router.push(`/operations/deficiencies/${deficiency.id}`)}
                            className="w-full rounded-lg border border-white/10 bg-[#202020] p-3 text-left transition hover:bg-[#252525]"
                          >
                            <p className="text-sm font-semibold text-white">
                              {deficiency.description || deficiency.deficiency_number || "Deficiency"}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${deficiencyStatusClasses(deficiency.status_name)}`}>
                                {normalizeDeficiencyStatus(deficiency.status_name)}
                              </span>
                              <span className="text-xs text-neutral-500">{formatDate(deficiency.reported_at)}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                {canManagePpe ? (
                  <button
                    type="button"
                    onClick={openEditForm}
                    className="w-full rounded-xl border border-white/15 bg-neutral-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800"
                  >
                    Edit PPE
                  </button>
                ) : null}
              </div>
            )}
          </aside>
        </section>
      </div>

      <PpeFormModal
        key={formInstanceKey}
        isOpen={isFormOpen}
        mode={formMode}
        memberOptions={memberOptions}
        initialValues={formInitialValues}
        existingPhotoUrl={selectedPhotoUrl}
        isSaving={isFormSaving}
        canDelete={formMode === "edit" && canManagePpe}
        onClose={closeForm}
        onSave={handleSave}
        onDelete={formMode === "edit" ? handleDelete : undefined}
      />
    </main>
  );
}
