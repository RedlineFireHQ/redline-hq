import Link from "next/link";
import { redirect } from "next/navigation";
import PageLayout from "@/components/layout/PageLayout";
import ApparatusChecklistWorkspace from "@/components/apparatus/ApparatusChecklistWorkspace";
import { getApparatusById } from "@/lib/database";
import { getCurrentMember } from "@/lib/current-member";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type ChecklistItemRow = {
  id: string;
  section_name: string;
  item_label: string;
  is_required: boolean;
  display_order: number;
};

type ChecklistProgressRow = {
  checklist_item_id: string;
  status: "checked" | "deficiency" | "not_applicable";
  note: string | null;
};

interface ApparatusChecklistPageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    returnTo?: string;
  }>;
}

export default async function ApparatusChecklistPage({
  params,
  searchParams,
}: ApparatusChecklistPageProps) {
  const { id } = await params;
  const { returnTo } = await searchParams;

  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);

  if (!currentMember?.departmentId) {
    redirect("/login");
  }

  const apparatus = await getApparatusById(id);
  if (!apparatus || apparatus.department_id !== currentMember.departmentId) {
    redirect("/apparatus");
  }

  const safeReturnTo =
    typeof returnTo === "string" && returnTo.startsWith("/")
      ? returnTo
      : `/apparatus/${id}/daily-check`;

  const [{ data: settingRow }, { data: checklistItemRows }, { data: checklistProgressRows }] = await Promise.all([
    supabase
      .from("apparatus_inspection_settings")
      .select("require_checklist")
      .eq("department_id", currentMember.departmentId)
      .maybeSingle(),
    supabase
      .from("apparatus_inspection_checklist_items")
      .select("id, section_name, item_label, is_required, display_order")
      .eq("department_id", currentMember.departmentId)
      .eq("apparatus_id", id)
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("apparatus_inspection_checklist_progress")
      .select("checklist_item_id, status, note")
      .eq("department_id", currentMember.departmentId)
      .eq("apparatus_id", id)
      .eq("member_id", currentMember.id),
  ]);

  const checklistRequired = settingRow?.require_checklist === true;

  const items = ((checklistItemRows ?? []) as ChecklistItemRow[]).map((row) => ({
    id: row.id,
    sectionName: typeof row.section_name === "string" ? row.section_name : "General",
    itemLabel: typeof row.item_label === "string" ? row.item_label : "Inspection Item",
    isRequired: row.is_required === true,
    displayOrder: typeof row.display_order === "number" ? row.display_order : 0,
  }));

  const progressRows = ((checklistProgressRows ?? []) as ChecklistProgressRow[]).map((row) => ({
    checklistItemId: row.checklist_item_id,
    status: row.status,
    note: typeof row.note === "string" ? row.note : null,
  }));

  return (
    <PageLayout>
      <div className="space-y-6">
        <Link
          href={safeReturnTo}
          className="inline-flex items-center text-sm font-semibold text-zinc-300 transition hover:text-white"
        >
          Back to Apparatus Check
        </Link>

        <ApparatusChecklistWorkspace
          departmentId={currentMember.departmentId}
          apparatusId={id}
          apparatusName={
            typeof apparatus.name === "string" && apparatus.name.trim()
              ? apparatus.name.trim()
              : "Apparatus"
          }
          currentMemberId={currentMember.id}
          checklistRequired={checklistRequired}
          returnTo={safeReturnTo}
          items={items}
          progressRows={progressRows}
        />
      </div>
    </PageLayout>
  );
}
