import MobileEmsSupplyDetail from "@/components/mobile/MobileEmsSupplyDetail";
import { getCurrentMember } from "@/lib/current-member";
import { hasDepartmentPermission } from "@/lib/member-permissions";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type PageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MobileEmsSupplyDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);
  const canAudit = Boolean(
    currentMember?.departmentId &&
      (await hasDepartmentPermission(supabase, currentMember.departmentId, currentMember.role, "inventory_management")),
  );
  return <MobileEmsSupplyDetail supplyId={id} canAudit={canAudit} />;
}
