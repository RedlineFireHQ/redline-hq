import {
  Award,
  Truck,
  Package,
  ChevronRight,
} from "lucide-react";
import PrimaryActionButton from "./PrimaryActionButton";

export default function AlertsPanel() {
  const alerts = [
    {
      id: 1,
      category: "Certifications",
      title: "2 Certifications Expire This Month",
      status: "Due Jul 31",
      severity: "critical",
      icon: Award,
    },
    {
      id: 2,
      category: "Apparatus",
      title: "Engine 430 Inspection Due",
      status: "Due Today",
      severity: "warning",
      icon: Truck,
    },
    {
      id: 3,
      category: "Inventory",
      title: "SCBA Masks Running Low",
      status: "3 Remaining",
      severity: "warning",
      icon: Package,
    },
  ];

  return (
 <section className="relative h-full overflow-hidden rounded-[22px] border border-white/10 bg-[#101010] shadow-[0_20px_60px_rgba(0,0,0,.45)]">

      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#171717] via-[#121212] to-[#171717]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_35%,rgba(180,0,0,.08),transparent_55%)]" />

      <div className="relative z-10 flex h-full flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3">

          <h2 className="text-[16px] font-semibold uppercase tracking-[.12em] text-white">
            DEPARTMENT ALERTS
          </h2>

          <div className="flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1">

            <div className="h-2 w-2 rounded-full bg-red-500" />

            <span className="text-[10px] font-bold uppercase tracking-[.08em] text-red-400">
              {alerts.length} Active
            </span>

          </div>

        </div>

        {/* Alert List */}
        <div className="flex-1 px-5">

          {alerts.map((alert) => {

            const Icon = alert.icon;
            const critical = alert.severity === "critical";

            return (
              <button
                key={alert.id}
                className="group relative flex w-full items-center gap-3 border-b border-white/10 py-2.5 text-left transition-all duration-300 hover:bg-white/[0.04]"
              >

                {/* Severity Bar */}
                <div
                  className={`absolute left-0 top-1/2 h-4 -translate-y-1/2 w-[3px] rounded-full ${
                    critical ? "bg-red-500" : "bg-amber-400"
                  }`}
                />

                {/* Icon */}
                <div
                  className={`ml-3 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
                    critical
                      ? "bg-red-500/10"
                      : "bg-amber-500/10"
                  }`}
                >
                  <Icon
                    size={16}
                    className={
                      critical
                        ? "text-red-400"
                        : "text-amber-300"
                    }
                  />
                </div>

                {/* Text */}
                <div className="min-w-0 flex-1">

                  <div className="text-[10px] font-semibold uppercase tracking-[.12em] text-neutral-500">
                    {alert.category}
                  </div>

                  <div className="mt-0.5 truncate text-[14px] font-semibold text-white">
                    {alert.title}
                  </div>

                  <div
                    className={`mt-0.5 text-[12px] font-medium ${
                      critical
                        ? "text-red-400"
                        : "text-amber-300"
                    }`}
                  >
                    {alert.status}
                  </div>

                </div>

                <ChevronRight
                  size={17}
                  className="mr-1 flex-shrink-0 text-neutral-500 transition-all duration-300 group-hover:translate-x-1 group-hover:text-white"
                />

              </button>
            );

          })}

        </div>

        {/* Footer */}
        <div className="border-t border-white/10 px-5 py-2">
          <PrimaryActionButton label="View All Alerts" />

        </div>

      </div>

      {/* Accent */}
      <div className="pointer-events-none absolute left-0 top-16 h-[160px] w-[2px] rounded-full bg-red-600/70 blur-[1px]" />

      <div className="pointer-events-none absolute bottom-0 left-1/2 h-20 w-[60%] -translate-x-1/2 bg-red-600/10 blur-3xl" />

      <div className="pointer-events-none absolute inset-0 rounded-[22px] ring-1 ring-inset ring-white/5" />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

    </section>
  );
}