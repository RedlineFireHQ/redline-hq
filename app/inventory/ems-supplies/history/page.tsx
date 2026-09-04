import { redirect } from "next/navigation";
import EmsSupplyHistoryWorkspace from "@/components/inventory/EmsSupplyHistoryWorkspace";
import { getCurrentMember } from "@/lib/current-member";
import { fetchEmsSupplyHistory, type EmsSupplyHistoryRow } from "@/lib/ems/supply-history";
import { hasDepartmentPermission } from "@/lib/member-permissions";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function normalizeName(firstName: unknown, lastName: unknown, fallback: string) {
  const first = typeof firstName === "string" ? firstName.trim() : "";
  const last = typeof lastName === "string" ? lastName.trim() : "";
  return `${first} ${last}`.trim() || fallback;
}

export default async function EmsSupplyHistoryPage() {
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);

  if (!currentMember?.departmentId) {
    redirect("/login");
  }

  const canViewHistory = await hasDepartmentPermission(
    supabase,
    currentMember.departmentId,
    currentMember.role,
    "inventory_management",
  );

  if (!canViewHistory) {
    redirect("/inventory/ems-supplies");
  }

  const [departmentQuery, memberQuery, supplyQuery] = await Promise.all([
    supabase
      .from("departments")
      .select("name")
      .eq("id", currentMember.departmentId)
      .maybeSingle(),
    supabase
      .from("members")
      .select("id, first_name, last_name")
      .eq("department_id", currentMember.departmentId)
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true }),
    supabase
      .from("ems_supply_items")
      .select("id, item_name")
      .eq("department_id", currentMember.departmentId)
      .order("item_name", { ascending: true }),
  ]);

  const departmentName = typeof departmentQuery.data?.name === "string" ? departmentQuery.data.name : null;

  const memberOptions = (memberQuery.data ?? [])
    .map((row) => ({
      id: String(row.id),
      label: normalizeName(row.first_name, row.last_name, String(row.id)),
    }))
    .filter((row) => row.id.length > 0);

  const supplyOptions = (supplyQuery.data ?? [])
    .map((row) => ({
      id: String(row.id),
      label: typeof row.item_name === "string" && row.item_name.trim() ? row.item_name.trim() : String(row.id),
    }))
    .filter((row) => row.id.length > 0);

  let initialRows: EmsSupplyHistoryRow[] = [];
  let initialError: string | null = null;

  try {
    initialRows = await fetchEmsSupplyHistory(supabase, currentMember.departmentId);
  } catch (error) {
    initialError = error instanceof Error ? error.message : "Unable to load EMS supply history.";
  }

  return (
    <EmsSupplyHistoryWorkspace
      departmentName={departmentName}
      memberOptions={memberOptions}
      supplyOptions={supplyOptions}
      initialRows={initialRows}
      initialError={initialError}
    />
  );
}