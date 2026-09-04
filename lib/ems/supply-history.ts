import type { SupabaseClient } from "@supabase/supabase-js";

export type EmsSupplyTransactionType = "Checkout" | "Restock" | "Return" | "Correction";

export type EmsSupplyHistoryFilters = {
  dateFrom?: string | null;
  dateTo?: string | null;
  memberId?: string | null;
  supplyItemId?: string | null;
  transactionType?: string | null;
};

export type EmsSupplyHistoryRow = {
  id: string;
  transactionId: string;
  occurredAt: string;
  performedByMemberId: string | null;
  performedByName: string;
  supplyItemId: string;
  supplyItemName: string;
  supplyItemCategory: string | null;
  transactionType: string;
  quantityChange: number;
  quantityBefore: number;
  quantityAfter: number;
  destination: string | null;
  destinationType: string | null;
  destinationLabel: string | null;
  notes: string | null;
};

type TransactionRelation = {
  id?: unknown;
  transaction_type?: unknown;
  occurred_at?: unknown;
  destination_type?: unknown;
  destination_apparatus_id?: unknown;
  destination_label?: unknown;
  notes?: unknown;
  performed_by_member_id?: unknown;
};

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeDateInput(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const candidate = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) {
    return null;
  }

  const parsed = new Date(`${candidate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return candidate;
}

function startOfDayIso(value: string): string {
  return `${value}T00:00:00.000Z`;
}

function nextDayStartIso(value: string): string {
  const parsed = new Date(`${value}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + 1);
  return parsed.toISOString();
}

function normalizeRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? value[0] ?? null : value;
}

function parseNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function formatMemberName(firstName: string | null, lastName: string | null, fallback: string) {
  const fullName = [firstName, lastName].filter((value) => typeof value === "string" && value.trim()).join(" ").trim();
  return fullName || fallback;
}

