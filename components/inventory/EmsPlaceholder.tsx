import EmsInventorySwitch from "@/components/inventory/EmsInventorySwitch";

type EmsPlaceholderProps = {
  title: string;
  activeView: "pediatric-bags" | "drug-box";
  departmentName: string | null;
};

export default function EmsPlaceholder({ title, activeView, departmentName }: EmsPlaceholderProps) {
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <EmsInventorySwitch activeView={activeView} />

      <section className="rounded-xl border border-neutral-800 bg-[#242424] p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
          {departmentName ?? "EMS Inventory"}
        </p>
        <h1 className="mt-2 text-2xl font-black text-white">{title}</h1>
        <p className="mt-3 text-sm text-neutral-300">
          This section is being prepared. Pediatric Bags and Drug Box tracking will live here.
        </p>
        <p className="mt-2 text-sm text-neutral-400">
          Use the buttons above to return to Supplies or Equipment.
        </p>
      </section>
    </div>
  );
}
