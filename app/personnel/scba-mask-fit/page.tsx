import Link from "next/link";
import { redirect } from "next/navigation";
import PageLayout from "@/components/layout/PageLayout";
import MaskFitSessionForm from "@/components/personnel/MaskFitSessionForm";
import { getCurrentMember } from "@/lib/current-member";
import { canManagePersonnel } from "@/lib/member-permissions";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export default async function MaskFitPage() {
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);
  if (!currentMember?.departmentId) redirect("/login");
  if (!await canManagePersonnel(supabase, currentMember.departmentId, currentMember.role)) redirect("/");

  const members: { id: string; name: string }[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.from("members")
      .select("id, first_name, last_name")
      .eq("department_id", currentMember.departmentId)
      .order("last_name").order("first_name").order("id")
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(`Unable to load personnel: ${error.message}`);
    for (const member of data ?? []) {
      members.push({ id: String(member.id), name: `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() || String(member.id) });
    }
    if ((data?.length ?? 0) < pageSize) break;
  }
  return (
    <PageLayout environmentBackgroundUrl="/branding/images/Personnelpage.png">
      <Link href="/personnel" className="text-sm text-neutral-300 hover:text-white">← Personnel</Link>
      <h1 className="mb-6 mt-3 text-3xl font-bold">SCBA Mask Fit Test</h1>
      <MaskFitSessionForm departmentId={currentMember.departmentId} members={members} />
    </PageLayout>
  );
}
