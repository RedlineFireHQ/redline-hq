import DrugBoxPicker from "@/components/inventory/DrugBoxPicker";
import DrugInspectionHistory from "@/components/inventory/DrugInspectionHistory";
import type { DrugBoxRecord, DrugInspectionSummary } from "@/lib/drug-boxes/data";

type DrugBoxSectionProps = {
  departmentName: string | null;
  boxes: DrugBoxRecord[];
  inspections: DrugInspectionSummary[];
  canDelete: boolean;
};

/**
 * Drug Box landing content within EMS Inventory: the four squad boxes and the
 * inspection history. Data is loaded server-side, scoped to the active
 * department, and passed in as props.
 */
export default function DrugBoxSection({ departmentName, boxes, inspections, canDelete }: DrugBoxSectionProps) {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-red-500">EMS Inventory</p>
        <h1 className="mt-2 text-[2.25rem] font-[700] leading-none tracking-[-0.06em] text-white">Drug Box</h1>
        <p className="mt-3 max-w-2xl text-lg text-neutral-400">
          {departmentName ? `${departmentName} — ` : ""}Squad drug box presence inspections (Units 114–117).
        </p>
      </div>

      <DrugBoxPicker boxes={boxes} />

      <DrugInspectionHistory inspections={inspections} canDelete={canDelete} />
    </div>
  );
}
