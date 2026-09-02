import { getCurrentMember } from "@/lib/current-member";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type CreateInspectionPayload = {
  inspectionDate?: unknown;
  primaryInspectorMemberId?: unknown;
  participantMemberIds?: unknown;
  result?: unknown;
  notes?: unknown;
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

function normalizeName(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const relation = value as Record<string, unknown>;
  const firstName = typeof relation.first_name === "string" ? relation.first_name.trim() : "";
  const lastName = typeof relation.last_name === "string" ? relation.last_name.trim() : "";
  const fullName = `${firstName} ${lastName}`.trim();

  return fullName || null;
}

function compareNames(left: string, right: string) {
  const leftFirst = left.split(" ")[0] ?? "";
  const rightFirst = right.split(" ")[0] ?? "";
  const leftHasFirst = leftFirst.trim().length > 0;
  const rightHasFirst = rightFirst.trim().length > 0;

  if (leftHasFirst !== rightHasFirst) {
    return leftHasFirst ? -1 : 1;
  }

  const firstCompare = leftFirst.localeCompare(rightFirst, undefined, { sensitivity: "base" });
  if (firstCompare !== 0) {
    return firstCompare;
  }

  return left.localeCompare(right, undefined, { sensitivity: "base" });
}

function parseInspectionDate(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const parsed = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
}

export async function GET(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createSupabaseServerClient();
    const currentMember = await getCurrentMember(supabase);

    if (!currentMember?.departmentId) {
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    }

    const { data: inspectionRows, error: inspectionError } = await supabase
      .from("rope_inspections")
      .select("id, inspection_date, result, notes, primary_inspector_member_id, primary_inspector:primary_inspector_member_id(first_name, last_name)")
      .eq("department_id", currentMember.departmentId)
      .eq("rope_item_id", id)
      .order("inspection_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (inspectionError) {
      return jsonResponse({ ok: false, error: inspectionError.message || "Unable to load rope inspections." }, 400);
    }

    const inspections = (inspectionRows ?? []) as Array<{
      id: string;
      inspection_date: string | null;
      result: string | null;
      notes: string | null;
      primary_inspector: unknown;
    }>;

    const inspectionIds = inspections.map((row) => row.id).filter(Boolean);
    const participantNamesByInspectionId = new Map<string, string[]>();

    if (inspectionIds.length > 0) {
      const { data: participantRows } = await supabase
        .from("rope_inspection_participants")
        .select("rope_inspection_id, member:member_id(first_name, last_name)")
        .eq("department_id", currentMember.departmentId)
        .in("rope_inspection_id", inspectionIds);

      for (const row of (participantRows ?? []) as Array<{ rope_inspection_id: string | null; member: unknown }>) {
        if (typeof row.rope_inspection_id !== "string" || !row.rope_inspection_id) {
          continue;
        }

        const memberName = normalizeName(row.member);
        if (!memberName) {
          continue;
        }

        const current = participantNamesByInspectionId.get(row.rope_inspection_id) ?? [];
        current.push(memberName);
        participantNamesByInspectionId.set(row.rope_inspection_id, current);
      }
    }

    const rows = inspections.map((row) => ({
      id: row.id,
      inspection_date: row.inspection_date,
      result: row.result,
      notes: row.notes,
      primary_inspector_name: normalizeName(Array.isArray(row.primary_inspector) ? row.primary_inspector[0] : row.primary_inspector),
      participant_names: (participantNamesByInspectionId.get(row.id) ?? []).sort(compareNames),
    }));

    return jsonResponse({ ok: true, rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load rope inspections.";
    return jsonResponse({ ok: false, error: message }, 400);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const payload = (await request.json().catch(() => ({}))) as CreateInspectionPayload;
    const supabase = await createSupabaseServerClient();
    const currentMember = await getCurrentMember(supabase);

    if (!currentMember?.departmentId) {
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    }

    const inspectionDate = parseInspectionDate(payload.inspectionDate) ?? new Date().toISOString().slice(0, 10);
    const normalizedResult = typeof payload.result === "string" ? payload.result.trim().toLowerCase() : "";
    const result = normalizedResult === "fail" ? "fail" : "pass";
    const notes = typeof payload.notes === "string" ? payload.notes.trim() : "";
    const primaryInspectorMemberId = typeof payload.primaryInspectorMemberId === "string" && payload.primaryInspectorMemberId.trim()
      ? payload.primaryInspectorMemberId.trim()
      : currentMember.id;
    const participantMemberIds = [...new Set(asStringArray(payload.participantMemberIds).filter((memberId) => memberId !== primaryInspectorMemberId))];

    const { data: ropeRow, error: ropeError } = await supabase
      .from("rope_items")
      .select("id")
      .eq("id", id)
      .eq("department_id", currentMember.departmentId)
      .maybeSingle();

    if (ropeError) {
      return jsonResponse({ ok: false, error: ropeError.message || "Unable to save rope inspection." }, 400);
    }

    if (!ropeRow) {
      return jsonResponse({ ok: false, error: "Rope item not found." }, 404);
    }

    const { data: primaryInspector, error: primaryInspectorError } = await supabase
      .from("members")
      .select("id")
      .eq("id", primaryInspectorMemberId)
      .eq("department_id", currentMember.departmentId)
      .maybeSingle();

    if (primaryInspectorError || !primaryInspector) {
      return jsonResponse({ ok: false, error: "Primary inspector was not found in this department." }, 400);
    }

    if (participantMemberIds.length > 0) {
      const { data: participantMembers, error: participantError } = await supabase
        .from("members")
        .select("id")
        .eq("department_id", currentMember.departmentId)
        .in("id", participantMemberIds);

      if (participantError) {
        return jsonResponse({ ok: false, error: participantError.message || "Unable to save rope inspection." }, 400);
      }

      if ((participantMembers ?? []).length !== participantMemberIds.length) {
        return jsonResponse({ ok: false, error: "One or more inspection participants were not found in this department." }, 400);
      }
    }

    const { data: inspectionRow, error: inspectionError } = await supabase
      .from("rope_inspections")
      .insert({
        department_id: currentMember.departmentId,
        rope_item_id: id,
        inspection_date: inspectionDate,
        primary_inspector_member_id: primaryInspectorMemberId,
        result,
        notes: notes || null,
      })
      .select("id, inspection_date, result, notes, primary_inspector_member_id, primary_inspector:primary_inspector_member_id(first_name, last_name)")
      .single();

    if (inspectionError || !inspectionRow) {
      return jsonResponse({ ok: false, error: inspectionError?.message || "Unable to save rope inspection." }, 400);
    }

    if (participantMemberIds.length > 0) {
      const participantRows = participantMemberIds.map((memberId) => ({
        department_id: currentMember.departmentId,
        rope_inspection_id: inspectionRow.id,
        member_id: memberId,
        added_by_member_id: currentMember.id,
      }));

      const { error: participantInsertError } = await supabase
        .from("rope_inspection_participants")
        .insert(participantRows);

      if (participantInsertError) {
        return jsonResponse({ ok: false, error: participantInsertError.message || "Unable to save rope inspection participants." }, 400);
      }
    }

    return jsonResponse({
      ok: true,
      inspection: {
        id: inspectionRow.id,
        inspection_date: inspectionRow.inspection_date,
        result: inspectionRow.result,
        notes: inspectionRow.notes,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save rope inspection.";
    return jsonResponse({ ok: false, error: message }, 400);
  }
}