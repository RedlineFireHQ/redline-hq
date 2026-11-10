import { redirect } from "next/navigation";
import MobileAlertsList from "@/components/mobile/MobileAlertsList";
import { getCurrentMember } from "@/lib/current-member";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export default async function MobileAlertsPage() {
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);

  if (!currentMember?.departmentId) {
    redirect("/login");
  }

  return <MobileAlertsList memberId={currentMember.id} />;
}
