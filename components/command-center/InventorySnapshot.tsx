export default function InventorySnapshot() {
  const inventory = [
    { item: "SCBA Bottles", value: "24 / 24", status: "Good" },
    { item: "Medical Bags", value: "6 / 6", status: "Good" },
    { item: "Foam Supply", value: "72%", status: "Monitor" },
    { item: "Fuel Level", value: "91%", status: "Good" },
  ];

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-red-500">
            Inventory Snapshot
          </p>

          <h2 className="mt-3 text-3xl font-bold text-white">
            Inventory
          </h2>

          <p className="mt-2 text-sm text-neutral-400">
            Critical equipment overview.
          </p>
        </div>

        <div className="rounded-full bg-red-900/40 px-4 py-2">
          <span className="text-sm font-semibold text-red-300">
            4 Items
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {inventory.map((item) => (
          <div
            key={item.item}
            className="flex items-center justify-between rounded-xl bg-neutral-900 px-4 py-3"
          >
            <div>
              <p className="font-semibold text-white">
                {item.item}
              </p>

              <p className="text-sm text-neutral-400">
                {item.value}
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                item.status === "Good"
                  ? "bg-green-900 text-green-300"
                  : "bg-yellow-900 text-yellow-300"
              }`}
            >
              {item.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}