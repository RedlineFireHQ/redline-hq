import { getCurrentMember } from "@/lib/current-member";
import { parseApparatusQrValue } from "@/lib/qr-identifiers";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
}

export async function GET(request: Request) {
  const value = new URL(request.url).searchParams.get("value")?.trim() || "";
  if (!value) return jsonResponse({ ok: false, error: "QR value is required." }, 400);

  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);
  if (!currentMember?.departmentId) return jsonResponse({ ok: false, error: "Unauthorized" }, 401);

  const { data: supply } = await supabase
    .from("ems_supply_items")
    .select("id, item_name, qr_identifier")
    .eq("department_id", currentMember.departmentId)
    .eq("qr_identifier", value)
    .eq("status", "Active")
    .maybeSingle();
  if (supply) return jsonResponse({ ok: true, result: { type: "ems_supply", id: supply.id, label: supply.item_name, value } });

  const apparatusId = parseApparatusQrValue(value);
  if (apparatusId) {
    const { data: apparatus } = await supabase
      .from("apparatus")
      .select("id, name")
      .eq("id", apparatusId)
      .eq("department_id", currentMember.departmentId)
      .eq("lifecycle_status", "active")
      .maybeSingle();
    if (apparatus) return jsonResponse({ ok: true, result: { type: "apparatus", id: apparatus.id, label: apparatus.name, value } });
  }

  return jsonResponse({ ok: false, error: "QR code not recognized for this department." }, 404);
}