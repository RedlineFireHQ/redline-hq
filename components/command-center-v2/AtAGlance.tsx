import SectionHeader from "./SectionHeader";

const stats = [
  {
    title: "Department Readiness",
    value: "91%",
    color: "text-red-500",
  },
  {
    title: "Personnel",
    value: "18",
    color: "text-white",
  },
  {
    title: "Apparatus",
    value: "5",
    color: "text-white",
  },
  {
    title: "Open Alerts",
    value: "4",
    color: "text-amber-400",
  },
];

export default function AtAGlance() {
  return (
    <section className="flex h-full flex-col overflow-hidden rounded-3xl border border-zinc-800 bg-[#101010]">

      <SectionHeader
        eyebrow="Overview"
        title="At A Glance"
      />

      <div className="grid flex-1 grid-cols-1 gap-3 p-4">

        {stats.map((stat) => (
          <div
            key={stat.title}
            className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-[#161616] px-4 transition hover:border-red-500/40"
          >

            <div>

              <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-zinc-500">
                {stat.title}
              </div>

              <div className={`mt-1 text-3xl font-black ${stat.color}`}>
                {stat.value}
              </div>

            </div>

            <div className="h-10 w-1 rounded-full bg-red-500/70" />

          </div>
        ))}

      </div>

    </section>
  );
}