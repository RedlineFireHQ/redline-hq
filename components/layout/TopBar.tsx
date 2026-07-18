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
    <header className="flex items-center justify-between border-b border-neutral-800 bg-neutral-950 px-8 py-6">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-red-500">
          Command Center
        </p>

        <h1 className="mt-1 text-3xl font-bold text-white">
          {department.name}
        </h1>

        <p className="mt-2 text-neutral-400">
          Less Paperwork. More Readiness.
        </p>
      </div>

      <div className="text-right">
        <p className="text-sm text-neutral-500">
          {formattedDate}
        </p>

        <p className="mt-2 text-lg font-semibold text-white">
          Welcome back, Adam
        </p>
      </div>
    </header>
  );
}