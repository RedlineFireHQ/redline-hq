import MobileInventory from "@/components/mobile/MobileInventory";
import { getCurrentMember } from "@/lib/current-member";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { loadMobileInventory } from "@/lib/mobile-inventory";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MobileInventoryPage() {
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);
  if (!currentMember?.departmentId) return null;

  try {
    const items = await loadMobileInventory(supabase, currentMember.departmentId);
    return <MobileInventory items={items} initialError={null} />;
  } catch (error) {
    return <MobileInventory items={[]} initialError={error instanceof Error ? error.message : "Unable to load inventory."} />;
  }
}
