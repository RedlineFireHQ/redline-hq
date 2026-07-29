export default function TopBar() {
  const now = new Date();

  const date = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const time = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <header className="sticky top-0 z-30 flex h-24 items-center justify-between border-b border-neutral-800 bg-[#050505] px-8">
      {/* LEFT */}
      <div className="flex flex-col justify-center">
        <h1 className="text-[56px] font-black uppercase tracking-tight leading-none text-white">
          COMMAND CENTER
        </h1>

        <div className="mt-2 flex items-center gap-4 text-[15px] uppercase tracking-[0.14em] text-neutral-400">
          <span>{date}</span>
          <span className="text-neutral-600">|</span>
          <span>{time}</span>
        </div>
      </div>

      {/* RIGHT */}
      <div className="flex items-center gap-4">
        {/* Notification */}
        <button className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-neutral-700 bg-[#111827] transition hover:border-red-500">
          <span className="text-2xl">🔔</span>

          <span className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">
            3
          </span>
        </button>

        {/* User */}
        <button className="flex h-16 min-w-[240px] items-center justify-between rounded-2xl border border-neutral-700 bg-[#111827] px-5 transition hover:border-red-500">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-red-600 bg-neutral-900 text-base font-bold text-white">
              EV
            </div>

            <div className="text-left">
              <p className="text-[30px] font-bold leading-none text-white">
                Adam Smith
              </p>

              <p className="mt-1 text-sm text-neutral-400">
                Administrator
              </p>
            </div>
          </div>

          <span className="text-xl text-neutral-500">⌄</span>
        </button>
      </div>
    </header>
  );
}