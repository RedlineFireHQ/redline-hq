import MobileEmsCheckout from "@/components/mobile/MobileEmsCheckout";
import { getCurrentMember } from "@/lib/current-member";
import { getActiveApparatusOptions } from "@/lib/database";
import { hasDepartmentPermission } from "@/lib/member-permissions";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MobileEmsSuppliesPage() {
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);
  const canAudit = Boolean(
    currentMember?.departmentId &&
      currentMember.role?.toLowerCase() === "administrator" &&
      (await hasDepartmentPermission(
        supabase,
        currentMember.departmentId,
        currentMember.role,
        "inventory_management",
      )),
  );
  const apparatusOptions = currentMember?.departmentId
    ? (await getActiveApparatusOptions({ client: supabase, departmentId: currentMember.departmentId })).map((option) => ({
        id: option.id,
        name: option.name?.trim() || "Unnamed Apparatus",
      }))
    : [];

  return <MobileEmsCheckout apparatusOptions={apparatusOptions} canAudit={canAudit} />;
}
