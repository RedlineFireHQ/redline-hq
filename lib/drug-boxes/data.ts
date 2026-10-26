import type { SupabaseClient } from "@supabase/supabase-js";

import { DRUG_BOX_INVENTORY, DRUG_BOX_SECTION_ORDER } from "./inventory";

/**
 * Drug Box inspection data layer (server-backed via Supabase).
 *
 * Every query is scoped to the caller's active department (`departmentId`,
 * resolved server-side via getCurrentMember). The department id is NEVER
 * trusted from the client beyond identifying the active tenant, and RLS on the
 * drug_box_* tables enforces the same scoping at the database. Immutable
 * per-item snapshots (drug_box_checklist_results) are written at completion so
 * history never reflects a later inspection or a template change.
 */

// --- Template ---------------------------------------------------------------

export type DrugTemplateItem = {
  id: string;
  sectionName: string;
  itemLabel: string;
  requiredQuantity: number;
  sourceQuantityText: string;
  displayOrder: number;
};

/** Build the canonical template items from the source-of-truth inventory. */
export function getDrugTemplateItems(): DrugTemplateItem[] {
  return DRUG_BOX_INVENTORY.map(([sectionName, itemLabel, requiredQuantity, sourceQuantityText], index) => ({
    id: `drug-item-${index}`,
    sectionName,
    itemLabel,
    requiredQuantity,
    sourceQuantityText,
    displayOrder: index,
  }));
}

export function getDrugTemplateSections(): Array<{ sectionName: string; items: DrugTemplateItem[] }> {
  const items = getDrugTemplateItems();
  return DRUG_BOX_SECTION_ORDER.map((sectionName) => ({
    sectionName,
    items: items.filter((item) => item.sectionName === sectionName),
  }));
}

// --- Types ------------------------------------------------------------------

export type DrugBoxRecord = {
  id: string;
  departmentId: string;
  squadNumber: string;
  displayName: string;
};

export type DrugInspectionItemSnapshot = {
  itemId: string;
  sectionName: string;
  itemLabel: string;
  requiredQuantity: number;
  sourceQuantityText: string;
  checked: boolean;
  itemOrder: number;
};

export type DrugInspectionRecord = {
  id: string;
  departmentId: string;
  squadNumber: string;
  inspectorMemberId: string;
  inspectorName: string;
  unitNumber: string;
  boxLockNumber: string;
  csLockNumber: string;
  ezIoNumber: string;
  assistingPersonnel: string[];
  createdAt: string; // ISO timestamp — date & time of the completed inspection
  items: DrugInspectionItemSnapshot[];
};

export type DrugInspectionSummary = Omit<DrugInspectionRecord, "items"> & {
  itemCount: number;
  checkedCount: number;
};

export type DrugSchemaState = "ok" | "missing_schema" | "unavailable";

/** True when the error indicates the drug box tables do not exist yet. */
export function isDrugBoxSchemaMissingError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const record = error as { code?: unknown; message?: unknown };
  const code = typeof record.code === "string" ? record.code : "";
  const message = typeof record.message === "string" ? record.message.toLowerCase() : "";
  if (code === "42P01") {
    return true;
  }
  const mentionsDrugTable =
    message.includes("drug_boxes") ||
    message.includes("drug_box_checklist_items") ||
    message.includes("drug_box_inspections") ||
    message.includes("drug_box_checklist_results");
  return (
    mentionsDrugTable &&
    (message.includes("does not exist") ||
      message.includes("could not find") ||
      message.includes("schema cache") ||
      message.includes("undefined table"))
  );
}

// --- Boxes ------------------------------------------------------------------

export async function getDrugBoxes(
  client: SupabaseClient,
  departmentId: string | null,
): Promise<{ status: DrugSchemaState; boxes: DrugBoxRecord[] }> {
  if (!departmentId) {
    return { status: "missing_schema", boxes: [] };
  }

  const { data, error } = await client
    .from("drug_boxes")
    .select("id, department_id, squad_number, display_name")
    .eq("department_id", departmentId)
    .eq("is_active", true)
    .order("squad_number", { ascending: true });

  if (error) {
    if (isDrugBoxSchemaMissingError(error)) {
      return { status: "missing_schema", boxes: [] };
    }
    console.error("[drug-boxes] box list load failed", error);
    return { status: "unavailable", boxes: [] };
  }

  const boxes = ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: typeof row.id === "string" ? row.id : "",
    departmentId: typeof row.department_id === "string" ? row.department_id : "",
    squadNumber: typeof row.squad_number === "string" ? row.squad_number : "",
    displayName: typeof row.display_name === "string" ? row.display_name : "Drug Box",
  }));

  return { status: "ok", boxes };
}

