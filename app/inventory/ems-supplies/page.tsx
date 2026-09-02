import EmsSupplyWorkspace, {
  type EmsSupplyItemRow,
} from "@/components/inventory/EmsSupplyWorkspace";
import { getActiveApparatusOptions } from "@/lib/database";
import { getCurrentMember } from "@/lib/current-member";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function compareItemNames(left: string | null | undefined, right: string | null | undefined) {
  const leftValue = typeof left === "string" ? left.trim() : "";
  const rightValue = typeof right === "string" ? right.trim() : "";

  if (!leftValue && !rightValue) {
    return 0;
  }

  if (!leftValue) {
    return 1;
  }

  if (!rightValue) {
    return -1;
  }

  return leftValue.localeCompare(rightValue, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export default async function EmsSuppliesInventoryPage() {
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);
  const departmentId = currentMember?.departmentId ?? null;
  const canManageSupplies =
    currentMember?.role === "administrator" || currentMember?.role === "officer";

  let departmentName: string | null = null;
  const checkedOutByName = currentMember?.name || "Authenticated Member";
  let apparatusOptions: Array<{ id: string; name: string }> = [];
  let initialRows: EmsSupplyItemRow[] = [];
  let initialError: string | null = null;

  if (departmentId) {
    const [{ data: departmentData }, { data, error }, apparatusData] = await Promise.all([
      supabase
        .from("departments")
        .select("name")
        .eq("id", departmentId)
        .maybeSingle(),
      supabase
        .from("ems_supply_items")
        .select(
          "id, item_name, item_category, unit_of_measure, custom_unit_of_measure, quantity_on_hand, reorder_threshold, critical_threshold, target_quantity, location, notes, status, qr_identifier, created_at, updated_at",
        )
        .eq("department_id", departmentId)
        .order("status", { ascending: true })
        .order("item_name", { ascending: true }),
      getActiveApparatusOptions({ client: supabase, departmentId }),
    ]);

    departmentName = typeof departmentData?.name === "string" ? departmentData.name : null;

    if (error) {
      console.error("[ems-supplies] initial load failed", error);
      initialError = error.message || "Unable to load EMS supplies.";
    }

    apparatusOptions = apparatusData
      .map((row) => ({
        id: row.id,
        name: typeof row.name === "string" && row.name.trim() ? row.name.trim() : "Unnamed Apparatus",
      }))
      .filter((row) => row.id.length > 0);

    initialRows = [...((data ?? []) as EmsSupplyItemRow[])].sort((left, right) =>
      compareItemNames(left.item_name, right.item_name),
    );
  }

  return (
    
      <EmsSupplyWorkspace
        departmentName={departmentName}
        checkedOutByName={checkedOutByName}
        apparatusOptions={apparatusOptions}
        canManageSupplies={canManageSupplies}
        initialRows={initialRows}
        initialError={initialError}
      />
    
  );
}
