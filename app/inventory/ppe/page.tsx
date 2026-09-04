import PpeWorkspace, {
  type PpeRow,
} from "@/components/inventory/PpeWorkspace";
import type { PpeApparatusOption, PpeMemberOption } from "@/components/inventory/PpeFormModal";
import { getCurrentMember } from "@/lib/current-member";
import { getActiveApparatusOptions } from "@/lib/database";
import { hasDepartmentPermission } from "@/lib/member-permissions";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type MemberRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

function memberDisplayName(member: MemberRow): string {
  const firstName = typeof member.first_name === "string" ? member.first_name.trim() : "";
  const lastName = typeof member.last_name === "string" ? member.last_name.trim() : "";
  return `${firstName} ${lastName}`.trim() || member.id;
}

function compareByFirstNameThenLastName(left: MemberRow, right: MemberRow): number {
  const leftFirst = typeof left.first_name === "string" ? left.first_name.trim() : "";
  const rightFirst = typeof right.first_name === "string" ? right.first_name.trim() : "";
  const leftLast = typeof left.last_name === "string" ? left.last_name.trim() : "";
  const rightLast = typeof right.last_name === "string" ? right.last_name.trim() : "";

  const leftHasFirst = leftFirst.length > 0;
  const rightHasFirst = rightFirst.length > 0;

  if (leftHasFirst !== rightHasFirst) {
    return leftHasFirst ? -1 : 1;
  }

  if (leftHasFirst && rightHasFirst) {
    const firstCompare = leftFirst.localeCompare(rightFirst, undefined, {
      sensitivity: "base",
    });
    if (firstCompare !== 0) {
      return firstCompare;
    }
  }

  const lastCompare = leftLast.localeCompare(rightLast, undefined, {
    sensitivity: "base",
  });
  if (lastCompare !== 0) {
    return lastCompare;
  }

  return left.id.localeCompare(right.id, undefined, {
    sensitivity: "base",
  });
}

function compareItemNames(left: string | null | undefined, right: string | null | undefined): number {
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

export default async function PpeInventoryPage() {
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);
  const departmentId = currentMember?.departmentId ?? null;
  const canManagePpe = departmentId
    ? await hasDepartmentPermission(
        supabase,
        departmentId,
        currentMember?.role,
        "inventory_management",
      )
    : false;

  let departmentName: string | null = null;
  let initialRows: PpeRow[] = [];
  let memberOptions: PpeMemberOption[] = [];
  let apparatusOptions: PpeApparatusOption[] = [];
  let initialError: string | null = null;

  if (departmentId) {
    const [
      { data: departmentData },
      { data: ppeData, error },
      { data: memberData, error: memberError },
      activeApparatusOptions,
    ] = await Promise.all([
      supabase
        .from("departments")
        .select("name")
        .eq("id", departmentId)
        .maybeSingle(),
      supabase
        .from("ppe_items")
        .select(
          "id, item_name, assigned_member_id, manufacturer, model, serial_number, asset_number, size, date_manufactured, placed_in_service_date, expiration_date, location, status, notes, photo_path, created_at, updated_at, assigned_member:assigned_member_id(first_name, last_name)",
        )
        .eq("department_id", departmentId)
        .order("status", { ascending: true })
        .order("item_name", { ascending: true }),
      supabase
        .from("members")
        .select("id, first_name, last_name")
        .eq("department_id", departmentId)
        .eq("active", true),
      getActiveApparatusOptions({ client: supabase, departmentId }),
    ]);

    departmentName = typeof departmentData?.name === "string" ? departmentData.name : null;

    if (error) {
      console.error("[ppe] initial load failed", error);
      initialError = error.message || "Unable to load PPE inventory.";
    }

    if (memberError) {
      console.error("[ppe] member load failed", memberError);
    }

    const sortedMembers = [...((memberData ?? []) as MemberRow[])].sort(compareByFirstNameThenLastName);
    memberOptions = sortedMembers.map((member) => ({
      id: member.id,
      label: memberDisplayName(member),
    }));
    apparatusOptions = activeApparatusOptions.map((row) => ({
      id: row.id,
      label: row.name?.trim() || row.id,
    }));

    initialRows = [...((ppeData ?? []) as Array<PpeRow & { assigned_member?: unknown }>)]
      .map((row) => ({
        ...row,
        assigned_member_name: row.assigned_member_id
          ? memberDisplayName({
              id: row.assigned_member_id,
              first_name: (row.assigned_member as { first_name?: string | null } | null)?.first_name ?? null,
              last_name: (row.assigned_member as { last_name?: string | null } | null)?.last_name ?? null,
            })
          : null,
      }))
      .sort((left, right) => compareItemNames(left.item_name, right.item_name));
  }

  return (
    
      <PpeWorkspace
        departmentName={departmentName}
        canManagePpe={canManagePpe}
        memberOptions={memberOptions}
        apparatusOptions={apparatusOptions}
        initialRows={initialRows}
        initialError={initialError}
      />
    
  );
}
