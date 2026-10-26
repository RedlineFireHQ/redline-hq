import DrugInspectionDetail from "@/components/inventory/DrugInspectionDetail";
import type { DrugInspectionRecord } from "@/lib/drug-boxes/data";

/**
 * Renders a completed drug box inspection's permanent snapshot (read-only).
 * The snapshot is loaded server-side, scoped to the active department.
 */
export default function DrugInspectionDetailLoader({ inspection }: { inspection: DrugInspectionRecord }) {
  return <DrugInspectionDetail inspection={inspection} />;
}
