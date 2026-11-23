import HydrostaticWorkspace from "@/components/inventory/HydrostaticWorkspace";
import { getCurrentMember } from "@/lib/current-member";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export default async function HydrostaticTestingPage({ searchParams }: { searchParams: Promise<{ cylinderId?: string; resultId?: string }> }) {
  const supabase = await createSupabaseServerClient();
  const member = await getCurrentMember(supabase);
  const { cylinderId, resultId } = await searchParams;
  return <HydrostaticWorkspace departmentId={member?.departmentId ?? null} cylinderId={cylinderId ?? null} resultId={resultId ?? null} />;
}
