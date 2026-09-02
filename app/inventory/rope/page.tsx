import RopeWorkspace, { type RopeRow } from "@/components/inventory/RopeWorkspace";
import type { RopeApparatusOption } from "@/components/inventory/RopeFormModal";
import type { RopeInspectionMemberOption } from "@/components/inventory/RopeInspectionModal";
import { getActiveApparatusOptions } from "@/lib/database";
import { getCurrentMember } from "@/lib/current-member";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function compareNames(left: string | null | undefined, right: string | null | undefined) {
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

function formatDisplayName(firstName: string | null | undefined, lastName: string | null | undefined, fallback: string | null | undefined) {
  const first = typeof firstName === "string" ? firstName.trim() : "";
  const last = typeof lastName === "string" ? lastName.trim() : "";
  const fullName = `${first} ${last}`.trim();
  return fullName || (typeof fallback === "string" ? fallback.trim() : "") || "Unknown";
}

export default async function RopeInventoryPage() {
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);
  const departmentId = currentMember?.departmentId ?? null;
  const canManageRope = currentMember?.role === "administrator" || currentMember?.role === "officer";

  let departmentName: string | null = null;
  let initialRows: RopeRow[] = [];
  let apparatusOptions: RopeApparatusOption[] = [];
  let inspectionMembers: RopeInspectionMemberOption[] = [];
  let initialError: string | null = null;

  if (departmentId) {
    const [{ data: departmentData }, { data: ropeData, error }, { data: inspectionData }, apparatusData, { data: memberData }, { data: deficiencyStatusData }, { data: deficiencyData }] = await Promise.all([
      supabase.from("departments").select("name").eq("id", departmentId).maybeSingle(),
      supabase
        .from("rope_items")
        .select("id, rope_name, rope_identifier, rope_type, serial_number, length_ft, diameter_mm, placed_in_service_date, location_type, apparatus_id, other_location, status, notes, photo_path, created_at, updated_at")
        .eq("department_id", departmentId)
        .order("rope_name", { ascending: true }),
      supabase
        .from("rope_inspections")
        .select("id, rope_item_id, inspection_date, result")
        .eq("department_id", departmentId)
        .order("inspection_date", { ascending: false })
        .order("created_at", { ascending: false }),
      getActiveApparatusOptions({ client: supabase, departmentId }),
      supabase
        .from("members")
        .select("id, first_name, last_name, email")
        .eq("department_id", departmentId)
        .eq("active", true)
        .order("first_name", { ascending: true })
        .order("last_name", { ascending: true }),
      supabase
        .from("deficiency_statuses")
        .select("id, name"),
      supabase
        .from("deficiencies")
        .select("rope_item_id, status")
        .not("rope_item_id", "is", null),
    ]);

    departmentName = typeof departmentData?.name === "string" ? departmentData.name : null;

    if (error) {
      console.error("[rope] initial load failed", error);
      initialError = error.message || "Unable to load rope inventory.";
    }

    const apparatusById = new Map(
      apparatusData.map((row) => [row.id, typeof row.name === "string" ? row.name : null]),
    );

    apparatusOptions = apparatusData.map((row) => ({
      id: row.id,
      name: typeof row.name === "string" ? row.name : null,
    }));

    inspectionMembers = ((memberData ?? []) as Record<string, unknown>[]).map((row) => ({
      id: typeof row.id === "string" ? row.id : String(row.id ?? ""),
      firstName: typeof row.first_name === "string" ? row.first_name : "",
      lastName: typeof row.last_name === "string" ? row.last_name : "",
      displayName: formatDisplayName(
        typeof row.first_name === "string" ? row.first_name : null,
        typeof row.last_name === "string" ? row.last_name : null,
        typeof row.email === "string" ? row.email : null,
      ),
    }));

    const latestInspectionByItemId = new Map<string, { date: string | null; result: string | null }>();
    for (const row of (inspectionData ?? []) as Array<{ rope_item_id: string | null; inspection_date: string | null; result: string | null }>) {
      if (typeof row.rope_item_id !== "string" || !row.rope_item_id) {
        continue;
      }

      if (!latestInspectionByItemId.has(row.rope_item_id)) {
        latestInspectionByItemId.set(row.rope_item_id, {
          date: row.inspection_date,
          result: row.result,
        });
      }
    }

    const statusNameById = new Map<string, string>();
    for (const row of (deficiencyStatusData ?? []) as Array<{ id: string | null; name: string | null }>) {
      if (typeof row.id !== "string" || !row.id) {
        continue;
      }

      const normalizedName = typeof row.name === "string" ? row.name.trim().toLowerCase() : "";
      statusNameById.set(row.id, normalizedName);
    }

    const openDeficiencyCountByRopeId = new Map<string, number>();
    for (const row of (deficiencyData ?? []) as Array<{ rope_item_id: string | null; status: string | null }>) {
      if (typeof row.rope_item_id !== "string" || !row.rope_item_id) {
        continue;
      }

      const normalizedStatus = typeof row.status === "string" ? (statusNameById.get(row.status) ?? "") : "";
      const isOpen = normalizedStatus !== "resolved" && normalizedStatus !== "closed";
      if (!isOpen) {
        continue;
      }

      const currentCount = openDeficiencyCountByRopeId.get(row.rope_item_id) ?? 0;
      openDeficiencyCountByRopeId.set(row.rope_item_id, currentCount + 1);
    }

    initialRows = [...((ropeData ?? []) as RopeRow[])]
      .map((row) => ({
        ...row,
        apparatus_name: row.apparatus_id ? apparatusById.get(row.apparatus_id) ?? null : null,
        last_inspection_date: latestInspectionByItemId.get(row.id)?.date ?? null,
        last_inspection_result: latestInspectionByItemId.get(row.id)?.result ?? null,
        open_deficiency_count: openDeficiencyCountByRopeId.get(row.id) ?? 0,
      }))
      .sort((left, right) => compareNames(left.rope_name, right.rope_name));
  }

  return (
    
      <RopeWorkspace
        departmentName={departmentName}
        canManageRope={canManageRope}
        initialRows={initialRows}
        apparatusOptions={apparatusOptions}
        inspectionMembers={inspectionMembers}
        currentMemberId={currentMember?.id ?? ""}
        currentMemberName={currentMember?.name ?? ""}
        initialError={initialError}
      />
    
  );
}