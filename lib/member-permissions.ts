import type { SupabaseClient } from "@supabase/supabase-js";

type RpcBooleanRow = boolean | null;

function normalizeRole(role: unknown): string {
  return typeof role === "string" ? role.trim().toLowerCase() : "";
}

export function isAdministratorRole(role: unknown): boolean {
  return normalizeRole(role) === "administrator";
}

export async function hasDepartmentPermission(
  supabase: SupabaseClient,
  departmentId: string,
  role: unknown,
  permissionKey: string,
): Promise<boolean> {
  if (!departmentId) {
    return false;
  }

  if (isAdministratorRole(role)) {
    return true;
  }

  const { data, error } = await supabase.rpc("member_has_app_permission", {
    p_department_id: departmentId,
    p_permission_key: permissionKey,
  });

  if (error) {
    return false;
  }

  return Boolean(data as RpcBooleanRow);
}

export async function canManagePersonnel(
  supabase: SupabaseClient,
  departmentId: string,
  role: unknown,
): Promise<boolean> {
  if (!departmentId) {
    return false;
  }

  if (isAdministratorRole(role)) {
    return true;
  }

  const { data, error } = await supabase.rpc("can_manage_personnel", {
    p_department_id: departmentId,
  });

  if (error) {
    return false;
  }

  return Boolean(data as RpcBooleanRow);
}

export async function canManageApparatus(
  supabase: SupabaseClient,
  departmentId: string,
  role: unknown,
): Promise<boolean> {
  if (!departmentId) {
    return false;
  }

  if (isAdministratorRole(role)) {
    return true;
  }

  const { data, error } = await supabase.rpc("member_has_app_permission", {
    p_department_id: departmentId,
    p_permission_key: "apparatus_management",
  });

  if (error) {
    return false;
  }

  return Boolean(data as RpcBooleanRow);
}
