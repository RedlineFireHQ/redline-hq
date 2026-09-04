import { getCurrentMember } from "@/lib/current-member";
import { fetchEmsSupplyHistory } from "@/lib/ems/supply-history";
import { hasDepartmentPermission } from "@/lib/member-permissions";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

function readSearchParam(url: URL, key: string): string | null {
  const value = url.searchParams.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function GET(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const currentMember = await getCurrentMember(supabase);

    if (!currentMember?.departmentId) {
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    }

    const canViewHistory = await hasDepartmentPermission(
      supabase,
      currentMember.departmentId,
      currentMember.role,
      "inventory_management",
    );

    if (!canViewHistory) {
      return jsonResponse({ ok: false, error: "Forbidden" }, 403);
    }

    const url = new URL(request.url);
    const rows = await fetchEmsSupplyHistory(supabase, currentMember.departmentId, {
      dateFrom: readSearchParam(url, "dateFrom"),
      dateTo: readSearchParam(url, "dateTo"),
      memberId: readSearchParam(url, "memberId"),
      supplyItemId: readSearchParam(url, "supplyItemId"),
      transactionType: readSearchParam(url, "transactionType"),
    });

    return jsonResponse({ ok: true, rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load EMS supply history.";
    return jsonResponse({ ok: false, error: message }, 400);
  }
}