export async function getDrugBox(
  client: SupabaseClient,
  departmentId: string | null,
  boxId: string,
): Promise<DrugBoxRecord | "missing_schema" | "not_found" | "forbidden"> {
  if (!departmentId) {
    return "forbidden";
  }

  const { data, error } = await client
    .from("drug_boxes")
    .select("id, department_id, squad_number, display_name")
    .eq("id", boxId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    if (isDrugBoxSchemaMissingError(error)) {
      return "missing_schema";
    }
    console.error("[drug-boxes] box load failed", error);
    return "not_found";
  }
  if (!data) {
    return "not_found";
  }

  const record = data as Record<string, unknown>;
  const boxDepartmentId = typeof record.department_id === "string" ? record.department_id : "";
  if (boxDepartmentId !== departmentId) {
    return "forbidden";
  }

  return {
    id: typeof record.id === "string" ? record.id : "",
    departmentId: boxDepartmentId,
    squadNumber: typeof record.squad_number === "string" ? record.squad_number : "",
    displayName: typeof record.display_name === "string" ? record.display_name : "Drug Box",
  };
}

// --- Create (complete an inspection) ----------------------------------------

export type CreateDrugInspectionInput = {
  drugBoxId: string;
  squadNumber: string;
  inspectorMemberId: string;
  inspectorName: string;
  unitNumber: string;
  boxLockNumber: string;
  csLockNumber: string;
  ezIoNumber: string;
  assistingPersonnel: string[];
  /** Items marked PASS (present/acceptable). */
  checkedItemIds: ReadonlySet<string>;
  /** Items marked EXPIRED. Persisted as not-present (is_checked=false). */
  expiredItemIds?: ReadonlySet<string>;
};

/**
 * Save a completed inspection as a NEW permanent record plus its immutable
 * per-item snapshot rows. Each call creates a separate inspection (multiple
 * inspections per squad per day are allowed); nothing overwrites a prior one.
 * Scoped to the active department throughout.
 */
export async function createDrugInspection(
  client: SupabaseClient,
  departmentId: string,
  input: CreateDrugInspectionInput,
): Promise<{ status: "ok"; inspectionId: string } | { status: "error"; message: string }> {
  const template = getDrugTemplateItems();

  const { data: inspectionRow, error: inspectionError } = await client
    .from("drug_box_inspections")
    .insert({
      drug_box_id: input.drugBoxId,
      department_id: departmentId,
      member_id: input.inspectorMemberId,
      squad_number: input.squadNumber,
      unit_number: input.unitNumber,
      box_lock_number: input.boxLockNumber,
      cs_lock_number: input.csLockNumber,
      ez_io_number: input.ezIoNumber,
      assisting_personnel: input.assistingPersonnel,
    })
    .select("id")
    .single();

  if (inspectionError || !inspectionRow) {
    console.error("[drug-boxes] inspection insert failed", inspectionError);
    return { status: "error", message: inspectionError?.message || "Unable to save this drug box inspection." };
  }

  const inspectionId = (inspectionRow as Record<string, unknown>).id as string;

  const snapshotRows = template.map((item) => ({
    inspection_id: inspectionId,
    department_id: departmentId,
    drug_box_id: input.drugBoxId,
    section_name_snapshot: item.sectionName,
    item_label_snapshot: item.itemLabel,
    required_quantity_snapshot: item.requiredQuantity,
    source_quantity_text_snapshot: item.sourceQuantityText,
    is_checked: input.checkedItemIds.has(item.id),
    item_order: item.displayOrder,
  }));

  const { error: resultsError } = await client.from("drug_box_checklist_results").insert(snapshotRows);
  if (resultsError) {
    console.error("[drug-boxes] snapshot insert failed", resultsError);
    return { status: "error", message: resultsError.message || "Unable to save the checklist snapshot." };
  }

  return { status: "ok", inspectionId };
}

// --- History ----------------------------------------------------------------

function formatMemberName(row: Record<string, unknown>): string {
  const first = typeof row.first_name === "string" ? row.first_name.trim() : "";
  const last = typeof row.last_name === "string" ? row.last_name.trim() : "";
  const full = `${first} ${last}`.trim();
  return full || (typeof row.id === "string" ? row.id : "Unknown");
}

