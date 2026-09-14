"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import RopeFormModal, { type RopeFormValues } from "@/components/inventory/RopeFormModal";
import RopeTestingSessionModal, {
  type RopeTestingItem,
  type RopeTestingSessionValues,
} from "@/components/inventory/RopeTestingSessionModal";
import type { RopeApparatusOption } from "@/components/inventory/RopeFormModal";
import { supabase } from "@/lib/supabase";

export type RopeRow = {
  id: string;
  rope_name: string;
  rope_identifier: string;
  rope_type: "Life Safety" | "Utility";
  serial_number: string | null;
  length_ft: number | null;
  diameter_mm: number | null;
  placed_in_service_date: string | null;
  location_type: "Apparatus" | "Station Storage" | "Other";
  apparatus_id: string | null;
  apparatus_name: string | null;
  other_location: string | null;
  status: "Active" | "Inactive" | "Out of Service";
  notes: string | null;
  photo_path: string | null;
  created_at: string;
  updated_at: string;
  last_inspection_date: string | null;
  last_inspection_result: string | null;
  open_deficiency_count?: number | null;
};

type RopeDetailResponse = {
  item: RopeRow;
  photoUrl: string | null;
};

type RopeInspectionRow = {
  id: string;
  inspection_date: string | null;
  result: string | null;
  notes: string | null;
  primary_inspector_name: string | null;
  participant_names: string[];
};

type RopeInspectionsResponse = {
  rows: RopeInspectionRow[];
};

type RopeDeficiencyRow = {
  id: string;
  deficiency_number: string | null;
  description: string | null;
  reported_at: string | null;
  status_name: string | null;
};

type RopeDeficienciesResponse = {
  rows: RopeDeficiencyRow[];
};

type WorkspaceProps = {
  departmentId: string | null;
  departmentName: string | null;
  canManageRope: boolean;
  initialRows: RopeRow[];
  apparatusOptions: RopeApparatusOption[];
  currentMemberId: string;
  currentMemberName: string;
  initialError?: string | null;
};

type StatusFilter = "All" | "Active" | "Inactive" | "Out of Service";
type TypeFilter = "All" | "Life Safety" | "Utility";

const ROPE_TESTING_RESUME_STORAGE_KEY = "rope-testing-resume";

function compareNames(left: string | null | undefined, right: string | null | undefined) {
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

function normalizeApiError(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const error = (payload as { error?: unknown }).error;
  return typeof error === "string" && error.trim() ? error : fallback;
}

function statusBadgeClasses(status: string) {
  if (status === "Active") {
    return "border-green-700/40 bg-green-900/20 text-green-300";
  }

  if (status === "Out of Service") {
    return "border-red-700/40 bg-red-900/20 text-red-300";
  }

  return "border-neutral-600/40 bg-neutral-900 text-neutral-300";
}

function typeBadgeClasses(type: string) {
  if (type === "Life Safety") {
    return "border-red-700/40 bg-red-900/20 text-red-200";
  }

  return "border-amber-700/40 bg-amber-900/20 text-amber-200";
}

function resultBadgeClasses(value: string | null | undefined) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";

  if (normalized === "pass") {
    return "border-green-700/40 bg-green-900/20 text-green-200";
  }

  return "border-red-700/40 bg-red-900/20 text-red-200";
}

function normalizeResultLabel(value: string | null | undefined) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "pass") {
    return "PASS";
  }
  if (normalized === "fail") {
    return "FAIL";
  }

  return value ?? "-";
}

