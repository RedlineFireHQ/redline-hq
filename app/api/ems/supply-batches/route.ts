import { getCurrentMember } from "@/lib/current-member";
import { hasInventoryPermission } from "@/lib/member-permissions";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status });
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const member = await getCurrentMember(supabase);
  if (!member?.departmentId) return json({ error: "Unauthorized" }, 401);

  const { data, error } = await supabase
    .from("ems_supply_batches")
    .select("id, supply_item_id, lot_number, quantity_received, quantity_remaining, expiration_date, received_at, storage_location, notes, created_at, supply_item:ems_supply_items!inner(item_name, unit_of_measure, custom_unit_of_measure)")
    .eq("department_id", member.departmentId)
    .gt("quantity_remaining", 0)
    .order("expiration_date", { ascending: true, nullsFirst: false });

  if (error) return json({ error: error.message }, 400);
  return json({ batches: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const member = await getCurrentMember(supabase);
  if (!member?.departmentId) return json({ error: "Unauthorized" }, 401);

  const allowed = await hasInventoryPermission(
    supabase, member.departmentId, member.role, "ems_supply_management",
  );
  if (!allowed) return json({ error: "You do not have permission to manage EMS supplies." }, 403);

  const payload = await request.json().catch(() => ({})) as Record<string, unknown>;
  const supplyItemId = typeof payload.supplyItemId === "string" ? payload.supplyItemId.trim() : "";
  const quantity = Number(payload.quantity);
  const expirationDate = typeof payload.expirationDate === "string" && payload.expirationDate ? payload.expirationDate : null;
  const lotNumber = typeof payload.lotNumber === "string" ? payload.lotNumber.trim() || null : null;
  const storageLocation = typeof payload.storageLocation === "string" ? payload.storageLocation.trim() || null : null;
  const notes = typeof payload.notes === "string" ? payload.notes.trim() || null : null;

  if (!supplyItemId) return json({ error: "Choose an EMS supply item." }, 400);
  if (!Number.isFinite(quantity) || quantity <= 0) return json({ error: "Quantity must be greater than zero." }, 400);

  const { data, error } = await supabase.rpc("receive_ems_supply_batch", {
    p_supply_item_id: supplyItemId,
    p_quantity: quantity,
    p_expiration_date: expirationDate,
    p_lot_number: lotNumber,
    p_storage_location: storageLocation,
    p_notes: notes,
  });

  if (error) return json({ error: error.message }, 400);
  const row = Array.isArray(data) ? data[0] : data;
  return json({ ok: true, batchId: row?.batch_id, transactionId: row?.transaction_id, quantityOnHand: row?.quantity_after }, 201);
}