export async function fetchEmsSupplyHistory(
  supabase: SupabaseClient,
  departmentId: string,
  filters: EmsSupplyHistoryFilters = {},
): Promise<EmsSupplyHistoryRow[]> {
  const memberId = normalizeText(filters.memberId);
  const supplyItemId = normalizeText(filters.supplyItemId);
  const transactionType = normalizeText(filters.transactionType);
  const dateFrom = normalizeDateInput(filters.dateFrom);
  const dateTo = normalizeDateInput(filters.dateTo);

  let query = supabase
    .from("ems_supply_transaction_items")
    .select(
      "id, supply_item_id, quantity_delta, quantity_before, quantity_after, created_at, transaction:ems_supply_transactions!inner(id, transaction_type, occurred_at, destination_type, destination_apparatus_id, destination_label, notes, performed_by_member_id)",
    )
    .eq("department_id", departmentId)
    .order("created_at", { ascending: false });

  if (supplyItemId && supplyItemId !== "all") {
    query = query.eq("supply_item_id", supplyItemId);
  }

  if (memberId && memberId !== "all") {
    query = query.eq("transaction.performed_by_member_id", memberId);
  }

  if (transactionType && transactionType !== "all") {
    query = query.eq("transaction.transaction_type", transactionType);
  }

  if (dateFrom) {
    query = query.gte("transaction.occurred_at", startOfDayIso(dateFrom));
  }

  if (dateTo) {
    query = query.lt("transaction.occurred_at", nextDayStartIso(dateTo));
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message || "Unable to load EMS supply history.");
  }

  const baseRows = (data ?? []) as Array<{
    id: string;
    supply_item_id: string | null;
    quantity_delta: number | string | null;
    quantity_before: number | string | null;
    quantity_after: number | string | null;
    created_at: string | null;
    transaction: TransactionRelation | TransactionRelation[] | null;
  }>;

  const supplyIds = Array.from(
    new Set(
      baseRows
        .map((row) => normalizeText(row.supply_item_id))
        .filter((value) => value.length > 0),
    ),
  );

  const transactionRows = baseRows
    .map((row) => ({
      ...row,
      transaction: normalizeRelation<TransactionRelation>(row.transaction),
    }))
    .filter((row) => row.transaction !== null);

  const memberIds = Array.from(
    new Set(
      transactionRows
        .map((row) => normalizeText(row.transaction?.performed_by_member_id))
        .filter((value) => value.length > 0),
    ),
  );

  const apparatusIds = Array.from(
    new Set(
      transactionRows
        .map((row) => normalizeText(row.transaction?.destination_apparatus_id))
        .filter((value) => value.length > 0),
    ),
  );

  const [supplyQuery, memberQuery, apparatusQuery] = await Promise.all([
    supplyIds.length > 0
      ? supabase
          .from("ems_supply_items")
          .select("id, item_name, item_category")
          .eq("department_id", departmentId)
          .in("id", supplyIds)
      : Promise.resolve({ data: [], error: null }),
    memberIds.length > 0
      ? supabase
          .from("members")
          .select("id, first_name, last_name")
          .eq("department_id", departmentId)
          .in("id", memberIds)
      : Promise.resolve({ data: [], error: null }),
    apparatusIds.length > 0
      ? supabase
          .from("apparatus")
          .select("id, name")
          .eq("department_id", departmentId)
          .in("id", apparatusIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (supplyQuery.error || memberQuery.error || apparatusQuery.error) {
    throw new Error(
      supplyQuery.error?.message ||
        memberQuery.error?.message ||
        apparatusQuery.error?.message ||
        "Unable to resolve EMS supply history references.",
    );
  }

  const supplyById = new Map(
    ((supplyQuery.data ?? []) as Array<{ id: string; item_name: string | null; item_category: string | null }>).map((row) => [
      row.id,
      {
        name: normalizeText(row.item_name) || "Unknown Supply",
        category: typeof row.item_category === "string" ? row.item_category : null,
      },
    ]),
  );

  const memberNameById = new Map(
    ((memberQuery.data ?? []) as Array<{ id: string; first_name: string | null; last_name: string | null }>).map((row) => [
      row.id,
      formatMemberName(row.first_name, row.last_name, row.id),
    ]),
  );

  const apparatusNameById = new Map(
    ((apparatusQuery.data ?? []) as Array<{ id: string; name: string | null }>).map((row) => [
      row.id,
      normalizeText(row.name) || row.id,
    ]),
  );

  return transactionRows
    .map((row) => {
      const transaction = row.transaction;
      const resolvedSupplyItemId = normalizeText(row.supply_item_id);
      const supply = supplyById.get(resolvedSupplyItemId);
      const performedByMemberId = normalizeText(transaction?.performed_by_member_id) || null;
      const destinationType = normalizeText(transaction?.destination_type) || null;
      const destinationLabel = normalizeText(transaction?.destination_label) || null;
      const destinationApparatusId = normalizeText(transaction?.destination_apparatus_id);
      const destination = destinationType === "Apparatus"
        ? apparatusNameById.get(destinationApparatusId) || "Apparatus"
        : destinationLabel || destinationType;

      return {
        id: String(row.id),
        transactionId: normalizeText(transaction?.id) || String(row.id),
        occurredAt:
          normalizeText(transaction?.occurred_at) ||
          normalizeText(row.created_at) ||
          new Date().toISOString(),
        performedByMemberId,
        performedByName: performedByMemberId
          ? memberNameById.get(performedByMemberId) || performedByMemberId
          : "Unknown Member",
        supplyItemId: resolvedSupplyItemId,
        supplyItemName: supply?.name || "Unknown Supply",
        supplyItemCategory: supply?.category || null,
        transactionType: normalizeText(transaction?.transaction_type) || "Unknown",
        quantityChange: parseNumber(row.quantity_delta),
        quantityBefore: parseNumber(row.quantity_before),
        quantityAfter: parseNumber(row.quantity_after),
        destination,
        destinationType,
        destinationLabel,
        notes: normalizeText(transaction?.notes) || null,
      } satisfies EmsSupplyHistoryRow;
    })
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
}