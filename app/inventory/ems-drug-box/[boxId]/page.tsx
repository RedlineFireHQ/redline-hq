import Link from "next/link";
import { redirect } from "next/navigation";
import EmsInventorySwitch from "@/components/inventory/EmsInventorySwitch";
import DrugBoxChecklistLoader from "@/components/inventory/DrugBoxChecklistLoader";
import { getCurrentMember } from "@/lib/current-member";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getDrugBox } from "@/lib/drug-boxes/data";

interface DrugBoxCheckPageProps {
  params: Promise<{ boxId: string }>;
}

export default async function DrugBoxCheckPage({ params }: DrugBoxCheckPageProps) {
  const { boxId } = await params;
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);

  if (!currentMember?.departmentId) {
    redirect("/login");
  }

  const box = await getDrugBox(supabase, currentMember.departmentId, boxId);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <EmsInventorySwitch activeView="drug-box" />
      {box === "missing_schema" ? (
        <section className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-6">
          <p className="text-sm font-semibold text-amber-200">Drug Box inspections are not set up yet.</p>
          <BackLink />
        </section>
      ) : box === "not_found" || box === "forbidden" ? (
        <section className="rounded-xl border border-neutral-800 bg-[#242424] p-6">
          <p className="text-sm font-semibold text-white">Drug box not found.</p>
          <BackLink />
        </section>
      ) : (
        <DrugBoxChecklistLoader box={box} />
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/inventory/ems-drug-box"
      className="mt-4 inline-flex rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
    >
      Back to Drug Boxes
    </Link>
  );
}
