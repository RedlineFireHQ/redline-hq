import SectionHeader from "./SectionHeader";

const alerts = [
  {
    title: "EMT Certifications",
    description: "2 members expire within 30 days",
    severity: "HIGH",
  },
  {
    title: "SCBA Fit Testing",
    description: "4 members require annual fit testing",
    severity: "MEDIUM",
  },
  {
    title: "Engine 432 Maintenance",
    description: "Pump service due next week",
    severity: "LOW",
  },
  {
    title: "Monthly Training",
    description: "Fire Behavior class • Thursday 1900",
    severity: "INFO",
  },
];

export default function DepartmentAlerts() {
  return (
    <section className="overflow-hidden rounded-3xl border border-zinc-800 bg-[#111111]">
      <SectionHeader
        eyebrow="Alerts"
        title="Department Alerts"
        subtitle="Items requiring attention"
      />

      <div className="space-y-4 p-6">
        {alerts.map((alert) => (
          <div
            key={alert.title}
            className="rounded-2xl border border-zinc-800 bg-[#171717] p-5 transition hover:border-red-500/40"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white">
                  {alert.title}
                </h3>

                <p className="mt-2 text-sm text-zinc-400">
                  {alert.description}
                </p>
              </div>

              <span
                className={`rounded-full px-3 py-1 text-xs font-bold tracking-[0.2em] ${
                  alert.severity === "HIGH"
                    ? "bg-red-500/15 text-red-400"
                    : alert.severity === "MEDIUM"
                    ? "bg-amber-500/15 text-amber-400"
                    : alert.severity === "LOW"
                    ? "bg-green-500/15 text-green-400"
                    : "bg-blue-500/15 text-blue-400"
                }`}
              >
                {alert.severity}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}