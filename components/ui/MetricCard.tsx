interface MetricCardProps {
  title: string;
  value: string | number;
  color?: string;
}

export default function MetricCard({
  title,
  value,
  color = "text-white",
}: MetricCardProps) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-[#2E2E2E] px-3 py-4 transition-all duration-300 hover:border-[#E1181B] hover:shadow-lg">
      <p className={`text-2xl font-black leading-none ${color}`}>
        {value}
      </p>

      <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-300">
        {title}
      </p>
    </div>
  );
}