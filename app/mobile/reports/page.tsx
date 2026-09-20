import { redirect } from "next/navigation";

import MobileReports from "@/components/mobile/MobileReports";
import { getCurrentMember } from "@/lib/current-member";
import { hasDepartmentPermission } from "@/lib/member-permissions";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Option = { id: string; name: string };
type MemberOption = Option & { station?: string | null; shift?: string | null; active?: boolean | null; departmentRoleId?: string | null };

function memberName(row: Record<string, unknown>) {
  const firstName = typeof row.first_name === "string" ? row.first_name.trim() : "";
  const lastName = typeof row.last_name === "string" ? row.last_name.trim() : "";
  return `${firstName} ${lastName}`.trim() || "Unknown Member";
}

export default async function MobileReportsPage() {
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);
  if (!currentMember?.departmentId) redirect("/login");

  const hasReportsAccess = await hasDepartmentPermission(
    supabase,
    currentMember.departmentId,
    currentMember.role,
    "reports_management",
  );

  if (!hasReportsAccess) redirect("/mobile");

  const departmentId = currentMember.departmentId;
  const [membersResult, trainingCategoriesResult, apparatusResult, fireHoseResult, scbaCylindersResult, scbaPacksResult, gasMonitorsResult, ropeItemsResult, groundLaddersResult, emsSuppliesResult] = await Promise.all([
    supabase.from("members").select("id, first_name, last_name, station, shift, active, department_role_id").eq("department_id", departmentId).order("last_name").order("first_name"),
    supabase.from("training_categories").select("id, name").eq("department_id", departmentId).eq("active", true).order("name"),
    supabase.from("apparatus").select("id, name").eq("department_id", departmentId).eq("lifecycle_status", "active").order("name"),
    supabase.from("fire_hose").select("id, inventory_number").eq("department_id", departmentId).order("inventory_number"),
    supabase.from("scba_cylinders").select("id, cylinder_number").eq("department_id", departmentId).order("cylinder_number"),
    supabase.from("scba_packs").select("id, pack_number").eq("department_id", departmentId).order("pack_number"),
    supabase.from("gas_monitors").select("id, monitor_number").eq("department_id", departmentId).order("monitor_number"),
    supabase.from("rope_items").select("id, rope_name, rope_identifier").eq("department_id", departmentId).order("rope_identifier"),
    supabase.from("ground_ladders").select("id, ladder_number").eq("department_id", departmentId).order("ladder_number"),
    supabase.from("ems_supply_items").select("id, item_name").eq("department_id", departmentId).order("item_name"),
  ]);

  const initialError = [membersResult.error, trainingCategoriesResult.error, apparatusResult.error, fireHoseResult.error, scbaCylindersResult.error, scbaPacksResult.error, gasMonitorsResult.error, ropeItemsResult.error, groundLaddersResult.error, emsSuppliesResult.error].find(Boolean)?.message ?? null;

  const members = ((membersResult.data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id ?? ""),
    name: memberName(row),
    station: typeof row.station === "string" ? row.station : null,
    shift: typeof row.shift === "string" ? row.shift : null,
    active: typeof row.active === "boolean" ? row.active : null,
    departmentRoleId: typeof row.department_role_id === "string" ? row.department_role_id : null,
  })).filter((row) => row.id);

  const trainingCategories = ((trainingCategoriesResult.data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id ?? ""),
    name: typeof row.name === "string" ? row.name : "Unknown Category",
  })).filter((row) => row.id);

  const mapOption = (rows: unknown[] | null | undefined, labelKey: string, fallbackKey?: string): Option[] => (rows ?? []).map((row) => {
    const record = row as Record<string, unknown>;
    const label = typeof record[labelKey] === "string" && record[labelKey] ? record[labelKey] : typeof record[fallbackKey ?? ""] === "string" ? record[fallbackKey ?? ""] : "Unknown";
    return { id: String(record.id ?? ""), name: String(label) };
  }).filter((row) => row.id);

  return (
    <MobileReports
      members={members as MemberOption[]}
      trainingCategories={trainingCategories}
      apparatus={mapOption(apparatusResult.data, "name")}
      fireHose={mapOption(fireHoseResult.data, "inventory_number")}
      scbaCylinders={mapOption(scbaCylindersResult.data, "cylinder_number")}
      scbaPacks={mapOption(scbaPacksResult.data, "pack_number")}
      gasMonitors={mapOption(gasMonitorsResult.data, "monitor_number")}
      ropeItems={mapOption(ropeItemsResult.data, "rope_identifier", "rope_name")}
      groundLadders={mapOption(groundLaddersResult.data, "ladder_number")}
      emsSupplies={mapOption(emsSuppliesResult.data, "item_name")}
      initialError={initialError}
    />
  );
}