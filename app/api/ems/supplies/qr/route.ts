import { getCurrentMember } from "@/lib/current-member";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function GET(request: Request) {
  try {
    const qrIdentifier = new URL(request.url).searchParams.get("value")?.trim() || "";
    if (!qrIdentifier) {
      return jsonResponse({ ok: false, error: "QR value is required." }, 400);
    }

    const supabase = await createSupabaseServerClient();
    const currentMember = await getCurrentMember(supabase);
    if (!currentMember?.departmentId) {
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    }

    const { data, error } = await supabase
      .from("ems_supply_items")
      .select(
        "id, item_name, item_category, unit_of_measure, custom_unit_of_measure, quantity_on_hand, reorder_threshold, critical_threshold, target_quantity, location, notes, status, created_at, updated_at",
      )
      .eq("department_id", currentMember.departmentId)
      .eq("qr_identifier", qrIdentifier)
      .eq("status", "Active")
      .maybeSingle();

    if (error) {
      return jsonResponse({ ok: false, error: "Unable to resolve supply QR." }, 400);
    }

    if (!data) {
      return jsonResponse({ ok: false, error: "Supply QR not recognized." }, 404);
    }

    return jsonResponse({ ok: true, item: data });
  } catch {
    return jsonResponse({ ok: false, error: "Unable to resolve supply QR." }, 400);
  }
}
