import { department } from "@/lib/department";

export default function TopBar() {
  const today = new Date();

  const formattedDate = today.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <header className="sticky top-0 z-20 border-b border-neutral-800/80 bg-neutral-950/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-red-500 shadow-lg shadow-red-500/50" />

            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-red-500">
              Command Center
            </p>
          </div>

          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">
            {department.name}
          </h1>

          <p className="mt-2 text-sm text-neutral-400">
            Firefighter-built software focused on operational readiness.
          </p>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-900/70 px-5 py-4 text-right shadow-lg">
          <p className="text-xs uppercase tracking-widest text-neutral-500">
            Today
          </p>

          <p className="mt-1 text-sm text-neutral-300">
            {formattedDate}
          </p>

          <div className="my-3 h-px bg-neutral-800" />

          <p className="text-xs uppercase tracking-widest text-neutral-500">
            Signed In
          </p>

          <p className="mt-1 text-lg font-semibold text-white">
            Adam
          </p>
        </div>
      </div>
    </header>
  );
}