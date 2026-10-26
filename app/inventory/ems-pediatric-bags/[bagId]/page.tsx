import Link from "next/link";
import { redirect } from "next/navigation";
import EmsInventorySwitch from "@/components/inventory/EmsInventorySwitch";
import PediatricBagChecklistWorkspace from "@/components/inventory/PediatricBagChecklistWorkspace";
import { getCurrentMember } from "@/lib/current-member";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getDepartmentMemberOptions, getPediatricBagChecklist } from "@/lib/pediatric-bags/data";

interface PediatricBagCheckPageProps {
  params: Promise<{
    bagId: string;
  }>;
}

export default async function PediatricBagCheckPage({ params }: PediatricBagCheckPageProps) {
  const { bagId } = await params;
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);

  if (!currentMember?.departmentId) {
    redirect("/login");
  }

  const result = await getPediatricBagChecklist(supabase, bagId, currentMember.departmentId, currentMember.id);
  const availableMembers =
    result.status === "ok" ? await getDepartmentMemberOptions(supabase, currentMember.departmentId) : [];

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <EmsInventorySwitch activeView="pediatric-bags" />

      {result.status === "missing_schema" ? (
        <section className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-6">
          <p className="text-sm font-semibold text-amber-200">Pediatric Bags are not set up yet.</p>
          <p className="mt-2 text-sm text-amber-100/80">
            The Pediatric Bags database foundation has not been applied. An administrator needs to apply the
            pediatric bags migration before checklists can be used. No data has been changed.
          </p>
          <Link
            href="/inventory/ems-pediatric-bags"
            className="mt-4 inline-flex rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
          >
            Back to Pediatric Bags
          </Link>
        </section>
      ) : result.status === "not_found" ? (
        <section className="rounded-xl border border-neutral-800 bg-[#242424] p-6">
          <p className="text-sm font-semibold text-white">Pediatric bag not found.</p>
          <Link
            href="/inventory/ems-pediatric-bags"
            className="mt-4 inline-flex rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
          >
            Back to Pediatric Bags
          </Link>
        </section>
      ) : result.status === "forbidden" ? (
        <section className="rounded-xl border border-red-500/30 bg-red-950/20 p-6">
          <p className="text-sm font-semibold text-red-200">You do not have access to this pediatric bag.</p>
          <Link
            href="/inventory/ems-pediatric-bags"
            className="mt-4 inline-flex rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
          >
            Back to Pediatric Bags
          </Link>
        </section>
      ) : (
        <PediatricBagChecklistWorkspace
          departmentId={currentMember.departmentId}
          bagId={result.bag.id}
          bagLabel={result.bag.bagLabel}
          inspectorName={currentMember.name}
          currentMemberId={currentMember.id}
          availableMembers={availableMembers}
          items={result.items}
          progressRows={result.progress}
        />
      )}
    </div>
  );
}
