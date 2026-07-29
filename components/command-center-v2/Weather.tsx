import SectionHeader from "./SectionHeader";

export default function Weather() {
  return (
    <section className="overflow-hidden rounded-3xl border border-zinc-800 bg-[#111111]">
      <SectionHeader
        eyebrow="Weather"
        title="Current Conditions"
        subtitle="Council Bluffs, Iowa"
      />

      <div className="p-6">

        <div className="rounded-3xl border border-zinc-800 bg-[#171717] p-8 text-center">

          <div className="text-7xl">
            ☀️
          </div>

          <div className="mt-4 text-6xl font-black text-white">
            78°
          </div>

          <div className="mt-2 text-zinc-400">
            Sunny
          </div>

        </div>

        <div className="mt-6 grid grid-cols-2 gap-4">

          <div className="rounded-2xl border border-zinc-800 bg-[#171717] p-5 text-center">

            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">
              Wind
            </div>

            <div className="mt-2 text-2xl font-black text-white">
              12 MPH
            </div>

          </div>

          <div className="rounded-2xl border border-zinc-800 bg-[#171717] p-5 text-center">

            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">
              Humidity
            </div>

            <div className="mt-2 text-2xl font-black text-white">
              61%
            </div>

          </div>

        </div>

      </div>
    </section>
  );
}