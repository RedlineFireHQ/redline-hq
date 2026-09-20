import { redirect } from "next/navigation";
import MobileTrainingForm from "@/components/mobile/MobileTrainingForm";
import { getCurrentMember } from "@/lib/current-member";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MobileTrainingPage() {
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);
  if (!currentMember?.departmentId) redirect("/login");

  const [{ data: categories }, { data: emsCourses }, { data: members }] = await Promise.all([
    supabase.from("training_categories").select("id, name, active").eq("department_id", currentMember.departmentId).order("name", { ascending: true }),
    supabase.from("ems_course_definitions").select("id, course_name, active").eq("department_id", currentMember.departmentId).order("course_name", { ascending: true }),
    supabase.rpc("get_active_department_training_members", { p_department_id: currentMember.departmentId }),
  ]);

  return <MobileTrainingForm departmentId={currentMember.departmentId} memberId={currentMember.id} categories={categories ?? []} emsCourses={emsCourses ?? []} members={members ?? []} />;
}
