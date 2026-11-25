import { redirect } from "next/navigation";
import Link from "next/link";
import PageLayout from "@/components/layout/PageLayout";
import RedOakEmsCompetencyForm from "@/components/personnel/RedOakEmsCompetencyForm";
import { RED_OAK_FIRE_DEPARTMENT_ID, type RedOakCompetencyVerification } from "@/lib/red-oak-ems-competency";
import { getCurrentMember } from "@/lib/current-member";
import { canManagePersonnel } from "@/lib/member-permissions";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export default async function RedOakEmsCompetencyPage() {
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);
  if (!currentMember?.departmentId) redirect("/login");
  if (currentMember.departmentId !== RED_OAK_FIRE_DEPARTMENT_ID) redirect("/");
  if (!await canManagePersonnel(supabase, currentMember.departmentId, currentMember.role)) redirect("/");

  const [{ data: memberRows, error: memberError }, { data: verificationRows, error: verificationError }] = await Promise.all([
    supabase.from("members").select("id, first_name, last_name")
      .eq("department_id", RED_OAK_FIRE_DEPARTMENT_ID)
      .order("last_name").order("first_name"),
    supabase.from("red_oak_ems_competency_verifications").select("*")
      .eq("department_id", RED_OAK_FIRE_DEPARTMENT_ID)
      .order("verification_year", { ascending: false }).order("created_at", { ascending: false }),
  ]);
  if (memberError) throw new Error("Unable to load Red Oak personnel: " + memberError.message);
  if (verificationError) throw new Error("Unable to load competency verifications: " + verificationError.message);

  const members = (memberRows ?? []).map((row) => ({
    id: String(row.id),
    name: `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || String(row.id),
  }));
  const verifications = (verificationRows ?? []) as unknown as RedOakCompetencyVerification[];

  return (
    <PageLayout environmentBackgroundUrl="/branding/images/Personnelpage.png">
      <Link href="/personnel" className="text-sm text-neutral-300 hover:text-white">← Personnel</Link>
      <h1 className="mb-2 mt-3 text-3xl font-bold">EMS Skills Competency Verification</h1>
      <p className="mb-6 text-sm text-neutral-400">Red Oak Fire Department · CQI Policy – Section D: Skill Maintenance</p>
      <RedOakEmsCompetencyForm members={members} verifications={verifications} />
    </PageLayout>
  );
}
