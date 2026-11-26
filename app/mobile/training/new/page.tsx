import { redirect } from "next/navigation";
import MobileTrainingForm from "@/components/mobile/MobileTrainingForm";
import type { IsoTrainingFacilityOption, IsoPrePlanOption } from "@/components/training/TrainingEventIsoFields";
import { getCurrentMember } from "@/lib/current-member";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MobileTrainingPage() {
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);
  if (!currentMember?.departmentId) redirect("/login");

  const [{ data: categories }, { data: emsCourses }, { data: members }, { data: facilities }, { data: prePlans }] = await Promise.all([
    supabase.from("training_categories").select("id, name, active, system_key, compliance_bucket").eq("department_id", currentMember.departmentId).order("name", { ascending: true }),
    supabase.from("ems_course_definitions").select("id, course_name, active").eq("department_id", currentMember.departmentId).order("course_name", { ascending: true }),
    supabase.rpc("get_active_department_training_members", { p_department_id: currentMember.departmentId }),
    supabase.from("training_facilities").select("id, name, facility_type, ownership_type, address, city, state, zip, tower_stories, yard_acres, purpose_built_live_fire, formal_agreement, agreement_reference, agreement_start_date, agreement_end_date, active").eq("department_id", currentMember.departmentId).eq("active", true).order("name"),
    supabase.from("pre_plans").select("id, business_name, address, city, state, iso_high_hazard, lifecycle_status").eq("department_id", currentMember.departmentId).eq("lifecycle_status", "active").order("business_name"),
  ]);

  return <MobileTrainingForm departmentId={currentMember.departmentId} memberId={currentMember.id} categories={categories ?? []} emsCourses={emsCourses ?? []} members={members ?? []} facilities={(facilities ?? []) as IsoTrainingFacilityOption[]} prePlans={(prePlans ?? []) as IsoPrePlanOption[]} />;
}
