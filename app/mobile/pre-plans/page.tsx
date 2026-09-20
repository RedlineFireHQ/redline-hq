import { redirect } from "next/navigation";
import MobilePrePlansList from "@/components/mobile/MobilePrePlansList";
import { getCurrentMember } from "@/lib/current-member";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PrePlanRow = {
  id: string;
  business_name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  occupancy_id_number: string | null;
  primary_apparatus_access: string | null;
  critical_information: string | null;
};

export default async function MobilePrePlansPage() {
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);
  if (!currentMember?.departmentId) redirect("/login");

  const { data: rows } = await supabase
    .from("pre_plans")
    .select("id, business_name, address, city, state, zip, occupancy_id_number, primary_apparatus_access, critical_information")
    .eq("department_id", currentMember.departmentId)
    .eq("lifecycle_status", "active")
    .order("business_name", { ascending: true })
    .limit(250);

  const plans = (rows ?? []) as PrePlanRow[];
  const ids = plans.map((plan) => plan.id);
  const [{ data: hazards }, { data: hydrants }] = ids.length > 0
    ? await Promise.all([
        supabase.from("pre_plan_hazards").select("pre_plan_id").eq("department_id", currentMember.departmentId).in("pre_plan_id", ids),
        supabase.from("pre_plan_hydrants").select("pre_plan_id").eq("department_id", currentMember.departmentId).in("pre_plan_id", ids),
      ])
    : [{ data: [] }, { data: [] }];

  const countByPlan = (values: Array<{ pre_plan_id: string }> | null | undefined) =>
    (values ?? []).reduce<Record<string, number>>((counts, row) => {
      counts[row.pre_plan_id] = (counts[row.pre_plan_id] ?? 0) + 1;
      return counts;
    }, {});
  const hazardCounts = countByPlan(hazards as Array<{ pre_plan_id: string }>);
  const hydrantCounts = countByPlan(hydrants as Array<{ pre_plan_id: string }>);

  return (
    <MobilePrePlansList
      items={plans.map((plan) => ({
        id: plan.id,
        businessName: plan.business_name,
        address: plan.address,
        city: plan.city,
        state: plan.state,
        zip: plan.zip,
        occupancyId: plan.occupancy_id_number,
        access: plan.primary_apparatus_access,
        criticalInformation: plan.critical_information,
        hazardCount: hazardCounts[plan.id] ?? 0,
        hydrantCount: hydrantCounts[plan.id] ?? 0,
      }))}
    />
  );
}
