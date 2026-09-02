import EmsEquipmentWorkspace, {
  type EmsEquipmentRow,
} from "@/components/inventory/EmsEquipmentWorkspace";
import { getCurrentMember } from "@/lib/current-member";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function compareEquipmentNames(left: string | null | undefined, right: string | null | undefined) {
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

export default async function EmsEquipmentInventoryPage() {
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);
  const departmentId = currentMember?.departmentId ?? null;
  const canManageEquipment =
    currentMember?.role === "administrator" || currentMember?.role === "officer";

  let departmentName: string | null = null;
  let initialRows: EmsEquipmentRow[] = [];
  let initialError: string | null = null;

  if (departmentId) {
    const [{ data: departmentData }, { data, error }] = await Promise.all([
      supabase
        .from("departments")
        .select("name")
        .eq("id", departmentId)
        .maybeSingle(),
      supabase
        .from("ems_equipment")
        .select(
          "id, equipment_name, manufacturer, model, serial_number, equipment_number, placed_in_service_date, location, status, notes, photo_path, created_at, updated_at",
        )
        .eq("department_id", departmentId)
        .order("status", { ascending: true })
        .order("equipment_name", { ascending: true }),
    ]);

    departmentName = typeof departmentData?.name === "string" ? departmentData.name : null;

    if (error) {
      console.error("[ems-equipment] initial load failed", error);
      initialError = error.message || "Unable to load EMS equipment.";
    }

    initialRows = [...((data ?? []) as EmsEquipmentRow[])].sort((left, right) =>
      compareEquipmentNames(left.equipment_name, right.equipment_name),
    );
  }

  return (
    
      <EmsEquipmentWorkspace
        departmentName={departmentName}
        canManageEquipment={canManageEquipment}
        initialRows={initialRows}
        initialError={initialError}
      />
    
  );
}
