export default function ReadinessHero() {
  return (
    <section className="relative h-full overflow-hidden rounded-3xl border border-zinc-800 bg-[#0f1012]">

      {/* Glow */}

      <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-red-600/10 blur-3xl" />

      <div className="relative flex h-full">

        {/* LEFT */}

        <div className="flex w-[58%] flex-col justify-between p-6">

          <div>

            <div className="text-[10px] font-bold uppercase tracking-[0.4em] text-red-500">
              COMMAND CENTER
            </div>

            <h1 className="mt-2 text-3xl font-black text-white">
              Elliott Fire Department
            </h1>

            <p className="mt-3 max-w-sm text-sm leading-6 text-zinc-400">
              Department readiness is high. One apparatus still requires
              inspection before today's operational goals are complete.
            </p>

          </div>

          <div className="flex items-center gap-6">

            {/* Readiness Circle */}

            <div className="relative flex h-32 w-32 items-center justify-center rounded-full border-[10px] border-red-500">

              <div className="text-center">

                <div className="text-4xl font-black text-white">
                  91
                </div>

                <div className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">
                  READY
                </div>

              </div>

            </div>

            {/* Stats */}

            <div className="grid grid-cols-2 gap-x-8 gap-y-4">

              <div>
                <div className="text-3xl font-black text-white">
                  18
                </div>
                <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">
                  MEMBERS
                </div>
              </div>

              <div>
                <div className="text-3xl font-black text-white">
                  5
                </div>
                <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">
                  APPARATUS
                </div>
              </div>

              <div>
                <div className="text-3xl font-black text-red-500">
                  4
                </div>
                <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">
                  ALERTS
                </div>
              </div>

              <div>
                <div className="text-3xl font-black text-white">
                  22
                </div>
                <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">
                  TRAINING
                </div>
              </div>

            </div>

          </div>

        </div>

        {/* RIGHT */}

        <div className="flex flex-1 items-end justify-center overflow-hidden">

          <img
            src="/images/firefighter-hero.png"
            alt="Firefighter"
            className="h-[102%] object-contain object-bottom"
          />

        </div>

      </div>

    </section>
  );
}