import { redirect } from "next/navigation";

import MobileHoseQuickTest from "@/components/mobile/MobileHoseQuickTest";
import { getCurrentMember } from "@/lib/current-member";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Hose = {
  id: string;
  inventory_number: string;
  hose_size: number | string | null;
  hose_length: number | null;
  booster_reel: boolean | null;
  apparatus: string | null;
  status: string;
  next_test_date: string | null;
};

type DeficiencyRow = {
  fire_hose_id: string | null;
  status_info: { active: boolean | null } | Array<{ active: boolean | null }> | null;
};

type Option = { id: string; name: string };
type Member = { id: string; first_name: string | null; last_name: string | null };

export default async function MobileHoseTestingPage() {
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);
  if (!currentMember?.departmentId) redirect("/login");

  const departmentId = currentMember.departmentId;
  const [hosesResult, deficienciesResult, categoriesResult, prioritiesResult, statusesResult, membersResult] = await Promise.all([
    supabase
      .from("fire_hose")
      .select("id, inventory_number, hose_size, hose_length, booster_reel, apparatus, status, next_test_date")
      .eq("department_id", departmentId)
      .neq("status", "Retired")
      .order("inventory_number", { ascending: true }),
    supabase
      .from("deficiencies")
      .select("fire_hose_id, status_info:deficiency_statuses!fk_deficiencies_status(active)")
      .eq("department_id", departmentId)
      .not("fire_hose_id", "is", null),
    supabase.from("deficiency_categories").select("id, name").order("display_order"),
    supabase.from("deficiency_priorities").select("id, name").order("display_order"),
    supabase.from("deficiency_statuses").select("id, name").order("display_order"),
    supabase.rpc("get_active_department_training_members", { p_department_id: departmentId }),
  ]);

  const activeDeficiencyHoseIds: string[] = [];
  for (const row of (deficienciesResult.data ?? []) as DeficiencyRow[]) {
    const status = Array.isArray(row.status_info) ? row.status_info[0] : row.status_info;
    if (row.fire_hose_id && status?.active === true) activeDeficiencyHoseIds.push(row.fire_hose_id);
  }

  const initialError = [hosesResult.error, deficienciesResult.error, categoriesResult.error, prioritiesResult.error, statusesResult.error, membersResult.error].find(Boolean)?.message ?? null;
  const openStatus = ((statusesResult.data ?? []) as Option[]).find((status) => status.name.trim().toLowerCase() === "open");

  return (
    <MobileHoseQuickTest
      departmentId={departmentId}
      memberId={currentMember.id}
      memberName={currentMember.name}
      hoses={(hosesResult.data ?? []) as Hose[]}
      activeDeficiencyHoseIds={activeDeficiencyHoseIds}
      deficiencyCategories={(categoriesResult.data ?? []) as Option[]}
      deficiencyPriorities={(prioritiesResult.data ?? []) as Option[]}
      openStatusId={openStatus?.id ?? ""}
      members={(membersResult.data ?? []) as Member[]}
      initialError={initialError}
    />
  );
}
