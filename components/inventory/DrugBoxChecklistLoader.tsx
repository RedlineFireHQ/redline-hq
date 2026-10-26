import DrugBoxChecklistWorkspace from "@/components/inventory/DrugBoxChecklistWorkspace";
import type { DrugBoxRecord } from "@/lib/drug-boxes/data";

/**
 * Renders a fresh inspection checklist for a squad drug box. A new inspection
 * always starts with every item unchecked.
 */
export default function DrugBoxChecklistLoader({ box }: { box: DrugBoxRecord }) {
  return <DrugBoxChecklistWorkspace box={box} />;
}
