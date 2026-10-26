import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Pediatric Bags data-access layer.
 *
 * All queries are scoped to the active department (resolved server-side via
 * getCurrentMember). The pediatric tables live in a dedicated schema created by
 * the pediatric bags migration; until that migration is applied to a database,
 * the queries fail with a Postgres "undefined_table" (42P01) / PostgREST
 * schema-cache error, which we surface as a graceful "missing schema" state
 * rather than throwing.
 */

export type PediatricBagRow = {
  id: string;
  departmentId: string;
  bagLabel: string;
  displayName: string;
  isActive: boolean;
};

export type PediatricBagsResult =
  | { status: "ok"; bags: PediatricBagRow[] }
  | { status: "missing_schema"; bags: [] }
  | { status: "unavailable"; bags: [] };

/** True when the error indicates the pediatric tables do not exist yet. */
export function isPediatricBagSchemaMissingError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as { code?: unknown; message?: unknown };
  const code = typeof record.code === "string" ? record.code : "";
  const message = typeof record.message === "string" ? record.message.toLowerCase() : "";

  // 42P01 = undefined_table (Postgres). This is the authoritative signal and is
  // sufficient on its own regardless of which pediatric table was queried.
  if (code === "42P01") {
    return true;
  }

  // PostgREST (schema cache) surfaces missing tables as a "Could not find the
  // table 'public.<name>' in the schema cache" error. Match only when a
  // pediatric table is actually the subject, so unrelated errors are not
  // misclassified as "missing schema".
  const mentionsPediatricTable =
    message.includes("pediatric_bags") ||
    message.includes("pediatric_bag_checklist_items") ||
    message.includes("pediatric_bag_checklist_sessions") ||
    message.includes("pediatric_bag_inspections") ||
    message.includes("pediatric_bag_checklist_progress") ||
    message.includes("pediatric_bag_checklist_results");

  return (
    mentionsPediatricTable &&
    (message.includes("does not exist") ||
      message.includes("could not find") ||
      message.includes("schema cache") ||
      message.includes("undefined table"))
  );
}

export async function getPediatricBagsForDepartment(
  client: SupabaseClient,
  departmentId: string | null,
): Promise<PediatricBagsResult> {
  if (!departmentId) {
    return { status: "missing_schema", bags: [] };
  }

  const { data, error } = await client
    .from("pediatric_bags")
    .select("id, department_id, bag_label, display_name, is_active")
    .eq("department_id", departmentId)
    .eq("is_active", true)
    .order("bag_label", { ascending: true });

  if (error) {
    if (isPediatricBagSchemaMissingError(error)) {
      return { status: "missing_schema", bags: [] };
    }

    // Any other failure (auth/invalid key, network, RLS, etc.) is NOT a missing
    // schema — report it as "unavailable" so the UI can tell the difference.
    console.error("[pediatric-bags] bag list load failed", error);
    return { status: "unavailable", bags: [] };
  }

  const bags = (data ?? []).map((row) => {
    const record = row as Record<string, unknown>;
    return {
      id: typeof record.id === "string" ? record.id : "",
      departmentId: typeof record.department_id === "string" ? record.department_id : "",
      bagLabel: typeof record.bag_label === "string" ? record.bag_label : "",
      displayName: typeof record.display_name === "string" ? record.display_name : "Pediatric Bag",
      isActive: record.is_active === true,
    };
  });

  return { status: "ok", bags };
}

// --- Per-bag checklist -------------------------------------------------------

export type PediatricTemplateItemRow = {
  id: string;
  sectionName: string;
  itemLabel: string;
  requiredQuantity: number | null;
  sourceQuantityText: string | null;
  isRequired: boolean;
  displayOrder: number;
};

export type PediatricItemStatus = "checked" | "expired";

export type PediatricProgressRow = {
  checklistItemId: string;
  status: PediatricItemStatus;
};

export type PediatricChecklistData =
  | { status: "ok"; bag: PediatricBagRow; items: PediatricTemplateItemRow[]; progress: PediatricProgressRow[] }
  | { status: "missing_schema" }
  | { status: "not_found" }
  | { status: "forbidden" };

