import { jsonResponse, resolvePumpTestActor } from "@/lib/pump-tests/access";
import { createUploadSlots } from "@/lib/pump-tests/upload-slots";

type PumpTestPayload = {
  apparatus_id?: unknown;
  test_date?: unknown;
  tester_type?: unknown;
  tester_member_id?: unknown;
  external_tester_name?: unknown;
  external_tester_company?: unknown;
  result?: unknown;
  notes?: unknown;
  files?: unknown;
};

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function POST(request: Request) {
  const actor = await resolvePumpTestActor();
  if (!actor) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }

  let payload: PumpTestPayload;
  try {
    payload = (await request.json()) as PumpTestPayload;
  } catch {
    return jsonResponse({ ok: false, error: "Invalid request." }, 400);
  }

  const apparatusId = typeof payload.apparatus_id === "string" ? payload.apparatus_id : "";
  const testDate = typeof payload.test_date === "string" ? payload.test_date : "";
  const testerType = payload.tester_type;
  const result = payload.result;

  if (!apparatusId) return jsonResponse({ ok: false, error: "Select an apparatus unit before saving." }, 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(testDate) || Number.isNaN(new Date(`${testDate}T00:00:00`).getTime())) {
    return jsonResponse({ ok: false, error: "Select a test date." }, 400);
  }
  if (testerType !== "department_member" && testerType !== "external_tester") {
    return jsonResponse({ ok: false, error: "Select who performed the pump test." }, 400);
  }
  if (result !== "Pass" && result !== "Fail") {
    return jsonResponse({ ok: false, error: "Select Pass or Fail." }, 400);
  }

  const testerMemberId = testerType === "department_member" ? optionalText(payload.tester_member_id) : null;
  const externalName = testerType === "external_tester" ? optionalText(payload.external_tester_name) : null;
  if (testerType === "department_member" && !testerMemberId) {
    return jsonResponse({ ok: false, error: "Select the department member who completed the test." }, 400);
  }
  if (testerType === "external_tester" && !externalName) {
    return jsonResponse({ ok: false, error: "External tester name is required." }, 400);
  }

  const { data: apparatus } = await actor.supabase
    .from("apparatus")
    .select("id")
    .eq("id", apparatusId)
    .eq("department_id", actor.departmentId)
    .maybeSingle();
  if (!apparatus) {
    return jsonResponse({ ok: false, error: "Apparatus is invalid for this department." }, 400);
  }

  if (testerMemberId) {
    const { data: tester } = await actor.supabase
      .from("members")
      .select("id")
      .eq("id", testerMemberId)
      .eq("department_id", actor.departmentId)
      .maybeSingle();
    if (!tester) {
      return jsonResponse({ ok: false, error: "Tester is invalid for this department." }, 400);
    }
  }

  const pumpTestId = crypto.randomUUID();
  const slots = await createUploadSlots(actor, pumpTestId, payload.files);
  if (!slots.ok) {
    return jsonResponse({ ok: false, error: slots.error }, 400);
  }

  const { error: insertError } = await actor.admin.from("apparatus_pump_tests").insert({
    id: pumpTestId,
    department_id: actor.departmentId,
    apparatus_id: apparatusId,
    test_date: testDate,
    tester_type: testerType,
    tester_member_id: testerMemberId,
    external_tester_name: externalName,
    external_tester_company: testerType === "external_tester" ? optionalText(payload.external_tester_company) : null,
    result,
    notes: optionalText(payload.notes),
  });
  if (insertError) {
    return jsonResponse({ ok: false, error: insertError.message || "Unable to save pump test." }, 400);
  }

  return jsonResponse({ ok: true, pumpTest: { id: pumpTestId }, uploads: slots.slots });
}
