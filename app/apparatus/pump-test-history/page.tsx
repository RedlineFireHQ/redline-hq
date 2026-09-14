import Link from "next/link";
import PageLayout from "@/components/layout/PageLayout";
import PumpTestHistoryTable from "@/components/apparatus/PumpTestHistoryTable";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getCurrentMember } from "@/lib/current-member";

export default async function PumpTestHistoryPage() {
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);

  if (!currentMember?.departmentId) {
    return (
      <PageLayout environmentBackgroundUrl="/branding/images/apparatuspageimage.png" environmentBackgroundPosition="left center">
        <div className="mx-auto max-w-3xl rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-8 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-red-500">Apparatus</p>
          <h1 className="mt-3 text-3xl font-black text-white">Pump Test History</h1>
          <p className="mt-3 text-neutral-400">Unable to determine your department.</p>
        </div>
      </PageLayout>
    );
  }

  const { data: rowsData } = await supabase
    .from("apparatus_pump_tests")
    .select(
      "id, test_date, result, notes, tester_type, tester_member_id, external_tester_name, external_tester_company, apparatus:apparatus_id(id, name)",
    )
    .eq("department_id", currentMember.departmentId)
    .order("test_date", { ascending: false })
    .order("created_at", { ascending: false });

  const memberIds = Array.from(
    new Set(
      ((rowsData ?? []) as Array<{ tester_member_id: string | null }>).map((row) => row.tester_member_id).filter((memberId): memberId is string => Boolean(memberId)),
    ),
  );

  let memberNameById: Record<string, string> = {};

  if (memberIds.length > 0) {
    const { data: memberRows } = await supabase
      .from("members")
      .select("id, first_name, last_name")
      .in("id", memberIds);

    memberNameById = ((memberRows ?? []) as Array<{ id: string; first_name: string | null; last_name: string | null }>).reduce<Record<string, string>>((accumulator, member) => {
      const label = `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim();
      accumulator[member.id] = label || member.id;
      return accumulator;
    }, {});
  }

  const rows = ((rowsData ?? []) as Array<{
    id: string;
    test_date: string | null;
    result: string | null;
    notes: string | null;
    tester_type: string | null;
    tester_member_id: string | null;
    external_tester_name: string | null;
    external_tester_company: string | null;
    apparatus: { id: string; name: string | null } | { id: string; name: string | null }[] | null;
  }>).map((row) => {
    const apparatus = Array.isArray(row.apparatus) ? row.apparatus[0] : row.apparatus;
    const testerName = row.tester_type === "external_tester"
      ? [row.external_tester_name, row.external_tester_company].filter(Boolean).join(" / ") || "External Tester"
      : row.tester_member_id
        ? memberNameById[row.tester_member_id] ?? "Department Member"
        : "Department Member";

    return {
      id: row.id,
      apparatusName: apparatus?.name ?? "Unknown Apparatus",
      testDate: row.test_date,
      testedBy: testerName,
      result: row.result,
      notes: row.notes,
    };
  });

  return (
    <PageLayout environmentBackgroundUrl="/branding/images/apparatuspageimage.png" environmentBackgroundPosition="left center">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-red-500">Apparatus</p>
            <h1 className="mt-2 text-[2.25rem] font-[700] leading-none tracking-[-0.06em] text-white">Pump Test History</h1>
            <p className="mt-3 text-neutral-400">Department-scoped apparatus pump test history.</p>
          </div>

          <div className="flex gap-2">
            <Link
              href="/apparatus"
              className="inline-flex rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
            >
              Back to Apparatus
            </Link>
            <Link
              href="/apparatus/pump-test"
              className="inline-flex rounded-lg border border-red-500/30 bg-red-900/20 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-900/30"
            >
              New Pump Test
            </Link>
          </div>
        </div>

        <PumpTestHistoryTable rows={rows} />
      </div>
    </PageLayout>
  );
}
