import { getCurrentMember } from "@/lib/current-member";
import { canManagePersonnel } from "@/lib/member-permissions";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { parseOptionalMemberRank, normalizePermissionKeys } from "@/lib/app-permissions";

type UpdateMemberPayload = {
  firstName?: unknown;
  lastName?: unknown;
  email?: unknown;
  phone?: unknown;
  rank?: unknown;
  departmentRoleId?: unknown;
  active?: unknown;
  hireStartDate?: unknown;
  inactiveDate?: unknown;
  specialPermissionsEnabled?: unknown;
  permissionKeys?: unknown;
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

function normalizeOptionalString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOptionalDate(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const candidate = value.trim();
  if (!candidate) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) {
    return null;
  }

  const parsed = new Date(`${candidate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return candidate;
}

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const payload = (await request.json()) as UpdateMemberPayload;

    if (!id) {
      return jsonResponse({ ok: false, error: "Member id is required." }, 400);
    }

    const supabase = await createSupabaseServerClient();
    const currentMember = await getCurrentMember(supabase, { requireActiveDepartmentMatch: true });

    if (!currentMember?.departmentId) {
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    }

    const hasAccess = await canManagePersonnel(
      supabase,
      currentMember.departmentId,
      currentMember.role,
    );

    if (!hasAccess) {
      return jsonResponse({ ok: false, error: "Forbidden" }, 403);
    }

    const firstName = normalizeOptionalString(payload.firstName);
    const lastName = normalizeOptionalString(payload.lastName);
    const email = normalizeOptionalString(payload.email);
    const phone = normalizeOptionalString(payload.phone);
    const { data: existingMember, error: memberError } = await supabase
      .from("members")
      .select("id, rank, department_role_id")
      .eq("department_id", currentMember.departmentId)
      .eq("id", id)
      .maybeSingle();

    if (memberError) {
      return jsonResponse({ ok: false, error: memberError.message || "Unable to load member." }, 400);
    }
    if (!existingMember) {
      return jsonResponse({ ok: false, error: "Member not found in this department." }, 404);
    }

    // Existing RPCs still require the legacy field; omitted values must preserve it.
    const rank = parseOptionalMemberRank(payload.rank === undefined ? existingMember.rank : payload.rank);
    let departmentRoleId = existingMember.department_role_id;
    if (payload.departmentRoleId !== undefined) {
      if (payload.departmentRoleId !== null && typeof payload.departmentRoleId !== "string") {
        return jsonResponse({ ok: false, error: "Invalid Department Role." }, 400);
      }
      departmentRoleId = normalizeOptionalString(payload.departmentRoleId) || null;
      if (departmentRoleId) {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(departmentRoleId)) {
          return jsonResponse({ ok: false, error: "Invalid Department Role." }, 400);
        }
        const { data: role, error: roleError } = await supabase
          .from("department_roles")
          .select("id, active")
          .eq("department_id", currentMember.departmentId)
          .eq("id", departmentRoleId)
          .maybeSingle();
        if (roleError) {
          return jsonResponse({ ok: false, error: roleError.message || "Unable to load Department Role." }, 400);
        }
        if (!role || (role.active === false && role.id !== existingMember.department_role_id)) {
          return jsonResponse({ ok: false, error: "Select an active Department Role from this department." }, 400);
        }
      }
    }
    const active = payload.active === false ? false : true;
    const hireStartDate = normalizeOptionalDate(payload.hireStartDate);
    const inactiveDate = normalizeOptionalDate(payload.inactiveDate);
    const specialPermissionsEnabled = payload.specialPermissionsEnabled === true;
    const permissionKeys = normalizePermissionKeys(payload.permissionKeys);

    if (!firstName || !lastName) {
      return jsonResponse({ ok: false, error: "First name and last name are required." }, 400);
    }

    if (!rank.ok) {
      return jsonResponse({ ok: false, error: "Invalid rank." }, 400);
    }

    if (
      typeof payload.hireStartDate === "string" &&
      payload.hireStartDate.trim().length > 0 &&
      !hireStartDate
    ) {
      return jsonResponse({ ok: false, error: "Hire / Start Date must be a valid date." }, 400);
    }

    if (
      typeof payload.inactiveDate === "string" &&
      payload.inactiveDate.trim().length > 0 &&
      !inactiveDate
    ) {
      return jsonResponse({ ok: false, error: "Exit / Inactive Date must be a valid date." }, 400);
    }

    if (active && inactiveDate) {
      return jsonResponse({ ok: false, error: "Exit / Inactive Date must be blank for active members." }, 400);
    }

    if (!active && !inactiveDate) {
      return jsonResponse({ ok: false, error: "Inactive members require an Exit / Inactive Date." }, 400);
    }

    if (hireStartDate && inactiveDate && inactiveDate < hireStartDate) {
      return jsonResponse({ ok: false, error: "Exit / Inactive Date cannot be before Hire / Start Date." }, 400);
    }

    const { data, error } = await supabase.rpc("update_department_member", {
      p_member_id: id,
      p_first_name: firstName,
      p_last_name: lastName,
      p_email: email || null,
      p_phone: phone || null,
      p_rank: rank.rank,
      p_active: active,
      p_special_permissions_enabled: specialPermissionsEnabled,
      p_permission_keys: permissionKeys,
      p_hire_start_date: hireStartDate,
      p_inactive_date: inactiveDate,
      p_department_id: currentMember.departmentId,
    });

    if (error) {
      const message = error.message || "Unable to update member.";
      const lowered = message.toLowerCase();
      const status = lowered.startsWith("forbidden") ? 403 : 400;
      return jsonResponse({ ok: false, error: message }, status);
    }

    if (data !== id) {
      return jsonResponse({ ok: false, error: "Member update did not affect the target member." }, 400);
    }

    if (departmentRoleId !== existingMember.department_role_id) {
      try {
        const { data: roleMemberId, error: roleError } = await supabase.rpc("update_department_member_role", {
          p_member_id: id,
          p_department_role_id: departmentRoleId,
          p_department_id: currentMember.departmentId,
        });
        if (roleError) {
          throw new Error(roleError.message || "Unable to save Department Role.");
        }
        if (roleMemberId !== id) {
          throw new Error("The role update did not affect the target member.");
        }
      } catch (roleError) {
        return jsonResponse({
          ok: false,
          memberId: id,
          error: `Member details were saved, but the Department Role update could not be confirmed: ${roleError instanceof Error ? roleError.message : "Unable to save Department Role."} Review the profile before retrying.`,
        }, 400);
      }
    }

    return jsonResponse({ ok: true, memberId: id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update member.";
    return jsonResponse({ ok: false, error: message }, 400);
  }
}
