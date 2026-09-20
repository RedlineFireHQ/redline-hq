import { redirect } from "next/navigation";
import MobileApparatusCheck from "@/components/mobile/MobileApparatusCheck";
import { getApparatusById } from "@/lib/database";
import { getCurrentMember } from "@/lib/current-member";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { ApparatusChecklistResultStatus } from "@/lib/apparatus/checklist";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PageProps = { params: Promise<{ id: string }> };

type OptionRow = { id: string; name: string | null };

type ChecklistRow = {
  id: string;
  section_name: string | null;
  item_label: string | null;
  is_required: boolean;
  display_order: number | null;
};

type MemberRow = {
  member_id: string;
  first_name: string | null;
  last_name: string | null;
};

export default async function MobileApparatusCheckPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);

  if (!currentMember?.departmentId) {
    redirect("/login");
  }

  const apparatus = await getApparatusById(id, supabase);
  if (!apparatus || apparatus.department_id !== currentMember.departmentId) {
    redirect("/mobile/apparatus-checks");
  }

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const { data: latestInspection } = await supabase
    .from("apparatus_inspections")
    .select("status, created_at")
    .eq("apparatus_id", id)
    .gte("created_at", dayStart.toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let sessionId: string | null = null;
  if (!latestInspection?.created_at) {
    const { data: currentMemberSession } = await supabase
      .from("apparatus_check_sessions")
      .select("id, member_id")
      .eq("apparatus_id", id)
      .eq("department_id", currentMember.departmentId)
      .eq("member_id", currentMember.id)
      .eq("state", "in_progress")
      .is("completed_at", null)
      .is("abandoned_at", null)
      .is("expired_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data } = await supabase.rpc("get_or_create_apparatus_check_session", {
      p_apparatus_id: id,
      p_existing_session_id: currentMemberSession?.member_id === currentMember.id ? currentMemberSession.id : null,
      p_selected_result: null,
    });
    const returnedSessionId = typeof data === "string" && UUID_REGEX.test(data) ? data : null;
    if (returnedSessionId) {
      const { data: returnedSession } = await supabase
        .from("apparatus_check_sessions")
        .select("id, member_id")
        .eq("id", returnedSessionId)
        .eq("apparatus_id", id)
        .eq("department_id", currentMember.departmentId)
        .maybeSingle();
      sessionId = returnedSession?.member_id === currentMember.id ? returnedSession.id : null;
    }
  }

  const [{ data: setting }, { data: itemRows }, { data: progressRows }, { data: categoryRows }, { data: priorityRows }, { data: statusRows }] = await Promise.all([
    supabase.from("apparatus_inspection_settings").select("require_checklist").eq("department_id", currentMember.departmentId).maybeSingle(),
    supabase.from("apparatus_inspection_checklist_items").select("id, section_name, item_label, is_required, display_order").eq("department_id", currentMember.departmentId).eq("apparatus_id", id).eq("is_active", true).order("display_order", { ascending: true }),
    supabase.from("apparatus_inspection_checklist_progress").select("checklist_item_id, status").eq("department_id", currentMember.departmentId).eq("apparatus_id", id).eq("member_id", currentMember.id),
    supabase.from("deficiency_categories").select("id, name").order("display_order", { ascending: true }),
    supabase.from("deficiency_priorities").select("id, name").order("display_order", { ascending: true }),
    supabase.from("deficiency_statuses").select("id, name").order("display_order", { ascending: true }),
  ]);

  const { data: sessionHelperRows } = sessionId
    ? await supabase.from("apparatus_check_session_members").select("member_id").eq("session_id", sessionId)
    : { data: [] };
  const { data: departmentMemberRows, error: departmentMemberError } = sessionId
    ? await supabase.rpc("get_apparatus_check_member_options", { p_session_id: sessionId })
    : { data: [], error: null };

  const options = (rows: OptionRow[] | null | undefined) => (rows ?? []).map((row) => ({ id: row.id, name: row.name ?? row.id }));
  const openStatus = (statusRows ?? []).find((row) => typeof row.name === "string" && row.name.toLowerCase() === "open");
  const checklistItems = ((itemRows ?? []) as ChecklistRow[]).map((row) => ({
    id: row.id,
    sectionName: row.section_name?.trim() || "General",
    itemLabel: row.item_label?.trim() || "Inspection item",
    isRequired: row.is_required === true,
    displayOrder: row.display_order ?? 0,
  }));
  const initialProgress = ((progressRows ?? []) as Array<{ checklist_item_id: string; status: ApparatusChecklistResultStatus }>).map((row) => ({
    checklistItemId: row.checklist_item_id,
    status: row.status,
  }));
  const departmentMembers = Array.from(
    new Map(
      ((departmentMemberRows ?? []) as MemberRow[]).map((row) => [row.member_id, row]),
    ).values(),
  );
  const helperIds = new Set((sessionHelperRows ?? []).map((row) => row.member_id));
  const toParticipant = (row: MemberRow) => ({
    memberId: row.member_id,
    name: `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || row.member_id,
  });
  const helperParticipants = departmentMembers.filter((row) => helperIds.has(row.member_id)).map(toParticipant);
  const availableHelpers = departmentMembers.filter((row) => row.member_id !== currentMember.id && !helperIds.has(row.member_id)).map(toParticipant);

  return (
    <MobileApparatusCheck
      apparatusId={id}
      apparatusName={apparatus.name ?? "Apparatus"}
      departmentId={currentMember.departmentId}
      memberId={currentMember.id}
      memberName={currentMember.name}
      sessionId={sessionId}
      sessionOwnerMemberId={currentMember.id}
      checklistRequired={
        typeof apparatus.checklist_required_override === "boolean"
          ? apparatus.checklist_required_override
          : setting?.require_checklist === true
      }
      checklistItems={checklistItems}
      initialProgress={initialProgress}
      categories={options(categoryRows as OptionRow[] | null)}
      priorities={options(priorityRows as OptionRow[] | null)}
      openStatusId={typeof openStatus?.id === "string" ? openStatus.id : ""}
      initialCompletedStatus={typeof latestInspection?.status === "string" ? latestInspection.status : null}
      helperParticipants={helperParticipants}
      availableHelpers={availableHelpers}
      memberLookupError={departmentMemberError?.message ?? null}
    />
  );
}
