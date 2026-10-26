import EmsInventorySwitch from "@/components/inventory/EmsInventorySwitch";
import PediatricBagsBrowser from "@/components/inventory/PediatricBagsBrowser";
import { getCurrentMember } from "@/lib/current-member";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getPediatricBagsForDepartment, getPediatricInspectionHistory } from "@/lib/pediatric-bags/data";

export default async function EmsPediatricBagsPage() {
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);
  const departmentId = currentMember?.departmentId ?? null;
  const canDeleteInspections = currentMember?.role === "administrator" && departmentId !== null;

  let departmentName: string | null = null;

  if (departmentId) {
    const { data: departmentData } = await supabase
      .from("departments")
      .select("name")
      .eq("id", departmentId)
      .maybeSingle();

    departmentName = typeof departmentData?.name === "string" ? departmentData.name : null;
  }

  const bagsResult = departmentId
    ? await getPediatricBagsForDepartment(supabase, departmentId)
    : { status: "missing_schema" as const, bags: [] };

  const historyResult = departmentId
    ? await getPediatricInspectionHistory(supabase, departmentId)
    : { status: "missing_schema" as const, inspections: [] };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <EmsInventorySwitch activeView="pediatric-bags" />

      <section className="rounded-xl border border-neutral-800 bg-[#242424] p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
          {departmentName ?? "EMS Inventory"}
        </p>
        <h1 className="mt-2 text-2xl font-black text-white">Pediatric Bags</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Four separate pediatric bags share one department checklist template. Each bag keeps its own
          inspection state and history.
        </p>
      </section>

      {bagsResult.status === "missing_schema" ? (
        <section className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-6">
          <p className="text-sm font-semibold text-amber-200">Pediatric Bags are not set up for this department yet.</p>
          <p className="mt-2 text-sm text-amber-100/80">
            The Pediatric Bags database foundation has not been applied yet. An administrator needs to apply the
            pediatric bags migration before checklists can be used. No data has been changed.
          </p>
        </section>
      ) : bagsResult.status === "unavailable" ? (
        <section className="rounded-xl border border-red-500/30 bg-red-950/20 p-6">
          <p className="text-sm font-semibold text-red-200">Pediatric Bags can't be reached right now.</p>
          <p className="mt-2 text-sm text-red-100/80">
            The app could not load pediatric bags from the connected project. This usually means a missing or
            invalid connection key, or the department could not be resolved — not that the feature is unconfigured.
            Check the local connection settings and try again.
          </p>
        </section>
      ) : (
        <PediatricBagsBrowser
          bags={bagsResult.bags}
          inspections={historyResult.inspections}
          canDeleteInspections={canDeleteInspections}
        />
      )}
    </div>
  );
}
