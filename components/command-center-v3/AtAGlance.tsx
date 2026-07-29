import { Truck, AlertCircle, AlertTriangle, Briefcase, GraduationCap, Award } from "lucide-react";

export default function AtAGlance() {
  const kpis = [
    { label: "APPARATUS READY", value: "3", icon: Truck, color: "#10B981" },
    { label: "NEEDS ATTENTION", value: "2", icon: AlertCircle, color: "#F59E0B" },
    { label: "OUT OF SERVICE", value: "0", icon: AlertTriangle, color: "#EF2B2D" },
    { label: "ACTIVE DEFICIENCIES", value: "4", icon: Briefcase, color: "#EF2B2D" },
    { label: "TRAINING DUE", value: "6", icon: GraduationCap, color: "#F59E0B" },
    { label: "CERTIFICATIONS EXPIRING", value: "5", icon: Award, color: "#EF2B2D" },
  ];

  return (
    <section className="relative flex h-full flex-col rounded-[20px] border border-[rgba(255,255,255,0.08)] bg-[#111111] p-6 shadow-lg">
      {/* Header */}
      <p className="text-[14px] font-[600] uppercase tracking-[1px] text-[#A1A1AA]">
        At A Glance
      </p>

      {/* KPI Cards */}
      <div className="mt-4 flex flex-1 flex-col justify-between gap-[7px]">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="flex items-center justify-between py-[2px]">
              <div className="flex flex-1 items-center gap-3">
                <Icon size={17} style={{ color: kpi.color, flexShrink: 0 }} strokeWidth={2.5} />
                <span className="truncate text-[11px] font-[600] tracking-[0.04em] text-[#A1A1AA]">{kpi.label}</span>
              </div>
              <div
                className="ml-2 flex h-7 w-[42px] flex-shrink-0 items-center justify-center rounded-[9px] text-[16px] font-bold text-white"
                style={{ backgroundColor: `${kpi.color}1A`, borderLeft: `3px solid ${kpi.color}` }}
              >
                <span style={{ color: kpi.color, fontWeight: 700 }}>{kpi.value}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}