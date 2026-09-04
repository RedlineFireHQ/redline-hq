import { getCurrentMember } from "@/lib/current-member";
import { hasDepartmentPermission } from "@/lib/member-permissions";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type UpdateSupplyPayload = {
  itemName?: unknown;
  itemCategory?: unknown;
  unitOfMeasure?: unknown;
  customUnitOfMeasure?: unknown;
  reorderThreshold?: unknown;
  criticalThreshold?: unknown;
  location?: unknown;
  notes?: unknown;
  status?: unknown;
};

type AllowedUnit =
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

const ALLOWED_UNITS = new Set<AllowedUnit>([
  "each",
  "box",
  "bag",
  "case",
  "bottle",
  "vial",
  "pair",
  "roll",
  "kit",
  "liter",
  "milliliter",
  "custom",
]);

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createSupabaseServerClient();
    const currentMember = await getCurrentMember(supabase);

    if (!currentMember?.departmentId) {
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    }

    const { data: item, error: itemError } = await supabase
      .from("ems_supply_items")
      .select(
        "id, item_name, item_category, unit_of_measure, custom_unit_of_measure, quantity_on_hand, reorder_threshold, critical_threshold, target_quantity, location, notes, status, qr_identifier, created_at, updated_at",
      )
      .eq("id", id)
      .eq("department_id", currentMember.departmentId)
      .maybeSingle();

    if (itemError) {
      return jsonResponse({ ok: false, error: itemError.message || "Unable to load EMS supply." }, 400);
    }

    if (!item) {
      return jsonResponse({ ok: false, error: "Supply item not found." }, 404);
    }

    const { data: activityRows, error: activityError } = await supabase
      .from("ems_supply_transaction_items")
      .select(
        "id, quantity_delta, quantity_before, quantity_after, unit_of_measure, created_at, transaction:ems_supply_transactions!inner(transaction_type, occurred_at, destination_type, destination_label, notes, performed_by_member_id, performed_by:members!ems_supply_transactions_performed_by_member_id_fkey(first_name, last_name))",
      )
      .eq("supply_item_id", id)
      .eq("department_id", currentMember.departmentId)
      .order("created_at", { ascending: false })
      .limit(12);

    if (activityError) {
      return jsonResponse({ ok: false, error: activityError.message || "Unable to load activity." }, 400);
    }

    const recentActivity = (activityRows ?? []).map((row) => {
      const transaction = Array.isArray(row.transaction) ? row.transaction[0] : row.transaction;
      const performer = Array.isArray(transaction?.performed_by)
        ? transaction?.performed_by[0]
        : transaction?.performed_by;
      const firstName = typeof performer?.first_name === "string" ? performer.first_name.trim() : "";
      const lastName = typeof performer?.last_name === "string" ? performer.last_name.trim() : "";
      const performerName = `${firstName} ${lastName}`.trim() || "Unknown Member";

      return {
        id: String(row.id),
        transactionType:
          typeof transaction?.transaction_type === "string" ? transaction.transaction_type : "Unknown",
        occurredAt:
          typeof transaction?.occurred_at === "string"
            ? transaction.occurred_at
            : typeof row.created_at === "string"
              ? row.created_at
              : new Date().toISOString(),
        quantityDelta: Number(row.quantity_delta ?? 0),
        quantityBefore: Number(row.quantity_before ?? 0),
        quantityAfter: Number(row.quantity_after ?? 0),
        performerName,
        destinationType:
          typeof transaction?.destination_type === "string" ? transaction.destination_type : null,
        destinationLabel:
          typeof transaction?.destination_label === "string" ? transaction.destination_label : null,
        notes: typeof transaction?.notes === "string" ? transaction.notes : null,
      };
    });

    return jsonResponse({
      ok: true,
      item,
      recentActivity,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load EMS supply.";
    return jsonResponse({ ok: false, error: message }, 400);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const payload = (await request.json().catch(() => ({}))) as UpdateSupplyPayload;

    const supabase = await createSupabaseServerClient();
    const currentMember = await getCurrentMember(supabase);

    if (!currentMember?.departmentId) {
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    }

    const canManageInventory = await hasDepartmentPermission(
      supabase,
      currentMember.departmentId,
      currentMember.role,
      "inventory_management",
    );

    if (!canManageInventory) {
      return jsonResponse({ ok: false, error: "Forbidden" }, 403);
    }

    const itemName = asTrimmedString(payload.itemName);
    const unitOfMeasureRaw = asTrimmedString(payload.unitOfMeasure).toLowerCase() as AllowedUnit;
    const customUnitOfMeasure = asTrimmedString(payload.customUnitOfMeasure) || null;
    const reorderThreshold = parseOptionalNumber(payload.reorderThreshold);
    const criticalThreshold = parseOptionalNumber(payload.criticalThreshold);
    const location = asTrimmedString(payload.location) || null;
    const notes = asTrimmedString(payload.notes) || null;
    const status = asTrimmedString(payload.status) === "Inactive" ? "Inactive" : "Active";

    if (!itemName) {
      return jsonResponse({ ok: false, error: "Item name is required." }, 400);
    }

    if (!ALLOWED_UNITS.has(unitOfMeasureRaw)) {
      return jsonResponse({ ok: false, error: "Invalid unit of measure." }, 400);
    }

    if (unitOfMeasureRaw === "custom" && !customUnitOfMeasure) {
      return jsonResponse({ ok: false, error: "Custom unit is required." }, 400);
    }

    if (reorderThreshold === null || reorderThreshold < 0) {
      return jsonResponse({ ok: false, error: "Reorder threshold is required." }, 400);
    }

    if (criticalThreshold !== null && criticalThreshold < 0) {
      return jsonResponse({ ok: false, error: "Critical threshold cannot be negative." }, 400);
    }

    const { data, error } = await supabase
      .from("ems_supply_items")
      .update({
        item_name: itemName,
        unit_of_measure: unitOfMeasureRaw,
        custom_unit_of_measure: unitOfMeasureRaw === "custom" ? customUnitOfMeasure : null,
        reorder_threshold: reorderThreshold,
        critical_threshold: criticalThreshold,
        location,
        notes,
        status,
        updated_by_member_id: currentMember.id,
      })
      .eq("id", id)
      .eq("department_id", currentMember.departmentId)
      .select(
        "id, item_name, item_category, unit_of_measure, custom_unit_of_measure, quantity_on_hand, reorder_threshold, critical_threshold, target_quantity, location, notes, status, qr_identifier, created_at, updated_at",
      )
      .single();

    if (error || !data) {
      return jsonResponse({ ok: false, error: error?.message || "Unable to update EMS supply." }, 400);
    }

    return jsonResponse({ ok: true, item: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update EMS supply.";
    return jsonResponse({ ok: false, error: message }, 400);
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createSupabaseServerClient();
    const currentMember = await getCurrentMember(supabase);

    if (!currentMember?.departmentId) {
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    }

    const canManageInventory = await hasDepartmentPermission(
      supabase,
      currentMember.departmentId,
      currentMember.role,
      "inventory_management",
    );

    if (!canManageInventory) {
      return jsonResponse({ ok: false, error: "Forbidden" }, 403);
    }

    const { data: existingItem, error: existingError } = await supabase
      .from("ems_supply_items")
      .select("id")
      .eq("id", id)
      .eq("department_id", currentMember.departmentId)
      .maybeSingle();

    if (existingError) {
      return jsonResponse({ ok: false, error: existingError.message || "Unable to delete item." }, 400);
    }

    if (!existingItem) {
      return jsonResponse({ ok: false, error: "Supply item not found." }, 404);
    }

    const [{ count: transactionItemsCount, error: transactionError }, { count: adjustmentCount, error: adjustmentError }] = await Promise.all([
      supabase
        .from("ems_supply_transaction_items")
        .select("id", { count: "exact", head: true })
        .eq("department_id", currentMember.departmentId)
        .eq("supply_item_id", id),
      supabase
        .from("ems_supply_adjustments")
        .select("id", { count: "exact", head: true })
        .eq("department_id", currentMember.departmentId)
        .eq("supply_item_id", id),
    ]);

    if (transactionError || adjustmentError) {
      return jsonResponse(
        {
          ok: false,
          error:
            transactionError?.message || adjustmentError?.message || "Unable to verify item history.",
        },
        400,
      );
    }

    if ((transactionItemsCount ?? 0) > 0 || (adjustmentCount ?? 0) > 0) {
      return jsonResponse(
        {
          ok: false,
          error:
            "This supply item has transaction history and cannot be hard-deleted. Mark it inactive instead.",
        },
        409,
      );
    }

    const { error: deleteError } = await supabase
      .from("ems_supply_items")
      .delete()
      .eq("id", id)
      .eq("department_id", currentMember.departmentId);

    if (deleteError) {
      return jsonResponse({ ok: false, error: deleteError.message || "Unable to delete item." }, 400);
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete item.";
    return jsonResponse({ ok: false, error: message }, 400);
  }
}
