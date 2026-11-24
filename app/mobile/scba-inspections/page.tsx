import { redirect } from "next/navigation";
import MobileScbaInspection from "@/components/mobile/MobileScbaInspection";
import { getCurrentMember } from "@/lib/current-member";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Pack = { id: string; pack_number: string; manufacturer: string | null; model: string | null; serial_number: string | null; status: string };

export default async function MobileScbaInspectionPage() {
  const supabase = await createSupabaseServerClient();
  const member = await getCurrentMember(supabase);
  if (!member?.departmentId) redirect("/login");
  const [{ data: packs, error }, { data: department }] = await Promise.all([
    supabase.from("scba_packs").select("id, pack_number, manufacturer, model, serial_number, status").eq("department_id", member.departmentId).neq("status", "Retired").order("pack_number", { ascending: true }),
    supabase.from("departments").select("name").eq("id", member.departmentId).maybeSingle(),
  ]);
  return <MobileScbaInspection departmentId={member.departmentId} memberId={member.id} memberName={member.name} departmentName={department?.name ?? "Department"} packs={(packs ?? []) as Pack[]} initialError={error?.message ?? null} />;
}
