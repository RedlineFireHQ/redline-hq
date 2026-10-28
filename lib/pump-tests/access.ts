import { getCurrentMember } from "@/lib/current-member";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
}

type SupabaseUserClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type PumpTestActor = {
  supabase: SupabaseUserClient;
  admin: ReturnType<typeof createSupabaseAdminClient>;
  memberId: string;
  departmentId: string;
};

// The single rule used by every pump-test page and route: an active member of the currently selected department.
export async function getActiveDepartmentMember(supabase: SupabaseUserClient): Promise<{ memberId: string; departmentId: string } | null> {
  const currentMember = await getCurrentMember(supabase);
  if (!currentMember?.departmentId) {
    return null;
  }

  const { data: activeMember } = await supabase
    .from("members")
    .select("id")
    .eq("id", currentMember.id)
    .eq("department_id", currentMember.departmentId)
    .eq("active", true)
    .maybeSingle();

  return activeMember ? { memberId: currentMember.id, departmentId: currentMember.departmentId } : null;
}

export async function resolvePumpTestActor(): Promise<PumpTestActor | null> {
  const supabase = await createSupabaseServerClient();
  const member = await getActiveDepartmentMember(supabase);
  if (!member) {
    return null;
  }

  return { supabase, admin: createSupabaseAdminClient(), ...member };
}

export async function findPumpTestInDepartment(actor: PumpTestActor, pumpTestId: string) {
  const { data } = await actor.supabase
    .from("apparatus_pump_tests")
    .select("id, apparatus_id")
    .eq("id", pumpTestId)
    .eq("department_id", actor.departmentId)
    .maybeSingle();

  return (data as { id: string; apparatus_id: string } | null) ?? null;
}
