import { getCurrentMember } from "@/lib/current-member";
import { hasInventoryPermission } from "@/lib/member-permissions";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type CreateSupplyPayload = {
  itemName?: unknown;
  itemCategory?: unknown;
  unitOfMeasure?: unknown;
  customUnitOfMeasure?: unknown;
  startingQuantity?: unknown;
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

async function buildUniqueQrIdentifier(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = `EMS-SUP-${crypto.randomUUID().replace(/-/g, "").slice(0, 18).toUpperCase()}`;
    const { data, error } = await supabase
      .from("ems_supply_items")
      .select("id")
      .eq("qr_identifier", candidate)
      .maybeSingle();

    if (error) {
      continue;
    }

    if (!data) {
      return candidate;
    }
  }

  throw new Error("Unable to generate unique QR identifier.");
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const currentMember = await getCurrentMember(supabase);

    if (!currentMember?.departmentId) {
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    }

    const { data, error } = await supabase
      .from("ems_supply_items")
      .select(
        "id, item_name, item_category, unit_of_measure, custom_unit_of_measure, quantity_on_hand, reorder_threshold, critical_threshold, target_quantity, location, notes, status, qr_identifier, created_at, updated_at",
      )
      .eq("department_id", currentMember.departmentId)
      .order("status", { ascending: true })
      .order("item_name", { ascending: true });

    if (error) {
      return jsonResponse({ ok: false, error: error.message || "Unable to load EMS supplies." }, 400);
    }

    return jsonResponse({ ok: true, rows: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load EMS supplies.";
    return jsonResponse({ ok: false, error: message }, 400);
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as CreateSupplyPayload;
    const supabase = await createSupabaseServerClient();
    const currentMember = await getCurrentMember(supabase);

    if (!currentMember?.departmentId) {
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    }

    const canManageInventory = await hasInventoryPermission(
      supabase,
      currentMember.departmentId,
      currentMember.role,
      "ems_supply_management",
    );

    if (!canManageInventory) {
      return jsonResponse({ ok: false, error: "Forbidden" }, 403);
    }

    const itemName = asTrimmedString(payload.itemName);
    const unitOfMeasureRaw = asTrimmedString(payload.unitOfMeasure).toLowerCase() as AllowedUnit;
    const customUnitOfMeasure = asTrimmedString(payload.customUnitOfMeasure) || null;
    const location = asTrimmedString(payload.location) || null;
    const notes = asTrimmedString(payload.notes) || null;
    const status = asTrimmedString(payload.status) === "Inactive" ? "Inactive" : "Active";

    const startingQuantity = parseOptionalNumber(payload.startingQuantity);
    const reorderThreshold = parseOptionalNumber(payload.reorderThreshold);
    const criticalThreshold = parseOptionalNumber(payload.criticalThreshold);

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

    if (startingQuantity === null || startingQuantity < 0) {
      return jsonResponse({ ok: false, error: "Starting quantity is required." }, 400);
    }

    if (criticalThreshold !== null && criticalThreshold < 0) {
      return jsonResponse({ ok: false, error: "Critical threshold cannot be negative." }, 400);
    }

    const qrIdentifier = await buildUniqueQrIdentifier(supabase);

    const { data: insertedItem, error: insertError } = await supabase
      .from("ems_supply_items")
      .insert({
        department_id: currentMember.departmentId,
        item_name: itemName,
        item_category: null,
        unit_of_measure: unitOfMeasureRaw,
        custom_unit_of_measure: unitOfMeasureRaw === "custom" ? customUnitOfMeasure : null,
        quantity_on_hand: 0,
        reorder_threshold: reorderThreshold,
        critical_threshold: criticalThreshold,
        location,
        notes,
        status,
        qr_identifier: qrIdentifier,
        created_by_member_id: currentMember.id,
        updated_by_member_id: currentMember.id,
      })
      .select(
        "id, item_name, item_category, unit_of_measure, custom_unit_of_measure, quantity_on_hand, reorder_threshold, critical_threshold, target_quantity, location, notes, status, qr_identifier, created_at, updated_at",
      )
      .single();

    if (insertError || !insertedItem) {
      return jsonResponse({ ok: false, error: insertError?.message || "Unable to create EMS supply." }, 400);
    }

    if (startingQuantity > 0) {
      const { error: restockError } = await supabase.rpc("apply_ems_supply_transaction", {
        p_transaction_type: "Restock",
        p_items: [
          {
            supply_item_id: insertedItem.id,
            quantity: startingQuantity,
          },
        ],
        p_destination_type: "SupplyRoom",
        p_destination_apparatus_id: null,
        p_destination_label: "Initial Stock",
        p_notes: "Initial quantity established during item creation.",
      });

      if (restockError) {
        await supabase
          .from("ems_supply_items")
          .delete()
          .eq("id", insertedItem.id)
          .eq("department_id", currentMember.departmentId);

        return jsonResponse(
          {
            ok: false,
            error: restockError.message || "Unable to establish initial quantity through transaction history.",
          },
          400,
        );
      }
    }

    const { data: finalRow, error: readbackError } = await supabase
      .from("ems_supply_items")
      .select(
        "id, item_name, item_category, unit_of_measure, custom_unit_of_measure, quantity_on_hand, reorder_threshold, critical_threshold, target_quantity, location, notes, status, qr_identifier, created_at, updated_at",
      )
      .eq("id", insertedItem.id)
      .eq("department_id", currentMember.departmentId)
      .single();

    if (readbackError || !finalRow) {
      return jsonResponse({ ok: false, error: readbackError?.message || "Unable to load created item." }, 400);
    }

    return jsonResponse({
      ok: true,
      item: finalRow,
      qrIdentifier,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create EMS supply.";
    return jsonResponse({ ok: false, error: message }, 400);
  }
}
