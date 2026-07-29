import SectionHeader from "./SectionHeader";

const missions = [
  {
    title: "Apparatus Checks",
    value: "4 / 5",
    color: "text-green-400",
  },
  {
    title: "Open Deficiencies",
    value: "1",
    color: "text-red-400",
  },
  {
    title: "Training Tonight",
    value: "1900",
    color: "text-blue-400",
  },
  {
    title: "Readiness Goal",
    value: "95%",
    color: "text-amber-400",
  },
];

export default function TodaysMission() {
  return (
    <section className="flex h-full flex-col overflow-hidden rounded-3xl border border-zinc-800 bg-[#101010]">

      <SectionHeader
        eyebrow="Today's Mission"
        title="Mission"
      />

      <div className="flex-1 p-4">

        <div className="space-y-3">

          {missions.map((mission) => (
            <div
              key={mission.title}
              className="rounded-2xl border border-zinc-800 bg-[#161616] px-4 py-3 transition hover:border-red-500/40"
            >
              <div className="flex items-center justify-between">

                <div>

                  <div className="text-sm font-semibold text-white">
                    {mission.title}
                  </div>

                  <div className="mt-1 text-[11px] uppercase tracking-[0.25em] text-zinc-500">
                    TODAY
                  </div>

                </div>

                <div className={`text-2xl font-black ${mission.color}`}>
                  {mission.value}
                </div>

              </div>
            </div>
          ))}

        </div>

      </div>

    </section>
  );
}