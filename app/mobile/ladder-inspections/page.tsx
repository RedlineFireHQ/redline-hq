import { redirect } from "next/navigation";

import MobileLadderInspection from "@/components/mobile/MobileLadderInspection";
import { getCurrentMember } from "@/lib/current-member";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Ladder = {
  id: string;
  ladder_number: string;
  ladder_type: string | null;
  ladder_length_ft: number | null;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  status: string;
  notes: string | null;
};

type Assignment = {
  ground_ladder_id: string;
  assignment_type: string;
  apparatus_id: string | null;
};

type Member = { id: string; first_name: string | null; last_name: string | null };
type DeficiencyRow = {
  ground_ladder_id: string | null;
  status_info: { active: boolean | null; name: string | null } | Array<{ active: boolean | null; name: string | null }> | null;
};

export default async function MobileLadderInspectionsPage() {
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);
  if (!currentMember?.departmentId) redirect("/login");

  const departmentId = currentMember.departmentId;
  const [laddersResult, assignmentsResult, deficienciesResult, settingsResult, membersResult] = await Promise.all([
    supabase
      .from("ground_ladders")
      .select("id, ladder_number, ladder_type, ladder_length_ft, manufacturer, model, serial_number, status, notes")
      .eq("department_id", departmentId)
      .neq("status", "Retired")
      .order("ladder_number", { ascending: true }),
    supabase
      .from("ground_ladder_assignments")
      .select("ground_ladder_id, assignment_type, apparatus_id")
      .eq("department_id", departmentId)
      .is("ended_at", null),
    supabase
      .from("deficiencies")
      .select("ground_ladder_id, status_info:deficiency_statuses!fk_deficiencies_status(active, name)")
      .eq("department_id", departmentId)
      .not("ground_ladder_id", "is", null),
    supabase
      .from("ground_ladder_inspection_settings")
      .select("require_checklist")
      .eq("department_id", departmentId)
      .maybeSingle(),
    supabase.rpc("get_active_department_training_members", { p_department_id: departmentId }),
  ]);

  const activeDeficiencyLadderIds: string[] = [];
  for (const row of (deficienciesResult.data ?? []) as DeficiencyRow[]) {
    if (!row.ground_ladder_id) continue;
    const status = Array.isArray(row.status_info) ? row.status_info[0] : row.status_info;
    const name = status?.name?.trim().toLowerCase() ?? "";
    if (name !== "resolved" && name !== "closed" && (status?.active === true || !name)) {
      activeDeficiencyLadderIds.push(row.ground_ladder_id);
    }
  }

  const initialError = [
    laddersResult.error,
    assignmentsResult.error,
    deficienciesResult.error,
    settingsResult.error,
    membersResult.error,
  ].find(Boolean)?.message ?? null;

  return (
    <MobileLadderInspection
      departmentId={departmentId}
      memberId={currentMember.id}
      ladders={(laddersResult.data ?? []) as Ladder[]}
      assignments={(assignmentsResult.data ?? []) as Assignment[]}
      members={(membersResult.data ?? []) as Member[]}
      activeDeficiencyLadderIds={activeDeficiencyLadderIds}
      checklistRequired={settingsResult.data?.require_checklist === true}
      initialError={initialError}
    />
  );
}
