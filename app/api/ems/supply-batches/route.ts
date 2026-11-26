import { getCurrentMember } from "@/lib/current-member";
import { hasDepartmentPermission } from "@/lib/member-permissions";
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

  const allowed = await hasDepartmentPermission(
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

  const { data: item, error: itemError } = await supabase
    .from("ems_supply_items")
    .select("id, quantity_on_hand")
    .eq("id", supplyItemId)
    .eq("department_id", member.departmentId)
    .maybeSingle();
  if (itemError || !item) return json({ error: itemError?.message || "Supply item not found in this department." }, 404);

  const { data, error } = await supabase.from("ems_supply_batches").insert({
    department_id: member.departmentId,
    supply_item_id: supplyItemId,
    lot_number: lotNumber,
    quantity_received: quantity,
    quantity_remaining: quantity,
    expiration_date: expirationDate,
    storage_location: storageLocation,
    notes,
    created_by_member_id: member.id,
  }).select("id").single();

  if (error) return json({ error: error.message }, 400);
  return json({ ok: true, batchId: data.id }, 201);
}
