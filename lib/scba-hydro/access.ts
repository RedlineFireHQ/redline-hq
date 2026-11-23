import { getActiveDepartmentMember } from "@/lib/pump-tests/access";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function hydroActor(sessionId: string) {
  const supabase = await createSupabaseServerClient();
  const member = await getActiveDepartmentMember(supabase);
  if (!member) return null;
  const { data: session, error } = await supabase.from("scba_hydro_sessions")
    .select("id").eq("id", sessionId).eq("department_id", member.departmentId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!session) return null;
  const permission = await supabase.rpc("member_has_inventory_permission", {
    p_department_id: member.departmentId, p_permission_key: "scba_cylinder_inspection_testing",
  });
  if (permission.error) throw new Error(permission.error.message);
  if (permission.data !== true) return null;
  return { ...member, supabase, admin: createSupabaseAdminClient() };
}

export function hydroJson(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}