function formatLocation(row: RopeRow) {
  if (row.location_type === "Apparatus") {
    return row.apparatus_name || "Apparatus";
  }

  if (row.location_type === "Other") {
    return row.other_location || "Other";
  }

  return "Station Storage";
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

function toFormValues(row: RopeRow): Omit<RopeFormValues, "photoFile" | "removePhoto"> {
  return {
    ropeName: row.rope_name,
    ropeIdentifier: row.rope_identifier,
    ropeType: row.rope_type,
    serialNumber: row.serial_number ?? "",
    lengthFt: row.length_ft?.toString() ?? "",
    diameterMm: row.diameter_mm?.toString() ?? "",
    placedInServiceDate: row.placed_in_service_date ?? "",
    locationType: row.location_type,
    apparatusId: row.apparatus_id ?? "",
    otherLocation: row.other_location ?? "",
    status: row.status === "Inactive" ? "Inactive" : row.status === "Out of Service" ? "Out of Service" : "Active",
    notes: row.notes ?? "",
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

export default function RopeWorkspace({
  departmentId,
  departmentName,
  canManageRope,
  initialRows,
  apparatusOptions,
  currentMemberId,
  currentMemberName,
  initialError = null,
}: WorkspaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resumeTestingSummary = searchParams.get("resumeTestingSummary") === "1";
  const [rows, setRows] = useState<RopeRow[]>(initialRows);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("All");
  const [toastMessage, setToastMessage] = useState<string | null>(initialError);
  const [testerName, setTesterName] = useState(currentMemberName);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<RopeRow | null>(null);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const [selectedDeficiencies, setSelectedDeficiencies] = useState<RopeDeficiencyRow[]>([]);
  const [selectedInspections, setSelectedInspections] = useState<RopeInspectionRow[]>([]);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isRelatedLoading, setIsRelatedLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [isFormSaving, setIsFormSaving] = useState(false);
  const [formInstanceKey, setFormInstanceKey] = useState(0);
  const [isTestingModalOpen, setIsTestingModalOpen] = useState(false);
  const [resumeTestingValues, setResumeTestingValues] = useState<RopeTestingSessionValues | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadTesterName = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const email = user?.email?.trim();
      if (!email || !isMounted) {
        return;
      }

      const { data } = await supabase
        .from("members")
        .select("first_name, last_name")
        .eq("email", email)
        .maybeSingle();

      if (!isMounted) {
        return;
      }

      const firstName = typeof data?.first_name === "string" ? data.first_name.trim() : "";
      const lastName = typeof data?.last_name === "string" ? data.last_name.trim() : "";
      const fullName = `${firstName} ${lastName}`.trim();
      setTesterName(fullName || email || currentMemberName || "");
    };

    void loadTesterName();

    return () => {
      isMounted = false;
    };
  }, [currentMemberName]);

  useEffect(() => {
    if (!resumeTestingSummary || isTestingModalOpen) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const raw = window.sessionStorage.getItem(ROPE_TESTING_RESUME_STORAGE_KEY);
    if (!raw) {
      router.replace("/inventory/rope");
      return;
    }

    try {
      const parsed = JSON.parse(raw) as RopeTestingSessionValues;
      if (
        typeof parsed.testingDate === "string" &&
        typeof parsed.tester === "string" &&
        parsed.ropeStatuses &&
        typeof parsed.ropeStatuses === "object"
      ) {
        queueMicrotask(() => {
          setResumeTestingValues(parsed);
          setIsTestingModalOpen(true);
        });
      }
    } catch {
      // Ignore malformed resume payload.
    } finally {
      window.sessionStorage.removeItem(ROPE_TESTING_RESUME_STORAGE_KEY);
      router.replace("/inventory/rope");
    }
  }, [isTestingModalOpen, resumeTestingSummary, router]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return rows
      .filter((row) => {
        if (statusFilter !== "All" && row.status !== statusFilter) {
          return false;
        }

        if (typeFilter !== "All" && row.rope_type !== typeFilter) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        const haystack = [
          row.rope_name,
          row.rope_identifier,
          row.serial_number,
          row.placed_in_service_date,
          row.apparatus_name,
          row.other_location,
          row.rope_type,
          row.location_type,
        ]
          .map((value) => (typeof value === "string" ? value.toLowerCase() : ""))
          .join(" ");

        return haystack.includes(normalizedSearch);
      })
      .sort((left, right) => compareNames(left.rope_name, right.rope_name));
  }, [rows, searchTerm, statusFilter, typeFilter]);

  const formInitialValues = formMode === "edit" && selectedItem ? toFormValues(selectedItem) : undefined;

  const openDeficiencyCount = useMemo(
    () => selectedDeficiencies.filter((row) => isOpenDeficiency(row.status_name)).length,
    [selectedDeficiencies],
  );

  const outOfServiceCount = useMemo(
    () => rows.filter((row) => row.status === "Out of Service").length,
    [rows],
  );

  const openDeficiencies = useMemo(
    () => selectedDeficiencies.filter((row) => isOpenDeficiency(row.status_name)),
    [selectedDeficiencies],
  );

  const deficiencyHistory = useMemo(
    () => selectedDeficiencies.filter((row) => !isOpenDeficiency(row.status_name)),
    [selectedDeficiencies],
  );

  const loadDetail = async (itemId: string) => {
    setSelectedItemId(itemId);
    setIsDetailLoading(true);
    setIsRelatedLoading(true);
    setSelectedDeficiencies([]);
    setSelectedInspections([]);

    try {
      const [detailResponse, deficienciesResponse, inspectionsResponse] = await Promise.all([
        fetch(`/api/rope/${itemId}`, { method: "GET" }),
        fetch(`/api/rope/${itemId}/deficiencies`, { method: "GET" }),
        fetch(`/api/rope/${itemId}/inspections`, { method: "GET" }),
      ]);

      const detailPayload = (await detailResponse.json().catch(() => ({}))) as
        | ({ error?: unknown } & Partial<RopeDetailResponse>)
        | null;

      if (!detailResponse.ok || !detailPayload || !detailPayload.item) {
        setToastMessage(normalizeApiError(detailPayload, "Unable to load rope detail."));
        return;
      }

        setRows((current) =>
          current.map((row) =>
            row.id === itemId
              ? {
                  ...row,
                  ...detailPayload.item,
                }
              : row,
          ),
        );
      setSelectedItem(detailPayload.item);
      setSelectedPhotoUrl(typeof detailPayload.photoUrl === "string" ? detailPayload.photoUrl : null);

      const deficienciesPayload = (await deficienciesResponse.json().catch(() => ({}))) as
        | ({ error?: unknown } & Partial<RopeDeficienciesResponse>)
        | null;

      if (deficienciesResponse.ok && deficienciesPayload && Array.isArray(deficienciesPayload.rows)) {
        setSelectedDeficiencies(deficienciesPayload.rows);
        const openCount = deficienciesPayload.rows.filter((row) => isOpenDeficiency(row.status_name)).length;
        setRows((current) =>
          current.map((row) => (row.id === itemId ? { ...row, open_deficiency_count: openCount } : row)),
        );
      }

      const inspectionsPayload = (await inspectionsResponse.json().catch(() => ({}))) as
        | ({ error?: unknown } & Partial<RopeInspectionsResponse>)
        | null;

      if (inspectionsResponse.ok && inspectionsPayload && Array.isArray(inspectionsPayload.rows)) {
        setSelectedInspections(inspectionsPayload.rows);
          const latestInspection = inspectionsPayload.rows[0] ?? null;
          setRows((current) =>
            current.map((row) =>
              row.id === itemId
                ? {
                    ...row,
                    last_inspection_date: typeof latestInspection?.inspection_date === "string"
                      ? latestInspection.inspection_date
                      : null,
                    last_inspection_result: typeof latestInspection?.result === "string"
                      ? latestInspection.result
                      : null,
                  }
                : row,
            ),
          );
      }
    } catch {
      setToastMessage("Unable to load rope detail.");
    } finally {
      setIsRelatedLoading(false);
      setIsDetailLoading(false);
    }
  };

  const openAddForm = () => {
    setFormMode("add");
    setFormInstanceKey((current) => current + 1);
    setIsFormOpen(true);
  };

  const openEditForm = () => {
    if (!selectedItem || !canManageRope) {
      return;
    }

    setFormMode("edit");
    setFormInstanceKey((current) => current + 1);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    if (!isFormSaving) {
      setIsFormOpen(false);
    }
  };

  const saveRope = async (values: RopeFormValues) => {
    if (!canManageRope || isFormSaving) {
      return;
    }

    if (!values.ropeName.trim()) {
      setToastMessage("Rope name is required.");
      return;
    }

    if (!values.ropeIdentifier.trim()) {
      setToastMessage("Rope identifier is required.");
      return;
    }

    if (!values.lengthFt.trim()) {
      setToastMessage("Length (ft) is required.");
      return;
    }

    if (!values.diameterMm.trim()) {
      setToastMessage("Diameter (mm) is required.");
      return;
    }

    const payload = {
      ropeName: values.ropeName,
      ropeIdentifier: values.ropeIdentifier,
      ropeType: values.ropeType,
      serialNumber: values.serialNumber,
      lengthFt: values.lengthFt,
      diameterMm: values.diameterMm,
        placedInServiceDate: values.placedInServiceDate,
        locationType: values.locationType,
        apparatusId: values.apparatusId,
        otherLocation: values.otherLocation,
      status: values.status,
      notes: values.notes,
      removePhoto: values.removePhoto,
      photoUpload: values.photoFile ? await fileToUploadPayload(values.photoFile) : null,
    };

    const isAdd = formMode === "add";
    const endpoint = isAdd ? "/api/rope" : `/api/rope/${selectedItem?.id ?? ""}`;
    const method = isAdd ? "POST" : "PATCH";

    setIsFormSaving(true);

    try {
      const response = await fetch(endpoint, {
        method,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const body = (await response.json().catch(() => ({}))) as {
        item?: RopeRow;
        error?: unknown;
      };

      if (!response.ok || !body.item) {
        setToastMessage(normalizeApiError(body, "Unable to save rope."));
        return;
      }

      const nextItem = body.item;
      setRows((current) => {
        if (isAdd) {
          return [nextItem, ...current].sort((left, right) => compareNames(left.rope_name, right.rope_name));
        }

        return current.map((row) => (row.id === nextItem.id ? nextItem : row));
      });

      setIsFormOpen(false);
      setToastMessage(isAdd ? "Rope added." : "Rope updated.");

      if (!isAdd) {
        await loadDetail(nextItem.id);
      }
    } catch {
      setToastMessage("Unable to save rope.");
    } finally {
      setIsFormSaving(false);
    }
  };

  const deleteRope = async () => {
    if (!selectedItem || !canManageRope || isFormSaving) {
      return;
    }

    const confirmed = window.confirm(`Delete ${selectedItem.rope_name}? This action cannot be undone.`);
    if (!confirmed) {
      return;
    }

    setIsFormSaving(true);

    try {
      const response = await fetch(`/api/rope/${selectedItem.id}`, {
        method: "DELETE",
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: unknown };

      if (!response.ok) {
        setToastMessage(normalizeApiError(payload, "Unable to delete rope."));
        return;
      }

      setRows((current) => current.filter((row) => row.id !== selectedItem.id));
      setSelectedItemId(null);
      setSelectedItem(null);
      setSelectedPhotoUrl(null);
      setSelectedDeficiencies([]);
      setSelectedInspections([]);
      setIsFormOpen(false);
      setToastMessage("Rope deleted.");
    } catch {
      setToastMessage("Unable to delete rope.");
    } finally {
      setIsFormSaving(false);
    }
  };

  const launchDeficiencyReport = () => {
    if (!selectedItem) {
      return;
    }

    const params = new URLSearchParams({
      inventoryCategory: "rope",
      inventoryItemId: selectedItem.id,
      inventoryItemLabel: selectedItem.rope_name,
      returnTo: "/inventory/rope",
    });

    router.push(`/deficiencies/report?${params.toString()}`);
  };

  const openTestingSession = () => {
    setResumeTestingValues(null);
    setIsTestingModalOpen(true);
  };

  const testingRows = useMemo(
    () =>
      rows
        .filter((row) => Boolean(row.id))
        .map((row) => ({
          id: row.id,
          ropeIdentifier: row.rope_identifier,
          ropeName: row.rope_name,
          ropeType: row.rope_type,
          length: `${row.length_ft ?? "-"} ft`,
          serialNumber: row.serial_number,
          location: formatLocation(row),
          hasActiveDeficiency: (row.open_deficiency_count ?? 0) > 0,
        })),
    [rows],
  );

  const hasActiveDeficiencyForRope = async (ropeId: string): Promise<boolean | null> => {
    if (!ropeId) {
      return false;
    }

    const { data: deficiencyRows, error: deficiencyRowsError } = await supabase
      .from("deficiencies")
      .select("id, status_info:deficiency_statuses!fk_deficiencies_status(active)")
      .eq("rope_item_id", ropeId);

    if (deficiencyRowsError) {
      setToastMessage(deficiencyRowsError.message || "Unable to verify linked deficiencies for this rope.");
      return null;
    }

    return (deficiencyRows ?? []).some((record) => {
      const statusInfoRecord = Array.isArray(record.status_info)
        ? record.status_info[0]
        : record.status_info;

      return statusInfoRecord?.active === true;
    });
  };

  const saveTestingSession = async (
    values: RopeTestingSessionValues,
    options?: {
      closeModalOnSuccess?: boolean;
      allowFailedRopesWithoutDeficiencies?: boolean;
    },
  ) => {
    try {
      if (!currentMemberId) {
        setToastMessage("Unable to determine inspector identity. Please refresh and try again.");
        return false;
      }

      const targetRows = rows.filter((row) => {
        const ropeStatus = values.ropeStatuses[row.id] ?? "untested";
        return ropeStatus === "passed" || ropeStatus === "failed";
      });

      if (targetRows.length === 0) {
        setToastMessage("Mark at least one rope as Passed or Failed before saving.");
        return false;
      }

      if (!(options?.allowFailedRopesWithoutDeficiencies ?? false)) {
        const failedRows = targetRows.filter((row) => values.ropeStatuses[row.id] === "failed");
        for (const failedRow of failedRows) {
          const hasActiveDeficiency = await hasActiveDeficiencyForRope(failedRow.id);
          if (hasActiveDeficiency !== true) {
            setToastMessage(
              "Failed ropes require deficiencies. Use Create Deficiencies from the summary to continue.",
            );
            return false;
          }
        }
      }

      if (!departmentId) {
        setToastMessage("Unable to determine the active department for this Rope inspection.");
        return false;
      }

      const testerLabel = values.tester.trim() || testerName || "Unknown Inspector";
      const { data: sessionInsertData, error: sessionInsertError } = await supabase
        .from("rope_testing_sessions")
        .insert({
          department_id: departmentId,
          test_date: values.testingDate,
          tester: testerLabel,
        })
        .select("id")
        .single();

      if (sessionInsertError || !sessionInsertData?.id) {
        setToastMessage(sessionInsertError?.message || "Unable to save inspection session history.");
        return false;
      }

      const testingResultsPayload = targetRows.map((row) => ({
        testing_session_id: sessionInsertData.id,
        department_id: departmentId,
        rope_item_id: row.id,
        rope_identifier: row.rope_identifier,
        test_date: values.testingDate,
        tester: testerLabel,
        result: values.ropeStatuses[row.id] === "failed" ? "fail" : "pass",
      }));

      const { error: resultsInsertError } = await supabase
        .from("rope_testing_results")
        .insert(testingResultsPayload);

      if (resultsInsertError) {
        setToastMessage(resultsInsertError.message || "Unable to save rope inspection result history.");
        return false;
      }

      const { data: insertedResults, error: insertedResultsError } = await supabase
        .from("rope_testing_results")
        .select("rope_item_id, result, tester, testing_session_id")
        .eq("testing_session_id", sessionInsertData.id);

      if (insertedResultsError) {
        setToastMessage(insertedResultsError.message || "Unable to verify saved rope inspection results.");
        return false;
      }

      if ((insertedResults ?? []).length !== testingResultsPayload.length) {
        setToastMessage("Saved rope inspection result count does not match inspected rope count.");
        return false;
      }

      const inspectionsPayload = targetRows.map((row) => ({
        department_id: departmentId,
        rope_item_id: row.id,
        inspection_date: values.testingDate,
        primary_inspector_member_id: currentMemberId,
        result: values.ropeStatuses[row.id] === "failed" ? "fail" : "pass",
      }));

      const { error: inspectionsInsertError } = await supabase
        .from("rope_inspections")
        .insert(inspectionsPayload);

      if (inspectionsInsertError) {
        setToastMessage(inspectionsInsertError.message || "Unable to save rope inspection records.");
        return false;
      }

      setRows((current) =>
        current.map((row) => {
          const currentStatus = values.ropeStatuses[row.id];
          if (currentStatus !== "passed" && currentStatus !== "failed") {
            return row;
          }

          return {
            ...row,
            last_inspection_date: values.testingDate,
            last_inspection_result: currentStatus,
          };
        }),
      );

      if (selectedItemId) {
        await loadDetail(selectedItemId);
      }
      router.refresh();

      if (options?.closeModalOnSuccess ?? true) {
        setIsTestingModalOpen(false);
      }

      setToastMessage(`Successfully inspected ${targetRows.length} ropes.`);
      return true;
    } catch {
      setToastMessage("Unable to save inspection session.");
      return false;
    }
  };

  const createDeficienciesForFailedRopes = async (
    failedRopes: RopeTestingItem[],
    values: RopeTestingSessionValues,
  ) => {
    if (failedRopes.length === 0) {
      return false;
    }

    const saved = await saveTestingSession(values, {
      closeModalOnSuccess: false,
      allowFailedRopesWithoutDeficiencies: true,
    });

    if (!saved) {
      return false;
    }

    const params = new URLSearchParams();
    params.set("returnTo", "/inventory/rope?resumeTestingSummary=1");
    params.set("inventoryCategory", "rope");
    params.set("apparatusId", "station-supply");
    params.set("failedRopeIds", failedRopes.map((rope) => rope.id).join(","));
    params.set("failedIndex", "0");
    params.set("inventoryItemId", failedRopes[0].id);
    params.set("inventoryItemLabel", failedRopes[0].ropeIdentifier || failedRopes[0].ropeName);

    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(ROPE_TESTING_RESUME_STORAGE_KEY, JSON.stringify(values));
    }

    setIsTestingModalOpen(false);
    router.push(`/deficiencies/report?${params.toString()}`);
    return true;
  };

  return (
    <div className="space-y-8">
      {toastMessage ? (
        <div className="fixed right-4 top-4 z-50 rounded-lg border border-red-500/40 bg-[#2E2E2E] px-4 py-3 text-sm text-red-200 shadow-lg">
          <div className="flex items-center gap-3">
            <span>{toastMessage}</span>
            <button type="button" onClick={() => setToastMessage(null)} className="text-red-200/80 transition hover:text-red-100">
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      <section className="rounded-2xl border border-red-900 bg-[#242424] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-red-500">Inventory Module</p>
            <h1 className="mt-2 text-[2.25rem] font-[700] leading-none tracking-[-0.06em] text-white">Rope</h1>
            <p className="mt-2 max-w-3xl text-sm text-neutral-400">Life safety and utility rope inventory with inspection and deficiency visibility.</p>
            <p className="mt-1 text-sm text-neutral-500">{departmentName ? `${departmentName} Rope Management` : "Rope Management"}</p>
          </div>

          <div className="flex w-full items-center justify-end gap-2 lg:w-auto lg:shrink-0">
            <div className="flex items-start gap-2">
              <div className="flex flex-col gap-2">
                {canManageRope ? (
                  <button type="button" onClick={openAddForm} className="inline-flex rounded-lg border border-red-500/40 bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700">
                    Add Rope
                  </button>
                ) : (
                  <button type="button" disabled className="inline-flex rounded-lg border border-white/10 bg-[#1b1b1b] px-3 py-2 text-xs font-semibold text-neutral-500">
                    Add Rope
                  </button>
                )}

                <button
                  type="button"
                  onClick={openTestingSession}
                  className="inline-flex rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
                >
                  Rope Inspection
                </button>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={launchDeficiencyReport}
                  disabled={!selectedItem}
                  className="inline-flex rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Report Deficiency
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/inventory/rope/inspection-history")}
                  className="inline-flex rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
                >
                  Rope Inspection History
                </button>
              </div>
            </div>

            <div className="w-[220px] shrink-0 rounded-xl border border-red-700/30 bg-red-950/20 px-4 py-3 text-left">
              <p className="text-xs uppercase tracking-[0.16em] text-neutral-500">Out of Service</p>
              <p className="mt-2 text-2xl font-black text-white">{outOfServiceCount}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0 flex-1">
            <label htmlFor="rope-search" className="sr-only">Search rope</label>
            <input
              id="rope-search"
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by rope name, identifier, type, serial number, or location"
              className="w-full rounded-xl border border-white/10 bg-[#1b1b1b] px-4 py-3 text-sm text-white placeholder:text-neutral-500 focus:border-red-500/50 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:min-w-[420px]">
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className="rounded-xl border border-white/10 bg-[#1b1b1b] px-3 py-3 text-sm text-neutral-200 focus:border-red-500/50 focus:outline-none">
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Out of Service">Out of Service</option>
            </select>

            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as TypeFilter)} className="rounded-xl border border-white/10 bg-[#1b1b1b] px-3 py-3 text-sm text-neutral-200 focus:border-red-500/50 focus:outline-none">
              <option value="All">All Types</option>
              <option value="Life Safety">Life Safety</option>
              <option value="Utility">Utility</option>
            </select>
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_390px] lg:items-start">
        <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-0">
          <div className="h-[755.5px] overflow-x-auto overflow-y-auto">
            <table className="min-w-full divide-y divide-white/5 text-left">
              <thead className="sticky top-0 z-10 bg-[#242424] text-xs uppercase tracking-[0.14em] text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Rope</th>
                  <th className="px-4 py-3 font-semibold">Asset ID</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredRows.map((row) => (
                  <tr key={row.id} className={`cursor-pointer transition hover:bg-white/[0.02] ${selectedItemId === row.id ? "bg-white/[0.04]" : ""}`} onClick={() => loadDetail(row.id)}>
                    <td className="px-4 py-3 align-top text-sm text-white">
                      <p className="font-semibold">{row.rope_name}</p>
                      <p className="mt-1 text-xs text-neutral-400">{row.serial_number || "-"}</p>
                    </td>
                    <td className="px-4 py-3 align-top text-sm text-neutral-300">
                      <p>{row.rope_identifier}</p>
                      <p className="mt-1 text-xs text-neutral-500">{formatLocation(row)}</p>
                    </td>
                    <td className="px-4 py-3 align-top text-sm">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${typeBadgeClasses(row.rope_type)}`}>{row.rope_type}</span>
                    </td>
                    <td className="px-4 py-3 align-top text-sm">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadgeClasses(row.status)}`}>{row.status}</span>
                      {row.last_inspection_date ? <p className="mt-2 text-xs text-neutral-500">Last inspection {formatDate(row.last_inspection_date)}</p> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredRows.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-neutral-500">No rope found for the current filters.</div>
            ) : null}
          </div>
        </div>

        <aside className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-5 lg:sticky lg:top-5">
          <p className="text-xs uppercase tracking-[0.16em] text-neutral-500">Rope Detail</p>

          {!selectedItemId ? (
            <p className="mt-4 text-sm text-neutral-400">Select a rope item to review details.</p>
          ) : isDetailLoading ? (
            <p className="mt-4 text-sm text-neutral-400">Loading detail...</p>
          ) : !selectedItem ? (
            <p className="mt-4 text-sm text-neutral-400">No rope detail available.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {selectedPhotoUrl ? (
                <Image
                  src={selectedPhotoUrl}
                  alt={`${selectedItem.rope_name} photo`}
                  width={1200}
                  height={720}
                  unoptimized
                  className="h-48 w-full rounded-xl border border-white/10 object-cover"
                />
              ) : (
                <div className="flex h-40 items-center justify-center rounded-xl border border-white/10 bg-[#1b1b1b] text-xs uppercase tracking-[0.16em] text-neutral-500">
                  No Photo
                </div>
              )}

              <div>
                <h3 className="text-xl font-black text-white">{selectedItem.rope_name}</h3>
                <p className="mt-1 text-sm text-neutral-400">{selectedItem.rope_identifier} • {selectedItem.rope_type}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-neutral-500">Identifier</p>
                  <p className="mt-1 text-neutral-200">{selectedItem.rope_identifier}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-neutral-500">Type</p>
                  <p className="mt-1 text-neutral-200">{selectedItem.rope_type}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-neutral-500">Length</p>
                  <p className="mt-1 text-neutral-200">{selectedItem.length_ft ?? "-"} ft</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-neutral-500">Diameter</p>
                  <p className="mt-1 text-neutral-200">{selectedItem.diameter_mm ?? "-"} mm</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-neutral-500">Serial Number</p>
                  <p className="mt-1 text-neutral-200">{selectedItem.serial_number || "-"}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-neutral-500">Date Placed In Service</p>
                  <p className="mt-1 text-neutral-200">{formatDate(selectedItem.placed_in_service_date)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-neutral-500">Location</p>
                  <p className="mt-1 text-neutral-200">{formatLocation(selectedItem)}</p>
                  {selectedItem.location_type === "Apparatus" ? (
                    <p className="mt-1 text-xs text-neutral-500">{selectedItem.apparatus_name || "-"}</p>
                  ) : null}
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-neutral-500">Status</p>
                  <p className="mt-1 text-neutral-200">{selectedItem.status}</p>
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
                  <button type="button" onClick={launchDeficiencyReport} className="rounded-lg border border-red-500/40 bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700">
                    Report Deficiency
                  </button>
                </div>

                {isRelatedLoading ? (
                  <p className="mt-3 text-sm text-neutral-400">Loading related records...</p>
                ) : openDeficiencies.length === 0 ? (
                  <p className="mt-3 text-sm text-neutral-400">No open deficiencies.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {openDeficiencies.map((deficiency) => (
                      <button key={deficiency.id} type="button" onClick={() => router.push(`/operations/deficiencies/${deficiency.id}`)} className="w-full rounded-lg border border-white/10 bg-[#202020] p-3 text-left transition hover:bg-[#252525]">
                        <p className="text-sm font-semibold text-white">{deficiency.description || deficiency.deficiency_number || "Deficiency"}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${deficiencyStatusClasses(deficiency.status_name)}`}>{normalizeDeficiencyStatus(deficiency.status_name)}</span>
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
                        <button key={deficiency.id} type="button" onClick={() => router.push(`/operations/deficiencies/${deficiency.id}`)} className="w-full rounded-lg border border-white/10 bg-[#202020] p-3 text-left transition hover:bg-[#252525]">
                          <p className="text-sm font-semibold text-white">{deficiency.description || deficiency.deficiency_number || "Deficiency"}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${deficiencyStatusClasses(deficiency.status_name)}`}>{normalizeDeficiencyStatus(deficiency.status_name)}</span>
                            <span className="text-xs text-neutral-500">{formatDate(deficiency.reported_at)}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="rounded-xl border border-white/10 bg-[#1b1b1b] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-neutral-500">Inspection History</p>
                    <p className="mt-1 text-sm font-semibold text-white">{selectedInspections.length} Record{selectedInspections.length === 1 ? "" : "s"}</p>
                  </div>
                </div>

                {isRelatedLoading ? (
                  <p className="mt-3 text-sm text-neutral-400">Loading inspections...</p>
                ) : selectedInspections.length === 0 ? (
                  <p className="mt-3 text-sm text-neutral-400">No rope inspections recorded yet.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {selectedInspections.map((inspection) => (
                      <div key={inspection.id} className="rounded-lg border border-white/10 bg-[#202020] p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-white">{formatDate(inspection.inspection_date)}</p>
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${resultBadgeClasses(inspection.result)}`}>{normalizeResultLabel(inspection.result)}</span>
                        </div>
                        <p className="mt-2 text-xs text-neutral-400">Primary inspector: {inspection.primary_inspector_name || "Unknown"}</p>
                        {inspection.participant_names.length > 0 ? (
                          <p className="mt-1 text-xs text-neutral-400">Participants: {inspection.participant_names.join(", ")}</p>
                        ) : null}
                        {inspection.notes ? <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-300">{inspection.notes}</p> : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {canManageRope ? (
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={openEditForm} className="rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800">Edit Rope</button>
                </div>
              ) : null}
            </div>
          )}
        </aside>
      </section>

      {isFormOpen ? (
        <RopeFormModal
          key={formInstanceKey}
          isOpen={isFormOpen}
          mode={formMode}
          initialValues={formInitialValues}
          apparatusOptions={apparatusOptions}
          existingPhotoUrl={selectedPhotoUrl}
          isSaving={isFormSaving}
          canDelete={Boolean(selectedItem && canManageRope && formMode === "edit")}
          onClose={closeForm}
          onSave={saveRope}
          onDelete={formMode === "edit" ? deleteRope : undefined}
        />
      ) : null}

      {isTestingModalOpen ? (
        <RopeTestingSessionModal
          isOpen={isTestingModalOpen}
          defaultTester={testerName || currentMemberName || ""}
          departmentName={departmentName ?? "Department"}
          resumeValues={resumeTestingValues}
          ropes={testingRows}
          onClose={() => {
            setIsTestingModalOpen(false);
            setResumeTestingValues(null);
          }}
          onSave={saveTestingSession}
          onCreateDeficiencies={createDeficienciesForFailedRopes}
        />
      ) : null}
    </div>
  );
}