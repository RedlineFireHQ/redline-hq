import SectionHeader from "./SectionHeader";

const inventory = [
  {
    item: "Trauma Bags",
    quantity: "6",
    status: "READY",
  },
  {
    item: "SCBA Bottles",
    quantity: "18",
    status: "READY",
  },
  {
    item: "Medical Oxygen",
    quantity: "2",
    status: "LOW",
  },
  {
    item: "Foam Concentrate",
    quantity: "8",
    status: "READY",
  },
];

export default function InventorySnapshot() {
  return (
    <section className="overflow-hidden rounded-3xl border border-zinc-800 bg-[#111111]">
      <SectionHeader
        eyebrow="Inventory"
        title="Equipment Snapshot"
        subtitle="Critical supply status"
      />

      <div className="divide-y divide-zinc-800">
        {inventory.map((item) => (
          <div
            key={item.item}
            className="flex items-center justify-between px-6 py-5 transition hover:bg-white/[0.02]"
          >
            <div>
              <h3 className="text-lg font-bold text-white">
                {item.item}
              </h3>

              <p className="mt-1 text-sm text-zinc-500">
                Quantity: {item.quantity}
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-bold tracking-[0.2em] ${
                item.status === "READY"
                  ? "bg-green-500/15 text-green-400"
                  : "bg-red-500/15 text-red-400"
              }`}
            >
              {item.status}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}