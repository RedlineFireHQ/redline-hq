export default function Weather() {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 shadow-xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-red-500">
            Weather
          </p>

          <h2 className="mt-3 text-3xl font-bold text-white">
            Current Conditions
          </h2>

          <p className="mt-2 text-sm text-neutral-400">
            Elliott, Iowa
          </p>
        </div>

        <div className="text-right">
          <p className="text-5xl font-bold text-white">78°</p>
          <p className="text-sm text-neutral-400">Sunny</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-neutral-900 p-3 text-center">
          <p className="text-xs uppercase text-neutral-500">Wind</p>
          <p className="mt-2 text-xl font-bold text-white">12 mph</p>
        </div>

        <div className="rounded-xl bg-neutral-900 p-3 text-center">
          <p className="text-xs uppercase text-neutral-500">Humidity</p>
          <p className="mt-2 text-xl font-bold text-white">58%</p>
        </div>

        <div className="rounded-xl bg-neutral-900 p-3 text-center">
          <p className="text-xs uppercase text-neutral-500">Rain</p>
          <p className="mt-2 text-xl font-bold text-white">0%</p>
        </div>
      </div>
    </div>
  );
}