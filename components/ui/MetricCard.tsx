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
    <div className="rounded-2xl border border-neutral-800 bg-[#2E2E2E] p-6 transition-all duration-300 hover:border-[#E1181B] hover:shadow-lg">
      <p className={`text-4xl font-black ${color}`}>
        {value}
      </p>

      <p className="mt-3 text-xs uppercase tracking-[0.25em] text-neutral-500">
        {title}
      </p>
    </div>
  );
}