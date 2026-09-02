import { getCurrentMember } from "@/lib/current-member";
import { canManagePersonnel } from "@/lib/member-permissions";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isValidMemberRank, normalizePermissionKeys } from "@/lib/app-permissions";

type CreateMemberPayload = {
  firstName?: unknown;
  lastName?: unknown;
  email?: unknown;
  phone?: unknown;
  rank?: unknown;
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
    const currentMember = await getCurrentMember(supabase);

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
    const rank = normalizeOptionalString(payload.rank);
    const active = payload.active === false ? false : true;
    const hireStartDate = normalizeOptionalDate(payload.hireStartDate);
    const inactiveDate = normalizeOptionalDate(payload.inactiveDate);
    const specialPermissionsEnabled = payload.specialPermissionsEnabled === true;
    const permissionKeys = normalizePermissionKeys(payload.permissionKeys);

    if (!firstName || !lastName) {
      return jsonResponse({ ok: false, error: "First name and last name are required." }, 400);
    }

    if (!isValidMemberRank(rank)) {
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

    const { data, error } = await supabase.rpc("create_department_member", {
      p_first_name: firstName,
      p_last_name: lastName,
      p_email: email || null,
      p_phone: phone || null,
      p_rank: rank,
      p_active: active,
      p_special_permissions_enabled: specialPermissionsEnabled,
      p_permission_keys: permissionKeys,
      p_hire_start_date: hireStartDate,
      p_inactive_date: inactiveDate,
    });

    if (error) {
      const message = error.message || "Unable to create member.";
      const status = message.toLowerCase().startsWith("forbidden") ? 403 : 400;
      return jsonResponse({ ok: false, error: message }, status);
    }

    return jsonResponse({ ok: true, memberId: String(data) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create member.";
    return jsonResponse({ ok: false, error: message }, 400);
  }
}
