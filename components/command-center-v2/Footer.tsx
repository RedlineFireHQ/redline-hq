export default function Footer() {
  return (
    <footer className="overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-r from-[#0b0b0b] via-[#141414] to-[#0b0b0b]">

      <div className="flex items-center justify-between px-8 py-8">

        <div>

          <p className="text-xs font-bold uppercase tracking-[0.45em] text-red-500">
            REDLINE HQ
          </p>

          <h2 className="mt-3 text-4xl font-black leading-tight text-white">
            LESS PAPERWORK.
            <br />
            MORE READINESS.
          </h2>

          <p className="mt-4 max-w-xl text-zinc-500">
            Built by firefighters for firefighters.
          </p>

        </div>

        <div className="flex gap-12">

          <div className="text-center">

            <div className="text-5xl font-black text-red-500">
              91%
            </div>

            <div className="mt-2 text-xs font-semibold uppercase tracking-[0.35em] text-zinc-500">
              Readiness
            </div>

          </div>

          <div className="text-center">

            <div className="text-5xl font-black text-white">
              18
            </div>

            <div className="mt-2 text-xs font-semibold uppercase tracking-[0.35em] text-zinc-500">
              Members
            </div>

          </div>

          <div className="text-center">

            <div className="text-5xl font-black text-white">
              5
            </div>

            <div className="mt-2 text-xs font-semibold uppercase tracking-[0.35em] text-zinc-500">
              Apparatus
            </div>

          </div>

        </div>

      </div>

    </footer>
  );
}