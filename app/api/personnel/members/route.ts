import { getCurrentMember } from "@/lib/current-member";
import { canManagePersonnel } from "@/lib/member-permissions";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { parseOptionalMemberRank, normalizePermissionKeys } from "@/lib/app-permissions";

type CreateMemberPayload = {
  firstName?: unknown;
  lastName?: unknown;
  email?: unknown;
  phone?: unknown;
  rank?: unknown;
  departmentRoleId?: unknown;
  requestId?: unknown;
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

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as CreateMemberPayload;
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
    const requestId = normalizeOptionalString(payload.requestId);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)) {
      return jsonResponse({ ok: false, error: "Unable to identify this submission. Reopen Add Member." }, 400);
    }
    const rank = parseOptionalMemberRank(payload.rank);
    if (payload.departmentRoleId !== null && typeof payload.departmentRoleId !== "string") {
      return jsonResponse({ ok: false, error: "Department Role selection is required; use Unassigned explicitly when appropriate." }, 400);
    }
    const departmentRoleId = normalizeOptionalString(payload.departmentRoleId) || null;
    if (departmentRoleId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(departmentRoleId)) {
      return jsonResponse({ ok: false, error: "Invalid Department Role." }, 400);
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

    const { data, error } = await supabase.rpc("create_department_member_with_role", {
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
      p_department_role_id: departmentRoleId,
      p_department_id: currentMember.departmentId,
      p_request_id: requestId,
    });

    if (error) {
      const message = error.message || "Unable to create member.";
      if (!error.code || !/^[0-9A-Z]{5}$/.test(error.code)) {
        return jsonResponse({ ok: false, error: `${message} The save outcome could not be confirmed. Review Personnel before retrying.` }, 502);
      }
      const status = error.code === "23505" ? 409 : message.toLowerCase().startsWith("forbidden") ? 403 : 400;
      return jsonResponse({ ok: false, error: message }, status);
    }

    if (typeof data !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data)) {
      return jsonResponse({ ok: false, error: "The save result could not be confirmed. Review Personnel before retrying." }, 502);
    }
    return jsonResponse({ ok: true, memberId: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create member.";
    return jsonResponse({ ok: false, error: `${message} The save outcome could not be confirmed. Review Personnel before retrying.` }, 500);
  }
}