/** Load a single bag scoped to the active department; verify ownership. */
export async function getPediatricBagForDepartment(
  client: SupabaseClient,
  bagId: string,
  departmentId: string | null,
): Promise<PediatricBagRow | "missing_schema" | "not_found" | "forbidden"> {
  if (!departmentId) {
    return "forbidden";
  }

  const { data, error } = await client
    .from("pediatric_bags")
    .select("id, department_id, bag_label, display_name, is_active")
    .eq("id", bagId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    if (isPediatricBagSchemaMissingError(error)) {
      return "missing_schema";
    }
    console.error("[pediatric-bags] bag load failed", error);
    return "not_found";
  }

  if (!data) {
    return "not_found";
  }

  const record = data as Record<string, unknown>;
  const bagDepartmentId = typeof record.department_id === "string" ? record.department_id : "";

  // Ownership: never expose another department's bag.
  if (bagDepartmentId !== departmentId) {
    return "forbidden";
  }

  return {
    id: typeof record.id === "string" ? record.id : "",
    departmentId: bagDepartmentId,
    bagLabel: typeof record.bag_label === "string" ? record.bag_label : "",
    displayName: typeof record.display_name === "string" ? record.display_name : "Pediatric Bag",
    isActive: record.is_active === true,
  };
}

/** Load the shared department template + this member's progress for one bag. */
export async function getPediatricBagChecklist(
  client: SupabaseClient,
  bagId: string,
  departmentId: string | null,
  memberId: string | null,
): Promise<PediatricChecklistData> {
  if (!departmentId || !memberId) {
    return { status: "forbidden" };
  }

  const bag = await getPediatricBagForDepartment(client, bagId, departmentId);
  if (bag === "missing_schema") {
    return { status: "missing_schema" };
  }
  if (bag === "not_found") {
    return { status: "not_found" };
  }
  if (bag === "forbidden") {
    return { status: "forbidden" };
  }

  const [itemsResult, progressResult] = await Promise.all([
    client
      .from("pediatric_bag_checklist_items")
      .select("id, section_name, item_label, required_quantity, source_quantity_text, is_required, display_order")
      .eq("department_id", departmentId)
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true }),
    client
      .from("pediatric_bag_checklist_progress")
      .select("checklist_item_id, status")
      .eq("department_id", departmentId)
      .eq("pediatric_bag_id", bagId)
      .eq("member_id", memberId),
  ]);

  if (itemsResult.error) {
    if (isPediatricBagSchemaMissingError(itemsResult.error)) {
      return { status: "missing_schema" };
    }
    console.error("[pediatric-bags] template load failed", itemsResult.error);
    return { status: "missing_schema" };
  }

  const items: PediatricTemplateItemRow[] = (itemsResult.data ?? []).map((row) => {
    const record = row as Record<string, unknown>;
    return {
      id: typeof record.id === "string" ? record.id : "",
      sectionName: typeof record.section_name === "string" ? record.section_name : "General",
      itemLabel: typeof record.item_label === "string" ? record.item_label : "Item",
      requiredQuantity: typeof record.required_quantity === "number" ? record.required_quantity : null,
      sourceQuantityText: typeof record.source_quantity_text === "string" ? record.source_quantity_text : null,
      isRequired: record.is_required === true,
      displayOrder: typeof record.display_order === "number" ? record.display_order : 0,
    };
  });

  const progress: PediatricProgressRow[] = (progressResult.data ?? []).map((row) => {
    const record = row as Record<string, unknown>;
    return {
      checklistItemId: typeof record.checklist_item_id === "string" ? record.checklist_item_id : "",
      status: (typeof record.status === "string" ? record.status : "checked") as PediatricItemStatus,
    };
  });

  return { status: "ok", bag, items, progress };
}

/** List active members of the active department for the personnel picker. */
export async function getDepartmentMemberOptions(
  client: SupabaseClient,
  departmentId: string | null,
): Promise<Array<{ memberId: string; name: string }>> {
  if (!departmentId) {
    return [];
  }

  const { data, error } = await client
    .from("members")
    .select("id, first_name, last_name")
    .eq("department_id", departmentId)
    .eq("active", true);

  if (error) {
    console.error("[pediatric-bags] member options load failed", error);
    return [];
  }

  return ((data ?? []) as Record<string, unknown>[])
    .map((row) => ({
      memberId: typeof row.id === "string" ? row.id : "",
      name: formatMemberName(row),
    }))
    .filter((row) => row.memberId.length > 0);
}

// --- Inspection history (read-only) -----------------------------------------

export type PediatricInspectionSummaryRow = {
  id: string;
  bagId: string;
  bagLabel: string;
  inspectorName: string;
  status: string;
  createdAt: string | null;
};

export type PediatricInspectionResultRow = {
  sectionName: string;
  itemLabel: string;
  requiredQuantity: number | null;
  sourceQuantityText: string | null;
  resultStatus: string;
  itemOrder: number;
};

export type PediatricInspectionDetail =
  | {
      status: "ok";
      inspection: PediatricInspectionSummaryRow;
      results: PediatricInspectionResultRow[];
      personnel: string[];
    }
  | { status: "missing_schema" }
  | { status: "not_found" }
  | { status: "forbidden" };

