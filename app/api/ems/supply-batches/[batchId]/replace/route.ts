import { getCurrentMember } from "@/lib/current-member";
import { hasInventoryPermission } from "@/lib/member-permissions";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status });
}

export async function POST(request: Request, context: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await context.params;
  const supabase = await createSupabaseServerClient();
  const member = await getCurrentMember(supabase);
  if (!member?.departmentId) return json({ error: "Unauthorized" }, 401);

  const allowed = await hasInventoryPermission(supabase, member.departmentId, member.role, "inventory_management");
  if (!allowed) return json({ error: "You do not have permission to manage EMS supplies." }, 403);

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const quantity = Number(body.quantity);
  const expirationDate = typeof body.expirationDate === "string" ? body.expirationDate : "";
  const lotNumber = typeof body.lotNumber === "string" ? body.lotNumber.trim() || null : null;
  const reason = typeof body.reason === "string" ? body.reason.trim() || null : null;
  if (!Number.isFinite(quantity) || quantity <= 0) return json({ error: "Enter a replacement quantity greater than zero." }, 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expirationDate)) return json({ error: "Enter the new item's expiration date." }, 400);

  const { data, error } = await supabase.rpc("replace_ems_supply_batch", {
    p_old_batch_id: batchId,
    p_quantity: quantity,
    p_new_expiration_date: expirationDate,
    p_new_lot_number: lotNumber,
    p_reason: reason,
  });
  if (error) return json({ error: error.message }, 400);
  const row = Array.isArray(data) ? data[0] : data;
  return json({ ok: true, replacementId: row?.replacement_id, newBatchId: row?.new_batch_id }, 201);
}
