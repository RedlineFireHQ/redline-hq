import {
  ClipboardCheck,
  GraduationCap,
  BadgeCheck,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";

export default function ActivityPanel() {
  const activities = [
    {
      id: 1,
      icon: ClipboardCheck,
      title: "Daily Inspection Completed",
      description: "Engine 430 inspection completed by A. Smith",
      timestamp: "5 min ago",
    },
    {
      id: 2,
      icon: AlertTriangle,
      title: "Deficiency Reported",
      description: "Engine 432 - Front intake valve leaking",
      timestamp: "12 min ago",
    },
    {
      id: 3,
      icon: GraduationCap,
      title: "Training Logged",
      description: "Pump Operations - 2.0 Hours by J. Williams",
      timestamp: "2 hr ago",
    },
    {
      id: 4,
      icon: BadgeCheck,
      title: "Certification Expiring",
      description: "CPR - 5 members expiring within 30 days",
      timestamp: "Yesterday",
    },
  ];

  return (
    <section className="relative flex h-full flex-col rounded-[20px] border border-[rgba(255,255,255,0.08)] bg-[#111111] p-6 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[16px] font-[700] uppercase tracking-[1.5px] text-white">
          Activity Feed
        </p>

        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-[#10B981]" />
          <span className="text-[12px] font-[700] text-[#10B981]">
            LIVE
          </span>
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="mt-5 grid flex-1 grid-cols-4 gap-4 overflow-hidden">
        {activities.map(({ id, icon: Icon, title, description, timestamp }) => (
          <div
            key={id}
            className="group flex min-w-0 cursor-pointer gap-3 rounded-[12px] border border-transparent bg-[#0d0d0d] p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#EF2B2D]/40 hover:bg-[#151515] hover:shadow-[0_0_18px_rgba(239,43,45,0.18)]"
          >
            <Icon
              className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#EF2B2D]"
              strokeWidth={2}
            />

            <div className="min-w-0">
              <p className="text-[14px] font-[600] text-white">
                {title}
              </p>

              <p className="mt-0.5 text-[13px] text-[#D4D4D8]">
                {description}
              </p>

              <p className="mt-1 text-[12px] font-medium text-[#C4C4C8]">
                {timestamp}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Footer Button */}
      <button className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-[12px] bg-gradient-to-r from-[#EF2B2D] to-[#C91C1E] text-[13px] font-[700] text-white transition-all duration-200 hover:brightness-110 hover:shadow-lg">
        View All Activity
        <ChevronRight className="h-4 w-4" />
      </button>
    </section>
  );
}