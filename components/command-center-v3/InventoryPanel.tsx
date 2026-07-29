import { ChevronRight, Droplets, ShieldAlert, ShieldCheck, Wrench } from "lucide-react";

export default function InventoryPanel() {
  const inventoryStats = [
    {
      id: 1,
      label: "Medical",
      count: "847",
      suffix: "Items",
      icon: Droplets,
      color: "#10B981",
    },
    {
      id: 2,
      label: "SCBA",
      count: "156",
      suffix: "Items",
      icon: ShieldCheck,
      color: "#F59E0B",
    },
    {
      id: 3,
      label: "Fire Hose",
      count: "92",
      suffix: "Sections",
      icon: ShieldAlert,
      color: "#EF2B2D",
    },
    {
      id: 4,
      label: "Vehicle",
      count: "189",
      suffix: "Items",
      icon: Wrench,
      color: "#A1A1AA",
    },
  ];

  return (
    <section className="relative flex h-full flex-col rounded-[20px] border border-[rgba(255,255,255,0.08)] bg-[#111111] p-6 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[14px] font-[600] uppercase tracking-[1px] text-[#A1A1AA]">
          Inventory Snapshot
        </p>
        <button className="flex items-center gap-1 text-[14px] font-[600] text-[#EF2B2D] transition hover:text-white">
          View Inventory
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Inventory Stats Grid */}
      <div className="mt-5 grid flex-1 grid-cols-4 gap-3">
        {inventoryStats.map(({ id, label, count, suffix, icon: Icon, color }) => (
          <div key={id} className="flex min-h-[126px] flex-col rounded-[14px] border border-[rgba(255,255,255,0.08)] bg-[#0d0d0d] px-4 py-4">
            <div className="flex items-start justify-between">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-[12px]"
                style={{ backgroundColor: `${color}1F`, color }}
              >
                <Icon size={19} strokeWidth={2.25} />
              </div>
              <p className="text-[28px] font-[800] leading-none text-white">{count}</p>
            </div>
            <p className="mt-4 text-[12px] font-[600] uppercase tracking-[0.08em] text-[#A1A1AA]">{label}</p>
            <p className="mt-1 text-[12px] text-[#A1A1AA]">{suffix}</p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-4 border-t border-[rgba(255,255,255,0.08)] pt-3 text-[14px] text-[#A1A1AA]">
        <p>
          <span className="text-white font-bold">1,284 Total Items</span> • 12 Low Stock • 2 Critical
        </p>
      </div>
    </section>
  );
}