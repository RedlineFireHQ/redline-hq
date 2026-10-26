import { redirect } from "next/navigation";
import EmsInventorySwitch from "@/components/inventory/EmsInventorySwitch";
import DrugBoxSection from "@/components/inventory/DrugBoxSection";
import { getCurrentMember } from "@/lib/current-member";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getDrugBoxes, getDrugInspections } from "@/lib/drug-boxes/data";

export default async function EmsDrugBoxPage() {
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);

  if (!currentMember?.departmentId) {
    redirect("/login");
  }

  const departmentId = currentMember.departmentId;

  const [departmentResult, boxesResult, inspectionsResult] = await Promise.all([
    supabase.from("departments").select("name").eq("id", departmentId).maybeSingle(),
    getDrugBoxes(supabase, departmentId),
    getDrugInspections(supabase, departmentId),
  ]);

  const departmentName = typeof departmentResult.data?.name === "string" ? departmentResult.data.name : null;

  // Delete visibility: only an Administrator of the active department.
  const canDelete = currentMember.role === "administrator";

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <EmsInventorySwitch activeView="drug-box" />
      {boxesResult.status === "missing_schema" ? (
        <section className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-6">
          <p className="text-sm font-semibold text-amber-200">Drug Box inspections are not set up yet.</p>
          <p className="mt-2 text-sm text-amber-100/80">
            The Drug Box database foundation has not been applied. An administrator needs to apply the drug box
            migration before inspections can be recorded. No data has been changed.
          </p>
        </section>
      ) : (
        <DrugBoxSection
          departmentName={departmentName}
          boxes={boxesResult.boxes}
          inspections={inspectionsResult.status === "ok" ? inspectionsResult.inspections : []}
          canDelete={canDelete}
        />
      )}
    </div>
  );
}
