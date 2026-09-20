import Link from "next/link";
import { redirect } from "next/navigation";
import MobilePrePlanForm from "@/components/mobile/MobilePrePlanForm";
import { getCurrentMember } from "@/lib/current-member";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function MobileNewPrePlanPage() {
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);
  if (!currentMember?.departmentId) redirect("/login");

  return <MobilePrePlanForm />;
}
