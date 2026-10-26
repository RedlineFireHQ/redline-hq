import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import EmsInventorySwitch from "@/components/inventory/EmsInventorySwitch";
import DrugInspectionDetailLoader from "@/components/inventory/DrugInspectionDetailLoader";
import { getCurrentMember } from "@/lib/current-member";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getDrugInspection } from "@/lib/drug-boxes/data";

interface DrugInspectionHistoryPageProps {
  params: Promise<{ inspectionId: string }>;
}

export default async function DrugInspectionHistoryPage({ params }: DrugInspectionHistoryPageProps) {
  const { inspectionId } = await params;
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);

  if (!currentMember?.departmentId) {
    redirect("/login");
  }

  const result = await getDrugInspection(supabase, currentMember.departmentId, inspectionId);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <EmsInventorySwitch activeView="drug-box" />
      {result.status === "missing_schema" ? (
        <section className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-6">
          <p className="text-sm font-semibold text-amber-200">Drug Box inspections are not set up yet.</p>
          <Link
            href="/inventory/ems-drug-box"
            className="mt-4 inline-flex rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
          >
            Back to Drug Boxes
          </Link>
        </section>
      ) : result.status === "not_found" || result.status === "forbidden" ? (
        notFound()
      ) : (
        <DrugInspectionDetailLoader inspection={result.inspection} />
      )}
    </div>
  );
}