function formatMemberName(row: Record<string, unknown>): string {
  const first = typeof row.first_name === "string" ? row.first_name.trim() : "";
  const last = typeof row.last_name === "string" ? row.last_name.trim() : "";
  const full = `${first} ${last}`.trim();
  return full || (typeof row.id === "string" ? row.id : "Unknown");
}

/** List completed inspections for the active department, newest first. */
export async function getPediatricInspectionHistory(
  client: SupabaseClient,
  departmentId: string | null,
): Promise<{ status: "ok"; inspections: PediatricInspectionSummaryRow[] } | { status: "missing_schema"; inspections: [] }> {
  if (!departmentId) {
    return { status: "missing_schema", inspections: [] };
  }

  const { data, error } = await client
    .from("pediatric_bag_inspections")
    .select("id, pediatric_bag_id, member_id, status, created_at")
    .eq("department_id", departmentId)
    .order("created_at", { ascending: false });

  if (error) {
    if (isPediatricBagSchemaMissingError(error)) {
      return { status: "missing_schema", inspections: [] };
    }
    console.error("[pediatric-bags] history load failed", error);
    return { status: "missing_schema", inspections: [] };
  }

  const rows = (data ?? []) as Record<string, unknown>[];
  const bagIds = Array.from(new Set(rows.map((r) => r.pediatric_bag_id).filter((v): v is string => typeof v === "string")));
  const memberIds = Array.from(new Set(rows.map((r) => r.member_id).filter((v): v is string => typeof v === "string")));

  const [bagsRes, membersRes] = await Promise.all([
    bagIds.length > 0
      ? client.from("pediatric_bags").select("id, bag_label").eq("department_id", departmentId).in("id", bagIds)
      : Promise.resolve({ data: [], error: null }),
    memberIds.length > 0
      ? client.from("members").select("id, first_name, last_name").eq("department_id", departmentId).in("id", memberIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const bagLabelById = new Map<string, string>();
  for (const b of (bagsRes.data ?? []) as Record<string, unknown>[]) {
    if (typeof b.id === "string" && typeof b.bag_label === "string") {
      bagLabelById.set(b.id, b.bag_label);
    }
  }

  const memberNameById = new Map<string, string>();
  for (const m of (membersRes.data ?? []) as Record<string, unknown>[]) {
    if (typeof m.id === "string") {
      memberNameById.set(m.id, formatMemberName(m));
    }
  }

  const inspections: PediatricInspectionSummaryRow[] = rows.map((r) => ({
    id: typeof r.id === "string" ? r.id : "",
    bagId: typeof r.pediatric_bag_id === "string" ? r.pediatric_bag_id : "",
    bagLabel: bagLabelById.get(typeof r.pediatric_bag_id === "string" ? r.pediatric_bag_id : "") ?? "?",
    inspectorName: memberNameById.get(typeof r.member_id === "string" ? r.member_id : "") ?? "Unknown",
    status: typeof r.status === "string" ? r.status : "",
    createdAt: typeof r.created_at === "string" ? r.created_at : null,
  }));

  return { status: "ok", inspections };
}

/** Load one inspection's immutable snapshot + personnel, scoped to the department. */
export async function getPediatricInspectionDetail(
  client: SupabaseClient,
  inspectionId: string,
  departmentId: string | null,
): Promise<PediatricInspectionDetail> {
  if (!departmentId) {
    return { status: "forbidden" };
  }

  const { data: inspectionRow, error: inspectionError } = await client
    .from("pediatric_bag_inspections")
    .select("id, pediatric_bag_id, department_id, member_id, status, notes, created_at")
    .eq("id", inspectionId)
    .maybeSingle();

  if (inspectionError) {
    if (isPediatricBagSchemaMissingError(inspectionError)) {
      return { status: "missing_schema" };
    }
    console.error("[pediatric-bags] inspection detail load failed", inspectionError);
    return { status: "not_found" };
  }

  if (!inspectionRow) {
    return { status: "not_found" };
  }

  const record = inspectionRow as Record<string, unknown>;
  // Ownership: never expose another department's inspection.
  if (typeof record.department_id === "string" && record.department_id !== departmentId) {
    return { status: "forbidden" };
  }

  const bagId = typeof record.pediatric_bag_id === "string" ? record.pediatric_bag_id : "";
  const memberId = typeof record.member_id === "string" ? record.member_id : "";

  const [resultsRes, bagRes, memberRes, sessionRes] = await Promise.all([
    client
      .from("pediatric_bag_checklist_results")
      .select("section_name_snapshot, item_label_snapshot, required_quantity_snapshot, source_quantity_text_snapshot, result_status, item_order")
      .eq("department_id", departmentId)
      .eq("inspection_id", inspectionId)
      .order("item_order", { ascending: true }),
    bagId
      ? client.from("pediatric_bags").select("id, bag_label").eq("id", bagId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    memberId
      ? client.from("members").select("id, first_name, last_name").eq("id", memberId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    // Find the session that produced this inspection to read its participants.
    client
      .from("pediatric_bag_checklist_sessions")
      .select("id")
      .eq("completed_inspection_id", inspectionId)
      .maybeSingle(),
  ]);

  const results: PediatricInspectionResultRow[] = ((resultsRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
    sectionName: typeof r.section_name_snapshot === "string" ? r.section_name_snapshot : "General",
    itemLabel: typeof r.item_label_snapshot === "string" ? r.item_label_snapshot : "Item",
    requiredQuantity: typeof r.required_quantity_snapshot === "number" ? r.required_quantity_snapshot : null,
    sourceQuantityText: typeof r.source_quantity_text_snapshot === "string" ? r.source_quantity_text_snapshot : null,
    resultStatus: typeof r.result_status === "string" ? r.result_status : "checked",
    itemOrder: typeof r.item_order === "number" ? r.item_order : 0,
  }));

  const bagLabel =
    bagRes.data && typeof (bagRes.data as Record<string, unknown>).bag_label === "string"
      ? ((bagRes.data as Record<string, unknown>).bag_label as string)
      : "?";

  const inspectorName = memberRes.data ? formatMemberName(memberRes.data as Record<string, unknown>) : "Unknown";

  // Participating personnel from the producing session (inspector first).
  const personnel: string[] = [inspectorName];
  const sessionId =
    sessionRes.data && typeof (sessionRes.data as Record<string, unknown>).id === "string"
      ? ((sessionRes.data as Record<string, unknown>).id as string)
      : null;

  if (sessionId) {
    const { data: participantRows } = await client
      .from("pediatric_bag_check_session_members")
      .select("member_id")
      .eq("session_id", sessionId);

    const participantIds = ((participantRows ?? []) as Record<string, unknown>[])
      .map((r) => r.member_id)
      .filter((v): v is string => typeof v === "string");

    if (participantIds.length > 0) {
      const { data: participantMembers } = await client
        .from("members")
        .select("id, first_name, last_name")
        .eq("department_id", departmentId)
        .in("id", participantIds);

      for (const m of (participantMembers ?? []) as Record<string, unknown>[]) {
        const name = formatMemberName(m);
        if (!personnel.includes(name)) {
          personnel.push(name);
        }
      }
    }
  }

  return {
    status: "ok",
    inspection: {
      id: inspectionId,
      bagId,
      bagLabel,
      inspectorName,
      status: typeof record.status === "string" ? record.status : "",
      createdAt: typeof record.created_at === "string" ? record.created_at : null,
    },
    results,
    personnel,
  };
}

// --- Inspection deletion (administrator-only) -------------------------------

export type PediatricInspectionDeleteResult =
  | { status: "deleted" }
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "unavailable" };

/**
 * Delete a single inspection and its inspection-specific snapshot rows.
 *
 * Active-department scope is enforced here (the inspection must belong to the
 * caller's cookie-derived active department) and enforced again inside the
 * delete_pediatric_bag_inspection RPC (the caller must be an active
 * Administrator member of the inspection's own department). The RPC deletes
 * only pediatric_bag_inspections + pediatric_bag_checklist_results rows for
 * that inspection — never bags, template items, sessions, participants,
 * members, departments, or other inspections.
 */
export async function deletePediatricInspection(
  client: SupabaseClient,
  inspectionId: string,
  departmentId: string | null,
): Promise<PediatricInspectionDeleteResult> {
  if (!departmentId) {
    return { status: "forbidden" };
  }

  const { data: inspectionRow, error: loadError } = await client
    .from("pediatric_bag_inspections")
    .select("id, department_id")
    .eq("id", inspectionId)
    .maybeSingle();

  if (loadError) {
    if (isPediatricBagSchemaMissingError(loadError)) {
      return { status: "unavailable" };
    }
    console.error("[pediatric-bags] inspection delete: load failed", loadError);
    return { status: "unavailable" };
  }

  if (!inspectionRow) {
    return { status: "not_found" };
  }

  const record = inspectionRow as Record<string, unknown>;
  if (typeof record.department_id !== "string" || record.department_id !== departmentId) {
    // Never delete another department's inspection.
    return { status: "forbidden" };
  }

  const { error: rpcError } = await client.rpc("delete_pediatric_bag_inspection", {
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
    console.error("[pediatric-bags] inspection delete RPC failed", rpcError);
    return { status: "unavailable" };
  }

  return { status: "deleted" };
}
