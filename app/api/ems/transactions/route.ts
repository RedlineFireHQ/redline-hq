import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getCurrentMember } from "@/lib/current-member";

type CheckoutLikeItem = {
  supplyItemId?: unknown;
  quantity?: unknown;
};

type BaseTransactionPayload = {
  transactionType?: unknown;
  destinationType?: unknown;
  destinationApparatusId?: unknown;
  destinationLabel?: unknown;
  notes?: unknown;
};

type CheckoutLikePayload = BaseTransactionPayload & {
  items?: unknown;
};

type CorrectionPayload = BaseTransactionPayload & {
  supplyItemId?: unknown;
  newQuantity?: unknown;
  reason?: unknown;
};

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

function parseNumber(value: unknown): number | null {
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

function isElevatedRole(role: unknown): boolean {
  return role === "administrator" || role === "officer";
}

function errorStatusFromMessage(message: string): number {
  const lowered = message.toLowerCase();

  if (lowered.includes("unauthorized")) {
    return 401;
  }

  if (lowered.includes("administrator privileges required") || lowered.startsWith("forbidden")) {
    return 403;
  }

  return 400;
}

export async function POST(request: Request) {
  try {
    const payload = ((await request.json().catch(() => ({}))) ?? {}) as
      | CheckoutLikePayload
      | CorrectionPayload;

    const transactionType = asTrimmedString(payload.transactionType);

    if (!transactionType) {
      return jsonResponse({ ok: false, error: "Transaction type is required." }, 400);
    }

    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    }

    const currentMember = await getCurrentMember(supabase);

    if (!currentMember?.departmentId) {
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    }

    if (transactionType === "Correction") {
      if (!isElevatedRole(currentMember.role)) {
        return jsonResponse({ ok: false, error: "Forbidden" }, 403);
      }

      const correctionPayload = payload as CorrectionPayload;
      const supplyItemId = asTrimmedString(correctionPayload.supplyItemId);
      const reason = asTrimmedString(correctionPayload.reason);
      const newQuantity = parseNumber(correctionPayload.newQuantity);
      const notes = asTrimmedString(correctionPayload.notes) || null;

      if (!supplyItemId) {
        return jsonResponse({ ok: false, error: "Supply item id is required." }, 400);
      }

      if (newQuantity === null) {
        return jsonResponse({ ok: false, error: "New quantity is required." }, 400);
      }

      if (!reason) {
        return jsonResponse({ ok: false, error: "Adjustment reason is required." }, 400);
      }

      const { data, error } = await supabase.rpc("apply_ems_supply_correction", {
        p_supply_item_id: supplyItemId,
        p_new_quantity: newQuantity,
        p_reason: reason,
        p_notes: notes,
      });

      if (error) {
        const message = error.message || "Unable to apply correction transaction.";
        return jsonResponse({ ok: false, error: message }, errorStatusFromMessage(message));
      }

      const row = Array.isArray(data) ? data[0] : data;

      return jsonResponse({
        ok: true,
        transactionType,
        transaction: row,
      });
    }

    if (transactionType !== "Checkout" && transactionType !== "Restock" && transactionType !== "Return") {
      return jsonResponse({ ok: false, error: "Invalid transaction type." }, 400);
    }

    if ((transactionType === "Restock" || transactionType === "Return") && !isElevatedRole(currentMember.role)) {
      return jsonResponse({ ok: false, error: "Forbidden" }, 403);
    }

    const checkoutPayload = payload as CheckoutLikePayload;
    const items = Array.isArray(checkoutPayload.items) ? checkoutPayload.items : null;

    if (!items || items.length === 0) {
      return jsonResponse({ ok: false, error: "At least one supply item is required." }, 400);
    }

    const normalizedItems = items.map((item) => {
      const candidate = (item ?? {}) as CheckoutLikeItem;
      return {
        supply_item_id: asTrimmedString(candidate.supplyItemId),
        quantity: parseNumber(candidate.quantity),
      };
    });

    for (const item of normalizedItems) {
      if (!item.supply_item_id) {
        return jsonResponse({ ok: false, error: "Supply item id is required." }, 400);
      }

      if (item.quantity === null) {
        return jsonResponse({ ok: false, error: "Quantity is required." }, 400);
      }
    }

    const destinationType = asTrimmedString(checkoutPayload.destinationType) || null;
    const destinationApparatusId = asTrimmedString(checkoutPayload.destinationApparatusId) || null;
    const destinationLabel = asTrimmedString(checkoutPayload.destinationLabel) || null;
    const notes = asTrimmedString(checkoutPayload.notes) || null;

    const { data, error } = await supabase.rpc("apply_ems_supply_transaction", {
      p_transaction_type: transactionType,
      p_items: normalizedItems,
      p_destination_type: destinationType,
      p_destination_apparatus_id: destinationApparatusId,
      p_destination_label: destinationLabel,
      p_notes: notes,
    });

    if (error) {
      const message = error.message || "Unable to apply EMS transaction.";
      return jsonResponse({ ok: false, error: message }, errorStatusFromMessage(message));
    }

    const row = Array.isArray(data) ? data[0] : data;

    return jsonResponse({
      ok: true,
      transactionType,
      transaction: row,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to apply EMS transaction.";
    return jsonResponse({ ok: false, error: message }, 400);
  }
}
