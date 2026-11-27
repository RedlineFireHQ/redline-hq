import { getCurrentMember } from "@/lib/current-member";
import { hasInventoryPermission } from "@/lib/member-permissions";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function PATCH(request: Request) {
  const supabase = await createSupabaseServerClient();
  const member = await getCurrentMember(supabase);
  if (!member?.departmentId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const allowed = await hasInventoryPermission(supabase, member.departmentId, member.role, "inventory_management");
  if (!allowed) return Response.json({ error: "You do not have permission to change EMS expiration settings." }, { status: 403 });
  const body = await request.json().catch(() => ({})) as { enabled?: unknown };
  if (typeof body.enabled !== "boolean") return Response.json({ error: "Choose whether expiration tracking is on or off." }, { status: 400 });
  const { error } = await supabase.from("departments").update({ ems_expiration_tracking_enabled: body.enabled }).eq("id", member.departmentId);
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ ok: true, enabled: body.enabled });
}
