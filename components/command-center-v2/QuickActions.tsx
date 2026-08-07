import SectionHeader from "./SectionHeader";

const actions = [
  {
    title: "Apparatus Checks",
    subtitle: "Inspect apparatus",
    icon: "🚒",
  },
  {
    title: "Members",
    subtitle: "Personnel roster",
    icon: "👨‍🚒",
  },
  {
    title: "Training",
    subtitle: "Log & review",
    icon: "🎓",
  },
  {
    title: "Reports",
    subtitle: "Department analytics",
    icon: "📊",
  },
  {
    title: "Inventory",
    subtitle: "Equipment status",
    icon: "📦",
  },
  {
    title: "Certifications",
    subtitle: "Expiration tracking",
    icon: "✅",
  },
];

export default function QuickActions() {
  return (
    <section className="overflow-hidden rounded-3xl border border-zinc-800 bg-[#111111]">
      <SectionHeader
        eyebrow="Navigation"
        title="Quick Actions"
        subtitle="Jump directly to any module"
      />

      <div className="grid grid-cols-2 gap-5 p-6">
        {actions.map((action) => (
          <button
            key={action.title}
            className="group rounded-2xl border border-zinc-800 bg-[#171717] p-6 text-left transition-all duration-200 hover:-translate-y-1 hover:border-red-500 hover:bg-[#1b1b1b]"
          >
            <div className="text-5xl">
              {action.icon}
            </div>

            <h3 className="mt-5 text-xl font-bold text-white transition group-hover:text-red-400">
              {action.title}
            </h3>

            <p className="mt-2 text-sm text-zinc-500">
              {action.subtitle}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}