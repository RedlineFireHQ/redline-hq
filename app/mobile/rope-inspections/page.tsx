import { redirect } from "next/navigation";

import MobileRopeInspection from "@/components/mobile/MobileRopeInspection";
import { getCurrentMember } from "@/lib/current-member";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Rope = {
  id: string;
  rope_name: string;
  rope_identifier: string;
  rope_type: string;
  serial_number: string | null;
  length_ft: number | null;
  location_type: string;
  apparatus_id: string | null;
  other_location: string | null;
};

type DeficiencyRow = {
  rope_item_id: string | null;
  status_info: { active: boolean | null } | Array<{ active: boolean | null }> | null;
};

type Member = { id: string; first_name: string | null; last_name: string | null };
type Option = { id: string; name: string };

export default async function MobileRopeInspectionsPage() {
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);
  if (!currentMember?.departmentId) redirect("/login");

  const departmentId = currentMember.departmentId;
  const [ropesResult, apparatusResult, deficienciesResult, membersResult, categoriesResult, prioritiesResult, statusesResult] = await Promise.all([
    supabase
      .from("rope_items")
      .select("id, rope_name, rope_identifier, rope_type, serial_number, length_ft, location_type, apparatus_id, other_location")
      .eq("department_id", departmentId)
      .eq("status", "Active")
      .order("rope_identifier", { ascending: true }),
    supabase
      .from("apparatus")
      .select("id, name")
      .eq("department_id", departmentId)
      .eq("lifecycle_status", "active"),
    supabase
      .from("deficiencies")
      .select("rope_item_id, status_info:deficiency_statuses!fk_deficiencies_status(active)")
      .eq("department_id", departmentId)
      .not("rope_item_id", "is", null),
    supabase.rpc("get_active_department_training_members", { p_department_id: departmentId }),
    supabase.from("deficiency_categories").select("id, name").order("display_order"),
    supabase.from("deficiency_priorities").select("id, name").order("display_order"),
    supabase.from("deficiency_statuses").select("id, name").order("display_order"),
  ]);

  const apparatusNameById: Record<string, string> = {};
  for (const apparatus of apparatusResult.data ?? []) {
    if (typeof apparatus.id === "string") {
      apparatusNameById[apparatus.id] = typeof apparatus.name === "string" ? apparatus.name : "Apparatus";
    }
  }

  const activeDeficiencyRopeIds: string[] = [];
  for (const row of (deficienciesResult.data ?? []) as DeficiencyRow[]) {
    const status = Array.isArray(row.status_info) ? row.status_info[0] : row.status_info;
    if (row.rope_item_id && status?.active === true) activeDeficiencyRopeIds.push(row.rope_item_id);
  }

  const initialError = [ropesResult.error, apparatusResult.error, deficienciesResult.error, membersResult.error, categoriesResult.error, prioritiesResult.error, statusesResult.error].find(Boolean)?.message ?? null;
  const openStatus = ((statusesResult.data ?? []) as Option[]).find((status) => status.name.trim().toLowerCase() === "open");

  return (
    <MobileRopeInspection
      departmentId={departmentId}
      memberId={currentMember.id}
      memberName={currentMember.name}
      ropes={(ropesResult.data ?? []) as Rope[]}
      apparatusNameById={apparatusNameById}
      activeDeficiencyRopeIds={activeDeficiencyRopeIds}
      members={(membersResult.data ?? []) as Member[]}
      deficiencyCategories={(categoriesResult.data ?? []) as Option[]}
      deficiencyPriorities={(prioritiesResult.data ?? []) as Option[]}
      openStatusId={openStatus?.id ?? ""}
      initialError={initialError}
    />
  );
}
