import { getCurrentMember } from "@/lib/current-member";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createDrugInspection, getDrugBox } from "@/lib/drug-boxes/data";

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status });
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/**
 * Complete a drug box inspection: persists a new inspection record plus its
 * immutable per-item snapshot, scoped to the caller's active department. The
 * inspector is always the authenticated member; the box is verified to belong
 * to the active department. Never trusts a client-supplied department id.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const currentMember = await getCurrentMember(supabase);

    if (!currentMember?.departmentId) {
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) {
      return jsonResponse({ ok: false, error: "Invalid request." }, 400);
    }

    const drugBoxId = typeof body.drugBoxId === "string" ? body.drugBoxId : "";
    const checkedItemIds = Array.isArray(body.checkedItemIds)
      ? (body.checkedItemIds as unknown[]).filter((v): v is string => typeof v === "string")
      : [];
    const expiredItemIds = Array.isArray(body.expiredItemIds)
      ? (body.expiredItemIds as unknown[]).filter((v): v is string => typeof v === "string")
      : [];

    if (!drugBoxId) {
      return jsonResponse({ ok: false, error: "Drug box is required." }, 400);
    }

    // Verify the box belongs to the active department (ownership check).
    const box = await getDrugBox(supabase, currentMember.departmentId, drugBoxId);
    if (box === "missing_schema") {
      return jsonResponse({ ok: false, error: "Drug box inspections are not set up yet." }, 503);
    }
    if (box === "not_found" || box === "forbidden") {
      return jsonResponse({ ok: false, error: "Drug box not found." }, 404);
    }

    const unitNumber = typeof body.unitNumber === "string" ? body.unitNumber.trim() : box.squadNumber;
    if (!unitNumber) {
      return jsonResponse({ ok: false, error: "Unit number is required." }, 400);
    }

    const result = await createDrugInspection(supabase, currentMember.departmentId, {
      drugBoxId: box.id,
      squadNumber: box.squadNumber,
      inspectorMemberId: currentMember.id,
      inspectorName: currentMember.name,
      unitNumber,
      boxLockNumber: typeof body.boxLockNumber === "string" ? body.boxLockNumber.trim() : "",
      csLockNumber: typeof body.csLockNumber === "string" ? body.csLockNumber.trim() : "",
      ezIoNumber: typeof body.ezIoNumber === "string" ? body.ezIoNumber.trim() : "",
      assistingPersonnel: asStringArray(body.assistingPersonnel),
      checkedItemIds: new Set(checkedItemIds),
      expiredItemIds: new Set(expiredItemIds),
    });

    if (result.status !== "ok") {
      return jsonResponse({ ok: false, error: result.message }, 400);
    }

    return jsonResponse({ ok: true, inspectionId: result.inspectionId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save this drug box inspection.";
    return jsonResponse({ ok: false, error: message }, 400);
  }
}
