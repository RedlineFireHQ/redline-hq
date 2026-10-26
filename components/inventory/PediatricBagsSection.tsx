import EmsInventorySwitch from "@/components/inventory/EmsInventorySwitch";
import PediatricBagsBrowser from "@/components/inventory/PediatricBagsBrowser";
import { getCurrentMember } from "@/lib/current-member";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getPediatricBagsForDepartment, getPediatricInspectionHistory } from "@/lib/pediatric-bags/data";

type PediatricBagsSectionProps = {
  departmentName: string | null;
  departmentId: string | null;
};

/**
 * Pediatric Bags content rendered within the EMS Supplies page (Inventory → EMS
 * Supplies → Pediatric Bags). Reuses the existing picker, history, and data
 * functions; scoped to the active department. Read-heavy but writes nothing.
 */
export default async function PediatricBagsSection({ departmentName, departmentId }: PediatricBagsSectionProps) {
  const supabase = await createSupabaseServerClient();
  const currentMember = await getCurrentMember(supabase);

  // Delete visibility: only an Administrator of the ACTIVE department.
  const canDeleteInspections =
    currentMember?.role === "administrator" && currentMember.departmentId === departmentId;

  const bagsResult = departmentId
    ? await getPediatricBagsForDepartment(supabase, departmentId)
    : { status: "missing_schema" as const, bags: [] };

  const historyResult = departmentId
    ? await getPediatricInspectionHistory(supabase, departmentId)
    : { status: "missing_schema" as const, inspections: [] };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-red-500">Inventory</p>
        <h1 className="mt-2 text-[2.25rem] font-[700] leading-none tracking-[-0.06em] text-white">EMS Supplies</h1>
        <p className="mt-3 max-w-2xl text-lg text-neutral-400">
          Pediatric Bags — {departmentName ? `${departmentName}` : "department"} checklist inventory.
        </p>
      </div>

      <EmsInventorySwitch activeView="pediatric-bags" />

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
            The app could not load pediatric bags from the connected project. Check the connection settings and try
            again.
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