/** List completed inspections for the active department, newest first. */
export async function getDrugInspections(
  client: SupabaseClient,
  departmentId: string | null,
): Promise<{ status: DrugSchemaState; inspections: DrugInspectionSummary[] }> {
  if (!departmentId) {
    return { status: "missing_schema", inspections: [] };
  }

  const { data, error } = await client
    .from("drug_box_inspections")
    .select("id, department_id, squad_number, member_id, unit_number, box_lock_number, cs_lock_number, ez_io_number, assisting_personnel, created_at")
    .eq("department_id", departmentId)
    .order("created_at", { ascending: false });

  if (error) {
    if (isDrugBoxSchemaMissingError(error)) {
      return { status: "missing_schema", inspections: [] };
    }
    console.error("[drug-boxes] history load failed", error);
    return { status: "unavailable", inspections: [] };
  }

  const rows = (data ?? []) as Record<string, unknown>[];
  const inspectionIds = rows.map((r) => r.id).filter((v): v is string => typeof v === "string");
  const memberIds = Array.from(new Set(rows.map((r) => r.member_id).filter((v): v is string => typeof v === "string")));

  const [membersRes, countsRes] = await Promise.all([
    memberIds.length > 0
      ? client.from("members").select("id, first_name, last_name").eq("department_id", departmentId).in("id", memberIds)
      : Promise.resolve({ data: [], error: null }),
    inspectionIds.length > 0
      ? client
          .from("drug_box_checklist_results")
          .select("inspection_id, is_checked")
          .eq("department_id", departmentId)
          .in("inspection_id", inspectionIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const memberNameById = new Map<string, string>();
  for (const m of (membersRes.data ?? []) as Record<string, unknown>[]) {
    if (typeof m.id === "string") {
      memberNameById.set(m.id, formatMemberName(m));
    }
  }

  const counts = new Map<string, { total: number; checked: number }>();
  for (const r of (countsRes.data ?? []) as Record<string, unknown>[]) {
    const id = typeof r.inspection_id === "string" ? r.inspection_id : "";
    if (!id) continue;
    const current = counts.get(id) ?? { total: 0, checked: 0 };
    current.total += 1;
    if (r.is_checked === true) {
      current.checked += 1;
    }
    counts.set(id, current);
  }

  const inspections: DrugInspectionSummary[] = rows.map((r) => {
    const id = typeof r.id === "string" ? r.id : "";
    const count = counts.get(id) ?? { total: 0, checked: 0 };
    return {
      id,
      departmentId: typeof r.department_id === "string" ? r.department_id : "",
      squadNumber: typeof r.squad_number === "string" ? r.squad_number : "",
      inspectorMemberId: typeof r.member_id === "string" ? r.member_id : "",
      inspectorName: memberNameById.get(typeof r.member_id === "string" ? r.member_id : "") ?? "Unknown",
      unitNumber: typeof r.unit_number === "string" ? r.unit_number : "",
      boxLockNumber: typeof r.box_lock_number === "string" ? r.box_lock_number : "",
      csLockNumber: typeof r.cs_lock_number === "string" ? r.cs_lock_number : "",
      ezIoNumber: typeof r.ez_io_number === "string" ? r.ez_io_number : "",
      assistingPersonnel: Array.isArray(r.assisting_personnel)
        ? (r.assisting_personnel as unknown[]).filter((v): v is string => typeof v === "string")
        : [],
      createdAt: typeof r.created_at === "string" ? r.created_at : "",
      itemCount: count.total,
      checkedCount: count.checked,
    };
  });

  return { status: "ok", inspections };
}

/** Load one inspection's immutable snapshot, scoped to the active department. */
export async function getDrugInspection(
  client: SupabaseClient,
  departmentId: string | null,
  inspectionId: string,
): Promise<
  | { status: "ok"; inspection: DrugInspectionRecord }
  | { status: "missing_schema" }
  | { status: "not_found" }
  | { status: "forbidden" }
> {
  if (!departmentId) {
    return { status: "forbidden" };
  }

  const { data: inspectionRow, error: inspectionError } = await client
    .from("drug_box_inspections")
    .select("id, department_id, squad_number, member_id, unit_number, box_lock_number, cs_lock_number, ez_io_number, assisting_personnel, created_at")
    .eq("id", inspectionId)
    .maybeSingle();

  if (inspectionError) {
    if (isDrugBoxSchemaMissingError(inspectionError)) {
      return { status: "missing_schema" };
    }
    console.error("[drug-boxes] inspection detail load failed", inspectionError);
    return { status: "not_found" };
  }
  if (!inspectionRow) {
    return { status: "not_found" };
  }

  const record = inspectionRow as Record<string, unknown>;
  if (typeof record.department_id === "string" && record.department_id !== departmentId) {
    return { status: "forbidden" };
  }

  const memberId = typeof record.member_id === "string" ? record.member_id : "";
  const [resultsRes, memberRes] = await Promise.all([
    client
      .from("drug_box_checklist_results")
      .select("checklist_item_id, section_name_snapshot, item_label_snapshot, required_quantity_snapshot, source_quantity_text_snapshot, is_checked, item_order")
      .eq("department_id", departmentId)
      .eq("inspection_id", inspectionId)
      .order("item_order", { ascending: true }),
    memberId
      ? client.from("members").select("id, first_name, last_name").eq("id", memberId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const items: DrugInspectionItemSnapshot[] = ((resultsRes.data ?? []) as Record<string, unknown>[]).map((r, index) => ({
    itemId: typeof r.checklist_item_id === "string" ? r.checklist_item_id : `snapshot-${index}`,
    sectionName: typeof r.section_name_snapshot === "string" ? r.section_name_snapshot : "General",
    itemLabel: typeof r.item_label_snapshot === "string" ? r.item_label_snapshot : "Item",
    requiredQuantity: typeof r.required_quantity_snapshot === "number" ? r.required_quantity_snapshot : 1,
    sourceQuantityText: typeof r.source_quantity_text_snapshot === "string" ? r.source_quantity_text_snapshot : "",
    checked: r.is_checked === true,
    itemOrder: typeof r.item_order === "number" ? r.item_order : index,
  }));

  const inspectorName = memberRes.data ? formatMemberName(memberRes.data as Record<string, unknown>) : "Unknown";

  return {
    status: "ok",
    inspection: {
      id: inspectionId,
      departmentId: typeof record.department_id === "string" ? record.department_id : "",
      squadNumber: typeof record.squad_number === "string" ? record.squad_number : "",
      inspectorMemberId: memberId,
      inspectorName,
      unitNumber: typeof record.unit_number === "string" ? record.unit_number : "",
      boxLockNumber: typeof record.box_lock_number === "string" ? record.box_lock_number : "",
      csLockNumber: typeof record.cs_lock_number === "string" ? record.cs_lock_number : "",
      ezIoNumber: typeof record.ez_io_number === "string" ? record.ez_io_number : "",
      assistingPersonnel: Array.isArray(record.assisting_personnel)
        ? (record.assisting_personnel as unknown[]).filter((v): v is string => typeof v === "string")
        : [],
      createdAt: typeof record.created_at === "string" ? record.created_at : "",
      items,
    },
  };
}

// --- Deletion (administrator-only) ------------------------------------------

export type DrugInspectionDeleteResult =
  | { status: "deleted" }
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "unavailable" };

/**
 * Delete a single inspection and its snapshot rows. Active-department scope is
 * enforced here (the inspection must belong to the caller's active department)
 * and again inside the delete_drug_box_inspection RPC (the caller must be an
 * active Administrator member of the inspection's own department).
 */
export async function deleteDrugInspection(
  client: SupabaseClient,
  inspectionId: string,
  departmentId: string | null,
): Promise<DrugInspectionDeleteResult> {
  if (!departmentId) {
    return { status: "forbidden" };
  }

  const { data: inspectionRow, error: loadError } = await client
    .from("drug_box_inspections")
    .select("id, department_id")
    .eq("id", inspectionId)
    .maybeSingle();

  if (loadError) {
    if (isDrugBoxSchemaMissingError(loadError)) {
      return { status: "unavailable" };
    }
    console.error("[drug-boxes] inspection delete: load failed", loadError);
    return { status: "unavailable" };
  }

  if (!inspectionRow) {
    return { status: "not_found" };
  }

  const record = inspectionRow as Record<string, unknown>;
  if (typeof record.department_id !== "string" || record.department_id !== departmentId) {
    return { status: "forbidden" };
  }

  const { error: rpcError } = await client.rpc("delete_drug_box_inspection", {
    p_inspection_id: inspectionId,
  });

  if (rpcError) {
    const message = (typeof rpcError.message === "string" ? rpcError.message : "").toLowerCase();
    if (message.includes("not found")) {
      return { status: "not_found" };
    }
    if (message.includes("administrator") || message.includes("requesting member")) {
      return { status: "forbidden" };
    }
    console.error("[drug-boxes] inspection delete RPC failed", rpcError);
    return { status: "unavailable" };
  }

  return { status: "deleted" };
}
