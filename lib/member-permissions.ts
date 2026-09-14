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

  return hasAssignedDepartmentPermission(supabase, departmentId, permissionKey);
}

export async function hasAssignedDepartmentPermission(
  supabase: SupabaseClient,
  departmentId: string,
  permissionKey: string,
): Promise<boolean> {
  if (!departmentId) {
    return false;
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

export async function hasInventoryPermission(
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

  const { data, error } = await supabase.rpc("member_has_inventory_permission", {
    p_department_id: departmentId,
    p_permission_key: permissionKey,
  });

  if (error) {
    return false;
  }

  return Boolean(data as RpcBooleanRow);
}

export async function hasTrainingProgramManagementPermission(
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

  const [canonical, legacy] = await Promise.all([
    hasDepartmentPermission(supabase, departmentId, role, "training_program_management"),
    hasDepartmentPermission(supabase, departmentId, role, "training_management"),
  ]);

  return canonical || legacy;
}

export async function hasTrainingAssignmentManagementPermission(
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

  const [canonical, legacyHomework, legacyTraining] = await Promise.all([
    hasDepartmentPermission(supabase, departmentId, role, "training_assignment_management"),
    hasDepartmentPermission(supabase, departmentId, role, "homework_assignment"),
    hasDepartmentPermission(supabase, departmentId, role, "training_management"),
  ]);

  return canonical || legacyHomework || legacyTraining;
}

export async function hasTrainingReviewManagementPermission(
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

  const [canonical, legacyReview, legacyTraining] = await Promise.all([
    hasDepartmentPermission(supabase, departmentId, role, "training_review_management"),
    hasDepartmentPermission(supabase, departmentId, role, "training_review"),
    hasDepartmentPermission(supabase, departmentId, role, "training_management"),
  ]);

  return canonical || legacyReview || legacyTraining;
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

export async function canManageDocuments(
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
    p_permission_key: "documents_management",
  });

  if (error) {
    return false;
  }

  return Boolean(data as RpcBooleanRow);
}

export async function canManagePrePlans(
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
    p_permission_key: "pre_plans_management",
  });

  if (error) {
    return false;
  }

  return Boolean(data as RpcBooleanRow);
}

export async function canEditAnyDeficiency(
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

  const [editAnyResult, legacyResult] = await Promise.all([
    supabase.rpc("member_has_app_permission", {
      p_department_id: departmentId,
      p_permission_key: "deficiency_edit_any",
    }),
    supabase.rpc("member_has_app_permission", {
      p_department_id: departmentId,
      p_permission_key: "deficiency_management",
    }),
  ]);

  if (editAnyResult.error && legacyResult.error) {
    return false;
  }

  return Boolean(editAnyResult.data as RpcBooleanRow) || Boolean(legacyResult.data as RpcBooleanRow);
}

export async function canResolveDeficiencies(
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

  const [resolveResult, legacyResult] = await Promise.all([
    supabase.rpc("member_has_app_permission", {
      p_department_id: departmentId,
      p_permission_key: "deficiency_resolve",
    }),
    supabase.rpc("member_has_app_permission", {
      p_department_id: departmentId,
      p_permission_key: "deficiency_management",
    }),
  ]);

  if (resolveResult.error && legacyResult.error) {
    return false;
  }

  return Boolean(resolveResult.data as RpcBooleanRow) || Boolean(legacyResult.data as RpcBooleanRow);
}
