import {
  ClipboardCheck,
  GraduationCap,
  AlertTriangle,
  BarChart3,
  Truck,
  BookOpen,
} from "lucide-react";

export default function QuickActions() {
  const actions = [
    { title: "New Apparatus Check", icon: Truck },
    { title: "Log Training", icon: GraduationCap },
    { title: "Add Deficiency", icon: AlertTriangle },
    { title: "Add Training", icon: BookOpen },
    { title: "Create Report", icon: BarChart3 },
    { title: "Inventory", icon: ClipboardCheck },
  ];

  return (
    <section className="relative flex h-full flex-col rounded-[20px] border border-[rgba(255,255,255,0.08)] bg-[#111111] p-6 shadow-lg">
      {/* Header */}
      <p className="text-[14px] font-[600] uppercase tracking-[1px] text-[#A1A1AA]">
        Quick Actions
      </p>

      {/* Actions Grid - 3 columns */}
      <div className="mt-5 grid flex-1 grid-cols-3 gap-3">
        {actions.map(({ title, icon: Icon }) => (
          <button
            key={title}
            className="flex flex-col items-center justify-center gap-2 rounded-[12px] border-0 bg-transparent px-2 py-4 text-white transition hover:opacity-80"
          >
            <Icon className="h-8 w-8 text-[#EF2B2D]" strokeWidth={1.5} />
            <span className="text-[12px] font-[600] text-center leading-tight">{title}</span>
          </button>
        ))}
      </div>
    </section>
  );
}