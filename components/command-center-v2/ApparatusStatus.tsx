import SectionHeader from "./SectionHeader";

const apparatus = [
  {
    name: "Engine 430",
    officer: "Capt. Smith",
    status: "READY",
    updated: "07:12 AM",
  },
  {
    name: "Engine 432",
    officer: "Lt. Johnson",
    status: "READY",
    updated: "07:28 AM",
  },
  {
    name: "Tanker 445",
    officer: "Pending",
    status: "SERVICE",
    updated: "--",
  },
  {
    name: "Grass 420",
    officer: "FF Brown",
    status: "READY",
    updated: "08:03 AM",
  },
  {
    name: "Grass 421",
    officer: "FF Davis",
    status: "READY",
    updated: "08:15 AM",
  },
];

export default function ApparatusStatus() {
  return (
    <section className="overflow-hidden rounded-3xl border border-zinc-800 bg-[#111111]">
      <SectionHeader
        eyebrow="Fleet Status"
        title="Apparatus Readiness"
        subtitle="Current operational status"
      />

      <div className="grid grid-cols-4 border-b border-zinc-800 bg-[#181818] px-6 py-4 text-xs font-bold uppercase tracking-[0.25em] text-zinc-500">
        <div>Apparatus</div>
        <div>Officer</div>
        <div>Status</div>
        <div>Updated</div>
      </div>

      <div className="divide-y divide-zinc-800">
        {apparatus.map((truck) => (
          <div
            key={truck.name}
            className="grid grid-cols-4 items-center px-6 py-5 transition hover:bg-white/[0.02]"
          >
            <div className="text-lg font-bold text-white">
              {truck.name}
            </div>

            <div className="text-zinc-400">
              {truck.officer}
            </div>

            <div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold tracking-wider ${
                  truck.status === "READY"
                    ? "bg-green-500/15 text-green-400"
                    : "bg-red-500/15 text-red-400"
                }`}
              >
                {truck.status}
              </span>
            </div>

            <div className="text-sm text-zinc-500">
              {truck.updated}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}